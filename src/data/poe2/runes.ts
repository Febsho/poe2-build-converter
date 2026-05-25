import type { Rune } from './types.ts';

// PoE2 runes applied to socketed items.
// Each rune has Lesser / Standard / Greater tiers.
// Source: poe2db.tw

export const POE2_RUNES: Rune[] = [
  // ── Desert Rune (Fire) ────────────────────────────────────────────────────
  {
    id: 'desert-rune-lesser',
    name: 'Lesser Desert Rune',
    tier: 'lesser',
    description: 'A rune imbued with fire energy.',
    effects: [
      { itemType: 'weapon', text: 'Adds 4-7 Fire Damage' },
      { itemType: 'armour', text: '+8% to Fire Resistance' },
    ],
  },
  {
    id: 'desert-rune-standard',
    name: 'Desert Rune',
    tier: 'standard',
    description: 'A rune imbued with fire energy.',
    effects: [
      { itemType: 'weapon', text: 'Adds 7-11 Fire Damage' },
      { itemType: 'armour', text: '+12% to Fire Resistance' },
    ],
  },
  {
    id: 'desert-rune-greater',
    name: 'Greater Desert Rune',
    tier: 'greater',
    description: 'A rune imbued with powerful fire energy.',
    effects: [
      { itemType: 'weapon', text: 'Adds 11-17 Fire Damage' },
      { itemType: 'armour', text: '+18% to Fire Resistance' },
    ],
  },

  // ── Glacial Rune (Cold) ───────────────────────────────────────────────────
  {
    id: 'glacial-rune-lesser',
    name: 'Lesser Glacial Rune',
    tier: 'lesser',
    description: 'A rune imbued with cold energy.',
    effects: [
      { itemType: 'weapon', text: 'Adds 4-6 Cold Damage' },
      { itemType: 'armour', text: '+8% to Cold Resistance' },
    ],
  },
  {
    id: 'glacial-rune-standard',
    name: 'Glacial Rune',
    tier: 'standard',
    description: 'A rune imbued with cold energy.',
    effects: [
      { itemType: 'weapon', text: 'Adds 6-10 Cold Damage' },
      { itemType: 'armour', text: '+12% to Cold Resistance' },
    ],
  },
  {
    id: 'glacial-rune-greater',
    name: 'Greater Glacial Rune',
    tier: 'greater',
    description: 'A rune imbued with powerful cold energy.',
    effects: [
      { itemType: 'weapon', text: 'Adds 9-15 Cold Damage' },
      { itemType: 'armour', text: '+18% to Cold Resistance' },
    ],
  },

  // ── Storm Rune (Lightning) ───────────────────────────────────────────────
  {
    id: 'storm-rune-lesser',
    name: 'Lesser Storm Rune',
    tier: 'lesser',
    description: 'A rune imbued with lightning energy.',
    effects: [
      { itemType: 'weapon', text: 'Adds 1-12 Lightning Damage' },
      { itemType: 'armour', text: '+8% to Lightning Resistance' },
    ],
  },
  {
    id: 'storm-rune-standard',
    name: 'Storm Rune',
    tier: 'standard',
    description: 'A rune imbued with lightning energy.',
    effects: [
      { itemType: 'weapon', text: 'Adds 1-20 Lightning Damage' },
      { itemType: 'armour', text: '+12% to Lightning Resistance' },
    ],
  },
  {
    id: 'storm-rune-greater',
    name: 'Greater Storm Rune',
    tier: 'greater',
    description: 'A rune imbued with powerful lightning energy.',
    effects: [
      { itemType: 'weapon', text: 'Adds 1-32 Lightning Damage' },
      { itemType: 'armour', text: '+18% to Lightning Resistance' },
    ],
  },

  // ── Iron Rune (Physical) ─────────────────────────────────────────────────
  {
    id: 'iron-rune-lesser',
    name: 'Lesser Iron Rune',
    tier: 'lesser',
    description: 'A rune imbued with physical force.',
    effects: [
      { itemType: 'weapon', text: '10% increased Physical Damage' },
      { itemType: 'armour', text: '10% increased Armour, Evasion Rating and Energy Shield' },
    ],
  },
  {
    id: 'iron-rune-standard',
    name: 'Iron Rune',
    tier: 'standard',
    description: 'A rune imbued with physical force.',
    effects: [
      { itemType: 'weapon', text: '16% increased Physical Damage' },
      { itemType: 'armour', text: '16% increased Armour, Evasion Rating and Energy Shield' },
    ],
  },
  {
    id: 'iron-rune-greater',
    name: 'Greater Iron Rune',
    tier: 'greater',
    description: 'A rune imbued with powerful physical force.',
    effects: [
      { itemType: 'weapon', text: '24% increased Physical Damage' },
      { itemType: 'armour', text: '24% increased Armour, Evasion Rating and Energy Shield' },
    ],
  },

  // ── Robust Rune (Strength) ───────────────────────────────────────────────
  {
    id: 'robust-rune-lesser',
    name: 'Lesser Robust Rune',
    tier: 'lesser',
    description: 'A rune imbued with strength.',
    effects: [
      { itemType: 'all', text: '+5 to Strength' },
    ],
  },
  {
    id: 'robust-rune-standard',
    name: 'Robust Rune',
    tier: 'standard',
    description: 'A rune imbued with strength.',
    effects: [
      { itemType: 'all', text: '+8 to Strength' },
    ],
  },
  {
    id: 'robust-rune-greater',
    name: 'Greater Robust Rune',
    tier: 'greater',
    description: 'A rune imbued with great strength.',
    effects: [
      { itemType: 'all', text: '+12 to Strength' },
    ],
  },

  // ── Adept Rune (Dexterity) ───────────────────────────────────────────────
  {
    id: 'adept-rune-lesser',
    name: 'Lesser Adept Rune',
    tier: 'lesser',
    description: 'A rune imbued with dexterity.',
    effects: [
      { itemType: 'all', text: '+5 to Dexterity' },
    ],
  },
  {
    id: 'adept-rune-standard',
    name: 'Adept Rune',
    tier: 'standard',
    description: 'A rune imbued with dexterity.',
    effects: [
      { itemType: 'all', text: '+8 to Dexterity' },
    ],
  },
  {
    id: 'adept-rune-greater',
    name: 'Greater Adept Rune',
    tier: 'greater',
    description: 'A rune imbued with great dexterity.',
    effects: [
      { itemType: 'all', text: '+12 to Dexterity' },
    ],
  },

  // ── Resolve Rune (Intelligence) ──────────────────────────────────────────
  {
    id: 'resolve-rune-lesser',
    name: 'Lesser Resolve Rune',
    tier: 'lesser',
    description: 'A rune imbued with intelligence.',
    effects: [
      { itemType: 'all', text: '+5 to Intelligence' },
    ],
  },
  {
    id: 'resolve-rune-standard',
    name: 'Resolve Rune',
    tier: 'standard',
    description: 'A rune imbued with intelligence.',
    effects: [
      { itemType: 'all', text: '+8 to Intelligence' },
    ],
  },
  {
    id: 'resolve-rune-greater',
    name: 'Greater Resolve Rune',
    tier: 'greater',
    description: 'A rune imbued with great intelligence.',
    effects: [
      { itemType: 'all', text: '+12 to Intelligence' },
    ],
  },

  // ── Body Rune (Life) ─────────────────────────────────────────────────────
  {
    id: 'body-rune-lesser',
    name: 'Lesser Body Rune',
    tier: 'lesser',
    description: 'A rune imbued with life force.',
    effects: [
      { itemType: 'weapon', text: '1.5% of Physical Damage Leeched as Life' },
      { itemType: 'armour', text: '+20 to maximum Life' },
    ],
  },
  {
    id: 'body-rune-standard',
    name: 'Body Rune',
    tier: 'standard',
    description: 'A rune imbued with life force.',
    effects: [
      { itemType: 'weapon', text: '2.5% of Physical Damage Leeched as Life' },
      { itemType: 'armour', text: '+30 to maximum Life' },
    ],
  },
  {
    id: 'body-rune-greater',
    name: 'Greater Body Rune',
    tier: 'greater',
    description: 'A rune imbued with powerful life force.',
    effects: [
      { itemType: 'weapon', text: '4% of Physical Damage Leeched as Life' },
      { itemType: 'armour', text: '+45 to maximum Life' },
    ],
  },

  // ── Mind Rune (Mana) ─────────────────────────────────────────────────────
  {
    id: 'mind-rune-lesser',
    name: 'Lesser Mind Rune',
    tier: 'lesser',
    description: 'A rune imbued with mana energy.',
    effects: [
      { itemType: 'weapon', text: '1% of Damage Leeched as Mana' },
      { itemType: 'armour', text: '+15 to maximum Mana' },
    ],
  },
  {
    id: 'mind-rune-standard',
    name: 'Mind Rune',
    tier: 'standard',
    description: 'A rune imbued with mana energy.',
    effects: [
      { itemType: 'weapon', text: '2% of Damage Leeched as Mana' },
      { itemType: 'armour', text: '+25 to maximum Mana' },
    ],
  },
  {
    id: 'mind-rune-greater',
    name: 'Greater Mind Rune',
    tier: 'greater',
    description: 'A rune imbued with powerful mana energy.',
    effects: [
      { itemType: 'weapon', text: '3% of Damage Leeched as Mana' },
      { itemType: 'armour', text: '+40 to maximum Mana' },
    ],
  },

  // ── Stone Rune (Stun) ────────────────────────────────────────────────────
  {
    id: 'stone-rune-lesser',
    name: 'Lesser Stone Rune',
    tier: 'lesser',
    description: 'A rune imbued with stunning force.',
    effects: [
      { itemType: 'weapon', text: '15% increased Stun Buildup' },
      { itemType: 'armour', text: '+40 to Stun Threshold' },
    ],
  },
  {
    id: 'stone-rune-standard',
    name: 'Stone Rune',
    tier: 'standard',
    description: 'A rune imbued with stunning force.',
    effects: [
      { itemType: 'weapon', text: '25% increased Stun Buildup' },
      { itemType: 'armour', text: '+60 to Stun Threshold' },
    ],
  },
  {
    id: 'stone-rune-greater',
    name: 'Greater Stone Rune',
    tier: 'greater',
    description: 'A rune imbued with powerful stunning force.',
    effects: [
      { itemType: 'weapon', text: '40% increased Stun Buildup' },
      { itemType: 'armour', text: '+90 to Stun Threshold' },
    ],
  },

  // ── Rebirth Rune (Life Recovery) ─────────────────────────────────────────
  {
    id: 'rebirth-rune-lesser',
    name: 'Lesser Rebirth Rune',
    tier: 'lesser',
    description: 'A rune imbued with regenerative life energy.',
    effects: [
      { itemType: 'weapon', text: 'Gain 12 Life per Enemy Killed' },
      { itemType: 'armour', text: '0.2% of Life Regenerated per second' },
    ],
  },
  {
    id: 'rebirth-rune-standard',
    name: 'Rebirth Rune',
    tier: 'standard',
    description: 'A rune imbued with regenerative life energy.',
    effects: [
      { itemType: 'weapon', text: 'Gain 20 Life per Enemy Killed' },
      { itemType: 'armour', text: '0.3% of Life Regenerated per second' },
    ],
  },
  {
    id: 'rebirth-rune-greater',
    name: 'Greater Rebirth Rune',
    tier: 'greater',
    description: 'A rune imbued with powerful regenerative life energy.',
    effects: [
      { itemType: 'weapon', text: 'Gain 32 Life per Enemy Killed' },
      { itemType: 'armour', text: '0.5% of Life Regenerated per second' },
    ],
  },

  // ── Inspiration Rune (Mana Regen) ────────────────────────────────────────
  {
    id: 'inspiration-rune-lesser',
    name: 'Lesser Inspiration Rune',
    tier: 'lesser',
    description: 'A rune imbued with mana regeneration.',
    effects: [
      { itemType: 'armour', text: '10% increased Mana Regeneration Rate' },
    ],
  },
  {
    id: 'inspiration-rune-standard',
    name: 'Inspiration Rune',
    tier: 'standard',
    description: 'A rune imbued with mana regeneration.',
    effects: [
      { itemType: 'armour', text: '15% increased Mana Regeneration Rate' },
    ],
  },
  {
    id: 'inspiration-rune-greater',
    name: 'Greater Inspiration Rune',
    tier: 'greater',
    description: 'A rune imbued with powerful mana regeneration.',
    effects: [
      { itemType: 'armour', text: '22% increased Mana Regeneration Rate' },
    ],
  },

  // ── Vision Rune (Accuracy) ───────────────────────────────────────────────
  {
    id: 'vision-rune-lesser',
    name: 'Lesser Vision Rune',
    tier: 'lesser',
    description: 'A rune imbued with accuracy.',
    effects: [
      { itemType: 'weapon', text: '+50 to Accuracy Rating' },
      { itemType: 'armour', text: '7% increased Flask Effect Recovery' },
    ],
  },
  {
    id: 'vision-rune-standard',
    name: 'Vision Rune',
    tier: 'standard',
    description: 'A rune imbued with accuracy.',
    effects: [
      { itemType: 'weapon', text: '+80 to Accuracy Rating' },
      { itemType: 'armour', text: '10% increased Flask Effect Recovery' },
    ],
  },
  {
    id: 'vision-rune-greater',
    name: 'Greater Vision Rune',
    tier: 'greater',
    description: 'A rune imbued with powerful accuracy.',
    effects: [
      { itemType: 'weapon', text: '+120 to Accuracy Rating' },
      { itemType: 'armour', text: '15% increased Flask Effect Recovery' },
    ],
  },
];
