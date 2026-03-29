import { campaignStatuses, roles } from './constants';
import { copy } from './copy';
import { getTodayInputValue } from './formatters';
import type {
  CampaignFormState,
  FormErrors,
  Locale,
  LoginFormState,
  UserManagementFormState,
  UserProvisionFormState,
} from './types';

export function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function validateLoginForm(locale: Locale, form: LoginFormState) {
  const errors: FormErrors<LoginFormState> = {};
  const messages = copy[locale];

  if (!form.email.trim()) {
    errors.email = messages.enterAccessEmail;
  } else if (!isValidEmail(form.email)) {
    errors.email = messages.typeValidEmail;
  }

  if (!form.password) {
    errors.password = messages.enterPassword;
  } else if (form.password.length < 8) {
    errors.password = messages.minPassword;
  }

  return errors;
}

export function validateProvisionForm(
  locale: Locale,
  form: UserProvisionFormState,
) {
  return validateManagedUserForm(locale, form, true);
}

export function validateManagedUserForm(
  locale: Locale,
  form: UserManagementFormState,
  requirePassword: boolean,
) {
  const errors: FormErrors<UserManagementFormState> = {};
  const messages = copy[locale];

  if (!form.name.trim()) {
    errors.name = messages.enterFullName;
  } else if (form.name.trim().length < 3) {
    errors.name = messages.minName;
  }

  if (!form.email.trim()) {
    errors.email = messages.enterNewAccessEmail;
  } else if (!isValidEmail(form.email)) {
    errors.email = messages.typeValidEmail;
  }

  if (requirePassword && !form.password) {
    errors.password = messages.definePassword;
  } else if (form.password && form.password.length < 8) {
    errors.password = messages.minPassword;
  } else if (
    form.password &&
    !/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,128}$/.test(
      form.password,
    )
  ) {
    errors.password = messages.strongPassword;
  }

  if (!roles.includes(form.role)) {
    errors.role = messages.selectValidRole;
  }

  return errors;
}

export function validateCampaignForm(
  locale: Locale,
  form: CampaignFormState,
  editingCampaignId?: string | null,
) {
  const errors: FormErrors<CampaignFormState> = {};
  const budgetValue = Number(form.budget);
  const today = getTodayInputValue();
  const messages = copy[locale];

  if (!form.name.trim()) {
    errors.name = messages.enterCampaignName;
  } else if (form.name.trim().length < 3) {
    errors.name = messages.minName;
  }

  if (!form.budget.trim()) {
    errors.budget = messages.enterCampaignBudget;
  } else if (!Number.isFinite(budgetValue) || budgetValue <= 0) {
    errors.budget = messages.budgetPositive;
  }

  if (!form.startDate) {
    errors.startDate = messages.enterStartDate;
  } else if (!editingCampaignId && form.startDate < today) {
    errors.startDate = messages.startDatePast;
  }

  if (form.endDate) {
    if (!editingCampaignId && form.endDate < today) {
      errors.endDate = messages.endDatePast;
    } else if (form.startDate && form.endDate < form.startDate) {
      errors.endDate = messages.endDateAfterStart;
    }
  }

  if (!campaignStatuses.includes(form.status)) {
    errors.status = messages.selectValidStatus;
  }

  return errors;
}
