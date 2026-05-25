/**
 * File-based JSON data store.
 * All data lives in /data/cache/ (gitignored at runtime).
 * Fails silently — the app always works even if data/ is empty.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname  = path.dirname(fileURLToPath(import.meta.url));
export const DATA_ROOT = path.resolve(__dirname, '../../data');
export const CACHE_DIR = path.join(DATA_ROOT, 'cache');
export const RAW_DIR   = path.join(DATA_ROOT, 'raw');

export async function ensureDirs() {
  for (const d of [DATA_ROOT, CACHE_DIR, RAW_DIR]) {
    if (!existsSync(d)) await mkdir(d, { recursive: true });
  }
}

export async function readCache(name) {
  try {
    const raw = await readFile(path.join(CACHE_DIR, `${name}.json`), 'utf8');
    return JSON.parse(raw);
  } catch { return null; }
}

export async function writeCache(name, data) {
  await ensureDirs();
  await writeFile(path.join(CACHE_DIR, `${name}.json`), JSON.stringify(data, null, 2), 'utf8');
}

export async function writeRaw(name, data) {
  await ensureDirs();
  await writeFile(path.join(RAW_DIR, `${name}.json`), JSON.stringify(data, null, 2), 'utf8');
}

export async function readMeta() {
  return (await readCache('_meta')) ?? { sources: {}, lastGlobalUpdate: null };
}

export async function touchSource(name, update) {
  const meta = await readMeta();
  meta.sources[name] = { ...(meta.sources[name] || {}), ...update, lastUpdated: new Date().toISOString() };
  meta.lastGlobalUpdate = new Date().toISOString();
  await writeCache('_meta', meta);
  return meta;
}
