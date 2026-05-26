import type { ItemBase, Modifier } from '../../data/poe2/itemBases.ts';
import type { CraftedItem, CraftingAction, CraftingContext, CraftingProblem } from './craftingEngine.ts';
import { POE2_ESSENCES } from '../../data/poe2/essences.ts';
import { POE2_OMENS } from '../../data/poe2/omens.ts';
import { POE2_RUNES } from '../../data/poe2/runes.ts';
import { POE2_SOUL_CORES } from '../../data/poe2/soulCores.ts';
import { validateDesecration } from './mechanics/validateDesecration.ts';

export function modifierMatchesBase(modifier: Modifier, base: ItemBase, itemLevel: number): boolean {
  if (modifier.requiredItemLevel > itemLevel) return false;
  const baseTags = new Set(base.tags);
  return modifier.tags.some((tag) => baseTags.has(tag));
}

export function explicitLimit(rarity: 'normal' | 'magic' | 'rare' | 'unique'): number {
  if (rarity === 'normal') return 0;
  if (rarity === 'magic') return 1;
  if (rarity === 'unique') return 0;
  return 3;
}

export function validateCraftingAction(
  item: CraftedItem,
  action: CraftingAction,
  context: CraftingContext
): CraftingProblem[] {
  const problems: CraftingProblem[] = [];

  if (item.destroyed) {
    problems.push({
      code: "item_destroyed",
      message: "Item was destroyed by Orb of Chance.",
      severity: "error"
    });
  }

  // Check general corruption and mirrored status
  if (item.corrupted && action.type !== 'undo' && action.type !== 'socket') {
    problems.push({
      code: "corruption_applied",
      message: "Corruption already applied — cannot modify explicit properties.",
      severity: "error"
    });
  }

  if (item.mirrored) {
    problems.push({
      code: "item_mirrored",
      message: "Item is mirrored — cannot modify.",
      severity: "error"
    });
  }

  switch (action.type) {
    case "abyss": {
      const abyssData = context.abyssData[action.abyssId];
      if (!abyssData) {
        problems.push({
          code: "incomplete_mechanic_data",
          message: "Abyss mechanic data is missing.",
          severity: "error"
        });
        break;
      }
      
      const baseTags = new Set(item.base.tags ?? []);
      const isCompatible = abyssData.itemTypes.some(type => item.base.type === type) ||
                          abyssData.allowedBaseTags.some(tag => baseTags.has(tag));
      if (!isCompatible) {
        problems.push({
          code: "unsupported_abyss_item",
          message: `Abyss mechanic '${abyssData.name}' is invalid for this item type.`,
          severity: "error"
        });
      }

      if (!abyssData.dataComplete) {
        problems.push({
          code: "abyss_mechanic_incomplete",
          message: `Abyss mechanic '${abyssData.name}' is only partially supported.`,
          severity: "warning"
        });
      }
      break;
    }
    case "desecration": {
      const desecration = context.desecrationData?.[action.desecrationId];
      if (!desecration) {
        problems.push({
          code: "DESECRATION_DATA_MISSING",
          message: "Desecration crafting data is missing.",
          severity: "error"
        });
        break;
      }
      problems.push(...validateDesecration(item, desecration, context));
      break;
    }
    case "essence": {
      const essence = POE2_ESSENCES.find(e => e.id === action.essenceId);
      if (!essence) {
        problems.push({
          code: "incomplete_mechanic_data",
          message: "Essence mod pool is missing.",
          severity: "error"
        });
        break;
      }

      if (item.rarity === 'rare') {
        problems.push({
          code: "wrong_item_rarity",
          message: "Essence requires a Normal or Magic base.",
          severity: "error"
        });
      }

      const baseTags = new Set(item.base.tags ?? []);
      const allowed = essence.allowedItemTags.some(t => baseTags.has(t));
      if (!allowed) {
        problems.push({
          code: "wrong_item_type",
          message: `Essence forced mod is not available for item class.`,
          severity: "error"
        });
      }
      break;
    }
    case "omen": {
      const omen = POE2_OMENS.find(o => o.id === action.omenId);
      if (!omen) {
        problems.push({
          code: "incomplete_mechanic_data",
          message: "Omen effects list missing.",
          severity: "error"
        });
        break;
      }
      break;
    }
    case "rune": {
      const rune = POE2_RUNES.find(r => r.id === action.runeId);
      if (!rune) {
        problems.push({
          code: "incomplete_mechanic_data",
          message: "Rune compatibility pool missing.",
          severity: "error"
        });
        break;
      }

      // Sockets check
      const currentSockets = String(item.properties?.["Sockets"] ?? "");
      const numSockets = currentSockets.split(" ").filter(Boolean).length;
      if (numSockets === 0) {
        problems.push({
          code: "missing_socket",
          message: "Item requires an open socket to apply Rune.",
          severity: "error"
        });
      }

      const baseTags = new Set(item.base.tags ?? []);
      const isCompatible = (rune.effects ?? []).some(e => baseTags.has(e.itemType));
      if (!isCompatible) {
        problems.push({
          code: "incompatible_socket_type",
          message: `Rune '${rune.name}' is incompatible with item category.`,
          severity: "error"
        });
      }
      break;
    }
    case "soul_core": {
      const core = POE2_SOUL_CORES.find(c => c.id === action.soulCoreId);
      if (!core) {
        problems.push({
          code: "incomplete_mechanic_data",
          message: "Soul Core data is missing.",
          severity: "error"
        });
        break;
      }

      const baseTags = new Set(item.base.tags ?? []);
      const isCompatible = (core.effects ?? []).some(e => baseTags.has(e.itemType));
      if (!isCompatible) {
        problems.push({
          code: "incompatible_soul_core",
          message: `Soul Core '${core.name}' is incompatible with item.`,
          severity: "error"
        });
      }

      if (!core.dataComplete) {
        problems.push({
          code: "incomplete_mechanic_data",
          message: `Soul Core '${core.name}' has incomplete database coverage.`,
          severity: "warning"
        });
      }
      break;
    }
    case "quality": {
      if (item.quality >= 20) {
        problems.push({
          code: "quality_capped",
          message: "Quality is already capped at +20%.",
          severity: "warning"
        });
      }
      break;
    }
    case "corruption": {
      if (item.corrupted) {
        problems.push({
          code: "corruption_applied",
          message: "Item is already corrupted.",
          severity: "error"
        });
      }
      break;
    }
    case "socket": {
      const currentSockets = String(item.properties?.["Sockets"] ?? "");
      const numSockets = currentSockets.split(" ").filter(Boolean).length;
      if (numSockets >= 4) {
        problems.push({
          code: "socket_required_missing",
          message: "Item already has maximum allowed socket count.",
          severity: "error"
        });
      }
      break;
    }
    case "currency": {
      const cId = action.currencyId;
      if (cId === "transmute" && item.rarity !== "normal") {
        problems.push({ code: "wrong_item_rarity", message: "Orb of Transmutation requires a Normal item.", severity: "error" });
      }
      if (cId === "augment" && item.rarity !== "magic") {
        problems.push({ code: "wrong_item_rarity", message: "Orb of Augmentation requires a Magic item.", severity: "error" });
      }
      if (cId === "augment" && item.prefixes.length + item.suffixes.length >= explicitLimit(item.rarity) * 2) {
        problems.push({ code: "no_open_prefix_suffix", message: "Magic item already has full prefix/suffix slots.", severity: "error" });
      }
      if (cId === "regal" && item.rarity !== "magic") {
        problems.push({ code: "wrong_item_rarity", message: "Regal Orb requires a Magic item.", severity: "error" });
      }
      if (cId === "exalt" && item.rarity !== "rare") {
        problems.push({ code: "wrong_item_rarity", message: "Exalted Orb requires a Rare item.", severity: "error" });
      }
      if (cId === "exalt" && item.prefixes.length + item.suffixes.length >= 6) {
        problems.push({ code: "no_open_prefix_suffix", message: "Rare item has no open modifier slots.", severity: "error" });
      }
      if (cId === "chaos" && item.rarity !== "rare") {
        problems.push({ code: "wrong_item_rarity", message: "Chaos Orb requires a Rare item.", severity: "error" });
      }
      if (cId === "chaos" && item.prefixes.length + item.suffixes.length === 0) {
        problems.push({ code: "no_explicit_modifier", message: "Chaos Orb requires a Rare item with at least one modifier.", severity: "error" });
      }
      if (cId === "alchemy" && item.rarity !== "normal" && item.rarity !== "magic") {
        problems.push({ code: "wrong_item_rarity", message: "Orb of Alchemy requires a Normal or Magic item.", severity: "error" });
      }
      if (cId === "annul" && item.prefixes.length + item.suffixes.length === 0) {
        problems.push({ code: "no_open_prefix_suffix", message: "No explicit modifier can be removed.", severity: "error" });
      }
      if (cId === "chance" && item.rarity !== "normal") {
        problems.push({ code: "wrong_item_rarity", message: "Orb of Chance requires a Normal item.", severity: "error" });
      }
      break;
    }
  }

  return problems;
}
