import { NativeEventEmitter, NativeModules, Platform } from 'react-native';

const { SmsConsentModule } = NativeModules;
const emitter = SmsConsentModule ? new NativeEventEmitter(SmsConsentModule) : null;

/**
 * Android-only wrapper around the OS's own SMS User Consent API
 * (android/app/.../SmsConsentModule.kt) — the moment a matching SMS arrives,
 * Android shows its own "Allow [app] to read this message?" bottom sheet; only
 * if the user taps Allow does this get the SMS body. No READ_SMS/RECEIVE_SMS
 * permission, and — unlike the SMS Retriever API — no app-signature hash
 * needed in the DLT-registered SMS template (smsGateway.js's message text
 * needs no changes). Deny or a 5-minute timeout just calls onTimeoutOrDenied
 * so the caller can silently fall back to manual OTP entry.
 *
 * Returns a cleanup function — call it on unmount / when leaving the OTP step
 * so a stale listener doesn't fire into an unmounted screen.
 */
export function startSmsConsentListener(handlers: {
  onReceived: (message: string) => void;
  onTimeoutOrDenied?: () => void;
}): () => void {
  if (Platform.OS !== 'android' || !SmsConsentModule || !emitter) return () => {};

  const subs = [
    emitter.addListener('SmsConsent:received', (message: string) => handlers.onReceived(message)),
    emitter.addListener('SmsConsent:timeout', () => handlers.onTimeoutOrDenied?.()),
    emitter.addListener('SmsConsent:denied', () => handlers.onTimeoutOrDenied?.()),
  ];

  SmsConsentModule.startListening().catch(() => {
    // Play Services unavailable, or the listener genuinely failed to arm —
    // the OTP screen's manual entry field is always there as the fallback.
  });

  return () => {
    subs.forEach((s) => s.remove());
    SmsConsentModule.stopListening();
  };
}

/** Pulls the first run of `digits` consecutive digits out of an SMS body — e.g. the 6-digit OTP smsGateway.js sends. */
export function extractOtp(message: string, digits = 6): string | null {
  const match = new RegExp(`(\\d{${digits}})`).exec(message);
  return match ? match[1] : null;
}
