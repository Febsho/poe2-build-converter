import type { CraftedItem } from '../craftingEngine.ts';
import type { Modifier } from '../../../data/poe2/types.ts';
import { POE2_OMENS } from '../../../data/poe2/omens.ts';
import type { CraftingResult } from './applyAbyss.ts';

export function applyOmen(
  item: CraftedItem,
  omenId: string
): CraftingResult {
  const cloned = JSON.parse(JSON.stringify(item)) as CraftedItem;
  const warnings: string[] = [];

  const omen = POE2_OMENS.find((o) => o.id === omenId);
  if (!omen) {
    warnings.push(`Unknown Omen '${omenId}'.`);
    return { item: cloned, addedMods: [], removedMods: [], warnings };
  }

  // Omens are consumed on next action, but we can log that we are preparing it.
  return {
    item: cloned,
    addedMods: [],
    removedMods: [],
    warnings,
  };
}
