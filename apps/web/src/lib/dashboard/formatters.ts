import { copy } from './copy';
import type { CampaignStatus, Locale, Role } from './types';

export function formatCurrency(locale: Locale, value: number | string) {
  const numericValue = Number(value);

  if (Number.isNaN(numericValue)) {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: 'BRL',
    }).format(0);
  }

  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'BRL',
  }).format(numericValue);
}

export function formatDate(locale: Locale, value: string | null) {
  if (!value) {
    return copy[locale].noEndDate;
  }

  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
  }).format(new Date(value));
}

export function formatRole(locale: Locale, role: Role) {
  if (locale === 'en-US') {
    switch (role) {
      case 'ADMIN':
        return 'Administrator';
      case 'MANAGER':
        return 'Manager';
      case 'USER':
      default:
        return 'User';
    }
  }

  switch (role) {
    case 'ADMIN':
      return 'Administrador';
    case 'MANAGER':
      return 'Gestor';
    case 'USER':
    default:
      return 'Usuário';
  }
}

export function formatCampaignStatus(locale: Locale, status: CampaignStatus) {
  switch (status) {
    case 'ACTIVE':
      return locale === 'pt-BR' ? 'Ativa' : 'Active';
    case 'PAUSED':
      return locale === 'pt-BR' ? 'Pausada' : 'Paused';
    case 'COMPLETED':
      return locale === 'pt-BR' ? 'Concluída' : 'Completed';
    case 'DRAFT':
    default:
      return locale === 'pt-BR' ? 'Rascunho' : 'Draft';
  }
}

export function toDateInputValue(value: string | null) {
  if (!value) {
    return '';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');

  return `${year}-${month}-${day}`;
}

export function getTodayInputValue() {
  const now = new Date();
  const timezoneOffsetInMs = now.getTimezoneOffset() * 60_000;

  return new Date(now.getTime() - timezoneOffsetInMs)
    .toISOString()
    .slice(0, 10);
}

export function toLocalDateISOString(value: string) {
  const parts = value.split('-');

  if (parts.length !== 3) {
    throw new Error('Invalid date input');
  }

  const [year, month, day] = parts.map(Number);

  if (![year, month, day].every((part) => Number.isFinite(part))) {
    throw new Error('Invalid date input');
  }

  const date = new Date(year, month - 1, day);

  if (
    Number.isNaN(date.getTime()) ||
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    throw new Error('Invalid date input');
  }

  return date.toISOString();
}

export function getCampaignCountLabel(locale: Locale, count: number) {
  return count === 1 ? copy[locale].campaignFound : copy[locale].campaignsFound;
}
