import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const POE_NINJA_HOSTS = ['poe.ninja', 'www.poe.ninja'];

/**
 * Detect a poe.ninja character URL:
 *   https://poe.ninja/builds?accountName=X&characterName=Y
 *   https://poe.ninja/character?accountName=X&characterName=Y
 */
export function isPoeNinjaUrl(input) {
  if (typeof input !== 'string') return false;
  try {
    const url = new URL(input.trim());
    if (!POE_NINJA_HOSTS.includes(url.hostname)) return false;
    const p = url.pathname.replace(/\/+$/, '');
    if (p !== '/builds' && p !== '/character') return false;
    return (
      url.searchParams.has('accountName') &&
      (url.searchParams.has('characterName') || url.searchParams.has('character'))
    );
  } catch {
    return false;
  }
}

/**
 * Fetch a PoE2 character from the official GGG character-window API
 * using account/character names extracted from the poe.ninja URL.
 * The account profile must be public on pathofexile.com.
 */
export async function fetchPoeNinjaData(input, opts = {}) {
  const url = new URL(input.trim());
  const accountName   = url.searchParams.get('accountName');
  const characterName = url.searchParams.get('characterName') || url.searchParams.get('character');

  if (!accountName || !characterName) {
    throw new Error('URL must include accountName= and characterName= query parameters');
  }

  return fetchPoeCharacter(accountName, characterName, opts);
}

/** Return empty sets — PoE2 API has no multi-set concept. */
export function inspectPoeNinjaUrl() {
  return { skillSets: [], itemSets: [], treeSpecs: [], meta: {} };
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

async function fetchPoeCharacter(accountName, characterName, { timeoutMs = 20000 } = {}) {
  const curlBin   = process.platform === 'win32' ? 'curl.exe' : 'curl';
  const timeoutSec = Math.ceil(timeoutMs / 1000);
  const acc = encodeURIComponent(accountName);
  const chr = encodeURIComponent(characterName);
  const base = 'https://www.pathofexile.com/character-window';

  const [passivesData, itemsData] = await Promise.all([
    fetchPoeApi(`${base}/get-passive-skills?accountName=${acc}&character=${chr}&realm=poe2`, curlBin, timeoutSec),
    fetchPoeApi(`${base}/get-items?accountName=${acc}&character=${chr}&realm=poe2`, curlBin, timeoutSec),
  ]);

  const char  = itemsData.character ?? {};
  const nodes = [
    ...(passivesData.hashes          ?? []),
    ...(passivesData.ascendancyHashes ?? []),
  ];

  return {
    build: {
      meta: {
        level:            char.level   ?? 1,
        className:        char.class   ?? '',
        ascendClassName:  char.class   ?? '',
        mainSocketGroup:  0,
      },
      skills: parsePoeApiSkills(itemsData.items ?? []),
      tree:   { nodes, specs: [{ nodes }] },
      items:  parsePoeApiItems(itemsData.items  ?? []),
      notes:  `Imported from PoE2 — account: ${accountName}`,
    },
    sourceName: characterName,
  };
}

async function fetchPoeApi(url, curlBin, timeoutSec) {
  let stdout;
  try {
    ({ stdout } = await execFileAsync(curlBin, [
      '-sL',
      '--max-time', String(timeoutSec),
      '-H', 'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      '-H', 'Accept: application/json',
      url,
    ], { maxBuffer: 10 * 1024 * 1024 }));
  } catch (err) {
    throw new Error(`Failed to reach PoE API: ${err.message}`);
  }

  let data;
  try {
    data = JSON.parse(stdout);
  } catch {
    throw new Error(
      'PoE API returned a non-JSON response — the account or character may be private, ' +
      'or the character name is incorrect'
    );
  }

  if (data.error) {
    const msg = typeof data.error === 'object'
      ? (data.error.message || JSON.stringify(data.error))
      : String(data.error);
    throw new Error(`PoE API: ${msg}`);
  }

  return data;
}

// PoE API inventoryId → PoB-compatible slot name used by converter.translateSlotName
const POE_INVENTORY_TO_SLOT = {
  Weapon:      'Weapon 1',
  Offhand:     'Weapon 2',
  Helm:        'Helmet',
  BodyArmour:  'Body Armour',
  Gloves:      'Gloves',
  Boots:       'Boots',
  Belt:        'Belt',
  Amulet:      'Amulet',
  Ring:        'Ring 1',
  Ring2:       'Ring 2',
  Flask:       'Flask 1',
  Flask2:      'Flask 2',
  Flask3:      'Flask 3',
  Flask4:      'Flask 4',
  Flask5:      'Flask 5',
};

const EQUIPMENT_SLOT_IDS = new Set(Object.keys(POE_INVENTORY_TO_SLOT));

function parsePoeApiItems(items) {
  const topLevel = items.filter((item) => EQUIPMENT_SLOT_IDS.has(item.inventoryId));
  const list     = [];
  const slots    = [];
  const catalog  = {};

  for (const raw of topLevel) {
    const slotName = POE_INVENTORY_TO_SLOT[raw.inventoryId] ?? raw.inventoryId;
    const isUnique = (raw.frameType ?? 0) === 3; // frameType 3 = Unique
    const name     = isUnique ? raw.name : (raw.typeLine || raw.name || '');

    const item = {
      id:         raw.id || String(list.length + 1),
      rarity:     (['Normal', 'Magic', 'Rare', 'Unique'])[raw.frameType ?? 0] ?? 'Normal',
      name,
      typeLine:   raw.typeLine || '',
      isUnique,
      uniqueName: isUnique ? (raw.name || raw.typeLine) : undefined,
      implicits:  raw.implicitMods ?? [],
      explicits:  raw.explicitMods ?? [],
      runes:      extractApiRunes(raw),
      raw:        raw.baseType || raw.typeLine || '',
    };

    list.push(item);
    catalog[item.id] = item;
    slots.push({ name: slotName, itemId: item.id });
  }

  return { list, slots, catalog };
}

function extractApiRunes(item) {
  return (item.socketedItems ?? [])
    .filter((si) =>
      si.frameType === 9 ||
      (si.properties ?? []).some((p) => p.name === 'Rune')
    )
    .map((si) => si.typeLine || si.name || '')
    .filter(Boolean);
}

function parsePoeApiSkills(items) {
  const groups = [];

  for (const item of items) {
    const socketed = (item.socketedItems ?? []).filter((si) => {
      // Runes are frameType 9; skip them. Accept gems that have a Level property.
      if (si.frameType === 9) return false;
      return (
        (si.typeLine || '').toLowerCase().includes('gem') ||
        (si.properties ?? []).some((p) => p.name === 'Level')
      );
    });

    if (!socketed.length) continue;

    const gems = socketed.map((gem) => ({
      gemId:    guessGemId(gem),
      nameSpec: gem.typeLine || gem.name || '',
      isSupport: (gem.typeLine || '').toLowerCase().includes('support'),
      enabled:  true,
      level:    getGemLevel(gem),
      quality:  getGemQuality(gem),
    }));

    const actives  = gems.filter((g) => !g.isSupport);
    const supports = gems.filter((g) => g.isSupport);
    if (!actives.length && !supports.length) continue;

    groups.push({ enabled: true, actives, supports, allGems: gems });
  }

  return groups;
}

function guessGemId(gem) {
  const raw       = gem.typeLine || gem.name || '';
  const isSupport = raw.toLowerCase().includes('support');
  const token     = raw
    .replace(/\bSupport\b/gi, '')
    .replace(/[^A-Za-z0-9 ]/g, '')
    .trim()
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join('');

  if (!token) return '';
  const prefix = isSupport ? 'SupportGem' : 'SkillGem';
  return `Metadata/Items/Gems/${prefix}${token}`;
}

function getGemLevel(gem) {
  const prop = (gem.properties ?? []).find((p) => p.name === 'Level');
  if (!prop?.values?.[0]?.[0]) return 1;
  return parseInt(String(prop.values[0][0]), 10) || 1;
}

function getGemQuality(gem) {
  const prop = (gem.properties ?? []).find((p) => p.name === 'Quality');
  if (!prop?.values?.[0]?.[0]) return 0;
  return parseInt(String(prop.values[0][0]).replace('%', ''), 10) || 0;
}
