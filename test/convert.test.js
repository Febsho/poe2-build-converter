import { test } from 'node:test';
import assert from 'node:assert/strict';
import zlib from 'node:zlib';
import { decodePobCode, parsePobXml } from '../src/pobParser.js';
import { convertToBuild } from '../src/converter.js';
import { resolveInput } from '../src/resolve.js';
import { toRawUrl } from '../src/pobbin.js';
import { resolveGemLevel } from '../src/gemLevels.js';

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

  assert.deepEqual(build.tree.nodes, [100, 200, 300, 400]);

  assert.equal(build.items.slots.length, 2);
  const belt = build.items.list.find((i) => i.id === '1');
  assert.equal(belt.isUnique, true);
  assert.equal(belt.uniqueName, 'Mageblood');

  assert.match(build.notes, /endgame mapper/);
});

test('parsePobXml and convertToBuild use ascendancy stored on the active tree spec', () => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<PathOfBuilding2>
  <Build level="95" className="Sorceress" />
  <Tree activeSpec="2">
    <Spec treeVersion="0_3" classId="6" ascendClassId="1" ascendancyInternalId="Sorceress1" nodes=""/>
    <Spec treeVersion="0_3" classId="6" ascendClassId="2" ascendancyInternalId="Sorceress2" nodes="38304"/>
  </Tree>
</PathOfBuilding2>`;

  const build = parsePobXml(xml);
  assert.equal(build.meta.ascendancyInternalId, 'Sorceress2');
  assert.equal(build.meta.ascendClassId, 2);
  assert.equal(build.tree.activeSpec.ascendancyInternalId, 'Sorceress2');

  const { build: out, report } = convertToBuild(build);
  assert.equal(out.ascendancy, 'Sorceress2');
  assert.equal(report.warnings.some((line) => line.includes('No ascendancy found')), false);
});

test('convertToBuild prefers selected ascendancy passives when source class metadata is weak', () => {
  const build = {
    meta: { className: 'Witch' },
    skills: [],
    tree: { nodes: [3165], specs: [{ nodes: [3165] }] },
    items: { list: [], slots: [], catalog: {} },
  };

  const { build: out, report } = convertToBuild(build);
  assert.equal(out.ascendancy, 'Witch2');
  assert.equal(report.warnings.some((line) => line.includes('No ascendancy found')), false);
});

test('parsePobXml includes PoB ascendancyNodes in converted passives', () => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<PathOfBuilding2>
  <Build level="90" className="Witch" ascendClassName="Blood Mage" />
  <Tree activeSpec="1">
    <Spec treeVersion="0_3" classId="3" ascendClassId="2" nodes="" ascendancyNodes="3165"/>
  </Tree>
</PathOfBuilding2>`;

  const build = parsePobXml(xml);
  assert.deepEqual(build.tree.activeSpec.ascendancyNodes, [3165]);
  assert.deepEqual(build.tree.activeSpec.nodes, []);

  const { build: out } = convertToBuild(build);
  assert.equal(out.passives.some((p) => p.id === 'AscendancyWitch2Small7'), true);
  assert.equal(out.passives.some((p) => p.id === 'AscendancyWitch2Notable3'), false);
});

test('convertToBuild caps PoB ascendancy passives at eight nodes', () => {
  const ascendancyNodes = [
    3165, 8415, 23416, 26282, 26383,
    27667, 30071, 30117, 31223, 47442,
  ].join(',');
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<PathOfBuilding2>
  <Build level="90" className="Witch" ascendClassName="Blood Mage" />
  <Tree activeSpec="1">
    <Spec treeVersion="0_3" classId="3" ascendClassId="2" nodes="" ascendancyNodes="${ascendancyNodes}"/>
  </Tree>
</PathOfBuilding2>`;

  const build = parsePobXml(xml);
  const { build: out, report } = convertToBuild(build);
  const ascendancyPassives = out.passives.filter((passive) => /^Ascendancy/.test(passive.id));

  assert.equal(ascendancyPassives.length, 8);
  assert.equal(ascendancyPassives.some((passive) => passive.id === 'AscendancyWitch2Notable8'), false);
  assert.equal(report.warnings.some((line) => line.includes('extra ascendancy node')), true);
});

test('parsePobXml includes nested PoB node entries in converted passives', () => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<PathOfBuilding2>
  <Build level="90" className="Witch" ascendClassName="Blood Mage" />
  <Tree activeSpec="1">
    <Spec treeVersion="0_3" classId="3" ascendClassId="2" nodes="">
      <AscendancyNodes>
        <Node id="3165"/>
      </AscendancyNodes>
    </Spec>
  </Tree>
</PathOfBuilding2>`;

  const build = parsePobXml(xml);
  assert.deepEqual(build.tree.activeSpec.ascendancyNodes, [3165]);

  const { build: out } = convertToBuild(build);
  assert.equal(out.passives.some((p) => p.id === 'AscendancyWitch2Small7'), true);
  assert.equal(out.passives.some((p) => p.id === 'AscendancyWitch2Notable3'), false);
});

test('parsePobXml infers support gem level from rank suffix when PoB level is missing', () => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<PathOfBuilding>
  <Build level="92" className="Witch" ascendClassName="Infernalist" />
  <Skills activeSkillSet="1">
    <SkillSet id="1">
      <Skill enabled="true">
        <Gem gemId="Metadata/Items/Gems/SkillGemEssenceDrain" nameSpec="Essence Drain" skillId="EssenceDrain" enabled="true"/>
        <Gem gemId="Metadata/Items/Gems/SupportGemSwiftAffliction" nameSpec="Swift Affliction II" skillId="SupportGemSwiftAffliction" support="true" enabled="true"/>
      </Skill>
    </SkillSet>
  </Skills>
</PathOfBuilding>`;

  const build = parsePobXml(xml);
  assert.equal(build.skills[0].supports[0].level, 2);
});

test('support gem rank suffix overrides misleading explicit preview level', () => {
  assert.equal(
    resolveGemLevel(20, 'Persistence II', 'Metadata/Items/Gems/SupportGemPersistenceTwo', { preferNameSuffix: true }),
    2
  );
  assert.equal(
    resolveGemLevel(20, 'Unleash', 'Metadata/Items/Gems/SupportGemUnleash', { preferNameSuffix: true }),
    20
  );
});

test('parsePobXml extracts rune names from item text', () => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<PathOfBuilding>
  <Build level="92" className="Witch" ascendClassName="Infernalist" />
  <Items activeItemSet="1">
    <Item id="1">Rarity: RARE
Rune Visage
Kamasan Tiara
Rune: Greater Iron Rune
Item Level: 79
Implicits: 0
+66% increased Energy Shield</Item>
    <ItemSet id="1">
      <Slot name="Helmet" itemId="1"/>
    </ItemSet>
  </Items>
</PathOfBuilding>`;

  const build = parsePobXml(xml);
  assert.deepEqual(build.items.list[0].runes, ['Greater Iron Rune']);
});

test('convertToBuild produces a valid .build object with a classification report', () => {
  const build = parsePobXml(SAMPLE_XML);
  const { build: out, report } = convertToBuild(build, {});

  // name auto-derived from class + ascendancy when no source title is available
  assert.equal(out.name, 'Sorceress - Stormweaver');
  assert.equal(out.ascendancy, 'Sorceress1');

  // sample PoB lacks PoE2 gem metadata paths, so skills are reported unsupported
  assert.equal(out.skills, undefined);
  assert.equal(out.passives, undefined);
  assert.ok(report.unsupported.some((line) => line.includes('Spark')));

  // items: belt mapped + unique_name set
  const beltOut = out.items.find((i) => i.inventory_id === 'Belt');
  assert.ok(beltOut);
  assert.equal(beltOut.unique_name, 'Mageblood');

  // report categories populated
  assert.ok(report.converted.length > 0);
  assert.ok(report.guessed.length > 0);
});

test('convertToBuild includes rune lines in item additional_text', () => {
  const build = parsePobXml(SAMPLE_XML);
  build.items = {
    list: [{
      id: '1',
      rarity: 'RARE',
      name: 'Rune Visage',
      typeLine: 'Kamasan Tiara',
      isUnique: false,
      implicits: ['+10 to maximum Mana'],
      explicits: ['+66% increased Energy Shield'],
      runes: ['Greater Iron Rune'],
    }],
    slots: [{ name: 'Helmet', itemId: '1' }],
    catalog: {
      '1': {
        id: '1',
        rarity: 'RARE',
        name: 'Rune Visage',
        typeLine: 'Kamasan Tiara',
        isUnique: false,
        implicits: ['+10 to maximum Mana'],
        explicits: ['+66% increased Energy Shield'],
        runes: ['Greater Iron Rune'],
      },
    },
  };

  const { build: out } = convertToBuild(build, {});
  assert.match(out.items[0].additional_text, /\[Rune\] Greater Iron Rune/);
});

test('convertToBuild uses source name for auto-name when available', () => {
  const build = parsePobXml(SAMPLE_XML);
  const { build: out } = convertToBuild(build, { sourceName: 'Lightning Spear Deadeye' });
  assert.equal(out.name, 'Lightning Spear Deadeye');
});

test('convertToBuild keeps explicit user name over source name', () => {
  const build = parsePobXml(SAMPLE_XML);
  const { build: out } = convertToBuild(build, {
    name: 'My Custom Name',
    sourceName: 'Lightning Spear Deadeye',
  });
  assert.equal(out.name, 'My Custom Name');
});

test('convertToBuild emits weapon-set passive nodes after the main tree', () => {
  const build = parsePobXml(SAMPLE_XML);
  build.tree = {
    nodes: [4, 60],
    specs: [{ nodes: [4, 60] }],
    weaponSet1Nodes: [65, 4],
    weaponSet2Nodes: [71],
  };

  const { build: out, report } = convertToBuild(build, {});
  assert.deepEqual(out.passives, [
    { id: 'lightning14', level_interval: [0, 100] },
    { id: 'blind2', level_interval: [0, 100] },
    { id: 'chill_and_freeze19_', weapon_set: 1, level_interval: [0, 100] },
    { id: 'physical58', weapon_set: 2, level_interval: [0, 100] },
  ]);
  assert.ok(report.converted.some((line) => line.includes('4 passive nodes resolved')));
});

test('convertToBuild folds extra active gems into the same skill group', () => {
  const build = parsePobXml(SAMPLE_XML);
  build.skills = [{
    enabled: true,
    actives: [
      { gemId: 'Metadata/Items/Gems/SkillGemCastOnCritMeta', nameSpec: 'Cast on Critical', enabled: true },
      { gemId: 'Metadata/Items/Gems/SkillGemComet', nameSpec: 'Comet', enabled: true },
      { gemId: 'Metadata/Items/Gems/SkillGemLivingBomb', nameSpec: 'Living Bomb', enabled: true },
    ],
    supports: [
      { gemId: 'Metadata/Items/Gems/SupportGemPinpointCritical', nameSpec: 'Pinpoint Critical', enabled: true },
      { gemId: 'Metadata/Items/Gems/SupportGemAddedEnergyRetention', nameSpec: 'Energy Retention', enabled: true },
    ],
  }];

  const { build: out } = convertToBuild(build, {});
  assert.deepEqual(out.skills, [{
    id: 'Metadata/Items/Gems/SkillGemCastOnCritMeta',
    level_interval: [0, 100],
    support_skills: [
      { id: 'Metadata/Items/Gems/SkillGemComet', level_interval: [0, 100] },
      { id: 'Metadata/Items/Gems/SkillGemLivingBomb', level_interval: [0, 100] },
      { id: 'Metadata/Items/Gems/SupportGemPinpointCritical', level_interval: [0, 100] },
      { id: 'Metadata/Items/Gems/SupportGemAddedEnergyRetention', level_interval: [0, 100] },
    ],
  }]);
});

test('convertToBuild parses level interval from Maxroll step name', () => {
  const build = {
    meta: { className: 'Witch' },
    skills: [{
      enabled: true,
      actives: [{ gemId: 'Metadata/Items/Gems/SkillGemEssenceDrain', nameSpec: 'Essence Drain', enabled: true }],
      supports: [{ gemId: 'Metadata/Items/Gems/SupportGemChainTwo', nameSpec: 'Chain II', enabled: true }],
      level_interval: [22, 100]
    }]
  };
  const { build: out } = convertToBuild(build, {});
  assert.deepEqual(out.skills[0].level_interval, [22, 100]);
});

test('convertToBuild formats support gem as object when it has custom additional_text', () => {
  const build = {
    meta: { className: 'Witch' },
    skills: [{
      enabled: true,
      actives: [{ gemId: 'Metadata/Items/Gems/SkillGemEssenceDrain', nameSpec: 'Essence Drain', enabled: true }],
      supports: [{ 
        gemId: 'Metadata/Items/Gems/SupportGemPierce', 
        nameSpec: 'Pierce', 
        enabled: true,
        additional_text: 'Freeze Support'
      }]
    }]
  };
  const { build: out } = convertToBuild(build, {});
  assert.deepEqual(out.skills[0].support_skills, [
    { id: 'Metadata/Items/Gems/SupportGemPierce', level_interval: [0, 100], additional_text: 'Freeze Support' }
  ]);
});

test('convertToBuild clamps skill and support gem levels to allowed maximums', () => {
  const build = {
    meta: { className: 'Witch' },
    skills: [{
      enabled: true,
      actives: [
        { gemId: 'Metadata/Items/Gems/SkillGemCastOnCritMeta', nameSpec: 'Cast on Critical', level: 21, enabled: true },
        { gemId: 'Metadata/Items/Gems/SkillGemComet', nameSpec: 'Comet', level: 21, enabled: true },
      ],
      supports: [
        { gemId: 'Metadata/Items/Gems/SupportGemChainTwo', nameSpec: 'Chain II', level: 20, enabled: true },
        { gemId: 'Metadata/Items/Gems/SupportGemPinpointCritical', nameSpec: 'Pinpoint Critical', level: 20, enabled: true },
      ],
    }]
  };

  const { build: out } = convertToBuild(build, {});
  assert.equal(out.skills[0].additional_text, 'Level 20');
  assert.deepEqual(out.skills[0].support_skills, [
    { id: 'Metadata/Items/Gems/SkillGemComet', level_interval: [0, 100], additional_text: 'Level 20' },
    { id: 'Metadata/Items/Gems/SupportGemChainTwo', level_interval: [0, 100], additional_text: 'Level 2' },
    { id: 'Metadata/Items/Gems/SupportGemPinpointCritical', level_interval: [0, 100], additional_text: 'Level 5' },
  ]);
});

test('convertToBuild passes already-compliant GGG BuildSkill objects directly through', () => {
  const build = {
    meta: { className: 'Witch' },
    skills: [
      {
        id: 'Metadata/Items/Gem/SkillGemFragmentationRounds',
        level_interval: [0, 25],
        additional_text: 'Use this on Frozen enemies',
        support_skills: [
          'Metadata/Items/Gems/SupportGemPrimalArmament',
          {
            id: 'Metadata/Items/Gems/SupportGemPierce',
            additional_text: 'Freeze Support'
          }
        ]
      }
    ]
  };
  const { build: out } = convertToBuild(build, {});
  assert.deepEqual(out.skills[0], {
    ...build.skills[0],
    level_interval: [0, 25],
    support_skills: [
      { id: 'Metadata/Items/Gems/SupportGemPrimalArmament', level_interval: [0, 100] },
      {
        id: 'Metadata/Items/Gems/SupportGemPierce',
        level_interval: [0, 100],
        additional_text: 'Freeze Support'
      }
    ]
  });
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

test('toRawUrl preserves pobb.in profile-style paths', () => {
  assert.equal(
    toRawUrl('https://pobb.in/u/paintmaster%232396/wvbnZ6zR-FuL'),
    'https://pobb.in/u/paintmaster%232396/wvbnZ6zR-FuL/raw'
  );
  assert.equal(
    toRawUrl('https://pobb.in/wvbnZ6zR-FuL'),
    'https://pobb.in/wvbnZ6zR-FuL/raw'
  );
});

test('decodePobCode rejects garbage', () => {
  assert.throws(() => decodePobCode('not a real code!!!'), /PoB/i);
});

test('convertToBuild passes already-compliant GGG passives directly through', () => {
  const build = {
    meta: { className: 'Mercenary' },
    passives: [
      { id: 'projectiles18', level_interval: [0, 25] },
      'duelist_mercenary_notable1',
      { id: 'strength34', level_interval: [25, 100], additional_text: 'Respec later' }
    ]
  };
  const { build: out, report } = convertToBuild(build, {});
  assert.deepEqual(out.passives, [
    { id: 'projectiles18', level_interval: [0, 25] },
    { id: 'duelist_mercenary_notable1', level_interval: [0, 100] },
    { id: 'strength34', level_interval: [25, 100], additional_text: 'Respec later' }
  ]);
  assert.ok(report.converted.some((line) => line.includes('3 passives (kept as-is)')));
});

test('convertToBuild passes already-compliant GGG items directly through', () => {
  const build = {
    meta: { className: 'Witch' },
    items: [
      { inventory_id: 'Weapon1', unique_name: 'Mageblood', slot_x: 0, slot_y: 0 },
      { inventory_id: 'Helm', additional_text: 'Iron Hat', slot_x: 0, slot_y: 0 }
    ]
  };
  const { build: out, report } = convertToBuild(build, {});
  assert.deepEqual(out.items, [
    { inventory_id: 'Weapon1', unique_name: 'Mageblood', slot_x: 0, slot_y: 0, level_interval: [0, 100] },
    { inventory_id: 'Helm', additional_text: 'Iron Hat', slot_x: 0, slot_y: 0, level_interval: [0, 100] }
  ]);
  assert.ok(report.converted.some((line) => line.includes('item "Mageblood" (kept as-is)')));
});

test('resolveInput and convertToBuild round-trips a GGG compliant .build JSON', async () => {
  const inputJson = {
    name: 'My Custom Mercenary Build',
    description: 'A test build',
    ascendancy: 'Mercenary2',
    skills: [
      {
        id: 'Metadata/Items/Gem/SkillGemFragmentationRounds',
        level_interval: [0, 25],
        support_skills: ['Metadata/Items/Gems/SupportGemPrimalArmament']
      }
    ],
    passives: [
      { id: 'projectiles18', level_interval: [0, 25] },
      'duelist_mercenary_notable1'
    ],
    items: [
      { inventory_id: 'Weapon1', unique_name: 'Super Bow', slot_x: 0, slot_y: 0 }
    ]
  };

  const { build, source } = await resolveInput(JSON.stringify(inputJson), { kind: 'json' });
  const { build: out } = convertToBuild(build, {});

  assert.equal(out.name, 'My Custom Mercenary Build');
  assert.equal(out.ascendancy, 'Mercenary2');
  assert.deepEqual(out.skills, [
    {
      id: 'Metadata/Items/Gem/SkillGemFragmentationRounds',
      level_interval: [0, 25],
      support_skills: [
        { id: 'Metadata/Items/Gems/SupportGemPrimalArmament', level_interval: [0, 100] }
      ]
    }
  ]);
  assert.deepEqual(out.passives, [
    { id: 'projectiles18', level_interval: [0, 25] },
    { id: 'duelist_mercenary_notable1', level_interval: [0, 100] }
  ]);
  assert.deepEqual(out.items, [
    { inventory_id: 'Weapon1', unique_name: 'Super Bow', slot_x: 0, slot_y: 0, level_interval: [0, 100] }
  ]);
});
