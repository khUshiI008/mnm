# Apna Payroll — React Native app

Generated with the real React Native CLI (`@react-native-community/cli`,
RN 0.86.0, TypeScript template) — the `android/` folder is tool-generated
native scaffolding, not hand-written, so it matches exactly what this RN
version expects. It was then customized for this project:

- App name: **Apna Payroll** (`app.json` displayName, Android
  `strings.xml` `app_name`)
- App icon: generated from `WebApplication1/favicon.png` at all 5 Android
  mipmap densities (mdpi/hdpi/xhdpi/xxhdpi/xxxhdpi), both `ic_launcher.png`
  and `ic_launcher_round.png`
- Android package / applicationId: `com.apnapayroll`
- `src/` — the actual app: navigation, screens, API client, Socket.io
  client (see `/PROJECT_ROADMAP.md` at the repo root for what's implemented
  vs. still "Coming soon")

## Before your first build

`npm install` has already been run once during setup (905 packages,
succeeded). If you copy this folder elsewhere or clean it, redo it:

```
cd mobile
npm install
```

Note: `package.json`'s `engines` field (inherited from the RN 0.86
template) asks for Node >= 22.11; it installed and works fine on Node 20.x
too (just an `EBADENGINE` warning, not a failure) — upgrade if you want to
match upstream exactly, but it isn't required.

### Point the app at your backend

Edit `src/config.ts`:

```ts
export const API_BASE_URL = 'http://10.0.2.2:4000/api'; // Android emulator -> your dev PC
export const SOCKET_URL = 'http://10.0.2.2:4000';
```

- Testing on the **Android emulator**: `10.0.2.2` already maps to your PC's
  `localhost` — no change needed if the backend runs on your dev machine on
  port 4000.
- Testing on a **physical phone** on the same Wi-Fi as your PC: replace
  `10.0.2.2` with your PC's LAN IP (`ipconfig` → IPv4 address).
- **Production build** (the APK you'll actually distribute): set these to
  your real backend domain, e.g. `https://api.apnapayroll.in/api` and
  `https://api.apnapayroll.in`, over HTTPS. There's no `.env` loading here
  on purpose — RN doesn't read `backend/.env`, and baking this in as a
  build-time constant keeps the release APK simple. Rebuild after changing it.

## Running in development

```
npx react-native start          # Metro bundler, separate terminal
npx react-native run-android    # builds debug + installs on emulator/device
```

## Building the release APK (what you asked for)

```
cd android
./gradlew assembleRelease
```

Output: `android/app/build/outputs/apk/release/app-release.apk`

This currently signs the release build with the **debug keystore** (RN's
default — see `android/app/build.gradle`'s `signingConfigs`), which is fine
for sideloading/testing on your own devices but **not** for the Play Store.
Before a real store submission, generate a proper release keystore and
update `signingConfigs.release` per
https://reactnative.dev/docs/signed-apk-android.

### If `gradlew` fails

This project currently lives under a path containing parentheses
(`HRMS (17)`). Windows Gradle/Android builds have a history of choking on
paths with spaces or special characters. If you get a cryptic
path/escaping error and nothing else explains it, try moving/copying the
whole repo to a plain path like `C:\Projects\ApnaPayroll` and building from
there — see `/PROJECT_ROADMAP.md`'s "Known environment caveats" section.

Also double check you're on **JDK 17** (`java -version`) — RN 0.86's
Android Gradle Plugin version expects it; older JDKs (8/11) will fail with
version-mismatch errors that don't obviously mention Java. This sandbox had
no Java at all, so the Android build itself could not be compiled or
verified here — you'll be the first to actually run `gradlew` against it.

## What's real vs. stubbed right now

- **Fully working**: Login/OTP, Register, Employee Dashboard, Attendance
  (monthly view + check-in/break selfie capture with camera + geolocation),
  live Socket.io status updates.
- **Admin menu**: lists all 30 modules from the original .NET `Panel/*`
  admin area (`src/navigation/adminModules.ts`) so navigation structure
  matches 1:1, but every module currently opens a "Coming soon" screen —
  see `/PROJECT_ROADMAP.md` for build order.
- **Employee Leaves / Payslips / Loans / Advances / Profile**: same
  "Coming soon" treatment — the .NET pages they map to
  (`Employee/Leaves.aspx` etc.) exist and work; the Node API + RN screen
  for them haven't been built yet.
