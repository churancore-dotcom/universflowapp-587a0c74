import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.5acaae55bbc847a7bd32f3924d8ef986',
  appName: 'universflowapp',
  webDir: 'dist',
  server: {
    // Hot reload from Lovable sandbox during development
    url: 'https://5acaae55-bbc8-47a7-bd32-f3924d8ef986.lovableproject.com?forceHideBadge=true',
    cleartext: true,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      backgroundColor: '#000000',
      showSpinner: false,
      androidSpinnerStyle: 'small',
      iosSpinnerStyle: 'small',
      spinnerColor: '#FF2D55',
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#000000',
    },
    Keyboard: {
      resize: 'body',
      resizeOnFullScreen: true,
    },
  },
  ios: {
    contentInset: 'automatic',
    preferredContentMode: 'mobile',
    scheme: 'UniversFlow',
  },
  android: {
    backgroundColor: '#000000',
    allowMixedContent: true,
    captureInput: true,
    webContentsDebuggingEnabled: false,
  },
};

export default config;
