import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Button from '../Button';
import { colors, radius, spacing } from '../../theme';

const A = colors.admin;

export type LeaveConflictData = {
  empName: string;
  deptName?: string;
  deptFromDisplay?: string;
  deptToDisplay?: string;
  deptConflicts: { employeeName: string; fromDateDisplay: string; toDateDisplay: string }[];
  ownOtherLeaves: { leaveTypeName: string; fromDateDisplay: string; toDateDisplay: string }[];
  // CL-quota warning — a separate condition from the department/own-leave
  // conflicts above, shown in the same confirm dialog so "Approve Anyway"
  // covers everything at once instead of confirming one warning only to
  // have a second, unrelated block fire silently underneath it.
  clQuotaExceeded?: boolean;
  clConsumed?: number;
  clQuota?: number;
  clRemaining?: number;
  clRequested?: number;
};

/**
 * Mirrors Panel/LeaveApproval/Index.aspx's department-conflict confirmation modal
 * (#hrmsLvApproveOverlay) — same warning header, amber conflict box with a proper
 * bulleted breakdown, and confirm question, instead of dumping it all into one
 * plain-text native Alert.
 */
export default function LeaveConflictModal({
  data,
  busy,
  mode = 'confirm',
  onClose,
  onConfirm,
}: {
  data: LeaveConflictData | null;
  busy: boolean;
  /** 'confirm' (default) — the approve-flow warning, asks "approve anyway?". 'details' — a neutral read-only view opened on demand, always shows both sections (even when empty), no approve action. */
  mode?: 'confirm' | 'details';
  onClose: () => void;
  onConfirm?: () => void;
}) {
  if (!data) return null;

  const hasDeptConflicts = data.deptConflicts.length > 0;
  const hasOwnConflicts = data.ownOtherLeaves.length > 0;
  const isDetails = mode === 'details';
  const hasClQuotaWarning = !isDetails && !!data.clQuotaExceeded;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.box} onPress={(e) => e.stopPropagation()}>
          <View style={styles.header}>
            <Text style={styles.icon}>{isDetails ? 'ℹ' : '⚠'}</Text>
            <Text style={styles.title}>
              {isDetails
                ? `${data.empName} — Leave Context`
                : hasDeptConflicts
                ? 'Department Already on Leave'
                : hasClQuotaWarning && !hasOwnConflicts
                ? 'CL Quota Would Be Exceeded'
                : 'Employee Already on Leave'}
            </Text>
          </View>

          <View style={styles.body}>
            {hasClQuotaWarning && (
              <Text style={[styles.para, styles.bold]}>
                {data.empName}'s CL quota ({data.clQuota} day{data.clQuota === 1 ? '' : 's'}) would be exceeded — {(data.clConsumed ?? 0).toFixed(1)} day(s)
                already consumed through absents/half-days this month, only {(data.clRemaining ?? 0).toFixed(1)} remaining, but this application requests{' '}
                {data.clRequested}.
              </Text>
            )}

            {hasDeptConflicts ? (
              <>
                <Text style={styles.para}>
                  The following <Text style={styles.bold}>{data.deptName}</Text> already on approved leave during{' '}
                  <Text style={styles.bold}>
                    {data.deptFromDisplay} – {data.deptToDisplay}
                  </Text>
                  :
                </Text>
                {data.deptConflicts.map((c, i) => (
                  <View key={i} style={styles.listRow}>
                    <Text style={styles.bullet}>{'•'}</Text>
                    <Text style={styles.listText}>
                      <Text style={styles.listName}>{c.employeeName}</Text> — {c.fromDateDisplay} to {c.toDateDisplay}
                    </Text>
                  </View>
                ))}
              </>
            ) : (
              isDetails && <Text style={styles.para}>No {data.deptName} colleagues have approved leave during {data.deptFromDisplay} – {data.deptToDisplay}.</Text>
            )}

            {hasOwnConflicts ? (
              <>
                <Text style={[styles.para, (hasDeptConflicts || isDetails) && styles.paraSpaced]}>
                  <Text style={styles.bold}>{data.empName}</Text> also already has approved leave coming up:
                </Text>
                {data.ownOtherLeaves.map((l, i) => (
                  <View key={i} style={styles.listRow}>
                    <Text style={styles.bullet}>{'•'}</Text>
                    <Text style={styles.listText}>
                      <Text style={styles.listName}>{l.leaveTypeName}</Text> — {l.fromDateDisplay} to {l.toDateDisplay}
                    </Text>
                  </View>
                ))}
              </>
            ) : (
              isDetails && (
                <Text style={[styles.para, styles.paraSpaced]}>
                  <Text style={styles.bold}>{data.empName}</Text> has no other approved leave coming up.
                </Text>
              )
            )}

            {!isDetails && <Text style={styles.question}>Do you really want to approve this leave?</Text>}
          </View>

          <View style={styles.actions}>
            {isDetails ? (
              <Button title="Close" onPress={onClose} style={{ flex: 1 }} />
            ) : (
              <>
                <Button title="Cancel" variant="outline" onPress={onClose} style={{ flex: 1 }} />
                <Button title="Approve Anyway" onPress={onConfirm!} loading={busy} style={[styles.confirmBtn, { flex: 1 }]} />
              </>
            )}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(15,13,35,0.5)', alignItems: 'center', justifyContent: 'center', padding: spacing(3) },
  box: { width: '100%', maxWidth: 460, backgroundColor: A.surface, borderRadius: radius.md, padding: spacing(2.5) },

  header: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  icon: { fontSize: 20, color: '#d97706' },
  title: { fontSize: 16, fontWeight: '800', color: '#92400e', flexShrink: 1 },

  body: { backgroundColor: '#fffbeb', borderWidth: 1, borderColor: '#fde68a', borderRadius: 10, padding: 14 },
  para: { fontSize: 13, color: '#374151', lineHeight: 19, marginBottom: 8 },
  paraSpaced: { marginTop: 10 },
  bold: { fontWeight: '700' },

  listRow: { flexDirection: 'row', gap: 6, marginBottom: 4, paddingLeft: 4 },
  bullet: { fontSize: 13, color: '#b45309', lineHeight: 18 },
  listText: { flex: 1, fontSize: 13, color: '#374151', lineHeight: 18 },
  listName: { fontWeight: '700', color: '#b45309' },

  question: { fontSize: 13, fontWeight: '700', color: '#92400e', marginTop: 10 },

  actions: { flexDirection: 'row', gap: 10, marginTop: spacing(2) },
  confirmBtn: { backgroundColor: '#d97706', borderColor: '#b45309' },
});
