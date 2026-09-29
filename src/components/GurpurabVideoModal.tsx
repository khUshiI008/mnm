import React, { useEffect, useState } from 'react';
import { AppState, Modal, Pressable, StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from './Icon';
import { useAuth } from '../context/AuthContext';
import { resolveFileUrl } from '../utils/fileUrl';

const VIDEO_URL = resolveFileUrl('/uploads/misc/greetings.mp4')!;
// 12 Sep 2026, 23:59:59 local device time — one-day-only event, hardcoded
// rather than a backend flag since it never needs to be reused or toggled.
const CUTOFF = new Date(2026, 8, 12, 23, 59, 59);

function withinWindow() {
  return new Date() <= CUTOFF;
}

// Lets the notification-tap routers force this open regardless of the
// AppState-driven show above — e.g. tapping the Gurpurab push while the app
// is already in the foreground (no 'active' AppState transition fires then).
let forceShowHandler: (() => void) | null = null;
export function showGurpurabVideoFromNotification() {
  if (withinWindow()) forceShowHandler?.();
}

const HTML = `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
<style>
  html, body { margin: 0; padding: 0; background: #000; height: 100%; overflow: hidden; }
  video { width: 100%; height: 100%; object-fit: contain; background: #000; }
</style>
</head>
<body>
  <video id="v" src="${VIDEO_URL}" autoplay controls playsinline webkit-playsinline></video>
  <script>
    document.getElementById('v').addEventListener('ended', function () {
      window.ReactNativeWebView.postMessage('ended');
    });
  </script>
</body>
</html>`;

/**
 * One-day-only (12 Sep 2026) Gurpurab greeting video — full-screen, autoplays
 * with sound, shown to every admin and employee on EVERY app open/foreground
 * (deliberately no once-per-day dedup, per explicit request) until the CUTOFF
 * above. No backend involvement beyond hosting the static video file — see
 * scripts/upload-event-video.js.
 */
export default function GurpurabVideoModal() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!user || (user.mode !== 'admin' && user.mode !== 'employee')) return undefined;
    if (!withinWindow()) return undefined;

    setVisible(true);

    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && withinWindow()) setVisible(true);
    });

    forceShowHandler = () => setVisible(true);

    return () => {
      sub.remove();
      forceShowHandler = null;
    };
  }, [user?.mode]);

  if (!visible || !user) return null;

  return (
    <Modal visible transparent={false} animationType="fade" onRequestClose={() => setVisible(false)}>
      <View style={styles.container}>
        <WebView
          source={{ html: HTML }}
          style={styles.webview}
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction={false}
          onMessage={(e) => {
            if (e.nativeEvent.data === 'ended') setVisible(false);
          }}
        />
        <Pressable style={[styles.closeBtn, { top: insets.top + 12 }]} onPress={() => setVisible(false)} hitSlop={12}>
          <Icon name="x" size={18} color="#fff" />
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  webview: { flex: 1, backgroundColor: '#000' },
  closeBtn: {
    position: 'absolute',
    right: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
