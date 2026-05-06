import * as Phaser from "phaser";
import {
  COLORS,
  FLOOD_RISE_BACK_VX_MULT,
  FLOOD_RISE_BASE_PX,
  VIEW_H,
  VIEW_W,
} from "../constants";
import { ASSET_KEYS, EMOJI_FRAMES } from "../assets";
import { gameBus } from "../eventBus";

const CAVERN_W = VIEW_W;
const CAVERN_H = VIEW_H;

export class CavernsScene extends Phaser.Scene {
  private player!: Phaser.Physics.Arcade.Sprite;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Record<"W" | "A" | "S" | "D" | "E" | "SPACE", Phaser.Input.Keyboard.Key>;
  private platforms!: Phaser.Physics.Arcade.StaticGroup;
  private charm?: Phaser.GameObjects.Container;
  private collected = false;
  private exited = false;
  private virtualInput = { left: false, right: false, up: false, down: false };
  private virtualJumpRequested = false;
  private busUnsubs: Array<() => void> = [];
  private inputFrozen = false;
  private floodSurfaceY = CAVERN_H + 100;
  private floodGraphics!: Phaser.GameObjects.Graphics;
  private drowned = false;
  private sfxJump?: Phaser.Sound.BaseSound;

  constructor() {
    super("CavernsScene");
  }

  create() {
    this.physics.world.gravity.y = 600;
    this.physics.world.setBounds(0, 0, CAVERN_W, CAVERN_H);
    this.cameras.main.setBounds(0, 0, CAVERN_W, CAVERN_H);
    this.cameras.main.setBackgroundColor(0x1f1b2c);
    this.cameras.main.fadeIn(280, 0, 0, 0);

    const bg = this.add.graphics();
    bg.fillStyle(0x241f37, 1);
    bg.fillRect(0, 0, CAVERN_W, CAVERN_H);
    for (let i = 0; i < 140; i++) {
      const sx = Phaser.Math.Between(0, CAVERN_W);
      const sy = Phaser.Math.Between(0, CAVERN_H);
      bg.fillStyle(0x4b3f6e, 0.42);
      bg.fillCircle(sx, sy, Phaser.Math.Between(1, 2));
    }
    for (let i = 0; i < 24; i++) {
      const x = Phaser.Math.Between(28, CAVERN_W - 28);
      const y = Phaser.Math.Between(34, CAVERN_H - 34);
      const crystal = this.add.triangle(
        x,
        y,
        0,
        14,
        8,
        -8,
        -8,
        -8,
        Phaser.Math.Between(0x65d8ff, 0x8bd6ff),
      );
      crystal.setAlpha(0.65);
      crystal.setDepth(1);
      const glow = this.add.circle(x, y - 2, 8, 0x9cc9ff, 0.16);
      glow.setDepth(0);
    }

    this.platforms = this.physics.add.staticGroup();

    const ground = this.add.rectangle(
      CAVERN_W / 2,
      CAVERN_H - 16,
      CAVERN_W,
      32,
      COLORS.shrineDark,
    );
    ground.setStrokeStyle(2, COLORS.bridgeDark);
    this.physics.add.existing(ground, true);
    this.platforms.add(ground);

    const platSpecs: Array<[number, number, number]> = [
      [120, CAVERN_H - 98, 160],
      [300, CAVERN_H - 146, 140],
      [500, CAVERN_H - 194, 150],
      [260, CAVERN_H - 242, 130],
      [440, CAVERN_H - 290, 140],
      [220, CAVERN_H - 338, 130],
      [420, CAVERN_H - 386, 140],
      [430, CAVERN_H - 438, 130],
    ];
    for (const [x, y, w] of platSpecs) {
      const plat = this.add.rectangle(x, y, w, 16, COLORS.bridge);
      plat.setStrokeStyle(2, COLORS.bridgeDark);
      this.physics.add.existing(plat, true);
      this.platforms.add(plat);
    }

    this.player = this.physics.add.sprite(
      40,
      CAVERN_H - 64,
      ASSET_KEYS.emojiSheet,
      EMOJI_FRAMES.catYellow,
    );
    this.player.setDepth(22);
    this.player.setSize(18, 14).setOffset(7, 16);
    this.player.setCollideWorldBounds(true);
    this.player.setBounce(0.05);
    this.physics.add.collider(this.player, this.platforms);

    const charmContainer = this.add.container(430, CAVERN_H - 504);
    const halo = this.add.circle(0, 0, 14, 0xffe8a3, 0.6);
    const star = this.add.star(0, 0, 5, 4, 10, COLORS.starGold);
    star.setStrokeStyle(2, COLORS.starShadow);
    charmContainer.add([halo, star]);
    this.tweens.add({
      targets: charmContainer,
      y: CAVERN_H - 514,
      duration: 900,
      yoyo: true,
      repeat: -1,
      ease: "sine.inOut",
    });
    this.tweens.add({
      targets: halo,
      alpha: 0.2,
      duration: 700,
      yoyo: true,
      repeat: -1,
    });
    this.charm = charmContainer;

    this.floodGraphics = this.add.graphics();
    this.floodGraphics.setDepth(20);
    this.sfxJump = this.sound.add(ASSET_KEYS.sfxJump, { volume: 0.35 });

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
        if (state.up) this.virtualJumpRequested = true;
      }),
      gameBus.on("input:freeze", ({ frozen }) => {
        this.inputFrozen = frozen;
        if (frozen) {
          this.player.setVelocity(0, 0);
          this.virtualInput = { left: false, right: false, up: false, down: false };
        }
      }),
    );

    this.events.on(Phaser.Scenes.Events.SHUTDOWN, () => {
      for (const off of this.busUnsubs) off();
      this.busUnsubs = [];
    });

    gameBus.emit("dialog:show", {
      speaker: "Teemo",
      lines: [
        "The cavern echoes... cold water claws upward.",
        "Don't look back — moving backward riles the flood. Reach the WAVE CHARM!",
      ],
    });
    gameBus.emit("objective:update", {
      text: "Climb the cavern and grab the wave charm — before the water wins.",
    });
  }

  private exit(collected: boolean) {
    if (this.exited) return;
    this.exited = true;
    this.cameras.main.fadeOut(280, 0, 0, 0);
    this.time.delayedCall(300, () => {
      gameBus.emit("scene:return-from-caverns", { collected });
      gameBus.emit("scene:enter", { scene: "island" });
      this.scene.stop();
      this.scene.wake("IslandScene");
    });
  }

  private redrawFlood() {
    const g = this.floodGraphics;
    g.clear();
    const h = CAVERN_H - this.floodSurfaceY + 24;
    if (h <= 0) return;
    g.fillStyle(COLORS.water, 0.82);
    g.fillRect(0, this.floodSurfaceY, CAVERN_W, h);
    g.lineStyle(3, COLORS.waterDeep, 1);
    g.beginPath();
    const t = this.time.now / 420;
    for (let x = 0; x <= CAVERN_W; x += 12) {
      const wob = Math.sin(x * 0.035 + t) * 5;
      const y = this.floodSurfaceY + wob;
      if (x === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    g.strokePath();
  }

  private triggerDrown() {
    if (this.drowned || this.exited) return;
    this.drowned = true;
    gameBus.emit("game:lost", {
      cause: "flood",
      reason: "The cavern filled with water… Teemo never made it out.",
    });
    gameBus.emit("input:freeze", { frozen: true });
  }

  update() {
    if (!this.player || this.exited) return;

    const dt = this.game.loop.delta / 1000;

    if (!this.drowned && !this.collected) {
      const body = this.player.body as Phaser.Physics.Arcade.Body;
      const vx = body.velocity.x;
      const back = Math.max(0, -vx);
      const rise = (FLOOD_RISE_BASE_PX + back * FLOOD_RISE_BACK_VX_MULT) * dt;
      this.floodSurfaceY -= rise;
      this.redrawFlood();

      if (this.player.y + 8 > this.floodSurfaceY) {
        this.triggerDrown();
      }
    }

    if (this.drowned) {
      return;
    }

    const can = !this.inputFrozen;
    const left =
      can && (this.cursors.left?.isDown || this.wasd.A.isDown || this.virtualInput.left);
    const right =
      can && (this.cursors.right?.isDown || this.wasd.D.isDown || this.virtualInput.right);
    const jumpPressed =
      can &&
      (Phaser.Input.Keyboard.JustDown(this.cursors.up!) ||
        Phaser.Input.Keyboard.JustDown(this.wasd.W) ||
        Phaser.Input.Keyboard.JustDown(this.wasd.SPACE) ||
        this.virtualJumpRequested);
    this.virtualJumpRequested = false;

    const body = this.player.body as Phaser.Physics.Arcade.Body;
    const onGround = body.blocked.down || body.touching.down;

    if (left) {
      this.player.setVelocityX(-180);
      this.player.setFlipX(false);
    } else if (right) {
      this.player.setVelocityX(180);
      this.player.setFlipX(true);
    } else {
      this.player.setVelocityX(0);
    }

    if (jumpPressed && onGround) {
      this.player.setVelocityY(-340);
      this.sfxJump?.play();
    }

    if (this.charm && !this.collected) {
      const d = Phaser.Math.Distance.Between(
        this.player.x,
        this.player.y,
        this.charm.x,
        this.charm.y,
      );
      if (d < 22) {
        this.collected = true;
        this.tweens.add({
          targets: this.charm,
          alpha: 0,
          scale: 2,
          duration: 220,
          onComplete: () => this.charm?.destroy(),
        });
        this.cameras.main.flash(220, 255, 240, 180);
        this.time.delayedCall(420, () => this.exit(true));
      }
    }

    if (this.player.y > CAVERN_H + 40) {
      this.player.setPosition(40, CAVERN_H - 64);
      this.player.setVelocity(0, 0);
    }
  }
}
