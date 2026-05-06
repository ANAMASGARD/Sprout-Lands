type Listener<T> = (payload: T) => void;

/** Stable keys for GameOverOverlay — never branch on `reason` strings. */
export type GameLostCause =
  | "timeout"
  | "flood"
  | "imposter-contact"
  | "wrong-accusation-hp";

export type GameEvents = {
  ready: void;
  "objective:update": { text: string };
  "dialog:show": { speaker: string; lines: string[] };
  "dialog:hide": void;
  "charm:collected": {
    id: string;
    label: string;
    total: number;
    needed: number;
  };
  "hp:update": { current: number; max: number };
  /** Run begins when IslandScene is ready; React timer resets to durationMs. */
  "run:started": { durationMs: number };
  /** Stop ticking (win / explicit stop before remount). */
  "run:stopped": { outcome: "win" | "lose" | "restart" };
  /** React timer applies −seconds * 1000 (clamped); optional for HUD toast copy. */
  "pressure:penalty": { seconds: number; reason?: string };
  /** React timer applies +seconds * 1000 (clamped). */
  "pressure:bonus": { seconds: number; reason?: string };
  /** Seconds left (0..duration); emitted ~4/s from RunTimer for Phaser sync if needed. */
  "timer:tick": { remainingMs: number; remainingSeconds: number };
  /** Hard loss — overlay switches on `cause` only. */
  "game:lost": { cause: GameLostCause; reason: string };
  /** Opens accusation UI with cat names (Commit 5). */
  "imposter:accuse-open": { names: string[] };
  /** Player chose a cat (Commit 5 UI → Commit 6 Island handler). */
  "imposter:accuse-pick": { accusedName: string };
  /** Imposter switched to hunt AI (for audio/HUD). */
  "imposter:hunt-start": Record<string, never>;
  /** When true, IslandScene / side scenes ignore movement + interact (Commit 3). */
  "input:freeze": { frozen: boolean };
  "mystery:solved": {
    reward: string;
    stars?: number;
    remainingMsSnapshot?: number;
    accusedCorrectly?: boolean;
  };
  "scene:enter": { scene: "island" | "caverns" | "library" };
  "scene:return-from-caverns": { collected: boolean };
  "scene:return-from-library": { collected: boolean };
  "input:virtual": {
    left: boolean;
    right: boolean;
    up: boolean;
    down: boolean;
  };
  "input:interact": void;
};

class EventBus {
  private listeners = new Map<keyof GameEvents, Set<Listener<unknown>>>();

  on<K extends keyof GameEvents>(
    event: K,
    listener: Listener<GameEvents[K]>,
  ): () => void {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    set.add(listener as Listener<unknown>);
    return () => {
      set!.delete(listener as Listener<unknown>);
    };
  }

  emit<K extends keyof GameEvents>(event: K, payload: GameEvents[K]) {
    const set = this.listeners.get(event);
    if (!set) return;
    for (const listener of Array.from(set)) {
      (listener as Listener<GameEvents[K]>)(payload);
    }
  }

  clear() {
    this.listeners.clear();
  }
}

export const gameBus = new EventBus();
