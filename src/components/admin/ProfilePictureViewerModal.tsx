import React from 'react';
import { Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Icon from '../Icon';
import { colors, radius, spacing } from '../../theme';
import { resolveFileUrl } from '../../utils/fileUrl';

const A = colors.admin;

type Props = {
  visible: boolean;
  employeeName: string;
  profilePictureUrl: string | null;
  onClose: () => void;
};

/**
 * Same shell as CheckInSelfieViewerModal, but for the employee's stored
 * profile picture instead of today's check-in selfie. No fetch of its own —
 * the caller (DrillDownListScreen) already has the URL from the bulk
 * getEmployeePhotos lookup, so opening this is instant.
 */
export default function ProfilePictureViewerModal({ visible, employeeName, profilePictureUrl, onClose }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.header}>
            <Text style={styles.title} numberOfLines={1}>
              {employeeName || 'Profile Picture'}
            </Text>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <Icon name="x" size={18} color={A.muted} />
            </Pressable>
          </View>

          {profilePictureUrl ? (
            <Image source={{ uri: resolveFileUrl(profilePictureUrl)! }} style={styles.photo} resizeMode="cover" />
          ) : (
            <Text style={styles.emptyText}>No profile picture uploaded.</Text>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(15,15,35,0.6)', justifyContent: 'center', padding: spacing(2) },
  sheet: { backgroundColor: A.surface, borderRadius: radius.lg, padding: 16, maxHeight: '85%' },

  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  title: { flex: 1, fontSize: 15, fontWeight: '800', color: A.ink },
  closeBtn: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: A.surfaceRaised },

  photo: { width: '100%', aspectRatio: 1, borderRadius: radius.md, backgroundColor: A.border },
  emptyText: { fontSize: 13, color: A.muted, textAlign: 'center', paddingVertical: 30 },
});
