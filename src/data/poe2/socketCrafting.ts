export type SocketCraftOption = {
  id: string;
  name: string;
  maxSockets: number;
  description: string;
};

export const POE2_SOCKET_CRAFT_OPTIONS: SocketCraftOption[] = [
  {
    id: "add-socket",
    name: "Jeweller's Orb",
    maxSockets: 4,
    description: "Adds an additional socket or socket link to the item, up to a maximum of 4 sockets.",
  },
  {
    id: "stygian-socket",
    name: "Stygian Socket Addition",
    maxSockets: 1,
    description: "Adds an Abyssal socket directly to Stygians or compatible bases.",
  }
];
