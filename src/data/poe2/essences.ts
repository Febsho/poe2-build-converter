import type { Essence } from './types.ts';

// Real PoE2 essence data with forced modifier effects per item type.
// Tier values: 1=Lesser, 2=Standard, 3=Greater, 4=Perfect
// Source: poe2db.tw

export const POE2_ESSENCES: Essence[] = [
  // ── Essence of the Body (Life) ───────────────────────────────────────────
  {
    id: 'essence-body-lesser',
    name: 'Lesser Essence of the Body',
    tier: 'lesser',
    allowedItemTags: ['armour', 'jewellery', 'belt', 'helmet', 'shield', 'amulet', 'ring'],
    forcedMods: [
      { itemTags: ['belt'], modText: '+(25-40) to maximum Life' },
      { itemTags: ['helmet'], modText: '+(20-35) to maximum Life' },
      { itemTags: ['armour'], modText: '+(20-35) to maximum Life' },
      { itemTags: ['shield'], modText: '+(20-35) to maximum Life' },
      { itemTags: ['amulet'], modText: '+(15-25) to maximum Life' },
      { itemTags: ['ring'], modText: '+(15-25) to maximum Life' },
    ],
    description: 'Forces a life modifier. Rerolls all other modifiers.',
  },
  {
    id: 'essence-body-standard',
    name: 'Essence of the Body',
    tier: 'standard',
    allowedItemTags: ['armour', 'jewellery', 'belt', 'helmet', 'shield', 'amulet', 'ring'],
    forcedMods: [
      { itemTags: ['belt'], modText: '+(50-70) to maximum Life' },
      { itemTags: ['helmet'], modText: '+(40-60) to maximum Life' },
      { itemTags: ['armour'], modText: '+(40-60) to maximum Life' },
      { itemTags: ['shield'], modText: '+(40-60) to maximum Life' },
      { itemTags: ['amulet'], modText: '+(30-45) to maximum Life' },
      { itemTags: ['ring'], modText: '+(30-45) to maximum Life' },
    ],
    description: 'Forces a life modifier. Rerolls all other modifiers.',
  },
  {
    id: 'essence-body-greater',
    name: 'Greater Essence of the Body',
    tier: 'greater',
    allowedItemTags: ['armour', 'jewellery', 'belt', 'helmet', 'shield', 'amulet', 'ring'],
    forcedMods: [
      { itemTags: ['belt'], modText: '+(75-95) to maximum Life' },
      { itemTags: ['helmet'], modText: '+(65-80) to maximum Life' },
      { itemTags: ['armour'], modText: '+(65-80) to maximum Life' },
      { itemTags: ['shield'], modText: '+(65-80) to maximum Life' },
      { itemTags: ['amulet'], modText: '+(55-70) to maximum Life' },
      { itemTags: ['ring'], modText: '+(55-70) to maximum Life' },
    ],
    description: 'Forces a life modifier. Rerolls all other modifiers.',
  },
  {
    id: 'essence-body-perfect',
    name: 'Perfect Essence of the Body',
    tier: 'perfect',
    allowedItemTags: ['armour', 'jewellery', 'belt', 'helmet', 'shield', 'amulet', 'ring'],
    forcedMods: [
      { itemTags: ['belt'], modText: '+(95-120) to maximum Life' },
      { itemTags: ['helmet'], modText: '+(85-110) to maximum Life' },
      { itemTags: ['armour'], modText: '+(85-110) to maximum Life' },
      { itemTags: ['shield'], modText: '+(85-110) to maximum Life' },
      { itemTags: ['amulet'], modText: '+(75-95) to maximum Life' },
      { itemTags: ['ring'], modText: '+(75-95) to maximum Life' },
    ],
    description: 'Forces a maximum life modifier. Rerolls all other modifiers.',
  },

  // ── Essence of the Mind (Mana) ───────────────────────────────────────────
  {
    id: 'essence-mind-lesser',
    name: 'Lesser Essence of the Mind',
    tier: 'lesser',
    allowedItemTags: ['armour', 'jewellery', 'amulet', 'ring', 'body_armour'],
    forcedMods: [
      { itemTags: ['body_armour'], modText: '+(20-35) to maximum Mana' },
      { itemTags: ['amulet'], modText: '+(15-25) to maximum Mana' },
      { itemTags: ['ring'], modText: '+(15-25) to maximum Mana' },
    ],
    description: 'Forces a mana modifier. Rerolls all other modifiers.',
  },
  {
    id: 'essence-mind-standard',
    name: 'Essence of the Mind',
    tier: 'standard',
    allowedItemTags: ['armour', 'jewellery', 'amulet', 'ring', 'body_armour'],
    forcedMods: [
      { itemTags: ['body_armour'], modText: '+(45-60) to maximum Mana' },
      { itemTags: ['amulet'], modText: '+(35-50) to maximum Mana' },
      { itemTags: ['ring'], modText: '+(35-50) to maximum Mana' },
    ],
    description: 'Forces a mana modifier. Rerolls all other modifiers.',
  },
  {
    id: 'essence-mind-greater',
    name: 'Greater Essence of the Mind',
    tier: 'greater',
    allowedItemTags: ['armour', 'jewellery', 'amulet', 'ring', 'body_armour'],
    forcedMods: [
      { itemTags: ['body_armour'], modText: '+(65-80) to maximum Mana' },
      { itemTags: ['amulet'], modText: '+(55-70) to maximum Mana' },
      { itemTags: ['ring'], modText: '+(55-70) to maximum Mana' },
    ],
    description: 'Forces a mana modifier. Rerolls all other modifiers.',
  },
  {
    id: 'essence-mind-perfect',
    name: 'Perfect Essence of the Mind',
    tier: 'perfect',
    allowedItemTags: ['armour', 'jewellery', 'amulet', 'ring', 'body_armour'],
    forcedMods: [
      { itemTags: ['body_armour'], modText: '+(85-100) to maximum Mana' },
      { itemTags: ['amulet'], modText: '+(75-90) to maximum Mana' },
      { itemTags: ['ring'], modText: '+(75-90) to maximum Mana' },
    ],
    description: 'Forces a maximum mana modifier. Rerolls all other modifiers.',
  },

  // ── Essence of Seeking (Critical Hit Chance) ─────────────────────────────
  {
    id: 'essence-seeking-lesser',
    name: 'Lesser Essence of Seeking',
    tier: 'lesser',
    allowedItemTags: ['weapon', 'focus'],
    forcedMods: [
      { itemTags: ['attack'], modText: '+(1.5-2.0)% to Critical Hit Chance' },
      { itemTags: ['caster'], modText: '+(1.0-1.5)% to Critical Hit Chance with Spells' },
      { itemTags: ['focus'], modText: '+(1.0-1.5)% to Critical Hit Chance with Spells' },
    ],
    description: 'Forces a critical hit chance modifier. Rerolls all other modifiers.',
  },
  {
    id: 'essence-seeking-standard',
    name: 'Essence of Seeking',
    tier: 'standard',
    allowedItemTags: ['weapon', 'focus'],
    forcedMods: [
      { itemTags: ['attack'], modText: '+(2.5-3.0)% to Critical Hit Chance' },
      { itemTags: ['caster'], modText: '+(1.8-2.4)% to Critical Hit Chance with Spells' },
      { itemTags: ['focus'], modText: '+(1.8-2.4)% to Critical Hit Chance with Spells' },
    ],
    description: 'Forces a critical hit chance modifier. Rerolls all other modifiers.',
  },
  {
    id: 'essence-seeking-greater',
    name: 'Greater Essence of Seeking',
    tier: 'greater',
    allowedItemTags: ['weapon', 'focus'],
    forcedMods: [
      { itemTags: ['attack'], modText: '+(3.5-4.0)% to Critical Hit Chance' },
      { itemTags: ['caster'], modText: '+(2.8-3.4)% to Critical Hit Chance with Spells' },
      { itemTags: ['focus'], modText: '+(2.8-3.4)% to Critical Hit Chance with Spells' },
    ],
    description: 'Forces a critical hit chance modifier. Rerolls all other modifiers.',
  },
  {
    id: 'essence-seeking-perfect',
    name: 'Perfect Essence of Seeking',
    tier: 'perfect',
    allowedItemTags: ['weapon', 'focus'],
    forcedMods: [
      { itemTags: ['attack'], modText: '+(4.5-5.5)% to Critical Hit Chance' },
      { itemTags: ['caster'], modText: '+(3.5-4.5)% to Critical Hit Chance with Spells' },
      { itemTags: ['focus'], modText: '+(3.5-4.5)% to Critical Hit Chance with Spells' },
    ],
    description: 'Forces a critical hit chance modifier. Rerolls all other modifiers.',
  },

  // ── Essence of Enhancement (Attributes) ──────────────────────────────────
  {
    id: 'essence-enhancement-lesser',
    name: 'Lesser Essence of Enhancement',
    tier: 'lesser',
    allowedItemTags: ['jewellery', 'amulet', 'ring', 'gloves'],
    forcedMods: [
      { itemTags: ['amulet'], modText: '+(8-14) to all Attributes' },
      { itemTags: ['gloves'], modText: '+(8-14) to Strength' },
      { itemTags: ['ring'], modText: '+(8-14) to Intelligence' },
    ],
    description: 'Forces an attribute modifier. Rerolls all other modifiers.',
  },
  {
    id: 'essence-enhancement-standard',
    name: 'Essence of Enhancement',
    tier: 'standard',
    allowedItemTags: ['jewellery', 'amulet', 'ring', 'gloves'],
    forcedMods: [
      { itemTags: ['amulet'], modText: '+(16-22) to all Attributes' },
      { itemTags: ['gloves'], modText: '+(16-22) to Strength' },
      { itemTags: ['ring'], modText: '+(16-22) to Intelligence' },
    ],
    description: 'Forces an attribute modifier. Rerolls all other modifiers.',
  },
  {
    id: 'essence-enhancement-greater',
    name: 'Greater Essence of Enhancement',
    tier: 'greater',
    allowedItemTags: ['jewellery', 'amulet', 'ring', 'gloves'],
    forcedMods: [
      { itemTags: ['amulet'], modText: '+(24-32) to all Attributes' },
      { itemTags: ['gloves'], modText: '+(24-32) to Strength' },
      { itemTags: ['ring'], modText: '+(24-32) to Intelligence' },
    ],
    description: 'Forces an attribute modifier. Rerolls all other modifiers.',
  },
  {
    id: 'essence-enhancement-perfect',
    name: 'Perfect Essence of Enhancement',
    tier: 'perfect',
    allowedItemTags: ['jewellery', 'amulet', 'ring', 'gloves'],
    forcedMods: [
      { itemTags: ['amulet'], modText: '+(34-42) to all Attributes' },
      { itemTags: ['gloves'], modText: '+(34-42) to Strength' },
      { itemTags: ['ring'], modText: '+(34-42) to Intelligence' },
    ],
    description: 'Forces an attribute modifier. Rerolls all other modifiers.',
  },

  // ── Essence of Flames (Fire Damage) ──────────────────────────────────────
  {
    id: 'essence-flames-lesser',
    name: 'Lesser Essence of Flames',
    tier: 'lesser',
    allowedItemTags: ['weapon', 'armour'],
    forcedMods: [
      { itemTags: ['weapon'], modText: 'Adds (4-6) to (9-12) Fire Damage' },
      { itemTags: ['armour'], modText: '+(12-18)% to Fire Resistance' },
    ],
    description: 'Forces a fire damage or resistance modifier. Rerolls all other modifiers.',
  },
  {
    id: 'essence-flames-standard',
    name: 'Essence of Flames',
    tier: 'standard',
    allowedItemTags: ['weapon', 'armour'],
    forcedMods: [
      { itemTags: ['weapon'], modText: 'Adds (8-12) to (18-24) Fire Damage' },
      { itemTags: ['armour'], modText: '+(20-26)% to Fire Resistance' },
    ],
    description: 'Forces a fire damage or resistance modifier. Rerolls all other modifiers.',
  },
  {
    id: 'essence-flames-greater',
    name: 'Greater Essence of Flames',
    tier: 'greater',
    allowedItemTags: ['weapon', 'armour'],
    forcedMods: [
      { itemTags: ['weapon'], modText: 'Adds (12-16) to (26-34) Fire Damage' },
      { itemTags: ['armour'], modText: '+(28-34)% to Fire Resistance' },
    ],
    description: 'Forces a fire damage or resistance modifier. Rerolls all other modifiers.',
  },
  {
    id: 'essence-flames-perfect',
    name: 'Perfect Essence of Flames',
    tier: 'perfect',
    allowedItemTags: ['weapon', 'armour'],
    forcedMods: [
      { itemTags: ['weapon'], modText: 'Adds (16-22) to (34-45) Fire Damage' },
      { itemTags: ['armour'], modText: '+(36-45)% to Fire Resistance' },
    ],
    description: 'Forces a fire damage or resistance modifier. Rerolls all other modifiers.',
  },

  // ── Essence of Ice (Cold Damage) ─────────────────────────────────────────
  {
    id: 'essence-ice-lesser',
    name: 'Lesser Essence of Ice',
    tier: 'lesser',
    allowedItemTags: ['weapon', 'armour'],
    forcedMods: [
      { itemTags: ['weapon'], modText: 'Adds (3-5) to (7-10) Cold Damage' },
      { itemTags: ['armour'], modText: '+(12-18)% to Cold Resistance' },
    ],
    description: 'Forces a cold damage or resistance modifier. Rerolls all other modifiers.',
  },
  {
    id: 'essence-ice-standard',
    name: 'Essence of Ice',
    tier: 'standard',
    allowedItemTags: ['weapon', 'armour'],
    forcedMods: [
      { itemTags: ['weapon'], modText: 'Adds (6-10) to (14-19) Cold Damage' },
      { itemTags: ['armour'], modText: '+(20-26)% to Cold Resistance' },
    ],
    description: 'Forces a cold damage or resistance modifier. Rerolls all other modifiers.',
  },
  {
    id: 'essence-ice-greater',
    name: 'Greater Essence of Ice',
    tier: 'greater',
    allowedItemTags: ['weapon', 'armour'],
    forcedMods: [
      { itemTags: ['weapon'], modText: 'Adds (9-13) to (20-28) Cold Damage' },
      { itemTags: ['armour'], modText: '+(28-34)% to Cold Resistance' },
    ],
    description: 'Forces a cold damage or resistance modifier. Rerolls all other modifiers.',
  },
  {
    id: 'essence-ice-perfect',
    name: 'Perfect Essence of Ice',
    tier: 'perfect',
    allowedItemTags: ['weapon', 'armour'],
    forcedMods: [
      { itemTags: ['weapon'], modText: 'Adds (12-16) to (26-36) Cold Damage' },
      { itemTags: ['armour'], modText: '+(36-45)% to Cold Resistance' },
    ],
    description: 'Forces a cold damage or resistance modifier. Rerolls all other modifiers.',
  },

  // ── Essence of Lightning (Lightning Damage) ───────────────────────────────
  {
    id: 'essence-lightning-lesser',
    name: 'Lesser Essence of Lightning',
    tier: 'lesser',
    allowedItemTags: ['weapon', 'armour'],
    forcedMods: [
      { itemTags: ['weapon'], modText: 'Adds 1 to (8-14) Lightning Damage' },
      { itemTags: ['armour'], modText: '+(12-18)% to Lightning Resistance' },
    ],
    description: 'Forces a lightning damage or resistance modifier. Rerolls all other modifiers.',
  },
  {
    id: 'essence-lightning-standard',
    name: 'Essence of Lightning',
    tier: 'standard',
    allowedItemTags: ['weapon', 'armour'],
    forcedMods: [
      { itemTags: ['weapon'], modText: 'Adds (1-3) to (20-30) Lightning Damage' },
      { itemTags: ['armour'], modText: '+(20-26)% to Lightning Resistance' },
    ],
    description: 'Forces a lightning damage or resistance modifier. Rerolls all other modifiers.',
  },
  {
    id: 'essence-lightning-greater',
    name: 'Greater Essence of Lightning',
    tier: 'greater',
    allowedItemTags: ['weapon', 'armour'],
    forcedMods: [
      { itemTags: ['weapon'], modText: 'Adds (1-4) to (32-45) Lightning Damage' },
      { itemTags: ['armour'], modText: '+(28-34)% to Lightning Resistance' },
    ],
    description: 'Forces a lightning damage or resistance modifier. Rerolls all other modifiers.',
  },
  {
    id: 'essence-lightning-perfect',
    name: 'Perfect Essence of Lightning',
    tier: 'perfect',
    allowedItemTags: ['weapon', 'armour'],
    forcedMods: [
      { itemTags: ['weapon'], modText: 'Adds (1-5) to (44-60) Lightning Damage' },
      { itemTags: ['armour'], modText: '+(36-45)% to Lightning Resistance' },
    ],
    description: 'Forces a lightning damage or resistance modifier. Rerolls all other modifiers.',
  },

  // ── Essence of Torment (Chaos Damage) ───────────────────────────────────
  {
    id: 'essence-torment-lesser',
    name: 'Lesser Essence of Torment',
    tier: 'lesser',
    allowedItemTags: ['weapon', 'jewellery', 'amulet', 'ring'],
    forcedMods: [
      { itemTags: ['weapon'], modText: 'Adds (3-5) to (7-10) Chaos Damage' },
      { itemTags: ['amulet', 'ring'], modText: '+(8-14)% to Chaos Resistance' },
    ],
    description: 'Forces a chaos damage or resistance modifier. Rerolls all other modifiers.',
  },
  {
    id: 'essence-torment-standard',
    name: 'Essence of Torment',
    tier: 'standard',
    allowedItemTags: ['weapon', 'jewellery', 'amulet', 'ring'],
    forcedMods: [
      { itemTags: ['weapon'], modText: 'Adds (6-9) to (13-18) Chaos Damage' },
      { itemTags: ['amulet', 'ring'], modText: '+(14-21)% to Chaos Resistance' },
    ],
    description: 'Forces a chaos damage or resistance modifier. Rerolls all other modifiers.',
  },
  {
    id: 'essence-torment-greater',
    name: 'Greater Essence of Torment',
    tier: 'greater',
    allowedItemTags: ['weapon', 'jewellery', 'amulet', 'ring'],
    forcedMods: [
      { itemTags: ['weapon'], modText: 'Adds (9-13) to (18-25) Chaos Damage' },
      { itemTags: ['amulet', 'ring'], modText: '+(16-22)% to Chaos Resistance' },
    ],
    description: 'Forces a chaos damage or resistance modifier. Rerolls all other modifiers.',
  },
  {
    id: 'essence-torment-perfect',
    name: 'Perfect Essence of Torment',
    tier: 'perfect',
    allowedItemTags: ['weapon', 'jewellery', 'amulet', 'ring'],
    forcedMods: [
      { itemTags: ['weapon'], modText: 'Adds (12-16) to (24-32) Chaos Damage' },
      { itemTags: ['amulet', 'ring'], modText: '+(20-30)% to Chaos Resistance' },
    ],
    description: 'Forces a chaos damage or resistance modifier. Rerolls all other modifiers.',
  },

  // ── Essence of Woe (Energy Shield) ──────────────────────────────────────
  {
    id: 'essence-woe-lesser',
    name: 'Lesser Essence of Woe',
    tier: 'lesser',
    allowedItemTags: ['armour', 'jewellery', 'body_armour', 'helmet', 'amulet'],
    forcedMods: [
      { itemTags: ['body_armour', 'helmet'], modText: '+(18-28) to maximum Energy Shield' },
      { itemTags: ['amulet'], modText: 'Regenerate (1.0-1.5) Energy Shield per second' },
    ],
    description: 'Forces an energy shield modifier. Rerolls all other modifiers.',
  },
  {
    id: 'essence-woe-standard',
    name: 'Essence of Woe',
    tier: 'standard',
    allowedItemTags: ['armour', 'jewellery', 'body_armour', 'helmet', 'amulet'],
    forcedMods: [
      { itemTags: ['body_armour', 'helmet'], modText: '+(40-60) to maximum Energy Shield' },
      { itemTags: ['amulet'], modText: 'Regenerate (2.0-3.0) Energy Shield per second' },
    ],
    description: 'Forces an energy shield modifier. Rerolls all other modifiers.',
  },
  {
    id: 'essence-woe-greater',
    name: 'Greater Essence of Woe',
    tier: 'greater',
    allowedItemTags: ['armour', 'jewellery', 'body_armour', 'helmet', 'amulet'],
    forcedMods: [
      { itemTags: ['body_armour', 'helmet'], modText: '+(70-95) to maximum Energy Shield' },
      { itemTags: ['amulet'], modText: 'Regenerate (3.5-5.0) Energy Shield per second' },
    ],
    description: 'Forces an energy shield modifier. Rerolls all other modifiers.',
  },
  {
    id: 'essence-woe-perfect',
    name: 'Perfect Essence of Woe',
    tier: 'perfect',
    allowedItemTags: ['armour', 'jewellery', 'body_armour', 'helmet', 'amulet'],
    forcedMods: [
      { itemTags: ['body_armour', 'helmet'], modText: '+(100-130) to maximum Energy Shield' },
      { itemTags: ['amulet'], modText: 'Regenerate (5.5-8.0) Energy Shield per second' },
    ],
    description: 'Forces an energy shield modifier. Rerolls all other modifiers.',
  },

  // ── Essence of Electricity (Lightning Resistance) ────────────────────────
  {
    id: 'essence-electricity-lesser',
    name: 'Lesser Essence of Electricity',
    tier: 'lesser',
    allowedItemTags: ['armour', 'jewellery'],
    forcedMods: [
      { itemTags: ['armour', 'jewellery'], modText: '+(20-28)% to Lightning Resistance' },
    ],
    description: 'Forces a high lightning resistance modifier. Rerolls all other modifiers.',
  },
  {
    id: 'essence-electricity-standard',
    name: 'Essence of Electricity',
    tier: 'standard',
    allowedItemTags: ['armour', 'jewellery'],
    forcedMods: [
      { itemTags: ['armour', 'jewellery'], modText: '+(29-36)% to Lightning Resistance' },
    ],
    description: 'Forces a high lightning resistance modifier. Rerolls all other modifiers.',
  },
  {
    id: 'essence-electricity-greater',
    name: 'Greater Essence of Electricity',
    tier: 'greater',
    allowedItemTags: ['armour', 'jewellery'],
    forcedMods: [
      { itemTags: ['armour', 'jewellery'], modText: '+(37-44)% to Lightning Resistance' },
    ],
    description: 'Forces a high lightning resistance modifier. Rerolls all other modifiers.',
  },
  {
    id: 'essence-electricity-perfect',
    name: 'Perfect Essence of Electricity',
    tier: 'perfect',
    allowedItemTags: ['armour', 'jewellery'],
    forcedMods: [
      { itemTags: ['armour', 'jewellery'], modText: '+(45-55)% to Lightning Resistance' },
    ],
    description: 'Forces a very high lightning resistance modifier. Rerolls all other modifiers.',
  },
];
