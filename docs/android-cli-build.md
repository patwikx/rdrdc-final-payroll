# Android CLI Build (CachyOS/Linux)

This project uses Capacitor for Android at:

- `capacitor.config.ts`
- `android/`

## One-time host setup

Local user-space toolchain paths used by this project:

- JDK 21: `~/.local/jdk/21`
- Android SDK: `~/.local/android-sdk`

Required SDK packages:

- `platform-tools`
- `platforms;android-35`
- `platforms;android-36` (pulled by AGP during build)
- `build-tools;35.0.0`

## Configure hosted employee-portal URL

Capacitor defaults to `https://hris.rdhardware.com`.

You can override it by setting `CAPACITOR_SERVER_URL` before syncing.

Example:

```bash
export CAPACITOR_SERVER_URL="https://your-portal-domain.com"
npm run mobile:sync:android
```

## Build debug APK

```bash
npm run mobile:build:android:debug
```

APK output:

- `android/app/build/outputs/apk/debug/app-debug.apk`

## Install APK to USB-connected phone

```bash
npm run mobile:install:android:debug
```

## Build release artifacts (APK/AAB)

Release build commands:

```bash
npm run mobile:build:android:release
npm run mobile:bundle:android:release
```

Release outputs:

- APK: `android/app/build/outputs/apk/release/app-release.apk`
- AAB: `android/app/build/outputs/bundle/release/app-release.aab`

## Configure Play Store signing

Create a keystore once:

```bash
keytool -genkeypair -v -keystore ~/keystores/employee-portal-upload.jks -alias employee-portal-upload -keyalg RSA -keysize 2048 -validity 10000
```

Export signing vars before release builds:

```bash
export ANDROID_KEYSTORE_FILE="$HOME/keystores/employee-portal-upload.jks"
export ANDROID_KEYSTORE_PASSWORD="your_keystore_password"
export ANDROID_KEY_ALIAS="employee-portal-upload"
export ANDROID_KEY_PASSWORD="your_key_password"
```

Then run:

```bash
npm run mobile:bundle:android:release
```

Notes:

- If signing variables are missing, release tasks will still build but will use debug signing (not Play Store-ready).
- For Play Store upload, use the signed `app-release.aab`.
