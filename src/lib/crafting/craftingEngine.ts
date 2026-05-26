import type { ItemBase, Modifier } from '../../data/poe2/itemBases.ts';
import { POE2_MODIFIERS } from '../../data/poe2/modifiers.ts';
import { POE2_ESSENCES } from '../../data/poe2/essences.ts';
import { POE2_OMENS } from '../../data/poe2/omens.ts';
import { POE2_RUNES } from '../../data/poe2/runes.ts';
import { POE2_SOUL_CORES } from '../../data/poe2/soulCores.ts';
import type { SoulCore } from '../../data/poe2/soulCores.ts';
import { POE2_ABYSS_CRAFTING } from '../../data/poe2/abyss.ts';
import type { AbyssCraftingData } from '../../data/poe2/abyss.ts';
import { POE2_QUALITY_CURRENCIES } from '../../data/poe2/quality.ts';
import { POE2_CORRUPTION_OUTCOMES } from '../../data/poe2/corruption.ts';
import { POE2_SOCKET_CRAFT_OPTIONS } from '../../data/poe2/socketCrafting.ts';
import type { DesecrationCraftingData } from '../../data/poe2/desecration.ts';

import { modifierMatchesBase, explicitLimit } from './validation.ts';
import { rollWeightedModifier } from './weightedRoll.ts';

import { applyAbyssCrafting } from './mechanics/applyAbyss.ts';
import { applyEssence } from './mechanics/applyEssence.ts';
import { applyOmen } from './mechanics/applyOmen.ts';
import { applyRune } from './mechanics/applyRune.ts';
import { applySoulCore } from './mechanics/applySoulCore.ts';
import { applyCorruption } from './mechanics/applyCorruption.ts';
import { applyQuality } from './mechanics/applyQuality.ts';
import { applySocketCrafting } from './mechanics/applySocketCrafting.ts';
import { applyDesecration } from './mechanics/applyDesecration.ts';

export type CraftedItem = {
  base: ItemBase;
  rarity: 'normal' | 'magic' | 'rare' | 'unique';
  quality: number;
  itemLevel: number;
  implicits: Modifier[];
  prefixes: Modifier[];
  suffixes: Modifier[];
  craftingLog: CraftingStep[];
  runes?: { id: string; name: string; text: string }[];
  corrupted?: boolean;
  mirrored?: boolean;
  destroyed?: boolean;
  properties?: Record<string, string | number>;
};

export type CraftingStep = {
  id: string;
  action: CraftingAction;
  beforeItem: CraftedItem;
  afterItem: CraftedItem;
  addedMods: Modifier[];
  removedMods: Modifier[];
  warnings: CraftingProblem[];
  timestamp: number;
};

export type CraftingProblem = {
  code: string;
  message: string;
  severity: 'warning' | 'error';
};

export type CraftingAction =
  | { type: 'currency'; currencyId: string }
  | { type: 'essence'; essenceId: string }
  | { type: 'omen'; omenId: string }
  | { type: 'rune'; runeId: string }
  | { type: 'soul_core'; soulCoreId: string }
  | { type: 'abyss'; abyssId: string }
  | { type: 'desecration'; desecrationId: string }
  | { type: 'quality'; qualityId: string }
  | { type: 'corruption'; corruptionId: string }
  | { type: 'socket'; socketCraftId: string };

export type CraftingContext = {
  abyssData: Record<string, AbyssCraftingData>;
  soulCores: Record<string, SoulCore>;
  desecrationData?: Record<string, DesecrationCraftingData>;
  qualityData?: Record<string, any>;
  corruptionData?: Record<string, any>;
  socketCraftingData?: Record<string, any>;
};

export function createCraftedItem(base: ItemBase, itemLevel = base.itemLevel): CraftedItem {
  return {
    base,
    rarity: 'normal',
    quality: 0,
    itemLevel,
    implicits: base.implicits || [],
    prefixes: [],
    suffixes: [],
    craftingLog: [],
    runes: [],
    corrupted: false,
    mirrored: false,
    destroyed: false,
    properties: { Sockets: "" },
  };
}

export function validPool(item: CraftedItem, type: 'prefix' | 'suffix', pool = POE2_MODIFIERS): Modifier[] {
  const existing = new Set([...item.prefixes, ...item.suffixes].map((mod) => mod.id));
  return pool.filter((mod) =>
    mod.type === type &&
    !existing.has(mod.id) &&
    modifierMatchesBase(mod, item.base, item.itemLevel)
  );
}

export function addRandomModifier(item: CraftedItem, pool = POE2_MODIFIERS): Modifier | null {
  const openTypes: Array<'prefix' | 'suffix'> = [];
  if (item.prefixes.length < explicitLimit(item.rarity)) openTypes.push('prefix');
  if (item.suffixes.length < explicitLimit(item.rarity)) openTypes.push('suffix');
  const buckets = openTypes.map((type) => ({ type, pool: validPool(item, type, pool) })).filter((bucket) => bucket.pool.length);
  if (!buckets.length) return null;
  const bucket = buckets[Math.floor(Math.random() * buckets.length)];
  const modifier = rollWeightedModifier(bucket.pool);
  if (!modifier) return null;
  if (bucket.type === 'prefix') item.prefixes.push(modifier);
  else item.suffixes.push(modifier);
  return modifier;
}

export function removeRandomModifier(item: CraftedItem): Modifier | null {
  const allExplicit = [...item.prefixes, ...item.suffixes];
  if (!allExplicit.length) return null;
  const chosen = allExplicit[Math.floor(Math.random() * allExplicit.length)];
  if (chosen.type === 'prefix') {
    item.prefixes = item.prefixes.filter((m) => m.id !== chosen.id);
  } else {
    item.suffixes = item.suffixes.filter((m) => m.id !== chosen.id);
  }
  return chosen;
}

export function rollRareModifiers(item: CraftedItem, desired = 4): Modifier[] {
  item.prefixes = [];
  item.suffixes = [];
  const added: Modifier[] = [];
  for (let i = 0; i < desired; i++) {
    const mod = addRandomModifier(item);
    if (!mod) break;
    added.push(mod);
  }
  return added;
}

export function applyCraftingAction(
  item: CraftedItem,
  action: CraftingAction,
  context: CraftingContext
): CraftedItem {
  const beforeItem = JSON.parse(JSON.stringify(item)) as CraftedItem;
  let cloned = JSON.parse(JSON.stringify(item)) as CraftedItem;
  let addedMods: Modifier[] = [];
  let removedMods: Modifier[] = [];
  let warnings: string[] = [];

  switch (action.type) {
    case 'abyss': {
      const data = context.abyssData[action.abyssId];
      if (data) {
        const res = applyAbyssCrafting(cloned, data);
        cloned = res.item;
        addedMods = res.addedMods;
        warnings = res.warnings;
      }
      break;
    }
    case 'desecration': {
      const data = context.desecrationData?.[action.desecrationId];
      if (data) {
        const res = applyDesecration(cloned, data, context);
        cloned = res.item;
        addedMods = res.addedMods;
        removedMods = res.removedMods;
        warnings = res.warnings;
      }
      break;
    }
    case 'essence': {
      const res = applyEssence(cloned, action.essenceId);
      cloned = res.item;
      addedMods = res.addedMods;
      warnings = res.warnings;
      break;
    }
    case 'omen': {
      const res = applyOmen(cloned, action.omenId);
      cloned = res.item;
      warnings = res.warnings;
      break;
    }
    case 'rune': {
      const res = applyRune(cloned, action.runeId);
      cloned = res.item;
      addedMods = res.addedMods;
      warnings = res.warnings;
      break;
    }
    case 'soul_core': {
      const res = applySoulCore(cloned, action.soulCoreId);
      cloned = res.item;
      addedMods = res.addedMods;
      warnings = res.warnings;
      break;
    }
    case 'corruption': {
      const res = applyCorruption(cloned, action.corruptionId);
      cloned = res.item;
      addedMods = res.addedMods;
      warnings = res.warnings;
      break;
    }
    case 'quality': {
      const res = applyQuality(cloned, action.qualityId);
      cloned = res.item;
      warnings = res.warnings;
      break;
    }
    case 'socket': {
      const res = applySocketCrafting(cloned, action.socketCraftId);
      cloned = res.item;
      warnings = res.warnings;
      break;
    }
    case 'currency': {
      if (action.currencyId === 'transmute') {
        cloned.rarity = 'magic';
        const mod = addRandomModifier(cloned);
        if (mod) addedMods.push(mod);
      } else if (action.currencyId === 'augment') {
        const mod = addRandomModifier(cloned);
        if (mod) addedMods.push(mod);
      } else if (action.currencyId === 'regal') {
        cloned.rarity = 'rare';
        const mod = addRandomModifier(cloned);
        if (mod) addedMods.push(mod);
      } else if (action.currencyId === 'exalt') {
        const mod = addRandomModifier(cloned);
        if (mod) addedMods.push(mod);
      } else if (action.currencyId === 'chaos') {
        const removed = removeRandomModifier(cloned);
        if (removed) removedMods.push(removed);
        const mod = addRandomModifier(cloned);
        if (mod) addedMods.push(mod);
        else warnings.push("Chaos Orb removed a modifier, but no valid replacement modifier was available.");
      } else if (action.currencyId === 'alchemy') {
        cloned.rarity = 'rare';
        addedMods = rollRareModifiers(cloned, 4);
      } else if (action.currencyId === 'annul') {
        const removed = removeRandomModifier(cloned);
        if (removed) removedMods.push(removed);
      } else if (action.currencyId === 'chance') {
        const hitUnique = Math.random() < 0.01;
        cloned.prefixes = [];
        cloned.suffixes = [];
        if (hitUnique) {
          cloned.rarity = 'unique';
          warnings.push("Unique outcome is simulated without unique modifier data.");
        } else {
          cloned.destroyed = true;
          warnings.push("Orb of Chance destroyed the item.");
        }
      }
      break;
    }
  }

  const afterItem = JSON.parse(JSON.stringify(cloned)) as CraftedItem;

  // Push new Step into history log
  const step: CraftingStep = {
    id: `step-${Date.now()}-${Math.random()}`,
    action,
    beforeItem,
    afterItem,
    addedMods,
    removedMods,
    warnings: warnings.map((msg) => ({ code: 'warning', message: msg, severity: 'warning' })),
    timestamp: Date.now()
  };

  cloned.craftingLog = cloned.craftingLog ?? [];
  cloned.craftingLog.push(step);

  return cloned;
}
