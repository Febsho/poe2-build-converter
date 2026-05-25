import type { CraftedItem, CraftingContext } from '../craftingEngine.ts';
import type { DesecrationCraftingData } from '../../../data/poe2/desecration.ts';
import type { Modifier } from '../../../data/poe2/types.ts';
import type { CraftingResult } from './applyAbyss.ts';
import { validateDesecration } from './validateDesecration.ts';
import { getDesecrationModifierPool } from './desecrationPool.ts';
import { rollWeightedModifier } from '../weightedRoll.ts';

// Add modifier helper
function addModifierToItem(item: CraftedItem, mod: Modifier): CraftedItem {
  const cloned = JSON.parse(JSON.stringify(item)) as CraftedItem;
  if (mod.type === 'prefix') {
    cloned.prefixes.push(mod);
  } else if (mod.type === 'suffix') {
    cloned.suffixes.push(mod);
  }
  return cloned;
}

export function applyDesecration(
  item: CraftedItem,
  desecration: DesecrationCraftingData,
  context: CraftingContext
): CraftingResult {
  const problems = validateDesecration(item, desecration, context);

  const blockingProblems = problems.filter(p => p.severity === "error");

  if (blockingProblems.length > 0) {
    return {
      item,
      addedMods: [],
      removedMods: [],
      warnings: problems.map(p => p.message),
    };
  }

  let nextItem = JSON.parse(JSON.stringify(item)) as CraftedItem;
  const addedMods: Modifier[] = [];
  const removedMods: Modifier[] = [];

  // If real Desecration modifier pools exist, roll from them.
  const validPool = getDesecrationModifierPool(nextItem, desecration, context);

  if (desecration.addsModifiers && validPool.length > 0) {
    const rolledMod = rollWeightedModifier(validPool);

    if (rolledMod) {
      nextItem = addModifierToItem(nextItem, rolledMod);
      addedMods.push(rolledMod);
    }
  }

  // If data is incomplete and no real pool exists, do not fake a result.
  if (desecration.addsModifiers && validPool.length === 0) {
    problems.push({
      severity: "warning",
      code: "DESECRATION_EMPTY_MOD_POOL",
      message:
        "No valid Desecration modifier pool found. No modifier was added.",
    });
  }

  return {
    item: nextItem,
    addedMods,
    removedMods,
    warnings: problems.map(p => p.message),
  };
}
