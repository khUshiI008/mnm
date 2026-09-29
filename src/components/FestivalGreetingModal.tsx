import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Sound from 'react-native-sound';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Icon from './Icon';
import { useAuth } from '../context/AuthContext';
import { getActiveFestivalGreeting } from '../api/festivalGreetingApi';
import { resolveFileUrl } from '../utils/fileUrl';
import { shareRemoteMedia } from '../utils/shareMedia';
import { colors, radius, spacing } from '../theme';

const videoHtml = (url: string) => `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
<style>
  html, body { margin: 0; padding: 0; background: #000; height: 100%; overflow: hidden; }
  video { width: 100%; height: 100%; object-fit: contain; background: #000; }
</style>
</head>
<body>
  <video src="${url}" autoplay controls playsinline webkit-playsinline></video>
</body>
</html>`;

Sound.setCategory('Playback');

function todayYmd() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

type Window = 'morning' | 'afternoon' | 'evening';
const MORNING_WINDOW_END_HOUR = 11;
const MORNING_WINDOW_MAX_SHOWS = 2;
/** Before 11 AM: shows again on every dashboard revisit, capped at MORNING_WINDOW_MAX_SHOWS total. After that: two more dedup'd windows, once each, roughly ~afternoon and ~evening. */
function currentWindow(): Window {
  const h = new Date().getHours();
  if (h < MORNING_WINDOW_END_HOUR) return 'morning';
  if (h < 20) return 'afternoon';
  return 'evening';
}

// Mirrors AppUpdateGate.tsx's triggerAppVersionRecheck pattern (and
// client.ts's setUnauthorizedHandler before that) — a module-level callback
// the mounted modal registers, which the admin/employee Dashboard screens
// call on every focus so the morning-window popup can re-show on a plain
// tab-revisit, not just a fresh app launch (the mount-only check below still
// covers app-open; this covers "already open, navigated back to Dashboard").
let recheckHandler: (() => void) | null = null;
export function triggerFestivalGreetingRecheck() {
  recheckHandler?.();
}

/**
 * One-off festival greeting (not a recurring daily thing like
 * MorningGreetingModal) — image, personalized "Happy {title}, {name}!", an
 * admin- or employee-specific message, and a short autoplaying audio clip.
 * Checked on app mount AND on every Dashboard screen focus (via
 * triggerFestivalGreetingRecheck, called from the admin/employee Dashboard
 * screens — see their useFocusEffect).
 *
 * Employees: before 11 AM it re-shows on each of those checks, capped at
 * MORNING_WINDOW_MAX_SHOWS total, so someone can still show it to a
 * colleague by revisiting Dashboard without it being truly unlimited. After
 * 11 AM: once each in an afternoon and an evening window for the rest of the
 * day.
 *
 * Admins (per explicit request): no cap, no windows — shows on every single
 * Dashboard visit all day, and the audio clip plays twice back-to-back
 * instead of once. See the user.mode branches below.
 *
 * Retire the greeting (IsActive: false on the backend row) once the festival
 * day is over — this component has no built-in date expiry of its own.
 */
export default function FestivalGreetingModal() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [visible, setVisible] = useState(false);
  const [data, setData] = useState<{ title: string; imageUrl: string; audioUrl: string; videoUrl: string | null; message: string; messageAuthor: string | null } | null>(
    null
  );
  const soundRef = useRef<Sound | null>(null);
  const checkInFlightRef = useRef(false);
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    if (!user) return undefined;
    let cancelled = false;

    const runCheck = async () => {
      // The mount effect below and the Dashboard's useFocusEffect
      // (triggerFestivalGreetingRecheck) both fire on cold start, milliseconds
      // apart — without this guard, both calls race past the AsyncStorage
      // dedup check before either finishes, so both decide to show and both
      // set `data` to a fresh object, re-running the audio effect twice and
      // briefly overlapping two Sound instances (heard as a "double" clip).
      if (checkInFlightRef.current) return;
      checkInFlightRef.current = true;
      try {
        const res = await getActiveFestivalGreeting();
        if (cancelled || !res.data.active) return;

        // Video greetings (VideoUrl set on the row) re-show on EVERY check for
        // everyone, admin or employee — no dedup bookkeeping at all, matching
        // the "every time they open the app" request these are built for.
        // Admins additionally get the same no-cap treatment for plain
        // image+audio greetings too (their own separate earlier request, so
        // they can pop it open to show a colleague repeatedly). Employees
        // keep the capped/windowed behavior below for image+audio greetings.
        if (!res.data.videoUrl && user.mode !== 'admin') {
          const identity = `employee:${user.empUserId ?? 'unknown'}`;
          const win = currentWindow();
          const keyBase = `apna_payroll_festival_greeting:${res.data.festivalGreetingId}:${identity}:${todayYmd()}:${win}`;

          if (win === 'morning') {
            const countRaw = await AsyncStorage.getItem(keyBase);
            const count = countRaw ? parseInt(countRaw, 10) || 0 : 0;
            if (count >= MORNING_WINDOW_MAX_SHOWS) return;
            await AsyncStorage.setItem(keyBase, String(count + 1));
          } else {
            const alreadyShown = await AsyncStorage.getItem(keyBase);
            if (alreadyShown) return;
            await AsyncStorage.setItem(keyBase, '1');
          }
        }

        setData({
          title: res.data.title,
          imageUrl: res.data.imageUrl,
          audioUrl: res.data.audioUrl,
          videoUrl: res.data.videoUrl,
          message: res.data.message,
          messageAuthor: res.data.messageAuthor,
        });
        setVisible(true);
      } catch {
        /* best-effort — a failed fetch just means no greeting this check, never blocks the app */
      } finally {
        checkInFlightRef.current = false;
      }
    };

    runCheck();
    recheckHandler = runCheck;

    return () => {
      cancelled = true;
      recheckHandler = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.mode]);

  useEffect(() => {
    if (!visible || !data || data.videoUrl) return undefined; // video mode plays its own embedded audio

    const audioUrl = resolveFileUrl(data.audioUrl);
    if (!audioUrl) return undefined;

    const sound = new Sound(audioUrl, undefined, (err) => {
      if (err) return;
      if (user?.mode === 'admin') {
        // Admin gets the clip twice back-to-back (their own request) — the
        // second play() only fires once the first genuinely finishes, so
        // this never overlaps into the double-playback glitch fixed earlier.
        sound.play(() => sound.play());
      } else {
        sound.play();
      }
    });
    soundRef.current = sound;

    return () => {
      sound.stop(() => sound.release());
      soundRef.current = null;
    };
  }, [visible, data, user?.mode]);

  const close = () => {
    soundRef.current?.stop(() => soundRef.current?.release());
    soundRef.current = null;
    setVisible(false);
  };

  const handleShare = async () => {
    if (!data || sharing) return;
    const remoteUrl = resolveFileUrl(data.videoUrl || data.imageUrl);
    if (!remoteUrl) return;
    setSharing(true);
    try {
      await shareRemoteMedia(remoteUrl, data.videoUrl ? 'greeting.mp4' : 'greeting.jpg');
    } catch (err: any) {
      // User cancelling the share sheet also lands here (failOnCancel: false
      // avoids that specific case, but a genuine failure — e.g. offline —
      // still can) — worth a nudge since sharing is the whole point of the button.
      if (err?.message && !/cancel/i.test(err.message)) {
        Alert.alert('Could not share', 'Please try again.');
      }
    } finally {
      setSharing(false);
    }
  };

  if (!visible || !data || !user) return null;
  const name = user.name?.split(' ')?.[0] || 'there';

  if (data.videoUrl) {
    const videoUrl = resolveFileUrl(data.videoUrl)!;
    return (
      <Modal visible transparent={false} animationType="fade" onRequestClose={close}>
        <View style={styles.videoContainer}>
          <WebView source={{ html: videoHtml(videoUrl) }} style={styles.webview} allowsInlineMediaPlayback mediaPlaybackRequiresUserAction={false} />
          <Pressable style={[styles.videoCloseBtn, { top: insets.top + 12 }]} onPress={close} hitSlop={12}>
            <Icon name="x" size={18} color="#fff" />
          </Pressable>
          <Pressable style={[styles.videoShareBtn, { top: insets.top + 12 }]} onPress={handleShare} disabled={sharing} hitSlop={12}>
            {sharing ? <ActivityIndicator size="small" color="#fff" /> : <Icon name="share" size={18} color="#fff" />}
          </Pressable>
        </View>
      </Modal>
    );
  }

  return (
    <Modal visible transparent animationType="fade" onRequestClose={close}>
      <Pressable style={styles.backdrop} onPress={close}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          <Image source={{ uri: resolveFileUrl(data.imageUrl)! }} style={styles.image} resizeMode="cover" />
          <View style={styles.body}>
            <Text style={styles.greeting}>{`Happy ${data.title}, ${name}!`}</Text>
            <Text style={styles.message}>{data.message}</Text>
            {data.messageAuthor ? <Text style={styles.author}>— {data.messageAuthor}</Text> : null}
            <View style={styles.actionRow}>
              <Pressable style={[styles.closeBtn, { flex: 1 }]} onPress={close}>
                <Text style={styles.closeBtnText}>Jai Shri Krishna 🙏</Text>
              </Pressable>
              <Pressable style={styles.shareBtn} onPress={handleShare} disabled={sharing}>
                {sharing ? <ActivityIndicator size="small" color={colors.primary} /> : <Icon name="share" size={18} color={colors.primary} />}
              </Pressable>
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center', padding: spacing(2.5) },
  card: { width: '100%', maxWidth: 380, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.surface },
  image: { width: '100%', height: 220, backgroundColor: colors.background },
  body: { padding: spacing(2.5), alignItems: 'center' },
  greeting: { fontSize: 19, fontWeight: '800', color: colors.text, marginBottom: 10, textAlign: 'center' },
  message: { fontSize: 17, fontWeight: '700', color: colors.text, textAlign: 'center', lineHeight: 25, marginBottom: 4 },
  author: { fontSize: 12, color: colors.textMuted, textAlign: 'center', fontStyle: 'italic', marginBottom: spacing(2) },
  closeBtn: { backgroundColor: colors.primary, borderRadius: radius.sm, paddingVertical: 12, paddingHorizontal: 32, marginTop: spacing(1) },
  closeBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  actionRow: { flexDirection: 'row', gap: 10, marginTop: spacing(1), width: '100%', alignItems: 'stretch' },
  shareBtn: {
    width: 44,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },

  videoContainer: { flex: 1, backgroundColor: '#000' },
  webview: { flex: 1, backgroundColor: '#000' },
  videoCloseBtn: {
    position: 'absolute',
    right: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoShareBtn: {
    position: 'absolute',
    right: 62,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
