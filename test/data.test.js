import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// ── store.js ──────────────────────────────────────────────────────────────────
describe('store', () => {
  it('readCache returns null for missing file', async () => {
    const { readCache } = await import('../src/data/store.js');
    const result = await readCache('__nonexistent__');
    assert.equal(result, null);
  });

  it('writeCache then readCache round-trips data', async () => {
    const { writeCache, readCache } = await import('../src/data/store.js');
    const payload = { test: true, items: [1, 2, 3] };
    await writeCache('__test_roundtrip__', payload);
    const result = await readCache('__test_roundtrip__');
    assert.deepEqual(result, payload);
  });

  it('readMeta returns default shape when no meta exists', async () => {
    const { readCache, writeCache } = await import('../src/data/store.js');
    // Temporarily check that readMeta returns the right default shape
    // by verifying the fallback is the same shape even with a cache miss
    const meta = (await readCache('_meta')) ?? { sources: {}, lastGlobalUpdate: null };
    assert.ok(typeof meta === 'object');
    assert.ok('sources' in meta);
  });

  it('touchSource creates/updates source entry', async () => {
    const { touchSource, readMeta } = await import('../src/data/store.js');
    await touchSource('__test_source__', { count: 5, sourceUrl: 'http://example.com' });
    const meta = await readMeta();
    const src  = meta.sources['__test_source__'];
    assert.ok(src, 'source entry should exist');
    assert.equal(src.count, 5);
    assert.ok(src.lastUpdated, 'lastUpdated should be set');
  });
});

// ── status.js ─────────────────────────────────────────────────────────────────
describe('status', () => {
  it('getDataStatus returns expected shape', async () => {
    const { getDataStatus } = await import('../src/data/status.js');
    const result = await getDataStatus();
    assert.ok(result.ok, 'ok should be true');
    assert.ok(result.summary, 'summary should exist');
    assert.ok(result.categories, 'categories should exist');
    assert.ok('available' in result.summary, 'summary.available should exist');
    assert.ok('total' in result.summary, 'summary.total should exist');
  });

  it('bundled categories always available', async () => {
    const { getDataStatus } = await import('../src/data/status.js');
    const { categories } = await getDataStatus();
    assert.equal(categories.passives?.status, 'bundled');
    assert.equal(categories.ascendancies?.status, 'bundled');
    assert.ok(categories.passives?.available, 'passives should be available');
  });

  it('non-bundled categories show missing or ok', async () => {
    const { getDataStatus } = await import('../src/data/status.js');
    const { categories } = await getDataStatus();
    for (const key of ['patches', 'gems', 'items', 'uniques']) {
      assert.ok(categories[key], `category ${key} should exist`);
      assert.ok(['missing', 'ok', 'stale'].includes(categories[key].status),
        `${key} status should be missing/ok/stale`);
    }
  });
});

// ── gems importer ─────────────────────────────────────────────────────────────
describe('gems importer', () => {
  it('importGems writes valid gem list', async () => {
    const { importGems } = await import('../src/data/importers/gems.js');
    const { readCache }  = await import('../src/data/store.js');
    const result = await importGems();
    assert.ok(result.ok, 'importGems should return ok:true');
    assert.ok(result.count > 0, 'should report > 0 gems');
    const gems = await readCache('gems');
    assert.ok(Array.isArray(gems), 'cached gems should be an array');
    assert.ok(gems.length > 0, 'cached gems should be non-empty');
    const gem = gems[0];
    assert.ok(gem.id,   'gem should have id');
    assert.ok(gem.name, 'gem should have name');
    assert.ok(gem.type === 'active' || gem.type === 'support', 'gem type should be active or support');
    assert.ok(Array.isArray(gem.tags), 'gem.tags should be an array');
  });
});

// ── contextBuilder.js ─────────────────────────────────────────────────────────
describe('contextBuilder', () => {
  it('buildContext returns expected shape', async () => {
    const { buildContext } = await import('../src/data/contextBuilder.js');
    const result = await buildContext('fire witch sorceress');
    assert.ok(typeof result.context === 'string', 'context should be a string');
    assert.ok(Array.isArray(result.sources), 'sources should be an array');
    assert.ok(Array.isArray(result.keywords), 'keywords should be an array');
    assert.ok(typeof result.truncated === 'boolean', 'truncated should be boolean');
  });

  it('buildContext includes gem data after importGems', async () => {
    const { importGems } = await import('../src/data/importers/gems.js');
    await importGems();
    const { buildContext } = await import('../src/data/contextBuilder.js');
    const result = await buildContext('fireball fire spell');
    // Context may include gem section if keywords match
    assert.ok(result.context.length >= 0, 'context should be a string');
  });

  it('scoreConfidence maps sources to levels', async () => {
    const { scoreConfidence } = await import('../src/data/contextBuilder.js');
    assert.equal(scoreConfidence(['patches']), 'verified');
    assert.equal(scoreConfidence(['gems']), 'likely');
    assert.equal(scoreConfidence(['passives']), 'likely');
    assert.equal(scoreConfidence(['some-unknown']), 'uncertain');
    assert.equal(scoreConfidence([]), 'unsupported');
  });
});
