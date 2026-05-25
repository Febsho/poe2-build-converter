import {
  QUALITY_RE,
  ARMOUR_RE,
  EVASION_RE,
  ENERGY_SHIELD_RE,
  BLOCK_CHANCE_RE,
  PHYSICAL_DAMAGE_RE,
  ELEMENTAL_DAMAGE_RE,
  CRIT_CHANCE_RE,
  ATTACKS_PER_SECOND_RE,
} from './regex.ts';

export type ParsedProperties = Record<string, string | number>;

export function parseProperties(
  lines: string[],
  unknownLines: string[]
): { properties: ParsedProperties; quality?: number } {
  const properties: ParsedProperties = {};
  let quality: number | undefined;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    let matched = false;

    // Quality
    const qualityMatch = trimmed.match(QUALITY_RE);
    if (qualityMatch) {
      quality = parseInt(qualityMatch[1], 10);
      properties['Quality'] = quality;
      matched = true;
      continue;
    }

    // Armour
    const armourMatch = trimmed.match(ARMOUR_RE);
    if (armourMatch) {
      properties['Armour'] = parseInt(armourMatch[1], 10);
      matched = true;
      continue;
    }

    // Evasion Rating
    const evasionMatch = trimmed.match(EVASION_RE);
    if (evasionMatch) {
      properties['Evasion Rating'] = parseInt(evasionMatch[1], 10);
      matched = true;
      continue;
    }

    // Energy Shield
    const esMatch = trimmed.match(ENERGY_SHIELD_RE);
    if (esMatch) {
      properties['Energy Shield'] = parseInt(esMatch[1], 10);
      matched = true;
      continue;
    }

    // Block chance
    const blockMatch = trimmed.match(BLOCK_CHANCE_RE);
    if (blockMatch) {
      properties['Block chance'] = parseFloat(blockMatch[1]);
      matched = true;
      continue;
    }

    // Physical Damage
    const physMatch = trimmed.match(PHYSICAL_DAMAGE_RE);
    if (physMatch) {
      properties['Physical Damage'] = `${physMatch[1]}-${physMatch[2]}`;
      matched = true;
      continue;
    }

    // Elemental Damage
    const elemMatch = trimmed.match(ELEMENTAL_DAMAGE_RE);
    if (elemMatch) {
      properties['Elemental Damage'] = elemMatch[1].trim();
      matched = true;
      continue;
    }

    // Critical Hit Chance
    const critMatch = trimmed.match(CRIT_CHANCE_RE);
    if (critMatch) {
      properties['Critical Hit Chance'] = parseFloat(critMatch[1]);
      matched = true;
      continue;
    }

    // Attacks per Second
    const apsMatch = trimmed.match(ATTACKS_PER_SECOND_RE);
    if (apsMatch) {
      properties['Attacks per Second'] = parseFloat(apsMatch[1]);
      matched = true;
      continue;
    }

    if (!matched) {
      unknownLines.push(`unknown property line: ${trimmed}`);
    }
  }

  return { properties, quality };
}
