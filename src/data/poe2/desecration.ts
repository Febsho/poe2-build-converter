export type DesecrationCraftingData = {
  id: string;
  name: string;
  description: string;

  allowedItemTags: string[];
  allowedItemTypes?: string[];
  forbiddenItemTags?: string[];

  requiredRarity?: Array<"normal" | "magic" | "rare" | "unique">;
  minItemLevel?: number;

  addsModifiers?: boolean;
  removesModifiers?: boolean;
  rerollsModifiers?: boolean;
  corruptsItem?: boolean;
  modifiesImplicit?: boolean;
  modifiesExplicit?: boolean;

  forcedModifierIds?: string[];
  modifierPoolIds?: string[];

  consumesItem?: boolean;
  oneTimeUse?: boolean;

  source: "poe2db" | "poe2re" | "manual" | "placeholder";
  dataComplete: boolean;
};

export const desecrationCraftingData: DesecrationCraftingData[] = [
  {
    id: "desecration_placeholder",
    name: "Desecration",
    description:
      "Desecration crafting mechanic. Replace placeholder behavior with real PoE2 data from poe2db/poe2.re when available.",
    allowedItemTags: [],
    addsModifiers: true,
    removesModifiers: false,
    rerollsModifiers: false,
    corruptsItem: false,
    modifiesImplicit: false,
    modifiesExplicit: true,
    source: "placeholder",
    dataComplete: false,
  },
  {
    id: "desecration_weapon",
    name: "Desecration: Weapon Modification",
    description: "Applies Desecration properties specifically to Weapon bases. (Placeholder/Partial).",
    allowedItemTags: ["weapon"],
    requiredRarity: ["normal", "magic"],
    minItemLevel: 68,
    addsModifiers: true,
    removesModifiers: false,
    rerollsModifiers: false,
    corruptsItem: false,
    modifiesImplicit: false,
    modifiesExplicit: true,
    source: "placeholder",
    dataComplete: false,
  }
];
