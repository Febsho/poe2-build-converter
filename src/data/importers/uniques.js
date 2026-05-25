/**
 * Unique items importer.
 * Source: poe2db.tw/us/Unique_item — full list, inline HTML, no API needed.
 */
import { writeCache, writeRaw, touchSource } from '../store.js';

const URL = 'https://poe2db.tw/us/Unique_item';
const TIMEOUT_MS = 30_000;
const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (compatible; poe2-build-converter/1.0; non-commercial)',
  'Accept-Encoding': 'gzip, deflate, br',
  'Accept': 'text/html',
};

export async function importUniques() {
  console.log('[uniques] Fetching', URL);
  let html;
  try {
    const resp = await fetch(URL, { headers: HEADERS, signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    html = await resp.text();
  } catch (err) {
    console.error('[uniques] Fetch failed:', err.message);
    await touchSource('uniques', { lastError: err.message });
    return { ok: false, error: err.message };
  }

  await writeRaw('uniques', { fetchedAt: new Date().toISOString(), size: html.length });

  const uniques = parseUniques(html);
  await writeCache('uniques', uniques);
  await touchSource('uniques', {
    count:     uniques.length,
    sourceUrl: URL,
    lastError: null,
  });

  console.log(`[uniques] Saved ${uniques.length} unique items`);
  return { ok: true, count: uniques.length };
}

// ── Parser ────────────────────────────────────────────────────────────────────

function parseUniques(html) {
  // Determine the current tab context (WeaponUnique, ArmourUnique, OtherUnique, CultivatedUniques)
  // Each item card: <div class="d-flex border-top rounded"> ... </div>
  const items = [];

  // Extract tab sections to assign category
  const tabSections = [
    { id: 'WeaponUnique',      category: 'Weapon'    },
    { id: 'ArmourUnique',      category: 'Armour'    },
    { id: 'OtherUnique',       category: 'Other'     },
    { id: 'CultivatedUniques', category: 'Cultivated'},
  ];

  for (const { id, category } of tabSections) {
    // Find the tab pane section
    const sectionRe = new RegExp(`id="${id}"[^>]*>([\\s\\S]*?)(?=<div[^>]+id="[A-Za-z]+Unique|<footer)`, 'i');
    const sectionMatch = html.match(sectionRe);
    if (!sectionMatch) continue;
    const section = sectionMatch[1];

    // Each item: between "d-flex border-top rounded" divs
    const itemRe = /d-flex border-top rounded[^>]*>([\s\S]*?)(?=d-flex border-top rounded|<\/div>\s*<\/div>\s*<\/div>\s*<\/div>\s*<div\s+id=)/g;
    let m;
    while ((m = itemRe.exec(section)) !== null) {
      const chunk = m[1];

      const name     = extract(chunk, 'uniqueName');
      const base     = extract(chunk, 'uniqueTypeLine');
      if (!name) continue;

      const reqMatch = chunk.match(/class="requirements">Requires:\s*([^<]*(?:<[^>]+>[^<]*)*)/i);
      const req      = reqMatch ? stripHtml(reqMatch[1]).trim() : '';

      const mods = [];
      const modRe = /class="explicitMod">([\s\S]*?)(?=<div class="explicit|<\/div>)/g;
      let modM;
      while ((modM = modRe.exec(chunk)) !== null) {
        const text = stripHtml(modM[1]).replace(/\s+/g, ' ').trim();
        if (text && !text.startsWith('[')) mods.push(text);
      }

      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      items.push({ id: slug, name, base: base || '', category, requires: req, mods: mods.slice(0, 10) });
    }
  }

  return items;
}

function extract(html, cls) {
  const m = html.match(new RegExp(`class="${cls}">([^<]*)<`));
  return m ? m[1].trim() : '';
}

function stripHtml(s) {
  return s.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/&#039;/g, "'").replace(/&quot;/g, '"');
}
