import test from 'node:test';
import assert from 'node:assert/strict';
import { convertToBuild } from '../src/converter.js';

test('Build Converter - Passives Round-Trip Accuracy', () => {
  // 1. Initial GGG-compliant build source
  const sourceBuild = {
    name: 'GGG Compliant Witch Starter',
    class: 'Witch',
    ascendancy: 'Lich',
    passives: [
      { id: 'lightning14', level_interval: [0, 100] },
      { id: 'cold_res3', level_interval: [0, 100] },
      { id: 'AscendancyWitch3Small1', level_interval: [0, 100] },
      { id: 'AscendancyWitch3Notable1', level_interval: [0, 100] }
    ],
    skills: [],
    items: []
  };

  // 2. First conversion (simulate export/normalization)
  const conversion1 = convertToBuild(sourceBuild);
  const exportedBuild = conversion1.build;

  // Assert that conversion mapped correctly
  assert.ok(exportedBuild.passives);
  assert.equal(exportedBuild.passives.length, 4);
  assert.equal(exportedBuild.passives[0].id, 'lightning14');
  assert.equal(exportedBuild.passives[2].id, 'AscendancyWitch3Small1');

  // 3. Second conversion (simulate re-importing the exported GGG compliant build)
  const conversion2 = convertToBuild(exportedBuild);
  const reimportedBuild = conversion2.build;

  // 4. Compare allocated Passive ID Sets
  const sourceIds = sourceBuild.passives.map(p => p.id);
  const reimportedIds = reimportedBuild.passives.map(p => p.id);

  assert.deepEqual(reimportedIds, sourceIds, 'Round-trip passive node GGG string IDs must match exactly!');
  console.log('[TreeTest] Round-trip passive ID validation passed successfully.');
});
