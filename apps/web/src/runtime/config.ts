const DEFAULT_API_BASE_URL = 'http://localhost:3100';

function trimTrailingSlash(value: string): string {
  return value.endsWith('/') ? value.slice(0, -1) : value;
}

export function resolveApiBaseUrl(input: string | undefined): string {
  const trimmed = input?.trim();
  if (!trimmed) {
    return DEFAULT_API_BASE_URL;
  }

  try {
    const parsed = new URL(trimmed);
    return trimTrailingSlash(parsed.toString());
  } catch {
    return DEFAULT_API_BASE_URL;
  }
}

export { DEFAULT_API_BASE_URL };
