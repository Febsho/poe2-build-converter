import type { CraftedItem, CraftingContext } from '../craftingEngine.ts';
import type { DesecrationCraftingData } from '../../../data/poe2/desecration.ts';
import type { Modifier } from '../../../data/poe2/types.ts';
import { explicitLimit } from '../validation.ts';

function wouldViolateModGroup(item: CraftedItem, mod: Modifier): boolean {
  const existingGroups = new Set([...item.prefixes, ...item.suffixes].map(m => m.group || m.id));
  return existingGroups.has(mod.group || mod.id);
}

function hasOpenAffixSlot(item: CraftedItem, mod: Modifier): boolean {
  const limit = explicitLimit(item.rarity);
  if (mod.type === 'prefix') {
    return item.prefixes.length < limit;
  } else if (mod.type === 'suffix') {
    return item.suffixes.length < limit;
  }
  return false;
}

export function getDesecrationModifierPool(
  item: CraftedItem,
  desecration: DesecrationCraftingData,
  context: CraftingContext
): Modifier[] {
  const poolIds = desecration.modifierPoolIds ?? [];
  const modifiersList = context.qualityData?.modifiers || []; // fallback/real modifiers

  let pool = modifiersList.filter(mod => {
    if (poolIds.length > 0 && !poolIds.includes(mod.id)) return false;
    if (mod.requiredItemLevel > item.itemLevel) return false;
    if (!mod.tags.some(tag => item.base.tags.includes(tag))) return false;
    if (wouldViolateModGroup(item, mod)) return false;
    if (!hasOpenAffixSlot(item, mod)) return false;
    return true;
  });

  if (desecration.forcedModifierIds?.length) {
    pool = pool.filter(mod => desecration.forcedModifierIds!.includes(mod.id));
  }

  return pool;
}
