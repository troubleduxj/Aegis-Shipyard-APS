import fs from "fs/promises";
import path from "path";
import { INITIAL_DOCKS, INITIAL_PROJECTS, INITIAL_MATERIALS, INITIAL_CREWS } from "./mockData.js";
import { ShipyardDatabaseSchema } from "./server_db.js";

const dbPath = path.join(process.cwd(), "database.json");

async function runMigration() {
  console.log("[MIGRATION] Starting database schema migration and clean initialization...");

  const initialDb: ShipyardDatabaseSchema = {
    sys_docks: INITIAL_DOCKS,
    shipyard_projects: INITIAL_PROJECTS,
    sys_materials: INITIAL_MATERIALS,
    sys_crews: INITIAL_CREWS,
    telemetry_logs: [
      {
        id: 1,
        timestamp: new Date().toISOString(),
        category: "success",
        source_module: "SYS",
        message_text: "数据库迁移脚本 `npm run db:migrate` 执行完毕：核心数据表已重构和全新初始化。",
      }
    ]
  };

  try {
    // Overwrite database.json completely for a fresh clean migration
    await fs.writeFile(dbPath, JSON.stringify(initialDb, null, 2), "utf-8");
    console.log(`[MIGRATION] Successfully created clean structured database at: ${dbPath}`);
    console.log("[MIGRATION] Tables initialized:");
    console.log(` - sys_docks (${initialDb.sys_docks.length} records)`);
    console.log(` - shipyard_projects (${initialDb.shipyard_projects.length} records)`);
    console.log(` - sys_materials (${initialDb.sys_materials.length} records)`);
    console.log(` - sys_crews (${initialDb.sys_crews.length} records)`);
    console.log(` - telemetry_logs (${initialDb.telemetry_logs.length} records)`);
    process.exit(0);
  } catch (err) {
    console.error("[MIGRATION] Critical failure on running migrations:", err);
    process.exit(1);
  }
}

runMigration();
