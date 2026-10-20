# Store listing copy

Copy and paste into App Store Connect and the Google Play Console. Character limits are noted; every field is within them.

## Names

| Field | Value | Limit |
| --- | --- | --- |
| App name (both stores) | Emoji Fighter 3D | 30 |
| Name on the home screen | Emoji Fighter | (set in the app) |
| App Store subtitle | Emoji brawler with specials | 30 |
| Bundle ID / package | com.edgekase.emojifighter | permanent once uploaded |
| Developer / seller | Edge Kase Interactive | |

## App Store: promotional text (170)

Sixteen emoji fighters. Six arenas. One gauntlet. Pick Cattitude, Dragon Warrior or Cluck Norris and punch your way to champion.

## Google Play: short description (80)

A 3D emoji brawler: 16 fighters, 6 arenas and a signature special for each.

## Description (both stores, 4000)

Emoji Fighter 3D is a pick-up-and-play arcade brawler starring the emoji you already know and love, now in full 3D.

Choose your fighter from a roster of 16, each with their own stats and a signature special move, then battle through a six-fight gauntlet that gets tougher with every opponent. Win two rounds to take the fight. Clear all six to become champion.

EASY TO PLAY, FUN TO MASTER
• Move and jump with the thumbstick
• Jab for quick hits, wind up a heavy punch for big damage
• Hold back to block, jump to dodge
• Fill your meter and unleash your special, but time it right: a well-placed dodge makes it miss

16 FIGHTERS, 16 SPECIALS
Cattitude's Claw-tastrophe. Dragon Warrior's Dragon Breath. Frost Byte's Absolute Zero. Kong Fu's Chest Thunder. Cluck Norris's Roundhouse Peck. Plus Hustle Ninja, ChadGPT, Extra T, McPoop Face, Boo Radley, Zom B. Goode, Rex Havoc, Sir Inksalot, Lil Devil, Uni-Corn and Giggles.

6 ARENAS
Fight across a sunset gas station, a neon subway, a pirate cove, a jungle temple, an emoji factory and a treetop canopy, each with its own music.

BUILT FOR PHONES AND TABLETS
• Full-screen 3D in landscape
• Touch controls sized for thumbs, with vibration on every hit
• Plays offline: no account, no ads, no in-app purchases, no tracking

Made by Edge Kase Interactive.

## App Store keywords (100, comma separated, no spaces)

fighting,fighter,brawler,arcade,boxing,beat em up,versus,battle,punch,KO,cat,dragon,cartoon,retro

## Categories

| Store | Primary | Secondary / tags |
| --- | --- | --- |
| App Store | Games › Action | Games › Arcade |
| Google Play | Action | Tags: Fighting, Arcade, Casual, Offline |

## URLs

| Field | Value |
| --- | --- |
| Privacy policy | `https://<your-site>/privacy.html` (in this repo at `public/privacy.html`; it goes live with the next Netlify deploy) |
| Support / marketing URL | `https://<your-site>/` or https://kaseyrandall.design |

## Age rating questionnaire answers

Fill in honestly. These describe the game as built:

- **Violence:** cartoon or fantasy violence, frequent but mild (emoji characters punching; no blood or gore, KO'd fighters just fall over).
- **Everything else:** none. No sexual content, profanity, drugs, alcohol, tobacco, gambling, horror, user-generated content, chat, web browsing, location or purchases.
- Expected result: App Store **9+**; Google Play (IARC) roughly **Everyone 10+ / PEGI 7**.

## Privacy answers

- **App Store "App Privacy":** Data Not Collected.
- **Google Play "Data safety":** the app collects no data and shares no data. No account creation. (The apps contain no analytics: Google Analytics runs only on the website.)
- **Play "Ads" declaration:** No, the app contains no ads.
- **Play "Target audience":** 13 and over is the simplest choice. Choosing under-13 age groups puts the app under the Families policy, which needs extra review.

## Screenshots and graphics (in `store/`)

| Folder / file | Size | For |
| --- | --- | --- |
| `store/screenshots/iphone/` | 2868 × 1320 | App Store iPhone 6.9" (required; Apple scales it down for smaller iPhones) |
| `store/screenshots/ipad/` | 2752 × 2064 | App Store iPad 13" (required because the app runs on iPad) |
| `store/screenshots/android/` | 1920 × 1080 | Google Play phone screenshots (also fine for 7" and 10" tablets) |
| `store/play-icon-512.png` | 512 × 512 | Google Play app icon |
| `store/play-feature-graphic.png` | 1024 × 500 | Google Play feature graphic |
| `assets/icon-only.png` | 1024 × 1024 | App Store icon (Xcode already has it in the asset catalog) |
