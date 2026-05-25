import { test } from 'node:test';
import assert from 'node:assert';
import { parseItem, normalizeItemText, parseModifier } from '../itemTextParser.ts';

test('normalizeItemText removes carriage returns, smart quotes, non-breaking spaces', () => {
  const input = 'Item Class: Wands\r\n“Smart Quotes” and \u00a0 spaces';
  const expected = 'Item Class: Wands\n"Smart Quotes" and   spaces';
  assert.strictEqual(normalizeItemText(input), expected);
});

test('parseItem - Normal Weapon without extra blocks', () => {
  const text = `
    Item Class: Wands
    Rarity: Normal
    Expert Siphon Wand
  `;
  const item = parseItem(text);
  assert.strictEqual(item.itemClass, 'Wands');
  assert.strictEqual(item.rarity, 'Normal');
  assert.strictEqual(item.baseType, 'Expert Siphon Wand');
  assert.strictEqual(item.name, undefined);
  assert.strictEqual(item.unknownLines.length, 0);
});

test('parseItem - Magic Armour with Requirements, Quality, and Properties', () => {
  const text = `
    Item Class: Body Armours
    Rarity: Magic
    Shagreen Expert Plate Vest
    Expert Plate Vest
    --------
    Quality: +15%
    Armour: 450
    --------
    Requirements:
    Requires Level 68, 95 Str
    --------
    +20 to Strength
  `;
  const item = parseItem(text);
  assert.strictEqual(item.itemClass, 'Body Armours');
  assert.strictEqual(item.rarity, 'Magic');
  assert.strictEqual(item.name, 'Shagreen Expert Plate Vest');
  assert.strictEqual(item.baseType, 'Expert Plate Vest');
  assert.strictEqual(item.quality, 15);
  assert.strictEqual(item.properties['Armour'], 450);
  assert.strictEqual(item.requirements.level, 68);
  assert.strictEqual(item.requirements.str, 95);
  assert.strictEqual(item.explicits.length, 1);
  assert.strictEqual(item.explicits[0].raw, '+20 to Strength');
  assert.strictEqual(item.explicits[0].kind, 'flat');
  assert.deepStrictEqual(item.explicits[0].values, [20]);
  assert.strictEqual(item.unknownLines.length, 0);
});

test('parseItem - Rare Jewellery with explicit Implicit block count', () => {
  const text = `
    Item Class: Rings
    Rarity: Rare
    Sorrow Loop
    Gold Ring
    --------
    Requirements:
    Requires Level 60
    --------
    Item Level: 75
    --------
    Implicits: 1
    +15% to Rarity of Items found
    --------
    +30 to maximum Life
    +25% to Fire Resistance
  `;
  const item = parseItem(text);
  assert.strictEqual(item.itemClass, 'Rings');
  assert.strictEqual(item.rarity, 'Rare');
  assert.strictEqual(item.name, 'Sorrow Loop');
  assert.strictEqual(item.baseType, 'Gold Ring');
  assert.strictEqual(item.itemLevel, 75);
  assert.strictEqual(item.requirements.level, 60);

  assert.strictEqual(item.implicits.length, 1);
  assert.strictEqual(item.implicits[0].raw, '+15% to Rarity of Items found');
  assert.strictEqual(item.implicits[0].kind, 'percent');
  assert.deepStrictEqual(item.implicits[0].values, [15]);

  assert.strictEqual(item.explicits.length, 2);
  assert.strictEqual(item.explicits[0].raw, '+30 to maximum Life');
  assert.strictEqual(item.explicits[1].raw, '+25% to Fire Resistance');
  assert.strictEqual(item.unknownLines.length, 0);
});

test('parseItem - Unique Weapon with Sockets, Sockets format, Sockets line in properties, Runes, and Soul Cores', () => {
  const text = `
    Item Class: Crossbows
    Rarity: Unique
    Lethal Pride
    Expert Bombard Crossbow
    --------
    Physical Damage: 45-120
    Critical Hit Chance: 5.0%
    Attacks per Second: 1.25
    --------
    Requirements:
    Requires Level 70, 110 Dex
    --------
    Sockets: S S
    Socketed Rune: Desert Rune
    Socketed Soul Core: Soul Core of Azcapa
    --------
    100% increased Physical Damage
    Adds 10 to 20 Physical Damage
  `;
  const item = parseItem(text);
  assert.strictEqual(item.itemClass, 'Crossbows');
  assert.strictEqual(item.rarity, 'Unique');
  assert.strictEqual(item.properties['Physical Damage'], '45-120');
  assert.strictEqual(item.properties['Critical Hit Chance'], 5.0);
  assert.strictEqual(item.properties['Attacks per Second'], 1.25);
  assert.strictEqual(item.properties['Sockets'], 'S S');
  assert.deepStrictEqual(item.runes, ['Desert Rune']);
  assert.deepStrictEqual(item.soulCores, ['Soul Core of Azcapa']);

  assert.strictEqual(item.explicits.length, 2);
  assert.strictEqual(item.explicits[0].raw, '100% increased Physical Damage');
  assert.strictEqual(item.explicits[0].kind, 'increased');
  assert.strictEqual(item.explicits[1].raw, 'Adds 10 to 20 Physical Damage');
  assert.strictEqual(item.explicits[1].kind, 'added_damage');
  assert.deepStrictEqual(item.explicits[1].values, [10, 20]);
  assert.strictEqual(item.unknownLines.length, 0);
});

test('parseItem - Meta Flags (Corrupted, Mirrored, Unidentified) and Unknown Lines detection', () => {
  const text = `
    Item Class: Helmets
    Rarity: Rare
    Blight Crest
    Expert Hunter Hood
    --------
    Evasion Rating: 150
    --------
    Requirements:
    Requires Level 65, 80 Dex
    --------
    +50 to maximum Life
    Some totally unrecognized property line here!
    --------
    Corrupted
    Mirrored
    Unidentified
  `;
  const item = parseItem(text);
  assert.strictEqual(item.corrupted, true);
  assert.strictEqual(item.mirrored, true);
  assert.strictEqual(item.unidentified, true);

  // The modifier section had unrecognized line, which we marked as unknown modifier format
  assert.strictEqual(item.explicits.length, 2);
  assert.strictEqual(item.explicits[1].raw, 'Some totally unrecognized property line here!');
  assert.strictEqual(item.explicits[1].kind, 'unknown');

  // Verify unknownLines has stored the warning
  assert.ok(item.unknownLines.some(line => line.includes('unknown modifier format')));
});

test('parseModifier - Kind classification checks', () => {
  assert.strictEqual(parseModifier('+25 to Strength').kind, 'flat');
  assert.strictEqual(parseModifier('+35% to Fire Resistance').kind, 'percent');
  assert.strictEqual(parseModifier('20% increased Movement Speed').kind, 'increased');
  assert.strictEqual(parseModifier('10% reduced Attribute Requirements').kind, 'reduced');
  assert.strictEqual(parseModifier('Adds 10 to 20 Physical Damage').kind, 'added_damage');
  assert.strictEqual(parseModifier('Desert Rune').kind, 'rune'); // matches RUNE_MOD_RE due to \bRune\b
  assert.strictEqual(parseModifier('Rune of Fire').kind, 'rune');
  assert.strictEqual(parseModifier('Soul Core of Azcapa').kind, 'soul_core');
  assert.strictEqual(parseModifier('Essence of Hatred').kind, 'essence');
  assert.strictEqual(parseModifier('Crafted Fire Resist').kind, 'crafted');
});
