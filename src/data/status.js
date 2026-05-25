import { readMeta, CACHE_DIR } from './store.js';
import { existsSync } from 'node:fs';
import path from 'node:path';

const STALE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

const CATEGORIES = {
  patches:      { label: 'Patch Notes',        bundled: false },
  gems:         { label: 'Skill / Support Gems', bundled: false },
  passives:     { label: 'Passive Tree',        bundled: true  },
  ascendancies: { label: 'Ascendancies',        bundled: true  },
  items:        { label: 'Item Bases',          bundled: false },
  uniques:      { label: 'Unique Items',        bundled: false },
};

export async function getDataStatus() {
  const meta = await readMeta();
  const now  = Date.now();
  const cats = {};

  for (const [key, info] of Object.entries(CATEGORIES)) {
    if (info.bundled) {
      cats[key] = { label: info.label, status: 'bundled', available: true, stale: false, message: 'Bundled with app' };
      continue;
    }

    const src    = meta.sources?.[key];
    const exists = existsSync(path.join(CACHE_DIR, `${key}.json`));

    if (!exists || !src) {
      cats[key] = { label: info.label, status: 'missing', available: false, message: 'Not imported yet — run: npm run data:update' };
      continue;
    }

    const ageMs = src.lastUpdated ? now - new Date(src.lastUpdated).getTime() : Infinity;
    const stale = ageMs > STALE_MS;

    cats[key] = {
      label:       info.label,
      status:      stale ? 'stale' : 'ok',
      available:   true,
      stale,
      count:       src.count ?? 0,
      lastUpdated: src.lastUpdated,
      error:       src.lastError ?? null,
      message:     stale
        ? `Updated ${fmtAge(ageMs)} — may be outdated`
        : `${src.count ?? '?'} records, updated ${fmtAge(ageMs)}`,
    };
  }

  const available = Object.values(cats).filter(c => c.available).length;
  const anyStale  = Object.values(cats).some(c => c.stale);

  return {
    ok: true,
    summary: {
      available,
      total:            Object.keys(cats).length,
      anyStale,
      lastGlobalUpdate: meta.lastGlobalUpdate ?? null,
      message:          buildMessage(cats, meta.lastGlobalUpdate),
    },
    categories: cats,
  };
}

function buildMessage(cats, lastUpdate) {
  const ok      = Object.values(cats).filter(c => c.available && !c.stale).map(c => c.label);
  const stale   = Object.values(cats).filter(c => c.stale).map(c => c.label);
  const missing = Object.values(cats).filter(c => !c.available).map(c => c.label);
  const parts   = [];
  if (ok.length)      parts.push(`${ok.join(', ')} available`);
  if (stale.length)   parts.push(`${stale.join(', ')} may be stale`);
  if (missing.length) parts.push(`${missing.join(', ')} not imported`);
  const age = lastUpdate ? `PoE2 data last updated ${fmtAge(Date.now() - new Date(lastUpdate).getTime())}. ` : '';
  return age + (parts.join('. ') || 'No data imported yet — run: npm run data:update');
}

function fmtAge(ms) {
  const m = Math.round(ms / 60_000);
  if (m < 60)  return `${m}m ago`;
  const h = Math.round(ms / 3_600_000);
  if (h < 24)  return `${h}h ago`;
  return `${Math.round(ms / 86_400_000)}d ago`;
}
