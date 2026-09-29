import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Sound from 'react-native-sound';
import Icon from './Icon';
import ConfettiBurst from './ConfettiBurst';
import { resolveFileUrl } from '../utils/fileUrl';
import { shareRemoteMedia } from '../utils/shareMedia';
import { getCelebrationVideoUrl } from '../api/celebrationApi';
import { colors, radius, shadow } from '../theme';

const A = colors.admin;

Sound.setCategory('Playback');

const AUTO_CLOSE_MS = 25000;

type CelebrationType = 'Birthday' | 'Anniversary';
type Shown = { type: CelebrationType; name: string };

// Mirrors MorningGreetingModal.tsx's forceShowHandler pattern — the
// notification-tap router calls this instead of navigating to Employee Form,
// since a bystander admin viewing someone else's birthday/anniversary wants a
// wish card, not an edit screen.
let forceShowHandler: ((s: Shown) => void) | null = null;
export function showAdminCelebrationFromNotification(s: Shown) {
  forceShowHandler?.(s);
}

const COPY: Record<CelebrationType, { emoji: string; verb: string; wish: (name: string) => string; sound: string; videoFilename: string }> = {
  Birthday: {
    emoji: '🎉🎂🎈',
    verb: 'Happy Birthday',
    wish: (name) => `${name}, aapko bahut bahut janamdin mubarak ho — from all Mom n Me members and staff! 🎊✨`,
    sound: 'happy_birthday',
    videoFilename: 'happy_birthday_wish.mp4',
  },
  Anniversary: {
    emoji: '💍🎉💐',
    verb: 'Happy Anniversary',
    wish: (name) => `${name}, aapko shaadi ki saalgirah bahut bahut mubarak ho — from all Mom n Me members and staff! 🎊✨`,
    sound: 'anniversary',
    videoFilename: 'anniversary_wish.mp4',
  },
};

/**
 * Admin-facing celebration popup — tapping a Birthday/Anniversary push used
 * to jump straight to that employee's Employee Form; this replaces that with
 * a proper wish card (company-voiced, since it's shown to a bystander admin
 * rather than the celebrant), the same birthday.mp3/anniversary.mp3 already
 * bundled for the notification channels (channels.ts), and a share button so
 * the wish itself can be forwarded to a WhatsApp group/chat.
 */
export default function AdminCelebrationModal() {
  const [shown, setShown] = useState<Shown | null>(null);
  const [sharing, setSharing] = useState(false);
  const soundRef = useRef<Sound | null>(null);

  useEffect(() => {
    forceShowHandler = (s) => setShown(s);
    return () => {
      forceShowHandler = null;
    };
  }, []);

  const close = () => {
    soundRef.current?.stop(() => soundRef.current?.release());
    soundRef.current = null;
    setShown(null);
  };

  useEffect(() => {
    if (!shown) return undefined;
    const timer = setTimeout(close, AUTO_CLOSE_MS);
    const sound = new Sound(COPY[shown.type].sound, Sound.MAIN_BUNDLE, (err) => {
      if (!err) sound.play();
    });
    soundRef.current = sound;
    return () => {
      clearTimeout(timer);
      sound.stop(() => sound.release());
      soundRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shown]);

  if (!shown) return null;
  const copy = COPY[shown.type];

  const handleShare = async () => {
    if (sharing) return;
    setSharing(true);
    try {
      const res = await getCelebrationVideoUrl(shown.type, shown.name);
      const url = resolveFileUrl(res.data.url)!;
      await shareRemoteMedia(url, copy.videoFilename);
    } catch (err: any) {
      if (err?.message && !/cancel/i.test(err.message)) Alert.alert('Could not share', 'Please try again.');
    } finally {
      setSharing(false);
    }
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={close}>
      <Pressable style={styles.backdrop} onPress={close}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          <Pressable style={styles.closeBtn} onPress={close} hitSlop={8}>
            <Text style={styles.closeText}>×</Text>
          </Pressable>
          <View style={styles.captureWrap}>
            <Text style={styles.emoji}>{copy.emoji}</Text>
            <Text style={styles.title}>
              {copy.verb}, {shown.name}!
            </Text>
            <Text style={styles.wish}>{copy.wish(shown.name)}</Text>
          </View>
          <Pressable style={styles.shareBtn} onPress={handleShare} disabled={sharing}>
            {sharing ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Icon name="share" size={16} color="#fff" />
                <Text style={styles.shareBtnText}>Share</Text>
              </>
            )}
          </Pressable>
        </Pressable>
        <ConfettiBurst active={!!shown} />
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: { width: '100%', maxWidth: 360, backgroundColor: A.surface, borderRadius: radius.lg, padding: 28, alignItems: 'center', ...shadow.card },
  closeBtn: { position: 'absolute', top: 10, right: 14, width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  closeText: { fontSize: 22, color: A.muted, lineHeight: 24 },
  captureWrap: { width: '100%', alignItems: 'center', backgroundColor: A.surface },
  emoji: { fontSize: 40, marginBottom: 8 },
  title: { fontSize: 20, fontWeight: '800', color: A.ink, textAlign: 'center', marginBottom: 12 },
  wish: { fontSize: 14, color: A.muted, textAlign: 'center', lineHeight: 21, marginBottom: 18 },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: A.primary,
    borderRadius: radius.sm,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  shareBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
