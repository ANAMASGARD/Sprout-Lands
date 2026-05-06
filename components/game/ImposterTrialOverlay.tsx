"use client";

import { useEffect, useState } from "react";
import { gameBus } from "@/lib/game/eventBus";

/** Semi-transparent; Phaser keeps running underneath (no scene.pause). */
export default function ImposterTrialOverlay() {
  const [open, setOpen] = useState(false);
  const [names, setNames] = useState<string[]>([]);

  useEffect(() => {
    const offOpen = gameBus.on("imposter:accuse-open", ({ names: n }) => {
      setNames(n);
      setOpen(true);
    });
    const offRun = gameBus.on("run:started", () => setOpen(false));
    return () => {
      offOpen();
      offRun();
    };
  }, []);

  if (!open || names.length === 0) return null;

  function pick(name: string) {
    gameBus.emit("imposter:accuse-pick", { accusedName: name });
    setOpen(false);
    setNames([]);
  }

  return (
    <div
      className="pointer-events-auto absolute inset-0 z-[95] flex items-end justify-center bg-black/35 pb-10 px-4 pb-[max(2.5rem,env(safe-area-inset-bottom))]"
      style={{
        backgroundImage: "url(/assets/sprout/jam/premade_dialog_medium.png)",
        backgroundRepeat: "no-repeat",
        backgroundPosition: "center max(18%, 5rem)",
        backgroundSize: "min(520px, 92vw) auto",
      }}
    >
      <div className="relative mt-24 w-full max-w-lg rounded-lg border-2 border-[#7a5235]/80 bg-[#ead7a8]/90 px-4 py-4 font-pixel text-[#4a3528] shadow-lg backdrop-blur-[1px]">
        <p className="mb-3 text-center text-xs font-bold uppercase tracking-wider">
          Who is lying?
        </p>
        <p className="mb-4 text-center text-[11px] leading-snug opacity-90">
          The Whisper Stone hums… accuse carefully. The game keeps moving.
        </p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {names.map((name) => (
            <button
              key={name}
              type="button"
              onClick={() => pick(name)}
              className="pixel-button py-2 text-xs font-bold uppercase"
            >
              {name}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
