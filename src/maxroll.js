import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { resolveGemLevel } from './gemLevels.js';

const execFileAsync = promisify(execFile);

const MAXROLL_HOSTS = ['maxroll.gg', 'www.maxroll.gg'];
// Planner path IDs that are NOT build IDs
const EXCLUDED_IDS = new Set([
  'community-builds', 'static', 'external', 'auto-loader',
  'assets', 'planner', 'poe2', 'community', 'build-guides',
]);

export function isMaxrollUrl(input) {
  if (typeof input !== 'string') return false;
  try {
    const url = new URL(input.trim());
    return MAXROLL_HOSTS.includes(url.hostname) && url.pathname.includes('/poe2/');
  } catch {
    return false;
  }
}

/**
 * Fetch and parse a Maxroll PoE2 build from either:
 *   - maxroll.gg/poe2/planner/XXXXX  (direct planner link)
 *   - maxroll.gg/poe2/build-guides/slug  (guide with embedded planner link)
 */
export async function fetchMaxrollData(input, opts = {}) {
  const { timeoutMs = 20000 } = opts;
  const html = await fetchPageHtml(input.trim(), timeoutMs);

  let plannerHtml = html;
  let sourceName = cleanMaxrollTitle(extractPageTitle(html));

  // Build guide pages don't embed planner data — extract ID and fetch planner page
  if (!html.includes('poe2-planner-by-id')) {
    const plannerId = extractPlannerId(html);
    if (!plannerId) {
      throw new Error(
        'No Maxroll planner found on this page. Make sure the build guide has an attached planner.'
      );
    }
    plannerHtml = await fetchPageHtml(
      `https://maxroll.gg/poe2/planner/${plannerId}`,
      timeoutMs
    );
  }

  const parsed = parseMaxrollPage(plannerHtml, opts);
  return {
    build: parsed.build,
    sourceName: parsed.sourceName || sourceName,
  };
}

/**
 * Inspect a Maxroll URL — return available sets (equipment variants, passive
 * variants, skill steps) so the UI can show selectors before converting.
 */
export async function inspectMaxrollUrl(input, { timeoutMs = 20000 } = {}) {
  try {
    const { timeoutMs: _t, ...opts } = { timeoutMs };
    const html = await fetchPageHtml(input.trim(), timeoutMs);

    let plannerHtml = html;
    if (!html.includes('poe2-planner-by-id')) {
      const plannerId = extractPlannerId(html);
      if (!plannerId) return { skillSets: [], itemSets: [], treeSpecs: [], meta: {} };
      plannerHtml = await fetchPageHtml(
        `https://maxroll.gg/poe2/planner/${plannerId}`,
        timeoutMs
      );
    }

    const profile = extractProfile(plannerHtml);
    const data = JSON.parse(profile.data);
    const planner = data.planner ?? {};
    const ascKey = planner.ascendancy ?? profile.class ?? '';
    const className = ascKey.replace(/\d+$/, '');

    const skillSets = (planner.skills?.steps ?? []).map((s, i) => ({
      id: i,
      title: s.name || `Step ${i + 1}`,
    }));
    const itemSets = (planner.equipment?.variants ?? []).map((v, i) => ({
      id: i,
      title: v.name || `Variant ${i + 1}`,
    }));
    const treeSpecs = (planner.passives?.variants ?? []).map((v, i) => ({
      index: i,
      title: v.name || `Variant ${i + 1}`,
      treeVersion: '',
    }));

    return {
      meta: { level: planner.level, className, ascendClassName: ascKey },
      skillSets,
      itemSets,
      treeSpecs,
    };
  } catch {
    return { skillSets: [], itemSets: [], treeSpecs: [], meta: {} };
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function extractPlannerId(html) {
  // Match /planner/XXXX where XXXX is 4-12 alphanumeric chars
  const re = /\/planner\/([A-Za-z0-9]{4,12})(?=[^A-Za-z0-9/]|$)/g;
  const counts = new Map();
  let m;
  while ((m = re.exec(html)) !== null) {
    const id = m[1];
    if (EXCLUDED_IDS.has(id)) continue;
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }

  if (!counts.size) return null;

  return [...counts.entries()]
    .sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1];
      if (b[0].length !== a[0].length) return b[0].length - a[0].length;
      return a[0].localeCompare(b[0]);
    })[0][0];
}

function extractProfile(html) {
  const ctx = extractRemixContext(html);

  const loaderData = ctx?.state?.loaderData ?? {};
  for (const v of Object.values(loaderData)) {
    if (v && typeof v === 'object' && v.profile) return v.profile;
  }
  throw new Error('Could not find build profile in Maxroll planner page');
}

function extractRemixContext(html) {
  const assignIdx = html.indexOf('__remixContext');
  if (assignIdx === -1) {
    throw new Error('Could not find Maxroll page data (is this a valid planner URL?)');
  }

  const start = html.indexOf('{', assignIdx);
  if (start === -1) {
    throw new Error('Could not find Maxroll page data payload');
  }

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < html.length; i++) {
    const ch = html[i];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === '\\') {
        escaped = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === '{') {
      depth++;
      continue;
    }
    if (ch === '}') {
      depth--;
      if (depth === 0) {
        const raw = html.slice(start, i + 1);
        try {
          return JSON.parse(raw);
        } catch (e) {
          throw new Error(`Failed to parse Maxroll page data: ${e.message}`);
        }
      }
    }
  }

  throw new Error('Could not find end of Maxroll page data payload');
}

function parseMaxrollPage(html, opts = {}) {
  const profile = extractProfile(html);
  const data = JSON.parse(profile.data);
  const planner = data.planner ?? {};

  const ascKey = planner.ascendancy ?? profile.class ?? '';
  const className = ascKey.replace(/\d+$/, '');

  // Default to last step/variant (endgame) unless caller specifies otherwise
  const skillStep = opts.skillSetId ?? (planner.skills?.steps?.length ?? 1) - 1;
  const itemVariant = opts.itemSetId ?? (planner.equipment?.variants?.length ?? 1) - 1;
  const passiveVariant = opts.specIndex ?? (planner.passives?.variants?.length ?? 1) - 1;

  return {
    sourceName: cleanMaxrollTitle(
      profile.name ||
      planner.name ||
      data.name ||
      extractPageTitle(html)
    ),
    build: {
      meta: {
        level: planner.level ?? 1,
        className,
        ascendClassName: ascKey,
        mainSocketGroup: 0,
      },
      skills: parseMaxrollSkills(planner.skills, skillStep),
      tree: parseMaxrollPassives(planner.passives, passiveVariant),
      items: parseMaxrollItems(data.items ?? {}, planner.equipment, itemVariant),
      notes: typeof planner.notes === 'string' ? planner.notes : '',
    },
  };
}

function parseMaxrollSkills(skillsData, stepIndex) {
  if (!skillsData?.steps?.length) return [];
  const idx = Math.min(Math.max(0, stepIndex ?? 0), skillsData.steps.length - 1);
  const step = skillsData.steps[idx];

  const result = [];
  for (const group of (step.skills ?? [])) {
    const gems = (group.gems ?? []).map((g) => {
      const isSupport = g.id.includes('SupportGem');
      const displayName = deriveMaxrollGemName(g.id);
      return {
        gemId: g.id,
        nameSpec: displayName,
        displayName,
        level: resolveGemLevel(g.level, displayName, g.id, { preferNameSuffix: isSupport }),
        quality: g.quality ?? 0,
        enabled: !g.corrupted,
        isSupport,
      };
    });
    if (!gems.length) continue;
    result.push({
      enabled: true,
      slot: undefined,
      gems,
      actives: gems.filter((g) => !g.isSupport),
      supports: gems.filter((g) => g.isSupport),
      allGems: gems,
    });
  }
  return result;
}

function deriveMaxrollGemName(id) {
  const token = String(id ?? '').split('/').pop() ?? '';
  return token
    .replace(/^SkillGem/, '')
    .replace(/^SupportGem/, '')
    .replace(/([a-z])([A-Z0-9])/g, '$1 $2')
    .replace(/([0-9])([A-Z])/g, '$1 $2')
    .replace(/\bTwo\b/g, 'II')
    .replace(/\bThree\b/g, 'III')
    .replace(/\bFour\b/g, 'IV')
    .trim();
}

function parseMaxrollPassives(passivesData, variantIndex) {
  if (!passivesData?.variants?.length) return { nodes: [], specs: [] };
  const idx = Math.min(Math.max(0, variantIndex ?? 0), passivesData.variants.length - 1);
  const specs = passivesData.variants.map((v) => ({ nodes: v.history ?? [] }));
  return { nodes: specs[idx].nodes, specs };
}

function parseMaxrollItems(itemCatalog, equipmentData, variantIndex) {
  if (!equipmentData?.variants?.length) return { list: [], slots: [], catalog: {} };
  const idx = Math.min(Math.max(0, variantIndex ?? 0), equipmentData.variants.length - 1);
  const variant = equipmentData.variants[idx];
  const slotMap = variant.items ?? {};

  const catalog = {};
  const slots = [];

  for (const [slotName, itemId] of Object.entries(slotMap)) {
    const raw = itemCatalog[String(itemId)];
    if (!raw) continue;
    const item = parseMaxrollItem(raw, itemId);
    catalog[String(itemId)] = item;
    // Translate maxroll slot names → PoB-compatible slot names
    slots.push({ name: translateMaxrollSlot(slotName), itemId: String(itemId) });
  }

  return { list: Object.values(catalog), slots, catalog };
}

function parseMaxrollItem(raw, id) {
  const rarity = (raw.rarity ?? 'normal').toUpperCase();
  const basePath = raw.base ?? '';
  const baseType = basePath.split('/').pop() ?? basePath;

  // Unique items: `raw.unique` holds the internal unique ID
  const isUnique = rarity === 'UNIQUE';
  const uniqueName = isUnique ? (raw.unique ?? undefined) : undefined;

  const implicits = formatMaxrollStats(raw.stats?.implicit ?? {});
  const explicits = [
    ...formatMaxrollStats(raw.stats?.explicit ?? {}),
    ...formatMaxrollStats(raw.stats?.enchant ?? {}),
  ];
  const runes = extractMaxrollRunes(raw);

  // Readable item name: for non-uniques, label is rarity + base type
  const name = isUnique ? (raw.unique ?? baseType) : baseType;
  const typeLine = isUnique ? baseType : '';

  return {
    id: String(id),
    rarity,
    name,
    typeLine,
    isUnique,
    uniqueName,
    implicits,
    explicits,
    runes,
    raw: basePath,
  };
}

function extractMaxrollRunes(raw) {
  const socketNames = (raw.sockets ?? [])
    .map((socket) => formatMaxrollRuneName(socket))
    .filter(Boolean);
  if (socketNames.length) return socketNames;

  return formatMaxrollStats(raw.stats?.rune ?? {}).map((line) => line.trim()).filter(Boolean);
}

function formatMaxrollRuneName(value) {
  const token = String(value ?? '').split('/').pop() ?? '';
  if (!token) return '';
  return token
    .replace(/^SoulCore/, 'Soul Core ')
    .replace(/^Rune/, '')
    .replace(/([a-z])([A-Z0-9])/g, '$1 $2')
    .replace(/([0-9])([A-Z])/g, '$1 $2')
    .trim();
}

/**
 * Convert a maxroll stat map like { "minion_damage_+%": 10 }
 * to human-readable strings like "+10% Minion Damage".
 */
function formatMaxrollStats(stats) {
  return Object.entries(stats).map(([key, val]) => {
    const isPercent = key.endsWith('+%') || key.endsWith('_%') || key.endsWith('resistance_%');
    const label = key
      .replace(/_\+%$/, '')
      .replace(/_%$/, '')
      .replace(/_\+$/, '')
      .replace(/^local_/, '')
      .replace(/^base_/, '')
      .replace(/^additional_/, '')
      .replace(/_/g, ' ')
      .trim();
    const pct = isPercent ? '%' : '';
    const sign = typeof val === 'number' && val > 0 ? '+' : '';
    return `${sign}${val}${pct} ${label}`.trim();
  });
}

/** Map maxroll slot names to PoB-compatible names used by the converter. */
function translateMaxrollSlot(name) {
  const map = {
    Weapon: 'Weapon 1',
    Offhand: 'Weapon 2',
    Weapon2: 'Weapon 1 Swap',
    Offhand2: 'Weapon 2 Swap',
  };
  return map[name] ?? name;
}

async function fetchPageHtml(url, timeoutMs) {
  const curlBin = process.platform === 'win32' ? 'curl.exe' : 'curl';
  const timeoutSec = Math.ceil(timeoutMs / 1000);
  const { stdout } = await execFileAsync(
    curlBin,
    [
      '-sL',
      '--max-time', String(timeoutSec),
      '-H', 'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      '-H', 'Accept: text/html,application/xhtml+xml,*/*;q=0.9',
      '-H', 'Accept-Language: en-US,en;q=0.9',
      url,
    ],
    { maxBuffer: 20 * 1024 * 1024 }
  );
  if (stdout.length < 1000 || stdout.includes('Just a moment')) {
    throw new Error('Maxroll page blocked by bot protection — try again in a moment.');
  }
  return stdout;
}

function extractPageTitle(html) {
  const meta = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i);
  if (meta?.[1]) return decodeHtml(meta[1]).trim();

  const title = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (title?.[1]) return decodeHtml(title[1]).trim();

  return '';
}

function cleanMaxrollTitle(title) {
  return String(title ?? '')
    .replace(/^Home News,\s*/i, '')
    .replace(/\s*[|:-]\s*Maxroll(?:\.gg)?\s*$/i, '')
    .replace(/\s*[|:-]\s*Path of Exile 2\s*$/i, '')
    .replace(/\s*[|:-]\s*PoE\s*2\s*$/i, '')
    .trim();
}

function decodeHtml(str) {
  return String(str ?? '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}
