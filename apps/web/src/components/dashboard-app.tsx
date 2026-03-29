'use client';

import { useDeferredValue, useEffect, useEffectEvent, useState } from 'react';
import { buildAuthenticatedUser } from '../lib/dashboard/auth';
import {
  getApiUrl,
  parseApiError,
  parseJsonResponse,
} from '../lib/dashboard/api';
import { copy } from '../lib/dashboard/copy';
import {
  LEGACY_TOKEN_STORAGE_KEY,
  LEGACY_USER_STORAGE_KEY,
  LOCALE_STORAGE_KEY,
  THEME_STORAGE_KEY,
  campaignStatuses,
  locales,
  roles,
  themes,
} from '../lib/dashboard/constants';
import {
  formatCampaignStatus,
  formatCurrency,
  formatDate,
  formatRole,
  getCampaignCountLabel,
  getTodayInputValue,
  toDateInputValue,
  toLocalDateISOString,
} from '../lib/dashboard/formatters';
import type {
  ApiErrorResponse,
  AuthResponse,
  AuthSession,
  AuthUser,
  Campaign,
  CampaignFormState,
  CampaignStatus,
  FeedbackState,
  FormErrors,
  Locale,
  LoginFormState,
  ManagedUser,
  Role,
  Theme,
  UserManagementFormState,
  UserProvisionFormState,
} from '../lib/dashboard/types';
import {
  validateCampaignForm,
  validateLoginForm,
  validateManagedUserForm,
  validateProvisionForm,
} from '../lib/dashboard/validation';
import styles from './dashboard-app.module.css';

const initialLoginForm: LoginFormState = {
  email: '',
  password: '',
};

const initialUserProvisionForm: UserProvisionFormState = {
  email: '',
  name: '',
  password: '',
  role: 'USER',
};

const initialUserManagementForm: UserManagementFormState = {
  email: '',
  name: '',
  password: '',
  role: 'USER',
};

const initialCampaignForm: CampaignFormState = {
  budget: '',
  description: '',
  endDate: '',
  name: '',
  startDate: '',
  status: 'DRAFT',
};

function getFeedbackClassName(feedback: FeedbackState | null) {
  if (!feedback) {
    return '';
  }

  switch (feedback.tone) {
    case 'success':
      return `${styles.feedback} ${styles.feedbackSuccess}`;
    case 'error':
      return `${styles.feedback} ${styles.feedbackError}`;
    case 'info':
    default:
      return `${styles.feedback} ${styles.feedbackInfo}`;
  }
}

function renderFieldMessage(error?: string, hint?: string) {
  if (error) {
    return <small className={styles.fieldError}>{error}</small>;
  }

  if (hint) {
    return <small className={styles.fieldHint}>{hint}</small>;
  }

  return <small className={styles.fieldSpacer} aria-hidden="true" />;
}

function renderDismissibleFeedback(
  locale: Locale,
  feedback: FeedbackState | null,
  onClose: () => void,
) {
  if (!feedback) {
    return null;
  }

  return (
    <div className={getFeedbackClassName(feedback)}>
      <span>{feedback.message}</span>
      <button
        aria-label={copy[locale].dismissMessage}
        className={styles.feedbackClose}
        onClick={onClose}
        type="button"
      >
        {copy[locale].dismiss}
      </button>
    </div>
  );
}

function CollapseIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="18"
      viewBox="0 0 20 20"
      width="18"
    >
      <path
        d={expanded ? 'M5 12l5-5 5 5' : 'M5 8l5 5 5-5'}
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="18"
      viewBox="0 0 20 20"
      width="18"
    >
      <path
        d="M8 4H5.75A1.75 1.75 0 004 5.75v8.5C4 15.216 4.784 16 5.75 16H8"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
      <path
        d="M11 6l4 4-4 4"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
      <path
        d="M15 10H8"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
    </svg>
  );
}

export function DashboardApp() {
  const [locale, setLocale] = useState<Locale>('pt-BR');
  const [theme, setTheme] = useState<Theme>('dark');
  const [authFeedback, setAuthFeedback] = useState<FeedbackState | null>(null);
  const [campaignFeedback, setCampaignFeedback] =
    useState<FeedbackState | null>(null);
  const [campaignForm, setCampaignForm] =
    useState<CampaignFormState>(initialCampaignForm);
  const [campaignErrors, setCampaignErrors] = useState<
    FormErrors<CampaignFormState>
  >({});
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [editingCampaignId, setEditingCampaignId] = useState<string | null>(
    null,
  );
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [isAuthPanelOpen, setIsAuthPanelOpen] = useState(true);
  const [isCampaignLoading, setIsCampaignLoading] = useState(false);
  const [isCampaignModalOpen, setIsCampaignModalOpen] = useState(false);
  const [isCampaignPanelOpen, setIsCampaignPanelOpen] = useState(true);
  const [isEditingUser, setIsEditingUser] = useState(false);
  const [isProvisionModalOpen, setIsProvisionModalOpen] = useState(false);
  const [isProvisioningUser, setIsProvisioningUser] = useState(false);
  const [isSessionLoading, setIsSessionLoading] = useState(true);
  const [isSyncingCampaigns, setIsSyncingCampaigns] = useState(false);
  const [isUsersLoading, setIsUsersLoading] = useState(false);
  const [isUsersModalOpen, setIsUsersModalOpen] = useState(false);
  const [loginErrors, setLoginErrors] = useState<FormErrors<LoginFormState>>(
    {},
  );
  const [loginForm, setLoginForm] = useState<LoginFormState>(initialLoginForm);
  const [provisionErrors, setProvisionErrors] = useState<
    FormErrors<UserProvisionFormState>
  >({});
  const [provisionForm, setProvisionForm] = useState<UserProvisionFormState>(
    initialUserProvisionForm,
  );
  const [managedUserErrors, setManagedUserErrors] = useState<
    FormErrors<UserManagementFormState>
  >({});
  const [managedUserForm, setManagedUserForm] =
    useState<UserManagementFormState>(initialUserManagementForm);
  const [managedUsers, setManagedUsers] = useState<ManagedUser[]>([]);
  const [editingManagedUserId, setEditingManagedUserId] = useState<
    string | null
  >(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<'ALL' | CampaignStatus>(
    'ALL',
  );
  const [session, setSession] = useState<AuthSession | null>(null);
  const [usersFeedback, setUsersFeedback] = useState<FeedbackState | null>(
    null,
  );
  const [user, setUser] = useState<AuthUser | null>(null);

  const messages = copy[locale];
  const deferredSearchTerm = useDeferredValue(searchTerm);
  const todayInputValue = getTodayInputValue();
  const showAuthPanel = user ? isAuthPanelOpen : true;
  const showCampaignPanel = user ? isCampaignPanelOpen : true;

  const campaignDistribution = campaignStatuses.map((status) => ({
    count: campaigns.filter((campaign) => campaign.status === status).length,
    status,
  }));

  function clearLegacySessionStorage() {
    localStorage.removeItem(LEGACY_TOKEN_STORAGE_KEY);
    localStorage.removeItem(LEGACY_USER_STORAGE_KEY);
  }

  function persistTheme(nextTheme: Theme) {
    localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    setTheme(nextTheme);
  }

  function persistLocale(nextLocale: Locale) {
    localStorage.setItem(LOCALE_STORAGE_KEY, nextLocale);
    setLocale(nextLocale);
  }

  function resetCampaignDraft() {
    setEditingCampaignId(null);
    setCampaignForm(initialCampaignForm);
    setCampaignErrors({});
  }

  function resetManagedUserDraft() {
    setEditingManagedUserId(null);
    setManagedUserForm(initialUserManagementForm);
    setManagedUserErrors({});
  }

  function closeProvisionModal() {
    setIsProvisionModalOpen(false);
    setProvisionForm(initialUserProvisionForm);
    setProvisionErrors({});
    setAuthFeedback(null);
  }

  function closeUsersModal() {
    setIsUsersModalOpen(false);
    setUsersFeedback(null);
    resetManagedUserDraft();
  }

  function closeCampaignModal() {
    setIsCampaignModalOpen(false);
    resetCampaignDraft();
    setCampaignFeedback(null);
  }

  function clearSession() {
    clearLegacySessionStorage();
    setSession(null);
    setUser(null);
    setCampaigns([]);
    setSearchTerm('');
    setSelectedStatus('ALL');
    setLoginForm(initialLoginForm);
    setLoginErrors({});
    setAuthFeedback(null);
    setCampaignFeedback(null);
    closeUsersModal();
    closeProvisionModal();
    closeCampaignModal();
  }

  function handleSessionInvalid(message: string = messages.sessionInvalid) {
    clearSession();
    setAuthFeedback({
      message,
      tone: 'error',
    });
    setIsAuthPanelOpen(true);
  }

  function applyAuthSession(response: AuthResponse) {
    const nextSession: AuthSession = {
      accessToken: response.accessToken,
    };
    const nextUser = buildAuthenticatedUser(response.user, locale);

    setSession(nextSession);
    setUser(nextUser);

    return {
      session: nextSession,
      user: nextUser,
    };
  }

  async function refreshSession() {
    const apiUrl = getApiUrl(messages);
    const response = await fetch(`${apiUrl}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    });
    const data = await parseJsonResponse<AuthResponse | ApiErrorResponse>(
      response,
    );

    if (!response.ok || !data || !('accessToken' in data)) {
      throw new Error(parseApiError(data ?? null, messages.sessionExpired));
    }

    return applyAuthSession(data);
  }

  async function logoutSession() {
    try {
      const apiUrl = getApiUrl(messages);

      await fetch(`${apiUrl}/auth/logout`, {
        method: 'POST',
        credentials: 'include',
      });
    } catch {
      // The client state is the source of truth for the current screen.
    }
  }

  async function runAuthenticatedRequest(
    input: string,
    init?: RequestInit,
    activeSession?: AuthSession | null,
  ) {
    const currentSession = activeSession ?? session;

    if (!currentSession) {
      throw new Error(messages.sessionInvalid);
    }

    const execute = (accessToken: string) => {
      const headers = new Headers(init?.headers);
      headers.set('Authorization', `Bearer ${accessToken}`);

      return fetch(input, {
        ...init,
        credentials: 'include',
        headers,
      });
    };

    const response = await execute(currentSession.accessToken);

    if (response.status !== 401) {
      return response;
    }

    const refreshed = await refreshSession();

    const retriedResponse = await execute(refreshed.session.accessToken);

    if (retriedResponse.status === 401) {
      handleSessionInvalid(messages.sessionExpired);
      throw new Error(messages.sessionInvalid);
    }

    return retriedResponse;
  }

  async function loadCampaigns(activeSession?: AuthSession | null) {
    setIsSyncingCampaigns(true);

    try {
      const apiUrl = getApiUrl(messages);
      const response = await runAuthenticatedRequest(
        `${apiUrl}/campaigns`,
        undefined,
        activeSession,
      );
      const data = await parseJsonResponse<Campaign[] | ApiErrorResponse>(
        response,
      );

      if (!response.ok || !Array.isArray(data)) {
        throw new Error(
          parseApiError(data ?? null, messages.loadCampaignsFailure),
        );
      }

      setCampaigns(data);
      setCampaignFeedback((current) =>
        current?.tone === 'error' ? null : current,
      );
    } catch (error) {
      if (error instanceof Error && error.message === messages.sessionInvalid) {
        handleSessionInvalid();
        return;
      }

      setCampaignFeedback({
        message:
          error instanceof Error ? error.message : messages.loadCampaignsFailed,
        tone: 'error',
      });
    } finally {
      setIsSyncingCampaigns(false);
    }
  }

  async function loadUsers(activeSession?: AuthSession | null) {
    setIsUsersLoading(true);

    try {
      const apiUrl = getApiUrl(messages);
      const response = await runAuthenticatedRequest(
        `${apiUrl}/users`,
        undefined,
        activeSession,
      );
      const data = await parseJsonResponse<ManagedUser[] | ApiErrorResponse>(
        response,
      );

      if (!response.ok || !Array.isArray(data)) {
        throw new Error(parseApiError(data ?? null, messages.loadUsersFailure));
      }

      setManagedUsers(data);
      setUsersFeedback((current) =>
        current?.tone === 'error' ? null : current,
      );
    } catch (error) {
      if (error instanceof Error && error.message === messages.sessionInvalid) {
        handleSessionInvalid();
        return;
      }

      setUsersFeedback({
        message:
          error instanceof Error ? error.message : messages.loadUsersFailed,
        tone: 'error',
      });
    } finally {
      setIsUsersLoading(false);
    }
  }

  const restoreSession = useEffectEvent(async () => {
    clearLegacySessionStorage();

    try {
      const refreshed = await refreshSession();
      await loadCampaigns(refreshed.session);
    } catch (error) {
      clearSession();
      setAuthFeedback({
        message:
          error instanceof Error ? error.message : messages.sessionExpiredLogin,
        tone: 'info',
      });
      setIsAuthPanelOpen(true);
    } finally {
      setIsSessionLoading(false);
    }
  });

  useEffect(() => {
    void restoreSession();
  }, []);

  useEffect(() => {
    const storedLocale = localStorage.getItem(LOCALE_STORAGE_KEY);
    const storedTheme = localStorage.getItem(THEME_STORAGE_KEY);

    if (storedLocale && locales.includes(storedLocale as Locale)) {
      setLocale(storedLocale as Locale);
    }

    if (storedTheme && themes.includes(storedTheme as Theme)) {
      setTheme(storedTheme as Theme);
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    if (!authFeedback) {
      return;
    }

    const timeoutId = window.setTimeout(
      () => setAuthFeedback(null),
      authFeedback.tone === 'error' ? 7000 : 4500,
    );

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [authFeedback]);

  useEffect(() => {
    if (!campaignFeedback) {
      return;
    }

    const timeoutId = window.setTimeout(
      () => setCampaignFeedback(null),
      campaignFeedback.tone === 'error' ? 7000 : 4500,
    );

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [campaignFeedback]);

  useEffect(() => {
    if (!usersFeedback) {
      return;
    }

    const timeoutId = window.setTimeout(
      () => setUsersFeedback(null),
      usersFeedback.tone === 'error' ? 7000 : 4500,
    );

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [usersFeedback]);

  useEffect(() => {
    if (!isProvisionModalOpen && !isCampaignModalOpen && !isUsersModalOpen) {
      return;
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') {
        return;
      }

      if (isCampaignModalOpen) {
        setIsCampaignModalOpen(false);
        resetCampaignDraft();
        return;
      }

      if (isUsersModalOpen) {
        setIsUsersModalOpen(false);
        setUsersFeedback(null);
        resetManagedUserDraft();
        return;
      }

      if (isProvisionModalOpen) {
        setIsProvisionModalOpen(false);
        setProvisionForm(initialUserProvisionForm);
        setProvisionErrors({});
      }
    };

    window.addEventListener('keydown', handleEscape);

    return () => {
      window.removeEventListener('keydown', handleEscape);
    };
  }, [isCampaignModalOpen, isProvisionModalOpen, isUsersModalOpen]);

  const normalizedSearch = deferredSearchTerm.trim().toLowerCase();
  const filteredCampaigns = campaigns.filter((campaign) => {
    const matchesStatus =
      selectedStatus === 'ALL' ? true : campaign.status === selectedStatus;
    const matchesSearch =
      normalizedSearch.length === 0
        ? true
        : `${campaign.name} ${campaign.owner.name} ${campaign.owner.email} ${campaign.description ?? ''}`
            .toLowerCase()
            .includes(normalizedSearch);

    return matchesStatus && matchesSearch;
  });

  async function handleLoginSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextErrors = validateLoginForm(locale, loginForm);
    setLoginErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      setAuthFeedback({
        message: messages.authReviewFields,
        tone: 'error',
      });
      return;
    }

    setIsAuthLoading(true);
    setAuthFeedback(null);

    try {
      const apiUrl = getApiUrl(messages);
      const response = await fetch(`${apiUrl}/auth/login`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(loginForm),
      });
      const data = await parseJsonResponse<AuthResponse | ApiErrorResponse>(
        response,
      );

      if (!response.ok || !data || !('accessToken' in data)) {
        throw new Error(parseApiError(data ?? null, messages.authFailure));
      }

      const nextSession = applyAuthSession(data);

      setLoginForm(initialLoginForm);
      await loadCampaigns(nextSession.session);
      setAuthFeedback({
        message: messages.loginSuccess,
        tone: 'success',
      });
      setIsCampaignPanelOpen(true);
    } catch (error) {
      setAuthFeedback({
        message: error instanceof Error ? error.message : messages.authFailed,
        tone: 'error',
      });
    } finally {
      setIsAuthLoading(false);
    }
  }

  async function handleProvisionUserSubmit(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    const nextErrors = validateProvisionForm(locale, provisionForm);
    setProvisionErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      setAuthFeedback({
        message: messages.reviewProvisionFields,
        tone: 'error',
      });
      return;
    }

    setIsProvisioningUser(true);
    setAuthFeedback(null);

    try {
      const apiUrl = getApiUrl(messages);
      const response = await runAuthenticatedRequest(`${apiUrl}/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(provisionForm),
      });
      const data = await parseJsonResponse<ManagedUser | ApiErrorResponse>(
        response,
      );

      if (!response.ok || !data || !('role' in data)) {
        throw new Error(parseApiError(data ?? null, messages.provisionFailure));
      }

      closeProvisionModal();
      setAuthFeedback({
        message: messages.createdUserMessage(
          data.name,
          formatRole(locale, data.role),
        ),
        tone: 'success',
      });
    } catch (error) {
      if (error instanceof Error && error.message === messages.sessionInvalid) {
        handleSessionInvalid();
        return;
      }

      setAuthFeedback({
        message:
          error instanceof Error ? error.message : messages.provisionFailed,
        tone: 'error',
      });
    } finally {
      setIsProvisioningUser(false);
    }
  }

  function openProvisionModal() {
    closeUsersModal();
    setProvisionForm(initialUserProvisionForm);
    setProvisionErrors({});
    setAuthFeedback(null);
    setIsProvisionModalOpen(true);
    setIsAuthPanelOpen(true);
  }

  function openUsersModal() {
    closeProvisionModal();
    setUsersFeedback(null);
    setIsUsersModalOpen(true);
    setIsAuthPanelOpen(true);
    void loadUsers();
  }

  function startManagedUserEdit(selectedUser: ManagedUser) {
    setEditingManagedUserId(selectedUser.id);
    setManagedUserForm({
      email: selectedUser.email,
      name: selectedUser.name,
      password: '',
      role: selectedUser.role,
    });
    setManagedUserErrors({});
    setUsersFeedback(null);
  }

  async function handleManagedUserSubmit(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (!editingManagedUserId) {
      return;
    }

    const nextErrors = validateManagedUserForm(locale, managedUserForm, false);
    setManagedUserErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      setUsersFeedback({
        message: messages.reviewUserFields,
        tone: 'error',
      });
      return;
    }

    setIsEditingUser(true);
    setUsersFeedback(null);

    try {
      const apiUrl = getApiUrl(messages);
      const payload = {
        name: managedUserForm.name.trim(),
        email: managedUserForm.email.trim(),
        role: managedUserForm.role,
        ...(managedUserForm.password
          ? { password: managedUserForm.password }
          : {}),
      };
      const response = await runAuthenticatedRequest(
        `${apiUrl}/users/${editingManagedUserId}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        },
      );
      const data = await parseJsonResponse<ManagedUser | ApiErrorResponse>(
        response,
      );

      if (!response.ok || !data || !('role' in data)) {
        throw new Error(parseApiError(data ?? null, messages.saveUserFailure));
      }

      await loadUsers();
      resetManagedUserDraft();
      setUsersFeedback({
        message: messages.userUpdated,
        tone: 'success',
      });
    } catch (error) {
      if (error instanceof Error && error.message === messages.sessionInvalid) {
        handleSessionInvalid();
        return;
      }

      setUsersFeedback({
        message:
          error instanceof Error ? error.message : messages.saveUserFailed,
        tone: 'error',
      });
    } finally {
      setIsEditingUser(false);
    }
  }

  async function handleDeleteManagedUser(selectedUser: ManagedUser) {
    if (!window.confirm(messages.confirmDeleteUser(selectedUser.name))) {
      return;
    }

    setIsUsersLoading(true);
    setUsersFeedback(null);

    try {
      const apiUrl = getApiUrl(messages);
      const response = await runAuthenticatedRequest(
        `${apiUrl}/users/${selectedUser.id}`,
        {
          method: 'DELETE',
        },
      );
      const data = await parseJsonResponse<ApiErrorResponse>(response);

      if (!response.ok) {
        throw new Error(
          parseApiError(data ?? null, messages.removeUserFailure),
        );
      }

      if (editingManagedUserId === selectedUser.id) {
        resetManagedUserDraft();
      }

      await loadUsers();
      setUsersFeedback({
        message: messages.userRemoved,
        tone: 'success',
      });
    } catch (error) {
      if (error instanceof Error && error.message === messages.sessionInvalid) {
        handleSessionInvalid();
        return;
      }

      setUsersFeedback({
        message:
          error instanceof Error ? error.message : messages.removeUserFailed,
        tone: 'error',
      });
    } finally {
      setIsUsersLoading(false);
    }
  }

  function openCreateCampaignModal() {
    setCampaignFeedback(null);
    resetCampaignDraft();
    setIsCampaignModalOpen(true);
    setIsCampaignPanelOpen(true);
  }

  function handleEditCampaign(campaign: Campaign) {
    setEditingCampaignId(campaign.id);
    setCampaignErrors({});
    setCampaignForm({
      name: campaign.name,
      description: campaign.description ?? '',
      status: campaign.status,
      budget: campaign.budget,
      startDate: toDateInputValue(campaign.startDate),
      endDate: toDateInputValue(campaign.endDate),
    });
    setCampaignFeedback(null);
    setIsCampaignModalOpen(true);
    setIsCampaignPanelOpen(true);
  }

  async function handleCampaignSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextErrors = validateCampaignForm(
      locale,
      campaignForm,
      editingCampaignId,
    );
    setCampaignErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      setCampaignFeedback({
        message: messages.reviewCampaignFields,
        tone: 'error',
      });
      return;
    }

    setIsCampaignLoading(true);
    setCampaignFeedback(null);

    try {
      const apiUrl = getApiUrl(messages);
      const payload = {
        name: campaignForm.name.trim(),
        description: campaignForm.description.trim(),
        status: campaignForm.status,
        budget: Number(campaignForm.budget),
        startDate: toLocalDateISOString(campaignForm.startDate),
        endDate: editingCampaignId
          ? campaignForm.endDate
            ? toLocalDateISOString(campaignForm.endDate)
            : null
          : campaignForm.endDate
            ? toLocalDateISOString(campaignForm.endDate)
            : undefined,
      };

      const response = await runAuthenticatedRequest(
        editingCampaignId
          ? `${apiUrl}/campaigns/${editingCampaignId}`
          : `${apiUrl}/campaigns`,
        {
          method: editingCampaignId ? 'PATCH' : 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        },
      );
      const data = await parseJsonResponse<Campaign | ApiErrorResponse>(
        response,
      );

      if (!response.ok) {
        throw new Error(
          parseApiError(data ?? null, messages.saveCampaignFailure),
        );
      }

      await loadCampaigns();
      closeCampaignModal();
      setCampaignFeedback({
        message: editingCampaignId
          ? messages.campaignUpdated
          : messages.campaignCreated,
        tone: 'success',
      });
    } catch (error) {
      if (error instanceof Error && error.message === messages.sessionInvalid) {
        handleSessionInvalid();
        return;
      }

      setCampaignFeedback({
        message:
          error instanceof Error ? error.message : messages.saveCampaignFailed,
        tone: 'error',
      });
    } finally {
      setIsCampaignLoading(false);
    }
  }

  async function handleDeleteCampaign(campaignId: string) {
    setIsCampaignLoading(true);
    setCampaignFeedback(null);

    try {
      const apiUrl = getApiUrl(messages);
      const response = await runAuthenticatedRequest(
        `${apiUrl}/campaigns/${campaignId}`,
        {
          method: 'DELETE',
        },
      );
      const data = await parseJsonResponse<ApiErrorResponse>(response);

      if (!response.ok) {
        throw new Error(
          parseApiError(data ?? null, messages.removeCampaignFailure),
        );
      }

      if (editingCampaignId === campaignId) {
        closeCampaignModal();
      }

      await loadCampaigns();
      setCampaignFeedback({
        message: messages.campaignRemoved,
        tone: 'success',
      });
    } catch (error) {
      if (error instanceof Error && error.message === messages.sessionInvalid) {
        handleSessionInvalid();
        return;
      }

      setCampaignFeedback({
        message:
          error instanceof Error
            ? error.message
            : messages.removeCampaignFailed,
        tone: 'error',
      });
    } finally {
      setIsCampaignLoading(false);
    }
  }

  return (
    <main className={styles.shell}>
      <section className={`${styles.hero} ${!user ? styles.heroSingle : ''}`}>
        <div className={styles.heroCopy}>
          <div className={styles.heroTopBar}>
            <span className={styles.eyebrow}>{messages.appName}</span>
            <div className={styles.preferenceStack}>
              <div
                className={styles.preferenceGroup}
                aria-label={messages.localeLabel}
                role="group"
              >
                <button
                  className={`${styles.preferenceButton} ${
                    locale === 'pt-BR' ? styles.preferenceButtonActive : ''
                  }`}
                  onClick={() => persistLocale('pt-BR')}
                  type="button"
                >
                  {messages.languagePortuguese}
                </button>
                <button
                  className={`${styles.preferenceButton} ${
                    locale === 'en-US' ? styles.preferenceButtonActive : ''
                  }`}
                  onClick={() => persistLocale('en-US')}
                  type="button"
                >
                  {messages.languageEnglish}
                </button>
              </div>
              <div
                className={styles.preferenceGroup}
                aria-label={messages.themeLabel}
                role="group"
              >
                <button
                  className={`${styles.preferenceButton} ${
                    theme === 'dark' ? styles.preferenceButtonActive : ''
                  }`}
                  onClick={() => persistTheme('dark')}
                  type="button"
                >
                  {messages.themeDark}
                </button>
                <button
                  className={`${styles.preferenceButton} ${
                    theme === 'light' ? styles.preferenceButtonActive : ''
                  }`}
                  onClick={() => persistTheme('light')}
                  type="button"
                >
                  {messages.themeLight}
                </button>
              </div>
            </div>
          </div>
          <h1>{messages.heroTitle}</h1>
          <p>{messages.heroDescription}</p>
          {user ? (
            <div className={styles.heroMetrics}>
              <article>
                <strong>{campaigns.length}</strong>
                <span>{messages.campaignsLoaded}</span>
              </article>
              <article>
                <strong>{formatRole(locale, user.role)}</strong>
                <span>{messages.currentProfile}</span>
              </article>
              <article>
                <strong>
                  {isSyncingCampaigns
                    ? messages.syncing
                    : messages.activeOperation}
                </strong>
                <span>{messages.panelStatus}</span>
              </article>
            </div>
          ) : null}
        </div>

        {user ? (
          <div className={styles.heroCard}>
            <div className={styles.heroCardHeader}>
              <span className={styles.sectionLabel}>
                {messages.portfolioView}
              </span>
              <span className={styles.syncFlag}>
                {isSyncingCampaigns
                  ? messages.updatingData
                  : messages.consolidatedData}
              </span>
            </div>
            <div className={styles.distributionList}>
              {campaignDistribution.map((item) => (
                <article key={item.status} className={styles.distributionItem}>
                  <div>
                    <strong>{formatCampaignStatus(locale, item.status)}</strong>
                    <span>
                      {item.count} {messages.campaignsLoaded}
                    </span>
                  </div>
                  <b>{item.count.toString().padStart(2, '0')}</b>
                </article>
              ))}
            </div>
          </div>
        ) : null}
      </section>

      <section className={styles.workspace}>
        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <span className={styles.sectionLabel}>
                {messages.authentication}
              </span>
              <h2>{user ? messages.accessAndUsers : messages.signInTitle}</h2>
              <p className={styles.panelLead}>
                {user
                  ? messages.connectedAs(user.name)
                  : messages.useExistingAccount}
              </p>
            </div>
            <div className={styles.panelHeaderActions}>
              {user?.role === 'ADMIN' ? (
                <>
                  <button
                    className={styles.primaryButton}
                    onClick={openProvisionModal}
                    type="button"
                  >
                    {messages.newAccess}
                  </button>
                  <button
                    className={styles.secondaryButton}
                    onClick={openUsersModal}
                    type="button"
                  >
                    {messages.manageUsers}
                  </button>
                </>
              ) : null}
              {user ? (
                <button
                  aria-label={messages.signOut}
                  className={styles.iconButton}
                  onClick={() => {
                    void logoutSession();
                    clearSession();
                    setAuthFeedback({
                      message: messages.loggedOut,
                      tone: 'info',
                    });
                  }}
                  title={messages.signOut}
                  type="button"
                >
                  <LogoutIcon />
                </button>
              ) : null}
              {user ? (
                <button
                  aria-expanded={isAuthPanelOpen}
                  aria-label={
                    isAuthPanelOpen
                      ? messages.collapseAuth
                      : messages.expandAuth
                  }
                  className={styles.iconButton}
                  onClick={() => setIsAuthPanelOpen((current) => !current)}
                  title={
                    isAuthPanelOpen
                      ? messages.collapseAuth
                      : messages.expandAuth
                  }
                  type="button"
                >
                  <CollapseIcon expanded={isAuthPanelOpen} />
                </button>
              ) : null}
            </div>
          </div>

          {showAuthPanel ? (
            <div className={styles.panelBody}>
              {!isProvisionModalOpen
                ? renderDismissibleFeedback(locale, authFeedback, () =>
                    setAuthFeedback(null),
                  )
                : null}

              {isSessionLoading ? (
                <p className={styles.mutedBox}>{messages.restoringSession}</p>
              ) : !user ? (
                <form
                  className={styles.form}
                  noValidate
                  onSubmit={handleLoginSubmit}
                >
                  <label className={styles.field}>
                    <span>{messages.email}</span>
                    <input
                      aria-invalid={Boolean(loginErrors.email)}
                      onChange={(event) => {
                        setLoginForm((current) => ({
                          ...current,
                          email: event.target.value,
                        }));
                        setLoginErrors((current) => {
                          const next = { ...current };
                          delete next.email;
                          return next;
                        });
                        setAuthFeedback(null);
                      }}
                      placeholder={messages.loginEmailPlaceholder}
                      type="email"
                      value={loginForm.email}
                    />
                    {renderFieldMessage(loginErrors.email)}
                  </label>

                  <label className={styles.field}>
                    <span>{messages.password}</span>
                    <input
                      aria-invalid={Boolean(loginErrors.password)}
                      onChange={(event) => {
                        setLoginForm((current) => ({
                          ...current,
                          password: event.target.value,
                        }));
                        setLoginErrors((current) => {
                          const next = { ...current };
                          delete next.password;
                          return next;
                        });
                        setAuthFeedback(null);
                      }}
                      placeholder={messages.loginPasswordPlaceholder}
                      type="password"
                      value={loginForm.password}
                    />
                    {renderFieldMessage(loginErrors.password)}
                  </label>

                  <button
                    className={styles.primaryButton}
                    disabled={isAuthLoading}
                    type="submit"
                  >
                    {isAuthLoading ? messages.signingIn : messages.signIn}
                  </button>
                </form>
              ) : (
                <div className={styles.accountCard}>
                  <div>
                    <strong>{user.name}</strong>
                    <span>{formatRole(locale, user.role)}</span>
                  </div>
                  <p>
                    {user.role === 'ADMIN'
                      ? messages.accountAdminDescription
                      : messages.accountManagerDescription}
                  </p>
                </div>
              )}
            </div>
          ) : null}
        </div>

        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <div>
              <span className={styles.sectionLabel}>{messages.campaigns}</span>
              <h2>{messages.operationalPanel}</h2>
              <p className={styles.panelLead}>{messages.campaignPanelLead}</p>
            </div>
            <div className={styles.panelHeaderActions}>
              {user ? (
                <span className={styles.syncFlag}>
                  {isSyncingCampaigns
                    ? messages.updatingData
                    : messages.updatedData}
                </span>
              ) : null}
              {user ? (
                <button
                  className={styles.primaryButton}
                  onClick={openCreateCampaignModal}
                  type="button"
                >
                  {messages.newCampaign}
                </button>
              ) : null}
              {user ? (
                <button
                  aria-expanded={isCampaignPanelOpen}
                  aria-label={
                    isCampaignPanelOpen
                      ? messages.collapseCampaigns
                      : messages.expandCampaigns
                  }
                  className={styles.iconButton}
                  onClick={() => setIsCampaignPanelOpen((current) => !current)}
                  title={
                    isCampaignPanelOpen
                      ? messages.collapseCampaigns
                      : messages.expandCampaigns
                  }
                  type="button"
                >
                  <CollapseIcon expanded={isCampaignPanelOpen} />
                </button>
              ) : null}
            </div>
          </div>

          {showCampaignPanel ? (
            <div className={styles.panelBody}>
              {!isCampaignModalOpen
                ? renderDismissibleFeedback(locale, campaignFeedback, () =>
                    setCampaignFeedback(null),
                  )
                : null}

              {!user ? (
                <p className={styles.mutedBox}>
                  {messages.loginToViewCampaigns}
                </p>
              ) : (
                <>
                  <div className={styles.toolbar}>
                    <div className={styles.filterGroup}>
                      <label className={styles.filterField}>
                        <span>{messages.search}</span>
                        <input
                          onChange={(event) =>
                            setSearchTerm(event.target.value)
                          }
                          placeholder={messages.searchPlaceholder}
                          value={searchTerm}
                        />
                      </label>

                      <label className={styles.filterField}>
                        <span>{messages.status}</span>
                        <select
                          onChange={(event) =>
                            setSelectedStatus(
                              event.target.value as 'ALL' | CampaignStatus,
                            )
                          }
                          value={selectedStatus}
                        >
                          <option value="ALL">{messages.allStatuses}</option>
                          {campaignStatuses.map((status) => (
                            <option key={status} value={status}>
                              {formatCampaignStatus(locale, status)}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                  </div>

                  <div className={styles.listHeader}>
                    <span>
                      {filteredCampaigns.length}{' '}
                      {getCampaignCountLabel(locale, filteredCampaigns.length)}
                    </span>
                    <span>{messages.globalCampaignView}</span>
                  </div>

                  {filteredCampaigns.length === 0 ? (
                    <div className={styles.emptyState}>
                      {messages.emptyCampaigns}
                    </div>
                  ) : (
                    <div className={styles.cardGrid}>
                      {filteredCampaigns.map((campaign) => (
                        <article
                          className={styles.campaignCard}
                          key={campaign.id}
                        >
                          <div className={styles.cardTop}>
                            <span className={styles.statusPill}>
                              {formatCampaignStatus(locale, campaign.status)}
                            </span>
                            <strong>
                              {formatCurrency(locale, campaign.budget)}
                            </strong>
                          </div>

                          <div className={styles.cardBody}>
                            <h3>{campaign.name}</h3>
                            <p>
                              {campaign.description || messages.noDescription}
                            </p>
                          </div>

                          <dl className={styles.metaGrid}>
                            <div>
                              <dt>{messages.owner}</dt>
                              <dd>{campaign.owner.name}</dd>
                            </div>
                            <div>
                              <dt>{messages.start}</dt>
                              <dd>{formatDate(locale, campaign.startDate)}</dd>
                            </div>
                            <div>
                              <dt>{messages.end}</dt>
                              <dd>{formatDate(locale, campaign.endDate)}</dd>
                            </div>
                          </dl>

                          <div className={styles.actionRow}>
                            <button
                              className={styles.secondaryButton}
                              onClick={() => handleEditCampaign(campaign)}
                              type="button"
                            >
                              {messages.edit}
                            </button>
                            <button
                              className={styles.dangerButton}
                              disabled={isCampaignLoading}
                              onClick={() =>
                                void handleDeleteCampaign(campaign.id)
                              }
                              type="button"
                            >
                              {messages.delete}
                            </button>
                          </div>
                        </article>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          ) : null}
        </div>
      </section>

      {isProvisionModalOpen ? (
        <div
          className={styles.modalBackdrop}
          onClick={closeProvisionModal}
          role="presentation"
        >
          <div
            className={styles.modal}
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="provision-modal-title"
          >
            <div className={styles.modalHeader}>
              <div>
                <span className={styles.sectionLabel}>{messages.users}</span>
                <h3 id="provision-modal-title">{messages.createNewAccess}</h3>
                <p className={styles.panelLead}>{messages.provisionLead}</p>
              </div>
              <button
                className={styles.ghostButton}
                onClick={closeProvisionModal}
                type="button"
              >
                {messages.close}
              </button>
            </div>

            <form
              className={styles.form}
              noValidate
              onSubmit={handleProvisionUserSubmit}
            >
              {renderDismissibleFeedback(locale, authFeedback, () =>
                setAuthFeedback(null),
              )}
              <div className={styles.formGrid}>
                <label className={styles.field}>
                  <span>{messages.name}</span>
                  <input
                    aria-invalid={Boolean(provisionErrors.name)}
                    onChange={(event) => {
                      setProvisionForm((current) => ({
                        ...current,
                        name: event.target.value,
                      }));
                      setProvisionErrors((current) => {
                        const next = { ...current };
                        delete next.name;
                        return next;
                      });
                      setAuthFeedback(null);
                    }}
                    placeholder={messages.fullNamePlaceholder}
                    value={provisionForm.name}
                  />
                  {renderFieldMessage(provisionErrors.name)}
                </label>

                <label className={styles.field}>
                  <span>{messages.role}</span>
                  <select
                    aria-invalid={Boolean(provisionErrors.role)}
                    onChange={(event) => {
                      setProvisionForm((current) => ({
                        ...current,
                        role: event.target.value as Role,
                      }));
                      setProvisionErrors((current) => {
                        const next = { ...current };
                        delete next.role;
                        return next;
                      });
                      setAuthFeedback(null);
                    }}
                    value={provisionForm.role}
                  >
                    {roles.map((role) => (
                      <option key={role} value={role}>
                        {formatRole(locale, role)}
                      </option>
                    ))}
                  </select>
                  {renderFieldMessage(provisionErrors.role)}
                </label>

                <label className={styles.field}>
                  <span>{messages.email}</span>
                  <input
                    aria-invalid={Boolean(provisionErrors.email)}
                    onChange={(event) => {
                      setProvisionForm((current) => ({
                        ...current,
                        email: event.target.value,
                      }));
                      setProvisionErrors((current) => {
                        const next = { ...current };
                        delete next.email;
                        return next;
                      });
                      setAuthFeedback(null);
                    }}
                    placeholder={messages.newUserEmailPlaceholder}
                    type="email"
                    value={provisionForm.email}
                  />
                  {renderFieldMessage(provisionErrors.email)}
                </label>

                <label className={styles.field}>
                  <span>{messages.password}</span>
                  <input
                    aria-invalid={Boolean(provisionErrors.password)}
                    onChange={(event) => {
                      setProvisionForm((current) => ({
                        ...current,
                        password: event.target.value,
                      }));
                      setProvisionErrors((current) => {
                        const next = { ...current };
                        delete next.password;
                        return next;
                      });
                      setAuthFeedback(null);
                    }}
                    placeholder={messages.passwordExample}
                    type="password"
                    value={provisionForm.password}
                  />
                  {renderFieldMessage(
                    provisionErrors.password,
                    messages.passwordHint,
                  )}
                </label>
              </div>

              <div className={styles.actionRow}>
                <button
                  className={styles.primaryButton}
                  disabled={isProvisioningUser}
                  type="submit"
                >
                  {isProvisioningUser ? messages.creating : messages.createUser}
                </button>
                <button
                  className={styles.ghostButton}
                  onClick={closeProvisionModal}
                  type="button"
                >
                  {messages.cancel}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {isUsersModalOpen ? (
        <div
          className={styles.modalBackdrop}
          onClick={closeUsersModal}
          role="presentation"
        >
          <div
            className={styles.modal}
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="users-modal-title"
          >
            <div className={styles.modalHeader}>
              <div>
                <span className={styles.sectionLabel}>{messages.users}</span>
                <h3 id="users-modal-title">{messages.manageUsersTitle}</h3>
                <p className={styles.panelLead}>{messages.manageUsersLead}</p>
              </div>
              <div className={styles.actionRow}>
                <button
                  className={styles.secondaryButton}
                  onClick={openProvisionModal}
                  type="button"
                >
                  {messages.createNewAccess}
                </button>
                <button
                  className={styles.ghostButton}
                  onClick={closeUsersModal}
                  type="button"
                >
                  {messages.close}
                </button>
              </div>
            </div>

            <div className={styles.form}>
              {renderDismissibleFeedback(locale, usersFeedback, () =>
                setUsersFeedback(null),
              )}

              {isUsersLoading ? (
                <p className={styles.mutedBox}>{messages.loadingUsers}</p>
              ) : managedUsers.length === 0 ? (
                <div className={styles.emptyState}>{messages.noUsers}</div>
              ) : (
                <div className={styles.userDirectory}>
                  {managedUsers.map((managedUser) => {
                    const isCurrentSessionUser = managedUser.id === user?.sub;

                    return (
                      <article className={styles.userCard} key={managedUser.id}>
                        <div className={styles.userCardHeader}>
                          <div className={styles.userIdentity}>
                            <strong>{managedUser.name}</strong>
                            <span>{managedUser.email}</span>
                          </div>
                          <span className={styles.statusPill}>
                            {formatRole(locale, managedUser.role)}
                          </span>
                        </div>

                        {isCurrentSessionUser ? (
                          <p className={styles.userNote}>
                            {messages.currentSessionUser}
                          </p>
                        ) : null}

                        <div className={styles.actionRow}>
                          <button
                            className={styles.secondaryButton}
                            disabled={isCurrentSessionUser || isUsersLoading}
                            onClick={() => startManagedUserEdit(managedUser)}
                            type="button"
                          >
                            {messages.editUser}
                          </button>
                          <button
                            className={styles.dangerButton}
                            disabled={isCurrentSessionUser || isUsersLoading}
                            onClick={() =>
                              void handleDeleteManagedUser(managedUser)
                            }
                            type="button"
                          >
                            {messages.delete}
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}

              {editingManagedUserId ? (
                <div className={styles.editorPanel}>
                  <div>
                    <span className={styles.sectionLabel}>
                      {messages.users}
                    </span>
                    <h4 className={styles.editorTitle}>
                      {messages.editUserTitle}
                    </h4>
                    <p className={styles.panelLead}>{messages.editUserLead}</p>
                  </div>

                  <form
                    className={styles.form}
                    noValidate
                    onSubmit={handleManagedUserSubmit}
                  >
                    <div className={styles.formGrid}>
                      <label className={styles.field}>
                        <span>{messages.name}</span>
                        <input
                          aria-invalid={Boolean(managedUserErrors.name)}
                          onChange={(event) => {
                            setManagedUserForm((current) => ({
                              ...current,
                              name: event.target.value,
                            }));
                            setManagedUserErrors((current) => {
                              const next = { ...current };
                              delete next.name;
                              return next;
                            });
                            setUsersFeedback(null);
                          }}
                          value={managedUserForm.name}
                        />
                        {renderFieldMessage(managedUserErrors.name)}
                      </label>

                      <label className={styles.field}>
                        <span>{messages.role}</span>
                        <select
                          aria-invalid={Boolean(managedUserErrors.role)}
                          onChange={(event) => {
                            setManagedUserForm((current) => ({
                              ...current,
                              role: event.target.value as Role,
                            }));
                            setManagedUserErrors((current) => {
                              const next = { ...current };
                              delete next.role;
                              return next;
                            });
                            setUsersFeedback(null);
                          }}
                          value={managedUserForm.role}
                        >
                          {roles.map((role) => (
                            <option key={role} value={role}>
                              {formatRole(locale, role)}
                            </option>
                          ))}
                        </select>
                        {renderFieldMessage(managedUserErrors.role)}
                      </label>

                      <label className={styles.field}>
                        <span>{messages.email}</span>
                        <input
                          aria-invalid={Boolean(managedUserErrors.email)}
                          onChange={(event) => {
                            setManagedUserForm((current) => ({
                              ...current,
                              email: event.target.value,
                            }));
                            setManagedUserErrors((current) => {
                              const next = { ...current };
                              delete next.email;
                              return next;
                            });
                            setUsersFeedback(null);
                          }}
                          type="email"
                          value={managedUserForm.email}
                        />
                        {renderFieldMessage(managedUserErrors.email)}
                      </label>

                      <label className={styles.field}>
                        <span>{messages.password}</span>
                        <input
                          aria-invalid={Boolean(managedUserErrors.password)}
                          onChange={(event) => {
                            setManagedUserForm((current) => ({
                              ...current,
                              password: event.target.value,
                            }));
                            setManagedUserErrors((current) => {
                              const next = { ...current };
                              delete next.password;
                              return next;
                            });
                            setUsersFeedback(null);
                          }}
                          placeholder={messages.passwordExample}
                          type="password"
                          value={managedUserForm.password}
                        />
                        {renderFieldMessage(
                          managedUserErrors.password,
                          messages.leavePasswordBlank,
                        )}
                      </label>
                    </div>

                    <div className={styles.actionRow}>
                      <button
                        className={styles.primaryButton}
                        disabled={isEditingUser}
                        type="submit"
                      >
                        {isEditingUser
                          ? messages.saving
                          : messages.saveUserChanges}
                      </button>
                      <button
                        className={styles.ghostButton}
                        onClick={resetManagedUserDraft}
                        type="button"
                      >
                        {messages.cancel}
                      </button>
                    </div>
                  </form>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {isCampaignModalOpen ? (
        <div
          className={styles.modalBackdrop}
          onClick={closeCampaignModal}
          role="presentation"
        >
          <div
            className={styles.modal}
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="campaign-modal-title"
          >
            <div className={styles.modalHeader}>
              <div>
                <span className={styles.sectionLabel}>
                  {messages.campaigns}
                </span>
                <h3 id="campaign-modal-title">
                  {editingCampaignId
                    ? messages.editCampaignTitle
                    : messages.createCampaignTitle}
                </h3>
                <p className={styles.panelLead}>
                  {editingCampaignId
                    ? messages.editCampaignLead
                    : messages.createCampaignLead}
                </p>
              </div>
              <button
                className={styles.ghostButton}
                onClick={closeCampaignModal}
                type="button"
              >
                {messages.close}
              </button>
            </div>

            <form
              className={styles.form}
              noValidate
              onSubmit={handleCampaignSubmit}
            >
              {renderDismissibleFeedback(locale, campaignFeedback, () =>
                setCampaignFeedback(null),
              )}
              <div className={styles.formGrid}>
                <label className={styles.field}>
                  <span>{messages.campaignName}</span>
                  <input
                    aria-invalid={Boolean(campaignErrors.name)}
                    onChange={(event) => {
                      setCampaignForm((current) => ({
                        ...current,
                        name: event.target.value,
                      }));
                      setCampaignErrors((current) => {
                        const next = { ...current };
                        delete next.name;
                        return next;
                      });
                      setCampaignFeedback(null);
                    }}
                    placeholder={messages.campaignNamePlaceholder}
                    value={campaignForm.name}
                  />
                  {renderFieldMessage(campaignErrors.name)}
                </label>

                <label className={styles.field}>
                  <span>{messages.status}</span>
                  <select
                    aria-invalid={Boolean(campaignErrors.status)}
                    onChange={(event) => {
                      setCampaignForm((current) => ({
                        ...current,
                        status: event.target.value as CampaignStatus,
                      }));
                      setCampaignErrors((current) => {
                        const next = { ...current };
                        delete next.status;
                        return next;
                      });
                      setCampaignFeedback(null);
                    }}
                    value={campaignForm.status}
                  >
                    {campaignStatuses.map((status) => (
                      <option key={status} value={status}>
                        {formatCampaignStatus(locale, status)}
                      </option>
                    ))}
                  </select>
                  {renderFieldMessage(campaignErrors.status)}
                </label>

                <label className={styles.field}>
                  <span>{messages.budget}</span>
                  <input
                    aria-invalid={Boolean(campaignErrors.budget)}
                    onChange={(event) => {
                      setCampaignForm((current) => ({
                        ...current,
                        budget: event.target.value,
                      }));
                      setCampaignErrors((current) => {
                        const next = { ...current };
                        delete next.budget;
                        return next;
                      });
                      setCampaignFeedback(null);
                    }}
                    placeholder="1500.00"
                    step="0.01"
                    type="number"
                    value={campaignForm.budget}
                  />
                  {renderFieldMessage(campaignErrors.budget)}
                </label>

                <label className={styles.field}>
                  <span>{messages.startDate}</span>
                  <input
                    aria-invalid={Boolean(campaignErrors.startDate)}
                    min={todayInputValue}
                    onChange={(event) => {
                      setCampaignForm((current) => ({
                        ...current,
                        startDate: event.target.value,
                      }));
                      setCampaignErrors((current) => {
                        const next = { ...current };
                        delete next.startDate;
                        delete next.endDate;
                        return next;
                      });
                      setCampaignFeedback(null);
                    }}
                    type="date"
                    value={campaignForm.startDate}
                  />
                  {renderFieldMessage(campaignErrors.startDate)}
                </label>

                <label className={styles.field}>
                  <span>{messages.endDate}</span>
                  <input
                    aria-invalid={Boolean(campaignErrors.endDate)}
                    min={
                      campaignForm.startDate &&
                      campaignForm.startDate > todayInputValue
                        ? campaignForm.startDate
                        : todayInputValue
                    }
                    onChange={(event) => {
                      setCampaignForm((current) => ({
                        ...current,
                        endDate: event.target.value,
                      }));
                      setCampaignErrors((current) => {
                        const next = { ...current };
                        delete next.endDate;
                        return next;
                      });
                      setCampaignFeedback(null);
                    }}
                    type="date"
                    value={campaignForm.endDate}
                  />
                  {renderFieldMessage(
                    campaignErrors.endDate,
                    messages.endDateHint,
                  )}
                </label>
              </div>

              <label className={styles.field}>
                <span>{messages.description}</span>
                <textarea
                  onChange={(event) => {
                    setCampaignForm((current) => ({
                      ...current,
                      description: event.target.value,
                    }));
                    setCampaignFeedback(null);
                  }}
                  placeholder={messages.descriptionPlaceholder}
                  value={campaignForm.description}
                />
              </label>

              <div className={styles.actionRow}>
                <button
                  className={styles.primaryButton}
                  disabled={isCampaignLoading}
                  type="submit"
                >
                  {isCampaignLoading
                    ? messages.saving
                    : editingCampaignId
                      ? messages.saveChanges
                      : messages.createCampaign}
                </button>
                <button
                  className={styles.ghostButton}
                  onClick={closeCampaignModal}
                  type="button"
                >
                  {messages.cancel}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </main>
  );
}
