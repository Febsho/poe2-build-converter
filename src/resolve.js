import { decodePobCode, parsePobXml, getAvailableSets } from './pobParser.js';
import { isPobbinUrl, fetchPobbinCode } from './pobbin.js';
import { isMobalyticsUrl, fetchMobalyticsData, inspectMobalyticsUrl } from './mobalytics.js';
import { isMaxrollUrl, fetchMaxrollData, inspectMaxrollUrl } from './maxroll.js';
import { isPoeNinjaUrl, fetchPoeNinjaData, inspectPoeNinjaUrl } from './poeninja.js';
import { convertToBuild } from './converter.js';
import { parseItem } from './lib/poe2/itemTextParser.ts';

/**
 * Resolve any supported input into a normalized PoB build object.
 *
 * Supported input kinds (auto-detected, can be forced via `kind`):
 *   - 'pobbin'      : a pobb.in URL  -> fetch raw code, then decode
 *   - 'mobalytics'  : a mobalytics.gg/poe-2 URL -> scrape build data
 *   - 'pobcode'     : a PoB export code (base64) -> decode
 *   - 'xml'         : raw PoB XML
 *   - 'json'        : an already-normalized build object (advanced/manual)
 *
 * Set selection opts: { skillSetId, itemSetId, specIndex }
 */
export async function resolveInput(rawInput, { kind = 'auto', skillSetId, itemSetId, specIndex } = {}) {
  const input = (rawInput ?? '').trim();
  if (!input) throw new Error('No input provided');

  const detected = kind === 'auto' ? detectKind(input) : kind;
  const source = { kind: detected };
  const setOpts = { skillSetId, itemSetId, specIndex };

  if (detected === 'poe2item') {
    const parsed = parseItem(input);
    const list = [{
      id: 'pasted_item',
      name: parsed.name || parsed.baseType || 'Pasted Item',
      typeLine: parsed.baseType || '',
      rarity: parsed.rarity || 'Normal',
      implicits: parsed.implicits.map(m => m.raw),
      explicits: parsed.explicits.map(m => m.raw),
      runes: parsed.runes,
      soulCores: parsed.soulCores,
      parserProblems: parsed.unknownLines,
    }];
    const slotName = getSlotNameFromItemClass(parsed.itemClass);
    const slots = [{ name: slotName, itemId: 'pasted_item' }];

    const build = {
      name: parsed.name || parsed.baseType || 'Pasted Item',
      items: { list, slots },
      meta: {
        className: 'Witch',
        level: parsed.requirements.level || 1,
        parserProblems: parsed.unknownLines,
      }
    };
    return { build, source: { kind: 'poe2item', name: parsed.name || parsed.baseType || 'Pasted Item' } };
  }

  if (detected === 'mobalytics') {
    const { build, sourceName } = await fetchMobalyticsData(input, setOpts);
    if (sourceName) source.name = sourceName;
    return { build, source };
  }

  if (detected === 'maxroll') {
    const { build, sourceName } = await fetchMaxrollData(input, setOpts);
    if (sourceName) source.name = sourceName;
    return { build, source };
  }

  if (detected === 'poeninja') {
    const { build, sourceName } = await fetchPoeNinjaData(input, setOpts);
    if (sourceName) source.name = sourceName;
    return { build, source };
  }

  if (detected === 'pobbin') {
    const code = await fetchPobbinCode(input);
    source.fetchedCode = true;
    const xml = decodePobCode(code);
    return { build: parsePobXml(xml, setOpts), source };
  }

  if (detected === 'xml') {
    return { build: parsePobXml(input, setOpts), source };
  }

  if (detected === 'json') {
    return { build: normalizeJsonInput(JSON.parse(input)), source };
  }

  // default: treat as a PoB export code
  const xml = decodePobCode(input);
  return { build: parsePobXml(xml, setOpts), source };
}

/**
 * Inspect a PoB input without converting — returns available SkillSets,
 * ItemSets, and Tree Specs so the UI can show selectors before converting.
 */
export async function inspectInput(rawInput, { kind = 'auto' } = {}) {
  const input = (rawInput ?? '').trim();
  if (!input) throw new Error('No input provided');

  const detected = kind === 'auto' ? detectKind(input) : kind;

  if (detected === 'json') {
    return { skillSets: [], itemSets: [], treeSpecs: [], meta: {} };
  }

  if (detected === 'mobalytics') {
    return inspectMobalyticsUrl(input);
  }

  if (detected === 'maxroll') {
    return inspectMaxrollUrl(input);
  }

  if (detected === 'poeninja') {
    return inspectPoeNinjaUrl();
  }

  let xml;
  if (detected === 'pobbin') {
    const code = await fetchPobbinCode(input);
    xml = decodePobCode(code);
  } else if (detected === 'xml') {
    xml = input;
  } else {
    xml = decodePobCode(input);
  }

  return getAvailableSets(xml);
}

function detectKind(input) {
  if (input.startsWith('Item Class:') || input.startsWith('Rarity:') || /^Rarity:\s*(Normal|Magic|Rare|Unique)/mi.test(input)) {
    return 'poe2item';
  }
  if (isMobalyticsUrl(input)) return 'mobalytics';
  if (isMaxrollUrl(input)) return 'maxroll';
  if (isPoeNinjaUrl(input)) return 'poeninja';
  if (isPobbinUrl(input)) return 'pobbin';
  if (/^https?:\/\//i.test(input)) {
    throw new Error(
      'Unrecognized URL. Supported sources: pobb.in, mobalytics.gg/poe-2, maxroll.gg/poe2, poe.ninja/builds?accountName=…&characterName=…'
    );
  }
  if (input.startsWith('<') && input.includes('PathOfBuilding')) return 'xml';
  if (input.startsWith('{') || input.startsWith('[')) return 'json';
  return 'pobcode';
}

function getSlotNameFromItemClass(itemClass) {
  if (!itemClass) return 'BodyArmour';
  const cls = itemClass.toLowerCase();
  if (cls.includes('body armour') || cls.includes('body armours')) return 'BodyArmour';
  if (cls.includes('helmet') || cls.includes('helmets')) return 'Helmet';
  if (cls.includes('glove') || cls.includes('gloves')) return 'Gloves';
  if (cls.includes('boot') || cls.includes('boots')) return 'Boots';
  if (cls.includes('shield') || cls.includes('focus') || cls.includes('buckler') || cls.includes('shields') || cls.includes('foci') || cls.includes('bucklers')) return 'Offhand';
  if (cls.includes('quiver') || cls.includes('quivers')) return 'Offhand';
  if (cls.includes('ring') || cls.includes('rings')) return 'Ring 1';
  if (cls.includes('amulet') || cls.includes('amulets')) return 'Amulet';
  if (cls.includes('belt') || cls.includes('belts')) return 'Belt';
  if (
    cls.includes('wand') || cls.includes('wands') ||
    cls.includes('bow') || cls.includes('bows') ||
    cls.includes('staff') || cls.includes('staves') ||
    cls.includes('quarterstaff') || cls.includes('quarterstaves') ||
    cls.includes('crossbow') || cls.includes('crossbows') ||
    cls.includes('spear') || cls.includes('spears') ||
    cls.includes('mace') || cls.includes('maces') ||
    cls.includes('sceptre') || cls.includes('sceptres')
  ) {
    return 'Weapon 1';
  }
  return 'BodyArmour';
}

/**
 * Allow advanced users to pass an already-normalized build object directly.
 * We accept the same shape parsePobXml produces and fill in missing keys.
 */
function normalizeJsonInput(obj) {
  if (Array.isArray(obj)) {
    throw new Error('Expected a build object, got an array');
  }
  return {
    name: obj.name ?? undefined,
    description: obj.description ?? undefined,
    ascendancy: obj.ascendancy ?? undefined,
    meta: obj.meta ?? {},
    skills: obj.skills ?? [],
    passives: obj.passives ?? undefined, // Carry GGG passives forward if present
    tree: obj.tree ?? { nodes: [], specs: [] },
    items: Array.isArray(obj.items) ? obj.items : (obj.items ?? { list: [], slots: [] }),
    notes: obj.notes ?? '',
  };
}

/**
 * One-shot: resolve + convert. Returns { build, report, source }.
 */
export async function resolveAndConvert(rawInput, opts = {}) {
  const { build, source } = await resolveInput(rawInput, opts);
  const { build: out, report } = convertToBuild(build, { ...opts, sourceName: source.name });
  return { build: out, report, source, normalizedBuild: build };
}
