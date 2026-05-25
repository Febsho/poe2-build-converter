export type CraftingMechanicId =
  | "currency"
  | "essence"
  | "omen"
  | "rune"
  | "soul_core"
  | "abyss"
  | "desecration"
  | "quality"
  | "corruption"
  | "socket"
  | "simulation"
  | "jewel"
  | "unique_chance"
  | "league"
  | "unknown";

export type CraftingMechanic = {
  id: CraftingMechanicId;
  name: string;
  description: string;
  source: "poe2db" | "poe2re" | "manual" | "placeholder";
  implemented: boolean;
  dataComplete: boolean;
};

export const POE2_CRAFTING_MECHANICS: CraftingMechanic[] = [
  {
    id: "currency",
    name: "Currency Orbs",
    description: "Standard currency orbs such as Transmutation, Augmentation, Regal, Exalted, Alchemy, Chaos, Annulment, and Chance.",
    source: "poe2db",
    implemented: true,
    dataComplete: true,
  },
  {
    id: "essence",
    name: "Essence Crafting",
    description: "Apply essences to force specific modifiers onto Normal/Magic bases and upgrade to Rare quality.",
    source: "poe2db",
    implemented: true,
    dataComplete: true,
  },
  {
    id: "omen",
    name: "Omen Effects",
    description: "Omens that modify next currency usage actions, such as Sinistral and Dextral Coronation, Alchemy, Erasure, or Exaltation.",
    source: "poe2db",
    implemented: true,
    dataComplete: true,
  },
  {
    id: "rune",
    name: "Rune Socketing",
    description: "Socket Runes into weapon/armour slots to gain unique implicit behaviors.",
    source: "poe2db",
    implemented: true,
    dataComplete: true,
  },
  {
    id: "soul_core",
    name: "Soul Cores",
    description: "Socket Soul Cores into compatible socketed items to add specific attributes or socket behaviors.",
    source: "poe2db",
    implemented: true,
    dataComplete: false, // Incomplete data warning target
  },
  {
    id: "abyss",
    name: "Abyss Crafting",
    description: "Apply Abyss-specific modifiers, Abyss sockets, and Abyss jewels to compatible gear.",
    source: "poe2db",
    implemented: true,
    dataComplete: false, // Incomplete data warning target
  },
  {
    id: "desecration",
    name: "Desecration",
    description: "Desecration crafting mechanic using corpse-themed modifiers and pools.",
    source: "placeholder",
    implemented: true,
    dataComplete: false,
  },
  {
    id: "quality",
    name: "Quality Currencies",
    description: "Apply Blacksmith's Whetstones and Armourer's Scraps to increase physical stats and defence qualities.",
    source: "poe2db",
    implemented: true,
    dataComplete: true,
  },
  {
    id: "corruption",
    name: "Vaal Orb Corruption",
    description: "Corrupt items using Vaal Orbs to lock stats, mirror items, or roll special implicit stats.",
    source: "poe2db",
    implemented: true,
    dataComplete: true,
  },
  {
    id: "socket",
    name: "Socket Crafting",
    description: "Modify socket properties, colors, linkages, or socket limits.",
    source: "poe2db",
    implemented: true,
    dataComplete: true,
  }
];
