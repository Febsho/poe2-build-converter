const MOBALYTICS_HOSTS = ['mobalytics.gg', 'www.mobalytics.gg'];

export function isMobalyticsUrl(input) {
  if (typeof input !== 'string') return false;
  try {
    const url = new URL(input.trim());
    return MOBALYTICS_HOSTS.includes(url.hostname) && url.pathname.includes('/poe-2');
  } catch {
    return false;
  }
}

export async function fetchMobalyticsData(input, { timeoutMs = 15000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let res;
  try {
    res = await fetch(input.trim(), {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; pob-to-poe2-buildplanner/1.0)',
        Accept: 'text/html,application/xhtml+xml',
      },
    });
  } catch (err) {
    if (err.name === 'AbortError') throw new Error('Mobalytics request timed out');
    throw new Error(`Failed to reach Mobalytics: ${err.message}`);
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) throw new Error(`Mobalytics returned HTTP ${res.status}`);

  const html = await res.text();
  return parseMobalyticsPage(html);
}

function parseMobalyticsPage(html) {
  // Next.js embeds all page data in __NEXT_DATA__
  const match = html.match(/<script[^>]+id="__NEXT_DATA__"[^>]*>([^<]+)<\/script>/);
  if (match) {
    try {
      const nextData = JSON.parse(match[1]);
      return extractFromNextData(nextData);
    } catch {
      // fall through
    }
  }

  // Some builds use a window state blob
  const stateMatch = html.match(
    /window\.__(?:INITIAL_STATE|APP_STATE|BUILD_DATA)__\s*=\s*(\{[\s\S]+?\});\s*<\/script>/
  );
  if (stateMatch) {
    try {
      return normalizeMobalyticsBuild(JSON.parse(stateMatch[1]));
    } catch {
      // fall through
    }
  }

  throw new Error(
    'Could not extract build data from Mobalytics page. The URL may be private or the page structure changed.'
  );
}

function extractFromNextData(data) {
  const props = data?.props?.pageProps ?? {};
  // Mobalytics uses several possible key paths; try the most common ones.
  const build =
    props.build ??
    props.buildData ??
    props.data?.build ??
    props.initialData?.build ??
    props.dehydratedState?.queries?.[0]?.state?.data?.build ??
    findDeep(props, 'build', 6);

  if (!build) throw new Error('No build data found in Mobalytics page');
  return normalizeMobalyticsBuild(build);
}

function normalizeMobalyticsBuild(raw) {
  const meta = {
    level: raw.level ?? raw.characterLevel ?? undefined,
    className: raw.className ?? raw.class?.name ?? (typeof raw.class === 'string' ? raw.class : undefined),
    ascendClassName: raw.ascendancy ?? raw.ascendancyName ?? raw.ascendClass ?? undefined,
    targetVersion: '2',
  };

  // Skills: try multiple shapes Mobalytics might use
  const rawSkills =
    raw.skills ?? raw.skillGroups ?? raw.gems ?? raw.socketGroups ?? [];
  const skills = [];
  for (const group of asArray(rawSkills)) {
    const gemList = group.gems ?? group.skills ?? asArray(group);
    const actives = [];
    const supports = [];
    for (const gem of asArray(gemList)) {
      if (!gem || typeof gem !== 'object') continue;
      const name = gem.name ?? gem.gemName ?? gem.skillName ?? '';
      const isSupport =
        gem.isSupport === true ||
        gem.type === 'support' ||
        /\bsupport\b/i.test(name);
      const obj = {
        nameSpec: name,
        skillId: gem.id ?? gem.skillId ?? undefined,
        level: gem.level ?? undefined,
        quality: gem.quality ?? undefined,
        enabled: gem.enabled ?? true,
        isSupport,
      };
      (isSupport ? supports : actives).push(obj);
    }
    if (actives.length || supports.length) {
      skills.push({ actives, supports, allGems: [...actives, ...supports], enabled: true });
    }
  }

  // Passive tree
  let treeNodes = [];
  const rawTree = raw.passiveTree ?? raw.tree ?? raw.passives ?? raw.allocatedNodes;
  if (rawTree) {
    if (typeof rawTree === 'string') {
      treeNodes = rawTree.split(',').map((s) => s.trim()).filter(Boolean);
    } else if (Array.isArray(rawTree)) {
      treeNodes = rawTree
        .map((n) => (typeof n === 'object' ? String(n.id ?? n.nodeId ?? '') : String(n)))
        .filter(Boolean);
    } else if (typeof rawTree === 'object' && rawTree.nodes) {
      treeNodes = asArray(rawTree.nodes).map(String);
    }
  }

  // Items
  const rawItems = raw.items ?? raw.equipment ?? raw.gear ?? [];
  const list = [];
  const slots = [];
  asArray(rawItems).forEach((item, i) => {
    if (!item || typeof item !== 'object') return;
    const id = String(item.id ?? i + 1);
    const isUnique = (item.rarity ?? '').toLowerCase() === 'unique';
    list.push({
      id,
      name: item.name ?? undefined,
      typeLine: item.base ?? item.baseType ?? undefined,
      rarity: item.rarity ?? undefined,
      isUnique,
      uniqueName: isUnique ? (item.name ?? undefined) : undefined,
      raw: '',
      summaryLines: [],
    });
    const slotName = item.slot ?? item.inventoryId ?? item.slotName;
    if (slotName) slots.push({ name: slotName, itemId: id });
  });

  return {
    meta,
    skills,
    tree: { nodes: treeNodes, specs: treeNodes.length ? [{ nodes: treeNodes }] : [] },
    items: { list, slots },
    notes: raw.notes ?? raw.description ?? '',
  };
}

function asArray(v) {
  if (v === null || v === undefined) return [];
  return Array.isArray(v) ? v : [v];
}

function findDeep(obj, key, maxDepth) {
  if (!obj || typeof obj !== 'object' || maxDepth === 0) return undefined;
  if (key in obj) return obj[key];
  for (const v of Object.values(obj)) {
    const found = findDeep(v, key, maxDepth - 1);
    if (found !== undefined) return found;
  }
  return undefined;
}
