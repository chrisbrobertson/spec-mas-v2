export type Role = 'admin' | 'operator' | 'developer' | 'viewer';

export type Permission =
  | 'run:event:write'
  | 'session:read'
  | 'session:write'
  | 'system:inspect';

const ROLE_PERMISSIONS: Record<Role, ReadonlySet<Permission | '*'> > = {
  admin: new Set(['*']),
  operator: new Set(['run:event:write', 'session:read', 'session:write', 'system:inspect']),
  developer: new Set(['session:read', 'session:write', 'system:inspect']),
  viewer: new Set(['session:read', 'system:inspect'])
};

const PUBLIC_PATHS = new Set(['/health', '/readyz', '/auth/login']);

export interface AuthorizationResult {
  allowed: boolean;
  reason?: string;
}

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.has(pathname);
}

export function parseRole(value: string | string[] | undefined): Role | undefined {
  const rawValue = Array.isArray(value) ? value[0] : value;
  if (!rawValue) {
    return undefined;
  }

  const normalized = rawValue.trim().toLowerCase();
  if (normalized === 'admin' || normalized === 'operator' || normalized === 'developer' || normalized === 'viewer') {
    return normalized;
  }

  return undefined;
}

export function parseBearerToken(authorizationHeader: string | string[] | undefined): string | undefined {
  const rawValue = Array.isArray(authorizationHeader) ? authorizationHeader[0] : authorizationHeader;
  if (!rawValue) {
    return undefined;
  }

  const trimmed = rawValue.trim();
  if (!trimmed.toLowerCase().startsWith('bearer ')) {
    return undefined;
  }

  const token = trimmed.slice('bearer '.length).trim();
  return token.length > 0 ? token : undefined;
}

export function authorize(role: Role | undefined, permission: Permission | undefined): AuthorizationResult {
  if (!permission) {
    return {
      allowed: false,
      reason: 'access denied: route permission not configured'
    };
  }

  if (!role) {
    return {
      allowed: false,
      reason: 'access denied: role is required'
    };
  }

  const granted = ROLE_PERMISSIONS[role];
  if (granted.has('*') || granted.has(permission)) {
    return { allowed: true };
  }

  return {
    allowed: false,
    reason: `access denied: role ${role} lacks ${permission}`
  };
}
