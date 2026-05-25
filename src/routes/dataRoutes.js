import { Router } from 'express';
import { getDataStatus } from '../data/status.js';
import { readCache } from '../data/store.js';
import { importAll } from '../data/importers/index.js';

const router = Router();

// GET /api/data/status
router.get('/status', async (_req, res) => {
  try {
    const status = await getDataStatus();
    res.json(status);
  } catch (err) {
    res.status(500).json({ ok: false, error: 'Failed to read data status.' });
  }
});

// POST /api/data/update  — protected by optional DATA_UPDATE_TOKEN
router.post('/update', async (req, res) => {
  const token = process.env.DATA_UPDATE_TOKEN;
  if (token) {
    const provided = req.headers['x-update-token'] || req.body?.token;
    if (provided !== token) {
      return res.status(403).json({ ok: false, error: 'Forbidden.' });
    }
  }

  const categories = req.body?.categories ?? null; // null = all
  try {
    const results = await importAll({ categories });
    res.json({ ok: true, results });
  } catch (err) {
    res.status(500).json({ ok: false, error: 'Import failed.' });
  }
});

// GET /api/data/search?q=<query>&type=gems|patches|all
router.get('/search', async (req, res) => {
  const q    = (req.query.q || '').toLowerCase().trim();
  const type = req.query.type || 'all';

  if (!q) return res.json({ ok: true, results: {} });

  try {
    const results = {};

    if (type === 'all' || type === 'gems') {
      const gems = await readCache('gems');
      results.gems = (gems || []).filter(g =>
        g.name?.toLowerCase().includes(q) ||
        (g.tags || []).some(t => t.includes(q)) ||
        g.desc?.toLowerCase().includes(q)
      ).slice(0, 20);
    }

    if (type === 'all' || type === 'patches') {
      const patches = await readCache('patches');
      results.patches = (patches || []).filter(p =>
        p.title?.toLowerCase().includes(q) ||
        p.summary?.toLowerCase().includes(q) ||
        (p.keywords || []).some(k => k.includes(q))
      ).slice(0, 10);
    }

    res.json({ ok: true, query: q, results });
  } catch (err) {
    res.status(500).json({ ok: false, error: 'Search failed.' });
  }
});

// GET /api/data/crafting/data
router.get('/crafting/data', async (_req, res) => {
  try {
    const rawBases = await readCache('items') ?? [];
    const { transformCachedItemBases } = await import('../data/poe2/itemBases.ts');
    const { POE2_MODIFIERS } = await import('../data/poe2/modifiers.ts');
    const { POE2_ESSENCES } = await import('../data/poe2/essences.ts');
    const { POE2_OMENS } = await import('../data/poe2/omens.ts');
    const { POE2_RUNES } = await import('../data/poe2/runes.ts');
    const { POE2_SOUL_CORES } = await import('../data/poe2/soulCores.ts');
    const { POE2_ABYSS_CRAFTING } = await import('../data/poe2/abyss.ts');
    const { POE2_QUALITY_CURRENCIES } = await import('../data/poe2/quality.ts');
    const { POE2_CORRUPTION_OUTCOMES } = await import('../data/poe2/corruption.ts');
    const { POE2_SOCKET_CRAFT_OPTIONS } = await import('../data/poe2/socketCrafting.ts');
    const { POE2_CRAFTING_MECHANICS } = await import('../data/poe2/craftingMechanics.ts');
    const { desecrationCraftingData } = await import('../data/poe2/desecration.ts');

    const bases = transformCachedItemBases(rawBases);
    res.json({
      ok: true,
      bases,
      modifiers: POE2_MODIFIERS,
      essences: POE2_ESSENCES,
      omens: POE2_OMENS,
      runes: POE2_RUNES,
      soulCores: POE2_SOUL_CORES,
      abyssData: POE2_ABYSS_CRAFTING,
      desecrationData: desecrationCraftingData,
      qualityData: POE2_QUALITY_CURRENCIES,
      corruptionData: POE2_CORRUPTION_OUTCOMES,
      socketCraftingData: POE2_SOCKET_CRAFT_OPTIONS,
      craftingMechanics: POE2_CRAFTING_MECHANICS,
      metadata: {
        source: 'poe2db.tw',
        modifierWeights: 'tier-estimated',
        basesCount: bases.length,
        modifiersCount: POE2_MODIFIERS.length,
      },
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

export default router;
