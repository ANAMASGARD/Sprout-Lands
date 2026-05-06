"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";
import { RUN_DURATION_MS } from "@/lib/game/constants";
import { ASSET_PATHS } from "@/lib/game/assets";
import type { GameLostCause } from "@/lib/game/eventBus";
import { gameBus } from "@/lib/game/eventBus";
import DialogOverlay from "./DialogOverlay";
import GameOverOverlay from "./GameOverOverlay";
import HudOverlay from "./HudOverlay";
import ImposterTrialOverlay from "./ImposterTrialOverlay";
import MysterySolved from "./MysterySolved";
import MobileControls from "./MobileControls";
import MusicControls from "./MusicControls";

/*
 * Reset contract (runKey / RunTimer / React overlays)
 * | State              | Lives in           | runKey remount? | Explicit reset?                    |
 * |--------------------|--------------------|-----------------|------------------------------------|
 * | Charms, shrine…    | IslandScene        | Yes             | No                                 |
 * | Imposter RNG       | IslandScene        | Yes             | No                                 |
 * | accusationUsed     | IslandScene        | Yes             | No                                 |
 * | remainingMs        | RunTimer (React)   | No              | Set on run:started                 |
 * | HP display         | HudOverlay         | No              | hp:update on island create         |
 * | GameOver visible   | GameShell          | No              | Clear before remount / on run:started |
 * | Trial open         | ImposterTrialOverlay | No           | Close on run:started               |
 */

const PhaserGame = dynamic(() => import("./PhaserGame"), { ssr: false });

export default function GameShell() {
  const [started, setStarted] = useState(false);
  const [runKey, setRunKey] = useState(0);
  const [activeScene, setActiveScene] = useState<"island" | "caverns" | "library">(
    "island",
  );
  const [gameOver, setGameOver] = useState<{
    cause: GameLostCause;
    reason: string;
  } | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (
        ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " ", "Space"].includes(
          e.key,
        )
      ) {
        e.preventDefault();
      }
    }
    window.addEventListener("keydown", onKey, { passive: false });
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const off = gameBus.on("scene:enter", ({ scene }) => {
      setActiveScene(scene);
    });
    return () => off();
  }, []);

  /** Global pressure timer (survives IslandScene sleep). */
  useEffect(() => {
    let remainingMs = RUN_DURATION_MS;
    let tickInterval: ReturnType<typeof setInterval> | undefined;
    let running = false;

    const emitTick = () => {
      gameBus.emit("timer:tick", {
        remainingMs,
        remainingSeconds: Math.max(0, Math.ceil(remainingMs / 1000)),
      });
    };

    const stopTicks = () => {
      running = false;
      if (tickInterval !== undefined) {
        clearInterval(tickInterval);
        tickInterval = undefined;
      }
    };

    const fireTimeoutLoss = () => {
      stopTicks();
      gameBus.emit("game:lost", {
        cause: "timeout",
        reason:
          "The waves swallowed the island… It’s gone. You’ll have to try again.",
      });
      gameBus.emit("run:stopped", { outcome: "lose" });
      gameBus.emit("input:freeze", { frozen: true });
    };

    const unsubStart = gameBus.on("run:started", ({ durationMs }) => {
      stopTicks();
      remainingMs = durationMs;
      running = true;
      emitTick();
      tickInterval = setInterval(() => {
        if (!running) return;
        remainingMs = Math.max(0, remainingMs - 250);
        emitTick();
        if (remainingMs <= 0) {
          fireTimeoutLoss();
        }
      }, 250);
    });

    const unsubPenalty = gameBus.on("pressure:penalty", ({ seconds }) => {
      if (!running && remainingMs <= 0) return;
      remainingMs = Math.max(0, remainingMs - seconds * 1000);
      emitTick();
      if (running && remainingMs <= 0) {
        fireTimeoutLoss();
      }
    });

    const unsubBonus = gameBus.on("pressure:bonus", ({ seconds }) => {
      remainingMs += seconds * 1000;
      emitTick();
    });

    const unsubWin = gameBus.on("mystery:solved", () => {
      stopTicks();
      gameBus.emit("run:stopped", { outcome: "win" });
    });

    const unsubLost = gameBus.on("game:lost", () => {
      stopTicks();
    });

    const unsubStopped = gameBus.on("run:stopped", ({ outcome }) => {
      if (outcome === "lose" || outcome === "restart") {
        stopTicks();
      }
    });

    return () => {
      stopTicks();
      unsubStart();
      unsubPenalty();
      unsubBonus();
      unsubWin();
      unsubLost();
      unsubStopped();
    };
  }, []);

  useEffect(() => {
    const off = gameBus.on("game:lost", ({ cause, reason }) => {
      setGameOver({ cause, reason });
      if (cause === "timeout" || cause === "imposter-contact") {
        try {
          const audio = new Audio(ASSET_PATHS.sfx_lose);
          audio.volume = 0.55;
          void audio.play();
        } catch {
          // Ignore autoplay restrictions and continue rendering game-over UI.
        }
      }
    });
    return () => off();
  }, []);

  const handleRetry = useCallback(() => {
    setGameOver(null);
    gameBus.emit("input:freeze", { frozen: false });
    gameBus.emit("run:stopped", { outcome: "restart" });
    setRunKey((k) => k + 1);
  }, []);

  return (
    <div
      className={`relative h-dvh w-full overflow-hidden ${
        activeScene === "caverns"
          ? "bg-[#1f1b2c]"
          : activeScene === "library"
            ? "bg-[#3a2d22]"
            : "bg-[#a6d8d3]"
      }`}
    >
      {!started ? (
        <TitleScreen onStart={() => setStarted(true)} />
      ) : (
        <>
          <PhaserGame key={runKey} />
          <HudOverlay />
          <MusicControls enabled={started} />
          <DialogOverlay />
          <ImposterTrialOverlay />
          <MobileControls />
          <MysterySolved />
          <GameOverOverlay
            cause={gameOver?.cause ?? null}
            reason={gameOver?.reason ?? ""}
            onRetry={handleRetry}
          />
        </>
      )}
    </div>
  );
}

function TitleScreen({ onStart }: { onStart: () => void }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-b from-[#cdeac1] via-[#a6d8d3] to-[#7ab8b1] p-4">
      <div className="pixel-panel relative w-[min(92vw,560px)] px-8 py-10 text-center font-pixel text-[#4a3528]">
        <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-[#9c7c54] px-5 py-1 text-xs font-bold uppercase tracking-widest text-[#fbeec1]">
          Sprout Lands
        </div>

        <h1 className="mb-2 text-3xl font-bold uppercase tracking-wider">
          Number Mystery Quest
        </h1>
        <p className="mb-1 text-sm">OinkJam — Under Pressure + Imposter</p>

        <div className="my-6 flex items-center justify-center gap-2 text-3xl">
          <span title="Sun Charm">☀</span>
          <span title="Leaf Charm">🌿</span>
          <span title="Wave Charm">≈</span>
          <span title="Moon Charm">☾</span>
        </div>

        <p className="mb-6 px-2 text-sm leading-relaxed">
          Beat the clock, collect four charms, and open the chest. One of the
          island cats is lying — use the Whisper Stone to accuse them once per
          run. The cavern floods; the imposter may hunt you when time runs low.
        </p>

        <div className="mb-6 grid grid-cols-2 gap-3 text-left text-[11px]">
          <div className="pixel-subpanel px-3 py-2">
            <div className="font-bold uppercase">Move</div>
            <div>Arrows / WASD</div>
          </div>
          <div className="pixel-subpanel px-3 py-2">
            <div className="font-bold uppercase">Interact</div>
            <div>E or Space</div>
          </div>
          <div className="pixel-subpanel px-3 py-2">
            <div className="font-bold uppercase">Cavern</div>
            <div>Jump with ↑ / W</div>
          </div>
          <div className="pixel-subpanel px-3 py-2">
            <div className="font-bold uppercase">Mobile</div>
            <div>On-screen pad</div>
          </div>
        </div>

        <button
          type="button"
          onClick={onStart}
          className="pixel-button px-8 py-3 text-base font-bold uppercase tracking-widest text-[#4a3528]"
        >
          ▶ Play
        </button>

        <p className="mt-8 text-[10px] uppercase tracking-wider opacity-60">
          Art by Cup Nooble — Sprout Lands UI Pack
        </p>
      </div>
    </div>
  );
}
