/**
 * Fetches the PoE2 passive tree from the PathOfBuilding-PoE2 repository
 * (tree.lua — the canonical, correctly-positioned dataset).
 * Computes pixel positions for every passive node using the embedded orbit
 * geometry constants.  Output: public/tree-data.json (served statically).
 *
 * Usage: node scripts/tree-build.js
 *
 * Data source:
 *   https://github.com/PathOfBuildingCommunity/PathOfBuilding-PoE2
 *   src/TreeData/0_4/tree.lua  ← single authoritative source
 *     • groups: correct x/y game coordinates
 *     • nodes:  orbit, orbitIndex, connections, name, type flags
 *     • constants: orbitRadii, orbitAnglesByOrbit
 *
 * Note: tree.json in the same repo has WRONG group y-coordinates (different
 * coordinate system).  tree.lua is the pre-processed, correct version.
 */
import { writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));

const POB2_TREE_LUA_URL =
  'https://raw.githubusercontent.com/PathOfBuildingCommunity/PathOfBuilding-PoE2/dev/src/TreeData/0_4/tree.lua';

// ── Lua table parser ──────────────────────────────────────────────────────────
// Handles the specific subset of Lua used in PoB2's generated tree.lua files:
//   { key = value, [N] = value, ... }
// Converts 1-based consecutive-integer-keyed tables to 0-indexed JS arrays.
function parseLuaTable(lua) {
  let i = 0;
  const n = lua.length;

  function skipWs() {
    while (i < n) {
      const c = lua[i];
      if (c === '-' && lua[i + 1] === '-') {
        // Single-line comment → skip to end of line
        while (i < n && lua[i] !== '\n') i++;
      } else if (c === ' ' || c === '\t' || c === '\n' || c === '\r' || c === ',') {
        i++;
      } else {
        break;
      }
    }
  }

  function parseValue() {
    skipWs();
    if (i >= n) return null;
    const c = lua[i];
    if (c === '{') return parseTable();
    if (c === '"') return parseStr('"');
    if (c === "'") return parseStr("'");
    // Number or keyword (true / false / nil)
    const start = i;
    while (i < n && /[a-zA-Z0-9_.+\-]/.test(lua[i])) i++;
    const tok = lua.slice(start, i);
    if (tok === 'true')  return true;
    if (tok === 'false') return false;
    if (tok === 'nil')   return null;
    const num = +tok;
    return (!isNaN(num) && tok !== '') ? num : tok;
  }

  function parseStr(q) {
    i++; // skip opening quote
    let s = '';
    while (i < n && lua[i] !== q) {
      if (lua[i] === '\\') i++; // escape → take next char literally
      s += lua[i++];
    }
    i++; // skip closing quote
    return s;
  }

  function parseTable() {
    i++; // skip '{'
    const result = {};
    let isArr = true;  // true while all keys are consecutive 1-based integers
    let nextArr = 1;

    while (i < n) {
      skipWs();
      if (lua[i] === '}') { i++; break; }

      let key;
      if (lua[i] === '[') {
        // [expression] = value
        i++; // skip [
        key = parseValue();
        skipWs();
        i++; // skip ]
        skipWs();
        i++; // skip =
        if (typeof key !== 'number' || key !== nextArr) isArr = false;
        else nextArr++;
      } else if (/[a-zA-Z_]/.test(lua[i])) {
        // identifier = value
        const start = i;
        while (i < n && /[a-zA-Z0-9_]/.test(lua[i])) i++;
        key = lua.slice(start, i);
        skipWs();
        i++; // skip =
        isArr = false; // string keys → object, not array
      } else {
        i++; // unexpected char — skip
        continue;
      }

      result[key] = parseValue();
    }

    // Convert to 0-indexed JS array when all keys are 1, 2, 3, …
    if (isArr && nextArr > 1) {
      const arr = new Array(nextArr - 1);
      for (let k = 1; k < nextArr; k++) arr[k - 1] = result[k];
      return arr;
    }
    return result;
  }

  // Skip the leading "return " keyword
  skipWs();
  if (lua.startsWith('return', i)) i += 6;
  return parseValue();
}

async function fetchText(url) {
  console.log(`[tree-build] Fetching ${url.split('?')[0]}…`);
  const resp = await fetch(url, { signal: AbortSignal.timeout(60_000) });
  if (!resp.ok) throw new Error(`HTTP ${resp.status} from ${url}`);
  return resp.text();
}

async function run() {
  // Build hash → string ID map from bundled passives data
  const passives = require('../src/data/passives_default.json');
  const hashToStringId = {};
  for (const [hash, entry] of Object.entries(passives)) {
    if (entry?.id) hashToStringId[hash] = entry.id;
  }
  console.log(`[tree-build] Loaded ${Object.keys(hashToStringId).length} passive ID mappings`);

  // Fetch PoB2's canonical tree.lua (correct group coordinates + all node data)
  const luaText = await fetchText(POB2_TREE_LUA_URL);
  console.log(`[tree-build] Parsing tree.lua (${Math.round(luaText.length / 1024)} KB)…`);
  const treeData = parseLuaTable(luaText);

  const { groups, nodes: pobNodes, constants } = treeData;
  // orbitRadii / orbitAnglesByOrbit come out as 0-indexed JS arrays
  // (Lua uses 1-based indexing; our parser converts [1],[2],… → [0],[1],…)
  const { orbitRadii, orbitAnglesByOrbit } = constants;

  console.log(`[tree-build] groups: ${Object.keys(groups).length}  nodes: ${Object.keys(pobNodes).length}`);

  // Compute absolute (x, y) for every node
  const out = {};
  let skipped = 0;

  for (const [id, node] of Object.entries(pobNodes)) {
    const group = groups[node.group];
    if (!group) { skipped++; continue; }

    // PoB2 field names: orbit (index 0-based), orbitIndex (position 0-based)
    const orbit      = node.orbit      ?? 0;
    const orbitIndex = node.orbitIndex ?? 0;
    const r          = orbitRadii[orbit] ?? 0;
    const angle      = orbitAnglesByOrbit[orbit]?.[orbitIndex] ?? 0;

    const x = group.x + r * Math.sin(angle);
    const y = group.y - r * Math.cos(angle);

    // Determine node type from PoB2 flags
    let type = 'normal';
    if (node.isKeystone)          type = 'keystone';
    else if (node.isNotable)      type = 'notable';
    else if (node.isJewelSocket)  type = 'jewel';
    else if (node.ascendancyName) type = 'ascendancy';
    else if (node.classesStart?.length) type = 'start';

    // Connections: keep PoB's orbit metadata so the browser renderer can draw
    // the same straight vs orbit-arc connector shapes instead of guessing.
    const conns = Array.isArray(node.connections)
      ? node.connections
          .map(c => typeof c === 'object'
            ? { id: String(c.id), orbit: Number(c.orbit ?? 0) }
            : { id: String(c), orbit: 0 })
          .filter(c => c.id)
      : [];

    const name = node.name ?? '';
    const entry = {
      x:  Math.round(x),
      y:  Math.round(y),
      n:  name,
      t:  type,
      c:  conns.map(c => c.id),
      co: conns,
      // Group / orbit data for arc rendering in the tree viewer
      g:  String(node.group),
      gx: Math.round(group.x),
      gy: Math.round(group.y),
      o:  orbit,
      R:  Math.round(r),
    };

    if (node.ascendancyName)  entry.a    = node.ascendancyName;
    if (hashToStringId[id])   entry.sid  = hashToStringId[id];
    if (node.icon)            entry.icon = node.icon;
    if (node.stats)           entry.sd   = node.stats;
    if (node.classesStart)    entry.cs   = node.classesStart;

    out[id] = entry;
  }

  // Bounding boxes — full tree and main tree only (no ascendancy)
  const allVals  = Object.values(out);
  const mainVals = allVals.filter(v => !v.a);

  const bbox = vals => ({
    minX: Math.min(...vals.map(v => v.x)),
    maxX: Math.max(...vals.map(v => v.x)),
    minY: Math.min(...vals.map(v => v.y)),
    maxY: Math.max(...vals.map(v => v.y)),
  });

  const bounds     = bbox(allVals);
  const mainBounds = bbox(mainVals);

  const payload = {
    source: {
      name: 'PathOfBuildingCommunity/PathOfBuilding-PoE2',
      ref: 'dev',
      path: 'src/TreeData/0_4/tree.lua',
      url: POB2_TREE_LUA_URL,
    },
    constants: {
      orbitRadii,
      orbitAnglesByOrbit,
    },
    nodes: out,
    bounds,
    mainBounds,
  };
  const outPath = resolve(__dirname, '../public/tree-data.json');
  writeFileSync(outPath, JSON.stringify(payload));

  const kb = Math.round(JSON.stringify(payload).length / 1024);
  console.log(`[tree-build] ${Object.keys(out).length} nodes (${skipped} skipped) → tree-data.json (${kb} KB)`);
  console.log(`[tree-build] bounds: x [${bounds.minX}…${bounds.maxX}]  y [${bounds.minY}…${bounds.maxY}]`);
  console.log(`[tree-build] mainBounds: x [${mainBounds.minX}…${mainBounds.maxX}]  y [${mainBounds.minY}…${mainBounds.maxY}]`);
}

run().catch(err => { console.error('[tree-build] FAILED:', err.message); process.exit(1); });
