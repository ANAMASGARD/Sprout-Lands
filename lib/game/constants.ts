export const TILE = 32;
export const MAP_WIDTH_TILES = 36;
export const MAP_HEIGHT_TILES = 26;
export const MAP_W = MAP_WIDTH_TILES * TILE;
export const MAP_H = MAP_HEIGHT_TILES * TILE;
export const VIEW_W = 960;
export const VIEW_H = 640;
export const PLAYER_SPEED = 150;

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
