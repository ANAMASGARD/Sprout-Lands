"use client";

import { useEffect, useRef, useState } from "react";

type MusicControlsProps = {
  enabled: boolean;
};

const MUSIC_SRC = "/assets/audio/hitslab-japan-japanese-music-502006.mp3";

export default function MusicControls({ enabled }: MusicControlsProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [muted, setMuted] = useState(false);

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
