import fs from "fs/promises";
import path from "path";
import { INITIAL_DOCKS, INITIAL_PROJECTS, INITIAL_MATERIALS, INITIAL_CREWS } from "./mockData.js";

// Structure of our persistent JSON database
export interface ShipyardDatabaseSchema {
  sys_docks: typeof INITIAL_DOCKS;
  shipyard_projects: typeof INITIAL_PROJECTS;
  sys_materials: typeof INITIAL_MATERIALS;
  sys_crews: typeof INITIAL_CREWS;
  telemetry_logs: Array<{
    id: number;
    timestamp: string;
    category: "info" | "success" | "warning" | "danger";
    source_module: string;
    message_text: string;
  }>;
}

const dbPath = path.join(process.cwd(), "database.json");
let dbCachedData: ShipyardDatabaseSchema | null = null;

/**
 * Loads the JSON database from disk, or initializes it with seed data if not present.
 */
export async function getDb(): Promise<ShipyardDatabaseSchema> {
  if (dbCachedData) {
    return dbCachedData;
  }

  try {
    // Check if the database.json file already exists
    try {
      await fs.access(dbPath);
      const dataStr = await fs.readFile(dbPath, "utf-8");
      dbCachedData = JSON.parse(dataStr);
      console.log(`[DB] Loaded existing persistent JSON database from: ${dbPath}`);
    } catch (notFound) {
      console.log(`[DB] Database file not found. Initializing seed data to: ${dbPath}`);
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
            message_text: "造船厂人工智能排程与先进中控平台 (Aegis APS) 本地 JSON 持久化数据库加载成功。",
          }
        ]
      };
      await fs.writeFile(dbPath, JSON.stringify(initialDb, null, 2), "utf-8");
      dbCachedData = initialDb;
    }
    return dbCachedData!;
  } catch (err) {
    console.error("[DB] Critical error in JSON Database client:", err);
    throw err;
  }
}

/**
 * Persists the changes to disk.
 */
export async function saveDb(data: ShipyardDatabaseSchema): Promise<void> {
  dbCachedData = data;
  await fs.writeFile(dbPath, JSON.stringify(data, null, 2), "utf-8");
}

/**
 * Helper to log events dynamically.
 */
export async function addTelemetryLog(
  category: "info" | "success" | "warning" | "danger",
  sourceModule: string,
  messageText: string
): Promise<void> {
  const db = await getDb();
  const nextId = db.telemetry_logs.length > 0 
    ? Math.max(...db.telemetry_logs.map(log => log.id)) + 1 
    : 1;

  db.telemetry_logs.push({
    id: nextId,
    timestamp: new Date().toISOString(),
    category,
    source_module: sourceModule,
    message_text: messageText,
  });

  await saveDb(db);
}
