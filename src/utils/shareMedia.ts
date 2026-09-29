import ReactNativeBlobUtil from 'react-native-blob-util';
import Share from 'react-native-share';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../config';
import { TOKEN_KEY } from '../api/client';

/**
 * Shares a remote image/video (festival greeting media) via the native share
 * sheet, so WhatsApp Status appears as a target without the user having to
 * screen-record. Downloads to a real local cache file via react-native-blob-util
 * rather than React Native's own built-in fetch().blob()/FileReader — RN's
 * built-in Blob polyfill is known to be unreliable for binary payloads like
 * video/image files (it's built primarily for text/JSON), which is what was
 * throwing "Could not share" for every attempt before this. Sharing by local
 * file:// path also avoids passing a multi-MB string across the JS<->native
 * boundary at all.
 */
export async function shareRemoteMedia(remoteUrl: string, filename: string) {
  const localPath = `${ReactNativeBlobUtil.fs.dirs.CacheDir}/${filename}`;
  const res = await ReactNativeBlobUtil.config({ path: localPath }).fetch('GET', remoteUrl);
  await Share.open({ url: `file://${res.path()}`, filename, failOnCancel: false });
}

/**
 * Same download-then-share pattern as shareRemoteMedia, but for an
 * authenticated backend endpoint (e.g. a payslip PDF) — react-native-blob-util's
 * raw .fetch() doesn't go through client.ts's axios interceptor, so the token
 * has to be read from AsyncStorage and attached manually here.
 */
export async function shareAuthedFile(apiPath: string, filename: string, mimeType: string) {
  const token = await AsyncStorage.getItem(TOKEN_KEY);
  const localPath = `${ReactNativeBlobUtil.fs.dirs.CacheDir}/${filename}`;
  const res = await ReactNativeBlobUtil.config({ path: localPath }).fetch('GET', `${API_BASE_URL}${apiPath}`, {
    Authorization: `Bearer ${token}`,
  });
  await Share.open({ url: `file://${res.path()}`, filename, type: mimeType, failOnCancel: false });
}
