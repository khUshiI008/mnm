import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from '../../components/Icon';
import { useAuth } from '../../context/AuthContext';
import { colors, radius, shadow, spacing } from '../../theme';
import {
  createQuote,
  deleteQuote,
  getQuoteBank,
  getSchedule,
  QuoteBankItem,
  ScheduleDay,
  updateQuote,
  updateScheduledQuote,
} from '../../api/adminMorningQuoteApi';
import {
  createShayari,
  deleteShayari,
  getShayariBank,
  getShayariSchedule,
  ShayariBankItem,
  ShayariScheduleDay,
  updateShayari,
  updateScheduledShayari,
} from '../../api/adminShayariApi';

const A = colors.admin;

function dayLabel(dateStr: string) {
  const d = new Date(`${dateStr}T00:00:00`);
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short' });
}

type EditTarget =
  | { kind: 'schedule'; date: string; text: string; author?: string }
  | { kind: 'bank'; id: number | null; text: string; author?: string };

/**
 * Settings > Quotes — visible only to the one special admin (see AdminSidebar.tsx's
 * gate). Two tabs: the employee morning-quote bank + schedule (unchanged from
 * before), and this admin's own shayari bank + schedule (new — author field,
 * same auto-planned-week pattern). No .NET source; mobile-only.
 */
export default function MorningQuotesScreen() {
  const { user } = useAuth();
  const [tab, setTab] = useState<'quotes' | 'shayari'>('quotes');

  // Defense-in-depth — the real gate is server-side (every /admin/morning-quotes
  // and /admin/admin-shayari route requires requireSpecialAdmin) and the sidebar
  // never links here for anyone else, but this keeps the screen inert even if
  // something else ever navigates here directly.
  if (!user?.isSpecialAdmin) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyText}>Not available.</Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.tabBar}>
        <Pressable style={[styles.tabBtn, tab === 'quotes' && styles.tabBtnActive]} onPress={() => setTab('quotes')}>
          <Text style={[styles.tabText, tab === 'quotes' && styles.tabTextActive]}>Employee Quotes</Text>
        </Pressable>
        <Pressable style={[styles.tabBtn, tab === 'shayari' && styles.tabBtnActive]} onPress={() => setTab('shayari')}>
          <Text style={[styles.tabText, tab === 'shayari' && styles.tabTextActive]}>Your Shayari</Text>
        </Pressable>
      </View>
      {tab === 'quotes' ? <QuotesTab /> : <ShayariTab />}
    </View>
  );
}

function QuotesTab() {
  const [schedule, setSchedule] = useState<ScheduleDay[]>([]);
  const [bank, setBank] = useState<QuoteBankItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editTarget, setEditTarget] = useState<EditTarget | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [schedRes, bankRes] = await Promise.all([getSchedule(), getQuoteBank()]);
      setSchedule(schedRes.data.schedule);
      setBank(bankRes.data.quotes);
    } catch {
      Alert.alert('Could not load', 'Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleSaveEdit = async (text: string) => {
    if (!editTarget) return;
    const trimmed = text.trim();
    if (!trimmed) {
      Alert.alert('Enter some text first.');
      return;
    }
    setSaving(true);
    try {
      if (editTarget.kind === 'schedule') {
        await updateScheduledQuote(editTarget.date, trimmed);
      } else if (editTarget.id != null) {
        await updateQuote(editTarget.id, trimmed);
      } else {
        await createQuote(trimmed);
      }
      setEditTarget(null);
      await load();
    } catch (err: any) {
      Alert.alert('Could not save', err?.response?.data?.message || 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteQuote = (item: QuoteBankItem) => {
    Alert.alert('Remove this quote?', 'It will no longer be picked for future days.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteQuote(item.quoteId);
            await load();
          } catch {
            Alert.alert('Could not remove', 'Please try again.');
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={A.primary} />
      </View>
    );
  }

  return (
    <>
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <Text style={styles.sectionTitle}>Upcoming 7 Days</Text>
        <Text style={styles.sectionSub}>What each employee sees the first time they open the app that day (plus a real push at 8 AM). Auto-planned — edit any day before it arrives.</Text>
        {schedule.map((day) => (
          <View key={day.date} style={styles.dayCard}>
            <View style={styles.dayCardHead}>
              <Text style={styles.dayCardDate}>
                {dayLabel(day.date)} {day.isToday && <Text style={styles.todayTag}>· TODAY</Text>}
              </Text>
              {day.isEdited && <Text style={styles.editedTag}>Edited</Text>}
            </View>
            <Text style={styles.dayCardText}>{day.text}</Text>
            <Pressable style={styles.editLink} onPress={() => setEditTarget({ kind: 'schedule', date: day.date, text: day.text })}>
              <Text style={styles.editLinkText}>✎ Edit</Text>
            </Pressable>
          </View>
        ))}

        <View style={styles.bankHeaderRow}>
          <View>
            <Text style={styles.sectionTitle}>Quote Bank</Text>
            <Text style={styles.sectionSub}>The pool auto-planning picks from — {bank.length} active quote(s).</Text>
          </View>
          <Pressable style={styles.addBtn} onPress={() => setEditTarget({ kind: 'bank', id: null, text: '' })}>
            <Text style={styles.addBtnText}>+ Add</Text>
          </Pressable>
        </View>

        <FlatList
          data={bank}
          keyExtractor={(q) => String(q.quoteId)}
          scrollEnabled={false}
          ListEmptyComponent={<Text style={styles.emptyText}>No quotes yet — add the first one above.</Text>}
          renderItem={({ item }) => (
            <View style={styles.bankRow}>
              <Text style={styles.bankRowText}>{item.text}</Text>
              <View style={styles.bankRowActions}>
                <Pressable onPress={() => setEditTarget({ kind: 'bank', id: item.quoteId, text: item.text })} hitSlop={8}>
                  <Text style={styles.bankEditGlyph}>✎</Text>
                </Pressable>
                <Pressable onPress={() => handleDeleteQuote(item)} hitSlop={8} style={{ marginLeft: 14 }}>
                  <Icon name="x" size={15} color="#b91c1c" />
                </Pressable>
              </View>
            </View>
          )}
        />
      </ScrollView>

      {editTarget && (
        <EditModal
          initialText={editTarget.text}
          showAuthor={false}
          title={editTarget.kind === 'schedule' ? `Edit — ${dayLabel(editTarget.date)}` : editTarget.id != null ? 'Edit Quote' : 'Add Quote'}
          saving={saving}
          onCancel={() => setEditTarget(null)}
          onSave={handleSaveEdit}
        />
      )}
    </>
  );
}

function ShayariTab() {
  const [schedule, setSchedule] = useState<ShayariScheduleDay[]>([]);
  const [bank, setBank] = useState<ShayariBankItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editTarget, setEditTarget] = useState<EditTarget | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [schedRes, bankRes] = await Promise.all([getShayariSchedule(), getShayariBank()]);
      setSchedule(schedRes.data.schedule);
      setBank(bankRes.data.shayari);
    } catch {
      Alert.alert('Could not load', 'Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleSaveEdit = async (text: string, author: string) => {
    if (!editTarget) return;
    const trimmed = text.trim();
    if (!trimmed) {
      Alert.alert('Enter some text first.');
      return;
    }
    setSaving(true);
    try {
      if (editTarget.kind === 'schedule') {
        await updateScheduledShayari(editTarget.date, trimmed, author);
      } else if (editTarget.id != null) {
        await updateShayari(editTarget.id, trimmed, author);
      } else {
        await createShayari(trimmed, author);
      }
      setEditTarget(null);
      await load();
    } catch (err: any) {
      Alert.alert('Could not save', err?.response?.data?.message || 'Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteShayari = (item: ShayariBankItem) => {
    Alert.alert('Remove this sher?', 'It will no longer be picked for future days.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteShayari(item.shayariId);
            await load();
          } catch {
            Alert.alert('Could not remove', 'Please try again.');
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={A.primary} />
      </View>
    );
  }

  return (
    <>
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <Text style={styles.sectionTitle}>Upcoming 7 Days</Text>
        <Text style={styles.sectionSub}>What you see each morning (in-app + a real push at 8 AM) — not shown to any other admin. Auto-planned — edit any day before it arrives.</Text>
        {schedule.map((day) => (
          <View key={day.date} style={styles.dayCard}>
            <View style={styles.dayCardHead}>
              <Text style={styles.dayCardDate}>
                {dayLabel(day.date)} {day.isToday && <Text style={styles.todayTag}>· TODAY</Text>}
              </Text>
              {day.isEdited && <Text style={styles.editedTag}>Edited</Text>}
            </View>
            <Text style={styles.dayCardText}>{day.text}</Text>
            {day.author ? <Text style={styles.dayCardAuthor}>— {day.author}</Text> : null}
            <Pressable style={styles.editLink} onPress={() => setEditTarget({ kind: 'schedule', date: day.date, text: day.text, author: day.author })}>
              <Text style={styles.editLinkText}>✎ Edit</Text>
            </Pressable>
          </View>
        ))}

        <View style={styles.bankHeaderRow}>
          <View>
            <Text style={styles.sectionTitle}>Shayari Bank</Text>
            <Text style={styles.sectionSub}>The pool auto-planning picks from — {bank.length} active sher(s).</Text>
          </View>
          <Pressable style={styles.addBtn} onPress={() => setEditTarget({ kind: 'bank', id: null, text: '', author: '' })}>
            <Text style={styles.addBtnText}>+ Add</Text>
          </Pressable>
        </View>

        <FlatList
          data={bank}
          keyExtractor={(q) => String(q.shayariId)}
          scrollEnabled={false}
          ListEmptyComponent={<Text style={styles.emptyText}>No shers yet — add the first one above.</Text>}
          renderItem={({ item }) => (
            <View style={styles.bankRow}>
              <View style={{ flex: 1, marginRight: 10 }}>
                <Text style={styles.bankRowText}>{item.text}</Text>
                {item.author ? <Text style={styles.bankRowAuthor}>— {item.author}</Text> : null}
              </View>
              <View style={styles.bankRowActions}>
                <Pressable onPress={() => setEditTarget({ kind: 'bank', id: item.shayariId, text: item.text, author: item.author })} hitSlop={8}>
                  <Text style={styles.bankEditGlyph}>✎</Text>
                </Pressable>
                <Pressable onPress={() => handleDeleteShayari(item)} hitSlop={8} style={{ marginLeft: 14 }}>
                  <Icon name="x" size={15} color="#b91c1c" />
                </Pressable>
              </View>
            </View>
          )}
        />
      </ScrollView>

      {editTarget && (
        <EditModal
          initialText={editTarget.text}
          initialAuthor={editTarget.author || ''}
          showAuthor
          title={editTarget.kind === 'schedule' ? `Edit — ${dayLabel(editTarget.date)}` : editTarget.id != null ? 'Edit Sher' : 'Add Sher'}
          saving={saving}
          onCancel={() => setEditTarget(null)}
          onSave={handleSaveEdit}
        />
      )}
    </>
  );
}

function EditModal({
  initialText,
  initialAuthor,
  showAuthor,
  title,
  saving,
  onCancel,
  onSave,
}: {
  initialText: string;
  initialAuthor?: string;
  showAuthor: boolean;
  title: string;
  saving: boolean;
  onCancel: () => void;
  onSave: (text: string, author: string) => void;
}) {
  const insets = useSafeAreaInsets();
  const [text, setText] = useState(initialText);
  const [author, setAuthor] = useState(initialAuthor || '');

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onCancel}>
      <Pressable style={styles.modalBackdrop} onPress={onCancel}>
        <Pressable style={[styles.modalBox, { paddingBottom: spacing(2.5) + insets.bottom }]} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.modalTitle}>{title}</Text>
          <TextInput
            style={styles.modalInput}
            value={text}
            onChangeText={setText}
            multiline
            numberOfLines={4}
            maxLength={500}
            placeholder={showAuthor ? 'शेर लिखें…' : 'Chalo, ek aur din…'}
            placeholderTextColor={A.muted}
          />
          <Text style={styles.charCount}>{text.length}/500</Text>
          {showAuthor && (
            <TextInput
              style={styles.modalAuthorInput}
              value={author}
              onChangeText={setAuthor}
              maxLength={100}
              placeholder="शायर का नाम (जैसे मिर्ज़ा ग़ालिब)"
              placeholderTextColor={A.muted}
            />
          )}
          <View style={styles.modalActions}>
            <Pressable style={[styles.modalBtn, styles.modalBtnOutline]} onPress={onCancel} disabled={saving}>
              <Text style={styles.modalBtnOutlineText}>Cancel</Text>
            </Pressable>
            <Pressable style={[styles.modalBtn, styles.modalBtnPrimary]} onPress={() => onSave(text, author)} disabled={saving}>
              {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.modalBtnPrimaryText}>Save</Text>}
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: A.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: A.bg },
  content: { padding: spacing(2), paddingBottom: spacing(5) },

  tabBar: { flexDirection: 'row', backgroundColor: A.surface, borderBottomWidth: 1, borderBottomColor: A.border },
  tabBtn: { flex: 1, paddingVertical: 14, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabBtnActive: { borderBottomColor: A.primary },
  tabText: { fontSize: 13, fontWeight: '700', color: A.muted },
  tabTextActive: { color: A.primary },

  sectionTitle: { fontSize: 15, fontWeight: '800', color: A.ink },
  sectionSub: { fontSize: 12, color: A.muted, marginTop: 2, marginBottom: spacing(1.5) },

  dayCard: { backgroundColor: A.surface, borderRadius: radius.md, padding: 12, marginBottom: 8, ...shadow.card },
  dayCardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  dayCardDate: { fontSize: 12, fontWeight: '800', color: A.ink },
  todayTag: { color: A.primary },
  editedTag: { fontSize: 10, fontWeight: '700', color: '#a16207', backgroundColor: '#fef3c7', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  dayCardText: { fontSize: 13, color: A.ink, lineHeight: 19 },
  dayCardAuthor: { fontSize: 11, color: A.muted, fontStyle: 'italic', marginTop: 2 },
  editLink: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8, alignSelf: 'flex-start' },
  editLinkText: { fontSize: 12, fontWeight: '700', color: A.primary },

  bankHeaderRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginTop: spacing(2) },
  addBtn: { backgroundColor: A.primary, borderRadius: radius.sm, paddingHorizontal: 14, paddingVertical: 8 },
  addBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  emptyText: { fontSize: 12, color: A.muted, textAlign: 'center', paddingVertical: 20 },

  bankRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: A.surface, borderRadius: radius.sm, padding: 12, marginBottom: 8, ...shadow.card },
  bankRowText: { flex: 1, fontSize: 13, color: A.ink, lineHeight: 19, marginRight: 10 },
  bankRowAuthor: { fontSize: 11, color: A.muted, fontStyle: 'italic', marginTop: 2 },
  bankRowActions: { flexDirection: 'row', alignItems: 'center' },
  bankEditGlyph: { fontSize: 15, color: A.muted },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(15,13,35,0.5)', justifyContent: 'flex-end' },
  modalBox: { backgroundColor: A.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: spacing(2.5) },
  modalTitle: { fontSize: 15, fontWeight: '800', color: A.ink, marginBottom: 12 },
  modalInput: { borderWidth: 1, borderColor: A.border, borderRadius: 10, padding: 12, fontSize: 14, color: A.ink, minHeight: 90, textAlignVertical: 'top' },
  modalAuthorInput: { borderWidth: 1, borderColor: A.border, borderRadius: 10, padding: 12, fontSize: 13, color: A.ink, marginTop: 10 },
  charCount: { fontSize: 10, color: A.muted, textAlign: 'right', marginTop: 4 },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: spacing(1.5) },
  modalBtn: { flex: 1, borderRadius: radius.sm, paddingVertical: 12, alignItems: 'center' },
  modalBtnOutline: { borderWidth: 1, borderColor: A.border },
  modalBtnOutlineText: { color: A.ink, fontWeight: '700', fontSize: 13 },
  modalBtnPrimary: { backgroundColor: A.primary },
  modalBtnPrimaryText: { color: '#fff', fontWeight: '700', fontSize: 13 },
});
