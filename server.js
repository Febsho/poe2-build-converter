import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveAndConvert } from './src/resolve.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/health', (_req, res) => res.json({ ok: true }));

/**
 * Convert any supported input into the PoE2 .build object + a report.
 * Body: { input: string, kind?: string, name?: string, description?: string }
 */
app.post('/api/convert', async (req, res) => {
  const { input, kind, name, description } = req.body ?? {};
  if (!input || typeof input !== 'string') {
    return res.status(400).json({ error: 'Missing "input" string in request body.' });
  }

  try {
    const result = await resolveAndConvert(input, { kind, name, description });
    const filename = `${sanitizeFilename(result.build.name)}.build`;
    return res.json({
      ok: true,
      source: result.source,
      report: result.report,
      build: result.build,
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
