export type SoulCore = {
  id: string;
  name: string;
  description: string;
  effects: { itemType: string; text: string }[];
  dataComplete: boolean;
};

export const POE2_SOUL_CORES: SoulCore[] = [
  {
    id: "core-azcapa",
    name: "Soul Core of Azcapa",
    description: "Adds fire damage, cast speed, or elemental properties depending on the base type.",
    effects: [
      { itemType: "weapon", text: "Adds 12 to 24 Fire Damage" },
      { itemType: "armour", text: "+15% to Fire Resistance" }
    ],
    dataComplete: true,
  },
  {
    id: "core-zalatl",
    name: "Soul Core of Zalatl",
    description: "Adds physical damage, evasion, or attribute properties.",
    effects: [
      { itemType: "weapon", text: "Adds 10 to 18 Physical Damage" },
      { itemType: "armour", text: "+8% to Evasion Rating" }
    ],
    dataComplete: true,
  },
  {
    id: "core-opul",
    name: "Soul Core of Opul",
    description: "Adds spirit, maximum life, or block multipliers. (Partial data).",
    effects: [
      { itemType: "weapon", text: "+10 to maximum Spirit" },
      { itemType: "armour", text: "+25 to maximum Life" }
    ],
    dataComplete: false,
  }
];
