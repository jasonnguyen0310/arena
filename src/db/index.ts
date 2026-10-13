import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import path from "node:path";
import fs from "node:fs";
import * as schema from "./schema";

const dataDir = path.join(process.cwd(), "data");
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Cache across HMR reloads in dev — otherwise every hot update leaks a fresh
// SQLite connection + prepared-statement cache until the process OOMs.
type Cached = { sqlite?: Database.Database; db?: ReturnType<typeof drizzle<typeof schema>>; migrated?: boolean };
const g = globalThis as unknown as { __arenaDb?: Cached };
const cache: Cached = g.__arenaDb ?? (g.__arenaDb = {});

if (!cache.sqlite) {
  cache.sqlite = new Database(path.join(dataDir, "arena.db"));
  cache.sqlite.pragma("journal_mode = WAL");
}
if (!cache.db) {
  cache.db = drizzle(cache.sqlite, { schema });
}
if (!cache.migrated) {
  migrate(cache.db, { migrationsFolder: path.join(process.cwd(), "drizzle") });
  cache.migrated = true;
}

export const db = cache.db;
export { schema };
