import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../config';
import { getDeviceId } from '../utils/deviceId';

export const TOKEN_KEY = 'apna_payroll_token';

const client = axios.create({ baseURL: API_BASE_URL, timeout: 20000 });

client.interceptors.request.use(async (cfg) => {
  const token = await AsyncStorage.getItem(TOKEN_KEY);
  cfg.headers = cfg.headers || {};
  if (token) {
    cfg.headers.Authorization = `Bearer ${token}`;
  }
  cfg.headers['X-Device-Id'] = await getDeviceId();
  return cfg;
});

// Registered by AuthContext on mount — lets a background 401 (token expired,
// or invalidated by strict single-device login: someone signed in on another
// device) force a real sign-out + return to the Login screen, instead of
// just failing whatever individual request happened to trigger it. Guarded
// against re-entry since signOut's own cleanup calls (e.g. unregistering the
// device's push token) go through this same client and could otherwise 401
// again and re-trigger this while the first sign-out is still running.
let unauthorizedHandler: (() => void) | null = null;
let handlingUnauthorized = false;
export function setUnauthorizedHandler(fn: (() => void) | null) {
  unauthorizedHandler = fn;
}

client.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err?.response?.status === 401 && unauthorizedHandler && !handlingUnauthorized) {
      handlingUnauthorized = true;
      Promise.resolve(unauthorizedHandler()).finally(() => {
        handlingUnauthorized = false;
      });
    }
    return Promise.reject(err);
  }
);

export default client;
