// The App Store / Google Play builds run the same web game inside a Capacitor
// shell. Everything native lives here, and every call is a no-op on the web.
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { ScreenOrientation } from '@capacitor/screen-orientation';
import { useSettings } from '../store/settingsStore';

export const isNative = Capacitor.isNativePlatform();

// One-time setup at launch: held in landscape, with the Android back button
// wired to the game (see onBack). The status / navigation bars are hidden
// natively (Info.plist on iOS, MainActivity on Android).
export function initNative(onBack: () => void) {
  if (!isNative) return;
  document.documentElement.classList.add('native');
  ScreenOrientation.lock({ orientation: 'landscape' }).catch(() => {});
  App.addListener('backButton', onBack).catch(() => {});
}

// Leaves the app (Android back on the home screen).
export const exitApp = () => {
  if (isNative) App.exitApp();
};

// A buzz to go with a blow: light for a jab or a block, heavier for a heavy
// punch, a special or a KO. Follows the Vibration setting.
export type Buzz = 'light' | 'medium' | 'heavy' | 'ko';
export function buzz(kind: Buzz) {
  if (!isNative || !useSettings.getState().haptics) return;
  const p =
    kind === 'ko'
      ? Haptics.notification({ type: NotificationType.Error })
      : Haptics.impact({ style: kind === 'light' ? ImpactStyle.Light : kind === 'medium' ? ImpactStyle.Medium : ImpactStyle.Heavy });
  p.catch(() => {});
}
