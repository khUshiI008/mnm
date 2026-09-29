import React, { useEffect } from 'react';
import { Modal, Pressable, StyleSheet, Text } from 'react-native';
import { colors, radius, shadow } from '../theme';
import ConfettiBurst from './ConfettiBurst';

const AUTO_CLOSE_MS = 25000;

type Props = { visible: boolean; name: string; onClose: () => void };

/**
 * Mirrors BirthdayModal's shape/timing — same 25s auto-close — but for the
 * marital anniversary celebration (Employee.AnniversaryDate + MaritalStatus
 * = 'Married', see anniversaryService.js).
 */
export default function AnniversaryModal({ visible, name, onClose }: Props) {
  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(onClose, AUTO_CLOSE_MS);
    return () => clearTimeout(timer);
  }, [visible, onClose]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          <Pressable style={styles.closeBtn} onPress={onClose} hitSlop={8}>
            <Text style={styles.closeText}>×</Text>
          </Pressable>
          <Text style={styles.emoji}>💍🎉💐</Text>
          <Text style={styles.title}>Happy Anniversary, {name}!</Text>
          <Text style={styles.wish}>
            Apna Payroll app aur poori team ki taraf se aapko aur aapke partner ko shaadi ki saalgirah ki bahut bahut
            badhaai! Yeh saal aapke liye pyaar aur khushiyaan lekar aaye. Enjoy your special day! 🎊✨
          </Text>
        </Pressable>
        <ConfettiBurst active={visible} />
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: 28,
    alignItems: 'center',
    ...shadow.card,
  },
  closeBtn: { position: 'absolute', top: 10, right: 14, width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  closeText: { fontSize: 22, color: colors.textMuted, lineHeight: 24 },
  emoji: { fontSize: 40, marginBottom: 8 },
  title: { fontSize: 20, fontWeight: '800', color: colors.text, textAlign: 'center', marginBottom: 12 },
  wish: { fontSize: 14, color: colors.textMuted, textAlign: 'center', lineHeight: 21 },
});
