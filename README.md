# Sprout Mystery Game

A browser-playable mystery puzzle game built with Next.js + Phaser, inspired by the Sprout Lands UI style.

## Story
Teemo the cat must recover the missing Moonbell by solving four mystery puzzles around Sprout Island:
1. Cottage diary clue
2. Garden step-sequence puzzle
3. Gravity cavern platform challenge
4. Shrine symbol-order puzzle

After all four charms are collected, the center chest opens and shows the reward popup with your configured phone number.

## Tech Stack
- Next.js 16 (App Router)
- React 19
- Phaser 3 (game engine + Arcade physics)
- Tailwind 4 for overlays and UI shell

## Asset Source and License
Sprout Lands UI assets are by Cup Nooble:
- https://cupnooble.itch.io/sprout-lands-ui-pack

Important license notes for the free/basic pack:
- non-commercial usage only
- do not redistribute/resell assets
- credit Cup Nooble

## Local Development
Install dependencies and run:

```bash
npm install
npm run dev
```

Then open `http://localhost:3000`.

## Build Checks
```bash
npm run lint
npm run build
```

## Configure Reward Phone Number
Set this environment variable:

```bash
NEXT_PUBLIC_REWARD_PHONE_NUMBER="+91 98765 43210"
```

Since this is `NEXT_PUBLIC_*`, it is visible in the client bundle and browser.

## Deploy on Vercel
1. Push this repo to GitHub/GitLab/Bitbucket.
2. Import it into Vercel.
3. Add env var in Vercel Project Settings:
   - `NEXT_PUBLIC_REWARD_PHONE_NUMBER`
4. Deploy.

No additional server services are required.
