import test from 'node:test';
import assert from 'node:assert/strict';
import { generatePobCodeFromAiBuild } from '../src/features/ai/lib/pobExport.ts';
import { decodePobCode } from '../src/pobParser.js';

test('PoB Export Utility', async (t) => {
  const validBuild = {
    buildName: 'Test Witch Starter',
    class: 'Witch',
    ascendancy: 'Necromancer',
    mainSkill: 'Summon Raging Spirit',
    supportGems: ['Minion Damage Support', 'Melee Splash Support'],
    secondarySkills: ['Desecrate', 'Flesh Offering'],
    defensiveLayers: ['Energy Shield', 'Minion Block'],
    passiveTreePlan: ['Path to Lord of the Dead', 'Path to Death Attunement'],
    gearPriorities: ['+1 to Level of all Minion Skill Gems', 'Life', 'Resistances'],
    levelingPlan: ['Act 1: Use Freezing Pulse until Summon Raging Spirit'],
    validationWarnings: ['Minion Damage Support might be legacy.']
  };

  await t.test('generates valid URL-safe base64 PoB2 export code from a valid build', () => {
    const code = generatePobCodeFromAiBuild(validBuild);
    assert.ok(typeof code === 'string');
    assert.ok(code.length > 50);
    // PoB2 uses URL-safe base64: + replaced with -, / replaced with _
    assert.equal(code.includes('+'), false, 'should not contain +');
    assert.equal(code.includes('/'), false, 'should not contain /');
  });

  await t.test('generated PoB2 code is decodable back to valid XML containing build metadata', () => {
    const code = generatePobCodeFromAiBuild(validBuild);
    const xml = decodePobCode(code);

    assert.ok(xml.includes('<PathOfBuilding>'), 'should use PathOfBuilding root for PoE2');
    assert.ok(xml.includes('className="Witch"'));
    assert.ok(xml.includes('ascendClassName="Necromancer"'));
    assert.ok(xml.includes('nameSpec="Summon Raging Spirit"'));
    assert.ok(xml.includes('nameSpec="Minion Damage Support"'));
    assert.ok(xml.includes('nameSpec="Desecrate"'));
    assert.ok(xml.includes('Test Witch Starter'));
    assert.ok(xml.includes('Minion Damage Support might be legacy.'));
  });

  await t.test('throws validation error when main skill is missing', () => {
    const invalidBuild = {
      buildName: 'Invalid Build',
      class: 'Witch',
      supportGems: ['Added Cold Damage']
    };

    assert.throws(() => {
      generatePobCodeFromAiBuild(invalidBuild);
    }, /Cannot generate PoB code: missing main skill\./);
  });

  await t.test('successfully generates code and includes warnings when class is missing', () => {
    const missingClassBuild = {
      buildName: 'No Class Build',
      mainSkill: 'Spark',
      supportGems: ['Pierce Support']
    };

    const code = generatePobCodeFromAiBuild(missingClassBuild);
    assert.ok(typeof code === 'string');
    
    const xml = decodePobCode(code);
    assert.ok(xml.includes('PoB export may be incomplete: missing class.'));
  });
});
