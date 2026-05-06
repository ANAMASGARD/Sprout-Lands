import * as Phaser from "phaser";
import {
  TILE,
  MAP_W,
  MAP_H,
  MAP_WIDTH_TILES,
  MAP_HEIGHT_TILES,
  COLORS,
  PLAYER_SPEED,
  PUZZLE_IDS,
  PUZZLE_ORDER,
  REWARD_PHONE_NUMBER,
  RUN_DURATION_MS,
  HP_MAX,
  PARANOIA_AT_REMAINING_MS,
  GARDEN_COMMIT_MS,
  PRESSURE_PENALTY_GARDEN_FAIL_SEC,
  IMPOSTER_KILL_GRACE_MS,
  IMPOSTER_KILL_CHECK_MIN_MS,
  IMPOSTER_KILL_CHECK_MAX_MS,
  IMPOSTER_KILL_RANGE_PX,
  IMPOSTER_KILL_CHANCE,
  STAR_2_REMAINING_MS,
  STAR_3_REMAINING_MS,
  type PuzzleId,
} from "../constants";
import { ASSET_KEYS, EMOJI_FRAMES } from "../assets";
import { gameBus } from "../eventBus";
import { PUZZLES } from "../puzzles";
import {
  GARDEN_LIES,
  GARDEN_TRUTH,
  GARDEN_TRUTH_PARANOID,
  NPC_NAMES,
  SHRINE_LIES,
  SHRINE_TRUTH,
  SHRINE_TRUTH_PARANOID,
} from "../npcDialog";

type Interactable = {
  zone: Phaser.GameObjects.Zone;
  prompt: string;
  onInteract: () => void;
};

type CropTile = {
  rect: Phaser.GameObjects.Rectangle;
  marker: Phaser.GameObjects.Text;
  index: number;
  activated: boolean;
};

type NpcWanderer = {
  name: string;
  sprite: Phaser.Physics.Arcade.Sprite;
  chatZone: Phaser.GameObjects.Zone;
  target: Phaser.Math.Vector2;
  speed: number;
  nextRetargetAt: number;
  waitingUntil: number;
  isWaiting: boolean;
};

const SHRINE_TARGET = ["sun", "leaf", "wave", "moon"] as const;
const SHRINE_SYMBOLS = ["sun", "leaf", "wave", "moon"] as const;
type ShrineSymbol = (typeof SHRINE_SYMBOLS)[number];

const SYMBOL_LABEL: Record<ShrineSymbol, string> = {
  sun: "☀",
  leaf: "🌿",
  wave: "≈",
  moon: "☾",
};

export class IslandScene extends Phaser.Scene {
  private player!: Phaser.Physics.Arcade.Sprite;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Record<"W" | "A" | "S" | "D" | "E" | "SPACE", Phaser.Input.Keyboard.Key>;
  private interactables: Interactable[] = [];
  private nearest: Interactable | null = null;
  private hint!: Phaser.GameObjects.Container;
  private hintText!: Phaser.GameObjects.Text;
  private solids!: Phaser.Physics.Arcade.StaticGroup;
  private crates!: Phaser.Physics.Arcade.Group;
  private cropTiles: CropTile[] = [];
  private cropOrder: number[] = [0, 1, 2, 3];
  private cropProgress = 0;
  private cropResetText!: Phaser.GameObjects.Text;
  private shrineState: ShrineSymbol[] = ["sun", "sun", "sun", "sun"];
  private shrinePillars: Phaser.GameObjects.Text[] = [];
  private collectedCharms = new Set<PuzzleId>();
  private chest!: Phaser.GameObjects.Container;
  private chestOpened = false;
  private interactCooldown = 0;
  private virtualInput = { left: false, right: false, up: false, down: false };
  private busUnsubs: Array<() => void> = [];
  private npcs: NpcWanderer[] = [];
  private inputFrozen = false;
  private lastRemainingMs = RUN_DURATION_MS;
  private imposterName = "";
  private accusationUsed = false;
  private accusationAttempts = 0;
  private whisperStoneCooldownUntil = 0;
  private accusationCorrect = false;
  private playerHp = HP_MAX;
  private gardenCommitDeadline: number | null = null;
  private gardenBarFill: Phaser.GameObjects.Rectangle | null = null;
  private gardenBarMaxW = TILE * 4;
  private gardenBarX = 0;
  private gardenBarY = 0;
  private chestInteractable: Interactable | null = null;
  private whisperInteractable: Interactable | null = null;
  private killSequenceStarted = false;
  private imposterKillGraceUntil = 0;
  private nextRandomKillCheckAt = 0;
  private static readonly MAX_ACCUSATION_ATTEMPTS = 3;
  private static readonly WHISPER_STONE_COOLDOWN_MS = 30_000;

  constructor() {
    super("IslandScene");
  }

  create() {
    this.physics.world.setBounds(0, 0, MAP_W, MAP_H);
    this.cameras.main.setBounds(0, 0, MAP_W, MAP_H);
    this.cameras.main.setBackgroundColor(COLORS.water);

    this.solids = this.physics.add.staticGroup();
    this.crates = this.physics.add.group({
      collideWorldBounds: true,
      bounceX: 0,
      bounceY: 0,
      dragX: 600,
      dragY: 600,
    });

    this.createCrateTexture();

    this.paintTerrain();
    this.placeWaterEdges();
    this.placePaths();
    this.placeDecor();
    this.placeLibraryEntrance();
    this.player = this.physics.add.sprite(
      MAP_W / 2,
      MAP_H / 2 + TILE * 2,
      ASSET_KEYS.emojiSheet,
      EMOJI_FRAMES.catYellow,
    );
    this.player.setDepth(50);
    this.player.setSize(18, 14).setOffset(7, 16);
    this.player.setCollideWorldBounds(true);

    this.placeGarden();
    this.placeCavernEntrance();
    this.placeShrine();
    this.placeChest();
    this.placeWhisperStone();
    this.placeCrates();
    this.placeNpcWanderers();

    this.physics.add.collider(this.player, this.solids);
    this.physics.add.collider(this.player, this.crates);
    this.physics.add.collider(this.crates, this.solids);
    this.physics.add.collider(this.crates, this.crates);

    this.cameras.main.startFollow(this.player, true, 0.12, 0.12);
    this.cameras.main.setRoundPixels(true);
    this.cameras.main.setZoom(1.6);

    this.cursors = this.input.keyboard!.createCursorKeys();
    this.wasd = this.input.keyboard!.addKeys({
      W: Phaser.Input.Keyboard.KeyCodes.W,
      A: Phaser.Input.Keyboard.KeyCodes.A,
      S: Phaser.Input.Keyboard.KeyCodes.S,
      D: Phaser.Input.Keyboard.KeyCodes.D,
      E: Phaser.Input.Keyboard.KeyCodes.E,
      SPACE: Phaser.Input.Keyboard.KeyCodes.SPACE,
    }) as Record<"W" | "A" | "S" | "D" | "E" | "SPACE", Phaser.Input.Keyboard.Key>;

    this.makeHint();

    gameBus.emit("hp:update", { current: HP_MAX, max: HP_MAX });
    gameBus.emit("run:started", { durationMs: RUN_DURATION_MS });
    gameBus.emit("objective:update", {
      text: "Race the clock — collect every charm and open the chest.",
    });
    gameBus.emit("dialog:show", {
      speaker: "Teemo",
      lines: [
        "Mrow… the tide is rising!",
        "I need Gaurav Chaudhary's phone number before the island sinks.",
        "Four charms seal the chest. One of the cats is lying — ask around.",
        "Use Arrows or WASD to walk. Press E to interact. Stay alert — the imposter may strike suddenly.",
      ],
    });

    this.busUnsubs.push(
      gameBus.on("input:virtual", (state) => {
        this.virtualInput = state;
      }),
      gameBus.on("input:interact", () => {
        if (!this.inputFrozen) this.tryInteract();
      }),
      gameBus.on("scene:return-from-caverns", ({ collected }) => {
        if (collected) {
          this.completePuzzle(PUZZLE_IDS.caverns);
        }
      }),
      gameBus.on("scene:return-from-library", ({ collected }) => {
        if (collected) {
          this.completePuzzle(PUZZLE_IDS.cottage);
        }
      }),
      gameBus.on("input:freeze", ({ frozen }) => {
        this.inputFrozen = frozen;
        if (frozen && this.player?.active) {
          this.player.setVelocity(0, 0);
          this.virtualInput = { left: false, right: false, up: false, down: false };
        }
      }),
      gameBus.on("timer:tick", ({ remainingMs }) => {
        this.lastRemainingMs = remainingMs;
      }),
      gameBus.on("imposter:accuse-pick", ({ accusedName }) => {
        this.handleAccusationPick(accusedName);
      }),
    );

    this.events.on(Phaser.Scenes.Events.WAKE, () => {
      this.cameras.main.fadeIn(300, 0, 0, 0);
    });

    this.refreshChestPrompt();

    this.events.on(Phaser.Scenes.Events.SHUTDOWN, () => {
      for (const off of this.busUnsubs) off();
      this.busUnsubs = [];
    });
  }

  private paintTerrain() {
    const g = this.add.graphics();
    g.fillStyle(COLORS.water, 1);
    g.fillRect(0, 0, MAP_W, MAP_H);

    const grassMarginX = 3;
    const grassMarginY = 3;
    const innerW = MAP_WIDTH_TILES - grassMarginX * 2;
    const innerH = MAP_HEIGHT_TILES - grassMarginY * 2;
    const sandX = grassMarginX * TILE;
    const sandY = grassMarginY * TILE;

    g.fillStyle(COLORS.sand, 1);
    g.fillRoundedRect(
      sandX - TILE,
      sandY - TILE,
      innerW * TILE + TILE * 2,
      innerH * TILE + TILE * 2,
      32,
    );

    g.fillStyle(COLORS.grassMid, 1);
    g.fillRoundedRect(
      sandX,
      sandY,
      innerW * TILE,
      innerH * TILE,
      24,
    );

    for (let y = grassMarginY; y < MAP_HEIGHT_TILES - grassMarginY; y++) {
      for (let x = grassMarginX; x < MAP_WIDTH_TILES - grassMarginX; x++) {
        if ((x + y) % 7 === 0) {
          g.fillStyle(COLORS.grassLight, 0.5);
          g.fillRect(x * TILE, y * TILE, TILE, TILE);
        } else if ((x * 3 + y * 5) % 11 === 0) {
          g.fillStyle(COLORS.grassDark, 0.45);
          g.fillRect(x * TILE, y * TILE, TILE, TILE);
        }
      }
    }
    g.setDepth(0);
  }

  private placeWaterEdges() {
    const grassMarginX = 3;
    const grassMarginY = 3;
    const top = grassMarginY * TILE;
    const left = grassMarginX * TILE;
    const right = (MAP_WIDTH_TILES - grassMarginX) * TILE;
    const bottom = (MAP_HEIGHT_TILES - grassMarginY) * TILE;

    const waterRects = [
      { x: 0, y: 0, w: MAP_W, h: top - TILE },
      { x: 0, y: bottom + TILE, w: MAP_W, h: MAP_H - bottom - TILE },
      { x: 0, y: top - TILE, w: left - TILE, h: bottom - top + TILE * 2 },
      {
        x: right + TILE,
        y: top - TILE,
        w: MAP_W - right - TILE,
        h: bottom - top + TILE * 2,
      },
    ];
    for (const r of waterRects) {
      const body = this.add.rectangle(
        r.x + r.w / 2,
        r.y + r.h / 2,
        r.w,
        r.h,
        COLORS.water,
        0,
      );
      this.physics.add.existing(body, true);
      this.solids.add(body);
    }

    const ripples = this.add.graphics();
    ripples.fillStyle(COLORS.waterDeep, 0.5);
    for (let i = 0; i < 60; i++) {
      const rx = Phaser.Math.Between(8, MAP_W - 8);
      const ry = Phaser.Math.Between(8, MAP_H - 8);
      const inGrass =
        rx > left &&
        rx < right &&
        ry > top &&
        ry < bottom;
      if (inGrass) continue;
      ripples.fillRect(rx, ry, 6, 2);
    }
    ripples.setDepth(1);
  }

  private placePaths() {
    const g = this.add.graphics();
    g.fillStyle(COLORS.pathLight, 1);
    const pathW = 28;

    const center = { x: MAP_W / 2, y: MAP_H / 2 + TILE * 2 };
    const stations = {
      cottage: { x: 6 * TILE + 32, y: 6 * TILE + 32 },
      garden: { x: 27 * TILE + 16, y: 6 * TILE + 32 },
      caverns: { x: 7 * TILE + 32, y: 19 * TILE },
      shrine: { x: 27 * TILE + 16, y: 19 * TILE },
    };

    const drawL = (
      a: { x: number; y: number },
      b: { x: number; y: number },
    ) => {
      g.fillRoundedRect(
        Math.min(a.x, b.x) - pathW / 2,
        a.y - pathW / 2,
        Math.abs(b.x - a.x) + pathW,
        pathW,
        6,
      );
      g.fillRoundedRect(
        b.x - pathW / 2,
        Math.min(a.y, b.y) - pathW / 2,
        pathW,
        Math.abs(b.y - a.y) + pathW,
        6,
      );
    };

    drawL(center, stations.cottage);
    drawL(center, stations.garden);
    drawL(center, stations.caverns);
    drawL(center, stations.shrine);

    g.lineStyle(2, COLORS.pathDark, 0.45);
    g.strokeCircle(center.x, center.y, 36);
    g.setDepth(2);
  }

  private placeDecor() {
    const trees: Array<[number, number]> = [
      [4, 4], [4, 11], [4, 18], [5, 22],
      [12, 4], [16, 4], [20, 4], [22, 9],
      [31, 4], [31, 11], [31, 18], [30, 22],
      [12, 22], [17, 22], [22, 22],
      [10, 9], [25, 14],
    ];
    for (const [tx, ty] of trees) {
      this.makeTree(tx * TILE + TILE / 2, ty * TILE + TILE / 2);
    }

    const rocks: Array<[number, number]> = [
      [6, 14], [13, 16], [29, 9], [11, 11], [24, 11], [15, 18],
    ];
    for (const [tx, ty] of rocks) {
      this.makeRock(tx * TILE + TILE / 2, ty * TILE + TILE / 2);
    }

    const flowers: Array<[number, number, number]> = [
      [9, 6, COLORS.flowerPink],
      [10, 6, COLORS.flowerYellow],
      [16, 8, COLORS.flowerPink],
      [20, 18, COLORS.flowerYellow],
      [25, 17, COLORS.flowerPink],
      [13, 13, COLORS.flowerYellow],
      [22, 5, COLORS.flowerPink],
    ];
    for (const [tx, ty, color] of flowers) {
      this.makeFlower(tx * TILE + TILE / 2, ty * TILE + TILE / 2, color);
    }
  }

  private makeTree(x: number, y: number) {
    const trunk = this.add.rectangle(x, y + 10, 6, 12, COLORS.treeTrunk);
    trunk.setDepth(8);
    const crown = this.add.circle(x, y - 4, 14, COLORS.treeDark);
    crown.setDepth(9);
    const crownLight = this.add.circle(x - 4, y - 7, 8, COLORS.treeLight);
    crownLight.setDepth(10);
    void crown;
    void crownLight;

    const body = this.add.rectangle(x, y + 6, 14, 14, 0, 0);
    this.physics.add.existing(body, true);
    this.solids.add(body);
  }

  private makeRock(x: number, y: number) {
    const rock = this.add.ellipse(x, y, 22, 16, COLORS.rock);
    rock.setDepth(8);
    const highlight = this.add.ellipse(x - 4, y - 3, 8, 4, COLORS.white, 0.6);
    highlight.setDepth(9);
    void highlight;

    const body = this.add.rectangle(x, y, 18, 12, 0, 0);
    this.physics.add.existing(body, true);
    this.solids.add(body);
  }

  private makeFlower(x: number, y: number, color: number) {
    const stem = this.add.rectangle(x, y + 4, 2, 6, COLORS.treeDark);
    void stem;
    this.add.circle(x, y, 3, color).setDepth(7);
    this.add.circle(x, y - 1, 1, COLORS.white).setDepth(8);
  }

  private placeLibraryEntrance() {
    const baseX = 5 * TILE + 16;
    const baseY = 4 * TILE + 16;

    const wall = this.add.rectangle(
      baseX,
      baseY + 16,
      TILE * 3,
      TILE * 2,
      COLORS.cottageWall,
    );
    wall.setStrokeStyle(2, COLORS.bridgeDark);
    wall.setDepth(8);

    const roof = this.add.triangle(
      baseX,
      baseY - 4,
      -TILE * 2,
      TILE,
      0,
      -TILE,
      TILE * 2,
      TILE,
      COLORS.cottageRoof,
    );
    roof.setStrokeStyle(2, 0x6b3c20);
    roof.setDepth(9);

    const door = this.add.rectangle(
      baseX,
      baseY + 30,
      14,
      22,
      COLORS.cottageDoor,
    );
    door.setStrokeStyle(2, 0x4a2614);
    door.setDepth(10);

    const win1 = this.add.rectangle(baseX - 22, baseY + 12, 12, 12, COLORS.water);
    win1.setStrokeStyle(2, COLORS.bridgeDark);
    win1.setDepth(10);
    const win2 = this.add.rectangle(baseX + 22, baseY + 12, 12, 12, COLORS.water);
    win2.setStrokeStyle(2, COLORS.bridgeDark);
    win2.setDepth(10);

    const wallBody = this.add.rectangle(baseX, baseY + 16, TILE * 3, TILE * 2, 0, 0);
    this.physics.add.existing(wallBody, true);
    this.solids.add(wallBody);

    const sign = this.add
      .text(baseX, baseY + 56, "LIBRARY", {
        fontFamily: "Sprout Lands, monospace",
        fontSize: "12px",
        color: "#4a3528",
        backgroundColor: "#fbeec1",
        padding: { x: 6, y: 2 },
      })
      .setOrigin(0.5)
      .setDepth(11);
    void sign;

    const zone = this.add.zone(baseX, baseY + 56, TILE * 3, TILE);
    this.physics.add.existing(zone, true);
    this.interactables.push({
      zone,
      prompt: "Enter library",
      onInteract: () => this.enterLibrary(),
    });
  }

  private enterLibrary() {
    if (this.inputFrozen) return;
    gameBus.emit("scene:enter", { scene: "library" });
    this.cameras.main.fadeOut(300, 0, 0, 0);
    this.time.delayedCall(320, () => {
      this.scene.sleep();
      this.scene.run("LibraryScene", {
        solved: this.collectedCharms.has(PUZZLE_IDS.cottage),
      });
    });
  }

  private placeGarden() {
    this.cropOrder = Phaser.Utils.Array.Shuffle([0, 1, 2, 3]);
    const startX = 22 * TILE;
    const y = 6 * TILE;

    const plotBg = this.add.rectangle(
      startX + TILE * 2,
      y + TILE / 2,
      TILE * 4 + 8,
      TILE + 8,
      COLORS.cropPlot,
    );
    plotBg.setStrokeStyle(2, COLORS.cropPlotDark);
    plotBg.setDepth(3);

    const labels = ["·", "·", "·", "·"];
    const heights = [4, 8, 14, 18];

    for (let i = 0; i < 4; i++) {
      const cx = startX + i * TILE + TILE / 2;
      const tile = this.add.rectangle(
        cx,
        y + TILE / 2,
        TILE - 4,
        TILE - 4,
        COLORS.cropGrowing,
        1,
      );
      tile.setStrokeStyle(2, COLORS.cropPlotDark);
      tile.setDepth(4);

      const sprout = this.add.rectangle(
        cx,
        y + TILE / 2 + (TILE - heights[i]) / 2 - 4,
        4,
        heights[i],
        COLORS.grassDarkest,
      );
      sprout.setDepth(5);
      void sprout;

      const marker = this.add
        .text(cx, y - 6, labels[i], {
          fontFamily: "Sprout Lands, monospace",
          fontSize: "10px",
          color: "#4a3528",
        })
        .setOrigin(0.5)
        .setDepth(6);

      const zone = this.add.zone(cx, y + TILE / 2, TILE - 6, TILE - 6);
      this.physics.add.existing(zone, true);

      const cropTile: CropTile = { rect: tile, marker, index: i, activated: false };
      this.cropTiles.push(cropTile);

      this.physics.add.overlap(
        this.player,
        zone,
        () => this.onCropTileEntered(cropTile),
        undefined,
        this,
      );
    }

    this.cropResetText = this.add
      .text(startX + TILE * 2, y - 28, "Garden sequence is random each run.", {
        fontFamily: "Sprout Lands, monospace",
        fontSize: "10px",
        color: "#4a3528",
        backgroundColor: "#fbeec1",
        padding: { x: 4, y: 2 },
      })
      .setOrigin(0.5, 1)
      .setDepth(20);

    this.gardenBarX = startX + TILE * 2 - TILE * 2;
    this.gardenBarY = y - 42;
    this.add
      .rectangle(
        this.gardenBarX + this.gardenBarMaxW / 2,
        this.gardenBarY,
        this.gardenBarMaxW + 4,
        8,
        COLORS.bridgeDark,
        0.7,
      )
      .setDepth(19);
    this.gardenBarFill = this.add.rectangle(
      this.gardenBarX,
      this.gardenBarY,
      this.gardenBarMaxW,
      4,
      COLORS.starGold,
      0.95,
    );
    this.gardenBarFill.setOrigin(0, 0.5);
    this.gardenBarFill.setStrokeStyle(1, COLORS.starShadow);
    this.gardenBarFill.setVisible(false);
    this.gardenBarFill.setDepth(20);
  }

  private onCropTileEntered(tile: CropTile) {
    if (this.collectedCharms.has(PUZZLE_IDS.garden)) return;
    if (tile.activated) return;

    if (tile.index === this.cropOrder[this.cropProgress]) {
      const starting = this.cropProgress === 0;
      this.playSfx(ASSET_KEYS.sfxCropPop, 0.4);
      tile.activated = true;
      tile.rect.setFillStyle(COLORS.starGold);
      this.cropProgress++;
      this.cameras.main.flash(120, 250, 230, 200);
      if (starting) {
        this.gardenCommitDeadline = this.time.now + GARDEN_COMMIT_MS;
        if (this.gardenBarFill) {
          this.gardenBarFill.setVisible(true);
          this.gardenBarFill.width = this.gardenBarMaxW;
        }
      }
      if (this.cropProgress === this.cropOrder.length) {
        this.gardenCommitDeadline = null;
        this.gardenBarFill?.setVisible(false);
        this.cropResetText.setText("The crops harmonize!");
        this.time.delayedCall(400, () => {
          this.completePuzzle(PUZZLE_IDS.garden);
        });
      }
    } else {
      this.playSfx(ASSET_KEYS.sfxCropPop, 0.4);
      this.cameras.main.shake(120, 0.005);
      this.clearGardenCommit();
      this.cropProgress = 0;
      for (const t of this.cropTiles) {
        t.activated = false;
        t.rect.setFillStyle(COLORS.cropGrowing);
      }
      this.cropResetText.setText("Order broken — read the heights again.");
    }
  }

  private clearGardenCommit() {
    this.gardenCommitDeadline = null;
    this.gardenBarFill?.setVisible(false);
  }

  private failGardenCommitTimedOut() {
    this.cameras.main.shake(160, 0.008);
    this.cropProgress = 0;
    for (const t of this.cropTiles) {
      t.activated = false;
      t.rect.setFillStyle(COLORS.cropGrowing);
    }
    this.cropResetText.setText("Too slow! The ground takes the blessing back.");
    this.clearGardenCommit();
    gameBus.emit("pressure:penalty", {
      seconds: PRESSURE_PENALTY_GARDEN_FAIL_SEC,
      reason: "Garden sequence timed out",
    });
  }

  private placeCavernEntrance() {
    const x = 7 * TILE + 16;
    const y = 19 * TILE;

    const mound = this.add.ellipse(x, y, TILE * 2.4, TILE * 1.6, COLORS.rockDark);
    mound.setDepth(7);
    const arch = this.add.rectangle(x, y + 8, TILE * 1.2, TILE, COLORS.black);
    arch.setDepth(8);
    const inner = this.add.ellipse(x, y - 2, TILE * 1.1, TILE * 0.9, COLORS.black);
    inner.setDepth(8);
    void arch;
    void inner;

    const sign = this.add
      .text(x, y + TILE, "CAVERN", {
        fontFamily: "Sprout Lands, monospace",
        fontSize: "11px",
        color: "#fbeec1",
        backgroundColor: "#4a3528",
        padding: { x: 4, y: 2 },
      })
      .setOrigin(0.5)
      .setDepth(20);
    void sign;

    const zone = this.add.zone(x, y, TILE * 1.2, TILE);
    this.physics.add.existing(zone, true);
    this.interactables.push({
      zone,
      prompt: "Enter cavern",
      onInteract: () => this.enterCaverns(),
    });
  }

  private enterCaverns() {
    if (this.inputFrozen) return;
    if (this.collectedCharms.has(PUZZLE_IDS.caverns)) {
      gameBus.emit("dialog:show", {
        speaker: "Teemo",
        lines: ["The cavern is empty now.", "I already have the Wave Charm."],
      });
      return;
    }
    gameBus.emit("scene:enter", { scene: "caverns" });
    this.cameras.main.fadeOut(300, 0, 0, 0);
    this.time.delayedCall(320, () => {
      this.scene.sleep();
      this.scene.run("CavernsScene");
    });
  }

  private placeShrine() {
    const baseX = 24 * TILE;
    const baseY = 19 * TILE;

    const platform = this.add.rectangle(
      baseX + TILE * 2,
      baseY,
      TILE * 5 + 16,
      TILE * 2 + 8,
      COLORS.shrineStone,
    );
    platform.setStrokeStyle(2, COLORS.shrineDark);
    platform.setDepth(3);

    const altar = this.add.rectangle(
      baseX + TILE * 2,
      baseY - 2,
      TILE * 1.6,
      TILE * 0.8,
      COLORS.shrineDark,
    );
    altar.setDepth(4);

    for (let i = 0; i < 4; i++) {
      const px = baseX + i * (TILE + 8) + 12;
      const py = baseY + 12;

      const pillar = this.add.rectangle(px, py, 18, 30, COLORS.shrineStone);
      pillar.setStrokeStyle(2, COLORS.shrineDark);
      pillar.setDepth(8);
      const top = this.add.rectangle(px, py - 18, 22, 6, COLORS.shrineDark);
      top.setDepth(9);
      void top;

      const symbolText = this.add
        .text(px, py - 4, SYMBOL_LABEL[this.shrineState[i]], {
          fontFamily: "Sprout Lands, monospace",
          fontSize: "16px",
          color: "#fbeec1",
        })
        .setOrigin(0.5)
        .setDepth(10);
      this.shrinePillars.push(symbolText);

      const body = this.add.rectangle(px, py, 22, 30, 0, 0);
      this.physics.add.existing(body, true);
      this.solids.add(body);

      const zone = this.add.zone(px, py + 22, TILE, TILE);
      this.physics.add.existing(zone, true);
      this.interactables.push({
        zone,
        prompt: `Cycle pillar ${i + 1}`,
        onInteract: () => this.cyclePillar(i),
      });
    }

    const hint = this.add
      .text(baseX + TILE * 2, baseY - 36, "Symbols remember what the cats teach you", {
        fontFamily: "Sprout Lands, monospace",
        fontSize: "10px",
        color: "#4a3528",
        backgroundColor: "#fbeec1",
        padding: { x: 4, y: 2 },
      })
      .setOrigin(0.5)
      .setDepth(20);
    void hint;
  }

  private cyclePillar(index: number) {
    if (this.collectedCharms.has(PUZZLE_IDS.shrine)) return;
    if (this.collectedCharms.size < 3) {
      gameBus.emit("dialog:show", {
        speaker: "Teemo",
        lines: [
          "The pillars feel cold...",
          "I should find more charms before tuning them.",
        ],
      });
      return;
    }
    const current = this.shrineState[index];
    const next = SHRINE_SYMBOLS[
      (SHRINE_SYMBOLS.indexOf(current) + 1) % SHRINE_SYMBOLS.length
    ];
    this.shrineState[index] = next;
    this.shrinePillars[index].setText(SYMBOL_LABEL[next]);
    this.cameras.main.flash(80, 240, 220, 180);

    const matches = this.shrineState.every((s, i) => s === SHRINE_TARGET[i]);
    if (matches) {
      this.time.delayedCall(220, () => {
        this.completePuzzle(PUZZLE_IDS.shrine);
      });
    }
  }

  private placeChest() {
    const x = MAP_W / 2;
    const y = MAP_H / 2 + TILE * 2;

    const c = this.add.container(x, y);
    const base = this.add.rectangle(0, 0, 28, 22, COLORS.bridge);
    base.setStrokeStyle(2, COLORS.bridgeDark);
    const lid = this.add.rectangle(0, -10, 28, 8, COLORS.bridgeDark);
    const lock = this.add.rectangle(0, -2, 6, 6, COLORS.starGold);
    lock.setStrokeStyle(1, COLORS.starShadow);
    c.add([base, lid, lock]);
    c.setDepth(20);
    this.chest = c;

    const body = this.add.rectangle(x, y, 28, 22, 0, 0);
    this.physics.add.existing(body, true);
    this.solids.add(body);

    const zone = this.add.zone(x, y + TILE, TILE * 2, TILE);
    this.physics.add.existing(zone, true);
    const interact: Interactable = {
      zone,
      prompt: "Inspect pedestal",
      onInteract: () => this.tryOpenChest(),
    };
    this.interactables.push(interact);
    this.chestInteractable = interact;
  }

  private refreshChestPrompt() {
    if (!this.chestInteractable) return;
    this.chestInteractable.prompt =
      this.collectedCharms.size >= PUZZLE_ORDER.length ? "Open chest" : "Inspect pedestal";
  }

  private tryOpenChest() {
    if (this.inputFrozen) return;
    if (this.chestOpened) {
      gameBus.emit("dialog:show", {
        speaker: "Teemo",
        lines: ["The Moonbell rings softly. The mystery is solved!"],
      });
      return;
    }
    if (this.collectedCharms.size < PUZZLE_ORDER.length) {
      gameBus.emit("dialog:show", {
        speaker: "Teemo",
        lines: [
          "This pedestal is sealed tight.",
          "Four charms must sing together before it opens.",
        ],
      });
      return;
    }
    if (this.lastRemainingMs <= 0) {
      gameBus.emit("dialog:show", {
        speaker: "Teemo",
        lines: ["The ocean took the island first… it's too late for this."],
      });
      return;
    }

    this.chestOpened = true;
    this.tweens.add({
      targets: this.chest,
      scale: 1.3,
      yoyo: true,
      duration: 220,
    });
    this.cameras.main.flash(280, 255, 240, 180);

    let stars = 1;
    if (this.lastRemainingMs >= STAR_2_REMAINING_MS) stars = 2;
    if (this.accusationCorrect && this.lastRemainingMs >= STAR_3_REMAINING_MS) stars = 3;

    gameBus.emit("dialog:show", {
      speaker: "Teemo",
      lines: [
        "The final mystery is solved!",
        "The chest opens with a bright glow…",
        "The scroll shows Gaurav Chaudhary's phone number!",
      ],
    });

    this.time.delayedCall(900, () => {
      gameBus.emit("mystery:solved", {
        reward: REWARD_PHONE_NUMBER,
        stars,
        remainingMsSnapshot: this.lastRemainingMs,
        accusedCorrectly: this.accusationCorrect,
      });
    });
  }

  private createCrateTexture() {
    if (this.textures.exists("crate")) return;
    const g = this.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(COLORS.bridge, 1);
    g.fillRect(0, 0, 24, 24);
    g.fillStyle(COLORS.bridgeDark, 1);
    g.fillRect(0, 0, 24, 2);
    g.fillRect(0, 22, 24, 2);
    g.fillRect(0, 0, 2, 24);
    g.fillRect(22, 0, 2, 24);
    g.fillRect(0, 11, 24, 2);
    g.fillRect(11, 0, 2, 24);
    g.generateTexture("crate", 24, 24);
    g.destroy();
  }

  private placeCrates() {
    const positions: Array<[number, number]> = [
      [14, 13],
      [21, 14],
      [16, 15],
    ];
    for (const [tx, ty] of positions) {
      const cx = tx * TILE + TILE / 2;
      const cy = ty * TILE + TILE / 2;
      const crate = this.crates.create(cx, cy, "crate") as Phaser.Physics.Arcade.Image;
      crate.setDepth(15);
      const body = crate.body as Phaser.Physics.Arcade.Body;
      body.setSize(22, 22);
      body.setBounce(0, 0);
      body.setDrag(900, 900);
    }
  }

  private placeNpcWanderers() {
    this.imposterKillGraceUntil = this.time.now + IMPOSTER_KILL_GRACE_MS;
    this.nextRandomKillCheckAt =
      this.imposterKillGraceUntil +
      Phaser.Math.Between(IMPOSTER_KILL_CHECK_MIN_MS, IMPOSTER_KILL_CHECK_MAX_MS);
    this.imposterName = Phaser.Utils.Array.GetRandom([...NPC_NAMES]);
    const npcProfiles = [
      { name: "Mimi" as const, frame: EMOJI_FRAMES.catOrange },
      { name: "Piko" as const, frame: EMOJI_FRAMES.catRed },
      { name: "Luna" as const, frame: EMOJI_FRAMES.catPurple },
      { name: "Nori" as const, frame: EMOJI_FRAMES.catBlue },
      { name: "Tomo" as const, frame: EMOJI_FRAMES.catGreen },
    ];
    for (const profile of npcProfiles) {
      const spawn = this.randomNpcPoint();
      const sprite = this.physics.add.sprite(
        spawn.x,
        spawn.y,
        ASSET_KEYS.emojiSheet,
        profile.frame,
      );
      sprite.setDepth(42);
      sprite.setSize(18, 14).setOffset(7, 16);
      sprite.setCollideWorldBounds(true);
      sprite.setBounce(0.02);
      sprite.setDrag(220, 220);
      const chatZone = this.add.zone(spawn.x, spawn.y, 36, 30);
      this.physics.add.existing(chatZone, true);

      this.physics.add.collider(sprite, this.solids);
      this.physics.add.collider(sprite, this.crates);
      this.physics.add.collider(sprite, this.player);

      const npc: NpcWanderer = {
        name: profile.name,
        sprite,
        chatZone,
        target: this.randomNpcPoint(),
        speed: Phaser.Math.Between(34, 52),
        nextRetargetAt: this.time.now + Phaser.Math.Between(2200, 4600),
        waitingUntil: this.time.now + Phaser.Math.Between(500, 1400),
        isWaiting: true,
      };
      this.npcs.push(npc);

      this.interactables.push({
        zone: chatZone,
        prompt: `Chat with ${profile.name}`,
        onInteract: () => this.chatWithNpc(npc),
      });
    }
  }

  private placeWhisperStone() {
    const x = 9 * TILE + 12;
    const y = 15 * TILE;
    const stone = this.add.circle(x, y, 14, COLORS.shrineDark, 0.92);
    stone.setStrokeStyle(3, COLORS.gem);
    stone.setDepth(11);
    this.add
      .text(x, y - 22, "◇", {
        fontFamily: "Sprout Lands, monospace",
        fontSize: "14px",
        color: "#fbeec1",
      })
      .setOrigin(0.5)
      .setDepth(12);

    const zone = this.add.zone(x, y, TILE * 1.5, TILE * 1.2);
    this.physics.add.existing(zone, true);
    const it: Interactable = {
      zone,
      prompt: "Touch the Whisper Stone",
      onInteract: () => {
        if (this.inputFrozen) return;
        if (this.accusationCorrect) {
          gameBus.emit("dialog:show", {
            speaker: "Teemo",
            lines: [
              "The stone has gone silent permanently.",
              "Its work is done. The liar was exposed.",
            ],
          });
          return;
        }
        if (this.accusationAttempts >= IslandScene.MAX_ACCUSATION_ATTEMPTS) {
          gameBus.emit("dialog:show", {
            speaker: "Teemo",
            lines: [
              "The Whisper Stone has gone silent permanently.",
              "I spent all 3 accusations and it will not answer again.",
            ],
          });
          return;
        }
        if (this.time.now < this.whisperStoneCooldownUntil) {
          const secsLeft = Math.ceil((this.whisperStoneCooldownUntil - this.time.now) / 1000);
          if (this.whisperInteractable) {
            this.whisperInteractable.prompt = `Whisper Stone: Silent for ${secsLeft}s`;
          }
          gameBus.emit("dialog:show", {
            speaker: "Teemo",
            lines: [
              `Wrong liar. The stone has gone silent for the next ${secsLeft} seconds.`,
              "Wait a bit, then accuse again.",
            ],
          });
          return;
        }
        if (this.whisperInteractable) {
          this.whisperInteractable.prompt = "Touch the Whisper Stone";
        }
        gameBus.emit("imposter:accuse-open", { names: [...NPC_NAMES] });
      },
    };
    this.interactables.push(it);
    this.whisperInteractable = it;
  }

  private handleAccusationPick(accusedName: string) {
    // Use scene systems activity check to avoid lifecycle races
    // where ScenePlugin can be null during teardown/remount.
    if (!this.sys?.isActive()) return;
    if (this.accusationCorrect) return;
    if (this.accusationAttempts >= IslandScene.MAX_ACCUSATION_ATTEMPTS) return;
    if (this.time.now < this.whisperStoneCooldownUntil) return;
    const correct = accusedName === this.imposterName;
    this.accusationCorrect = correct;
    if (correct) {
      this.accusationUsed = true;
      if (this.whisperInteractable) {
        this.whisperInteractable.prompt = "Whisper Stone: Liar exposed";
      }
      this.playerHp = Math.min(HP_MAX, this.playerHp + 1);
      gameBus.emit("hp:update", { current: this.playerHp, max: HP_MAX });
      gameBus.emit("pressure:bonus", { seconds: 45, reason: "Exposed the liar" });
      gameBus.emit("dialog:show", {
        speaker: "Teemo",
        lines: [
          `${accusedName} was the imposter!`,
          "The air feels lighter… and I earned a little more time.",
        ],
      });
      this.applyShrineShortcutIfEligible();
    } else {
      this.accusationAttempts += 1;
      this.playerHp -= 1;
      gameBus.emit("hp:update", { current: this.playerHp, max: HP_MAX });
      if (this.accusationAttempts >= IslandScene.MAX_ACCUSATION_ATTEMPTS) {
        this.accusationUsed = true;
        if (this.whisperInteractable) {
          this.whisperInteractable.prompt = "Whisper Stone: Silent permanently";
        }
        gameBus.emit("dialog:show", {
          speaker: "Teemo",
          lines: [
            `${accusedName} stares back, offended.`,
            "Wrong again. The Whisper Stone has gone silent for this run.",
          ],
        });
      } else {
        this.whisperStoneCooldownUntil = this.time.now + IslandScene.WHISPER_STONE_COOLDOWN_MS;
        if (this.whisperInteractable) {
          this.whisperInteractable.prompt = `Whisper Stone: Recharging (${IslandScene.WHISPER_STONE_COOLDOWN_MS / 1000}s)`;
        }
        gameBus.emit("dialog:show", {
          speaker: "Teemo",
          lines: [
            `${accusedName} stares back, offended.`,
            `Wrong liar. The stone has gone silent for the next ${IslandScene.WHISPER_STONE_COOLDOWN_MS / 1000} seconds.`,
            `${IslandScene.MAX_ACCUSATION_ATTEMPTS - this.accusationAttempts} accusations remain.`,
          ],
        });
      }
      if (this.playerHp <= 0) {
        gameBus.emit("game:lost", {
          cause: "wrong-accusation-hp",
          reason: "Wrong cat — Teemo ran out of heart to keep going.",
        });
        gameBus.emit("input:freeze", { frozen: true });
      }
    }
  }

  private applyShrineShortcutIfEligible() {
    if (this.collectedCharms.has(PUZZLE_IDS.shrine)) return;
    for (let i = 0; i < 4; i++) {
      this.shrineState[i] = SHRINE_TARGET[i];
      this.shrinePillars[i].setText(SYMBOL_LABEL[this.shrineState[i]]);
    }
    this.time.delayedCall(500, () => {
      if (!this.collectedCharms.has(PUZZLE_IDS.shrine)) {
        this.completePuzzle(PUZZLE_IDS.shrine);
      }
    });
  }

  private imposterContactCooldown = 0;

  private onImposterContactDamage() {
    if (this.inputFrozen || this.killSequenceStarted) return;
    if (this.accusationCorrect) return;
    if (this.time.now < this.imposterContactCooldown) return;
    this.imposterContactCooldown = this.time.now + 1400;
    this.killSequenceStarted = true;
    this.inputFrozen = true;
    gameBus.emit("input:freeze", { frozen: true });

    const imposter = this.npcs.find((n) => n.name === this.imposterName);
    this.player.setVelocity(0, 0);
    if (imposter?.sprite?.active) {
      imposter.sprite.setVelocity(0, 0);
      this.tweens.add({
        targets: imposter.sprite,
        scaleX: 1.28,
        scaleY: 0.72,
        duration: 120,
        yoyo: true,
        repeat: 1,
      });
    }

    this.playSfx(ASSET_KEYS.sfxCropPop, 0.6);
    this.tweens.add({
      targets: this.player,
      alpha: 0.3,
      duration: 320,
      yoyo: true,
      repeat: 1,
      ease: "sine.inOut",
    });
    this.cameras.main.shake(260, 0.016);
    this.cameras.main.flash(220, 255, 60, 60);

    this.time.delayedCall(360, () => {
      gameBus.emit("game:lost", {
        cause: "imposter-contact",
        reason: "The imposter stepped in and took Teemo out.",
      });
    });
  }

  private maybeTriggerRandomImposterKill() {
    if (!this.player?.active || !this.scene || !this.scene.isActive()) return;
    if (this.inputFrozen || this.killSequenceStarted || this.accusationCorrect) return;
    if (this.time.now < this.imposterKillGraceUntil) return;
    if (this.time.now < this.nextRandomKillCheckAt) return;

    this.nextRandomKillCheckAt =
      this.time.now +
      Phaser.Math.Between(IMPOSTER_KILL_CHECK_MIN_MS, IMPOSTER_KILL_CHECK_MAX_MS);
    const imposter = this.npcs.find((n) => n.name === this.imposterName);
    if (!imposter?.sprite?.active) return;

    const dist = Phaser.Math.Distance.Between(
      this.player.x,
      this.player.y,
      imposter.sprite.x,
      imposter.sprite.y,
    );
    if (dist > IMPOSTER_KILL_RANGE_PX) return;
    if (Phaser.Math.RND.frac() > IMPOSTER_KILL_CHANCE) return;
    this.onImposterContactDamage();
  }

  private randomNpcPoint() {
    return new Phaser.Math.Vector2(
      Phaser.Math.Between(3 * TILE, MAP_W - 3 * TILE),
      Phaser.Math.Between(3 * TILE, MAP_H - 3 * TILE),
    );
  }

  private chatWithNpc(npc: NpcWanderer) {
    if (this.inputFrozen) return;
    const paranoid =
      this.lastRemainingMs < PARANOIA_AT_REMAINING_MS &&
      npc.name !== this.imposterName;
    const gardenTopic = Phaser.Math.RND.frac() < 0.5;
    let line: string;
    if (npc.name === this.imposterName) {
      line = gardenTopic
        ? Phaser.Utils.Array.GetRandom([...GARDEN_LIES])
        : Phaser.Utils.Array.GetRandom([...SHRINE_LIES]);
    } else if (paranoid) {
      line = gardenTopic
        ? Phaser.Utils.Array.GetRandom([...GARDEN_TRUTH_PARANOID])
        : Phaser.Utils.Array.GetRandom([...SHRINE_TRUTH_PARANOID]);
    } else {
      line = gardenTopic
        ? Phaser.Utils.Array.GetRandom([...GARDEN_TRUTH])
        : Phaser.Utils.Array.GetRandom([...SHRINE_TRUTH]);
    }
    gameBus.emit("dialog:show", {
      speaker: npc.name,
      lines: [line, "Teemo listens closely."],
    });
  }

  private updateNpcWanderers() {
    for (const npc of this.npcs) {
      const s = npc.sprite;
      if (!s.active) continue;

      npc.chatZone.setPosition(s.x, s.y + 2);

      if (npc.isWaiting) {
        s.setVelocity(0, 0);
        if (this.time.now >= npc.waitingUntil) {
          npc.isWaiting = false;
          npc.target = this.randomNpcPoint();
          npc.nextRetargetAt = this.time.now + Phaser.Math.Between(2400, 5200);
        }
        continue;
      }

      const dist = Phaser.Math.Distance.Between(s.x, s.y, npc.target.x, npc.target.y);
      if (dist < 14 || this.time.now >= npc.nextRetargetAt) {
        npc.isWaiting = true;
        npc.waitingUntil = this.time.now + Phaser.Math.Between(800, 2400);
        s.setVelocity(0, 0);
        continue;
      }

      const angle = Phaser.Math.Angle.Between(s.x, s.y, npc.target.x, npc.target.y);
      const vx = Math.cos(angle) * npc.speed;
      const vy = Math.sin(angle) * npc.speed;
      s.setVelocity(vx, vy);

      if (vx < -1) s.setFlipX(false);
      else if (vx > 1) s.setFlipX(true);

      const bob = Math.sin((this.time.now + s.x * 2) / 180) * 0.03;
      s.setScale(1 + bob, 1 - bob);
    }
  }

  private makeHint() {
    const bg = this.add.rectangle(0, 0, 80, 18, COLORS.panelTan);
    bg.setStrokeStyle(2, COLORS.bridgeDark);
    const text = this.add
      .text(0, 0, "Press E", {
        fontFamily: "Sprout Lands, monospace",
        fontSize: "10px",
        color: "#4a3528",
      })
      .setOrigin(0.5);
    this.hintText = text;
    this.hint = this.add.container(0, 0, [bg, text]);
    this.hint.setDepth(80);
    this.hint.setVisible(false);
  }

  private updateNearestInteractable() {
    const px = this.player.x;
    const py = this.player.y;
    let best: Interactable | null = null;
    let bestDist = 48;
    for (const it of this.interactables) {
      const d = Phaser.Math.Distance.Between(px, py, it.zone.x, it.zone.y);
      if (d < bestDist) {
        best = it;
        bestDist = d;
      }
    }
    this.nearest = best;
    if (best) {
      this.hintText.setText(`E - ${best.prompt}`);
      this.hint.setPosition(this.player.x, this.player.y - 24);
      this.hint.setVisible(true);
      const bg = this.hint.getAt(0) as Phaser.GameObjects.Rectangle;
      bg.setSize(this.hintText.width + 12, this.hintText.height + 6);
    } else {
      this.hint.setVisible(false);
    }
  }

  private tryInteract() {
    if (this.inputFrozen) return;
    if (this.interactCooldown > this.time.now) return;
    if (!this.nearest) return;
    this.interactCooldown = this.time.now + 250;
    this.nearest.onInteract();
  }

  private completePuzzle(id: PuzzleId) {
    if (this.collectedCharms.has(id)) return;
    this.collectedCharms.add(id);
    const def = PUZZLES[id];
    gameBus.emit("charm:collected", {
      id,
      label: def.charmLabel,
      total: this.collectedCharms.size,
      needed: PUZZLE_ORDER.length,
    });
    gameBus.emit("dialog:show", { speaker: "Teemo", lines: def.solved });
    this.playSfx(ASSET_KEYS.sfxLevelClear, 0.35);

    if (this.collectedCharms.size === PUZZLE_ORDER.length) {
      gameBus.emit("objective:update", {
        text: "Open the central chest!",
      });
    } else {
      const next = PUZZLE_ORDER.find((p) => !this.collectedCharms.has(p));
      if (next) {
        gameBus.emit("objective:update", { text: PUZZLES[next].objective });
      }
    }
    this.refreshChestPrompt();
  }

  update() {
    if (!this.player) return;

    if (
      this.gardenCommitDeadline !== null &&
      !this.collectedCharms.has(PUZZLE_IDS.garden)
    ) {
      if (this.time.now >= this.gardenCommitDeadline) {
        this.failGardenCommitTimedOut();
      } else if (this.gardenBarFill?.visible) {
        const left = Math.max(0, this.gardenCommitDeadline - this.time.now);
        this.gardenBarFill.width = this.gardenBarMaxW * (left / GARDEN_COMMIT_MS);
      }
    }

    this.updateNpcWanderers();
    this.maybeTriggerRandomImposterKill();
    const canMove = !this.inputFrozen;
    const left =
      canMove &&
      (this.cursors.left?.isDown || this.wasd.A.isDown || this.virtualInput.left);
    const right =
      canMove &&
      (this.cursors.right?.isDown || this.wasd.D.isDown || this.virtualInput.right);
    const up =
      canMove &&
      (this.cursors.up?.isDown || this.wasd.W.isDown || this.virtualInput.up);
    const down =
      canMove &&
      (this.cursors.down?.isDown || this.wasd.S.isDown || this.virtualInput.down);

    let vx = 0;
    let vy = 0;
    if (left) vx -= 1;
    if (right) vx += 1;
    if (up) vy -= 1;
    if (down) vy += 1;
    if (vx !== 0 && vy !== 0) {
      vx *= Math.SQRT1_2;
      vy *= Math.SQRT1_2;
    }
    this.player.setVelocity(vx * PLAYER_SPEED, vy * PLAYER_SPEED);

    if (vx < 0) this.player.setFlipX(false);
    else if (vx > 0) this.player.setFlipX(true);

    const moving = vx !== 0 || vy !== 0;
    if (moving) {
      const bob = Math.sin(this.time.now / 80) * 0.06;
      this.player.setScale(1 + bob, 1 - bob);
    } else {
      this.player.setScale(1, 1);
    }

    if (canMove && (Phaser.Input.Keyboard.JustDown(this.wasd.E) || Phaser.Input.Keyboard.JustDown(this.wasd.SPACE))) {
      this.tryInteract();
    }

    this.updateNearestInteractable();
  }

  private playSfx(key: string, volume = 0.4) {
    try {
      if (!this.sound || !this.cache.audio.exists(key)) return;
      this.sound.play(key, { volume });
    } catch {
      // Ignore one-off audio lifecycle errors across sleep/wake transitions.
    }
  }
}
