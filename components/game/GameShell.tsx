"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import HudOverlay from "./HudOverlay";
import DialogOverlay from "./DialogOverlay";
import MysterySolved from "./MysterySolved";
import MobileControls from "./MobileControls";
import MusicControls from "./MusicControls";

const PhaserGame = dynamic(() => import("./PhaserGame"), { ssr: false });

export default function GameShell() {
  const [started, setStarted] = useState(false);

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

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-[#a6d8d3]">
      {!started ? (
        <TitleScreen onStart={() => setStarted(true)} />
      ) : (
        <>
          <PhaserGame />
          <HudOverlay />
          <MusicControls enabled={started} />
          <DialogOverlay />
          <MobileControls />
          <MysterySolved />
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
        <p className="mb-1 text-sm">
          Find Gaurav Chaudhary&apos;s Number
        </p>

        <div className="my-6 flex items-center justify-center gap-2 text-3xl">
          <span title="Sun Charm">☀</span>
          <span title="Leaf Charm">🌿</span>
          <span title="Wave Charm">≈</span>
          <span title="Moon Charm">☾</span>
        </div>

        <p className="mb-6 px-2 text-sm leading-relaxed">
          The goal is clear: find Gaurav Chaudhary&apos;s phone number. Help
          Teemo solve each mystery puzzle, collect all four charms, and unlock
          the chest to reveal the final number.
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
