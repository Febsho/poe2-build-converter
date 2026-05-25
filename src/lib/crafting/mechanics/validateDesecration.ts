import type { CraftedItem, CraftingProblem, CraftingContext } from '../craftingEngine.ts';
import type { DesecrationCraftingData } from '../../../data/poe2/desecration.ts';

export function validateDesecration(
  item: CraftedItem,
  desecration: DesecrationCraftingData,
  context: CraftingContext
): CraftingProblem[] {
  const problems: CraftingProblem[] = [];

  if (!desecration) {
    problems.push({
      severity: "error",
      code: "DESECRATION_DATA_MISSING",
      message: "Desecration crafting data is missing.",
    });
    return problems;
  }

  if (!desecration.dataComplete) {
    problems.push({
      severity: "warning",
      code: "DESECRATION_DATA_INCOMPLETE",
      message:
        "Desecration crafting data is incomplete. Verify behavior against real PoE2 data.",
    });
  }

  if (
    desecration.requiredRarity &&
    !desecration.requiredRarity.includes(item.rarity)
  ) {
    problems.push({
      severity: "error",
      code: "DESECRATION_INVALID_RARITY",
      message: "Desecration cannot be applied to this item rarity.",
    });
  }

  if (
    desecration.minItemLevel &&
    item.itemLevel < desecration.minItemLevel
  ) {
    problems.push({
      severity: "error",
      code: "DESECRATION_ITEM_LEVEL_TOO_LOW",
      message: "Item level is too low for this Desecration craft.",
    });
  }

  if (
    desecration.allowedItemTags.length > 0 &&
    !item.base.tags.some(tag => desecration.allowedItemTags.includes(tag))
  ) {
    problems.push({
      severity: "error",
      code: "DESECRATION_INVALID_BASE",
      message: "Desecration is not valid for this item base.",
    });
  }

  if (
    desecration.forbiddenItemTags?.some(tag => item.base.tags.includes(tag))
  ) {
    problems.push({
      severity: "error",
      code: "DESECRATION_FORBIDDEN_BASE",
      message: "Desecration cannot be applied to this item type.",
    });
  }

  return problems;
}
