import type { CraftedItem } from '../craftingEngine.ts';
import type { Modifier } from '../../../data/poe2/types.ts';
import { POE2_ESSENCES } from '../../../data/poe2/essences.ts';
import { POE2_MODIFIERS } from '../../../data/poe2/modifiers.ts';
import { addRandomModifier } from '../craftingEngine.ts';
import type { CraftingResult } from './applyAbyss.ts';

export function applyEssence(
  item: CraftedItem,
  essenceId: string
): CraftingResult {
  const cloned = JSON.parse(JSON.stringify(item)) as CraftedItem;
  const addedMods: Modifier[] = [];
  const warnings: string[] = [];

  const essence = POE2_ESSENCES.find((e) => e.id === essenceId);
  if (!essence) {
    warnings.push(`Unknown essence '${essenceId}'.`);
    return { item: cloned, addedMods: [], removedMods: [], warnings };
  }

  cloned.rarity = 'rare';
  cloned.prefixes = [];
  cloned.suffixes = [];

  const baseTags = new Set(cloned.base.tags);
  let bestFm = null;
  let bestScore = 0;
  for (const fm of essence.forcedMods) {
    const score = fm.itemTags.filter((t) => baseTags.has(t)).length;
    if (score > bestScore) {
      bestScore = score;
      bestFm = fm;
    }
  }

  let forcedType: 'prefix' | 'suffix' = 'prefix';
  if (bestFm) {
    const txt = bestFm.modText.toLowerCase();
    if (
      txt.includes('resistance') ||
      txt.includes('% to critical') ||
      txt.includes('cast speed') ||
      txt.includes('attack speed') ||
      txt.includes('movement speed')
    ) {
      forcedType = 'suffix';
    }

    const newMod: Modifier = {
      id: `essence-forced-${essence.id}-${Date.now()}`,
      name: essence.name,
      text: bestFm.modText,
      type: forcedType,
      tier: 1,
      weight: 1,
      requiredItemLevel: 1,
      tags: [],
    };
    if (forcedType === 'prefix') cloned.prefixes.push(newMod);
    else cloned.suffixes.push(newMod);
    addedMods.push(newMod);
  } else {
    warnings.push(`Essence forced mod missing for base tags: ${cloned.base.tags.join(', ')}.`);
  }

  // Add remaining modifiers to Rare limit (up to 4 to 6 total)
  const desired = 4;
  const remaining = bestFm ? desired - 1 : desired;
  for (let i = 0; i < remaining; i++) {
    const rolled = addRandomModifier(cloned, POE2_MODIFIERS);
    if (rolled) addedMods.push(rolled);
  }

  return {
    item: cloned,
    addedMods,
    removedMods: [],
    warnings,
  };
}
