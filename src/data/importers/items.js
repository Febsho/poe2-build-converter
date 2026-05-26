/**
 * Item bases importer.
 * Source: poe2db.tw/us/Items — navigation gives item class list;
 * we then fetch each enabled class page for base item names + implicits.
 */
import { writeCache, writeRaw, touchSource } from '../store.js';

const INDEX_URL  = 'https://poe2db.tw/us/Items';
const BASE_URL   = 'https://poe2db.tw/us/';
const TIMEOUT_MS = 20_000;
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (compatible; poe2-build-converter/1.0; non-commercial)',
  'Accept-Encoding': 'gzip, deflate, br',
  'Accept': 'text/html',
};

// Equipment classes we care about for build advice (skip currency/misc)
const WANTED_CLASSES = new Set([
  'Claws','Daggers','Wands','Bows','Staves','Quarterstaves','Crossbows','Spears','Flails',
  'One_Hand_Maces','Two_Hand_Maces','Sceptres',
  'One_Hand_Swords','Two_Hand_Swords','One_Hand_Axes','Two_Hand_Axes',
  'Traps','Talismans',
  'Shields','Bucklers','Foci','Quivers',
  'Body_Armours','Helmets','Gloves','Boots',
  'Amulets','Rings','Belts','Jewels',
  'Flasks','Life_Flasks','Mana_Flasks','Charms',
  'Relics','Vault_Keys',
]);

export async function importItems() {
  console.log('[items] Fetching index:', INDEX_URL);

  let indexHtml;
  try {
    const resp = await fetch(INDEX_URL, { headers: HEADERS, signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    indexHtml = await resp.text();
  } catch (err) {
    console.error('[items] Index fetch failed:', err.message);
    await touchSource('items', { lastError: err.message });
    return { ok: false, error: err.message };
  }

  // Extract item class links from the navigation. Some implemented PoE2DB pages
  // are still marked "disabled" in the nav, so rely on the wanted class list
  // instead of the nav state.
  const classes = parseItemClasses(indexHtml);
  console.log(`[items] Found ${classes.length} item classes to fetch`);

  const allBases = [];
  for (const cls of classes) {
    try {
      const resp = await fetch(`${BASE_URL}${cls.slug}`, {
        headers: HEADERS,
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (!resp.ok) { console.warn(`[items] ${cls.slug} returned ${resp.status}`); continue; }
      const html = await resp.text();
      const bases = parseClassBases(html, cls.name);
      console.log(`[items]   ${cls.name}: ${bases.length} bases`);
      allBases.push(...bases);
    } catch (err) {
      console.warn(`[items] ${cls.slug} failed:`, err.message);
    }
  }

  await writeRaw('items', { fetchedAt: new Date().toISOString(), classCount: classes.length });
  await writeCache('items', allBases);
  await touchSource('items', {
    count:     allBases.length,
    sourceUrl: INDEX_URL,
    lastError: null,
    note:      `${classes.length} classes, ${allBases.length} base items`,
  });

  console.log(`[items] Saved ${allBases.length} item bases across ${classes.length} classes`);
  return { ok: true, count: allBases.length };
}

// ── Parsers ───────────────────────────────────────────────────────────────────

function parseItemClasses(html) {
  const re = /class="ItemClasses[^"]*"\s+href="([^"/][^"]*)"[^>]*>([^<]*)</g;
  const seen = new Set();
  const results = [];
  let m;
  while ((m = re.exec(html)) !== null) {
    const slug = m[1].trim();
    const name = m[2].trim() || slug.replace(/_/g, ' ');
    if (!seen.has(slug) && WANTED_CLASSES.has(slug)) {
      seen.add(slug);
      results.push({ slug, name });
    }
  }
  return results;
}

function parseClassBases(html, className) {
  // Base items appear in "d-flex border-top rounded" cards with <a class="whiteitem ..."> anchors.
  // Unique items in the same page use "uniqueitem" — we skip those.
  const bases = [];
  const divRe = /class="d-flex border-top rounded">([\s\S]*?)(?=class="d-flex border-top rounded"|<footer|<div\s+id="[A-Za-z])/g;
  let m;
  while ((m = divRe.exec(html)) !== null) {
    const chunk = m[1];
    if (chunk.includes('uniqueitem') || chunk.includes('uniqueName')) continue;

    // Name: the whiteitem anchor that contains only text (not an img)
    const nameMatch = chunk.match(/class="whiteitem[^"]*"[^>]*>([^<]{2,})<\/a>/);
    if (!nameMatch) continue;
    const name = nameMatch[1].trim();
    if (!name) continue;

    const lvlMatch = chunk.match(/Level (\d+)/i);
    const level = lvlMatch ? parseInt(lvlMatch[1]) : 0;

    const implicitMatch = chunk.match(/class="implicitMod">([\s\S]*?)(?=<div class=|<\/div>)/);
    const implicit = implicitMatch ? stripHtml(implicitMatch[1]).replace(/\s+/g, ' ').trim() : '';

    // Extract base stats: Armour, Evasion Rating, Energy Shield, Damage, APS
    const text = stripHtml(chunk);
    const armourMatch  = text.match(/Armour\s*:\s*(\d+)/i);
    const evasionMatch = text.match(/Evasion\s*(?:Rating)?\s*:\s*(\d+)/i);
    const esMatch      = text.match(/Energy\s*Shield\s*:\s*(\d+)/i);
    const dmgMatch     = text.match(/Damage\s*:\s*([\d.]+)[-–]([\d.]+)/i);
    const apsMatch     = text.match(/Attacks?\s*per\s*Second\s*:\s*([\d.]+)/i);
    const blockMatch   = text.match(/(?:Chance\s*to\s*Block|Block)\s*:\s*(\d+)/i);

    const stats = {};
    if (armourMatch)  stats.armour = parseInt(armourMatch[1]);
    if (evasionMatch) stats.evasion = parseInt(evasionMatch[1]);
    if (esMatch)      stats.energyShield = parseInt(esMatch[1]);
    if (dmgMatch)     { stats.damageMin = parseFloat(dmgMatch[1]); stats.damageMax = parseFloat(dmgMatch[2]); }
    if (apsMatch)     stats.aps = parseFloat(apsMatch[1]);
    if (blockMatch)   stats.block = parseInt(blockMatch[1]);

    const id = (className + '-' + name).toLowerCase().replace(/[^a-z0-9]+/g, '-');
    bases.push({ id, name, class: className, level, implicit: implicit || null, ...(Object.keys(stats).length ? { stats } : {}) });
  }
  return bases;
}

function stripHtml(s) {
  return String(s)
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ').replace(/&#039;/g, "'").replace(/&quot;/g, '"');
}
