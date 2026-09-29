import AsyncStorage from '@react-native-async-storage/async-storage';
import notifee, { AndroidImportance } from '@notifee/react-native';

export const DEFAULT_CHANNEL_ID = 'default';
export const TARGET_COMPLETION_CHANNEL_ID = 'target_completion';
export const BIRTHDAY_CHANNEL_ID = 'birthday';
export const ANNIVERSARY_CHANNEL_ID = 'anniversary';
export const FESTIVAL_QUOTE_CHANNEL_ID = 'festival_quote';
export const TARGET_REMARKS_CHANNEL_ID = 'target_remarks';
// Admin-only variant of festival_quote — same content, longer (8s vs 5s)
// temple bell clip, per explicit admin-only request. Kept as its own channel
// rather than changing festival_quote's own sound, since employees stay on
// the 5s clip unchanged.
export const FESTIVAL_QUOTE_ADMIN_CHANNEL_ID = 'festival_quote_admin';
// '_v2': a brand-new channel ID is the ONLY way to change a channel's sound on
// a device that already has it — see the note on ensureChannels() below. Must
// match the channelId emailInboxService.js sends. Bump the suffix again if the
// email sound ever changes.
export const IMPORTANT_EMAIL_CHANNEL_ID = 'important_email_v2';
// Previous ID — stuck on the OS default sound on existing devices; deleted below.
const LEGACY_IMPORTANT_EMAIL_CHANNEL_ID = 'important_email';

/**
 * Android notification channels can't change sound/importance after
 * creation, so this must run once before any notification is displayed.
 * `sound: 'coin_drop'` / `'happy_birthday'` point at
 * android/app/src/main/res/raw/coin_drop.mp3 and happy_birthday.mp3 — if
 * those files aren't there yet, Android silently falls back to the default
 * notification sound instead of failing. Resource file names must be
 * lowercase a-z/0-9/underscore only (Android build rule).
 */
const DEFAULT_SOUND_MIGRATION_KEY = 'apna_payroll_default_channel_sound_v1';
// Same reason, for target_completion's coin_drop.mp3 shrinking from ~6.2s to
// ~3s — a duration change is still a sound change as far as Android's "can't
// change after creation" rule is concerned, so this needs its own delete-and-
// recreate migration too, not just swapping the raw resource file.
const TARGET_COMPLETION_SOUND_MIGRATION_KEY = 'apna_payroll_target_completion_channel_sound_v2';

/**
 * IMPORTANT — Android gotcha: deleteChannel() + createChannel() with the SAME
 * id does NOT reset the channel. Android keeps deleted channels and, when one
 * is re-created under the same id, restores it with ALL its old settings,
 * sound included (documented platform behaviour). So the delete-and-recreate
 * migrations below cannot actually change a sound on a device that already
 * had the channel. To really change a channel's sound, give it a NEW id (as
 * important_email_v2 does) and have the backend send that id.
 */
export async function ensureChannels() {
  // One-time migration for the 'default' channel switching from no custom
  // sound to notify_default.mp3. createChannel() is a no-op on a channel ID
  // that already exists on this device — it silently ignores the new
  // `sound` value rather than updating it, so devices that already opened
  // an earlier build (no custom sound) would otherwise be stuck silent
  // forever. Deleting the channel first forces Android to rebuild it fresh
  // from the createChannel call below. This is a normal in-app operation
  // (not tied to app data/login), gated by the AsyncStorage flag so it only
  // runs once per device — every app open after the first just goes
  // straight to createChannel like before.
  try {
    const migrated = await AsyncStorage.getItem(DEFAULT_SOUND_MIGRATION_KEY);
    if (!migrated) {
      await notifee.deleteChannel(DEFAULT_CHANNEL_ID).catch(() => {});
      await AsyncStorage.setItem(DEFAULT_SOUND_MIGRATION_KEY, '1');
    }
  } catch {
    /* best-effort — worst case the old sound sticks around for this device */
  }

  try {
    const migratedTarget = await AsyncStorage.getItem(TARGET_COMPLETION_SOUND_MIGRATION_KEY);
    if (!migratedTarget) {
      await notifee.deleteChannel(TARGET_COMPLETION_CHANNEL_ID).catch(() => {});
      await AsyncStorage.setItem(TARGET_COMPLETION_SOUND_MIGRATION_KEY, '1');
    }
  } catch {
    /* best-effort — worst case the old (longer) sound sticks around for this device */
  }

  // The old email channel is no longer used (backend now sends
  // important_email_v2) — remove it so the phone's notification settings
  // don't show two "Important Emails" entries. Safe to run every launch.
  await notifee.deleteChannel(LEGACY_IMPORTANT_EMAIL_CHANNEL_ID).catch(() => {});

  await notifee.createChannel({
    id: DEFAULT_CHANNEL_ID,
    name: 'General',
    importance: AndroidImportance.HIGH,
    // 'default' is a reserved value in both notifee's channel sound API and
    // FCM's android.notification.sound field — either one interprets the
    // literal string "default" as "play the OS's default sound", not as a
    // lookup for res/raw/default.mp3. The custom sound file is named
    // notify_default.mp3 specifically to steer clear of that collision.
    sound: 'notify_default',
  });

  await notifee.createChannel({
    id: TARGET_COMPLETION_CHANNEL_ID,
    name: 'Target Achieved',
    importance: AndroidImportance.HIGH,
    sound: 'coin_drop',
  });

  await notifee.createChannel({
    id: BIRTHDAY_CHANNEL_ID,
    name: 'Birthday Wishes',
    importance: AndroidImportance.HIGH,
    sound: 'happy_birthday',
  });

  await notifee.createChannel({
    id: ANNIVERSARY_CHANNEL_ID,
    name: 'Anniversary Wishes',
    importance: AndroidImportance.HIGH,
    sound: 'anniversary',
  });

  // Brand-new channel id (never existed before this build) specifically so it
  // always picks up its custom sound cleanly — reusing an existing channel
  // (e.g. 'default') wouldn't work: Android channels can't change sound after
  // creation, same reason the migration above exists for 'default'.
  await notifee.createChannel({
    id: FESTIVAL_QUOTE_CHANNEL_ID,
    name: 'Daily Quote & Festival Greetings',
    importance: AndroidImportance.HIGH,
    sound: 'temple_bell',
  });

  // Brand-new channel id, same reasoning as festival_quote above — created
  // fresh here specifically so it never needs a migration key later.
  await notifee.createChannel({
    id: TARGET_REMARKS_CHANNEL_ID,
    name: 'Target Remarks',
    importance: AndroidImportance.HIGH,
    sound: 'clapping',
  });

  await notifee.createChannel({
    id: FESTIVAL_QUOTE_ADMIN_CHANNEL_ID,
    name: 'Daily Quote & Festival Greetings (Admin)',
    importance: AndroidImportance.HIGH,
    sound: 'temple_bell_admin',
  });

  await notifee.createChannel({
    id: IMPORTANT_EMAIL_CHANNEL_ID,
    name: 'Important Emails',
    importance: AndroidImportance.HIGH,
    // res/raw/email.mp3 — must match CHANNEL_SOUNDS.important_email_v2 in the
    // backend's notificationService.js.
    sound: 'email',
  });
}
