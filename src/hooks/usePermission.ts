import { useAuth } from '../context/AuthContext';

/**
 * True for admins unconditionally (no DB round trip needed client-side — the
 * server enforces the real boundary on every request regardless). For a
 * manager, true only if their fetched grants include this exact module+action.
 * UI-only gating: hiding a button here is a courtesy, never the security
 * control — see requirePermission.js on the backend for that.
 */
export function usePermission(moduleKey: string, actionKey: string): boolean {
  const { user } = useAuth();
  if (user?.mode === 'admin') return true;
  return !!user?.permissions?.some((p) => p.moduleKey === moduleKey && p.actionKey === actionKey);
}

/**
 * Field-level counterpart for Employee/Edit-style grants.
 * null = unrestricted (admin, or no field-level concept for this action).
 * string[] = exactly the editable field keys (empty array = none).
 */
export function useAllowedFields(moduleKey: string, actionKey: string): string[] | null {
  const { user } = useAuth();
  if (user?.mode === 'admin') return null;
  const grant = user?.permissions?.find((p) => p.moduleKey === moduleKey && p.actionKey === actionKey);
  if (!grant) return [];
  return grant.allowedFields ?? [];
}
