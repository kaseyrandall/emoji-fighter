# Emoji Fighter

A 3D emoji fighting game built with React, [three.js](https://threejs.org) (via
`@react-three/fiber`) and zustand.

```
npm install
npm run dev
```

## How it's put together

- `src/store/gameStore.ts` holds the fight simulation (movement, AI, hits, rounds, gauntlet).
- `src/three/` renders it in 3D:
  - `ArenaScene.tsx`: the fight scene, with the fighting-game camera, hitstop, KO slow-mo and hit effects.
  - `Fighter.tsx`: the procedurally animated emoji brawler rig (floating gloves).
  - `EmojiBody.tsx`: turns any emoji into a thick "cookie-cutter" 3D body.
  - `Stage3D.tsx`: the five stages (painted backdrops, 3D platform, props, lighting).
  - `Vfx.tsx`: pooled sparks, shockwave rings, damage numbers and per-character special effects.
  - `LandingScene.tsx` / `FighterPreview.tsx`: the 3D title screen and the character-select turntable.
- HUD, menus and touch controls stay as React DOM layered over the canvas.

## Classic (2D) version

The original 2D game stays playable at `/classic/` (linked from the home page). It's a prebuilt static copy in `public/classic/`, built from `main` at commit `95382f3` (the last 2D release) with `base: '/classic/'`, plus a "Play the new 3D version" button on its home page. It ships its own copies of the sounds the 3D game dropped (`public/classic/assets/*.wav`) and loads the stage art, fight music and select sound from the shared `public/assets/`, so keep those files in place.
