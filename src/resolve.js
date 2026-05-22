import { decodePobCode, parsePobXml, getAvailableSets } from './pobParser.js';
import { isPobbinUrl, fetchPobbinCode } from './pobbin.js';
import { isMobalyticsUrl, fetchMobalyticsData } from './mobalytics.js';
import { convertToBuild } from './converter.js';

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

  if (detected === 'mobalytics') {
    const build = await fetchMobalyticsData(input);
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

  // Only PoB-format inputs have multiple sets; others get empty arrays.
  if (detected === 'mobalytics' || detected === 'json') {
    return { skillSets: [], itemSets: [], treeSpecs: [], meta: {} };
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
  if (isMobalyticsUrl(input)) return 'mobalytics';
  if (isPobbinUrl(input)) return 'pobbin';
  if (/^https?:\/\//i.test(input)) {
    throw new Error(
      'Unrecognized URL. Supported sources: pobb.in, mobalytics.gg/poe-2'
    );
  }
  if (input.startsWith('<') && input.includes('PathOfBuilding')) return 'xml';
  if (input.startsWith('{') || input.startsWith('[')) return 'json';
  return 'pobcode';
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
    meta: obj.meta ?? {},
    skills: obj.skills ?? [],
    tree: obj.tree ?? { nodes: [], specs: [] },
    items: obj.items ?? { list: [], slots: [] },
    notes: obj.notes ?? '',
  };
}

/**
 * One-shot: resolve + convert. Returns { build, report, source }.
 */
export async function resolveAndConvert(rawInput, opts = {}) {
  const { build, source } = await resolveInput(rawInput, opts);
  const { build: out, report } = convertToBuild(build, opts);
  return { build: out, report, source };
}
