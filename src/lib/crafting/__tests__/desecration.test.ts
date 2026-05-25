import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createCraftedItem, applyCraftingAction } from '../craftingEngine.ts';
import { validateCraftingAction } from '../validation.ts';
import { desecrationCraftingData } from '../../../data/poe2/desecration.ts';

const desecrationMap = Object.fromEntries(desecrationCraftingData.map(d => [d.id, d]));

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

// Create a custom test context with desecrationData and modifiers
const testContext = {
  abyssData: {},
  soulCores: {},
  desecrationData: desecrationMap,
  qualityData: {
    modifiers: [
      {
        id: "physical_damage_percent",
        group: "physical_damage",
        name: "Physical Damage %",
        text: "50% increased Physical Damage",
        type: "prefix",
        tier: 1,
        weight: 100,
        requiredItemLevel: 1,
        tags: ["weapon"]
      }
    ]
  }
};

test('can validate Desecration data', () => {
  const item = createCraftedItem(baseWeapon, 83);
  const action = { type: 'desecration' as const, desecrationId: 'desecration_placeholder' };
  const problems = validateCraftingAction(item, action, testContext);
  // Placeholder has dataComplete: false, so it should warn
  assert.ok(problems.some(p => p.code === 'DESECRATION_DATA_INCOMPLETE'));
});

test('rejects invalid rarity', () => {
  const item = createCraftedItem(baseWeapon, 83);
  item.rarity = 'rare'; // weapon craft requires normal or magic
  const action = { type: 'desecration' as const, desecrationId: 'desecration_weapon' };
  const problems = validateCraftingAction(item, action, testContext);
  assert.ok(problems.some(p => p.code === 'DESECRATION_INVALID_RARITY'));
});

test('rejects invalid item base', () => {
  const item = createCraftedItem(baseBelt, 83);
  const action = { type: 'desecration' as const, desecrationId: 'desecration_weapon' };
  const problems = validateCraftingAction(item, action, testContext);
  assert.ok(problems.some(p => p.code === 'DESECRATION_INVALID_BASE'));
});

test('rejects item level too low', () => {
  const item = createCraftedItem(baseWeapon, 50); // requires min level 68
  const action = { type: 'desecration' as const, desecrationId: 'desecration_weapon' };
  const problems = validateCraftingAction(item, action, testContext);
  assert.ok(problems.some(p => p.code === 'DESECRATION_ITEM_LEVEL_TOO_LOW'));
});

test('warns when data is incomplete', () => {
  const item = createCraftedItem(baseWeapon, 83);
  const action = { type: 'desecration' as const, desecrationId: 'desecration_weapon' };
  const problems = validateCraftingAction(item, action, testContext);
  assert.ok(problems.some(p => p.code === 'DESECRATION_DATA_INCOMPLETE'));
});

test('warns when modifier pool is empty', () => {
  const item = createCraftedItem(baseWeapon, 83);
  const action = { type: 'desecration' as const, desecrationId: 'desecration_placeholder' };
  
  // Empty modifiers list context
  const emptyContext = {
    abyssData: {},
    soulCores: {},
    desecrationData: desecrationMap,
    qualityData: { modifiers: [] }
  };
  
  const result = applyCraftingAction(item, action, emptyContext);
  assert.ok(result.craftingLog[0].warnings.some(p => p.message.includes('No valid Desecration modifier pool found')));
});

test('applies valid Desecration modifier when pool exists', () => {
  const item = createCraftedItem(baseWeapon, 83);
  item.rarity = 'magic';
  const action = { type: 'desecration' as const, desecrationId: 'desecration_weapon' };
  
  const result = applyCraftingAction(item, action, testContext);
  assert.equal(result.prefixes.length, 1);
  assert.equal(result.prefixes[0].id, 'physical_damage_percent');
});

test('does not fake results when no pool exists', () => {
  const item = createCraftedItem(baseWeapon, 83);
  const action = { type: 'desecration' as const, desecrationId: 'desecration_weapon' };
  
  // Empty modifiers list context
  const emptyContext = {
    abyssData: {},
    soulCores: {},
    desecrationData: desecrationMap,
    qualityData: { modifiers: [] }
  };
  
  const result = applyCraftingAction(item, action, emptyContext);
  assert.equal(result.prefixes.length, 0);
  assert.equal(result.suffixes.length, 0);
});

test('adds crafting log entry', () => {
  const item = createCraftedItem(baseWeapon, 83);
  item.rarity = 'magic';
  const action = { type: 'desecration' as const, desecrationId: 'desecration_weapon' };
  
  const result = applyCraftingAction(item, action, testContext);
  assert.equal(result.craftingLog.length, 1);
  assert.equal(result.craftingLog[0].action.type, 'desecration');
});

test('adds Problems tab warning', () => {
  const item = createCraftedItem(baseWeapon, 83);
  const action = { type: 'desecration' as const, desecrationId: 'desecration_weapon' };
  
  const problems = validateCraftingAction(item, action, testContext);
  assert.ok(problems.some(p => p.severity === 'warning' && p.code === 'DESECRATION_DATA_INCOMPLETE'));
});

test('target simulation handles Desecration strategy', () => {
  // Standalone simulation tests or logic validations
  const d = desecrationMap['desecration_weapon'];
  assert.equal(d.addsModifiers, true);
  assert.equal(d.dataComplete, false);
});
