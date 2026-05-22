import { decodePobCode, parsePobXml } from './pobParser.js';
import { isPobbinUrl, fetchPobbinCode } from './pobbin.js';
import { convertToBuild } from './converter.js';

/**
 * Resolve any supported input into a normalized PoB build object.
 *
 * Supported input kinds (auto-detected, can be forced via `kind`):
 *   - 'pobbin'   : a pobb.in URL  -> fetch raw code, then decode
 *   - 'pobcode'  : a PoB export code (base64) -> decode
 *   - 'xml'      : raw PoB XML
 *   - 'json'     : an already-normalized build object (advanced/manual)
 */
export async function resolveInput(rawInput, { kind = 'auto' } = {}) {
  const input = (rawInput ?? '').trim();
  if (!input) throw new Error('No input provided');

  const detected = kind === 'auto' ? detectKind(input) : kind;
  const source = { kind: detected };

  if (detected === 'pobbin') {
    const code = await fetchPobbinCode(input);
    source.fetchedCode = true;
    const xml = decodePobCode(code);
    return { build: parsePobXml(xml), source };
  }

  if (detected === 'xml') {
    return { build: parsePobXml(input), source };
  }

  if (detected === 'json') {
    return { build: normalizeJsonInput(JSON.parse(input)), source };
  }

  // default: treat as a PoB export code
  const xml = decodePobCode(input);
  return { build: parsePobXml(xml), source };
}

function detectKind(input) {
  if (isPobbinUrl(input)) return 'pobbin';
  if (/^https?:\/\//i.test(input)) return 'pobbin'; // try as paste host anyway
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
  return { build: out, report, source, parsed: build };
}
