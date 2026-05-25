import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '../../../..');
const treePath = path.join(rootDir, 'public', 'tree-data.json');

const CLASS_START_NAME = {
  Warrior: 'MARAUDER',
  Ranger: 'RANGER',
  Witch: 'WITCH',
  Sorceress: 'WITCH',
  Mercenary: 'DUELIST',
  Monk: 'TEMPLAR',
  Druid: 'TEMPLAR',
  Huntress: 'RANGER',
};

let treeCache = null;

export function getAiPassiveTreeData() {
  if (treeCache) return treeCache;

  const tree = JSON.parse(readFileSync(treePath, 'utf8'));
  const nodes = tree.nodes || {};
  const sidToHash = new Map();
  const hashToSid = new Map();
  const adjacency = new Map();

  const ensure = (hash) => {
    if (!adjacency.has(hash)) adjacency.set(hash, new Set());
    return adjacency.get(hash);
  };

  for (const [hash, node] of Object.entries(nodes)) {
    ensure(hash);
    if (node.sid) {
      sidToHash.set(node.sid, hash);
      hashToSid.set(hash, node.sid);
    }
  }

  for (const [hash, node] of Object.entries(nodes)) {
    for (const connected of node.c || []) {
      if (!nodes[connected]) continue;
      ensure(hash).add(connected);
      ensure(connected).add(hash);
    }
  }

  treeCache = { nodes, sidToHash, hashToSid, adjacency };
  return treeCache;
}

export function repairAiBuildPassives(build, options = {}) {
  const passives = Array.isArray(build?.passives) ? build.passives : [];
  if (!passives.length) return { build, warnings: [], stats: emptyStats() };

  const result = buildConnectedPassiveIds(passives, {
    className: build.class,
    ascendancy: build.ascendancy,
    maxMain: options.maxMain ?? 112,
    maxAscendancy: options.maxAscendancy ?? 8,
  });

  if (!result.passives.length) {
    const warnings = ['No generated passive IDs could be mapped to the PoB2 passive tree data.'];
    return {
      build: appendWarnings(build, warnings),
      warnings,
      stats: result.stats,
    };
  }

  const warnings = [];
  if (result.stats.connectorCount > 0 || result.stats.omittedCount > 0 || result.stats.ascendancyOmittedCount > 0) {
    warnings.push(
      `Passive tree rebuilt with PathOfBuilding-PoE2 graph data: ${result.stats.mappedCount} AI targets mapped to ${result.stats.outputCount} connected nodes; ${result.stats.omittedCount + result.stats.ascendancyOmittedCount} unreachable or over-budget targets omitted.`
    );
  }

  return {
    build: appendWarnings({ ...build, passives: result.passives }, warnings),
    warnings,
    stats: result.stats,
  };
}

export function buildConnectedPassiveIds(passiveInputs, options = {}) {
  const data = getAiPassiveTreeData();
  const mapped = passiveInputs
    .map((input, index) => ({ hash: passiveInputToHash(input, data), index }))
    .filter((entry) => entry.hash && data.nodes[entry.hash]);

  const uniqueMapped = dedupeBy(mapped, (entry) => entry.hash);
  const ascendancyName = normalize(options.ascendancy);
  const mainTargets = uniqueMapped.filter(({ hash }) => isMainTreeNode(hash, data));
  const ascTargets = uniqueMapped.filter(({ hash }) => {
    const node = data.nodes[hash];
    if (!node?.a) return false;
    return !ascendancyName || normalize(node.a) === ascendancyName;
  });

  const main = connectTargets(mainTargets, {
    data,
    start: findClassStartHash(options.className, data),
    max: options.maxMain ?? 112,
    allow: (hash) => isMainTreeNode(hash, data) || hash === findClassStartHash(options.className, data),
  });

  const asc = connectTargets(ascTargets, {
    data,
    start: findAscendancyStartHash(options.ascendancy, data),
    max: options.maxAscendancy ?? 8,
    allow: (hash) => {
      const node = data.nodes[hash];
      return !!node?.a && (!ascendancyName || normalize(node.a) === ascendancyName);
    },
  });

  const passives = [...main.hashes, ...asc.hashes]
    .map((hash) => hashToPassiveId(hash, data))
    .filter(Boolean);

  return {
    passives,
    stats: {
      mappedCount: uniqueMapped.length,
      mainTargetCount: mainTargets.length,
      ascendancyTargetCount: ascTargets.length,
      outputCount: passives.length,
      connectorCount: main.connectorCount + asc.connectorCount,
      omittedCount: main.omittedCount,
      ascendancyOmittedCount: asc.omittedCount,
    },
  };
}

export function arePassiveIdsConnected(passiveInputs, options = {}) {
  const data = getAiPassiveTreeData();
  const hashes = passiveInputs
    .map((input) => passiveInputToHash(input, data))
    .filter((hash) => hash && data.nodes[hash]);
  if (hashes.length <= 1) return true;

  const checkAsc = normalize(options.ascendancy);
  const groups = new Map();
  for (const hash of hashes) {
    const node = data.nodes[hash];
    if (node.a && checkAsc && normalize(node.a) !== checkAsc) continue;
    const key = node.a ? `asc:${normalize(node.a)}` : 'main';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(hash);
  }

  return [...groups.entries()].every(([key, group]) => {
    const implicitStart = key === 'main'
      ? findClassStartHash(options.className, data)
      : findAscendancyStartHash(key.slice(4), data);
    return isInducedGroupConnected(group, data, implicitStart);
  });
}

function isInducedGroupConnected(group, data, implicitStart = null) {
  if (group.length <= 1) return true;
  const allowed = new Set(group);
  if (implicitStart) allowed.add(implicitStart);
  const visited = new Set();
  const first = implicitStart || group[0];
  const queue = [first];
  visited.add(first);

  while (queue.length) {
    const hash = queue.shift();
    for (const next of data.adjacency.get(hash) || []) {
      if (!allowed.has(next) || visited.has(next)) continue;
      visited.add(next);
      queue.push(next);
    }
  }

  return group.every((hash) => visited.has(hash));
}

function connectTargets(targets, { data, start, max, allow }) {
  const result = [];
  const selected = new Set();
  let connectorCount = 0;
  let omittedCount = 0;

  const distanceFromStart = start ? shortestDistances(start, data, allow) : new Map();
  const ordered = [...targets].sort((a, b) => {
    const da = distanceFromStart.get(a.hash) ?? Number.MAX_SAFE_INTEGER;
    const db = distanceFromStart.get(b.hash) ?? Number.MAX_SAFE_INTEGER;
    return da - db || a.index - b.index;
  });

  if (start && data.nodes[start] && allow(start)) {
    selected.add(start);
  } else if (ordered[0]) {
    selected.add(ordered[0].hash);
  }

  for (const target of ordered) {
    if (selected.has(target.hash)) {
      maybeAddAllocated(target.hash, result, data, max);
      continue;
    }

    const path = shortestPathFromSet(selected, target.hash, data, allow);
    if (!path) {
      omittedCount += 1;
      continue;
    }

    const newAllocated = path.filter((hash) => shouldExportNode(hash, data) && !result.includes(hash));
    if (result.length + newAllocated.length > max) {
      omittedCount += 1;
      continue;
    }

    for (const hash of path) selected.add(hash);
    for (const hash of newAllocated) {
      if (hash !== target.hash) connectorCount += 1;
      result.push(hash);
    }
  }

  return { hashes: result, connectorCount, omittedCount };
}

function shortestPathFromSet(startSet, target, data, allow) {
  if (!target || !allow(target)) return null;
  const queue = [];
  const previous = new Map();
  const visited = new Set();

  for (const start of startSet) {
    if (!allow(start)) continue;
    if (start === target) return [target];
    visited.add(start);
    previous.set(start, null);
    queue.push(start);
  }

  while (queue.length) {
    const hash = queue.shift();
    for (const next of data.adjacency.get(hash) || []) {
      if (!allow(next) || visited.has(next)) continue;
      visited.add(next);
      previous.set(next, hash);
      if (next === target) return unwindPath(previous, target);
      queue.push(next);
    }
  }

  return null;
}

function shortestDistances(start, data, allow) {
  const distances = new Map();
  const queue = [start];
  distances.set(start, 0);

  while (queue.length) {
    const hash = queue.shift();
    const nextDistance = distances.get(hash) + 1;
    for (const next of data.adjacency.get(hash) || []) {
      if (!allow(next) || distances.has(next)) continue;
      distances.set(next, nextDistance);
      queue.push(next);
    }
  }

  return distances;
}

function unwindPath(previous, target) {
  const path = [];
  let current = target;
  while (current) {
    path.push(current);
    current = previous.get(current);
  }
  return path.reverse();
}

function maybeAddAllocated(hash, result, data, max) {
  if (!shouldExportNode(hash, data) || result.includes(hash) || result.length >= max) return;
  result.push(hash);
}

function passiveInputToHash(input, data) {
  const raw = typeof input === 'string' ? input : input?.id;
  if (raw === null || raw === undefined) return null;
  const id = String(raw).trim();
  if (!id) return null;
  if (data.nodes[id]) return id;
  return data.sidToHash.get(id) || null;
}

function hashToPassiveId(hash, data) {
  return data.hashToSid.get(hash) || null;
}

function shouldExportNode(hash, data) {
  const node = data.nodes[hash];
  return !!node?.sid && node.t !== 'start';
}

function isMainTreeNode(hash, data) {
  const node = data.nodes[hash];
  return !!node && !node.a && node.t !== 'jewel' && node.t !== 'start';
}

function findClassStartHash(className, data) {
  const startName = CLASS_START_NAME[className] || String(className || '').toUpperCase();
  const entry = Object.entries(data.nodes).find(([, node]) => node.t === 'start' && node.n === startName);
  return entry?.[0] || null;
}

function findAscendancyStartHash(ascendancy, data) {
  const wanted = normalize(ascendancy);
  if (!wanted) return null;
  const exact = Object.entries(data.nodes).find(([, node]) =>
    node.a && normalize(node.a) === wanted && node.t === 'ascendancy' && normalize(node.n) === wanted
  );
  if (exact) return exact[0];
  const sidStart = Object.entries(data.nodes).find(([, node]) =>
    node.a && normalize(node.a) === wanted && String(node.sid || '').toLowerCase().endsWith('start')
  );
  return sidStart?.[0] || null;
}

function appendWarnings(build, warnings) {
  if (!warnings.length) return build;
  const existing = Array.isArray(build?.validationWarnings) ? build.validationWarnings : [];
  return { ...build, validationWarnings: [...existing, ...warnings] };
}

function dedupeBy(items, keyFn) {
  const seen = new Set();
  const out = [];
  for (const item of items) {
    const key = keyFn(item);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

function normalize(value) {
  return String(value || '').trim().toLowerCase();
}

function emptyStats() {
  return {
    mappedCount: 0,
    mainTargetCount: 0,
    ascendancyTargetCount: 0,
    outputCount: 0,
    connectorCount: 0,
    omittedCount: 0,
    ascendancyOmittedCount: 0,
  };
}
