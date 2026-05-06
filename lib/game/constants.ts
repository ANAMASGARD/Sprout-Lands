export const TILE = 32;
export const MAP_WIDTH_TILES = 36;
export const MAP_HEIGHT_TILES = 26;
export const MAP_W = MAP_WIDTH_TILES * TILE;
export const MAP_H = MAP_HEIGHT_TILES * TILE;
export const VIEW_W = 960;
export const VIEW_H = 640;
export const PLAYER_SPEED = 150;

/** Full run length when IslandScene starts (ms). */
export const RUN_DURATION_MS = 6 * 60 * 1000;
/** HUD pulse / warn styling below this (ms). */
export const TIMER_WARN_MS = 2 * 60 * 1000;
/** Imposter begins hunting at or below this remaining time (ms). */
export const HUNT_AT_REMAINING_MS = 4 * 60 * 1000;
/** Honest NPC lines become hedged below this (ms). */
export const PARANOIA_AT_REMAINING_MS = 3 * 60 * 1000;
/** After first correct garden tile, finish all four within this (ms). */
export const GARDEN_COMMIT_MS = 6500;
/** Time shaved on garden commit fail (seconds, applied via bus). */
export const PRESSURE_PENALTY_GARDEN_FAIL_SEC = 40;
export const HP_MAX = 3;
/** Star 2: chest opened with at least this many ms left. */
export const STAR_2_REMAINING_MS = 3 * 60 * 1000;
/** Star 3: plus correct imposter accusation before end; need at least this ms left. */
export const STAR_3_REMAINING_MS = 4 * 60 * 1000;
/** Cavern rising flood (world px per second). */
export const FLOOD_RISE_BASE_PX = 10;
/** Extra rise when player moves left (don't look back). */
export const FLOOD_RISE_BACK_VX_MULT = 0.04;
/** Imposter random-kill grace period from scene start (ms). */
export const IMPOSTER_KILL_GRACE_MS = 20 * 1000;
/** Minimum delay between kill chance checks (ms). */
export const IMPOSTER_KILL_CHECK_MIN_MS = 1600;
/** Maximum delay between kill chance checks (ms). */
export const IMPOSTER_KILL_CHECK_MAX_MS = 2200;
/** Kill can only trigger when imposter is this close to player (px). */
export const IMPOSTER_KILL_RANGE_PX = 84;
/** Medium aggression: chance to kill when in range at each check. */
export const IMPOSTER_KILL_CHANCE = 0.38;

export const COLORS = {
  grassLight: 0xc6dca8,
  grassMid: 0x9dc878,
  grassDark: 0x6fa055,
  grassDarkest: 0x4f7e3a,
  water: 0xa6d8d3,
  waterDeep: 0x6fb1ad,
  sand: 0xead7a8,
  bridge: 0xb1804f,
  bridgeDark: 0x7a5235,
  pathLight: 0xe7d3a4,
  pathDark: 0xc4ac7a,
  shrineStone: 0xc7b8ad,
  shrineDark: 0x8c7d72,
  cottageRoof: 0xc06b4a,
  cottageWall: 0xead7a8,
  cottageDoor: 0x73422c,
  treeTrunk: 0x73422c,
  treeLight: 0x7cb663,
  treeDark: 0x5a8c4a,
  flowerPink: 0xf2a4a4,
  flowerYellow: 0xf3d18d,
  rock: 0xb1b6b9,
  rockDark: 0x6f7479,
  cropPlot: 0xc89b6c,
  cropPlotDark: 0xa9804f,
  cropGrowing: 0xa5cf7c,
  cropTagged: 0xf3d18d,
  panelTan: 0xead7a8,
  panelDark: 0x9c7c54,
  textBrown: 0x4a3528,
  textCream: 0xfbeec1,
  starGold: 0xf3c44a,
  starShadow: 0xb37b1d,
  heart: 0xd96573,
  gem: 0x9b6bd6,
  white: 0xffffff,
  black: 0x000000,
};

export const REWARD_PHONE_NUMBER =
  process.env.NEXT_PUBLIC_REWARD_PHONE_NUMBER ?? "9936882778";

export const PUZZLE_IDS = {
  cottage: "cottage",
  garden: "garden",
  caverns: "caverns",
  shrine: "shrine",
} as const;

export type PuzzleId = (typeof PUZZLE_IDS)[keyof typeof PUZZLE_IDS];

export const PUZZLE_ORDER: PuzzleId[] = [
  PUZZLE_IDS.cottage,
  PUZZLE_IDS.garden,
  PUZZLE_IDS.caverns,
  PUZZLE_IDS.shrine,
];
