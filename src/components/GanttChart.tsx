import React, { useState, useMemo } from "react";
import { ShipProject, ProjectStage, ShipyardDock } from "../types";
import { 
  Calendar, Ship, Plus, X, Gauge, ShieldAlert, Layers, Sliders, CalendarDays, Maximize2, Info 
} from "lucide-react";

interface GanttChartProps {
  projects: ShipProject[];
  docks: ShipyardDock[];
  onAddProject: (project: ShipProject) => void;
  onUpdateProjectProgress: (projectId: string, stageName: string, newProgress: number) => void;
  onSelectProject: (projectId: string) => void;
}

export function GanttChart({ projects, docks, onAddProject, onUpdateProjectProgress, onSelectProject }: GanttChartProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [activeTab, setActiveTab] = useState<string>("all");
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(projects[0]?.id || null);
  
  // View Modes: Detailed Slider Controls or 2D Graphic Gantt Chart Timeline (TSK-401)
  const [viewMode, setViewMode] = useState<"gantt" | "control">("gantt");
  
  // Date grains for Gantt timescale selector (TSK-401): "day" | "week" | "month" | "year"
  const [timeGrain, setTimeGrain] = useState<"day" | "week" | "month" | "year">("month");

  // Form State
  const [vesselName, setVesselName] = useState("");
  const [vesselType, setVesselType] = useState<"Bulk Carrier" | "LNG Carrier" | "Container Vessel" | "Oil Tanker">("Bulk Carrier");
  const [dwt, setDwt] = useState(82000);
  const [client, setClient] = useState("");
  const [dockId, setDockId] = useState(docks[0]?.id || "");
  const [startDate, setStartDate] = useState("2026-06-01");
  const [endDate, setEndDate] = useState("2026-11-30");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!vesselName || !client) {
      alert("请填写船舶名称与船东客户名称！");
      return;
    }

    // Generate timeline stages proportional to total duration
    const computedStages: ProjectStage[] = [
      { name: "钢板开割 (Steel Cutting)", start: startDate, end: addDays(startDate, 25), progress: 0, status: "pending" },
      { name: "起龙骨 (Keel Laying)", start: addDays(startDate, 26), end: addDays(startDate, 40), progress: 0, status: "pending" },
      { name: "船体合拢/分段建造 (Hull Assembly)", start: addDays(startDate, 41), end: addDays(startDate, 100), progress: 0, status: "pending" },
      { name: "下水仪式 (Vessel Launching)", start: addDays(startDate, 101), end: addDays(startDate, 110), progress: 0, status: "pending" },
      { name: "舾装/内装工程 (Outfitting)", start: addDays(startDate, 111), end: addDays(endDate, -20), progress: 0, status: "pending" },
      { name: "系泊与海试 (Testing & Sea Trials)", start: addDays(endDate, -19), end: endDate, progress: 0, status: "pending" }
    ];

    const newProj: ShipProject = {
      id: `proj-${Date.now()}`,
      name: vesselName,
      vesselType,
      deadweightTons: Number(dwt),
      start: startDate,
      end: endDate,
      progress: 0,
      currentStage: "Steel Cutting",
      dockId,
      client,
      stages: computedStages
    };

    onAddProject(newProj);
    setShowAddForm(false);
    resetForm();
  };

  const resetForm = () => {
    setVesselName("");
    setClient("");
    setDwt(82000);
    setStartDate("2026-06-01");
    setEndDate("2026-11-30");
  };

  const addDays = (dateStr: string, daysStr: number): string => {
    const d = new Date(dateStr);
    d.setDate(d.getDate() + daysStr);
    return d.toISOString().split("T")[0];
  };

  const filteredProjects = activeTab === "all" 
    ? projects 
    : projects.filter((p) => p.vesselType === activeTab);

  const selectedProject = projects.find(p => p.id === selectedProjectId) || projects[0];

  const getDockName = (dockId: string) => {
    return docks.find((d) => d.id === dockId)?.name || "外舾装锚地";
  };

  // ---------------------------------------------------------------------
  // Dynamic Time Dimension Calculation Logic for 2D Gantt View (TSK-401)
  // ---------------------------------------------------------------------
  const { minDate, maxDate, totalDays, spanMs } = useMemo(() => {
    let minD = new Date("2026-05-01");
    let maxD = new Date("2026-12-01");

    if (projects.length > 0) {
      const dates = projects.flatMap(p => [new Date(p.start), new Date(p.end)]);
      const minVal = Math.min(...dates.map(d => d.getTime()));
      const maxVal = Math.max(...dates.map(d => d.getTime()));
      // Give some extra days buffer padding at start and end
      minD = new Date(minVal - 10 * 24 * 3600 * 1000);
      maxD = new Date(maxVal + 20 * 24 * 3600 * 1000);
    }

    const diff = maxD.getTime() - minD.getTime();
    const days = Math.max(30, Math.ceil(diff / (24 * 3600 * 1000)));

    return {
      minDate: minD,
      maxDate: maxD,
      totalDays: days,
      spanMs: diff
    };
  }, [projects]);

  const getRelativeLeft = (dateStr: string) => {
    const t = new Date(dateStr).getTime();
    const diff = t - minDate.getTime();
    const raw = (diff / spanMs) * 100;
    return Math.min(100, Math.max(0, raw));
  };

  const getRelativeWidth = (startStr: string, endStr: string) => {
    const s = new Date(startStr).getTime();
    const e = new Date(endStr).getTime();
    const raw = ((e - s) / spanMs) * 100;
    return Math.min(100, Math.max(0.5, raw));
  };

  const getStageSegmentPercent = (proj: ShipProject, stage: ProjectStage) => {
    const pStart = new Date(proj.start).getTime();
    const pEnd = new Date(proj.end).getTime();
    const sStart = new Date(stage.start).getTime();
    const sEnd = new Date(stage.end).getTime();
    
    const projSpan = pEnd - pStart;
    const stageSpan = sEnd - sStart;
    
    if (projSpan <= 0) return 16.6;
    return Math.min(100, Math.max(5, (stageSpan / projSpan) * 100));
  };

  // Generate date labels/ticks based on zoom granularity (TSK-401)
  const ticks = useMemo(() => {
    const res: { label: string; offsetPercent: number }[] = [];
    const epoch = minDate.getTime();
    const dayMs = 24 * 3600 * 1000;

    if (timeGrain === "day") {
      // Show every 2 to 6 days dynamically to avoid vertical overlaps
      const step = totalDays > 120 ? 8 : totalDays > 60 ? 4 : 2;
      for (let i = 0; i < totalDays; i += step) {
        const d = new Date(epoch + i * dayMs);
        const m = d.getMonth() + 1;
        const dayNum = d.getDate();
        res.push({
          label: `${m.toString().padStart(2, "0")}/${dayNum.toString().padStart(2, "0")}`,
          offsetPercent: (i / totalDays) * 100
        });
      }
    } else if (timeGrain === "week") {
      // Weekly intervals
      const totalWeeks = Math.ceil(totalDays / 7);
      for (let i = 0; i < totalWeeks; i++) {
        const d = new Date(epoch + i * 7 * dayMs);
        const m = d.getMonth() + 1;
        res.push({
          label: `W${i + 1} (${m}/${d.getDate()})`,
          offsetPercent: ((i * 7) / totalDays) * 100
        });
      }
    } else if (timeGrain === "month") {
      // Monthly partitions
      let curr = new Date(minDate);
      curr.setDate(1); // align with month start
      while (curr.getTime() <= maxDate.getTime()) {
        const offset = ((curr.getTime() - epoch) / spanMs) * 100;
        if (offset >= 0 && offset <= 100) {
          res.push({
            label: `${curr.getFullYear()}年${curr.getMonth() + 1}月`,
            offsetPercent: offset
          });
        }
        curr.setMonth(curr.getMonth() + 1);
      }
    } else {
      // Yearly intervals
      let curr = new Date(minDate);
      while (curr.getTime() <= maxDate.getTime()) {
        const offset = ((curr.getTime() - epoch) / spanMs) * 100;
        if (offset >= 0 && offset <= 100) {
          res.push({
            label: `${curr.getFullYear()}年度`,
            offsetPercent: offset
          });
        }
        curr.setFullYear(curr.getFullYear() + 1);
      }
    }
    return res;
  }, [minDate, maxDate, totalDays, spanMs, timeGrain]);

  // Infinite horizontal scroll calculated width map (TSK-401)
  const timelinePxWidth = useMemo(() => {
    switch (timeGrain) {
      case "day": return Math.max(1200, totalDays * 16);
      case "week": return Math.max(1200, Math.ceil(totalDays / 7) * 90);
      case "month": return 1200;
      case "year": return 800;
    }
  }, [timeGrain, totalDays]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      
      {/* Ship List Side Column (Left 1 Col) */}
      <div className="lg:col-span-1 bg-[#0f0f12] border border-white/10 rounded-xl p-5 shadow-xs flex flex-col h-[640px]">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h4 className="text-sm font-bold text-white tracking-tight flex items-center gap-1.5">
              <Ship className="h-4.5 w-4.5 text-cyan-400" />
              在建船舶名册 ({projects.length})
            </h4>
            <p className="text-[11px] text-gray-500 mt-0.5">选择船舶以审视各分段搭载排程</p>
          </div>
          <button 
            onClick={() => setShowAddForm(true)}
            className="px-2.5 py-1.5 bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 transition-all border border-cyan-500/20 rounded-md flex items-center gap-1 text-[11px] font-bold cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" />
            新增船舶
          </button>
        </div>

        {/* Categories Tab */}
        <div className="flex flex-wrap gap-1.5 mb-3 border-b border-white/10 pb-3 text-[10px] font-mono">
          {["all", "LNG Carrier", "Bulk Carrier", "Container Vessel"].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-2.5 py-1 rounded-md transition-all cursor-pointer border ${
                activeTab === tab 
                  ? "bg-cyan-500 text-black border-cyan-400 font-bold shadow-[0_0_8px_rgba(34,211,238,0.3)]" 
                  : "bg-white/5 text-gray-400 border-white/5 hover:bg-white/10 hover:text-white"
              }`}
            >
              {tab === "all" ? "全部船舶" : tab === "LNG Carrier" ? "液化天然气" : tab === "Bulk Carrier" ? "散货船" : "集装箱"}
            </button>
          ))}
        </div>

        {/* Scrollable list */}
        <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scroll-area">
          {filteredProjects.map((p) => {
            const isSel = p.id === selectedProject?.id;
            return (
              <div
                key={p.id}
                onClick={() => {
                  setSelectedProjectId(p.id);
                  onSelectProject(p.id);
                }}
                className={`p-3.5 rounded-lg border text-left cursor-pointer transition-all ${
                  isSel 
                    ? "bg-cyan-500/10 border-cyan-500/50 shadow-xs" 
                    : "bg-[#0a0a0b]/40 border-white/5 hover:bg-white/5 hover:border-white/10"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold font-mono text-gray-500">
                    {p.deadweightTons.toLocaleString()} DWT
                  </span>
                  <span className={`text-[10px] font-mono px-1.5 py-0.5 font-semibold rounded ${
                    p.progress > 75 
                      ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" 
                      : p.progress > 35 
                      ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20" 
                      : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                  }`}>
                    完成度 {p.progress}%
                  </span>
                </div>
                <h5 className="text-xs font-bold text-white mt-1.5 font-sans flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${isSel ? "bg-cyan-400 animate-ping" : "bg-gray-600"}`}></span>
                  {p.name}
                </h5>
                <div className="flex justify-between items-center text-[10px] text-gray-500 mt-2 font-mono">
                  <span>坞槽: {getDockName(p.dockId).split(" ")[0]}</span>
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3 text-cyan-500/50" />
                    {p.end}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Gantt / Stage Control Breakdown Pane (Right 2 cols) */}
      <div className="lg:col-span-2 bg-[#0f0f12] border border-white/10 rounded-xl p-5 shadow-xs flex flex-col h-[640px] overflow-hidden">
        
        {/* Toggle Panel Mode Trigger & Info (TSK-401) */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-white/10 pb-4 mb-4">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-extrabold text-white tracking-tight flex items-center gap-1.5">
                <Layers className="h-4.5 w-4.5 text-cyan-400" />
                造船搭载及排程指挥部 (APS Dashboard)
              </h3>
            </div>
            <p className="text-[11px] text-gray-500 mt-0.5">
              协调干船坞槽位的利用效率与焊接、舾装六大搭载里程碑节点
            </p>
          </div>

          {/* View Tab Switcher (TSK-401, TSK-402) */}
          <div className="flex bg-white/5 rounded-lg border border-white/5 p-0.5 text-[11px] font-mono select-none">
            <button
              onClick={() => setViewMode("gantt")}
              className={`px-3 py-1.5 gap-1.5 rounded-md flex items-center transition-all cursor-pointer ${
                viewMode === "gantt" 
                  ? "bg-cyan-500 text-black font-extrabold shadow-md" 
                  : "text-gray-400 hover:text-white"
              }`}
            >
              <CalendarDays className="h-3.5 w-3.5" />
              2D船坞甘特图
            </button>
            <button
              onClick={() => setViewMode("control")}
              className={`px-3 py-1.5 gap-1.5 rounded-md flex items-center transition-all cursor-pointer ${
                viewMode === "control" 
                  ? "bg-cyan-500 text-black font-extrabold shadow-md" 
                  : "text-gray-400 hover:text-white"
              }`}
            >
              <Sliders className="h-3.5 w-3.5" />
              分段工序调节
            </button>
          </div>
        </div>

        {selectedProject ? (
          <div className="flex-1 flex flex-col overflow-hidden">
            
            {/* View Mode 1: Graphical Multi-dimensional Gantt timeline (TSK-401) */}
            {viewMode === "gantt" && (
              <div className="flex-1 flex flex-col overflow-hidden animate-in fade-in duration-200">
                {/* Time range selector and helper grain text */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-[#060608]/50 p-3 border border-white/5 rounded-lg mb-4 text-xs font-mono">
                  <div className="flex items-center gap-2">
                    <span className="text-gray-500 text-[10px] uppercase">粒度选择:</span>
                    <div className="flex bg-white/5 border border-white/10 rounded overflow-hidden">
                      {(["day", "week", "month", "year"] as const).map((grain) => (
                        <button
                          key={grain}
                          onClick={() => setTimeGrain(grain)}
                          className={`px-2 py-1 text-[10px] hover:text-white border-r border-white/5 last:border-0 transition-colors cursor-pointer ${
                            timeGrain === grain ? "bg-cyan-400/10 text-cyan-400 font-bold" : "text-gray-400"
                          }`}
                        >
                          {grain === "day" ? "天" : grain === "week" ? "周" : grain === "month" ? "月" : "年"}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 text-[10.5px] text-gray-400">
                    <Info className="h-3.5 w-3.5 text-cyan-500" />
                    <span>通过拖拽底部滚动条横向无限无限浏览平滑周转计划</span>
                  </div>
                </div>

                {/* The core interactive graphical Gantt table */}
                <div className="flex-1 border border-white/10 rounded-xl overflow-hidden bg-[#0a0a0c] flex flex-col min-h-0">
                  <div className="flex flex-1 min-h-0">
                    
                    {/* Sticky left dock label column */}
                    <div className="w-48 shrink-0 bg-[#0f0f12] border-r border-[#1e1e24] flex flex-col z-10 font-sans shadow-[4px_0_10px_rgba(0,0,0,0.3)]">
                      <div className="h-10 border-b border-[#1e1e24] flex items-center px-4 font-mono text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                        船坞及排班槽位
                      </div>
                      <div className="flex-1 overflow-y-auto divide-y divide-white/5">
                        {docks.map((dock) => {
                          const associated = projects.find(p => p.dockId === dock.id);
                          return (
                            <div 
                              key={dock.id} 
                              className={`h-[72px] flex flex-col justify-center px-4 transition-all ${
                                selectedProject.dockId === dock.id ? "bg-cyan-500/5" : "bg-transparent"
                              }`}
                            >
                              <span className="text-[11.5px] font-bold text-white truncate leading-tight flex items-center gap-1">
                                {dock.name}
                              </span>
                              <span className="text-[9px] text-gray-500 font-mono mt-0.5 truncate uppercase">
                                {dock.type} | {Math.round(dock.length)}M
                              </span>
                              <div className="flex items-center gap-1.5 mt-1.5 text-[9.5px]">
                                <span className={`w-1.5 h-1.5 rounded-full ${associated ? "bg-cyan-400 animate-ping" : "bg-emerald-400"}`}></span>
                                <span className="font-semibold text-gray-400 truncate">
                                  {associated ? associated.name : "空置可排程"}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Scrollable multi-dimensional timeline container */}
                    <div className="flex-1 overflow-x-auto overflow-y-hidden scrollbar-thin scrollbar-thumb-cyan-500/20 scrollbar-track-transparent relative custom-scroll-area">
                      <div className="relative h-full flex flex-col" style={{ width: `${timelinePxWidth}px` }}>
                        
                        {/* Upper timescale header row (TSK-401) */}
                        <div className="h-10 border-b border-[#1e1e24] bg-[#0f0f12] flex items-center relative font-mono text-[9px] text-gray-500 select-none">
                          {ticks.map((t, idx) => (
                            <div 
                              key={idx} 
                              className="absolute transform -translate-x-1/2 flex flex-col items-center"
                              style={{ left: `${t.offsetPercent}%` }}
                            >
                              <span className="text-gray-300 font-semibold">{t.label}</span>
                              <span className="h-1.5 w-px bg-white/20 mt-1"></span>
                            </div>
                          ))}
                        </div>

                        {/* Mid Gantt Segment timelines row for each Dock */}
                        <div className="flex-1 divide-y divide-white/5">
                          {docks.map((dock) => {
                            const associated = projects.find(p => p.dockId === dock.id);
                            const isHighlighted = selectedProject.id === associated?.id;

                            return (
                              <div 
                                key={dock.id} 
                                className={`h-[72px] relative flex items-center transition-all ${
                                  isHighlighted ? "bg-cyan-500/5 hover:bg-cyan-500/10" : "hover:bg-white/[0.01]"
                                } bg-[#0a0a0c]/40`}
                              >
                                {/* Vertical dotted scale grids */}
                                <div className="absolute inset-0 pointer-events-none opacity-5">
                                  {ticks.map((t, idx) => (
                                    <div 
                                      key={idx} 
                                      className="absolute top-0 bottom-0 w-px bg-white border-dashed"
                                      style={{ left: `${t.offsetPercent}%` }}
                                    ></div>
                                  ))}
                                </div>

                                {/* Main graphic Gantt progress bar container within dates */}
                                {associated ? (
                                  <div 
                                    className={`absolute h-10 border rounded-lg overflow-hidden flex transition-all ${
                                      isHighlighted 
                                        ? "border-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.15)] bg-cyan-950/10" 
                                        : "border-white/10 bg-white/5 opacity-80"
                                    }`}
                                    style={{ 
                                      left: `${getRelativeLeft(associated.start)}%`, 
                                      width: `${Math.max(12, getRelativeWidth(associated.start, associated.end))}%` 
                                    }}
                                  >
                                    {/* Iterative milestones stages inner flexblocks (TSK-401) */}
                                    {associated.stages.map((stage, idx) => {
                                      const segWidth = getStageSegmentPercent(associated, stage);
                                      const isComp = stage.status === "completed";
                                      const isAct = stage.status === "active";

                                      return (
                                        <div
                                          key={stage.name}
                                          onClick={() => {
                                            setSelectedProjectId(associated.id);
                                            onSelectProject(associated.id);
                                          }}
                                          className={`h-full relative group cursor-pointer border-r border-black/30 last:border-r-0 flex items-center justify-center transition-all ${
                                            isComp 
                                              ? "bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400" 
                                              : isAct 
                                              ? "bg-cyan-500/40 hover:bg-cyan-500/50 text-cyan-100 animate-pulse" 
                                              : "bg-[#18181f]/40 hover:bg-[#1f1f2a]/60 text-gray-500"
                                          }`}
                                          style={{ width: `${segWidth}%` }}
                                        >
                                          <span className="text-[10px] font-extrabold font-mono truncate px-0.5" title={stage.name}>
                                            {idx + 1}
                                          </span>

                                          {/* Floating details popup card on hover */}
                                          <div className="absolute bottom-full mb-2 hidden group-hover:flex flex-col bg-[#14141a]/95 border border-white/15 rounded-lg p-3 shadow-2xl w-60 text-left z-40 font-sans pointer-events-none transition-all">
                                            <div className="text-[9px] font-bold uppercase tracking-widest text-cyan-400 font-mono">
                                              施工阶段 {idx + 1} / 6
                                            </div>
                                            <h6 className="text-[11.5px] font-extrabold text-white mt-0.5 leading-snug break-words">
                                              {stage.name}
                                            </h6>
                                            <div className="grid grid-cols-2 gap-2 mt-2.5 text-[10px] font-mono text-gray-400 border-t border-white/5 pt-2">
                                              <div>
                                                <span className="text-[8.5px] uppercase block text-gray-500">工期开割点</span>
                                                <p className="text-white font-bold mt-0.5">{stage.start}</p>
                                              </div>
                                              <div>
                                                <span className="text-[8.5px] uppercase block text-gray-500">工序交付点</span>
                                                <p className="text-white font-bold mt-0.5">{stage.end}</p>
                                              </div>
                                            </div>
                                            <div className="mt-2 text-[11px] font-semibold text-gray-300 flex items-center justify-between border-t border-white/5 pt-2">
                                              <span>目前交付进度:</span>
                                              <span className={`font-bold font-mono ${isComp ? "text-emerald-400" : isAct ? "text-cyan-400" : "text-gray-500"}`}>
                                                {stage.progress}%
                                              </span>
                                            </div>
                                          </div>

                                        </div>
                                      );
                                    })}
                                  </div>
                                ) : (
                                  <div className="absolute left-6 text-[10px] font-mono text-gray-600 italic">
                                    [ 无搭载任务 - 可分配起龙骨节点 ]
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>

                      </div>
                    </div>

                  </div>
                </div>
              </div>
            )}

            {/* View Mode 2: Fine-Tuning Stages slider controllers */}
            {viewMode === "control" && (
              <div className="flex-1 flex flex-col overflow-hidden animate-in fade-in duration-200">
                
                {/* Header info for selected vessel */}
                <div className="bg-white/5 p-4 rounded-xl border border-white/5 mb-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-2 py-0.5 rounded font-mono">
                        {selectedProject.vesselType}
                      </span>
                      <span className="text-[11px] font-mono text-gray-400">
                        船东: {selectedProject.client}
                      </span>
                    </div>
                    <h3 className="text-base font-extrabold text-white tracking-tight mt-1">
                      {selectedProject.name} 搭载里程碑进度调节
                    </h3>
                    <p className="text-[11px] text-gray-500 mt-0.5">
                      所属铺位：{getDockName(selectedProject.dockId)} | 总施工周期：{selectedProject.start} 至 {selectedProject.end}
                    </p>
                  </div>

                  <div className="flex items-center gap-3 font-mono text-xs">
                    <div className="text-right">
                      <div className="text-gray-500 text-[9px] uppercase tracking-wider">总体当前进度</div>
                      <div className="text-xs font-bold text-white">{selectedProject.progress}% 已完成</div>
                    </div>
                    <div className="w-10 h-10 rounded-full border-4 border-cyan-500 border-t-[#1e1e24] flex items-center justify-center font-bold text-cyan-400 text-xs shadow-[0_0_8px_rgba(6,182,212,0.15)]">
                      {selectedProject.progress}%
                    </div>
                  </div>
                </div>

                {/* Stages List Grid */}
                <div className="flex-1 overflow-y-auto space-y-3.5 pr-1 custom-scroll-area">
                  <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest font-mono mb-2">
                    施工分段工序精推拉杆 (APS Stage Controller)
                  </div>
                  
                  {selectedProject.stages.map((stage, idx) => {
                    const isActive = stage.status === "active";
                    const isComp = stage.status === "completed";

                    return (
                      <div 
                        key={stage.name} 
                        className={`p-4 rounded-xl border transition-all ${
                          isActive 
                            ? "bg-cyan-500/5 border-cyan-400/40 shadow-xs" 
                            : isComp 
                            ? "bg-[#0a0a0b]/40 border-emerald-500/20 opacity-80" 
                            : "bg-[#0a0a0b]/20 border-white/5"
                        }`}
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2.5">
                          <div className="flex items-start gap-2.5">
                            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold font-mono mt-0.5 ${
                              isComp 
                                ? "bg-emerald-500 text-black shadow-xs shadow-emerald-500/20" 
                                : isActive 
                                ? "bg-cyan-400 text-black animate-pulse" 
                                : "bg-white/5 border border-white/10 text-gray-400"
                            }`}>
                              {idx + 1}
                            </span>
                            <div>
                              <h4 className="text-xs font-bold text-white font-sans">
                                {stage.name}
                              </h4>
                              <div className="flex items-center gap-1 text-[10px] text-gray-400 font-mono mt-1">
                                <Calendar className="h-3 w-3 text-cyan-400" />
                                <span>{stage.start} 到 {stage.end}</span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 self-end sm:self-auto">
                            <span className={`text-[9px] font-mono font-bold px-2 py-0.5 rounded border ${
                              isComp 
                                ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" 
                                : isActive 
                                ? "bg-cyan-500/10 text-cyan-400 border-cyan-500/20" 
                                : "bg-white/5 text-gray-400 border-white/5"
                            }`}>
                              {isComp ? "已完工" : isActive ? "建造中" : "待启动"}
                            </span>
                          </div>
                        </div>

                        {/* Adjustable slider for active/pending/completed stages */}
                        <div className="space-y-2 bg-[#060608]/60 p-2.5 rounded-lg border border-white/5">
                          <div className="flex items-center justify-between text-[11px] text-gray-400 font-mono">
                            <span className="flex items-center gap-1">
                              <Gauge className="h-3.5 w-3.5 text-gray-500" />
                              工序推进率 (Progress Control)
                            </span>
                            <span className="font-bold text-white">{stage.progress}%</span>
                          </div>
                          <div className="flex items-center gap-4">
                            <input
                              type="range"
                              min="0"
                              max="100"
                              value={stage.progress}
                              onChange={(e) => onUpdateProjectProgress(selectedProject.id, stage.name, Number(e.target.value))}
                              className="flex-1 accent-cyan-400 h-1 bg-white/10 rounded-lg appearance-none cursor-pointer"
                            />
                            <button
                              onClick={() => onUpdateProjectProgress(selectedProject.id, stage.name, 100)}
                              className="px-2 py-0.5 bg-white/5 border border-white/10 hover:bg-emerald-500 hover:text-black hover:border-emerald-400 transition-colors text-[9px] font-mono rounded text-gray-300 cursor-pointer"
                            >
                              完工 (100%)
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-gray-500">
            <Ship className="h-10 w-10 text-gray-600 stroke-[1.2] mb-2 font-mono" />
            <span className="text-sm font-medium">暂无在建船舶项目</span>
            <p className="text-xs text-slate-500 mt-1">请点击左上角的“新增”按钮配置建造任务</p>
          </div>
        )}
      </div>

      {/* Add Project Modal Popup Frame */}
      {showAddForm && (
        <div className="fixed inset-0 bg-[#060608]/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="bg-[#0f0f12] border border-white/15 rounded-xl max-w-lg w-full p-6 shadow-2xl relative animate-in fade-in-50 zoom-in-95 duration-200">
            <button
              onClick={() => setShowAddForm(false)}
              className="absolute top-4 right-4 p-1.5 text-gray-400 hover:text-white hover:bg-white/5 rounded-full cursor-pointer"
            >
              <X className="h-5 w-5" />
            </button>

            <h3 className="text-base font-bold text-white flex items-center gap-2 mb-1">
              <Ship className="h-5 w-5 text-cyan-400" />
              起龙骨开工排程启动 (APS Plan Launch)
            </h3>
            <p className="text-xs text-gray-400 mb-4">
              启动新一轮海事重工搭载排程，智能自动生成首期六段全周期搭载阶段里程碑。
            </p>

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-gray-400 mb-1">船舶中文/英文名 (Vessel Name)</label>
                  <input
                    type="text"
                    required
                    placeholder="例如: Ocean-Leo 703"
                    value={vesselName}
                    onChange={(e) => setVesselName(e.target.value)}
                    className="w-full px-3 py-2 bg-[#060608] border border-white/10 rounded-lg text-gray-200 placeholder-gray-600 focus:outline-hidden focus:ring-1 focus:ring-cyan-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-gray-400 mb-1">船舶类型 (Vessel Type)</label>
                  <select
                    value={vesselType}
                    onChange={(e) => setVesselType(e.target.value as any)}
                    className="w-full px-3 py-2 bg-[#060608] border border-white/10 rounded-lg text-gray-200 focus:outline-hidden focus:ring-1 focus:ring-cyan-500"
                  >
                    <option value="Bulk Carrier">散货船 (Bulk Carrier)</option>
                    <option value="LNG Carrier">液化天然气船 (LNG Carrier)</option>
                    <option value="Container Vessel">集装箱船 (Container Vessel)</option>
                    <option value="Oil Tanker">油轮 (Oil Tanker)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-gray-400 mb-1">设计载重吨 (DWT)</label>
                  <input
                    type="number"
                    value={dwt}
                    onChange={(e) => setDwt(Number(e.target.value))}
                    className="w-full bg-[#060608] border border-white/10 rounded-lg text-gray-200 px-3 py-2 focus:outline-hidden focus:ring-1 focus:ring-cyan-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-gray-400 mb-1">分派船坞槽 (Dock / Birth)</label>
                  <select
                    value={dockId}
                    onChange={(e) => setDockId(e.target.value)}
                    className="w-full px-3 py-2 bg-[#060608] border border-white/10 rounded-lg text-gray-200 focus:outline-hidden focus:ring-1 focus:ring-cyan-500"
                  >
                    {docks.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} {d.isOccupied ? "(已占线)" : "(空闲)"}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-gray-400 mb-1">船东/船级社客户 (Client Standard)</label>
                <input
                  type="text"
                  required
                  placeholder="例如: COSCO Group, Maersk Shipping"
                  value={client}
                  onChange={(e) => setClient(e.target.value)}
                  className="w-full px-3 py-2 bg-[#060608] border border-white/10 rounded-lg text-gray-200 placeholder-gray-600 focus:outline-hidden focus:ring-1 focus:ring-cyan-500 font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-gray-400 mb-1">钢板切割开工日 (Start Date)</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-3 py-2 bg-[#060608] border border-white/10 rounded-lg text-gray-200 focus:outline-hidden focus:ring-1 focus:ring-cyan-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-gray-400 mb-1">交付返航日 (Delivery Date)</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-3 py-2 bg-[#060608] border border-white/10 rounded-lg text-gray-200 focus:outline-hidden focus:ring-1 focus:ring-cyan-500 font-mono"
                  />
                </div>
              </div>

              <div className="bg-amber-500/5 rounded-xl p-3 border border-amber-500/20 text-amber-300 flex items-start gap-2 text-[10px] leading-relaxed">
                <ShieldAlert className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold">排程冲突合规警示:</span> 如果选择的船坞已被其他重点项目独占，排程系统将在中控中心出具决策分析，优化辅材、拼钢板及电焊班工效负载，平滑干坞周转。
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="px-4 py-2 border border-white/10 text-gray-400 hover:text-white hover:bg-white/5 transition-all rounded-lg cursor-pointer font-semibold"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-cyan-500 hover:bg-cyan-600 text-black transition-all rounded-lg font-extrabold shadow-[0_0_12px_rgba(34,211,238,0.2)] cursor-pointer"
                >
                  启动新计划流程
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
