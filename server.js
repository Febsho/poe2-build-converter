import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { resolveAndConvert, inspectInput } from './src/resolve.js';
import { handleAiProxy } from './src/ai/proxy.js';
import dataRoutes from './src/routes/dataRoutes.js';
import aiRoutes from './src/routes/aiRoutes.js';

const require = createRequire(import.meta.url);

// Build a reverse lookup map: GGG passive id → human-readable name
// e.g. "lightning14" → "Shock Chance"
const _passivesRaw = require('./src/data/passives_default.json');
const _ascendanciesRaw = require('./src/data/ascendancies.json');
const PASSIVE_DISPLAY_NAMES = Object.fromEntries(
  Object.values(_passivesRaw)
    .filter((e) => e.id && e.name)
    .map((e) => [e.id, e.name])
);
const PASSIVE_ASCENDANCIES = Object.fromEntries(
  Object.values(_passivesRaw)
    .filter((e) => e.id && e.ascendancy)
    .map((e) => [e.id, e.ascendancy])
);
const ASCENDANCY_DISPLAY_NAMES = Object.fromEntries(
  Object.entries(_ascendanciesRaw)
    .filter(([, e]) => e?.name && !e.name.startsWith('[DNT-UNUSED]'))
    .map(([id, e]) => [id, e.name])
);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/health', (_req, res) => res.json({ ok: true }));

/**
 * AI proxy — forwards requests to AI providers using the user's own API key.
 * The key is passed in x-ai-key header and is NEVER stored or logged.
 * Disable by setting AI_PROXY_ENABLED=false in environment.
 */
if (process.env.AI_PROXY_ENABLED !== 'false') {
  app.post('/api/ai/proxy', handleAiProxy);
  app.use('/api/ai', aiRoutes);
}
app.use('/api/data', dataRoutes);

const regexDataCache = new Map();
const REGEX_DATA_SOURCES = {
  waystone: [
    'https://poe2db.tw/us/Waystones_low_tier',
    'https://poe2db.tw/us/Waystones_mid_tier',
    'https://poe2db.tw/us/Waystones_top_tier',
  ],
  tablet: [
    'https://poe2db.tw/us/Precursor_Tablet',
    'https://poe2db.tw/us/Abyss_Precursor_Tablet',
    'https://poe2db.tw/us/Breach_Precursor_Tablet',
    'https://poe2db.tw/us/Delirium_Precursor_Tablet',
    'https://poe2db.tw/us/Expedition_Precursor_Tablet',
    'https://poe2db.tw/us/Ritual_Precursor_Tablet',
    'https://poe2db.tw/us/Overseer_Precursor_Tablet',
  ],
  relic: [
    'https://poe2db.tw/us/Relics',
  ],
};

app.get('/api/regex-data/:kind', async (req, res) => {
  const kind = String(req.params.kind || '').toLowerCase();
  const sourceUrls = REGEX_DATA_SOURCES[kind];
  if (!sourceUrls) {
    return res.status(404).json({ error: 'Unknown regex data kind.' });
  }

  const cached = regexDataCache.get(kind);
  if (cached && Date.now() - cached.timestamp < 6 * 60 * 60 * 1000) {
    return res.json(cached.payload);
  }

  try {
    const pages = await Promise.all(sourceUrls.map(async (url) => {
      const response = await fetch(url, {
        headers: {
          accept: 'text/html,application/xhtml+xml',
          'user-agent': 'poe2-build-converter regex builder (+https://github.com/febsho/poe2-build-converter)',
        },
      });
      if (!response.ok) throw new Error(`${url} returned ${response.status}`);
      return { url, html: await response.text() };
    }));
    const blocks = normalizePoe2dbRegexBlocks(kind, pages);
    const payload = { source: sourceUrls.join(', '), blocks, updatedAt: new Date().toISOString() };
    regexDataCache.set(kind, { timestamp: Date.now(), payload });
    res.setHeader('Cache-Control', 'public, max-age=3600');
    return res.json(payload);
  } catch (err) {
    return res.status(502).json({ error: err.message, source: sourceUrls.join(', ') });
  }
});

/**
 * Inspect a PoB input and return available SkillSets, ItemSets, and Tree Specs.
 * Body: { input: string, kind?: string }
 */
app.post('/api/inspect', async (req, res) => {
  const { input, kind } = req.body ?? {};
  if (!input || typeof input !== 'string') {
    return res.status(400).json({ error: 'Missing "input" string in request body.' });
  }
  try {
    const sets = await inspectInput(input, { kind });
    return res.json({ ok: true, ...sets });
  } catch (err) {
    return res.status(422).json({ ok: false, error: err.message });
  }
});

/**
 * Convert any supported input into the PoE2 .build object + a report.
 * Body: { input: string, kind?: string, name?: string, description?: string,
 *         skillSetId?: number, itemSetId?: number, specIndex?: number }
 */
app.post('/api/convert', async (req, res) => {
  const { input, kind, name, description, skillSetId, itemSetId, specIndex } = req.body ?? {};
  if (!input || typeof input !== 'string') {
    return res.status(400).json({ error: 'Missing "input" string in request body.' });
  }

  try {
    const result = await resolveAndConvert(input, { kind, name, description, skillSetId, itemSetId, specIndex });
    const filename = `${sanitizeFilename(result.build.name)}.build`;

    // Build a name-lookup map so the UI can display "Lightning" instead of "lightning14"
    const passiveNames = {};
    const passiveAscendancies = {};
    for (const p of result.build.passives ?? []) {
      const id = typeof p === 'string' ? p : p?.id;
      if (id && PASSIVE_DISPLAY_NAMES[id]) passiveNames[id] = PASSIVE_DISPLAY_NAMES[id];
      if (id && PASSIVE_ASCENDANCIES[id]) passiveAscendancies[id] = PASSIVE_ASCENDANCIES[id];
    }

    return res.json({
      ok: true,
      source: result.source,
      report: result.report,
      build: result.build,
      preview: result.normalizedBuild,
      passiveNames,
      passiveAscendancies,
      ascendancyNames: ASCENDANCY_DISPLAY_NAMES,
      filename,
    });
  } catch (err) {
    return res.status(422).json({ ok: false, error: err.message });
  }
});

function sanitizeFilename(name) {
  const base = (name || 'MyBuild').replace(/[^A-Za-z0-9 _-]/g, '').trim();
  return base.length ? base.replace(/\s+/g, '_') : 'MyBuild';
}

function normalizePoe2dbRegexBlocks(mode, pages) {
  const seen = new Set();
  const blocks = [];
  for (const page of pages) {
    const urlGroup = inferGroupFromUrl(mode, page.url);
    for (const label of extractPoe2dbModifierLabels(page.html)) {
      const regex = makeRegexTerm(label);
      if (!label || !regex) continue;
      const key = `${mode}:${label.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const group = mode === 'waystone' ? inferWaystoneGroup(label) : urlGroup;
      blocks.push({
        id: `${mode}-${blocks.length + 1}`,
        mode,
        group,
        label,
        shortLabel: makeShortLabel(label),
        description: label,
        terms: [regex],
        source: 'poe2db.tw',
      });
    }
  }
  return blocks.sort((a, b) => a.group.localeCompare(b.group) || a.label.localeCompare(b.label));
}

function inferGroupFromUrl(mode, url) {
  if (mode === 'tablet') {
    if (url.includes('Abyss')) return 'Abyss';
    if (url.includes('Breach')) return 'Breach';
    if (url.includes('Delirium')) return 'Delirium';
    if (url.includes('Expedition')) return 'Expedition';
    if (url.includes('Ritual')) return 'Ritual';
    if (url.includes('Overseer')) return 'Overseer';
    return 'General';
  }
  return titleCase(mode);
}

function inferWaystoneGroup(label) {
  const l = label.toLowerCase();
  if (/breach/i.test(l)) return 'Breach';
  if (/delirium|simulacrum/i.test(l)) return 'Delirium';
  if (/expedition/i.test(l)) return 'Expedition';
  if (/ritual/i.test(l)) return 'Ritual';
  if (/strongbox/i.test(l)) return 'Strongboxes';
  if (/shrine/i.test(l)) return 'Shrines';
  if (/boss/i.test(l)) return 'Bosses';
  if (/monster|enemy|rare.*pack|magic.*pack/i.test(l)) return 'Monsters';
  if (/experience/i.test(l)) return 'Experience';
  if (/quantity|rarity|pack size|item.*found|waystone.*found|gold/i.test(l)) return 'Rewards';
  return 'General';
}

function makeShortLabel(label) {
  const cleaned = label
    .replace(/#/g, '')
    .replace(/[|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (cleaned.length <= 42) return cleaned;
  return cleaned.slice(0, 40).trimEnd() + '…';
}

function extractPoe2dbModifierLabels(html) {
  const labels = [];
  const explicitModRe = /<(?:span|div)\s+class="[^"]*\bexplicitMod\b[^"]*"[^>]*>([\s\S]*?)<\/(?:span|div)>/gi;
  let match;
  while ((match = explicitModRe.exec(html))) {
    const label = normalizeRegexLabel(match[1]);
    if (isUsablePoe2dbModifier(label)) labels.push(label);
  }

  const embeddedStringRe = /"str":"((?:\\.|[^"\\])*)"/g;
  while ((match = embeddedStringRe.exec(html))) {
    const label = normalizeRegexLabel(decodeJsonString(match[1]));
    if (isUsablePoe2dbModifier(label)) labels.push(label);
  }

  return labels;
}

function isUsablePoe2dbModifier(label) {
  return Boolean(
    label &&
    !label.includes('{{') &&
    !label.includes('}}') &&
    !/^current stats$/i.test(label)
  );
}

function normalizeRegexLabel(value) {
  return String(value)
    .replace(/<br\s*\/?>/gi, ' | ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/\\\//g, '/')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&ndash;|&mdash;|—/g, '-')
    .replace(/&#39;/g, "'")
    .replace(/\r?\n/g, ' | ')
    .replace(/\[[^\]]+\]/g, (match) => match.slice(1, -1))
    .replace(/[+-]?\d+(?:\.\d+)?%?/g, '#')
    .replace(/\s+/g, ' ')
    .trim();
}

function decodeJsonString(value) {
  try {
    return JSON.parse(`"${value}"`);
  } catch {
    return String(value).replace(/\\"/g, '"').replace(/\\n/g, ' ');
  }
}

function makeRegexTerm(label) {
  const words = label
    .toLowerCase()
    .replace(/#/g, ' ')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length >= 4 && !COMMON_REGEX_WORDS.has(word));
  const chosen = [...new Set(words)].slice(0, 4);
  if (!chosen.length) return '';
  return chosen.map(escapeRegexPart).join('.*');
}

const COMMON_REGEX_WORDS = new Set([
  'increased',
  'reduced',
  'chance',
  'with',
  'from',
  'your',
  'have',
  'gain',
  'while',
  'area',
  'level',
]);

function escapeRegexPart(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function titleCase(value) {
  return value.replace(/\w\S*/g, (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());
}

app.listen(PORT, () => {
  console.log(`PoB -> PoE2 Build Planner converter running on http://localhost:${PORT}`);
});
