import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Real GGG passive and ascendancy data from poe2-build-forge
const PASSIVES = require('./data/passives_default.json');
const ASCENDANCIES = require('./data/ascendancies.json');
const TREE_DATA = require('../public/tree-data.json');

// Build a reverse map: ascendancy display name -> internal key (e.g. "Deadeye" -> "Ranger1")
const ASCENDANCY_BY_NAME = Object.fromEntries(
  Object.entries(ASCENDANCIES).map(([key, val]) => [val.name, key])
);
const ASCENDANCY_BY_PASSIVE_ID = Object.fromEntries(
  Object.values(PASSIVES)
    .filter((entry) => entry.id && entry.ascendancy)
    .map((entry) => [entry.id, entry.ascendancy])
);

const DEFAULT_LEVEL_INTERVAL = [0, 100];
const MAX_ASCENDANCY_PASSIVES = 8;
const ROMAN_SUPPORT_LEVELS = {
  I: 1,
  II: 2,
  III: 3,
  IV: 4,
  V: 5,
};
const WORD_SUPPORT_LEVELS = {
  One: 1,
  Two: 2,
  Three: 3,
  Four: 4,
  Five: 5,
};
const CLASS_BY_ID = {
  1: 'Warrior',
  2: 'Ranger',
  3: 'Witch',
  4: 'Mercenary',
  5: 'Monk',
  6: 'Sorceress',
  7: 'Druid',
  8: 'Huntress',
  9: 'Templar',
  10: 'Duelist',
  11: 'Shadow',
  12: 'Marauder',
};

/** Returns true if the interval is the implicit default [0, 100] (always-show). */
function isDefaultInterval(interval) {
  return Array.isArray(interval) && interval[0] === 0 && interval[1] === 100;
}

function normalizeLevelInterval(interval) {
  if (Array.isArray(interval) && interval.length === 2) {
    const start = Number(interval[0]);
    const end = Number(interval[1]);
    if (Number.isFinite(start) && Number.isFinite(end)) {
      return [start, end];
    }
  }
  return [...DEFAULT_LEVEL_INTERVAL];
}

/**
 * Build a level/quality annotation string for a gem.
 * Only includes non-trivial values (level > 1, quality > 0).
 */
function buildGemLevelText(gem) {
  if (!gem) return '';
  const parts = [];
  const level   = normalizeGemLevel(gem);
  const quality = Number(gem.quality);
  if (Number.isFinite(level)   && level   > 1) parts.push(`Level ${level}`);
  if (Number.isFinite(quality) && quality > 0) parts.push(`Quality ${quality}%`);
  return parts.join(' | ');
}

function normalizeGemLevel(gem) {
  const level = Number(gem?.level);
  if (!Number.isFinite(level) || level <= 0) return level;
  return Math.min(Math.floor(level), gemMaxLevel(gem?.gemId, gem?.support));
}

function gemMaxLevel(gemId, supportFlag = false) {
  const id = String(gemId ?? '');
  if (isSupportGemId(id)) return inferSupportGemMaxLevel(id);
  if (isSkillGemId(id)) return 20;
  return supportFlag ? 5 : 20;
}

function isSkillGemId(id) {
  return /(?:^|\/)SkillGem/i.test(String(id ?? ''));
}

function isSupportGemId(id) {
  return /(?:^|\/)SupportGem/i.test(String(id ?? ''));
}

function inferSupportGemMaxLevel(gemId) {
  const idPart = String(gemId ?? '').split('/').pop() ?? '';
  const numeric = idPart.match(/\b([1-5])\s*$/);
  if (numeric) return Number(numeric[1]);

  const roman = idPart.match(/\b(I|II|III|IV|V)\s*$/i);
  if (roman) return ROMAN_SUPPORT_LEVELS[roman[1].toUpperCase()] ?? 5;

  const word = idPart.match(/(One|Two|Three|Four|Five)$/);
  if (word) return WORD_SUPPORT_LEVELS[word[1]] ?? 5;

  return 5;
}

/**
 * Convert a normalized PoB build (from parsePobXml) into a PoE2 .build object
 * plus a classification report.
 */
export function convertToBuild(build, opts = {}) {
  const report = { converted: [], guessed: [], unsupported: [], warnings: [] };
  const out = {};

  if (build.meta?.parserProblems) {
    for (const problem of build.meta.parserProblems) {
      report.unsupported.push(`[Item Parser] ${problem}`);
    }
  }

  out.name = pickName(build, opts, report);
  out.description = buildDescription(build, opts);
  report.converted.push('description (generated from build metadata + notes)');

  const asc = convertAscendancy(build, report);
  if (asc) out.ascendancy = asc;

  const skills = convertSkills(build, report);
  if (skills.length) out.skills = skills;

  if (build.passives) {
    out.passives = build.passives.map(enrichBuildPassive);
    report.converted.push(`${build.passives.length} passives (kept as-is)`);
  } else {
    const passives = convertPassivesWithWeaponSets(build, report, asc);
    if (passives.length) out.passives = passives;
  }

  const items = convertItems(build, report);
  if (items.length) out.items = items;

  return { build: out, report };
}

function pickName(build, opts, report) {
  if (opts.name?.trim()) {
    report.converted.push('name (provided by user)');
    return opts.name.trim();
  }
  if (build.name?.trim()) {
    report.converted.push(`name (kept: "${build.name.trim()}")`);
    return build.name.trim();
  }
  if (opts.sourceName?.trim()) {
    const name = opts.sourceName.trim();
    report.converted.push(`name (from source page: "${name}")`);
    return name;
  }
  const cls = build.meta?.className;
  const asc = build.meta?.ascendClassName;
  const meaningful = asc && asc !== 'None';
  const name = meaningful ? `${cls} - ${asc}` : (cls || 'Imported Build');
  report.converted.push(`name (derived: "${name}")`);
  return name;
}

function buildDescription(build, opts) {
  if (opts.description?.trim()) return opts.description.trim();
  if (build.description?.trim()) return build.description.trim();
  const bits = ['Generated from PoB.'];
  const m = build.meta ?? {};
  if (m.className) bits.push(`Class: ${m.className}.`);
  if (m.level) bits.push(`Level: ${m.level}.`);
  if (build.notes) {
    const trimmed = build.notes.replace(/\s+/g, ' ').slice(0, 500);
    if (trimmed) bits.push(`Notes: ${trimmed}`);
  }
  return bits.join(' ');
}

function convertAscendancy(build, report) {
  if (build.ascendancy) {
    report.converted.push(`ascendancy "${build.ascendancy}" (kept as-is)`);
    return build.ascendancy;
  }
  const internal = pickDirectInternalAscendancy(build);
  if (internal) {
    report.converted.push(`ascendancy "${internal}" (from build tree)`);
    return internal;
  }
  const display = build.meta?.ascendClassName;
  if (!display || display === 'None') {
    const fromPassives = inferAscendancyFromPassives(build);
    if (fromPassives) {
      report.guessed.push(`ascendancy "${fromPassives}" inferred from selected ascendancy passives.`);
      return fromPassives;
    }

    const fromClassId = inferAscendancyFromClassId(build);
    if (fromClassId) {
      report.guessed.push(`ascendancy "${fromClassId}" inferred from class and ascendancy number.`);
      return fromClassId;
    }

    report.warnings.push('No ascendancy found in the build.');
    return undefined;
  }

  // Already an internal key (e.g. maxroll uses "Sorceress3" directly)
  if (ASCENDANCIES[display]) {
    report.converted.push(`ascendancy "${display}" (internal key, kept)`);
    return display;
  }

  // Try exact lookup: "Deadeye" -> "Ranger1"
  const key = ASCENDANCY_BY_NAME[display];
  if (key) {
    report.converted.push(`ascendancy "${display}" -> "${key}"`);
    return key;
  }

  // Try by className prefix + class_number fallback
  const cls = build.meta?.className;
  if (cls) {
    const match = Object.entries(ASCENDANCIES).find(
      ([k, v]) => k.startsWith(cls) && v.name === display
    );
    if (match) {
      report.converted.push(`ascendancy "${display}" -> "${match[0]}"`);
      return match[0];
    }
  }

  const fromPassives = inferAscendancyFromPassives(build);
  if (fromPassives) {
    report.guessed.push(`ascendancy "${fromPassives}" inferred from selected ascendancy passives.`);
    return fromPassives;
  }

  const fromClassId = inferAscendancyFromClassId(build);
  if (fromClassId) {
    report.guessed.push(`ascendancy "${fromClassId}" inferred from class and ascendancy number.`);
    return fromClassId;
  }

  report.guessed.push(`ascendancy "${display}" — could not map to internal key, passing display name through.`);
  return display;
}

function pickDirectInternalAscendancy(build) {
  const meta = build.meta ?? {};
  const specs = [
    build.tree?.activeSpec,
    ...(build.tree?.specs ?? []),
  ].filter(Boolean);

  const direct = [
    meta.ascendancy,
    meta.ascendancyId,
    meta.ascendancyInternalId,
    meta.ascendClassName,
    build.tree?.ascendancy,
    build.tree?.ascendancyInternalId,
    ...specs.map((spec) => spec.ascendancyInternalId),
  ].find((candidate) => candidate && ASCENDANCIES[candidate]);
  return direct;
}

function inferAscendancyFromClassId(build) {
  const meta = build.meta ?? {};
  const specs = [
    build.tree?.activeSpec,
    ...(build.tree?.specs ?? []),
  ].filter(Boolean);
  const classCandidates = [
    meta.className,
    CLASS_BY_ID[meta.classId],
    ...specs.flatMap((spec) => [spec.className, CLASS_BY_ID[spec.classId]]),
  ].filter(Boolean);

  const numberCandidates = [
    meta.ascendClassId,
    ...specs.map((spec) => spec.ascendClassId),
  ].filter((n) => Number.isFinite(Number(n)) && Number(n) > 0);

  for (const cls of classCandidates) {
    for (const number of numberCandidates) {
      const key = `${cls}${Number(number)}`;
      if (ASCENDANCIES[key]) return key;
    }
  }

  return undefined;
}

function inferAscendancyFromPassives(build) {
  const counts = new Map();
  const rawNodes = [
    ...(build.tree?.nodes ?? []),
    ...(build.tree?.weaponSet1Nodes ?? []),
    ...(build.tree?.weaponSet2Nodes ?? []),
    ...(build.tree?.activeSpec?.ascendancyNodes ?? []),
    ...(build.tree?.specs ?? []).flatMap((spec) => spec.nodes ?? []),
    ...(build.tree?.specs ?? []).flatMap((spec) => spec.ascendancyNodes ?? []),
  ];

  for (const nodeId of rawNodes) {
    const asc = PASSIVES[String(nodeId)]?.ascendancy;
    if (asc && ASCENDANCIES[asc]) counts.set(asc, (counts.get(asc) ?? 0) + 1);
  }

  for (const passive of build.passives ?? []) {
    const id = typeof passive === 'string' ? passive : passive?.id;
    if (!id) continue;
    const asc = ASCENDANCY_BY_PASSIVE_ID[id];
    if (asc && ASCENDANCIES[asc]) counts.set(asc, (counts.get(asc) ?? 0) + 1);
  }

  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
}

function convertSkills(build, report) {
  const groups = build.skills ?? [];
  if (!groups.length) {
    report.warnings.push('No skill gems found in the build.');
    return [];
  }

  const out = [];
  for (const group of groups) {
    if (!group) continue;

    // 1. If it's already a GGG BuildSkill object, pass it through
    if (typeof group === 'object' && 'id' in group && !('actives' in group)) {
      out.push(enrichBuildSkill(group));
      report.converted.push(`skill "${group.id}" (kept as-is)`);
      continue;
    }

    // 2. If it's a string, convert to minimal GGG BuildSkill object
    if (typeof group === 'string') {
      out.push({ id: group, level_interval: [...DEFAULT_LEVEL_INTERVAL], support_skills: [] });
      report.converted.push(`skill "${group}"`);
      continue;
    }

    if (!group.enabled) continue;

    const activeGems = (group.actives ?? []).filter((active) => active.enabled);
    if (!activeGems.length) continue;

    const primaryActive = activeGems.find((active) => active.gemId) ?? activeGems[0];
    if (!primaryActive.gemId) {
      report.unsupported.push(
        `skill "${primaryActive.nameSpec || 'unknown'}" — no gemId in PoB export; gem omitted.`
      );
      continue;
    }

    const supportSkills = [];

    // 3. Process linked actives
    const linkedActives = activeGems.filter((active) => active !== primaryActive && active.gemId);
    for (const active of linkedActives) {
      const rawText = active.additional_text ?? active.comment ?? active.description;
      const levelText = buildGemLevelText(active);
      const activeText = [levelText, rawText].filter(Boolean).join(' | ') || undefined;
      const activeInterval = active.level_interval ?? active.levelInterval;
      const nonDefaultInterval = activeInterval && !isDefaultInterval(activeInterval) ? activeInterval : null;
      if (activeText || nonDefaultInterval) {
        const obj = { id: active.gemId };
        obj.level_interval = normalizeLevelInterval(nonDefaultInterval);
        if (activeText) obj.additional_text = activeText;
        supportSkills.push(obj);
      } else {
        supportSkills.push({ id: active.gemId, level_interval: [...DEFAULT_LEVEL_INTERVAL] });
      }
    }

    // 4. Process supports
    const supports = (group.supports ?? []).filter((support) => support.enabled && support.gemId);
    for (const support of supports) {
      const rawText = support.additional_text ?? support.comment ?? support.description;
      const levelText = buildGemLevelText(support);
      const supportText = [levelText, rawText].filter(Boolean).join(' | ') || undefined;
      const supportInterval = support.level_interval ?? support.levelInterval;
      const nonDefaultInterval = supportInterval && !isDefaultInterval(supportInterval) ? supportInterval : null;
      if (supportText || nonDefaultInterval) {
        const obj = { id: support.gemId };
        obj.level_interval = normalizeLevelInterval(nonDefaultInterval);
        if (supportText) obj.additional_text = supportText;
        supportSkills.push(obj);
      } else {
        supportSkills.push({ id: support.gemId, level_interval: [...DEFAULT_LEVEL_INTERVAL] });
      }
    }

    const skillInterval = primaryActive.level_interval ?? primaryActive.levelInterval ?? group.level_interval ?? group.levelInterval;
    const rawSkillText  = primaryActive.additional_text ?? primaryActive.comment ?? primaryActive.description ?? group.additional_text ?? group.comment ?? group.description;
    const skillLevelText = buildGemLevelText(primaryActive);
    const skillText = [skillLevelText, rawSkillText].filter(Boolean).join(' | ') || undefined;

    const buildSkill = {
      id: primaryActive.gemId,
      level_interval: normalizeLevelInterval(skillInterval),
      support_skills: supportSkills
    };

    if (skillText) {
      buildSkill.additional_text = skillText;
    }

    // 5. Validate support gem compatibility (PoB2 Build Optimizer rules)
    const activeKey = normalizeGemKey(primaryActive.gemId || primaryActive.nameSpec);
    const activeTags = ACTIVE_GEM_TAGS[activeKey] || [];
    if (activeTags.length > 0) {
      for (const support of supports) {
        const supportKey = normalizeGemKey(support.gemId || support.nameSpec);
        const rule = SUPPORT_COMPAT_RULES[supportKey];
        if (rule) {
          const hasRequiredTag = rule.requiresAny
            ? rule.requires.some(tag => activeTags.includes(tag))
            : rule.requires.every(tag => activeTags.includes(tag));
            
          if (!hasRequiredTag) {
            report.warnings.push(
              `Skill Link Warning: Support gem "${support.nameSpec || support.gemId}" does not support "${primaryActive.nameSpec || primaryActive.gemId}" (${rule.errMsg}).`
            );
          }
        }
      }
    }

    out.push(buildSkill);
    report.converted.push(`skill "${primaryActive.nameSpec || primaryActive.gemId}"`);

    for (const active of activeGems) {
      if (active === primaryActive) continue;
      if (!active.gemId) {
        report.unsupported.push(
          `skill "${active.nameSpec || 'unknown'}" — no gemId in PoB export; gem omitted.`
        );
      }
    }
  }

  return out;
}

function convertPassives(build, report) {
  const specs = build.tree?.specs ?? [];
  if (!specs.length || !specs.some((s) => s.nodes.length)) {
    if (build.tree?.nodes?.length) {
      // Single-spec path
    } else {
      report.warnings.push('No passive tree data found in the build.');
      return [];
    }
  }

  // Use multi-spec approach from poe2-build-forge: derive level_interval from
  // when a node first appears across specs (ordered by progression).
  const allSpecs = specs.filter((s) => s.nodes.length > 0);

  if (!allSpecs.length) {
    report.warnings.push('No passive tree data found in the build.');
    return [];
  }

  const finalSpec = allSpecs[allSpecs.length - 1];
  const out = [];
  let resolved = 0, unresolved = 0;

  if (allSpecs.length === 1) {
    for (const nodeId of finalSpec.nodes) {
      const entry = PASSIVES[String(nodeId)];
      if (!entry) { unresolved++; continue; }
      if (entry.ascendancy) continue;
      out.push({ id: entry.id, level_interval: [...DEFAULT_LEVEL_INTERVAL] });
      resolved++;
    }
  } else {
    // Multi-spec: find earliest spec each node appears in
    const startLevelForSpec = (i) => (i === 0 ? 1 : Math.round((100 * i) / allSpecs.length));
    const earliest = new Map();
    for (let i = 0; i < allSpecs.length; i++) {
      for (const nodeId of allSpecs[i].nodes) {
        if (!earliest.has(nodeId)) earliest.set(nodeId, i);
      }
    }

    for (const nodeId of finalSpec.nodes) {
      const entry = PASSIVES[String(nodeId)];
      if (!entry) { unresolved++; continue; }
      if (entry.ascendancy) continue;

      const startLevel = startLevelForSpec(earliest.get(nodeId) ?? allSpecs.length - 1);
      out.push({ id: entry.id, level_interval: [startLevel <= 1 ? 0 : startLevel, 100] });
      resolved++;
    }
  }

  if (resolved) report.converted.push(`${resolved} passive nodes resolved from GGG data`);
  if (unresolved) report.guessed.push(`${unresolved} passive node(s) not found in data — omitted`);

  return out;
}

function convertPassivesWithWeaponSets(build, report, ascendancy) {
  const localReport = { warnings: [], converted: [], guessed: [] };
  const out = convertPassives(build, localReport);
  const weaponSet1Nodes = build.tree?.weaponSet1Nodes ?? [];
  const weaponSet2Nodes = build.tree?.weaponSet2Nodes ?? [];
  const seenNodeIds = new Set();

  for (const spec of build.tree?.specs ?? []) {
    for (const nodeId of spec.nodes ?? []) {
      if (!PASSIVES[String(nodeId)]?.ascendancy) {
        seenNodeIds.add(nodeId);
      }
    }
  }

  const weaponSet1 = appendWeaponSetPassives(out, seenNodeIds, weaponSet1Nodes, 1);
  const weaponSet2 = appendWeaponSetPassives(out, seenNodeIds, weaponSet2Nodes, 2);
  const ascendancyResult = appendAscendancyPassives(out, seenNodeIds, build.tree, ascendancy);
  const resolved = localReport.converted
    .map((line) => line.match(/^(\d+) passive nodes resolved from GGG data$/))
    .find(Boolean);
  const guessed = localReport.guessed
    .map((line) => line.match(/^(\d+) passive node\(s\) not found in data/))
    .find(Boolean);
  const resolvedCount = (resolved ? Number(resolved[1]) : 0) + weaponSet1.resolved + weaponSet2.resolved + ascendancyResult.resolved;
  const unresolvedCount = (guessed ? Number(guessed[1]) : 0) + weaponSet1.unresolved + weaponSet2.unresolved + ascendancyResult.unresolved;

  report.warnings.push(...localReport.warnings);
  report.converted.push(...localReport.converted.filter((line) => !/passive nodes resolved from GGG data$/.test(line)));
  report.guessed.push(...localReport.guessed.filter((line) => !/passive node\(s\) not found in data/.test(line)));
  if (resolvedCount) report.converted.push(`${resolvedCount} passive nodes resolved from GGG data`);
  if (unresolvedCount) report.guessed.push(`${unresolvedCount} passive node(s) not found in data - omitted`);
  if (ascendancyResult.capped) {
    report.warnings.push(`${ascendancyResult.capped} extra ascendancy node(s) omitted; Path of Exile 2 builds can allocate at most ${MAX_ASCENDANCY_PASSIVES} ascendancy points.`);
  }

  return out;
}

function convertPassiveNode(nodeId) {
  const entry = PASSIVES[String(nodeId)];
  if (!entry) return null;
  if (entry.ascendancy) return null;
  return entry.id;
}

function appendWeaponSetPassives(out, seenNodeIds, nodeIds, weaponSet) {
  let resolved = 0;
  let unresolved = 0;

  for (const nodeId of nodeIds) {
    if (seenNodeIds.has(nodeId)) continue;
    const passive = convertPassiveNode(nodeId);
    if (!passive) {
      unresolved++;
      continue;
    }
    out.push({ id: passive, weapon_set: weaponSet, level_interval: [...DEFAULT_LEVEL_INTERVAL] });
    seenNodeIds.add(nodeId);
    resolved++;
  }

  return { resolved, unresolved };
}

function appendAscendancyPassives(out, seenNodeIds, tree, selectedAscendancy) {
  const activeAscendancyNodes = tree?.activeSpec?.ascendancyNodes ?? [];
  const specAscendancyNodes = (tree?.specs ?? []).flatMap((spec) => spec.ascendancyNodes ?? []);
  const fallbackAscendancyNodes = [
    ...(tree?.nodes ?? []),
    ...(tree?.specs ?? []).flatMap((spec) => spec.nodes ?? []),
  ].filter((nodeId) => PASSIVES[String(nodeId)]?.ascendancy);
  const nodeIds = uniqueNums([...activeAscendancyNodes, ...specAscendancyNodes, ...fallbackAscendancyNodes]);
  const selectedInternal = selectedAscendancy && ASCENDANCIES[selectedAscendancy]
    ? selectedAscendancy
    : ASCENDANCY_BY_NAME[selectedAscendancy];
  let resolved = 0;
  let unresolved = 0;
  let capped = 0;

  for (const nodeId of nodeIds) {
    if (seenNodeIds.has(nodeId)) continue;
    const entry = PASSIVES[String(nodeId)];
    if (!entry) {
      unresolved++;
      continue;
    }
    if (!entry.ascendancy) continue;
    if (selectedInternal && entry.ascendancy !== selectedInternal) continue;
    if (resolved >= MAX_ASCENDANCY_PASSIVES) {
      capped++;
      continue;
    }
    out.push({ id: entry.id, level_interval: [...DEFAULT_LEVEL_INTERVAL] });
    seenNodeIds.add(nodeId);
    resolved++;
  }

  return { resolved, unresolved, capped };
}

function uniqueNums(values) {
  return [...new Set(values.filter((n) => Number.isInteger(n)))];
}

function repairAscendancyNodeIds(nodeIds, selectedAscendancy) {
  const unique = uniqueNums(nodeIds);
  if (!unique.length) return { nodeIds: [], unresolved: 0 };

  const selectedInternal = selectedAscendancy && ASCENDANCIES[selectedAscendancy]
    ? selectedAscendancy
    : ASCENDANCY_BY_NAME[selectedAscendancy];
  const inferredInternal = selectedInternal || unique
    .map((nodeId) => PASSIVES[String(nodeId)]?.ascendancy)
    .find((asc) => asc && ASCENDANCIES[asc]);
  const display = ASCENDANCIES[inferredInternal]?.name;

  const targets = unique
    .map((nodeId, index) => {
      const entry = PASSIVES[String(nodeId)];
      if (!entry?.ascendancy) return null;
      if (inferredInternal && entry.ascendancy !== inferredInternal) return null;
      const hash = findTreeHashBySid(entry.id);
      if (!hash) return null;
      return { nodeId, hash, index };
    })
    .filter(Boolean);

  if (!targets.length) {
    return { nodeIds: [], unresolved: unique.filter((nodeId) => PASSIVES[String(nodeId)]?.ascendancy).length };
  }

  const startHash = findAscendancyTreeStartHash(display);
  const adjacency = buildTreeAdjacency(TREE_DATA.nodes || {});
  const allow = (hash) => {
    const node = TREE_DATA.nodes?.[hash];
    return !!node?.a && (!display || String(node.a).toLowerCase() === display.toLowerCase());
  };

  const connected = connectTreeTargets(targets, {
    adjacency,
    startHash,
    max: MAX_ASCENDANCY_PASSIVES,
    allow,
    draw: (hash) => {
      const node = TREE_DATA.nodes?.[hash];
      return !!node?.sid && !isAscendancyRootTreeNode(node);
    },
  });

  const repaired = connected
    .map((hash) => TREE_DATA.nodes?.[hash]?.sid)
    .map((sid) => findPassiveHashById(sid))
    .filter((nodeId) => Number.isInteger(nodeId));

  return {
    nodeIds: uniqueNums(repaired.length ? repaired : targets.map((target) => target.nodeId)).slice(0, MAX_ASCENDANCY_PASSIVES),
    unresolved: 0,
  };
}

function findTreeHashBySid(sid) {
  const found = Object.entries(TREE_DATA.nodes || {}).find(([, node]) => node.sid === sid);
  return found?.[0] || null;
}

function findPassiveHashById(id) {
  const found = Object.entries(PASSIVES).find(([, entry]) => entry.id === id);
  return found ? Number(found[0]) : null;
}

function findAscendancyTreeStartHash(displayName) {
  const wanted = String(displayName || '').trim().toLowerCase();
  if (!wanted) return null;
  const found = Object.entries(TREE_DATA.nodes || {}).find(([, node]) =>
    node.a && String(node.a).toLowerCase() === wanted && isAscendancyRootTreeNode(node)
  );
  return found?.[0] || null;
}

function isAscendancyRootTreeNode(node) {
  return !!node?.a && node.t === 'ascendancy' && String(node.n || '').toLowerCase() === String(node.a || '').toLowerCase();
}

function buildTreeAdjacency(nodes) {
  const adjacency = new Map();
  const ensure = (hash) => {
    if (!adjacency.has(hash)) adjacency.set(hash, new Set());
    return adjacency.get(hash);
  };
  for (const hash of Object.keys(nodes)) ensure(hash);
  for (const [hash, node] of Object.entries(nodes)) {
    for (const next of node.c || []) {
      const target = String(next);
      if (!nodes[target]) continue;
      ensure(hash).add(target);
      ensure(target).add(hash);
    }
  }
  return adjacency;
}

function connectTreeTargets(targets, { adjacency, startHash, max, allow, draw }) {
  const selected = new Set();
  const result = [];
  if (startHash && allow(startHash)) selected.add(startHash);
  else if (targets[0]) selected.add(targets[0].hash);

  const distances = startHash ? treeDistancesFrom(startHash, adjacency, allow) : new Map();
  const ordered = [...targets].sort((a, b) => {
    const da = distances.get(a.hash) ?? Number.MAX_SAFE_INTEGER;
    const db = distances.get(b.hash) ?? Number.MAX_SAFE_INTEGER;
    return da - db || a.index - b.index;
  });

  for (const target of ordered) {
    if (selected.has(target.hash)) {
      if (draw(target.hash) && !result.includes(target.hash) && result.length < max) result.push(target.hash);
      continue;
    }
    const path = shortestTreePathFromSet(selected, target.hash, adjacency, allow);
    if (!path) continue;
    const newHashes = path.filter((hash) => draw(hash) && !result.includes(hash));
    if (result.length + newHashes.length > max) continue;
    for (const hash of path) selected.add(hash);
    for (const hash of newHashes) result.push(hash);
  }

  return result;
}

function shortestTreePathFromSet(startSet, target, adjacency, allow) {
  if (!target || !allow(target)) return null;
  const queue = [];
  const previous = new Map();
  const visited = new Set();
  for (const start of startSet) {
    if (!allow(start)) continue;
    visited.add(start);
    previous.set(start, null);
    queue.push(start);
  }
  while (queue.length) {
    const hash = queue.shift();
    if (hash === target) return unwindTreePath(previous, target);
    for (const next of adjacency.get(hash) || []) {
      if (!allow(next) || visited.has(next)) continue;
      visited.add(next);
      previous.set(next, hash);
      queue.push(next);
    }
  }
  return null;
}

function treeDistancesFrom(startHash, adjacency, allow) {
  const distances = new Map();
  if (!startHash || !allow(startHash)) return distances;
  const queue = [startHash];
  distances.set(startHash, 0);
  while (queue.length) {
    const hash = queue.shift();
    const nextDistance = distances.get(hash) + 1;
    for (const next of adjacency.get(hash) || []) {
      if (!allow(next) || distances.has(next)) continue;
      distances.set(next, nextDistance);
      queue.push(next);
    }
  }
  return distances;
}

function unwindTreePath(previous, target) {
  const path = [];
  let current = target;
  while (current) {
    path.push(current);
    current = previous.get(current);
  }
  return path.reverse();
}

function convertItems(build, report) {
  if (Array.isArray(build.items)) {
    if (build.items.length === 0 || (build.items[0] && typeof build.items[0] === 'object' && 'inventory_id' in build.items[0])) {
      for (const item of build.items) {
        const name = item.unique_name || item.additional_text || item.inventory_id;
        report.converted.push(`item "${name}" (kept as-is)`);
      }
      return build.items.map(enrichBuildItem);
    }
  }

  const { list, slots, catalog } = build.items ?? { list: [], slots: [], catalog: {} };
  const itemLookup = catalog ?? Object.fromEntries((list ?? []).map((i) => [i.id, i]));

  if (!slots?.length) {
    if (list?.length) {
      report.warnings.push(`${list.length} item(s) present but no slot mapping found.`);
    } else {
      report.warnings.push('No items found in the build.');
    }
    return [];
  }

  const out = [];
  for (const slot of slots) {
    const inventoryId = translateSlotName(slot.name);
    const item = itemLookup[slot.itemId];
    const buildItem = {
      inventory_id: inventoryId,
      slot_x: 0,
      slot_y: 0,
      level_interval: normalizeLevelInterval(item?.level_interval ?? item?.levelInterval ?? slot.level_interval ?? slot.levelInterval),
    };

    if (item) {
      if (item.parserProblems) {
        for (const problem of item.parserProblems) {
          report.unsupported.push(`[Item Parser] ${problem}`);
        }
      }
      if (item.isUnique && item.uniqueName) {
        buildItem.unique_name = item.uniqueName;
        const baseType = (item.typeLine && item.typeLine !== item.uniqueName) ? item.typeLine : '';
        const modText  = formatMods(item.implicits, item.explicits, item.runes);
        const fullText = [baseType, modText].filter(Boolean).join('\n');
        if (fullText) buildItem.additional_text = fullText;
        report.converted.push(`unique "${item.uniqueName}" in slot "${slot.name}"`);
      } else if (item.rarity && item.name) {
        const base = item.typeLine && item.typeLine !== item.name
          ? `${item.rarity}: ${item.typeLine} ("${item.name}")`
          : `${item.rarity}: ${item.name}`;
        const modText = formatMods(item.implicits, item.explicits, item.runes);
        buildItem.additional_text = modText ? `${base}\n${modText}` : base;
        report.converted.push(`item "${item.name}" in slot "${slot.name}"`);
      }
    }

    out.push(buildItem);
  }

  return out;
}

function formatMods(implicits = [], explicits = [], runes = []) {
  const lines = [];
  for (const rune of runes) lines.push(`[Rune] ${rune}`);
  for (const m of implicits) lines.push(`[Implicit] ${m}`);
  for (const m of explicits) lines.push(m);
  return lines.join('\n');
}

function enrichBuildSkill(skill) {
  return {
    ...skill,
    level_interval: normalizeLevelInterval(skill.level_interval ?? skill.levelInterval),
    support_skills: (skill.support_skills ?? []).map(enrichBuildSupport),
  };
}

function enrichBuildSupport(support) {
  if (typeof support === 'string') {
    return { id: support, level_interval: [...DEFAULT_LEVEL_INTERVAL] };
  }
  return {
    ...support,
    level_interval: normalizeLevelInterval(support.level_interval ?? support.levelInterval),
  };
}

function enrichBuildPassive(passive) {
  if (typeof passive === 'string') {
    return { id: passive, level_interval: [...DEFAULT_LEVEL_INTERVAL] };
  }
  return {
    ...passive,
    level_interval: normalizeLevelInterval(passive.level_interval ?? passive.levelInterval),
  };
}

function enrichBuildItem(item) {
  return {
    ...item,
    level_interval: normalizeLevelInterval(item.level_interval ?? item.levelInterval),
  };
}

function translateSlotName(name) {
  const map = {
    // Weapon set 1
    'Weapon 1':       'Weapon',
    'Weapon 2':       'Offhand',
    // Weapon set 2 (swap)
    'Weapon 1 Swap':  'Weapon2',
    'Weapon 2 Swap':  'Offhand2',
    // Armour
    'Body Armour':    'BodyArmour',
    Helmet:           'Helm',
    Gloves:           'Gloves',
    Boots:            'Boots',
    Belt:             'Belt',
    Amulet:           'Amulet',
    // Rings
    'Ring 1':         'Ring',
    'Ring 2':         'Ring2',
    // Flasks
    'Flask 1':        'Flask1',
    'Flask 2':        'Flask2',
    'Flask 3':        'Flask3',
    'Flask 4':        'Flask4',
    'Flask 5':        'Flask5',
  };
  return map[name] ?? name.replace(/\s+/g, '');
}

// ── Smart Gem-Link Compatibility Rules & Tags ───────────────────────────────

function normalizeGemKey(idOrName) {
  return String(idOrName ?? '')
    .split('/')
    .pop()
    .replace(/(?:Skill|Support)?Gem/i, '')
    .replace(/\bSupport\b/gi, '')
    .replace(/[^A-Za-z0-9]/g, '')
    .toLowerCase();
}

const SUPPORT_COMPAT_RULES = {
  spellecho: { requires: ['spell'], errMsg: 'requires a Spell skill' },
  fastercasting: { requires: ['spell'], errMsg: 'requires a Spell skill' },
  controlleddestruction: { requires: ['spell'], errMsg: 'requires a Spell skill' },
  spellcascade: { requires: ['spell', 'area'], errMsg: 'requires an Area Spell skill' },
  meleephysicaldamage: { requires: ['melee'], errMsg: 'requires a Melee skill' },
  closecombat: { requires: ['melee'], errMsg: 'requires a Melee skill' },
  maim: { requires: ['attack', 'melee'], requiresAny: true, errMsg: 'requires an Attack or Melee skill' },
  miniondamage: { requires: ['minion'], errMsg: 'requires a Minion skill' },
  minionspeed: { requires: ['minion'], errMsg: 'requires a Minion skill' },
  meatshield: { requires: ['minion'], errMsg: 'requires a Minion skill' },
  multipleprojectiles: { requires: ['projectile'], errMsg: 'requires a Projectile skill' },
  fork: { requires: ['projectile'], errMsg: 'requires a Projectile skill' },
  chain: { requires: ['projectile', 'chaining'], requiresAny: true, errMsg: 'requires a Projectile or Chaining skill' },
  pierce: { requires: ['projectile'], errMsg: 'requires a Projectile skill' },
  concentratedeffect: { requires: ['area'], errMsg: 'requires an Area of Effect skill' },
  increasedaoe: { requires: ['area'], errMsg: 'requires an Area of Effect skill' },
  burningdamage: { requires: ['fire', 'ignite', 'dot'], requiresAny: true, errMsg: 'requires a Fire, Ignite, or DoT skill' },
  igniteproliferation: { requires: ['fire', 'ignite'], requiresAny: true, errMsg: 'requires a Fire or Ignite skill' },
  hypothermia: { requires: ['cold', 'elemental'], requiresAny: true, errMsg: 'requires a Cold or Elemental skill' },
  icebite: { requires: ['cold'], errMsg: 'requires a Cold skill' },
  viletoxins: { requires: ['chaos', 'poison', 'dot'], requiresAny: true, errMsg: 'requires a Chaos, Poison, or DoT skill' },
  voidmanipulation: { requires: ['chaos', 'elemental', 'physical'], requiresAny: true, errMsg: 'requires a Chaos or Damage scaling skill' },
};

const ACTIVE_GEM_TAGS = {
  // Fire
  fireball: ['fire', 'spell', 'projectile'],
  flameblast: ['fire', 'spell', 'area', 'channelling'],
  volcanicfissure: ['fire', 'attack', 'area', 'slam'],
  explosiveshot: ['fire', 'attack', 'projectile', 'bow'],
  rollingmagma: ['fire', 'spell', 'projectile'],
  flamewall: ['fire', 'spell', 'area'],
  volatiledead: ['fire', 'spell', 'area', 'minion'],
  combustion: ['fire', 'spell', 'area'],
  incinerate: ['fire', 'spell', 'channelling'],
  firetrap: ['fire', 'trap', 'area'],

  // Cold
  icenova: ['cold', 'spell', 'area'],
  frostbomb: ['cold', 'spell', 'area'],
  comet: ['cold', 'spell', 'projectile'],
  glacialbolt: ['cold', 'spell', 'projectile'],
  icelance: ['cold', 'attack', 'projectile'],
  snapfreeze: ['cold', 'spell', 'area'],
  glacialcascade: ['cold', 'spell', 'area'],
  coldsnap: ['cold', 'spell', 'area'],
  frostblink: ['cold', 'spell', 'movement'],
  iceshot: ['cold', 'attack', 'projectile', 'bow'],

  // Lightning
  arc: ['lightning', 'spell', 'chaining'],
  balllightning: ['lightning', 'spell', 'projectile', 'area'],
  spark: ['lightning', 'spell', 'projectile'],
  lightningarrow: ['lightning', 'attack', 'projectile', 'bow'],
  stormsurge: ['lightning', 'spell', 'area'],
  chainlightning: ['lightning', 'spell', 'chaining'],
  orbofstorms: ['lightning', 'spell', 'area'],
  stormcall: ['lightning', 'spell', 'area'],
  lightningwarp: ['lightning', 'spell', 'movement'],
  tempestflurry: ['lightning', 'attack', 'melee'],

  // Physical
  groundslam: ['physical', 'attack', 'area', 'slam', 'melee'],
  heavystrike: ['physical', 'attack', 'melee'],
  whirlingslash: ['physical', 'attack', 'area', 'melee'],
  sunder: ['physical', 'attack', 'area', 'slam'],
  splittingsteel: ['physical', 'attack', 'projectile'],
  shieldcrush: ['physical', 'attack', 'area', 'melee'],
  boneshatter: ['physical', 'attack', 'melee'],
  reap: ['physical', 'spell', 'area'],
  leapslam: ['physical', 'attack', 'area', 'slam', 'movement'],
  hammerofgods: ['physical', 'attack', 'slam', 'melee'],
  shieldcharge: ['physical', 'attack', 'movement', 'melee'],

  // Chaos
  essencedrain: ['chaos', 'spell', 'projectile', 'dot'],
  contagion: ['chaos', 'spell', 'area'],
  blight: ['chaos', 'spell', 'channelling', 'area'],
  despair: ['chaos', 'spell', 'curse', 'aura'],
  plaguebearer: ['chaos', 'spell', 'buff'],
  poisonousconcoction: ['chaos', 'attack', 'projectile', 'poison'],

  // Minion
  raisezombie: ['minion', 'spell'],
  raisespectre: ['minion', 'spell'],
  summonskeletons: ['minion', 'spell'],
  bonecage: ['minion', 'physical', 'spell'],
  infernallegion: ['fire', 'minion', 'aura'],
  unearth: ['physical', 'spell', 'projectile'],

  // Bow
  tornadoshot: ['attack', 'projectile', 'bow'],
  barrage: ['attack', 'projectile', 'bow'],
  rainofarrows: ['attack', 'projectile', 'bow', 'area'],
  shrapnelballista: ['attack', 'projectile', 'bow', 'totem'],

  // Aura
  anger: ['fire', 'aura'],
  hatred: ['cold', 'aura'],
  wrath: ['lightning', 'aura'],
  grace: ['defence', 'aura'],
  determination: ['defence', 'aura'],
  discipline: ['defence', 'aura'],
  haste: ['buff', 'aura'],
  malevolence: ['chaos', 'aura'],
  vitality: ['defence', 'aura'],

  // Misc
  flickerstrike: ['attack', 'melee', 'movement'],
  cyclone: ['attack', 'area', 'melee', 'channelling'],
  seismiccry: ['physical', 'warcry', 'area'],
  powersiphon: ['attack', 'projectile'],
  dash: ['movement', 'spell'],
  flamedash: ['movement', 'fire', 'spell'],
  frenzy: ['attack', 'projectile', 'bow', 'melee'],
  whirlingblades: ['movement', 'attack', 'melee'],
};
