import { execFile } from 'node:child_process';
import fs from 'node:fs';
import { promisify } from 'node:util';
import { decodePobCode, parsePobXml } from './pobParser.js';
import { fetchPobbinCode, isPobbinUrl } from './pobbin.js';
import { resolveGemLevel } from './gemLevels.js';

const execFileAsync = promisify(execFile);
const MOBALYTICS_HOSTS = ['mobalytics.gg', 'www.mobalytics.gg'];
const POE2_CLASSES = ['Warrior', 'Sorceress', 'Witch', 'Ranger', 'Huntress', 'Mercenary', 'Monk', 'Druid'];
const POE2_ASCENDANCIES = [
  'Titan', 'Warbringer', 'Smith of Kitava',
  'Deadeye', 'Pathfinder', 'Ritualist', 'Amazon',
  'Infernalist', 'Blood Mage', 'Lich', 'Abyssal Lich',
  'Witchhunter', 'Gemling Legionnaire', 'Tactician',
  'Invoker', 'Acolyte of Chayula',
  'Stormweaver', 'Chronomancer',
  'Shaman', 'Oracle', 'Disciple of Varashta',
];

export function isMobalyticsUrl(input) {
  if (typeof input !== 'string') return false;
  try {
    const url = new URL(input.trim());
    return MOBALYTICS_HOSTS.includes(url.hostname) && url.pathname.includes('/poe-2');
  } catch {
    return false;
  }
}

/**
 * Fetch a Mobalytics PoE2 build by URL, resolve its pobCode (pobb.in URL or
 * raw PoB export), and return a normalized build object.
 */
export async function fetchMobalyticsData(input, opts = {}) {
  const { timeoutMs = 15000, skillSetId, itemSetId, specIndex } = opts;
  const parsed = new URL(input.trim());
  const requestedVariantId = extractRequestedVariantId(parsed);

  // Extract slug from pathname: /poe-2/builds/<slug>
  const slug = parsed.pathname.replace(/\/+$/, '').split('/').pop();
  if (!slug) throw new Error('Could not extract build slug from Mobalytics URL');

  const page = await fetchBuildPage(slug, timeoutMs);
  const gemNameMap = extractMobalyticsGemNameMap(page.html);
  const pobLinks = extractPobLinks(page.html);
  const preloadedState = extractPreloadedState(page.html);
  const doc = preloadedState ? findBuildDocument(preloadedState) : null;
  const defaultVariantIndex = getDefaultVariantIndex(doc, requestedVariantId);

  if (doc?.pobCode || pobLinks.length === 1) {
    const pobCode = doc?.pobCode || pobLinks[0];
    let xml;
    if (isPobbinUrl(pobCode)) {
      const code = await fetchPobbinCode(pobCode, { timeoutMs });
      xml = decodePobCode(code);
    } else {
      xml = decodePobCode(pobCode);
    }

    const build = parsePobXml(xml, { skillSetId, itemSetId, specIndex });
    if (doc) {
      const treeVariant = getBuildVariant(doc, specIndex, defaultVariantIndex);
      if (treeVariant?.passiveTree) {
        build.tree = mergeMobalyticsPassiveTree(build.tree, treeVariant.passiveTree);
      }
    }

    return {
      build,
      sourceName: doc?.name || page.title,
    };
  }

  return {
    build: buildFromPageData(doc, {
      skillSetId,
      itemSetId,
      specIndex,
      defaultVariantIndex,
      fallbackName: page.title,
      gemNameMap,
    }),
    sourceName: doc?.name || page.title,
  };
}

/**
 * Inspect a Mobalytics URL — return available sets for the set selector.
 * Fetches the pobCode and delegates to getAvailableSets.
 */
export async function inspectMobalyticsUrl(input, { timeoutMs = 15000 } = {}) {
  const { getAvailableSets } = await import('./pobParser.js');
  const parsed = new URL(input.trim());
  const requestedVariantId = extractRequestedVariantId(parsed);
  const slug = parsed.pathname.replace(/\/+$/, '').split('/').pop();
  if (!slug) return { skillSets: [], itemSets: [], treeSpecs: [], meta: {} };

  try {
    const page = await fetchBuildPage(slug, timeoutMs);
    const pobLinks = extractPobLinks(page.html);
    const preloadedState = extractPreloadedState(page.html);
    const doc = preloadedState ? findBuildDocument(preloadedState) : null;

    if (doc?.pobCode || pobLinks.length === 1) {
      const pobCode = doc?.pobCode || pobLinks[0];
      let xml;
      if (isPobbinUrl(pobCode)) {
        const code = await fetchPobbinCode(pobCode, { timeoutMs });
        xml = decodePobCode(code);
      } else {
        xml = decodePobCode(pobCode);
      }
      return getAvailableSets(xml);
    }

    if (!doc) return { skillSets: [], itemSets: [], treeSpecs: [], meta: {} };
    return inspectBuildPageData(doc, page.title, requestedVariantId);
  } catch {
    return { skillSets: [], itemSets: [], treeSpecs: [], meta: {} };
  }
}

/**
 * Fetch a Mobalytics build page via curl (bypasses Cloudflare's TLS
 * fingerprint check that blocks Node.js's built-in fetch) and extract
 * the embedded pobb.in URL from the page HTML.
 */
async function fetchBuildPage(slug, timeoutMs) {
  const url = `https://mobalytics.gg/poe-2/builds/${slug}`;
  let stdout = '';
  try {
    stdout = await fetchPageViaCurl(url, timeoutMs);
  } catch {
    // Fall through to browser-based fetch.
  }

  if (stdout.includes('Just a moment') || stdout.length < 1000) {
    stdout = await fetchPageViaBrowser(url, timeoutMs);
  }

  return {
    html: stdout,
    title: cleanMobalyticsTitle(extractPageTitle(stdout)),
  };
}

async function fetchPageViaCurl(url, timeoutMs) {
  const timeoutSec = Math.ceil(timeoutMs / 1000);
  const curlBin = process.platform === 'win32' ? 'curl.exe' : 'curl';
  const { stdout } = await execFileAsync(curlBin, [
    '-sL',
    '--max-time', String(timeoutSec),
    '-H', 'User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    '-H', 'Accept: text/html,application/xhtml+xml,*/*;q=0.9',
    '-H', 'Accept-Language: en-US,en;q=0.9',
    url,
  ], { maxBuffer: 15 * 1024 * 1024 });
  return stdout;
}

async function fetchPageViaBrowser(url, timeoutMs) {
  const browserPath = findChromeExecutable();
  if (!browserPath) {
    throw new Error('Mobalytics page is protected and no local Chrome/Chromium executable was found.');
  }

  const args = [
    '--headless=new',
    '--disable-gpu',
    '--no-first-run',
    '--disable-background-networking',
    '--disable-default-apps',
    '--disable-extensions',
    '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    `--virtual-time-budget=${Math.max(8000, Math.min(timeoutMs - 1000, 15000))}`,
    '--dump-dom',
    url,
  ];

  const { stdout } = await execFileAsync(browserPath, args, {
    maxBuffer: 30 * 1024 * 1024,
    timeout: timeoutMs,
    windowsHide: true,
  });
  return stdout;
}

function extractPobLinks(html) {
  const matches = html.match(/https:\/\/pobb\.in\/[^\s"'<>]+/g) ?? [];
  return [...new Set(matches)];
}

function extractPreloadedState(html) {
  const marker = 'window.__PRELOADED_STATE__=';
  const assignIdx = html.indexOf(marker);
  if (assignIdx === -1) return null;

  const start = html.indexOf('{', assignIdx);
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = start; i < html.length; i++) {
    const ch = html[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
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
        try {
          return JSON.parse(html.slice(start, i + 1));
        } catch {
          return null;
        }
      }
    }
  }

  return null;
}

function findBuildDocument(state) {
  return state?.poe2State?.apollo?.graphqlV2?.queries?.[1]?.state?.data?.[0]?.game?.documents?.userGeneratedDocumentBySlug?.data?.data
    ?? null;
}

function inspectBuildPageData(doc, fallbackTitle, requestedVariantId) {
  const values = doc?.buildVariants?.values ?? [];
  const title = doc?.name || fallbackTitle;
  const meta = extractMetaFromTitle(title);
  const requestedIndex = findVariantIndex(doc, requestedVariantId);
  const makeTitle = (i) => {
    const base = values.length > 1 ? `Variant ${i + 1}` : 'Default';
    return i === requestedIndex ? `${base} (linked)` : base;
  };

  return {
    meta,
    skillSets: values.map((_, i) => ({ id: i, title: makeTitle(i) })),
    itemSets: values.map((_, i) => ({ id: i, title: makeTitle(i) })),
    treeSpecs: values.map((_, i) => ({ index: i, title: makeTitle(i), treeVersion: '' })),
  };
}

function buildFromPageData(doc, { skillSetId, itemSetId, specIndex, defaultVariantIndex = 0, fallbackName, gemNameMap }) {
  if (!doc?.buildVariants?.values?.length) {
    throw new Error('No supported build data found on this Mobalytics page.');
  }

  const title = doc.name || fallbackName || '';
  const meta = extractMetaFromTitle(title);
  const skillsVariant = getBuildVariant(doc, skillSetId, defaultVariantIndex);
  const itemsVariant = getBuildVariant(doc, itemSetId, defaultVariantIndex);
  const treeVariant = getBuildVariant(doc, specIndex, defaultVariantIndex);

  return {
    meta,
    skills: parseMobalyticsSkills(skillsVariant?.skillGems, gemNameMap),
    tree: parseMobalyticsTree(treeVariant?.passiveTree),
    items: parseMobalyticsItems(itemsVariant?.equipment),
    notes: '',
  };
}

function getBuildVariant(doc, requestedIndex, defaultVariantIndex = 0) {
  const values = doc?.buildVariants?.values ?? [];
  if (!values.length) return null;
  const idx = requestedIndex != null ? requestedIndex : defaultVariantIndex;
  return values[Math.max(0, Math.min(idx, values.length - 1))] ?? values[defaultVariantIndex] ?? values[0];
}

function getDefaultVariantIndex(doc, requestedVariantId) {
  const values = doc?.buildVariants?.values ?? [];
  if (!values.length) return 0;
  const requestedIndex = findVariantIndex(doc, requestedVariantId);
  if (requestedIndex >= 0) return requestedIndex;
  let bestIndex = 0;
  let bestScore = -1;

  for (let i = 0; i < values.length; i++) {
    const variant = values[i];
    const score =
      (variant?.passiveTree?.mainTree?.selectedSlugs?.length ?? 0) +
      (variant?.passiveTree?.set1Tree?.selectedSlugs?.length ?? 0) +
      (variant?.passiveTree?.set2Tree?.selectedSlugs?.length ?? 0) +
      (variant?.passiveTree?.ascendancyTree?.selectedSlugs?.length ?? 0) +
      (variant?.skillGems?.gems?.length ?? 0) +
      Object.keys(variant?.equipment ?? {}).length;

    if (score >= bestScore) {
      bestIndex = i;
      bestScore = score;
    }
  }

  return bestIndex;
}

function findVariantIndex(doc, requestedVariantId) {
  if (requestedVariantId == null) return -1;
  const values = doc?.buildVariants?.values ?? [];
  return values.findIndex((variant) => String(variant?.id) === String(requestedVariantId));
}

function extractRequestedVariantId(parsedUrl) {
  if (!parsedUrl?.searchParams) return null;
  if (parsedUrl.searchParams.has('activeVariantId')) {
    return parsedUrl.searchParams.get('activeVariantId');
  }

  for (const value of parsedUrl.searchParams.values()) {
    const match = String(value).match(/(?:^|,)activeVariantId,([^,]+)/);
    if (match?.[1]) return match[1];
  }

  return null;
}

function parseMobalyticsSkills(skillGems, gemNameMap = new Map()) {
  const groups = skillGems?.gems ?? [];
  return groups
    .map((group) => parseMobalyticsSkillGroup(group, gemNameMap))
    .filter((group) => group && group.allGems.length);
}

function parseMobalyticsSkillGroup(group, gemNameMap) {
  const actives = [];
  const supports = [];

  const activeGem = parseMobalyticsGem(
    group?.activeSkill,
    'ACTIVE',
    group?.weaponSet,
    gemNameMap,
  );
  if (activeGem) actives.push(activeGem);

  for (const subSkill of group?.subSkills ?? []) {
    const parsedGem = parseMobalyticsGem(subSkill, subSkill?.gemType, group?.weaponSet, gemNameMap);
    if (!parsedGem) continue;
    if (parsedGem.isSupport) supports.push(parsedGem);
    else actives.push(parsedGem);
  }

  const gems = [...actives, ...supports];
  if (!gems.length) return null;

  return {
    slot: weaponSetToSlot(group?.weaponSet),
    enabled: true,
    gems,
    actives,
    supports,
    allGems: gems,
    additional_text: group?.additional_text ?? group?.additionalText ?? group?.comment ?? group?.description ?? group?.notes ?? undefined,
    level_interval: group?.level_interval ?? group?.levelInterval ?? undefined,
  };
}

function parseMobalyticsGem(gem, gemType, weaponSet, gemNameMap) {
  const slug = gem?.gemSlug ?? '';
  const displayName = gem?.name || gemNameMap.get(slug) || deriveGemNameFromSlug(slug, gemType);
  const nameSpec = displayName || slug;
  const isSupport = String(gemType).toUpperCase() === 'SUPPORT';
  const gemId = deriveMobalyticsGemId(gem, isSupport);
  if (!gemId && !nameSpec) return null;

  return {
    gemId: gemId || undefined,
    variantId: '',
    nameSpec,
    displayName,
    skillId: slug || sanitizeToken(nameSpec),
    level: resolveGemLevel(gem?.level, displayName, nameSpec, slug, gemId, { preferNameSuffix: isSupport }),
    quality: 0,
    enabled: true,
    isSupport,
    weaponSet,
    additional_text: gem?.additional_text ?? gem?.additionalText ?? gem?.comment ?? gem?.description ?? gem?.notes ?? undefined,
    level_interval: gem?.level_interval ?? gem?.levelInterval ?? undefined,
  };
}

function deriveMobalyticsGemId(gem, isSupport) {
  const iconCandidate = fileStemFromUrl(gem?.gemIconURL) || fileStemFromUrl(gem?.iconURL);
  const iconBased = iconCandidate ? normalizeMobalyticsGemToken(iconCandidate, isSupport) : '';
  if (iconBased) return `Metadata/Items/Gems/${iconBased}`;

  const slugBased = normalizeMobalyticsGemToken(slugToGemToken(gem?.gemSlug), isSupport);
  if (slugBased) return `Metadata/Items/Gems/${slugBased}`;

  const nameBased = normalizeMobalyticsGemToken(sanitizeToken(gem?.name), isSupport);
  if (nameBased) return `Metadata/Items/Gems/${nameBased}`;

  return '';
}

function normalizeMobalyticsGemToken(token, isSupport) {
  const clean = sanitizeToken(token);
  if (!clean || clean === 'BlankGem') return '';

  if (isSupport) {
    if (clean.startsWith('SupportGem')) return clean;
    if (clean.endsWith('SupportGem')) return `SupportGem${clean.slice(0, -'SupportGem'.length)}`;
    return clean.startsWith('Support') ? clean : `SupportGem${clean.replace(/^Support/, '')}`;
  }

  if (clean.startsWith('SkillGem')) return clean;
  if (clean.endsWith('SkillGem')) return `SkillGem${clean.slice(0, -'SkillGem'.length)}`;
  return `SkillGem${clean}`;
}

function slugToGemToken(slug) {
  return sanitizeToken(
    String(slug ?? '')
      .replace(/playertwo$/i, '')
      .replace(/player$/i, '')
      .replace(/two$/i, '')
  );
}

function fileStemFromUrl(url) {
  if (!url) return '';
  const part = String(url).split('/').pop() ?? '';
  return part.replace(/\.[^.]+$/, '');
}

function sanitizeToken(value) {
  return String(value ?? '').replace(/[^A-Za-z0-9]/g, '');
}

function deriveGemNameFromSlug(slug, gemType) {
  const raw = String(slug ?? '')
    .replace(/playertwo$/i, ' ii')
    .replace(/playerthree$/i, ' iii')
    .replace(/player$/i, '')
    .replace(/^support/i, '')
    .replace(/^meta/i, 'meta ')
    .replace(/([a-z])([A-Z])/g, '$1 $2');

  const words = raw.match(/[A-Z]?[a-z]+|[0-9]+|ii|iii|iv/gi) ?? [raw];
  const normalized = words
    .filter(Boolean)
    .map((word) => {
      const lower = word.toLowerCase();
      if (['ii', 'iii', 'iv'].includes(lower)) return lower.toUpperCase();
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ')
    .replace(/\bOn Crit Meta\b/i, 'Cast on Critical');

  if (!normalized && String(gemType).toUpperCase() === 'SUPPORT') return 'Support Gem';
  return normalized || String(slug ?? '');
}

function extractMobalyticsGemNameMap(html) {
  const map = new Map();
  const regex = /"gemSlug":"([^"]+)","iconURL":"[^"]*","gemType":"[^"]+","description":(?:null|"[^"]*"),"name":"([^"]+)"/g;
  let match;
  while ((match = regex.exec(html)) !== null) {
    const slug = decodeHtml(match[1]).trim();
    const name = decodeHtml(match[2]).trim();
    if (slug && name && !map.has(slug)) {
      map.set(slug, name);
    }
  }
  return map;
}

function weaponSetToSlot(weaponSet) {
  if (weaponSet === 'set1') return 'Weapon 1';
  if (weaponSet === 'set2') return 'Weapon 2';
  return undefined;
}

function parseMobalyticsTree(tree) {
  if (!tree) return { nodes: [], specs: [] };
  const mainNodes = collectPrimaryTreeNodes(tree);
  return {
    nodes: mainNodes,
    specs: [{ nodes: mainNodes }],
    weaponSet1Nodes: slugsToNodeIds(tree.set1Tree?.selectedSlugs),
    weaponSet2Nodes: slugsToNodeIds(tree.set2Tree?.selectedSlugs),
  };
}

function parseMobalyticsItems(equipment) {
  if (!equipment || typeof equipment !== 'object') return { list: [], slots: [], catalog: {} };

  const slotMap = [
    ['mainHand', 'Weapon 1'],
    ['offHand', 'Weapon 2'],
    ['helmet', 'Helmet'],
    ['body', 'Body Armour'],
    ['gloves', 'Gloves'],
    ['boots', 'Boots'],
    ['amulet', 'Amulet'],
    ['leftRing', 'Ring 1'],
    ['rightRing', 'Ring 2'],
    ['extraRing', 'Ring 2'],
    ['belt', 'Belt'],
    ['flask1', 'Flask 1'],
    ['flask2', 'Flask 2'],
    ['flask3', 'Flask 3'],
    ['flask4', 'Flask 4'],
    ['flask5', 'Flask 5'],
  ];

  const seenSlots = new Set();
  const list = [];
  const slots = [];
  const catalog = {};

  for (const [key, slotName] of slotMap) {
    if (seenSlots.has(slotName)) continue;
    const wrapped = equipment[key];
    const raw = wrapped?.commonItem;
    if (!raw) continue;
    const item = parseMobalyticsItem(raw, key);
    if (!item) continue;
    seenSlots.add(slotName);
    list.push(item);
    catalog[item.id] = item;
    slots.push({ name: slotName, itemId: item.id });
  }

  return { list, slots, catalog };
}

function parseMobalyticsItem(raw, key) {
  const explicits = (raw.explicitDescriptions ?? [])
    .map((d) => d?.description?.trim())
    .filter(Boolean);
  const implicits = (raw.implicitDescriptions ?? [])
    .map((d) => d?.description?.trim())
    .filter(Boolean);
  const runes = extractMobalyticsRunes(raw);

  return {
    id: String(key),
    rarity: raw.isUnique ? 'UNIQUE' : 'RARE',
    name: raw.name ?? '',
    typeLine: raw.isUnique ? (raw.baseName ?? '') : '',
    isUnique: !!raw.isUnique,
    uniqueName: raw.isUnique ? raw.name : undefined,
    implicits,
    explicits,
    runes,
    raw: raw.slug ?? raw.name ?? String(key),
  };
}

function extractMobalyticsRunes(raw) {
  const directLists = [
    raw?.runeDescriptions,
    raw?.runes,
    raw?.socketables,
    raw?.sockets,
    raw?.socketedItems,
  ];

  const names = directLists
    .flatMap((list) => Array.isArray(list) ? list : [])
    .map(extractMobalyticsRuneName)
    .filter(Boolean);

  return [...new Set(names)];
}

function extractMobalyticsRuneName(value) {
  if (!value) return '';
  if (typeof value === 'string') return humanizeSocketableToken(value);
  return (
    value.name?.trim?.() ||
    value.description?.trim?.() ||
    humanizeSocketableToken(value.slug || value.id || value.metadata || value.iconURL)
  );
}

function humanizeSocketableToken(value) {
  const token = String(value ?? '').split('/').pop() ?? '';
  if (!token) return '';
  return token
    .replace(/\.[^.]+$/, '')
    .replace(/^SoulCore/, 'Soul Core ')
    .replace(/^Rune/, '')
    .replace(/[-_]+/g, ' ')
    .replace(/([a-z])([A-Z0-9])/g, '$1 $2')
    .replace(/([0-9])([A-Z])/g, '$1 $2')
    .trim();
}

function slugsToNodeIds(slugs) {
  return (slugs ?? [])
    .map((slug) => {
      const match = String(slug).match(/node-(\d+)/);
      return match ? Number(match[1]) : null;
    })
    .filter((n) => Number.isInteger(n));
}

function collectPrimaryTreeNodes(tree) {
  return [
    ...slugsToNodeIds(tree?.mainTree?.selectedSlugs),
    ...slugsToNodeIds(tree?.ascendancyTree?.selectedSlugs),
  ];
}

function mergeMobalyticsPassiveTree(tree, mobalyticsTree) {
  const base = tree ?? { nodes: [], specs: [] };
  const mergedNodes = collectPrimaryTreeNodes(mobalyticsTree);
  return {
    ...base,
    nodes: mergedNodes.length ? mergedNodes : base.nodes,
    specs: mergedNodes.length ? [{ nodes: mergedNodes }] : base.specs,
    weaponSet1Nodes: slugsToNodeIds(mobalyticsTree?.set1Tree?.selectedSlugs),
    weaponSet2Nodes: slugsToNodeIds(mobalyticsTree?.set2Tree?.selectedSlugs),
  };
}

function extractMetaFromTitle(title) {
  const cleaned = cleanMobalyticsTitle(title);
  const className = POE2_CLASSES.find((name) => cleaned.includes(name)) || '';
  const ascendClassName = POE2_ASCENDANCIES.find((name) => cleaned.includes(name)) || '';
  return {
    className,
    ascendClassName,
    level: undefined,
    mainSocketGroup: 0,
  };
}

function findChromeExecutable() {
  const envPath = process.env.CHROME_PATH || process.env.GOOGLE_CHROME_BIN;
  if (envPath && fs.existsSync(envPath)) return envPath;

  const candidates = process.platform === 'win32'
    ? [
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files\\Chromium\\Application\\chrome.exe',
      ]
    : process.platform === 'darwin'
      ? [
          '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
          '/Applications/Chromium.app/Contents/MacOS/Chromium',
        ]
      : [
          '/usr/bin/google-chrome',
          '/usr/bin/google-chrome-stable',
          '/usr/bin/chromium-browser',
          '/usr/bin/chromium',
        ];

  return candidates.find((p) => fs.existsSync(p)) || null;
}

function extractPageTitle(html) {
  const meta = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i);
  if (meta?.[1]) return decodeHtml(meta[1]).trim();

  const title = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (title?.[1]) return decodeHtml(title[1]).trim();

  return '';
}

function cleanMobalyticsTitle(title) {
  return title
    .replace(/\s*[|:-]\s*Mobalytics.*$/i, '')
    .replace(/\s*[|:-]\s*Path of Exile 2.*$/i, '')
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
