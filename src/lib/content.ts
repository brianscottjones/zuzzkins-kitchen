import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';

function resolveContentPath(): string {
  // Always try cwd-based path first (works in both dev and build)
  const cwdPath = resolve(process.cwd(), 'src/data/content.json');
  try {
    readFileSync(cwdPath, 'utf-8');
    return cwdPath;
  } catch {}
  
  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = dirname(__filename);
    return join(__dirname, '../data/content.json');
  } catch {
    return cwdPath;
  }
}

const CONTENT_PATH = resolveContentPath();

export function readContent() {
  const raw = readFileSync(CONTENT_PATH, 'utf-8');
  return JSON.parse(raw);
}

export function writeContent(data: unknown) {
  writeFileSync(CONTENT_PATH, JSON.stringify(data, null, 2), 'utf-8');
}

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}
