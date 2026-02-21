export type UserRole = 'admin' | 'operator' | 'developer' | 'viewer';

export interface AuthSessionRecord {
  accessToken: string;
  role: UserRole;
  username: string;
  displayName: string;
  expiresAt: string;
}

export const AUTH_SESSION_STORAGE_KEY = 'specmas.auth.session';

export function isSessionExpired(expiresAt: string, nowIso = new Date().toISOString()): boolean {
  const expiresAtMs = Date.parse(expiresAt);
  const nowMs = Date.parse(nowIso);
  if (Number.isNaN(expiresAtMs) || Number.isNaN(nowMs)) {
    return true;
  }
  return nowMs >= expiresAtMs;
}

export function canWriteSessions(role: UserRole): boolean {
  return role === 'admin' || role === 'operator' || role === 'developer';
}

export function parseStoredSession(rawValue: string | null, nowIso = new Date().toISOString()): AuthSessionRecord | undefined {
  if (!rawValue) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(rawValue) as Partial<AuthSessionRecord>;
    if (
      !parsed.accessToken ||
      !parsed.role ||
      !parsed.username ||
      !parsed.displayName ||
      !parsed.expiresAt ||
      (parsed.role !== 'admin' && parsed.role !== 'operator' && parsed.role !== 'developer' && parsed.role !== 'viewer')
    ) {
      return undefined;
    }

    if (isSessionExpired(parsed.expiresAt, nowIso)) {
      return undefined;
    }

    return {
      accessToken: parsed.accessToken,
      role: parsed.role,
      username: parsed.username,
      displayName: parsed.displayName,
      expiresAt: parsed.expiresAt
    };
  } catch {
    return undefined;
  }
}
