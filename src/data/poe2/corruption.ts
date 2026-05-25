import type { Modifier } from './types.ts';

export type CorruptionOutcome = {
  id: string;
  name: string;
  chance: number;
  effect: "corrupted_no_change" | "brick_to_rare" | "implicit_change" | "mirrored";
};

export const POE2_CORRUPTION_OUTCOMES: CorruptionOutcome[] = [
  { id: "outcome-no-change", name: "Corrupted (No Change)", chance: 0.5, effect: "corrupted_no_change" },
  { id: "outcome-brick-rare", name: "Brick to Rare item", chance: 0.25, effect: "brick_to_rare" },
  { id: "outcome-implicit", name: "Add Corrupted Implicit", chance: 0.25, effect: "implicit_change" }
];

export const POE2_CORRUPTION_IMPLICITS: Modifier[] = [
  {
    id: "corruption-implicit-1",
    name: "Corrupted Implicit",
    text: "+1 to Level of socketed Skill Gems",
    type: "implicit",
    weight: 100,
    requiredItemLevel: 1,
    tags: ["weapon", "armour"]
  },
  {
    id: "corruption-implicit-2",
    name: "Corrupted Implicit",
    text: "+5% to maximum Fire Resistance",
    type: "implicit",
    weight: 100,
    requiredItemLevel: 1,
    tags: ["armour"]
  },
  {
    id: "corruption-implicit-3",
    name: "Corrupted Implicit",
    text: "4% increased maximum Life",
    type: "implicit",
    weight: 100,
    requiredItemLevel: 1,
    tags: ["armour", "jewellery"]
  }
];
