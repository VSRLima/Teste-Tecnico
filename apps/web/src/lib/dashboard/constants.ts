export const LOCAL_API_URL = 'http://localhost:3333/api';
const publicApiUrl = process.env.NEXT_PUBLIC_API_URL?.trim();

export const API_URL =
  publicApiUrl || (process.env.NODE_ENV === 'development' ? LOCAL_API_URL : '');

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
