import { ShipProject, ProjectStage, ShipyardDock } from "./types";

export interface SolverTask {
  projectId: string;
  projectName: string;
  stageName: string;
  durationDays: number;
  length: number;    // 米
  width: number;     // 米
  laborRequired: number; // 每天班组所需人数
  dependencies: string[]; // 依赖的前置 (projectId_stageName) ID
}

export interface SolverAllocation {
  projectId: string;
  projectName: string;
  stageName: string;
  startDayOffset: number; // 距离拟排程第一天的偏移天数
  endDayOffset: number;
  startDateStr: string;
  endDateStr: string;
  dockId: string;
  dockName: string;
  coordX: number; // 船坞内定位 X (米)
  coordY: number; // 船坞内定位 Y (米)
}

export interface SolverResult {
  success: boolean;
  allocations: SolverAllocation[];
  dailyLaborTrack: { [day: number]: number };
  logs: string[];
}

/**
 * Helper to parse a date into day-count offset from a base date (e.g. 2026-05-01)
 */
export function dateToDayOffset(dateStr: string, baseDateStr = "2026-05-01"): number {
  const base = new Date(baseDateStr).getTime();
  const target = new Date(dateStr).getTime();
  const diffTime = target - base;
  return Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
}

/**
 * Helper to format a day offset back to a YYYY-MM-DD date string
 */
export function dayOffsetToDate(offsetDays: number, baseDateStr = "2026-05-01"): string {
  const base = new Date(baseDateStr);
  base.setDate(base.getDate() + offsetDays);
  return base.toISOString().split("T")[0];
}

/**
 * Helper to infer length & width of project based on vessel type / deadweight tons
 */
export function getVesselDimensions(project: ShipProject): { length: number; width: number } {
  if (project.vesselType === "LNG Carrier") {
    return { length: 290, width: 45 };
  } else if (project.vesselType === "Bulk Carrier") {
    return { length: 225, width: 32 };
  } else if (project.vesselType === "Container Vessel") {
    return { length: 295, width: 32 };
  } else if (project.vesselType === "Oil Tanker") {
    return { length: 330, width: 60 };
  }
  // Safe default fallback formula based on Deadweight Tonnage (DWT)
  const length = Math.round(100 + Math.sqrt(project.deadweightTons) * 0.5);
  const width = Math.round(15 + Math.sqrt(project.deadweightTons) * 0.08);
  return { length, width };
}

/**
 * Helper to infer stage labor requirements
 */
export function getStageLaborRequirements(stageName: string): number {
  const normalized = stageName.toLowerCase();
  if (normalized.includes("cutting") || normalized.includes("割")) return 20;
  if (normalized.includes("keel") || normalized.includes("龙骨")) return 15;
  if (normalized.includes("assembly") || normalized.includes("合拢") || normalized.includes("建造")) return 45;
  if (normalized.includes("launching") || normalized.includes("下水")) return 10;
  if (normalized.includes("outfitting") || normalized.includes("舾装")) return 30;
  if (normalized.includes("testing") || normalized.includes("海试") || normalized.includes("试")) return 25;
  return 20; // default
}

/**
 * TSK-201: CPM-based Topology Sort of tasks to schedule.
 * Detects and prevents cyclic dependencies.
 */
export function cpmTopologySort(tasks: SolverTask[]): SolverTask[] {
  const sorted: SolverTask[] = [];
  const visited = new Set<string>();
  const temp = new Set<string>();

  const taskMap = new Map<string, SolverTask>();
  for (const t of tasks) {
    taskMap.set(`${t.projectId}_${t.stageName}`, t);
  }

  function visit(taskId: string) {
    if (temp.has(taskId)) {
      throw new Error(`[CPM] 检测到工序循环依赖! 任务ID: ${taskId}`);
    }
    if (!visited.has(taskId)) {
      temp.add(taskId);
      const task = taskMap.get(taskId);
      if (task) {
        for (const depId of task.dependencies) {
          visit(depId);
        }
      }
      temp.delete(taskId);
      visited.add(taskId);
      if (task) {
        sorted.push(task);
      }
    }
  }

  for (const t of tasks) {
    const id = `${t.projectId}_${t.stageName}`;
    if (!visited.has(id)) {
      visit(id);
    }
  }

  return sorted;
}

/**
 * TSK-202 & TSK-203: Runs the Local Standalone Multi-Heuristic Solver Engine
 */
export function runApsSolver(
  projects: ShipProject[],
  docks: ShipyardDock[],
  resourceCap = 110, // Global maximum daily workforce cap (TSK-203)
  baseDateStr = "2026-05-01"
): SolverResult {
  const solverLogs: string[] = [];
  solverLogs.push(`[APS Engine] 启动工业级离线排产重排。基准日期: ${baseDateStr}, 人工上限: ${resourceCap} 人/天.`);

  // 1. Convert state items into flat ScheduleTask objects
  const tasksToSchedule: SolverTask[] = [];

  for (const proj of projects) {
    const { length, width } = getVesselDimensions(proj);
    
    // Order stages to set logical sequence dependencies automatically
    for (let i = 0; i < proj.stages.length; i++) {
      const stage = proj.stages[i];
      
      // Calculate active days duration for scheduling
      const startOffset = dateToDayOffset(stage.start, baseDateStr);
      const endOffset = dateToDayOffset(stage.end, baseDateStr);
      const duration = Math.max(1, endOffset - startOffset + 1);

      // Collect dependency: The immediately preceding stage of the same project
      const deps: string[] = [];
      if (i > 0) {
        deps.push(`${proj.id}_${proj.stages[i - 1].name}`);
      }

      tasksToSchedule.push({
        projectId: proj.id,
        projectName: proj.name,
        stageName: stage.name,
        durationDays: duration,
        length,
        width,
        laborRequired: getStageLaborRequirements(stage.name),
        dependencies: deps
      });
    }
  }

  // 2. Perform topological sorting (TSK-201)
  let sortedTasks: SolverTask[];
  try {
    sortedTasks = cpmTopologySort(tasksToSchedule);
    solverLogs.push(`[CPM] 拓扑排序完成，共处理 ${sortedTasks.length} 个建造阶段，无循环工序冲突。`);
  } catch (err: any) {
    solverLogs.push(`[CPM Error] 拓扑排序失败: ${err.message}. 降级为原始录入次序进行排产。`);
    sortedTasks = tasksToSchedule;
  }

  // 3. Initialize scheduling grids
  // dailyLaborTrack: day_offset -> current total allocated workers
  const dailyLaborTrack: { [day: number]: number } = {};

  // For 2D Spatial-Temporal allocation registry (TSK-202):
  // Tracks allocated coordinate rectangles: { [day]: { [dockId]: Array<{ x, y, length, width, taskId }> } }
  interface AllocationRect {
    x: number;
    y: number;
    length: number;
    width: number;
    taskId: string;
  }
  const spatialTemporalRegistry: { [day: number]: { [dockId: string]: AllocationRect[] } } = {};

  const finalAllocations: SolverAllocation[] = [];

  // Helper to find non-overlapping coordinates in dock for a particular range of days
  function findValid2DCoordinatesForDock(
    dock: ShipyardDock,
    taskLength: number,
    taskWidth: number,
    startDay: number,
    duration: number
  ): { x: number; y: number } | null {
    // We try to place the vessel in the dock (sized length x width)
    // To be computationally efficient and clean, we partition placement candidates
    // standard ribbon coordinate steps: 10 meter steps or fit-first at boundary (0,0) or next to existing vessels coordinates
    const candidates: Array<{ x: number; y: number }> = [{ x: 0, y: 0 }];
    
    // Scan all days to find existing allocated boundaries to use as tight packing coordinates
    for (let d = startDay; d < startDay + duration; d++) {
      const dayAllocations = spatialTemporalRegistry[d]?.[dock.id] || [];
      for (const rect of dayAllocations) {
        // Try placing to the right of this rect
        if (rect.x + rect.length + taskLength <= dock.length && rect.y + taskWidth <= dock.width) {
          candidates.push({ x: rect.x + rect.length, y: rect.y });
        }
        // Try placing above this rect
        if (rect.x + taskLength <= dock.length && rect.y + rect.width + taskWidth <= dock.width) {
          candidates.push({ x: rect.x, y: rect.y + rect.width });
        }
      }
    }

    // Sort candidates to prefer packing tightly near (0,0) index
    candidates.sort((a, b) => (a.x + a.y) - (b.x + b.y));

    for (const cand of candidates) {
      if (cand.x + taskLength > dock.length || cand.y + taskWidth > dock.width) {
        continue;
      }

      // Verify no overlap on any day in this interval [startDay, startDay + duration - 1]
      let overlap = false;
      for (let d = startDay; d < startDay + duration; d++) {
        const dayAllocations = spatialTemporalRegistry[d]?.[dock.id] || [];
        for (const rect of dayAllocations) {
          // AABB Collision overlap check:
          const overlapX = cand.x < rect.x + rect.length && cand.x + taskLength > rect.x;
          const overlapY = cand.y < rect.y + rect.width && cand.y + taskWidth > rect.y;
          if (overlapX && overlapY) {
            overlap = true;
            break;
          }
        }
        if (overlap) break;
      }

      if (!overlap) {
        return cand; // Found optimal packed coordinates
      }
    }

    return null; // Could not fit inside this dock for those days
  }

  // 4. Fit tasks into temporal & 2D spatial workspace, respecting daily labor cap
  for (const task of sortedTasks) {
    const taskId = `${task.projectId}_${task.stageName}`;
    
    // Find earliest allowed start day offset based on dependency completions
    let earliestStart = 0;
    for (const depId of task.dependencies) {
      const matchAlloc = finalAllocations.find(a => `${a.projectId}_${a.stageName}` === depId);
      if (matchAlloc) {
        earliestStart = Math.max(earliestStart, matchAlloc.endDayOffset + 1);
      }
    }

    let allocated = false;
    let candidateDay = earliestStart;
    let attemptLimit = 1000; // Limit sliding forward window to 1000 days to prevent infinite runs

    while (!allocated && attemptLimit-- > 0) {
      // Find candidate docks
      for (const dock of docks) {
        // Physical bounds quick verification
        if (task.length > dock.length || task.width > dock.width) {
          continue; // Larger than the dock's maximum bounds, continue
        }

        // TSK-203: Check if adding this task's labor on every day in the duration window violates resourceCap
        let laborCheckPassed = true;
        for (let d = candidateDay; d < candidateDay + task.durationDays; d++) {
          const projectedLabor = (dailyLaborTrack[d] || 0) + task.laborRequired;
          if (projectedLabor > resourceCap) {
            laborCheckPassed = false;
            break;
          }
        }

        if (!laborCheckPassed) {
          continue; // Try shifting day or next dock
        }

        // TSK-202: Check if fits spatial-temporally and unpack coordinate placement
        const coords = findValid2DCoordinatesForDock(dock, task.length, task.width, candidateDay, task.durationDays);
        if (coords !== null) {
          // Placement found! Lock and register resources
          for (let d = candidateDay; d < candidateDay + task.durationDays; d++) {
            // Allocate labor
            dailyLaborTrack[d] = (dailyLaborTrack[d] || 0) + task.laborRequired;

            // Register spatial position
            if (!spatialTemporalRegistry[d]) spatialTemporalRegistry[d] = {};
            if (!spatialTemporalRegistry[d][dock.id]) spatialTemporalRegistry[d][dock.id] = [];
            
            spatialTemporalRegistry[d][dock.id].push({
              x: coords.x,
              y: coords.y,
              length: task.length,
              width: task.width,
              taskId
            });
          }

          finalAllocations.push({
            projectId: task.projectId,
            projectName: task.projectName,
            stageName: task.stageName,
            startDayOffset: candidateDay,
            endDayOffset: candidateDay + task.durationDays - 1,
            startDateStr: dayOffsetToDate(candidateDay, baseDateStr),
            endDateStr: dayOffsetToDate(candidateDay + task.durationDays - 1, baseDateStr),
            dockId: dock.id,
            dockName: dock.name,
            coordX: coords.x,
            coordY: coords.y
          });

          solverLogs.push(`[APS solver] 成功排产 ${task.projectName} -> 阶段: ${task.stageName}. 进驻船坞: ${dock.name}. 开始日期: ${dayOffsetToDate(candidateDay, baseDateStr)}. 二维坐标: (${coords.x}米, ${coords.y}米).`);
          allocated = true;
          break; // successfully allocated this task
        }
      }

      if (!allocated) {
        // Shift candidate window by 1 day and retry (sliding temporal window)
        candidateDay++;
      }
    }

    if (!allocated) {
      solverLogs.push(`[APS Solver Warning] 无法为 ${task.projectName} 的阶段 ${task.stageName} 在有效尝试周期内找到合适空间或冗余用工。`);
    }
  }

  solverLogs.push(`[APS Solver Success] 离线二阶段拼图排程排产计算完成. 共成功放置 ${finalAllocations.length}/${tasksToSchedule.length} 个重工工位。`);

  return {
    success: true,
    allocations: finalAllocations,
    dailyLaborTrack,
    logs: solverLogs
  };
}
