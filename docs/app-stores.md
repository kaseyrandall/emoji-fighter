# Emoji Fighter on the App Store and Google Play

The same web game ships inside native iOS and Android shells built with [Capacitor](https://capacitorjs.com). The game code in `src/` runs unchanged. The few places that differ in the apps are in `src/lib/native.ts`.

## What's in the repo

| Path | What it is |
| --- | --- |
| `capacitor.config.ts` | App ID `com.edgekase.emojifighter`, home-screen name "Emoji Fighter", splash and inset settings |
| `ios/` | Xcode project (Swift Package Manager, no CocoaPods) |
| `android/` | Android Studio / Gradle project (target SDK 36, min SDK 24) |
| `assets/` | Icon and splash source art. Rerun `npx capacitor-assets generate --ios --android --iconBackgroundColor '#07070d' --splashBackgroundColor '#1e1139'` after changing them |
| `src/lib/native.ts` | Landscape lock, Android back button, haptics. Every call does nothing on the web |
| `src/lib/analytics.ts` | Google Analytics, website only. The apps collect nothing |
| `public/privacy.html` | Privacy policy, live at `/privacy.html` after the next Netlify deploy |
| `docs/store-listing.md` | Every store field: name, descriptions, keywords, age rating and privacy answers |
| `store/` | Screenshots in store sizes, Play icon and Play feature graphic |

### How the apps differ from the website

- Always full screen and landscape. The status and navigation bars are hidden; the Full screen toggle becomes a **Vibration** toggle.
- Haptics: light buzz on jabs and blocks, stronger on heavy punches and specials, a jolt on a KO.
- Android back button: pauses or resumes a fight; otherwise goes back a screen; on the home screen it leaves the app.
- The game pauses when the app goes to the background (same as the website).
- Works offline. The Press Start 2P font is bundled instead of loaded from Google Fonts. This also applies to the website now.
- No Google Analytics, and no "Classic" button (the 2D game stays on the website).

## Commands

```bash
npm ci
npm run cap:sync          # build the web game and copy it into ios/ and android/
npx cap open ios          # open in Xcode (Mac only)
npx cap open android      # open in Android Studio
npm run android:apk       # debug APK -> android/app/build/outputs/apk/debug/app-debug.apk
```

Run `npm run cap:sync` after **every** game change before building either app.

---

## Your checklist

Everything below needs you: your accounts, your Mac, your signing keys or your legal answers.

### 0. Try it today (Android)

- [ ] Install the debug APK I built (`app-debug.apk`, sent separately) on an Android phone: open it and allow "install unknown apps". Play a few fights and check the back button, vibration and the pause menu.

### 1. Accounts

- [ ] **Apple Developer Program**: $99/year at https://developer.apple.com/programs/enroll/.
  - Enrolling as an *individual* shows your personal name as the seller.
  - To show **Edge Kase Interactive**, enroll as an *organization*. That needs a registered business and a free D-U-N-S number, which can take a week or two.
- [ ] **Google Play Console**: $25 one-time at https://play.google.com/console/signup.
  - Identity verification takes a few days.
  - **Heads-up:** new *personal* Play accounts must run a closed test with at least 12 testers for 14 days before they can publish to production. Line up friends early. Organization accounts are exempt.

### 2. iOS: build and upload (needs a Mac)

- [ ] Install the latest Xcode from the Mac App Store, plus Node 22.
- [ ] Clone this branch, then run `npm ci && npm run cap:sync && npx cap open ios`.
- [ ] In Xcode, select the **App** target, then **Signing & Capabilities**: tick *Automatically manage signing* and pick your Team. The bundle ID is already `com.edgekase.emojifighter`.
- [ ] Run it on your iPhone (plug it in, pick it as the destination, press ▶). Check that:
  - the safe areas clear the notch / Dynamic Island in both landscape directions;
  - haptics work;
  - sound starts after the first tap.
- [ ] In App Store Connect (https://appstoreconnect.apple.com), go to **My Apps → +** and create **New App**:
  - Platform: iOS
  - Name: *Emoji Fighter 3D*
  - Bundle ID: `com.edgekase.emojifighter`
  - SKU: e.g. `emojifighter`
- [ ] In Xcode, choose **Product → Archive**, then **Distribute App → App Store Connect → Upload**.
- [ ] Test the build through **TestFlight** on your phone.
- [ ] Fill in the listing from `docs/store-listing.md`:
  - screenshots from `store/screenshots/iphone` and `store/screenshots/ipad`;
  - App Privacy: "Data Not Collected";
  - the age rating questionnaire;
  - privacy policy URL;
  - price: Free.
- [ ] Encryption: already answered in `Info.plist` (`ITSAppUsesNonExemptEncryption = NO`), so no export compliance prompt.
- [ ] **Submit for Review**. Reviews usually take 1–3 days.

### 3. Android: sign and upload

- [ ] Create your **upload key** once and back it up somewhere safe. Never commit it:
  ```bash
  keytool -genkeypair -v -keystore android/upload-key.jks -alias upload -keyalg RSA -keysize 2048 -validity 10000
  ```
- [ ] Create `android/keystore.properties` (git-ignored):
  ```properties
  storeFile=upload-key.jks
  storePassword=YOUR_STORE_PASSWORD
  keyAlias=upload
  keyPassword=YOUR_KEY_PASSWORD
  ```
- [ ] Build the release bundle:
  ```bash
  npm run cap:sync && cd android && ./gradlew bundleRelease
  ```
  This produces `android/app/build/outputs/bundle/release/app-release.aab`. Alternatively, use Android Studio: **Build → Generate Signed App Bundle**.
- [ ] In Play Console, **Create app**:
  - Name: *Emoji Fighter 3D*
  - Type: Game
  - Price: Free
  - Accept **Play App Signing**: Google holds the final signing key; yours is only the upload key.
- [ ] Fill in the **App content** forms from `docs/store-listing.md`:
  - privacy policy;
  - ads: no;
  - content rating;
  - target audience: 13+ is simplest;
  - data safety: no data collected.
- [ ] Fill in the **Store listing**:
  - short and full description;
  - `store/play-icon-512.png`;
  - `store/play-feature-graphic.png`;
  - screenshots from `store/screenshots/android`.
- [ ] Upload the `.aab` to **Testing → Internal testing** and try it. Then run **Closed testing** with 12+ testers for 14 days if your account needs it. Then **Production**.

### 4. Ship the website changes

- [ ] Merge this branch so Netlify deploys it. That puts `privacy.html` live at the URL the stores need. The bundled font and the analytics cleanup also go live.

---

## App Review risks, and what to do about each

- **Apple 4.2 "minimum functionality"** (apps that are just a website): low risk here. The game is bundled and works offline, plays full screen with touch controls and haptics, and loads nothing remote. If it's flagged anyway, reply in Resolution Center that it is a native-packaged offline game, not a website.
- **Names that parody real brands or people (Apple 5.2 / Play IP policy).** If a reviewer objects, rename the character in `src/data/characters.ts` and resubmit. The names:
  - **ChadGPT** echoes ChatGPT (a trademark);
  - **Cluck Norris** echoes a real person's name;
  - **Boo Radley** is a literary character.

  Parody names often pass, but these are the most likely reasons for a rejection.
- **Icon art**: the app icon uses Noto Emoji artwork (Google, Apache License 2.0), which allows commercial use. Inside the game, emoji are drawn by the phone's own emoji font.

## Updating the apps later

1. Make the game change, then run `npm run cap:sync`.
2. Bump the version:
   - Android: `versionCode` (+1 every upload) and `versionName` in `android/app/build.gradle`.
   - iOS: **Version** and **Build** in Xcode → App target → General.
3. Build and upload as above.

## Not verified yet

- Neither app has run on a real device. This environment has no Android emulator (no hardware virtualization) and no Mac.
- The Android debug APK **builds**, and its manifest checks out:
  - package name;
  - target SDK 36;
  - landscape only;
  - label "Emoji Fighter".
- The app UI was checked in Chromium with the Android bridge simulated: home screen, fighter select, fights, specials and the pause menu with the Vibration toggle.
- Haptics, the back button, the orientation lock and the hidden system bars need a check on a real phone (step 0 above).
- The iOS project was generated but not compiled (that needs Xcode).
