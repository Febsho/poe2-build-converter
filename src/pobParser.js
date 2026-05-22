import zlib from 'node:zlib';
import { XMLParser } from 'fast-xml-parser';

/**
 * Decode a Path of Building export code into its raw XML string.
 *
 * PoB export codes are URL-safe base64 of a zlib-compressed XML document.
 * Some sources use standard base64, some strip padding, and a few use raw
 * deflate without a zlib header, so we try a few decode strategies.
 */
export function decodePobCode(code) {
  if (typeof code !== 'string') {
    throw new Error('PoB code must be a string');
  }

  // Strip whitespace/newlines that often sneak in from copy-paste.
  let cleaned = code.trim().replace(/\s+/g, '');

  // Some people paste a full URL fragment or "code=..." prefix.
  const eq = cleaned.lastIndexOf('=');
  if (cleaned.includes('code=') && eq !== -1 && eq < cleaned.length - 1) {
    cleaned = cleaned.slice(eq + 1);
  }

  // Convert URL-safe base64 to standard base64.
  let b64 = cleaned.replace(/-/g, '+').replace(/_/g, '/');
  // Restore padding.
  while (b64.length % 4 !== 0) b64 += '=';

  let compressed;
  try {
    compressed = Buffer.from(b64, 'base64');
  } catch {
    throw new Error('Input is not valid base64');
  }

  if (compressed.length === 0) {
    throw new Error('Decoded payload was empty');
  }

  const attempts = [
    // Modern PoB prepends a version byte (0x01 / 0x02) before the zlib stream.
    // Try skipping it first since it's now the common case.
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

/**
 * Parse PoB XML into a normalized, source-agnostic build object that the
 * converter can consume. Everything here is "what PoB gave us", not yet
 * mapped to the official PoE2 format.
 */
export function parsePobXml(xml) {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    allowBooleanAttributes: true,
    parseAttributeValue: false,
    trimValues: true,
    // Keep these as arrays even when there is only one element.
    isArray: (name) =>
      ['Skill', 'Gem', 'Item', 'Slot', 'Spec', 'SkillSet', 'Node'].includes(name),
  });

  const doc = parser.parse(xml);
  const root = doc.PathOfBuilding ?? {};

  return {
    meta: parseBuildMeta(root.Build),
    skills: parseSkills(root.Skills),
    tree: parseTree(root.Tree),
    items: parseItems(root.Items),
    notes: extractNotes(root),
  };
}

function attr(node, name, fallback = undefined) {
  if (!node) return fallback;
  const v = node[`@_${name}`];
  return v === undefined ? fallback : v;
}

function parseBuildMeta(build) {
  if (!build) return {};
  return {
    level: toInt(attr(build, 'level')),
    className: attr(build, 'className'),
    ascendClassName: attr(build, 'ascendClassName'),
    mainSocketGroup: toInt(attr(build, 'mainSocketGroup')),
    bandit: attr(build, 'bandit'),
    targetVersion: attr(build, 'targetVersion'),
  };
}

function parseSkills(skills) {
  if (!skills) return [];

  // PoB may store multiple skill sets; prefer the active one, else the first.
  const sets = asArray(skills.SkillSet);
  let skillNodes;
  if (sets.length) {
    const activeId = attr(skills, 'activeSkillSet');
    const active =
      sets.find((s) => String(attr(s, 'id')) === String(activeId)) ?? sets[0];
    skillNodes = asArray(active.Skill);
  } else {
    skillNodes = asArray(skills.Skill);
  }

  return skillNodes
    .map((skill) => {
      const gems = asArray(skill.Gem).map(parseGem);
      // In PoB, a "Skill" is a socket group: typically the first active gem is
      // the main skill and the rest are supports. Active vs support is flagged.
      const actives = gems.filter((g) => !g.isSupport);
      const supports = gems.filter((g) => g.isSupport);
      return {
        slot: attr(skill, 'slot'),
        enabled: attr(skill, 'enabled') !== 'false',
        isMainGroup: attr(skill, 'mainActiveSkill') !== undefined,
        label: attr(skill, 'label'),
        actives,
        supports,
        allGems: gems,
      };
    })
    .filter((g) => g.allGems.length > 0);
}

function parseGem(gem) {
  const nameSpec = attr(gem, 'nameSpec') ?? attr(gem, 'name');
  // PoB marks supports either via skillId starting "Support" or a flag.
  const skillId = attr(gem, 'skillId') ?? attr(gem, 'gemId');
  const variantId = attr(gem, 'variantId');
  const isSupport =
    attr(gem, 'support') === 'true' ||
    (typeof skillId === 'string' && /support/i.test(skillId)) ||
    (typeof nameSpec === 'string' && /\bsupport\b/i.test(nameSpec));

  return {
    nameSpec,
    skillId,
    variantId,
    level: toInt(attr(gem, 'level')),
    quality: toInt(attr(gem, 'quality')),
    enabled: attr(gem, 'enabled') !== 'false',
    isSupport,
  };
}

function parseTree(tree) {
  if (!tree) return { nodes: [], specs: [] };

  const specs = asArray(tree.Spec).map((spec) => {
    let nodes = [];

    // PoB stores allocated nodes either as a comma-separated "nodes" attr,
    // inside a tree URL, or as <Node> children.
    const nodesAttr = attr(spec, 'nodes');
    if (typeof nodesAttr === 'string' && nodesAttr.length) {
      nodes = nodesAttr
        .split(',')
        .map((n) => n.trim())
        .filter(Boolean);
    }

    const url = attr(spec, 'treeVersion') ? undefined : extractText(spec);
    if (!nodes.length && typeof url === 'string') {
      nodes = nodesFromTreeUrl(url);
    }

    return {
      treeVersion: attr(spec, 'treeVersion'),
      ascendClassId: attr(spec, 'ascendClassId'),
      classId: attr(spec, 'classId'),
      nodes,
    };
  });

  // Surface the active spec's nodes (first spec is the default in PoB).
  const active = specs[0] ?? { nodes: [] };
  return { nodes: active.nodes, specs };
}

function nodesFromTreeUrl(url) {
  // Tree-sharing URLs encode allocated nodes in a base64 blob after the last
  // slash. Decoding the exact node IDs is version-specific and brittle, so we
  // only attempt the simple comma-list case elsewhere. Return empty here and
  // let the converter flag the tree as unresolved.
  if (typeof url !== 'string' || !/passive-skill-tree|poeplanner|/.test(url)) {
    return [];
  }
  return [];
}

function parseItems(items) {
  if (!items) return { list: [], slots: [] };

  const list = asArray(items.Item).map((item) => {
    const id = attr(item, 'id');
    const rawText = extractText(item) ?? '';
    return {
      id: id !== undefined ? String(id) : undefined,
      ...parseItemText(rawText),
      raw: rawText,
    };
  });

  // Slot -> item mapping lives in the active ItemSet.
  const sets = asArray(items.ItemSet);
  let slotNodes = [];
  if (sets.length) {
    const activeId = attr(items, 'activeItemSet');
    const active =
      sets.find((s) => String(attr(s, 'id')) === String(activeId)) ?? sets[0];
    slotNodes = asArray(active.Slot);
  } else {
    slotNodes = asArray(items.Slot);
  }

  const slots = slotNodes
    .map((slot) => ({
      name: attr(slot, 'name'),
      itemId: attr(slot, 'itemId') ? String(attr(slot, 'itemId')) : undefined,
    }))
    .filter((s) => s.name && s.itemId && s.itemId !== '0');

  return { list, slots };
}

/**
 * PoB item blocks are plain text. We extract the rarity, names and the first
 * couple of lines so the converter can emit useful hints without claiming to
 * fully understand affixes.
 */
function parseItemText(text) {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  let rarity;
  let name;
  let typeLine;

  let cursor = 0;
  if (lines[cursor]?.toLowerCase().startsWith('rarity:')) {
    rarity = lines[cursor].split(':')[1]?.trim();
    cursor++;
  }
  if (lines[cursor]) {
    name = lines[cursor];
    cursor++;
  }
  // For uniques/rares the next line is usually the base type.
  if (lines[cursor] && !/:/.test(lines[cursor])) {
    typeLine = lines[cursor];
  }

  const isUnique = (rarity ?? '').toUpperCase() === 'UNIQUE';

  return {
    rarity,
    name,
    typeLine,
    isUnique,
    uniqueName: isUnique ? name : undefined,
    summaryLines: lines.slice(0, 6),
  };
}

function extractNotes(root) {
  const notes = root.Notes;
  if (typeof notes === 'string') return notes.trim();
  if (notes && typeof notes === 'object') {
    const text = extractText(notes);
    return typeof text === 'string' ? text.trim() : '';
  }
  return '';
}

// --- small helpers -------------------------------------------------------

function asArray(v) {
  if (v === undefined || v === null) return [];
  return Array.isArray(v) ? v : [v];
}

function extractText(node) {
  if (node === undefined || node === null) return undefined;
  if (typeof node === 'string') return node;
  if (typeof node === 'object') {
    if (typeof node['#text'] === 'string') return node['#text'];
  }
  return undefined;
}

function toInt(v) {
  if (v === undefined || v === null || v === '') return undefined;
  const n = parseInt(v, 10);
  return Number.isNaN(n) ? undefined : n;
}
