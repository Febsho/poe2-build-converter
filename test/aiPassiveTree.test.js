import test from 'node:test';
import assert from 'node:assert/strict';

import {
  arePassiveIdsConnected,
  buildConnectedPassiveIds,
  repairAiBuildPassives,
} from '../src/features/ai/lib/passiveTree.js';

test('AI passive targets are expanded into a connected PoB2 allocation', () => {
  const scatteredTargets = [
    'lightning14',
    'energy_shield38',
    'critical40',
    'passive_keystone_zealots_oath',
  ];

  const repaired = buildConnectedPassiveIds(scatteredTargets, {
    className: 'Witch',
    ascendancy: 'Lich',
  });

  assert.ok(repaired.passives.length > scatteredTargets.length);
  assert.equal(
    arePassiveIdsConnected(repaired.passives, { className: 'Witch', ascendancy: 'Lich' }),
    true
  );
  assert.ok(repaired.passives.includes('lightning14'));
});

test('AI ascendancy passives are capped at obtainable points', () => {
  const lichNodes = [
    'AscendancyWitch3Start_',
    'AscendancyWitch3Small1',
    'AscendancyWitch3Notable1',
    'AscendancyWitch3Small2',
    'AscendancyWitch3Notable2',
    'AscendancyWitch3Small3',
    'AscendancyWitch3Notable3',
    'AscendancyWitch3Small4',
    'AscendancyWitch3Notable4',
    'AscendancyWitch3Small5',
    'AscendancyWitch3Notable5',
  ];

  const { build, stats } = repairAiBuildPassives({
    class: 'Witch',
    ascendancy: 'Lich',
    mainSkill: 'Spark',
    passives: lichNodes,
  });

  const ascCount = build.passives.filter((id) => id.startsWith('AscendancyWitch3')).length;
  assert.ok(ascCount <= 8);
  assert.ok(stats.ascendancyOmittedCount > 0);
  assert.match(build.validationWarnings.join('\n'), /PathOfBuilding-PoE2 graph data/);
});
