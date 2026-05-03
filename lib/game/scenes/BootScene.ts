import * as Phaser from "phaser";
import { ASSET_KEYS, ASSET_PATHS } from "../assets";

export class BootScene extends Phaser.Scene {
  constructor() {
    super("BootScene");
  }

  preload() {
    const { load } = this;

    load.spritesheet(ASSET_KEYS.emojiSheet, ASSET_PATHS.emoji_sheet, {
      frameWidth: 32,
      frameHeight: 32,
    });
    load.spritesheet(ASSET_KEYS.teemoEmotes, ASSET_PATHS.teemo_emotes, {
      frameWidth: 32,
      frameHeight: 32,
    });
    load.spritesheet(ASSET_KEYS.specialIcons, ASSET_PATHS.special_icons, {
      frameWidth: 16,
      frameHeight: 16,
    });
    load.spritesheet(ASSET_KEYS.allIcons, ASSET_PATHS.all_icons, {
      frameWidth: 16,
      frameHeight: 16,
    });
    load.spritesheet(ASSET_KEYS.whiteIcons, ASSET_PATHS.white_icons, {
      frameWidth: 16,
      frameHeight: 16,
    });
    load.spritesheet(ASSET_KEYS.weatherIcons, ASSET_PATHS.weather_icons, {
      frameWidth: 16,
      frameHeight: 16,
    });
    load.spritesheet(ASSET_KEYS.squareButtons, ASSET_PATHS.square_buttons, {
      frameWidth: 48,
      frameHeight: 48,
    });

    load.image(ASSET_KEYS.basicPack, ASSET_PATHS.basic_pack);
    load.image(ASSET_KEYS.dialogBig, ASSET_PATHS.dialog_big);
    load.image(ASSET_KEYS.dialogMedium, ASSET_PATHS.dialog_medium);
    load.image(ASSET_KEYS.dialogSmall, ASSET_PATHS.dialog_small);
    load.image(ASSET_KEYS.speechBubble, ASSET_PATHS.speech_bubble);
    load.image(ASSET_KEYS.inventory, ASSET_PATHS.inventory);
    load.image(ASSET_KEYS.hearts, ASSET_PATHS.hearts);
    load.image(ASSET_KEYS.inventoryBlocks, ASSET_PATHS.inventory_blocks);
    load.image(ASSET_KEYS.playButton, ASSET_PATHS.play_button);
    load.image(ASSET_KEYS.settingsMenu, ASSET_PATHS.settings_menu);
    load.image(ASSET_KEYS.settingsButtons, ASSET_PATHS.settings_buttons);
    load.image(
      ASSET_KEYS.smallSquareButtons,
      ASSET_PATHS.small_square_buttons,
    );
  }

  create() {
    this.scene.start("IslandScene");
  }
}
