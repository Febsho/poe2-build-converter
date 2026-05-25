/**
 * Patch notes importer.
 * Source: pathofexile.com/forum/view-forum/patch-notes (server-rendered HTML).
 * Fetches the forum index to discover threads, then scrapes each PoE2-relevant one.
 */
import { writeCache, writeRaw, touchSource } from '../store.js';

// Forum 2212 = "Path of Exile 2 Patch Notes" subforum (PoE2-specific)
const FORUM_INDEX_URL = 'https://www.pathofexile.com/forum/view-forum/2212';
const THREAD_BASE_URL = 'https://www.pathofexile.com/forum/view-thread/';
const TIMEOUT_MS = 20_000;
const MAX_THREADS = 10;

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (compatible; poe2-build-converter/1.0; non-commercial data importer)',
  'Accept-Encoding': 'gzip, deflate, br',
  'Accept': 'text/html',
};


const MECHANIC_KEYWORDS = [
  'fire','cold','lightning','chaos','physical',
  'spell','attack','projectile','melee','bow',
  'minion','aura','curse','trap','mine','totem',
  'ignite','freeze','shock','bleed','poison','chill','burn','stun',
  'sorceress','witch','warrior','ranger','monk','mercenary','huntress','druid',
  'infernalist','stormweaver','deadeye','pathfinder','titan','warbringer',
  'oracle','invoker','amazon','tactician','blood mage','witchhunter',
  'ascendancy','keystone','notable','passive','skill','gem','support',
  'damage','defence','resistance','life','mana','energy shield',
];

export async function importPatches() {
  console.log('[patches] Fetching forum index:', FORUM_INDEX_URL);

  // 1. Fetch the forum index to discover thread IDs + titles
  let indexHtml;
  try {
    const resp = await fetch(FORUM_INDEX_URL, {
      headers: HEADERS,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    indexHtml = await resp.text();
  } catch (err) {
    console.error('[patches] Index fetch failed:', err.message);
    await touchSource('patches', { lastError: err.message });
    return { ok: false, error: err.message };
  }

  // 2. Parse thread list from the forum index
  const threads = parseThreadList(indexHtml).slice(0, MAX_THREADS);
  console.log(`[patches] Found ${threads.length} threads to check`);

  // 3. For each PoE2-relevant thread, fetch and parse the content
  const patches = [];
  for (const t of threads) {
    console.log(`[patches] Fetching thread: ${t.title} (${t.id})`);
    try {
      const resp = await fetch(`${THREAD_BASE_URL}${t.id}`, {
        headers: HEADERS,
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!resp.ok) { console.warn(`[patches] Thread ${t.id} returned ${resp.status}`); continue; }
      const html = await resp.text();
      const content = parseThreadContent(html);

      patches.push({
        id:       `thread-${t.id}`,
        title:    t.title,
        date:     t.date || null,
        url:      `${THREAD_BASE_URL}${t.id}`,
        summary:  content.slice(0, 1500),
        keywords: extractKeywords(`${t.title} ${content}`),
      });
    } catch (err) {
      console.warn(`[patches] Thread ${t.id} failed:`, err.message);
    }
  }

  await writeRaw('patches', { fetchedAt: new Date().toISOString(), threadCount: threads.length });
  await writeCache('patches', patches);
  await touchSource('patches', {
    count:     patches.length,
    sourceUrl: FORUM_INDEX_URL,
    lastError: null,
    note:      `${threads.length} threads checked, ${patches.length} matched PoE2 filter`,
  });

  console.log(`[patches] Saved ${patches.length} patch note entries`);
  return { ok: true, count: patches.length };
}

// ── HTML parsers ──────────────────────────────────────────────────────────────

function parseThreadList(html) {
  const threads = [];
  // Each thread row has: <a href="/forum/view-thread/ID">Title</a>
  const re = /href="\/forum\/view-thread\/(\d+)">\s*([^<]+?)\s*<\/a>/g;
  const seen = new Set();
  let m;
  while ((m = re.exec(html)) !== null) {
    const id    = m[1];
    const title = m[2].trim();
    // Skip navigation/pagination links (short titles like "1", "2", etc.)
    if (seen.has(id) || title.length < 5 || /^\d+$/.test(title)) continue;
    seen.add(id);

    // Try to find a date near this thread ID in the HTML
    const dateMatch = html.slice(m.index, m.index + 600).match(/(\w+ \d+, \d{4})/);
    threads.push({ id, title, date: dateMatch?.[1] || null });
  }
  return threads;
}

function parseThreadContent(html) {
  // PoE2 patch notes can appear in two containers:
  // 1. <div class="box-content" ...> — large content update posts
  // 2. <tr class="staff"><td class="content-container"><div class="content"> — standard posts
  const boxMatch = html.match(/<div class="box-content"[^>]*>([\s\S]{100,}?)(?=<div class="box-content"|<\/table>)/);
  if (boxMatch) return stripHtml(boxMatch[1]).replace(/\s+/g, ' ').trim();

  const staffMatch = html.match(/<tr class="staff"[^>]*>[\s\S]*?<div class="content">([\s\S]*?)<\/div>\s*<\/td>/);
  if (staffMatch) return stripHtml(staffMatch[1]).replace(/\s+/g, ' ').trim();

  return '';
}

function stripHtml(html) {
  return html.replace(/<style[\s\S]*?<\/style>/gi, '')
             .replace(/<script[\s\S]*?<\/script>/gi, '')
             .replace(/<[^>]+>/g, ' ')
             .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
             .replace(/&nbsp;/g, ' ').replace(/&#039;/g, "'")
             .replace(/\s+/g, ' ').trim();
}

function extractKeywords(text) {
  const lower = text.toLowerCase();
  return MECHANIC_KEYWORDS.filter(k => lower.includes(k));
}
