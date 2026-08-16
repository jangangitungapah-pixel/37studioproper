import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import '../../styles/modules/settings.css';
import '../../styles/modules/operator-fee.css';
import { AlertTriangle, Building2, CheckCircle2, Clipboard, Crown, DatabaseZap, Edit3, KeyRound, Landmark, Mail, MapPin, MessageCircle, MonitorSmartphone, Phone, QrCode, RefreshCcw, Save, ShieldAlert, ShieldCheck, SlidersHorizontal, Trash2, UserRound, WalletCards, X } from 'lucide-react';
import { collection, query, orderBy, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { useLocation, useNavigate } from 'react-router-dom';
import { firestoreDb } from '../../lib/firebase.js';
import { OWNER_EMAIL } from '../../constants/appConstants.js';
import ConfirmDialog from '../../components/ui/ConfirmDialog.jsx';
import StudioSelect from '../../components/ui/StudioSelect.jsx';
import StudioTextField from '../../components/ui/StudioTextField.jsx';
import OperatorFeeSettingsPanel from '../../components/settings/OperatorFeeSettingsPanel.jsx';
import { adminAuthRepository } from '../../services/adminAuthRepository.js';
import {
  adminOperationsRepository,
  createAdminOperationKey,
} from '../../services/adminOperationsRepository.js';
import { ownerAccountProvisioningRepository } from '../../services/ownerAccountProvisioningRepository.js';
import {
  accountContactOptions,
  accountLandingOptions,
  accountNotificationOptions,
  defaultAccountPreferences,
  normalizeAccountPreferences,
  readAccountPreferences,
  writeAccountPreferences,
} from '../../utils/accountSettings.js';
import {
  buildPortalRoleTransitionPatch,
  countEnabledAdminPermissions,
  defaultAdminPermissions,
  defaultGuardPortalPermissions,
  getAssignablePermissionPages,
  isOwnerAdminUser,
  normalizeAdminPermissionsForRole,
} from '../../utils/adminPermissions.js';
import {
  defaultInvoiceSettings,
  paperSizeOptions,
  saveInvoiceSettings,
  useInvoiceSettings,
} from '../../settings/invoiceSettings.js';
import {
  defaultStudioSettings,
  formatBankAccountNumber,
  normalizeStudioSettings,
  saveStudioSettings,
  useStudioSettings,
} from '../../settings/studioSettings.js';
import {
  formatRupiah,
  getSessionOptions,
  isRecordingSessionId,
  makeSettingItemId,
  normalizePricingSettings,
  usePricingSettings,
  savePricingSettings,
} from '../../settings/pricingSettings.js';
import {
  useOperatorFeeSettings,
  OPERATOR_FEE_PERSON_ROLES,
} from '../../settings/operatorFeeSettings.js';
import {
  GUARD_IDENTITY_LINK_STATES,
  getGuardIdentityRepairMessage,
  resolveGuardIdentityLink,
} from '../../utils/guardIdentity.js';


const DANGER_ZONE_CONFIRM_TEXT = 'HAPUS DATA 37 STUDIO';
const STUDIO_PAYMENT_TERM_LIMIT = 12;
const STUDIO_DRAFT_FIELDS = [
  'studioName',
  'studioAddress',
  'studioPhone',
  'bankName',
  'bankAccountNumber',
  'bankAccountHolder',
  'qrisLabel',
  'qrisNote',
];

const dangerZoneCollections = [
  {
    key: 'bookings',
    label: 'Booking & invoice',
    collectionName: 'bookings',
    preserveCurrentOwner: false,
  },
  {
    key: 'paymentProofs',
    label: 'Bukti pembayaran',
    collectionName: 'paymentProofs',
    preserveCurrentOwner: false,
  },
  {
    key: 'bookingMessages',
    label: 'Pesan booking',
    collectionName: 'bookingMessages',
    preserveCurrentOwner: false,
  },
  {
    key: 'clientCalendarSlots',
    label: 'Slot kalender client',
    collectionName: 'clientCalendarSlots',
    preserveCurrentOwner: false,
  },
  {
    key: 'bookingScheduleDays',
    label: 'Booking schedule concurrency guards',
    collectionName: 'bookingScheduleDays',
    preserveCurrentOwner: false,
  },
  {
    key: 'customers',
    label: 'Customer profile',
    collectionName: 'customers',
    preserveCurrentOwner: false,
  },
  {
    key: 'bookkeepingEntries',
    label: 'Pembukuan',
    collectionName: 'bookkeepingEntries',
    preserveCurrentOwner: false,
  },
  {
    key: 'operatorFeeEntries',
    label: 'Operator fee',
    collectionName: 'operatorFeeEntries',
    preserveCurrentOwner: false,
  },
  {
    key: 'guardAttendanceSessions',
    label: 'Guard attendance',
    collectionName: 'guardAttendanceSessions',
    preserveCurrentOwner: false,
  },
  {
    key: 'inventoryItems',
    label: 'Inventory items',
    collectionName: 'inventoryItems',
    preserveCurrentOwner: false,
  },
  {
    key: 'inventoryMovements',
    label: 'Inventory movements',
    collectionName: 'inventoryMovements',
    preserveCurrentOwner: false,
  },
  {
    key: 'gallery',
    label: 'Gallery metadata',
    collectionName: 'gallery',
    preserveCurrentOwner: false,
  },
  {
    key: 'notificationEvents',
    label: 'Notification events',
    collectionName: 'notificationEvents',
    preserveCurrentOwner: false,
  },
  {
    key: 'settings',
    label: 'Remote app settings',
    collectionName: 'settings',
    preserveCurrentOwner: false,
  },
  {
    key: 'mail',
    label: 'Mail queue',
    collectionName: 'mail',
    preserveCurrentOwner: false,
  },
  {
    key: 'users',
    label: 'Admin/client account docs',
    collectionName: 'users',
    preserveCurrentOwner: true,
  },
];

const emptySessionForm = {
  id: '',
  name: '',
  description: '',
  price: '',
};

const emptyDiscountForm = {
  id: '',
  nominal: '',
  durationHours: '',
  sessionId: 'rehearsal',
};

const emptyRecordingForm = {
  id: '',
  name: '',
  durationHours: '',
  price: '',
};

const emptyPackageForm = {
  id: '',
  name: '',
  detail: '',
  durationHours: '',
  price: '',
};

const emptyProvisionAccountForm = {
  confirmPassword: '',
  displayName: '',
  email: '',
  guardId: '',
  password: '',
  role: 'admin',
};

const OWNER_PROVISION_ROLE_OPTIONS = [
  {
    key: 'admin',
    label: 'Admin',
  },
  {
    key: 'studio_guard',
    label: 'Guard',
  },
];

function toNumber(value) {
  const parsed = Number(value);

  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

function getAccountProviderIds(user) {
  const directProviderIds = Array.isArray(user?.providerIds)
    ? user.providerIds.map((providerId) => String(providerId || '').trim()).filter(Boolean)
    : [];

  if (directProviderIds.length) {
    return Array.from(new Set(directProviderIds));
  }

  const legacyProvider = String(user?.provider || '').toLowerCase();
  const fallbackProviders = [];

  if (legacyProvider.includes('google')) fallbackProviders.push('google.com');
  if (legacyProvider.includes('password')) fallbackProviders.push('password');
  if (legacyProvider.includes('phone')) fallbackProviders.push('phone');

  return Array.from(new Set(fallbackProviders));
}

function getAccountProviderLabel(user) {
  const providerIds = getAccountProviderIds(user);
  const labels = [];

  if (providerIds.includes('google.com')) labels.push('Google');
  if (providerIds.includes('password')) labels.push('Email / Password');
  if (providerIds.includes('phone')) labels.push('Phone OTP');

  if (labels.length) return labels.join(' + ');
  if (user?.phoneNumber && !user?.email) return 'Phone OTP';
  if (user?.email) return 'Email account';

  return 'Unknown';
}

function getAccountRoleLabel(user) {
  return String(user?.email || '').trim().toLowerCase() === OWNER_EMAIL ? 'Owner' : 'Admin';
}

function getPortalUserRoleLabel(user) {
  if (user?.role === 'owner') return 'Owner';
  if (user?.role === 'studio_guard') return 'Guard';
  if (user?.role === 'admin') return 'Admin';

  return user?.role || 'Unknown';
}

function getAccountStatusLabel(user) {
  if (user?.isApproved || user?.status === 'approved') return 'Approved';
  if (user?.status === 'pending') return 'Pending Approval';
  if (user?.status === 'rejected') return 'Rejected';

  return user?.status || 'Unknown';
}

function getMaskedUid(uid) {
  const text = String(uid || '');

  if (!text) return '-';
  if (text.length <= 10) return text;

  return text.slice(0, 6) + '...' + text.slice(-4);
}

function getOptionLabel(options, key, fallback = '-') {
  return options.find((item) => item.key === key)?.label || fallback;
}

function resolveAccountPreferences(user) {
  return normalizeAccountPreferences(
    readAccountPreferences(
      user?.uid,
      user?.preferences
    )
  );
}

function accountPreferencesMatch(left, right) {
  return JSON.stringify(
    normalizeAccountPreferences(left)
  ) === JSON.stringify(
    normalizeAccountPreferences(right)
  );
}

function getStudioDraftSnapshot(settings) {
  const source = settings && typeof settings === 'object' ? settings : {};
  const snapshot = STUDIO_DRAFT_FIELDS.reduce((result, field) => ({
    ...result,
    [field]: String(source[field] || '').trim(),
  }), {});

  snapshot.paymentTerms = (Array.isArray(source.paymentTerms) ? source.paymentTerms : [])
    .map((term) => String(term || '').trim());

  return snapshot;
}

function studioDraftsMatch(left, right) {
  return JSON.stringify(getStudioDraftSnapshot(left)) === JSON.stringify(getStudioDraftSnapshot(right));
}

function getStudioValidationErrors(settings) {
  const source = getStudioDraftSnapshot(settings);
  const errors = {};
  const phoneDigits = source.studioPhone.replace(/\D/g, '');
  const bankDigits = source.bankAccountNumber.replace(/\D/g, '');

  if (!source.studioName) errors.studioName = 'Nama studio wajib diisi.';
  if (source.studioPhone && (phoneDigits.length < 9 || phoneDigits.length > 15)) {
    errors.studioPhone = 'Gunakan 9–15 digit nomor WhatsApp atau telepon.';
  }
  if (!source.bankName) errors.bankName = 'Nama bank wajib diisi.';
  if (bankDigits.length < 6) errors.bankAccountNumber = 'Nomor rekening minimal 6 digit.';
  if (!source.bankAccountHolder) errors.bankAccountHolder = 'Nama pemilik rekening wajib diisi.';
  if (!source.qrisLabel) errors.qrisLabel = 'Label QRIS wajib diisi.';
  if (!source.paymentTerms.some(Boolean)) errors.paymentTerms = 'Tambahkan minimal satu ketentuan pembayaran.';

  return errors;
}

function getStudioSetupProgress(settings) {
  const source = getStudioDraftSnapshot(settings);
  const bankDigits = source.bankAccountNumber.replace(/\D/g, '');
  const checks = [
    {
      complete: Boolean(source.studioName),
      key: 'identity',
      label: 'Identitas studio',
    },
    {
      complete: Boolean(source.studioPhone || source.studioAddress),
      key: 'contact',
      label: 'Kontak publik',
    },
    {
      complete: Boolean(source.bankName && bankDigits.length >= 6 && source.bankAccountHolder),
      key: 'transfer',
      label: 'Rekening transfer',
    },
    {
      complete: Boolean(source.qrisLabel),
      key: 'qris',
      label: 'Informasi QRIS',
    },
    {
      complete: source.paymentTerms.some(Boolean),
      key: 'terms',
      label: 'Aturan pembayaran',
    },
  ];
  const completed = checks.filter((item) => item.complete).length;

  return {
    checks,
    completed,
    percent: Math.round((completed / checks.length) * 100),
    total: checks.length,
  };
}

function getAccountPasswordStrength(password) {
  const value = String(password || '');
  const checks = [
    {
      complete: value.length >= 6,
      key: 'length',
      label: '6+ karakter',
    },
    {
      complete: /[a-z]/i.test(value) && /\d/.test(value),
      key: 'mixed',
      label: 'Huruf + angka',
    },
    {
      complete: /[^a-z0-9]/i.test(value),
      key: 'symbol',
      label: 'Simbol',
    },
  ];
  const completed = checks.filter((item) => item.complete).length;

  if (!value) {
    return {
      checks,
      label: 'Belum diisi',
      percent: 0,
      tone: 'empty',
    };
  }

  return {
    checks,
    label:
      completed === checks.length
        ? 'Kuat'
        : completed === 2
          ? 'Cukup'
          : 'Lemah',
    percent: Math.round((completed / checks.length) * 100),
    tone:
      completed === checks.length
        ? 'strong'
        : completed === 2
          ? 'medium'
          : 'weak',
  };
}

const SETTINGS_GROUP_LABELS = {
  account: 'Account & access',
  'user-settings': 'Account & access',
  studio: 'Studio configuration',
  pricing: 'Commerce',
  invoice: 'Commerce',
  'fee-settings': 'Operations',
  danger: 'System safety',
};

function getSettingsGroupLabel(key) {
  return SETTINGS_GROUP_LABELS[key] || 'Studio settings';
}

function FormActions({ editing, onCancel }) {
  return (
    <div className="settings-form-actions">
      {editing ? (
        <button className="settings-mini-button is-ghost" type="button" onClick={onCancel}>
          Batal Edit
        </button>
      ) : null}
      <button className="settings-mini-button is-primary" type="submit">
        <Save size={15} />
        {editing ? 'Update' : 'Simpan'}
      </button>
    </div>
  );
}

function EmptyState({ children }) {
  return <p className="settings-empty-text">{children}</p>;
}

export default function SettingsPage({ authState, currentUser: currentUserProp }) {
  const [confirmConfig, setConfirmConfig] = useState(null);
  const currentUser = useMemo(() => currentUserProp || authState?.user || {}, [currentUserProp, authState?.user]);
  const isOwner = isOwnerAdminUser(currentUser);
  const location = useLocation();
  const navigate = useNavigate();

  const subpages = useMemo(() => {
    const pages = [
      {
        key: 'account',
        label: 'Account Settings',
        description: 'Profil admin, akses akun, preferensi login, dan pengaturan lokal.',
      },
      {
        key: 'studio',
        label: 'Studio Settings',
        description: 'Identitas studio, alamat, kontak, rekening transfer, QRIS, dan ketentuan pembayaran.',
      },
      {
        key: 'pricing',
        label: 'Pricing and Session',
        description: 'Harga session, discount, recording type, dan paket.',
      },
      {
        key: 'invoice',
        label: 'Invoice Settings',
        description: 'Header, footer, nomor kontak, dan ukuran thermal invoice.',
      }
    ];
    if (isOwner) {
      pages.push({
        key: 'fee-settings',
        label: 'Fee Settings',
        description: 'Atur crew, operator, uang makan, dan rule fee internal studio.',
      });
      pages.push({
        key: 'user-settings',
        label: 'User & Access Settings',
        description: 'Buat akun Admin/Guard, kelola role, status, identitas Guard, dan hak akses halaman.',
      });
      pages.push({
        key: 'danger',
        label: 'Danger Zone',
        description: 'Reset data operasional app. Aksi ini hanya untuk owner dan tidak bisa dibatalkan.',
      });
    }
    return pages;
  }, [isOwner]);

  const requestedSettingsArea = useMemo(() => (
    new URLSearchParams(location.search).get('area') || 'account'
  ), [location.search]);
  const dangerJobIdFromUrl = useMemo(() => (
    new URLSearchParams(location.search).get('dangerJob') || ''
  ), [location.search]);
  // UI-12A.2 — Resolve access before any Owner-only subscription is enabled.
  const resolvedActiveSubpage = subpages.some((page) => page.key === requestedSettingsArea)
    ? requestedSettingsArea
    : subpages[0]?.key || 'account';
  const setSettingsArea = useCallback((nextArea, { replace = false } = {}) => {
    const safeArea = subpages.some((page) => page.key === nextArea)
      ? nextArea
      : subpages[0]?.key || 'account';
    const nextSearch = new URLSearchParams(location.search);
    nextSearch.set('area', safeArea);

    navigate({
      hash: location.hash,
      pathname: location.pathname,
      search: `?${nextSearch.toString()}`,
    }, { replace });
  }, [location.hash, location.pathname, location.search, navigate, subpages]);
  const setDangerJobInUrl = useCallback((jobId, { replace = true } = {}) => {
    const nextSearch = new URLSearchParams(location.search);
    nextSearch.set('area', 'danger');
    if (jobId) nextSearch.set('dangerJob', jobId);
    else nextSearch.delete('dangerJob');

    navigate({
      hash: location.hash,
      pathname: location.pathname,
      search: `?${nextSearch.toString()}`,
    }, { replace });
  }, [location.hash, location.pathname, location.search, navigate]);

  useEffect(() => {
    if (requestedSettingsArea === resolvedActiveSubpage) return;
    setSettingsArea(resolvedActiveSubpage, { replace: true });
  }, [requestedSettingsArea, resolvedActiveSubpage, setSettingsArea]);

  const remoteSettings = usePricingSettings();
  const [settings, setSettings] = useState(() => remoteSettings);
  const remoteInvoiceSettings = useInvoiceSettings();
  const [invoiceSettings, setInvoiceSettings] = useState(() => remoteInvoiceSettings);
  const [invoiceSettingsMessage, setInvoiceSettingsMessage] = useState('');
  const remoteStudioSettings = useStudioSettings();
  const [studioSettings, setStudioSettings] = useState(() => remoteStudioSettings);
  const [savedStudioSettings, setSavedStudioSettings] = useState(() => remoteStudioSettings);
  const [studioSettingsMessage, setStudioSettingsMessage] = useState('');
  const [studioSettingsMessageTone, setStudioSettingsMessageTone] = useState('info');
  const [studioSettingsIsSaving, setStudioSettingsIsSaving] = useState(false);
  const [studioValidationErrors, setStudioValidationErrors] = useState({});
  const [accountPreferences, setAccountPreferences] = useState(() => resolveAccountPreferences(currentUser));
  const [savedAccountPreferences, setSavedAccountPreferences] = useState(() => resolveAccountPreferences(currentUser));
  const [accountSettingsMessage, setAccountSettingsMessage] = useState('');
  const [accountSettingsMessageTone, setAccountSettingsMessageTone] = useState('info');
  const [accountSettingsIsSaving, setAccountSettingsIsSaving] = useState(false);
  const [accountCopyMessage, setAccountCopyMessage] = useState('');
  const [accountProfileForm, setAccountProfileForm] = useState(() => ({
    displayName: currentUser?.displayName || '',
  }));
  const [accountProfileSavedName, setAccountProfileSavedName] = useState(
    () => String(currentUser?.displayName || '').trim()
  );
  const [accountProfileIsSaving, setAccountProfileIsSaving] = useState(false);
  const operatorFeeSettings = useOperatorFeeSettings({
    enabled: isOwner && resolvedActiveSubpage === 'user-settings',
  });
  const [selectingGuardUser, setSelectingGuardUser] = useState(null);
  const [selectedCrewId, setSelectedCrewId] = useState(null);
  const [accountProfileMessage, setAccountProfileMessage] = useState('');
  const [accountProfileMessageTone, setAccountProfileMessageTone] = useState('info');
  const [accountPasswordForm, setAccountPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [accountPasswordMessage, setAccountPasswordMessage] = useState('');
  const [accountPasswordHasError, setAccountPasswordHasError] = useState(false);
  const [accountPasswordIsSaving, setAccountPasswordIsSaving] = useState(false);
  const [accountPasswordResetIsSending, setAccountPasswordResetIsSending] = useState(false);
  const [accountSecurityProviderIds, setAccountSecurityProviderIds] = useState(
    () => getAccountProviderIds(currentUser)
  );
  const [dangerConfirmText, setDangerConfirmText] = useState('');
  const [dangerFinalCheck, setDangerFinalCheck] = useState(false);
  const [dangerIsDeleting, setDangerIsDeleting] = useState(false);
  const [dangerIsLoading, setDangerIsLoading] = useState(false);
  const [dangerMessage, setDangerMessage] = useState('');
  const [dangerDryRun, setDangerDryRun] = useState(null);
  const [dangerJob, setDangerJob] = useState(null);
  const [dangerResumeToken, setDangerResumeToken] = useState(0);
  const [sensitiveCurrentPassword, setSensitiveCurrentPassword] = useState('');
  const dangerDryRunKeyRef = useRef(createAdminOperationKey('danger-dry-run', currentUser?.uid));

  useEffect(() => {
    if (!isOwner || resolvedActiveSubpage !== 'danger') return undefined;

    let cancelled = false;
    const loadingFrame = window.requestAnimationFrame(() => {
      setDangerIsLoading(true);
    });
    const request = dangerJobIdFromUrl
      ? adminOperationsRepository.getDangerZoneJob(dangerJobIdFromUrl)
      : adminOperationsRepository.createDangerZoneDryRun(dangerDryRunKeyRef.current);

    request
      .then((response) => {
        if (cancelled) return;

        if (dangerJobIdFromUrl) {
          setDangerJob(response.job || null);
          setDangerDryRun(null);
          setDangerMessage(
            response.job?.status === 'completed'
              ? `Reset selesai. ${Number(response.job.totalDeleted || 0)} dokumen terhapus.`
              : 'Job reset ditemukan dan akan dilanjutkan dari checkpoint terakhir.',
          );
        } else {
          setDangerDryRun(response);
          setDangerJob(null);
          setDangerMessage('Dry-run siap. Verifikasi project, environment, dan jumlah dokumen sebelum melanjutkan.');
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setDangerMessage(error?.message || 'Status Danger Zone belum dapat dimuat.');
        }
      })
      .finally(() => {
        if (!cancelled) setDangerIsLoading(false);
      });

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(loadingFrame);
    };
  }, [dangerJobIdFromUrl, isOwner, resolvedActiveSubpage]);

  useEffect(() => {
    if (
      !isOwner ||
      resolvedActiveSubpage !== 'danger' ||
      !dangerJob?.id ||
      !['queued', 'running'].includes(dangerJob.status)
    ) {
      return undefined;
    }

    let cancelled = false;
    const stepTimer = window.setTimeout(async () => {
      try {
        setDangerIsDeleting(true);
        const response = await adminOperationsRepository.stepDangerZoneJob(dangerJob.id);
        if (cancelled) return;

        const nextJob = response.job || null;
        setDangerJob(nextJob);
        if (nextJob?.status === 'completed') {
          setDangerConfirmText('');
          setDangerFinalCheck(false);
          setDangerMessage(`Reset selesai. ${Number(nextJob.totalDeleted || 0)} dokumen terhapus. Akun Owner aktif tetap dipertahankan.`);
          setDangerIsDeleting(false);
        } else {
          setDangerMessage('Reset server sedang berjalan dan checkpoint terakhir sudah tersimpan.');
          setDangerResumeToken((current) => current + 1);
        }
      } catch (error) {
        if (!cancelled) {
          setDangerIsDeleting(false);
          setDangerMessage(`${error?.message || 'Job belum dapat dilanjutkan.'} Tekan Lanjutkan Job untuk mencoba lagi.`);
        }
      }
    }, 120);

    return () => {
      cancelled = true;
      window.clearTimeout(stepTimer);
    };
  }, [dangerJob?.id, dangerJob?.status, dangerJob?.updatedAt, dangerResumeToken, isOwner, resolvedActiveSubpage]);

  useEffect(() => {
    const clearSensitivePasswordFrame = window.requestAnimationFrame(() => {
      setSensitiveCurrentPassword('');
    });

    return () => window.cancelAnimationFrame(clearSensitivePasswordFrame);
  }, [resolvedActiveSubpage]);

  useEffect(() => {
    const settingsFrameId = window.requestAnimationFrame(() => {
      setSettings(remoteSettings);
    });

    return () => {
      window.cancelAnimationFrame(settingsFrameId);
    };
  }, [remoteSettings]);

  useEffect(() => {
    const invoiceFrameId = window.requestAnimationFrame(() => {
      setInvoiceSettings(remoteInvoiceSettings);
    });

    return () => {
      window.cancelAnimationFrame(invoiceFrameId);
    };
  }, [remoteInvoiceSettings]);

  useEffect(() => {
    const studioFrameId = window.requestAnimationFrame(() => {
      const nextStudioSettings = normalizeStudioSettings(remoteStudioSettings);

      setStudioSettings(nextStudioSettings);
      setSavedStudioSettings(nextStudioSettings);
      setStudioSettingsMessage('');
      setStudioSettingsMessageTone('info');
      setStudioValidationErrors({});
    });

    return () => {
      window.cancelAnimationFrame(studioFrameId);
    };
  }, [remoteStudioSettings]);

  useEffect(() => {
    const accountFrameId = window.requestAnimationFrame(() => {
      const nextPreferences = resolveAccountPreferences(currentUser);

      setAccountPreferences(nextPreferences);
      setSavedAccountPreferences(nextPreferences);
      setAccountSettingsMessage('');
    });

    return () => {
      window.cancelAnimationFrame(accountFrameId);
    };
  }, [currentUser]);

  useEffect(() => {
    const profileFrameId = window.requestAnimationFrame(() => {
      setAccountProfileForm({
        displayName: currentUser?.displayName || '',
      });
      setAccountProfileSavedName(
        String(currentUser?.displayName || '').trim()
      );
      setAccountProfileMessage('');
      setAccountProfileMessageTone('info');
    });

    return () => {
      window.cancelAnimationFrame(profileFrameId);
    };
  }, [currentUser?.displayName]);

  useEffect(() => {
    const providerFrameId = window.requestAnimationFrame(() => {
      setAccountSecurityProviderIds(getAccountProviderIds(currentUser));
    });

    return () => {
      window.cancelAnimationFrame(providerFrameId);
    };
  }, [currentUser]);


  const [sessionForm, setSessionForm] = useState(emptySessionForm);
  const [discountForm, setDiscountForm] = useState(emptyDiscountForm);
  const [recordingForm, setRecordingForm] = useState(emptyRecordingForm);
  const [packageForm, setPackageForm] = useState(emptyPackageForm);

  // Approvals State
  const [registeredUsers, setRegisteredUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [selectedPermissionUser, setSelectedPermissionUser] = useState(null);
  const [permissionDraft, setPermissionDraft] = useState(defaultAdminPermissions);
  const [approvalSettingsMessage, setApprovalSettingsMessage] = useState('');
  const [provisionAccountForm, setProvisionAccountForm] = useState(emptyProvisionAccountForm);
  const [provisionAccountIsSaving, setProvisionAccountIsSaving] = useState(false);
  const [provisionAccountMessage, setProvisionAccountMessage] = useState('');
  const [provisionAccountHasError, setProvisionAccountHasError] = useState(false);
  const [provisionedCredentials, setProvisionedCredentials] = useState(null);

  const sessionOptions = useMemo(() => getSessionOptions(settings), [settings]);

  useEffect(() => {
    savePricingSettings(settings).catch((err) => console.error('Gagal auto-save pricing:', err));
  }, [settings]);

  const approvalUsers = useMemo(
    () => registeredUsers.filter((user) => user.id !== currentUser?.uid && user.status === 'pending'),
    [registeredUsers, currentUser?.uid]
  );

  const portalUsers = useMemo(
    () => registeredUsers.filter((user) => user.status === 'approved' || user.role === 'owner'),
    [registeredUsers]
  );

  const inactiveUsers = useMemo(
    () => registeredUsers.filter((user) => user.status === 'rejected' && user.role !== 'owner'),
    [registeredUsers]
  );

  const guardPeople = useMemo(() => {
    if (!operatorFeeSettings?.people) return [];
    return operatorFeeSettings.people.filter(
      (person) =>
        person.active &&
        [OPERATOR_FEE_PERSON_ROLES.GUARD, OPERATOR_FEE_PERSON_ROLES.BOTH].includes(person.role)
    );
  }, [operatorFeeSettings]);

  const guardProvisionOptions = useMemo(
    () =>
      guardPeople.map(
        (person) => ({
          key: person.id,
          label: person.name,
        })
      ),
    [guardPeople]
  );

  const getGuardIdentityLink = (guardId) =>
    resolveGuardIdentityLink(
      operatorFeeSettings?.people || [],
      guardId,
    );

  const getLinkedGuardName = (guardId) => {
    const link = getGuardIdentityLink(guardId);

    if (link.state === GUARD_IDENTITY_LINK_STATES.MISSING_GUARD_ID) {
      return 'Belum terhubung';
    }

    if (link.state === GUARD_IDENTITY_LINK_STATES.PERSON_NOT_FOUND) {
      return 'Crew tidak ditemukan';
    }

    if (link.state === GUARD_IDENTITY_LINK_STATES.PERSON_INACTIVE) {
      return (link.person?.name || 'Crew Guard') + ' · Nonaktif';
    }

    if (link.state === GUARD_IDENTITY_LINK_STATES.INVALID_PERSON_ROLE) {
      return (link.person?.name || 'Crew') + ' · Bukan Guard';
    }

    return link.person?.name || 'Belum terhubung';
  };

  function openGuardIdentityLinker(user) {
    const currentLink =
      getGuardIdentityLink(
        user?.guardId,
      );

    setSelectingGuardUser({
      ...user,
      pendingRole: 'studio_guard',
    });

    setSelectedCrewId(
      currentLink.isValid
        ? currentLink.guardId
        : null,
    );

    setApprovalSettingsMessage(
      currentLink.isValid
        ? 'Pilih crew Guard aktif untuk menghubungkan ulang identitas akun.'
        : getGuardIdentityRepairMessage(currentLink),
    );
  }

  // Sync users list for owner-only user management pages
  useEffect(() => {
    if (resolvedActiveSubpage !== 'user-settings' || !isOwnerAdminUser(currentUser)) return;

    const usersLoadingFrameId = window.requestAnimationFrame(() => {
      setUsersLoading(true);
    });

    const usersRef = collection(firestoreDb, 'users');
    const q = query(usersRef, orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          if (data.role !== 'client') {
            list.push({ id: doc.id, ...data });
          }
        });
        setRegisteredUsers(list);
        setUsersLoading(false);
      },
      (err) => {
        console.error('Error fetching users for approvals:', err);
        setUsersLoading(false);
      }
    );

    return () => {
      window.cancelAnimationFrame(usersLoadingFrameId);
      unsubscribe();
    };
  }, [resolvedActiveSubpage, currentUser]);

  function updateProvisionAccountField(field) {
    return (event) => {
      const value = event.target.value;

      setProvisionAccountForm((current) => ({
        ...current,
        [field]: value,
        ...(field === 'role' && value !== 'studio_guard'
          ? { guardId: '' }
          : {}),
      }));

      setProvisionAccountMessage('');
      setProvisionAccountHasError(false);
    };
  }

  function updateProvisionAccountValue(field) {
    return (nextValue) => {
      setProvisionAccountForm((current) => ({
        ...current,
        [field]: nextValue,
        ...(field === 'role' && nextValue !== 'studio_guard'
          ? { guardId: '' }
          : {}),
      }));

      setProvisionAccountMessage('');
      setProvisionAccountHasError(false);
    };
  }

  async function handleProvisionPortalAccount(event) {
    event.preventDefault();

    if (!isOwnerAdminUser(currentUser)) {
      setProvisionAccountHasError(true);
      setProvisionAccountMessage('Hanya Owner yang dapat membuat akun portal.');
      return;
    }

    const email = provisionAccountForm.email.trim().toLowerCase();
    const displayName = provisionAccountForm.displayName.trim();
    const password = provisionAccountForm.password;

    if (!displayName) {
      setProvisionAccountHasError(true);
      setProvisionAccountMessage('Nama akun wajib diisi.');
      return;
    }

    if (!email || !email.includes('@')) {
      setProvisionAccountHasError(true);
      setProvisionAccountMessage('Email akun belum valid.');
      return;
    }

    if (password.length < 6) {
      setProvisionAccountHasError(true);
      setProvisionAccountMessage('Password minimal 6 karakter.');
      return;
    }

    if (password !== provisionAccountForm.confirmPassword) {
      setProvisionAccountHasError(true);
      setProvisionAccountMessage('Konfirmasi password belum sama.');
      return;
    }

    if (
      provisionAccountForm.role === 'studio_guard' &&
      !provisionAccountForm.guardId
    ) {
      setProvisionAccountHasError(true);
      setProvisionAccountMessage('Pilih identitas crew Guard terlebih dahulu.');
      return;
    }

    setProvisionAccountIsSaving(true);
    setProvisionAccountHasError(false);
    setProvisionAccountMessage('');
    setProvisionedCredentials(null);

    try {
      const createdAccount =
        await ownerAccountProvisioningRepository.provisionPortalAccount({
          currentOwner: currentUser,
          displayName,
          email,
          guardId: provisionAccountForm.guardId,
          guardPeople: operatorFeeSettings?.people || [],
          password,
          role: provisionAccountForm.role,
        });

      const roleLabel =
        createdAccount.role === 'studio_guard'
          ? 'Guard'
          : 'Admin';

      setProvisionedCredentials({
        displayName: createdAccount.displayName,
        email: createdAccount.email,
        password,
        role: createdAccount.role,
        roleLabel,
        loginPath:
          createdAccount.role === 'studio_guard'
            ? '/guard/attendance'
            : '/login',
      });

      setProvisionAccountForm(emptyProvisionAccountForm);
      setProvisionAccountMessage(
        'Akun ' + roleLabel + ' berhasil dibuat dan langsung aktif.'
      );
    } catch (err) {
      console.error(
        '[owner-account-provision] Gagal membuat akun portal:',
        err,
      );

      setProvisionAccountHasError(true);
      setProvisionAccountMessage(
        ownerAccountProvisioningRepository.getOwnerProvisioningErrorMessage(err)
      );
    } finally {
      setProvisionAccountIsSaving(false);
    }
  }

  async function copyProvisionedCredentials() {
    if (!provisionedCredentials) return;

    const text = [
      '37 Studio Portal',
      'Nama: ' + provisionedCredentials.displayName,
      'Role: ' + provisionedCredentials.roleLabel,
      'Email: ' + provisionedCredentials.email,
      'Password: ' + provisionedCredentials.password,
      'Login: ' + provisionedCredentials.loginPath,
    ].join('\n');

    try {
      await navigator.clipboard.writeText(text);
      setProvisionAccountHasError(false);
      setProvisionAccountMessage('Kredensial berhasil disalin.');
    } catch (err) {
      console.error('Gagal menyalin kredensial akun:', err);
      setProvisionAccountHasError(true);
      setProvisionAccountMessage('Browser tidak mengizinkan copy otomatis. Salin kredensial secara manual.');
    }
  }

  async function handleApproveUser(userId) {
    try {
      const docRef = doc(firestoreDb, 'users', userId);
      await updateDoc(docRef, {
        status: 'approved',
        updatedAt: new Date().toISOString()
      });
    } catch (err) {
      console.error('Failed to approve user:', err);
    }
  }

  function handleRejectUser(userId) {
    setConfirmConfig({
      title: 'Tolak Request Admin',
      message: 'Tolak atau nonaktifkan request admin ini? Akun tidak akan mendapat akses admin, tetapi pemilik akun masih dapat memilih beralih menjadi client.',
      confirmLabel: 'Tolak Akses',
      onConfirm: async () => {
        try {
          const docRef = doc(firestoreDb, 'users', userId);
          await updateDoc(docRef, {
            status: 'rejected',
            updatedAt: new Date().toISOString(),
          });
        } catch (err) {
          console.error('Failed to reject admin user:', err);
        }
      }
    });
  }

  async function commitUserRoleTransition(
    user,
    newRole,
    {
      guardId = '',
    } = {},
  ) {
    if (
      !user?.id
    ) {
      throw new Error(
        'User tujuan tidak valid.',
      );
    }

    const patch =
      buildPortalRoleTransitionPatch(
        user,
        newRole,
        {
          guardId,
          guardPeople:
            operatorFeeSettings?.people || [],
        },
      );

    await updateDoc(
      doc(
        firestoreDb,
        'users',
        user.id,
      ),
      {
        ...patch,

        updatedAt:
          new Date().toISOString(),
      },
    );

    return patch;
  }

  async function handleUpdateUserRole(
    user,
    newRole,
    options = {},
  ) {
    const isGuardLinkSave = Boolean(
      user?.role === 'studio_guard' &&
      newRole === 'studio_guard' &&
      options.guardId
    );

    if (
      !user?.id ||
      !newRole ||
      (
        newRole === user.role &&
        !isGuardLinkSave
      )
    ) {
      return;
    }

    if (
      newRole === 'studio_guard'
    ) {
      const requestedGuardId =
        options.guardId ||
        user.guardId ||
        '';

      const guardIdentityLink =
        getGuardIdentityLink(
          requestedGuardId,
        );

      if (!guardIdentityLink.isValid) {
        openGuardIdentityLinker(user);

        setApprovalSettingsMessage(
          getGuardIdentityRepairMessage(
            guardIdentityLink,
          ),
        );

        return;
      }

      options = {
        ...options,
        guardId:
          guardIdentityLink.guardId,
      };
    }

    try {
      await commitUserRoleTransition(
        user,
        newRole,
        options,
      );

      setSelectingGuardUser(
        null,
      );

      setSelectedCrewId(
        null,
      );

      setApprovalSettingsMessage(
        newRole === 'studio_guard'
          ? (
              user.role === 'studio_guard'
                ? 'Identitas Guard berhasil dihubungkan ulang.'
                : 'Role berhasil diubah menjadi Guard.'
            )
          : 'Role berhasil diubah menjadi Admin.',
      );
    } catch (err) {
      console.error(
        'Failed to update user role:',
        err,
      );

      setApprovalSettingsMessage(
        err?.message ||
        'Gagal memperbarui peran akun.',
      );
    }
  }

  async function handleToggleUserStatus(
    user,
    currentStatus,
  ) {
    if (!user?.id) {
      setApprovalSettingsMessage('User tujuan tidak valid.');
      return;
    }

    const nextStatus =
      currentStatus === 'approved'
        ? 'rejected'
        : 'approved';

    if (
      nextStatus === 'approved' &&
      user.role === 'studio_guard'
    ) {
      const guardIdentityLink =
        getGuardIdentityLink(
          user.guardId,
        );

      if (!guardIdentityLink.isValid) {
        openGuardIdentityLinker(user);

        setApprovalSettingsMessage(
          'Akun Guard tidak bisa diaktifkan sebelum identity link diperbaiki. ' +
          getGuardIdentityRepairMessage(
            guardIdentityLink,
          ),
        );

        return;
      }
    }

    try {
      const docRef =
        doc(
          firestoreDb,
          'users',
          user.id,
        );

      await updateDoc(docRef, {
        status: nextStatus,
        updatedAt: new Date().toISOString(),
      });

      setApprovalSettingsMessage(
        'Status akses berhasil diubah menjadi ' +
        (
          nextStatus === 'approved'
            ? 'Aktif'
            : 'Nonaktif'
        ) +
        '.',
      );
    } catch (err) {
      console.error(
        'Failed to toggle user status:',
        err,
      );

      setApprovalSettingsMessage(
        'Gagal mengubah status akses.',
      );
    }
  }

  function openPermissionSettings(user) {
    setSelectedPermissionUser(user);
    setPermissionDraft(normalizeAdminPermissionsForRole(user.permissions, user.role));
    setApprovalSettingsMessage('');
  }

  function closePermissionSettings() {
    setSelectedPermissionUser(null);
    setPermissionDraft(defaultAdminPermissions);
  }

  function togglePermissionPage(pageKey) {
    setPermissionDraft((current) => {
      const normalized = normalizeAdminPermissionsForRole(current, selectedPermissionUser?.role);

      return {
        ...normalized,
        [pageKey]: !normalized[pageKey],
      };
    });

    if (approvalSettingsMessage) setApprovalSettingsMessage('');
  }

  function grantAllPermissions() {
    setPermissionDraft(selectedPermissionUser?.role === 'studio_guard' ? defaultGuardPortalPermissions : defaultAdminPermissions);
    if (approvalSettingsMessage) setApprovalSettingsMessage('');
  }

  async function savePermissionSettings(event) {
    event.preventDefault();

    if (!selectedPermissionUser?.id) {
      setApprovalSettingsMessage('User belum dipilih.');
      return;
    }

    const normalized = normalizeAdminPermissionsForRole(permissionDraft, selectedPermissionUser.role);
    const enabledCount = countEnabledAdminPermissions(normalized, selectedPermissionUser.role);

    if (!enabledCount && selectedPermissionUser.role !== 'studio_guard') {
      setApprovalSettingsMessage('Minimal aktifkan satu halaman untuk user ini.');
      return;
    }

    try {
      await updateDoc(doc(firestoreDb, 'users', selectedPermissionUser.id), {
        permissions: normalized,
        updatedAt: new Date().toISOString(),
      });

      setApprovalSettingsMessage('Permission ' + (selectedPermissionUser.displayName || selectedPermissionUser.email || 'user') + ' berhasil disimpan.');
      closePermissionSettings();
    } catch (err) {
      console.error('Gagal menyimpan permission user:', err);
      setApprovalSettingsMessage('Permission belum berhasil disimpan ke Firestore.');
    }
  }

  async function transferOwnershipToUser(user) {
    if (!user?.id) {
      setApprovalSettingsMessage('User tujuan belum dipilih.');
      return;
    }

    if (!currentUser?.uid) {
      setApprovalSettingsMessage('Owner aktif belum terbaca.');
      return;
    }

    if (user.id === currentUser.uid) {
      setApprovalSettingsMessage('Akun ini sudah menjadi owner aktif.');
      return;
    }

    if (accountNeedsCurrentPassword && !sensitiveCurrentPassword) {
      setApprovalSettingsMessage('Masukkan password Owner saat ini sebelum transfer ownership.');
      return;
    }

    const targetLabel = user.displayName || user.email || user.phoneNumber || 'user ini';
    const targetIdentity = user.email || user.displayName || user.phoneNumber || user.id;
    
    setConfirmConfig({
      title: 'Transfer Ownership?',
      message: `Transfer ownership ke ${targetLabel}? Akun owner saat ini akan berubah menjadi admin biasa.`,
      detail: `Sesudah transfer, ${targetLabel} menjadi satu-satunya Owner. Akun Anda tetap aktif sebagai Admin biasa.`,
      confirmLabel: 'Ya, Transfer',
      verificationExpected: targetIdentity,
      verificationLabel: `Ketik tepat “${targetIdentity}” untuk mengonfirmasi target`,
      onConfirm: async () => {
        try {
          setApprovalSettingsMessage('Memverifikasi ulang sesi Owner...');
          await adminAuthRepository.reauthenticateCurrentAdmin({
            password: sensitiveCurrentPassword,
          });
          setSensitiveCurrentPassword('');
          await adminOperationsRepository.transferOwnership({
            targetUid: user.id,
          });

          setApprovalSettingsMessage('Ownership berhasil ditransfer ke ' + targetLabel + '.');
        } catch (err) {
          setSensitiveCurrentPassword('');
          console.error('Gagal transfer ownership:', err);
          setApprovalSettingsMessage(err?.message || 'Terjadi kesalahan saat mentransfer ownership.');
          throw err;
        }
      }
    });
  }

  function updateSettings(updater) {
    setSettings((current) => normalizePricingSettings(typeof updater === 'function' ? updater(current) : updater));
  }

  function updateForm(setter, field) {
    return (event) => {
      const value = event.target.value;
      setter((current) => ({
        ...current,
        [field]: value,
      }));
    };
  }

  function updateInvoiceSetting(field) {
    return (event) => {
      const value = event.target.value;
      setInvoiceSettings((current) => ({
        ...current,
        [field]: value,
      }));
      if (invoiceSettingsMessage) setInvoiceSettingsMessage('');
    };
  }

  function updateInvoiceValue(field) {
    return (nextValue) => {
      setInvoiceSettings((current) => ({
        ...current,
        [field]: nextValue,
      }));
      if (invoiceSettingsMessage) setInvoiceSettingsMessage('');
    };
  }

  function updateAccountPreference(field) {
    return (event) => {
      const value = event.target.value;
      setAccountPreferences((current) => ({
        ...current,
        [field]: value,
      }));
      if (accountSettingsMessage) {
        setAccountSettingsMessage('');
        setAccountSettingsMessageTone('info');
      }
    };
  }

  function updateAccountPreferenceValue(field) {
    return (nextValue) => {
      setAccountPreferences((current) => ({
        ...current,
        [field]: nextValue,
      }));
      if (accountSettingsMessage) {
        setAccountSettingsMessage('');
        setAccountSettingsMessageTone('info');
      }
    };
  }

  async function saveAccountSettingsPage(event) {
    event.preventDefault();

    if (accountSettingsIsSaving) return;

    const nextPreferences = normalizeAccountPreferences(accountPreferences);

    if (accountPreferencesMatch(nextPreferences, savedAccountPreferences)) {
      setAccountSettingsMessage('Tidak ada perubahan preferensi yang perlu disimpan.');
      setAccountSettingsMessageTone('info');
      return;
    }

    setAccountSettingsIsSaving(true);
    setAccountSettingsMessage('');
    setAccountSettingsMessageTone('info');

    try {
      writeAccountPreferences(currentUser?.uid, nextPreferences);
      setAccountPreferences(nextPreferences);
      setSavedAccountPreferences(nextPreferences);

      if (currentUser?.uid) {
        await updateDoc(doc(firestoreDb, 'users', currentUser.uid), {
          preferences: nextPreferences,
          updatedAt: new Date().toISOString()
        });
        setAccountSettingsMessage('Account settings berhasil disimpan dan disinkronkan ke cloud.');
        setAccountSettingsMessageTone('success');
      } else {
        setAccountSettingsMessage('Account settings berhasil disimpan di perangkat ini.');
        setAccountSettingsMessageTone('success');
      }
    } catch (err) {
      console.error('Gagal menyimpan preferensi account:', err);

      if (accountPreferencesMatch(nextPreferences, readAccountPreferences(currentUser?.uid))) {
        setSavedAccountPreferences(nextPreferences);
        setAccountSettingsMessage('Preferensi tersimpan di perangkat, tetapi sinkronisasi cloud belum berhasil.');
        setAccountSettingsMessageTone('warning');
      } else {
        setAccountSettingsMessage('Preferensi belum berhasil disimpan. Coba kembali.');
        setAccountSettingsMessageTone('error');
      }
    } finally {
      setAccountSettingsIsSaving(false);
    }
  }

  function resetAccountSettingsPage() {
    const nextPreferences = normalizeAccountPreferences(defaultAccountPreferences);

    setAccountPreferences(nextPreferences);
    setAccountSettingsMessage('Nilai default sudah dimuat sebagai draft. Tekan Simpan Preferensi untuk menerapkannya.');
    setAccountSettingsMessageTone('info');
  }

  async function copyAccountUid() {
    const uid = currentUser?.uid || '';

    if (!uid) {
      setAccountCopyMessage('UID akun belum tersedia.');
      return;
    }

    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(uid);
        setAccountCopyMessage('UID akun berhasil disalin.');
        return;
      }

      setAccountCopyMessage('Clipboard browser tidak tersedia.');
    } catch (err) {
      console.error('Gagal menyalin UID akun:', err);
      setAccountCopyMessage('UID akun belum berhasil disalin.');
    }
  }

  function updateAccountProfileField(field) {
    return (event) => {
      const value = event.target.value;

      setAccountProfileForm((current) => ({
        ...current,
        [field]: value,
      }));

      if (accountProfileMessage) {
        setAccountProfileMessage('');
        setAccountProfileMessageTone('info');
      }
    };
  }

  async function saveAccountProfilePage(event) {
    event.preventDefault();

    if (accountProfileIsSaving) return;

    const cleanDisplayName = accountProfileForm.displayName.trim();

    if (cleanDisplayName.length < 2) {
      setAccountProfileMessage('Nama tampilan minimal 2 karakter.');
      setAccountProfileMessageTone('error');
      return;
    }

    if (cleanDisplayName.length > 60) {
      setAccountProfileMessage('Nama tampilan maksimal 60 karakter.');
      setAccountProfileMessageTone('error');
      return;
    }

    if (cleanDisplayName === accountProfileSavedName) {
      setAccountProfileMessage('Nama tampilan belum berubah.');
      setAccountProfileMessageTone('info');
      return;
    }

    setAccountProfileIsSaving(true);
    setAccountProfileMessage('');
    setAccountProfileMessageTone('info');

    try {
      const updatedProfile = await adminAuthRepository.updateAdminProfile({
        displayName: cleanDisplayName,
      });
      const savedDisplayName = String(
        updatedProfile.displayName || cleanDisplayName
      ).trim();

      setAccountProfileForm({
        displayName: savedDisplayName,
      });
      setAccountProfileSavedName(savedDisplayName);
      setAccountProfileMessage('Profil akun berhasil diperbarui.');
      setAccountProfileMessageTone('success');
    } catch (err) {
      console.error('Gagal menyimpan profil akun:', err);
      setAccountProfileMessage(err?.message || 'Profil akun belum berhasil diperbarui.');
      setAccountProfileMessageTone('error');
    } finally {
      setAccountProfileIsSaving(false);
    }
  }

  function updateAccountPasswordField(field) {
    return (event) => {
      const value = event.target.value;

      setAccountPasswordForm((current) => ({
        ...current,
        [field]: value,
      }));

      if (accountPasswordMessage) {
        setAccountPasswordMessage('');
        setAccountPasswordHasError(false);
      }
    };
  }

  async function saveAccountPasswordPage(event) {
    event.preventDefault();

    const newPassword = accountPasswordForm.newPassword;
    const confirmPassword = accountPasswordForm.confirmPassword;

    if (newPassword.length < 6) {
      setAccountPasswordMessage('Password baru minimal 6 karakter.');
      setAccountPasswordHasError(true);
      return;
    }

    if (newPassword !== confirmPassword) {
      setAccountPasswordMessage('Konfirmasi password baru belum sama.');
      setAccountPasswordHasError(true);
      return;
    }

    setAccountPasswordIsSaving(true);
    setAccountPasswordMessage('');
    setAccountPasswordHasError(false);

    try {
      const result = await adminAuthRepository.changeAdminPassword({
        currentPassword: accountPasswordForm.currentPassword,
        newPassword,
      });

      if (Array.isArray(result?.user?.providerIds)) {
        setAccountSecurityProviderIds(result.user.providerIds);
      }

      setAccountPasswordForm({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });

      setAccountPasswordMessage(
        result?.mode === 'linked'
          ? 'Password login berhasil dibuat. Akun ini sekarang bisa login dengan Google maupun email/password.'
          : 'Password akun berhasil diganti.'
      );
    } catch (err) {
      console.error('Gagal memperbarui password akun:', err);
      setAccountPasswordMessage(
        adminAuthRepository.getAdminPasswordErrorMessage?.(err) ||
        err?.message ||
        'Password akun belum berhasil diperbarui.'
      );
      setAccountPasswordHasError(true);
    } finally {
      setAccountPasswordIsSaving(false);
    }
  }

  async function sendPasswordResetPage() {
    if (accountPasswordResetIsSending) return;

    setAccountPasswordResetIsSending(true);
    setAccountPasswordMessage('');
    setAccountPasswordHasError(false);

    try {
      await adminAuthRepository.sendAdminPasswordReset(currentUser?.email);
      setAccountPasswordMessage('Email reset password sudah dikirim.');
      setAccountPasswordHasError(false);
    } catch (err) {
      console.error('Gagal mengirim reset password:', err);
      setAccountPasswordMessage(
        err?.message || 'Email reset password belum berhasil dikirim.'
      );
      setAccountPasswordHasError(true);
    } finally {
      setAccountPasswordResetIsSending(false);
    }
  }

  function clearStudioFieldFeedback(field) {
    setStudioValidationErrors((current) => {
      if (!current[field]) return current;

      const nextErrors = { ...current };
      delete nextErrors[field];
      return nextErrors;
    });
    setStudioSettingsMessage('');
    setStudioSettingsMessageTone('info');
  }

  function updateStudioSetting(field) {
    return (event) => {
      const rawValue = event.target.value;
      const value = field === 'bankAccountNumber'
        ? rawValue.replace(/\D/g, '').slice(0, 24)
        : rawValue;

      setStudioSettings((current) => ({
        ...current,
        [field]: value,
      }));
      clearStudioFieldFeedback(field);
    };
  }

  function updateStudioTerm(index) {
    return (event) => {
      const value = event.target.value;

      setStudioSettings((current) => {
        const currentTerms = Array.isArray(current.paymentTerms) && current.paymentTerms.length
          ? current.paymentTerms
          : [''];

        return {
          ...current,
          paymentTerms: currentTerms.map((term, termIndex) =>
            termIndex === index ? value : term
          ),
        };
      });
      clearStudioFieldFeedback('paymentTerms');
    };
  }

  function addStudioPaymentTerm() {
    if (studioPaymentTerms.length >= STUDIO_PAYMENT_TERM_LIMIT) {
      setStudioSettingsMessage('Maksimal 12 ketentuan pembayaran.');
      setStudioSettingsMessageTone('warning');
      return;
    }

    setStudioSettings((current) => {
      const currentTerms = Array.isArray(current.paymentTerms) && current.paymentTerms.length
        ? current.paymentTerms
        : [''];

      return {
        ...current,
        paymentTerms: [...currentTerms, ''],
      };
    });
    clearStudioFieldFeedback('paymentTerms');
  }

  function removeStudioPaymentTerm(index) {
    setStudioSettings((current) => {
      const currentTerms = Array.isArray(current.paymentTerms) && current.paymentTerms.length
        ? current.paymentTerms
        : [''];

      if (currentTerms.length <= 1) return current;

      return {
        ...current,
        paymentTerms: currentTerms.filter((_term, termIndex) => termIndex !== index),
      };
    });
    clearStudioFieldFeedback('paymentTerms');
  }

  async function saveStudioSettingsPage(event) {
    event.preventDefault();
    if (studioSettingsIsSaving) return;

    const validationErrors = getStudioValidationErrors(studioSettings);

    if (Object.keys(validationErrors).length) {
      setStudioValidationErrors(validationErrors);
      setStudioSettingsMessage('Periksa kembali field yang ditandai sebelum menyimpan.');
      setStudioSettingsMessageTone('danger');
      return;
    }

    setStudioSettingsIsSaving(true);
    setStudioSettingsMessage('');
    setStudioSettingsMessageTone('info');

    try {
      const nextSettings = await saveStudioSettings({
        ...normalizeStudioSettings(studioSettings),
        updatedAt: new Date().toISOString(),
      });

      setStudioSettings(nextSettings);
      setSavedStudioSettings(nextSettings);
      setStudioValidationErrors({});
      setStudioSettingsMessage('Studio settings berhasil disimpan.');
      setStudioSettingsMessageTone('success');
    } catch (err) {
      console.error('Failed to save studio settings:', err);
      setStudioSettingsMessage('Gagal menyimpan studio settings ke Firestore. Coba lagi.');
      setStudioSettingsMessageTone('danger');
    } finally {
      setStudioSettingsIsSaving(false);
    }
  }

  function resetStudioSettingsPage() {
    setStudioSettings(normalizeStudioSettings(defaultStudioSettings));
    setStudioValidationErrors({});
    setStudioSettingsMessage('Default dimuat sebagai draft. Tekan Simpan untuk menerapkannya.');
    setStudioSettingsMessageTone('warning');
  }

  function restoreSavedStudioSettingsPage() {
    setStudioSettings(savedStudioSettings);
    setStudioValidationErrors({});
    setStudioSettingsMessage('Perubahan draft dibatalkan.');
    setStudioSettingsMessageTone('info');
  }

  async function saveInvoiceSettingsPage(event) {
    event.preventDefault();

    try {
      const nextSettings = await saveInvoiceSettings({
        ...defaultInvoiceSettings,
        ...invoiceSettings,
        updatedAt: new Date().toISOString(),
      });

      setInvoiceSettings(nextSettings);
      setInvoiceSettingsMessage('Invoice settings berhasil disimpan.');
    } catch (err) {
      console.error('Failed to save invoice settings:', err);
      setInvoiceSettingsMessage('Gagal menyimpan invoice settings.');
    }
  }

  async function resetInvoiceSettingsPage() {
    try {
      const nextSettings = await saveInvoiceSettings({
        ...defaultInvoiceSettings,
        updatedAt: new Date().toISOString(),
      });

      setInvoiceSettings(nextSettings);
      setInvoiceSettingsMessage('Invoice settings dikembalikan ke default.');
    } catch (err) {
      console.error('Failed to reset invoice settings:', err);
      setInvoiceSettingsMessage('Gagal mengembalikan settings ke default.');
    }
  }

  function saveSession(event) {
    event.preventDefault();

    const cleanName = sessionForm.name.trim();
    if (!cleanName) return;

    const itemId = sessionForm.id || makeSettingItemId('session');
    const isRecordingSession = isRecordingSessionId(itemId);

    const item = {
      id: itemId,
      name: cleanName,
      description: isRecordingSession
        ? 'Harga dan durasi mengikuti Recording Type'
        : sessionForm.description.trim() || 'Session studio',
      price: isRecordingSession ? 0 : toNumber(sessionForm.price),
      locked: sessionForm.id ? settings.sessions.find((session) => session.id === sessionForm.id)?.locked : false,
    };

    updateSettings((current) => {
      const exists = current.sessions.some((session) => session.id === item.id);

      return {
        ...current,
        sessions: exists
          ? current.sessions.map((session) => (session.id === item.id ? item : session))
          : [...current.sessions, item],
      };
    });

    setSessionForm(emptySessionForm);
  }

  function editSession(item) {
    setSessionForm({
      id: item.id,
      name: item.name,
      description: item.description,
      price: String(item.price),
    });
  }

  function deleteSession(id) {
    updateSettings((current) => {
      const nextSessions = current.sessions.filter((item) => item.id !== id);
      const fallbackSessionId = nextSessions[0]?.id || 'rehearsal';

      return {
        ...current,
        sessions: nextSessions,
        discounts: current.discounts.map((discount) => ({
          ...discount,
          sessionId: discount.sessionId === id ? fallbackSessionId : discount.sessionId,
        })),
      };
    });
  }

  function saveDiscount(event) {
    event.preventDefault();

    const item = {
      id: discountForm.id || makeSettingItemId('discount'),
      nominal: toNumber(discountForm.nominal),
      durationHours: toNumber(discountForm.durationHours),
      sessionId: discountForm.sessionId || sessionOptions[0]?.key || 'rehearsal',
    };

    if (!item.nominal || !item.durationHours) return;

    updateSettings((current) => {
      const exists = current.discounts.some((discount) => discount.id === item.id);

      return {
        ...current,
        discounts: exists
          ? current.discounts.map((discount) => (discount.id === item.id ? item : discount))
          : [...current.discounts, item],
      };
    });

    setDiscountForm({
      ...emptyDiscountForm,
      sessionId: sessionOptions[0]?.key || 'rehearsal',
    });
  }

  function editDiscount(item) {
    setDiscountForm({
      id: item.id,
      nominal: String(item.nominal),
      durationHours: item.durationHours ? String(item.durationHours) : '',
      sessionId: item.sessionId,
    });
  }

  function deleteDiscount(id) {
    updateSettings((current) => ({
      ...current,
      discounts: current.discounts.filter((item) => item.id !== id),
    }));
  }

  function saveRecording(event) {
    event.preventDefault();

    const cleanName = recordingForm.name.trim();
    const item = {
      id: recordingForm.id || makeSettingItemId('recording'),
      name: cleanName,
      durationHours: toNumber(recordingForm.durationHours),
      price: toNumber(recordingForm.price),
    };

    if (!item.name || !item.price) return;

    updateSettings((current) => {
      const exists = current.recordingTypes.some((recording) => recording.id === item.id);

      return {
        ...current,
        recordingTypes: exists
          ? current.recordingTypes.map((recording) => (recording.id === item.id ? item : recording))
          : [...current.recordingTypes, item],
      };
    });

    setRecordingForm(emptyRecordingForm);
  }

  function editRecording(item) {
    setRecordingForm({
      id: item.id,
      name: item.name,
      durationHours: String(item.durationHours),
      price: String(item.price),
    });
  }

  function deleteRecording(id) {
    updateSettings((current) => ({
      ...current,
      recordingTypes: current.recordingTypes.filter((item) => item.id !== id),
    }));
  }

  function savePackage(event) {
    event.preventDefault();

    const cleanName = packageForm.name.trim();
    const item = {
      id: packageForm.id || makeSettingItemId('package'),
      name: cleanName,
      detail: packageForm.detail.trim() || 'Detail paket belum diisi',
      durationHours: toNumber(packageForm.durationHours),
      price: toNumber(packageForm.price),
    };

    if (!item.name || !item.price) return;

    updateSettings((current) => {
      const exists = current.packages.some((packageItem) => packageItem.id === item.id);

      return {
        ...current,
        packages: exists
          ? current.packages.map((packageItem) => (packageItem.id === item.id ? item : packageItem))
          : [...current.packages, item],
      };
    });

    setPackageForm(emptyPackageForm);
  }

  function editPackage(item) {
    setPackageForm({
      id: item.id,
      name: item.name,
      detail: item.detail,
      durationHours: item.durationHours ? String(item.durationHours) : '',
      price: String(item.price),
    });
  }

  function deletePackage(id) {
    updateSettings((current) => ({
      ...current,
      packages: current.packages.filter((item) => item.id !== id),
    }));
  }

  function getSessionLabel(sessionId) {
    return sessionOptions.find((item) => item.key === sessionId)?.label || 'Session';
  }

  async function refreshDangerZoneDryRun() {
    if (!isOwner) {
      setDangerMessage('Aksi ini hanya tersedia untuk Owner.');
      return;
    }

    setDangerIsLoading(true);
    setDangerMessage('Menghitung dry-run di server...');
    const requestKey = createAdminOperationKey('danger-dry-run', currentUser?.uid);
    dangerDryRunKeyRef.current = requestKey;

    try {
      const response = await adminOperationsRepository.createDangerZoneDryRun(requestKey);
      setDangerDryRun(response);
      setDangerJob(null);
      setDangerJobInUrl('', { replace: true });
      setDangerMessage('Dry-run baru siap. Periksa project, environment, dan jumlah dokumen.');
    } catch (error) {
      setDangerMessage(error?.message || 'Dry-run belum dapat dibuat.');
    } finally {
      setDangerIsLoading(false);
    }
  }

  async function handleDangerZoneDeleteAllData() {
    if (!isOwner) {
      setDangerMessage('Aksi ini hanya tersedia untuk Owner.');
      return;
    }

    if (dangerConfirmText !== DANGER_ZONE_CONFIRM_TEXT || !dangerFinalCheck) {
      setDangerMessage('Ketik teks konfirmasi dan aktifkan checkbox final terlebih dahulu.');
      return;
    }

    if (!dangerDryRun?.snapshotId) {
      setDangerMessage('Dry-run server wajib selesai sebelum reset dapat dimulai.');
      return;
    }

    setConfirmConfig({
      title: 'Hapus Seluruh Data?',
      message: `Project ${dangerDryRun.projectId || 'unknown'} (${dangerDryRun.environment || 'unknown'}) akan menjalankan reset terproteksi. Data tidak dapat dikembalikan dari UI.`,
      confirmLabel: 'Lanjut',
      onConfirm: () => {
        setConfirmConfig({
          title: 'Konfirmasi Terakhir',
          message: `Hapus ${Number(dangerDryRun.totalDocuments || 0)} dokumen sesuai dry-run? Owner aktif, Firebase Auth users, dan file Cloudinary tetap dipertahankan.`,
          confirmLabel: 'Ya, Mulai Server Job',
          onConfirm: async () => {
            setDangerIsDeleting(true);
            setDangerMessage('Memverifikasi ulang sesi Owner...');

            try {
              await adminAuthRepository.reauthenticateCurrentAdmin({
                password: sensitiveCurrentPassword,
              });
              setSensitiveCurrentPassword('');

              const response = await adminOperationsRepository.startDangerZoneJob({
                confirmationPhrase: dangerConfirmText,
                finalConfirmation: dangerFinalCheck,
                snapshotId: dangerDryRun.snapshotId,
              });
              const nextJob = response.job || null;
              setDangerJob(nextJob);
              setDangerDryRun(null);
              if (nextJob?.id) setDangerJobInUrl(nextJob.id, { replace: true });
              setDangerMessage('Server job dimulai. Setiap batch menyimpan checkpoint agar aman dilanjutkan setelah refresh.');
            } catch (error) {
              setDangerIsDeleting(false);
              setSensitiveCurrentPassword('');
              setDangerMessage(error?.message || 'Server job belum dapat dimulai.');
              throw error;
            }
          }
        });
      }
    });
  }

  useEffect(() => {
    if (typeof document === 'undefined') return undefined;

    document.body.classList.toggle('is-admin-permission-modal-open', Boolean(selectedPermissionUser));

    return () => {
      document.body.classList.remove('is-admin-permission-modal-open');
    };
  }, [selectedPermissionUser]);

  const activePageInfo = useMemo(() => {
    return subpages.find((page) => page.key === resolvedActiveSubpage) || subpages[0];
  }, [subpages, resolvedActiveSubpage]);

  const studioPaymentTerms = Array.isArray(studioSettings.paymentTerms) && studioSettings.paymentTerms.length
    ? studioSettings.paymentTerms
    : [''];
  const studioSettingsIsDirty = !studioDraftsMatch(studioSettings, savedStudioSettings);
  const studioDefaultIsLoaded = studioDraftsMatch(studioSettings, defaultStudioSettings);
  const studioSetupProgress = getStudioSetupProgress(studioSettings);
  const studioNamePreview = String(studioSettings.studioName || '').trim() || 'Nama studio belum diisi';
  const studioPhonePreview = String(studioSettings.studioPhone || '').trim() || 'Nomor kontak belum diisi';
  const studioAddressPreview = String(studioSettings.studioAddress || '').trim() || 'Alamat studio belum diisi';
  const studioBankNamePreview = String(studioSettings.bankName || '').trim() || 'Bank belum diisi';
  const studioBankHolderPreview = String(studioSettings.bankAccountHolder || '').trim() || 'Pemilik belum diisi';
  const studioBankAccountPreview = formatBankAccountNumber(studioSettings.bankAccountNumber);
  const studioQrisLabelPreview = String(studioSettings.qrisLabel || '').trim() || 'Label QRIS belum diisi';
  const studioQrisNotePreview = String(studioSettings.qrisNote || '').trim() || 'Catatan QRIS belum diisi';

  const accountProviderView = {
    ...currentUser,
    providerIds: accountSecurityProviderIds,
  };
  const accountProviderLabel = getAccountProviderLabel(accountProviderView);
  const accountHasGoogleProvider = accountSecurityProviderIds.includes('google.com');
  const accountHasPasswordProvider = accountSecurityProviderIds.includes('password');
  const accountNeedsCurrentPassword = accountHasPasswordProvider && !accountHasGoogleProvider;
  const dangerCollectionRows = dangerJob?.collections || (
    Array.isArray(dangerDryRun?.collections)
      ? dangerDryRun.collections.map((row) => ({
          ...row,
          deleted: 0,
          estimated: Number(row.count || 0),
          status: Number(row.count || 0) > 0 ? 'ready' : 'empty',
        }))
      : dangerZoneCollections.map((row) => ({
          collectionId: row.collectionName,
          deleted: 0,
          estimated: 0,
          label: row.label,
          preserved: 0,
          status: 'waiting',
        }))
  );
  const dangerTotalEstimated = dangerCollectionRows.reduce(
    (sum, row) => sum + Number(row.estimated ?? row.count ?? 0),
    0,
  );
  const dangerTotalDeleted = dangerCollectionRows.reduce(
    (sum, row) => sum + Number(row.deleted || 0),
    0,
  );
  const dangerTotalPreserved = dangerCollectionRows.reduce(
    (sum, row) => sum + Number(row.preserved || 0),
    0,
  );
  const dangerErrorCount = dangerCollectionRows.filter((row) => row.error).length;
  const dangerEnvironment = dangerJob || dangerDryRun || {};
  const accountCanManagePassword = Boolean(
    currentUser?.email &&
    (accountHasGoogleProvider || accountHasPasswordProvider)
  );
  const accountPasswordActionLabel = accountHasGoogleProvider && !accountPasswordForm.currentPassword
    ? accountHasPasswordProvider
      ? 'Verifikasi Google & Ganti'
      : 'Verifikasi Google & Buat Password'
    : accountHasPasswordProvider
      ? 'Ganti Password'
      : 'Buat Password';
  const accountRoleLabel = getAccountRoleLabel(currentUser);
  const accountStatusLabel = getAccountStatusLabel(currentUser);
  const accountContactValue = currentUser?.email || currentUser?.phoneNumber || 'Belum tersedia';
  const accountUidLabel = getMaskedUid(currentUser?.uid);
  const accountPreferredContactLabel = getOptionLabel(accountContactOptions, accountPreferences.preferredContact, 'Email');
  const accountLandingLabel = getOptionLabel(accountLandingOptions, accountPreferences.defaultLandingKey, 'Dashboard');
  const accountNotificationLabel = getOptionLabel(accountNotificationOptions, accountPreferences.notificationLevel, 'Penting Saja');
  const accountProfileCleanName = accountProfileForm.displayName.trim();
  const accountProfileIsDirty = accountProfileCleanName !== accountProfileSavedName;
  const accountPreferencesIsDirty = !accountPreferencesMatch(
    accountPreferences,
    savedAccountPreferences
  );
  const accountPreferencesAreDefault = accountPreferencesMatch(
    accountPreferences,
    defaultAccountPreferences
  );
  const accountPasswordStrength = getAccountPasswordStrength(
    accountPasswordForm.newPassword
  );
  const accountPasswordConfirmationMatches = Boolean(
    accountPasswordForm.confirmPassword &&
    accountPasswordForm.newPassword === accountPasswordForm.confirmPassword
  );
  const accountPasswordCanSubmit = Boolean(
    accountCanManagePassword &&
    accountPasswordForm.newPassword.length >= 6 &&
    accountPasswordConfirmationMatches &&
    (
      !accountNeedsCurrentPassword ||
      accountPasswordForm.currentPassword
    ) &&
    !accountPasswordIsSaving
  );
  const accountPendingChangeCount =
    Number(accountProfileIsDirty) +
    Number(accountPreferencesIsDirty);
  const accountHealthChecks = [
    {
      complete: Boolean(accountProfileSavedName),
      label: 'Profil',
    },
    {
      complete: accountContactValue !== 'Belum tersedia',
      label: 'Kontak',
    },
    {
      complete: accountStatusLabel === 'Approved',
      label: 'Akses',
    },
    {
      complete: Boolean(
        accountHasGoogleProvider ||
        accountHasPasswordProvider
      ),
      label: 'Login',
    },
    {
      complete: Boolean(
        !currentUser?.email ||
        currentUser?.emailVerified
      ),
      label: 'Verifikasi',
    },
  ];
  const accountHealthCompleted = accountHealthChecks.filter(
    (item) => item.complete
  ).length;
  const accountHealthPercent = Math.round(
    (
      accountHealthCompleted /
      accountHealthChecks.length
    ) *
    100
  );
  const accountHealthLabel =
    accountHealthPercent === 100
      ? 'Siap'
      : accountHealthPercent >= 60
        ? 'Perlu ditinjau'
        : 'Perlu dilengkapi';

  return (
    <>
      <section
      className={
        resolvedActiveSubpage === 'account'
          ? 'settings-page is-account-settings'
          : resolvedActiveSubpage === 'user-settings'
            ? 'settings-page is-user-settings'
            : resolvedActiveSubpage === 'danger'
              ? 'settings-page is-danger-settings'
              : resolvedActiveSubpage === 'fee-settings'
                ? 'settings-page is-fee-settings'
                : resolvedActiveSubpage === 'studio'
                  ? 'settings-page is-studio-settings'
                  : 'settings-page'
      }
      data-settings-ui="ui-12-spatial"
      aria-labelledby="settings-current-page-title"
    >
      <div className="settings-command-mobile">
        <StudioSelect
          label="Settings Area"
          options={subpages}
          selectedKey={resolvedActiveSubpage}
          onChange={setSettingsArea}
        />
      </div>

      <div className="settings-workspace-grid">
        <aside className="settings-navigation-panel" aria-label="Settings navigation">
          <div className="settings-navigation-intro">
            <small>Settings map</small>
            <strong>Control room</strong>
            <span>Pilih area konfigurasi tanpa kehilangan konteks workspace.</span>
          </div>

          <div className="settings-navigation-list" role="tablist" aria-label="Settings subpage">
            {subpages.map((item, index) => (
              <button
                aria-selected={resolvedActiveSubpage === item.key}
                className={resolvedActiveSubpage === item.key ? 'settings-navigation-tab is-active' : 'settings-navigation-tab'}
                key={item.key}
                role="tab"
                type="button"
                onClick={() => setSettingsArea(item.key)}
              >
                <span className="settings-navigation-index" aria-hidden="true">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <span className="settings-navigation-copy">
                  <small>{getSettingsGroupLabel(item.key)}</small>
                  <strong>{item.label}</strong>
                  <em>{item.description}</em>
                </span>
              </button>
            ))}
          </div>

          <div className="settings-navigation-safety">
            <ShieldCheck size={16} aria-hidden="true" />
            <span>
              <strong>Safe editing</strong>
              <small>Perubahan UI tidak mengubah schema, route, atau permission semantics.</small>
            </span>
          </div>
        </aside>

        <main className="settings-workspace-content" aria-label={activePageInfo.label}>
          <div className="settings-current-context">
            <span>{getSettingsGroupLabel(resolvedActiveSubpage)}</span>
            <strong id="settings-current-page-title">{activePageInfo.label}</strong>
            <small>{activePageInfo.description}</small>
          </div>

      {resolvedActiveSubpage === 'account' && (
        <section
          aria-label="Account settings"
          className="settings-account-grid settings-account-control-center"
          data-account-settings-ui="ui-12a-control-center"
        >
          <section
            aria-labelledby="settings-account-title"
            className="settings-section settings-account-hero-strip"
          >
            <div className="settings-account-avatar-sm" aria-hidden="true">
              <UserRound size={19} />
            </div>

            <div className="settings-account-hero-copy">
              <p>Admin account</p>
              <h3 id="settings-account-title">
                {accountProfileCleanName || currentUser?.email || currentUser?.phoneNumber || 'Admin 37 Music'}
              </h3>
              <span>{accountContactValue}</span>
            </div>

            <div className="settings-account-badges" aria-label="Status akun">
              <span className="settings-account-badge is-approved">
                <ShieldCheck size={12} />
                {accountStatusLabel}
              </span>
              <span className="settings-account-badge">
                <KeyRound size={12} />
                {accountRoleLabel}
              </span>
            </div>

            <div className="settings-account-health">
              <div>
                <span>Account health</span>
                <strong>{accountHealthPercent}% · {accountHealthLabel}</strong>
              </div>
              <span
                aria-label={'Kelengkapan account ' + accountHealthPercent + ' persen'}
                aria-valuemax="100"
                aria-valuemin="0"
                aria-valuenow={accountHealthPercent}
                className="settings-account-health-track"
                role="progressbar"
              >
                <i style={{ '--account-health-progress': accountHealthPercent + '%' }} />
              </span>
            </div>

            <div
              aria-live="polite"
              className={
                accountPendingChangeCount
                  ? 'settings-account-save-state is-dirty'
                  : 'settings-account-save-state is-saved'
              }
            >
              {accountPendingChangeCount ? (
                <RefreshCcw size={14} aria-hidden="true" />
              ) : (
                <ShieldCheck size={14} aria-hidden="true" />
              )}
              <span>
                <strong>
                  {accountPendingChangeCount
                    ? accountPendingChangeCount + ' perubahan'
                    : 'Tersimpan'}
                </strong>
                <small>
                  {accountPendingChangeCount
                    ? 'Belum diterapkan'
                    : 'Tidak ada draft'}
                </small>
              </span>
            </div>
          </section>

          <div className="settings-account-layout">
            <aside className="settings-account-overview" aria-label="Ringkasan account">
              <section className="settings-section">
                <div className="settings-section-heading">
                  <span>Identity</span>
                  <h3 className="settings-section-title">Identitas Login</h3>
                  <p>Data utama yang terhubung ke autentikasi admin.</p>
                </div>

                <div className="settings-info-flat-list">
                  <div className="settings-info-flat-row">
                    <span className="settings-info-flat-icon"><Mail size={13} /></span>
                    <span className="settings-info-flat-label">Email</span>
                    <strong className="settings-info-flat-value" title={currentUser?.email || 'Belum tersedia'}>{currentUser?.email || '—'}</strong>
                  </div>

                  <div className="settings-info-flat-row">
                    <span className="settings-info-flat-icon"><Phone size={13} /></span>
                    <span className="settings-info-flat-label">Nomor HP</span>
                    <strong className="settings-info-flat-value" title={currentUser?.phoneNumber || 'Belum tersedia'}>{currentUser?.phoneNumber || '—'}</strong>
                  </div>

                  <div className="settings-info-flat-row">
                    <span className="settings-info-flat-icon"><MonitorSmartphone size={13} /></span>
                    <span className="settings-info-flat-label">Provider</span>
                    <strong className="settings-info-flat-value">{accountProviderLabel}</strong>
                  </div>

                  <div className="settings-info-flat-row">
                    <span className="settings-info-flat-icon"><KeyRound size={13} /></span>
                    <span className="settings-info-flat-label">User ID</span>
                    <strong className="settings-info-flat-value" title={currentUser?.uid || accountUidLabel}>{accountUidLabel}</strong>
                  </div>
                </div>
              </section>

              <section className="settings-section">
                <div className="settings-section-head-row">
                  <div className="settings-section-heading">
                    <span>Security</span>
                    <h3 className="settings-section-title">Access &amp; Security</h3>
                  </div>
                  <button className="settings-mini-button" type="button" onClick={copyAccountUid}>
                    <Clipboard size={13} />
                    Copy UID
                  </button>
                </div>

                <div className="settings-security-check-grid">
                  {accountHealthChecks.map((item) => (
                    <span
                      className={
                        item.complete
                          ? 'settings-security-check is-complete'
                          : 'settings-security-check'
                      }
                      key={item.label}
                    >
                      <ShieldCheck size={13} aria-hidden="true" />
                      {item.label}
                    </span>
                  ))}
                </div>

                <div className="settings-security-flat-list">
                  <div className="settings-security-flat-row">
                    <ShieldCheck size={14} />
                    <span className="settings-security-label">Status akses</span>
                    <span className="settings-security-value">{accountStatusLabel}</span>
                  </div>

                  <div className="settings-security-flat-row">
                    <Mail size={14} />
                    <span className="settings-security-label">Verifikasi email</span>
                    <span className="settings-security-value">{currentUser?.emailVerified ? 'Verified' : 'Belum verified'}</span>
                  </div>

                  <div className="settings-security-flat-row">
                    <MonitorSmartphone size={14} />
                    <span className="settings-security-label">Login aktif</span>
                    <span className="settings-security-value">{accountProviderLabel}</span>
                  </div>
                </div>

                {accountCopyMessage ? (
                  <p className="settings-account-message is-info" role="status">{accountCopyMessage}</p>
                ) : null}
              </section>
            </aside>

            <div className="settings-account-editor">
              <section className="settings-section">
                <div className="settings-section-heading">
                  <span>Profile</span>
                  <h3 className="settings-section-title">Profil Akun</h3>
                  <p>Nama ini tampil di header, aktivitas, dan approval admin.</p>
                </div>

                <form
                  aria-busy={accountProfileIsSaving}
                  className="settings-account-form-compact"
                  onSubmit={saveAccountProfilePage}
                >
                  <StudioTextField
                    id="account-profile-display-name"
                    label="Nama Tampilan"
                    placeholder="Contoh: Owner 37 Music"
                    value={accountProfileForm.displayName}
                    onChange={updateAccountProfileField('displayName')}
                  />

                  <div className="settings-field-status">
                    <span>{accountProfileCleanName.length}/60 karakter</span>
                    <strong>{accountProfileIsDirty ? 'Draft berubah' : 'Sudah tersimpan'}</strong>
                  </div>

                  {accountProfileMessage ? (
                    <p
                      className={'settings-account-message is-' + accountProfileMessageTone}
                      role={accountProfileMessageTone === 'error' ? 'alert' : 'status'}
                    >
                      {accountProfileMessage}
                    </p>
                  ) : null}

                  <div className="settings-account-actions-row">
                    <button
                      className="settings-mini-button is-primary"
                      disabled={!accountProfileIsDirty || accountProfileIsSaving}
                      type="submit"
                    >
                      <Save size={14} />
                      {accountProfileIsSaving ? 'Menyimpan...' : 'Simpan Profil'}
                    </button>
                  </div>
                </form>
              </section>

              <section className="settings-section settings-password-security-section">
                <div className="settings-section-head-row">
                  <div className="settings-section-heading">
                    <span>Sign-in</span>
                    <h3 className="settings-section-title">Password &amp; Sign-in</h3>
                    <p>Kelola kredensial tanpa memutus provider yang sudah aktif.</p>
                  </div>
                  <span className={
                    accountHasGoogleProvider
                      ? 'settings-password-provider-badge is-google'
                      : accountHasPasswordProvider
                        ? 'settings-password-provider-badge is-password'
                        : 'settings-password-provider-badge'
                  }>
                    {accountHasGoogleProvider
                      ? accountHasPasswordProvider
                        ? 'Google + Password'
                        : 'Google-only'
                      : accountHasPasswordProvider
                        ? 'Password'
                        : 'Provider lain'}
                  </span>
                </div>

                <div className={
                  accountHasGoogleProvider
                    ? 'settings-password-provider-note is-google'
                    : 'settings-password-provider-note'
                }>
                  <KeyRound size={16} aria-hidden="true" />
                  <span>
                    <strong>
                      {accountHasGoogleProvider
                        ? accountHasPasswordProvider
                          ? 'Verifikasi perubahan lewat Google'
                          : 'Buat password tanpa memutus login Google'
                        : accountHasPasswordProvider
                          ? 'Verifikasi dengan password saat ini'
                          : 'Password belum tersedia untuk provider ini'}
                    </strong>
                    <small>
                      {accountHasGoogleProvider
                        ? accountHasPasswordProvider
                          ? 'Isi password saat ini untuk verifikasi langsung, atau kosongkan untuk verifikasi Google. Login Google tetap aktif.'
                          : 'Setelah verifikasi Google, login email/password ditambahkan ke UID Firebase yang sama.'
                        : accountHasPasswordProvider
                          ? 'Password lama hanya dipakai untuk re-authentication dan tidak pernah disimpan.'
                          : 'Akun perlu memiliki email dan provider Google atau Email/Password untuk mengelola password.'}
                    </small>
                  </span>
                </div>

                {accountCanManagePassword ? (
                  <form
                    aria-busy={accountPasswordIsSaving}
                    className="settings-account-form-compact"
                    onSubmit={saveAccountPasswordPage}
                  >
                    <div className={
                      accountNeedsCurrentPassword
                        ? 'settings-password-form-grid is-three-field'
                        : 'settings-password-form-grid'
                    }>
                      {accountHasPasswordProvider ? (
                        <StudioTextField
                          autoComplete="current-password"
                          helper={accountHasGoogleProvider ? 'Opsional · verifikasi Google jika kosong' : undefined}
                          id="account-password-current"
                          label="Password Saat Ini"
                          placeholder="Masukkan password saat ini"
                          required={accountNeedsCurrentPassword}
                          type="password"
                          value={accountPasswordForm.currentPassword}
                          onChange={updateAccountPasswordField('currentPassword')}
                        />
                      ) : null}

                      <StudioTextField
                        autoComplete="new-password"
                        id="account-password-new"
                        label={accountHasPasswordProvider ? 'Password Baru' : 'Buat Password'}
                        placeholder="Minimal 6 karakter"
                        required
                        type="password"
                        value={accountPasswordForm.newPassword}
                        onChange={updateAccountPasswordField('newPassword')}
                      />

                      <StudioTextField
                        autoComplete="new-password"
                        id="account-password-confirm"
                        label="Ulangi Password Baru"
                        placeholder="Ketik ulang password baru"
                        required
                        type="password"
                        value={accountPasswordForm.confirmPassword}
                        onChange={updateAccountPasswordField('confirmPassword')}
                      />
                    </div>

                    <div
                      aria-live="polite"
                      className={'settings-password-strength is-' + accountPasswordStrength.tone}
                    >
                      <div className="settings-password-strength-head">
                        <span>Kekuatan password</span>
                        <strong>{accountPasswordStrength.label}</strong>
                      </div>
                      <span className="settings-password-strength-track" aria-hidden="true">
                        <i style={{ '--password-strength-progress': accountPasswordStrength.percent + '%' }} />
                      </span>
                      <div className="settings-password-checks">
                        {accountPasswordStrength.checks.map((item) => (
                          <span className={item.complete ? 'is-complete' : ''} key={item.key}>
                            <ShieldCheck size={12} aria-hidden="true" />
                            {item.label}
                          </span>
                        ))}
                        <span className={accountPasswordConfirmationMatches ? 'is-complete' : ''}>
                          <ShieldCheck size={12} aria-hidden="true" />
                          Konfirmasi sama
                        </span>
                      </div>
                    </div>

                    {accountPasswordMessage ? (
                      <p
                        className={
                          accountPasswordHasError
                            ? 'settings-password-message is-error'
                            : 'settings-password-message is-success'
                        }
                        role={accountPasswordHasError ? 'alert' : 'status'}
                      >
                        {accountPasswordMessage}
                      </p>
                    ) : null}

                    <div className="settings-account-actions-row">
                      {accountHasPasswordProvider ? (
                        <button
                          className="settings-mini-button is-ghost"
                          disabled={accountPasswordIsSaving || accountPasswordResetIsSending || !currentUser?.email}
                          type="button"
                          onClick={sendPasswordResetPage}
                        >
                          {accountPasswordResetIsSending ? 'Mengirim...' : 'Kirim Email Reset'}
                        </button>
                      ) : null}

                      <button
                        className="settings-mini-button is-primary"
                        disabled={!accountPasswordCanSubmit}
                        type="submit"
                      >
                        <KeyRound size={14} />
                        {accountPasswordIsSaving ? 'Memverifikasi...' : accountPasswordActionLabel}
                      </button>
                    </div>
                  </form>
                ) : (
                  <p className="settings-password-message is-error" role="status">
                    Provider akun saat ini belum mendukung perubahan password dari halaman ini.
                  </p>
                )}
              </section>

              <section className="settings-section">
                <div className="settings-section-heading">
                  <span>Preferences</span>
                  <h3 className="settings-section-title">Preferensi Account</h3>
                  <p>Pilihan disimpan per akun dan disinkronkan ke cloud saat tersedia.</p>
                </div>

                <form
                  aria-busy={accountSettingsIsSaving}
                  className="settings-account-form-compact"
                  onSubmit={saveAccountSettingsPage}
                >
                  <div className="settings-prefs-selects">
                    <StudioSelect
                      label="Halaman Awal"
                      options={accountLandingOptions}
                      selectedKey={accountPreferences.defaultLandingKey}
                      onChange={updateAccountPreferenceValue('defaultLandingKey')}
                    />

                    <StudioSelect
                      label="Kontak Utama"
                      options={accountContactOptions}
                      selectedKey={accountPreferences.preferredContact}
                      onChange={updateAccountPreferenceValue('preferredContact')}
                    />

                    <StudioSelect
                      label="Level Notifikasi"
                      options={accountNotificationOptions}
                      selectedKey={accountPreferences.notificationLevel}
                      onChange={updateAccountPreferenceValue('notificationLevel')}
                    />
                  </div>

                  <label className="settings-account-note-field" htmlFor="account-setting-note">
                    <span className="settings-field-label-row">
                      <span>Catatan Account</span>
                      <small>{accountPreferences.accountNote.length}/240</small>
                    </span>
                    <textarea
                      id="account-setting-note"
                      maxLength={240}
                      placeholder="Contoh: akun owner utama, dipakai untuk approval admin..."
                      value={accountPreferences.accountNote}
                      onChange={updateAccountPreference('accountNote')}
                    />
                  </label>

                  <div className="settings-prefs-summary-grid" aria-label="Preview preferensi">
                    <span><small>Landing</small><strong>{accountLandingLabel}</strong></span>
                    <span><small>Kontak</small><strong>{accountPreferredContactLabel}</strong></span>
                    <span><small>Notifikasi</small><strong>{accountNotificationLabel}</strong></span>
                  </div>

                  {accountSettingsMessage ? (
                    <p
                      className={'settings-account-message is-' + accountSettingsMessageTone}
                      role={accountSettingsMessageTone === 'error' ? 'alert' : 'status'}
                    >
                      {accountSettingsMessage}
                    </p>
                  ) : null}

                  <div className="settings-account-actions-row">
                    <button
                      className="settings-mini-button is-ghost"
                      disabled={accountSettingsIsSaving || accountPreferencesAreDefault}
                      type="button"
                      onClick={resetAccountSettingsPage}
                    >
                      <RefreshCcw size={14} />
                      Muat Default
                    </button>
                    <button
                      className="settings-mini-button is-primary"
                      disabled={!accountPreferencesIsDirty || accountSettingsIsSaving}
                      type="submit"
                    >
                      <Save size={14} />
                      {accountSettingsIsSaving ? 'Menyimpan...' : 'Simpan Preferensi'}
                    </button>
                  </div>
                </form>
              </section>
            </div>
          </div>
        </section>
      )}

      {resolvedActiveSubpage === 'fee-settings' && isOwnerAdminUser(currentUser) && (
        <OperatorFeeSettingsPanel currentUser={currentUser} />
      )}

      {resolvedActiveSubpage === 'danger' && isOwnerAdminUser(currentUser) && (
        <section className="settings-section settings-owner-danger-zone" aria-label="Danger zone reset data app">
          <div className="settings-danger-hero">
            <span className="settings-danger-icon" aria-hidden="true">
              <DatabaseZap size={24} />
            </span>
            <div>
              <p>Owner Only</p>
              <h3>Hapus Seluruh Data App</h3>
              <span>
                Reset berjalan sebagai server job terproteksi dan resumable. Refresh halaman tidak mengulang batch yang sudah memiliki checkpoint.
              </span>
            </div>
          </div>

          <div className="settings-danger-environment" aria-label="Target Danger Zone">
            <span>
              <small>Firebase project</small>
              <strong>{dangerEnvironment.projectId || 'Memuat...'}</strong>
            </span>
            <span>
              <small>Environment</small>
              <strong>{dangerEnvironment.environment || 'Memuat...'}</strong>
            </span>
            <span>
              <small>{dangerJob ? 'Job ID' : 'Dry-run snapshot'}</small>
              <strong>{dangerJob?.id || dangerDryRun?.snapshotId || 'Belum tersedia'}</strong>
            </span>
          </div>

          <div className="settings-danger-alert">
            <ShieldAlert size={18} />
            <div>
              <strong>Aksi permanen</strong>
              <p>
                Firestore docs sesuai dry-run akan dihapus. Owner aktif dipertahankan. Firebase Auth users dan file Cloudinary berada di luar job ini dan tidak dihapus.
              </p>
            </div>
          </div>

          <div className="settings-danger-exclusions" aria-label="Data yang dipertahankan">
            <span><ShieldCheck size={14} /> Owner aktif · {dangerTotalPreserved || 1} doc dipertahankan</span>
            <span><ShieldCheck size={14} /> Firebase Auth users · {dangerEnvironment.externalData?.firebaseAuthUsers || 'retained'}</span>
            <span><ShieldCheck size={14} /> File Cloudinary · {dangerEnvironment.externalData?.cloudinaryFiles || 'retained'}</span>
          </div>

          <div className="settings-danger-collections" aria-label="Daftar data yang akan dihapus">
            {dangerCollectionRows.map((progress) => {
              const statusLabel =
                progress.status === 'done'
                  ? 'Selesai'
                  : progress.status === 'empty'
                    ? 'Kosong'
                    : progress.status === 'error'
                      ? 'Gagal'
                      : progress.status === 'running'
                        ? 'Menghapus'
                        : progress.status === 'pending'
                          ? 'Antre'
                          : progress.status === 'waiting'
                            ? 'Memuat'
                            : 'Siap';
              const estimated = Number(progress.estimated ?? progress.count ?? 0);

              return (
                <article className={'settings-danger-collection is-' + (progress.status || 'idle')} key={progress.collectionId}>
                  <span>
                    <strong>{progress.label}</strong>
                    <small>
                      {progress.collectionId}
                      {Number(progress.preserved || 0) ? ` · ${progress.preserved} preserved` : ''}
                      {progress.truncated ? ' · count dibatasi safety limit' : ''}
                    </small>
                  </span>
                  <em>{statusLabel} · {Number(progress.deleted || 0)}/{estimated} docs</em>
                  {progress.error ? <p>{progress.error}</p> : null}
                </article>
              );
            })}
          </div>

          <div className="settings-danger-confirm">
            <label htmlFor="danger-confirm-text">
              <span>Ketik teks konfirmasi</span>
              <strong>{DANGER_ZONE_CONFIRM_TEXT}</strong>
              <input
                autoComplete="off"
                disabled={dangerIsDeleting || Boolean(dangerJob)}
                id="danger-confirm-text"
                placeholder={DANGER_ZONE_CONFIRM_TEXT}
                value={dangerConfirmText}
                onChange={(event) => {
                  setDangerConfirmText(event.target.value);
                  if (dangerMessage) setDangerMessage('');
                }}
              />
            </label>

            <label className="settings-danger-check" htmlFor="danger-final-check">
              <input
                checked={dangerFinalCheck}
                disabled={dangerIsDeleting || Boolean(dangerJob)}
                id="danger-final-check"
                type="checkbox"
                onChange={(event) => {
                  setDangerFinalCheck(event.target.checked);
                  if (dangerMessage) setDangerMessage('');
                }}
              />
              <span>Saya paham data operasional akan dihapus permanen dari Firestore.</span>
            </label>

            {accountNeedsCurrentPassword && !dangerJob ? (
              <label htmlFor="danger-current-password">
                <span>Verifikasi password Owner</span>
                <input
                  autoComplete="current-password"
                  disabled={dangerIsDeleting}
                  id="danger-current-password"
                  type="password"
                  value={sensitiveCurrentPassword}
                  onChange={(event) => setSensitiveCurrentPassword(event.target.value)}
                />
                <small>Password hanya dipakai untuk Firebase reauthentication dan tidak disimpan.</small>
              </label>
            ) : null}
          </div>

          {dangerMessage ? (
            <p className="settings-danger-message" role="status">
              <AlertTriangle size={15} />
              {dangerMessage}
            </p>
          ) : null}

          <div className="settings-danger-summary">
            <span>Estimasi dry-run: <strong>{dangerTotalEstimated}</strong></span>
            <span>Total terhapus: <strong>{dangerTotalDeleted}</strong></span>
            <span>Error collection: <strong>{dangerErrorCount}</strong></span>
          </div>

          <div className="settings-form-actions settings-danger-actions">
            <button
              className="settings-mini-button is-ghost"
              disabled={dangerIsDeleting}
              type="button"
              onClick={refreshDangerZoneDryRun}
            >
              <RefreshCcw size={15} />
              {dangerIsLoading ? 'Menghitung...' : 'Refresh Dry-run'}
            </button>

            {dangerJob && dangerJob.status !== 'completed' ? (
              <button
                className="settings-mini-button is-danger"
                disabled={dangerIsDeleting}
                type="button"
                onClick={() => setDangerResumeToken((current) => current + 1)}
              >
                <RefreshCcw size={15} />
                {dangerIsDeleting ? 'Job Berjalan...' : 'Lanjutkan Job'}
              </button>
            ) : (
              <button
                className="settings-mini-button is-danger"
                disabled={
                  dangerIsDeleting ||
                  dangerIsLoading ||
                  !dangerDryRun?.snapshotId ||
                  dangerConfirmText !== DANGER_ZONE_CONFIRM_TEXT ||
                  !dangerFinalCheck ||
                  (accountNeedsCurrentPassword && !sensitiveCurrentPassword)
                }
                type="button"
                onClick={handleDangerZoneDeleteAllData}
              >
                <Trash2 size={15} />
                {dangerIsDeleting ? 'Memulai Job...' : 'Hapus Seluruh Data App'}
              </button>
            )}
          </div>
        </section>
      )}

      {resolvedActiveSubpage === 'studio' && (
        <section
          aria-labelledby="settings-studio-control-title"
          className="settings-studio-control-center"
          data-studio-settings-ui="ui-12b-studio-control-center"
        >
          <section className="settings-section settings-studio-command-strip">
            <div className="settings-studio-command-icon" aria-hidden="true">
              <Building2 size={19} />
            </div>

            <div className="settings-studio-command-copy">
              <p>Studio workspace</p>
              <h3 id="settings-studio-control-title">{studioNamePreview}</h3>
              <span>Identitas operasional, kanal pembayaran, dan aturan booking dalam satu workspace.</span>
            </div>

            <div className="settings-studio-command-badges" aria-label="Status Studio Settings">
              <span className="settings-studio-command-badge is-readiness">
                <CheckCircle2 size={12} />
                {studioSetupProgress.percent}% siap
              </span>
              <span className={'settings-studio-command-badge ' + (studioSettingsIsDirty ? 'is-dirty' : 'is-saved')}>
                {studioSettingsIsDirty ? <AlertTriangle size={12} /> : <ShieldCheck size={12} />}
                {studioSettingsIsDirty ? 'Draft berubah' : 'Tersimpan'}
              </span>
            </div>

            <div className="settings-studio-command-health" aria-label={'Kelengkapan ' + studioSetupProgress.percent + '%'}>
              <div>
                <span>Setup readiness</span>
                <strong>{studioSetupProgress.completed}/{studioSetupProgress.total} area lengkap</strong>
              </div>
              <span className="settings-studio-health-track" aria-hidden="true">
                <span style={{ width: studioSetupProgress.percent + '%' }} />
              </span>
            </div>
          </section>

          <form className="settings-studio-form" noValidate onSubmit={saveStudioSettingsPage}>
            <div className="settings-studio-layout">
              <div className="settings-studio-editor">
                <section className="settings-section settings-studio-panel" aria-labelledby="settings-studio-identity-title">
                  <div className="settings-studio-panel-heading">
                    <span className="settings-studio-panel-icon" aria-hidden="true">
                      <Building2 size={16} />
                    </span>
                    <span>
                      <small>Identity</small>
                      <h3 id="settings-studio-identity-title">Identitas Studio</h3>
                      <p>Informasi utama yang muncul di invoice dan kanal komunikasi pelanggan.</p>
                    </span>
                  </div>

                  <div className="settings-studio-grid">
                    <StudioTextField
                      autoComplete="organization"
                      className="settings-studio-field"
                      error={studioValidationErrors.studioName}
                      helper="Wajib"
                      id="studio-setting-name"
                      label="Nama Studio"
                      placeholder="37 Music Studio"
                      required
                      value={studioSettings.studioName}
                      onChange={updateStudioSetting('studioName')}
                    />

                    <StudioTextField
                      autoComplete="tel"
                      className="settings-studio-field"
                      error={studioValidationErrors.studioPhone}
                      helper="Opsional"
                      id="studio-setting-phone"
                      inputMode="tel"
                      label="WhatsApp / Telepon"
                      placeholder="08xxxxxxxxxx"
                      value={studioSettings.studioPhone}
                      onChange={updateStudioSetting('studioPhone')}
                    />
                  </div>

                  <label className="settings-studio-textarea-field" htmlFor="studio-setting-address">
                    <span className="settings-studio-field-head">
                      <span>Alamat Studio</span>
                      <small>Opsional · tampil di invoice</small>
                    </span>
                    <textarea
                      id="studio-setting-address"
                      maxLength={180}
                      placeholder="Jl. Studio No. 37, Tangerang"
                      rows={3}
                      value={studioSettings.studioAddress}
                      onChange={updateStudioSetting('studioAddress')}
                    />
                  </label>
                </section>

                <section className="settings-section settings-studio-panel" aria-labelledby="settings-studio-payment-title">
                  <div className="settings-studio-panel-heading">
                    <span className="settings-studio-panel-icon" aria-hidden="true">
                      <Landmark size={16} />
                    </span>
                    <span>
                      <small>Payments</small>
                      <h3 id="settings-studio-payment-title">Transfer &amp; QRIS</h3>
                      <p>Rekening tujuan dan instruksi pembayaran yang dibaca pelanggan.</p>
                    </span>
                  </div>

                  <div className="settings-studio-grid settings-studio-grid-3">
                    <StudioTextField
                      className="settings-studio-field"
                      error={studioValidationErrors.bankName}
                      helper="Wajib"
                      id="studio-setting-bank-name"
                      label="Nama Bank"
                      placeholder="Bank BCA"
                      required
                      value={studioSettings.bankName}
                      onChange={updateStudioSetting('bankName')}
                    />

                    <StudioTextField
                      className="settings-studio-field"
                      error={studioValidationErrors.bankAccountNumber}
                      helper="Wajib"
                      id="studio-setting-bank-account"
                      inputMode="numeric"
                      label="Nomor Rekening"
                      placeholder="3728902822"
                      required
                      value={studioSettings.bankAccountNumber}
                      onChange={updateStudioSetting('bankAccountNumber')}
                    />

                    <StudioTextField
                      autoComplete="name"
                      className="settings-studio-field"
                      error={studioValidationErrors.bankAccountHolder}
                      helper="Wajib"
                      id="studio-setting-bank-holder"
                      label="Nama Pemilik"
                      placeholder="37 MUSIC STUDIO"
                      required
                      value={studioSettings.bankAccountHolder}
                      onChange={updateStudioSetting('bankAccountHolder')}
                    />
                  </div>

                  <div className="settings-studio-qris-grid">
                    <StudioTextField
                      className="settings-studio-field"
                      error={studioValidationErrors.qrisLabel}
                      helper="Wajib"
                      id="studio-setting-qris-label"
                      label="Label QRIS"
                      placeholder="Scan di kasir studio"
                      required
                      value={studioSettings.qrisLabel}
                      onChange={updateStudioSetting('qrisLabel')}
                    />

                    <StudioTextField
                      className="settings-studio-field"
                      helper="Opsional"
                      id="studio-setting-qris-note"
                      label="Catatan QRIS"
                      placeholder="Mendukung GoPay, OVO, ShopeePay"
                      value={studioSettings.qrisNote}
                      onChange={updateStudioSetting('qrisNote')}
                    />
                  </div>
                </section>

                <section className="settings-section settings-studio-panel settings-studio-terms-panel" aria-labelledby="settings-studio-terms-title">
                  <div className="settings-studio-terms-heading">
                    <div className="settings-studio-panel-heading">
                      <span className="settings-studio-panel-icon" aria-hidden="true">
                        <WalletCards size={16} />
                      </span>
                      <span>
                        <small>Booking rules</small>
                        <h3 id="settings-studio-terms-title">Ketentuan Pembayaran</h3>
                        <p>Susun informasi DP, pelunasan, dan pembatalan sesuai urutan baca.</p>
                      </span>
                    </div>

                    <div className="settings-studio-terms-tools">
                      <span>{studioPaymentTerms.length}/{STUDIO_PAYMENT_TERM_LIMIT}</span>
                      <button
                        className="settings-mini-button is-ghost"
                        disabled={studioPaymentTerms.length >= STUDIO_PAYMENT_TERM_LIMIT || studioSettingsIsSaving}
                        type="button"
                        onClick={addStudioPaymentTerm}
                      >
                        + Tambah aturan
                      </button>
                    </div>
                  </div>

                  <div className="settings-payment-terms-list">
                    {studioPaymentTerms.map((term, index) => (
                      <div className="settings-payment-term-row" key={'studio-payment-term-' + index}>
                        <span className="settings-payment-term-index" aria-hidden="true">
                          {String(index + 1).padStart(2, '0')}
                        </span>
                        <textarea
                          aria-label={'Ketentuan pembayaran ' + (index + 1)}
                          id={'studio-setting-payment-term-' + index}
                          className="settings-payment-term-input"
                          maxLength={220}
                          placeholder="Tulis ketentuan pembayaran..."
                          rows={2}
                          value={term}
                          onChange={updateStudioTerm(index)}
                        />
                        <button
                          aria-label={'Hapus ketentuan ' + (index + 1)}
                          className="settings-term-delete-btn"
                          disabled={studioPaymentTerms.length <= 1 || studioSettingsIsSaving}
                          title={studioPaymentTerms.length <= 1 ? 'Minimal satu ketentuan' : 'Hapus ketentuan'}
                          type="button"
                          onClick={() => removeStudioPaymentTerm(index)}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))}
                  </div>

                  {studioValidationErrors.paymentTerms ? (
                    <p className="settings-studio-field-error" role="alert">{studioValidationErrors.paymentTerms}</p>
                  ) : null}

                  <p className="settings-studio-panel-note">
                    Urutan aturan di atas dipertahankan saat ditampilkan pada alur booking dan invoice.
                  </p>
                </section>
              </div>

              <aside className="settings-studio-sidebar" aria-label="Preview dan readiness Studio Settings">
                <section className="settings-section settings-studio-preview-card" aria-labelledby="settings-studio-preview-title">
                  <div className="settings-studio-panel-heading">
                    <span className="settings-studio-panel-icon" aria-hidden="true">
                      <MonitorSmartphone size={16} />
                    </span>
                    <span>
                      <small>Live preview</small>
                      <h3 id="settings-studio-preview-title">Tampilan Operasional</h3>
                      <p>Ringkasan data yang akan dibaca pelanggan dan admin.</p>
                    </span>
                  </div>

                  <div className="settings-studio-preview-identity">
                    <span className="settings-studio-preview-logo" aria-hidden="true">
                      <Building2 size={19} />
                    </span>
                    <span>
                      <small>Studio</small>
                      <strong>{studioNamePreview}</strong>
                    </span>
                  </div>

                  <div className="settings-studio-preview-contact">
                    <span>
                      <MessageCircle size={13} aria-hidden="true" />
                      {studioPhonePreview}
                    </span>
                    <span>
                      <MapPin size={13} aria-hidden="true" />
                      {studioAddressPreview}
                    </span>
                  </div>

                  <div className="settings-studio-preview-payment">
                    <div>
                      <span className="settings-studio-preview-payment-icon" aria-hidden="true">
                        <Landmark size={16} />
                      </span>
                      <span>
                        <small>{studioBankNamePreview}</small>
                        <strong>{studioBankAccountPreview}</strong>
                        <em>A/N {studioBankHolderPreview}</em>
                      </span>
                    </div>
                    <div>
                      <span className="settings-studio-preview-payment-icon" aria-hidden="true">
                        <QrCode size={16} />
                      </span>
                      <span>
                        <small>QRIS</small>
                        <strong>{studioQrisLabelPreview}</strong>
                        <em>{studioQrisNotePreview}</em>
                      </span>
                    </div>
                  </div>

                  <p className="settings-studio-preview-note">
                    Preview mengikuti draft secara langsung. Data publik baru berubah setelah disimpan.
                  </p>
                </section>

                <section className="settings-section settings-studio-readiness-card" aria-labelledby="settings-studio-readiness-title">
                  <div className="settings-studio-readiness-head">
                    <span>
                      <small>Configuration health</small>
                      <h3 id="settings-studio-readiness-title">Kesiapan Studio</h3>
                    </span>
                    <strong>{studioSetupProgress.percent}%</strong>
                  </div>

                  <div className="settings-studio-readiness-list">
                    {studioSetupProgress.checks.map((item) => (
                      <span className={item.complete ? 'is-complete' : 'is-incomplete'} key={item.key}>
                        {item.complete ? <CheckCircle2 size={13} /> : <AlertTriangle size={13} />}
                        {item.label}
                      </span>
                    ))}
                  </div>

                  <span className="settings-studio-health-track" aria-hidden="true">
                    <span style={{ width: studioSetupProgress.percent + '%' }} />
                  </span>
                </section>
              </aside>
            </div>

            <div
              className={
                'settings-studio-action-bar is-' +
                studioSettingsMessageTone +
                (studioSettingsIsDirty ? ' is-dirty' : ' is-saved')
              }
            >
              <div className="settings-studio-save-state" aria-live="polite" role="status">
                {studioSettingsMessageTone === 'danger' || studioSettingsMessageTone === 'warning'
                  ? <AlertTriangle size={16} />
                  : studioSettingsIsDirty
                    ? <RefreshCcw size={16} />
                    : <CheckCircle2 size={16} />}
                <span>
                  <strong>
                    {studioSettingsMessage || (studioSettingsIsDirty
                      ? 'Ada perubahan yang belum disimpan.'
                      : 'Semua perubahan sudah tersimpan.')}
                  </strong>
                  <small>
                    {studioSettingsIsSaving
                      ? 'Menyinkronkan data lokal dan Firestore...'
                      : studioSettingsIsDirty
                        ? 'Periksa live preview, lalu simpan saat sudah siap.'
                        : 'Draft lokal dan konfigurasi aktif sudah sinkron.'}
                  </small>
                </span>
              </div>

              <div className="settings-studio-actions">
                {studioSettingsIsDirty ? (
                  <button
                    className="settings-mini-button is-ghost"
                    disabled={studioSettingsIsSaving}
                    type="button"
                    onClick={restoreSavedStudioSettingsPage}
                  >
                    Batalkan
                  </button>
                ) : null}
                <button
                  className="settings-mini-button is-ghost"
                  disabled={studioDefaultIsLoaded || studioSettingsIsSaving}
                  type="button"
                  onClick={resetStudioSettingsPage}
                >
                  Muat Default
                </button>
                <button
                  className="settings-mini-button is-primary"
                  disabled={!studioSettingsIsDirty || studioSettingsIsSaving}
                  type="submit"
                >
                  <Save size={14} />
                  {studioSettingsIsSaving ? 'Menyimpan...' : 'Simpan Studio Settings'}
                </button>
              </div>
            </div>
          </form>
        </section>
      )}

      {resolvedActiveSubpage === 'pricing' && (
        <section className="settings-pricing-container" aria-label="Pricing and session settings">

          {/* ── SESSION LIST ────────────────────────────────── */}
          <section className="settings-section">
            <h3 className="settings-section-title">Session List</h3>

            <div className="settings-flat-pricing-list">
              {settings.sessions.length ? (
                settings.sessions.map((item) => (
                  <div className="settings-flat-pricing-row" key={item.id}>
                    <div className="settings-flat-row-header">
                      <strong className="settings-flat-row-title">{item.name}</strong>
                      <div className="settings-flat-row-actions">
                        <button type="button" className="settings-icon-action-btn" aria-label="Edit session" onClick={() => editSession(item)}>
                          <Edit3 size={13} />
                        </button>
                        <button type="button" className="settings-icon-action-btn is-delete" aria-label="Delete session" onClick={() => deleteSession(item.id)}>
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                    <div className="settings-flat-row-body">
                      <span className="settings-flat-row-desc">{item.description || 'Session studio'}</span>
                      <strong className="settings-flat-row-price">
                        {isRecordingSessionId(item.id) ? 'Recording Type' : formatRupiah(item.price) + ' / jam'}
                      </strong>
                    </div>
                  </div>
                ))
              ) : (
                <EmptyState>Belum ada session.</EmptyState>
              )}
            </div>

            <form className="settings-account-form-compact" onSubmit={saveSession}>
              <div className="settings-studio-grid">
                <StudioTextField
                  id="setting-session-name"
                  label="Nama Session"
                  placeholder="Contoh: Rehearsal"
                  value={sessionForm.name}
                  onChange={updateForm(setSessionForm, 'name')}
                />
                <StudioTextField
                  id="setting-session-description"
                  label="Deskripsi Kecil"
                  placeholder="Contoh: Latihan band reguler"
                  value={sessionForm.description}
                  onChange={updateForm(setSessionForm, 'description')}
                />
              </div>

              {isRecordingSessionId(sessionForm.id) ? (
                <p className="settings-empty-text">
                  Harga &amp; durasi mengikuti Recording Type.
                </p>
              ) : (
                <StudioTextField
                  id="setting-session-price"
                  className="is-currency"
                  inputMode="numeric"
                  label="Harga Sesi / Jam"
                  min="0"
                  placeholder="100000"
                  type="number"
                  value={sessionForm.price}
                  onChange={updateForm(setSessionForm, 'price')}
                />
              )}
              <FormActions editing={Boolean(sessionForm.id)} onCancel={() => setSessionForm(emptySessionForm)} />
            </form>
          </section>

          {/* ── DISCOUNT LIST ───────────────────────────────── */}
          <section className="settings-section">
            <h3 className="settings-section-title">Discount</h3>

            <div className="settings-flat-pricing-list">
              {settings.discounts.length ? (
                settings.discounts.map((item) => (
                  <div className="settings-flat-pricing-row" key={item.id}>
                    <div className="settings-flat-row-header">
                      <strong className="settings-flat-row-title">{formatRupiah(item.nominal)} Off</strong>
                      <div className="settings-flat-row-actions">
                        <button type="button" className="settings-icon-action-btn" aria-label="Edit discount" onClick={() => editDiscount(item)}>
                          <Edit3 size={13} />
                        </button>
                        <button type="button" className="settings-icon-action-btn is-delete" aria-label="Delete discount" onClick={() => deleteDiscount(item.id)}>
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                    <div className="settings-flat-row-body">
                      <span className="settings-flat-row-desc">{getSessionLabel(item.sessionId)}</span>
                      <strong className="settings-flat-row-price">{item.durationHours} jam</strong>
                    </div>
                  </div>
                ))
              ) : (
                <EmptyState>Belum ada discount.</EmptyState>
              )}
            </div>

            <form className="settings-account-form-compact" onSubmit={saveDiscount}>
              <div className="settings-studio-grid">
                <StudioTextField
                  id="setting-discount-nominal"
                  className="is-currency"
                  inputMode="numeric"
                  label="Nominal Discount"
                  min="0"
                  placeholder="25000"
                  type="number"
                  value={discountForm.nominal}
                  onChange={updateForm(setDiscountForm, 'nominal')}
                />
                <StudioTextField
                  id="setting-discount-duration"
                  inputMode="decimal"
                  label="Durasi (Jam)"
                  min="0"
                  placeholder="3"
                  step="0.5"
                  type="number"
                  value={discountForm.durationHours}
                  onChange={updateForm(setDiscountForm, 'durationHours')}
                />
              </div>
              <StudioSelect
                label="Tipe Session Discount"
                options={sessionOptions}
                selectedKey={discountForm.sessionId}
                onChange={(nextValue) => setDiscountForm((current) => ({ ...current, sessionId: nextValue }))}
              />
              <FormActions editing={Boolean(discountForm.id)} onCancel={() => setDiscountForm(emptyDiscountForm)} />
            </form>
          </section>

          {/* ── RECORDING TYPE LIST ─────────────────────────── */}
          <section className="settings-section">
            <h3 className="settings-section-title">Recording Type</h3>

            <div className="settings-flat-pricing-list">
              {settings.recordingTypes.length ? (
                settings.recordingTypes.map((item) => (
                  <div className="settings-flat-pricing-row" key={item.id}>
                    <div className="settings-flat-row-header">
                      <strong className="settings-flat-row-title">{item.name}</strong>
                      <div className="settings-flat-row-actions">
                        <button type="button" className="settings-icon-action-btn" aria-label="Edit recording type" onClick={() => editRecording(item)}>
                          <Edit3 size={13} />
                        </button>
                        <button type="button" className="settings-icon-action-btn is-delete" aria-label="Delete recording type" onClick={() => deleteRecording(item.id)}>
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                    <div className="settings-flat-row-body">
                      <span className="settings-flat-row-desc">{item.durationHours} jam</span>
                      <strong className="settings-flat-row-price">{formatRupiah(item.price)}</strong>
                    </div>
                  </div>
                ))
              ) : (
                <EmptyState>Belum ada tipe recording.</EmptyState>
              )}
            </div>

            <form className="settings-account-form-compact" onSubmit={saveRecording}>
              <StudioTextField
                id="setting-recording-name"
                label="Nama Tipe Recording"
                placeholder="Contoh: Live Multitrack"
                value={recordingForm.name}
                onChange={updateForm(setRecordingForm, 'name')}
              />
              <div className="settings-studio-grid">
                <StudioTextField
                  id="setting-recording-duration"
                  inputMode="decimal"
                  label="Durasi (Jam)"
                  min="0"
                  placeholder="3"
                  step="0.5"
                  type="number"
                  value={recordingForm.durationHours}
                  onChange={updateForm(setRecordingForm, 'durationHours')}
                />
                <StudioTextField
                  id="setting-recording-price"
                  className="is-currency"
                  inputMode="numeric"
                  label="Harga Sesi"
                  min="0"
                  placeholder="450000"
                  type="number"
                  value={recordingForm.price}
                  onChange={updateForm(setRecordingForm, 'price')}
                />
              </div>
              <FormActions editing={Boolean(recordingForm.id)} onCancel={() => setRecordingForm(emptyRecordingForm)} />
            </form>
          </section>

          {/* ── PACKAGE LIST ────────────────────────────────── */}
          <section className="settings-section">
            <h3 className="settings-section-title">Paket</h3>

            <div className="settings-flat-pricing-list">
              {settings.packages.length ? (
                settings.packages.map((item) => (
                  <div className="settings-flat-pricing-row" key={item.id}>
                    <div className="settings-flat-row-header">
                      <strong className="settings-flat-row-title">{item.name}</strong>
                      <div className="settings-flat-row-actions">
                        <button type="button" className="settings-icon-action-btn" aria-label="Edit package" onClick={() => editPackage(item)}>
                          <Edit3 size={13} />
                        </button>
                        <button type="button" className="settings-icon-action-btn is-delete" aria-label="Delete package" onClick={() => deletePackage(item.id)}>
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                    <div className="settings-flat-row-body">
                      <span className="settings-flat-row-desc">
                        {item.detail} {item.durationHours ? `(${item.durationHours} jam)` : '(Tanpa studio)'}
                      </span>
                      <strong className="settings-flat-row-price">{formatRupiah(item.price)}</strong>
                    </div>
                  </div>
                ))
              ) : (
                <EmptyState>Belum ada paket.</EmptyState>
              )}
            </div>

            <form className="settings-account-form-compact" onSubmit={savePackage}>
              <div className="settings-studio-grid">
                <StudioTextField
                  id="setting-package-name"
                  label="Nama Paket"
                  placeholder="Contoh: Rehearsal Bundle"
                  value={packageForm.name}
                  onChange={updateForm(setPackageForm, 'name')}
                />
                <StudioTextField
                  id="setting-package-detail"
                  label="Detail Fitur Paket"
                  placeholder="Contoh: Free recording, mineral water"
                  value={packageForm.detail}
                  onChange={updateForm(setPackageForm, 'detail')}
                />
              </div>
              <div className="settings-studio-grid">
                <StudioTextField
                  id="setting-package-duration"
                  inputMode="decimal"
                  label="Durasi Studio (Jam, Opsional)"
                  min="0"
                  placeholder="3"
                  step="0.5"
                  type="number"
                  value={packageForm.durationHours}
                  onChange={updateForm(setPackageForm, 'durationHours')}
                />
                <StudioTextField
                  id="setting-package-price"
                  className="is-currency"
                  inputMode="numeric"
                  label="Harga Paket"
                  min="0"
                  placeholder="350000"
                  type="number"
                  value={packageForm.price}
                  onChange={updateForm(setPackageForm, 'price')}
                />
              </div>
              <FormActions editing={Boolean(packageForm.id)} onCancel={() => setPackageForm(emptyPackageForm)} />
            </form>
          </section>

        </section>
      )}

      {resolvedActiveSubpage === 'invoice' && (
        <section className="settings-section" aria-label="Invoice settings">
          <h3 className="settings-section-title">Invoice Thermal</h3>

          <form className="settings-invoice-form" onSubmit={saveInvoiceSettingsPage}>
            <div className="settings-studio-grid">
              <StudioTextField
                id="invoice-setting-studio-name"
                label="Nama Studio"
                placeholder="37 Music Studio"
                value={invoiceSettings.studioName}
                onChange={updateInvoiceSetting('studioName')}
              />

              <StudioTextField
                id="invoice-setting-subtitle"
                label="Subtitle Invoice"
                placeholder="Invoice Digital"
                value={invoiceSettings.subtitle}
                onChange={updateInvoiceSetting('subtitle')}
              />
            </div>

            <div className="settings-studio-grid">
              <StudioTextField
                id="invoice-setting-phone"
                inputMode="tel"
                label="Nomor WA Studio"
                placeholder="08xxxxxxxxxx"
                value={invoiceSettings.phone}
                onChange={updateInvoiceSetting('phone')}
              />

              <StudioTextField
                id="invoice-setting-address"
                label="Alamat Singkat"
                placeholder="Contoh: Tangerang"
                value={invoiceSettings.address}
                onChange={updateInvoiceSetting('address')}
              />
            </div>

            {/* ── FORMAT NOTA & PAJAK ──────────────────────── */}
            <h3 className="settings-section-title settings-section-divider">Format Nota &amp; Pajak</h3>

            <div className="settings-studio-grid">
              <StudioTextField
                id="invoice-setting-prefix"
                label="Invoice Prefix"
                placeholder="INV-"
                value={invoiceSettings.invoicePrefix || ''}
                onChange={updateInvoiceSetting('invoicePrefix')}
              />
              <StudioTextField
                id="invoice-setting-starting-number"
                label="Starting Number"
                placeholder="001"
                value={invoiceSettings.startingNumber || ''}
                onChange={updateInvoiceSetting('startingNumber')}
              />
            </div>

            <div className="settings-tax-fees-row">
              <label className="settings-inline-toggle" htmlFor="invoice-setting-tax-enabled">
                <input
                  id="invoice-setting-tax-enabled"
                  type="checkbox"
                  checked={Boolean(invoiceSettings.taxEnabled)}
                  onChange={(e) => updateInvoiceValue('taxEnabled')(e.target.checked)}
                />
                <span className="settings-toggle-label">Aktifkan Pajak (Tax)</span>
              </label>

              <div className="settings-tax-percentage-field">
                <StudioTextField
                  id="invoice-setting-tax-percentage"
                  className="is-percentage"
                  type="number"
                  min="0"
                  max="100"
                  disabled={!invoiceSettings.taxEnabled}
                  label="Pajak (%)"
                  placeholder="11"
                  value={invoiceSettings.taxPercentage !== undefined ? invoiceSettings.taxPercentage : ''}
                  onChange={updateInvoiceSetting('taxPercentage')}
                />
              </div>
            </div>

            <StudioSelect
              label="Ukuran Kertas Thermal"
              options={paperSizeOptions}
              selectedKey={invoiceSettings.paperSize}
              onChange={updateInvoiceValue('paperSize')}
            />

            {/* ── FOOTER & SYARAT ──────────────────────────── */}
            <h3 className="settings-section-title settings-section-divider">Footer &amp; Syarat</h3>

            <label className="settings-textarea-field" htmlFor="invoice-setting-footer">
              <span>Catatan Footer</span>
              <textarea
                id="invoice-setting-footer"
                placeholder="Terima kasih sudah booking."
                rows={3}
                value={invoiceSettings.footer || ''}
                onChange={updateInvoiceSetting('footer')}
              />
            </label>

            <label className="settings-textarea-field" htmlFor="invoice-setting-terms">
              <span>Syarat &amp; Ketentuan</span>
              <textarea
                id="invoice-setting-terms"
                placeholder="Tulis syarat & ketentuan booking..."
                rows={3}
                value={invoiceSettings.termsAndConditions || ''}
                onChange={updateInvoiceSetting('termsAndConditions')}
              />
            </label>

            {/* Preview area */}
            <div className="settings-invoice-preview" aria-label="Preview invoice settings">
              <small>Preview Struk</small>
              <strong>{invoiceSettings.studioName || defaultInvoiceSettings.studioName}</strong>
              <span>{invoiceSettings.subtitle || defaultInvoiceSettings.subtitle}</span>
              {invoiceSettings.phone ? <span>WA: {invoiceSettings.phone}</span> : null}
              {invoiceSettings.address ? <span>{invoiceSettings.address}</span> : null}
              <span>Format: <strong>{invoiceSettings.invoicePrefix || 'INV-'}{invoiceSettings.startingNumber || '001'}</strong></span>
              {invoiceSettings.taxEnabled ? <span>Pajak: <strong>{invoiceSettings.taxPercentage || 0}%</strong></span> : null}
              <em>{invoiceSettings.paperSize || defaultInvoiceSettings.paperSize}</em>
            </div>

            {invoiceSettingsMessage ? (
              <p className="settings-invoice-message" role="status">{invoiceSettingsMessage}</p>
            ) : null}

            <div className="settings-invoice-actions-sticky">
              <button className="settings-mini-button is-ghost" type="button" onClick={resetInvoiceSettingsPage}>
                Reset Default
              </button>
              <button className="settings-mini-button is-primary" type="submit">
                <Save size={14} />
                Simpan Invoice Settings
              </button>
            </div>
          </form>
        </section>
      )}

      {resolvedActiveSubpage === 'user-settings' && isOwnerAdminUser(currentUser) && (
        <section className="settings-section settings-user-access-section">
          
          {/* ── OWNER MANAGED ACCOUNT PROVISIONING ── */}
          <div className="settings-section-head">
            <div>
              <h3>Buat Akun Portal</h3>
              <p>
                Buat akun login Admin atau Guard langsung dari Owner.
                Session Owner tetap aktif selama proses provisioning.
              </p>
            </div>
          </div>

          <form
            className="settings-account-form-compact"
            aria-label="Buat akun portal Admin atau Guard"
            onSubmit={handleProvisionPortalAccount}
          >
            <div className="settings-studio-grid">
              <StudioTextField
                autoComplete="off"
                id="owner-provision-display-name"
                label="Nama PIC / Nama Akun"
                placeholder="Contoh: Dede Karawang"
                required
                value={provisionAccountForm.displayName}
                onChange={updateProvisionAccountField('displayName')}
              />

              <StudioTextField
                autoComplete="off"
                id="owner-provision-email"
                label="Email Login"
                placeholder="pic@37studio.com"
                required
                type="email"
                value={provisionAccountForm.email}
                onChange={updateProvisionAccountField('email')}
              />
            </div>

            <div className="settings-studio-grid">
              <StudioTextField
                autoComplete="new-password"
                id="owner-provision-password"
                label="Password Awal"
                placeholder="Minimal 6 karakter"
                required
                type="password"
                value={provisionAccountForm.password}
                onChange={updateProvisionAccountField('password')}
              />

              <StudioTextField
                autoComplete="new-password"
                id="owner-provision-confirm-password"
                label="Ulangi Password"
                placeholder="Ketik ulang password"
                required
                type="password"
                value={provisionAccountForm.confirmPassword}
                onChange={updateProvisionAccountField('confirmPassword')}
              />
            </div>

            <div className="settings-studio-grid">
              <StudioSelect
                label="Role Portal"
                options={OWNER_PROVISION_ROLE_OPTIONS}
                selectedKey={provisionAccountForm.role}
                onChange={updateProvisionAccountValue('role')}
              />

              {provisionAccountForm.role === 'studio_guard' ? (
                guardProvisionOptions.length ? (
                  <StudioSelect
                    label="Identitas Crew Guard"
                    options={guardProvisionOptions}
                    selectedKey={provisionAccountForm.guardId}
                    onChange={updateProvisionAccountValue('guardId')}
                  />
                ) : (
                  <div className="settings-password-provider-note">
                    <ShieldAlert size={16} aria-hidden="true" />
                    <span>
                      <strong>Belum ada crew Guard aktif</strong>
                      <small>
                        Tambahkan crew ber-role Guard/Both di Fee Settings
                        sebelum membuat akun Guard.
                      </small>
                    </span>
                  </div>
                )
              ) : (
                <div className="settings-password-provider-note">
                  <ShieldCheck size={16} aria-hidden="true" />
                  <span>
                    <strong>Admin langsung aktif</strong>
                    <small>
                      Admin dibuat dengan permission default.
                      Hak akses bisa disesuaikan setelah akun dibuat.
                    </small>
                  </span>
                </div>
              )}
            </div>

            <div className="settings-password-provider-note">
              <KeyRound size={16} aria-hidden="true" />
              <span>
                <strong>Password tidak disimpan di database aplikasi</strong>
                <small>
                  Password hanya dikirim ke Firebase Authentication dan
                  ditampilkan sementara setelah akun berhasil dibuat.
                </small>
              </span>
            </div>

            {provisionAccountMessage ? (
              <p
                className={
                  provisionAccountHasError
                    ? 'settings-password-message is-error'
                    : 'settings-password-message is-success'
                }
                role={provisionAccountHasError ? 'alert' : 'status'}
              >
                {provisionAccountMessage}
              </p>
            ) : null}

            <div className="settings-account-actions-row">
              <button
                className="settings-mini-button is-primary"
                disabled={
                  provisionAccountIsSaving ||
                  (
                    provisionAccountForm.role === 'studio_guard' &&
                    !provisionAccountForm.guardId
                  )
                }
                type="submit"
              >
                <UserRound size={14} />
                {provisionAccountIsSaving
                  ? 'Membuat Akun...'
                  : 'Buat Akun & Aktifkan'}
              </button>
            </div>
          </form>

          {provisionedCredentials ? (
            <div
              aria-label="Kredensial akun baru"
              className="settings-password-provider-note is-google"
            >
              <KeyRound size={18} aria-hidden="true" />

              <span style={{ width: '100%' }}>
                <strong>Kredensial siap diberikan</strong>
                <small>
                  Salin sekarang. Password tidak disimpan di Firestore
                  dan receipt ini hilang saat halaman direfresh.
                </small>

                <div className="settings-info-flat-list" style={{ marginTop: '10px' }}>
                  <div className="settings-info-flat-row">
                    <span className="settings-info-flat-label">Nama</span>
                    <strong className="settings-info-flat-value">
                      {provisionedCredentials.displayName}
                    </strong>
                  </div>

                  <div className="settings-info-flat-row">
                    <span className="settings-info-flat-label">Role</span>
                    <strong className="settings-info-flat-value">
                      {provisionedCredentials.roleLabel}
                    </strong>
                  </div>

                  <div className="settings-info-flat-row">
                    <span className="settings-info-flat-label">Email</span>
                    <strong className="settings-info-flat-value">
                      {provisionedCredentials.email}
                    </strong>
                  </div>

                  <div className="settings-info-flat-row">
                    <span className="settings-info-flat-label">Password</span>
                    <strong className="settings-info-flat-value">
                      {provisionedCredentials.password}
                    </strong>
                  </div>

                  <div className="settings-info-flat-row">
                    <span className="settings-info-flat-label">Login</span>
                    <strong className="settings-info-flat-value">
                      {provisionedCredentials.loginPath}
                    </strong>
                  </div>
                </div>

                <div className="settings-account-actions-row" style={{ marginTop: '10px' }}>
                  <button
                    className="settings-mini-button is-primary"
                    type="button"
                    onClick={copyProvisionedCredentials}
                  >
                    <Clipboard size={14} />
                    Copy Kredensial
                  </button>

                  <button
                    className="settings-mini-button is-ghost"
                    type="button"
                    onClick={() => setProvisionedCredentials(null)}
                  >
                    Tutup Receipt
                  </button>
                </div>
              </span>
            </div>
          ) : null}

          {/* ── SEKSI 1: REQUEST REGISTER BARU ── */}
          {approvalUsers.length ? (
            <div className="settings-pending-approvals-block">
              <h3 className="settings-section-title">Pending Approvals</h3>
              <div className="settings-pending-list">
                {approvalUsers.map((user) => (
                  <article className="is-pending-item" key={user.id}>
                    <div className="settings-user-profile-col">
                      <div className="settings-user-avatar-micro" aria-hidden="true">
                        {(user.displayName || user.email || 'U').slice(0, 1).toUpperCase()}
                      </div>
                      <div className="settings-user-info-stacked">
                        <strong className="settings-user-name-inline">{user.displayName || 'User Admin Baru'}</strong>
                        <span className="settings-user-email-inline">{user.email || user.phoneNumber || getMaskedUid(user.id)}</span>
                      </div>
                    </div>

                    <div className="settings-user-controls-col">
                      <button
                        type="button"
                        aria-label="Setujui user"
                        title="Setujui user"
                        onClick={() => handleApproveUser(user.id)}
                        className="settings-mini-button is-primary settings-approval-icon-button is-approve"
                        style={{ height: '26px', minHeight: '26px', padding: '0 8px', fontSize: '10px' }}
                      >
                        <ShieldCheck size={11} />
                        Setujui
                      </button>

                      <button
                        type="button"
                        aria-label="Tolak request admin"
                        title="Tolak request admin"
                        onClick={() => handleRejectUser(user.id)}
                        className="settings-icon-action-btn is-delete"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          ) : null}

          {accountNeedsCurrentPassword ? (
            <div className="settings-sensitive-auth settings-section-divider">
              <ShieldCheck size={17} aria-hidden="true" />
              <label htmlFor="ownership-current-password">
                <span>Verifikasi untuk transfer ownership</span>
                <input
                  autoComplete="current-password"
                  id="ownership-current-password"
                  placeholder="Password Owner saat ini"
                  type="password"
                  value={sensitiveCurrentPassword}
                  onChange={(event) => setSensitiveCurrentPassword(event.target.value)}
                />
                <small>Password hanya berada di memori form, dipakai saat reauthentication, lalu langsung dibersihkan.</small>
              </label>
            </div>
          ) : (
            <div className="settings-sensitive-auth settings-section-divider">
              <ShieldCheck size={17} aria-hidden="true" />
              <span>
                <strong>Fresh authentication aktif</strong>
                <small>Transfer ownership akan membuka verifikasi Google sebelum memanggil server.</small>
              </span>
            </div>
          )}

          {/* ── SEKSI 2: DAFTAR AKUN PORTAL TIM AKTIF ── */}
          <div className="settings-section-head settings-section-divider">
            <div>
              <h3>Akun Portal Tim Aktif</h3>
              <p>Daftar akun Owner, Admin, dan Penjaga. Atur role, kepemilikan, dan izin akses halaman.</p>
            </div>
          </div>

          <div className="settings-user-access-list">
            {usersLoading ? (
              <p className="settings-empty-text">Memuat daftar user...</p>
            ) : portalUsers.length ? (
              portalUsers.map((user) => {
                const assignablePages = getAssignablePermissionPages(user);
                const enabledCount = countEnabledAdminPermissions(user.permissions, user.role);
                const canEditPermissions = user.role !== 'owner';
                const guardIdentityLink =
                  user.role === 'studio_guard'
                    ? getGuardIdentityLink(user.guardId)
                    : null;
                const guardIdentityNeedsRepair =
                  Boolean(
                    guardIdentityLink &&
                    !guardIdentityLink.isValid
                  );

                return (
                  <article className="settings-user-access-item" key={user.id}>
                    <div className="settings-user-profile-col">
                      <div className="settings-user-avatar-micro" aria-hidden="true">
                        {(user.displayName || user.email || 'U').slice(0, 1).toUpperCase()}
                      </div>
                      <div className="settings-user-info-stacked">
                        <strong className="settings-user-name-inline">{user.displayName || user.email || 'User'}</strong>
                        <span className="settings-user-email-inline">
                          {user.role === 'owner'
                            ? 'Owner Akses Utama'
                            : user.role === 'studio_guard'
                              ? 'Guard Identity: ' + getLinkedGuardName(user.guardId)
                              : `${enabledCount}/${assignablePages.length} halaman`}
                        </span>
                      </div>
                    </div>

                    <div className="settings-user-controls-col">
                      {canEditPermissions ? (
                        <>
                          {/* Role select dropdown */}
                          <select
                            value={user.role}
                            onChange={(e) => handleUpdateUserRole(user, e.target.value)}
                            className="settings-role-select"
                            aria-label="Update user role"
                          >
                            <option value="admin">Admin</option>
                            <option value="studio_guard">Guard</option>
                          </select>

                          {user.role === 'studio_guard' ? (
                            <button
                              type="button"
                              aria-label={
                                guardIdentityNeedsRepair
                                  ? 'Perbaiki identitas Guard'
                                  : 'Hubungkan ulang identitas Guard'
                              }
                              title={
                                guardIdentityNeedsRepair
                                  ? 'Perbaiki identitas Guard'
                                  : 'Hubungkan ulang identitas Guard'
                              }
                              onClick={() => openGuardIdentityLinker(user)}
                              className={
                                guardIdentityNeedsRepair
                                  ? 'settings-icon-action-btn is-delete'
                                  : 'settings-icon-action-btn'
                              }
                            >
                              {guardIdentityNeedsRepair
                                ? <ShieldAlert size={12} />
                                : <RefreshCcw size={12} />}
                            </button>
                          ) : null}

                          {/* Access page permissions button */}
                          <button
                            type="button"
                            aria-label="Atur akses halaman user"
                            title="Atur akses halaman"
                            onClick={() => openPermissionSettings(user)}
                            className="settings-icon-action-btn"
                          >
                            <SlidersHorizontal size={12} />
                          </button>

                          {/* Transfer Owner (Admin only) */}
                          {user.role === 'admin' && (
                            <button
                              type="button"
                              aria-label="Transfer owner ke user ini"
                              title="Transfer owner"
                              onClick={() => transferOwnershipToUser(user)}
                              className="settings-icon-action-btn"
                              style={{ color: 'var(--auth-accent)' }}
                            >
                              <Crown size={12} />
                            </button>
                          )}

                          {/* Active status sliding toggle */}
                          <label className="settings-user-toggle-switch" title="Toggle Status Aktif">
                            <input
                              type="checkbox"
                              checked={user.status === 'approved'}
                              onChange={() => handleToggleUserStatus(user, user.status)}
                            />
                            <span className="settings-user-toggle-slider"></span>
                          </label>

                        </>
                      ) : (
                        <span className="settings-owner-status-pill" title="Owner full access" aria-label="Owner full access" style={{ padding: '4px 8px', fontSize: '10px', background: 'var(--auth-accent-soft)', color: 'var(--auth-accent)', borderRadius: 'var(--studio-radius-sm)', fontWeight: 'bold', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                          <Crown size={11} />
                          Owner
                        </span>
                      )}
                    </div>
                  </article>
                );
              })
            ) : (
              <p className="settings-empty-text">Belum ada user admin portal selain client.</p>
            )}
          </div>

          {/* ── SEKSI 3: DAFTAR AKUN PORTAL TIM NONAKTIF ── */}
          {inactiveUsers.length ? (
            <div className="settings-pending-approvals-block settings-section-divider">
              <h3 className="settings-section-title">Akun Portal Tim Nonaktif</h3>
              <div className="settings-pending-list">
                {inactiveUsers.map((user) => (
                  <article className="is-pending-item" key={user.id}>
                    <div className="settings-user-profile-col">
                      <div className="settings-user-avatar-micro" aria-hidden="true" style={{ opacity: 0.6 }}>
                        {(user.displayName || user.email || 'U').slice(0, 1).toUpperCase()}
                      </div>
                      <div className="settings-user-info-stacked" style={{ opacity: 0.6 }}>
                        <strong className="settings-user-name-inline">{user.displayName || 'User Admin'}</strong>
                        <span className="settings-user-email-inline">
                          {user.email || user.phoneNumber || user.id} ({user.role?.toUpperCase()})
                        </span>
                      </div>
                    </div>

                    <div className="settings-user-controls-col">
                      <button
                        type="button"
                        aria-label="Aktifkan user"
                        title="Aktifkan user"
                        onClick={() => handleToggleUserStatus(user, 'rejected')}
                        className="settings-mini-button is-primary settings-approval-icon-button is-approve"
                        style={{ height: '26px', minHeight: '26px', padding: '0 8px', fontSize: '10px' }}
                      >
                        <ShieldCheck size={11} />
                        Aktifkan
                      </button>

                    </div>
                  </article>
                ))}
              </div>
            </div>
          ) : null}

          {approvalSettingsMessage ? (
            <p className="settings-invoice-message" role="status">{approvalSettingsMessage}</p>
          ) : null}

          {/* ── DRAWER MODAL ATUR PERMISSION ── */}
        </section>
      )}
        </main>
      </div>
      </section>

      {selectedPermissionUser ? (
        <div
          className="settings-permission-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closePermissionSettings();
          }}
        >
          <form className="settings-permission-panel" role="dialog" aria-modal="true" aria-labelledby="permission-panel-title" onSubmit={savePermissionSettings}>
            <header className="settings-permission-head">
              <div>
                <small>{getPortalUserRoleLabel(selectedPermissionUser)} Permission</small>
                <h3 id="permission-panel-title">{selectedPermissionUser.displayName || selectedPermissionUser.email || 'Admin User'}</h3>
                <span>{selectedPermissionUser.email || selectedPermissionUser.phoneNumber || selectedPermissionUser.id}</span>
              </div>

              <button type="button" aria-label="Tutup permission settings" onClick={closePermissionSettings}>
                <X size={16} />
              </button>
            </header>

            <div className="settings-permission-flat-list" aria-label="Daftar permission halaman admin">
              {getAssignablePermissionPages(selectedPermissionUser).map((page) => {
                const enabled = Boolean(permissionDraft[page.key]);

                return (
                  <div className="settings-permission-flat-row" key={page.key}>
                    <div className="settings-permission-info">
                      <strong className="settings-permission-title">{page.label}</strong>
                      <small className="settings-permission-desc">{page.description}</small>
                    </div>
                    <label className="settings-user-toggle-switch" title="Toggle Halaman">
                      <input
                        type="checkbox"
                        checked={enabled}
                        onChange={() => togglePermissionPage(page.key)}
                      />
                      <span className="settings-user-toggle-slider"></span>
                    </label>
                  </div>
                );
              })}
            </div>

            <footer className="settings-permission-actions">
              <button className="settings-mini-button is-ghost" type="button" onClick={grantAllPermissions}>
                Full Access
              </button>
              <button className="settings-mini-button" type="button" onClick={closePermissionSettings}>
                Batal
              </button>
              <button className="settings-mini-button is-primary" type="submit">
                Simpan Permission
              </button>
            </footer>
          </form>
        </div>
      ) : null}

      {selectingGuardUser ? (
        <div
          className="settings-permission-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setSelectingGuardUser(null);
          }}
        >
          <div className="settings-permission-panel" role="dialog" aria-modal="true" aria-labelledby="guard-select-title">
            <header className="settings-permission-head">
              <div>
                <small>
                  {selectingGuardUser.role === 'studio_guard'
                    ? 'Perbaiki Identitas Guard'
                    : 'Hubungkan Penjaga Studio'}
                </small>
                <h3 id="guard-select-title">Pilih Identitas Crew Penjaga</h3>
                <span>
                  Pilih satu crew Guard/Both aktif. Link ini menjadi identitas operasional
                  untuk attendance baru dari akun tersebut.
                </span>
              </div>
              <button type="button" aria-label="Tutup pilihan" onClick={() => setSelectingGuardUser(null)}>
                <X size={16} />
              </button>
            </header>

            <div className="settings-permission-flat-list">
              {guardPeople.length ? (
                guardPeople.map((person) => {
                  const isSelected = selectedCrewId === person.id;

                  return (
                    <button
                      className="settings-permission-flat-row"
                      key={person.id}
                      type="button"
                      onClick={() => setSelectedCrewId(person.id)}
                      style={{ 
                        textAlign: 'left', 
                        width: '100%', 
                        border: isSelected ? '1px solid var(--auth-success)' : '1px solid var(--auth-border)', 
                        background: isSelected ? 'var(--auth-success-soft)' : 'var(--auth-bg-card)',
                        cursor: 'pointer' 
                      }}
                    >
                      <div className="settings-permission-info">
                        <strong className="settings-permission-title" style={{ color: isSelected ? 'var(--auth-success)' : 'var(--auth-text-strong)' }}>{person.name}</strong>
                        <small className="settings-permission-desc">
                          Metode Bayar: {person.defaultPaymentMethod?.toUpperCase() || 'CASH'}
                        </small>
                      </div>
                      <span style={{ fontSize: '12px', color: isSelected ? 'var(--auth-success)' : 'var(--auth-accent)', fontWeight: isSelected ? 'bold' : 'normal' }}>
                        {isSelected ? 'Terpilih ✓' : 'Pilih →'}
                      </span>
                    </button>
                  );
                })
              ) : (
                <p className="settings-empty-text" style={{ margin: '10px 0' }}>
                  Belum ada crew ber-role Penjaga Studio (Guard) di Fee Settings. Tambahkan crew di tab Fee Settings terlebih dahulu.
                </p>
              )}
            </div>

            <footer className="settings-permission-actions">
              <button className="settings-mini-button" type="button" onClick={() => setSelectingGuardUser(null)}>
                Batal
              </button>
              <button 
                className="settings-mini-button is-primary" 
                type="button" 
                disabled={!selectedCrewId}
                onClick={() =>
                  handleUpdateUserRole(
                    selectingGuardUser,
                    'studio_guard',
                    {
                      guardId:
                        selectedCrewId,
                    },
                  )
                }
              >
                {selectingGuardUser.role === 'studio_guard'
                  ? 'Simpan Link Guard'
                  : 'Simpan Penjaga'}
              </button>
            </footer>
          </div>
        </div>
      ) : null}

      <ConfirmDialog config={confirmConfig} onClose={() => setConfirmConfig(null)} />
    </>
  );
}
