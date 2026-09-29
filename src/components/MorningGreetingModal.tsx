import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Animated, Easing, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { WebView } from 'react-native-webview';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Sound from 'react-native-sound';
import Share from 'react-native-share';
import { captureRef } from 'react-native-view-shot';
import Icon from './Icon';
import { useAuth } from '../context/AuthContext';
import { getTodayQuote } from '../api/morningQuoteApi';
import { getTodayShayari } from '../api/adminShayariApi';
import { resolveFileUrl } from '../utils/fileUrl';
import { shareRemoteMedia } from '../utils/shareMedia';
import { colors, radius, spacing } from '../theme';

Sound.setCategory('Playback');

const SCENE_HEIGHT = 220;

function todayYmd() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function SkyGradient({ top, bottom }: { top: string; bottom: string }) {
  return (
    <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        <LinearGradient id="skyGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <Stop offset="0%" stopColor={top} />
          <Stop offset="100%" stopColor={bottom} />
        </LinearGradient>
      </Defs>
      <Rect width="100%" height="100%" fill="url(#skyGrad)" />
    </Svg>
  );
}

/* ───────────────────────── Employee scenes (unchanged) ───────────────────────── */

/** Clouds slide apart to reveal the sun, which scales/fades in behind them with soft radiating rays. */
function SunriseScene() {
  const cloudL = useRef(new Animated.Value(0)).current;
  const cloudR = useRef(new Animated.Value(0)).current;
  const sunScale = useRef(new Animated.Value(0.4)).current;
  const sunOpacity = useRef(new Animated.Value(0)).current;
  const rayRotate = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.delay(150),
      Animated.parallel([
        Animated.timing(sunOpacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.spring(sunScale, { toValue: 1, friction: 5, tension: 40, useNativeDriver: true }),
        Animated.timing(cloudL, { toValue: 1, duration: 900, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(cloudR, { toValue: 1, duration: 900, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]),
    ]).start();

    Animated.loop(Animated.timing(rayRotate, { toValue: 1, duration: 20000, easing: Easing.linear, useNativeDriver: true })).start();
  }, [cloudL, cloudR, sunScale, sunOpacity, rayRotate]);

  const rayDeg = rayRotate.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const rays = Array.from({ length: 8 }, (_, i) => i * 45);

  return (
    <View style={sceneStyles.wrap}>
      <SkyGradient top="#8ec9f0" bottom="#ffe1a8" />

      <View style={sceneStyles.center}>
        <Animated.View style={[sceneStyles.rayGroup, { transform: [{ rotate: rayDeg }] }]}>
          {rays.map((deg) => (
            <View key={deg} style={[sceneStyles.ray, { transform: [{ rotate: `${deg}deg` }] }]} />
          ))}
        </Animated.View>
        <Animated.View style={[sceneStyles.sunGlow, { opacity: sunOpacity }]} />
        <Animated.View style={[sceneStyles.sun, { opacity: sunOpacity, transform: [{ scale: sunScale }] }]} />
      </View>

      <Animated.View
        style={[
          sceneStyles.cloud,
          sceneStyles.cloudLeft,
          { transform: [{ translateX: cloudL.interpolate({ inputRange: [0, 1], outputRange: [0, -70] }) }] },
        ]}
      >
        <View style={[sceneStyles.cloudPuff, { width: 60, height: 60, top: 6, left: 10 }]} />
        <View style={[sceneStyles.cloudPuff, { width: 44, height: 44, top: 0, left: 46 }]} />
        <View style={[sceneStyles.cloudBase, { width: 90 }]} />
      </Animated.View>
      <Animated.View
        style={[
          sceneStyles.cloud,
          sceneStyles.cloudRight,
          { transform: [{ translateX: cloudR.interpolate({ inputRange: [0, 1], outputRange: [0, 70] }) }] },
        ]}
      >
        <View style={[sceneStyles.cloudPuff, { width: 50, height: 50, top: 8, left: 8 }]} />
        <View style={[sceneStyles.cloudPuff, { width: 38, height: 38, top: 2, left: 40 }]} />
        <View style={[sceneStyles.cloudBase, { width: 78 }]} />
      </Animated.View>
    </View>
  );
}

/** Dark sky fades in with twinkling stars and a clipped half-moon. */
function NightSkyScene() {
  const skyOpacity = useRef(new Animated.Value(0)).current;
  const moonScale = useRef(new Animated.Value(0.5)).current;
  const stars = useRef(Array.from({ length: 14 }, () => new Animated.Value(0))).current;
  const starPositions = useRef(
    Array.from({ length: 14 }, () => ({ top: Math.random() * (SCENE_HEIGHT - 40) + 10, left: Math.random() * 280 + 10, size: Math.random() * 2.5 + 2 }))
  ).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(skyOpacity, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.spring(moonScale, { toValue: 1, friction: 6, tension: 40, delay: 200, useNativeDriver: true }),
    ]).start();

    stars.forEach((star, i) => {
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 180),
          Animated.timing(star, { toValue: 1, duration: 900 + (i % 4) * 150, useNativeDriver: true }),
          Animated.timing(star, { toValue: 0.25, duration: 900 + (i % 4) * 150, useNativeDriver: true }),
        ])
      ).start();
    });
  }, [skyOpacity, moonScale, stars]);

  return (
    <Animated.View style={[sceneStyles.wrap, { opacity: skyOpacity }]}>
      <SkyGradient top="#0b1130" bottom="#2c2a5e" />

      {starPositions.map((p, i) => (
        <Animated.View
          key={i}
          style={[
            sceneStyles.star,
            { top: p.top, left: p.left, width: p.size, height: p.size, borderRadius: p.size / 2, opacity: stars[i] },
          ]}
        />
      ))}

      <Animated.View style={[sceneStyles.moonClip, { transform: [{ scale: moonScale }] }]}>
        <View style={sceneStyles.moonFull} />
      </Animated.View>
    </Animated.View>
  );
}

/**
 * Once-per-day greeting shown the first time an employee opens the app that
 * day — a sunrise-through-clouds scene before noon, a starry half-moon sky
 * after. Carries a fresh quote from the backend's daily-planned schedule.
 */
function EmployeeGreetingModal({ user }: { user: { name: string; empUserId?: number } }) {
  const [visible, setVisible] = useState(false);
  const [quote, setQuote] = useState<string | null>(null);
  const isMorning = new Date().getHours() < 12;

  useEffect(() => {
    let cancelled = false;
    const storageKey = `apna_payroll_last_morning_greeting_date:employee:${user.empUserId ?? 'unknown'}`;

    (async () => {
      try {
        const lastShown = await AsyncStorage.getItem(storageKey);
        if (lastShown === todayYmd()) return;

        if (isMorning) {
          const res = await getTodayQuote();
          if (!cancelled) setQuote(res.data.text);
        }
        if (!cancelled) {
          setVisible(true);
          await AsyncStorage.setItem(storageKey, todayYmd());
        }
      } catch {
        /* best-effort — a failed fetch just means no greeting this session, never blocks the app */
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!visible) return null;
  const name = user.name?.split(' ')?.[0] || 'there';

  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => setVisible(false)}>
      <Pressable style={styles.backdrop} onPress={() => setVisible(false)}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          <View style={styles.sceneWrap}>{isMorning ? <SunriseScene /> : <NightSkyScene />}</View>
          <View style={styles.body}>
            <Text style={styles.greeting}>{isMorning ? `Good Morning, ${name}!` : `Good Evening, ${name}!`}</Text>
            {isMorning && quote ? <Text style={styles.quote}>{quote}</Text> : <Text style={styles.quote}>Hope your evening is a good one. 🌙</Text>}
            <Pressable style={styles.closeBtn} onPress={() => setVisible(false)}>
              <Text style={styles.closeBtnText}>Let's go</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/* ───────────────────────── Admin scenes (4 dayparts) ───────────────────────── */

export type Daypart = 'morning' | 'afternoon' | 'evening' | 'night';

function currentDaypart(): Daypart {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return 'morning';
  if (h >= 12 && h < 17) return 'afternoon';
  if (h >= 17 && h < 20) return 'evening';
  return 'night';
}

const DAYPART_GREETING: Record<Daypart, string> = {
  morning: 'Good Morning',
  afternoon: 'Good Afternoon',
  evening: 'Good Evening',
  night: 'Good Night',
};

/** Two dot eyes + a curved "smile" (rounded-bottom box, classic CSS trick — no SVG needed). One eye can blink on a loop. */
function Face({ blinkEye, sleepy, tint = '#7a4a00' }: { blinkEye?: 'left' | 'right' | 'both'; sleepy?: boolean; tint?: string }) {
  const blink = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!blinkEye) return;
    let cancelled = false;
    const loop = () => {
      if (cancelled) return;
      Animated.sequence([
        Animated.delay(1600 + Math.random() * 1400),
        Animated.timing(blink, { toValue: 0.08, duration: 110, useNativeDriver: true }),
        Animated.timing(blink, { toValue: 1, duration: 140, useNativeDriver: true }),
      ]).start(() => loop());
    };
    loop();
    return () => {
      cancelled = true;
    };
  }, [blinkEye, blink]);

  return (
    <View style={faceStyles.wrap} pointerEvents="none">
      <View style={faceStyles.eyeRow}>
        <Animated.View
          style={[
            faceStyles.eye,
            { backgroundColor: tint },
            sleepy && faceStyles.eyeSleepy,
            (blinkEye === 'left' || blinkEye === 'both') && { transform: [{ scaleY: blink }] },
          ]}
        />
        <Animated.View
          style={[
            faceStyles.eye,
            { backgroundColor: tint },
            sleepy && faceStyles.eyeSleepy,
            (blinkEye === 'right' || blinkEye === 'both') && { transform: [{ scaleY: blink }] },
          ]}
        />
      </View>
      <View style={[faceStyles.smile, { borderColor: tint }, sleepy && faceStyles.smileSmall]} />
    </View>
  );
}

/** Sun rising through clouds, winking one eye every couple of seconds. */
function AdminMorningScene() {
  const cloudL = useRef(new Animated.Value(0)).current;
  const cloudR = useRef(new Animated.Value(0)).current;
  const sunScale = useRef(new Animated.Value(0.4)).current;
  const sunOpacity = useRef(new Animated.Value(0)).current;
  const rayRotate = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.delay(150),
      Animated.parallel([
        Animated.timing(sunOpacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.spring(sunScale, { toValue: 1, friction: 5, tension: 40, useNativeDriver: true }),
        Animated.timing(cloudL, { toValue: 1, duration: 900, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(cloudR, { toValue: 1, duration: 900, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      ]),
    ]).start();
    Animated.loop(Animated.timing(rayRotate, { toValue: 1, duration: 20000, easing: Easing.linear, useNativeDriver: true })).start();
  }, [cloudL, cloudR, sunScale, sunOpacity, rayRotate]);

  const rayDeg = rayRotate.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const rays = Array.from({ length: 8 }, (_, i) => i * 45);

  return (
    <View style={sceneStyles.wrap}>
      <SkyGradient top="#8ec9f0" bottom="#ffe1a8" />
      <View style={sceneStyles.center}>
        <Animated.View style={[sceneStyles.rayGroup, { transform: [{ rotate: rayDeg }] }]}>
          {rays.map((deg) => (
            <View key={deg} style={[sceneStyles.ray, { transform: [{ rotate: `${deg}deg` }] }]} />
          ))}
        </Animated.View>
        <Animated.View style={[sceneStyles.sunGlow, { opacity: sunOpacity }]} />
        <Animated.View style={[sceneStyles.sun, { opacity: sunOpacity, transform: [{ scale: sunScale }] }]}>
          <Face blinkEye="left" />
        </Animated.View>
      </View>
      <Animated.View style={[sceneStyles.cloud, sceneStyles.cloudLeft, { transform: [{ translateX: cloudL.interpolate({ inputRange: [0, 1], outputRange: [0, -70] }) }] }]}>
        <View style={[sceneStyles.cloudPuff, { width: 60, height: 60, top: 6, left: 10 }]} />
        <View style={[sceneStyles.cloudPuff, { width: 44, height: 44, top: 0, left: 46 }]} />
        <View style={[sceneStyles.cloudBase, { width: 90 }]} />
      </Animated.View>
      <Animated.View style={[sceneStyles.cloud, sceneStyles.cloudRight, { transform: [{ translateX: cloudR.interpolate({ inputRange: [0, 1], outputRange: [0, 70] }) }] }]}>
        <View style={[sceneStyles.cloudPuff, { width: 50, height: 50, top: 8, left: 8 }]} />
        <View style={[sceneStyles.cloudPuff, { width: 38, height: 38, top: 2, left: 40 }]} />
        <View style={[sceneStyles.cloudBase, { width: 78 }]} />
      </Animated.View>
    </View>
  );
}

/** Bright high sun, cheerfully waving two little "arms" side to side. */
function AdminAfternoonScene() {
  const sunScale = useRef(new Animated.Value(0.6)).current;
  const sunOpacity = useRef(new Animated.Value(0)).current;
  const waveL = useRef(new Animated.Value(0)).current;
  const waveR = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(sunOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.spring(sunScale, { toValue: 1, friction: 5, tension: 45, useNativeDriver: true }),
    ]).start();

    const waveLoop = (val: Animated.Value, delay: number) => {
      let cancelled = false;
      const step = () => {
        if (cancelled) return;
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(val, { toValue: 1, duration: 260, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
          Animated.timing(val, { toValue: -1, duration: 400, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
          Animated.timing(val, { toValue: 0, duration: 260, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        ]).start(() => step());
      };
      step();
      return () => {
        cancelled = true;
      };
    };
    const stopL = waveLoop(waveL, 900);
    const stopR = waveLoop(waveR, 1000);
    return () => {
      stopL();
      stopR();
    };
  }, [sunOpacity, sunScale, waveL, waveR]);

  const rotL = waveL.interpolate({ inputRange: [-1, 1], outputRange: ['-30deg', '10deg'] });
  const rotR = waveR.interpolate({ inputRange: [-1, 1], outputRange: ['10deg', '-30deg'] });

  return (
    <View style={sceneStyles.wrap}>
      <SkyGradient top="#4fb2f0" bottom="#bfe8ff" />
      <View style={sceneStyles.center}>
        <Animated.View style={[sceneStyles.sunGlow, { opacity: sunOpacity, width: 150, height: 150, borderRadius: 75 }]} />
        <Animated.View style={[sceneStyles.sun, { width: 92, height: 92, borderRadius: 46, opacity: sunOpacity, transform: [{ scale: sunScale }] }]}>
          <Face blinkEye="both" />
        </Animated.View>
        <Animated.View style={[sceneStyles.waveArm, sceneStyles.waveArmLeft, { transform: [{ rotate: rotL }] }]} />
        <Animated.View style={[sceneStyles.waveArm, sceneStyles.waveArmRight, { transform: [{ rotate: rotR }] }]} />
      </View>
    </View>
  );
}

/** Warm sunset — sun low near the horizon, sleepy half-closed eyes. */
function AdminEveningScene() {
  const sunOpacity = useRef(new Animated.Value(0)).current;
  const sunY = useRef(new Animated.Value(-20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(sunOpacity, { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.spring(sunY, { toValue: 0, friction: 6, tension: 40, useNativeDriver: true }),
    ]).start();
  }, [sunOpacity, sunY]);

  return (
    <View style={sceneStyles.wrap}>
      <SkyGradient top="#5b4b8a" bottom="#ff9d6c" />
      <View style={sceneStyles.horizon} />
      <Animated.View style={[sceneStyles.center, { transform: [{ translateY: sunY }] }]}>
        <Animated.View style={[sceneStyles.sunGlow, { opacity: sunOpacity, backgroundColor: 'rgba(255,140,90,0.35)' }]} />
        <Animated.View style={[sceneStyles.sun, { opacity: sunOpacity, backgroundColor: '#ff8c5a' }]}>
          <Face sleepy tint="#8a3d1a" />
        </Animated.View>
      </Animated.View>
    </View>
  );
}

/** Moon rising among stars that blink by growing and shrinking, not just fading. */
function AdminNightScene() {
  const skyOpacity = useRef(new Animated.Value(0)).current;
  const moonScale = useRef(new Animated.Value(0.5)).current;
  const stars = useRef(Array.from({ length: 16 }, () => new Animated.Value(0.4))).current;
  const starPositions = useRef(
    Array.from({ length: 16 }, () => ({ top: Math.random() * (SCENE_HEIGHT - 40) + 10, left: Math.random() * 280 + 10, size: 3 + Math.random() * 4 }))
  ).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(skyOpacity, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.spring(moonScale, { toValue: 1, friction: 6, tension: 40, delay: 200, useNativeDriver: true }),
    ]).start();

    stars.forEach((star, i) => {
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 150),
          Animated.timing(star, { toValue: 1, duration: 700 + (i % 4) * 150, useNativeDriver: true }),
          Animated.timing(star, { toValue: 0.35, duration: 700 + (i % 4) * 150, useNativeDriver: true }),
        ])
      ).start();
    });
  }, [skyOpacity, moonScale, stars]);

  return (
    <Animated.View style={[sceneStyles.wrap, { opacity: skyOpacity }]}>
      <SkyGradient top="#050818" bottom="#232156" />
      {starPositions.map((p, i) => (
        <Animated.View
          key={i}
          style={[
            sceneStyles.star,
            {
              top: p.top,
              left: p.left,
              width: p.size,
              height: p.size,
              borderRadius: p.size / 2,
              opacity: stars[i].interpolate({ inputRange: [0.35, 1], outputRange: [0.3, 1] }),
              transform: [{ scale: stars[i] }],
            },
          ]}
        />
      ))}
      <Animated.View style={[sceneStyles.moonClip, { transform: [{ scale: moonScale }] }]}>
        <View style={sceneStyles.moonFull}>
          <Face blinkEye="both" tint="#5c5230" />
        </View>
      </Animated.View>
    </Animated.View>
  );
}

const ADMIN_SCENES: Record<Daypart, React.ComponentType> = {
  morning: AdminMorningScene,
  afternoon: AdminAfternoonScene,
  evening: AdminEveningScene,
  night: AdminNightScene,
};

/* ───────────────────────── One-off: Kawal's birthday (2026-09-20, admin-only) ───────────────────────── */

// Hardcoded one-off, not DB-backed like festivalGreetingService.js — see
// kawalBirthdayService.js on the backend for the employee-side push (a
// different, static photo + text, sent once in the morning — never a
// video). This is the admin-only counterpart: a full-screen video takeover
// (own embedded audio, no separate sound file needed), same UI pattern as
// FestivalGreetingModal.tsx's VideoUrl mode, shown every time an admin opens
// the app that day (bypasses the normal once-per-daypart dedup below).
// Deliberately NOT reusing FestivalGreetingModal/FestivalGreeting for this:
// that system shows its video to EVERYONE (admin and employee alike, see its
// own "for everyone, admin or employee" comment) with no per-audience gate,
// which would leak this to employees. AdminGreetingModal is already
// admin-only by construction (see MorningGreetingModal's mode branch below),
// so the video lives here instead.
const KAWAL_BIRTHDAY_DATE = '2026-09-20';
const KAWAL_VIDEO_URL = 'https://apnapayroll247.in/uploads/kawal-birthday/kawal-birthday-video.mp4';

const kawalVideoHtml = (url: string) => `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
<style>
  html, body { margin: 0; padding: 0; background: #000; height: 100%; overflow: hidden; }
  video { width: 100%; height: 100%; object-fit: contain; background: #000; }
</style>
</head>
<body>
  <video src="${url}" autoplay controls playsinline webkit-playsinline></video>
</body>
</html>`;

/** A tapped AdminShayari notification's own title/body — re-shown verbatim (see showAdminShayariFromNotification below), bypassing the once-per-daypart dedup entirely since this is an explicit user action, not the automatic on-open check. */
type ForcedShayari = { title: string; body: string; daypart: Daypart };
let forceShowHandler: ((show: ForcedShayari) => void) | null = null;

/**
 * Called from the notification-tap router (adminNotificationRouter.ts) when
 * an admin taps an AdminShayari notification — re-displays exactly that
 * push's own title/body (the shayari text + author line is already baked
 * into `body` by morningPushService.js), since there's no "fetch this exact
 * past sher by id" endpoint and the daily-shayari API only ever returns
 * *today's* sher, which may differ from whatever this older notification said.
 */
export function showAdminShayariFromNotification(show: ForcedShayari) {
  forceShowHandler?.(show);
}

/**
 * Shown up to 4x a day for every admin — once per daypart (morning/afternoon/
 * evening/night), each with its own scene, each independently tracked so
 * opening the app again later the same day shows the NEXT daypart's scene
 * the moment that window arrives (not capped to once-per-day like employees).
 * Same sher all day (adminShayariService.js plans one per calendar date, not
 * per daypart) — only the scene/greeting changes.
 */
function AdminGreetingModal({ user }: { user: { name: string; mobile?: string } }) {
  const insets = useSafeAreaInsets();
  const [visible, setVisible] = useState(false);
  const [quote, setQuote] = useState<string | null>(null);
  const [author, setAuthor] = useState<string | null>(null);
  const [daypart, setDaypart] = useState<Daypart>(currentDaypart());
  const [forced, setForced] = useState<ForcedShayari | null>(null);
  const [sharing, setSharing] = useState(false);
  const shotRef = useRef<View>(null);

  useEffect(() => {
    forceShowHandler = (show) => setForced(show);
    return () => {
      forceShowHandler = null;
    };
  }, []);

  const isKawalBirthday = todayYmd() === KAWAL_BIRTHDAY_DATE;

  useEffect(() => {
    // Kawal's birthday: no AsyncStorage dedup at all — shows every time the
    // app is (re)launched that day, same "every open" treatment
    // FestivalGreetingModal.tsx gives admins for video greetings. No
    // quote/author needed — the video is the whole message, own embedded audio.
    if (isKawalBirthday) {
      setVisible(true);
      return undefined;
    }

    let cancelled = false;
    const dp = currentDaypart();
    const storageKey = `apna_payroll_admin_greeting:${user.mobile ?? 'unknown'}:${dp}`;

    (async () => {
      try {
        const lastShown = await AsyncStorage.getItem(storageKey);
        if (lastShown === todayYmd()) return;

        const res = await getTodayShayari();
        if (cancelled) return;
        setQuote(res.data.text);
        setAuthor(res.data.author || null);
        setDaypart(dp);
        setVisible(true);
        await AsyncStorage.setItem(storageKey, todayYmd());
      } catch {
        /* best-effort — a failed fetch just means no greeting this session, never blocks the app */
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!visible && !forced) return null;
  const name = user.name?.split(' ')?.[0] || 'there';
  const effectiveDaypart = forced?.daypart ?? daypart;
  const Scene = ADMIN_SCENES[effectiveDaypart];
  const close = () => {
    setVisible(false);
    setForced(null);
  };

  const handleShare = async () => {
    if (sharing || !shotRef.current) return;
    setSharing(true);
    try {
      const uri = await captureRef(shotRef.current, { format: 'png', quality: 0.92 });
      await Share.open({ url: `file://${uri}`, filename: 'shayari.png', failOnCancel: false });
    } catch (err: any) {
      if (err?.message && !/cancel/i.test(err.message)) Alert.alert('Could not share', 'Please try again.');
    } finally {
      setSharing(false);
    }
  };

  if (isKawalBirthday && !forced) {
    const videoUrl = resolveFileUrl(KAWAL_VIDEO_URL)!;
    const handleVideoShare = async () => {
      if (sharing) return;
      setSharing(true);
      try {
        await shareRemoteMedia(videoUrl, 'kawal-birthday.mp4');
      } catch (err: any) {
        if (err?.message && !/cancel/i.test(err.message)) Alert.alert('Could not share', 'Please try again.');
      } finally {
        setSharing(false);
      }
    };
    return (
      <Modal visible transparent={false} animationType="fade" onRequestClose={close}>
        <View style={styles.videoContainer}>
          <WebView source={{ html: kawalVideoHtml(videoUrl) }} style={styles.webview} allowsInlineMediaPlayback mediaPlaybackRequiresUserAction={false} />
          <Pressable style={[styles.videoCloseBtn, { top: insets.top + 12 }]} onPress={close} hitSlop={12}>
            <Icon name="x" size={18} color="#fff" />
          </Pressable>
          <Pressable style={[styles.videoShareBtn, { top: insets.top + 12 }]} onPress={handleVideoShare} disabled={sharing} hitSlop={12}>
            {sharing ? <ActivityIndicator size="small" color="#fff" /> : <Icon name="share" size={18} color="#fff" />}
          </Pressable>
        </View>
      </Modal>
    );
  }

  return (
    <Modal visible transparent animationType="fade" onRequestClose={close}>
      <Pressable style={styles.backdrop} onPress={close}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          {/* collapsable={false} is required on Android — otherwise the view
              can get optimized out of the native hierarchy and captureRef
              silently captures nothing. Buttons live outside this wrapper so
              the shared screenshot is just the greeting card, not the UI chrome. */}
          <View ref={shotRef} collapsable={false}>
            <View style={styles.sceneWrap}>
              <Scene />
            </View>
            <View style={styles.captureBody}>
              <Text style={styles.greeting}>{forced ? forced.title : `${DAYPART_GREETING[daypart]}, ${name}!`}</Text>
              {forced ? (
                <Text style={[styles.quote, styles.adminQuote]}>{forced.body}</Text>
              ) : (
                <>
                  {quote ? <Text style={[styles.quote, styles.adminQuote]}>{quote}</Text> : null}
                  {quote && author ? <Text style={styles.author}>— {author}</Text> : null}
                </>
              )}
            </View>
          </View>
          <View style={styles.buttonWrap}>
            <View style={styles.actionRow}>
              <Pressable style={[styles.closeBtn, { flex: 1 }]} onPress={close}>
                <Text style={styles.closeBtnText}>Let's go</Text>
              </Pressable>
              <Pressable style={styles.shareBtn} onPress={handleShare} disabled={sharing}>
                {sharing ? <ActivityIndicator size="small" color={colors.primary} /> : <Icon name="share" size={18} color={colors.primary} />}
              </Pressable>
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/* ───────────────────────── Entry point ───────────────────────── */

export default function MorningGreetingModal() {
  const { user } = useAuth();
  if (!user) return null;
  if (user.mode === 'employee') return <EmployeeGreetingModal user={user} />;
  if (user.mode === 'admin') return <AdminGreetingModal user={user} />;
  return null;
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center', padding: spacing(2.5) },
  card: { width: '100%', maxWidth: 380, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.surface },
  sceneWrap: { width: '100%', height: SCENE_HEIGHT },
  body: { padding: spacing(2.5), alignItems: 'center' },

  videoContainer: { flex: 1, backgroundColor: '#000' },
  webview: { flex: 1, backgroundColor: '#000' },
  videoCloseBtn: { position: 'absolute', right: 16, width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center' },
  videoShareBtn: { position: 'absolute', right: 62, width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center' },
  captureBody: { padding: spacing(2.5), paddingBottom: spacing(1.5), alignItems: 'center', backgroundColor: colors.surface },
  buttonWrap: { paddingHorizontal: spacing(2.5), paddingBottom: spacing(2.5) },
  greeting: { fontSize: 19, fontWeight: '800', color: colors.text, marginBottom: 10, textAlign: 'center' },
  quote: { fontSize: 14, color: colors.textMuted, textAlign: 'center', lineHeight: 21, marginBottom: spacing(2) },
  adminQuote: { fontSize: 17, fontWeight: '700', color: colors.text, lineHeight: 25, marginBottom: 4 },
  author: { fontSize: 12, color: colors.textMuted, textAlign: 'center', fontStyle: 'italic', marginBottom: spacing(2) },
  closeBtn: { backgroundColor: colors.primary, borderRadius: radius.sm, paddingVertical: 12, paddingHorizontal: 32 },
  closeBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  actionRow: { flexDirection: 'row', gap: 10, width: '100%', alignItems: 'stretch' },
  shareBtn: { width: 44, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
});

const faceStyles = StyleSheet.create({
  wrap: { position: 'absolute', top: '38%', alignItems: 'center' },
  eyeRow: { flexDirection: 'row', gap: 14 },
  eye: { width: 7, height: 7, borderRadius: 3.5 },
  eyeSleepy: { height: 2.5, borderRadius: 1.5 },
  smile: { width: 18, height: 9, borderBottomLeftRadius: 9, borderBottomRightRadius: 9, borderBottomWidth: 2.5, marginTop: 6 },
  smileSmall: { width: 12, height: 6, marginTop: 4 },
});

const sceneStyles = StyleSheet.create({
  wrap: { width: '100%', height: SCENE_HEIGHT, overflow: 'hidden', position: 'relative' },
  center: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  horizon: { position: 'absolute', bottom: 0, left: 0, right: 0, height: SCENE_HEIGHT * 0.32, backgroundColor: 'rgba(60,30,60,0.35)' },

  sun: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#ffb703', alignItems: 'center' },
  sunGlow: { position: 'absolute', width: 130, height: 130, borderRadius: 65, backgroundColor: 'rgba(255,183,3,0.35)' },
  rayGroup: { position: 'absolute', width: 80, height: 80, alignItems: 'center', justifyContent: 'center' },
  ray: { position: 'absolute', width: 4, height: 110, borderRadius: 2, backgroundColor: 'rgba(255,183,3,0.4)' },

  waveArm: { position: 'absolute', width: 26, height: 8, borderRadius: 4, backgroundColor: '#ffb703', top: '46%' },
  waveArmLeft: { left: '28%' },
  waveArmRight: { right: '28%' },

  cloud: { position: 'absolute', width: 100, height: 60 },
  cloudLeft: { top: 40, left: -10 },
  cloudRight: { top: 90, right: -10 },
  cloudPuff: { position: 'absolute', borderRadius: 999, backgroundColor: '#ffffff' },
  cloudBase: { position: 'absolute', height: 34, borderRadius: 17, backgroundColor: '#ffffff', bottom: 0, left: 6 },

  star: { position: 'absolute', backgroundColor: '#fff9db' },
  moonClip: { position: 'absolute', top: SCENE_HEIGHT / 2 - 45, right: 40, width: 45, height: 90, overflow: 'hidden' },
  moonFull: { width: 90, height: 90, borderRadius: 45, backgroundColor: '#f2eecb', alignItems: 'center' },
});
