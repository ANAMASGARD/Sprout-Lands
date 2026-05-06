"use client";

import type { GameLostCause } from "@/lib/game/eventBus";

const TITLE: Record<GameLostCause, string> = {
  timeout: "The island sank",
  flood: "Lost to the flood",
  "imposter-contact": "The imposter caught you",
  "wrong-accusation-hp": "It wasn't them...",
};

export default function GameOverOverlay({
  cause,
  reason,
  onRetry,
}: {
  cause: GameLostCause | null;
  reason: string;
  onRetry: () => void;
}) {
  if (!cause) return null;

  return (
    <div className="pointer-events-auto absolute inset-0 z-[100] flex flex-col items-center justify-center bg-[#0a1623]/90 px-6 font-pixel text-[#fbeec1]">
      <div className="pixel-panel max-w-md border-2 border-[#7a5235] bg-[#2a1f18] px-8 py-8 text-center shadow-lg">
        <p className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-[#e8a078]">
          Game over
        </p>
        <h2 className="mb-4 text-2xl font-bold uppercase tracking-wider text-[#fbeec1]">
          {TITLE[cause]}
        </h2>
        <p className="mb-8 text-sm leading-relaxed text-[#d4c4a8]">{reason}</p>
        <button
          type="button"
          onClick={onRetry}
          className="pixel-button w-full px-6 py-3 text-base font-bold uppercase tracking-widest text-[#4a3528]"
        >
          Play again
        </button>
      </div>
    </div>
  );
}
