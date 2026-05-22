/**
 * Best-effort mapping tables between Path of Building names and the official
 * PoE2 Build Planner identifiers.
 *
 * IMPORTANT: GGG has not published a complete, machine-readable list of the
 * exact string IDs the .build format expects (passive node IDs, skill gem
 * Metadata paths, ascendancy IDs, inventory slot IDs). Where a value here is
 * not certain, the converter marks the corresponding output as "guessed" and
 * also preserves the human-readable original in `additional_text` so nothing
 * is silently lost. We never invent IDs that look authoritative.
 */

// PoE2 ascendancy display names, keyed by PoB's ascendClassName.
// The .build `ascendancy` field wants an "AscendancyId". The exact ID strings
// are unconfirmed, so we pass the canonical display name through and flag it.
export const KNOWN_POE2_ASCENDANCIES = new Set([
  'Titan',
  'Warbringer',
  'Smith of Kitava',
  'Deadeye',
  'Pathfinder',
  'Ritualist',
  'Infernalist',
  'Blood Mage',
  'Lich',
  'Witchhunter',
  'Gemling Legionnaire',
  'Tactician',
  'Invoker',
  'Acolyte of Chayula',
  'Stormweaver',
  'Chronomancer',
]);

/**
 * Map a PoB slot name to the official PoE2 Build Planner `inventory_id`.
 * Weapon set 1: Weapon / Offhand
 * Weapon set 2 (swap): Weapon2 / Offhand2
 */
const SLOT_TO_INVENTORY = new Map([
  ['weapon 1',       'Weapon'],
  ['weapon 2',       'Offhand'],
  ['weapon 1 swap',  'Weapon2'],
  ['weapon 2 swap',  'Offhand2'],
  ['helmet',         'Helm'],
  ['body armour',    'BodyArmour'],
  ['gloves',         'Gloves'],
  ['boots',          'Boots'],
  ['amulet',         'Amulet'],
  ['ring 1',         'Ring'],
  ['ring 2',         'Ring2'],
  ['belt',           'Belt'],
  ['flask 1',        'Flask1'],
  ['flask 2',        'Flask2'],
  ['flask 3',        'Flask3'],
  ['flask 4',        'Flask4'],
  ['flask 5',        'Flask5'],
]);

export function slotToInventoryId(slotName) {
  if (typeof slotName !== 'string') return undefined;
  const key = slotName.trim().toLowerCase();
  if (SLOT_TO_INVENTORY.has(key)) return SLOT_TO_INVENTORY.get(key);

  // PoB also uses "<Skill> Abyssal Socket N" and jewel slots we cannot map.
  if (key.startsWith('weapon 1 swap')) return 'Weapon2';
  if (key.startsWith('weapon 2 swap')) return 'Offhand2';
  return undefined;
}

/**
 * Build a candidate PoE2 gem Metadata path from a gem's PoB skillId.
 * PoB's skillId is often close to the engine's internal id (e.g. "Fireball"),
 * but the full Metadata path and exact casing are unconfirmed. We therefore
 * return a candidate and let the caller flag it as guessed.
 */
export function guessSkillMetadataId(gem) {
  const base = gem.skillId || sanitizeName(gem.nameSpec);
  if (!base) return undefined;
  return {
    candidate: `Metadata/Items/Gems/SkillGem${base}`,
    confidence: gem.skillId ? 'medium' : 'low',
  };
}

export function guessSupportMetadataId(gem) {
  const base = gem.skillId || sanitizeName(gem.nameSpec);
  if (!base) return undefined;
  // Strip a leading "Support" token PoB sometimes includes.
  const clean = base.replace(/^support/i, '');
  return {
    candidate: `Metadata/Items/Gems/SupportGem${clean}`,
    confidence: gem.skillId ? 'medium' : 'low',
  };
}

function sanitizeName(name) {
  if (typeof name !== 'string') return undefined;
  return name.replace(/[^A-Za-z0-9]/g, '');
}
