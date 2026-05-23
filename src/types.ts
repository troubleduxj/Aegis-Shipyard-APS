export interface ProjectStage {
  name: string;
  start: string;
  end: string;
  progress: number;
  status: "pending" | "active" | "completed";
}

export interface ShipProject {
  id: string;
  name: string; // e.g. "Bulk Carrier BC-105"
  vesselType: "" | "Bulk Carrier" | "LNG Carrier" | "Container Vessel" | "Oil Tanker";
  deadweightTons: number; // e.g. 82000
  start: string; 
  end: string;
  progress: number; // 0 - 100
  currentStage: string; // e.g. "Steel Cutting"
  dockId: string; // assigned dock
  client: string; // Shipowner e.g. "Cosco Shipping"
  stages: ProjectStage[];
}

export interface MaterialItem {
  id: string;
  name: string;
  category: "Steel Base" | "Propulsion & Power" | "Pipes & Fittings" | "Paint & Protective" | "Electrical & Controls";
  currentStock: number;
  unit: "Tons" | "Units" | "Meters" | "Liters" | "Sets";
  safetyStock: number;
  allocated: number; // Allocated to active projects
  incomingQty: number;
  incomingDate: string; // e.g. "2026-06-05"
}

export interface EmployeeCrew {
  id: string;
  crewName: string; // e.g. "Welding Team Alpha"
  skillCategory: "Welding" | "Hull Fitting" | "Outfitting" | "Painting & Blasting" | "Electrical & Cabling" | "Quality Inspection";
  headcount: number;
  shiftType: "Day Shift" | "Night Shift" | "Rotating Shift" | "Standby";
  assignedProjectId: string;
  efficiencyRate: number; // 0 - 100% or 120% metric of production speed
  safetyDays: number; // consecutive days without incident
  status: "productive" | "idle" | "rest";
}

export interface ShipyardDock {
  id: string;
  name: string; // e.g. "Dry Dock No.1"
  type: "Dry Dock" | "Building Berth" | "Outfitting Quay";
  maxDwt: number; // Max capacity e.g. 150000 DWT
  length: number; // meters e.g. 320
  width: number; // meters e.g. 56
  isOccupied: boolean;
  currentVesselId?: string;
}

export interface CriticalConflict {
  id: string;
  severity: "HIGH" | "MEDIUM" | "INFO";
  title: string;
  description: string;
  affectedProjects: string[];
  suggestedAction: string;
}

export interface OptimizedMilestone {
  project: string;
  stage: string;
  originalEnd: string;
  optimizedEnd: string;
  note: string;
}

export interface MaterialAllocation {
  material: string;
  source: string;
  qty: string;
  targetProject: string;
  status: string;
}

export interface PersonnelFinetune {
  team: string;
  shift: string;
  adjustment: string;
}

export interface OptimizationResult {
  criticalConflicts: CriticalConflict[];
  optimizedMilestones: OptimizedMilestone[];
  materialAllocations: MaterialAllocation[];
  personnelFinetunes: PersonnelFinetune[];
  executiveSummary: string;
}
