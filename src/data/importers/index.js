import { importPatches } from './patches.js';
import { importGems } from './gems.js';
import { importUniques } from './uniques.js';
import { importItems } from './items.js';

export async function importAll({ categories } = {}) {
  const run = name => !categories || categories.includes(name);
  const results = {};

  if (run('patches')) {
    console.log('[importer] Running patches...');
    results.patches = await importPatches();
  }

  if (run('gems')) {
    console.log('[importer] Running gems...');
    results.gems = await importGems();
  }

  if (run('uniques')) {
    console.log('[importer] Running uniques...');
    results.uniques = await importUniques();
  }

  if (run('items')) {
    console.log('[importer] Running items...');
    results.items = await importItems();
  }

  console.log('[importer] Done.', results);
  return results;
}
