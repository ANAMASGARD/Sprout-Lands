import * as Phaser from "phaser";
import { COLORS, VIEW_H, VIEW_W } from "../constants";
import { ASSET_KEYS, EMOJI_FRAMES } from "../assets";
import { gameBus } from "../eventBus";
import { PUZZLES } from "../puzzles";

type RuneNode = {
  id: number;
  word: string;
  x: number;
  y: number;
  frame: Phaser.GameObjects.Rectangle;
  glow: Phaser.GameObjects.Ellipse;
  label: Phaser.GameObjects.Text;
};

type Interactable = {
  zone: Phaser.GameObjects.Zone;
  prompt: string;
  onInteract: () => void;
};

const RUNE_WORDS = ["SUN", "LEAF", "MOON", "WAVE", "STAR", "BELL"] as const;
const TARGET_SEQUENCE = [0, 3, 2, 5];

export class LibraryScene extends Phaser.Scene {
  private player!: Phaser.Physics.Arcade.Sprite;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Record<"W" | "A" | "S" | "D" | "E" | "SPACE", Phaser.Input.Keyboard.Key>;
  private hint!: Phaser.GameObjects.Container;
  private hintText!: Phaser.GameObjects.Text;
  private interactables: Interactable[] = [];
  private nearest: Interactable | null = null;
  private virtualInput = { left: false, right: false, up: false, down: false };
  private busUnsubs: Array<() => void> = [];
  private solvedAlready = false;
  private solvedNow = false;
  private exiting = false;
  private runeNodes: RuneNode[] = [];
  private inputProgress = 0;
  private mistakes = 0;
  private locked = false;
  private statusText!: Phaser.GameObjects.Text;
  private sequenceText!: Phaser.GameObjects.Text;

  constructor() {
    super("LibraryScene");
  }

  init(data: { solved?: boolean }) {
    this.solvedAlready = Boolean(data?.solved);
    this.solvedNow = false;
    this.exiting = false;
  }

  create() {
    this.physics.world.setBounds(0, 0, VIEW_W, VIEW_H);
    this.cameras.main.setBounds(0, 0, VIEW_W, VIEW_H);
    this.cameras.main.setBackgroundColor(0x3a2d22);
    this.cameras.main.fadeIn(260, 0, 0, 0);

    this.paintRoom();
    this.paintLibraryUiFrame();
    this.placeRunePuzzle();
    this.makeHint();

    this.player = this.physics.add.sprite(120, VIEW_H - 96, ASSET_KEYS.emojiSheet, EMOJI_FRAMES.catYellow);
    this.player.setDepth(30);
    this.player.setSize(18, 14).setOffset(7, 16);
    this.player.setCollideWorldBounds(true);

    this.cursors = this.input.keyboard!.createCursorKeys();
    this.wasd = this.input.keyboard!.addKeys({
      W: Phaser.Input.Keyboard.KeyCodes.W,
      A: Phaser.Input.Keyboard.KeyCodes.A,
      S: Phaser.Input.Keyboard.KeyCodes.S,
      D: Phaser.Input.Keyboard.KeyCodes.D,
      E: Phaser.Input.Keyboard.KeyCodes.E,
      SPACE: Phaser.Input.Keyboard.KeyCodes.SPACE,
    }) as Record<"W" | "A" | "S" | "D" | "E" | "SPACE", Phaser.Input.Keyboard.Key>;

    this.busUnsubs.push(
      gameBus.on("input:virtual", (state) => {
        this.virtualInput = state;
      }),
      gameBus.on("input:interact", () => {
        this.tryInteract();
      }),
    );

    this.events.on(Phaser.Scenes.Events.SHUTDOWN, () => {
      for (const off of this.busUnsubs) off();
      this.busUnsubs = [];
    });

    if (this.solvedAlready) {
      gameBus.emit("dialog:show", {
        speaker: "Librarian Owl",
        lines: [
          "Welcome back, Teemo.",
          "You already solved the Memory Codex.",
          "Press E near the door to return outside.",
        ],
      });
      gameBus.emit("objective:update", { text: "Continue the mystery on the island" });
      this.statusText.setText("Puzzle solved. Exit whenever you are ready.");
      this.sequenceText.setText("Solved sequence: SUN -> WAVE -> MOON -> BELL");
    } else {
      const intro = PUZZLES.cottage.intro;
      gameBus.emit("dialog:show", { speaker: "Librarian Owl", lines: intro });
      gameBus.emit("objective:update", {
        text: "Solve the memory codex in the library",
      });
      this.statusText.setText("Memorize and repeat the rune word sequence.");
      this.sequenceText.setText("Sequence preview begins in 1 second...");
      this.time.delayedCall(1000, () => this.playSequenceShowcase());
    }
  }

  private paintRoom() {
    const g = this.add.graphics();
    g.fillStyle(0x5b4430, 1);
    g.fillRect(0, 0, VIEW_W, VIEW_H);
    g.fillStyle(0x7a5a3c, 1);
    g.fillRect(0, VIEW_H - 120, VIEW_W, 120);
    g.fillStyle(0x2f2218, 1);
    g.fillRect(0, 0, VIEW_W, 58);
    g.setDepth(0);

    this.add
      .text(VIEW_W / 2, 30, "TEEMO LIBRARY", {
        fontFamily: "Sprout Lands, monospace",
        fontSize: "15px",
        color: "#fbeec1",
      })
      .setOrigin(0.5)
      .setDepth(4);
  }

  private paintLibraryUiFrame() {
    const panel = this.add.image(VIEW_W / 2, 84, ASSET_KEYS.dialogMedium);
    panel.setDisplaySize(470, 116);
    panel.setDepth(2);

    this.add
      .text(VIEW_W / 2, 56, "Library Memory Codex", {
        fontFamily: "Sprout Lands, monospace",
        fontSize: "12px",
        color: "#4a3528",
      })
      .setOrigin(0.5)
      .setDepth(3);

    this.sequenceText = this.add
      .text(VIEW_W / 2, 76, "", {
        fontFamily: "Sprout Lands, monospace",
        fontSize: "10px",
        color: "#4a3528",
      })
      .setOrigin(0.5)
      .setDepth(3);
    this.statusText = this.add
      .text(VIEW_W / 2, 98, "", {
        fontFamily: "Sprout Lands, monospace",
        fontSize: "10px",
        color: "#4a3528",
      })
      .setOrigin(0.5)
      .setDepth(3);
  }

  private placeRunePuzzle() {
    const doorZone = this.add.zone(74, VIEW_H - 88, 86, 96);
    this.physics.add.existing(doorZone, true);
    this.interactables.push({
      zone: doorZone,
      prompt: "Exit library",
      onInteract: () => this.exit(this.solvedNow),
    });

    this.add.rectangle(74, VIEW_H - 88, 68, 92, 0x2c1b13).setStrokeStyle(3, 0xc4ac7a).setDepth(2);
    this.add
      .text(74, VIEW_H - 44, "EXIT", {
        fontFamily: "Sprout Lands, monospace",
        fontSize: "10px",
        color: "#fbeec1",
      })
      .setOrigin(0.5)
      .setDepth(3);

    const points: Array<[number, number]> = [
      [190, 218],
      [350, 182],
      [510, 218],
      [670, 182],
      [290, 298],
      [590, 298],
    ];

    for (let i = 0; i < RUNE_WORDS.length; i++) {
      const [x, y] = points[i];
      const glow = this.add.ellipse(x, y + 4, 116, 74, 0xf3c44a, 0.05).setDepth(1);
      const frame = this.add
        .rectangle(x, y, 108, 66, 0x6d4e33)
        .setStrokeStyle(2, 0xc4ac7a)
        .setDepth(2);
      this.add.rectangle(x, y + 16, 86, 10, 0xc89b6c).setDepth(3);
      const label = this.add
        .text(x, y - 4, RUNE_WORDS[i], {
          fontFamily: "Sprout Lands, monospace",
          fontSize: "15px",
          color: "#fbeec1",
        })
        .setOrigin(0.5)
        .setDepth(4);

      const node: RuneNode = {
        id: i,
        word: RUNE_WORDS[i],
        x,
        y,
        frame,
        glow,
        label,
      };
      this.runeNodes.push(node);

      const zone = this.add.zone(x, y, 116, 74);
      this.physics.add.existing(zone, true);
      this.interactables.push({
        zone,
        prompt: `Touch rune ${RUNE_WORDS[i]}`,
        onInteract: () => this.selectRune(node),
      });
    }
  }

  private playSequenceShowcase() {
    if (this.solvedAlready || this.solvedNow || this.exiting) return;
    this.locked = true;
    this.inputProgress = 0;
    this.statusText.setText("Watch carefully...");

    TARGET_SEQUENCE.forEach((runeId, idx) => {
      this.time.delayedCall(340 + idx * 540, () => {
        const node = this.runeNodes[runeId];
        if (!node) return;
        node.frame.setFillStyle(0x94795a);
        node.glow.setFillStyle(0xf3c44a, 0.3);
        node.label.setColor("#fff7d6");
        this.tweens.add({
          targets: node.glow,
          alpha: { from: 0.35, to: 0.08 },
          duration: 260,
          yoyo: true,
        });
        this.time.delayedCall(260, () => {
          node.frame.setFillStyle(0x6d4e33);
          node.glow.setFillStyle(0xf3c44a, 0.05);
          node.label.setColor("#fbeec1");
        });
      });
    });

    this.time.delayedCall(340 + TARGET_SEQUENCE.length * 540, () => {
      this.locked = false;
      this.statusText.setText("Now repeat it: SUN -> WAVE -> MOON -> BELL");
      this.sequenceText.setText("Progress: 0 / 4");
    });
  }

  private selectRune(node: RuneNode) {
    if (this.solvedAlready || this.solvedNow) {
      gameBus.emit("dialog:show", {
        speaker: "Teemo",
        lines: ["The Memory Codex is solved.", "I should continue the mystery outside."],
      });
      return;
    }
    if (this.locked) {
      gameBus.emit("dialog:show", {
        speaker: "Librarian Owl",
        lines: ["Patience, Teemo.", "Watch the sequence first, then repeat it."],
      });
      return;
    }

    const targetRune = TARGET_SEQUENCE[this.inputProgress];
    const success = node.id === targetRune;

    node.frame.setFillStyle(success ? 0x9a845f : 0x8d5050);
    this.time.delayedCall(150, () => {
      node.frame.setFillStyle(0x6d4e33);
    });

    if (success) {
      this.inputProgress += 1;
      this.sequenceText.setText(`Progress: ${this.inputProgress} / ${TARGET_SEQUENCE.length}`);
      this.cameras.main.flash(80, 240, 225, 180);
      if (this.inputProgress < TARGET_SEQUENCE.length) {
        this.statusText.setText("Good! Keep going...");
        return;
      }

      this.solvedNow = true;
      this.cameras.main.flash(260, 255, 230, 170);
      gameBus.emit("dialog:show", {
        speaker: "Teemo",
        lines: [
          "I completed the Memory Codex!",
          "The runes spell the clue: 'Follow the SUN first.'",
          "A Sun Charm rises from the glowing shelf!",
        ],
      });
      this.statusText.setText("Perfect sequence! Puzzle complete.");
      this.sequenceText.setText("Solved: SUN -> WAVE -> MOON -> BELL");
      gameBus.emit("objective:update", { text: "Exit the library and continue your quest" });
      this.time.delayedCall(1100, () => this.exit(true));
      return;
    }

    this.mistakes += 1;
    this.inputProgress = 0;
    this.sequenceText.setText("Progress: 0 / 4");
    this.statusText.setText(`Wrong order! Mistakes: ${this.mistakes}. Watch again.`);
    this.cameras.main.shake(150, 0.006);
    gameBus.emit("dialog:show", {
      speaker: "Librarian Owl",
      lines: [
        "The runes reject that order.",
        "Remember the sequence from the codex lights.",
      ],
    });
    this.time.delayedCall(700, () => this.playSequenceShowcase());
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
    let bestDist = 54;
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
    if (!this.nearest || this.exiting || this.locked) return;
    this.nearest.onInteract();
  }

  private exit(collected: boolean) {
    if (this.exiting) return;
    this.exiting = true;
    this.cameras.main.fadeOut(280, 0, 0, 0);
    this.time.delayedCall(300, () => {
      gameBus.emit("scene:return-from-library", { collected });
      gameBus.emit("scene:enter", { scene: "island" });
      this.scene.stop();
      this.scene.wake("IslandScene");
    });
  }

  update() {
    if (!this.player || this.exiting) return;

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
    this.player.setVelocity(vx * 150, vy * 150);

    if (vx < 0) this.player.setFlipX(false);
    else if (vx > 0) this.player.setFlipX(true);

    if (Phaser.Input.Keyboard.JustDown(this.wasd.E) || Phaser.Input.Keyboard.JustDown(this.wasd.SPACE)) {
      this.tryInteract();
    }

    this.updateNearestInteractable();
  }
}
