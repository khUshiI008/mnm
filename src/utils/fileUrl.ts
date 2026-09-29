import { API_BASE_URL, NET_WEB_BASE_URL } from '../config';

const NODE_FILE_BASE_URL = API_BASE_URL.replace(/\/api$/, '');

/**
 * Resolves a file path stored in the DB (KYC docs, selfies, signatures) to a
 * loadable URL. Paths come in two shapes depending on which app wrote them:
 *   - "/Content/Uploads/..." — written by the .NET web app, only exists on
 *     its host (NET_WEB_BASE_URL).
 *   - "/uploads/..." — written by this Node backend, exists on its own host
 *     (API_BASE_URL's host).
 * Mixing these up 404s — see config.ts's NET_WEB_BASE_URL comment.
 */
export function resolveFileUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  const base = path.startsWith('/Content/Uploads/') ? NET_WEB_BASE_URL : NODE_FILE_BASE_URL;
  return base + path;
}
