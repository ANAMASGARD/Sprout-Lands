"use client";

import { useEffect, useRef, useState } from "react";
import { gameBus } from "@/lib/game/eventBus";

type Dir = "left" | "right" | "up" | "down";

export default function MobileControls() {
  const stateRef = useRef({ left: false, right: false, up: false, down: false });
  const [touchActive, setTouchActive] = useState(false);

  useEffect(() => {
    function detect() {
      const isTouch =
        "ontouchstart" in window ||
        (navigator.maxTouchPoints && navigator.maxTouchPoints > 0);
      setTouchActive(Boolean(isTouch));
    }
    detect();
    window.addEventListener("touchstart", detect, { once: true });
    return () => window.removeEventListener("touchstart", detect);
  }, []);

  function press(dir: Dir, on: boolean) {
    stateRef.current = { ...stateRef.current, [dir]: on };
    gameBus.emit("input:virtual", { ...stateRef.current });
  }

  function interact() {
    gameBus.emit("input:interact", undefined);
  }

  if (!touchActive) return null;

  const btn =
    "pixel-button flex h-14 w-14 items-center justify-center text-xl font-bold text-[#4a3528] active:translate-y-[2px]";

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-40 flex justify-between gap-3 p-3 sm:hidden">
      <div className="pointer-events-auto grid grid-cols-3 gap-1">
        <span />
        <button
          type="button"
          aria-label="up"
          className={btn}
          onTouchStart={() => press("up", true)}
          onTouchEnd={() => press("up", false)}
          onMouseDown={() => press("up", true)}
          onMouseUp={() => press("up", false)}
        >
          ▲
        </button>
        <span />
        <button
          type="button"
          aria-label="left"
          className={btn}
          onTouchStart={() => press("left", true)}
          onTouchEnd={() => press("left", false)}
          onMouseDown={() => press("left", true)}
          onMouseUp={() => press("left", false)}
        >
          ◀
        </button>
        <button
          type="button"
          aria-label="down"
          className={btn}
          onTouchStart={() => press("down", true)}
          onTouchEnd={() => press("down", false)}
          onMouseDown={() => press("down", true)}
          onMouseUp={() => press("down", false)}
        >
          ▼
        </button>
        <button
          type="button"
          aria-label="right"
          className={btn}
          onTouchStart={() => press("right", true)}
          onTouchEnd={() => press("right", false)}
          onMouseDown={() => press("right", true)}
          onMouseUp={() => press("right", false)}
        >
          ▶
        </button>
      </div>

      <div className="pointer-events-auto flex flex-col items-end justify-end gap-2">
        <button
          type="button"
          aria-label="interact"
          className="pixel-button h-16 w-20 text-sm font-bold uppercase text-[#4a3528]"
          onClick={interact}
          onTouchStart={interact}
        >
          E
        </button>
        <button
          type="button"
          aria-label="jump"
          className="pixel-button h-12 w-20 text-xs font-bold uppercase text-[#4a3528]"
          onTouchStart={() => press("up", true)}
          onTouchEnd={() => press("up", false)}
          onMouseDown={() => press("up", true)}
          onMouseUp={() => press("up", false)}
        >
          Jump
        </button>
      </div>
    </div>
  );
}
