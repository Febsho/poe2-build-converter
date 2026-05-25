import type { CraftedItem } from '../craftingEngine.ts';
import { POE2_QUALITY_CURRENCIES } from '../../../data/poe2/quality.ts';
import type { CraftingResult } from './applyAbyss.ts';

export function applyQuality(
  item: CraftedItem,
  qualityId: string
): CraftingResult {
  const cloned = JSON.parse(JSON.stringify(item)) as CraftedItem;
  const warnings: string[] = [];

  const qc = POE2_QUALITY_CURRENCIES.find((q) => q.id === qualityId);
  const increment = qc ? qc.qualIncrement : 5;

  if (cloned.quality >= 20) {
    warnings.push("Quality is already capped at +20%.");
  } else {
    cloned.quality = Math.min(20, cloned.quality + increment);
  }

  return {
    item: cloned,
    addedMods: [],
    removedMods: [],
    warnings,
  };
}
