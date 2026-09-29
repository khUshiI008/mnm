import { RefObject, useEffect, useRef, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { captureRef } from 'react-native-view-shot';
import ReactNativeBlobUtil from 'react-native-blob-util';
import Share from 'react-native-share';

/**
 * Shares a screenshot of one wrapped View (e.g. a report's summary card +
 * chart) via the native share sheet — same captureRef -> Share.open pattern
 * already used by MorningGreetingModal.tsx's shayari card. The caller's
 * wrapped View needs `collapsable={false}` on Android, same reason as there:
 * without it, the view can get optimized out of the native hierarchy and
 * captureRef silently captures nothing.
 */
export async function shareViewAsImage(ref: RefObject<View | null>, filename: string) {
  if (!ref.current) return;
  const uri = await captureRef(ref.current, { format: 'png', quality: 0.95 });
  await Share.open({ url: `file://${uri}`, filename, failOnCancel: false });
}

function csvEscape(v: unknown) {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * Writes rows to a local CSV file and opens the native share sheet for it —
 * same pattern as PartySaleReportScreen.tsx's exportCsv(). A leading BOM
 * makes Excel open the file as UTF-8 without a manual import step. CSV
 * (not a real .xlsx) opens natively in Excel/Sheets and needs no extra
 * library to generate, unlike a true binary spreadsheet format.
 */
export async function shareRowsAsCsv(header: string[], rows: (string | number)[][], filename: string) {
  const lines = [header, ...rows].map((r) => r.map(csvEscape).join(','));
  const csvContent = '﻿' + lines.join('\n');
  const path = `${ReactNativeBlobUtil.fs.dirs.CacheDir}/${filename}`;
  await ReactNativeBlobUtil.fs.writeFile(path, csvContent, 'utf8');
  await Share.open({ url: `file://${path}`, filename, type: 'text/csv', failOnCancel: false });
}

/** Safe-ish filename fragment — strips characters that upset a Share sheet or filesystem across platforms. */
export function safeFilePart(s: string) {
  return s.replace(/[^a-zA-Z0-9-]+/g, '_').replace(/^_+|_+$/g, '') || 'report';
}

/**
 * A screenshot of what's ON SCREEN can only ever show the visible portion of
 * a long list — that's what was wrong with the first version of "Share
 * Image" (it captured the chart+total, or a modal's title, and nothing
 * else). To actually include every row, the full list has to be rendered
 * SOMEWHERE, unclipped, even if only off-screen and only for the instant
 * captureRef runs. `useCaptureShare` drives that: `capturing` tells the
 * caller to mount an extra copy of its content — title, chart, AND every
 * row via plain `.map()`, not a virtualized FlatList — positioned off-screen
 * via `offscreenCaptureStyle` below, wrapped in the `ref` this hook returns.
 * A ~2,000-row report rendered as one unclipped bitmap risks hitting Android's
 * texture/bitmap size limits, so callers should cap what they render for
 * capture (see MAX_IMAGE_ROWS) and tell the admin to use Excel export
 * instead for anything larger — that export has no such limit, since it's
 * just text.
 */
export const MAX_IMAGE_ROWS = 150;

export function useCaptureShare(filename: string) {
  const [capturing, setCapturing] = useState(false);
  const [sharing, setSharing] = useState(false);
  const ref = useRef<View>(null);

  useEffect(() => {
    if (!capturing) return;
    let cancelled = false;
    // One frame so the off-screen view actually commits/lays out before capture.
    const t = setTimeout(async () => {
      try {
        await shareViewAsImage(ref, filename);
      } catch (err: any) {
        if (!cancelled && err?.message && !/cancel/i.test(err.message)) Alert.alert('Could not share', 'Please try again.');
      } finally {
        if (!cancelled) {
          setCapturing(false);
          setSharing(false);
        }
      }
    }, 50);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [capturing]);

  const startCapture = () => {
    if (sharing) return;
    setSharing(true);
    setCapturing(true);
  };

  return { ref, capturing, sharing, startCapture };
}

export const offscreenCaptureStyle = StyleSheet.create({
  wrap: { position: 'absolute', top: 0, left: -99999, width: 360, backgroundColor: '#fff' },
}).wrap;
