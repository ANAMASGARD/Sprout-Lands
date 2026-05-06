"use client";

import { useEffect, useState } from "react";
import { gameBus } from "@/lib/game/eventBus";

export default function MysterySolved() {
  const [reward, setReward] = useState<string | null>(null);
  const [stars, setStars] = useState(1);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const off = gameBus.on("mystery:solved", (p) => {
      setReward(p.reward);
      setStars(p.stars ?? 1);
    });
    return () => off();
  }, []);

  if (!reward) return null;

  function copy() {
    if (!reward) return;
    void navigator.clipboard?.writeText(reward).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  }

  const starDisplay = "★".repeat(Math.min(3, Math.max(1, stars)));

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="pixel-panel relative w-[min(92vw,520px)] px-8 py-8 text-center font-pixel text-[#4a3528]">
        <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-[#9c7c54] px-4 py-1 text-xs font-bold uppercase tracking-widest text-[#fbeec1]">
          Mystery Solved!
        </div>

        <div className="mb-2 text-lg tracking-[0.35em] text-[#b37b1d]" aria-label={`${stars} stars`}>
          {starDisplay}
        </div>

        <div className="mb-4 flex justify-center">
          <div className="flex items-center gap-1">
            <span className="text-2xl">⭐</span>
            <span className="text-2xl">🌿</span>
            <span className="text-2xl">≈</span>
            <span className="text-2xl">☾</span>
          </div>
        </div>

        <h2 className="mb-2 text-xl font-bold uppercase tracking-wider">
          Finally, You Have Achieved It!
        </h2>
        <p className="mb-6 text-sm leading-relaxed">
          Finally you have achieved the phone number of Gaurav Chaudhary.
          Thank you Nishita Shah, achievement unlocked. Feel free to call me or
          message me any time.
        </p>

        <div
          className="mx-auto mb-6 inline-block rounded-md border-2 border-[#7a5235] bg-[#fbeec1] px-6 py-4 text-2xl font-bold tracking-widest text-[#4a3528] shadow-[3px_3px_0_#7a5235]"
          aria-label="reward phone number"
        >
          {reward}
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={copy}
            className="pixel-button px-4 py-2 text-xs font-bold uppercase tracking-wider"
          >
            {copied ? "Copied!" : "Copy Number"}
          </button>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="pixel-button px-4 py-2 text-xs font-bold uppercase tracking-wider"
          >
            Play Again
          </button>
        </div>

        <p className="mt-6 text-[10px] uppercase tracking-wider opacity-60">
          Art by Cup Nooble — Sprout Lands UI Pack
        </p>
      </div>
    </div>
  );
}
