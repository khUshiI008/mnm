/**
 * Backend connection settings.
 *
 * IMPORTANT: "localhost" from a phone/emulator does NOT mean your PC.
 *   - Android emulator -> use http://10.0.2.2:4000
 *   - Physical Android device on the same Wi-Fi as your dev PC -> use your PC's LAN IP, e.g. http://192.168.1.50:4000
 *   - Production (CloudPanel/Hostinger VPS) -> use your domain, e.g. https://api.apnapayroll.in
 *
 * Change API_BASE_URL below before building. There is deliberately no .env
 * loading here — React Native doesn't read backend/.env, and baking in a
 * build-time constant keeps the release APK simple. If you need per-environment
 * builds later, look at react-native-config.
 */
export const API_BASE_URL = 'https://apnapayroll247.in/api';
export const SOCKET_URL = 'https://apnapayroll247.in';

/**
 * The .NET web app's own live host — separate server from the Node API above.
 * Needed because every file path written by the .NET app (KYC photos, Aadhaar
 * scans, signatures, selfies — anything saved before this Node backend
 * existed) is stored in the DB as "/Content/Uploads/...", served only by
 * this host. New uploads made through the Node backend use "/uploads/..."
 * instead, served by API_BASE_URL. See src/utils/fileUrl.ts for the routing.
 */
export const NET_WEB_BASE_URL = 'https://snmapp.cloudk.in';

/**
 * Must match android/app/build.gradle's `versionCode` for this exact build —
 * bump both together, in the same commit, every release. This is what the
 * force-update gate (AppUpdateGate) sends the backend to compare against the
 * published AppVersions row. If this drifts from build.gradle's versionCode,
 * the gate will compare the wrong number and either force-block a build that
 * shouldn't be, or silently let through one that should've been blocked.
 */
export const APP_VERSION_CODE = 65;
