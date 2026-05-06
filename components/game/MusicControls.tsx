"use client";

import { useEffect, useRef, useState } from "react";
import { gameBus } from "@/lib/game/eventBus";

type MusicControlsProps = {
  enabled: boolean;
};

const MUSIC_SRC = "/assets/audio/hitslab-japan-japanese-music-502006.mp3";

export default function MusicControls({ enabled }: MusicControlsProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const humCtxRef = useRef<AudioContext | null>(null);
  const humOscRef = useRef<OscillatorNode | null>(null);
  const humGainRef = useRef<GainNode | null>(null);
  const [muted, setMuted] = useState(false);

  useEffect(() => {
    const off = gameBus.on("imposter:hunt-start", () => {
      if (muted) return;
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return;
      let ctx = humCtxRef.current;
      if (!ctx) {
        ctx = new Ctx();
        humCtxRef.current = ctx;
      }
      if (ctx.state === "suspended") void ctx.resume();
      if (humOscRef.current) {
        try {
          humOscRef.current.stop();
        } catch {
          /* already stopped */
        }
      }
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sawtooth";
      osc.frequency.value = 55;
      gain.gain.value = 0.04;
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      humOscRef.current = osc;
      humGainRef.current = gain;
    });
    return () => off();
  }, [muted]);

  useEffect(() => {
    if (muted && humOscRef.current && humCtxRef.current) {
      try {
        humOscRef.current.stop();
      } catch {
        /* no-op */
      }
      humOscRef.current = null;
    }
  }, [muted]);

  useEffect(() => {
    let audio = audioRef.current;
    if (!audio) {
      audio = new Audio(MUSIC_SRC);
      audio.loop = true;
      audio.preload = "auto";
      audio.volume = 0.55;
      audioRef.current = audio;
    }

    if (enabled) {
      void audio.play().catch(() => {
        // If browser blocks autoplay, user can unmute/toggle.
      });
    } else {
      audio.pause();
      audio.currentTime = 0;
    }
    return () => {
      if (!enabled) {
        audio?.pause();
      }
    };
  }, [enabled]);

  useEffect(() => {
    return () => {
      const audio = audioRef.current;
      if (audio) {
        audio.pause();
        audioRef.current = null;
      }
      try {
        humOscRef.current?.stop();
      } catch {
        /* no-op */
      }
      humOscRef.current = null;
      void humCtxRef.current?.close();
      humCtxRef.current = null;
    };
  }, []);

  function toggleMute() {
    const audio = audioRef.current;
    if (!audio) return;
    const next = !muted;
    audio.muted = next;
    setMuted(next);
    if (enabled && audio.paused) {
      void audio.play().catch(() => {
        // no-op
      });
    }
  }

  if (!enabled) return null;

  return (
    <div className="pointer-events-none absolute bottom-3 left-3 z-50">
      <button
        type="button"
        onClick={toggleMute}
        className="pointer-events-auto pixel-button h-11 w-11 text-lg"
        aria-label={muted ? "Unmute music" : "Mute music"}
        title={muted ? "Unmute music" : "Mute music"}
      >
        {muted ? "🔇" : "🔊"}
      </button>
    </div>
  );
}
