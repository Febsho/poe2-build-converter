import test from 'node:test';
import assert from 'node:assert/strict';
import { buildContext, scoreConfidence } from '../src/data/contextBuilder.js';

test('Live Context Engine Integration', async (t) => {
  await t.test('buildContext handles standard queries and retrieves structured sources', async () => {
    const result = await buildContext('Create a fire Sorceress build utilizing Headhunter and fireball');
    
    assert.ok(result);
    assert.ok(Array.isArray(result.sources));
    assert.ok(Array.isArray(result.keywords));
    assert.ok(typeof result.context === 'string');

    // Should successfully extract key terms
    assert.ok(result.keywords.includes('fire'));
    assert.ok(result.keywords.includes('headhunter'));
    assert.ok(result.keywords.includes('fireball'));

    // Should aggregate sources
    assert.ok(result.sources.length > 0);
  });

  await t.test('scoreConfidence maps sources correctly', () => {
    assert.equal(scoreConfidence(['patches']), 'verified');
    assert.equal(scoreConfidence(['gems']), 'likely');
    assert.equal(scoreConfidence(['passives', 'uniques']), 'likely');
    assert.equal(scoreConfidence(['unknown_source']), 'uncertain');
    assert.equal(scoreConfidence([]), 'unsupported');
  });
});
