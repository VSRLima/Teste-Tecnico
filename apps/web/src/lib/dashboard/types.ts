import type { campaignStatuses, locales, roles, themes } from './constants';

export type CampaignStatus = (typeof campaignStatuses)[number];
export type Role = (typeof roles)[number];
export type Locale = (typeof locales)[number];
export type Theme = (typeof themes)[number];

export type AuthUser = {
  name: string;
  role: Role;
  sub: string;
};

export type AuthSession = {
  accessToken: string;
};

export type AuthResponse = {
  accessToken: string;
  user: AuthUser;
};

export type ApiErrorResponse = {
  message?: string | string[];
};

export type Campaign = {
  id: string;
  name: string;
  description: string | null;
  status: CampaignStatus;
  budget: string;
  startDate: string;
  endDate: string | null;
  owner: {
    id: string;
    email: string;
    name: string;
    role: Role;
  };
};

export type ManagedUser = {
  createdAt: string;
  email: string;
  id: string;
  name: string;
  role: Role;
  updatedAt: string;
};

export type LoginFormState = {
  email: string;
  password: string;
};

export type UserProvisionFormState = {
  email: string;
  name: string;
  password: string;
  role: Role;
};

export type UserManagementFormState = UserProvisionFormState;

export type CampaignFormState = {
  budget: string;
  description: string;
  endDate: string;
  name: string;
  startDate: string;
  status: CampaignStatus;
};

export type FormErrors<T> = Partial<Record<keyof T, string>>;

export type FeedbackTone = 'success' | 'error' | 'info';

export type FeedbackState = {
  message: string;
  tone: FeedbackTone;
};
