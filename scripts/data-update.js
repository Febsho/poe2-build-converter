#!/usr/bin/env node
/**
 * npm run data:update [-- --only patches,gems]
 */
import { importAll } from '../src/data/importers/index.js';

const args = process.argv.slice(2);
const onlyIdx = args.indexOf('--only');
const categories = onlyIdx !== -1 && args[onlyIdx + 1]
  ? args[onlyIdx + 1].split(',').map(s => s.trim())
  : null;

console.log('[data:update] Starting import', categories ? `(categories: ${categories.join(', ')})` : '(all)');

try {
  const results = await importAll({ categories });
  const ok  = Object.values(results).filter(r => r?.ok).length;
  const bad = Object.values(results).filter(r => !r?.ok);
  console.log(`[data:update] Complete — ${ok} succeeded, ${bad.length} failed`);
  if (bad.length) process.exitCode = 1;
} catch (err) {
  console.error('[data:update] Fatal:', err.message);
  process.exitCode = 1;
}
