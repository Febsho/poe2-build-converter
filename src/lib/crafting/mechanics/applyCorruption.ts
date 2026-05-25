import type { CraftedItem } from '../craftingEngine.ts';
import type { Modifier } from '../../../data/poe2/types.ts';
import { POE2_CORRUPTION_OUTCOMES, POE2_CORRUPTION_IMPLICITS } from '../../../data/poe2/corruption.ts';
import { POE2_MODIFIERS } from '../../../data/poe2/modifiers.ts';
import { addRandomModifier } from '../craftingEngine.ts';
import type { CraftingResult } from './applyAbyss.ts';

export function applyCorruption(
  item: CraftedItem,
  corruptionId: string
): CraftingResult {
  const cloned = JSON.parse(JSON.stringify(item)) as CraftedItem;
  const addedMods: Modifier[] = [];
  const removedMods: Modifier[] = [];
  const warnings: string[] = [];

  cloned.corrupted = true;

  // For simulation / testing predictability, let's allow passing a specific outcome id,
  // or roll randomly if it is not custom-selected.
  let outcome = POE2_CORRUPTION_OUTCOMES.find((o) => o.id === corruptionId);
  if (!outcome) {
    const roll = Math.random();
    if (roll < 0.5) outcome = POE2_CORRUPTION_OUTCOMES[0]; // No change
    else if (roll < 0.75) outcome = POE2_CORRUPTION_OUTCOMES[1]; // Brick to Rare
    else outcome = POE2_CORRUPTION_OUTCOMES[2]; // Implicit
  }

  if (outcome.effect === "brick_to_rare") {
    cloned.rarity = 'rare';
    cloned.prefixes = [];
    cloned.suffixes = [];
    const desired = 4;
    for (let i = 0; i < desired; i++) {
      const rolled = addRandomModifier(cloned, POE2_MODIFIERS);
      if (rolled) addedMods.push(rolled);
    }
  } else if (outcome.effect === "implicit_change") {
    // Add one random corruption implicit compatible with base category/tags
    const baseTags = new Set(cloned.base.tags ?? []);
    const validImplicits = POE2_CORRUPTION_IMPLICITS.filter((mod) =>
      mod.tags.some((tag) => baseTags.has(tag))
    );
    const chosen = validImplicits.length > 0
      ? validImplicits[Math.floor(Math.random() * validImplicits.length)]
      : POE2_CORRUPTION_IMPLICITS[0];

    const rolledImplicit = {
      ...chosen,
      id: `corruption-implicit-${Date.now()}`
    };
    cloned.implicits.push(rolledImplicit);
    addedMods.push(rolledImplicit);
  }

  return {
    item: cloned,
    addedMods,
    removedMods,
    warnings,
  };
}
