import test from 'node:test';
import assert from 'node:assert/strict';

import { createCraftedItem, applyCraftingAction } from '../src/lib/crafting/craftingEngine.ts';
import { validateCraftingAction } from '../src/lib/crafting/validation.ts';
import { POE2_ESSENCES } from '../src/data/poe2/essences.ts';
import { POE2_OMENS } from '../src/data/poe2/omens.ts';
import { POE2_RUNES } from '../src/data/poe2/runes.ts';
import { POE2_SOUL_CORES } from '../src/data/poe2/soulCores.ts';
import { POE2_ABYSS_CRAFTING } from '../src/data/poe2/abyss.ts';
import { getFallbackItemBases, transformCachedItemBases } from '../src/data/poe2/itemBases.ts';

// Mock context for the tests
const context = {
  abyssData: Object.fromEntries(POE2_ABYSS_CRAFTING.map(a => [a.id, a])),
  soulCores: Object.fromEntries(POE2_SOUL_CORES.map(c => [c.id, c]))
};

// Base mock item for weapon / belt / jewel / ring
const baseWeapon = {
  id: "longbow",
  name: "Longbow",
  category: "Weapon",
  type: "bow",
  itemLevel: 83,
  requirements: "Str 50",
  tags: ["weapon", "two_handed", "bow"],
  implicits: []
};

const baseBelt = {
  id: "heavy-belt",
  name: "Heavy Belt",
  category: "Jewellery",
  type: "belt",
  itemLevel: 83,
  requirements: "",
  tags: ["jewellery", "belt"],
  implicits: []
};

const baseRing = {
  id: "gold-ring",
  name: "Gold Ring",
  category: "Jewellery",
  type: "ring",
  itemLevel: 83,
  requirements: "",
  tags: ["jewellery", "ring"],
  implicits: []
};

const baseJewel = {
  id: "base-jewel",
  name: "Timeless Jewel",
  category: "Jewel",
  type: "jewel",
  itemLevel: 83,
  requirements: "",
  tags: ["jewel"],
  implicits: []
};

test('fallback crafting bases are available when runtime cache is missing', () => {
  const bases = getFallbackItemBases();
  assert.ok(bases.length > 0);
  assert.ok(bases.some((base) => base.category === 'Weapon' && base.type === 'bow'));
  assert.ok(bases.some((base) => base.category === 'Jewellery' && base.type === 'ring'));
});

test('poe2db crafting base transform supports all current item class groups', () => {
  const bases = transformCachedItemBases([
    { id: 'claws-crude-claw', name: 'Crude Claw', class: 'Claws', level: 1 },
    { id: 'daggers-glass-shank', name: 'Glass Shank', class: 'Daggers', level: 1 },
    { id: 'one-hand-swords-shortsword', name: 'Shortsword', class: 'One Hand Swords', level: 1 },
    { id: 'two-hand-axes-greataxe', name: 'Greataxe', class: 'Two Hand Axes', level: 1 },
    { id: 'flails-chain-flail', name: 'Chain Flail', class: 'Flails', level: 1 },
    { id: 'traps-bear-trap', name: 'Bear Trap', class: 'Traps', level: 1 },
    { id: 'relics-weathered-relic', name: 'Weathered Relic', class: 'Relics', level: 1 },
    { id: 'vault-keys-copper-key', name: 'Copper Key', class: 'Vault Keys', level: 1 },
  ]);

  assert.deepEqual(
    bases.map((base) => [base.name, base.category, base.type]),
    [
      ['Crude Claw', 'Weapon', 'claw'],
      ['Glass Shank', 'Weapon', 'dagger'],
      ['Shortsword', 'Weapon', 'sword'],
      ['Greataxe', 'Weapon', '2h axe'],
      ['Chain Flail', 'Weapon', 'flail'],
      ['Bear Trap', 'Weapon', 'trap'],
      ['Weathered Relic', 'Relic', 'relic'],
      ['Copper Key', 'Key', 'vault key'],
    ],
  );
});

test('valid currency craft - transmutes normal item to magic', () => {
  const item = createCraftedItem(baseWeapon, 83);
  
  // Verify starts normal
  assert.equal(item.rarity, 'normal');
  
  const updated = applyCraftingAction(item, { type: 'currency', currencyId: 'transmute' }, context);
  
  assert.equal(updated.rarity, 'magic');
  assert.equal(updated.prefixes.length + updated.suffixes.length, 1);
});

test('invalid currency craft - transmute blocks magic item', () => {
  const item = createCraftedItem(baseWeapon, 83);
  item.rarity = 'magic';
  
  const problems = validateCraftingAction(item, { type: 'currency', currencyId: 'transmute' }, context);
  assert.ok(problems.some(p => p.code === 'wrong_item_rarity'));
});

test('alchemy upgrades normal or magic item to rare with four modifiers', () => {
  const normalItem = createCraftedItem(baseWeapon, 83);
  const rareFromNormal = applyCraftingAction(normalItem, { type: 'currency', currencyId: 'alchemy' }, context);
  assert.equal(rareFromNormal.rarity, 'rare');
  assert.equal(rareFromNormal.prefixes.length + rareFromNormal.suffixes.length, 4);

  const magicItem = createCraftedItem(baseWeapon, 83);
  magicItem.rarity = 'magic';
  const existingMod = rareFromNormal.prefixes[0] ?? rareFromNormal.suffixes[0];
  if (existingMod.type === 'prefix') magicItem.prefixes.push(existingMod);
  else magicItem.suffixes.push(existingMod);
  const problems = validateCraftingAction(magicItem, { type: 'currency', currencyId: 'alchemy' }, context);
  assert.equal(problems.filter(p => p.severity === 'error').length, 0);

  const rareFromMagic = applyCraftingAction(magicItem, { type: 'currency', currencyId: 'alchemy' }, context);
  assert.equal(rareFromMagic.rarity, 'rare');
  assert.equal(rareFromMagic.prefixes.length + rareFromMagic.suffixes.length, 4);
});

test('chaos removes one rare modifier and adds one replacement', () => {
  const item = applyCraftingAction(createCraftedItem(baseWeapon, 83), { type: 'currency', currencyId: 'alchemy' }, context);
  const beforeCount = item.prefixes.length + item.suffixes.length;
  const updated = applyCraftingAction(item, { type: 'currency', currencyId: 'chaos' }, context);
  const step = updated.craftingLog.at(-1);

  assert.equal(updated.rarity, 'rare');
  assert.equal(step.removedMods.length, 1);
  assert.equal(step.addedMods.length, 1);
  assert.equal(updated.prefixes.length + updated.suffixes.length, beforeCount);
});

test('chaos requires at least one explicit rare modifier', () => {
  const item = createCraftedItem(baseWeapon, 83);
  item.rarity = 'rare';
  const problems = validateCraftingAction(item, { type: 'currency', currencyId: 'chaos' }, context);
  assert.ok(problems.some(p => p.code === 'no_explicit_modifier'));
});

test('chance upgrades normal item to unique or destroys it', () => {
  const originalRandom = Math.random;
  try {
    Math.random = () => 0;
    const unique = applyCraftingAction(createCraftedItem(baseWeapon, 83), { type: 'currency', currencyId: 'chance' }, context);
    assert.equal(unique.rarity, 'unique');
    assert.equal(unique.destroyed, false);

    Math.random = () => 0.99;
    const destroyed = applyCraftingAction(createCraftedItem(baseWeapon, 83), { type: 'currency', currencyId: 'chance' }, context);
    assert.equal(destroyed.destroyed, true);
    const problems = validateCraftingAction(destroyed, { type: 'currency', currencyId: 'transmute' }, context);
    assert.ok(problems.some(p => p.code === 'item_destroyed'));
  } finally {
    Math.random = originalRandom;
  }
});

test('essence forced modifier - force-applies mod and upgrades to rare', () => {
  const item = createCraftedItem(baseBelt, 83);
  
  // Find a valid essence
  const essence = POE2_ESSENCES[0];
  
  const problems = validateCraftingAction(item, { type: 'essence', essenceId: essence.id }, context);
  assert.equal(problems.length, 0, 'Should have no validation errors');
  
  const updated = applyCraftingAction(item, { type: 'essence', essenceId: essence.id }, context);
  assert.equal(updated.rarity, 'rare');
  assert.ok(updated.prefixes.length > 0 || updated.suffixes.length > 0);
  
  // Rarity restriction
  updated.rarity = 'rare';
  const newProblems = validateCraftingAction(updated, { type: 'essence', essenceId: essence.id }, context);
  assert.ok(newProblems.some(p => p.code === 'wrong_item_rarity'));
});

test('omen pending modifier - applies omen without errors', () => {
  const item = createCraftedItem(baseWeapon, 83);
  const omen = POE2_OMENS[0];
  
  const problems = validateCraftingAction(item, { type: 'omen', omenId: omen.id }, context);
  assert.equal(problems.length, 0);
  
  const updated = applyCraftingAction(item, { type: 'omen', omenId: omen.id }, context);
  assert.equal(updated.craftingLog.length, 1);
});

test('rune compatibility - weapon rune on bow', () => {
  const item = createCraftedItem(baseWeapon, 83);
  
  // Must have a socket to apply rune
  item.properties = { Sockets: "S" };
  const rune = POE2_RUNES[0];
  
  const problems = validateCraftingAction(item, { type: 'rune', runeId: rune.id }, context);
  assert.equal(problems.length, 0);
  
  const updated = applyCraftingAction(item, { type: 'rune', runeId: rune.id }, context);
  assert.equal(updated.implicits.length, 1);
});

test('rune compatibility - missing socket blocks rune', () => {
  const item = createCraftedItem(baseWeapon, 83);
  item.properties = { Sockets: "" };
  const rune = POE2_RUNES[0];
  
  const problems = validateCraftingAction(item, { type: 'rune', runeId: rune.id }, context);
  assert.ok(problems.some(p => p.code === 'missing_socket'));
});

test('soul core compatibility - armour soul core compatibility checking', () => {
  const item = createCraftedItem(baseWeapon, 83);
  const core = POE2_SOUL_CORES.find(c => c.id === 'core-azcapa');
  
  const problems = validateCraftingAction(item, { type: 'soul_core', soulCoreId: core.id }, context);
  assert.equal(problems.length, 0);
  
  const updated = applyCraftingAction(item, { type: 'soul_core', soulCoreId: core.id }, context);
  assert.equal(updated.implicits.length, 1);
});

test('Abyss mechanic compatibility - heavy belt to stygian vise', () => {
  const item = createCraftedItem(baseBelt, 83);
  const abyssId = "abyss-vise";
  
  const problems = validateCraftingAction(item, { type: 'abyss', abyssId }, context);
  assert.equal(problems.length, 0);
  
  const updated = applyCraftingAction(item, { type: 'abyss', abyssId }, context);
  assert.equal(updated.base.name, "Stygian Vise");
  assert.ok(updated.base.tags.includes("abyss_socket"));
});

test('Abyss invalid item type - stygian vise on ring is blocked', () => {
  const item = createCraftedItem(baseRing, 83);
  const abyssId = "abyss-vise";
  
  const problems = validateCraftingAction(item, { type: 'abyss', abyssId }, context);
  assert.ok(problems.some(p => p.code === 'unsupported_abyss_item'));
});

test('corruption behavior - Vaal Orb outcomes', () => {
  const item = createCraftedItem(baseWeapon, 83);
  
  const problems = validateCraftingAction(item, { type: 'corruption', corruptionId: "outcome-brick-rare" }, context);
  assert.equal(problems.length, 0);
  
  const bricked = applyCraftingAction(item, { type: 'corruption', corruptionId: "outcome-brick-rare" }, context);
  assert.equal(bricked.corrupted, true);
  assert.equal(bricked.rarity, 'rare');
  assert.ok(bricked.prefixes.length > 0);
  
  // Blocks further modifications
  const postBrickProblems = validateCraftingAction(bricked, { type: 'currency', currencyId: 'chaos' }, context);
  assert.ok(postBrickProblems.some(p => p.code === 'corruption_applied'));
});

test('quality behavior - upgrades quality up to 20%', () => {
  const item = createCraftedItem(baseWeapon, 83);
  item.quality = 10;
  
  const problems = validateCraftingAction(item, { type: 'quality', qualityId: 'blacksmith-whetstone' }, context);
  assert.equal(problems.length, 0);
  
  const updated = applyCraftingAction(item, { type: 'quality', qualityId: 'blacksmith-whetstone' }, context);
  assert.equal(updated.quality, 15);
  
  updated.quality = 20;
  const postCapProblems = validateCraftingAction(updated, { type: 'quality', qualityId: 'blacksmith-whetstone' }, context);
  assert.ok(postCapProblems.some(p => p.code === 'quality_capped'));
});

test('socket crafting behavior - Jeweller\'s Orb socket addition', () => {
  const item = createCraftedItem(baseWeapon, 83);
  item.properties = { Sockets: "S" };
  
  const problems = validateCraftingAction(item, { type: 'socket', socketCraftId: 'add-socket' }, context);
  assert.equal(problems.length, 0);
  
  const updated = applyCraftingAction(item, { type: 'socket', socketCraftId: 'add-socket' }, context);
  assert.equal(updated.properties?.["Sockets"], "S S");
});

test('Problems warnings for incomplete data - flags soul core Azcapa as complete but Opul as warning', () => {
  const item = createCraftedItem(baseWeapon, 83);
  
  const completeCore = POE2_SOUL_CORES.find(c => c.id === 'core-azcapa');
  const incompleteCore = POE2_SOUL_CORES.find(c => c.id === 'core-opul');
  
  const completeProblems = validateCraftingAction(item, { type: 'soul_core', soulCoreId: completeCore.id }, context);
  assert.ok(!completeProblems.some(p => p.code === 'incomplete_mechanic_data'));
  
  const incompleteProblems = validateCraftingAction(item, { type: 'soul_core', soulCoreId: incompleteCore.id }, context);
  assert.ok(incompleteProblems.some(p => p.severity === 'warning'));
});
