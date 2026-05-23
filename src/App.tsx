import React, { useState, useEffect } from "react";
import { ShipProject, MaterialItem, EmployeeCrew, ShipyardDock, OptimizationResult } from "./types";
import { INITIAL_PROJECTS, INITIAL_MATERIALS, INITIAL_CREWS, INITIAL_DOCKS } from "./mockData";
import { DockOccupancy } from "./components/DockOccupancy";
import { GanttChart } from "./components/GanttChart";
import { 
  Anchor, Box, Users, Sparkles, Send, Play, ShieldAlert, AlertCircle, RefreshCw, 
  CheckCircle, PlusCircle, PenTool, Database, Layers, ChevronRight, Gauge, HelpCircle, ArrowUpRight, Search, X
} from "lucide-react";

export default function App() {
  // Core States
  const [projects, setProjects] = useState<ShipProject[]>(INITIAL_PROJECTS);
  const [showBottomPanel, setShowBottomPanel] = useState<boolean>(false);
  const [materials, setMaterials] = useState<MaterialItem[]>(INITIAL_MATERIALS);
  const [crews, setCrews] = useState<EmployeeCrew[]>(INITIAL_CREWS);
  const [docks, setDocks] = useState<ShipyardDock[]>(INITIAL_DOCKS);
  const [activeTab, setActiveTab] = useState<"aps" | "materials" | "workforce" | "ai_center">("aps");

  // Selection states
  const [selectedProjectId, setSelectedProjectId] = useState<string>(INITIAL_PROJECTS[0]?.id || "");

  // AI Scheduling Engine parameters & responses
  const [optimizationInstruction, setOptimizationInstruction] = useState<string>("");
  const [optimizationLoading, setOptimizationLoading] = useState<boolean>(false);
  const [optResult, setOptResult] = useState<OptimizationResult | null>(null);

  // Chat/QA Helper states
  const [chatQuery, setChatQuery] = useState<string>("");
  const [chatHistory, setChatHistory] = useState<Array<{ role: "user" | "assistant"; content: string }>>([
    { role: "assistant", content: "您好，我是 Aegis 船厂 APS 智能排程指挥官。我可以为您进行材料供应链瓶颈分析、船台坞槽周转优化排程和焊接/涂装各班组的工效调配决策。请问有什么可以协助您的？" }
  ]);
  const [chatLoading, setChatLoading] = useState<boolean>(false);

  // Material CRUD states
  const [editingMaterial, setEditingMaterial] = useState<MaterialItem | null>(null);
  const [showAddMaterialDialog, setShowAddMaterialDialog] = useState<boolean>(false);
  const [newMaterial, setNewMaterial] = useState<Partial<MaterialItem>>({
    name: "",
    category: "Steel Base",
    currentStock: 100,
    unit: "Tons",
    safetyStock: 80,
    allocated: 0,
    incomingQty: 0,
    incomingDate: "2026-06-15"
  });

  // Workforce stats micro-features
  const [selectedCrew, setSelectedCrew] = useState<EmployeeCrew | null>(null);

  // Live log simulation feed
  const [logs, setLogs] = useState<Array<{ time: string; text: string; category: "info" | "success" | "warning"; id: number }>>([
    { time: "06:15:32", text: "1号门座式起重机(50T)开始对 LNG Carrier 082 实施船艏分段起吊作业", category: "info", id: 1 },
    { time: "06:30:11", text: "焊接1班已通过移动端向数字化系统提报 A12 片板探伤优良检验单", category: "success", id: 2 },
    { time: "06:42:05", text: "库存警报：变频铠装电缆当前库存消耗达安全阈值线以下，请及时催收下轮物流", category: "warning", id: 3 },
  ]);
  const [newLogText, setNewLogText] = useState<string>("");

  // Sync dock occupancy state based on projects
  useEffect(() => {
    const updatedDocks = docks.map((dock) => {
      const associatedProj = projects.find((p) => p.dockId === dock.id);
      return {
        ...dock,
        isOccupied: !!associatedProj,
        currentVesselId: associatedProj?.id
      };
    });
    setDocks(updatedDocks);
  }, [projects]);

  // Handle stage progress adjustments
  const handleUpdateProjectProgress = (projectId: string, stageName: string, newProgress: number) => {
    const updatedProjects = projects.map((p) => {
      if (p.id !== projectId) return p;
      
      const updatedStages = p.stages.map((stage) => {
        if (stage.name !== stageName) return stage;
        
        let status: "pending" | "active" | "completed" = "pending";
        if (newProgress === 100) {
          status = "completed";
        } else if (newProgress > 0) {
          status = "active";
        }
        
        return {
          ...stage,
          progress: newProgress,
          status
        };
      });

      // Calculate total progress as simple average of stages
      const avgProgress = Math.round(
        updatedStages.reduce((sum, s) => sum + s.progress, 0) / updatedStages.length
      );

      // Determine active stage name
      const firstActiveOrPending = updatedStages.find((s) => s.progress < 100) || updatedStages[updatedStages.length - 1];

      return {
        ...p,
        stages: updatedStages,
        progress: avgProgress,
        currentStage: firstActiveOrPending ? firstActiveOrPending.name.split(" (")[0] : "Completed"
      };
    });

    setProjects(updatedProjects);
  };

  // Add project handler from Gantt Component
  const handleAddProject = (newProj: ShipProject) => {
    setProjects([newProj, ...projects]);
    setLogs((prev) => [
      {
        time: new Date().toTimeString().split(" ")[0],
        text: `新工程项目上线: ${newProj.name} (${newProj.vesselType})，派驻位置: 坞槽 #${newProj.dockId}`,
        category: "success",
        id: Date.now()
      },
      ...prev
    ]);
  };

  // AI Scheduler Optimizer invoke
  const handleTriggerAIOptimizer = async () => {
    setOptimizationLoading(true);
    try {
      const res = await fetch("/api/scheduler/optimize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projects,
          inventory: materials,
          scheduling: crews,
          customInstruction: optimizationInstruction
        })
      });
      const data = await res.json();
      if (data.success) {
        setOptResult(data.analysis);
        setLogs((prev) => [
          {
            time: new Date().toTimeString().split(" ")[0],
            text: "Aegis AI 主指挥排程引擎成功重构并平滑了船型合拢及起重物流调度",
            category: "success",
            id: Date.now()
          },
          ...prev
        ]);
      } else {
        alert("优化分析失败: " + data.error);
      }
    } catch (err: any) {
      console.error(err);
      alert("服务器无法通信，请检查后台连接状态");
    } finally {
      setOptimizationLoading(false);
    }
  };

  // Chat ask handler
  const handleSendChatQuery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatQuery.trim()) return;

    const userMsg = chatQuery;
    setChatQuery("");
    setChatHistory((prev) => [...prev, { role: "user", content: userMsg }]);
    setChatLoading(true);

    try {
      const res = await fetch("/api/scheduler/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: userMsg,
          history: chatHistory.slice(-6), // keep context size tiny and efficient
          shipyardState: {
            projects,
            inventory: materials,
            scheduling: crews
          }
        })
      });
      const data = await res.json();
      if (data.success) {
        setChatHistory((prev) => [...prev, { role: "assistant", content: data.text }]);
      } else {
        setChatHistory((prev) => [...prev, { role: "assistant", content: "抱歉，调度中枢系统遇到了逻辑传输瓶颈。" }]);
      }
    } catch (err) {
      console.error(err);
      setChatHistory((prev) => [...prev, { role: "assistant", content: "网络通讯超时，无法获取AI指挥官回复。" }]);
    } finally {
      setChatLoading(false);
    }
  };

  // Material CRUD handlers
  const handleSaveMaterial = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingMaterial) {
      setMaterials(materials.map((m) => (m.id === editingMaterial.id ? editingMaterial : m)));
      setEditingMaterial(null);
      setLogs((prev) => [
        {
          time: new Date().toTimeString().split(" ")[0],
          text: `物资存量及状态更新: ${editingMaterial.name}`,
          category: "info",
          id: Date.now()
        },
        ...prev
      ]);
    }
  };

  const handleAddNewMaterial = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMaterial.name) return;

    const fullMaterialItem: MaterialItem = {
      id: `mat-${Date.now()}`,
      name: newMaterial.name,
      category: newMaterial.category as any,
      currentStock: Number(newMaterial.currentStock || 0),
      unit: newMaterial.unit as any,
      safetyStock: Number(newMaterial.safetyStock || 0),
      allocated: Number(newMaterial.allocated || 0),
      incomingQty: Number(newMaterial.incomingQty || 0),
      incomingDate: newMaterial.incomingDate || "2026-06-30"
    };

    setMaterials([...materials, fullMaterialItem]);
    setShowAddMaterialDialog(false);
    setNewMaterial({
      name: "",
      category: "Steel Base",
      currentStock: 100,
      unit: "Tons",
      safetyStock: 80,
      allocated: 0,
      incomingQty: 0,
      incomingDate: "2026-06-15"
    });
    setLogs((prev) => [
      {
        time: new Date().toTimeString().split(" ")[0],
        text: `新采买物资登记入库: ${fullMaterialItem.name}`,
        category: "success",
        id: Date.now()
      },
      ...prev
    ]);
  };

  // Logs append helper
  const handleAddLiveLog = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLogText.trim()) return;
    setLogs((prev) => [
      {
        time: new Date().toTimeString().split(" ")[0],
        text: newLogText,
        category: "info",
        id: Date.now()
      },
      ...prev
    ]);
    setNewLogText("");
  };

  // Global KPIs calculation
  const totalTonnage = projects.reduce((acc, p) => acc + p.deadweightTons, 0);
  const activeVesselsCount = projects.filter(p => p.progress < 100).length;
  const avgEfficiency = Math.round(crews.reduce((acc, c) => acc + c.efficiencyRate, 0) / crews.length);
  const lowStockItemsCount = materials.filter(m => m.currentStock < m.safetyStock).length;

  return (
    <div className="flex flex-col h-screen w-full bg-[#0a0a0b] text-gray-300 font-sans overflow-hidden">
      
      {/* 1. Header Section */}
      <header className="flex flex-col md:flex-row items-center justify-between px-6 py-4 border-b border-white/10 bg-[#0f0f12] shrink-0 gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 bg-cyan-500/10 border border-cyan-500/30 rounded flex items-center justify-center shadow-[0_0_15px_rgba(34,211,238,0.15)]">
            <Anchor className="h-5 w-5 text-cyan-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-extrabold tracking-widest text-white uppercase font-mono">
                Aegis Shipyard APS
              </h1>
              <span className="text-[9px] bg-cyan-500/10 text-cyan-400 px-1 py-0.5 rounded font-bold border border-cyan-500/20">
                PRO-PLAN V2.8
              </span>
            </div>
            <p className="text-[10px] text-gray-500 font-mono tracking-wider uppercase mt-0.5">
              造船重工高级计划与智能排程中控管理系统
            </p>
          </div>
        </div>

        {/* Dynamic global KPIs */}
        <div className="flex flex-wrap gap-6 text-right justify-end font-mono">
          <div className="bg-[#121217] p-2.5 rounded-lg border border-white/5 min-w-[120px]">
            <span className="block text-[9px] uppercase tracking-wider text-gray-500 mb-0.5">重工在建总量</span>
            <span className="text-base font-bold text-cyan-400">
              {totalTonnage.toLocaleString()} <span className="text-[10px] text-gray-600">DWT</span>
            </span>
          </div>
          <div className="bg-[#121217] p-2.5 rounded-lg border border-white/5 min-w-[100px]">
            <span className="block text-[9px] uppercase tracking-wider text-gray-500 mb-0.5">临界物资预警</span>
            <span className={`text-base font-bold ${lowStockItemsCount > 0 ? "text-rose-500 animate-pulse" : "text-emerald-400"}`}>
              {lowStockItemsCount.toString().padStart(2, "0")} <span className="text-[9px] text-gray-600">项缺口</span>
            </span>
          </div>
          <div className="bg-[#121217] p-2.5 rounded-lg border border-white/5 min-w-[100px]">
            <span className="block text-[9px] uppercase tracking-wider text-gray-500 mb-0.5">在建坞槽/铺位</span>
            <span className="text-base font-bold text-white">
              {activeVesselsCount} <span className="text-[9px] text-gray-600">/ {docks.length} 坞</span>
            </span>
          </div>
          <div className="bg-[#121217] p-2.5 rounded-lg border border-white/5 min-w-[110px]">
            <span className="block text-[9px] uppercase tracking-wider text-gray-500 mb-0.5">班组综合工效 OEE</span>
            <span className="text-base font-bold text-emerald-400">
              {avgEfficiency}% <span className="text-[9px] text-gray-600">Avg</span>
            </span>
          </div>
        </div>
      </header>

      {/* 2. Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* Left Side Tab Navigation */}
        <nav className="w-20 hidden md:flex flex-col gap-5 items-center py-5 bg-[#0f0f12] border-r border-white/10 shrink-0">
          {[
            { id: "aps", label: "指挥排程", icon: Layers },
            { id: "materials", label: "物资储备", icon: Database },
            { id: "workforce", label: "劳务班组", icon: Users },
            { id: "ai_center", label: "APS智能", icon: Sparkles },
          ].map((item) => {
            const IconComp = item.icon;
            const isAct = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id as any)}
                title={item.label}
                className={`w-14 h-14 rounded-lg flex flex-col items-center justify-center gap-1 cursor-pointer transition-all ${
                  isAct 
                    ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 font-bold shadow-[0_0_8px_rgba(6,182,212,0.15)]" 
                    : "text-gray-500 hover:text-gray-300 hover:bg-white/5"
                }`}
              >
                <IconComp className="h-5 w-5" />
                <span className="text-[9px] tracking-tight">{item.label}</span>
              </button>
            );
          })}
          
          <div className="mt-auto px-2 text-center">
            <span className="text-[8px] font-mono text-gray-600 block">安全生产</span>
            <span className="text-[9px] font-mono font-bold text-emerald-400">1280天</span>
          </div>
        </nav>

        {/* View Content Port */}
        <div className="flex-1 flex flex-col overflow-hidden bg-[#0a0a0b] p-5">
          
          {/* Mobile view top tabs */}
          <div className="flex md:hidden gap-1 bg-white/5 p-1 rounded-lg border border-white/10 mb-4 text-xs font-semibold">
            {[
              { id: "aps", label: "排程" },
              { id: "materials", label: "物资" },
              { id: "workforce", label: "班组" },
              { id: "ai_center", label: "智能AI" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex-1 py-2 text-center rounded-md ${
                  activeTab === tab.id ? "bg-cyan-500 text-black font-extrabold" : "text-gray-400"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto space-y-6 pr-1 custom-scroll-area">
            
            {/* TAB 1: APS SCHEDULER & PIPING/HULL PROGRESS TIMELINES */}
            {activeTab === "aps" && (
              <div className="space-y-6 animate-in fade-in duration-300">
                
                {/* Visual Dock Monitor */}
                <DockOccupancy 
                  docks={docks} 
                  projects={projects} 
                  onSelectDock={(dId) => {
                    // Quick allocate ship if empty or direct selection
                    const associated = projects.find((p) => p.dockId === dId);
                    if (associated) {
                      setSelectedProjectId(associated.id);
                    } else {
                      // Trigger new assignment popup indirectly via Gantt state
                      alert("请在下方的“在建船舶名册”中点击“新增”按钮，将新船指定投放至此空置坞位！");
                    }
                  }} 
                />

                {/* Primary Gantt and Stages control */}
                <GanttChart
                  projects={projects}
                  docks={docks}
                  onAddProject={handleAddProject}
                  onUpdateProjectProgress={handleUpdateProjectProgress}
                  onSelectProject={(pId) => setSelectedProjectId(pId)}
                />
              </div>
            )}

            {/* TAB 2: MATERIAL PROCUREMENT CONTROL GRID */}
            {activeTab === "materials" && (
              <div className="space-y-6 animate-in fade-in duration-300">
                <div className="bg-[#0f0f12] border border-white/10 rounded-xl p-6">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
                    <div>
                      <h3 className="text-base font-bold text-white flex items-center gap-2">
                        <Database className="h-5 w-5 text-cyan-400" />
                        物资钢板及核心舾装件精细库存控制
                      </h3>
                      <p className="text-xs text-gray-500 mt-0.5">
                        监控EH36/AH36船体钢板储备、推进装机系统阀门排产，避免钢板断档和配件采购迟滞。
                      </p>
                    </div>
                    
                    <button
                      onClick={() => setShowAddMaterialDialog(true)}
                      className="px-4 py-2 bg-cyan-500 hover:bg-cyan-600 text-black transition-colors rounded-lg text-xs font-bold shadow-[0_0_10px_rgba(34,211,238,0.2)] flex items-center gap-1.5 cursor-pointer"
                    >
                      <PlusCircle className="h-4 w-4" />
                      入库物资登记
                    </button>
                  </div>

                  {/* Materials Grid List */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {materials.map((mat) => {
                      const percentOfSafety = Math.min(100, Math.round((mat.currentStock / mat.safetyStock) * 100));
                      const isCritical = mat.currentStock < mat.safetyStock;

                      return (
                        <div 
                          key={mat.id}
                          className={`p-4 rounded-xl border transition-all ${
                            isCritical 
                              ? "bg-rose-500/5 border-rose-500/20" 
                              : "bg-[#060608]/40 border-white/5 hover:border-white/10"
                          }`}
                        >
                          <div className="flex items-start justify-between mb-3">
                            <div>
                              <span className="text-[10px] font-mono text-gray-500 uppercase">
                                {mat.category === "Steel Base" ? "EH26/AH板材" : mat.category === "Propulsion & Power" ? "主机动力" : mat.category === "Pipes & Fittings" ? "管件与管配件" : mat.category === "Paint & Protective" ? "涂料特种油漆" : "电系统铠装线缆"}
                              </span>
                              <h4 className="text-xs font-bold text-white font-sans mt-0.5">{mat.name}</h4>
                            </div>
                            <button
                              onClick={() => setEditingMaterial(mat)}
                              className="text-[10px] text-cyan-400 bg-cyan-400/5 border border-cyan-400/10 px-2 py-0.5 rounded hover:bg-cyan-400/20"
                            >
                              调配存量
                            </button>
                          </div>

                          <div className="space-y-2.5">
                            <div className="flex justify-between items-end text-xs font-mono">
                              <div>
                                <div className="text-[9px] text-gray-500">当前实库存</div>
                                <div className={`text-sm font-extrabold ${isCritical ? "text-rose-400" : "text-white"}`}>
                                  {mat.currentStock} {mat.unit}
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="text-[9px] text-gray-500">占用锁定</div>
                                <div className="text-xs font-semibold text-gray-300">
                                  {mat.allocated} {mat.unit}
                                </div>
                              </div>
                            </div>

                            {/* Safety threshold progress bar */}
                            <div>
                              <div className="w-full bg-[#1e1e24] rounded-full h-1.5 overflow-hidden">
                                <div 
                                  className={`h-full rounded-full transition-all duration-300 ${
                                    isCritical ? "bg-rose-500" : "bg-cyan-400"
                                  }`}
                                  style={{ width: `${(mat.currentStock / (mat.safetyStock * 1.5)) * 100}%` }}
                                ></div>
                              </div>
                              <div className="flex justify-between items-center text-[9px] text-gray-500 font-mono mt-1">
                                <span>起征安全水位: {mat.safetyStock} {mat.unit}</span>
                                <span className={isCritical ? "text-rose-400 font-bold animate-pulse" : "text-gray-600"}>
                                  {isCritical ? "已破安全水位!" : "存量安全"}
                                </span>
                              </div>
                            </div>

                            {/* Logistics pipeline arriving information */}
                            {mat.incomingQty > 0 && (
                              <div className="bg-[#111115] border border-white/5 rounded-lg p-2 flex justify-between items-center text-[10px] text-gray-400 font-mono mt-2">
                                <span className="flex items-center gap-1 text-emerald-400">
                                  <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full inline-block"></span>
                                  在途物流: +{mat.incomingQty}
                                </span>
                                <span>预计抵港: {mat.incomingDate}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Edit Stock Drawer/popup */}
                {editingMaterial && (
                  <div className="fixed inset-0 bg-[#060608]/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
                    <div className="bg-[#0f0f12] border border-white/15 rounded-xl max-w-sm w-full p-6 shadow-2xl relative">
                      <button
                        onClick={() => setEditingMaterial(null)}
                        className="absolute top-4 right-4 p-1.5 text-gray-400 hover:text-white hover:bg-white/5 rounded-full"
                      >
                        <X className="h-4 w-4" />
                      </button>

                      <h3 className="text-sm font-bold text-white mb-1">物资存量手动分配微调</h3>
                      <p className="text-xs text-gray-500 mb-4">{editingMaterial.name}</p>

                      <form onSubmit={handleSaveMaterial} className="space-y-4 text-xs font-medium">
                        <div>
                          <label className="block text-gray-400 mb-1">当前实际可用纯库存 ({editingMaterial.unit})</label>
                          <input
                            type="number"
                            value={editingMaterial.currentStock}
                            onChange={(e) => setEditingMaterial({ ...editingMaterial, currentStock: Number(e.target.value) })}
                            className="w-full bg-[#060608] border border-white/10 rounded-lg text-gray-200 px-3 py-2 font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-gray-400 mb-1">在建船舶排程占用锁定数</label>
                          <input
                            type="number"
                            value={editingMaterial.allocated}
                            onChange={(e) => setEditingMaterial({ ...editingMaterial, allocated: Number(e.target.value) })}
                            className="w-full bg-[#060608] border border-white/10 rounded-lg text-gray-200 px-3 py-2 font-mono"
                          />
                        </div>
                        <div>
                          <label className="block text-gray-400 mb-1">在途增补订购计划数量</label>
                          <input
                            type="number"
                            value={editingMaterial.incomingQty}
                            onChange={(e) => setEditingMaterial({ ...editingMaterial, incomingQty: Number(e.target.value) })}
                            className="w-full bg-[#060608] border border-white/10 rounded-lg text-gray-200 px-3 py-2 font-mono"
                          />
                        </div>

                        <div className="flex justify-end gap-2 pt-2">
                          <button
                            type="button"
                            onClick={() => setEditingMaterial(null)}
                            className="px-3 py-1.5 border border-white/10 text-gray-400 rounded hover:bg-white/5"
                          >
                            取消
                          </button>
                          <button
                            type="submit"
                            className="px-4 py-1.5 bg-cyan-500 text-black font-extrabold rounded hover:bg-cyan-600"
                          >
                            保存修改
                          </button>
                        </div>
                      </form>
                    </div>
                  </div>
                )}

                {/* Add Material popup */}
                {showAddMaterialDialog && (
                  <div className="fixed inset-0 bg-[#060608]/80 backdrop-blur-md flex items-center justify-center z-50 p-4">
                    <div className="bg-[#0f0f12] border border-white/15 rounded-xl max-w-sm w-full p-6 shadow-2xl relative">
                      <button
                        onClick={() => setShowAddMaterialDialog(false)}
                        className="absolute top-4 right-4 p-1.5 text-gray-400 hover:text-white hover:bg-white/5 rounded-full"
                      >
                        <X className="h-4 w-4" />
                      </button>

                      <h3 className="text-sm font-bold text-white mb-1">新批次造船原料登记</h3>
                      <p className="text-xs text-gray-500 mb-4">登记由外协分包商或物流链新到货的物料</p>

                      <form onSubmit={handleAddNewMaterial} className="space-y-4 text-xs font-medium">
                        <div>
                          <label className="block text-gray-400 mb-1">原料标准分类名称 (Specification Name)</label>
                          <input
                            type="text"
                            required
                            placeholder="例如: DH36 船用耐磨高强钢板"
                            value={newMaterial.name}
                            onChange={(e) => setNewMaterial({ ...newMaterial, name: e.target.value })}
                            className="w-full bg-[#060608] border border-white/10 rounded-lg text-gray-200 px-3 py-2 font-mono"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-gray-400 mb-1">类型归属</label>
                            <select
                              value={newMaterial.category}
                              onChange={(e) => setNewMaterial({ ...newMaterial, category: e.target.value as any })}
                              className="w-full bg-[#060608] border border-white/10 rounded-lg text-gray-200 px-2 py-2"
                            >
                              <option value="Steel Base">板材及球扁钢</option>
                              <option value="Propulsion & Power">螺旋桨或动力发动机</option>
                              <option value="Pipes & Fittings">压力管及阀组</option>
                              <option value="Paint & Protective">耐雾涂料漆料</option>
                              <option value="Electrical & Controls">铠装变频电缆</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-gray-400 mb-1">配给计量单位</label>
                            <select
                              value={newMaterial.unit}
                              onChange={(e) => setNewMaterial({ ...newMaterial, unit: e.target.value as any })}
                              className="w-full bg-[#060608] border border-white/10 rounded-lg text-gray-200 px-2 py-2"
                            >
                              <option value="Tons">吨 (Tons)</option>
                              <option value="Sets">套 (Sets)</option>
                              <option value="Meters">米 (Meters)</option>
                              <option value="Liters">升 (Liters)</option>
                              <option value="Units">件 (Units)</option>
                            </select>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-gray-400 mb-1">到厂可用实库数</label>
                            <input
                              type="number"
                              value={newMaterial.currentStock}
                              onChange={(e) => setNewMaterial({ ...newMaterial, currentStock: Number(e.target.value) })}
                              className="w-full bg-[#060608] border border-white/10 rounded-lg text-gray-200 px-3 py-2 font-mono"
                            />
                          </div>
                          <div>
                            <label className="block text-gray-400 mb-1">破产安全水位阈值</label>
                            <input
                              type="number"
                              value={newMaterial.safetyStock}
                              onChange={(e) => setNewMaterial({ ...newMaterial, safetyStock: Number(e.target.value) })}
                              className="w-full bg-[#060608] border border-white/10 rounded-lg text-gray-200 px-3 py-2 font-mono"
                            />
                          </div>
                        </div>

                        <div className="flex justify-end gap-2 pt-2">
                          <button
                            type="button"
                            onClick={() => setShowAddMaterialDialog(false)}
                            className="px-3 py-1.5 border border-white/10 text-gray-400 rounded hover:bg-white/5"
                          >
                            取消
                          </button>
                          <button
                            type="submit"
                            className="px-4 py-1.5 bg-cyan-500 text-black font-extrabold rounded hover:bg-cyan-600"
                          >
                            新增登册
                          </button>
                        </div>
                      </form>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: WORKFORCE SCHEDULING & EFFICIENCY HEATMAP */}
            {activeTab === "workforce" && (
              <div className="space-y-6 animate-in fade-in duration-300">
                <div className="bg-[#0f0f12] border border-white/10 rounded-xl p-6">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
                    <div>
                      <h3 className="text-base font-bold text-white flex items-center gap-2">
                        <Users className="h-5 w-5 text-cyan-400" />
                        劳务及特种班组排班与工效热力度矩阵
                      </h3>
                      <p className="text-xs text-gray-500 mt-0.5">
                        船厂OEE工效监控：评估电焊组、防腐打砂班、舾装调试组之作业负荷，科学协调错峰排班，避免疲劳作业引发安全事件。
                      </p>
                    </div>
                  </div>

                  {/* 14-block mock workforce heatmap representation requested by Elegant Dark theme */}
                  <div className="mb-6 bg-[#0a0a0b]/60 border border-white/5 p-4 rounded-xl">
                    <div className="flex justify-between items-center mb-3">
                      <span className="text-[10px] font-mono text-gray-400 uppercase tracking-wider">
                        全分厂班组24小时焊接/打砂综合工效热力度矩阵 (Shift Load Heatmap)
                      </span>
                      <span className="text-[10px] text-cyan-400 font-mono">24/7 满负荷平滑率: 92.4%</span>
                    </div>
                    <div className="grid grid-cols-7 sm:grid-cols-14 gap-2.5">
                      {[
                        { rate: 94, name: "焊A班 - 白" },
                        { rate: 88, name: "焊A班 - 晚" },
                        { rate: 91, name: "装配1班" },
                        { rate: 98, name: "起重舾装" },
                        { rate: 82, name: "防腐涂装" },
                        { rate: 105, name: "电系统组" },
                        { rate: 100, name: "联合质检" },
                        { rate: 95, name: "焊B班 - 白" },
                        { rate: 76, name: "焊B班 - 晚" },
                        { rate: 92, name: "船壳一车间" },
                        { rate: 89, name: "龙门起重A组" },
                        { rate: 65, name: "外协打磨组" },
                        { rate: 97, name: "动力分段组" },
                        { rate: 84, name: "调试复核班" },
                      ].map((cell, idx) => (
                        <div 
                          key={idx}
                          title={`${cell.name}: 效率 ${cell.rate}%`}
                          className={`h-11 rounded-lg border flex flex-col justify-between p-1.5 transition-all text-center ${
                            cell.rate >= 98
                              ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-400"
                              : cell.rate >= 85
                              ? "bg-cyan-500/10 border-cyan-500/30 text-cyan-300"
                              : "bg-amber-500/10 border-amber-500/30 text-amber-300"
                          }`}
                        >
                          <span className="text-[7.5px] font-mono font-bold uppercase overflow-hidden whitespace-nowrap truncate block">
                            {cell.name.split(" ")[0]}
                          </span>
                          <span className="text-[9.5px] font-mono font-bold">{cell.rate}%</span>
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-4 text-[9px] text-gray-500 font-mono mt-3 justify-end">
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 bg-emerald-500/20 border border-emerald-500/40 rounded inline-block"></span>
                        超常发挥 (&gt;98%)
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 bg-cyan-500/10 border border-cyan-500/30 rounded inline-block"></span>
                        常规达标 (85%-97%)
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 bg-amber-500/10 border border-amber-500/30 rounded inline-block"></span>
                        效率偏缓 (&lt;85%)
                      </span>
                    </div>
                  </div>

                  {/* Crews table with interaction */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Left Column Crews roster list */}
                    <div className="lg:col-span-2 space-y-3">
                      <div className="text-xs font-bold text-gray-400 tracking-wider font-mono">
                        全厂重点施工班组名册
                      </div>
                      <div className="space-y-2 h-[340px] overflow-y-auto pr-1">
                        {crews.map((crew) => (
                          <div
                            key={crew.id}
                            onClick={() => setSelectedCrew(crew)}
                            className={`p-3.5 rounded-xl border text-left cursor-pointer transition-all flex items-center justify-between gap-4 ${
                              selectedCrew?.id === crew.id
                                ? "bg-cyan-500/10 border-cyan-500/50"
                                : "bg-[#060608]/40 border-white/5 hover:border-white/10"
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center font-mono text-cyan-400 text-xs font-bold">
                                {crew.headcount}人
                              </div>
                              <div>
                                <h4 className="text-xs font-bold text-white tracking-tight">{crew.crewName}</h4>
                                <div className="flex gap-2 text-[10px] text-gray-500 font-mono mt-0.5">
                                  <span>工种: {crew.skillCategory}</span>
                                  <span>|</span>
                                  <span>班次: {crew.shiftType === "Day Shift" ? "白班" : crew.shiftType === "Night Shift" ? "夜班" : "轮班"}</span>
                                </div>
                              </div>
                            </div>

                            <div className="text-right font-mono text-xs">
                              <div className="text-gray-400">工效评级: <span className="font-bold text-cyan-400">{crew.efficiencyRate}%</span></div>
                              <div className="text-[9px] text-emerald-400 font-bold mt-0.5">无事故安全: {crew.safetyDays}天</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Right column detailed shift allocation info card */}
                    <div className="lg:col-span-1 bg-[#060608]/50 border border-white/5 rounded-xl p-4.5 flex flex-col justify-between">
                      {selectedCrew ? (
                        <div className="space-y-4">
                          <div className="flex justify-between items-start border-b border-white/5 pb-3">
                            <div>
                              <span className="text-[9px] uppercase tracking-wider font-mono text-cyan-400 bg-cyan-500/10 px-1.5 py-0.5 rounded border border-cyan-500/20">
                                Crew Profile
                              </span>
                              <h4 className="text-xs font-extrabold text-white mt-1">{selectedCrew.crewName}</h4>
                            </div>
                            <span className="text-[10px] text-gray-500 font-mono">ID: {selectedCrew.id}</span>
                          </div>

                          <div className="space-y-2.5 text-xs">
                            <div className="flex justify-between font-mono">
                              <span className="text-gray-500">成员编成:</span>
                              <span className="font-bold text-white">{selectedCrew.headcount} 级特种工</span>
                            </div>
                            <div className="flex justify-between font-mono">
                              <span className="text-gray-500">主建船舶:</span>
                              <span className="font-bold text-cyan-400">
                                {projects.find(p => p.id === selectedCrew.assignedProjectId)?.name || "暂未固定指派"}
                              </span>
                            </div>
                            <div className="flex justify-between font-mono">
                              <span className="text-gray-500">连续安全班期:</span>
                              <span className="font-bold text-emerald-400">{selectedCrew.safetyDays} 个工日</span>
                            </div>

                            {/* Shift reassignment block */}
                            <div className="pt-3 border-t border-white/5">
                              <span className="block text-[10px] text-gray-500 font-mono mb-2">
                                更改所属计划班次 (Crew Shift Re-assignment)
                              </span>
                              <div className="grid grid-cols-2 gap-1.5 text-[10px]">
                                {[
                                  { t: "Day Shift", l: "白班 (日)" },
                                  { t: "Night Shift", l: "夜班 (跨)" },
                                  { t: "Rotating Shift", l: "轮作白/夜" },
                                  { t: "Standby", l: "常备待令" }
                                ].map((sh) => (
                                  <button
                                    key={sh.t}
                                    onClick={() => {
                                      const updated = crews.map(c => c.id === selectedCrew.id ? { ...c, shiftType: sh.t as any } : c);
                                      setCrews(updated);
                                      setSelectedCrew({ ...selectedCrew, shiftType: sh.t as any });
                                    }}
                                    className={`py-1.5 rounded text-center font-mono border cursor-pointer ${
                                      selectedCrew.shiftType === sh.t 
                                        ? "bg-cyan-500 text-black border-cyan-400 font-bold" 
                                        : "bg-white/5 hover:bg-white/10 text-gray-400 border-white/5"
                                    }`}
                                  >
                                    {sh.l}
                                  </button>
                                ))}
                              </div>
                            </div>

                            <div className="pt-3">
                              <span className="block text-[10px] text-gray-500 font-mono mb-1.5">
                                手工微调班组工效基准 (OEE Modifier)
                              </span>
                              <div className="flex gap-2">
                                <input
                                  type="range"
                                  min="50"
                                  max="120"
                                  value={selectedCrew.efficiencyRate}
                                  onChange={(e) => {
                                    const val = Number(e.target.value);
                                    const updated = crews.map(c => c.id === selectedCrew.id ? { ...c, efficiencyRate: val } : c);
                                    setCrews(updated);
                                    setSelectedCrew({ ...selectedCrew, efficiencyRate: val });
                                  }}
                                  className="flex-1 accent-cyan-400 h-1 bg-white/10 rounded-lg appearance-none cursor-pointer self-center"
                                />
                                <span className="font-mono text-xs font-bold text-white w-8 text-right">
                                  {selectedCrew.efficiencyRate}%
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="h-full py-16 text-center text-gray-500 flex flex-col items-center justify-center">
                          <Users className="h-8 w-8 text-gray-600 stroke-[1.2] mb-1.5" />
                          <span className="text-xs font-semibold">未选中特定班组</span>
                          <p className="text-[10px] text-gray-500 mt-1 max-w-[180px]">
                            点击左侧排队名册中的班组，可进行工效拉升及班次跨段调整
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 4: AI STRATEGIC COMMAND CENTRAL */}
            {activeTab === "ai_center" && (
              <div className="space-y-6 animate-in fade-in duration-300">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  
                  {/* Left Column: Optimization input pane (5 cols) */}
                  <div className="lg:col-span-5 bg-[#0f0f12] border border-white/10 rounded-xl p-5 flex flex-col gap-4">
                    <div>
                      <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                        <Sparkles className="h-4.5 w-4.5 text-cyan-400" />
                        Aegis AI 智慧生产排程优控中枢
                      </h3>
                      <p className="text-[11px] text-gray-500 mt-1">
                        集成高级计划排程（APS）运筹学算法与大模型决策。在此输入最新的物资异动、工期冲突或船级社审查偏好，由AI一键生成最优工期和钢材调拨方案。
                      </p>
                    </div>

                    <div className="space-y-2">
                      <label className="block text-xs font-semibold text-gray-400">
                        特定调度任务输入与优控偏好
                      </label>
                      <textarea
                        rows={5}
                        placeholder="例如：优先保住LNG船 Ocean-82 的6月合拢大节点；变频电缆库存较低，若产生阶段性断档，自动调整其余船型的调试段前置，平滑后续电焊班工效..."
                        value={optimizationInstruction}
                        onChange={(e) => setOptimizationInstruction(e.target.value)}
                        className="w-full bg-[#060608] border border-white/10 rounded-lg text-gray-200 p-3 placeholder-gray-600 text-xs focus:ring-1 focus:ring-cyan-500 focus:outline-hidden font-mono"
                      ></textarea>
                    </div>

                    <button
                      onClick={handleTriggerAIOptimizer}
                      disabled={optimizationLoading}
                      className="w-full py-3 bg-cyan-500 hover:bg-cyan-600 disabled:bg-gray-700 text-black font-extrabold uppercase tracking-widest text-xs rounded-lg transition-all shadow-[0_0_15px_rgba(34,211,238,0.25)] flex items-center justify-center gap-2 cursor-pointer"
                    >
                      {optimizationLoading ? (
                        <>
                          <RefreshCw className="h-4.5 w-4.5 animate-spin text-black" />
                          <span>正在执行多卡求解决策...</span>
                        </>
                      ) : (
                        <>
                          <Play className="h-4.5 w-4.5 text-black fill-black" />
                          <span>启动 AI APS 求解器</span>
                        </>
                      )}
                    </button>

                    <div className="bg-[#050507] border border-white/5 rounded-lg p-3 space-y-2 text-[10px] font-mono text-gray-500 leading-relaxed">
                      <div className="text-cyan-400 font-bold border-b border-white/5 pb-1 flex items-center gap-1">
                        <Database className="h-3 w-3" />
                        数据流汇入
                      </div>
                      <div className="flex justify-between">
                        <span>船舶进度向量 (Ship progress specs-vector):</span>
                        <span className="text-gray-300">已对齐 (Active)</span>
                      </div>
                      <div className="flex justify-between">
                        <span>物料供给阻尼 (Materials logistics constraints):</span>
                        <span className="text-gray-300">已锁定 (7个约束)</span>
                      </div>
                      <div className="flex justify-between">
                        <span>班组OEE摩擦损失 (Personnel OEE friction loss):</span>
                        <span className="text-gray-300">&lt;2.4%</span>
                      </div>
                    </div>
                  </div>

                  {/* Right Column: AI Optimization breakdown outcome (7 cols) */}
                  <div className="lg:col-span-7 bg-[#0f0f12] border border-white/10 rounded-xl p-5 flex flex-col h-[525px] overflow-hidden">
                    <div className="flex justify-between items-center border-b border-white/10 pb-3 mb-4">
                      <h4 className="text-xs font-bold text-white uppercase tracking-wider font-mono">
                        求解分析输出: 决策控制舱 (APS Optimization Output)
                      </h4>
                      {optResult && (
                        <span className="text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded font-bold uppercase font-mono">
                          求解收敛
                        </span>
                      )}
                    </div>

                    {optResult ? (
                      <div className="flex-1 overflow-y-auto space-y-5 pr-1 text-xs">
                        {/* Executive Summary */}
                        <div className="bg-cyan-500/5 border border-cyan-500/20 p-3.5 rounded-lg text-gray-200">
                          <span className="text-[10px] uppercase font-mono text-cyan-400 block font-bold mb-1">
                            总师战指挥决策报告 (Executive Summary):
                          </span>
                          <p className="leading-relaxed font-sans">{optResult.executiveSummary}</p>
                        </div>

                        {/* Critical conflicts */}
                        <div className="space-y-2">
                          <span className="text-[10px] uppercase font-bold text-gray-500 tracking-wider font-mono block">
                            识别到的制造资源冲突 (Identified Bottlenecks):
                          </span>
                          <div className="space-y-2">
                            {optResult.criticalConflicts.map((conf) => (
                              <div key={conf.id} className="bg-white/5 border border-white/5 p-3 rounded-lg flex gap-3">
                                <span className={`w-2.5 h-2.5 rounded-full shrink-0 mt-1.5 ${
                                  conf.severity === "HIGH" ? "bg-rose-500" : conf.severity === "MEDIUM" ? "bg-amber-500" : "bg-blue-400"
                                }`}></span>
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2">
                                    <h5 className="font-bold text-white">{conf.title}</h5>
                                    <span className="text-[9px] font-mono text-gray-500">[{conf.severity}]</span>
                                  </div>
                                  <p className="text-gray-400 text-[11px] leading-relaxed">{conf.description}</p>
                                  <div className="text-[10px] bg-black/40 p-2 rounded text-cyan-300 font-mono border border-white/5">
                                    <span className="font-bold text-gray-400">APS行动指令：</span>
                                    {conf.suggestedAction}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Milestones optimization suggestion */}
                        <div className="space-y-2">
                          <span className="text-[10px] uppercase font-bold text-gray-500 tracking-wider font-mono block">
                            建议周期调整方案 (Recommended Schedule Shifts):
                          </span>
                          <div className="bg-black/20 rounded-lg border border-white/5 divide-y divide-white/5 overflow-hidden font-mono text-[11px]">
                            <div className="grid grid-cols-12 gap-2 bg-white/5 p-2 font-bold text-gray-400 uppercase">
                              <span className="col-span-3">船体项目</span>
                              <span className="col-span-3">施工工段</span>
                              <span className="col-span-2 text-center">原定节点</span>
                              <span className="col-span-2 text-center text-cyan-400">推荐优控</span>
                              <span className="col-span-2">备注调拨</span>
                            </div>
                            {optResult.optimizedMilestones.map((mil, idx) => (
                              <div key={idx} className="grid grid-cols-12 gap-2 p-2 items-center text-gray-300">
                                <span className="col-span-3 font-sans font-semibold text-white">{mil.project}</span>
                                <span className="col-span-3 text-gray-500">{mil.stage}</span>
                                <span className="col-span-2 text-center line-through text-gray-600">{mil.originalEnd}</span>
                                <span className="col-span-2 text-center text-cyan-400 font-bold">{mil.optimizedEnd}</span>
                                <span className="col-span-2 text-[10px] font-sans truncate text-gray-400" title={mil.note}>
                                  {mil.note}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Inventory adjustments */}
                        <div className="space-y-2">
                          <span className="text-[10px] uppercase font-bold text-gray-500 tracking-wider font-mono block">
                            配套辅件及钢板跨库流向分配 (Suggested Inventory Allocations):
                          </span>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            {optResult.materialAllocations.map((alloc, idx) => (
                              <div key={idx} className="bg-white/5 p-2.5 rounded-lg border border-white/5">
                                <h5 className="font-bold text-white text-[11px] truncate">{alloc.material}</h5>
                                <div className="text-[10px] font-mono text-gray-500 mt-1">调配量: <span className="text-cyan-400 font-bold">{alloc.qty}</span></div>
                                <div className="text-[10px] font-mono text-gray-500">流向: <span className="text-white">{alloc.targetProject.split("-")[0]}</span></div>
                                <div className="text-[9px] text-emerald-400 font-bold bg-emerald-500/10 px-1 mt-1.5 rounded inline-block uppercase">
                                  {alloc.status}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Personnel readjustments */}
                        <div className="space-y-2">
                          <span className="text-[10px] uppercase font-bold text-gray-500 tracking-wider font-mono block">
                            施工作业班组错峰提效配置 (Personnel Fine-tuning):
                          </span>
                          <div className="space-y-2">
                            {optResult.personnelFinetunes.map((pAdjust, idx) => (
                              <div key={idx} className="bg-[#0c0c0e] border border-white/5 p-3 rounded-md flex justify-between gap-4 font-mono text-[11px] items-center">
                                <div>
                                  <span className="font-bold text-white">{pAdjust.team}</span>
                                  <span className="text-[10px] text-gray-500 ml-2">[{pAdjust.shift}]</span>
                                </div>
                                <div className="text-gray-400 text-xs text-right font-sans">{pAdjust.adjustment}</div>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="flex justify-end gap-3 pt-3 border-t border-white/5">
                          <button
                            onClick={() => {
                              // Perform state replacement for projects schedule and material allocations based on AI recommendations
                              const updatedProjects = projects.map(p => {
                                const matchingRecom = optResult.optimizedMilestones.find(o => p.name.includes(o.project) || p.name === o.project);
                                if (matchingRecom) {
                                  return {
                                    ...p,
                                    end: matchingRecom.optimizedEnd,
                                    stages: p.stages.map(st => st.name.includes(matchingRecom.stage) ? { ...st, end: matchingRecom.optimizedEnd } : st)
                                  };
                                }
                                return p;
                              });
                              setProjects(updatedProjects);
                              setOptResult(null);
                              alert("已经成功将 AI 优盘推荐排期自动反写注入到船体生产里程碑计划中！");
                            }}
                            className="px-4 py-2 bg-emerald-500 text-black font-extrabold hover:bg-emerald-600 rounded-lg transition-colors cursor-pointer"
                          >
                            采纳排程并反写中控 (Apply & Sync)
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="h-full flex flex-col items-center justify-center text-gray-500">
                        <Sparkles className="h-10 w-10 text-gray-600 stroke-[1.2] mb-2 animate-bounce" />
                        <span className="text-xs font-semibold">等待求解指令</span>
                        <p className="text-[10px] text-gray-500 mt-1 max-w-[200px] text-center">
                          配置左侧的排程优先级并点击“启动 AI APS 求解器”触发智能排程求解过程
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* TAB Column Grid 2: Real-time Command Chat and feed logs panel (combines elements at bottom) */}
          <div className="mt-5 border-t border-white/10 pt-4 flex flex-col shrink-0 z-10 transition-all duration-300">
            {/* Toggle Header bar */}
            <div 
              onClick={() => setShowBottomPanel(!showBottomPanel)}
              className="flex items-center justify-between bg-[#0f0f12] hover:bg-[#141419] border border-white/10 rounded-xl px-5 py-3 text-xs text-gray-400 font-mono select-none cursor-pointer transition-all duration-200 shadow-md"
            >
              <div className="flex items-center gap-3">
                <Sparkles className="h-4 w-4 text-cyan-400 animate-pulse" />
                <span className="font-bold text-gray-200 tracking-wide">
                  中控实时调度与 AI 指挥提问台 (Real-time Feed & AI Assistant)
                </span>
                <span className="text-[10px] bg-cyan-500/10 text-cyan-400 px-2 py-0.5 rounded font-bold border border-cyan-500/20 ml-2">
                  {logs.length} 个最新事件
                </span>
                {!showBottomPanel && (
                  <span className="hidden sm:inline text-xs text-gray-500 font-sans ml-4 italic">
                    (控制面板已被折叠以优化主排程图表展示高度)
                  </span>
                )}
              </div>
              <button
                type="button"
                className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-500/10 border border-cyan-500/20 rounded-lg text-cyan-400 hover:bg-cyan-500/20 hover:text-white transition-all text-xs font-bold cursor-pointer"
              >
                {showBottomPanel ? (
                  <>
                    <span>折叠隐藏面板</span>
                    <ChevronRight className="h-3.5 w-3.5 rotate-90 transition-transform" />
                  </>
                ) : (
                  <>
                    <span className="animate-pulse">点击展开 AI & 日志监控</span>
                    <ChevronRight className="h-3.5 w-3.5 -rotate-90 transition-transform" />
                  </>
                )}
              </button>
            </div>

            {/* Expandable Panel Body */}
            {showBottomPanel && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 h-56 mt-4 animate-in slide-in-from-bottom duration-200 overflow-hidden">
                {/* Real-time feed events log - Left 5 cols */}
                <div className="lg:col-span-5 bg-[#0f0f12] border border-white/10 rounded-xl p-4 flex flex-col h-full overflow-hidden">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-[10px] uppercase tracking-wider font-mono font-bold text-white flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full inline-block animate-ping"></span>
                      船坞建造及物流实时跟踪看板
                    </h3>
                    <span className="text-[8px] font-mono text-gray-500">LIVE FEED</span>
                  </div>

                  {/* Feed scrollable lists */}
                  <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
                    {logs.map((log) => (
                      <div 
                        key={log.id} 
                        className={`flex items-start gap-2.5 p-1.5 rounded transition-all text-[11px] ${
                          log.category === "success" 
                            ? "bg-emerald-500/5 text-emerald-300 border-l border-emerald-500" 
                            : log.category === "warning" 
                            ? "bg-rose-500/5 text-rose-300 border-l border-rose-500" 
                            : "bg-white/5 text-gray-300 border-l border-cyan-500"
                        }`}
                      >
                        <span className="font-mono text-gray-600 shrink-0 text-[10px]">{log.time}</span>
                        <p className="flex-1 truncate" title={log.text}>{log.text}</p>
                        <span className={`text-[8.5px] uppercase font-mono font-bold shrink-0 ${
                          log.category === "success" ? "text-emerald-500" : log.category === "warning" ? "text-rose-500" : "text-cyan-400"
                        }`}>
                          {log.category === "success" ? "通过" : log.category === "warning" ? "警报" : "运转"}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Quick manual dispatch simulation logging */}
                  <form onSubmit={handleAddLiveLog} className="mt-2 flex gap-1.5 shrink-0">
                    <input
                      type="text"
                      placeholder="调度室手动广播新事件/警报..."
                      value={newLogText}
                      onChange={(e) => setNewLogText(e.target.value)}
                      className="flex-1 bg-[#060608] border border-white/10 rounded px-2.5 py-1 text-[11px] text-gray-300 placeholder-gray-600 focus:outline-hidden focus:border-cyan-500 font-mono"
                    />
                    <button 
                      type="submit" 
                      className="px-3 py-1 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded text-[10px] font-mono font-bold cursor-pointer"
                    >
                      广播
                    </button>
                  </form>
                </div>

                {/* AI Command Center Assistant QA - Right 7 cols */}
                <div className="lg:col-span-7 bg-[#0f0f12] border border-white/10 rounded-xl p-4 flex flex-col h-full overflow-hidden">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-[10px] uppercase tracking-wider font-mono font-bold text-white flex items-center gap-1.5">
                      <Sparkles className="h-3.5 w-3.5 text-cyan-400" />
                      造船厂总调度 AI 指挥提问台
                    </h3>
                    <span className="text-[8px] font-mono text-gray-500">GEMINI POWERED</span>
                  </div>

                  {/* Chat messages viewport */}
                  <div className="flex-1 overflow-y-auto space-y-2 pr-1 bg-[#060608]/50 rounded-lg p-2.5 border border-white/5 font-mono text-[10.5px]">
                    {chatHistory.map((msg, idx) => (
                      <div key={idx} className={`flex gap-1.5 items-start ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                        {msg.role !== "user" && <span className="text-cyan-400 shrink-0 select-none">[Command]</span>}
                        <div className={`p-1.5 rounded max-w-[85%] leading-relaxed ${
                          msg.role === "user" 
                            ? "bg-cyan-500/10 text-cyan-300 self-end text-right border border-cyan-500/10" 
                            : "text-gray-300 self-start text-left"
                        }`}>
                          {msg.content}
                        </div>
                        {msg.role === "user" && <span className="text-gray-500 shrink-0 select-none">[调度长]</span>}
                      </div>
                    ))}
                    {chatLoading && (
                      <div className="text-gray-500 italic animate-pulse flex items-center gap-1">
                        <RefreshCw className="h-3 w-3 animate-spin text-cyan-400" />
                        指令中枢正在比对全局排班與物资库存关联因子...
                      </div>
                    )}
                  </div>

                  {/* Ask input form */}
                  <form onSubmit={handleSendChatQuery} className="mt-2 flex gap-2 shrink-0">
                    <input
                      type="text"
                      placeholder="提问：钢体车间隔天工效如何调节？/ EH36高强钢到货后如何部署？"
                      value={chatQuery}
                      onChange={(e) => setChatQuery(e.target.value)}
                      className="flex-1 bg-[#060608] border border-white/10 rounded px-2.5 py-1 text-xs text-gray-200 placeholder-gray-600 focus:outline-hidden focus:border-cyan-500 font-sans"
                    />
                    <button
                      type="submit"
                      disabled={chatLoading}
                      className="px-4 bg-cyan-500 hover:bg-cyan-600 text-black font-extrabold rounded text-xs flex items-center gap-1 cursor-pointer transition-all disabled:bg-gray-700"
                    >
                      <Send className="w-3.5 h-3.5" />
                      提问
                    </button>
                  </form>
                </div>
              </div>
            )}
          </div>

        </div>
      </div>

      {/* 3. Footer status row */}
      <footer className="h-8 px-6 bg-[#0a0a0b] border-t border-white/5 flex items-center justify-between text-[9px] text-gray-600 font-mono tracking-wider shrink-0 select-none">
        <div className="flex gap-4">
          <span>APS STATUS: ONLINE</span>
          <span>|</span>
          <span>LATENCY: 9ms</span>
          <span>|</span>
          <span>UPTIME: 99.98%</span>
        </div>
        <div className="flex gap-4">
          <span className="text-cyan-600">UTC CLOCK: 2026-05-23 06:47:08</span>
          <span className="text-gray-400">LOGGED IN AS: CHIEF_ADMIN (duxiaojun1983@gmail.com)</span>
        </div>
      </footer>
    </div>
  );
}
