import { PUZZLE_IDS, type PuzzleId } from "./constants";

export type PuzzleDefinition = {
  id: PuzzleId;
  label: string;
  charmLabel: string;
  intro: string[];
  solved: string[];
  objective: string;
  /**
   * Symbol the puzzle teaches Teemo. The shrine puzzle uses these
   * to verify the final pillar arrangement.
   */
  symbol: "sun" | "leaf" | "wave" | "moon";
};

export const PUZZLES: Record<PuzzleId, PuzzleDefinition> = {
  [PUZZLE_IDS.cottage]: {
    id: PUZZLE_IDS.cottage,
    label: "The Library Ledger",
    charmLabel: "Sun Charm",
    intro: [
      "Welcome to the old library, little traveler.",
      "The Memory Codex glows with six rune words.",
      "Remember the light sequence and repeat it correctly.",
    ],
    solved: ["You picked up the SUN CHARM.", "Where to next?"],
    objective: "Solve the Memory Codex sequence in the library",
    symbol: "sun",
  },
  [PUZZLE_IDS.garden]: {
    id: PUZZLE_IDS.garden,
    label: "The Sprout Sequence",
    charmLabel: "Leaf Charm",
    intro: [
      "Four crop tiles bloom in a row.",
      "An old gardener's note: 'Wake them in order — TINY, SHORT, TALL, BLOOM.'",
      "Step on the right tile first.",
    ],
    solved: [
      "The crops chime in harmony.",
      "A LEAF CHARM sprouts up from the soil!",
    ],
    objective: "Step on the crops in the right order",
    symbol: "leaf",
  },
  [PUZZLE_IDS.caverns]: {
    id: PUZZLE_IDS.caverns,
    label: "The Falling Caverns",
    charmLabel: "Wave Charm",
    intro: [
      "Inside the cavern, gravity pulls everything down.",
      "Climb the platforms and grab the WAVE CHARM at the top.",
    ],
    solved: ["You snatched the WAVE CHARM mid-air!", "Back to the island."],
    objective: "Climb the cavern and grab the wave charm",
    symbol: "wave",
  },
  [PUZZLE_IDS.shrine]: {
    id: PUZZLE_IDS.shrine,
    label: "The Moonbell Shrine",
    charmLabel: "Moon Charm",
    intro: [
      "Four pillars hum at the shrine.",
      "Each pillar cycles symbols: SUN, LEAF, WAVE, MOON.",
      "Set them in the order Teemo discovered.",
    ],
    solved: [
      "The pillars sing in unison...",
      "The final clue is unlocked! Open the central chest for the number!",
    ],
    objective: "Arrange the four pillars: SUN, LEAF, WAVE, MOON",
    symbol: "moon",
  },
};
