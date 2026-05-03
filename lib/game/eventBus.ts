type Listener<T> = (payload: T) => void;

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
  "mystery:solved": { reward: string };
  "scene:enter": { scene: "island" | "caverns" };
  "scene:return-from-caverns": { collected: boolean };
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
