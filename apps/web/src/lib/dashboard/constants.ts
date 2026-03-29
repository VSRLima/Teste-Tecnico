export const LOCAL_API_URL = 'http://localhost:3333/api';
export const API_URL = (() => {
  const publicApiUrl = process.env.NEXT_PUBLIC_API_URL?.trim();

  if (publicApiUrl) {
    return publicApiUrl;
  }

  if (process.env.NODE_ENV === 'development') {
    return LOCAL_API_URL;
  }

  throw new Error('NEXT_PUBLIC_API_URL must be set in production');
})();

export const LEGACY_TOKEN_STORAGE_KEY = 'directcash.token';
export const LEGACY_USER_STORAGE_KEY = 'directcash.user';
export const THEME_STORAGE_KEY = 'directcash.preferences.theme';
export const LOCALE_STORAGE_KEY = 'directcash.preferences.locale';

export const campaignStatuses = [
  'DRAFT',
  'ACTIVE',
  'PAUSED',
  'COMPLETED',
] as const;
export const roles = ['ADMIN', 'MANAGER', 'USER'] as const;
export const locales = ['pt-BR', 'en-US'] as const;
export const themes = ['dark', 'light'] as const;
