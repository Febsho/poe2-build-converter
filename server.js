import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { resolveAndConvert, inspectInput } from './src/resolve.js';

const require = createRequire(import.meta.url);

// Build a reverse lookup map: GGG passive id → human-readable name
// e.g. "lightning14" → "Shock Chance"
const _passivesRaw = require('./src/data/passives_default.json');
const PASSIVE_DISPLAY_NAMES = Object.fromEntries(
  Object.values(_passivesRaw)
    .filter((e) => e.id && e.name)
    .map((e) => [e.id, e.name])
);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/health', (_req, res) => res.json({ ok: true }));

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
    for (const p of result.build.passives ?? []) {
      const id = typeof p === 'string' ? p : p?.id;
      if (id && PASSIVE_DISPLAY_NAMES[id]) passiveNames[id] = PASSIVE_DISPLAY_NAMES[id];
    }

    return res.json({
      ok: true,
      source: result.source,
      report: result.report,
      build: result.build,
      preview: result.normalizedBuild,
      passiveNames,
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

app.listen(PORT, () => {
  console.log(`PoB -> PoE2 Build Planner converter running on http://localhost:${PORT}`);
});
