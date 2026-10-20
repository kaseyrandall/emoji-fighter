import type { CapacitorConfig } from '@capacitor/cli';

// Native iOS / Android shells around the web build in dist/.
// Rebuild and copy with: npm run cap:sync
const config: CapacitorConfig = {
  appId: 'com.edgekase.emojifighter',
  appName: 'Emoji Fighter',
  webDir: 'dist',
  backgroundColor: '#07070d',
  ios: {
    contentInset: 'never',
    // The game draws edge to edge; safe areas are padded in CSS.
    scrollEnabled: false,
  },
  android: {
    // Ship only what the app needs; no remote debugging in release builds.
    webContentsDebuggingEnabled: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 900,
      launchAutoHide: true,
      backgroundColor: '#1e1139', // the app icon's purple
      showSpinner: false,
      androidScaleType: 'CENTER_CROP',
    },
    // Android: the web view runs edge to edge and gets real safe-area insets
    // (env(safe-area-inset-*)) around the camera cutout.
    SystemBars: {
      insetsHandling: 'native',
      initialViewportFitValueHint: 'cover',
    },
  },
};

export default config;
