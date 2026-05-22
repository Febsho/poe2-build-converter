import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const MAXROLL_HOSTS = ['maxroll.gg', 'www.maxroll.gg'];
// Planner path IDs that are NOT build IDs
const EXCLUDED_IDS = new Set([
  'community-builds', 'static', 'external', 'auto-loader',
  'assets', 'planner', 'poe2',
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

  return parseMaxrollPage(plannerHtml, opts);
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
  let m;
  while ((m = re.exec(html)) !== null) {
    if (!EXCLUDED_IDS.has(m[1])) return m[1];
  }
  return null;
}

function extractProfile(html) {
  // __remixContext is a large JSON blob; use a regex that stops at </script>
  const m = html.match(/__remixContext\s*=\s*(\{[\s\S]*?);\s*<\/script>/);
  if (!m) throw new Error('Could not find Maxroll page data (is this a valid planner URL?)');

  let ctx;
  try {
    ctx = JSON.parse(m[1]);
  } catch (e) {
    throw new Error(`Failed to parse Maxroll page data: ${e.message}`);
  }

  const loaderData = ctx?.state?.loaderData ?? {};
  for (const v of Object.values(loaderData)) {
    if (v && typeof v === 'object' && v.profile) return v.profile;
  }
  throw new Error('Could not find build profile in Maxroll planner page');
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
      return {
        gemId: g.id,
        nameSpec: g.id.split('/').pop() ?? '',
        level: g.level ?? 1,
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
    ...formatMaxrollStats(raw.stats?.rune ?? {}),
    ...formatMaxrollStats(raw.stats?.enchant ?? {}),
  ];

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
    raw: basePath,
  };
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
