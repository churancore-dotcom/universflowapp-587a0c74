import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  // Must match google-services.json package_name AND the PKG used in
  // .github/workflows/build-android.yml — changing this here without updating
  // both of those will break the Android build (MainActivity path mismatch).
  appId: 'app.lovable.id5acaae55bbc847a7bd32f3924d8ef986',
  appName: 'Univers Flow',
  webDir: 'dist',
  server: {
    androidScheme: 'https'
  }
};

export default config;
