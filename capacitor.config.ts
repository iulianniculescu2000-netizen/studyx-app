import type { CapacitorConfig } from '@capacitor/cli';

// appId matches electron-builder's build.appId (electron-builder.json / package.json "build")
// so the desktop and Android builds share one brand identity.
const config: CapacitorConfig = {
  appId: 'com.studyx.app',
  appName: 'StudyX',
  webDir: 'dist',
};

export default config;
