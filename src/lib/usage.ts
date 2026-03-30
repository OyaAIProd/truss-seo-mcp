import Database from 'better-sqlite3';
import { getDbPath } from './config.js';
import { getLicenseStatus } from './license.js';

const FREE_TIER_DAILY_LIMIT = 3;

let db: Database.Database | null = null;

function getDb(): Database.Database {
  if (!db) {
    db = new Database(getDbPath());
    db.pragma('journal_mode = WAL');
    db.exec(`
      CREATE TABLE IF NOT EXISTS usage (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tool_name TEXT NOT NULL,
        timestamp TEXT NOT NULL DEFAULT (datetime('now')),
        date_utc TEXT NOT NULL DEFAULT (date('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_usage_date ON usage(date_utc);
      CREATE INDEX IF NOT EXISTS idx_usage_tool ON usage(tool_name);
    `);
  }
  return db;
}

export function recordToolUsage(toolName: string): void {
  const database = getDb();
  database.prepare('INSERT INTO usage (tool_name) VALUES (?)').run(toolName);
}

export function getTodayUsageCount(): number {
  const database = getDb();
  const row = database
    .prepare("SELECT COUNT(*) as cnt FROM usage WHERE date_utc = date('now')")
    .get() as { cnt: number };
  return row.cnt;
}

export async function checkUsageQuota(): Promise<{
  allowed: boolean;
  remaining: number;
  limit: number;
  tier: string;
}> {
  const license = await getLicenseStatus();

  if (license.tier === 'pro') {
    return { allowed: true, remaining: Infinity, limit: Infinity, tier: 'pro' };
  }

  const used = getTodayUsageCount();
  const remaining = Math.max(0, FREE_TIER_DAILY_LIMIT - used);

  return {
    allowed: remaining > 0,
    remaining,
    limit: FREE_TIER_DAILY_LIMIT,
    tier: 'free',
  };
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}
