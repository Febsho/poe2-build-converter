import type { Modifier } from '../../data/poe2/itemBases.ts';

export function rollWeightedModifier(pool: Modifier[]): Modifier | null {
  const total = pool.reduce((sum, mod) => sum + Math.max(0, mod.weight), 0);
  if (!pool.length || total <= 0) return null;
  let roll = Math.random() * total;
  for (const mod of pool) {
    roll -= Math.max(0, mod.weight);
    if (roll <= 0) return mod;
  }
  return pool[pool.length - 1] ?? null;
}
