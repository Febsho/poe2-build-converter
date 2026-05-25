import {
  ITEM_CLASS_RE,
  RARITY_RE,
  ITEM_LEVEL_RE,
  SEPARATOR_RE,
  CORRUPTED_RE,
  MIRRORED_RE,
  UNIDENTIFIED_RE,
  REQUIRES_LEVEL_RE,
  REQUIRES_STR_RE,
  REQUIRES_DEX_RE,
  REQUIRES_INT_RE,
  QUALITY_RE,
  ARMOUR_RE,
  EVASION_RE,
  ENERGY_SHIELD_RE,
  BLOCK_CHANCE_RE,
  PHYSICAL_DAMAGE_RE,
  ELEMENTAL_DAMAGE_RE,
  CRIT_CHANCE_RE,
  ATTACKS_PER_SECOND_RE,
  SOCKETS_RE,
  RUNE_RE,
  SOUL_CORE_RE,
} from './regex.ts';
import { parseModifier } from './modParser.ts';
import type { ParsedModifier } from './modParser.ts';
import { parseRequirements } from './parseRequirements.ts';
import { parseProperties } from './parseProperties.ts';
import { parseSockets } from './parseSockets.ts';

export type ParsedPoe2Item = {
  itemClass?: string;
  rarity?: 'Normal' | 'Magic' | 'Rare' | 'Unique';
  name?: string;
  baseType?: string;
  itemLevel?: number;
  quality?: number;
  requirements: {
    level?: number;
    str?: number;
    dex?: number;
    int?: number;
  };
  properties: Record<string, string | number>;
  implicits: ParsedModifier[];
  explicits: ParsedModifier[];
  runes: string[];
  soulCores: string[];
  corrupted: boolean;
  mirrored: boolean;
  unidentified: boolean;
  unknownLines: string[];
};

export function normalizeItemText(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\u00a0/g, ' ')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .trim();
}

export function parseItem(text: string): ParsedPoe2Item {
  const normalized = normalizeItemText(text);
  const lines = normalized.split('\n').map((l) => l.trim());

  const unknownLines: string[] = [];
  const runes: string[] = [];
  const soulCores: string[] = [];
  const properties: Record<string, string | number> = {};

  let itemClass: string | undefined;
  let rarity: ParsedPoe2Item['rarity'];
  let name: string | undefined;
  let baseType: string | undefined;
  let itemLevel: number | undefined;
  let quality: number | undefined;
  let corrupted = false;
  let mirrored = false;
  let unidentified = false;

  // Split into raw sections by separator lines
  const rawSections: string[][] = [[]];
  for (const line of lines) {
    if (SEPARATOR_RE.test(line)) {
      rawSections.push([]);
    } else if (line) {
      rawSections[rawSections.length - 1].push(line);
    }
  }

  // Filter out empty sections
  const sections = rawSections.filter((s) => s.length > 0);

  if (sections.length === 0) {
    return {
      requirements: {},
      properties: {},
      implicits: [],
      explicits: [],
      runes: [],
      soulCores: [],
      corrupted: false,
      mirrored: false,
      unidentified: false,
      unknownLines,
    };
  }

  // Section 0 is always the Header
  const headerLines = sections[0];
  const remainingHeaderLines: string[] = [];

  for (const line of headerLines) {
    const classMatch = line.match(ITEM_CLASS_RE);
    if (classMatch) {
      itemClass = classMatch[1].trim();
      continue;
    }

    const rarityMatch = line.match(RARITY_RE);
    if (rarityMatch) {
      rarity = rarityMatch[1].trim() as ParsedPoe2Item['rarity'];
      continue;
    }

    remainingHeaderLines.push(line);
  }

  // Parse Name and Base Type from remaining header lines
  if (remainingHeaderLines.length === 1) {
    baseType = remainingHeaderLines[0];
  } else if (remainingHeaderLines.length === 2) {
    name = remainingHeaderLines[0];
    baseType = remainingHeaderLines[1];
  } else if (remainingHeaderLines.length >= 3) {
    name = remainingHeaderLines.slice(0, remainingHeaderLines.length - 1).join(' ');
    baseType = remainingHeaderLines[remainingHeaderLines.length - 1];
  }

  // Group subsequent sections into their identified types
  const classifiedSections: {
    itemLevel?: string[];
    requirements?: string[];
    sockets?: string[];
    meta?: string[];
    properties?: string[];
    modifiers: string[][];
  } = {
    modifiers: [],
  };

  let explicitImplicitCount = -1;

  for (let i = 1; i < sections.length; i++) {
    const section = sections[i];
    let isItemLevel = false;
    let isRequirements = false;
    let isSockets = false;
    let isMeta = false;
    let isProperties = false;

    for (const line of section) {
      if (ITEM_LEVEL_RE.test(line)) {
        isItemLevel = true;
      }
      if (
        /^Requirements:?$/i.test(line) ||
        REQUIRES_LEVEL_RE.test(line) ||
        REQUIRES_STR_RE.test(line) ||
        REQUIRES_DEX_RE.test(line) ||
        REQUIRES_INT_RE.test(line)
      ) {
        isRequirements = true;
      }
      if (SOCKETS_RE.test(line) || RUNE_RE.test(line) || SOUL_CORE_RE.test(line)) {
        isSockets = true;
      }
      if (CORRUPTED_RE.test(line) || MIRRORED_RE.test(line) || UNIDENTIFIED_RE.test(line)) {
        isMeta = true;
      }
      if (
        QUALITY_RE.test(line) ||
        ARMOUR_RE.test(line) ||
        EVASION_RE.test(line) ||
        ENERGY_SHIELD_RE.test(line) ||
        BLOCK_CHANCE_RE.test(line) ||
        PHYSICAL_DAMAGE_RE.test(line) ||
        ELEMENTAL_DAMAGE_RE.test(line) ||
        CRIT_CHANCE_RE.test(line) ||
        ATTACKS_PER_SECOND_RE.test(line)
      ) {
        isProperties = true;
      }

      // Check for explicit "Implicits: N" count
      const implCountMatch = line.match(/^Implicits:\s*(\d+)/i);
      if (implCountMatch) {
        explicitImplicitCount = parseInt(implCountMatch[1], 10);
      }
    }

    if (isItemLevel) {
      classifiedSections.itemLevel = (classifiedSections.itemLevel || []).concat(section);
    } else if (isRequirements) {
      classifiedSections.requirements = (classifiedSections.requirements || []).concat(section);
    } else if (isSockets) {
      classifiedSections.sockets = (classifiedSections.sockets || []).concat(section);
    } else if (isMeta) {
      classifiedSections.meta = (classifiedSections.meta || []).concat(section);
    } else if (isProperties) {
      classifiedSections.properties = (classifiedSections.properties || []).concat(section);
    } else {
      classifiedSections.modifiers.push(section);
    }
  }

  // Parse Classified Sections
  // Item Level
  if (classifiedSections.itemLevel) {
    for (const line of classifiedSections.itemLevel) {
      const match = line.match(ITEM_LEVEL_RE);
      if (match) {
        itemLevel = parseInt(match[1], 10);
      } else {
        unknownLines.push(`unknown item line: ${line}`);
      }
    }
  }

  // Requirements
  let parsedReqs = {};
  if (classifiedSections.requirements) {
    parsedReqs = parseRequirements(classifiedSections.requirements, unknownLines);
  }

  // Properties
  if (classifiedSections.properties) {
    const { properties: parsedProps, quality: parsedQual } = parseProperties(
      classifiedSections.properties,
      unknownLines
    );
    Object.assign(properties, parsedProps);
    quality = parsedQual;
  }

  // Sockets, Runes, Soul Cores
  if (classifiedSections.sockets) {
    const parsedSockets = parseSockets(classifiedSections.sockets, unknownLines);
    if (parsedSockets.sockets) {
      properties['Sockets'] = parsedSockets.sockets;
    }
    runes.push(...parsedSockets.runes);
    soulCores.push(...parsedSockets.soulCores);
  }

  // Meta
  if (classifiedSections.meta) {
    for (const line of classifiedSections.meta) {
      if (CORRUPTED_RE.test(line)) {
        corrupted = true;
      } else if (MIRRORED_RE.test(line)) {
        mirrored = true;
      } else if (UNIDENTIFIED_RE.test(line)) {
        unidentified = true;
      } else {
        unknownLines.push(`unknown meta line: ${line}`);
      }
    }
  }

  // Modifiers
  const allModifierLines: string[] = [];
  const modifierSections = classifiedSections.modifiers;

  let implicits: ParsedModifier[] = [];
  let explicits: ParsedModifier[] = [];

  // Helper to parse a modifier line
  const parseModLine = (line: string): ParsedModifier => {
    const parsed = parseModifier(line);
    if (parsed.kind === 'unknown') {
      unknownLines.push(`unknown modifier format: ${line}`);
    }
    return parsed;
  };

  // If there are exactly 2 modifier sections, treat Section 1 as implicits and Section 2 as explicits
  if (modifierSections.length === 2 && explicitImplicitCount === -1) {
    implicits = modifierSections[0]
      .filter((line) => !/^Implicits:\s*(\d+)/i.test(line))
      .map(parseModLine);
    explicits = modifierSections[1]
      .filter((line) => !/^Implicits:\s*(\d+)/i.test(line))
      .map(parseModLine);
  } else {
    // Collect all lines across all modifier sections
    for (const section of modifierSections) {
      for (const line of section) {
        if (!/^Implicits:\s*(\d+)/i.test(line)) {
          allModifierLines.push(line);
        }
      }
    }

    const parsedMods = allModifierLines.map(parseModLine);

    if (explicitImplicitCount > 0) {
      implicits = parsedMods.slice(0, explicitImplicitCount);
      explicits = parsedMods.slice(explicitImplicitCount);
    } else {
      // By default, if 1 section and no Implicits count, treat as explicits
      explicits = parsedMods;
    }
  }

  return {
    itemClass,
    rarity,
    name,
    baseType,
    itemLevel,
    quality,
    requirements: parsedReqs,
    properties,
    implicits,
    explicits,
    runes,
    soulCores,
    corrupted,
    mirrored,
    unidentified,
    unknownLines,
  };
}
