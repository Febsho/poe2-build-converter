export type QualityCurrency = {
  id: string;
  name: string;
  itemCategory: "Weapon" | "Armour";
  qualIncrement: number;
  description: string;
};

export const POE2_QUALITY_CURRENCIES: QualityCurrency[] = [
  {
    id: "blacksmith-whetstone",
    name: "Blacksmith's Whetstone",
    itemCategory: "Weapon",
    qualIncrement: 5,
    description: "Improves the quality of a weapon by +5% per use (up to +20%).",
  },
  {
    id: "armourers-scrap",
    name: "Armourer's Scrap",
    itemCategory: "Armour",
    qualIncrement: 5,
    description: "Improves the quality of an armour piece by +5% per use (up to +20%).",
  }
];
