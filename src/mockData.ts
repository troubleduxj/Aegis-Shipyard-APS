import { ShipProject, MaterialItem, EmployeeCrew, ShipyardDock } from "./types";

export const INITIAL_DOCKS: ShipyardDock[] = [
  { id: "dock-1", name: "大型干船坞 No.1 (Dry Dock 1)", type: "Dry Dock", maxDwt: 200000, length: 360, width: 68, isOccupied: true, currentVesselId: "proj-1" },
  { id: "dock-2", name: "中型船台 No.2 (Building Berth 2)", type: "Building Berth", maxDwt: 100000, length: 280, width: 48, isOccupied: true, currentVesselId: "proj-2" },
  { id: "dock-3", name: "智能舾装码头 No.3 (Outfitting Quay 3)", type: "Outfitting Quay", maxDwt: 150000, length: 420, width: 35, isOccupied: true, currentVesselId: "proj-3" },
  { id: "dock-4", name: "深水总装码头 No.4 (Outfitting Quay 4)", type: "Outfitting Quay", maxDwt: 300000, length: 500, width: 45, isOccupied: false }
];

export const INITIAL_PROJECTS: ShipProject[] = [
  {
    id: "proj-1",
    name: "LNG Carrier Ocean-82",
    vesselType: "LNG Carrier",
    deadweightTons: 174000,
    start: "2026-03-01",
    end: "2026-08-15",
    progress: 45,
    currentStage: "Hull Assembly",
    dockId: "dock-1",
    client: "Global LNG Shipping Inc.",
    stages: [
      { name: "钢板开割 (Steel Cutting)", start: "2026-03-01", end: "2026-03-25", progress: 100, status: "completed" },
      { name: "起龙骨 (Keel Laying)", start: "2026-03-26", end: "2026-04-10", progress: 100, status: "completed" },
      { name: "船体合拢/分段建造 (Hull Assembly)", start: "2026-04-11", end: "2026-06-15", progress: 65, status: "active" },
      { name: "下水仪式 (Vessel Launching)", start: "2026-06-16", end: "2026-06-25", progress: 0, status: "pending" },
      { name: "舾装/内装工程 (Outfitting)", start: "2026-06-26", end: "2026-07-30", progress: 0, status: "pending" },
      { name: "系泊与海试 (Testing & Sea Trials)", start: "2026-08-01", end: "2026-08-15", progress: 0, status: "pending" }
    ]
  },
  {
    id: "proj-2",
    name: "Bulk Carrier Titan-105",
    vesselType: "Bulk Carrier",
    deadweightTons: 82000,
    start: "2026-04-10",
    end: "2026-09-30",
    progress: 30,
    currentStage: "Steel Cutting",
    dockId: "dock-2",
    client: "Cosco Shipping Bulk Co.",
    stages: [
      { name: "钢板开割 (Steel Cutting)", start: "2026-04-10", end: "2026-05-15", progress: 100, status: "completed" },
      { name: "起龙骨 (Keel Laying)", start: "2026-05-16", end: "2026-06-05", progress: 20, status: "active" },
      { name: "船体合拢/分段建造 (Hull Assembly)", start: "2026-06-06", end: "2026-07-30", progress: 0, status: "pending" },
      { name: "下水仪式 (Vessel Launching)", start: "2026-08-01", end: "2026-08-05", progress: 0, status: "pending" },
      { name: "舾装/内装工程 (Outfitting)", start: "2026-08-06", end: "2026-09-10", progress: 0, status: "pending" },
      { name: "系泊与海试 (Testing & Sea Trials)", start: "2026-09-11", end: "2026-09-30", progress: 0, status: "pending" }
    ]
  },
  {
    id: "proj-3",
    name: "Container Vessel Neptune-203",
    vesselType: "Container Vessel",
    deadweightTons: 150000,
    start: "2026-01-15",
    end: "2026-06-30",
    progress: 80,
    currentStage: "Outfitting",
    dockId: "dock-3",
    client: "Maersk Marine Logistics",
    stages: [
      { name: "钢板开割 (Steel Cutting)", start: "2026-01-15", end: "2026-02-10", progress: 100, status: "completed" },
      { name: "起龙骨 (Keel Laying)", start: "2026-02-11", end: "2026-02-28", progress: 100, status: "completed" },
      { name: "船体合拢/分段建造 (Hull Assembly)", start: "2026-03-01", end: "2026-04-30", progress: 100, status: "completed" },
      { name: "下水仪式 (Vessel Launching)", start: "2026-05-01", end: "2026-05-10", progress: 100, status: "completed" },
      { name: "舾装/内装工程 (Outfitting)", start: "2026-05-11", end: "2026-06-15", progress: 65, status: "active" },
      { name: "系泊与海试 (Testing & Sea Trials)", start: "2026-06-16", end: "2026-06-30", progress: 0, status: "pending" }
    ]
  }
];

export const INITIAL_MATERIALS: MaterialItem[] = [
  { id: "mat-1", name: "船用EH36高强钢板", category: "Steel Base", currentStock: 480, unit: "Tons", safetyStock: 200, allocated: 380, incomingQty: 150, incomingDate: "2026-06-03" },
  { id: "mat-2", name: "船用AH36球扁钢", category: "Steel Base", currentStock: 210, unit: "Tons", safetyStock: 100, allocated: 150, incomingQty: 80, incomingDate: "2026-05-30" },
  { id: "mat-3", name: "双燃料主机(船用主发动机)", category: "Propulsion & Power", currentStock: 1, unit: "Sets", safetyStock: 1, allocated: 1, incomingQty: 2, incomingDate: "2026-06-20" },
  { id: "mat-4", name: "大马力定距螺旋桨", category: "Propulsion & Power", currentStock: 2, unit: "Sets", safetyStock: 1, allocated: 1, incomingQty: 1, incomingDate: "2026-07-01" },
  { id: "mat-5", name: "船用无缝不锈钢压力管管件", category: "Pipes & Fittings", currentStock: 850, unit: "Meters", safetyStock: 500, allocated: 620, incomingQty: 300, incomingDate: "2026-06-12" },
  { id: "mat-6", name: "耐盐雾防腐阻燃油漆", category: "Paint & Protective", currentStock: 180, unit: "Liters", safetyStock: 100, allocated: 110, incomingQty: 200, incomingDate: "2026-05-28" },
  { id: "mat-7", name: "高柔性变频铜芯铠装船用电缆", category: "Electrical & Controls", currentStock: 4300, unit: "Meters", safetyStock: 1500, allocated: 3500, incomingQty: 1200, incomingDate: "2026-06-10" }
];

export const INITIAL_CREWS: EmployeeCrew[] = [
  { id: "crew-1", crewName: "焊接工艺1班 (Welding班)", skillCategory: "Welding", headcount: 32, shiftType: "Day Shift", assignedProjectId: "proj-1", efficiencyRate: 94, safetyDays: 450, status: "productive" },
  { id: "crew-2", crewName: "焊接工艺2班 (Welding班)", skillCategory: "Welding", headcount: 28, shiftType: "Night Shift", assignedProjectId: "proj-1", efficiencyRate: 88, safetyDays: 240, status: "productive" },
  { id: "crew-3", crewName: "船体总装装配组", skillCategory: "Hull Fitting", headcount: 45, shiftType: "Day Shift", assignedProjectId: "proj-2", efficiencyRate: 91, safetyDays: 320, status: "productive" },
  { id: "crew-4", crewName: "精细起重舾装班", skillCategory: "Outfitting", headcount: 18, shiftType: "Day Shift", assignedProjectId: "proj-3", efficiencyRate: 98, safetyDays: 820, status: "productive" },
  { id: "crew-5", crewName: "涂装防腐除锈班", skillCategory: "Painting & Blasting", headcount: 22, shiftType: "Rotating Shift", assignedProjectId: "proj-3", efficiencyRate: 82, safetyDays: 190, status: "productive" },
  { id: "crew-6", crewName: "智能电系统控制调试组", skillCategory: "Electrical & Cabling", headcount: 15, shiftType: "Day Shift", assignedProjectId: "proj-3", efficiencyRate: 105, safetyDays: 610, status: "productive" },
  { id: "crew-7", crewName: "船级社联合无损检测组", skillCategory: "Quality Inspection", headcount: 8, shiftType: "Standby", assignedProjectId: "", efficiencyRate: 100, safetyDays: 1200, status: "rest" }
];
