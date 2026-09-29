import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, Linking, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { triggerFestivalGreetingRecheck } from '../../components/FestivalGreetingModal';
import Svg, { Circle, Polygon } from 'react-native-svg';
import Card from '../../components/Card';
import Button from '../../components/Button';
import Icon, { IconName } from '../../components/Icon';
import { colors, radius, shadow, spacing } from '../../theme';
import { useAuth } from '../../context/AuthContext';
import {
  getTodayStatus,
  getKpi,
  getKpiCalendar,
  getTodaySelfies,
  TodayKpi,
  RangeKpi,
  KpiCalDay,
  KpiSwipe,
  TodaySelfie,
  TodayBreakSelfie,
} from '../../api/attendanceApi';
import { getPendingApprovals, approveLeave, rejectLeave, PendingApproval } from '../../api/leaveApi';
import { getProfile, ProfileResponse } from '../../api/profileApi';
import { getSaleReportScope } from '../../api/saleReportApi';
import { getLiveStockBrands } from '../../api/employeeLiveStockApi';
import { getBarcodeEarnedStatus } from '../../api/barcodeEarnedApi';
import { connectSocket, disconnectSocket } from '../../sockets/socketClient';
import { resolveFileUrl } from '../../utils/fileUrl';
import { useSelfieCapture } from '../../hooks/useSelfieCapture';
import NotificationPermissionBanner from '../../components/NotificationPermissionBanner';

/** "dddd, dd MMM yyyy" — mirrors litTodayDate.Text in Dashboard.aspx.cs. */
function formatGreetingDate(d: Date) {
  return d.toLocaleDateString('en-GB', { weekday: 'long', day: '2-digit', month: 'short', year: 'numeric' });
}
/** "hh:mm:ss AM/PM" — mirrors empLiveClock in Dashboard.Master's employeedashboard.js. */
function formatLiveClock(d: Date) {
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
}
/** Opens the captured lat/lng in the device's map app — same pattern as the admin CheckInSelfieViewerModal. */
function openInMaps(latitude: number, longitude: number) {
  Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`).catch(() => {});
}

/** "morning"/"afternoon"/"evening" by hour — mirrors Dashboard.aspx.cs's Greeting(). */
function greetingPeriod(d: Date) {
  const h = d.getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}
/** Same month+day comparison as Dashboard.Master.cs's IsBirthdayToday/IsAnniversaryToday. */
function isTodayMonthDay(iso: string | null, today: Date) {
  if (!iso) return false;
  const d = new Date(iso);
  return d.getMonth() === today.getMonth() && d.getDate() === today.getDate();
}
/** Mirrors Dashboard.Master.cs's IsProfileIncomplete(Employee emp) — only relevant once KYC is locked. */
function isProfileIncomplete(profile: ProfileResponse | null) {
  const kyc = profile?.kyc;
  if (!kyc || !kyc.locked) return false;
  const missingMaritalStatus = !kyc.maritalStatus;
  const missingAnniversary = kyc.maritalStatus === 'Married' && !kyc.anniversaryDate;
  const missingAddress = !kyc.address;
  const missingEmail = !kyc.email || !kyc.isEmailVerified;
  return missingMaritalStatus || missingAnniversary || missingAddress || missingEmail;
}

const E = colors.emp;

export default function DashboardScreen({ navigation }: any) {
  const { user, token } = useAuth();

  useFocusEffect(
    useCallback(() => {
      triggerFestivalGreetingRecheck();
    }, [])
  );
  const [swipeCount, setSwipeCount] = useState(0);
  const [needsSelfie, setNeedsSelfie] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [today, setToday] = useState<TodayKpi | null>(null);
  const [month, setMonth] = useState<RangeKpi | null>(null);
  const [pending, setPending] = useState<PendingApproval[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkInSelfie, setCheckInSelfie] = useState<TodaySelfie | null>(null);
  const [breakSelfies, setBreakSelfies] = useState<TodayBreakSelfie[]>([]);
  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [saleReportConfigured, setSaleReportConfigured] = useState(false);
  const [liveStockConfigured, setLiveStockConfigured] = useState(false);
  const [barcodeEarnedConfigured, setBarcodeEarnedConfigured] = useState(false);
  const [now, setNow] = useState(new Date());
  const [rejectTarget, setRejectTarget] = useState<PendingApproval | null>(null);
  const [rejectRemark, setRejectRemark] = useState('');
  // "My Status Overview" tile tap → shared month calendar modal (mirrors empKpiDetail).
  const [calModalVisible, setCalModalVisible] = useState(false);
  const [calModalKey, setCalModalKey] = useState<string | null>(null);
  // "Monthly Overview" tile tap → date list modal (mirrors window.empMonthDetail).
  const [monthListVisible, setMonthListVisible] = useState(false);
  const [monthListKey, setMonthListKey] = useState<string | null>(null);

  const openKpiModal = (key: string) => {
    setCalModalKey(key);
    setCalModalVisible(true);
  };
  const openMonthListModal = (key: string) => {
    setMonthListKey(key);
    setMonthListVisible(true);
  };

  const { capturing, capture: captureSelfie } = useSelfieCapture((type, success, message) => {
    if (!success) {
      Alert.alert('Not saved', message);
      return;
    }
    if (type === 'checkin') setNeedsSelfie(false);
    load();
  });

  const load = useCallback(async () => {
    try {
      const [statusRes, kpiRes, pendingRes, selfiesRes, profileRes, saleReportScopeRes, liveStockBrandsRes, barcodeEarnedRes] = await Promise.all([
        getTodayStatus(),
        getKpi(),
        getPendingApprovals().catch(() => ({ data: { pending: [] } })),
        getTodaySelfies().catch(() => null),
        getProfile().catch(() => null),
        getSaleReportScope().catch(() => null),
        getLiveStockBrands().catch(() => null),
        getBarcodeEarnedStatus().catch(() => null),
      ]);
      setSwipeCount(statusRes.data.swipeCount);
      setNeedsSelfie(statusRes.data.needsCheckInSelfie);
      setToday(kpiRes.data.today);
      setMonth(kpiRes.data.month);
      setPending(pendingRes.data.pending);
      if (selfiesRes) {
        setCheckInSelfie(selfiesRes.data.checkIn);
        setBreakSelfies(selfiesRes.data.breaks);
      }
      if (profileRes) setProfile(profileRes.data);
      setSaleReportConfigured(!!saleReportScopeRes?.data.configured);
      setLiveStockConfigured(!!liveStockBrandsRes?.data.brands.length);
      setBarcodeEarnedConfigured(!!barcodeEarnedRes?.data.configured);
    } catch {
      /* biometric device DB may be temporarily unreachable — non-fatal */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    if (!token) return;
    const socket = connectSocket(token);
    const onToday = (payload: { swipeCount: number; needsCheckInSelfie: boolean }) => {
      setSwipeCount(payload.swipeCount);
      setNeedsSelfie(payload.needsCheckInSelfie);
    };
    const onSelfieUploaded = () => load();
    socket.on('attendance:today', onToday);
    socket.on('attendance:selfie-uploaded', onSelfieUploaded);
    return () => {
      socket.off('attendance:today', onToday);
      socket.off('attendance:selfie-uploaded', onSelfieUploaded);
    };
  }, [token, load]);

  useEffect(() => () => disconnectSocket(), []);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const handleApprove = async (item: PendingApproval) => {
    try {
      await approveLeave(item.leaveApplicationId);
      setPending((p) => p.filter((x) => x.leaveApplicationId !== item.leaveApplicationId));
    } catch (err: any) {
      Alert.alert('Could not approve', err?.response?.data?.message || 'Please try again.');
    }
  };

  const handleReject = (item: PendingApproval) => {
    setRejectRemark('');
    setRejectTarget(item);
  };

  const confirmReject = async () => {
    if (!rejectTarget) return;
    const target = rejectTarget;
    setRejectTarget(null);
    try {
      await rejectLeave(target.leaveApplicationId, rejectRemark.trim() || undefined);
      setPending((p) => p.filter((x) => x.leaveApplicationId !== target.leaveApplicationId));
    } catch (err: any) {
      Alert.alert('Could not reject', err?.response?.data?.message || 'Please try again.');
    }
  };

  // "Good {period}, {FirstName}!" — mirrors Dashboard.aspx.cs's greetText (litGreeting/litWelcome).
  const firstName = (user?.name || '').split(' ')[0] || 'there';
  const greetingText = `Good ${greetingPeriod(now)}, ${firstName}!`;

  const isBirthdayToday = isTodayMonthDay(profile?.dateOfBirth ?? null, now);
  const isAnniversaryToday = isTodayMonthDay(profile?.anniversaryDate ?? null, now);
  const profileIncomplete = isProfileIncomplete(profile);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={E.primary} />
      </View>
    );
  }

  return (
    <>
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.greetingHero}>
        <View style={styles.greetingTopRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.greeting}>{greetingText}</Text>
            <Text style={styles.greetingSub}>Here's your attendance snapshot for today.</Text>
          </View>
          <View style={styles.liveClockWrap}>
            <Text style={styles.liveClockTime}>{formatLiveClock(now)}</Text>
            <Text style={styles.liveClockDate}>{now.toLocaleDateString('en-US', { weekday: 'short' })}</Text>
          </View>
        </View>
        <View style={styles.chipsRow}>
          <View style={styles.chip}>
            <Icon name="calendar" size={12} color={E.muted} />
            <Text style={styles.chipText}>{formatGreetingDate(now)}</Text>
          </View>
          <View style={styles.chip}>
            <Icon name="grid" size={12} color={E.muted} />
            <Text style={styles.chipText}>{profile?.organizationName || 'HRMS'}</Text>
          </View>
          <View style={styles.chip}>
            <View
              style={[
                styles.chipDot,
                { backgroundColor: today?.currentlyIn ? E.green : today?.arrivedToday ? E.muted : E.red },
              ]}
            />
            <Text style={styles.chipText}>
              {today?.currentlyIn
                ? `Checked In${today.arrivedTime ? ' at ' + today.arrivedTime : ''}`
                : today?.arrivedToday
                ? 'Checked Out'
                : 'Not punched yet'}
            </Text>
          </View>
        </View>
      </View>

      <NotificationPermissionBanner />

      <View style={styles.promoRow}>
        <Pressable style={styles.promoPressable} onPress={() => navigation.navigate('StockCheck')}>
          <Card style={styles.promoCard}>
            <View style={styles.promoBadge}>
              <Text style={styles.promoBadgeText}>NEW</Text>
            </View>
            <View style={styles.promoIconWrap}>
              <Icon name="search" size={18} color={E.primary} />
            </View>
            <Text style={styles.promoTitle}>Stock Check</Text>
            <Text style={styles.promoSubtitle}>Live stock, any branch</Text>
          </Card>
        </Pressable>
        {saleReportConfigured && (
          <Pressable style={styles.promoPressable} onPress={() => navigation.navigate('SaleReport')}>
            <Card style={styles.promoCard}>
              <View style={styles.promoBadge}>
                <Text style={styles.promoBadgeText}>NEW</Text>
              </View>
              <View style={styles.promoIconWrap}>
                <Icon name="barTrend" size={18} color={E.primary} />
              </View>
              <Text style={styles.promoTitle}>Sale Report</Text>
              <Text style={styles.promoSubtitle}>Day-wise or item-wise</Text>
            </Card>
          </Pressable>
        )}
        {liveStockConfigured && (
          <Pressable style={styles.promoPressable} onPress={() => navigation.navigate('LiveStock')}>
            <Card style={styles.promoCard}>
              <View style={styles.promoBadge}>
                <Text style={styles.promoBadgeText}>NEW</Text>
              </View>
              <View style={styles.promoIconWrap}>
                <Icon name="box" size={18} color={E.primary} />
              </View>
              <Text style={styles.promoTitle}>Live Stock</Text>
              <Text style={styles.promoSubtitle}>Balance, sold &amp; fast movers</Text>
            </Card>
          </Pressable>
        )}
      </View>

      {(barcodeEarnedConfigured || liveStockConfigured) && (
        <View style={styles.promoRow}>
          {barcodeEarnedConfigured && (
            <Pressable style={styles.promoPressable} onPress={() => navigation.navigate('BarcodeEarned')}>
              <Card style={styles.promoCard}>
                <View style={styles.promoBadge}>
                  <Text style={styles.promoBadgeText}>NEW</Text>
                </View>
                <View style={styles.promoIconWrap}>
                  <Icon name="dollar" size={18} color={E.primary} />
                </View>
                <Text style={styles.promoTitle}>Barcode Wise Earned</Text>
                <Text style={styles.promoSubtitle}>Date-wise, paid &amp; pending</Text>
              </Card>
            </Pressable>
          )}
          {/* Same condition as Live Stock (and the web's Article Picture banner) — an allocated Brand. */}
          {liveStockConfigured && (
            <Pressable style={styles.promoPressable} onPress={() => navigation.navigate('ArticlePicture')}>
              <Card style={styles.promoCard}>
                <View style={styles.promoBadge}>
                  <Text style={styles.promoBadgeText}>NEW</Text>
                </View>
                <View style={styles.promoIconWrap}>
                  <Icon name="camera" size={18} color={E.primary} />
                </View>
                <Text style={styles.promoTitle}>Article Picture</Text>
                <Text style={styles.promoSubtitle}>Upload article photos</Text>
              </Card>
            </Pressable>
          )}
        </View>
      )}

      {isBirthdayToday && (
        <View style={styles.bdayBanner}>
          <Text style={styles.bdayBannerText}>🎉🎁 Happy Birthday, {user?.name}! 🎂🎈</Text>
        </View>
      )}
      {isAnniversaryToday && (
        <View style={styles.annivBanner}>
          <Text style={styles.annivBannerText}>🎉❤️ Happy Anniversary, {user?.name}! ❤️🎉</Text>
        </View>
      )}

      {user?.approvalStatus === 'Trial' && (
        <Card style={styles.trialCard}>
          <Text style={styles.trialText}>Your account is pending HR approval. Some features are limited until then.</Text>
        </Card>
      )}

      {profileIncomplete && (
        <Pressable onPress={() => navigation.navigate('Profile')}>
          <Card style={styles.nagCard}>
            <Text style={styles.nagTitle}>Complete your profile</Text>
            <Text style={styles.nagText}>A few details are missing — tap to fill them in when you get a chance.</Text>
          </Card>
        </Pressable>
      )}

      <Card style={styles.statusCard}>
        <Text style={styles.statusLabel}>Today's punches (device)</Text>
        <Text style={styles.statusValue}>{swipeCount}</Text>
      </Card>

      <SectionCard title="Check-In Selfie" subtitle="Mandatory — captured once per day, along with your location">
        {checkInSelfie ? (
          <>
            <Text style={styles.selfieOkText}>Check-in selfie submitted for today.</Text>
            <View style={styles.selfieThumbWrap}>
              <Image source={{ uri: resolveFileUrl(checkInSelfie.url)! }} style={styles.selfieThumb} />
              <Text style={styles.selfieThumbLabel}>Check-In</Text>
              {!!checkInSelfie.capturedAt && <Text style={styles.selfieTimeText}>{checkInSelfie.capturedAt}</Text>}
              <Pressable
                style={styles.selfieLocRow}
                disabled={!checkInSelfie.hasLocation}
                onPress={() => checkInSelfie.hasLocation && openInMaps(checkInSelfie.latitude!, checkInSelfie.longitude!)}
              >
                <Icon name="mapPin" size={12} color={checkInSelfie.hasLocation ? E.primary : E.muted} />
                <Text style={[styles.selfieLocText, !checkInSelfie.hasLocation && styles.selfieLocTextMuted]}>
                  {checkInSelfie.hasLocation ? `${checkInSelfie.latitude?.toFixed(5)}, ${checkInSelfie.longitude?.toFixed(5)}` : 'No location'}
                </Text>
              </Pressable>
            </View>
          </>
        ) : needsSelfie ? (
          <Button title="Take Check-In Selfie" onPress={() => captureSelfie('checkin')} loading={capturing === 'checkin'} />
        ) : (
          <Text style={styles.selfieMutedText}>Not available right now — please try again shortly.</Text>
        )}
      </SectionCard>

      <SectionCard title="Break Selfie" subtitle="Required for every punch after your first check-in of the day">
        <Button title="Take Selfie" variant="outline" onPress={() => captureSelfie('break')} loading={capturing === 'break'} style={{ marginBottom: breakSelfies.length ? spacing(1.5) : 0 }} />
        {breakSelfies.length > 0 ? (
          <View style={styles.breakSelfieGrid}>
            {breakSelfies.map((s, i) => (
              <View key={i} style={styles.breakSelfieCard}>
                <Image source={{ uri: resolveFileUrl(s.url)! }} style={styles.breakSelfiePhoto} />
                <View style={styles.breakSelfieBadgeRow}>
                  <Text style={styles.breakSelfieLabel}>Break #{s.breakNumber}</Text>
                  {s.isExcess && (
                    <View style={styles.breakSelfieExcessPill}>
                      <Text style={styles.breakSelfieExcessText}>Excess</Text>
                    </View>
                  )}
                </View>
                {!!s.capturedAt && <Text style={styles.selfieTimeTextSmall}>{s.capturedAt}</Text>}
                <Pressable
                  style={styles.selfieLocRowSmall}
                  disabled={!s.hasLocation}
                  onPress={() => s.hasLocation && openInMaps(s.latitude!, s.longitude!)}
                >
                  <Icon name="mapPin" size={10} color={s.hasLocation ? E.primary : E.muted} />
                  <Text style={[styles.selfieLocTextSmall, !s.hasLocation && styles.selfieLocTextMuted]} numberOfLines={1}>
                    {s.hasLocation ? `${s.latitude?.toFixed(4)}, ${s.longitude?.toFixed(4)}` : 'No location'}
                  </Text>
                </Pressable>
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.selfieMutedText}>No break selfies captured yet today.</Text>
        )}
      </SectionCard>

      {pending.length > 0 && (
        <SectionCard title="Pending Leave Approvals" subtitle={`${pending.length} request${pending.length > 1 ? 's' : ''} from your team`}>
          {pending.map((item) => (
            <View key={item.leaveApplicationId} style={styles.approvalRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.approvalName}>
                  {item.empName} <Text style={styles.approvalCode}>· {item.shortCode}</Text>
                </Text>
                <Text style={styles.approvalDates}>
                  {item.fromDate === item.toDate ? item.fromDate : `${item.fromDate} – ${item.toDate}`} ({item.totalDays}d)
                </Text>
                {item.reason ? <Text style={styles.approvalReason}>{item.reason}</Text> : null}
              </View>
              <View style={styles.approvalActions}>
                <Pressable style={[styles.approvalBtn, styles.approvalBtnApprove]} onPress={() => handleApprove(item)}>
                  <Icon name="check" size={16} color="#fff" />
                </Pressable>
                <Pressable style={[styles.approvalBtn, styles.approvalBtnReject]} onPress={() => handleReject(item)}>
                  <Icon name="x" size={16} color="#fff" />
                </Pressable>
              </View>
            </View>
          ))}
        </SectionCard>
      )}

      <SectionCard title="My Status Overview" subtitle="Live data for today">
        <View style={styles.kpiGrid}>
          {today ? (
            <>
              {/* Tile set + order mirrors Dashboard.aspx's renderToday() — Currently Working,
                  On Break, Not Yet Come and Half Day are commented out there (dead cards,
                  never rendered in production), so they're left out here too. Every tile
                  below opens the shared month-calendar modal on tap, same as empKpiDetail(). */}
              <KpiCard
                icon="logIn"
                color="green"
                title="Arrived Today"
                value={today.arrivedToday ? today.arrivedTime || '—' : '—'}
                sub={today.arrivedToday ? 'First punch recorded' : 'No swipe yet today'}
                dot={today.arrivedToday ? 'good' : 'muted'}
                onPress={() => openKpiModal('arrived')}
              />
              <KpiCard
                icon="zap"
                color="amber"
                title="High Puncher"
                value={`${today.punchCount || 0} punch`}
                sub={today.isHighPuncher ? 'High punch count' : 'Normal range'}
                dot={today.isHighPuncher ? 'warn' : 'good'}
                onPress={() => openKpiModal('highPunch')}
              />
              <KpiCard
                icon="alertCircle"
                color="red"
                title="Late Coming"
                value={today.isLate ? `${today.lateMinutes} min late` : '0 min late'}
                sub={today.isLate ? 'After grace period' : 'Within grace window'}
                dot={today.isLate ? 'danger' : 'good'}
                onPress={() => openKpiModal('late')}
              />
              <KpiCard
                icon="logOut"
                color="pink"
                title="Early Going"
                value={today.isEarlyGoing ? `${today.earlyGoingMins} min early` : '0 min early'}
                sub={today.isEarlyGoing ? 'Left early yesterday' : 'On time yesterday'}
                dot={today.isEarlyGoing ? 'warn' : 'good'}
                onPress={() => openKpiModal('earlyGoing')}
              />
              <KpiCard
                icon="clockAlert"
                color="rose"
                title="Excess Break"
                value={today.isExcessBreak ? `+${today.excessBreakMins} min` : 'OK'}
                sub={today.isExcessBreak ? 'Exceeded break limit' : 'Within allocated break'}
                dot={today.isExcessBreak ? 'danger' : 'good'}
                onPress={() => openKpiModal('excessBreak')}
              />
              <KpiCard
                icon="calendar"
                color="purple"
                title="On Leave"
                value={today.isOnLeave ? today.leaveType || 'Leave' : 'No Leave'}
                sub={today.isOnLeave ? 'On approved leave today' : 'No leave today'}
                dot={today.isOnLeave ? 'warn' : 'good'}
                onPress={() => openKpiModal('onLeave')}
              />
            </>
          ) : (
            <Text style={styles.emptyText}>Status data unavailable.</Text>
          )}
        </View>
      </SectionCard>

      {month && month.calDays?.length > 0 && <MonthCalendar initial={month} />}
      {month && month.calDays?.length > 0 && <MonthlySummary month={month} onSelectTile={openMonthListModal} />}
    </ScrollView>

    <Modal visible={!!rejectTarget} transparent animationType="fade" onRequestClose={() => setRejectTarget(null)}>
      <Pressable style={styles.modalBackdrop} onPress={() => setRejectTarget(null)}>
        <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.modalTitle}>Reject Leave Request</Text>
          <Text style={styles.modalSub}>Provide a reason (optional) before rejecting.</Text>
          <TextInput
            style={styles.modalTextArea}
            placeholder="e.g. Insufficient staff coverage on those dates..."
            placeholderTextColor={E.muted}
            multiline
            numberOfLines={3}
            value={rejectRemark}
            onChangeText={setRejectRemark}
          />
          <View style={styles.modalBtnRow}>
            <Pressable style={[styles.modalBtn, styles.modalBtnCancel]} onPress={() => setRejectTarget(null)}>
              <Text style={styles.modalBtnCancelText}>Cancel</Text>
            </Pressable>
            <Pressable style={[styles.modalBtn, styles.modalBtnReject]} onPress={confirmReject}>
              <Text style={styles.modalBtnRejectText}>Confirm Reject</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>

    <KpiCalendarModal
      visible={calModalVisible}
      kpiKey={calModalKey}
      initialMonth={month}
      onClose={() => setCalModalVisible(false)}
    />
    <MonthDateListModal
      visible={monthListVisible}
      monthKey={monthListKey}
      monthData={month}
      onClose={() => setMonthListVisible(false)}
    />
    </>
  );
}

function SectionCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <Card style={styles.sectionCard}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
      {children}
    </Card>
  );
}

const KPI_COLORS: Record<string, string> = {
  green: E.green,
  amber: '#d97706',
  red: E.red,
  pink: '#db2777',
  rose: '#e11d48',
  purple: E.purple,
  blue: E.blue,
  orange: '#f97316',
  gray: E.muted,
  teal: '#0d9488',
};
const DOT_COLORS: Record<string, string> = { good: E.green, warn: '#d97706', danger: E.red, muted: E.muted };

function KpiCard({
  icon,
  color,
  title,
  value,
  sub,
  dot,
  onPress,
}: {
  icon: IconName;
  color: string;
  title: string;
  value: string;
  sub: string;
  dot: 'good' | 'warn' | 'danger' | 'muted';
  onPress?: () => void;
}) {
  const tint = KPI_COLORS[color] || E.primary;
  return (
    <Pressable style={styles.kpiCard} onPress={onPress} disabled={!onPress}>
      <View style={[styles.kpiIcon, { backgroundColor: tint + '1a' }]}>
        <Icon name={icon} size={20} color={tint} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.kpiValue} numberOfLines={1}>{value}</Text>
        <Text style={styles.kpiTitle}>{title}</Text>
        <View style={styles.kpiSubRow}>
          <View style={[styles.kpiDot, { backgroundColor: DOT_COLORS[dot] }]} />
          <Text style={styles.kpiSub} numberOfLines={1}>{sub}</Text>
        </View>
      </View>
      {/* mirrors .emp-kpi-arr — every card is a tap target that opens the calendar drill-down */}
      {onPress ? <Icon name="chevronRight" size={16} color={E.muted} /> : null}
    </Pressable>
  );
}

// 'excess' shares the same green background as 'ok' — the employee WAS
// present that day, they just also went over their break allowance. The
// distinction is carried by ExcessBreakFlag's corner mark instead of a
// different background color — mirrors the admin calendar's treatment
// exactly (AttendanceCalendarModal.tsx's ExcessBreakFlag). 'late' is no
// longer a distinct background either, for the same reason — it's the
// separate LateFlag corner below, driven by day.isLate, not by `status`
// (a day can be both late AND excess-break at once, same as admin).
const CAL_STATUS_COLOR: Record<string, string> = {
  ok: E.green,
  excess: E.green,
  leave: E.purple,
  absent: E.red,
  weekend: E.muted,
  upcoming: E.border,
};

/** Top-left corner mark — mirrors AttendanceCalendarModal.tsx's LateFlag exactly, same colors/geometry. */
function LateFlag() {
  return (
    <View style={styles.calLateFlagWrap} pointerEvents="none">
      <Svg width={13} height={13} viewBox="0 0 15 15">
        <Polygon points="0,0 15,0 0,15" fill="#fbbf24" />
      </Svg>
    </View>
  );
}

/** Top-right corner mark — mirrors AttendanceCalendarModal.tsx's ExcessBreakFlag exactly, same colors/geometry. */
function ExcessBreakFlag() {
  return (
    <View style={styles.calExcessFlagWrap} pointerEvents="none">
      <Svg width={13} height={13} viewBox="0 0 15 15">
        <Polygon points="0,0 15,0 15,15" fill="#dc2626" />
      </Svg>
    </View>
  );
}

/** Live-navigable month calendar — mirrors the "My Status Overview" KPI calendar (GetKpiMonthCalendar.ashx). */
function MonthCalendar({ initial }: { initial: RangeKpi }) {
  const [data, setData] = useState<RangeKpi>(initial);
  const [loading, setLoading] = useState(false);

  const navigate = async (delta: number) => {
    const base = new Date(data.calYear, data.calMonth - 1 + delta, 1);
    setLoading(true);
    try {
      const res = await getKpiCalendar(base.getFullYear(), base.getMonth() + 1);
      setData({ ...data, ...res.data });
    } catch {
      /* keep showing previous month on failure */
    } finally {
      setLoading(false);
    }
  };

  const onDayPress = (day: KpiCalDay) => {
    if (day.status === 'upcoming') return;
    const lines = [
      `Status: ${day.status === 'ok' ? 'Present' : day.status === 'excess' ? 'Excess Break' : day.status[0].toUpperCase() + day.status.slice(1)}`,
      day.checkIn ? `First In: ${day.checkIn}` : null,
      day.checkOut ? `Last Punch: ${day.checkOut}` : null,
      day.shiftStart ? `Shift: ${day.shiftStart} – ${day.shiftEnd}` : null,
      day.exMins ? `Excess by: ${day.exMins} min` : null,
    ].filter(Boolean);
    Alert.alert(day.dateDisplay, lines.join('\n'));
  };

  const weeks = useMemo(() => {
    const cells: (KpiCalDay | null)[] = Array((data as any).firstDow ?? 0).fill(null);
    cells.push(...data.calDays);
    while (cells.length % 7 !== 0) cells.push(null);
    const rows: (KpiCalDay | null)[][] = [];
    for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
    return rows;
  }, [data]);

  return (
    <SectionCard title={(data as any).monthLabel || 'Calendar'}>
      <View style={styles.calNavRow}>
        <Pressable onPress={() => navigate(-1)} style={styles.calNavBtn}>
          <Icon name="chevronLeft" size={18} color={E.ink} />
        </Pressable>
        {loading ? <ActivityIndicator size="small" color={E.primary} /> : <View style={{ width: 18 }} />}
        <Pressable onPress={() => navigate(1)} style={styles.calNavBtn}>
          <Icon name="chevronRight" size={18} color={E.ink} />
        </Pressable>
      </View>
      <View style={styles.calDowRow}>
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
          <Text key={i} style={styles.calDowLabel}>{d}</Text>
        ))}
      </View>
      {weeks.map((row, ri) => (
        <View key={ri} style={styles.calRow}>
          {row.map((day, ci) =>
            day ? (
              <Pressable key={ci} style={styles.calCell} onPress={() => onDayPress(day)}>
                <View style={[styles.calDot, { backgroundColor: CAL_STATUS_COLOR[day.status] || E.border }, day.isToday && styles.calDotToday]}>
                  <Text style={[styles.calDayNum, day.status !== 'upcoming' && day.status !== 'weekend' && styles.calDayNumActive]}>{day.day}</Text>
                </View>
                {day.isLate && <LateFlag />}
                {day.status === 'excess' && <ExcessBreakFlag />}
              </Pressable>
            ) : (
              <View key={ci} style={styles.calCell} />
            )
          )}
        </View>
      ))}
    </SectionCard>
  );
}

/** Client-side derived "Monthly Attendance Summary" — mirrors empRenderMonthSummary in Dashboard.aspx. */
function MonthlySummary({ month, onSelectTile }: { month: RangeKpi; onSelectTile: (key: string) => void }) {
  const derived = useMemo(() => {
    const calDays = month.calDays || [];
    const monthWorkDays = month.monthWorkingDays || 0;
    const monthPresent = month.monthPresent || 0;
    const monthLate = month.monthLate || 0;
    const monthLeave = month.monthLeave || 0;
    const monthEarlyGo = month.monthEarlyGoing || 0;
    const monthHalfDay = month.monthHalfDay || 0;

    let partialCount = 0;
    const trend: { day: number; status: string }[] = [];

    calDays.forEach((day) => {
      if (day.status === 'weekend' || day.status === 'upcoming') return;
      const sw = day.swipes;
      if (!sw || sw.length === 0) {
        trend.push({ day: day.day, status: 'Absent' });
        return;
      }
      const isPartial = sw.length % 2 !== 0;
      if (isPartial) {
        partialCount++;
        trend.push({ day: day.day, status: 'Partial' });
      } else {
        const firstIn = parseClock(sw[0].time);
        const shiftS = parseClock(day.shiftStart);
        const isLate = firstIn != null && shiftS != null && firstIn > shiftS;
        trend.push({ day: day.day, status: isLate ? 'Late' : 'On Time' });
      }
    });

    const absentCount = Math.max(0, monthWorkDays - monthPresent - monthLeave);
    const cleanPresent = Math.max(0, monthPresent - partialCount - monthLate);

    return { monthWorkDays, monthLate, monthLeave, monthEarlyGo, monthHalfDay, partialCount, absentCount, cleanPresent, trend };
  }, [month]);

  const donutData = [
    { label: 'On Time', value: derived.cleanPresent, color: '#22c55e' },
    { label: 'Late', value: derived.monthLate, color: '#f59e0b' },
    { label: 'Early Going', value: derived.monthEarlyGo, color: '#14b8a6' },
    { label: 'Partial', value: derived.partialCount, color: '#f97316' },
    { label: 'Absent', value: derived.absentCount, color: '#ef4444' },
  ];
  const total = donutData.reduce((s, d) => s + d.value, 0);

  const TREND_COLOR: Record<string, string> = { 'On Time': '#22c55e', Late: '#f59e0b', Partial: '#f97316', Absent: '#ef4444' };

  return (
    <SectionCard title={`${(month as any).monthLabel || 'This month'} — Overview`} subtitle={`${derived.monthWorkDays} working days`}>
      <View style={styles.statChipRow}>
        <StatChip label="Working Days" value={derived.monthWorkDays} tint={E.blue} onPress={() => onSelectTile('totalWorkingDays')} />
        <StatChip label="On Time" value={derived.cleanPresent} pct={pctStr(derived.cleanPresent, derived.monthWorkDays)} tint={E.green} onPress={() => onSelectTile('onTime')} />
        <StatChip label="Late" value={derived.monthLate} pct={pctStr(derived.monthLate, derived.monthWorkDays)} tint="#d97706" onPress={() => onSelectTile('late')} />
        <StatChip label="Partial" value={derived.partialCount} pct={pctStr(derived.partialCount, derived.monthWorkDays)} tint="#f97316" onPress={() => onSelectTile('partial')} />
        <StatChip label="Absent" value={derived.absentCount} pct={pctStr(derived.absentCount, derived.monthWorkDays)} tint={E.red} onPress={() => onSelectTile('absentDays')} />
        <StatChip label="Early Going" value={derived.monthEarlyGo} pct={pctStr(derived.monthEarlyGo, derived.monthWorkDays)} tint="#14b8a6" onPress={() => onSelectTile('earlyGoing')} />
        <StatChip label="Half Day" value={derived.monthHalfDay} pct={pctStr(derived.monthHalfDay, derived.monthWorkDays)} tint="#14b8a6" onPress={() => onSelectTile('halfDay')} />
      </View>

      <View style={styles.donutRow}>
        <Donut segments={donutData} total={total} />
        <View style={styles.donutLegend}>
          {donutData.map((d) => (
            <View key={d.label} style={styles.legendRow}>
              <View style={[styles.legendDot, { backgroundColor: d.color }]} />
              <Text style={styles.legendLabel}>{d.label}</Text>
              <Text style={styles.legendVal}>{d.value} ({pctStr(d.value, total)})</Text>
            </View>
          ))}
        </View>
      </View>

      <Text style={styles.trendTitle}>Daily Attendance Trend</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.trendScroll}>
        {derived.trend.map((t) => (
          <View key={t.day} style={styles.trendBarWrap}>
            <View style={[styles.trendBar, { backgroundColor: TREND_COLOR[t.status] || E.border }]} />
            <Text style={styles.trendDayLabel}>{t.day}</Text>
          </View>
        ))}
      </ScrollView>
    </SectionCard>
  );
}

function StatChip({ label, value, pct, tint, onPress }: { label: string; value: number; pct?: string; tint: string; onPress?: () => void }) {
  return (
    <Pressable style={[styles.statChip, { borderColor: tint + '33' }]} onPress={onPress} disabled={!onPress}>
      <Text style={[styles.statChipValue, { color: tint }]}>{value}</Text>
      <Text style={styles.statChipLabel}>{label}</Text>
      {pct ? <Text style={styles.statChipPct}>{pct}</Text> : null}
    </Pressable>
  );
}

/** Simple SVG ring donut built from stroke-dasharray segments — no charting library. */
function Donut({ segments, total }: { segments: { label: string; value: number; color: string }[]; total: number }) {
  const size = 110;
  const stroke = 16;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  let offset = 0;

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <Circle cx={size / 2} cy={size / 2} r={r} stroke={E.border} strokeWidth={stroke} fill="none" />
      {total > 0
        ? segments
            .filter((s) => s.value > 0)
            .map((s) => {
              const frac = s.value / total;
              const dash = frac * circumference;
              const circle = (
                <Circle
                  key={s.label}
                  cx={size / 2}
                  cy={size / 2}
                  r={r}
                  stroke={s.color}
                  strokeWidth={stroke}
                  fill="none"
                  strokeDasharray={`${dash} ${circumference - dash}`}
                  strokeDashoffset={-offset}
                  strokeLinecap="butt"
                  rotation={-90}
                  origin={`${size / 2}, ${size / 2}`}
                />
              );
              offset += dash;
              return circle;
            })
        : null}
    </Svg>
  );
}

function parseClock(t: string | null | undefined): number | null {
  if (!t) return null;
  const m = t.match(/(\d+):(\d+)\s*(AM|PM)/i);
  if (!m) return null;
  let h = parseInt(m[1], 10);
  const mn = parseInt(m[2], 10);
  const ap = m[3].toUpperCase();
  if (ap === 'PM' && h !== 12) h += 12;
  if (ap === 'AM' && h === 12) h = 0;
  return h * 60 + mn;
}
function pctStr(n: number, total: number) {
  return total > 0 ? `${((n * 100) / total).toFixed(1)}%` : '0.0%';
}
function netWorkedFromSwipes(swipes: KpiSwipe[] | null | undefined): number {
  if (!swipes || swipes.length < 2) return 0;
  let total = 0;
  for (let i = 0; i + 1 < swipes.length; i += 2) {
    const inM = parseClock(swipes[i].time);
    const outM = parseClock(swipes[i + 1].time);
    if (inM != null && outM != null && outM > inM) total += outM - inM;
  }
  return total;
}
function fmtMinsDur(mins: number | null | undefined) {
  if (mins == null) return '—';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return (h > 0 ? `${h}h ` : '') + `${m}m`;
}
/** Mirrors classifyDay() in Dashboard.aspx's inline KPI renderer. */
function classifyDay(day: KpiCalDay) {
  const sw = day.swipes || [];
  const isPartial = sw.length > 0 && sw.length % 2 !== 0;
  const inM = parseClock(day.checkIn);
  const ssM = parseClock(day.shiftStart);
  const lateDiff = !isPartial && inM != null && ssM != null ? inM - ssM : null;
  const isLate = lateDiff != null && lateDiff > 0;
  const outM = parseClock(day.checkOut);
  const seM = parseClock(day.shiftEnd);
  const earlyDiff = !isPartial && sw.length >= 2 && outM != null && seM != null ? seM - outM : null;
  const isEarly = earlyDiff != null && earlyDiff >= 10;
  const netMins = netWorkedFromSwipes(sw);
  const isHalf = sw.length >= 2 && netMins >= 210 && netMins < 360;
  return { isPartial, isLate, lateDiff, isEarly, earlyDiff, netMins, isHalf };
}

/** "My Status Overview" tile metadata — keys/order/icons mirror Dashboard.aspx's META[] + ICO{}. */
const TILE_META: Record<string, { title: string; color: string; icon: IconName }> = {
  arrived: { title: 'Arrived Today', color: 'green', icon: 'logIn' },
  highPunch: { title: 'High Puncher', color: 'amber', icon: 'zap' },
  late: { title: 'Late Coming', color: 'red', icon: 'alertCircle' },
  earlyGoing: { title: 'Early Going', color: 'pink', icon: 'logOut' },
  excessBreak: { title: 'Excess Break', color: 'rose', icon: 'clockAlert' },
  onLeave: { title: 'On Leave', color: 'purple', icon: 'calendar' },
};
/** "Monthly Overview" tile metadata — mirrors the kpiCard() calls inside empRenderMonthSummary. */
const MONTH_TILE_META: Record<string, { title: string; color: string; icon: IconName }> = {
  totalWorkingDays: { title: 'Total Working Days', color: 'blue', icon: 'calendar' },
  onTime: { title: 'On Time', color: 'green', icon: 'check' },
  late: { title: 'Late', color: 'amber', icon: 'alertCircle' },
  partial: { title: 'Partial Day', color: 'orange', icon: 'zap' },
  absentDays: { title: 'Absent', color: 'red', icon: 'x' },
  earlyGoing: { title: 'Early Going', color: 'teal', icon: 'logOut' },
  halfDay: { title: 'Half Day', color: 'teal', icon: 'calendarCheck' },
};

type DetailRow = { label: string; value: string; tone?: 'good' | 'warn' | 'danger' };
/** Per-day drill-down content — ports buildCalDayDetail()'s switch(key) from Dashboard.aspx verbatim. */
function buildCalDayDetailRows(day: KpiCalDay, key: string): { note?: string; rows?: DetailRow[]; timeline?: KpiSwipe[] } {
  const st = day.status;
  if (st === 'weekend') return { note: 'Weekend — non-working day.' };
  if (st === 'upcoming') return { note: "This date hasn't happened yet." };
  if (st === 'leave' && key !== 'onLeave') return { note: 'On Approved Leave' };
  if (st === 'absent' && key !== 'onLeave') {
    if (day.checkIn) {
      // They did punch — just not enough hours to clear the half-day minimum.
      // Still show the actual punches, not just the "Absent" verdict, so it
      // doesn't look like the system ignored their attendance.
      return {
        note: 'Worked hours were below the half-day minimum for this day — counted as Absent.',
        rows: [
          { label: 'First In', value: day.checkIn },
          { label: 'Last Punch', value: day.checkOut || '—' },
        ],
        timeline: day.swipes || [],
      };
    }
    return { note: 'No punch records for this day.' };
  }

  switch (key) {
    case 'onLeave':
      return st === 'leave' ? { note: 'On Approved Leave' } : { note: 'Not on leave this day.' };

    case 'arrived':
      return {
        rows: [
          { label: 'First In', value: day.checkIn || '—', tone: 'good' },
          { label: 'Last Punch', value: day.checkOut || '—' },
        ],
        timeline: day.swipes || [],
      };

    case 'highPunch': {
      const cnt = (day.swipes || []).length;
      return { rows: [{ label: 'Punches That Day', value: String(cnt), tone: cnt > 6 ? 'danger' : 'good' }], timeline: day.swipes || [] };
    }

    case 'late': {
      const inM = parseClock(day.checkIn);
      const ssM = parseClock(day.shiftStart);
      const diff = inM != null && ssM != null ? inM - ssM : null;
      const isLate = diff != null && diff > 0;
      const rows: DetailRow[] = [{ label: 'First In', value: day.checkIn || '—' }];
      if (day.shiftStart) rows.push({ label: 'Shift Start', value: day.shiftStart });
      rows.push({ label: 'Vs. Shift Start', value: diff == null ? '—' : isLate ? `+${diff} min` : 'On Time', tone: isLate ? 'danger' : 'good' });
      return { rows };
    }

    case 'earlyGoing': {
      const outM = parseClock(day.checkOut);
      const seM = parseClock(day.shiftEnd);
      const ediff = outM != null && seM != null ? seM - outM : null;
      const isEarly = ediff != null && ediff >= 10;
      const rows: DetailRow[] = [{ label: 'Last Punch', value: day.checkOut || '—' }];
      if (day.shiftEnd) rows.push({ label: 'Shift End', value: day.shiftEnd });
      rows.push({ label: 'Vs. Shift End', value: ediff == null ? '—' : isEarly ? `${ediff} min early` : 'On Time', tone: isEarly ? 'warn' : 'good' });
      return { rows };
    }

    case 'excessBreak':
    default:
      return {
        rows: [
          { label: 'Break Used', value: `${day.brkMins || 0} min`, tone: st === 'excess' ? 'danger' : 'good' },
          { label: 'Exceeded By', value: st === 'excess' ? `+${day.exMins} min` : 'On Time', tone: st === 'excess' ? 'danger' : 'good' },
        ],
        timeline: day.swipes || [],
      };
  }
}

type DateListRow = { day: KpiCalDay; line: string; badge?: string; tone?: 'good' | 'warn' | 'danger' };
/** Ports buildMonthDateList()'s switch(key) from Dashboard.aspx verbatim. */
function buildMonthDateListRows(monthData: RangeKpi, key: string): DateListRow[] {
  const calDays = monthData.calDays || [];
  const rows: DateListRow[] = [];

  calDays.forEach((day) => {
    const st = day.status;
    if (st === 'weekend' || st === 'upcoming') return;

    if (st === 'leave') {
      if (key === 'totalWorkingDays') rows.push({ day, line: 'On approved leave', badge: 'Leave' });
      return;
    }
    if (st === 'absent') {
      if (key === 'absentDays' || key === 'totalWorkingDays') {
        const line = day.checkIn
          ? `First In: ${day.checkIn}${day.checkOut ? ` • Last Punch: ${day.checkOut}` : ''} — below half-day minimum`
          : 'No punch recorded';
        rows.push({ day, line, badge: 'Absent', tone: 'danger' });
      }
      return;
    }

    const c = classifyDay(day);
    switch (key) {
      case 'totalWorkingDays': {
        const lbl = c.isPartial ? 'Partial' : c.isLate ? 'Late' : 'On Time';
        const tone = c.isPartial ? 'warn' : c.isLate ? 'danger' : 'good';
        rows.push({ day, line: `First In: ${day.checkIn || '—'}${day.checkOut ? ` • Last Punch: ${day.checkOut}` : ''}`, badge: lbl, tone });
        break;
      }
      case 'onTime':
        if (c.isPartial || c.isLate) return;
        rows.push({ day, line: `First In: ${day.checkIn || '—'}`, badge: 'On Time', tone: 'good' });
        break;
      case 'late':
        if (c.isPartial || !c.isLate) return;
        rows.push({ day, line: `First In: ${day.checkIn || '—'} • Shift Start: ${day.shiftStart || '—'}`, badge: `+${c.lateDiff} min`, tone: 'danger' });
        break;
      case 'partial':
        if (!c.isPartial) return;
        rows.push({ day, line: `${(day.swipes || []).length} punch recorded — missing pair`, badge: 'Partial', tone: 'warn' });
        break;
      case 'earlyGoing':
        if (!c.isEarly) return;
        rows.push({ day, line: `Last Punch: ${day.checkOut || '—'} • Shift End: ${day.shiftEnd || '—'}`, badge: `${c.earlyDiff} min early`, tone: 'warn' });
        break;
      case 'halfDay':
        if (!c.isHalf) return;
        rows.push({ day, line: `Worked ${fmtMinsDur(c.netMins)}`, badge: 'Half Day', tone: 'warn' });
        break;
    }
  });

  return rows;
}

const TONE_COLOR: Record<'good' | 'warn' | 'danger', string> = { good: E.green, warn: '#d97706', danger: E.red };

/** Shared month-calendar drill-down, opened by every "My Status Overview" tile — mirrors empKpiDetail()
 *  (buildKpiCalendar) in Dashboard.aspx: same month grid re-used for every tile, tap a date for that
 *  day's tile-specific detail (showCalDayPopup/buildCalDayDetail). */
function KpiCalendarModal({
  visible,
  kpiKey,
  initialMonth,
  onClose,
}: {
  visible: boolean;
  kpiKey: string | null;
  initialMonth: RangeKpi | null;
  onClose: () => void;
}) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [data, setData] = useState<RangeKpi | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedDay, setSelectedDay] = useState<KpiCalDay | null>(null);

  useEffect(() => {
    if (!visible) return;
    setYear(today.getFullYear());
    setMonth(today.getMonth() + 1);
    setSelectedDay(null);
    setData(initialMonth);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, kpiKey]);

  const isCurrentMonth = year === today.getFullYear() && month === today.getMonth() + 1;

  useEffect(() => {
    if (!visible) return;
    if (isCurrentMonth && initialMonth) {
      setData(initialMonth);
      return;
    }
    let cancelled = false;
    setLoading(true);
    getKpiCalendar(year, month)
      .then((res) => {
        if (cancelled) return;
        setData({ ...(res.data as any), calDays: res.data.calDays, calYear: res.data.year, calMonth: res.data.month, monthLabel: res.data.monthLabel, firstDow: res.data.firstDow });
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, year, month]);

  const changeMonth = (delta: number) => {
    if (delta > 0 && isCurrentMonth) return; // never browse into the future — mirrors empKpiCalNav
    const d = new Date(year, month - 1 + delta, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth() + 1);
    setSelectedDay(null);
  };

  const meta = kpiKey ? TILE_META[kpiKey] : null;
  const tint = meta ? KPI_COLORS[meta.color] || E.primary : E.primary;

  const stats = useMemo(() => {
    const days = data?.calDays || [];
    let present = 0, absent = 0, leave = 0;
    days.forEach((d) => {
      if (d.status === 'ok' || d.status === 'excess') present++;
      else if (d.status === 'absent') absent++;
      else if (d.status === 'leave') leave++;
    });
    return { present, absent, leave };
  }, [data]);

  const weeks = useMemo(() => {
    if (!data) return [] as (KpiCalDay | null)[][];
    const cells: (KpiCalDay | null)[] = Array(data.firstDow || 0).fill(null);
    cells.push(...(data.calDays || []));
    while (cells.length % 7 !== 0) cells.push(null);
    const rows: (KpiCalDay | null)[][] = [];
    for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
    return rows;
  }, [data]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable style={styles.calModalCard} onPress={(e) => e.stopPropagation()}>
          <View style={styles.calModalHead}>
            {meta ? (
              <View style={[styles.kpiIcon, { backgroundColor: tint + '1a' }]}>
                <Icon name={meta.icon} size={18} color={tint} />
              </View>
            ) : null}
            <View style={{ flex: 1 }}>
              <Text style={styles.modalTitle}>{meta?.title || 'Calendar'}</Text>
              <Text style={styles.modalSub}>Tap a date to see that day's detail</Text>
            </View>
            <Pressable onPress={onClose} hitSlop={8}>
              <Icon name="x" size={20} color={E.muted} />
            </Pressable>
          </View>

          <View style={styles.calNavRow}>
            <Pressable onPress={() => changeMonth(-1)} style={styles.calNavBtn} hitSlop={8}>
              <Icon name="chevronLeft" size={18} color={E.ink} />
            </Pressable>
            <Text style={styles.calModalMonthLabel}>{data?.monthLabel || ''}</Text>
            <Pressable onPress={() => changeMonth(1)} style={styles.calNavBtn} disabled={isCurrentMonth} hitSlop={8}>
              <Icon name="chevronRight" size={18} color={isCurrentMonth ? E.border : E.ink} />
            </Pressable>
          </View>

          {stats.present || stats.absent || stats.leave ? (
            <View style={styles.statPillRow}>
              {stats.present ? (
                <View style={[styles.statPill, { backgroundColor: E.green + '1a' }]}>
                  <Text style={[styles.statPillText, { color: E.green }]}>{stats.present} Present</Text>
                </View>
              ) : null}
              {stats.absent ? (
                <View style={[styles.statPill, { backgroundColor: E.red + '1a' }]}>
                  <Text style={[styles.statPillText, { color: E.red }]}>{stats.absent} Absent</Text>
                </View>
              ) : null}
              {stats.leave ? (
                <View style={[styles.statPill, { backgroundColor: E.purple + '1a' }]}>
                  <Text style={[styles.statPillText, { color: E.purple }]}>{stats.leave} Leave</Text>
                </View>
              ) : null}
            </View>
          ) : null}

          {loading ? (
            <View style={{ paddingVertical: 40, alignItems: 'center' }}>
              <ActivityIndicator color={E.primary} />
            </View>
          ) : (
            <>
              <View style={styles.calDowRow}>
                {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
                  <Text key={i} style={styles.calDowLabel}>{d}</Text>
                ))}
              </View>
              {weeks.map((row, ri) => (
                <View key={ri} style={styles.calRow}>
                  {row.map((day, ci) =>
                    day ? (
                      <Pressable
                        key={ci}
                        style={styles.calCell}
                        disabled={day.status === 'upcoming'}
                        onPress={() => setSelectedDay(day)}
                      >
                        <View style={[styles.calDot, { backgroundColor: CAL_STATUS_COLOR[day.status] || E.border }, day.isToday && styles.calDotToday]}>
                          <Text style={[styles.calDayNum, day.status !== 'upcoming' && day.status !== 'weekend' && styles.calDayNumActive]}>{day.day}</Text>
                        </View>
                        {day.isLate && <LateFlag />}
                        {day.status === 'excess' && <ExcessBreakFlag />}
                        {day.status === 'excess' && day.exMins > 0 ? <Text style={styles.calExcessBadge}>+{day.exMins}m</Text> : null}
                      </Pressable>
                    ) : (
                      <View key={ci} style={styles.calCell} />
                    )
                  )}
                </View>
              ))}
            </>
          )}
        </Pressable>
      </Pressable>

      {selectedDay && kpiKey ? (
        <CalDayDetailModal day={selectedDay} kpiKey={kpiKey} tint={tint} onClose={() => setSelectedDay(null)} />
      ) : null}
    </Modal>
  );
}

const CAL_STATUS_LABEL: Record<string, string> = {
  excess: 'Excess Break',
  ok: 'Present',
  partial: 'Half Day',
  absent: 'Absent',
  leave: 'On Leave',
  weekend: 'Weekend',
};

/** Per-day detail popup — mirrors showCalDayPopup()/buildCalDayDetail() in Dashboard.aspx. */
function CalDayDetailModal({ day, kpiKey, tint, onClose }: { day: KpiCalDay; kpiKey: string; tint: string; onClose: () => void }) {
  const detail = buildCalDayDetailRows(day, kpiKey);
  const statusLabel = CAL_STATUS_LABEL[day.status] || '—';
  const statusColor = CAL_STATUS_COLOR[day.status] || E.muted;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable style={styles.dayDetailCard} onPress={(e) => e.stopPropagation()}>
          <View style={styles.dayDetailHead}>
            <View>
              <Text style={styles.dayDetailDate}>{day.dateDisplay}</Text>
              <View style={[styles.statusPill, { backgroundColor: statusColor + '1a' }]}>
                <Text style={[styles.statusPillText, { color: statusColor }]}>{statusLabel}</Text>
              </View>
            </View>
            <Pressable onPress={onClose} hitSlop={8}>
              <Icon name="x" size={18} color={E.muted} />
            </Pressable>
          </View>

          <ScrollView style={{ maxHeight: 340 }}>
            {detail.note ? <Text style={styles.dayDetailNote}>{detail.note}</Text> : null}

            {detail.rows?.map((r, i) => (
              <View key={i} style={styles.detailRow}>
                <Text style={styles.detailRowLabel}>{r.label}</Text>
                <Text style={[styles.detailRowValue, r.tone ? { color: TONE_COLOR[r.tone] } : null]}>{r.value}</Text>
              </View>
            ))}

            {detail.timeline && detail.timeline.length > 0 ? (
              <>
                <Text style={styles.timelineTitle}>Punch Timeline ({detail.timeline.length})</Text>
                {detail.timeline.map((s, i) => (
                  <View key={i} style={styles.timelineRow}>
                    <View style={[styles.timelinePill, { backgroundColor: (s.isIn ? E.green : E.red) + '1a' }]}>
                      <Text style={[styles.timelinePillText, { color: s.isIn ? E.green : E.red }]}>{s.isIn ? 'IN' : 'OUT'}</Text>
                    </View>
                    <Text style={styles.timelineTime}>{s.time}</Text>
                  </View>
                ))}
              </>
            ) : null}
          </ScrollView>

          <Pressable style={[styles.detailCloseBtn, { borderColor: tint + '33' }]} onPress={onClose}>
            <Text style={[styles.detailCloseBtnText, { color: tint }]}>Close</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/** "Monthly Overview" tile drill-down — mirrors window.empMonthDetail()/buildMonthDateList() in
 *  Dashboard.aspx: opens straight to a date list (no calendar step), since every listed date
 *  already carries its own line + badge. */
function MonthDateListModal({
  visible,
  monthKey,
  monthData,
  onClose,
}: {
  visible: boolean;
  monthKey: string | null;
  monthData: RangeKpi | null;
  onClose: () => void;
}) {
  const meta = monthKey ? MONTH_TILE_META[monthKey] : null;
  const tint = meta ? KPI_COLORS[meta.color] || E.primary : E.primary;
  const rows = useMemo(() => (monthData && monthKey ? buildMonthDateListRows(monthData, monthKey) : []), [monthData, monthKey]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable style={styles.calModalCard} onPress={(e) => e.stopPropagation()}>
          <View style={styles.calModalHead}>
            {meta ? (
              <View style={[styles.kpiIcon, { backgroundColor: tint + '1a' }]}>
                <Icon name={meta.icon} size={18} color={tint} />
              </View>
            ) : null}
            <View style={{ flex: 1 }}>
              <Text style={styles.modalTitle}>{meta?.title || 'Details'}</Text>
              <Text style={styles.modalSub}>{monthData?.monthLabel || 'This month'}</Text>
            </View>
            <Pressable onPress={onClose} hitSlop={8}>
              <Icon name="x" size={20} color={E.muted} />
            </Pressable>
          </View>

          <ScrollView style={{ maxHeight: 420 }}>
            {rows.length === 0 ? (
              <Text style={styles.emptyText}>No matching dates this month.</Text>
            ) : (
              rows.map((r, i) => (
                <View key={i} style={styles.dateListRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.dateListDate}>{r.day.dateDisplay}</Text>
                    <Text style={styles.dateListLine}>{r.line}</Text>
                  </View>
                  {r.badge ? (
                    <View style={[styles.dateListBadge, { backgroundColor: (r.tone ? TONE_COLOR[r.tone] : E.muted) + '1a' }]}>
                      <Text style={[styles.dateListBadgeText, { color: r.tone ? TONE_COLOR[r.tone] : E.muted }]}>{r.badge}</Text>
                    </View>
                  ) : null}
                </View>
              ))
            )}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: E.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: E.bg },
  content: { padding: spacing(3), paddingBottom: spacing(6) },
  greeting: { fontSize: 24, fontWeight: '800', color: E.ink, marginBottom: spacing(2) },
  trialCard: { backgroundColor: '#FFF6E5', marginBottom: spacing(2) },
  trialText: { color: '#d97706', fontSize: 13 },
  statusCard: { marginBottom: spacing(2), borderRadius: radius.md, ...shadow.card },
  statusLabel: { color: E.muted, fontSize: 13 },
  statusValue: { fontSize: 32, fontWeight: '800', color: E.ink, marginVertical: 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing(1.5), marginBottom: spacing(3) },

  sectionCard: { marginBottom: spacing(2), borderRadius: radius.md, ...shadow.card },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: E.ink, marginBottom: 2 },
  sectionSubtitle: { fontSize: 12, color: E.muted, marginBottom: spacing(1.5) },
  emptyText: { color: E.muted, fontSize: 13 },

  selfieOkText: { color: E.green, fontSize: 13, fontWeight: '600', marginBottom: spacing(1.5) },
  selfieMutedText: { color: E.muted, fontSize: 13 },
  selfieThumbWrap: { alignItems: 'center' },
  selfieThumb: { width: 96, height: 96, borderRadius: 48, backgroundColor: E.surface2 },
  selfieThumbLabel: { fontSize: 11, fontWeight: '700', color: E.muted, marginTop: 6 },
  selfieTimeText: { fontSize: 12, color: E.muted, fontWeight: '600', marginTop: 6 },
  selfieLocRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  selfieLocText: { fontSize: 11, color: E.primary, fontWeight: '600' },
  selfieLocTextMuted: { color: E.muted },
  breakSelfieGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  breakSelfieCard: { width: '31%', backgroundColor: E.surface2, borderRadius: radius.sm, overflow: 'hidden' },
  breakSelfiePhoto: { width: '100%', aspectRatio: 1, backgroundColor: E.border },
  breakSelfieBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: 4, padding: 6, flexWrap: 'wrap' },
  breakSelfieLabel: { fontSize: 10, fontWeight: '800', color: E.ink },
  breakSelfieExcessPill: { backgroundColor: '#fee2e2', borderRadius: 999, paddingHorizontal: 5, paddingVertical: 1 },
  breakSelfieExcessText: { fontSize: 8.5, fontWeight: '800', color: '#b91c1c' },
  selfieTimeTextSmall: { fontSize: 9.5, color: E.muted, fontWeight: '600', paddingHorizontal: 6 },
  selfieLocRowSmall: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6, paddingBottom: 6, paddingTop: 2 },
  selfieLocTextSmall: { fontSize: 9, color: E.primary, fontWeight: '600', flexShrink: 1 },

  approvalRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderTopWidth: 1, borderTopColor: E.border, gap: spacing(1) },
  approvalName: { fontSize: 14, fontWeight: '700', color: E.ink },
  approvalCode: { fontWeight: '600', color: E.muted },
  approvalDates: { fontSize: 12, color: E.muted, marginTop: 2 },
  approvalReason: { fontSize: 12, color: E.muted, marginTop: 2, fontStyle: 'italic' },
  approvalActions: { flexDirection: 'row', gap: 8 },
  approvalBtn: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  approvalBtnApprove: { backgroundColor: E.green },
  approvalBtnReject: { backgroundColor: E.red },

  kpiGrid: { gap: spacing(1) },
  kpiCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing(1.5),
    padding: 12,
    borderRadius: radius.sm,
    backgroundColor: E.surface2,
  },
  kpiIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  kpiValue: { fontSize: 15, fontWeight: '800', color: E.ink },
  kpiTitle: { fontSize: 11, color: E.muted, marginTop: 1 },
  kpiSubRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 3 },
  kpiDot: { width: 6, height: 6, borderRadius: 3 },
  kpiSub: { fontSize: 11, color: E.muted, flexShrink: 1 },

  calNavRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing(1.5) },
  calNavBtn: { width: 30, height: 30, borderRadius: 15, borderWidth: 1.5, borderColor: E.border, alignItems: 'center', justifyContent: 'center' },
  calDowRow: { flexDirection: 'row', backgroundColor: E.surface2, borderRadius: 10, paddingVertical: 6, marginBottom: spacing(1) },
  calDowLabel: { flex: 1, textAlign: 'center', fontSize: 11, fontWeight: '800', color: E.muted, textTransform: 'uppercase' },
  calRow: { flexDirection: 'row', gap: 6, marginBottom: 6 },
  calCell: { flex: 1, aspectRatio: 1, position: 'relative' },
  calDot: { flex: 1, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  calDotToday: { borderWidth: 2.5, borderColor: E.primary },
  calExcessFlagWrap: { position: 'absolute', top: 0, right: 0, zIndex: 1 },
  calLateFlagWrap: { position: 'absolute', top: 0, left: 0, zIndex: 1 },
  calDayNum: { fontSize: 15, fontWeight: '700', color: E.ink },
  calDayNumActive: { color: '#fff', fontWeight: '900', fontSize: 16 },

  statChipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: spacing(2) },
  statChip: { minWidth: 78, borderWidth: 1, borderRadius: radius.sm, padding: 8, alignItems: 'center' },
  statChipValue: { fontSize: 16, fontWeight: '800' },
  statChipLabel: { fontSize: 10, color: E.muted, marginTop: 2, textAlign: 'center' },
  statChipPct: { fontSize: 10, color: E.muted },

  donutRow: { flexDirection: 'row', alignItems: 'center', gap: spacing(2), marginBottom: spacing(2) },
  donutLegend: { flex: 1, gap: 6 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendLabel: { flex: 1, fontSize: 12, color: E.ink },
  legendVal: { fontSize: 12, color: E.muted },

  trendTitle: { fontSize: 12, fontWeight: '700', color: E.ink, marginBottom: 8 },
  trendScroll: { flexDirection: 'row' },
  trendBarWrap: { alignItems: 'center', marginRight: 6, width: 18 },
  trendBar: { width: 10, height: 36, borderRadius: 4 },
  trendDayLabel: { fontSize: 9, color: E.muted, marginTop: 3 },

  greetingHero: { marginBottom: spacing(2) },
  greetingTopRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing(1) },
  greetingSub: { fontSize: 13, color: E.muted, marginTop: -spacing(1.5) },
  liveClockWrap: { alignItems: 'flex-end' },
  liveClockTime: { fontSize: 18, fontWeight: '800', color: E.ink, fontVariant: ['tabular-nums'] },
  liveClockDate: { fontSize: 11, color: E.muted, marginTop: 1 },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: spacing(1.5) },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: E.surface2,
    borderWidth: 1,
    borderColor: E.border,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  chipDot: { width: 7, height: 7, borderRadius: 3.5 },
  chipText: { fontSize: 11, fontWeight: '600', color: E.ink },

  bdayBanner: {
    backgroundColor: '#FDF2F8',
    borderWidth: 1,
    borderColor: '#FBCFE8',
    borderRadius: radius.md,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: spacing(2),
    alignItems: 'center',
  },
  bdayBannerText: { fontSize: 13, fontWeight: '700', color: '#9d174d', textAlign: 'center' },
  annivBanner: {
    backgroundColor: '#FDF4FF',
    borderWidth: 1,
    borderColor: '#F5D0FE',
    borderRadius: radius.md,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: spacing(2),
    alignItems: 'center',
  },
  annivBannerText: { fontSize: 13, fontWeight: '700', color: '#86198f', textAlign: 'center' },

  nagCard: { backgroundColor: '#EEF2FF', marginBottom: spacing(2) },
  nagTitle: { fontSize: 14, fontWeight: '700', color: '#4338ca' },
  nagText: { fontSize: 12, color: '#4338ca', marginTop: 2 },

  promoRow: { flexDirection: 'row', gap: spacing(1.5), marginBottom: spacing(2) },
  promoPressable: { flex: 1 },
  promoCard: { padding: spacing(1.5), position: 'relative' },
  promoBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: E.primary,
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  promoBadgeText: { fontSize: 8.5, fontWeight: '800', color: '#fff', letterSpacing: 0.3 },
  promoIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: E.surface2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  promoTitle: { fontSize: 13, fontWeight: '800', color: E.ink },
  promoSubtitle: { fontSize: 10.5, color: E.muted, marginTop: 2 },

  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center', padding: spacing(3) },
  modalCard: { width: '100%', maxWidth: 360, backgroundColor: E.surface, borderRadius: radius.md, padding: spacing(3) },
  modalTitle: { fontSize: 15, fontWeight: '800', color: E.ink, marginBottom: 4 },
  modalSub: { fontSize: 12, color: E.muted, marginBottom: spacing(1.5) },
  modalTextArea: {
    borderWidth: 1,
    borderColor: E.border,
    borderRadius: 10,
    padding: 10,
    fontSize: 13,
    color: E.ink,
    backgroundColor: E.surface2,
    textAlignVertical: 'top',
    minHeight: 72,
    marginBottom: spacing(1.5),
  },
  modalBtnRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
  modalBtn: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 20 },
  modalBtnCancel: { backgroundColor: E.surface2 },
  modalBtnCancelText: { color: E.muted, fontSize: 12, fontWeight: '700' },
  modalBtnReject: { backgroundColor: E.red },
  modalBtnRejectText: { color: '#fff', fontSize: 12, fontWeight: '700' },

  // KPI tile drill-down modals (calendar sheet + day detail + month date list) —
  // mirror the emp-kpi-sheet / emp-kpi-cd / emp-kpi-date-row markup in Dashboard.aspx.
  calModalCard: { width: '100%', maxWidth: 400, maxHeight: '85%', backgroundColor: E.surface, borderRadius: 20, padding: spacing(2.5) },
  calModalHead: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing(1.5), marginBottom: spacing(1.5) },
  calModalMonthLabel: { fontSize: 17, fontWeight: '900', color: E.ink, letterSpacing: -0.3 },

  statPillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: spacing(1.5) },
  statPill: { borderRadius: 999, paddingHorizontal: 11, paddingVertical: 4, borderWidth: 1.5 },
  statPillText: { fontSize: 11.5, fontWeight: '800' },

  calExcessBadge: {
    position: 'absolute',
    bottom: 4,
    alignSelf: 'center',
    fontSize: 9,
    fontWeight: '900',
    color: 'rgba(255,255,255,.95)',
    backgroundColor: 'rgba(0,0,0,.22)',
    borderRadius: 8,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },

  dayDetailCard: { width: '100%', maxWidth: 360, maxHeight: '80%', backgroundColor: E.surface, borderRadius: radius.md, padding: spacing(3) },
  dayDetailHead: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: spacing(1.5) },
  dayDetailDate: { fontSize: 14, fontWeight: '800', color: E.ink, marginBottom: 4 },
  statusPill: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  statusPillText: { fontSize: 10.5, fontWeight: '800' },
  dayDetailNote: { fontSize: 13, color: E.muted },

  detailRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 7, borderTopWidth: 1, borderTopColor: E.border },
  detailRowLabel: { fontSize: 12.5, color: E.muted },
  detailRowValue: { fontSize: 12.5, fontWeight: '700', color: E.ink },

  timelineTitle: { fontSize: 11, fontWeight: '800', color: E.muted, textTransform: 'uppercase', letterSpacing: 0.3, marginTop: spacing(1.5), marginBottom: 6 },
  timelineRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6, borderTopWidth: 1, borderTopColor: E.border },
  timelinePill: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  timelinePillText: { fontSize: 10, fontWeight: '800' },
  timelineTime: { fontSize: 12, fontWeight: '600', color: E.ink },

  detailCloseBtn: { alignSelf: 'center', marginTop: spacing(1.5), paddingHorizontal: 20, paddingVertical: 9, borderRadius: 999, borderWidth: 1 },
  detailCloseBtnText: { fontSize: 12, fontWeight: '700' },

  dateListRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, borderTopWidth: 1, borderTopColor: E.border },
  dateListDate: { fontSize: 12.5, fontWeight: '700', color: E.ink },
  dateListLine: { fontSize: 11, color: E.muted, marginTop: 2 },
  dateListBadge: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 },
  dateListBadgeText: { fontSize: 10.5, fontWeight: '800' },
});
