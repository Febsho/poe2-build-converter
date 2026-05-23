import zlib from 'node:zlib';
import { XMLParser } from 'fast-xml-parser';
import { resolveGemLevel } from './gemLevels.js';

/**
 * Decode a Path of Building export code into its raw XML string.
 * PoB export codes are URL-safe base64 of a zlib-compressed XML document.
 * Modern PoB prepends a version byte (0x01/0x02) before the zlib stream.
 */
export function decodePobCode(code) {
  if (typeof code !== 'string') throw new Error('PoB code must be a string');

  let cleaned = code.trim().replace(/\s+/g, '');

  // Strip "code=..." prefix some sources include
  const eq = cleaned.lastIndexOf('=');
  if (cleaned.includes('code=') && eq !== -1 && eq < cleaned.length - 1) {
    cleaned = cleaned.slice(eq + 1);
  }

  let b64 = cleaned.replace(/-/g, '+').replace(/_/g, '/');
  while (b64.length % 4 !== 0) b64 += '=';

  let compressed;
  try {
    compressed = Buffer.from(b64, 'base64');
  } catch {
    throw new Error('Input is not valid base64');
  }

  if (compressed.length === 0) throw new Error('Decoded payload was empty');

  // Try version-byte-skipped variants first (modern PoB prepends 0x01/0x02).
  const attempts = [
    () => zlib.inflateSync(compressed.subarray(1)),
    () => zlib.inflateRawSync(compressed.subarray(1)),
    () => zlib.inflateSync(compressed),
    () => zlib.inflateRawSync(compressed),
    () => zlib.gunzipSync(compressed),
  ];

  let xml;
  let lastErr;
  for (const attempt of attempts) {
    try {
      xml = attempt().toString('utf8');
      break;
    } catch (err) {
      lastErr = err;
    }
  }

  if (!xml) {
    throw new Error(
      `Could not decompress PoB code (not a valid PoB export?): ${lastErr?.message ?? 'unknown error'}`
    );
  }

  if (!xml.includes('<PathOfBuilding')) {
    throw new Error('Decompressed data does not look like a PoB build');
  }

  return xml;
}

const ALWAYS_ARRAYS = new Set([
  'PlayerStat', 'Spec', 'SkillSet', 'Skill', 'Gem',
  'ItemSet', 'Slot', 'SocketIdURL', 'Item',
]);

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  allowBooleanAttributes: true,
  parseAttributeValue: true,
  parseTagValue: true,
  trimValues: true,
  isArray: (name) => ALWAYS_ARRAYS.has(name),
});

/**
 * Return available SkillSets, ItemSets and Tree Specs from a PoB XML string.
 * Used by /api/inspect so the UI can show set selectors before converting.
 */
export function getAvailableSets(xml) {
  const doc = parser.parse(xml);
  const root = doc.PathOfBuilding2 ?? doc.PathOfBuilding;
  if (!root) return { skillSets: [], itemSets: [], treeSpecs: [], meta: {} };

  const buildEl = root.Build;
  const meta = buildEl ? {
    level: num(buildEl['@_level']),
    className: str(buildEl['@_className']),
    ascendClassName: str(buildEl['@_ascendClassName']),
  } : {};

  const skillSets = asArray(root.Skills?.SkillSet).map((s, i) => ({
    id: num(s['@_id']) || i + 1,
    title: str(s['@_title']) || `Skill Set ${i + 1}`,
  }));

  const itemSets = asArray(root.Items?.ItemSet).map((s, i) => ({
    id: num(s['@_id']) || i + 1,
    title: str(s['@_title']) || `Item Set ${i + 1}`,
  }));

  const treeSpecs = asArray(root.Tree?.Spec).map((s, i) => ({
    index: i,
    title: str(s['@_title']) || `Spec ${i + 1}`,
    treeVersion: str(s['@_treeVersion']),
  }));

  return { meta, skillSets, itemSets, treeSpecs };
}

/**
 * Parse PoB XML into a normalized build object.
 * Supports both <PathOfBuilding2> (PoB2) and <PathOfBuilding> (PoB1) roots.
 * @param {string} xml
 * @param {{ skillSetId?: number, itemSetId?: number, specIndex?: number }} opts
 */
export function parsePobXml(xml, { skillSetId, itemSetId, specIndex } = {}) {
  const doc = parser.parse(xml);
  // PoB2 exports use <PathOfBuilding2>; PoB1 uses <PathOfBuilding>
  const root = doc.PathOfBuilding2 ?? doc.PathOfBuilding;
  if (!root) throw new Error('Expected <PathOfBuilding2> root element');

  const buildEl = root.Build;
  if (!buildEl) throw new Error('Expected <Build> element under root');

  const tree = parseTree(root.Tree, specIndex);
  const meta = parseBuildMeta(buildEl);
  enrichMetaFromTree(meta, tree);

  return {
    meta,
    skills: parseSkills(root.Skills, skillSetId),
    tree,
    items: parseItems(root.Items, itemSetId),
    notes: extractNotes(root),
  };
}

function parseBuildMeta(b) {
  return {
    level: num(b['@_level']),
    className: str(b['@_className']),
    ascendClassName: str(b['@_ascendClassName']),
    ascendClassId: num(b['@_ascendClassId']),
    ascendancyInternalId: str(b['@_ascendancyInternalId']),
    classId: num(b['@_classId']),
    mainSocketGroup: num(b['@_mainSocketGroup']),
    targetVersion: str(b['@_targetVersion']),
    viewMode: str(b['@_viewMode']),
  };
}

function enrichMetaFromTree(meta, tree) {
  const specs = tree?.specs ?? [];
  const active = tree?.activeSpec ?? specs.find((s) => s.ascendancyInternalId || s.ascendClassId || s.classId);
  if (!active) return meta;

  if (!meta.ascendancyInternalId && active.ascendancyInternalId) {
    meta.ascendancyInternalId = active.ascendancyInternalId;
  }
  if (!meta.ascendClassId && active.ascendClassId) {
    meta.ascendClassId = active.ascendClassId;
  }
  if (!meta.classId && active.classId) {
    meta.classId = active.classId;
  }

  return meta;
}

function parseSkills(skills, targetId) {
  if (!skills) return [];

  const activeId = targetId ?? num(skills['@_activeSkillSet']) ?? 1;
  const sets = asArray(skills.SkillSet);

  let skillNodes;
  if (sets.length) {
    const active =
      sets.find((s) => num(s['@_id']) === activeId) ??
      sets[activeId - 1] ??
      sets[0];
    skillNodes = asArray(active.Skill);
  } else {
    skillNodes = asArray(skills.Skill);
  }

  return skillNodes
    .map((skill) => {
      const gems = asArray(skill.Gem).map(parseGem);
      return {
        slot: str(skill['@_slot']) || undefined,
        enabled: skill['@_enabled'] !== false && skill['@_enabled'] !== 'false',
        gems,
        actives: gems.filter((g) => !g.isSupport),
        supports: gems.filter((g) => g.isSupport),
        allGems: gems,
        additional_text: str(skill['@_additional_text'] || skill['@_additionalText'] || skill['@_comment'] || skill['@_description']) || undefined,
        level_interval: parseXmlLevelInterval(skill['@_level_interval'] || skill['@_levelInterval']),
      };
    })
    .filter((g) => g.allGems.length > 0);
}

function parseXmlLevelInterval(val) {
  if (!val) return undefined;
  if (Array.isArray(val)) return val;
  try {
    const parsed = JSON.parse(String(val));
    if (Array.isArray(parsed)) return parsed;
  } catch {}
  return undefined;
}

function parseGem(gem) {
  const gemId = str(gem['@_gemId']);
  const nameSpec = str(gem['@_nameSpec']);
  const skillId = str(gem['@_skillId']);
  const isSupport =
    gem['@_support'] === true ||
    gem['@_support'] === 'true' ||
    /support/i.test(skillId) ||
    /\bsupport\b/i.test(nameSpec);

  return {
    gemId,      // GGG metadata path — use directly in .build output
    variantId: str(gem['@_variantId']),
    nameSpec,
    skillId,
    level: resolveGemLevel(num(gem['@_level']), nameSpec, skillId, gemId, { preferNameSuffix: isSupport }),
    quality: num(gem['@_quality']) || 0,
    enabled: gem['@_enabled'] !== false && gem['@_enabled'] !== 'false',
    isSupport,
    additional_text: str(gem['@_additional_text'] || gem['@_additionalText'] || gem['@_comment'] || gem['@_description']) || undefined,
    level_interval: parseXmlLevelInterval(gem['@_level_interval'] || gem['@_levelInterval']),
  };
}

function parseTree(tree, targetSpecIndex) {
  if (!tree) return { nodes: [], specs: [] };

  const specs = asArray(tree.Spec).map((spec) => {
    const mainNodes = parseNodeList(spec['@_nodes']);
    const extraNodes = collectSpecNodeFields(spec).filter((nodeId) => !mainNodes.includes(nodeId));
    const ascendancyNodes = uniqueNums(extraNodes);
    const nodes = uniqueNums(mainNodes);

    return {
      treeVersion: str(spec['@_treeVersion']),
      ascendClassId: num(spec['@_ascendClassId']),
      ascendancyInternalId: str(spec['@_ascendancyInternalId']),
      classId: num(spec['@_classId']),
      mainNodes,
      ascendancyNodes,
      nodes,
    };
  });

  const activeSpecIndex = targetSpecIndex != null
    ? targetSpecIndex
    : (num(tree['@_activeSpec']) > 0 ? num(tree['@_activeSpec']) - 1 : undefined);
  const active = (activeSpecIndex != null ? specs[activeSpecIndex] : null) ?? specs[0] ?? { nodes: [] };
  return { nodes: active.nodes, specs, activeSpec: active };
}

function parseNodeList(value) {
  if (value == null || value === '') return [];
  const values = Array.isArray(value) ? value : String(value).split(/[,\s;|]+/);
  return values
    .map((n) => parseInt(String(n).trim(), 10))
    .filter((n) => Number.isInteger(n));
}

function collectSpecNodeFields(value, path = '') {
  if (value == null) return [];

  if (Array.isArray(value)) {
    return value.flatMap((entry) => collectSpecNodeFields(entry, path));
  }

  if (typeof value !== 'object') {
    return /node/i.test(path) ? parseNodeList(value) : [];
  }

  const out = [];
  for (const [key, child] of Object.entries(value)) {
    const cleanKey = key.replace(/^@_/, '');
    const childPath = path ? `${path}.${cleanKey}` : cleanKey;
    if (cleanKey === 'nodes') continue;

    if (/node/i.test(childPath)) {
      out.push(...parseNodeList(child));
      if (child && typeof child === 'object') {
        out.push(...parseNodeList(child['@_id']));
        out.push(...parseNodeList(child['@_nodeId']));
        out.push(...parseNodeList(child['@_hash']));
      }
    }

    if (child && typeof child === 'object') {
      out.push(...collectSpecNodeFields(child, childPath));
    }
  }

  return uniqueNums(out);
}

function uniqueNums(values) {
  return [...new Set(values.filter((n) => Number.isInteger(n)))];
}

function parseItems(items, targetId) {
  if (!items) return { list: [], slots: [] };

  const catalog = {};
  for (const raw of asArray(items.Item)) {
    const id = num(raw['@_id']);
    if (id > 0) catalog[String(id)] = parsePobItem(raw, id);
  }

  const activeId = targetId ?? num(items['@_activeItemSet']) ?? 1;
  const sets = asArray(items.ItemSet);
  let slotNodes = [];
  if (sets.length) {
    const active =
      sets.find((s) => num(s['@_id']) === activeId) ??
      sets[activeId - 1] ??
      sets[0];
    slotNodes = asArray(active.Slot);
  } else {
    slotNodes = asArray(items.Slot);
  }

  const slots = slotNodes
    .map((s) => ({ name: str(s['@_name']), itemId: String(num(s['@_itemId'])) }))
    .filter((s) => s.name && s.itemId !== '0');

  // Convert catalog to list for backward compat
  const list = Object.values(catalog);

  return { list, slots, catalog };
}

function parsePobItem(raw, id) {
  const text =
    typeof raw === 'string' ? raw : str(raw['#text']);
const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);

  let rarity = '', name = '', typeLine = '';
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('Rarity:')) {
      rarity = lines[i].slice('Rarity:'.length).trim();
      if (i + 1 < lines.length) name = lines[i + 1];
      if (i + 2 < lines.length && looksLikeBaseType(lines[i + 2])) {
        typeLine = lines[i + 2];
      }
      break;
    }
  }

  const isUnique = rarity.toUpperCase() === 'UNIQUE';
  const { implicits, explicits } = parseItemMods(lines);
  return {
    id: String(id),
    rarity,
    name,
    typeLine,
    isUnique,
    uniqueName: isUnique ? name : undefined,
    implicits,
    explicits,
    runes: parseRuneNames(lines),
    raw: text,
  };
}

// Lines matching these are metadata, not mods
const META_LINE = /^(Rarity|Quality|Sockets?|Item Level|Requirements|Str|Dex|Int|Level|Armour|Evasion|Energy Shield|Ward|Chaos Resistance|Radius|Limited to|Lore|Unique ID|LevelReq|Rune|Implicits)\s*:/i;
const SKIP_LINE = /^(Corrupted|Mirrored|Split|Fractured Item|Synthesised Item|Unidentified|Superior|-{3,})$/i;
// Strip PoB tag prefixes like {crafted}, {fractured}{rune}, {enchant}{rune} etc.
const MOD_TAG = /^\{[^}]+\}(\{[^}]+\})*/;

function parseItemMods(lines) {
  // Find the "Implicits: N" line — everything after it is mods
  let implicitCount = 0;
  let implicitIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^Implicits:\s*(\d+)/i);
    if (m) { implicitCount = parseInt(m[1], 10); implicitIdx = i; break; }
  }

  const implicits = [];
  const explicits = [];

  if (implicitIdx < 0) return { implicits, explicits };

  const modLines = lines.slice(implicitIdx + 1);
  let modCount = 0;
  for (const line of modLines) {
    if (META_LINE.test(line) || SKIP_LINE.test(line)) continue;
    const cleaned = line.replace(MOD_TAG, '').trim();
    if (!cleaned) continue;
    if (modCount < implicitCount) implicits.push(cleaned);
    else explicits.push(cleaned);
    modCount++;
  }

  return { implicits, explicits };
}

function parseRuneNames(lines) {
  return lines
    .map((line) => line.match(/^Rune:\s*(.+)$/i)?.[1]?.trim())
    .filter(Boolean);
}

function looksLikeBaseType(line) {
  if (line.startsWith('-')) return false;
  if (line.includes(': ')) return false;
  return true;
}

function extractNotes(root) {
  const notes = root.Notes;
  if (typeof notes === 'string') return notes.trim();
  if (notes && typeof notes === 'object') {
    const text = notes['#text'];
    return typeof text === 'string' ? text.trim() : '';
  }
  return '';
}

function asArray(v) {
  if (v === undefined || v === null) return [];
  return Array.isArray(v) ? v : [v];
}

function num(v, fallback = 0) {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    const n = Number(v);
    return isNaN(n) ? fallback : n;
  }
  return fallback;
}

function str(v, fallback = '') {
  return v == null ? fallback : String(v);
}
