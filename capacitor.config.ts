import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  // Must match google-services.json package_name for FCM to deliver pushes
  appId: 'app.lovable.id5acaae55bbc847a7bd32f3924d8ef986',
  appName: 'Univers Flow',
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
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
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
  // Disable JS hijacking the hardware back button while media plays.
  // @ts-expect-error supported by the Android runtime even if absent from older type defs
  hardwareBackButton: false,
};

export default config;
