export type AbyssCraftingData = {
  id: string;
  name: string;
  itemTypes: string[];
  allowedBaseTags: string[];
  forcedMods?: string[];
  modifierPoolIds?: string[];
  socketBehavior?: "adds_socket" | "modifies_socket" | "requires_socket" | "none";
  description: string;
  dataComplete: boolean;
};

export const POE2_ABYSS_CRAFTING: AbyssCraftingData[] = [
  {
    id: "abyss-vise",
    name: "Stygian Vise Crafting",
    itemTypes: ["belt"],
    allowedBaseTags: ["belt"],
    socketBehavior: "adds_socket",
    description: "Converts a belt into a Stygian Vise, adding an Abyss Socket to the item.",
    dataComplete: true,
  },
  {
    id: "abyss-jewel-ghastly",
    name: "Ghastly Eye Jewel Insertion",
    itemTypes: ["jewel"],
    allowedBaseTags: ["jewel"],
    forcedMods: ["Minions deal #% increased Damage"],
    description: "Applies Ghastly Eye Abyss specific stats to jewels. (Partial database status).",
    dataComplete: false,
  },
  {
    id: "abyss-socket-modification",
    name: "Abyssal Socket Resonance",
    itemTypes: ["body armour", "gloves", "boots", "helmet"],
    allowedBaseTags: ["armour"],
    socketBehavior: "modifies_socket",
    description: "Resonates standard socket links with Abyssal socket behavior. (Incomplete database status).",
    dataComplete: false,
  }
];
