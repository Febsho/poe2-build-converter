import type { Modifier } from './types.ts';

// Real PoE2 modifier pool with tier-based estimated weights:
// T1=80, T2=150, T3=250, T4=400, T5=600, T6=900
// Source: poe2db.tw (modifier weights cannot be obtained from game files, using tier-based estimates)

export const POE2_MODIFIERS: Modifier[] = [
  // ── Weapon Prefixes ───────────────────────────────────────────────────────

  // local_phys_percent: % increased Physical Damage
  { id: 'local-phys-pct-t1', group: 'local_phys_percent', name: 'Flaring', text: '+(115-140)% increased Physical Damage', type: 'prefix', tier: 1, weight: 80, requiredItemLevel: 75, tags: ['weapon', 'attack'], values: [{ min: 115, max: 140 }] },
  { id: 'local-phys-pct-t2', group: 'local_phys_percent', name: 'Exquisite', text: '+(90-114)% increased Physical Damage', type: 'prefix', tier: 2, weight: 150, requiredItemLevel: 60, tags: ['weapon', 'attack'], values: [{ min: 90, max: 114 }] },
  { id: 'local-phys-pct-t3', group: 'local_phys_percent', name: 'Expert', text: '+(65-89)% increased Physical Damage', type: 'prefix', tier: 3, weight: 250, requiredItemLevel: 45, tags: ['weapon', 'attack'], values: [{ min: 65, max: 89 }] },
  { id: 'local-phys-pct-t4', group: 'local_phys_percent', name: 'Jagged', text: '+(45-64)% increased Physical Damage', type: 'prefix', tier: 4, weight: 400, requiredItemLevel: 28, tags: ['weapon', 'attack'], values: [{ min: 45, max: 64 }] },
  { id: 'local-phys-pct-t5', group: 'local_phys_percent', name: 'Sturdy', text: '+(25-44)% increased Physical Damage', type: 'prefix', tier: 5, weight: 600, requiredItemLevel: 10, tags: ['weapon', 'attack'], values: [{ min: 25, max: 44 }] },
  { id: 'local-phys-pct-t6', group: 'local_phys_percent', name: 'Heavy', text: '+(10-24)% increased Physical Damage', type: 'prefix', tier: 6, weight: 900, requiredItemLevel: 1, tags: ['weapon', 'attack'], values: [{ min: 10, max: 24 }] },

  // local_flat_phys: Adds flat Physical Damage
  { id: 'local-flat-phys-t1', group: 'local_flat_phys', name: 'Merciless', text: 'Adds (18-24) to (36-44) Physical Damage', type: 'prefix', tier: 1, weight: 100, requiredItemLevel: 64, tags: ['weapon', 'attack'], values: [{ min: 18, max: 24 }, { min: 36, max: 44 }] },
  { id: 'local-flat-phys-t2', group: 'local_flat_phys', name: 'Tyrannical', text: 'Adds (13-18) to (27-35) Physical Damage', type: 'prefix', tier: 2, weight: 180, requiredItemLevel: 46, tags: ['weapon', 'attack'], values: [{ min: 13, max: 18 }, { min: 27, max: 35 }] },
  { id: 'local-flat-phys-t3', group: 'local_flat_phys', name: 'Brute', text: 'Adds (9-13) to (18-26) Physical Damage', type: 'prefix', tier: 3, weight: 300, requiredItemLevel: 30, tags: ['weapon', 'attack'], values: [{ min: 9, max: 13 }, { min: 18, max: 26 }] },
  { id: 'local-flat-phys-t4', group: 'local_flat_phys', name: 'Anarchy', text: 'Adds (5-9) to (10-18) Physical Damage', type: 'prefix', tier: 4, weight: 500, requiredItemLevel: 16, tags: ['weapon', 'attack'], values: [{ min: 5, max: 9 }, { min: 10, max: 18 }] },
  { id: 'local-flat-phys-t5', group: 'local_flat_phys', name: 'Soldier', text: 'Adds (2-5) to (5-10) Physical Damage', type: 'prefix', tier: 5, weight: 700, requiredItemLevel: 3, tags: ['weapon', 'attack'], values: [{ min: 2, max: 5 }, { min: 5, max: 10 }] },

  // local_spell_damage: % increased Spell Damage (wand/staff prefix)
  { id: 'local-spell-dmg-t1', group: 'local_spell_damage', name: 'Archmage', text: '+(85-105)% increased Spell Damage', type: 'prefix', tier: 1, weight: 80, requiredItemLevel: 78, tags: ['weapon', 'caster', 'wand', 'staff'], values: [{ min: 85, max: 105 }] },
  { id: 'local-spell-dmg-t2', group: 'local_spell_damage', name: 'Magister', text: '+(65-84)% increased Spell Damage', type: 'prefix', tier: 2, weight: 140, requiredItemLevel: 62, tags: ['weapon', 'caster', 'wand', 'staff'], values: [{ min: 65, max: 84 }] },
  { id: 'local-spell-dmg-t3', group: 'local_spell_damage', name: 'Scholar', text: '+(45-64)% increased Spell Damage', type: 'prefix', tier: 3, weight: 240, requiredItemLevel: 45, tags: ['weapon', 'caster', 'wand', 'staff'], values: [{ min: 45, max: 64 }] },
  { id: 'local-spell-dmg-t4', group: 'local_spell_damage', name: 'Adept', text: '+(25-44)% increased Spell Damage', type: 'prefix', tier: 4, weight: 400, requiredItemLevel: 28, tags: ['weapon', 'caster', 'wand', 'staff'], values: [{ min: 25, max: 44 }] },
  { id: 'local-spell-dmg-t5', group: 'local_spell_damage', name: 'Pupil', text: '+(10-24)% increased Spell Damage', type: 'prefix', tier: 5, weight: 600, requiredItemLevel: 8, tags: ['weapon', 'caster', 'wand', 'staff'], values: [{ min: 10, max: 24 }] },

  // maximum_life: armour/jewellery prefix
  { id: 'max-life-t1', group: 'maximum_life', name: 'Vigorous', text: '+(95-120) to maximum Life', type: 'prefix', tier: 1, weight: 120, requiredItemLevel: 78, tags: ['armour', 'jewellery', 'amulet', 'ring', 'belt'], values: [{ min: 95, max: 120 }] },
  { id: 'max-life-t2', group: 'maximum_life', name: 'Sanguine', text: '+(75-94) to maximum Life', type: 'prefix', tier: 2, weight: 200, requiredItemLevel: 62, tags: ['armour', 'jewellery', 'amulet', 'ring', 'belt'], values: [{ min: 75, max: 94 }] },
  { id: 'max-life-t3', group: 'maximum_life', name: 'Healthy', text: '+(55-74) to maximum Life', type: 'prefix', tier: 3, weight: 300, requiredItemLevel: 46, tags: ['armour', 'jewellery', 'amulet', 'ring', 'belt'], values: [{ min: 55, max: 74 }] },
  { id: 'max-life-t4', group: 'maximum_life', name: 'Robust', text: '+(35-54) to maximum Life', type: 'prefix', tier: 4, weight: 450, requiredItemLevel: 28, tags: ['armour', 'jewellery', 'amulet', 'ring', 'belt'], values: [{ min: 35, max: 54 }] },
  { id: 'max-life-t5', group: 'maximum_life', name: 'Sturdy', text: '+(20-34) to maximum Life', type: 'prefix', tier: 5, weight: 650, requiredItemLevel: 11, tags: ['armour', 'jewellery', 'amulet', 'ring', 'belt'], values: [{ min: 20, max: 34 }] },
  { id: 'max-life-t6', group: 'maximum_life', name: 'Vital', text: '+(8-19) to maximum Life', type: 'prefix', tier: 6, weight: 1000, requiredItemLevel: 1, tags: ['armour', 'jewellery', 'amulet', 'ring', 'belt'], values: [{ min: 8, max: 19 }] },

  // local_energy_shield: armour prefix
  { id: 'local-es-t1', group: 'local_energy_shield', name: 'Shimmering', text: '+(110-140) to maximum Energy Shield', type: 'prefix', tier: 1, weight: 140, requiredItemLevel: 78, tags: ['armour', 'energy_shield'], values: [{ min: 110, max: 140 }] },
  { id: 'local-es-t2', group: 'local_energy_shield', name: 'Glowing', text: '+(86-109) to maximum Energy Shield', type: 'prefix', tier: 2, weight: 220, requiredItemLevel: 62, tags: ['armour', 'energy_shield'], values: [{ min: 86, max: 109 }] },
  { id: 'local-es-t3', group: 'local_energy_shield', name: 'Energised', text: '+(62-85) to maximum Energy Shield', type: 'prefix', tier: 3, weight: 350, requiredItemLevel: 46, tags: ['armour', 'energy_shield'], values: [{ min: 62, max: 85 }] },
  { id: 'local-es-t4', group: 'local_energy_shield', name: 'Pulsing', text: '+(40-61) to maximum Energy Shield', type: 'prefix', tier: 4, weight: 500, requiredItemLevel: 30, tags: ['armour', 'energy_shield'], values: [{ min: 40, max: 61 }] },
  { id: 'local-es-t5', group: 'local_energy_shield', name: 'Charged', text: '+(20-39) to maximum Energy Shield', type: 'prefix', tier: 5, weight: 700, requiredItemLevel: 14, tags: ['armour', 'energy_shield'], values: [{ min: 20, max: 39 }] },
  { id: 'local-es-t6', group: 'local_energy_shield', name: 'Crackling', text: '+(8-19) to maximum Energy Shield', type: 'prefix', tier: 6, weight: 1000, requiredItemLevel: 1, tags: ['armour', 'energy_shield'], values: [{ min: 8, max: 19 }] },

  // local_armour_percent: % increased Armour
  { id: 'local-armour-pct-t1', group: 'local_armour_percent', name: 'Adamantine', text: '+(110-130)% increased Armour', type: 'prefix', tier: 1, weight: 100, requiredItemLevel: 75, tags: ['armour', 'str_armour'], values: [{ min: 110, max: 130 }] },
  { id: 'local-armour-pct-t2', group: 'local_armour_percent', name: 'Impervious', text: '+(90-109)% increased Armour', type: 'prefix', tier: 2, weight: 180, requiredItemLevel: 58, tags: ['armour', 'str_armour'], values: [{ min: 90, max: 109 }] },
  { id: 'local-armour-pct-t3', group: 'local_armour_percent', name: 'Reinforced', text: '+(70-89)% increased Armour', type: 'prefix', tier: 3, weight: 300, requiredItemLevel: 42, tags: ['armour', 'str_armour'], values: [{ min: 70, max: 89 }] },
  { id: 'local-armour-pct-t4', group: 'local_armour_percent', name: 'Tempered', text: '+(50-69)% increased Armour', type: 'prefix', tier: 4, weight: 480, requiredItemLevel: 26, tags: ['armour', 'str_armour'], values: [{ min: 50, max: 69 }] },
  { id: 'local-armour-pct-t5', group: 'local_armour_percent', name: 'Studded', text: '+(30-49)% increased Armour', type: 'prefix', tier: 5, weight: 700, requiredItemLevel: 11, tags: ['armour', 'str_armour'], values: [{ min: 30, max: 49 }] },
  { id: 'local-armour-pct-t6', group: 'local_armour_percent', name: 'Ribbed', text: '+(10-29)% increased Armour', type: 'prefix', tier: 6, weight: 1000, requiredItemLevel: 1, tags: ['armour', 'str_armour'], values: [{ min: 10, max: 29 }] },

  // local_evasion_percent: % increased Evasion
  { id: 'local-evasion-pct-t1', group: 'local_evasion_percent', name: 'Agile', text: '+(110-130)% increased Evasion Rating', type: 'prefix', tier: 1, weight: 100, requiredItemLevel: 75, tags: ['armour', 'dex_armour', 'evasion'], values: [{ min: 110, max: 130 }] },
  { id: 'local-evasion-pct-t2', group: 'local_evasion_percent', name: 'Lithe', text: '+(90-109)% increased Evasion Rating', type: 'prefix', tier: 2, weight: 180, requiredItemLevel: 58, tags: ['armour', 'dex_armour', 'evasion'], values: [{ min: 90, max: 109 }] },
  { id: 'local-evasion-pct-t3', group: 'local_evasion_percent', name: 'Fleet', text: '+(70-89)% increased Evasion Rating', type: 'prefix', tier: 3, weight: 300, requiredItemLevel: 42, tags: ['armour', 'dex_armour', 'evasion'], values: [{ min: 70, max: 89 }] },
  { id: 'local-evasion-pct-t4', group: 'local_evasion_percent', name: 'Supple', text: '+(50-69)% increased Evasion Rating', type: 'prefix', tier: 4, weight: 480, requiredItemLevel: 26, tags: ['armour', 'dex_armour', 'evasion'], values: [{ min: 50, max: 69 }] },
  { id: 'local-evasion-pct-t5', group: 'local_evasion_percent', name: 'Elastic', text: '+(30-49)% increased Evasion Rating', type: 'prefix', tier: 5, weight: 700, requiredItemLevel: 11, tags: ['armour', 'dex_armour', 'evasion'], values: [{ min: 30, max: 49 }] },
  { id: 'local-evasion-pct-t6', group: 'local_evasion_percent', name: 'Flexible', text: '+(10-29)% increased Evasion Rating', type: 'prefix', tier: 6, weight: 1000, requiredItemLevel: 1, tags: ['armour', 'dex_armour', 'evasion'], values: [{ min: 10, max: 29 }] },

  // maximum_mana: armour/jewellery prefix
  { id: 'max-mana-t1', group: 'maximum_mana', name: 'Lucid', text: '+(80-100) to maximum Mana', type: 'prefix', tier: 1, weight: 120, requiredItemLevel: 68, tags: ['armour', 'jewellery', 'amulet', 'ring'], values: [{ min: 80, max: 100 }] },
  { id: 'max-mana-t2', group: 'maximum_mana', name: 'Clear', text: '+(60-79) to maximum Mana', type: 'prefix', tier: 2, weight: 200, requiredItemLevel: 46, tags: ['armour', 'jewellery', 'amulet', 'ring'], values: [{ min: 60, max: 79 }] },
  { id: 'max-mana-t3', group: 'maximum_mana', name: 'Focused', text: '+(40-59) to maximum Mana', type: 'prefix', tier: 3, weight: 320, requiredItemLevel: 28, tags: ['armour', 'jewellery', 'amulet', 'ring'], values: [{ min: 40, max: 59 }] },
  { id: 'max-mana-t4', group: 'maximum_mana', name: 'Tranquil', text: '+(20-39) to maximum Mana', type: 'prefix', tier: 4, weight: 500, requiredItemLevel: 10, tags: ['armour', 'jewellery', 'amulet', 'ring'], values: [{ min: 20, max: 39 }] },

  // spirit: amulet prefix
  { id: 'spirit-t1', group: 'spirit', name: 'Commanding', text: '+(28-40) to Spirit', type: 'prefix', tier: 1, weight: 80, requiredItemLevel: 70, tags: ['amulet'], values: [{ min: 28, max: 40 }] },
  { id: 'spirit-t2', group: 'spirit', name: 'Dictating', text: '+(20-27) to Spirit', type: 'prefix', tier: 2, weight: 150, requiredItemLevel: 50, tags: ['amulet'], values: [{ min: 20, max: 27 }] },
  { id: 'spirit-t3', group: 'spirit', name: 'Inspiring', text: '+(12-19) to Spirit', type: 'prefix', tier: 3, weight: 260, requiredItemLevel: 28, tags: ['amulet'], values: [{ min: 12, max: 19 }] },
  { id: 'spirit-t4', group: 'spirit', name: 'Summoning', text: '+(6-11) to Spirit', type: 'prefix', tier: 4, weight: 420, requiredItemLevel: 8, tags: ['amulet'], values: [{ min: 6, max: 11 }] },

  // ── Weapon Suffixes ───────────────────────────────────────────────────────

  // local_attack_speed: % increased Attack Speed
  { id: 'local-atk-spd-t1', group: 'local_attack_speed', name: 'Celebration', text: '+(22-26)% increased Attack Speed', type: 'suffix', tier: 1, weight: 90, requiredItemLevel: 75, tags: ['weapon', 'attack'], values: [{ min: 22, max: 26 }] },
  { id: 'local-atk-spd-t2', group: 'local_attack_speed', name: 'Swift', text: '+(18-21)% increased Attack Speed', type: 'suffix', tier: 2, weight: 160, requiredItemLevel: 55, tags: ['weapon', 'attack'], values: [{ min: 18, max: 21 }] },
  { id: 'local-atk-spd-t3', group: 'local_attack_speed', name: 'Hasty', text: '+(13-17)% increased Attack Speed', type: 'suffix', tier: 3, weight: 270, requiredItemLevel: 35, tags: ['weapon', 'attack'], values: [{ min: 13, max: 17 }] },
  { id: 'local-atk-spd-t4', group: 'local_attack_speed', name: 'Nimble', text: '+(9-12)% increased Attack Speed', type: 'suffix', tier: 4, weight: 430, requiredItemLevel: 15, tags: ['weapon', 'attack'], values: [{ min: 9, max: 12 }] },
  { id: 'local-atk-spd-t5', group: 'local_attack_speed', name: 'Quick', text: '+(5-8)% increased Attack Speed', type: 'suffix', tier: 5, weight: 650, requiredItemLevel: 1, tags: ['weapon', 'attack'], values: [{ min: 5, max: 8 }] },

  // local_cast_speed: % increased Cast Speed (wand/staff suffix)
  { id: 'local-cast-spd-t1', group: 'local_cast_speed', name: 'Shaping', text: '+(18-22)% increased Cast Speed', type: 'suffix', tier: 1, weight: 90, requiredItemLevel: 75, tags: ['weapon', 'caster', 'wand', 'staff'], values: [{ min: 18, max: 22 }] },
  { id: 'local-cast-spd-t2', group: 'local_cast_speed', name: 'Haste', text: '+(13-17)% increased Cast Speed', type: 'suffix', tier: 2, weight: 160, requiredItemLevel: 52, tags: ['weapon', 'caster', 'wand', 'staff'], values: [{ min: 13, max: 17 }] },
  { id: 'local-cast-spd-t3', group: 'local_cast_speed', name: 'Velocity', text: '+(9-12)% increased Cast Speed', type: 'suffix', tier: 3, weight: 270, requiredItemLevel: 32, tags: ['weapon', 'caster', 'wand', 'staff'], values: [{ min: 9, max: 12 }] },
  { id: 'local-cast-spd-t4', group: 'local_cast_speed', name: 'Alacrity', text: '+(5-8)% increased Cast Speed', type: 'suffix', tier: 4, weight: 430, requiredItemLevel: 10, tags: ['weapon', 'caster', 'wand', 'staff'], values: [{ min: 5, max: 8 }] },

  // local_critical_hit_chance: % increased Critical Hit Chance
  { id: 'local-crit-t1', group: 'local_critical_hit_chance', name: 'Razor', text: '+(3.5-4.5)% to Critical Hit Chance', type: 'suffix', tier: 1, weight: 100, requiredItemLevel: 75, tags: ['weapon'], values: [{ min: 3.5, max: 4.5 }] },
  { id: 'local-crit-t2', group: 'local_critical_hit_chance', name: 'Sharp', text: '+(2.6-3.4)% to Critical Hit Chance', type: 'suffix', tier: 2, weight: 180, requiredItemLevel: 55, tags: ['weapon'], values: [{ min: 2.6, max: 3.4 }] },
  { id: 'local-crit-t3', group: 'local_critical_hit_chance', name: 'Incisive', text: '+(1.6-2.5)% to Critical Hit Chance', type: 'suffix', tier: 3, weight: 300, requiredItemLevel: 30, tags: ['weapon'], values: [{ min: 1.6, max: 2.5 }] },
  { id: 'local-crit-t4', group: 'local_critical_hit_chance', name: 'Keen', text: '+(0.8-1.5)% to Critical Hit Chance', type: 'suffix', tier: 4, weight: 480, requiredItemLevel: 10, tags: ['weapon'], values: [{ min: 0.8, max: 1.5 }] },

  // local_accuracy_rating: +Accuracy Rating
  { id: 'local-accuracy-t1', group: 'local_accuracy_rating', name: 'Accurate', text: '+(300-400) to Accuracy Rating', type: 'suffix', tier: 1, weight: 120, requiredItemLevel: 68, tags: ['weapon', 'attack'], values: [{ min: 300, max: 400 }] },
  { id: 'local-accuracy-t2', group: 'local_accuracy_rating', name: 'Precise', text: '+(225-299) to Accuracy Rating', type: 'suffix', tier: 2, weight: 200, requiredItemLevel: 48, tags: ['weapon', 'attack'], values: [{ min: 225, max: 299 }] },
  { id: 'local-accuracy-t3', group: 'local_accuracy_rating', name: 'Sure', text: '+(150-224) to Accuracy Rating', type: 'suffix', tier: 3, weight: 320, requiredItemLevel: 28, tags: ['weapon', 'attack'], values: [{ min: 150, max: 224 }] },
  { id: 'local-accuracy-t4', group: 'local_accuracy_rating', name: 'Unerring', text: '+(75-149) to Accuracy Rating', type: 'suffix', tier: 4, weight: 500, requiredItemLevel: 8, tags: ['weapon', 'attack'], values: [{ min: 75, max: 149 }] },

  // adds_fire_damage: Adds Fire Damage to Attacks (attack weapon suffix)
  { id: 'adds-fire-t1', group: 'adds_fire_damage', name: 'Cremating', text: 'Adds (14-18) to (26-32) Fire Damage', type: 'suffix', tier: 1, weight: 100, requiredItemLevel: 72, tags: ['weapon', 'attack'], values: [{ min: 14, max: 18 }, { min: 26, max: 32 }] },
  { id: 'adds-fire-t2', group: 'adds_fire_damage', name: 'Flaming', text: 'Adds (10-14) to (18-25) Fire Damage', type: 'suffix', tier: 2, weight: 180, requiredItemLevel: 50, tags: ['weapon', 'attack'], values: [{ min: 10, max: 14 }, { min: 18, max: 25 }] },
  { id: 'adds-fire-t3', group: 'adds_fire_damage', name: 'Smoking', text: 'Adds (5-9) to (10-17) Fire Damage', type: 'suffix', tier: 3, weight: 300, requiredItemLevel: 30, tags: ['weapon', 'attack'], values: [{ min: 5, max: 9 }, { min: 10, max: 17 }] },
  { id: 'adds-fire-t4', group: 'adds_fire_damage', name: 'Heating', text: 'Adds (2-4) to (4-9) Fire Damage', type: 'suffix', tier: 4, weight: 480, requiredItemLevel: 10, tags: ['weapon', 'attack'], values: [{ min: 2, max: 4 }, { min: 4, max: 9 }] },

  // adds_cold_damage: Adds Cold Damage to Attacks (attack weapon suffix)
  { id: 'adds-cold-t1', group: 'adds_cold_damage', name: 'Crystalising', text: 'Adds (11-14) to (22-28) Cold Damage', type: 'suffix', tier: 1, weight: 100, requiredItemLevel: 72, tags: ['weapon', 'attack'], values: [{ min: 11, max: 14 }, { min: 22, max: 28 }] },
  { id: 'adds-cold-t2', group: 'adds_cold_damage', name: 'Freezing', text: 'Adds (7-11) to (14-21) Cold Damage', type: 'suffix', tier: 2, weight: 180, requiredItemLevel: 50, tags: ['weapon', 'attack'], values: [{ min: 7, max: 11 }, { min: 14, max: 21 }] },
  { id: 'adds-cold-t3', group: 'adds_cold_damage', name: 'Chilling', text: 'Adds (4-6) to (8-13) Cold Damage', type: 'suffix', tier: 3, weight: 300, requiredItemLevel: 30, tags: ['weapon', 'attack'], values: [{ min: 4, max: 6 }, { min: 8, max: 13 }] },
  { id: 'adds-cold-t4', group: 'adds_cold_damage', name: 'Cooling', text: 'Adds (2-3) to (3-7) Cold Damage', type: 'suffix', tier: 4, weight: 480, requiredItemLevel: 10, tags: ['weapon', 'attack'], values: [{ min: 2, max: 3 }, { min: 3, max: 7 }] },

  // adds_lightning_damage: Adds Lightning Damage to Attacks (attack weapon suffix)
  { id: 'adds-lightning-t1', group: 'adds_lightning_damage', name: 'Electrocuting', text: 'Adds (1-4) to (40-60) Lightning Damage', type: 'suffix', tier: 1, weight: 100, requiredItemLevel: 72, tags: ['weapon', 'attack'], values: [{ min: 1, max: 4 }, { min: 40, max: 60 }] },
  { id: 'adds-lightning-t2', group: 'adds_lightning_damage', name: 'Shocking', text: 'Adds (1-3) to (25-40) Lightning Damage', type: 'suffix', tier: 2, weight: 180, requiredItemLevel: 50, tags: ['weapon', 'attack'], values: [{ min: 1, max: 3 }, { min: 25, max: 40 }] },
  { id: 'adds-lightning-t3', group: 'adds_lightning_damage', name: 'Sparking', text: 'Adds (1-2) to (12-24) Lightning Damage', type: 'suffix', tier: 3, weight: 300, requiredItemLevel: 30, tags: ['weapon', 'attack'], values: [{ min: 1, max: 2 }, { min: 12, max: 24 }] },
  { id: 'adds-lightning-t4', group: 'adds_lightning_damage', name: 'Buzzing', text: 'Adds 1 to (5-11) Lightning Damage', type: 'suffix', tier: 4, weight: 480, requiredItemLevel: 10, tags: ['weapon', 'attack'], values: [{ min: 1, max: 1 }, { min: 5, max: 11 }] },

  // adds_spell_fire_damage: Adds Fire Damage to Spells (caster weapon prefix)
  { id: 'spell-fire-t1', group: 'adds_spell_fire_damage', name: 'Magma', text: 'Adds (22-28) to (44-55) Fire Damage to Spells', type: 'prefix', tier: 1, weight: 100, requiredItemLevel: 72, tags: ['weapon', 'caster'], values: [{ min: 22, max: 28 }, { min: 44, max: 55 }] },
  { id: 'spell-fire-t2', group: 'adds_spell_fire_damage', name: 'Inferno', text: 'Adds (14-20) to (28-38) Fire Damage to Spells', type: 'prefix', tier: 2, weight: 180, requiredItemLevel: 50, tags: ['weapon', 'caster'], values: [{ min: 14, max: 20 }, { min: 28, max: 38 }] },
  { id: 'spell-fire-t3', group: 'adds_spell_fire_damage', name: 'Blaze', text: 'Adds (8-13) to (16-25) Fire Damage to Spells', type: 'prefix', tier: 3, weight: 300, requiredItemLevel: 28, tags: ['weapon', 'caster'], values: [{ min: 8, max: 13 }, { min: 16, max: 25 }] },
  { id: 'spell-fire-t4', group: 'adds_spell_fire_damage', name: 'Smouldering', text: 'Adds (3-6) to (6-12) Fire Damage to Spells', type: 'prefix', tier: 4, weight: 480, requiredItemLevel: 8, tags: ['weapon', 'caster'], values: [{ min: 3, max: 6 }, { min: 6, max: 12 }] },

  // adds_spell_cold_damage: Adds Cold Damage to Spells (caster weapon prefix)
  { id: 'spell-cold-t1', group: 'adds_spell_cold_damage', name: 'Glacial', text: 'Adds (18-24) to (36-46) Cold Damage to Spells', type: 'prefix', tier: 1, weight: 100, requiredItemLevel: 72, tags: ['weapon', 'caster'], values: [{ min: 18, max: 24 }, { min: 36, max: 46 }] },
  { id: 'spell-cold-t2', group: 'adds_spell_cold_damage', name: 'Freezing', text: 'Adds (11-16) to (22-32) Cold Damage to Spells', type: 'prefix', tier: 2, weight: 180, requiredItemLevel: 50, tags: ['weapon', 'caster'], values: [{ min: 11, max: 16 }, { min: 22, max: 32 }] },
  { id: 'spell-cold-t3', group: 'adds_spell_cold_damage', name: 'Chilling', text: 'Adds (6-10) to (12-20) Cold Damage to Spells', type: 'prefix', tier: 3, weight: 300, requiredItemLevel: 28, tags: ['weapon', 'caster'], values: [{ min: 6, max: 10 }, { min: 12, max: 20 }] },
  { id: 'spell-cold-t4', group: 'adds_spell_cold_damage', name: 'Icy', text: 'Adds (2-4) to (4-9) Cold Damage to Spells', type: 'prefix', tier: 4, weight: 480, requiredItemLevel: 8, tags: ['weapon', 'caster'], values: [{ min: 2, max: 4 }, { min: 4, max: 9 }] },

  // adds_spell_lightning_damage: Adds Lightning Damage to Spells (caster weapon prefix)
  { id: 'spell-lightning-t1', group: 'adds_spell_lightning_damage', name: 'Thundering', text: 'Adds (2-6) to (65-90) Lightning Damage to Spells', type: 'prefix', tier: 1, weight: 100, requiredItemLevel: 72, tags: ['weapon', 'caster'], values: [{ min: 2, max: 6 }, { min: 65, max: 90 }] },
  { id: 'spell-lightning-t2', group: 'adds_spell_lightning_damage', name: 'Crackling', text: 'Adds (1-4) to (40-58) Lightning Damage to Spells', type: 'prefix', tier: 2, weight: 180, requiredItemLevel: 50, tags: ['weapon', 'caster'], values: [{ min: 1, max: 4 }, { min: 40, max: 58 }] },
  { id: 'spell-lightning-t3', group: 'adds_spell_lightning_damage', name: 'Sparking', text: 'Adds (1-2) to (18-28) Lightning Damage to Spells', type: 'prefix', tier: 3, weight: 300, requiredItemLevel: 28, tags: ['weapon', 'caster'], values: [{ min: 1, max: 2 }, { min: 18, max: 28 }] },
  { id: 'spell-lightning-t4', group: 'adds_spell_lightning_damage', name: 'Charged', text: 'Adds 1 to (7-13) Lightning Damage to Spells', type: 'prefix', tier: 4, weight: 480, requiredItemLevel: 8, tags: ['weapon', 'caster'], values: [{ min: 1, max: 1 }, { min: 7, max: 13 }] },

  // local_crit_multiplier: % increased Critical Strike Multiplier (all weapons suffix)
  { id: 'local-crit-multi-t1', group: 'local_crit_multiplier', name: 'Rupturing', text: '+(40-50)% to Critical Strike Multiplier', type: 'suffix', tier: 1, weight: 80, requiredItemLevel: 70, tags: ['weapon'], values: [{ min: 40, max: 50 }] },
  { id: 'local-crit-multi-t2', group: 'local_crit_multiplier', name: 'Puncturing', text: '+(30-39)% to Critical Strike Multiplier', type: 'suffix', tier: 2, weight: 150, requiredItemLevel: 50, tags: ['weapon'], values: [{ min: 30, max: 39 }] },
  { id: 'local-crit-multi-t3', group: 'local_crit_multiplier', name: 'Piercing', text: '+(20-29)% to Critical Strike Multiplier', type: 'suffix', tier: 3, weight: 260, requiredItemLevel: 28, tags: ['weapon'], values: [{ min: 20, max: 29 }] },
  { id: 'local-crit-multi-t4', group: 'local_crit_multiplier', name: 'Stinging', text: '+(10-19)% to Critical Strike Multiplier', type: 'suffix', tier: 4, weight: 420, requiredItemLevel: 8, tags: ['weapon'], values: [{ min: 10, max: 19 }] },

  // ── Armour/Jewellery Suffixes ─────────────────────────────────────────────

  // fire_resistance
  { id: 'fire-res-t1', group: 'fire_resistance', name: 'Salamander', text: '+(36-45)% to Fire Resistance', type: 'suffix', tier: 1, weight: 180, requiredItemLevel: 68, tags: ['armour', 'jewellery', 'amulet', 'ring', 'belt', 'charm'], values: [{ min: 36, max: 45 }] },
  { id: 'fire-res-t2', group: 'fire_resistance', name: 'Drake', text: '+(27-35)% to Fire Resistance', type: 'suffix', tier: 2, weight: 280, requiredItemLevel: 48, tags: ['armour', 'jewellery', 'amulet', 'ring', 'belt', 'charm'], values: [{ min: 27, max: 35 }] },
  { id: 'fire-res-t3', group: 'fire_resistance', name: 'Iguana', text: '+(18-26)% to Fire Resistance', type: 'suffix', tier: 3, weight: 420, requiredItemLevel: 28, tags: ['armour', 'jewellery', 'amulet', 'ring', 'belt', 'charm'], values: [{ min: 18, max: 26 }] },
  { id: 'fire-res-t4', group: 'fire_resistance', name: 'Lizard', text: '+(9-17)% to Fire Resistance', type: 'suffix', tier: 4, weight: 640, requiredItemLevel: 8, tags: ['armour', 'jewellery', 'amulet', 'ring', 'belt', 'charm'], values: [{ min: 9, max: 17 }] },

  // cold_resistance
  { id: 'cold-res-t1', group: 'cold_resistance', name: 'Penguin', text: '+(36-45)% to Cold Resistance', type: 'suffix', tier: 1, weight: 180, requiredItemLevel: 68, tags: ['armour', 'jewellery', 'amulet', 'ring', 'belt', 'charm'], values: [{ min: 36, max: 45 }] },
  { id: 'cold-res-t2', group: 'cold_resistance', name: 'Polar', text: '+(27-35)% to Cold Resistance', type: 'suffix', tier: 2, weight: 280, requiredItemLevel: 48, tags: ['armour', 'jewellery', 'amulet', 'ring', 'belt', 'charm'], values: [{ min: 27, max: 35 }] },
  { id: 'cold-res-t3', group: 'cold_resistance', name: 'Tundra', text: '+(18-26)% to Cold Resistance', type: 'suffix', tier: 3, weight: 420, requiredItemLevel: 28, tags: ['armour', 'jewellery', 'amulet', 'ring', 'belt', 'charm'], values: [{ min: 18, max: 26 }] },
  { id: 'cold-res-t4', group: 'cold_resistance', name: 'Arctic', text: '+(9-17)% to Cold Resistance', type: 'suffix', tier: 4, weight: 640, requiredItemLevel: 8, tags: ['armour', 'jewellery', 'amulet', 'ring', 'belt', 'charm'], values: [{ min: 9, max: 17 }] },

  // lightning_resistance
  { id: 'lightning-res-t1', group: 'lightning_resistance', name: 'Storm', text: '+(36-45)% to Lightning Resistance', type: 'suffix', tier: 1, weight: 180, requiredItemLevel: 68, tags: ['armour', 'jewellery', 'amulet', 'ring', 'belt', 'charm'], values: [{ min: 36, max: 45 }] },
  { id: 'lightning-res-t2', group: 'lightning_resistance', name: 'Thunder', text: '+(27-35)% to Lightning Resistance', type: 'suffix', tier: 2, weight: 280, requiredItemLevel: 48, tags: ['armour', 'jewellery', 'amulet', 'ring', 'belt', 'charm'], values: [{ min: 27, max: 35 }] },
  { id: 'lightning-res-t3', group: 'lightning_resistance', name: 'Squall', text: '+(18-26)% to Lightning Resistance', type: 'suffix', tier: 3, weight: 420, requiredItemLevel: 28, tags: ['armour', 'jewellery', 'amulet', 'ring', 'belt', 'charm'], values: [{ min: 18, max: 26 }] },
  { id: 'lightning-res-t4', group: 'lightning_resistance', name: 'Gale', text: '+(9-17)% to Lightning Resistance', type: 'suffix', tier: 4, weight: 640, requiredItemLevel: 8, tags: ['armour', 'jewellery', 'amulet', 'ring', 'belt', 'charm'], values: [{ min: 9, max: 17 }] },

  // chaos_resistance
  { id: 'chaos-res-t1', group: 'chaos_resistance', name: 'Antitoxin', text: '+(22-30)% to Chaos Resistance', type: 'suffix', tier: 1, weight: 120, requiredItemLevel: 60, tags: ['armour', 'jewellery', 'amulet', 'ring', 'belt', 'charm'], values: [{ min: 22, max: 30 }] },
  { id: 'chaos-res-t2', group: 'chaos_resistance', name: 'Remedy', text: '+(16-21)% to Chaos Resistance', type: 'suffix', tier: 2, weight: 220, requiredItemLevel: 40, tags: ['armour', 'jewellery', 'amulet', 'ring', 'belt', 'charm'], values: [{ min: 16, max: 21 }] },
  { id: 'chaos-res-t3', group: 'chaos_resistance', name: 'Cure', text: '+(9-15)% to Chaos Resistance', type: 'suffix', tier: 3, weight: 360, requiredItemLevel: 20, tags: ['armour', 'jewellery', 'amulet', 'ring', 'belt', 'charm'], values: [{ min: 9, max: 15 }] },

  // movement_speed (boots only suffix)
  { id: 'move-spd-t1', group: 'movement_speed', name: 'Fleet', text: '+(30-35)% increased Movement Speed', type: 'suffix', tier: 1, weight: 75, requiredItemLevel: 72, tags: ['boots'], values: [{ min: 30, max: 35 }] },
  { id: 'move-spd-t2', group: 'movement_speed', name: 'Runner', text: '+(24-29)% increased Movement Speed', type: 'suffix', tier: 2, weight: 140, requiredItemLevel: 50, tags: ['boots'], values: [{ min: 24, max: 29 }] },
  { id: 'move-spd-t3', group: 'movement_speed', name: 'Sprinter', text: '+(18-23)% increased Movement Speed', type: 'suffix', tier: 3, weight: 240, requiredItemLevel: 30, tags: ['boots'], values: [{ min: 18, max: 23 }] },
  { id: 'move-spd-t4', group: 'movement_speed', name: 'Swift', text: '+(12-17)% increased Movement Speed', type: 'suffix', tier: 4, weight: 380, requiredItemLevel: 12, tags: ['boots'], values: [{ min: 12, max: 17 }] },
  { id: 'move-spd-t5', group: 'movement_speed', name: 'Quick', text: '+(5-11)% increased Movement Speed', type: 'suffix', tier: 5, weight: 580, requiredItemLevel: 1, tags: ['boots'], values: [{ min: 5, max: 11 }] },

  // life_regeneration
  { id: 'life-regen-t1', group: 'life_regeneration', name: 'Athlete', text: 'Regenerate 1.2% of Life per second', type: 'suffix', tier: 1, weight: 150, requiredItemLevel: 70, tags: ['armour', 'belt'] },
  { id: 'life-regen-t2', group: 'life_regeneration', name: 'Runner', text: 'Regenerate 0.9% of Life per second', type: 'suffix', tier: 2, weight: 250, requiredItemLevel: 50, tags: ['armour', 'belt'] },
  { id: 'life-regen-t3', group: 'life_regeneration', name: 'Active', text: 'Regenerate 0.6% of Life per second', type: 'suffix', tier: 3, weight: 380, requiredItemLevel: 30, tags: ['armour', 'belt'] },
  { id: 'life-regen-t4', group: 'life_regeneration', name: 'Healthy', text: 'Regenerate 0.3% of Life per second', type: 'suffix', tier: 4, weight: 580, requiredItemLevel: 10, tags: ['armour', 'belt'] },

  // all_attributes
  { id: 'all-attrib-t1', group: 'all_attributes', name: 'Genius', text: '+(28-35) to all Attributes', type: 'suffix', tier: 1, weight: 130, requiredItemLevel: 65, tags: ['jewellery', 'amulet', 'ring'], values: [{ min: 28, max: 35 }] },
  { id: 'all-attrib-t2', group: 'all_attributes', name: 'Apt', text: '+(20-27) to all Attributes', type: 'suffix', tier: 2, weight: 220, requiredItemLevel: 45, tags: ['jewellery', 'amulet', 'ring'], values: [{ min: 20, max: 27 }] },
  { id: 'all-attrib-t3', group: 'all_attributes', name: 'Versatile', text: '+(12-19) to all Attributes', type: 'suffix', tier: 3, weight: 360, requiredItemLevel: 22, tags: ['jewellery', 'amulet', 'ring'], values: [{ min: 12, max: 19 }] },

  // strength_bonus
  { id: 'str-bonus-t1', group: 'strength_bonus', name: 'Bull', text: '+(56-70) to Strength', type: 'suffix', tier: 1, weight: 160, requiredItemLevel: 64, tags: ['armour', 'jewellery', 'amulet', 'ring', 'belt'], values: [{ min: 56, max: 70 }] },
  { id: 'str-bonus-t2', group: 'strength_bonus', name: 'Brawn', text: '+(40-55) to Strength', type: 'suffix', tier: 2, weight: 260, requiredItemLevel: 42, tags: ['armour', 'jewellery', 'amulet', 'ring', 'belt'], values: [{ min: 40, max: 55 }] },
  { id: 'str-bonus-t3', group: 'strength_bonus', name: 'Power', text: '+(24-39) to Strength', type: 'suffix', tier: 3, weight: 400, requiredItemLevel: 22, tags: ['armour', 'jewellery', 'amulet', 'ring', 'belt'], values: [{ min: 24, max: 39 }] },
  { id: 'str-bonus-t4', group: 'strength_bonus', name: 'Titan', text: '+(10-23) to Strength', type: 'suffix', tier: 4, weight: 620, requiredItemLevel: 4, tags: ['armour', 'jewellery', 'amulet', 'ring', 'belt'], values: [{ min: 10, max: 23 }] },

  // dexterity_bonus
  { id: 'dex-bonus-t1', group: 'dexterity_bonus', name: 'Dancer', text: '+(56-70) to Dexterity', type: 'suffix', tier: 1, weight: 160, requiredItemLevel: 64, tags: ['armour', 'jewellery', 'amulet', 'ring', 'belt'], values: [{ min: 56, max: 70 }] },
  { id: 'dex-bonus-t2', group: 'dexterity_bonus', name: 'Agile', text: '+(40-55) to Dexterity', type: 'suffix', tier: 2, weight: 260, requiredItemLevel: 42, tags: ['armour', 'jewellery', 'amulet', 'ring', 'belt'], values: [{ min: 40, max: 55 }] },
  { id: 'dex-bonus-t3', group: 'dexterity_bonus', name: 'Nimble', text: '+(24-39) to Dexterity', type: 'suffix', tier: 3, weight: 400, requiredItemLevel: 22, tags: ['armour', 'jewellery', 'amulet', 'ring', 'belt'], values: [{ min: 24, max: 39 }] },
  { id: 'dex-bonus-t4', group: 'dexterity_bonus', name: 'Quick', text: '+(10-23) to Dexterity', type: 'suffix', tier: 4, weight: 620, requiredItemLevel: 4, tags: ['armour', 'jewellery', 'amulet', 'ring', 'belt'], values: [{ min: 10, max: 23 }] },

  // intelligence_bonus
  { id: 'int-bonus-t1', group: 'intelligence_bonus', name: 'Sage', text: '+(56-70) to Intelligence', type: 'suffix', tier: 1, weight: 160, requiredItemLevel: 64, tags: ['armour', 'jewellery', 'amulet', 'ring', 'belt'], values: [{ min: 56, max: 70 }] },
  { id: 'int-bonus-t2', group: 'intelligence_bonus', name: 'Scholar', text: '+(40-55) to Intelligence', type: 'suffix', tier: 2, weight: 260, requiredItemLevel: 42, tags: ['armour', 'jewellery', 'amulet', 'ring', 'belt'], values: [{ min: 40, max: 55 }] },
  { id: 'int-bonus-t3', group: 'intelligence_bonus', name: 'Learned', text: '+(24-39) to Intelligence', type: 'suffix', tier: 3, weight: 400, requiredItemLevel: 22, tags: ['armour', 'jewellery', 'amulet', 'ring', 'belt'], values: [{ min: 24, max: 39 }] },
  { id: 'int-bonus-t4', group: 'intelligence_bonus', name: 'Student', text: '+(10-23) to Intelligence', type: 'suffix', tier: 4, weight: 620, requiredItemLevel: 4, tags: ['armour', 'jewellery', 'amulet', 'ring', 'belt'], values: [{ min: 10, max: 23 }] },

  // gem_level_active: +level of all Skill Gems (amulet)
  { id: 'gem-level-active-t2', group: 'gem_level_active', name: 'Talent', text: '+1 to Level of all Skill Gems', type: 'suffix', tier: 2, weight: 60, requiredItemLevel: 55, tags: ['amulet'] },
  { id: 'gem-level-active-t1', group: 'gem_level_active', name: 'Mastery', text: '+2 to Level of all Skill Gems', type: 'suffix', tier: 1, weight: 30, requiredItemLevel: 75, tags: ['amulet'] },

  // ── Attack Weapon Extra Prefixes ──────────────────────────────────────────

  // adds_chaos_damage: Adds Chaos Damage to Attacks (attack weapon prefix)
  { id: 'adds-chaos-t1', group: 'adds_chaos_damage', name: 'Pestilent', text: 'Adds (12-15) to (24-30) Chaos Damage', type: 'prefix', tier: 1, weight: 80, requiredItemLevel: 68, tags: ['weapon', 'attack'], values: [{ min: 12, max: 15 }, { min: 24, max: 30 }] },
  { id: 'adds-chaos-t2', group: 'adds_chaos_damage', name: 'Virulent', text: 'Adds (8-11) to (15-22) Chaos Damage', type: 'prefix', tier: 2, weight: 150, requiredItemLevel: 46, tags: ['weapon', 'attack'], values: [{ min: 8, max: 11 }, { min: 15, max: 22 }] },
  { id: 'adds-chaos-t3', group: 'adds_chaos_damage', name: 'Corrupted', text: 'Adds (4-7) to (8-14) Chaos Damage', type: 'prefix', tier: 3, weight: 260, requiredItemLevel: 24, tags: ['weapon', 'attack'], values: [{ min: 4, max: 7 }, { min: 8, max: 14 }] },
  { id: 'adds-chaos-t4', group: 'adds_chaos_damage', name: 'Vile', text: 'Adds (1-3) to (3-7) Chaos Damage', type: 'prefix', tier: 4, weight: 420, requiredItemLevel: 6, tags: ['weapon', 'attack'], values: [{ min: 1, max: 3 }, { min: 3, max: 7 }] },

  // ── Quiver Prefixes ───────────────────────────────────────────────────────

  // quiver_flat_phys: Adds flat Physical Damage (arrows)
  { id: 'quiver-flat-phys-t1', group: 'quiver_flat_phys', name: 'Serrated', text: 'Adds (10-14) to (20-26) Physical Damage to Attacks', type: 'prefix', tier: 1, weight: 120, requiredItemLevel: 60, tags: ['armour', 'quiver'], values: [{ min: 10, max: 14 }, { min: 20, max: 26 }] },
  { id: 'quiver-flat-phys-t2', group: 'quiver_flat_phys', name: 'Barbed', text: 'Adds (6-9) to (12-18) Physical Damage to Attacks', type: 'prefix', tier: 2, weight: 220, requiredItemLevel: 36, tags: ['armour', 'quiver'], values: [{ min: 6, max: 9 }, { min: 12, max: 18 }] },
  { id: 'quiver-flat-phys-t3', group: 'quiver_flat_phys', name: 'Pointed', text: 'Adds (2-5) to (5-11) Physical Damage to Attacks', type: 'prefix', tier: 3, weight: 360, requiredItemLevel: 14, tags: ['armour', 'quiver'], values: [{ min: 2, max: 5 }, { min: 5, max: 11 }] },

  // quiver_projectile_damage: % increased Projectile Damage
  { id: 'quiver-proj-dmg-t1', group: 'quiver_projectile_damage', name: 'Piercing', text: '+(45-60)% increased Projectile Damage', type: 'prefix', tier: 1, weight: 100, requiredItemLevel: 64, tags: ['armour', 'quiver'], values: [{ min: 45, max: 60 }] },
  { id: 'quiver-proj-dmg-t2', group: 'quiver_projectile_damage', name: 'Penetrating', text: '+(30-44)% increased Projectile Damage', type: 'prefix', tier: 2, weight: 180, requiredItemLevel: 40, tags: ['armour', 'quiver'], values: [{ min: 30, max: 44 }] },
  { id: 'quiver-proj-dmg-t3', group: 'quiver_projectile_damage', name: 'Launched', text: '+(15-29)% increased Projectile Damage', type: 'prefix', tier: 3, weight: 300, requiredItemLevel: 18, tags: ['armour', 'quiver'], values: [{ min: 15, max: 29 }] },

  // quiver_attack_speed: % increased Attack Speed (quiver suffix)
  { id: 'quiver-atk-spd-t1', group: 'quiver_attack_speed', name: 'Rapid', text: '+(14-18)% increased Attack Speed', type: 'suffix', tier: 1, weight: 120, requiredItemLevel: 64, tags: ['armour', 'quiver'], values: [{ min: 14, max: 18 }] },
  { id: 'quiver-atk-spd-t2', group: 'quiver_attack_speed', name: 'Snappy', text: '+(8-13)% increased Attack Speed', type: 'suffix', tier: 2, weight: 220, requiredItemLevel: 36, tags: ['armour', 'quiver'], values: [{ min: 8, max: 13 }] },
  { id: 'quiver-atk-spd-t3', group: 'quiver_attack_speed', name: 'Nocking', text: '+(4-7)% increased Attack Speed', type: 'suffix', tier: 3, weight: 360, requiredItemLevel: 12, tags: ['armour', 'quiver'], values: [{ min: 4, max: 7 }] },

  // quiver_critical_hit_chance: % increased Critical Hit Chance (quiver suffix)
  { id: 'quiver-crit-t1', group: 'quiver_critical_hit_chance', name: 'Deadly', text: '+(2.5-3.5)% to Critical Hit Chance', type: 'suffix', tier: 1, weight: 100, requiredItemLevel: 60, tags: ['armour', 'quiver'], values: [{ min: 2.5, max: 3.5 }] },
  { id: 'quiver-crit-t2', group: 'quiver_critical_hit_chance', name: 'Sharp', text: '+(1.5-2.4)% to Critical Hit Chance', type: 'suffix', tier: 2, weight: 180, requiredItemLevel: 36, tags: ['armour', 'quiver'], values: [{ min: 1.5, max: 2.4 }] },
  { id: 'quiver-crit-t3', group: 'quiver_critical_hit_chance', name: 'Keen', text: '+(0.6-1.4)% to Critical Hit Chance', type: 'suffix', tier: 3, weight: 300, requiredItemLevel: 12, tags: ['armour', 'quiver'], values: [{ min: 0.6, max: 1.4 }] },

  // ── Ring Extra Prefixes ───────────────────────────────────────────────────

  // ring_added_fire_damage: Adds flat Fire Damage to Attacks (ring prefix)
  { id: 'ring-fire-dmg-t1', group: 'ring_added_fire_damage', name: 'Flaming', text: 'Adds (8-12) to (14-18) Fire Damage to Attacks', type: 'prefix', tier: 1, weight: 120, requiredItemLevel: 58, tags: ['jewellery', 'ring'], values: [{ min: 8, max: 12 }, { min: 14, max: 18 }] },
  { id: 'ring-fire-dmg-t2', group: 'ring_added_fire_damage', name: 'Smoking', text: 'Adds (4-7) to (8-12) Fire Damage to Attacks', type: 'prefix', tier: 2, weight: 220, requiredItemLevel: 32, tags: ['jewellery', 'ring'], values: [{ min: 4, max: 7 }, { min: 8, max: 12 }] },
  { id: 'ring-fire-dmg-t3', group: 'ring_added_fire_damage', name: 'Heated', text: 'Adds (1-3) to (3-7) Fire Damage to Attacks', type: 'prefix', tier: 3, weight: 360, requiredItemLevel: 8, tags: ['jewellery', 'ring'], values: [{ min: 1, max: 3 }, { min: 3, max: 7 }] },

  // ring_added_cold_damage: Adds flat Cold Damage to Attacks (ring prefix)
  { id: 'ring-cold-dmg-t1', group: 'ring_added_cold_damage', name: 'Icy', text: 'Adds (6-9) to (12-16) Cold Damage to Attacks', type: 'prefix', tier: 1, weight: 120, requiredItemLevel: 58, tags: ['jewellery', 'ring'], values: [{ min: 6, max: 9 }, { min: 12, max: 16 }] },
  { id: 'ring-cold-dmg-t2', group: 'ring_added_cold_damage', name: 'Frosted', text: 'Adds (3-5) to (6-11) Cold Damage to Attacks', type: 'prefix', tier: 2, weight: 220, requiredItemLevel: 32, tags: ['jewellery', 'ring'], values: [{ min: 3, max: 5 }, { min: 6, max: 11 }] },
  { id: 'ring-cold-dmg-t3', group: 'ring_added_cold_damage', name: 'Chilled', text: 'Adds 1 to (2-5) Cold Damage to Attacks', type: 'prefix', tier: 3, weight: 360, requiredItemLevel: 8, tags: ['jewellery', 'ring'], values: [{ min: 1, max: 1 }, { min: 2, max: 5 }] },

  // ring_added_lightning_damage: Adds flat Lightning Damage to Attacks (ring prefix)
  { id: 'ring-lightning-dmg-t1', group: 'ring_added_lightning_damage', name: 'Shocking', text: 'Adds (1-3) to (22-30) Lightning Damage to Attacks', type: 'prefix', tier: 1, weight: 120, requiredItemLevel: 58, tags: ['jewellery', 'ring'], values: [{ min: 1, max: 3 }, { min: 22, max: 30 }] },
  { id: 'ring-lightning-dmg-t2', group: 'ring_added_lightning_damage', name: 'Sparking', text: 'Adds 1 to (12-20) Lightning Damage to Attacks', type: 'prefix', tier: 2, weight: 220, requiredItemLevel: 32, tags: ['jewellery', 'ring'], values: [{ min: 1, max: 1 }, { min: 12, max: 20 }] },
  { id: 'ring-lightning-dmg-t3', group: 'ring_added_lightning_damage', name: 'Buzzing', text: 'Adds 1 to (4-10) Lightning Damage to Attacks', type: 'prefix', tier: 3, weight: 360, requiredItemLevel: 8, tags: ['jewellery', 'ring'], values: [{ min: 1, max: 1 }, { min: 4, max: 10 }] },

  // ── Belt Extra Prefixes ───────────────────────────────────────────────────

  // belt_flask_charges: Gain Flask Charges (belt prefix)
  { id: 'belt-flask-charges-t1', group: 'belt_flask_charges', name: 'Replenishing', text: '+(2-3) to Maximum Flask Charges', type: 'prefix', tier: 1, weight: 100, requiredItemLevel: 60, tags: ['belt'], values: [{ min: 2, max: 3 }] },
  { id: 'belt-flask-charges-t2', group: 'belt_flask_charges', name: 'Stocked', text: '+2 to Maximum Flask Charges', type: 'prefix', tier: 2, weight: 200, requiredItemLevel: 35, tags: ['belt'], values: [{ min: 2, max: 2 }] },
  { id: 'belt-flask-charges-t3', group: 'belt_flask_charges', name: 'Ready', text: '+1 to Maximum Flask Charges', type: 'prefix', tier: 3, weight: 360, requiredItemLevel: 10, tags: ['belt'], values: [{ min: 1, max: 1 }] },

  // belt_flask_effect: % increased Flask Effect (belt prefix)
  { id: 'belt-flask-effect-t1', group: 'belt_flask_effect', name: 'Bountiful', text: '+(22-30)% increased Flask Effect', type: 'prefix', tier: 1, weight: 80, requiredItemLevel: 64, tags: ['belt'], values: [{ min: 22, max: 30 }] },
  { id: 'belt-flask-effect-t2', group: 'belt_flask_effect', name: 'Potent', text: '+(14-21)% increased Flask Effect', type: 'prefix', tier: 2, weight: 160, requiredItemLevel: 42, tags: ['belt'], values: [{ min: 14, max: 21 }] },
  { id: 'belt-flask-effect-t3', group: 'belt_flask_effect', name: 'Effective', text: '+(6-13)% increased Flask Effect', type: 'prefix', tier: 3, weight: 280, requiredItemLevel: 18, tags: ['belt'], values: [{ min: 6, max: 13 }] },

  // ── Jewel Prefixes ────────────────────────────────────────────────────────

  // jewel_maximum_life: flat maximum Life (jewel prefix)
  { id: 'jewel-life-t1', group: 'jewel_maximum_life', name: 'Healthy', text: '+(35-50) to maximum Life', type: 'prefix', tier: 1, weight: 150, requiredItemLevel: 60, tags: ['jewel'], values: [{ min: 35, max: 50 }] },
  { id: 'jewel-life-t2', group: 'jewel_maximum_life', name: 'Vital', text: '+(20-34) to maximum Life', type: 'prefix', tier: 2, weight: 260, requiredItemLevel: 35, tags: ['jewel'], values: [{ min: 20, max: 34 }] },
  { id: 'jewel-life-t3', group: 'jewel_maximum_life', name: 'Living', text: '+(8-19) to maximum Life', type: 'prefix', tier: 3, weight: 420, requiredItemLevel: 8, tags: ['jewel'], values: [{ min: 8, max: 19 }] },

  // jewel_maximum_energy_shield: flat maximum Energy Shield (jewel prefix)
  { id: 'jewel-es-t1', group: 'jewel_maximum_energy_shield', name: 'Charged', text: '+(22-35) to maximum Energy Shield', type: 'prefix', tier: 1, weight: 150, requiredItemLevel: 60, tags: ['jewel'], values: [{ min: 22, max: 35 }] },
  { id: 'jewel-es-t2', group: 'jewel_maximum_energy_shield', name: 'Crackling', text: '+(12-21) to maximum Energy Shield', type: 'prefix', tier: 2, weight: 260, requiredItemLevel: 35, tags: ['jewel'], values: [{ min: 12, max: 21 }] },
  { id: 'jewel-es-t3', group: 'jewel_maximum_energy_shield', name: 'Pulsing', text: '+(4-11) to maximum Energy Shield', type: 'prefix', tier: 3, weight: 420, requiredItemLevel: 8, tags: ['jewel'], values: [{ min: 4, max: 11 }] },

  // jewel_increased_damage: % increased Damage (jewel prefix)
  { id: 'jewel-damage-t1', group: 'jewel_increased_damage', name: 'Destructive', text: '+(12-16)% increased Damage', type: 'prefix', tier: 1, weight: 120, requiredItemLevel: 55, tags: ['jewel'], values: [{ min: 12, max: 16 }] },
  { id: 'jewel-damage-t2', group: 'jewel_increased_damage', name: 'Ruinous', text: '+(7-11)% increased Damage', type: 'prefix', tier: 2, weight: 220, requiredItemLevel: 30, tags: ['jewel'], values: [{ min: 7, max: 11 }] },
  { id: 'jewel-damage-t3', group: 'jewel_increased_damage', name: 'Forceful', text: '+(3-6)% increased Damage', type: 'prefix', tier: 3, weight: 380, requiredItemLevel: 8, tags: ['jewel'], values: [{ min: 3, max: 6 }] },

  // ── Jewel Suffixes ────────────────────────────────────────────────────────

  // jewel_fire_resistance: % Fire Resistance (jewel suffix)
  { id: 'jewel-fire-res-t1', group: 'jewel_fire_resistance', name: 'Cinder', text: '+(12-16)% to Fire Resistance', type: 'suffix', tier: 1, weight: 200, requiredItemLevel: 40, tags: ['jewel'], values: [{ min: 12, max: 16 }] },
  { id: 'jewel-fire-res-t2', group: 'jewel_fire_resistance', name: 'Ember', text: '+(6-11)% to Fire Resistance', type: 'suffix', tier: 2, weight: 360, requiredItemLevel: 10, tags: ['jewel'], values: [{ min: 6, max: 11 }] },

  // jewel_cold_resistance: % Cold Resistance (jewel suffix)
  { id: 'jewel-cold-res-t1', group: 'jewel_cold_resistance', name: 'Frost', text: '+(12-16)% to Cold Resistance', type: 'suffix', tier: 1, weight: 200, requiredItemLevel: 40, tags: ['jewel'], values: [{ min: 12, max: 16 }] },
  { id: 'jewel-cold-res-t2', group: 'jewel_cold_resistance', name: 'Floe', text: '+(6-11)% to Cold Resistance', type: 'suffix', tier: 2, weight: 360, requiredItemLevel: 10, tags: ['jewel'], values: [{ min: 6, max: 11 }] },

  // jewel_lightning_resistance: % Lightning Resistance (jewel suffix)
  { id: 'jewel-lightning-res-t1', group: 'jewel_lightning_resistance', name: 'Spark', text: '+(12-16)% to Lightning Resistance', type: 'suffix', tier: 1, weight: 200, requiredItemLevel: 40, tags: ['jewel'], values: [{ min: 12, max: 16 }] },
  { id: 'jewel-lightning-res-t2', group: 'jewel_lightning_resistance', name: 'Jolt', text: '+(6-11)% to Lightning Resistance', type: 'suffix', tier: 2, weight: 360, requiredItemLevel: 10, tags: ['jewel'], values: [{ min: 6, max: 11 }] },

  // jewel_all_attributes: + to all Attributes (jewel suffix)
  { id: 'jewel-all-attrib-t1', group: 'jewel_all_attributes', name: 'Gifted', text: '+(8-12) to all Attributes', type: 'suffix', tier: 1, weight: 150, requiredItemLevel: 50, tags: ['jewel'], values: [{ min: 8, max: 12 }] },
  { id: 'jewel-all-attrib-t2', group: 'jewel_all_attributes', name: 'Versatile', text: '+(3-7) to all Attributes', type: 'suffix', tier: 2, weight: 280, requiredItemLevel: 12, tags: ['jewel'], values: [{ min: 3, max: 7 }] },

  // jewel_critical_hit_chance: % increased Critical Hit Chance (jewel suffix)
  { id: 'jewel-crit-t1', group: 'jewel_critical_hit_chance', name: 'Lethal', text: '+(1.5-2.5)% to Critical Hit Chance', type: 'suffix', tier: 1, weight: 130, requiredItemLevel: 50, tags: ['jewel'], values: [{ min: 1.5, max: 2.5 }] },
  { id: 'jewel-crit-t2', group: 'jewel_critical_hit_chance', name: 'Incisive', text: '+(0.5-1.4)% to Critical Hit Chance', type: 'suffix', tier: 2, weight: 240, requiredItemLevel: 12, tags: ['jewel'], values: [{ min: 0.5, max: 1.4 }] },

  // jewel_attack_speed: % increased Attack Speed (jewel suffix)
  { id: 'jewel-atk-spd-t1', group: 'jewel_attack_speed', name: 'Haste', text: '+(6-9)% increased Attack Speed', type: 'suffix', tier: 1, weight: 130, requiredItemLevel: 45, tags: ['jewel'], values: [{ min: 6, max: 9 }] },
  { id: 'jewel-atk-spd-t2', group: 'jewel_attack_speed', name: 'Swift', text: '+(3-5)% increased Attack Speed', type: 'suffix', tier: 2, weight: 240, requiredItemLevel: 10, tags: ['jewel'], values: [{ min: 3, max: 5 }] },

  // ── Flask Prefixes ────────────────────────────────────────────────────────

  // flask_increased_life_recovery: % increased Life Recovery (life flask prefix)
  { id: 'flask-life-recovery-t1', group: 'flask_increased_life_recovery', name: 'Bubbling', text: '+(80-100)% increased Life Recovery from Flasks', type: 'prefix', tier: 1, weight: 100, requiredItemLevel: 60, tags: ['flask', 'life_flask'], values: [{ min: 80, max: 100 }] },
  { id: 'flask-life-recovery-t2', group: 'flask_increased_life_recovery', name: 'Seething', text: '+(50-79)% increased Life Recovery from Flasks', type: 'prefix', tier: 2, weight: 200, requiredItemLevel: 35, tags: ['flask', 'life_flask'], values: [{ min: 50, max: 79 }] },
  { id: 'flask-life-recovery-t3', group: 'flask_increased_life_recovery', name: 'Saturated', text: '+(20-49)% increased Life Recovery from Flasks', type: 'prefix', tier: 3, weight: 360, requiredItemLevel: 8, tags: ['flask', 'life_flask'], values: [{ min: 20, max: 49 }] },

  // flask_increased_mana_recovery: % increased Mana Recovery (mana flask prefix)
  { id: 'flask-mana-recovery-t1', group: 'flask_increased_mana_recovery', name: 'Brimming', text: '+(80-100)% increased Mana Recovery from Flasks', type: 'prefix', tier: 1, weight: 100, requiredItemLevel: 60, tags: ['flask', 'mana_flask'], values: [{ min: 80, max: 100 }] },
  { id: 'flask-mana-recovery-t2', group: 'flask_increased_mana_recovery', name: 'Replenishing', text: '+(50-79)% increased Mana Recovery from Flasks', type: 'prefix', tier: 2, weight: 200, requiredItemLevel: 35, tags: ['flask', 'mana_flask'], values: [{ min: 50, max: 79 }] },
  { id: 'flask-mana-recovery-t3', group: 'flask_increased_mana_recovery', name: 'Refreshing', text: '+(20-49)% increased Mana Recovery from Flasks', type: 'prefix', tier: 3, weight: 360, requiredItemLevel: 8, tags: ['flask', 'mana_flask'], values: [{ min: 20, max: 49 }] },

  // flask_increased_effect: % increased Flask Effect (flask prefix)
  { id: 'flask-effect-t1', group: 'flask_increased_effect', name: 'Potent', text: '+(28-40)% increased Effect', type: 'prefix', tier: 1, weight: 80, requiredItemLevel: 55, tags: ['flask'], values: [{ min: 28, max: 40 }] },
  { id: 'flask-effect-t2', group: 'flask_increased_effect', name: 'Concentrated', text: '+(14-27)% increased Effect', type: 'prefix', tier: 2, weight: 160, requiredItemLevel: 28, tags: ['flask'], values: [{ min: 14, max: 27 }] },
  { id: 'flask-effect-t3', group: 'flask_increased_effect', name: 'Strengthened', text: '+(4-13)% increased Effect', type: 'prefix', tier: 3, weight: 280, requiredItemLevel: 6, tags: ['flask'], values: [{ min: 4, max: 13 }] },

  // ── Flask Suffixes ────────────────────────────────────────────────────────

  // flask_duration: % increased Duration (flask suffix)
  { id: 'flask-duration-t1', group: 'flask_duration', name: 'Prolonged', text: '+(50-60)% increased Duration', type: 'suffix', tier: 1, weight: 120, requiredItemLevel: 50, tags: ['flask'], values: [{ min: 50, max: 60 }] },
  { id: 'flask-duration-t2', group: 'flask_duration', name: 'Lasting', text: '+(30-49)% increased Duration', type: 'suffix', tier: 2, weight: 220, requiredItemLevel: 28, tags: ['flask'], values: [{ min: 30, max: 49 }] },
  { id: 'flask-duration-t3', group: 'flask_duration', name: 'Extended', text: '+(10-29)% increased Duration', type: 'suffix', tier: 3, weight: 360, requiredItemLevel: 6, tags: ['flask'], values: [{ min: 10, max: 29 }] },

  // flask_charges_used: reduced Charges Used (flask suffix)
  { id: 'flask-charges-used-t1', group: 'flask_charges_used', name: 'Frugal', text: '-(2-3) to Charges Used', type: 'suffix', tier: 1, weight: 100, requiredItemLevel: 50, tags: ['flask'], values: [{ min: 2, max: 3 }] },
  { id: 'flask-charges-used-t2', group: 'flask_charges_used', name: 'Sparing', text: '-1 to Charges Used', type: 'suffix', tier: 2, weight: 200, requiredItemLevel: 20, tags: ['flask'], values: [{ min: 1, max: 1 }] },

  // flask_immunity_bleed: Immunity to Bleeding (flask suffix)
  { id: 'flask-immune-bleed', group: 'flask_immunity_bleed', name: 'Staunching', text: 'Grants Immunity to Bleeding during Effect', type: 'suffix', tier: 1, weight: 80, requiredItemLevel: 18, tags: ['flask', 'life_flask'] },

  // flask_immunity_poison: Immunity to Poison (flask suffix)
  { id: 'flask-immune-poison', group: 'flask_immunity_poison', name: 'Curing', text: 'Grants Immunity to Poison during Effect', type: 'suffix', tier: 1, weight: 80, requiredItemLevel: 18, tags: ['flask', 'life_flask'] },

  // flask_immunity_freeze: Immunity to Freeze (flask suffix)
  { id: 'flask-immune-freeze', group: 'flask_immunity_freeze', name: 'Warming', text: 'Grants Immunity to Freeze during Effect', type: 'suffix', tier: 1, weight: 80, requiredItemLevel: 18, tags: ['flask'] },

  // flask_immunity_shock: Immunity to Shock (flask suffix)
  { id: 'flask-immune-shock', group: 'flask_immunity_shock', name: 'Grounding', text: 'Grants Immunity to Shock during Effect', type: 'suffix', tier: 1, weight: 80, requiredItemLevel: 18, tags: ['flask'] },

  // ── Charm Prefixes ────────────────────────────────────────────────────────

  // charm_life_regen: Life Regeneration per second (charm prefix)
  { id: 'charm-life-regen-t1', group: 'charm_life_regen', name: 'Vital', text: 'Regenerate (4-6) Life per second', type: 'prefix', tier: 1, weight: 120, requiredItemLevel: 55, tags: ['charm'], values: [{ min: 4, max: 6 }] },
  { id: 'charm-life-regen-t2', group: 'charm_life_regen', name: 'Healthy', text: 'Regenerate (2-3) Life per second', type: 'prefix', tier: 2, weight: 220, requiredItemLevel: 30, tags: ['charm'], values: [{ min: 2, max: 3 }] },
  { id: 'charm-life-regen-t3', group: 'charm_life_regen', name: 'Active', text: 'Regenerate 1 Life per second', type: 'prefix', tier: 3, weight: 360, requiredItemLevel: 8, tags: ['charm'], values: [{ min: 1, max: 1 }] },

  // charm_mana_regen: % increased Mana Regeneration Rate (charm prefix)
  { id: 'charm-mana-regen-t1', group: 'charm_mana_regen', name: 'Focused', text: '+(22-30)% increased Mana Regeneration Rate', type: 'prefix', tier: 1, weight: 100, requiredItemLevel: 50, tags: ['charm'], values: [{ min: 22, max: 30 }] },
  { id: 'charm-mana-regen-t2', group: 'charm_mana_regen', name: 'Peaceful', text: '+(12-21)% increased Mana Regeneration Rate', type: 'prefix', tier: 2, weight: 200, requiredItemLevel: 28, tags: ['charm'], values: [{ min: 12, max: 21 }] },
  { id: 'charm-mana-regen-t3', group: 'charm_mana_regen', name: 'Clear', text: '+(4-11)% increased Mana Regeneration Rate', type: 'prefix', tier: 3, weight: 340, requiredItemLevel: 8, tags: ['charm'], values: [{ min: 4, max: 11 }] },
];
