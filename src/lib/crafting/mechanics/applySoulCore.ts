import type { CraftedItem } from '../craftingEngine.ts';
import type { Modifier } from '../../../data/poe2/types.ts';
import { POE2_SOUL_CORES } from '../../../data/poe2/soulCores.ts';
import type { CraftingResult } from './applyAbyss.ts';

export function applySoulCore(
  item: CraftedItem,
  soulCoreId: string
): CraftingResult {
  const cloned = JSON.parse(JSON.stringify(item)) as CraftedItem;
  const warnings: string[] = [];
  const addedMods: Modifier[] = [];

  const core = POE2_SOUL_CORES.find((c) => c.id === soulCoreId);
  if (!core) {
    warnings.push(`Unknown Soul Core '${soulCoreId}'.`);
    return { item: cloned, addedMods: [], removedMods: [], warnings };
  }

  const baseTags = new Set(cloned.base.tags ?? []);
  const effect = (core.effects ?? []).find((e) => baseTags.has(e.itemType)) ?? (core.effects ?? [])[0];

  const newMod: Modifier = {
    id: `soul-core-${core.id}-${Date.now()}`,
    name: core.name,
    text: effect?.text ?? core.description,
    type: "implicit",
    weight: 1,
    requiredItemLevel: 1,
    tags: []
  };

  cloned.implicits.push(newMod);
  addedMods.push(newMod);

  if (!core.dataComplete) {
    warnings.push(`Soul Core '${core.name}' has incomplete database coverage.`);
  }

  return {
    item: cloned,
    addedMods,
    removedMods: [],
    warnings,
  };
}
