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
  type PuzzleId,
} from "../constants";
import { ASSET_KEYS, EMOJI_FRAMES } from "../assets";
import { gameBus } from "../eventBus";
import { PUZZLES } from "../puzzles";

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

const CROP_ORDER = [0, 1, 2, 3];
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
    this.placeCottage();
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
    this.placeCrates();

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

    gameBus.emit("hp:update", { current: 3, max: 3 });
    gameBus.emit("objective:update", {
      text: "Start the quest: find Gaurav Chaudhary's number.",
    });
    gameBus.emit("dialog:show", {
      speaker: "Teemo",
      lines: [
        "Mrow... a secret quest has begun!",
        "I need to find Gaurav Chaudhary's phone number.",
        "To reveal it, I must solve FOUR mystery puzzles.",
        "Use Arrows or WASD to walk. Press E to interact.",
      ],
    });

    this.busUnsubs.push(
      gameBus.on("input:virtual", (state) => {
        this.virtualInput = state;
      }),
      gameBus.on("input:interact", () => {
        this.tryInteract();
      }),
      gameBus.on("scene:return-from-caverns", ({ collected }) => {
        if (collected) {
          this.completePuzzle(PUZZLE_IDS.caverns);
        }
      }),
    );

    this.events.on(Phaser.Scenes.Events.WAKE, () => {
      this.cameras.main.fadeIn(300, 0, 0, 0);
    });

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

  private placeCottage() {
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
      .text(baseX, baseY + 56, "DIARY", {
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
      prompt: "Read diary",
      onInteract: () => this.runCottagePuzzle(),
    });
  }

  private runCottagePuzzle() {
    if (this.collectedCharms.has(PUZZLE_IDS.cottage)) {
      gameBus.emit("dialog:show", {
        speaker: "Teemo",
        lines: ["I already have the Sun Charm.", "It hums softly..."],
      });
      return;
    }
    const def = PUZZLES[PUZZLE_IDS.cottage];
    gameBus.emit("dialog:show", { speaker: "Teemo", lines: def.intro });
    this.time.delayedCall(400, () => {
      this.completePuzzle(PUZZLE_IDS.cottage);
    });
  }

  private placeGarden() {
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

    const labels = ["TINY", "SHORT", "TALL", "BLOOM"];
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
      .text(startX + TILE * 2, y - 28, "Step in order: TINY → SHORT → TALL → BLOOM", {
        fontFamily: "Sprout Lands, monospace",
        fontSize: "10px",
        color: "#4a3528",
        backgroundColor: "#fbeec1",
        padding: { x: 4, y: 2 },
      })
      .setOrigin(0.5, 1)
      .setDepth(20);
  }

  private onCropTileEntered(tile: CropTile) {
    if (this.collectedCharms.has(PUZZLE_IDS.garden)) return;
    if (tile.activated) return;

    if (tile.index === CROP_ORDER[this.cropProgress]) {
      tile.activated = true;
      tile.rect.setFillStyle(COLORS.starGold);
      this.cropProgress++;
      this.cameras.main.flash(120, 250, 230, 200);
      if (this.cropProgress === CROP_ORDER.length) {
        this.cropResetText.setText("The crops harmonize!");
        this.time.delayedCall(400, () => {
          this.completePuzzle(PUZZLE_IDS.garden);
        });
      }
    } else {
      this.cameras.main.shake(120, 0.005);
      this.cropProgress = 0;
      for (const t of this.cropTiles) {
        t.activated = false;
        t.rect.setFillStyle(COLORS.cropGrowing);
      }
      this.cropResetText.setText("Order broken. Restart from TINY.");
    }
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
      .text(baseX + TILE * 2, baseY - 36, "Match the order Teemo learned", {
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
    this.interactables.push({
      zone,
      prompt: "Open chest",
      onInteract: () => this.tryOpenChest(),
    });
  }

  private tryOpenChest() {
    if (this.chestOpened) {
      gameBus.emit("dialog:show", {
        speaker: "Teemo",
        lines: ["The Moonbell rings softly. The mystery is solved!"],
      });
      return;
    }
    if (this.collectedCharms.size < PUZZLE_ORDER.length) {
      const remaining = PUZZLE_ORDER.filter(
        (id) => !this.collectedCharms.has(id),
      ).map((id) => PUZZLES[id].charmLabel);
      gameBus.emit("dialog:show", {
        speaker: "Teemo",
        lines: [
          "The chest is sealed by four charms.",
          `Still missing: ${remaining.join(", ")}.`,
        ],
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

    gameBus.emit("dialog:show", {
      speaker: "Teemo",
      lines: [
        "The final mystery is solved!",
        "The chest opens with a bright glow...",
        "The scroll shows Gaurav Chaudhary's phone number!",
      ],
    });

    this.time.delayedCall(900, () => {
      gameBus.emit("mystery:solved", { reward: REWARD_PHONE_NUMBER });
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
  }

  update() {
    if (!this.player) return;
    const left =
      this.cursors.left?.isDown || this.wasd.A.isDown || this.virtualInput.left;
    const right =
      this.cursors.right?.isDown || this.wasd.D.isDown || this.virtualInput.right;
    const up =
      this.cursors.up?.isDown || this.wasd.W.isDown || this.virtualInput.up;
    const down =
      this.cursors.down?.isDown || this.wasd.S.isDown || this.virtualInput.down;

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

    if (Phaser.Input.Keyboard.JustDown(this.wasd.E) || Phaser.Input.Keyboard.JustDown(this.wasd.SPACE)) {
      this.tryInteract();
    }

    this.updateNearestInteractable();
  }
}
