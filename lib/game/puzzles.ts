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
      "Watch the preview — then echo it back in the same order.",
    ],
    solved: ["You picked up the SUN CHARM.", "Where to next?"],
    objective: "Repeat the Memory Codex rune sequence in the library",
    symbol: "sun",
  },
  [PUZZLE_IDS.garden]: {
    id: PUZZLE_IDS.garden,
    label: "The Sprout Sequence",
    charmLabel: "Leaf Charm",
    intro: [
      "Four crop tiles bloom in a row.",
      "The sprouts rise to different heights — the soil remembers a marching order.",
      "Step wisely; you only have one window once you begin.",
    ],
    solved: [
      "The crops chime in harmony.",
      "A LEAF CHARM sprouts up from the soil!",
    ],
    objective: "Read the garden and step the crops in the true order — quickly",
    symbol: "leaf",
  },
  [PUZZLE_IDS.caverns]: {
    id: PUZZLE_IDS.caverns,
    label: "The Falling Caverns",
    charmLabel: "Wave Charm",
    intro: [
      "Inside the cavern, gravity pulls everything down.",
      "Cold water chases from below — climb before it catches you.",
    ],
    solved: ["You snatched the WAVE CHARM mid-air!", "Back to the island."],
    objective: "Outrun the flood and grab the wave charm",
    symbol: "wave",
  },
  [PUZZLE_IDS.shrine]: {
    id: PUZZLE_IDS.shrine,
    label: "The Moonbell Shrine",
    charmLabel: "Moon Charm",
    intro: [
      "Four pillars hum at the shrine.",
      "Each pillar cycles ancient symbols.",
      "Match what the honest island cats remember.",
    ],
    solved: [
      "The pillars sing in unison...",
      "The final clue is unlocked! Open the central chest for the number!",
    ],
    objective: "Tune all four pillars to the true island order",
    symbol: "moon",
  },
};
