import { AppLogger } from '../observability/app-logger.service';

const DEFAULT_ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
];

function stripWrappingQuotes(value: string) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}

export function normalizeOrigin(origin: string) {
  return stripWrappingQuotes(origin.trim()).replace(/\/+$/, '').toLowerCase();
}

function parseJsonOriginList(value: string) {
  try {
    const parsed: unknown = JSON.parse(value);

    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === 'string')
      : null;
  } catch {
    return null;
  }
}

export function parseAllowedOrigins(value?: string) {
  if (value === undefined) {
    return [...DEFAULT_ALLOWED_ORIGINS];
  }

  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return [];
  }

  const origins =
    trimmedValue.startsWith('[') && trimmedValue.endsWith(']')
      ? (parseJsonOriginList(trimmedValue) ?? [trimmedValue])
      : trimmedValue.split(/[\n,;]+/);

  return [...new Set(origins.map(normalizeOrigin).filter(Boolean))];
}

export function buildCorsOriginValidator(
  allowedOrigins: string[],
  logger: AppLogger,
) {
  return (
    requestOrigin: string | undefined,
    callback: (error: null, allow?: boolean) => void,
  ) => {
    if (!requestOrigin) {
      callback(null, true);
      return;
    }

    const normalizedRequestOrigin = normalizeOrigin(requestOrigin);

    if (allowedOrigins.includes(normalizedRequestOrigin)) {
      callback(null, true);
      return;
    }

    logger.logWithMetadata(
      'warn',
      'Rejected request from origin outside CORS allowlist',
      {
        allowedOrigins,
        requestOrigin,
        normalizedRequestOrigin,
      },
      'Cors',
    );
    callback(null, false);
  };
}
