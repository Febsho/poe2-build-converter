import {
  KNOWN_POE2_ASCENDANCIES,
  slotToInventoryId,
  guessSkillMetadataId,
  guessSupportMetadataId,
} from './mappings.js';

const FULL_INTERVAL = [0, 100];

/**
 * Convert a normalized PoB build (from pobParser) into the official PoE2
 * `.build` Build Planner object plus a classification report.
 *
 * The report tells the UI which pieces are:
 *   - converted:   structurally faithful, high confidence
 *   - guessed:     mapped via heuristics, IDs not officially confirmed
 *   - unsupported: could not be resolved; preserved as text where possible
 *
 * @param {object} build  normalized build from parsePobXml
 * @param {object} opts   { name, description } user overrides
 */
export function convertToBuild(build, opts = {}) {
  const report = {
    converted: [],
    guessed: [],
    unsupported: [],
    warnings: [],
  };

  const out = {};

  // --- name ---------------------------------------------------------------
  out.name = pickName(build, opts, report);

  // --- description --------------------------------------------------------
  out.description = buildDescription(build, opts);
  report.converted.push('description (generated from build metadata + notes)');

  // --- ascendancy ---------------------------------------------------------
  const asc = convertAscendancy(build, report);
  if (asc) out.ascendancy = asc;

  // --- skills -------------------------------------------------------------
  const skills = convertSkills(build, report);
  if (skills.length) out.skills = skills;

  // --- passives -----------------------------------------------------------
  const passives = convertPassives(build, report);
  if (passives.length) out.passives = passives;

  // --- items --------------------------------------------------------------
  const items = convertItems(build, report);
  if (items.length) out.items = items;

  return { build: out, report };
}

// ---------------------------------------------------------------------------

function pickName(build, opts, report) {
  if (opts.name && opts.name.trim()) {
    report.converted.push('name (provided by user)');
    return opts.name.trim();
  }
  const cls = build.meta?.className;
  const asc = build.meta?.ascendClassName;
  const lvl = build.meta?.level;
  const parts = [];
  if (asc && asc !== 'None') parts.push(asc);
  else if (cls) parts.push(cls);
  if (lvl) parts.push(`Lvl ${lvl}`);
  const name = parts.length ? parts.join(' ') : 'Imported PoB Build';
  report.converted.push(`name (derived: "${name}")`);
  return name;
}

function buildDescription(build, opts) {
  if (opts.description && opts.description.trim()) {
    return opts.description.trim();
  }
  const bits = ['Generated from PoB / pobb.in.'];
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
  const name = build.meta?.ascendClassName;
  if (!name || name === 'None') {
    report.warnings.push('No ascendancy found in the build.');
    return undefined;
  }
  if (KNOWN_POE2_ASCENDANCIES.has(name)) {
    report.guessed.push(
      `ascendancy "${name}" — using the display name; the official AscendancyId string is unconfirmed.`
    );
    return name;
  }
  report.unsupported.push(
    `ascendancy "${name}" is not a recognized PoE2 ascendancy (it may be a PoE1 build). Passed through as-is.`
  );
  return name;
}

function convertSkills(build, report) {
  const groups = build.skills ?? [];
  if (!groups.length) {
    report.warnings.push('No skill gems found in the build.');
    return [];
  }

  const skills = [];
  for (const group of groups) {
    for (const active of group.actives) {
      const skill = { level_interval: FULL_INTERVAL };

      const idGuess = guessSkillMetadataId(active);
      const notes = [];
      if (group.label) notes.push(group.label);
      if (active.nameSpec) notes.push(`Gem: ${active.nameSpec}`);
      if (active.level) notes.push(`Lvl ${active.level}`);
      if (active.quality) notes.push(`Q${active.quality}%`);

      if (idGuess) {
        skill.id = idGuess.candidate;
        report.guessed.push(
          `skill "${active.nameSpec ?? active.skillId}" -> ${idGuess.candidate} (${idGuess.confidence} confidence; verify the Metadata path).`
        );
      } else {
        notes.unshift('UNRESOLVED skill id');
        report.unsupported.push(
          `skill "${active.nameSpec ?? 'unknown'}" could not be mapped to a Metadata id; left in additional_text.`
        );
      }

      // Supports for this group.
      const supports = [];
      for (const sup of group.supports) {
        const supGuess = guessSupportMetadataId(sup);
        const supNote = [sup.nameSpec, sup.level ? `Lvl ${sup.level}` : null]
          .filter(Boolean)
          .join(' ');
        if (supGuess) {
          supports.push({
            id: supGuess.candidate,
            level_interval: FULL_INTERVAL,
            additional_text: supNote || undefined,
          });
          report.guessed.push(
            `support "${sup.nameSpec ?? sup.skillId}" -> ${supGuess.candidate} (${supGuess.confidence} confidence).`
          );
        } else if (supNote) {
          supports.push({ additional_text: `UNRESOLVED support: ${supNote}` });
          report.unsupported.push(
            `support "${sup.nameSpec ?? 'unknown'}" could not be mapped; left in additional_text.`
          );
        }
      }
      if (supports.length) skill.support_skills = supports;

      if (notes.length) skill.additional_text = notes.join(' | ');
      skills.push(skill);
    }
  }

  return skills;
}

function convertPassives(build, report) {
  const nodes = build.tree?.nodes ?? [];
  if (!nodes.length) {
    if (build.tree?.specs?.length) {
      report.unsupported.push(
        'Passive tree was present but allocated nodes could not be extracted (tree stored as an encoded URL). No passives emitted.'
      );
    } else {
      report.warnings.push('No passive tree data found in the build.');
    }
    return [];
  }

  // PoB allocated-node IDs are numeric tree node IDs. Whether these match the
  // exact strings the .build format expects for `passives` is unconfirmed, so
  // we emit them but flag the whole set as guessed.
  report.guessed.push(
    `${nodes.length} passive node id(s) carried over from PoB. These are PoB tree node IDs; confirm they match the official PoE2 passive_id values.`
  );

  // Emit as objects so we can attach a clarifying note on the first one.
  return nodes.map((id, idx) => {
    if (idx === 0) {
      return {
        id: String(id),
        level_interval: FULL_INTERVAL,
        additional_text: 'Passive IDs imported from PoB tree node IDs (unverified).',
      };
    }
    return String(id);
  });
}

function convertItems(build, report) {
  const { list, slots } = build.items ?? { list: [], slots: [] };
  if (!slots.length) {
    if (list.length) {
      report.unsupported.push(
        `${list.length} item(s) were present but no equipped slot mapping (ItemSet) was found; items not emitted.`
      );
    } else {
      report.warnings.push('No items found in the build.');
    }
    return [];
  }

  const byId = new Map(list.map((it) => [it.id, it]));
  const items = [];

  for (const slot of slots) {
    const item = byId.get(slot.itemId);
    const inventoryId = slotToInventoryId(slot.name);

    const out = { level_interval: FULL_INTERVAL };
    const notes = [];

    if (inventoryId) {
      out.inventory_id = inventoryId;
      out.slot_x = 0;
      out.slot_y = 0;
      report.guessed.push(
        `item slot "${slot.name}" -> inventory_id "${inventoryId}" (slot id convention unconfirmed for PoE2).`
      );
    } else {
      notes.push(`UNRESOLVED slot: ${slot.name}`);
      report.unsupported.push(
        `item slot "${slot.name}" has no known PoE2 inventory_id mapping; described in additional_text.`
      );
    }

    if (item) {
      if (item.isUnique && item.uniqueName) {
        out.unique_name = item.uniqueName;
        report.converted.push(
          `unique item "${item.uniqueName}" in slot "${slot.name}".`
        );
      }
      if (item.name) notes.push(item.name);
      if (item.typeLine) notes.push(`Base: ${item.typeLine}`);
      if (item.rarity) notes.push(`Rarity: ${item.rarity}`);
    } else {
      notes.push('item details not found');
    }

    if (notes.length) out.additional_text = notes.join(' | ');
    items.push(out);
  }

  return items;
}
