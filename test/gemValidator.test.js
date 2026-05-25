import test from 'node:test';
import assert from 'node:assert/strict';
import { convertToBuild } from '../src/converter.js';

test('Smart Gem-Link Compatibility Validator', async (t) => {
  await t.test('accepts a valid gem combination (Spell Echo + Fireball) without warnings', () => {
    const build = {
      meta: { className: 'Witch' },
      skills: [
        {
          enabled: true,
          actives: [{ gemId: 'Metadata/Items/Gem/SkillGemFireball', nameSpec: 'Fireball', enabled: true }],
          supports: [{ gemId: 'Metadata/Items/Gems/SupportGemSpellEcho', nameSpec: 'Spell Echo Support', enabled: true }]
        }
      ]
    };

    const { report } = convertToBuild(build);
    
    // Should have no skill link warnings
    const warnings = report.warnings.filter(w => w.startsWith('Skill Link Warning:'));
    assert.equal(warnings.length, 0);
  });

  await t.test('flags an invalid gem combination (Spell Echo + Heavy Strike) with a helpful warning', () => {
    const build = {
      meta: { className: 'Warrior' },
      skills: [
        {
          enabled: true,
          actives: [{ gemId: 'Metadata/Items/Gem/SkillGemHeavyStrike', nameSpec: 'Heavy Strike', enabled: true }],
          supports: [{ gemId: 'Metadata/Items/Gems/SupportGemSpellEcho', nameSpec: 'Spell Echo Support', enabled: true }]
        }
      ]
    };

    const { report } = convertToBuild(build);
    
    const warnings = report.warnings.filter(w => w.startsWith('Skill Link Warning:'));
    assert.equal(warnings.length, 1);
    assert.ok(warnings[0].includes('does not support "Heavy Strike"'));
    assert.ok(warnings[0].includes('requires a Spell skill'));
  });

  await t.test('validates minion supports correctly', () => {
    // Raise Zombie + Meat Shield (valid)
    const validBuild = {
      meta: { className: 'Witch' },
      skills: [
        {
          enabled: true,
          actives: [{ gemId: 'Metadata/Items/Gem/SkillGemRaiseZombie', nameSpec: 'Raise Zombie', enabled: true }],
          supports: [{ gemId: 'Metadata/Items/Gems/SupportGemMeatShield', nameSpec: 'Meat Shield Support', enabled: true }]
        }
      ]
    };
    const { report: validReport } = convertToBuild(validBuild);
    assert.equal(validReport.warnings.filter(w => w.startsWith('Skill Link Warning:')).length, 0);

    // Cyclone + Meat Shield (invalid)
    const invalidBuild = {
      meta: { className: 'Monk' },
      skills: [
        {
          enabled: true,
          actives: [{ gemId: 'Metadata/Items/Gem/SkillGemCyclone', nameSpec: 'Cyclone', enabled: true }],
          supports: [{ gemId: 'Metadata/Items/Gems/SupportGemMeatShield', nameSpec: 'Meat Shield Support', enabled: true }]
        }
      ]
    };
    const { report: invalidReport } = convertToBuild(invalidBuild);
    const warnings = invalidReport.warnings.filter(w => w.startsWith('Skill Link Warning:'));
    assert.equal(warnings.length, 1);
    assert.ok(warnings[0].includes('requires a Minion skill'));
  });

  await t.test('resolves different naming variations correctly', () => {
    const build = {
      meta: { className: 'Sorceress' },
      skills: [
        {
          enabled: true,
          actives: [{ gemId: '', nameSpec: 'flame-blast', enabled: true }],
          supports: [{ gemId: '', nameSpec: 'spell echo', enabled: true }]
        }
      ]
    };
    const { report } = convertToBuild(build);
    assert.equal(report.warnings.filter(w => w.startsWith('Skill Link Warning:')).length, 0);
  });
});
