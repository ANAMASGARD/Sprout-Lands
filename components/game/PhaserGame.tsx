"use client";

import { useEffect, useRef } from "react";
import { VIEW_W, VIEW_H } from "@/lib/game/constants";

export default function PhaserGame() {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<unknown>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const Phaser = (await import("phaser")).default;
      const { BootScene } = await import("@/lib/game/scenes/BootScene");
      const { IslandScene } = await import("@/lib/game/scenes/IslandScene");
      const { CavernsScene } = await import("@/lib/game/scenes/CavernsScene");

      if (cancelled || !containerRef.current) return;

      const game = new Phaser.Game({
        type: Phaser.AUTO,
        parent: containerRef.current,
        width: VIEW_W,
        height: VIEW_H,
        backgroundColor: "#a6d8d3",
        pixelArt: true,
        antialias: false,
        roundPixels: true,
        scale: {
          mode: Phaser.Scale.FIT,
          autoCenter: Phaser.Scale.CENTER_BOTH,
        },
        physics: {
          default: "arcade",
          arcade: {
            gravity: { x: 0, y: 0 },
            debug: false,
          },
        },
        scene: [BootScene, IslandScene, CavernsScene],
      });

      gameRef.current = game;
    })();

    return () => {
      cancelled = true;
      const g = gameRef.current as { destroy: (removeCanvas: boolean) => void } | null;
      if (g) {
        g.destroy(true);
        gameRef.current = null;
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 flex items-center justify-center"
      aria-label="Sprout Mystery Game canvas"
    />
  );
}
