export const DEFAULT_API_PORT = 3100;
export const DEFAULT_CORS_ORIGIN = 'http://localhost:3000';
export const DEFAULT_API_HOST = '0.0.0.0';

function parsePort(value: string | undefined): number | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = Number.parseInt(value.trim(), 10);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
    return undefined;
  }

  return parsed;
}

export function resolveApiPort(args: string[], envPort: string | undefined): number {
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === '--port') {
      const fromNext = parsePort(args[index + 1]);
      return fromNext ?? DEFAULT_API_PORT;
    }

    if (argument.startsWith('--port=')) {
      const fromInline = parsePort(argument.slice('--port='.length));
      return fromInline ?? DEFAULT_API_PORT;
    }
  }

  return parsePort(envPort) ?? DEFAULT_API_PORT;
}

export function resolveCorsOrigin(value: string | undefined): string {
  const trimmed = value?.trim();
  if (!trimmed) {
    return DEFAULT_CORS_ORIGIN;
  }

  return trimmed;
}

export function resolveApiHost(value: string | undefined): string {
  const trimmed = value?.trim();
  if (!trimmed) {
    return DEFAULT_API_HOST;
  }

  return trimmed;
}
