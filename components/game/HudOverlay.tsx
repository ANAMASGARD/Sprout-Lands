"use client";

import { useEffect, useState } from "react";
import { gameBus } from "@/lib/game/eventBus";

type Charm = { id: string; label: string };

export default function HudOverlay() {
  const [hp, setHp] = useState({ current: 3, max: 3 });
  const [objective, setObjective] = useState(
    "Walk around with arrows or WASD. Find the cottage.",
  );
  const [activeScene, setActiveScene] = useState<"island" | "caverns">("island");
  const [charms, setCharms] = useState<Charm[]>([]);
  const [needed, setNeeded] = useState(4);

  useEffect(() => {
    const off1 = gameBus.on("hp:update", (p) => setHp(p));
    const off2 = gameBus.on("objective:update", (p) => setObjective(p.text));
    const offScene = gameBus.on("scene:enter", ({ scene }) => setActiveScene(scene));
    const off3 = gameBus.on("charm:collected", (p) => {
      setCharms((prev) =>
        prev.find((c) => c.id === p.id) ? prev : [...prev, { id: p.id, label: p.label }],
      );
      setNeeded(p.needed);
    });
    return () => {
      off1();
      off2();
      offScene();
      off3();
    };
  }, []);

  return (
    <div className="pointer-events-none absolute inset-0 z-20 select-none font-pixel text-[#4a3528]">
      <div className="absolute top-3 left-3 flex flex-col gap-2">
        <div className="pixel-panel flex items-center gap-1 px-3 py-2 text-base">
          {Array.from({ length: hp.max }).map((_, i) => (
            <span
              key={i}
              aria-label={i < hp.current ? "heart full" : "heart empty"}
              className={i < hp.current ? "text-[#d96573]" : "text-[#b39992]"}
            >
              ♥
            </span>
          ))}
        </div>
        <div className="pixel-panel flex items-center gap-2 px-3 py-2 text-xs">
          <span className="font-bold uppercase tracking-wider">Charms</span>
          <span>
            {charms.length} / {needed}
          </span>
          <span className="ml-1 flex gap-1">
            {Array.from({ length: needed }).map((_, i) => (
              <span
                key={i}
                className={`inline-block h-3 w-3 rounded-sm ${
                  charms[i] ? "bg-[#f3c44a]" : "bg-[#c4ac7a]"
                }`}
                style={{
                  border: "1px solid #7a5235",
                }}
              />
            ))}
          </span>
        </div>
      </div>

      {activeScene !== "caverns" && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2">
          <div className="pixel-panel max-w-md px-4 py-2 text-center text-xs">
            <span className="mr-2 inline-block font-bold uppercase tracking-wider">
              Mission
            </span>
            <span>{objective}</span>
          </div>
        </div>
      )}

      <div className="absolute top-3 right-3">
        <div className="pixel-panel px-3 py-2 text-xs">
          <div className="flex flex-col gap-1">
            <span className="font-bold uppercase tracking-wider">Sprout Mystery</span>
            <span>Find Moonbell</span>
          </div>
        </div>
      </div>
    </div>
  );
}
