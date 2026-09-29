import React, { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text } from 'react-native';
import { colors, radius, shadow, spacing } from '../theme';

type Shown = { title: string; body: string } | null;

let showHandler: ((show: Shown) => void) | null = null;

/**
 * Called when an employee taps (or is already viewing the app when) a
 * "TargetRemarks" notification arrives — an admin's optional note on a
 * target achievement (see backend/src/services/adminTargetRemarkService.js).
 * Re-shows that exact notification's own title/body, same pattern as
 * MorningGreetingModal.tsx's showAdminShayariFromNotification.
 *
 * No sound yet — a dedicated "clapping" sound is planned but the audio asset
 * doesn't exist in the repo yet; the OS push itself already plays a sound
 * via its channel (currently reusing target_completion's) regardless of
 * whether this in-app popup ever renders.
 */
export function showTargetRemarkFromNotification(show: { title: string; body: string }) {
  showHandler?.(show);
}

export default function TargetRemarkModal() {
  const [shown, setShown] = useState<Shown>(null);

  useEffect(() => {
    showHandler = setShown;
    return () => {
      showHandler = null;
    };
  }, []);

  if (!shown) return null;
  const close = () => setShown(null);

  return (
    <Modal visible transparent animationType="fade" onRequestClose={close}>
      <Pressable style={styles.backdrop} onPress={close}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.emoji}>👏</Text>
          <Text style={styles.title}>{shown.title}</Text>
          <Text style={styles.body}>{shown.body}</Text>
          <Pressable style={styles.closeBtn} onPress={close}>
            <Text style={styles.closeBtnText}>Thanks!</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center', padding: spacing(2.5) },
  card: { width: '100%', maxWidth: 360, backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing(3), alignItems: 'center', ...shadow.card },
  emoji: { fontSize: 40, marginBottom: 8 },
  title: { fontSize: 18, fontWeight: '800', color: colors.text, textAlign: 'center', marginBottom: 10 },
  body: { fontSize: 14, color: colors.textMuted, textAlign: 'center', lineHeight: 21, marginBottom: spacing(2) },
  closeBtn: { backgroundColor: colors.primary, borderRadius: radius.sm, paddingVertical: 12, paddingHorizontal: 32 },
  closeBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
});
