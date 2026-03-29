import { API_URL } from './constants';
import type { Messages } from './copy';

export function parseApiError(data: unknown, fallback: string) {
  if (!data || typeof data !== 'object' || !('message' in data)) {
    return fallback;
  }

  const message = (data as { message?: unknown }).message;

  if (Array.isArray(message)) {
    const normalizedMessage = message
      .filter((item): item is string => typeof item === 'string')
      .join(' ');

    return normalizedMessage || fallback;
  }

  return typeof message === 'string' && message.length > 0 ? message : fallback;
}

export async function parseJsonResponse<T>(response: Response) {
  if (!response.headers.get('content-type')?.includes('application/json')) {
    return null;
  }

  return (await response.json()) as T;
}

export function getApiUrl(messages: Messages) {
  if (!API_URL) {
    throw new Error(messages.apiNotConfigured);
  }

  return API_URL;
}
