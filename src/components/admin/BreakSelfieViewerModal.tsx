import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Icon from '../Icon';
import { colors, radius, spacing } from '../../theme';
import { resolveFileUrl } from '../../utils/fileUrl';
import { BreakSelfie, getEmployeeSelfies } from '../../api/adminDashboardApi';

const A = colors.admin;

type Props = {
  visible: boolean;
  employeeId: number;
  onClose: () => void;
};

/** Mirrors Panel/Dashboard.aspx's mSelfieViewer modal — today's break selfies + geolocation for one employee. */
export default function BreakSelfieViewerModal({ visible, employeeId, onClose }: Props) {
  const [loading, setLoading] = useState(false);
  const [employeeName, setEmployeeName] = useState('');
  const [dateDisplay, setDateDisplay] = useState('');
  const [selfies, setSelfies] = useState<BreakSelfie[]>([]);
  const [found, setFound] = useState(true);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    setLoading(true);
    getEmployeeSelfies(employeeId)
      .then((res) => {
        if (cancelled) return;
        setFound(res.data.found);
        setEmployeeName(res.data.employeeName);
        setDateDisplay(res.data.dateDisplay || '');
        setSelfies(res.data.selfies);
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
                {employeeName || 'Break Selfies'}
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

          {!loading && (!found || selfies.length === 0) && (
            <Text style={styles.emptyText}>{found ? 'No break selfies captured today.' : 'Employee not found.'}</Text>
          )}

          {!loading && found && selfies.length > 0 && (
            <ScrollView>
              <View style={styles.grid}>
                {selfies.map((s, i) => (
                  <View key={i} style={styles.card}>
                    <Image source={{ uri: resolveFileUrl(s.url)! }} style={styles.photo} resizeMode="cover" />
                    <View style={styles.cardMeta}>
                      <View style={styles.badgeRow}>
                        <Text style={styles.breakLabel}>Break #{s.breakNumber}</Text>
                        {s.isExcess && (
                          <View style={styles.excessPill}>
                            <Text style={styles.excessPillText}>Excess</Text>
                          </View>
                        )}
                      </View>
                      {!!s.capturedAt && <Text style={styles.timeText}>{s.capturedAt}</Text>}
                      <View style={styles.locRow}>
                        <Icon name="mapPin" size={12} color={s.hasLocation ? A.primary : A.muted} />
                        <Text style={[styles.locText, !s.hasLocation && styles.locTextMuted]}>
                          {s.hasLocation ? `${s.latitude?.toFixed(5)}, ${s.longitude?.toFixed(5)}` : 'No location'}
                        </Text>
                      </View>
                    </View>
                  </View>
                ))}
              </View>
            </ScrollView>
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

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  card: { width: '47%', backgroundColor: A.surfaceRaised, borderRadius: radius.md, overflow: 'hidden' },
  photo: { width: '100%', aspectRatio: 1, backgroundColor: A.border },
  cardMeta: { padding: 8 },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  breakLabel: { fontSize: 11, fontWeight: '800', color: A.ink },
  excessPill: { backgroundColor: '#fee2e2', borderRadius: 999, paddingHorizontal: 6, paddingVertical: 1 },
  excessPillText: { fontSize: 9, fontWeight: '800', color: '#b91c1c' },
  timeText: { fontSize: 10.5, color: A.muted, marginTop: 3, fontWeight: '600' },
  locRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 5 },
  locText: { fontSize: 9.5, color: A.primary, fontWeight: '600' },
  locTextMuted: { color: A.muted },
});
