# Aegis Shipyard APS & Command 阶段一（MVP）详细设计与落地实施方案

本篇文档针对 **Aegis Shipyard APS & Command** 系统演进战略中的 **阶段一（最小可行性产品, MVP）** 进行深度细化。提供了一套可以直接指导研发、算法设计和系统部署的极高细粒度方案。

---

```
                                  +------------------------------------+
                                  |         工业级中控台 (前端 SPA)      |
                                  |    (React 18 + Vite + Tailwind)    |
                                  +-----------------+------------------+
                                                    | (REST / WebSocket)
                                                    v
                                  +------------------------------------+
                                  |          APS 微型后端服务            |
                                  |    (NodeJS + Express + TypeScript) |
                                  +--------+------------------+---------+
                                           |                  |
                                           v (本地调用)        v (RPC/API)
+--------------------------------------------+       +-------------------------+
|                高性能求解器                |       |       AI 智能中枢       |
|    (以启发式/贪婪加权为主的拟合算法引擎)    |       |   (Gemini 2.5 Flash SDK) |
+--------------------------------------------+       |   + 船厂知识库本地 RAG    |
                                                     +-------------------------+
```

---

## 一、 系统技术栈与架构设计

阶段一采用**单机部署模式（Standalone Architecture）**，最大程度减少分布式系统（如微服务、服务网格、数据库集群、分布式缓存）带来的首期研发与运维成本，确保以极快速度完成首家标杆厂试运行。

### 1. 整体构架
*   **前端展示层**：React 18 + Vite + Tailwind CSS。采用 D3.js 自由布局甘特图及泊位空间热力图，提供高密度的工业大屏级操控体验。
*   **应用后端服务**：TypeScript + Express，运行于单个专有计算服务器上。
*   **持久化层**：
    *   **热数据/配置**：SQLite 3。无多节点同步负担，单文件即可支撑高达 100 Tps 的写性能与数千级 Qps 的读性能。
    *   **排程策略快照**：前端内置 `IndexedDB` 保持离线编辑快照，防止调度师浏览器意外崩溃丢失排版工作区。

---

## 二、 核心算法：阶段一约束求解排程引擎 (APS Core)

造船厂排程的核心难点在于 **船坞空间（2D 空间连续约束）** 与 **工序（时间 1D 约束）**、**班组/物料（非连续资源约束）** 的交叉冲突。阶段一求解器采用 **“二阶段启发式空域拼图算法” (2-Stage Heuristic Spatial-Temporal Packing Algorithm)**。

### 1. 数学建模与问题定义

*   **输入变量 (Inputs)**:
    *   待建造船只工程集合：$P = \{p_1, p_2, \dots, p_n\}$
    *   每一个工程 $p_i$ 包含若干建造阶段（工序）：$S_i = \{s_{i,1}, s_{i,2}, \dots, s_{i,m}\}$
    *   每个工序 $s_{i,j}$ 的基本属性：
        *   持续工期: $D_{i,j}$（天）
        *   物理尺寸需求: 长度 $L_i$（米），宽度 $W_i$（米）
        *   资源需求量: 班组人员 $C_{i,j}$（人/天），专用材料 $M_{i,j}$（吨）
    *   物理泊位资源集合：$B = \{b_1, b_2, \dots, b_k\}$。每个泊位 $b_y$ 拥有最大容纳长度 $MaxL_y$、最大宽度 $MaxW_y$。
    *   全厂日人员瓶颈容量：$C_{max}$

*   **优化目标 (Objectives)**:
    *   最小化总交付周期 (Makespan): $\min \max (EndTime_i)$
    *   最大化船坞空间利用率 (Dock Space Efficiency): $\max \sum (L_i \times W_i \times D_{i,j})$
    *   平滑人员负载曲线，避免用工波峰超出 $C_{max}$。

### 2. 启发式排程核心算法伪代码

我们将算法分为 **主链拓扑序生成** 与 **泊位空间-时间联合拟合拟合（二维装箱+一维时间轴）**。

```typescript
interface ScheduleTask {
  projectId: string;
  stageId: string;
  duration: number; // 天
  length: number;    // 米
  width: number;     // 米
  laborRequired: number; // 人数
  dependencies: string[]; // 依赖的前置工序IDs
}

interface ShipyardDock {
  dockId: string;
  length: string;
  width: string;
}

export function runPhase1ApsSolver(
  tasks: ScheduleTask[], 
  docks: ShipyardDock[],
  resourceCap: number // 每日最高班组负荷
): Map<string, { startDay: number; endDay: number; dockId: string }> {
  
  // 1. 生成并排序拓扑序：根据重要度、合同期限以及工序依赖倒序计算关键路径法 (CPM)
  const sortedTasks = cpmTopologySort(tasks); 
  const allocationResult = new Map<string, { startDay: number; endDay: number; dockId: string }>();
  
  // 记录每个船坞在每一天的物理空闲分段矩阵 (2D Ribbon Yard State)
  // key: dockId_dayNum, value: Array of available intervals [start_meter, end_meter]
  const dockUsageRegistry = new Map<string, Array<[number, number]>>();

  // 记录每一天的累计班组负荷
  const dailyLaborCost = new Map<number, number>();

  for (const task of sortedTasks) {
    let allocated = false;
    let candidateDay = 0;
    
    // 找出该任务最早可开启时间（必须在所有依赖项完成之后）
    const earliestStart = getMinStartDayFromDependencies(task, allocationResult);
    candidateDay = earliestStart;

    while (!allocated) {
      // 遍历所有可用船坞
      for (const dock of docks) {
        const dockLength = parseFloat(dock.length);
        const dockWidth = parseFloat(dock.width);
        
        // 校验该船坞的物理最值是否能塞下这条船
        if (task.length > dockLength || task.width > dockWidth) continue;

        // 检查从 candidateDay 到 (candidateDay + task.duration - 1) 的每一天里
        // 船坞在长度方向上是否有连续的大于 task.length 的空闲空间，且日人工总额不超出阈值
        let fitsInWindow = true;
        
        for (let d = candidateDay; d < candidateDay + task.duration; d++) {
          const availableSegments = getOrCreateDockDaySegments(dockUsageRegistry, dock.dockId, d, dockLength);
          const hasSpace = hasContinuousSegment(availableSegments, task.length);
          const currentLabor = dailyLaborCost.get(d) || 0;
          
          if (!hasSpace || (currentLabor + task.laborRequired) > resourceCap) {
            fitsInWindow = false;
            break;
          }
        }

        if (fitsInWindow) {
          // 锁定排程并扣减资源
          for (let d = candidateDay; d < candidateDay + task.duration; d++) {
            // 扣减船坞对应天数的可用区间段 (2D Packing update)
            allocateDockSpace(dockUsageRegistry, dock.dockId, d, task.length, dockLength);
            // 累加人员负荷
            dailyLaborCost.set(d, (dailyLaborCost.get(d) || 0) + task.laborRequired);
          }
          
          allocationResult.set(`${task.projectId}_${task.stageId}`, {
            startDay: candidateDay,
            endDay: candidateDay + task.duration,
            dockId: dock.dockId
          });
          allocated = true;
          break; // 跳出船坞寻找，进行下一个任务
        }
      }
      
      if (!allocated) {
        // 如果当前时间周期所有船坞或班组溢出，天数递增，向后滑动窗口
        candidateDay++;
      }
    }
  }
  
  return allocationResult;
}
```

---

## 三、 数据库结构 (Schema Design)

阶段一选用 SQLite。核心实体包含：船坞定义、建造项目、细化工序以及现场物资快照。

```sql
-- 1. 船坞与码头基本设施表 (Docks)
CREATE TABLE IF NOT EXISTS sys_docks (
    dock_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT CHECK(type IN ('dry_dock', 'berth', 'outfit_quay')),
    length_m REAL NOT NULL,
    width_m REAL NOT NULL,
    max_dwt INTEGER NOT NULL,
    status TEXT DEFAULT 'active'
);

-- 2. 船舶建造项目母表 (Projects)
CREATE TABLE IF NOT EXISTS shipyard_projects (
    project_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    ship_type TEXT NOT NULL,          -- 如 LNG, Bulk Carrier
    length_m REAL NOT NULL,
    width_m REAL NOT NULL,
    tonnage INTEGER NOT NULL,
    contract_delivery_date TEXT NOT NULL, -- 交付日期限制
    current_progress REAL DEFAULT 0.0,
    status TEXT DEFAULT 'designing'
);

-- 3. 建造阶段与具体工位工序 (Stages)
CREATE TABLE IF NOT EXISTS project_stages (
    stage_id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    name TEXT NOT NULL,                -- 如 "Steel Cutting", "Hull Assembly", "Outfitting"
    duration_days INTEGER NOT NULL,
    labor_requirement INTEGER NOT NULL,-- 每日所需班组工时人数
    parent_stage_ids TEXT,             -- 逗号分隔的依赖 stage_id
    plan_start_date TEXT,
    plan_end_date TEXT,
    actual_start_date TEXT,
    actual_end_date TEXT,
    assigned_dock_id TEXT,
    FOREIGN KEY(project_id) REFERENCES shipyard_projects(project_id),
    FOREIGN KEY(assigned_dock_id) REFERENCES sys_docks(dock_id)
);

-- 4. 实时动态看板事件日志 (Logs)
CREATE TABLE IF NOT EXISTS telemetry_logs (
    log_id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
    category TEXT CHECK(category IN ('info', 'success', 'warning', 'danger')),
    source_module TEXT NOT NULL,       -- 如 'DOCK_1', 'AI_SCHEDULER', 'MATERIAL_LOGISTICS'
    message_text TEXT NOT NULL
);
```

---

## 四、 AI 智能提问与求解反写集成设计 (AI Integration)

在阶段一中，**造船厂总调度 AI 指挥提问台** 的核心链路是将人类的高级自然语言意图（Natural Language Utterance）转化为本系统排程计算的算法参数，形成**语义级控制和闭环**。

### 1. 技术链路：参数化提示（Prompt Grounding）与反写 API
当调度员输入：“*钢体车间隔天工效因为大风下降了 20%，重新调整排产方案*” 时：

```
+------------------+     NLP Grounding      +---------------------+     算法重算     +------------------+
|  人机交互输入指令  +---------------------->+  Gemini Json Output +------------------>+  重新调用求解器  |
+------------------+                        +----------+----------+                    +--------+---------+
                                                       |                                        |
                                                       v Schema 反写                            v
                                            +---------------------+                    +------------------+
                                            |  临时锁定某些核心约束 |                    |  推送更新至前端  |
                                            +---------------------+                    +------------------+
```

### 2. 人机交互 Prompt 模板设计
为确保大语言模型始终可以输出强格式、防注入的解析参数，定义以下基于 `Gemini-2.5-Flash` 的系统级约束：

```markdown
Role: Aegis Shipyard Smart Controller NLP Grounder
Context: You are intercepting physical event descriptions and parameters in a heavy industry shipyard.
Output format: You MUST respond with ONLY a strict JSON object matches this typescript interface:

interface GroundedSchedulingEvent {
  action: "adjust_labor" | "postpone_milestone" | "lock_berth" | "query_only";
  targetProjectId?: string;
  targetStageName?: string;
  adjustmentPercentage?: number; // E.g., -20, 10
  shiftDays?: number;
  reason: string;
}

Guidelines:
- If the user is only asking general questions, return action: "query_only".
- Do not add conversational text or markdown codeblocks inside your raw output.
```

### 3. API 端点设计 (Express Route)
*   **POST** `/api/ai/command`
    *   **Payload**: `{ query: "一号门座式起重机受检修影响，前置物资驳运暂停 2 天" }`
    *   **处理逻辑**:
        1. 调用上述 LLM 获取 Grounding 后的对象参数。
        2. 如果 `action === "postpone_milestone"`，则直接获取对应项目的工序数据，修改持续天数 `duration_days = duration_days + shift_days`。
        3. 自动在数据库中调用 `runPhase1ApsSolver` 获取全新排位视图快照。
        4. 向日志表插入一条 `warning` 级别事件。
        5. 返回全新排程快照与 AI 解释话术。

---

## 五、 第一阶段单元/集成测试与灰度运行

### 1. 冒烟测试：极值物理排程边界测试
*   **用例 1 (超限检测)**：试图排程一艘 L=400m, W=50m 的巨型集装箱船进入 L=300m, W=40m 的中型船台。求解器必须干净地将该船滞后至其他深水码头或向调度员报错，而不是强行挤入。
*   **用例 2 (人员冲突检测)**：引入总劳动力为 500 人的硬限制。将三套并行工序的日需工时设为 200, 250, 150，求解器必须把最后一套工位在时序上后移，保持总日耗曲线 $\le 500$。

### 2. 灰度并跑设计 (Parallel Running Mode)
在正式上线取代手工作业前，建立为期 4 周的“双轨运行制”：
1.  **输入同步**：每周一，调度室将 Excel 手动编写的本周调度计划同步上传至 MVP 系统。
2.  **不干涉监视**：MVP 系统根据当前物料、船坞、环境变更自动重算并展示一版“AI 推荐排程方案”，但不直接反写主控制室。
3.  **大周期多轮比对**：每周五，召集各工区工长对两套计划进行比对（评估里程碑偏差率、资源波动曲线平滑度、行吊等特种设备利用率）。
4.  **数据沉淀**：偏差超过 5 天的事件须记录至系统，用于微调 AI 知识库中的前置置信度参数。
