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
    // Fallback to empty array if cache is unavailable
    _cachedBases = [];
  }
  return _cachedBases;
}

export const POE2_ITEM_BASES: ItemBase[] = loadItemBases();
