// Shared PoE2 data types

export type Modifier = {
  id: string;
  name: string;
  text: string;
  type: 'prefix' | 'suffix' | 'implicit';
  tier?: number;
  weight: number;
  requiredItemLevel: number;
  tags: string[];
  group?: string;
  values?: { min: number; max: number }[];
};

export type ItemBaseStats = {
  armour?: number;
  evasion?: number;
  energyShield?: number;
  block?: number;
  damageMin?: number;
  damageMax?: number;
  aps?: number;
};

export type ItemBase = {
  id: string;
  name: string;
  category: string;
  type: string;
  itemLevel: number;
  requirements?: string;
  implicits: Modifier[];
  tags: string[];
  stats?: ItemBaseStats;
};

export type Essence = {
  id: string;
  name: string;
  tier: 'lesser' | 'standard' | 'greater' | 'perfect';
  forcedMods: { itemTags: string[]; modText: string }[];
  allowedItemTags: string[];
  description: string;
};

export type Omen = {
  id: string;
  name: string;
  description: string;
  modifiesAction: string[];
  effect: string;
};

export type Rune = {
  id: string;
  name: string;
  tier: 'lesser' | 'standard' | 'greater';
  description: string;
  effects: { itemType: string; text: string }[];
};

export type CraftingCurrency = {
  id: string;
  name: string;
  type: string;
  description: string;
  validRarities: string[];
};
