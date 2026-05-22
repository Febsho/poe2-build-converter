import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Real GGG passive and ascendancy data from poe2-build-forge
const PASSIVES = require('./data/passives_default.json');
const ASCENDANCIES = require('./data/ascendancies.json');

// Build a reverse map: ascendancy display name -> internal key (e.g. "Deadeye" -> "Ranger1")
const ASCENDANCY_BY_NAME = Object.fromEntries(
  Object.entries(ASCENDANCIES).map(([key, val]) => [val.name, key])
);

/** Returns true if the interval is the implicit default [0, 100] (always-show). */
function isDefaultInterval(interval) {
  return Array.isArray(interval) && interval[0] === 0 && interval[1] === 100;
}

/**
 * Build a level/quality annotation string for a gem.
 * Only includes non-trivial values (level > 1, quality > 0).
 */
function buildGemLevelText(gem) {
  if (!gem) return '';
  const parts = [];
  const level   = Number(gem.level);
  const quality = Number(gem.quality);
  if (Number.isFinite(level)   && level   > 1) parts.push(`Level ${level}`);
  if (Number.isFinite(quality) && quality > 0) parts.push(`Quality ${quality}%`);
  return parts.join(' | ');
}

/**
 * Convert a normalized PoB build (from parsePobXml) into a PoE2 .build object
 * plus a classification report.
 */
export function convertToBuild(build, opts = {}) {
  const report = { converted: [], guessed: [], unsupported: [], warnings: [] };
  const out = {};

  out.name = pickName(build, opts, report);
  out.description = buildDescription(build, opts);
  report.converted.push('description (generated from build metadata + notes)');

  const asc = convertAscendancy(build, report);
  if (asc) out.ascendancy = asc;

  const skills = convertSkills(build, report);
  if (skills.length) out.skills = skills;

  if (build.passives) {
    out.passives = build.passives;
    report.converted.push(`${build.passives.length} passives (kept as-is)`);
  } else {
    const passives = convertPassivesWithWeaponSets(build, report);
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
  const display = build.meta?.ascendClassName;
  if (!display || display === 'None') {
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

  report.guessed.push(`ascendancy "${display}" — could not map to internal key, passing display name through.`);
  return display;
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
      out.push(group);
      report.converted.push(`skill "${group.id}" (kept as-is)`);
      continue;
    }

    // 2. If it's a string, convert to minimal GGG BuildSkill object
    if (typeof group === 'string') {
      out.push({ id: group, support_skills: [] });
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
        if (nonDefaultInterval) obj.level_interval = nonDefaultInterval;
        if (activeText) obj.additional_text = activeText;
        supportSkills.push(obj);
      } else {
        supportSkills.push(active.gemId);
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
        if (nonDefaultInterval) obj.level_interval = nonDefaultInterval;
        if (supportText) obj.additional_text = supportText;
        supportSkills.push(obj);
      } else {
        supportSkills.push(support.gemId);
      }
    }

    const skillInterval = primaryActive.level_interval ?? primaryActive.levelInterval ?? group.level_interval ?? group.levelInterval;
    const rawSkillText  = primaryActive.additional_text ?? primaryActive.comment ?? primaryActive.description ?? group.additional_text ?? group.comment ?? group.description;
    const skillLevelText = buildGemLevelText(primaryActive);
    const skillText = [skillLevelText, rawSkillText].filter(Boolean).join(' | ') || undefined;

    const buildSkill = {
      id: primaryActive.gemId,
      support_skills: supportSkills
    };

    if (skillInterval && !isDefaultInterval(skillInterval)) {
      buildSkill.level_interval = skillInterval;
    }

    if (skillText) {
      buildSkill.additional_text = skillText;
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
      if (entry.is_jewel_socket) continue;
      out.push(entry.id);
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
      if (entry.is_jewel_socket) continue;

      const startLevel = startLevelForSpec(earliest.get(nodeId) ?? allSpecs.length - 1);
      if (startLevel <= 1) {
        out.push(entry.id);
      } else {
        out.push({ id: entry.id, level_interval: [startLevel, 100] });
      }
      resolved++;
    }
  }

  if (resolved) report.converted.push(`${resolved} passive nodes resolved from GGG data`);
  if (unresolved) report.guessed.push(`${unresolved} passive node(s) not found in data — omitted`);

  return out;
}

function convertPassivesWithWeaponSets(build, report) {
  const localReport = { warnings: [], converted: [], guessed: [] };
  const out = convertPassives(build, localReport);
  const weaponSet1Nodes = build.tree?.weaponSet1Nodes ?? [];
  const weaponSet2Nodes = build.tree?.weaponSet2Nodes ?? [];
  const seenNodeIds = new Set();

  for (const spec of build.tree?.specs ?? []) {
    for (const nodeId of spec.nodes ?? []) {
      seenNodeIds.add(nodeId);
    }
  }

  const weaponSet1 = appendWeaponSetPassives(out, seenNodeIds, weaponSet1Nodes, 1);
  const weaponSet2 = appendWeaponSetPassives(out, seenNodeIds, weaponSet2Nodes, 2);
  const resolved = localReport.converted
    .map((line) => line.match(/^(\d+) passive nodes resolved from GGG data$/))
    .find(Boolean);
  const guessed = localReport.guessed
    .map((line) => line.match(/^(\d+) passive node\(s\) not found in data/))
    .find(Boolean);
  const resolvedCount = (resolved ? Number(resolved[1]) : 0) + weaponSet1.resolved + weaponSet2.resolved;
  const unresolvedCount = (guessed ? Number(guessed[1]) : 0) + weaponSet1.unresolved + weaponSet2.unresolved;

  report.warnings.push(...localReport.warnings);
  report.converted.push(...localReport.converted.filter((line) => !/passive nodes resolved from GGG data$/.test(line)));
  report.guessed.push(...localReport.guessed.filter((line) => !/passive node\(s\) not found in data/.test(line)));
  if (resolvedCount) report.converted.push(`${resolvedCount} passive nodes resolved from GGG data`);
  if (unresolvedCount) report.guessed.push(`${unresolvedCount} passive node(s) not found in data - omitted`);

  return out;
}

function convertPassiveNode(nodeId) {
  const entry = PASSIVES[String(nodeId)];
  if (!entry || entry.is_jewel_socket) return null;
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
    out.push({ id: passive, weapon_set: weaponSet });
    seenNodeIds.add(nodeId);
    resolved++;
  }

  return { resolved, unresolved };
}

function convertItems(build, report) {
  if (Array.isArray(build.items)) {
    if (build.items.length === 0 || (build.items[0] && typeof build.items[0] === 'object' && 'inventory_id' in build.items[0])) {
      for (const item of build.items) {
        const name = item.unique_name || item.additional_text || item.inventory_id;
        report.converted.push(`item "${name}" (kept as-is)`);
      }
      return build.items;
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
    const buildItem = { inventory_id: inventoryId, slot_x: 0, slot_y: 0 };

    if (item) {
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
