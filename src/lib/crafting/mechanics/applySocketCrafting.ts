import type { CraftedItem } from '../craftingEngine.ts';
import type { CraftingResult } from './applyAbyss.ts';

export function applySocketCrafting(
  item: CraftedItem,
  socketCraftId: string
): CraftingResult {
  const cloned = JSON.parse(JSON.stringify(item)) as CraftedItem;
  const warnings: string[] = [];

  cloned.properties = cloned.properties ?? {};
  
  // Standard sockets addition
  const currentSockets = String(cloned.properties["Sockets"] ?? "");
  const numSockets = currentSockets.split(" ").filter(Boolean).length;

  if (numSockets >= 4) {
    warnings.push("Item already has the maximum of 4 sockets.");
  } else {
    const updatedSockets = Array(numSockets + 1).fill("S").join(" ");
    cloned.properties["Sockets"] = updatedSockets;
  }

  return {
    item: cloned,
    addedMods: [],
    removedMods: [],
    warnings,
  };
}
