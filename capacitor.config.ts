import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.musicdelight.moe',
  appName: 'MDS Calendar',
  webDir: 'www',
  server: {
    url: 'https://mdscal.com/login?nativeApp=1',
    androidScheme: 'https',
    cleartext: false,
    allowNavigation: ['mdscal.com', 'www.mdscal.com'],
  },
};

export default config;
