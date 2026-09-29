import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Linking, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from '../../components/Icon';
import { colors, radius, shadow, spacing } from '../../theme';
import { EmailDetail, EmailFilter, EmailRow, getEmailInboxDetail, getEmailInboxList, markEmailRead } from '../../api/emailInboxApi';

const A = colors.admin;

/**
 * "Email Inbox" module (Sep 2026) — shows every email ingested from the
 * Google Apps Script webhook (see backend/src/services/emailInboxService.js),
 * with this app's own rule-based importance/summary already computed
 * server-side. The user never needs to open Gmail to see this — sender,
 * subject, received time, a short summary, and whether a reply is required
 * are all shown right here.
 */
export default function EmailInboxScreen({ params }: { params?: { monitoredEmailId?: number } }) {
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = useState<EmailFilter>('important');
  const [rows, setRows] = useState<EmailRow[]>([]);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [detail, setDetail] = useState<EmailDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const load = useCallback(async (f: EmailFilter, p: number, append: boolean) => {
    try {
      const res = await getEmailInboxList(f, p);
      setRows((prev) => (append ? [...prev, ...res.data.rows] : res.data.rows));
      setTotalPages(res.data.totalPages);
      setPage(p);
    } catch {
      Alert.alert('Could not load emails', 'Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    load(filter, 0, false);
  }, [filter, load]);

  // Opened directly from a "New Important Email" push notification tap —
  // land on the list, then immediately open that specific email's detail.
  useEffect(() => {
    if (params?.monitoredEmailId) openDetail(params.monitoredEmailId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params?.monitoredEmailId]);

  const onRefresh = () => {
    setRefreshing(true);
    load(filter, 0, false);
  };

  const loadMore = () => {
    if (loadingMore || page + 1 >= totalPages) return;
    setLoadingMore(true);
    load(filter, page + 1, true);
  };

  const openDetail = async (id: number) => {
    setDetailLoading(true);
    setDetail(null);
    try {
      const res = await getEmailInboxDetail(id);
      setDetail(res.data);
      if (!res.data.isRead) {
        markEmailRead(id, true).catch(() => {});
        setRows((prev) => prev.map((r) => (r.monitoredEmailId === id ? { ...r, isRead: true } : r)));
      }
    } catch {
      Alert.alert('Could not load email', 'Please try again.');
    } finally {
      setDetailLoading(false);
    }
  };

  return (
    <View style={styles.screen}>
      <View style={styles.tabRow}>
        {(['important', 'other', 'all'] as EmailFilter[]).map((f) => (
          <Pressable key={f} style={[styles.tabBtn, filter === f && styles.tabBtnActive]} onPress={() => setFilter(f)}>
            <Text style={[styles.tabBtnText, filter === f && styles.tabBtnTextActive]}>
              {f === 'important' ? 'Important' : f === 'other' ? 'Other' : 'All'}
            </Text>
          </Pressable>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={A.primary} style={styles.loader} />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(r) => String(r.monitoredEmailId)}
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          onEndReached={loadMore}
          onEndReachedThreshold={0.4}
          ListEmptyComponent={<Text style={styles.emptyText}>No {filter === 'all' ? '' : filter} emails found.</Text>}
          ListFooterComponent={loadingMore ? <ActivityIndicator size="small" color={A.primary} style={{ marginVertical: spacing(2) }} /> : null}
          renderItem={({ item }) => <EmailCard row={item} onPress={() => openDetail(item.monitoredEmailId)} />}
        />
      )}

      <Modal visible={!!detail || detailLoading} transparent animationType="slide" onRequestClose={() => setDetail(null)}>
        <View style={styles.modalRoot}>
          {/* Backdrop is a plain sibling positioned behind modalBox, not an
              ancestor of it — a Pressable ancestor around the scrollable
              detail body intermittently steals touch-move events meant for
              its scroll gesture (worked most taps, randomly ate others). See
              the identical fix/comment in SalesReportDetailScreen.tsx. */}
          <Pressable style={[StyleSheet.absoluteFill, styles.modalBackdropFill]} onPress={() => setDetail(null)} />
          <View style={[styles.modalBox, { paddingBottom: spacing(2.5) + insets.bottom }]}>
            {detailLoading || !detail ? (
              <ActivityIndicator size="large" color={A.primary} style={{ marginVertical: spacing(4) }} />
            ) : (
              <EmailDetailView detail={detail} onClose={() => setDetail(null)} />
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

function EmailCard({ row, onPress }: { row: EmailRow; onPress: () => void }) {
  return (
    <Pressable style={[styles.card, !row.isRead && styles.cardUnread]} onPress={onPress}>
      <View style={styles.cardHeaderRow}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.senderText, !row.isRead && styles.boldText]} numberOfLines={1}>
            {row.senderName || row.senderEmail || 'Unknown sender'}
          </Text>
          <Text style={styles.sourceText} numberOfLines={1}>
            {row.sourceAccount}
          </Text>
        </View>
        {row.isImportant && (
          <View style={styles.importantBadge}>
            <Text style={styles.importantBadgeText}>IMPORTANT</Text>
          </View>
        )}
      </View>
      <Text style={[styles.subjectText, !row.isRead && styles.boldText]} numberOfLines={1}>
        {row.subject || '(no subject)'}
      </Text>
      <Text style={styles.summaryText} numberOfLines={2}>
        {row.summary}
      </Text>
      <View style={styles.cardFooterRow}>
        <Text style={styles.dateText}>{fmtDateTime(row.receivedDate)}</Text>
        {row.actionRequired && (
          <View style={styles.actionBadge}>
            <Icon name="alertCircle" size={11} color="#b91c1c" />
            <Text style={styles.actionBadgeText}>Reply required</Text>
          </View>
        )}
        {!row.isRead && <View style={styles.unreadDot} />}
      </View>
    </Pressable>
  );
}

// Gmail's web client accepts a thread id straight in the #all/ route, and
// `authuser` (by email, not just index) steers it to the right mailbox tab
// if that account happens to already be signed in on the device — best
// effort, since there's no way to know in advance which of the phone's
// signed-in Google accounts (if any) matches the monitored mailbox.
function gmailWebUrl(detail: EmailDetail) {
  if (!detail.gmailThreadId) return null;
  return `https://mail.google.com/mail/u/0/?authuser=${encodeURIComponent(detail.sourceAccount)}#all/${detail.gmailThreadId}`;
}

function EmailDetailView({ detail, onClose }: { detail: EmailDetail; onClose: () => void }) {
  const gmailUrl = gmailWebUrl(detail);

  const openInGmail = () => {
    if (!gmailUrl) return;
    Linking.openURL(gmailUrl).catch(() => Alert.alert('Could not open Gmail', 'Please try again.'));
  };

  return (
    <ScrollView showsVerticalScrollIndicator style={styles.detailScroll}>
      <View style={styles.detailHeadRow}>
        <View style={{ flex: 1 }}>
          {detail.isImportant && (
            <View style={styles.importantBadge}>
              <Text style={styles.importantBadgeText}>NEW IMPORTANT EMAIL</Text>
            </View>
          )}
          <Text style={styles.detailSubject}>{detail.subject || '(no subject)'}</Text>
        </View>
        <Pressable style={styles.modalCloseBtn} onPress={onClose}>
          <Icon name="x" size={18} color={A.ink} />
        </Pressable>
      </View>

      <Text style={styles.detailMeta}>
        From: <Text style={styles.boldText}>{detail.senderName || detail.senderEmail}</Text>
        {detail.senderName && detail.senderEmail ? ` (${detail.senderEmail})` : ''}
      </Text>
      <Text style={styles.detailMeta}>To account: {detail.sourceAccount}</Text>
      <Text style={styles.detailMeta}>Received: {fmtDateTime(detail.receivedDate)}</Text>

      {gmailUrl && (
        <Pressable style={styles.gmailBtn} onPress={openInGmail}>
          <Icon name="share" size={14} color={A.primary} />
          <Text style={styles.gmailBtnText}>Open in Gmail</Text>
        </Pressable>
      )}

      <View style={styles.summaryBox}>
        <Text style={styles.summaryBoxLabel}>Summary</Text>
        <Text style={styles.summaryBoxText}>{detail.summary}</Text>
      </View>

      {detail.actionRequired && (
        <View style={styles.actionBox}>
          <Icon name="alertCircle" size={16} color="#b91c1c" />
          <Text style={styles.actionBoxText}>Action Required: Reply required.</Text>
        </View>
      )}

      {detail.bodySnippet ? (
        <View style={styles.bodyBox}>
          <Text style={styles.bodyBoxLabel}>Full message</Text>
          <Text style={styles.bodyBoxText}>{detail.bodySnippet}</Text>
        </View>
      ) : null}
    </ScrollView>
  );
}

function fmtDateTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true });
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: A.bg },
  loader: { marginTop: spacing(4) },
  content: { padding: spacing(2) },
  emptyText: { color: A.muted, fontSize: 13, textAlign: 'center', marginTop: spacing(4) },

  tabRow: { flexDirection: 'row', gap: 8, padding: spacing(2), paddingBottom: 0 },
  tabBtn: { flex: 1, height: 40, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center', backgroundColor: A.surface, borderWidth: 1, borderColor: A.border },
  tabBtnActive: { backgroundColor: A.primary, borderColor: A.primary },
  tabBtnText: { fontSize: 13, fontWeight: '700', color: A.muted },
  tabBtnTextActive: { color: '#fff' },

  card: { backgroundColor: A.surface, borderRadius: radius.md, padding: 14, marginBottom: 12, ...shadow.card },
  cardUnread: { borderLeftWidth: 3, borderLeftColor: A.primary },
  cardHeaderRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 4 },
  senderText: { fontSize: 13.5, fontWeight: '700', color: A.ink },
  sourceText: { fontSize: 10.5, color: A.muted, marginTop: 1 },
  boldText: { fontWeight: '800' },
  subjectText: { fontSize: 13, color: A.ink, marginTop: 4 },
  summaryText: { fontSize: 12, color: A.muted, marginTop: 4, lineHeight: 17 },

  importantBadge: { backgroundColor: '#fee2e2', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  importantBadgeText: { fontSize: 9.5, fontWeight: '800', color: '#b91c1c', letterSpacing: 0.3 },

  cardFooterRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  dateText: { fontSize: 10.5, color: A.muted, flex: 1 },
  actionBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#fef2f2', paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6 },
  actionBadgeText: { fontSize: 10, fontWeight: '700', color: '#b91c1c' },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: A.primary },

  modalRoot: { flex: 1, justifyContent: 'flex-end' },
  modalBackdropFill: { backgroundColor: 'rgba(15,13,35,0.5)' },
  modalBox: { maxHeight: '90%', flexShrink: 1, backgroundColor: A.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: spacing(2.5), overflow: 'hidden' },
  modalCloseBtn: { padding: 6, borderRadius: 8, borderWidth: 1, borderColor: A.border },
  detailScroll: { flexGrow: 0 },

  gmailBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 36,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    borderColor: A.primary,
    marginTop: spacing(1),
  },
  gmailBtnText: { color: A.primary, fontWeight: '700', fontSize: 12.5 },

  detailHeadRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: spacing(1.5) },
  detailSubject: { fontSize: 16, fontWeight: '800', color: A.ink, marginTop: 6 },
  detailMeta: { fontSize: 12.5, color: A.muted, marginBottom: 4 },

  summaryBox: { backgroundColor: A.surfaceRaised, borderRadius: radius.sm, padding: 14, marginTop: spacing(1.5) },
  summaryBoxLabel: { fontSize: 11, fontWeight: '800', color: A.muted, letterSpacing: 0.4, marginBottom: 6, textTransform: 'uppercase' },
  summaryBoxText: { fontSize: 13.5, color: A.ink, lineHeight: 20 },

  actionBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fef2f2', borderRadius: radius.sm, padding: 12, marginTop: spacing(1.5) },
  actionBoxText: { fontSize: 13, fontWeight: '700', color: '#b91c1c' },

  bodyBox: { marginTop: spacing(1.5) },
  bodyBoxLabel: { fontSize: 11, fontWeight: '800', color: A.muted, letterSpacing: 0.4, marginBottom: 6, textTransform: 'uppercase' },
  bodyBoxText: { fontSize: 12.5, color: A.ink, lineHeight: 19 },
});
