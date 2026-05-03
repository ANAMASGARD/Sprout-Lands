# SproutLands Agent Guide

## Framework guardrail
<!-- BEGIN:nextjs-agent-rules -->
This is NOT the Next.js you know.

This repo uses Next.js 16 App Router. Before changing framework behavior, read the relevant guide in `node_modules/next/dist/docs/` instead of relying on older Next.js assumptions.
<!-- END:nextjs-agent-rules -->

## Project summary
- This is a browser-playable mystery puzzle game built with Next.js + React + Phaser.
- The app currently has one route: `app/page.tsx`, which renders `components/game/GameShell.tsx`.
- The visual style is based on the Sprout Lands UI pack and uses assets under `public/assets/sprout`.

## Main architecture
- `components/game/GameShell.tsx` is the top-level UI shell. It mounts the Phaser canvas plus React overlays.
- `components/game/PhaserGame.tsx` creates the Phaser game on the client only and loads the scenes dynamically.
- `components/game/HudOverlay.tsx`, `DialogOverlay.tsx`, `MobileControls.tsx`, `MusicControls.tsx`, and `MysterySolved.tsx` are React overlays layered above the canvas.
- `lib/game/eventBus.ts` is the bridge between Phaser scenes and React overlays. Prefer emitting typed events here instead of tightly coupling scene logic to React.
- `lib/game/scenes/BootScene.ts`, `IslandScene.ts`, and `CavernsScene.ts` contain the actual gameplay.
- `lib/game/constants.ts`, `assets.ts`, and `puzzles.ts` hold shared game configuration and content.

## Important implementation notes
- Keep Phaser code client-side. Do not import Phaser into server components or server-only files.
- In scene files, import Phaser as `import * as Phaser from "phaser"`. The current Phaser package in this repo does not expose a usable default export there.
- In `components/game/PhaserGame.tsx`, the runtime dynamic import still uses `(await import("phaser")).default` for game bootstrapping. Verify this carefully before changing it.
- The dev script intentionally uses `next dev --webpack` because Turbopack previously panicked in this repo with a resolver error.
- The game viewport is controlled by `VIEW_W` and `VIEW_H` in `lib/game/constants.ts`. Keep overlays and scene sizing aligned with those values.
- `scene:enter` events are used by React overlays to adapt UI between island and cavern scenes.

## Reward / secret handling
- The reward phone number is currently sourced from `NEXT_PUBLIC_REWARD_PHONE_NUMBER` in `lib/game/constants.ts`.
- That means it is visible in the client bundle and browser. Do not claim it is hidden or server-only unless you actually move it behind a server route or server action.
- If asked to truly hide the reward, introduce a server-side endpoint and stop exposing the value through `NEXT_PUBLIC_*`.

## UI and content expectations
- Preserve the pastel pixel-art feel. Prefer small, readable UI changes over generic modern web styling.
- Avoid covering gameplay objects with top banners or overlays, especially in the cavern scene.
- When adjusting the cavern scene, make sure the shell/background color matches the scene so side gutters do not look broken.

## Assets and licensing
- Asset source is Cup Nooble's Sprout Lands UI pack.
- Treat those assets as non-commercial and do not suggest redistributing them.
- Preserve visible credit in user-facing UI/docs when appropriate.

## Verification checklist
- After substantive changes, run `npm run build`.
- Use `ReadLints` on edited files and fix any new diagnostics you introduced.
- If changing scene/UI behavior, also verify that overlays still react correctly to `gameBus` events.
