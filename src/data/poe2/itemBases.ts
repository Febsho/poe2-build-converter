import { createRequire } from 'node:module';
import type { ItemBase, Modifier } from './types.ts';

// Re-export shared types for backward compatibility
export type { Modifier, ItemBase } from './types.ts';

// Tag mapping from poe2db class name to item tags
const CLASS_TAG_MAP: Record<string, string[]> = {
  'Wands':           ['weapon', 'wand', 'caster', 'spell'],
  'Bows':            ['weapon', 'bow', 'attack', 'projectile'],
  'Staves':          ['weapon', 'staff', 'caster', 'melee'],
  'Quarterstaves':   ['weapon', 'quarterstaff', 'attack', 'melee'],
  'Crossbows':       ['weapon', 'crossbow', 'attack', 'projectile'],
  'Spears':          ['weapon', 'spear', 'attack', 'melee', 'projectile'],
  'One Hand Maces':  ['weapon', 'mace', 'attack', 'melee', 'str_weapon'],
  'Two Hand Maces':  ['weapon', 'mace', '2h', 'attack', 'melee', 'str_weapon'],
  'Sceptres':        ['weapon', 'sceptre', 'caster', 'melee', 'str_weapon'],
  'Shields':         ['armour', 'shield', 'str_armour', 'block'],
  'Bucklers':        ['armour', 'shield', 'dex_armour', 'block', 'evasion'],
  'Foci':            ['armour', 'focus', 'int_armour', 'energy_shield'],
  'Quivers':         ['armour', 'quiver', 'dex_armour'],
  'Body Armours':    ['armour', 'body_armour'],
  'Helmets':         ['armour', 'helmet'],
  'Gloves':          ['armour', 'gloves'],
  'Boots':           ['armour', 'boots'],
  'Amulets':         ['jewellery', 'amulet'],
  'Rings':           ['jewellery', 'ring'],
  'Belts':           ['jewellery', 'belt'],
  'Jewels':          ['jewel'],
  'Life Flasks':     ['flask', 'life_flask'],
  'Mana Flasks':     ['flask', 'mana_flask'],
  'Charms':          ['charm'],
};

// Derive category from class name
function classToCategory(cls: string): string {
  if (cls.includes('Flask'))  return 'Flask';
  if (cls === 'Charms')       return 'Flask/Charm';
  if (cls === 'Jewels')       return 'Jewel';
  if (['Amulets', 'Rings', 'Belts'].includes(cls)) return 'Jewellery';
  if (['Wands', 'Bows', 'Staves', 'Quarterstaves', 'Crossbows', 'Spears', 'One Hand Maces', 'Two Hand Maces', 'Sceptres'].includes(cls)) return 'Weapon';
  return 'Armour';
}

// Derive item type (short) from class name
function classToType(cls: string): string {
  const map: Record<string, string> = {
    'Wands': 'wand', 'Bows': 'bow', 'Staves': 'staff', 'Quarterstaves': 'quarterstaff',
    'Crossbows': 'crossbow', 'Spears': 'spear',
    'One Hand Maces': 'mace', 'Two Hand Maces': '2h mace', 'Sceptres': 'sceptre',
    'Shields': 'shield', 'Bucklers': 'buckler', 'Foci': 'focus', 'Quivers': 'quiver',
    'Body Armours': 'body armour', 'Helmets': 'helmet', 'Gloves': 'gloves', 'Boots': 'boots',
    'Amulets': 'amulet', 'Rings': 'ring', 'Belts': 'belt',
    'Jewels': 'jewel', 'Life Flasks': 'life flask', 'Mana Flasks': 'mana flask', 'Charms': 'charm',
  };
  return map[cls] ?? cls.toLowerCase();
}

// Parse an implicit text string into a Modifier object
function parseImplicit(text: string, baseId: string, index: number): Modifier {
  const id = `implicit-${baseId}-${index}`;
  // Check for Grants Skill pattern
  const grantsMatch = text.match(/^Grants Skill:\s*(?:Level\s+(\d+)\s+)?(.+)$/i);
  if (grantsMatch) {
    return {
      id,
      name: grantsMatch[2].trim(),
      text,
      type: 'implicit',
      weight: 1,
      requiredItemLevel: 1,
      tags: [],
    };
  }
  // Try to extract a numeric range like (120-160) or +(36-45)
  const rangeMatch = text.match(/\((\d+\.?\d*)-(\d+\.?\d*)\)/g);
  const values = rangeMatch
    ? rangeMatch.map((m) => {
        const [, min, max] = m.match(/\((\d+\.?\d*)-(\d+\.?\d*)\)/) ?? [];
        return { min: Number(min), max: Number(max) };
      })
    : undefined;
  return {
    id,
    name: 'Implicit',
    text,
    type: 'implicit',
    weight: 1,
    requiredItemLevel: 1,
    tags: [],
    ...(values && values.length ? { values } : {}),
  };
}

// Raw cache item shape from data/cache/items.json
interface RawCacheItem {
  id: string;
  name: string;
  class: string;
  level: number;
  implicit?: string;
  stats?: {
    armour?: number;
    evasion?: number;
    energyShield?: number;
    block?: number;
    damageMin?: number;
    damageMax?: number;
    aps?: number;
  };
}

const FALLBACK_RAW_ITEM_BASES: RawCacheItem[] = [
  { id: 'expert-dualstring-bow', name: 'Expert Dualstring Bow', class: 'Bows', level: 77, implicit: 'Bow Attacks fire an additional Arrow' },
  { id: 'expert-longbow', name: 'Expert Longbow', class: 'Bows', level: 78 },
  { id: 'expert-advanced-crossbow', name: 'Expert Bombard Crossbow', class: 'Crossbows', level: 77 },
  { id: 'expert-crackling-staff', name: 'Expert Crackling Staff', class: 'Staves', level: 78, implicit: 'Grants Skill: Level 20 Spark' },
  { id: 'expert-plague-wand', name: 'Expert Plague Wand', class: 'Wands', level: 78, implicit: 'Grants Skill: Level 20 Contagion' },
  { id: 'expert-shaman-sceptre', name: 'Expert Shaman Sceptre', class: 'Sceptres', level: 78, implicit: 'Grants Skill: Level 20 Skeletal Warrior Minion' },
  { id: 'expert-piledriver', name: 'Expert Piledriver', class: 'Two Hand Maces', level: 77 },
  { id: 'expert-iron-cuirass', name: 'Expert Iron Cuirass', class: 'Body Armours', level: 78, stats: { armour: 714 } },
  { id: 'expert-studded-vest', name: 'Expert Studded Vest', class: 'Body Armours', level: 78, stats: { evasion: 714 } },
  { id: 'expert-silk-robe', name: 'Expert Silk Robe', class: 'Body Armours', level: 78, stats: { energyShield: 243 } },
  { id: 'expert-greathelm', name: 'Expert Greathelm', class: 'Helmets', level: 76, stats: { armour: 236 } },
  { id: 'expert-hunter-hood', name: 'Expert Hunter Hood', class: 'Helmets', level: 76, stats: { evasion: 236 } },
  { id: 'expert-gilded-focus', name: 'Expert Gilded Focus', class: 'Foci', level: 78, stats: { energyShield: 106 } },
  { id: 'gold-ring', name: 'Gold Ring', class: 'Rings', level: 20, implicit: '(6-15)% increased Rarity of Items found' },
  { id: 'sapphire-ring', name: 'Sapphire Ring', class: 'Rings', level: 12, implicit: '+(20-30)% to Cold Resistance' },
  { id: 'stellar-amulet', name: 'Stellar Amulet', class: 'Amulets', level: 30, implicit: '+(5-7) to all Attributes' },
  { id: 'heavy-belt', name: 'Heavy Belt', class: 'Belts', level: 8, implicit: '+(25-35) to Strength' },
  { id: 'timeless-jewel', name: 'Timeless Jewel', class: 'Jewels', level: 1 },
];

export function getFallbackItemBases(): ItemBase[] {
  return transformCachedItemBases(FALLBACK_RAW_ITEM_BASES);
}

/**
 * Transform raw cached item bases (from data/cache/items.json) into ItemBase objects.
 */
export function transformCachedItemBases(raw: RawCacheItem[]): ItemBase[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => {
    const cls = item.class ?? '';
    const tags = CLASS_TAG_MAP[cls] ?? ['misc'];
    const implicits: Modifier[] = [];
    if (item.implicit) {
      // Some items have multiple implicits separated by '\n'
      const parts = item.implicit.split('\n').map((s: string) => s.trim()).filter(Boolean);
      parts.forEach((part: string, i: number) => {
        implicits.push(parseImplicit(part, item.id, i));
      });
    }
    return {
      id: item.id,
      name: item.name,
      category: classToCategory(cls),
      type: classToType(cls),
      itemLevel: item.level ?? 1,
      implicits,
      tags,
      ...(item.stats ? { stats: item.stats } : {}),
    };
  });
}

// Load item bases from the cache file at module initialisation time using createRequire
// so the 879 real bases are available without an async call.
const _require = createRequire(import.meta.url);

let _cachedBases: ItemBase[] | null = null;

function loadItemBases(): ItemBase[] {
  if (_cachedBases) return _cachedBases;
  try {
    const raw: RawCacheItem[] = _require('../../../data/cache/items.json');
    _cachedBases = transformCachedItemBases(raw);
  } catch {
    _cachedBases = getFallbackItemBases();
  }
  return _cachedBases;
}

export const POE2_ITEM_BASES: ItemBase[] = loadItemBases();
