# MDS Calendar Mobile App

The Android app is a Capacitor wrapper for the live platform at `https://mdscal.com`.

## Build Android

1. Install Android Studio and a Java 21 JDK on a Windows or Mac build machine.
2. Run `npm install`.
3. Run `npm run cap:sync` after changing `capacitor.config.ts` or native plugins.
4. Run `npm run cap:open` to open the Android project in Android Studio.
5. In Android Studio, use Build > Build APK(s) to create a test APK, or Build > Generate Signed Bundle / APK for Google Play.

The app needs an internet connection because it loads the live Next.js platform, Supabase authentication, and API routes from `https://mdscal.com`.

## iPhone

The iPhone project must be generated and signed on a Mac with Xcode. Install `@capacitor/ios`, then run `npx cap add ios` and `npx cap sync ios` on that Mac.
