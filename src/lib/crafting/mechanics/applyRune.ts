import type { CraftedItem } from '../craftingEngine.ts';
import type { Modifier } from '../../../data/poe2/types.ts';
import { POE2_RUNES } from '../../../data/poe2/runes.ts';
import type { CraftingResult } from './applyAbyss.ts';

export function applyRune(
  item: CraftedItem,
  runeId: string
): CraftingResult {
  const cloned = JSON.parse(JSON.stringify(item)) as CraftedItem;
  const warnings: string[] = [];
  const addedMods: Modifier[] = [];

  const rune = POE2_RUNES.find((r) => r.id === runeId);
  if (!rune) {
    warnings.push(`Unknown Rune '${runeId}'.`);
    return { item: cloned, addedMods: [], removedMods: [], warnings };
  }

  // Pick effect for this item type (weapon vs armour)
  const baseTags = new Set(cloned.base.tags ?? []);
  const effect = (rune.effects ?? []).find((e) => baseTags.has(e.itemType)) ?? (rune.effects ?? [])[0];

  const newMod: Modifier = {
    id: `rune-${rune.id}-${Date.now()}`,
    name: rune.name,
    text: effect?.text ?? rune.description,
    type: "implicit",
    weight: 1,
    requiredItemLevel: 1,
    tags: []
  };

  cloned.implicits.push(newMod);
  addedMods.push(newMod);

  return {
    item: cloned,
    addedMods,
    removedMods: [],
    warnings,
  };
}
