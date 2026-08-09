import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.musicdelight.moe',
  appName: 'Music Delight MOE',
  webDir: 'www',
  server: {
    url: 'https://mdscal.com',
    androidScheme: 'https',
    cleartext: false,
    allowNavigation: ['mdscal.com'],
  },
};

export default config;
