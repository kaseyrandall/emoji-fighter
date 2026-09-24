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
  - `Fighter.tsx`: the procedurally animated emoji brawler rig (floating gloves and boots).
  - `EmojiBody.tsx`: turns any emoji into a thick "cookie-cutter" 3D body.
  - `Stage3D.tsx`: the five stages (painted backdrops, 3D platform, props, lighting).
  - `Vfx.tsx`: pooled sparks, shockwave rings and damage numbers.
  - `LandingScene.tsx` / `FighterPreview.tsx`: the 3D title screen and the character-select turntable.
- HUD, menus and touch controls stay as React DOM layered over the canvas.
