import { test } from 'node:test';
import assert from 'node:assert/strict';
import zlib from 'node:zlib';
import { decodePobCode, parsePobXml } from '../src/pobParser.js';
import { convertToBuild } from '../src/converter.js';
import { resolveInput } from '../src/resolve.js';

const SAMPLE_XML = `<?xml version="1.0" encoding="UTF-8"?>
<PathOfBuilding>
  <Build level="92" className="Sorceress" ascendClassName="Stormweaver" mainSocketGroup="1">
    <PlayerStat stat="Life" value="3200"/>
  </Build>
  <Skills activeSkillSet="1">
    <SkillSet id="1">
      <Skill mainActiveSkill="1" enabled="true" slot="Weapon 1">
        <Gem nameSpec="Spark" skillId="Spark" level="20" quality="20" enabled="true"/>
        <Gem nameSpec="Added Lightning Damage" skillId="SupportAddedLightning" level="20" quality="0" support="true"/>
      </Skill>
    </SkillSet>
  </Skills>
  <Tree activeSpec="1">
    <Spec treeVersion="0_2" classId="6" ascendClassId="1" nodes="100,200,300,400"/>
  </Tree>
  <Items activeItemSet="1">
    <Item id="1">Rarity: UNIQUE
Mageblood
Heavy Belt
Item Level: 84
+50 to maximum Life</Item>
    <Item id="2">Rarity: RARE
Doom Cowl
Iron Hat</Item>
    <ItemSet id="1">
      <Slot name="Belt" itemId="1"/>
      <Slot name="Helmet" itemId="2"/>
    </ItemSet>
  </Items>
  <Notes>Strong endgame mapper.</Notes>
</PathOfBuilding>`;

function encodePob(xml) {
  const compressed = zlib.deflateSync(Buffer.from(xml, 'utf8'));
  return compressed
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

test('decodePobCode round-trips a deflate+base64url code', () => {
  const code = encodePob(SAMPLE_XML);
  const xml = decodePobCode(code);
  assert.match(xml, /<PathOfBuilding/);
  assert.match(xml, /Stormweaver/);
});

test('parsePobXml extracts meta, skills, tree, items, notes', () => {
  const build = parsePobXml(SAMPLE_XML);
  assert.equal(build.meta.className, 'Sorceress');
  assert.equal(build.meta.ascendClassName, 'Stormweaver');
  assert.equal(build.meta.level, 92);

  assert.equal(build.skills.length, 1);
  assert.equal(build.skills[0].actives[0].nameSpec, 'Spark');
  assert.equal(build.skills[0].supports[0].nameSpec, 'Added Lightning Damage');

  assert.deepEqual(build.tree.nodes, ['100', '200', '300', '400']);

  assert.equal(build.items.slots.length, 2);
  const belt = build.items.list.find((i) => i.id === '1');
  assert.equal(belt.isUnique, true);
  assert.equal(belt.uniqueName, 'Mageblood');

  assert.match(build.notes, /endgame mapper/);
});

test('convertToBuild produces a valid .build object with a classification report', () => {
  const build = parsePobXml(SAMPLE_XML);
  const { build: out, report } = convertToBuild(build, {});

  // name auto-derived from ascendancy + level
  assert.equal(out.name, 'Stormweaver Lvl 92');
  assert.equal(out.ascendancy, 'Stormweaver');

  // skills: main + support
  assert.equal(out.skills.length, 1);
  assert.match(out.skills[0].id, /^Metadata\/Items\/Gems\/SkillGem/);
  assert.equal(out.skills[0].support_skills.length, 1);
  assert.match(out.skills[0].support_skills[0].id, /SupportGem/);
  assert.deepEqual(out.skills[0].level_interval, [0, 100]);

  // passives present, first carries a note
  assert.equal(out.passives.length, 4);
  assert.equal(typeof out.passives[0], 'object');
  assert.equal(out.passives[1], '200');

  // items: belt mapped + unique_name set
  const beltOut = out.items.find((i) => i.inventory_id === 'Belt');
  assert.ok(beltOut);
  assert.equal(beltOut.unique_name, 'Mageblood');

  // report categories populated
  assert.ok(report.converted.length > 0);
  assert.ok(report.guessed.length > 0);
});

test('resolveInput auto-detects a PoB export code', async () => {
  const code = encodePob(SAMPLE_XML);
  const { build, source } = await resolveInput(code, { kind: 'auto' });
  assert.equal(source.kind, 'pobcode');
  assert.equal(build.meta.className, 'Sorceress');
});

test('resolveInput auto-detects raw XML', async () => {
  const { source } = await resolveInput(SAMPLE_XML, { kind: 'auto' });
  assert.equal(source.kind, 'xml');
});

test('decodePobCode rejects garbage', () => {
  assert.throws(() => decodePobCode('not a real code!!!'), /PoB/i);
});
