import type { CraftedItem } from '../craftingEngine.ts';
import type { AbyssCraftingData } from '../../../data/poe2/abyss.ts';
import type { Modifier } from '../../../data/poe2/types.ts';

export type CraftingResult = {
  item: CraftedItem;
  addedMods: Modifier[];
  removedMods: Modifier[];
  warnings: string[];
};

export function applyAbyssCrafting(
  item: CraftedItem,
  abyssData: AbyssCraftingData
): CraftingResult {
  const cloned = JSON.parse(JSON.stringify(item)) as CraftedItem;
  const addedMods: Modifier[] = [];
  const warnings: string[] = [];

  // Implement Stygian Vise socket additions
  if (abyssData.socketBehavior === "adds_socket") {
    cloned.base.name = "Stygian Vise";
    if (!cloned.base.tags.includes("abyss_socket")) {
      cloned.base.tags.push("abyss_socket");
    }
  }

  // Handle Ghastly Eye forced mods (Minions deal #% increased Damage)
  if (abyssData.forcedMods && abyssData.forcedMods.length > 0) {
    for (const text of abyssData.forcedMods) {
      const newMod: Modifier = {
        id: `abyss-forced-${Date.now()}-${Math.random()}`,
        name: "Abyssal Modifier",
        text,
        type: "prefix",
        weight: 1,
        requiredItemLevel: 1,
        tags: ["jewel"]
      };
      cloned.prefixes.push(newMod);
      addedMods.push(newMod);
    }
  }

  // If the data is marked as incomplete, add warnings
  if (!abyssData.dataComplete) {
    warnings.push(`Abyss mechanic '${abyssData.name}' has incomplete database coverage.`);
  }

  return {
    item: cloned,
    addedMods,
    removedMods: [],
    warnings,
  };
}
