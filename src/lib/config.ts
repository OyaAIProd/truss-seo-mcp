import { homedir } from 'node:os';
import { join } from 'node:path';
import { mkdirSync } from 'node:fs';

const DATA_DIR = join(homedir(), '.truss', 'seo');

// Ensure data directory exists on import
try {
  mkdirSync(DATA_DIR, { recursive: true });
} catch {
  // ignore — directory already exists
}

export function getConfig() {
  return {
    licenseKey: process.env.TRUSS_LICENSE_KEY,
    anthropicApiKey: process.env.ANTHROPIC_API_KEY,
    openaiApiKey: process.env.OPENAI_API_KEY,
    trussApiBaseUrl: process.env.TRUSS_API_BASE_URL || 'https://api.truss.dev',
    dataDir: DATA_DIR,
  };
}

export function getDataDir(): string {
  return DATA_DIR;
}

export function getDbPath(): string {
  return join(DATA_DIR, 'seo-usage.db');
}

export function hasAiKey(): boolean {
  return !!(process.env.ANTHROPIC_API_KEY || process.env.OPENAI_API_KEY);
}
