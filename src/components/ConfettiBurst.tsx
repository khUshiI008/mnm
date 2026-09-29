import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View, useWindowDimensions } from 'react-native';

const COLORS = ['#f43f5e', '#fbbf24', '#22c55e', '#3b82f6', '#a855f7', '#f97316', '#ec4899', '#14b8a6'];
const PIECE_COUNT = 32;
const BURST_DURATION = 2200;
// Real patake feel — not one burst then done: keep firing bursts, spaced out,
// for as long as the modal stays open (25s auto-close, see Birthday/AnniversaryModal).
const REBURST_INTERVAL_MS = 3200;

type Piece = {
  color: string;
  size: number;
  shape: 'rect' | 'circle';
  angleDeg: number; // burst direction, biased upward (firecracker-outward, not a top-down rain)
  burstDistance: number;
  driftX: number; // extra horizontal wind drift during the fall phase
  fallDistance: number;
  rotateDir: 1 | -1;
  spinTurns: number;
};

function buildPieces(): Piece[] {
  return Array.from({ length: PIECE_COUNT }, () => {
    // -160°..-20° in screen terms (0° = right, 90° = down) keeps the initial
    // pop mostly upward/outward like a firecracker, not sideways or downward.
    const angleDeg = -160 + Math.random() * 140;
    return {
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      size: 6 + Math.random() * 6,
      shape: Math.random() > 0.5 ? 'rect' : 'circle',
      angleDeg,
      burstDistance: 60 + Math.random() * 90,
      driftX: (Math.random() - 0.5) * 100,
      fallDistance: 260 + Math.random() * 220,
      rotateDir: Math.random() > 0.5 ? 1 : -1,
      spinTurns: 2 + Math.random() * 3,
    };
  });
}

/**
 * A repeating shower of small colored pieces bursting outward-then-falling
 * from a point near the top of the screen — the "patake phutna" animation
 * layered over BirthdayModal/AnniversaryModal. Plain Views + the Animated
 * API (transform/opacity only, all native-driver-eligible) rather than a new
 * particle/confetti library — consistent with how MorningGreetingModal's
 * sunrise/moon scenes were built, no extra dependency.
 */
export default function ConfettiBurst({ active }: { active: boolean }) {
  const { width } = useWindowDimensions();
  const originX = width / 2;
  const pieces = useRef<Piece[]>(buildPieces()).current;
  const progress = useRef(pieces.map(() => new Animated.Value(0))).current;
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fire = () => {
    progress.forEach((v) => v.setValue(0));
    Animated.stagger(
      12,
      progress.map((v) =>
        Animated.timing(v, { toValue: 1, duration: BURST_DURATION, easing: Easing.out(Easing.cubic), useNativeDriver: true })
      )
    ).start();
  };

  useEffect(() => {
    if (!active) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = null;
      return;
    }
    fire();
    intervalRef.current = setInterval(fire, REBURST_INTERVAL_MS);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  if (!active) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {pieces.map((p, i) => {
        const rad = (p.angleDeg * Math.PI) / 180;
        const burstX = Math.cos(rad) * p.burstDistance;
        const burstY = Math.sin(rad) * p.burstDistance;

        const translateX = progress[i].interpolate({
          inputRange: [0, 0.3, 1],
          outputRange: [0, burstX, burstX + p.driftX],
        });
        const translateY = progress[i].interpolate({
          inputRange: [0, 0.3, 1],
          outputRange: [0, burstY, burstY + p.fallDistance],
        });
        const rotate = progress[i].interpolate({
          inputRange: [0, 1],
          outputRange: ['0deg', `${360 * p.spinTurns * p.rotateDir}deg`],
        });
        const scale = progress[i].interpolate({ inputRange: [0, 0.15, 1], outputRange: [0.3, 1, 1] });
        const opacity = progress[i].interpolate({ inputRange: [0, 0.7, 1], outputRange: [1, 1, 0] });

        return (
          <Animated.View
            key={i}
            style={{
              position: 'absolute',
              left: originX,
              top: '14%',
              width: p.size,
              height: p.shape === 'rect' ? p.size * 1.6 : p.size,
              borderRadius: p.shape === 'rect' ? 2 : p.size / 2,
              backgroundColor: p.color,
              opacity,
              transform: [{ translateX }, { translateY }, { rotate }, { scale }],
            }}
          />
        );
      })}
    </View>
  );
}
