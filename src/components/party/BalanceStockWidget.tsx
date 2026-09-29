import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '../../theme';
import {
  getBalanceStockSummary,
  getBalanceStockDrillRows,
  getArticleBalance,
  BalanceStockSummaryResponse,
  DrillFilters,
  DrillLeafRow,
  ArticleBalanceResponse,
} from '../../api/partyBalanceStockDrillApi';

const P = colors.party;
type Kind = 'stock' | 'sold' | 'salereturn';
type Level = 'departments' | 'sessions' | 'categories' | 'articles' | 'articleDetail';
type Branch = 'brs' | 'ghm';
const isOthers = (v?: string) => !!v && v.startsWith('Others (');

/**
 * Node port of the Dashboard's embedded Balance Stock drill-down card
 * (BalanceStockSummary/BalanceStockDrillRows/ArticleBalanceRows.ashx) — a
 * 5-level tree (Branch -> Department -> Session -> Category -> Article),
 * shared generically across Stock/Sold/Sale-Return via the `kind` toggle.
 */
export default function BalanceStockWidget({ filters, previewPartyId }: { filters: DrillFilters; previewPartyId?: number }) {
  const [kind, setKind] = useState<Kind>('stock');
  const [branch, setBranch] = useState<Branch>('brs');
  const [summary, setSummary] = useState<BalanceStockSummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const [level, setLevel] = useState<Level>('departments');
  const [department, setDepartment] = useState<string | undefined>();
  const [session, setSession] = useState<string | undefined>();
  const [category, setCategory] = useState<string | undefined>();
  const [articleNo, setArticleNo] = useState<string | undefined>();
  const [drillRows, setDrillRows] = useState<DrillLeafRow[] | null>(null);
  const [articleDetail, setArticleDetail] = useState<ArticleBalanceResponse | null>(null);
  const [drillLoading, setDrillLoading] = useState(false);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const res = await getBalanceStockSummary(filters, previewPartyId);
        setSummary(res.data);
        if (res.data.brandOptions.length) {
          // Keep whichever branch already has data if the party is single-branch.
        }
      } catch {
        Alert.alert('Could not load Balance Stock');
      } finally {
        setLoading(false);
      }
    })();
    resetDrill();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, previewPartyId]);

  const resetDrill = () => {
    setLevel('departments');
    setDepartment(undefined);
    setSession(undefined);
    setCategory(undefined);
    setArticleNo(undefined);
    setDrillRows(null);
    setArticleDetail(null);
  };

  const changeKind = (k: Kind) => {
    setKind(k);
    resetDrill();
  };
  const changeBranch = (b: Branch) => {
    setBranch(b);
    resetDrill();
  };

  const goBack = () => {
    if (level === 'articleDetail') {
      setArticleDetail(null);
      setArticleNo(undefined);
      setLevel('articles');
    } else if (level === 'articles') {
      setDrillRows(null);
      setCategory(undefined);
      setLevel('categories');
    } else if (level === 'categories') {
      setSession(undefined);
      setLevel('sessions');
    } else if (level === 'sessions') {
      setDepartment(undefined);
      setLevel('departments');
    }
  };

  const openSessions = (dept: string) => {
    if (isOthers(dept)) return;
    setDepartment(dept);
    setLevel('sessions');
  };
  const openCategories = (sess: string) => {
    if (isOthers(sess)) return;
    setSession(sess);
    setLevel('categories');
  };
  const openArticles = async (cat: string) => {
    if (isOthers(cat) || !department || !session) return;
    setCategory(cat);
    setLevel('articles');
    setDrillLoading(true);
    try {
      const res = await getBalanceStockDrillRows({ ...filters, branch, department, session, category: cat, kind }, previewPartyId);
      setDrillRows(res.data.rows);
    } catch {
      Alert.alert('Could not load items');
    } finally {
      setDrillLoading(false);
    }
  };
  const openArticleDetail = async (article: string) => {
    setArticleNo(article);
    setLevel('articleDetail');
    setDrillLoading(true);
    try {
      const res = await getArticleBalance({ ...filters, articleNo: article }, previewPartyId);
      setArticleDetail(res.data);
    } catch {
      Alert.alert('Could not load article balance');
    } finally {
      setDrillLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.card}>
        <ActivityIndicator size="large" color={P.primary} />
      </View>
    );
  }
  if (!summary || summary.notConfigured) {
    return (
      <View style={styles.card}>
        <Text style={styles.title}>Balance Stock</Text>
        <Text style={styles.emptyText}>Balance Stock branches aren't configured yet.</Text>
      </View>
    );
  }

  const metric = kind === 'stock' ? summary.stock : kind === 'sold' ? summary.sold : summary.saleReturn;
  const branchData = branch === 'brs' ? metric?.branchTree.brs : metric?.branchTree.ghm;
  const breadcrumb = [branch.toUpperCase(), department, session, category, articleNo].filter(Boolean).join(' › ');

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Balance Stock</Text>

      <View style={styles.infoRow}>
        <Text style={styles.infoChip}>Sell-through {summary.sellThroughPct}%</Text>
        <Text style={styles.infoChip}>Return {summary.saleReturnPct}%</Text>
        <Text style={styles.infoChip}>As of {summary.asOf}</Text>
      </View>

      <View style={styles.tabRow}>
        {(['stock', 'sold', 'salereturn'] as Kind[]).map((k) => (
          <Pressable key={k} style={[styles.tabBtn, kind === k && styles.tabBtnActive]} onPress={() => changeKind(k)}>
            <Text style={[styles.tabBtnText, kind === k && styles.tabBtnTextActive]}>{k === 'stock' ? 'Stock' : k === 'sold' ? 'Sold' : 'Sale Return'}</Text>
          </Pressable>
        ))}
      </View>

      {metric?.branchTree.brs && metric?.branchTree.ghm && (
        <View style={styles.tabRow}>
          {(['brs', 'ghm'] as Branch[]).map((b) => (
            <Pressable key={b} style={[styles.tabBtn, branch === b && styles.tabBtnActive]} onPress={() => changeBranch(b)}>
              <Text style={[styles.tabBtnText, branch === b && styles.tabBtnTextActive]}>{b.toUpperCase()}</Text>
            </Pressable>
          ))}
        </View>
      )}

      <View style={styles.breadcrumbRow}>
        {level !== 'departments' && (
          <Pressable onPress={goBack} style={styles.backBtn}>
            <Text style={styles.backBtnText}>‹ Back</Text>
          </Pressable>
        )}
        <Text style={styles.breadcrumbText} numberOfLines={1}>
          {breadcrumb}
        </Text>
      </View>

      {drillLoading ? (
        <ActivityIndicator size="small" color={P.primary} style={{ marginTop: spacing(2) }} />
      ) : level === 'articleDetail' && articleDetail ? (
        <ArticleDetailView data={articleDetail} />
      ) : level === 'articles' && drillRows ? (
        <ArticleListView rows={drillRows} onSelect={openArticleDetail} />
      ) : level === 'categories' && department && session ? (
        <NodeList nodes={branchData?.departments.find((d) => d.label === department)?.sessions.find((s) => s.label === session)?.categories || []} onSelect={openArticles} />
      ) : level === 'sessions' && department ? (
        <NodeList nodes={branchData?.departments.find((d) => d.label === department)?.sessions.map((s) => ({ label: s.label, qty: s.qty })) || []} onSelect={openCategories} />
      ) : (
        <NodeList nodes={branchData?.departments.map((d) => ({ label: d.label, qty: d.qty })) || []} onSelect={openSessions} />
      )}
    </View>
  );
}

function NodeList({ nodes, onSelect }: { nodes: { label: string; qty: number }[]; onSelect: (label: string) => void }) {
  if (!nodes.length) return <Text style={styles.emptyText}>No data at this level.</Text>;
  return (
    <View style={{ marginTop: spacing(1) }}>
      {nodes.map((n) => {
        const tappable = !isOthers(n.label);
        return (
          <Pressable key={n.label} style={styles.nodeRow} onPress={() => tappable && onSelect(n.label)} disabled={!tappable}>
            <Text style={styles.nodeLabel} numberOfLines={1}>
              {n.label}
            </Text>
            <Text style={styles.nodeQty}>{n.qty}</Text>
            {tappable && <Text style={styles.nodeArrow}>›</Text>}
          </Pressable>
        );
      })}
    </View>
  );
}

function ArticleListView({ rows, onSelect }: { rows: DrillLeafRow[]; onSelect: (articleNo: string) => void }) {
  if (!rows.length) return <Text style={styles.emptyText}>No articles found.</Text>;
  return (
    <View style={{ marginTop: spacing(1) }}>
      {rows.map((r, i) => (
        <Pressable key={i} style={styles.nodeRow} onPress={() => onSelect(r.articleNo)}>
          <Text style={styles.nodeLabel} numberOfLines={1}>
            {r.articleNo} {r.color ? `· ${r.color}` : ''} {r.size ? `· ${r.size}` : ''}
          </Text>
          <Text style={styles.nodeQty}>{r.qty}</Text>
          <Text style={styles.nodeArrow}>›</Text>
        </Pressable>
      ))}
    </View>
  );
}

function ArticleDetailView({ data }: { data: ArticleBalanceResponse }) {
  return (
    <View style={{ marginTop: spacing(1) }}>
      <Text style={styles.articleTotals}>
        Total {data.totalQty} (BRS {data.totalBrsQty} · GHM {data.totalGhmQty})
      </Text>
      {data.colors.map((c) => (
        <View key={c.color} style={styles.colorBlock}>
          <Text style={styles.colorTitle}>
            {c.color} — {c.qty}
          </Text>
          <View style={styles.sizeGrid}>
            {c.sizes.map((s) => (
              <View key={s.size} style={styles.sizeChip}>
                <Text style={styles.sizeChipLabel}>{s.size}</Text>
                <Text style={styles.sizeChipQty}>{s.qty}</Text>
              </View>
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: P.surface, borderRadius: radius.md, padding: 14 },
  title: { fontSize: 13.5, fontWeight: '800', color: P.ink, marginBottom: 8 },
  infoRow: { flexDirection: 'row', gap: 6, marginBottom: 10, flexWrap: 'wrap' },
  infoChip: { fontSize: 10.5, fontWeight: '700', color: P.ink, backgroundColor: P.surfaceRaised, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },

  tabRow: { flexDirection: 'row', backgroundColor: P.surfaceRaised, borderRadius: radius.sm, padding: 3, marginBottom: 8 },
  tabBtn: { flex: 1, paddingVertical: 7, borderRadius: radius.sm - 2, alignItems: 'center' },
  tabBtnActive: { backgroundColor: P.primary },
  tabBtnText: { fontSize: 11, fontWeight: '700', color: P.muted },
  tabBtnTextActive: { color: '#fff' },

  breadcrumbRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  backBtn: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: radius.sm, borderWidth: 1, borderColor: P.border },
  backBtnText: { fontSize: 11, fontWeight: '700', color: P.ink },
  breadcrumbText: { flex: 1, fontSize: 11, color: P.muted, fontWeight: '600' },

  emptyText: { fontSize: 12, color: P.muted, textAlign: 'center', marginTop: spacing(2) },

  nodeRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: P.border, gap: 8 },
  nodeLabel: { flex: 1, fontSize: 12.5, color: P.ink, fontWeight: '600' },
  nodeQty: { fontSize: 12.5, color: P.primaryDark, fontWeight: '800' },
  nodeArrow: { fontSize: 16, color: P.muted },

  articleTotals: { fontSize: 12, fontWeight: '700', color: P.ink, marginBottom: 8 },
  colorBlock: { marginBottom: 10 },
  colorTitle: { fontSize: 12, fontWeight: '800', color: P.ink, marginBottom: 6 },
  sizeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  sizeChip: { backgroundColor: P.surfaceRaised, borderRadius: radius.sm - 2, paddingHorizontal: 10, paddingVertical: 6, alignItems: 'center', minWidth: 48 },
  sizeChipLabel: { fontSize: 10, color: P.muted, fontWeight: '700' },
  sizeChipQty: { fontSize: 12.5, color: P.ink, fontWeight: '800' },
});
