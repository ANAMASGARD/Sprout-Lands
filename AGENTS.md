# SproutLands Agent Guide

## Framework guardrail
<!-- BEGIN:nextjs-agent-rules -->
This is NOT the Next.js you know.

This repo uses Next.js 16 App Router. Before changing framework behavior, read the relevant guide in `node_modules/next/dist/docs/` instead of relying on older Next.js assumptions.
<!-- END:nextjs-agent-rules -->

## Project identity and current scope
- SproutLands is a browser-playable mystery puzzle game built with Next.js + React + Phaser.
- Current app surface is one route: `app/page.tsx`.
- Core loop: explore island -> solve 4 charm puzzles across scenes -> open final chest -> reveal reward phone number.
- Visual style is pixel-art/pastel and based on Cup Nooble's Sprout Lands UI pack.

## Repository map (what each folder owns)
- `app/`
  - `layout.tsx`: root HTML shell and local font registration from `public/assets/sprout/font/SproutLands.ttf`.
  - `page.tsx`: renders `components/game/GameShell.tsx`.
  - `globals.css`: base theme variables and game-shell styling.
- `components/game/`
  - `GameShell.tsx`: start screen + scene-aware shell + React overlays.
  - `PhaserGame.tsx`: client-only Phaser bootstrap and scene registration.
  - `HudOverlay.tsx`: objective/charm/HP overlay.
  - `DialogOverlay.tsx`: dialog modal for scene narration/prompts.
  - `MobileControls.tsx`: virtual joystick + interact controls; emits event-bus input.
  - `MusicControls.tsx`: in-game music toggle/player.
  - `MysterySolved.tsx`: final reward reveal overlay.
  - `GameOverOverlay.tsx`: run-fail overlay (switches by typed loss cause).
  - `ImposterTrialOverlay.tsx`: non-pausing accusation UI from Whisper Stone.
- `lib/game/`
  - `constants.ts`: gameplay constants (grid, speed, viewport, IDs, order, reward env read).
  - `puzzles.ts`: puzzle metadata (labels, objective copy, charm text/symbols).
  - `assets.ts`: canonical asset keys/paths/frame maps.
  - `eventBus.ts`: typed bridge between Phaser and React.
  - `npcDialog.ts`: curated truth/lie/paranoia NPC clue pools.
  - `scenes/`
    - `BootScene.ts`: preload assets and start island.
    - `IslandScene.ts`: primary exploration hub, puzzle progression state, chest win condition.
    - `LibraryScene.ts`: rune-sequence challenge for one charm.
    - `CavernsScene.ts`: platformer challenge for one charm.
- `public/assets/`
  - Runtime static assets used by game and overlays (`audio`, `sprout/*` subfolders).
- `Sprout Lands - UI Pack - Basic pack/`
  - Source/downloaded art pack and license docs (reference bundle, not app code).

## Runtime flow (boot to gameplay)
1. Next.js serves `app/page.tsx` -> renders `GameShell`.
2. `GameShell` shows title/start gate; after start it mounts `PhaserGame` and overlays.
3. `PhaserGame` dynamically imports Phaser on client (`ssr: false`) and registers scenes.
4. Phaser starts `BootScene`, preloads assets, then transitions to `IslandScene`.
5. Gameplay and UI stay in sync through `gameBus` events (scene emits, React listens; mobile UI emits, scene listens).

## Scene ownership and game logic

### `IslandScene.ts` (main gameplay hub)
- Owns top-down movement using keyboard + virtual controls.
- Owns collisions with terrain, blockers, crates, interact zones.
- Tracks puzzle progress with collected charms and objective updates.
- Handles most dialog narrative and proximity-based interaction prompts.
- Launches side scenes (`LibraryScene`, `CavernsScene`) and resumes on return.
- Controls shrine/chest progression and emits final `mystery:solved` when all puzzle conditions pass.
- Starts global run timer via `run:started` and tracks timer ticks.
- Owns Imposter systems: random imposter pick, clue dialog variance, Hunt Mode trigger, Whisper Stone accusation handling.
- Owns HP economy updates (`hp:update`) and emits typed `game:lost` on failure conditions.
- Garden puzzle now uses a per-run random order with a commit window timer + penalty.

### `LibraryScene.ts` (rune sequence challenge)
- Top-down mini-scene.
- Player interacts with runes in correct sequence.
- On completion, emits return event and wakes island scene with `collected` result.
- Respects `input:freeze` so game-over state cannot move/interact.

### `CavernsScene.ts` (platformer challenge)
- Gravity scene with horizontal movement + jump.
- Player collects wave charm via traversal.
- On completion, emits return event and wakes island scene with `collected` result.
- Adds rising flood hazard with sine-wave surface and backward-motion acceleration.
- Emits typed `game:lost` with cause `flood` on drown.
- Plays jump SFX on successful jumps.

### Motion logic locations (important)
- Island movement loop: `lib/game/scenes/IslandScene.ts` in `update()`.
- Library movement loop: `lib/game/scenes/LibraryScene.ts` in `update()`.
- Caverns movement/jump/gravity loop: `lib/game/scenes/CavernsScene.ts` in `update()`.
- Mobile input source: `components/game/MobileControls.tsx` emits `input:virtual` and `input:interact`.

## Puzzle and progression model
- Puzzle IDs/order are defined centrally in `lib/game/constants.ts` (`PUZZLE_IDS`, `PUZZLE_ORDER`).
- Puzzle copy/content is centralized in `lib/game/puzzles.ts`.
- Progress is scene-memory state in `IslandScene` (not persisted across refresh).
- High-level progression:
  1) Solve library/cottage puzzle charm.
  2) Solve garden charm (randomized step order each run, time-window constrained).
  3) Solve caverns traversal charm.
  4) Solve shrine symbol-order charm (gated by prior charms).
  5) Open chest and emit solved event with reward payload.
- Optional shortcut currently implemented: correct imposter accusation can auto-resolve shrine alignment.

## Event bus contract (authoritative integration layer)
- Event definitions live in `lib/game/eventBus.ts`.
- Core events currently used in app flow:
  - `run:started`
  - `run:stopped`
  - `timer:tick`
  - `pressure:penalty`
  - `pressure:bonus`
  - `game:lost`
  - `objective:update`
  - `dialog:show`
  - `charm:collected`
  - `hp:update`
  - `imposter:accuse-open`
  - `imposter:accuse-pick`
  - `imposter:hunt-start`
  - `input:freeze`
  - `mystery:solved`
  - `scene:enter`
  - `scene:return-from-caverns`
  - `scene:return-from-library`
  - `input:virtual`
  - `input:interact`
- Primary listeners:
  - React side: `GameShell`, `HudOverlay`, `DialogOverlay`, `MysterySolved`.
  - Phaser side: scene files listen to virtual input/return events.
- If adding scene/UI behavior, prefer new typed bus events over direct cross-layer imports.

## Asset layout and loading rules
- Runtime assets are in `public/assets`.
- Key subfolders:
  - `public/assets/audio/`: background music + gameplay SFX (crop pop, jump, level-clear).
  - `public/assets/sprout/buttons/`
  - `public/assets/sprout/dialog/`
  - `public/assets/sprout/emotes/`
  - `public/assets/sprout/font/`
  - `public/assets/sprout/icons/`
  - `public/assets/sprout/inventory/`
  - `public/assets/sprout/sprites/`
  - `public/assets/sprout/ui/`
  - `public/assets/sprout/jam/`: jam-specific imported pack assets (e.g. trial dialog frame).
- Asset key/path canonical map is `lib/game/assets.ts`; keep scene loader usage aligned to this file.
- `BootScene.ts` is the central preload owner; avoid ad-hoc loading in multiple scenes unless justified.

## Configuration, secrets, and environment
- Reward phone number is read in `lib/game/constants.ts` from `NEXT_PUBLIC_REWARD_PHONE_NUMBER`.
- Because it is `NEXT_PUBLIC_*`, it is client-visible. Do not claim it is server-secret.
- To truly hide reward data, move reveal logic behind a server endpoint/action and stop exposing it via public env.

## Implementation guardrails for future agents
- Keep Phaser usage client-side only.
- In scene files, import Phaser as `import * as Phaser from "phaser"`.
- In `components/game/PhaserGame.tsx`, bootstrap currently relies on `(await import("phaser")).default`; verify carefully before changing.
- Dev script intentionally uses `next dev --webpack`; do not switch casually.
- `VIEW_W`/`VIEW_H` in `lib/game/constants.ts` are layout-critical for camera and overlays.
- Keep `scene:enter` behavior consistent so shell/HUD styling reflects active scene.
- Preserve pixel-art readability and avoid overlays covering core interactables.
- Game-over UX is typed by cause (`timeout`, `flood`, `imposter-contact`, `wrong-accusation-hp`); branch on cause, not reason strings.
- Keep timer authority in React (`GameShell`) so countdown continues while scenes sleep.
- `ImposterTrialOverlay` must remain non-pausing for intended tension.

## Known pitfalls and context future agents should keep
- `LibraryScene` corresponds to the `cottage` puzzle ID (name mismatch can confuse edits).
- Some typed events remain lightly used (`ready`, `dialog:hide`).
- Puzzle progression is not persisted (refresh resets run).
- Reward flow currently reveals public data by design.
- License constraints from asset pack are non-commercial; do not suggest redistribution.
- Avoid storing long-lived Phaser sound instances across scene lifecycle boundaries; prefer one-shot `this.sound.play(...)` to avoid stale sound-object runtime errors.

## Dev/build/lint workflow
- Install: `npm install`
- Dev: `npm run dev`
- Build: `npm run build`
- Start production: `npm run start`
- Lint: `npm run lint`

## Verification checklist after substantive changes
- Run `npm run build`.
- Use `ReadLints` on edited files and fix newly introduced diagnostics.
- If scene or overlay behavior changes:
  - Verify mobile + keyboard movement still works.
  - Verify `objective:update` and `dialog:show` still appear correctly in overlays.
  - Verify scene transitions (island <-> library/caverns) still wake/sleep correctly.
  - Verify shell background and HUD state still react to `scene:enter`.
