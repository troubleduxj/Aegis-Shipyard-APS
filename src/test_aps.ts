import { runApsSolver } from "./aps_solver.js";
import { ShipProject, ShipyardDock } from "./types.js";

// Generate extreme test data (TSK-204)
function generateExtremeDataset(vesselCount = 52): { projects: ShipProject[]; docks: ShipyardDock[] } {
  const docks: ShipyardDock[] = [
    { id: "narrow-dock-1", name: "狭窄临时船坞A-1", type: "Dry Dock", maxDwt: 80000, length: 250, width: 38, isOccupied: false },
    { id: "narrow-dock-2", name: "狭窄临时船坞B-2", type: "Building Berth", maxDwt: 60000, length: 220, width: 35, isOccupied: false }
  ];

  const projects: ShipProject[] = [];

  for (let i = 1; i <= vesselCount; i++) {
    const vesselType = i % 2 === 0 ? "Bulk Carrier" : "LNG Carrier";
    projects.push({
      id: `stress-vessel-${i}`,
      name: `${vesselType} Stress-${i.toString().padStart(3, "0")}`,
      vesselType: vesselType,
      deadweightTons: 50000 + (i * 1000) % 50000,
      start: "2026-05-01",
      end: "2026-10-31",
      progress: 0,
      currentStage: "Steel Cutting",
      dockId: i % 2 === 0 ? "narrow-dock-1" : "narrow-dock-2",
      client: `Stress Testing Agency Ltd. (Vessel #${i})`,
      stages: [
        { name: `钢板开割 (Steel Cutting) #${i}`, start: "2026-05-01", end: "2026-05-15", progress: 0, status: "pending" },
        { name: `起龙骨 (Keel Laying) #${i}`, start: "2026-05-16", end: "2026-06-05", progress: 0, status: "pending" },
        { name: `船体合拢/分段建造 (Hull Assembly) #${i}`, start: "2026-06-06", end: "2026-07-30", progress: 0, status: "pending" },
        { name: `下水仪式 (Vessel Launching) #${i}`, start: "2026-08-01", end: "2026-08-05", progress: 0, status: "pending" },
        { name: `装/内装工程 (Outfitting) #${i}`, start: "2026-08-06", end: "2026-09-10", progress: 0, status: "pending" },
        { name: `系泊与海试 (Testing & Sea Trials) #${i}`, start: "2026-09-11", end: "2026-09-30", progress: 0, status: "pending" }
      ]
    });
  }

  return { projects, docks };
}

async function startStressTest() {
  console.log("================================================================================");
  console.log("             Aegis Shipyard APS Solver Extreme Stress Testing (TSK-204)");
  console.log("================================================================================");

  const numVessels = 55;
  console.log(`[STRESS] Generating extreme stress data containing ${numVessels} heavy container/LNG/Bulk vessels...`);
  const { projects, docks } = generateExtremeDataset(numVessels);
  const totalStagesCount = projects.reduce((acc, p) => acc + p.stages.length, 0);
  console.log(`[STRESS] Total generated 2D spatial-temporal interdependent heavy tasks: ${totalStagesCount}`);

  // Garbage Collector check if available
  const initialMemory = process.memoryUsage().heapUsed / 1024 / 1024;
  console.log(`[STRESS] Initial Heap Used: ${initialMemory.toFixed(2)} MB`);

  console.log("[STRESS] Starting high-performance rule-based packing and CPM sorting calculation...");
  const startTime = performance.now();

  // Run the solver under highly constrained resources (max 150 workers globally)
  const result = runApsSolver(projects, docks, 150, "2026-05-01");

  const endTime = performance.now();
  const timeTakenMs = endTime - startTime;
  const finalMemory = process.memoryUsage().heapUsed / 1024 / 1024;

  console.log("\n============================ STRESS TEST REPORT ============================");
  console.log(`- Time consumed:      ${timeTakenMs.toFixed(3)} ms (${(timeTakenMs / 1000).toFixed(4)} seconds)`);
  console.log(`- Executed within SLA limits (< 2 seconds)? : ${timeTakenMs < 2000 ? "✅ SUCCESS" : "❌ FAILED"}`);
  console.log(`- Allocated tasks:    ${result.allocations.length} / ${totalStagesCount} stages`);
  console.log(`- Memory profile:     Initial ${initialMemory.toFixed(2)} MB -> Final ${finalMemory.toFixed(2)} MB (Delta: ${(finalMemory - initialMemory).toFixed(2)} MB)`);
  console.log(`- Solver message:     ${result.success ? "Calculated perfectly without deadlock." : "Failed."}`);
  console.log("============================================================================\n");

  if (timeTakenMs < 2000) {
    console.log("[STRESS] SLA standard respected. APS packing heuristics are optimized for high concurrency.");
    process.exit(0);
  } else {
    console.error("[STRESS] SLA breach. High complexity packing is slower than 2 seconds.");
    process.exit(1);
  }
}

startStressTest().catch(err => {
  console.error("[STRESS ERROR] Critical exception in stress testing script:", err);
  process.exit(1);
});
