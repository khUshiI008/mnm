import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import Card from '../../components/Card';
import Icon, { IconName } from '../../components/Icon';
import { colors, radius, shadow, spacing } from '../../theme';
import TrialGate from './TrialGate';
import { navigate } from '../../navigation/navigationRef';
import {
  getMySalesTarget,
  BarcodeIncentive,
  BillRow,
  DayTarget,
  DaySale,
  MySalesTargetResponse,
  SalesTargetCard,
  SalesTargetMode,
  SlabTier,
} from '../../api/salesTargetApi';

const E = colors.emp;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const RUN_RATE_LABEL: Record<string, string> = {
  superstar: 'Superstar pace',
  on_track: 'On track',
  needs_push: 'Needs a push',
  behind_target: 'Behind target',
};
const RUN_RATE_COLOR: Record<string, string> = {
  superstar: '#16a34a',
  on_track: '#2563eb',
  needs_push: '#d97706',
  behind_target: '#e11d48',
};

function pctColor(pct: number) {
  if (pct >= 100) return E.green;
  if (pct >= 60) return E.yellow;
  return E.red;
}
function money(n: number) {
  return `₹${Math.round(n || 0).toLocaleString('en-IN')}`;
}
function qtyStr(n: number) {
  const v = n || 0;
  return Number.isInteger(v) ? String(v) : v.toFixed(2);
}
// Qty TARGETS (never achieved qty) round up to the next whole piece for
// readability — purely cosmetic, doesn't change any hit/miss outcome (see
// SalesTarget_Calculation_Reference.md §9). Achieved qty is never rounded.
function qtyTargetDisplay(n: number) {
  return Math.ceil(n || 0);
}
function round2(n: number) {
  return Math.round(n * 100) / 100;
}
function ordinalSuffix(n: number) {
  const v = n % 100;
  if (v >= 11 && v <= 13) return 'th';
  switch (n % 10) {
    case 1:
      return 'st';
    case 2:
      return 'nd';
    case 3:
      return 'rd';
    default:
      return 'th';
  }
}
function ordinalDayLabel(dt: DayTarget) {
  const parts = dt.date.split('-');
  const day = parseInt(parts[2], 10);
  const mon = MONTHS[parseInt(parts[1], 10) - 1];
  return `${day}${ordinalSuffix(day)} ${mon} (${dt.dow})`;
}
function longDateLabel(dateIso: string) {
  const d = new Date(`${dateIso}T00:00:00`);
  return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}
// "THURSDAY" — bold-caps day name, matches .NET's `.st-today-day-name`.
function dayNameCaps(dateIso: string) {
  const d = new Date(`${dateIso}T00:00:00`);
  return d.toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase();
}
// "13 Aug 2026" — short date, matches .NET's `.st-today-date-full` companion line.
function shortDateLabel(dateIso: string) {
  const parts = dateIso.split('-');
  const day = parseInt(parts[2], 10);
  const mon = MONTHS[parseInt(parts[1], 10) - 1];
  return `${day} ${mon} ${parts[0]}`;
}
function groupByBillNo(bills: BillRow[]) {
  const map = new Map<string, BillRow[]>();
  bills.forEach((b) => {
    const k = b.no || '?';
    if (!map.has(k)) map.set(k, []);
    map.get(k)!.push(b);
  });
  return Array.from(map, ([no, rows]) => ({ no, rows, total: rows.reduce((s, r) => s + r.amount, 0) }));
}

// Groups a target's full day-target ladder into real calendar weeks aligned
// to the target's own WeekStartDay — starts a new bucket only when a day's
// weekday matches WeekStartDay, so a month that doesn't start on that weekday
// still produces a correctly partial first/last week (mirrors .NET's
// stRenderMonthContent — see SalesTarget_Calculation_Reference.md §8.2).
function groupIntoCalendarWeeks(dayTargets: DayTarget[], weekStartDay: string): DayTarget[][] {
  const startShort = (weekStartDay || 'Monday').slice(0, 3);
  const weeks: DayTarget[][] = [];
  let current: DayTarget[] = [];
  dayTargets.forEach((dt, i) => {
    if (i > 0 && dt.dow === startShort) {
      weeks.push(current);
      current = [];
    }
    current.push(dt);
  });
  if (current.length) weeks.push(current);
  return weeks;
}

// Client-side ceiling projection — mirrors .NET's stComputeMaxWeeklyPayout()
// exactly (also computed client-side there, never sent from the server).
// Per-piece commission is excluded from the true ceiling because it's an
// uncapped per-unit rate; for qty mode we instead show "pcs at target" as a
// meaningful reference point (see calc reference §7).
type MaxPayout = { total: number; dayRewards: number; bestSlab: number; slabList: number[]; perPcsAtTarget: number };
function computeMaxWeeklyPayout(card: SalesTargetCard, qtyMode: boolean): MaxPayout {
  let dayRewSum = 0;
  card.dayTargets.forEach((dt) => {
    dayRewSum += qtyMode ? dt.qReward || 0 : dt.vReward || 0;
  });

  let bestSlabRupees = 0;
  const slabList: number[] = [];
  card.slabs.forEach((sl) => {
    // Value-slab component applied to card.totalValue (what's ACTUALLY been
    // achieved), not the weekly target — so this ceiling can never read
    // lower than the real "Rewards Earned" figure elsewhere on this card.
    const rup = qtyMode
      ? sl.qRew > 0 && card.weeklyTargetQty > 0
        ? ((card.weeklyTargetQty * sl.pct) / 100) * sl.qRew
        : 0
      : sl.vRew > 0
      ? (card.totalValue * sl.vRew) / 100
      : 0;
    if (rup > 0) slabList.push(round2(rup));
    if (rup > bestSlabRupees) bestSlabRupees = rup;
  });

  const perPcsAtTarget = qtyMode && card.qtyRewardPerPcs > 0 && card.weeklyTargetQty > 0 ? card.weeklyTargetQty * card.qtyRewardPerPcs : 0;

  return {
    total: round2(dayRewSum + bestSlabRupees + perPcsAtTarget),
    dayRewards: round2(dayRewSum),
    bestSlab: round2(bestSlabRupees),
    slabList,
    perPcsAtTarget: round2(perPcsAtTarget),
  };
}

// Diagonal purple/indigo gradient fill for the hero card — mirrors .NET's
// `.st-overall-card` / `.st-target-head` gradient (--st-primary → --st-primary2)
// using this app's own E.primary/E.primaryDark tokens instead of a new palette.
// Same react-native-svg technique already used by components/Button.tsx.
function HeroGradient({ cornerRadius }: { cornerRadius: number }) {
  return (
    <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        <LinearGradient id="stHeroGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop offset="0%" stopColor={E.primary} />
          <Stop offset="100%" stopColor={E.primaryDark} />
        </LinearGradient>
      </Defs>
      <Rect width="100%" height="100%" rx={cornerRadius} fill="url(#stHeroGrad)" />
    </Svg>
  );
}

// Circular achievement ring — mirrors .NET's SVG progress circle
// (stroke-dasharray/stroke-dashoffset over a circumference, animated there
// via CSS transitions). RN has no CSS transitions, so this renders the
// final position directly rather than animating toward it — same visual
// result, no motion.
function ProgressRing({ pct, label, size = 140, strokeWidth = 12 }: { pct: number; label: string; size?: number; strokeWidth?: number }) {
  const clamped = Math.max(0, Math.min(pct, 100));
  const r = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - clamped / 100);
  const color = pctColor(clamped);
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={E.border} strokeWidth={strokeWidth} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={offset}
          strokeLinecap="round"
          rotation={-90}
          origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>
      <View style={styles.ringCenter} pointerEvents="none">
        <Text style={styles.ringPct}>{clamped.toFixed(1)}%</Text>
        <Text style={styles.ringLabel}>{label}</Text>
      </View>
    </View>
  );
}

export default function SalesTargetScreen({ navigation }: any) {
  const [mode, setMode] = useState<SalesTargetMode>('week');
  const [offset, setOffset] = useState(0);
  const [data, setData] = useState<MySalesTargetResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [trial, setTrial] = useState(false);
  const [selected, setSelected] = useState<'overall' | 'barcode' | number>('overall');

  const load = useCallback(async (m: SalesTargetMode, o: number) => {
    try {
      const res = await getMySalesTarget(m, o);
      setData(res.data);
      setTrial(false);
    } catch (err: any) {
      if (err?.response?.data?.code === 'TRIAL_PENDING') setTrial(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    load(mode, offset);
  }, [mode, offset, load]);

  useEffect(() => {
    if (!data) return;
    const hasOverall = !!data.overallTeamSummary;
    if (selected === 'overall' && !hasOverall && data.targets.length) {
      setSelected(data.targets[0].salesTargetId);
    } else if (selected === 'overall' && !hasOverall && !data.targets.length && data.barcodeIncentives.length) {
      setSelected('barcode');
    }
  }, [data, selected]);

  const onRefresh = () => {
    setRefreshing(true);
    load(mode, offset);
  };

  const changeMode = (m: SalesTargetMode) => {
    setMode(m);
    setOffset(0);
  };

  const selectedCard: SalesTargetCard | undefined = useMemo(
    () => (typeof selected === 'number' ? data?.targets.find((t) => t.salesTargetId === selected) : undefined),
    [data, selected]
  );

  if (trial) return <TrialGate navigation={navigation} />;

  if (loading && !data) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={E.primary} />
      </View>
    );
  }

  const hasOverall = !!data?.overallTeamSummary;
  const targets = data?.targets || [];
  const barcodeIncentives = data?.barcodeIncentives || [];

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.periodRow}>
        <Pressable style={styles.periodArrow} onPress={() => setOffset((o) => o - 1)}>
          <Icon name="chevronLeft" size={18} color={E.ink} />
        </Pressable>
        <View style={styles.periodPills}>
          {(['today', 'week', 'month'] as SalesTargetMode[]).map((m) => (
            <Pressable key={m} style={[styles.periodPill, mode === m && styles.periodPillActive]} onPress={() => changeMode(m)}>
              <Text style={[styles.periodPillText, mode === m && styles.periodPillTextActive]}>
                {m === 'today' ? 'Today' : m === 'week' ? 'This Week' : 'Month'}
              </Text>
            </Pressable>
          ))}
        </View>
        <Pressable style={styles.periodArrow} onPress={() => setOffset((o) => o + 1)}>
          <Icon name="chevronRight" size={18} color={E.ink} />
        </Pressable>
      </View>
      {!!data?.periodLabel && <Text style={styles.periodLabel}>{data.periodLabel}</Text>}

      {targets.length === 0 && barcodeIncentives.length === 0 && !loading && (
        <Card style={styles.emptyCard}>
          <Text style={styles.emptyText}>No sales target is currently assigned to you for this period.</Text>
        </Card>
      )}

      {(hasOverall || targets.length > 1 || barcodeIncentives.length > 0) && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scopeRow} contentContainerStyle={{ gap: 8 }}>
          {hasOverall && (
            <Pressable style={[styles.scopePill, selected === 'overall' && styles.scopePillActive]} onPress={() => setSelected('overall')}>
              <Icon name="briefcase" size={14} color={selected === 'overall' ? '#fff' : E.muted} />
              <Text style={[styles.scopePillText, selected === 'overall' && styles.scopePillTextActive]}>Overall Team Summary</Text>
            </Pressable>
          )}
          {targets.map((t) => (
            <Pressable
              key={t.salesTargetId}
              style={[styles.scopePill, selected === t.salesTargetId && styles.scopePillActive]}
              onPress={() => setSelected(t.salesTargetId)}
            >
              <Text style={[styles.scopePillText, selected === t.salesTargetId && styles.scopePillTextActive]} numberOfLines={1}>
                {t.targetName}
              </Text>
              {t.teamSummary && <Icon name="twoUsers" size={12} color={selected === t.salesTargetId ? '#fff' : E.muted} />}
            </Pressable>
          ))}
          {barcodeIncentives.length > 0 && (
            <Pressable style={[styles.scopePill, selected === 'barcode' && styles.scopePillActive]} onPress={() => setSelected('barcode')}>
              <Icon name="dollar" size={14} color={selected === 'barcode' ? '#fff' : E.muted} />
              <Text style={[styles.scopePillText, selected === 'barcode' && styles.scopePillTextActive]}>Barcode Incentive</Text>
            </Pressable>
          )}
        </ScrollView>
      )}

      {selected === 'overall' && data?.overallTeamSummary && (
        <>
          <Card style={styles.heroCard}>
            <Text style={styles.heroTitle}>Overall Team Summary</Text>
            <Text style={styles.heroSubtitle}>
              {data.overallTeamSummary.totalManagedTargets} target{data.overallTeamSummary.totalManagedTargets === 1 ? '' : 's'} ·{' '}
              {data.overallTeamSummary.totalEmployees} employees
            </Text>
            <View style={styles.heroStatsRow}>
              <View style={styles.heroStat}>
                <Text style={styles.heroStatValue}>{money(data.overallTeamSummary.grossTargetValue)}</Text>
                <Text style={styles.heroStatLabel}>Gross Target (Value)</Text>
              </View>
              <View style={styles.heroStat}>
                <Text style={styles.heroStatValue}>
                  {money(data.overallTeamSummary.achievedValue)} · {data.overallTeamSummary.achValuePct}%
                </Text>
                <Text style={styles.heroStatLabel}>Team Achieved</Text>
              </View>
            </View>
          </Card>

          <Text style={styles.sectionHeading}>BY TARGET</Text>
          {targets
            .filter((t) => t.teamSummary)
            .map((t) => (
              <Pressable key={t.salesTargetId} onPress={() => setSelected(t.salesTargetId)}>
                <Card style={styles.byTargetRow}>
                  <Text style={styles.byTargetName} numberOfLines={1}>
                    {t.targetName}
                  </Text>
                  <View style={styles.byTargetRight}>
                    <Text style={styles.byTargetAmount}>
                      {money(t.teamSummary!.teamAchievedValue)} / {money(t.teamSummary!.grossTargetValue)}
                    </Text>
                    <Text style={[styles.byTargetPct, { color: pctColor(t.teamSummary!.teamAchValuePct) }]}>{t.teamSummary!.teamAchValuePct}%</Text>
                  </View>
                </Card>
              </Pressable>
            ))}

          {!!data?.byEmployee.length && (
            <>
              <Text style={styles.sectionHeading}>BY EMPLOYEE — best-effort, only counts employees linked to a salesperson profile</Text>
              <Card style={styles.byEmployeeCard}>
                {data.byEmployee.map((e) => (
                  <View key={e.employeeId} style={styles.byEmployeeRow}>
                    <Text style={styles.byEmployeeName} numberOfLines={1}>
                      {e.code ? `${e.code} - ` : ''}
                      {e.employeeName}
                    </Text>
                    <Text style={styles.byEmployeeAmount}>{money(e.achievedValue)}</Text>
                    <Text style={styles.byEmployeeQty}>{e.achievedQty} units</Text>
                  </View>
                ))}
              </Card>
            </>
          )}
        </>
      )}

      {selected === 'barcode' && <BarcodeIncentiveTab items={barcodeIncentives} />}

      {selectedCard && <TargetDetail card={selectedCard} mode={mode} todayIso={data?.today || ''} />}
    </ScrollView>
  );
}

// ── Barcode Incentive tab — a wholly separate, flat per-piece commission tied
// to Barcode Targets (no relation to SalesTarget/slabs). One card per Barcode
// Target the viewer is assigned to, either as an employee ("Your Commission")
// or a manager ("Team Commission" + per-employee breakdown) — both can apply
// to the same card at once.
function BarcodeIncentiveTab({ items }: { items: BarcodeIncentive[] }) {
  if (!items.length) {
    return (
      <Card style={styles.emptyCard}>
        <Text style={styles.emptyText}>No barcode incentives assigned to you right now.</Text>
      </Card>
    );
  }
  return (
    <>
      {items.map((it) => (
        <BarcodeIncentiveCard key={it.barcodeTargetId} item={it} />
      ))}
    </>
  );
}

function BarcodeIncentiveCard({ item }: { item: BarcodeIncentive }) {
  const [teamOpen, setTeamOpen] = useState(false);
  const totalEarned = round2(item.employeeEarned + item.managerEarned);
  const rangeLabel = item.effectiveTo ? `${shortDateLabel(item.effectiveFrom)} – ${shortDateLabel(item.effectiveTo)}` : `From ${shortDateLabel(item.effectiveFrom)} (ongoing)`;

  return (
    <Card style={styles.bcCard}>
      <View style={styles.bcHeadRow}>
        <View style={{ flex: 1 }}>
          <View style={styles.chipRow}>
            {item.brands.map((b) => (
              <View key={b} style={styles.brandChipMuted}>
                <Text style={styles.brandChipMutedText} numberOfLines={1}>
                  {b}
                </Text>
              </View>
            ))}
          </View>
          <Text style={styles.bcMeta}>
            {rangeLabel} · {item.barcodeCount} barcode{item.barcodeCount === 1 ? '' : 's'}
          </Text>
        </View>
        {totalEarned > 0 && (
          <View style={styles.bcTotalBadge}>
            <Text style={styles.bcTotalBadgeText}>{money(totalEarned)}</Text>
          </View>
        )}
      </View>

      {item.isEmployee && (
        <View style={styles.bcRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.bcRowLabel}>Your Commission</Text>
            <Text style={styles.bcRowSub}>
              {qtyStr(item.employeeQty)} pcs{item.pcsAmount > 0 ? ` × ₹${item.pcsAmount}` : ''}
            </Text>
          </View>
          <Text style={styles.bcRowValue}>{money(item.employeeEarned)}</Text>
        </View>
      )}

      {item.isManager && (
        <>
          <Pressable style={styles.bcRow} onPress={() => setTeamOpen((v) => !v)} disabled={!item.teamBreakdown?.length}>
            <View style={{ flex: 1 }}>
              <Text style={styles.bcRowLabel}>Team Commission</Text>
              <Text style={styles.bcRowSub}>
                {qtyStr(item.managerQty)} pcs{item.managerPcsAmount != null && item.managerPcsAmount > 0 ? ` × ₹${item.managerPcsAmount}` : ''}
              </Text>
            </View>
            <Text style={styles.bcRowValue}>{money(item.managerEarned)}</Text>
            {!!item.teamBreakdown?.length && <Icon name={teamOpen ? 'chevronDown' : 'chevronRight'} size={14} color={E.muted} />}
          </Pressable>
          {teamOpen && !!item.teamBreakdown?.length && (
            <View style={styles.bcTeamList}>
              {item.teamBreakdown.map((m) => (
                <View key={m.name} style={styles.bcTeamRow}>
                  <Text style={styles.bcTeamName} numberOfLines={1}>
                    {m.name}
                  </Text>
                  <Text style={styles.bcTeamQty}>{qtyStr(m.qty)} pcs</Text>
                  <Text style={styles.bcTeamEarned}>{money(m.earned)}</Text>
                </View>
              ))}
            </View>
          )}
        </>
      )}
    </Card>
  );
}

function TargetDetail({ card, mode, todayIso }: { card: SalesTargetCard; mode: SalesTargetMode; todayIso: string }) {
  const p = card.pacing;
  const [billModal, setBillModal] = useState<{ date: string; dayTarget: DayTarget | null; daySale: DaySale | null } | null>(null);

  const openBills = (date: string) => {
    const dt = card.dayTargets.find((d) => d.date === date) || null;
    const ds = card.daySales.find((d) => d.date === date) || null;
    setBillModal({ date, dayTarget: dt, daySale: ds });
  };

  return (
    <>
      <TargetHero card={card} mode={mode} todayIso={todayIso} />

      {card.teamSummary && (
        <>
          <Text style={styles.sectionHeading}>TEAM ({card.teamSummary.teamSize})</Text>
          <Card style={styles.teamCard}>
            {card.teamSummary.members.map((m) => (
              <View key={m.employeeId} style={styles.memberRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.memberName} numberOfLines={1}>
                    {m.code ? `${m.code} - ` : ''}
                    {m.employeeName}
                  </Text>
                  <Text style={styles.memberSub}>{money(m.achievedValue)} achieved</Text>
                </View>
                <Text style={[styles.memberPct, { color: pctColor(m.achValuePct) }]}>{m.achValuePct}%</Text>
              </View>
            ))}
          </Card>
        </>
      )}

      {mode === 'today' && <TodayContent card={card} todayIso={todayIso} onOpen={openBills} />}
      {mode === 'week' && <DayGrid card={card} todayIso={todayIso} onOpen={openBills} />}
      {mode === 'month' && <MonthAccordion card={card} todayIso={todayIso} onOpen={openBills} />}

      <NextMilestoneCallout card={card} />

      {card.slabs.length > 0 && <SlabLadder card={card} />}

      <RewardsSummary card={card} />

      {/* Week/Month mode's own Max-You-Can-Earn already rendered inline in
          TargetHero, right after the ring + stat grid — only Today mode
          still needs it called from here. */}
      {mode === 'today' && <MaxEarnBlock card={card} />}

      <Text style={styles.sectionHeading}>MONTHLY PACING</Text>
      <Card style={styles.pacingCard}>
        <View style={[styles.runRatePill, { backgroundColor: (RUN_RATE_COLOR[p.runRateStatus] || E.muted) + '1a' }]}>
          <Text style={[styles.runRateText, { color: RUN_RATE_COLOR[p.runRateStatus] || E.muted }]}>
            {RUN_RATE_LABEL[p.runRateStatus] || p.runRateStatus}
          </Text>
        </View>
        <Text style={styles.pacingMeta}>
          Day {p.daysElapsed} of {p.daysInMonth} · {p.daysRemaining} day{p.daysRemaining === 1 ? '' : 's'} left
        </Text>

        <View style={styles.pacingStatsRow}>
          {p.monthlyTargetValue > 0 && (
            <View style={styles.pacingStat}>
              <Text style={styles.pacingStatValue}>
                {money(p.mtdAchievedValue)} / {money(p.monthlyTargetValue)}
              </Text>
              <Text style={styles.pacingStatLabel}>MTD Value · {p.monthlyAchValuePct}%</Text>
            </View>
          )}
          {p.monthlyTargetQty > 0 && (
            <View style={styles.pacingStat}>
              <Text style={styles.pacingStatValue}>
                {qtyStr(p.mtdAchievedQty)} / {qtyTargetDisplay(p.monthlyTargetQty)} pcs
              </Text>
              <Text style={styles.pacingStatLabel}>MTD Qty · {p.monthlyAchQtyPct}%</Text>
            </View>
          )}
        </View>

        <View style={styles.pacingStatsRow}>
          <View style={styles.pacingStat}>
            <Text style={styles.pacingStatValue}>{money(p.projectedEndValue)}</Text>
            <Text style={styles.pacingStatLabel}>Projected month-end value</Text>
          </View>
          <View style={styles.pacingStat}>
            <Text style={styles.pacingStatValue}>{money(p.projectedPayout)}</Text>
            <Text style={styles.pacingStatLabel}>
              Projected payout{p.projectedSlabPct != null ? ` · ${p.projectedSlabPct}% slab pace` : ''}
            </Text>
          </View>
        </View>

        {(p.projDayValueComponent > 0 ||
          p.projDayQtyComponent > 0 ||
          p.projSlabValueComponent > 0 ||
          p.projSlabQtyComponent > 0 ||
          p.projPerPcsComponent > 0) && (
          <Text style={styles.pacingBreakdown}>
            {[
              p.projDayValueComponent > 0 ? `Day value ${money(p.projDayValueComponent)}` : '',
              p.projDayQtyComponent > 0 ? `Day qty ${money(p.projDayQtyComponent)}` : '',
              p.projSlabValueComponent > 0 ? `Slab value ${money(p.projSlabValueComponent)}` : '',
              p.projSlabQtyComponent > 0 ? `Slab qty ${money(p.projSlabQtyComponent)}` : '',
              p.projPerPcsComponent > 0 ? `Per pcs ${money(p.projPerPcsComponent)}` : '',
            ]
              .filter(Boolean)
              .join('  +  ')}
          </Text>
        )}

        {(p.neededPerDayValue > 0 || p.neededPerDayQty > 0) && (
          <Text style={styles.pacingNeeded}>
            Need {p.neededPerDayValue > 0 ? `${money(p.neededPerDayValue)}/day` : ''}
            {p.neededPerDayValue > 0 && p.neededPerDayQty > 0 ? ' and ' : ''}
            {p.neededPerDayQty > 0 ? `${p.neededPerDayQty} pcs/day` : ''} to hit this month's target.
          </Text>
        )}

        {p.nextSlab && (
          <View style={styles.nextSlabBox}>
            <Text style={styles.nextSlabText}>
              Push {p.nextSlab.deltaValue > 0 ? money(p.nextSlab.deltaValue) : `${p.nextSlab.deltaQty} pcs`} more this week to reach the{' '}
              {p.nextSlab.achievementPct}% slab — payout would grow to {money(p.nextSlab.payoutAtNextSlab)}.
            </Text>
          </View>
        )}
      </Card>

      {card.teamSummary && (
        <>
          <Text style={styles.sectionHeading}>TEAM OVERVIEW</Text>
          <Card style={styles.teamCard}>
            <View style={styles.rewardsGrid}>
              <View style={[styles.rewardMini, { borderLeftColor: E.blue }]}>
                <Text style={[styles.rewardMiniValue, { color: E.blue }]}>{money(card.teamSummary.grossTargetValue)}</Text>
                <Text style={styles.rewardMiniLabel}>Gross Target (Value)</Text>
              </View>
              <View style={[styles.rewardMini, { borderLeftColor: pctColor(card.teamSummary.teamAchValuePct) }]}>
                <Text style={[styles.rewardMiniValue, { color: pctColor(card.teamSummary.teamAchValuePct) }]}>
                  {money(card.teamSummary.teamAchievedValue)}
                </Text>
                <Text style={styles.rewardMiniLabel}>Team Achieved · {card.teamSummary.teamAchValuePct}%</Text>
              </View>
              {card.teamSummary.grossTargetQty > 0 && (
                <>
                  <View style={[styles.rewardMini, { borderLeftColor: E.yellow }]}>
                    <Text style={[styles.rewardMiniValue, { color: E.yellow }]}>{qtyStr(card.teamSummary.grossTargetQty)} units</Text>
                    <Text style={styles.rewardMiniLabel}>Gross Target (Qty)</Text>
                  </View>
                  <View style={[styles.rewardMini, { borderLeftColor: pctColor(card.teamSummary.teamAchQtyPct) }]}>
                    <Text style={[styles.rewardMiniValue, { color: pctColor(card.teamSummary.teamAchQtyPct) }]}>
                      {qtyStr(card.teamSummary.teamAchievedQty)} units
                    </Text>
                    <Text style={styles.rewardMiniLabel}>Team Achieved · {card.teamSummary.teamAchQtyPct}%</Text>
                  </View>
                </>
              )}
            </View>
          </Card>
        </>
      )}

      <BillDrilldownModal
        visible={!!billModal}
        onClose={() => setBillModal(null)}
        label={billModal ? longDateLabel(billModal.date) : ''}
        dayTarget={billModal?.dayTarget || null}
        daySale={billModal?.daySale || null}
      />
    </>
  );
}

// ── Hero card — purple/indigo gradient centerpiece, mirrors .NET's
// `.st-target-head` + `.st-hero` + (today mode) `.st-today-week-strip`.
// Shows a big hero % stat in 'today' mode (like the .NET progress ring's
// big center number), else the Target/Achieved/Remaining trio used in
// week/month mode. Brand chips + "View Brands" open a small modal listing
// every assigned brand/dept/branch (mirrors .st-view-brands-btn).
function TargetHero({ card, mode, todayIso }: { card: SalesTargetCard; mode: SalesTargetMode; todayIso: string }) {
  const [brandsOpen, setBrandsOpen] = useState(false);
  const isToday = mode === 'today';
  const qtyOnly = card.isQtyOnly;

  const dt = card.dayTargets.find((d) => d.date === todayIso) || null;
  const ds = card.daySales.find((d) => d.date === todayIso) || null;

  let todayAch = 0;
  let todayTgt = 0;
  let todayRew = 0;
  let todayPct = 0;
  let todayHit = false;
  if (isToday && dt) {
    if (qtyOnly) {
      todayAch = ds?.qty || 0;
      todayTgt = dt.qTarget;
      todayRew = dt.qReward;
    } else {
      todayAch = ds?.value || 0;
      todayTgt = dt.vTarget;
      todayRew = dt.vReward;
    }
    todayPct = todayTgt > 0 ? Math.min((todayAch / todayTgt) * 100, 100) : 0;
    todayHit = todayTgt > 0 && todayAch >= todayTgt;
  }

  const brandOverflow = card.brandNames.length > 2 || card.deptNames.length > 0 || card.branchNames.length > 0;
  const scopeLabel = `${card.salesScope}${card.teamSummary ? ' & Team' : ''}`;
  const effFromParts = card.weekFrom.split('-');
  const effFromLabel = `${parseInt(effFromParts[2], 10)} ${MONTHS[parseInt(effFromParts[1], 10) - 1]}`;

  return (
    <>
      <Card style={styles.heroCard}>
        <HeroGradient cornerRadius={radius.md} />
        <Text style={styles.heroTitle} numberOfLines={1}>
          {card.targetName}
        </Text>
        <Text style={styles.heroSubtitle}>({scopeLabel})</Text>
        <Text style={styles.heroEffFrom}>Effective from {effFromLabel}</Text>

        {(card.brandNames.length > 0 || card.deptNames.length > 0 || card.branchNames.length > 0) && (
          <View style={styles.chipRow}>
            {card.brandNames.slice(0, 2).map((b) => (
              <View key={b} style={styles.brandChip}>
                <Text style={styles.brandChipText} numberOfLines={1}>
                  {b}
                </Text>
              </View>
            ))}
            {brandOverflow && (
              <Pressable style={styles.viewBrandsBtn} onPress={() => setBrandsOpen(true)}>
                <Text style={styles.viewBrandsText}>
                  {card.brandNames.length > 2 ? `+${card.brandNames.length - 2} more · ` : ''}
                  View Brands
                </Text>
              </Pressable>
            )}
          </View>
        )}

        {isToday && (
          dt ? (
            <>
              <View style={styles.heroBigStatRow}>
                <Text style={styles.heroBigStat}>{todayPct.toFixed(1)}%</Text>
                <Text style={styles.heroBigStatLabel}>TODAY</Text>
              </View>
              <View style={styles.heroStatsRow}>
                <View style={styles.heroStat}>
                  <Text style={styles.heroStatLabel}>ACHIEVED TODAY</Text>
                  <Text style={styles.heroStatValue}>{qtyOnly ? `${qtyStr(todayAch)} pcs` : money(todayAch)}</Text>
                </View>
                <View style={styles.heroStat}>
                  <Text style={styles.heroStatLabel}>REMAINING</Text>
                  <Text style={styles.heroStatValue}>
                    {qtyOnly ? `${qtyStr(Math.max(0, todayTgt - todayAch))} pcs` : money(Math.max(0, todayTgt - todayAch))}
                  </Text>
                </View>
              </View>
              <Text style={styles.heroCaption}>of {qtyOnly ? `${qtyTargetDisplay(todayTgt)} pcs` : money(todayTgt)} day target</Text>
              {todayRew > 0 && (
                <View style={[styles.heroRewardBadge, !todayHit && styles.heroRewardBadgePending]}>
                  <Text style={styles.heroRewardBadgeText}>
                    {todayHit ? `🎉 DAY REWARD +${money(todayRew)}` : `Achieve target to earn ${money(todayRew)}`}
                  </Text>
                </View>
              )}
            </>
          ) : (
            <Text style={styles.heroCaption}>No target configured for today.</Text>
          )
        )}
      </Card>

      {/* Ring + stat grid — mirrors .NET's stat block below the hero card
          (Week/Month mode only; Today mode's big % stat stays inside the
          purple card above, matching the reference's own layout split). */}
      {!isToday && (
        <>
          <View style={styles.ringSection}>
            <ProgressRing pct={qtyOnly ? card.achQtyPct : card.achValuePct} label={mode.toUpperCase()} />
          </View>

          <View style={styles.statGrid3}>
            <View style={styles.statBox}>
              <Text style={styles.statBoxLabel}>TARGET</Text>
              <Text style={styles.statBoxValue}>{qtyOnly ? `${qtyTargetDisplay(card.weeklyTargetQty)} pcs` : money(card.weeklyTargetValue)}</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statBoxLabel}>ACHIEVED</Text>
              <Text style={[styles.statBoxValue, { color: E.green }]}>{qtyOnly ? `${qtyStr(card.totalQty)} pcs` : money(card.totalValue)}</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statBoxLabel}>REMAINING</Text>
              <Text style={[styles.statBoxValue, { color: E.red }]}>
                {qtyOnly
                  ? `${qtyStr(Math.max(0, card.weeklyTargetQty - card.totalQty))} pcs`
                  : money(Math.max(0, card.weeklyTargetValue - card.totalValue))}
              </Text>
            </View>
          </View>

          <View style={styles.statGrid2}>
            <View style={styles.statBox}>
              <Text style={styles.statBoxLabel}>PCS SOLD</Text>
              <Text style={styles.statBoxValue}>{qtyStr(card.totalQty)} units</Text>
              {card.totalQty > 0 && !qtyOnly && <Text style={styles.statBoxSub}>Avg price {money(card.totalValue / card.totalQty)}/pc</Text>}
            </View>
            <View style={styles.statBox}>
              <Text style={styles.statBoxLabel}>REWARDS EARNED</Text>
              <Text style={[styles.statBoxValue, { color: E.green }]}>{money(card.totalCashReward)}</Text>
            </View>
          </View>

          <MaxEarnBlock card={card} />
        </>
      )}

      {isToday && card.weeklyTargetValue > 0 && (
        <Card style={styles.weekRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.weekRowLabel}>This Week</Text>
            <Text style={styles.weekRowValue}>
              {money(card.totalValue)} / {money(card.weeklyTargetValue)}
            </Text>
          </View>
          <View style={[styles.weekRowBadge, { backgroundColor: pctColor(card.achValuePct) + '1a' }]}>
            <Text style={[styles.weekRowBadgeText, { color: pctColor(card.achValuePct) }]}>{card.achValuePct}%</Text>
          </View>
        </Card>
      )}

      <BrandsModal visible={brandsOpen} onClose={() => setBrandsOpen(false)} card={card} />
    </>
  );
}

// ── Assigned Brands/Depts/Branches modal — mirrors .NET's #stBrandsOverlay ──
function BrandsModal({ visible, onClose, card }: { visible: boolean; onClose: () => void; card: SalesTargetCard }) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <Pressable style={[styles.modalSheet, { paddingBottom: insets.bottom + 12 }]} onPress={(e) => e.stopPropagation()}>
          <View style={styles.modalHead}>
            <View style={{ flex: 1 }}>
              <Text style={styles.modalTitle}>Assigned Brands</Text>
              <Text style={styles.modalSub}>{card.targetName}</Text>
            </View>
            <Pressable style={styles.modalCloseBtn} onPress={onClose}>
              <Icon name="x" size={18} color={E.ink} />
            </Pressable>
          </View>
          <ScrollView style={styles.modalBody} contentContainerStyle={{ paddingVertical: spacing(2), paddingBottom: spacing(4) }}>
            {card.brandNames.length > 0 && (
              <>
                <Text style={styles.brandsSectionLbl}>Brands ({card.brandNames.length})</Text>
                <View style={styles.brandsPillGrid}>
                  {card.brandNames.map((b) => (
                    <View key={b} style={styles.brandsPill}>
                      <Text style={styles.brandsPillText}>{b}</Text>
                    </View>
                  ))}
                </View>
              </>
            )}
            {card.deptNames.length > 0 && (
              <>
                <Text style={styles.brandsSectionLbl}>Departments ({card.deptNames.length})</Text>
                <View style={styles.brandsPillGrid}>
                  {card.deptNames.map((d) => (
                    <View key={d} style={styles.brandsPill}>
                      <Text style={styles.brandsPillText}>{d}</Text>
                    </View>
                  ))}
                </View>
              </>
            )}
            {card.branchNames.length > 0 && (
              <>
                <Text style={styles.brandsSectionLbl}>Branches ({card.branchNames.length})</Text>
                <View style={styles.brandsPillGrid}>
                  {card.branchNames.map((b) => (
                    <View key={b} style={styles.brandsPill}>
                      <Text style={styles.brandsPillText}>{b}</Text>
                    </View>
                  ))}
                </View>
              </>
            )}
            {card.brandNames.length === 0 && card.deptNames.length === 0 && card.branchNames.length === 0 && (
              <Text style={styles.modalEmpty}>No brand/department restrictions — all products count.</Text>
            )}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ── Today mode: progress + inline bill list (tap to open the full drill-down) ──
function TodayContent({ card, todayIso, onOpen }: { card: SalesTargetCard; todayIso: string; onOpen: (date: string) => void }) {
  const dt = card.dayTargets.find((d) => d.date === todayIso);
  const ds = card.daySales.find((d) => d.date === todayIso);
  const bills = ds?.bills || [];
  const groups = groupByBillNo(bills);

  return (
    <>
      {dt ? (
        <Card style={styles.todayCard}>
          <View style={styles.dayHeaderRow}>
            <Text style={styles.dayHeaderName}>{dayNameCaps(todayIso)}</Text>
            <Text style={styles.dayHeaderDate}>{shortDateLabel(todayIso)}</Text>
          </View>
          {card.weeklyTargetValue > 0 && (
            <TodayProgressBlock
              achieved={ds?.value || 0}
              target={dt.vTarget}
              rewardAmt={dt.vReward}
              rewardLabel="Day reward"
              format={money}
            />
          )}
          {card.weeklyTargetQty > 0 && (
            <TodayProgressBlock
              achieved={ds?.qty || 0}
              target={dt.qTarget}
              rewardAmt={dt.qReward}
              rewardLabel="Qty reward"
              format={(n) => `${qtyStr(n)} pcs`}
              style={card.weeklyTargetValue > 0 ? { marginTop: spacing(2) } : undefined}
            />
          )}
        </Card>
      ) : (
        <Card style={styles.todayCard}>
          <Text style={styles.emptyText}>No target configured for today.</Text>
        </Card>
      )}

      <Text style={styles.sectionHeading}>TODAY'S BILLS ({bills.length})</Text>
      {bills.length === 0 ? (
        <Card style={styles.emptyCard}>
          <Text style={styles.emptyText}>No sales recorded today yet.</Text>
        </Card>
      ) : (
        <Card style={styles.todayBillsCard}>
          {groups.map((g) => (
            <Pressable key={g.no} style={styles.todayBillRow} onPress={() => onOpen(todayIso)}>
              <Text style={styles.todayBillNo}>#{g.no}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.todayBillBrand} numberOfLines={1}>
                  {g.rows[0].brand || ''}
                </Text>
                <Text style={styles.todayBillDept} numberOfLines={1}>
                  {g.rows[0].dept || ''}
                  {g.rows.length > 1 ? ` + ${g.rows.length - 1} item(s)` : ''}
                </Text>
              </View>
              <Text style={styles.todayBillAmt}>{money(g.total)}</Text>
            </Pressable>
          ))}
        </Card>
      )}
    </>
  );
}

function TodayProgressBlock({
  achieved,
  target,
  rewardAmt,
  rewardLabel,
  format,
  style,
}: {
  achieved: number;
  target: number;
  rewardAmt: number;
  rewardLabel: string;
  format: (n: number) => string;
  style?: any;
}) {
  const hit = target > 0 && achieved >= target;
  const pct = target > 0 ? Math.min((achieved / target) * 100, 100) : 0;
  const barColor = hit ? E.green : pct >= 80 ? E.yellow : E.red;
  return (
    <View style={style}>
      <View style={styles.todayProgressBarBg}>
        <View style={[styles.todayProgressBarFill, { width: `${pct}%`, backgroundColor: barColor }]} />
      </View>
      <View style={styles.todayProgressLblRow}>
        <Text style={styles.todayProgressLbl}>{format(achieved)} achieved</Text>
        <Text style={styles.todayProgressLbl}>{format(target)} target</Text>
      </View>
      {rewardAmt > 0 && (
        <Text style={[styles.todayRewBadge, hit ? styles.todayRewEarned : styles.todayRewPending]}>
          {hit ? `${rewardLabel} earned: ${money(rewardAmt)}` : `Achieve target to earn ${money(rewardAmt)} reward`}
        </Text>
      )}
    </View>
  );
}

// ── Week mode: 2-col day grid, tap a day for its bills ──
function DayGrid({ card, todayIso, onOpen }: { card: SalesTargetCard; todayIso: string; onOpen: (date: string) => void }) {
  const maxDayRew = Math.max(
    card.dayTargets.reduce((s, dt) => s + (dt.vReward || 0), 0),
    card.dayTargets.reduce((s, dt) => s + (dt.qReward || 0), 0)
  );
  return (
    <>
      <Text style={styles.sectionHeading}>
        DAY-BY-DAY PROGRESS{maxDayRew > 0 ? ` · max this week ${money(maxDayRew)}` : ''}
      </Text>
      <View style={styles.dayGrid}>
        {card.dayTargets.map((dt) => {
          const ds = card.daySales.find((d) => d.date === dt.date);
          return <DayCard key={dt.date} dt={dt} ds={ds} card={card} todayIso={todayIso} onOpen={onOpen} />;
        })}
      </View>
    </>
  );
}

// ── Month mode: accordion of real calendar weeks → day grid drill-down ──
function MonthAccordion({ card, todayIso, onOpen }: { card: SalesTargetCard; todayIso: string; onOpen: (date: string) => void }) {
  const weeks = useMemo(() => groupIntoCalendarWeeks(card.dayTargets, card.weekStart), [card.dayTargets, card.weekStart]);
  const [expanded, setExpanded] = useState<Set<number>>(() => new Set([0]));

  const toggle = (i: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  };

  return (
    <>
      <Text style={styles.sectionHeading}>MONTHLY OVERVIEW — tap a week to expand</Text>
      {weeks.map((week, i) => {
        const wVal = week.reduce((s, dt) => s + (card.daySales.find((d) => d.date === dt.date)?.value || 0), 0);
        const wQty = week.reduce((s, dt) => s + (card.daySales.find((d) => d.date === dt.date)?.qty || 0), 0);
        const wTgtV = week.reduce((s, dt) => s + dt.vTarget, 0);
        const wTgtQ = week.reduce((s, dt) => s + dt.qTarget, 0);
        const isOpen = expanded.has(i);
        return (
          <Card key={week[0].date} style={styles.monthWeekCard}>
            <Pressable style={styles.monthWeekHead} onPress={() => toggle(i)}>
              <View style={{ flex: 1 }}>
                <Text style={styles.monthWeekTitle}>
                  {week[0].label} – {week[week.length - 1].label}
                </Text>
                <Text style={styles.monthWeekMeta}>
                  {card.weeklyTargetValue > 0 ? `${money(wVal)} / ${money(wTgtV)}` : ''}
                  {card.weeklyTargetValue > 0 && card.weeklyTargetQty > 0 ? '  ·  ' : ''}
                  {card.weeklyTargetQty > 0 ? `${qtyStr(wQty)} / ${qtyTargetDisplay(wTgtQ)} pcs` : ''}
                </Text>
              </View>
              <Icon name={isOpen ? 'chevronDown' : 'chevronRight'} size={16} color={E.muted} />
            </Pressable>
            {isOpen && (
              <View style={[styles.dayGrid, { marginTop: spacing(1.5) }]}>
                {week.map((dt) => {
                  const ds = card.daySales.find((d) => d.date === dt.date);
                  return <DayCard key={dt.date} dt={dt} ds={ds} card={card} todayIso={todayIso} onOpen={onOpen} />;
                })}
              </View>
            )}
          </Card>
        );
      })}
    </>
  );
}

function DayCard({
  dt,
  ds,
  card,
  todayIso,
  onOpen,
}: {
  dt: DayTarget;
  ds: DaySale | undefined;
  card: SalesTargetCard;
  todayIso: string;
  onOpen: (date: string) => void;
}) {
  const isFuture = !!todayIso && dt.date > todayIso;
  const isToday = dt.date === todayIso;
  const val = ds?.value || 0;
  const qty = ds?.qty || 0;
  const vHit = !isFuture && dt.vTarget > 0 && val >= dt.vTarget;
  const qHit = !isFuture && dt.qTarget > 0 && qty >= dt.qTarget;
  const primaryPct = card.isQtyOnly
    ? dt.qTarget > 0
      ? Math.min((qty / dt.qTarget) * 100, 100)
      : 0
    : dt.vTarget > 0
    ? Math.min((val / dt.vTarget) * 100, 100)
    : 0;
  const hit = card.isQtyOnly ? qHit : vHit;
  const close = !hit && !isFuture && primaryPct >= 80;
  const barColor = isFuture ? E.border : hit ? E.green : close ? E.yellow : E.red;
  const bcount = ds?.bills.length || 0;

  return (
    <Pressable
      style={[styles.dayCard, isToday && styles.dayCardToday, isFuture && styles.dayCardFuture]}
      onPress={() => !isFuture && onOpen(dt.date)}
      disabled={isFuture}
    >
      <Text style={styles.dayCardDate}>
        {ordinalDayLabel(dt)}
        {isToday ? ' •' : ''}
      </Text>
      <View style={styles.dayCardBar}>
        <View style={[styles.dayCardBarFill, { width: `${Math.min(primaryPct, 100)}%`, backgroundColor: barColor }]} />
      </View>

      {card.weeklyTargetValue > 0 && (
        <>
          <Text style={styles.dayCardAch}>{money(val)}</Text>
          <Text style={styles.dayCardTgt}>of {money(dt.vTarget)} target</Text>
          {dt.vReward > 0 && (
            <Text style={[styles.dayCardRew, vHit ? styles.dayCardRewEarned : styles.dayCardRewPending]}>
              {vHit ? `+${money(dt.vReward)}` : `Achieve to earn ${money(dt.vReward)}`}
            </Text>
          )}
        </>
      )}
      {card.weeklyTargetQty > 0 && (
        <View style={card.weeklyTargetValue > 0 ? { marginTop: 6 } : undefined}>
          <Text style={styles.dayCardAch}>
            {qtyStr(qty)} <Text style={styles.dayCardUnit}>pcs</Text>
          </Text>
          <Text style={styles.dayCardTgt}>of {qtyTargetDisplay(dt.qTarget)} pcs target</Text>
          {dt.qReward > 0 && (
            <Text style={[styles.dayCardRew, qHit ? styles.dayCardRewEarned : styles.dayCardRewPending]}>
              {qHit ? `+${money(dt.qReward)}` : `Achieve to earn ${money(dt.qReward)}`}
            </Text>
          )}
        </View>
      )}
      {card.qtyRewardPerPcs > 0 && qty > 0 && (
        <Text style={styles.dayCardPcs}>
          {money(qty * card.qtyRewardPerPcs)} ({qtyStr(qty)} × ₹{card.qtyRewardPerPcs})
        </Text>
      )}
      {!isFuture && bcount > 0 && (
        <Text style={styles.dayCardBills}>
          {bcount} bill{bcount > 1 ? 's' : ''}
        </Text>
      )}
    </Pressable>
  );
}

// ── Achievement Slabs ladder — every configured tier, not just the qualifying one ──
// ── Next Milestone callout — "sell X more to unlock Y% slab", mirrors .NET's
// stRenderNextMilestone() exactly (including its own not-yet-updated-for-the-
// Sep-2026-split behavior: it still compares against the shared Value `pct`
// even for a qty-only target, not a separate qty threshold). Computed
// entirely client-side from data already on the card, same as the reference.
function NextMilestoneCallout({ card }: { card: SalesTargetCard }) {
  if (!card.slabs.length) return null;
  const qtyOnly = card.isQtyOnly;
  const achPct = qtyOnly ? card.achQtyPct : card.achValuePct;
  const basis = qtyOnly ? card.weeklyTargetQty : card.weeklyTargetValue;
  if (basis <= 0) return null;

  let next: SlabTier | null = null;
  for (const sl of card.slabs) {
    if (achPct < sl.pct && (!next || sl.pct < next.pct)) next = sl;
  }
  if (!next) return null;

  const deltaAmt = Math.max(0, (basis * (next.pct - achPct)) / 100);
  const amtTxt = qtyOnly ? `${qtyStr(deltaAmt)} pcs` : money(deltaAmt);

  let rewardTxt = '';
  if (qtyOnly && next.qRew > 0) rewardTxt = `₹${next.qRew} per piece bonus`;
  else if (!qtyOnly && next.vRew > 0) rewardTxt = `${next.vRew}% value bonus`;
  else if (next.qRew > 0) rewardTxt = `₹${next.qRew}/pc bonus`;

  return (
    <Card style={styles.milestoneCard}>
      <Text style={styles.milestoneIcon}>🔥</Text>
      <Text style={styles.milestoneText}>
        Sell <Text style={styles.milestoneBold}>{amtTxt}</Text> more to unlock the <Text style={styles.milestoneBold}>{next.pct}% Achievement Slab</Text>
        {rewardTxt ? (
          <>
            {' '}
            and earn <Text style={styles.milestoneBold}>{rewardTxt}</Text>!
          </>
        ) : (
          '!'
        )}
      </Text>
    </Card>
  );
}

// Value and Qty ladders are independent (Sep 2026) — each has its own
// threshold (sl.pct for Value, sl.qPct for Qty), so each is checked and
// ticked on its own line within the same numbered tier row instead of a
// single shared "hit" flag. The row-level number badge still follows
// whichever metric is this target's primary mode, matching the .NET
// reference's `q = qtyOnly ? qQty : qVal` row highlight.
function SlabLadder({ card }: { card: SalesTargetCard }) {
  return (
    <>
      <Text style={styles.sectionHeading}>ACHIEVEMENT SLABS</Text>
      <Card style={styles.slabCard}>
        {card.slabs.map((sl, i) => {
          const qVal = card.achValuePct >= sl.pct;
          const qQty = card.achQtyPct >= sl.qPct;
          const rowHit = card.isQtyOnly ? qQty : qVal;
          // Value's % is applied to the ACHIEVED amount (card.totalValue), not
          // the weekly target — same formula the server uses for the
          // currently-qualifying slab, applied here to every tier for preview.
          const slabVRupees = sl.vRew > 0 ? round2((card.totalValue * sl.vRew) / 100) : 0;
          const slabQRupees = sl.qRew > 0 && card.weeklyTargetQty > 0 ? round2(((card.weeklyTargetQty * sl.qPct) / 100) * sl.qRew) : 0;
          return (
            <View key={i} style={[styles.slabRow, i > 0 && styles.slabRowBorder]}>
              <View style={[styles.slabNumWrap, rowHit && styles.slabNumWrapHit]}>
                {rowHit ? <Icon name="check" size={12} color="#fff" /> : <Text style={styles.slabNum}>{i + 1}</Text>}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.slabPct}>
                  {sl.vRew > 0 ? `${sl.pct}%` : ''}
                  {sl.vRew > 0 && sl.qRew > 0 ? ' / ' : ''}
                  {sl.qRew > 0 ? `${sl.qPct}%` : ''}
                </Text>
                {sl.vRew > 0 && (
                  <Text style={styles.slabDetail}>
                    {qVal ? '✅' : '⭕'} Value: {sl.vRew}% <Text style={styles.slabDetailBold}>({money(slabVRupees)})</Text>
                  </Text>
                )}
                {sl.qRew > 0 && (
                  <Text style={styles.slabDetail}>
                    {qQty ? '✅' : '⭕'} Qty: ₹{sl.qRew}/pc{slabQRupees > 0 ? <Text style={styles.slabDetailBold}> (~{money(slabQRupees)})</Text> : null}
                  </Text>
                )}
              </View>
            </View>
          );
        })}
      </Card>
    </>
  );
}

// ── Rewards Summary — itemized breakdown of what's actually been earned ──
function RewardsSummary({ card }: { card: SalesTargetCard }) {
  type Item = { icon: IconName; label: string; value: number; tint: string; sub?: string };
  const items: Item[] = [];
  items.push({ icon: 'zap', label: 'Day Value Rewards', value: card.dayValueReward, tint: E.green });
  if (card.weeklyTargetQty > 0) items.push({ icon: 'zap', label: 'Day Qty Rewards', value: card.dayQtyReward, tint: E.yellow });
  if (card.qtyRewardPerPcs > 0)
    items.push({
      icon: 'dollar',
      label: 'Per Pcs Commission',
      value: card.perPcsEarned,
      tint: E.green,
      sub: `${qtyStr(card.totalQty)} pcs × ₹${card.qtyRewardPerPcs}`,
    });
  if (card.slabs.length > 0) {
    items.push({
      icon: 'trendingUp',
      label: 'Slab Value',
      value: card.slabValueRewardRupees,
      tint: E.purple,
      sub: card.slabValueReward > 0 ? `${card.slabValueReward}% of target` : undefined,
    });
    items.push({ icon: 'trendingUp', label: 'Slab Qty', value: card.slabQtyReward, tint: E.blue });
  }
  const earnedCount = items.filter((i) => i.value > 0).length;

  return (
    <>
      <Text style={styles.sectionHeading}>REWARDS SUMMARY</Text>
      <View style={styles.rewardsGrid}>
        {items.map((it) => (
          <View key={it.label} style={[styles.rewardMini, { borderLeftColor: it.tint }]}>
            <Icon name={it.icon} size={14} color={it.tint} />
            <Text style={[styles.rewardMiniValue, { color: it.tint }]}>{money(it.value)}</Text>
            <Text style={styles.rewardMiniLabel}>{it.label}</Text>
            {it.sub ? <Text style={styles.rewardMiniSub}>{it.sub}</Text> : null}
          </View>
        ))}
      </View>
      <Card style={styles.totalRewardCard}>
        <View style={{ flex: 1 }}>
          <Text style={styles.totalRewardLabel}>
            Total Cash Earned{earnedCount > 0 ? ` · ${earnedCount}` : ''}
          </Text>
          <Text style={styles.totalRewardValue}>{money(card.totalCashReward)}</Text>
          {card.slabValueRewardRupees > 0 && (
            <Text style={styles.totalRewardSlabNote}>
              includes {money(card.slabValueRewardRupees)} slab bonus ({card.slabValueReward}% of target)
            </Text>
          )}
        </View>
        <Icon name="dollar" size={22} color={E.primary} />
      </Card>
    </>
  );
}

// ── "Max You Can Earn" ceiling ──
function MaxEarnBlock({ card }: { card: SalesTargetCard }) {
  const blocks: { label: string; b: MaxPayout }[] = [];
  if (card.weeklyTargetValue > 0) blocks.push({ label: 'Value', b: computeMaxWeeklyPayout(card, false) });
  if (card.weeklyTargetQty > 0) blocks.push({ label: 'Qty', b: computeMaxWeeklyPayout(card, true) });
  const visible = blocks.filter((x) => x.b.total > 0);
  if (!visible.length) return null;

  return (
    <>
      <Text style={styles.sectionHeading}>MAX YOU CAN EARN</Text>
      <Card style={styles.maxEarnCard}>
        {visible.map(({ label, b }, idx) => (
          <View key={label} style={[styles.maxEarnBlock, idx > 0 && { marginTop: spacing(1.5) }]}>
            <View style={styles.maxEarnHeadRow}>
              {visible.length > 1 && <Text style={styles.maxEarnLabel}>{label}</Text>}
              <Text style={styles.maxEarnValue}>{money(b.total)}</Text>
            </View>
            <Text style={styles.maxEarnBreakdown}>
              {[
                b.dayRewards > 0 ? `Day rewards ${money(b.dayRewards)}` : '',
                ...b.slabList.map((s, i) => `Slab ${i + 1} ${money(s)}`),
                b.perPcsAtTarget > 0 ? `Pcs at target ${money(b.perPcsAtTarget)}` : '',
              ]
                .filter(Boolean)
                .join('  +  ')}
            </Text>
          </View>
        ))}
      </Card>
    </>
  );
}

// ── Bill drill-down modal — per-day bill list + the MRP-Disc+Returns=NetAmt verification footer ──
function BillDrilldownModal({
  visible,
  onClose,
  label,
  dayTarget,
  daySale,
}: {
  visible: boolean;
  onClose: () => void;
  label: string;
  dayTarget: DayTarget | null;
  daySale: DaySale | null;
}) {
  const insets = useSafeAreaInsets();
  const bills = daySale?.bills || [];
  const ach = daySale?.value || 0;
  const tgt = dayTarget?.vTarget || 0;
  const pct = tgt > 0 ? Math.round((ach / tgt) * 100) : 0;
  const rew = dayTarget && dayTarget.vReward > 0 && tgt > 0 && ach >= tgt ? dayTarget.vReward : 0;
  const qrew =
    dayTarget && dayTarget.qReward > 0 && daySale && dayTarget.qTarget > 0 && (daySale.qty || 0) >= dayTarget.qTarget ? dayTarget.qReward : 0;

  const totAmt = bills.reduce((s, b) => s + b.amount, 0);
  const totQty = bills.reduce((s, b) => s + b.qty, 0);
  const saleRows = bills.filter((b) => b.qty > 0);
  const returnRows = bills.filter((b) => b.qty < 0 || b.amount < 0);
  const totMrp = saleRows.reduce((s, b) => s + b.mrp * b.qty, 0);
  const totDisc = saleRows.reduce((s, b) => s + b.discount, 0);
  const totReturnAmt = returnRows.reduce((s, b) => s + b.amount, 0);
  const totReturnQty = returnRows.reduce((s, b) => s + b.qty, 0);
  const avgDiscPct = totMrp > 0 ? (totDisc / totMrp) * 100 : 0;
  const avgDiscAmt = saleRows.length > 0 ? totDisc / saleRows.length : 0;
  // Verification: MRP_sales - Disc + Returns = Net Amt (within ₹2 for rounding) —
  // same formula/threshold as the .NET bill modal and Sale Report's own check.
  const calcCheck = Math.abs(totMrp - totDisc + totReturnAmt - totAmt) < 2;
  const billCount = new Set(bills.map((b) => b.no)).size;

  // Which single line item's rich detail popup is showing — tapping a compact
  // row opens this instead of always rendering full detail inline for every
  // row (matches .NET's mobile-appropriate drill-down: compact list → tap →
  // detail). Resets whenever the sheet itself closes.
  const [detailBill, setDetailBill] = useState<BillRow | null>(null);
  useEffect(() => {
    if (!visible) setDetailBill(null);
  }, [visible]);

  // "Article Picture" on a sold item — close this sheet first (an open RN Modal
  // would otherwise stay on top of the next screen), then open the upload
  // screen pre-set to that Brand + Article.
  const openArticlePicture = (b: BillRow) => {
    setDetailBill(null);
    onClose();
    setTimeout(() => navigate('Dashboard', { screen: 'ArticlePicture', params: { brandName: b.brand, articleNo: b.article } }), 250);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <Pressable style={[styles.modalSheet, { paddingBottom: insets.bottom + 12 }]} onPress={(e) => e.stopPropagation()}>
          <View style={styles.modalHead}>
            <View style={{ flex: 1 }}>
              <Text style={styles.modalTitle}>{label}</Text>
              {bills.length > 0 && (
                <Text style={styles.modalSub}>
                  Target: {money(tgt)} · Achieved: {money(ach)} · {pct}%
                  {rew + qrew > 0 ? ` · Reward: ${money(rew + qrew)}` : ''}
                </Text>
              )}
            </View>
            <Pressable style={styles.modalCloseBtn} onPress={onClose}>
              <Icon name="x" size={18} color={E.ink} />
            </Pressable>
          </View>

          <ScrollView style={styles.modalBody} contentContainerStyle={{ paddingBottom: spacing(2) }}>
            {bills.length === 0 ? (
              <Text style={styles.modalEmpty}>No bills found for this date.</Text>
            ) : (
              bills.map((b, idx) => <ModalBillRowCompact key={idx} bill={b} onPress={() => setDetailBill(b)} />)
            )}
          </ScrollView>

          {bills.length > 0 && (
            <View style={styles.modalFoot}>
              <View style={styles.modalFootRow}>
                <ModalFootStat label={`Bills${returnRows.length ? ` (${returnRows.length} ret)` : ''}`} value={String(billCount)} />
                <ModalFootStat label="Net Qty" value={qtyStr(totQty)} tint={E.primary} />
                <ModalFootStat
                  label="Net Amt"
                  value={money(totAmt)}
                  tint={E.green}
                  badge={calcCheck ? '✓' : '△'}
                  badgeTint={calcCheck ? E.green : E.yellow}
                />
                {rew + qrew > 0 && <ModalFootStat label="Reward" value={money(rew + qrew)} tint={E.yellow} />}
              </View>
              <View style={styles.modalFootRow}>
                <ModalFootStat label="MRP (sales)" value={money(totMrp)} />
                <ModalFootStat label="Disc Total" value={`-${money(totDisc)}`} tint={E.red} />
                {returnRows.length > 0 ? (
                  <>
                    <ModalFootStat label="Return Qty" value={qtyStr(totReturnQty)} tint={E.red} />
                    <ModalFootStat label="Returns" value={money(totReturnAmt)} tint={E.red} />
                  </>
                ) : (
                  <ModalFootStat label="Avg Disc" value={`-${money(avgDiscAmt)}`} tint={E.yellow} />
                )}
                <ModalFootStat label="Avg Disc %" value={`${avgDiscPct.toFixed(1)}%`} tint={E.yellow} />
              </View>
              {returnRows.length > 0 && calcCheck && (
                <Text style={styles.modalEquation}>
                  {money(totMrp)} MRP - {money(totDisc)} Disc + ({money(totReturnAmt)}) Returns = {money(totAmt)} ✓
                </Text>
              )}
            </View>
          )}

          {detailBill && <BillItemDetailOverlay bill={detailBill} onClose={() => setDetailBill(null)} onArticlePicture={openArticlePicture} />}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ── Compact bill row — item/bill no, article name, category tag, price only.
// Matches the same compact format as the page-level "Today's Bills" list
// (per .NET's `.st-today-bill-row` / bill-table row). Tap opens the full
// rich breakdown in BillItemDetailOverlay instead of showing it inline for
// every row always — the row-level tap-for-detail interaction .NET uses.
function ModalBillRowCompact({ bill, onPress }: { bill: BillRow; onPress: () => void }) {
  const isReturn = bill.qty < 0 || bill.amount < 0;
  const tag = [bill.category, bill.dept].filter(Boolean).join(' · ') || bill.brand || '';
  return (
    <Pressable
      style={({ pressed }) => [styles.modalBillRowCompact, isReturn && styles.modalBillRowReturn, pressed && styles.modalBillRowPressed]}
      onPress={onPress}
    >
      <View style={{ flex: 1 }}>
        <Text style={styles.modalBillCompactTitle} numberOfLines={1}>
          #{bill.no || '?'}  {bill.article || bill.brand || '-'}
          {isReturn && <Text style={styles.modalBillReturnTag}>  RETURN</Text>}
        </Text>
        {!!tag && (
          <Text style={styles.modalBillCompactTag} numberOfLines={1}>
            {tag}
          </Text>
        )}
      </View>
      <Text style={[styles.modalBillCompactAmt, isReturn && styles.modalBillReturnText]}>{money(bill.amount)}</Text>
      <Icon name="chevronRight" size={14} color={E.muted} />
    </Pressable>
  );
}

// ── Single line-item detail popup — the fuller breakdown (color/size,
// brand/dept, qty, MRP, discount amount + %, net amount, return tag,
// timestamp) that used to render inline for every row; now shown only for
// the tapped bill. Rendered as an in-sheet overlay (not a nested RN Modal)
// to avoid Android's nested-modal quirks.
function BillItemDetailOverlay({ bill, onClose, onArticlePicture }: { bill: BillRow; onClose: () => void; onArticlePicture: (b: BillRow) => void }) {
  const isReturn = bill.qty < 0 || bill.amount < 0;
  const discPct = bill.mrp > 0 && bill.discount > 0 ? Math.round((bill.discount / bill.mrp) * 1000) / 10 : null;
  return (
    <View style={styles.itemDetailOverlay}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      <View style={styles.itemDetailCard}>
        <View style={styles.itemDetailHead}>
          <Text style={styles.modalBillNo}>
            #{bill.no || '?'} <Text style={styles.modalBillTime}>{bill.dateStr}</Text>
            {isReturn && <Text style={styles.modalBillReturnTag}> RETURN</Text>}
          </Text>
          <Pressable style={styles.modalCloseBtn} onPress={onClose}>
            <Icon name="x" size={16} color={E.ink} />
          </Pressable>
        </View>
        <Text style={styles.modalBillArticle}>
          {bill.article || '-'}
          {bill.color || bill.size ? `  ·  ${[bill.color, bill.size].filter(Boolean).join(' / ')}` : ''}
        </Text>
        <Text style={styles.modalBillSub}>{[bill.brand, bill.dept, bill.category].filter(Boolean).join(' · ')}</Text>

        <View style={styles.itemDetailGrid}>
          <ItemDetailStat label="Qty" value={`${qtyStr(bill.qty)} pc`} tint={isReturn ? E.red : undefined} />
          <ItemDetailStat label="MRP" value={money(bill.mrp)} />
          {bill.discount > 0 && !isReturn ? (
            <ItemDetailStat label="Discount" value={`-${money(bill.discount)}${discPct != null ? ` (${discPct}%)` : ''}`} tint={E.red} />
          ) : (
            <ItemDetailStat label="Discount" value="—" />
          )}
          <ItemDetailStat label="Net Amount" value={money(bill.amount)} tint={isReturn ? E.red : E.green} />
        </View>

        {!!bill.article && !!bill.brand && (
          <Pressable style={({ pressed }) => [styles.itemPicBtn, pressed && { opacity: 0.85 }]} onPress={() => onArticlePicture(bill)}>
            <Icon name="camera" size={16} color="#fff" />
            <Text style={styles.itemPicBtnText}>Article Picture — upload / change</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

function ItemDetailStat({ label, value, tint }: { label: string; value: string; tint?: string }) {
  return (
    <View style={styles.itemDetailStat}>
      <Text style={[styles.itemDetailStatValue, tint && { color: tint }]}>{value}</Text>
      <Text style={styles.itemDetailStatLabel}>{label}</Text>
    </View>
  );
}

function ModalFootStat({ label, value, tint, badge, badgeTint }: { label: string; value: string; tint?: string; badge?: string; badgeTint?: string }) {
  return (
    <View style={styles.modalFootStat}>
      <View style={styles.modalFootStatValueRow}>
        <Text style={[styles.modalFootStatValue, tint && { color: tint }]}>{value}</Text>
        {badge ? <Text style={[styles.modalFootBadge, { color: badgeTint }]}>{badge}</Text> : null}
      </View>
      <Text style={styles.modalFootStatLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: E.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: E.bg },
  content: { padding: spacing(2), paddingBottom: spacing(6) },

  periodRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  periodArrow: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: E.surface,
    borderWidth: 1,
    borderColor: E.border,
  },
  periodPills: { flex: 1, flexDirection: 'row', backgroundColor: E.surface2, borderRadius: radius.sm, padding: 3, gap: 3 },
  periodPill: { flex: 1, paddingVertical: 8, borderRadius: radius.sm - 2, alignItems: 'center' },
  periodPillActive: { backgroundColor: E.primary },
  periodPillText: { fontSize: 12, fontWeight: '700', color: E.muted },
  periodPillTextActive: { color: '#fff' },
  periodLabel: { textAlign: 'center', fontSize: 12, color: E.muted, marginBottom: spacing(2), fontWeight: '600' },

  emptyCard: { marginBottom: spacing(2) },
  emptyText: { color: E.muted, textAlign: 'center', fontSize: 13 },

  scopeRow: { marginBottom: spacing(2) },
  scopePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: E.surface,
    borderWidth: 1,
    borderColor: E.border,
  },
  scopePillActive: { backgroundColor: E.primary, borderColor: E.primary },
  scopePillText: { fontSize: 12, fontWeight: '700', color: E.ink, maxWidth: 140 },
  scopePillTextActive: { color: '#fff' },

  heroCard: {
    marginBottom: spacing(2),
    borderRadius: radius.md,
    backgroundColor: E.primary,
    overflow: 'hidden',
    position: 'relative',
    ...shadow.card,
  },
  heroTitle: { fontSize: 17, fontWeight: '800', color: '#fff' },
  heroSubtitle: { fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 2 },
  heroEffFrom: { fontSize: 11, color: 'rgba(255,255,255,0.65)', marginTop: 2 },
  heroStatsRow: { flexDirection: 'row', gap: spacing(2), marginTop: spacing(2) },
  heroStat: { flex: 1 },
  heroStatValue: { fontSize: 16, fontWeight: '800', color: '#fff' },
  heroStatLabel: {
    fontSize: 10.5,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.75)',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },

  ringSection: { alignItems: 'center', paddingVertical: spacing(2.5) },
  ringCenter: { position: 'absolute', alignItems: 'center' },
  ringPct: { fontSize: 26, fontWeight: '800', color: E.ink },
  ringLabel: { fontSize: 11, fontWeight: '700', color: E.muted, letterSpacing: 0.5, marginTop: 2 },

  statGrid3: { flexDirection: 'row', gap: 8, marginBottom: spacing(1) },
  statGrid2: { flexDirection: 'row', gap: 8, marginBottom: spacing(2) },
  statBox: { flex: 1, backgroundColor: E.surface2, borderRadius: radius.sm, padding: 10, alignItems: 'center' },
  statBoxLabel: { fontSize: 9.5, fontWeight: '700', color: E.muted, letterSpacing: 0.4, marginBottom: 4, textAlign: 'center' },
  statBoxValue: { fontSize: 14, fontWeight: '800', color: E.ink, textAlign: 'center' },
  statBoxSub: { fontSize: 9.5, color: E.muted, marginTop: 2, textAlign: 'center' },

  rewardBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginTop: spacing(2),
    alignSelf: 'flex-start',
  },
  rewardBadgeText: { fontSize: 12, fontWeight: '700', color: '#fff' },

  // Brand chips row — mirrors .NET's `.st-chip-row` / `.st-brand-chip` / `.st-view-brands-btn`
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: spacing(1.5) },
  brandChip: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
    maxWidth: 150,
  },
  brandChipText: { fontSize: 11, fontWeight: '700', color: '#fff' },
  viewBrandsBtn: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 3,
  },
  viewBrandsText: { fontSize: 11, fontWeight: '800', color: E.primaryDark },

  // Hero big % stat — the "100.0% TODAY" hero number, like .NET's oversized
  // progress-ring center text, shown only in Today mode.
  heroBigStatRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: spacing(2) },
  heroBigStat: { fontSize: 44, fontWeight: '900', color: '#fff', letterSpacing: -1 },
  heroBigStatLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: 'rgba(255,255,255,0.8)',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  heroCaption: { fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 4 },
  heroRewardBadge: {
    marginTop: spacing(1.5),
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  heroRewardBadgePending: { backgroundColor: 'rgba(255,255,255,0.1)' },
  heroRewardBadgeText: { fontSize: 12.5, fontWeight: '800', color: '#fff' },

  // "This Week" progress row — small card directly under the hero in Today
  // mode, mirrors .NET's `.st-today-week-strip`.
  weekRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing(1.5),
    marginBottom: spacing(2),
  },
  weekRowLabel: { fontSize: 11, fontWeight: '700', color: E.muted, textTransform: 'uppercase', letterSpacing: 0.4 },
  weekRowValue: { fontSize: 15, fontWeight: '800', color: E.ink, marginTop: 2 },
  weekRowBadge: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  weekRowBadgeText: { fontSize: 13, fontWeight: '800' },

  // Assigned Brands modal
  brandsSectionLbl: {
    fontSize: 11,
    fontWeight: '800',
    color: E.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: spacing(2),
    marginBottom: spacing(1),
  },
  brandsPillGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  brandsPill: { backgroundColor: E.surface2, borderWidth: 1, borderColor: E.border, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  brandsPillText: { fontSize: 12, fontWeight: '700', color: E.ink },

  sectionHeading: { fontSize: 11, fontWeight: '800', color: E.muted, letterSpacing: 0.5, marginBottom: spacing(1), marginTop: spacing(1) },

  byTargetRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, paddingVertical: 12 },
  byTargetName: { flex: 1, fontSize: 13, fontWeight: '700', color: E.ink, marginRight: spacing(1) },
  byTargetRight: { alignItems: 'flex-end' },
  byTargetAmount: { fontSize: 12, color: E.muted },
  byTargetPct: { fontSize: 14, fontWeight: '800', marginTop: 2 },

  byEmployeeCard: { marginBottom: spacing(2) },
  byEmployeeRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: E.border, gap: 8 },
  byEmployeeName: { flex: 1, fontSize: 12.5, fontWeight: '700', color: E.ink },
  byEmployeeAmount: { fontSize: 12.5, fontWeight: '800', color: E.primary },
  byEmployeeQty: { fontSize: 11, color: E.muted, minWidth: 56, textAlign: 'right' },

  teamCard: { marginBottom: spacing(2) },
  memberRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: E.border },
  memberName: { fontSize: 13, fontWeight: '700', color: E.ink },
  memberSub: { fontSize: 11, color: E.muted, marginTop: 2 },
  memberPct: { fontSize: 14, fontWeight: '800' },

  // Today mode
  todayCard: { marginBottom: spacing(2) },
  // Day header — "THURSDAY" + "13 Aug 2026", mirrors .NET's `.st-today-day-name` / `.st-today-date-full`.
  dayHeaderRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: spacing(1.5) },
  dayHeaderName: { fontSize: 13, fontWeight: '800', color: E.muted, letterSpacing: 1, textTransform: 'uppercase' },
  dayHeaderDate: { fontSize: 13, fontWeight: '700', color: E.ink },
  todayProgressBarBg: { height: 10, borderRadius: 5, backgroundColor: E.surface2, overflow: 'hidden' },
  todayProgressBarFill: { height: '100%', borderRadius: 5 },
  todayProgressLblRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  todayProgressLbl: { fontSize: 11.5, color: E.muted, fontWeight: '600' },
  todayRewBadge: { fontSize: 11.5, fontWeight: '700', marginTop: 6 },
  todayRewEarned: { color: E.green },
  todayRewPending: { color: E.muted },
  todayBillsCard: { marginBottom: spacing(2), padding: 0, overflow: 'hidden' },
  todayBillRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: spacing(1.5), borderBottomWidth: 1, borderBottomColor: E.border },
  todayBillNo: { fontSize: 11.5, fontWeight: '800', color: E.primary, minWidth: 44 },
  todayBillBrand: { fontSize: 12.5, fontWeight: '700', color: E.ink },
  todayBillDept: { fontSize: 10.5, color: E.muted, marginTop: 2 },
  todayBillAmt: { fontSize: 13, fontWeight: '800', color: E.ink },

  // Day grid (week + month modes)
  dayGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: spacing(2) },
  dayCard: {
    width: '48%',
    backgroundColor: E.surface,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: E.border,
    padding: 10,
  },
  dayCardToday: { borderColor: E.primary, borderWidth: 1.5 },
  dayCardFuture: { opacity: 0.5 },
  dayCardDate: { fontSize: 11, fontWeight: '800', color: E.ink, marginBottom: 6 },
  dayCardBar: { height: 5, borderRadius: 3, backgroundColor: E.surface2, overflow: 'hidden', marginBottom: 6 },
  dayCardBarFill: { height: '100%', borderRadius: 3 },
  dayCardAch: { fontSize: 15, fontWeight: '800', color: E.ink },
  dayCardUnit: { fontSize: 11, fontWeight: '600', color: E.muted },
  dayCardTgt: { fontSize: 10.5, color: E.muted, marginTop: 1 },
  dayCardRew: { fontSize: 10.5, fontWeight: '700', marginTop: 4 },
  dayCardRewEarned: { color: E.green },
  dayCardRewPending: { color: E.muted },
  dayCardPcs: { fontSize: 10, color: E.green, fontWeight: '700', marginTop: 4 },
  dayCardBills: { fontSize: 10, color: E.primary, fontWeight: '700', marginTop: 6 },

  // Month accordion
  monthWeekCard: { marginBottom: spacing(1.5) },
  monthWeekHead: { flexDirection: 'row', alignItems: 'center' },
  monthWeekTitle: { fontSize: 12.5, fontWeight: '800', color: E.ink },
  monthWeekMeta: { fontSize: 11, color: E.muted, marginTop: 2 },

  // Achievement Slabs
  slabCard: { marginBottom: spacing(2) },
  slabRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 10 },
  slabRowBorder: { borderTopWidth: 1, borderTopColor: E.border },
  slabNumWrap: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: E.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  slabNumWrapHit: { backgroundColor: E.green, borderColor: E.green },
  slabNum: { fontSize: 11, fontWeight: '800', color: E.muted },
  slabPct: { fontSize: 13, fontWeight: '800', color: E.ink },
  slabDetail: { fontSize: 11, color: E.muted, marginTop: 2 },
  slabDetailBold: { fontWeight: '800', color: E.ink },

  // Rewards summary
  rewardsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: spacing(1.5) },
  rewardMini: {
    minWidth: '30%',
    flexGrow: 1,
    backgroundColor: E.surface,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: E.border,
    borderLeftWidth: 3,
    padding: 10,
  },
  rewardMiniValue: { fontSize: 14, fontWeight: '800', marginTop: 6 },
  rewardMiniLabel: { fontSize: 10, color: E.muted, marginTop: 2 },
  rewardMiniSub: { fontSize: 9.5, color: E.muted, marginTop: 2 },
  totalRewardCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing(2) },
  totalRewardLabel: { fontSize: 11.5, fontWeight: '700', color: E.muted },
  totalRewardValue: { fontSize: 20, fontWeight: '800', color: E.ink, marginTop: 2 },
  totalRewardSlabNote: { fontSize: 10.5, color: E.muted, marginTop: 3 },

  // Max you can earn
  maxEarnCard: { marginBottom: spacing(2) },
  maxEarnBlock: {},
  maxEarnHeadRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  maxEarnLabel: { fontSize: 11, fontWeight: '800', color: E.muted, textTransform: 'uppercase' },
  maxEarnValue: { fontSize: 18, fontWeight: '800', color: E.primary },
  maxEarnBreakdown: { fontSize: 11, color: E.muted, marginTop: 4, lineHeight: 16 },

  pacingCard: { marginBottom: spacing(2) },
  runRatePill: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, marginBottom: 6 },
  runRateText: { fontSize: 11, fontWeight: '800' },
  pacingMeta: { fontSize: 11, color: E.muted, marginBottom: spacing(1.5) },
  pacingStatsRow: { flexDirection: 'row', gap: spacing(2), marginBottom: spacing(1.5) },
  pacingStat: { flex: 1 },
  pacingStatValue: { fontSize: 14, fontWeight: '800', color: E.ink },
  pacingStatLabel: { fontSize: 10.5, color: E.muted, marginTop: 2 },
  pacingBreakdown: { fontSize: 11, color: E.muted, marginTop: -4, marginBottom: spacing(1.5), lineHeight: 16 },
  pacingNeeded: { fontSize: 12, color: E.ink, marginTop: 4 },
  nextSlabBox: { backgroundColor: E.surface2, borderRadius: radius.sm, padding: 10, marginTop: spacing(1.5) },
  nextSlabText: { fontSize: 12, color: E.ink, lineHeight: 17 },

  // Bill drill-down modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: E.surface, borderTopLeftRadius: radius.md, borderTopRightRadius: radius.md, maxHeight: '85%' },
  modalHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: spacing(2),
    borderBottomWidth: 1,
    borderBottomColor: E.border,
  },
  modalTitle: { fontSize: 15, fontWeight: '800', color: E.ink },
  modalSub: { fontSize: 11.5, color: E.muted, marginTop: 4 },
  modalCloseBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: E.surface2,
  },
  modalBody: { paddingHorizontal: spacing(2) },
  modalEmpty: { textAlign: 'center', padding: spacing(4), color: E.muted, fontSize: 13 },

  modalBillRow: { flexDirection: 'row', paddingVertical: spacing(1.5), borderBottomWidth: 1, borderBottomColor: E.border, gap: 10 },
  modalBillRowReturn: { backgroundColor: '#fef2f2' },
  modalBillNo: { fontSize: 11.5, fontWeight: '800', color: E.ink },
  modalBillTime: { fontSize: 10.5, fontWeight: '600', color: E.muted },
  modalBillReturnTag: { fontSize: 9.5, fontWeight: '800', color: E.red },
  modalBillArticle: { fontSize: 12.5, fontWeight: '700', color: E.ink, marginTop: 3 },
  modalBillSub: { fontSize: 10.5, color: E.muted, marginTop: 2 },
  modalBillRight: { alignItems: 'flex-end', minWidth: 78 },
  modalBillQty: { fontSize: 11, fontWeight: '700', color: E.ink },
  modalBillMrp: { fontSize: 10.5, color: E.muted, marginTop: 2 },
  modalBillDisc: { fontSize: 10.5, color: E.red, marginTop: 2 },
  modalBillAmt: { fontSize: 13, fontWeight: '800', color: E.ink, marginTop: 3 },
  modalBillReturnText: { color: E.red },

  // Compact bill row (day-modal list) — #no + article + category tag + price only.
  // Tapping opens BillItemDetailOverlay for the full breakdown.
  modalBillRowCompact: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: spacing(1.25),
    borderBottomWidth: 1,
    borderBottomColor: E.border,
  },
  modalBillRowPressed: { backgroundColor: E.surface2 },
  modalBillCompactTitle: { fontSize: 12.5, fontWeight: '700', color: E.ink },
  modalBillCompactTag: { fontSize: 10.5, color: E.muted, marginTop: 2 },
  modalBillCompactAmt: { fontSize: 13, fontWeight: '800', color: E.ink },

  // Single line-item detail popup, shown as an in-sheet overlay over the
  // bill-drilldown modal when a compact row is tapped.
  itemDetailOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing(3),
    zIndex: 20,
  },
  itemDetailCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: E.surface,
    borderRadius: radius.md,
    padding: spacing(2.5),
    ...shadow.card,
  },
  itemDetailHead: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: spacing(1) },
  itemDetailGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: spacing(2) },
  itemDetailStat: { minWidth: '45%', flexGrow: 1, backgroundColor: E.surface2, borderRadius: radius.sm, padding: 10 },
  itemDetailStatValue: { fontSize: 14, fontWeight: '800', color: E.ink },
  itemPicBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: spacing(2), paddingVertical: 12, borderRadius: radius.sm, backgroundColor: E.primary },
  itemPicBtnText: { fontSize: 13.5, fontWeight: '800', color: '#fff' },
  itemDetailStatLabel: { fontSize: 10, color: E.muted, marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.4 },

  modalFoot: { borderTopWidth: 1, borderTopColor: E.border, padding: spacing(1.5) },
  modalFootRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 6 },
  modalFootStat: {
    minWidth: '22%',
    flexGrow: 1,
    backgroundColor: E.surface2,
    borderRadius: radius.sm,
    padding: 8,
  },
  modalFootStatValueRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  modalFootStatValue: { fontSize: 12.5, fontWeight: '800', color: E.ink },
  modalFootBadge: { fontSize: 11, fontWeight: '800' },
  modalFootStatLabel: { fontSize: 9.5, color: E.muted, marginTop: 2 },
  modalEquation: { fontSize: 10.5, color: E.muted, textAlign: 'center', marginTop: 4 },

  bcCard: { marginBottom: spacing(1.5) },
  bcHeadRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: spacing(1) },
  brandChipMuted: { backgroundColor: E.surface2, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3, marginRight: 6, marginBottom: 4 },
  brandChipMutedText: { fontSize: 10.5, color: E.muted, fontWeight: '700' },
  bcMeta: { fontSize: 11, color: E.muted, marginTop: 2 },
  bcTotalBadge: { backgroundColor: E.green + '1a', borderRadius: radius.sm, paddingHorizontal: 10, paddingVertical: 6 },
  bcTotalBadgeText: { fontSize: 13, fontWeight: '800', color: E.green },
  bcRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderTopWidth: 1, borderTopColor: E.border, gap: 8 },
  bcRowLabel: { fontSize: 12.5, fontWeight: '700', color: E.ink },
  bcRowSub: { fontSize: 11, color: E.muted, marginTop: 1 },
  bcRowValue: { fontSize: 14, fontWeight: '800', color: E.ink },
  bcTeamList: { paddingLeft: spacing(1), paddingBottom: 4 },
  bcTeamRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 5, gap: 8 },
  bcTeamName: { flex: 1, fontSize: 11.5, color: E.ink },
  bcTeamQty: { fontSize: 11, color: E.muted },
  bcTeamEarned: { fontSize: 11.5, fontWeight: '700', color: E.ink, minWidth: 60, textAlign: 'right' },

  milestoneCard: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: E.yellow + '1a', borderWidth: 1, borderColor: E.yellow + '40' },
  milestoneIcon: { fontSize: 20 },
  milestoneText: { flex: 1, fontSize: 12.5, color: E.ink, lineHeight: 18 },
  milestoneBold: { fontWeight: '800' },
});
