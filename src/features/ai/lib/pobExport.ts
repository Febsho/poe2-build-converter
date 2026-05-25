import zlib from 'node:zlib';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { repairAiBuildPassives } from './passiveTree.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export interface AiBuild {
  buildName?: string;
  class?: string;
  ascendancy?: string;
  mainSkill?: string;
  supportGems?: string[];
  secondarySkills?: string[];
  defensiveLayers?: string[];
  passiveTreePlan?: string[];
  gearPriorities?: string[];
  levelingPlan?: string[];
  validationWarnings?: string[];
  passives?: string[];
  skills?: any[];
  items?: any[];
  [key: string]: any;
}

let passiveIdToHash: Record<string, number> | null = null;

/**
 * Loads passives_default.json and maps GGG passive string IDs to their integer hashes.
 */
function getPassiveIdToHash(): Record<string, number> {
  if (passiveIdToHash) return passiveIdToHash;

  try {
    const raw = readFileSync(path.resolve(__dirname, '../../../data/passives_default.json'), 'utf8');
    const passives = JSON.parse(raw);
    passiveIdToHash = {};
    for (const [hash, entry] of Object.entries(passives)) {
      if (entry && typeof entry === 'object' && (entry as any).id) {
        passiveIdToHash[(entry as any).id] = parseInt(hash, 10);
      }
    }
  } catch (err) {
    console.error('Failed to load passives_default.json for ID mapping:', err);
    passiveIdToHash = {};
  }
  return passiveIdToHash;
}

/**
 * Converts an AI-generated build object into a zlib-compressed, URL-safe base64 encoded
 * Path of Building (PoB) compatible export code.
 *
 * @param build The generated AI build object.
 * @returns PoB/PoB2-compatible base64 export string.
 */
export function generatePobCodeFromAiBuild(build: AiBuild): string {
  if (!build) {
    throw new Error('Cannot generate PoB code: missing build data.');
  }
  if (!build.mainSkill || build.mainSkill.trim() === '') {
    throw new Error('Cannot generate PoB code: missing main skill.');
  }

  build = repairAiBuildPassives(build).build as AiBuild;

  // 1. Build beautiful Notes text block for non-mappable data
  const notesLines: string[] = [];
  notesLines.push('Partial PoB export — passive tree, exact item stats, and config are not fully available yet.\n');
  notesLines.push(`=== Build Name ===\n${build.buildName || 'Unnamed AI Build'}\n`);
  notesLines.push(`=== Class ===\n${build.class || 'None Specified'}\n`);
  notesLines.push(`=== Ascendancy ===\n${build.ascendancy || 'None Specified'}\n`);
  notesLines.push(`=== Main Skill ===\n${build.mainSkill}\n`);

  if (build.supportGems && build.supportGems.length > 0) {
    notesLines.push(`=== Support Gems ===\n${build.supportGems.join('\n')}\n`);
  }
  if (build.secondarySkills && build.secondarySkills.length > 0) {
    notesLines.push(`=== Secondary Skills ===\n${build.secondarySkills.join('\n')}\n`);
  }
  if (build.defensiveLayers && build.defensiveLayers.length > 0) {
    notesLines.push(`=== Defensive Layers ===\n${build.defensiveLayers.join('\n')}\n`);
  }
  if (build.passiveTreePlan && build.passiveTreePlan.length > 0) {
    notesLines.push(`=== Passive Tree Direction ===\n${build.passiveTreePlan.join('\n')}\n`);
  }
  if (build.gearPriorities && build.gearPriorities.length > 0) {
    notesLines.push(`=== Gear Priorities ===\n${build.gearPriorities.join('\n')}\n`);
  }
  if (build.levelingPlan && build.levelingPlan.length > 0) {
    notesLines.push(`=== Leveling Notes ===\n${build.levelingPlan.join('\n')}\n`);
  }

  const warnings: string[] = [];
  if (!build.class || build.class.trim() === '') {
    warnings.push('PoB export may be incomplete: missing class.');
  }
  if (build.validationWarnings && build.validationWarnings.length > 0) {
    warnings.push(...build.validationWarnings);
  }
  if (warnings.length > 0) {
    notesLines.push(`=== Validation Warnings ===\n${warnings.join('\n')}\n`);
  }

  const notesText = notesLines.join('\n');

  // Helper to escape XML special entities safely
  const escXml = (str?: string): string => {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  };

  // 2. Generate compliant passive node hashes
  const nodeHashes: number[] = [];
  if (build.passives && build.passives.length > 0) {
    const map = getPassiveIdToHash();
    for (const id of build.passives) {
      const cleanId = typeof id === 'string' ? id : (id as any).id;
      if (cleanId && map[cleanId]) {
        nodeHashes.push(map[cleanId]);
      }
    }
  }

  // 3. Generate compliant PoB Skills section
  let skillsXml = '';
  if (build.skills && build.skills.length > 0) {
    const skillGroups: string[] = [];
    build.skills.forEach((sk: any, idx: number) => {
      const activeGemName = escXml(sk.id || sk.gem || 'Main Skill');
      const activeGem = `        <Gem enabled="true" level="20" nameSpec="${activeGemName}" skillId="" quality="0"/>`;
      const supportGems = (sk.support_skills || [])
        .map((sup: any) => `        <Gem enabled="true" level="20" nameSpec="${escXml(sup.id || sup.gem)}" skillId="" quality="0" support="true"/>`)
        .join('\n');
      
      skillGroups.push(`      <Skill enabled="true" mainActiveSkill="1">\n${activeGem}\n${supportGems}\n      </Skill>`);
    });
    skillsXml = `<Skills activeSkillSet="1">
    <SkillSet id="1" title="Default">
${skillGroups.join('\n')}
    </SkillSet>
  </Skills>`;
  } else {
    // Fallback to simple fields
    const mainSkillGem = `        <Gem enabled="true" level="20" nameSpec="${escXml(build.mainSkill)}" skillId="" quality="0"/>`;
    const supportGemsXml = (build.supportGems || [])
      .map((gem: string) => `        <Gem enabled="true" level="20" nameSpec="${escXml(gem)}" skillId="" quality="0" support="true"/>`)
      .join('\n');

    const secondarySkillsXml = (build.secondarySkills || [])
      .map((skill: string) => `      <Skill enabled="true">\n        <Gem enabled="true" level="20" nameSpec="${escXml(skill)}" skillId="" quality="0"/>\n      </Skill>`)
      .join('\n');

    skillsXml = `<Skills activeSkillSet="1">
    <SkillSet id="1" title="Default">
      <Skill enabled="true" mainActiveSkill="1">
${mainSkillGem}
${supportGemsXml}
      </Skill>
${secondarySkillsXml}
    </SkillSet>
  </Skills>`;
  }

  // 4. Generate compliant PoB Items section
  let itemsSectionXml = '';
  if (build.items && build.items.length > 0) {
    const slots: string[] = [];
    const items: string[] = [];
    build.items.forEach((it: any, idx: number) => {
      const itemId = idx + 1;
      const slotName = it.inventory_id || '';
      if (slotName) {
        slots.push(`      <Slot name="${escXml(slotName)}" itemId="${itemId}"/>`);
      }
      
      let itemText = it.additional_text || '';
      if (!itemText) {
        const rarity = it.rarity || 'Unique';
        const name = it.unique_name || 'Item';
        itemText = `Rarity: ${rarity.toUpperCase()}\n${name}\n`;
      }
      
      items.push(`    <Item id="${itemId}">\n      ${escXml(itemText).trim()}\n    </Item>`);
    });
    
    itemsSectionXml = `\n  <Items activeItemSet="1">
    <ItemSet id="1" title="Default">
${slots.join('\n')}
    </ItemSet>
${items.join('\n')}
  </Items>`;
  }

  const CLASS_NAME_TO_ID: Record<string, number> = {
    'Warrior': 1,
    'Ranger': 2,
    'Witch': 3,
    'Mercenary': 4,
    'Monk': 5,
    'Sorceress': 6,
    'Druid': 7,
    'Huntress': 8,
    'Templar': 9,
    'Duelist': 10,
    'Shadow': 11,
    'Marauder': 12,
  };

  const ASCENDANCY_TO_ID: Record<string, { classId: number; ascendId: number }> = {
    'Oracle': { classId: 7, ascendId: 1 },
    'Shaman': { classId: 7, ascendId: 2 },
    'Amazon': { classId: 8, ascendId: 1 },
    'Ritualist': { classId: 8, ascendId: 3 },
    'Tactician': { classId: 4, ascendId: 1 },
    'Witchhunter': { classId: 4, ascendId: 2 },
    'Gemling Legionnaire': { classId: 4, ascendId: 3 },
    'Invoker': { classId: 5, ascendId: 2 },
    'Acolyte of Chayula': { classId: 5, ascendId: 3 },
    'Deadeye': { classId: 2, ascendId: 1 },
    'Pathfinder': { classId: 2, ascendId: 3 },
    'Stormweaver': { classId: 6, ascendId: 1 },
    'Chronomancer': { classId: 6, ascendId: 2 },
    'Disciple of Varashta': { classId: 6, ascendId: 3 },
    'Titan': { classId: 1, ascendId: 1 },
    'Warbringer': { classId: 1, ascendId: 2 },
    'Smith of Kitava': { classId: 1, ascendId: 3 },
    'Infernalist': { classId: 3, ascendId: 1 },
    'Blood Mage': { classId: 3, ascendId: 2 },
    'Lich': { classId: 3, ascendId: 3 },
    'Abyssal Lich': { classId: 3, ascendId: 6 },
  };

  const classNameEsc = escXml(build.class || '');
  const ascendNameEsc = escXml(build.ascendancy || '');

  let classId = 0;
  let ascendClassId = 0;

  const ascName = build.ascendancy || '';
  const className = build.class || '';

  if (ascName && ASCENDANCY_TO_ID[ascName]) {
    classId = ASCENDANCY_TO_ID[ascName].classId;
    ascendClassId = ASCENDANCY_TO_ID[ascName].ascendId;
  } else if (className && CLASS_NAME_TO_ID[className]) {
    classId = CLASS_NAME_TO_ID[className];
  }

  const treeVer = build.treeVersion || build.tree_version || '0_4';
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<PathOfBuilding>
  <Build level="1" className="${classNameEsc}" ascendClassName="${ascendNameEsc}" mainSocketGroup="1" viewMode="NOTES" targetVersion="3_0">
  </Build>
  ${skillsXml}
  <Config/>
  <Tree activeSpec="1">
    <Spec title="Default" treeVersion="${escXml(treeVer)}" ascendClassId="${ascendClassId}" classId="${classId}" nodes="${nodeHashes.join(',')}"/>
  </Tree>${itemsSectionXml}
  <Notes>
${escXml(notesText)}
  </Notes>
</PathOfBuilding>`;

  // 5. zlib-wrapped DEFLATE + URL-safe base64 — matches PoB export format:
  //    Prepends version byte 0x01 (strictly expected by desktop PoB's base64/deflate Lua importer).
  const compressed = zlib.deflateSync(Buffer.from(xml, 'utf8'));
  const payload = Buffer.concat([Buffer.from([0x01]), compressed]);
  const b64 = payload.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

  return b64;
}
