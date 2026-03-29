'use client';

import { useDeferredValue, useEffect, useEffectEvent, useState } from 'react';
import styles from './dashboard-app.module.css';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3333/api';
const SESSION_STORAGE_KEY = 'directcash.session';
const LEGACY_TOKEN_STORAGE_KEY = 'directcash.token';
const LEGACY_USER_STORAGE_KEY = 'directcash.user';
const THEME_STORAGE_KEY = 'directcash.preferences.theme';
const LOCALE_STORAGE_KEY = 'directcash.preferences.locale';
const campaignStatuses = ['DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED'] as const;
const roles = ['ADMIN', 'MANAGER'] as const;
const locales = ['pt-BR', 'en-US'] as const;
const themes = ['dark', 'light'] as const;

type CampaignStatus = (typeof campaignStatuses)[number];
type Role = (typeof roles)[number];
type Locale = (typeof locales)[number];
type Theme = (typeof themes)[number];

type AuthUser = {
  name: string;
  role: Role;
  sub: string;
};

type AuthSession = {
  accessToken: string;
  refreshToken: string;
};

type PersistedSession = AuthSession;

type AuthResponse = {
  accessToken: string;
  refreshToken: string;
};

type ApiErrorResponse = {
  message?: string | string[];
};

type JwtPayload = {
  name?: string;
  role?: Role;
  sub?: string;
};

type Campaign = {
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
    role: string;
  };
};

type LoginFormState = {
  email: string;
  password: string;
};

type UserProvisionFormState = {
  email: string;
  name: string;
  password: string;
  role: Role;
};

type CampaignFormState = {
  budget: string;
  description: string;
  endDate: string;
  name: string;
  startDate: string;
  status: CampaignStatus;
};

type FormErrors<T> = Partial<Record<keyof T, string>>;

type FeedbackTone = 'success' | 'error' | 'info';

type FeedbackState = {
  message: string;
  tone: FeedbackTone;
};

const initialLoginForm: LoginFormState = {
  email: '',
  password: '',
};

const initialUserProvisionForm: UserProvisionFormState = {
  email: '',
  name: '',
  password: '',
  role: 'MANAGER',
};

const initialCampaignForm: CampaignFormState = {
  budget: '',
  description: '',
  endDate: '',
  name: '',
  startDate: '',
  status: 'DRAFT',
};

const copy = {
  'pt-BR': {
    appName: 'DirectCash Studio',
    heroTitle: 'Controle operacional de campanhas.',
    heroDescription:
      'Centralize a operação comercial em um painel com visão de carteira, responsáveis, orçamento e status sincronizados com a API.',
    campaignsLoaded: 'campanhas carregadas',
    currentProfile: 'perfil atual',
    panelStatus: 'status do painel',
    syncing: 'Sincronizando',
    activeOperation: 'Operação ativa',
    portfolioView: 'Visão da carteira',
    updatingData: 'Atualizando dados',
    consolidatedData: 'Dados consolidados',
    authentication: 'Autenticação',
    accessAndUsers: 'Acesso e usuários',
    signInTitle: 'Entrar no sistema',
    useExistingAccount: 'Use um usuário existente para acessar o painel.',
    connectedAs: (name: string) => `Sessão conectada como ${name}.`,
    newAccess: 'Novo acesso',
    signOut: 'Encerrar sessão',
    collapseAuth: 'Recolher autenticação',
    expandAuth: 'Expandir autenticação',
    restoringSession: 'Restaurando sessão...',
    email: 'E-mail',
    password: 'Senha',
    loginEmailPlaceholder: 'admin@directcash.local',
    loginPasswordPlaceholder: 'Digite sua senha',
    signingIn: 'Entrando...',
    signIn: 'Entrar',
    accountAdminDescription:
      'Gerencie acessos e acompanhe todas as campanhas da operação.',
    accountManagerDescription:
      'Acompanhe e opere as campanhas sob sua responsabilidade.',
    campaigns: 'Campanhas',
    operationalPanel: 'Painel operacional',
    campaignPanelLead:
      'Filtros e carteira ativa separados do fluxo de criação e edição.',
    updatedData: 'Dados atualizados',
    newCampaign: 'Nova campanha',
    collapseCampaigns: 'Recolher campanhas',
    expandCampaigns: 'Expandir campanhas',
    loginToViewCampaigns:
      'Faça login para visualizar, filtrar e operar as campanhas.',
    search: 'Busca',
    searchPlaceholder: 'Buscar por nome, responsável, e-mail ou descrição',
    status: 'Status',
    allStatuses: 'Todos os status',
    campaignFound: 'campanha encontrada',
    campaignsFound: 'campanhas encontradas',
    globalCampaignView: 'Visão global de campanhas',
    emptyCampaigns: 'Nenhuma campanha corresponde aos filtros aplicados.',
    noDescription: 'Sem descrição cadastrada.',
    owner: 'Responsável',
    start: 'Início',
    end: 'Fim',
    edit: 'Editar',
    delete: 'Excluir',
    users: 'Usuários',
    createNewAccess: 'Criar novo acesso',
    provisionLead: 'Cadastre perfis internos sem ocupar espaço fixo no painel.',
    close: 'Fechar',
    name: 'Nome',
    role: 'Perfil',
    fullNamePlaceholder: 'Nome completo',
    newUserEmailPlaceholder: 'novo.usuario@directcash.local',
    passwordExample: 'Ex.: Admin@123',
    passwordHint: 'Use pelo menos 8 caracteres com letras, número e símbolo.',
    creating: 'Criando...',
    createUser: 'Criar usuário',
    cancel: 'Cancelar',
    editCampaignTitle: 'Editar campanha',
    createCampaignTitle: 'Nova campanha',
    editCampaignLead:
      'Atualize dados operacionais sem misturar com os filtros do dashboard.',
    createCampaignLead:
      'Cadastre uma campanha em um fluxo dedicado e mais claro.',
    campaignName: 'Nome da campanha',
    campaignNamePlaceholder: 'Campanha de conversão',
    budget: 'Budget',
    startDate: 'Data inicial',
    endDate: 'Data final',
    endDateHint: 'Opcional para campanhas sem data final definida.',
    description: 'Descrição',
    descriptionPlaceholder: 'Contexto, objetivo e observações da campanha',
    saving: 'Salvando...',
    saveChanges: 'Salvar alterações',
    createCampaign: 'Criar campanha',
    dismissMessage: 'Fechar mensagem',
    dismiss: 'Fechar',
    sessionInvalid: 'Sessão inválida. Faça login novamente.',
    invalidApiSession: 'Sessão inválida retornada pela API.',
    sessionExpired: 'Sessão expirada.',
    sessionExpiredLogin: 'Sessão expirada. Faça login novamente.',
    authReviewFields: 'Revise os campos de acesso antes de continuar.',
    authFailure: 'Falha na autenticação.',
    authFailed: 'Falha ao autenticar.',
    loginSuccess: 'Login realizado com sucesso.',
    reviewProvisionFields: 'Revise os dados do novo acesso antes de salvar.',
    provisionFailure: 'Não foi possível criar o usuário.',
    provisionFailed: 'Falha ao criar usuário.',
    createdUserMessage: (name: string, role: string) =>
      `Usuário ${name} criado com perfil ${role}.`,
    reviewCampaignFields: 'Revise os dados da campanha antes de salvar.',
    saveCampaignFailure: 'Não foi possível salvar a campanha.',
    saveCampaignFailed: 'Falha ao salvar campanha.',
    campaignUpdated: 'Campanha atualizada com sucesso.',
    campaignCreated: 'Campanha criada com sucesso.',
    removeCampaignFailure: 'Não foi possível remover a campanha.',
    removeCampaignFailed: 'Falha ao remover campanha.',
    campaignRemoved: 'Campanha removida com sucesso.',
    loadCampaignsFailure: 'Não foi possível carregar as campanhas.',
    loadCampaignsFailed: 'Falha ao carregar campanhas.',
    loggedOut: 'Sessão encerrada.',
    enterAccessEmail: 'Informe o e-mail de acesso.',
    typeValidEmail: 'Digite um e-mail válido.',
    enterPassword: 'Informe a senha.',
    minPassword: 'A senha deve ter pelo menos 8 caracteres.',
    enterFullName: 'Informe o nome completo.',
    minName: 'O nome precisa ter pelo menos 3 caracteres.',
    enterNewAccessEmail: 'Informe o e-mail do novo acesso.',
    definePassword: 'Defina uma senha para o usuário.',
    strongPassword:
      'Use letras maiúsculas, minúsculas, número e caractere especial.',
    selectValidRole: 'Selecione um perfil válido.',
    enterCampaignName: 'Informe o nome da campanha.',
    enterCampaignBudget: 'Informe o budget da campanha.',
    budgetPositive: 'Informe um budget maior que zero.',
    enterStartDate: 'Informe a data inicial.',
    startDatePast: 'A data inicial não pode ser anterior ao dia atual.',
    endDatePast: 'A data final não pode ser anterior ao dia atual.',
    endDateAfterStart:
      'A data final deve ser igual ou posterior à data inicial.',
    selectValidStatus: 'Selecione um status válido.',
    noEndDate: 'Sem data final',
    localeLabel: 'Idioma',
    themeLabel: 'Tema',
    languagePortuguese: 'PT',
    languageEnglish: 'EN',
    themeDark: 'Escuro',
    themeLight: 'Claro',
  },
  'en-US': {
    appName: 'DirectCash Studio',
    heroTitle: 'Operational campaign control.',
    heroDescription:
      'Centralize the commercial operation in one dashboard with portfolio, owners, budget, and status synced with the API.',
    campaignsLoaded: 'campaigns loaded',
    currentProfile: 'current profile',
    panelStatus: 'panel status',
    syncing: 'Syncing',
    activeOperation: 'Operation online',
    portfolioView: 'Portfolio view',
    updatingData: 'Refreshing data',
    consolidatedData: 'Consolidated data',
    authentication: 'Authentication',
    accessAndUsers: 'Access and users',
    signInTitle: 'Sign in',
    useExistingAccount: 'Use an existing account to access the dashboard.',
    connectedAs: (name: string) => `Signed in as ${name}.`,
    newAccess: 'New access',
    signOut: 'Sign out',
    collapseAuth: 'Collapse authentication',
    expandAuth: 'Expand authentication',
    restoringSession: 'Restoring session...',
    email: 'Email',
    password: 'Password',
    loginEmailPlaceholder: 'admin@directcash.local',
    loginPasswordPlaceholder: 'Enter your password',
    signingIn: 'Signing in...',
    signIn: 'Sign in',
    accountAdminDescription:
      'Manage internal access and monitor every campaign in the operation.',
    accountManagerDescription: 'Monitor and operate campaigns assigned to you.',
    campaigns: 'Campaigns',
    operationalPanel: 'Operations panel',
    campaignPanelLead:
      'Filters and active portfolio stay separate from the creation and editing flow.',
    updatedData: 'Data updated',
    newCampaign: 'New campaign',
    collapseCampaigns: 'Collapse campaigns',
    expandCampaigns: 'Expand campaigns',
    loginToViewCampaigns: 'Sign in to view, filter, and operate campaigns.',
    search: 'Search',
    searchPlaceholder: 'Search by name, owner, email, or description',
    status: 'Status',
    allStatuses: 'All statuses',
    campaignFound: 'campaign found',
    campaignsFound: 'campaigns found',
    globalCampaignView: 'Global campaign view',
    emptyCampaigns: 'No campaign matches the active filters.',
    noDescription: 'No description provided.',
    owner: 'Owner',
    start: 'Start',
    end: 'End',
    edit: 'Edit',
    delete: 'Delete',
    users: 'Users',
    createNewAccess: 'Create new access',
    provisionLead:
      'Create internal profiles without occupying fixed dashboard space.',
    close: 'Close',
    name: 'Name',
    role: 'Role',
    fullNamePlaceholder: 'Full name',
    newUserEmailPlaceholder: 'new.user@directcash.local',
    passwordExample: 'Ex.: Admin@123',
    passwordHint:
      'Use at least 8 characters with letters, numbers, and symbols.',
    creating: 'Creating...',
    createUser: 'Create user',
    cancel: 'Cancel',
    editCampaignTitle: 'Edit campaign',
    createCampaignTitle: 'New campaign',
    editCampaignLead:
      'Update operational data without mixing it with dashboard filters.',
    createCampaignLead: 'Register a campaign in a dedicated and clearer flow.',
    campaignName: 'Campaign name',
    campaignNamePlaceholder: 'Conversion campaign',
    budget: 'Budget',
    startDate: 'Start date',
    endDate: 'End date',
    endDateHint: 'Optional for campaigns without a defined end date.',
    description: 'Description',
    descriptionPlaceholder: 'Context, objective, and campaign notes',
    saving: 'Saving...',
    saveChanges: 'Save changes',
    createCampaign: 'Create campaign',
    dismissMessage: 'Dismiss message',
    dismiss: 'Close',
    sessionInvalid: 'Invalid session. Sign in again.',
    invalidApiSession: 'Invalid session returned by the API.',
    sessionExpired: 'Session expired.',
    sessionExpiredLogin: 'Session expired. Sign in again.',
    authReviewFields: 'Review the access fields before continuing.',
    authFailure: 'Authentication failed.',
    authFailed: 'Unable to authenticate.',
    loginSuccess: 'Signed in successfully.',
    reviewProvisionFields: 'Review the new access data before saving.',
    provisionFailure: 'Unable to create the user.',
    provisionFailed: 'User creation failed.',
    createdUserMessage: (name: string, role: string) =>
      `User ${name} created with ${role} access.`,
    reviewCampaignFields: 'Review the campaign data before saving.',
    saveCampaignFailure: 'Unable to save the campaign.',
    saveCampaignFailed: 'Campaign save failed.',
    campaignUpdated: 'Campaign updated successfully.',
    campaignCreated: 'Campaign created successfully.',
    removeCampaignFailure: 'Unable to remove the campaign.',
    removeCampaignFailed: 'Campaign removal failed.',
    campaignRemoved: 'Campaign removed successfully.',
    loadCampaignsFailure: 'Unable to load campaigns.',
    loadCampaignsFailed: 'Failed to load campaigns.',
    loggedOut: 'Session ended.',
    enterAccessEmail: 'Enter the access email.',
    typeValidEmail: 'Enter a valid email.',
    enterPassword: 'Enter the password.',
    minPassword: 'Password must contain at least 8 characters.',
    enterFullName: 'Enter the full name.',
    minName: 'Name must contain at least 3 characters.',
    enterNewAccessEmail: 'Enter the new access email.',
    definePassword: 'Define a password for this user.',
    strongPassword:
      'Use uppercase, lowercase, a number, and a special character.',
    selectValidRole: 'Select a valid role.',
    enterCampaignName: 'Enter the campaign name.',
    enterCampaignBudget: 'Enter the campaign budget.',
    budgetPositive: 'Enter a budget greater than zero.',
    enterStartDate: 'Enter the start date.',
    startDatePast: 'Start date cannot be earlier than today.',
    endDatePast: 'End date cannot be earlier than today.',
    endDateAfterStart: 'End date must be on or after the start date.',
    selectValidStatus: 'Select a valid status.',
    noEndDate: 'No end date',
    localeLabel: 'Language',
    themeLabel: 'Theme',
    languagePortuguese: 'PT',
    languageEnglish: 'EN',
    themeDark: 'Dark',
    themeLight: 'Light',
  },
} as const;

function formatCurrency(locale: Locale, value: number | string) {
  const numericValue = Number(value);

  if (Number.isNaN(numericValue)) {
    return locale === 'pt-BR' ? 'R$ 0,00' : 'R$0.00';
  }

  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'BRL',
  }).format(numericValue);
}

function formatDate(locale: Locale, value: string | null) {
  if (!value) {
    return copy[locale].noEndDate;
  }

  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
  }).format(new Date(value));
}

function formatRole(locale: Locale, role: Role) {
  if (locale === 'en-US') {
    return role === 'ADMIN' ? 'Administrator' : 'Manager';
  }

  return role === 'ADMIN' ? 'Administrador' : 'Gestor';
}

function formatCampaignStatus(locale: Locale, status: CampaignStatus) {
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

function parseApiError(data: unknown, fallback: string) {
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

function decodeJwtPayload(token: string): JwtPayload | null {
  try {
    const payloadSegment = token.split('.')[1];

    if (!payloadSegment) {
      return null;
    }

    const normalizedPayload = payloadSegment
      .replace(/-/g, '+')
      .replace(/_/g, '/');
    const paddedPayload = normalizedPayload.padEnd(
      normalizedPayload.length + ((4 - (normalizedPayload.length % 4)) % 4),
      '=',
    );

    return JSON.parse(atob(paddedPayload)) as JwtPayload;
  } catch {
    return null;
  }
}

function buildAuthenticatedUser(accessToken: string, locale: Locale): AuthUser {
  const payload = decodeJwtPayload(accessToken);

  if (!payload?.sub || !payload?.role || !payload?.name) {
    throw new Error(copy[locale].invalidApiSession);
  }

  return {
    name: payload.name,
    role: payload.role,
    sub: payload.sub,
  };
}

function toDateInputValue(value: string | null) {
  if (!value) {
    return '';
  }

  return new Date(value).toISOString().slice(0, 10);
}

function getTodayInputValue() {
  const now = new Date();
  const timezoneOffsetInMs = now.getTimezoneOffset() * 60_000;

  return new Date(now.getTime() - timezoneOffsetInMs)
    .toISOString()
    .slice(0, 10);
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function validateLoginForm(locale: Locale, form: LoginFormState) {
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

function validateProvisionForm(locale: Locale, form: UserProvisionFormState) {
  const errors: FormErrors<UserProvisionFormState> = {};
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

  if (!form.password) {
    errors.password = messages.definePassword;
  } else if (form.password.length < 8) {
    errors.password = messages.minPassword;
  } else if (
    !/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,128}/.test(
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

function validateCampaignForm(locale: Locale, form: CampaignFormState) {
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
  } else if (form.startDate < today) {
    errors.startDate = messages.startDatePast;
  }

  if (form.endDate) {
    if (form.endDate < today) {
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

async function parseJsonResponse<T>(response: Response) {
  if (!response.headers.get('content-type')?.includes('application/json')) {
    return null;
  }

  return (await response.json()) as T;
}

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

function getCampaignCountLabel(locale: Locale, count: number) {
  return count === 1 ? copy[locale].campaignFound : copy[locale].campaignsFound;
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
  const [isProvisionModalOpen, setIsProvisionModalOpen] = useState(false);
  const [isProvisioningUser, setIsProvisioningUser] = useState(false);
  const [isSessionLoading, setIsSessionLoading] = useState(true);
  const [isSyncingCampaigns, setIsSyncingCampaigns] = useState(false);
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
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<'ALL' | CampaignStatus>(
    'ALL',
  );
  const [session, setSession] = useState<AuthSession | null>(null);
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

  function persistSession(nextSession: AuthSession) {
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(nextSession));
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

  function closeProvisionModal() {
    setIsProvisionModalOpen(false);
    setProvisionForm(initialUserProvisionForm);
    setProvisionErrors({});
    setAuthFeedback(null);
  }

  function closeCampaignModal() {
    setIsCampaignModalOpen(false);
    resetCampaignDraft();
    setCampaignFeedback(null);
  }

  function clearSession() {
    localStorage.removeItem(SESSION_STORAGE_KEY);
    localStorage.removeItem(LEGACY_TOKEN_STORAGE_KEY);
    localStorage.removeItem(LEGACY_USER_STORAGE_KEY);
    setSession(null);
    setUser(null);
    setCampaigns([]);
    setSearchTerm('');
    setSelectedStatus('ALL');
    setLoginForm(initialLoginForm);
    setLoginErrors({});
    setAuthFeedback(null);
    setCampaignFeedback(null);
    closeProvisionModal();
    closeCampaignModal();
  }

  function handleSessionInvalid(message = messages.sessionInvalid) {
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
      refreshToken: response.refreshToken,
    };
    const nextUser = buildAuthenticatedUser(response.accessToken, locale);

    setSession(nextSession);
    setUser(nextUser);
    persistSession(nextSession);

    return {
      session: nextSession,
      user: nextUser,
    };
  }

  async function refreshSessionWithToken(refreshToken: string) {
    const response = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refreshToken }),
    });
    const data = await parseJsonResponse<AuthResponse | ApiErrorResponse>(
      response,
    );

    if (!response.ok || !data || !('accessToken' in data)) {
      throw new Error(parseApiError(data ?? null, messages.sessionExpired));
    }

    return applyAuthSession(data);
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
        headers,
      });
    };

    const response = await execute(currentSession.accessToken);

    if (response.status !== 401) {
      return response;
    }

    const refreshed = await refreshSessionWithToken(
      currentSession.refreshToken,
    );

    return execute(refreshed.session.accessToken);
  }

  async function loadCampaigns(activeSession?: AuthSession | null) {
    setIsSyncingCampaigns(true);

    try {
      const response = await runAuthenticatedRequest(
        `${API_URL}/campaigns`,
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

  const restoreSession = useEffectEvent(async () => {
    const storedSession = localStorage.getItem(SESSION_STORAGE_KEY);

    if (!storedSession) {
      localStorage.removeItem(LEGACY_TOKEN_STORAGE_KEY);
      localStorage.removeItem(LEGACY_USER_STORAGE_KEY);
      setIsSessionLoading(false);
      return;
    }

    try {
      const parsedSession = JSON.parse(storedSession) as PersistedSession;

      if (!parsedSession.refreshToken || !parsedSession.accessToken) {
        throw new Error(messages.sessionInvalid);
      }

      const refreshed = await refreshSessionWithToken(
        parsedSession.refreshToken,
      );

      await loadCampaigns(refreshed.session);
    } catch {
      clearSession();
      setAuthFeedback({
        message: messages.sessionExpiredLogin,
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
    if (!isProvisionModalOpen && !isCampaignModalOpen) {
      return;
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') {
        return;
      }

      if (isCampaignModalOpen) {
        setIsCampaignModalOpen(false);
        resetCampaignDraft();
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
  }, [isCampaignModalOpen, isProvisionModalOpen]);

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
      const response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
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
      const response = await runAuthenticatedRequest(
        `${API_URL}/auth/register`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(provisionForm),
        },
      );
      const data = await parseJsonResponse<AuthResponse | ApiErrorResponse>(
        response,
      );

      if (!response.ok || !data || !('accessToken' in data)) {
        throw new Error(parseApiError(data ?? null, messages.provisionFailure));
      }

      const createdUser = buildAuthenticatedUser(data.accessToken, locale);
      closeProvisionModal();
      setAuthFeedback({
        message: messages.createdUserMessage(
          createdUser.name,
          formatRole(locale, createdUser.role),
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
    setProvisionForm(initialUserProvisionForm);
    setProvisionErrors({});
    setAuthFeedback(null);
    setIsProvisionModalOpen(true);
    setIsAuthPanelOpen(true);
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

    const nextErrors = validateCampaignForm(locale, campaignForm);
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
      const payload = {
        name: campaignForm.name.trim(),
        description: campaignForm.description.trim(),
        status: campaignForm.status,
        budget: Number(campaignForm.budget),
        startDate: new Date(campaignForm.startDate).toISOString(),
        endDate: editingCampaignId
          ? campaignForm.endDate
            ? new Date(campaignForm.endDate).toISOString()
            : null
          : campaignForm.endDate
            ? new Date(campaignForm.endDate).toISOString()
            : undefined,
      };

      const response = await runAuthenticatedRequest(
        editingCampaignId
          ? `${API_URL}/campaigns/${editingCampaignId}`
          : `${API_URL}/campaigns`,
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
      const response = await runAuthenticatedRequest(
        `${API_URL}/campaigns/${campaignId}`,
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
                <button
                  className={styles.primaryButton}
                  onClick={openProvisionModal}
                  type="button"
                >
                  {messages.newAccess}
                </button>
              ) : null}
              {user ? (
                <button
                  aria-label={messages.signOut}
                  className={styles.iconButton}
                  onClick={() => {
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
