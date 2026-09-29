import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '../../theme';
import {
  getPurchaseMovementSummary,
  getPurchaseMovementDetail,
  PurchaseMovementRow,
  PurchaseMovementWindow,
  PurchaseMovementDetailResponse,
  PurchaseMovementDetailDepartment,
  PurchaseMovementDetailCategory,
  PurchaseMovementDetailArticle,
} from '../../api/partyPurchaseMovementApi';

const P = colors.party;

/**
 * Node port of the Dashboard's "Purchase Movement" card
 * (PurchaseMovementSummary.ashx + PurchaseMovementAgingCalculator) — a
 * calendar-window cohort running-balance per resolved Purchase Moving
 * Session (NOT a per-unit FIFO engine, unlike FastMovingWidget). Shown as
 * its own full-width row right after the Fast Moving Products / Balance
 * Stock row on the Dashboard, matching the reference project's own
 * pd-pm-row placement. Tapping a window drills into
 * PurchaseMovementDetail.ashx's own Branch -> Department -> Category ->
 * Article+Color breakdown for that one window.
 */
export default function PurchaseMovementWidget({ brandId, previewPartyId }: { brandId?: number; previewPartyId?: number }) {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<PurchaseMovementRow[]>([]);
  const [notConfigured, setNotConfigured] = useState(false);
  const [branchesNotFound, setBranchesNotFound] = useState(false);
  const [asOf, setAsOf] = useState<string | undefined>();
  const [drill, setDrill] = useState<{ session: string; window: string } | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await getPurchaseMovementSummary({ brandId }, previewPartyId);
        setRows(res.data.rows || []);
        setNotConfigured(!!res.data.notConfigured);
        setBranchesNotFound(!!res.data.branchesNotFound);
        setAsOf(res.data.asOf);
      } catch {
        Alert.alert('Could not load Purchase Movement');
      } finally {
        setLoading(false);
      }
    })();
  }, [brandId, previewPartyId]);

  if (loading) {
    return (
      <View style={styles.card}>
        <ActivityIndicator size="large" color={P.primary} />
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Purchase Movement</Text>
        {!!asOf && <Text style={styles.asOf}>As of {asOf}</Text>}
      </View>

      {notConfigured ? (
        <Text style={styles.emptyText}>No Sessions have been flagged "purchase moving" yet — ask admin to configure this.</Text>
      ) : branchesNotFound ? (
        <Text style={styles.emptyText}>Purchase Movement branches aren't configured yet.</Text>
      ) : rows.length === 0 ? (
        <Text style={styles.emptyText}>No purchase movement data found.</Text>
      ) : (
        rows.map((r) => (
          <SessionCard key={r.session} row={r} onSelectWindow={(w) => setDrill({ session: r.session, window: w })} />
        ))
      )}

      {drill && (
        <DetailModal
          session={drill.session}
          windowLabel={drill.window}
          brandId={brandId}
          previewPartyId={previewPartyId}
          onClose={() => setDrill(null)}
        />
      )}
    </View>
  );
}

function SessionCard({ row, onSelectWindow }: { row: PurchaseMovementRow; onSelectWindow: (window: string) => void }) {
  return (
    <View style={styles.sessionBlock}>
      <Text style={styles.sessionTitle}>
        {row.session} {row.fromPurchase ? `· from ${row.fromPurchase}` : '· no purchase data yet'}
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View>
          <View style={styles.tableHeaderRow}>
            {['Window', 'Opening', 'Purchase', 'T.Stock', 'Sale', 'Sale%', 'T.Pur', 'T.Sale', 'B.Stock', 'T.Sale%'].map((h) => (
              <Text key={h} style={styles.tableHeaderCell}>
                {h}
              </Text>
            ))}
          </View>
          {row.windows.map((w) => (
            <WindowRow key={w.label} w={w} onPress={() => onSelectWindow(w.label)} />
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

function WindowRow({ w, onPress }: { w: PurchaseMovementWindow; onPress: () => void }) {
  return (
    <Pressable style={styles.tableRow} onPress={onPress}>
      <Text style={[styles.tableCell, styles.tableCellLabel]}>{w.label}</Text>
      <Text style={styles.tableCell}>{w.opening}</Text>
      <Text style={styles.tableCell}>{w.purchase}</Text>
      <Text style={styles.tableCell}>{w.totalStock}</Text>
      <Text style={styles.tableCell}>{w.sale}</Text>
      <Text style={styles.tableCell}>{w.salePct}%</Text>
      <Text style={styles.tableCell}>{w.cumPurchase}</Text>
      <Text style={styles.tableCell}>{w.cumSale}</Text>
      <Text style={[styles.tableCell, styles.tableCellHighlight]}>{w.cumBalance}</Text>
      <Text style={styles.tableCell}>{w.cumSalePct}%</Text>
    </Pressable>
  );
}

function DetailModal({
  session,
  windowLabel,
  brandId,
  previewPartyId,
  onClose,
}: {
  session: string;
  windowLabel: string;
  brandId?: number;
  previewPartyId?: number;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<PurchaseMovementDetailResponse | null>(null);
  const [kind, setKind] = useState<'purchase' | 'sale'>('purchase');
  const [branch, setBranch] = useState<'ghm' | 'brs'>('ghm');
  const [path, setPath] = useState<{ dept?: string; category?: string }>({});

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await getPurchaseMovementDetail({ brandId, session, window: windowLabel }, previewPartyId);
        setData(res.data);
      } catch {
        Alert.alert('Could not load details');
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, windowLabel]);

  const section = data ? (kind === 'purchase' ? data.purchase : data.sale) : null;
  const depts: PurchaseMovementDetailDepartment[] = (branch === 'ghm' ? section?.branchTree.ghm : section?.branchTree.brs) || [];
  const activeDept = path.dept ? depts.find((d) => d.department === path.dept) : undefined;
  const cats: PurchaseMovementDetailCategory[] = activeDept?.categories || [];
  const activeCat = path.category ? cats.find((c) => c.category === path.category) : undefined;
  const articles: PurchaseMovementDetailArticle[] = activeCat?.articles || [];

  const breadcrumb = [branch.toUpperCase(), path.dept, path.category].filter(Boolean).join(' › ');

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable style={styles.modalBox} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.modalTitle}>
            {session} · {windowLabel}
          </Text>
          {!!data?.fromDate && (
            <Text style={styles.modalSub}>
              {data.fromDate} – {data.toDate}
            </Text>
          )}

          {loading ? (
            <ActivityIndicator size="large" color={P.primary} style={{ marginTop: spacing(3) }} />
          ) : !section ? (
            <Text style={styles.emptyText}>No detail available.</Text>
          ) : (
            <ScrollView style={{ marginTop: spacing(1.5) }}>
              <View style={styles.tabRow}>
                {(['purchase', 'sale'] as const).map((k) => (
                  <Pressable
                    key={k}
                    style={[styles.tabBtn, kind === k && styles.tabBtnActive]}
                    onPress={() => {
                      setKind(k);
                      setPath({});
                    }}
                  >
                    <Text style={[styles.tabBtnText, kind === k && styles.tabBtnTextActive]}>{k === 'purchase' ? 'Purchase' : 'Sale'}</Text>
                  </Pressable>
                ))}
              </View>
              <Text style={styles.sectionTotal}>
                Total {section.total} (GHM {section.ghmQty} · BRS {section.brsQty})
              </Text>

              <View style={styles.tabRow}>
                {(['ghm', 'brs'] as const).map((b) => (
                  <Pressable
                    key={b}
                    style={[styles.tabBtn, branch === b && styles.tabBtnActive]}
                    onPress={() => {
                      setBranch(b);
                      setPath({});
                    }}
                  >
                    <Text style={[styles.tabBtnText, branch === b && styles.tabBtnTextActive]}>{b.toUpperCase()}</Text>
                  </Pressable>
                ))}
              </View>

              <View style={styles.breadcrumbRow}>
                {(path.dept || path.category) && (
                  <Pressable
                    onPress={() => setPath((p) => (p.category ? { dept: p.dept } : {}))}
                    style={styles.backBtn}
                  >
                    <Text style={styles.backBtnText}>‹ Back</Text>
                  </Pressable>
                )}
                <Text style={styles.breadcrumbText} numberOfLines={1}>
                  {breadcrumb}
                </Text>
              </View>

              {!path.dept ? (
                <NodeList items={depts.map((d) => ({ label: d.department, qty: d.qty }))} onSelect={(label) => setPath({ dept: label })} />
              ) : !path.category ? (
                <NodeList items={cats.map((c) => ({ label: c.category, qty: c.qty }))} onSelect={(label) => setPath((p) => ({ ...p, category: label }))} />
              ) : (
                <ArticleList articles={articles} />
              )}
            </ScrollView>
          )}

          <Pressable style={styles.doneBtn} onPress={onClose}>
            <Text style={styles.doneBtnText}>Close</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function NodeList({ items, onSelect }: { items: { label: string; qty: number }[]; onSelect: (label: string) => void }) {
  if (!items.length) return <Text style={styles.emptyText}>No data at this level.</Text>;
  return (
    <View style={{ marginTop: spacing(1) }}>
      {items.map((n) => (
        <Pressable key={n.label} style={styles.nodeRow} onPress={() => onSelect(n.label)}>
          <Text style={styles.nodeLabel} numberOfLines={1}>
            {n.label}
          </Text>
          <Text style={styles.nodeQty}>{n.qty}</Text>
          <Text style={styles.nodeArrow}>›</Text>
        </Pressable>
      ))}
    </View>
  );
}

function ArticleList({ articles }: { articles: PurchaseMovementDetailArticle[] }) {
  if (!articles.length) return <Text style={styles.emptyText}>No articles found.</Text>;
  return (
    <View style={{ marginTop: spacing(1) }}>
      {articles.map((a, i) => (
        <View key={i} style={styles.articleBlock}>
          <View style={styles.nodeRow}>
            <Text style={styles.nodeLabel} numberOfLines={1}>
              {a.articleNo} {a.color ? `· ${a.color}` : ''}
            </Text>
            <Text style={styles.nodeQty}>{a.qty}</Text>
          </View>
          {a.rows.slice(0, 5).map((r, ri) => (
            <View key={ri} style={styles.detailRow}>
              <Text style={styles.detailRowText}>
                {r.reference} · {r.date || '—'}
              </Text>
              <Text style={styles.detailRowQty}>{r.qty}</Text>
            </View>
          ))}
          {a.rows.length > 5 && <Text style={styles.moreRowsText}>+{a.rows.length - 5} more</Text>}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: P.surface, borderRadius: radius.md, padding: 14 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  title: { fontSize: 13.5, fontWeight: '800', color: P.ink },
  asOf: { fontSize: 10.5, color: P.muted, fontWeight: '600' },
  emptyText: { fontSize: 12, color: P.muted, textAlign: 'center', marginTop: spacing(2) },

  sessionBlock: { marginBottom: spacing(2) },
  sessionTitle: { fontSize: 12.5, fontWeight: '700', color: P.ink, marginBottom: 6 },

  tableHeaderRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: P.border, paddingBottom: 6, marginBottom: 4 },
  tableHeaderCell: { width: 66, fontSize: 9.5, fontWeight: '700', color: P.muted, textAlign: 'right' },
  tableRow: { flexDirection: 'row', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: P.border },
  tableCell: { width: 66, fontSize: 11, color: P.ink, fontWeight: '600', textAlign: 'right' },
  tableCellLabel: { textAlign: 'left', fontWeight: '800' },
  tableCellHighlight: { color: P.primaryDark, fontWeight: '800' },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(15,13,35,0.5)', justifyContent: 'flex-end' },
  modalBox: { maxHeight: '85%', backgroundColor: P.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: spacing(2.5) },
  modalTitle: { fontSize: 15, fontWeight: '800', color: P.ink },
  modalSub: { fontSize: 11, color: P.muted, marginTop: 2 },

  tabRow: { flexDirection: 'row', backgroundColor: P.surfaceRaised, borderRadius: radius.sm, padding: 3, marginBottom: 8 },
  tabBtn: { flex: 1, paddingVertical: 7, borderRadius: radius.sm - 2, alignItems: 'center' },
  tabBtnActive: { backgroundColor: P.primary },
  tabBtnText: { fontSize: 11, fontWeight: '700', color: P.muted },
  tabBtnTextActive: { color: '#fff' },

  sectionTotal: { fontSize: 12, fontWeight: '700', color: P.ink, marginBottom: 8 },

  breadcrumbRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  backBtn: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: radius.sm, borderWidth: 1, borderColor: P.border },
  backBtnText: { fontSize: 11, fontWeight: '700', color: P.ink },
  breadcrumbText: { flex: 1, fontSize: 11, color: P.muted, fontWeight: '600' },

  nodeRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: P.border, gap: 8 },
  nodeLabel: { flex: 1, fontSize: 12.5, color: P.ink, fontWeight: '600' },
  nodeQty: { fontSize: 12.5, color: P.primaryDark, fontWeight: '800' },
  nodeArrow: { fontSize: 16, color: P.muted },

  articleBlock: { marginBottom: 6 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4, paddingLeft: 12 },
  detailRowText: { fontSize: 10.5, color: P.muted },
  detailRowQty: { fontSize: 10.5, color: P.ink, fontWeight: '700' },
  moreRowsText: { fontSize: 10, color: P.muted, paddingLeft: 12, fontStyle: 'italic' },

  doneBtn: { marginTop: spacing(2), backgroundColor: P.primary, borderRadius: radius.sm, paddingVertical: 12, alignItems: 'center' },
  doneBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
});
