import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Linking, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Icon from '../Icon';
import { colors, radius, spacing } from '../../theme';
import { resolveFileUrl } from '../../utils/fileUrl';
import { CheckInSelfie, getEmployeeCheckInSelfie } from '../../api/adminDashboardApi';

const A = colors.admin;

type Props = {
  visible: boolean;
  employeeId: number;
  onClose: () => void;
};

/** Opens the captured lat/lng in the device's map app (Google Maps on Android, falls back to a browser if none is installed). */
function openInMaps(latitude: number, longitude: number) {
  Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`).catch(() => {});
}

/** Same shell as BreakSelfieViewerModal, but for today's single check-in selfie — used from the "Arrived Today" drill-down. */
export default function CheckInSelfieViewerModal({ visible, employeeId, onClose }: Props) {
  const [loading, setLoading] = useState(false);
  const [employeeName, setEmployeeName] = useState('');
  const [dateDisplay, setDateDisplay] = useState('');
  const [selfie, setSelfie] = useState<CheckInSelfie | null>(null);
  const [found, setFound] = useState(true);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    setLoading(true);
    getEmployeeCheckInSelfie(employeeId)
      .then((res) => {
        if (cancelled) return;
        setFound(res.data.found);
        setEmployeeName(res.data.employeeName);
        setDateDisplay(res.data.dateDisplay || '');
        setSelfie(res.data.selfie);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [visible, employeeId]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title} numberOfLines={1}>
                {employeeName || 'Check-In Selfie'}
              </Text>
              {!!dateDisplay && <Text style={styles.subtitle}>{dateDisplay}</Text>}
            </View>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <Icon name="x" size={18} color={A.muted} />
            </Pressable>
          </View>

          {loading && (
            <View style={styles.loadingBox}>
              <ActivityIndicator color={A.primary} />
            </View>
          )}

          {!loading && (!found || !selfie) && (
            <Text style={styles.emptyText}>{found ? 'No check-in selfie captured today.' : 'Employee not found.'}</Text>
          )}

          {!loading && found && selfie && (
            <View style={styles.card}>
              <Image source={{ uri: resolveFileUrl(selfie.url)! }} style={styles.photo} resizeMode="cover" />
              <View style={styles.cardMeta}>
                {!!selfie.capturedAt && <Text style={styles.timeText}>{selfie.capturedAt}</Text>}
                <Pressable
                  style={styles.locRow}
                  disabled={!selfie.hasLocation}
                  onPress={() => selfie.hasLocation && openInMaps(selfie.latitude!, selfie.longitude!)}
                >
                  <Icon name="mapPin" size={12} color={selfie.hasLocation ? A.primary : A.muted} />
                  <Text style={[styles.locText, !selfie.hasLocation && styles.locTextMuted]}>
                    {selfie.hasLocation ? `${selfie.latitude?.toFixed(5)}, ${selfie.longitude?.toFixed(5)}` : 'No location'}
                  </Text>
                </Pressable>
              </View>
            </View>
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
  title: { fontSize: 15, fontWeight: '800', color: A.ink },
  subtitle: { fontSize: 12, color: A.muted, marginTop: 2 },
  closeBtn: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: A.surfaceRaised },

  loadingBox: { paddingVertical: 40, alignItems: 'center' },
  emptyText: { fontSize: 13, color: A.muted, textAlign: 'center', paddingVertical: 30 },

  card: { backgroundColor: A.surfaceRaised, borderRadius: radius.md, overflow: 'hidden' },
  photo: { width: '100%', aspectRatio: 1, backgroundColor: A.border },
  cardMeta: { padding: 10 },
  timeText: { fontSize: 12, color: A.muted, fontWeight: '600' },
  locRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  locText: { fontSize: 11, color: A.primary, fontWeight: '600' },
  locTextMuted: { color: A.muted },
});
