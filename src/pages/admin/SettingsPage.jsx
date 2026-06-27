import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Clipboard, Crown, DatabaseZap, Edit3, KeyRound, Mail, MonitorSmartphone, Phone, RefreshCcw, Save, ShieldAlert, ShieldCheck, SlidersHorizontal, Trash2, UserRound, X } from 'lucide-react';
import { collection, getDocs, query, orderBy, onSnapshot, doc, updateDoc, writeBatch, deleteDoc } from 'firebase/firestore';
import { firestoreDb } from '../../lib/firebase.js';
import { OWNER_EMAIL } from '../../constants/appConstants.js';
import ConfirmDialog from '../../components/ui/ConfirmDialog.jsx';
import StudioSelect from '../../components/ui/StudioSelect.jsx';
import StudioTextField from '../../components/ui/StudioTextField.jsx';
import OperatorFeeSettingsPanel from '../../components/settings/OperatorFeeSettingsPanel.jsx';
import { adminAuthRepository } from '../../services/adminAuthRepository.js';
import {
  accountContactOptions,
  accountLandingOptions,
  accountNotificationOptions,
  readAccountPreferences,
  resetAccountPreferences,
  writeAccountPreferences,
} from '../../utils/accountSettings.js';
import {
  countEnabledAdminPermissions,
  defaultAdminPermissions,
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


const DANGER_ZONE_CONFIRM_TEXT = 'HAPUS DATA 37 STUDIO';
const DANGER_ZONE_DELETE_BATCH_SIZE = 450;

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
    key: 'notificationSubscriptions',
    label: 'Notification subscriptions legacy',
    collectionName: 'notificationSubscriptions',
    preserveCurrentOwner: false,
  },
  {
    key: 'notificationSubscriptionDevices',
    label: 'Notification subscription devices',
    collectionName: 'notificationSubscriptionDevices',
    preserveCurrentOwner: false,
  },
  {
    key: 'settings',
    label: 'Remote app settings',
    collectionName: 'settings',
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

function toNumber(value) {
  const parsed = Number(value);

  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

function getAccountProviderLabel(user) {
  const provider = String(user?.provider || '').toLowerCase();

  if (provider.includes('google')) return 'Google';
  if (provider.includes('phone')) return 'Phone OTP';
  if (user?.phoneNumber && !user?.email) return 'Phone OTP';
  if (user?.email) return 'Email / Password';

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

function getPortalUserStatusLabel(user) {
  if (user?.status === 'approved') return 'Approved';
  if (user?.status === 'pending') return 'Pending';
  if (user?.status === 'rejected') return 'Rejected';
  if (user?.status === 'active') return 'Active';

  return user?.status || 'Unknown';
}

function getPermissionSummary(user) {
  if (user?.role === 'owner') return 'Full access';

  const pages = getAssignablePermissionPages(user);
  const permissions = normalizeAdminPermissionsForRole(user?.permissions, user?.role);
  const enabled = pages.filter((page) => permissions[page.key]);

  if (!enabled.length) return 'Belum ada akses halaman';

  return enabled.map((page) => page.label).join(', ');
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

function createDangerZoneInitialProgress() {
  return dangerZoneCollections.reduce((progress, item) => ({
    ...progress,
    [item.key]: {
      deleted: 0,
      error: '',
      status: 'idle',
    },
  }), {});
}

function getDangerZoneProgressSummary(progress) {
  return dangerZoneCollections.reduce((summary, item) => {
    const row = progress[item.key] || {};

    return {
      deleted: summary.deleted + Number(row.deleted || 0),
      errors: summary.errors + (row.error ? 1 : 0),
    };
  }, { deleted: 0, errors: 0 });
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
    if (isOwnerAdminUser(currentUser)) {
      pages.push({
        key: 'fee-settings',
        label: 'Fee Settings',
        description: 'Atur crew, operator, uang makan, dan rule fee internal studio.',
      });
      pages.push({
        key: 'user-settings',
        label: 'User & Access Settings',
        description: 'Daftar user admin portal, role, persetujuan akun baru, dan hak akses halaman.',
      });
      pages.push({
        key: 'danger',
        label: 'Danger Zone',
        description: 'Reset data operasional app. Aksi ini hanya untuk owner dan tidak bisa dibatalkan.',
      });
    }
    return pages;
  }, [currentUser]);

  const [activeSubpage, setActiveSubpage] = useState('account');
  const remoteSettings = usePricingSettings();
  const [settings, setSettings] = useState(() => remoteSettings);
  const remoteInvoiceSettings = useInvoiceSettings();
  const [invoiceSettings, setInvoiceSettings] = useState(() => remoteInvoiceSettings);
  const [invoiceSettingsMessage, setInvoiceSettingsMessage] = useState('');
  const remoteStudioSettings = useStudioSettings();
  const [studioSettings, setStudioSettings] = useState(() => remoteStudioSettings);
  const [studioSettingsMessage, setStudioSettingsMessage] = useState('');
  const [accountPreferences, setAccountPreferences] = useState(() => readAccountPreferences(currentUser?.uid));
  const [accountSettingsMessage, setAccountSettingsMessage] = useState('');
  const [accountProfileForm, setAccountProfileForm] = useState(() => ({
    displayName: currentUser?.displayName || '',
  }));
  const operatorFeeSettings = useOperatorFeeSettings();
  const [selectingGuardUser, setSelectingGuardUser] = useState(null);
  const [selectedCrewId, setSelectedCrewId] = useState(null);
  const [accountProfileMessage, setAccountProfileMessage] = useState('');
  const [dangerConfirmText, setDangerConfirmText] = useState('');
  const [dangerFinalCheck, setDangerFinalCheck] = useState(false);
  const [dangerIsDeleting, setDangerIsDeleting] = useState(false);
  const [dangerMessage, setDangerMessage] = useState('');
  const [dangerProgress, setDangerProgress] = useState(createDangerZoneInitialProgress);

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
      setStudioSettings(remoteStudioSettings);
    });

    return () => {
      window.cancelAnimationFrame(studioFrameId);
    };
  }, [remoteStudioSettings]);

  useEffect(() => {
    const accountFrameId = window.requestAnimationFrame(() => {
      setAccountPreferences(readAccountPreferences(currentUser?.uid));
    });

    return () => {
      window.cancelAnimationFrame(accountFrameId);
    };
  }, [currentUser?.uid]);

  useEffect(() => {
    const profileFrameId = window.requestAnimationFrame(() => {
      setAccountProfileForm({
        displayName: currentUser?.displayName || '',
      });
    });

    return () => {
      window.cancelAnimationFrame(profileFrameId);
    };
  }, [currentUser?.displayName]);

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

  const getLinkedGuardName = (guardId) => {
    if (!guardId) return 'Umum';
    const match = guardPeople.find((p) => p.id === guardId);
    return match ? match.name : 'Terhapus/Nonaktif';
  };

  // Sync users list for owner-only user management pages
  useEffect(() => {
    if (activeSubpage !== 'user-settings' || !isOwnerAdminUser(currentUser)) return;

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
  }, [activeSubpage, currentUser]);

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

  async function handleUpdateUserRole(userId, newRole) {
    try {
      const docRef = doc(firestoreDb, 'users', userId);
      await updateDoc(docRef, {
        role: newRole,
        updatedAt: new Date().toISOString()
      });
      setApprovalSettingsMessage('Peran akun berhasil diperbarui.');
    } catch (err) {
      console.error('Failed to update user role:', err);
      setApprovalSettingsMessage('Gagal memperbarui peran akun.');
    }
  }

  async function handleToggleUserStatus(userId, currentStatus) {
    const nextStatus = currentStatus === 'approved' ? 'rejected' : 'approved';
    try {
      const docRef = doc(firestoreDb, 'users', userId);
      await updateDoc(docRef, {
        status: nextStatus,
        updatedAt: new Date().toISOString()
      });
      setApprovalSettingsMessage(`Status akses berhasil diubah menjadi ${nextStatus === 'approved' ? 'Aktif' : 'Nonaktif'}.`);
    } catch (err) {
      console.error('Failed to toggle user status:', err);
      setApprovalSettingsMessage('Gagal mengubah status akses.');
    }
  }

  async function handleDeleteUser(userId, userEmail) {
    setConfirmConfig({
      title: 'Hapus User Permanen',
      message: `Apakah Anda yakin ingin menghapus user ${userEmail || ''} secara permanen dari 37 Studio? Data user ini akan dihapus selamanya.`,
      confirmLabel: 'Hapus Permanen',
      onConfirm: async () => {
        try {
          const docRef = doc(firestoreDb, 'users', userId);
          await deleteDoc(docRef);
          setApprovalSettingsMessage('User berhasil dihapus secara permanen.');
        } catch (err) {
          console.error('Failed to delete user:', err);
          setApprovalSettingsMessage('Gagal menghapus user.');
        }
      }
    });
  }

  async function handleToggleUserIsGuard(userId, currentIsGuard, guardId = null) {
    const nextIsGuard = !currentIsGuard;
    try {
      const docRef = doc(firestoreDb, 'users', userId);
      await updateDoc(docRef, {
        isGuard: nextIsGuard,
        guardId: nextIsGuard ? guardId : null,
        updatedAt: new Date().toISOString()
      });
      setApprovalSettingsMessage(nextIsGuard ? 'Status penjaga admin berhasil diaktifkan.' : 'Status penjaga admin berhasil dinonaktifkan.');
      setSelectingGuardUser(null);
    } catch (err) {
      console.error('Failed to toggle isGuard status:', err);
      setApprovalSettingsMessage('Gagal memperbarui status penjaga.');
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

    const targetLabel = user.displayName || user.email || user.phoneNumber || 'user ini';
    
    setConfirmConfig({
      title: 'Transfer Ownership?',
      message: `Transfer ownership ke ${targetLabel}? Akun owner saat ini akan berubah menjadi admin biasa.`,
      confirmLabel: 'Ya, Transfer',
      onConfirm: async () => {
        try {
          const now = new Date().toISOString();
          const batch = writeBatch(firestoreDb);

          batch.update(doc(firestoreDb, 'users', currentUser.uid), {
            role: 'admin',
            status: 'approved',
            permissions: defaultAdminPermissions,
            ownershipTransferredOutAt: now,
            updatedAt: now,
          });

          batch.update(doc(firestoreDb, 'users', user.id), {
            role: 'owner',
            status: 'approved',
            permissions: defaultAdminPermissions,
            ownershipTransferredInAt: now,
            updatedAt: now,
          });

          await batch.commit();

          setApprovalSettingsMessage('Ownership berhasil ditransfer ke ' + targetLabel + '.');
        } catch (err) {
          console.error('Gagal transfer ownership:', err);
          setApprovalSettingsMessage('Terjadi kesalahan saat mentransfer ownership.');
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
      if (accountSettingsMessage) setAccountSettingsMessage('');
    };
  }

  function updateAccountPreferenceValue(field) {
    return (nextValue) => {
      setAccountPreferences((current) => ({
        ...current,
        [field]: nextValue,
      }));
      if (accountSettingsMessage) setAccountSettingsMessage('');
    };
  }

  async function saveAccountSettingsPage(event) {
    event.preventDefault();

    const nextPreferences = writeAccountPreferences(currentUser?.uid, accountPreferences);
    setAccountPreferences(nextPreferences);

    if (currentUser?.uid) {
      try {
        await updateDoc(doc(firestoreDb, 'users', currentUser.uid), {
          preferences: nextPreferences,
          updatedAt: new Date().toISOString()
        });
        setAccountSettingsMessage('Account settings berhasil disimpan dan disinkronkan ke cloud.');
      } catch (err) {
        console.error('Gagal sinkronisasi preferensi ke Firestore:', err);
        setAccountSettingsMessage('Account settings disimpan secara lokal tetapi gagal disinkronkan ke cloud.');
      }
    } else {
      setAccountSettingsMessage('Account settings berhasil disimpan di perangkat ini.');
    }
  }

  async function resetAccountSettingsPage() {
    const nextPreferences = resetAccountPreferences(currentUser?.uid);
    setAccountPreferences(nextPreferences);

    if (currentUser?.uid) {
      try {
        await updateDoc(doc(firestoreDb, 'users', currentUser.uid), {
          preferences: nextPreferences,
          updatedAt: new Date().toISOString()
        });
        setAccountSettingsMessage('Preferensi lokal dikembalikan ke default dan disinkronkan ke cloud.');
      } catch (err) {
        console.error('Gagal reset preferensi di Firestore:', err);
        setAccountSettingsMessage('Preferensi lokal dikembalikan ke default, tetapi gagal disinkronkan ke cloud.');
      }
    } else {
      setAccountSettingsMessage('Preferensi account lokal dikembalikan ke default.');
    }
  }

  async function copyAccountUid() {
    const uid = currentUser?.uid || '';

    if (!uid) {
      setAccountSettingsMessage('UID akun belum tersedia.');
      return;
    }

    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(uid);
        setAccountSettingsMessage('UID akun berhasil disalin.');
        return;
      }

      setAccountSettingsMessage('Clipboard browser tidak tersedia.');
    } catch (err) {
      console.error('Gagal menyalin UID akun:', err);
      setAccountSettingsMessage('UID akun belum berhasil disalin.');
    }
  }

  function updateAccountProfileField(field) {
    return (event) => {
      const value = event.target.value;

      setAccountProfileForm((current) => ({
        ...current,
        [field]: value,
      }));

      if (accountProfileMessage) setAccountProfileMessage('');
    };
  }

  async function saveAccountProfilePage(event) {
    event.preventDefault();

    try {
      const updatedProfile = await adminAuthRepository.updateAdminProfile({
        displayName: accountProfileForm.displayName,
      });

      setAccountProfileForm({
        displayName: updatedProfile.displayName || accountProfileForm.displayName,
      });
      setAccountProfileMessage('Profil akun berhasil diperbarui.');
    } catch (err) {
      console.error('Gagal menyimpan profil akun:', err);
      setAccountProfileMessage(err?.message || 'Profil akun belum berhasil diperbarui.');
    }
  }

  async function sendPasswordResetPage() {
    try {
      await adminAuthRepository.sendAdminPasswordReset(currentUser?.email);
      setAccountProfileMessage('Email reset password sudah dikirim.');
    } catch (err) {
      console.error('Gagal mengirim reset password:', err);
      setAccountProfileMessage(err?.message || 'Email reset password belum berhasil dikirim.');
    }
  }

  function updateStudioSetting(field) {
    return (event) => {
      const value = event.target.value;

      setStudioSettings((current) => normalizeStudioSettings({
        ...current,
        [field]: value,
      }));

      if (studioSettingsMessage) setStudioSettingsMessage('');
    };
  }

  function updateStudioTerm(index) {
    return (event) => {
      const value = event.target.value;

      setStudioSettings((current) => normalizeStudioSettings({
        ...current,
        paymentTerms: (current.paymentTerms || defaultStudioSettings.paymentTerms).map((term, termIndex) =>
          termIndex === index ? value : term
        ),
      }));

      if (studioSettingsMessage) setStudioSettingsMessage('');
    };
  }

  function addStudioPaymentTerm() {
    setStudioSettings((current) => normalizeStudioSettings({
      ...current,
      paymentTerms: [...(current.paymentTerms || defaultStudioSettings.paymentTerms), ''],
    }));

    if (studioSettingsMessage) setStudioSettingsMessage('');
  }

  function removeStudioPaymentTerm(index) {
    setStudioSettings((current) => {
      const nextTerms = (current.paymentTerms || defaultStudioSettings.paymentTerms).filter((_term, termIndex) => termIndex !== index);

      return normalizeStudioSettings({
        ...current,
        paymentTerms: nextTerms.length ? nextTerms : defaultStudioSettings.paymentTerms,
      });
    });

    if (studioSettingsMessage) setStudioSettingsMessage('');
  }

  async function saveStudioSettingsPage(event) {
    event.preventDefault();

    try {
      const nextSettings = await saveStudioSettings({
        ...studioSettings,
        updatedAt: new Date().toISOString(),
      });

      setStudioSettings(nextSettings);
      setStudioSettingsMessage('Studio settings berhasil disimpan.');
    } catch (err) {
      console.error('Failed to save studio settings:', err);
      setStudioSettingsMessage('Gagal menyimpan studio settings ke Firestore.');
    }
  }

  async function resetStudioSettingsPage() {
    try {
      const nextSettings = await saveStudioSettings({
        ...defaultStudioSettings,
        updatedAt: new Date().toISOString(),
      });

      setStudioSettings(nextSettings);
      setStudioSettingsMessage('Studio settings dikembalikan ke default.');
    } catch (err) {
      console.error('Failed to reset studio settings:', err);
      setStudioSettingsMessage('Gagal reset studio settings.');
    }
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

  function setDangerCollectionProgress(key, patch) {
    setDangerProgress((current) => ({
      ...current,
      [key]: {
        ...(current[key] || {}),
        ...patch,
      },
    }));
  }

  async function deleteDangerZoneCollection(item) {
    const snapshot = await getDocs(collection(firestoreDb, item.collectionName));
    const docsToDelete = snapshot.docs.filter((snapshotDoc) => {
      if (item.preserveCurrentOwner && snapshotDoc.id === currentUser?.uid) return false;

      return true;
    });

    if (!docsToDelete.length) {
      setDangerCollectionProgress(item.key, {
        deleted: 0,
        error: '',
        status: 'empty',
      });

      return 0;
    }

    let deletedCount = 0;

    for (let index = 0; index < docsToDelete.length; index += DANGER_ZONE_DELETE_BATCH_SIZE) {
      const chunk = docsToDelete.slice(index, index + DANGER_ZONE_DELETE_BATCH_SIZE);
      const batch = writeBatch(firestoreDb);

      chunk.forEach((snapshotDoc) => {
        batch.delete(snapshotDoc.ref);
      });

      await batch.commit();

      deletedCount += chunk.length;
      setDangerCollectionProgress(item.key, {
        deleted: deletedCount,
        error: '',
        status: 'deleting',
      });
    }

    setDangerCollectionProgress(item.key, {
      deleted: deletedCount,
      error: '',
      status: 'done',
    });

    return deletedCount;
  }

  async function handleDangerZoneDeleteAllData() {
    if (!isOwnerAdminUser(currentUser)) {
      setDangerMessage('Aksi ini hanya tersedia untuk owner.');
      return;
    }

    if (dangerConfirmText !== DANGER_ZONE_CONFIRM_TEXT || !dangerFinalCheck) {
      setDangerMessage('Ketik teks konfirmasi dan aktifkan checkbox final terlebih dahulu.');
      return;
    }

    setConfirmConfig({
      title: 'Hapus Seluruh Data?',
      message: 'Aksi ini akan menghapus data operasional app dari Firestore. Data tidak bisa dikembalikan dari UI. Lanjutkan?',
      confirmLabel: 'Lanjut',
      onConfirm: () => {
        setConfirmConfig({
          title: 'Konfirmasi Terakhir',
          message: 'Hapus data booking, customer, inventory, pembukuan, gallery metadata, notifikasi, settings, dan akun non-owner?',
          confirmLabel: 'Ya, Hapus Semua Data',
          onConfirm: async () => {
            setDangerIsDeleting(true);
            setDangerMessage('Proses reset data dimulai...');
            setDangerProgress(createDangerZoneInitialProgress());

            let totalDeleted = 0;
            let errorCount = 0;

            for (const item of dangerZoneCollections) {
              setDangerCollectionProgress(item.key, {
                deleted: 0,
                error: '',
                status: 'deleting',
              });

              try {
                totalDeleted += await deleteDangerZoneCollection(item);
              } catch (error) {
                errorCount += 1;
                console.error('[danger-zone] Gagal menghapus collection ' + item.collectionName + ':', error);
                setDangerCollectionProgress(item.key, {
                  error: error?.message || 'Gagal menghapus collection.',
                  status: 'error',
                });
              }
            }

            setDangerIsDeleting(false);

            if (errorCount) {
              setDangerMessage(
                'Reset selesai sebagian. ' + totalDeleted + ' dokumen terhapus, ' + errorCount + ' collection gagal. Cek detail di bawah.'
              );
              return;
            }

            setDangerConfirmText('');
            setDangerFinalCheck(false);
            setDangerMessage(
              'Reset selesai. ' + totalDeleted + ' dokumen terhapus. Akun owner aktif tetap dipertahankan.'
            );
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
    return subpages.find((page) => page.key === activeSubpage) || subpages[0];
  }, [subpages, activeSubpage]);

  const accountProviderLabel = getAccountProviderLabel(currentUser);
  const accountRoleLabel = getAccountRoleLabel(currentUser);
  const accountStatusLabel = getAccountStatusLabel(currentUser);
  const accountContactValue = currentUser?.email || currentUser?.phoneNumber || 'Belum tersedia';
  const accountUidLabel = getMaskedUid(currentUser?.uid);
  const accountPreferredContactLabel = getOptionLabel(accountContactOptions, accountPreferences.preferredContact, 'Email');
  const accountLandingLabel = getOptionLabel(accountLandingOptions, accountPreferences.defaultLandingKey, 'Dashboard');
  const accountNotificationLabel = getOptionLabel(accountNotificationOptions, accountPreferences.notificationLevel, 'Penting Saja');

  return (
    <>
      <section
      className={
        activeSubpage === 'account'
          ? 'settings-page is-account-settings'
          : activeSubpage === 'user-settings'
            ? 'settings-page is-user-settings'
            : activeSubpage === 'danger'
              ? 'settings-page is-danger-settings'
              : activeSubpage === 'fee-settings'
                ? 'settings-page is-fee-settings'
                : 'settings-page'
      }
      aria-labelledby="settings-title"
    >
      <div className="settings-subnav-mobile">
        <StudioSelect
          label="Settings Page"
          options={subpages}
          selectedKey={activeSubpage}
          onChange={setActiveSubpage}
        />
      </div>

      <div className="settings-tabs-desktop" role="tablist" aria-label="Settings subpage">
        {subpages.map((item) => (
          <button
            aria-selected={activeSubpage === item.key}
            className={activeSubpage === item.key ? 'settings-tab is-active' : 'settings-tab'}
            key={item.key}
            role="tab"
            type="button"
            onClick={() => setActiveSubpage(item.key)}
          >
            <strong>{item.label}</strong>
            <span>{item.description}</span>
          </button>
        ))}
      </div>

      <div className="settings-title-block">
        <p>{activePageInfo.label}</p>
        <h2 id="settings-title">{activePageInfo.label}</h2>
        <span>{activePageInfo.description}</span>
      </div>

      {activeSubpage === 'account' && (
        <section className="settings-account-grid" aria-label="Account settings">

          {/* ── HERO STRIP ─────────────────────────────────── */}
          <section className="settings-section settings-account-hero-strip">
            <div className="settings-account-avatar-sm" aria-hidden="true">
              <UserRound size={18} />
            </div>

            <div className="settings-account-hero-copy">
              <p>Admin Account</p>
              <h3>{currentUser?.displayName || currentUser?.email || currentUser?.phoneNumber || 'Admin 37 Music'}</h3>
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
          </section>

          {/* ── IDENTITAS LOGIN (flat list) ─────────────────── */}
          <section className="settings-section">
            <h3 className="settings-section-title">Identitas Login</h3>

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

          {/* ── PROFIL AKUN ─────────────────────────────────── */}
          <section className="settings-section">
            <h3 className="settings-section-title">Profil Akun</h3>

            <form className="settings-account-form-compact" onSubmit={saveAccountProfilePage}>
              <StudioTextField
                id="account-profile-display-name"
                label="Nama Tampilan"
                placeholder="Contoh: Owner 37 Music"
                value={accountProfileForm.displayName}
                onChange={updateAccountProfileField('displayName')}
              />

              {accountProfileMessage ? (
                <p className="settings-invoice-message" role="status">{accountProfileMessage}</p>
              ) : null}

              <div className="settings-account-actions-row">
                <button
                  className="settings-mini-button is-ghost"
                  disabled={!currentUser?.email}
                  type="button"
                  onClick={sendPasswordResetPage}
                >
                  Kirim Reset Password
                </button>

                <button className="settings-mini-button is-primary" type="submit">
                  <Save size={14} />
                  Simpan Profil
                </button>
              </div>
            </form>
          </section>

          {/* ── PREFERENSI ACCOUNT ──────────────────────────── */}
          <section className="settings-section">
            <h3 className="settings-section-title">Preferensi Account</h3>

            <form className="settings-account-form-compact" onSubmit={saveAccountSettingsPage}>
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
                <span>Catatan Account</span>
                <textarea
                  id="account-setting-note"
                  maxLength={240}
                  placeholder="Contoh: akun owner utama, dipakai untuk approval admin..."
                  value={accountPreferences.accountNote}
                  onChange={updateAccountPreference('accountNote')}
                />
              </label>

              <div className="settings-prefs-preview-strip">
                <span>Landing: <strong>{accountLandingLabel}</strong></span>
                <span>·</span>
                <span>Kontak: <strong>{accountPreferredContactLabel}</strong></span>
                <span>·</span>
                <span>Notifikasi: <strong>{accountNotificationLabel}</strong></span>
              </div>

              {accountSettingsMessage ? (
                <p className="settings-invoice-message" role="status">{accountSettingsMessage}</p>
              ) : null}

              <div className="settings-account-actions-row">
                <button className="settings-mini-button is-ghost" type="button" onClick={resetAccountSettingsPage}>
                  <RefreshCcw size={14} />
                  Reset Lokal
                </button>
                <button className="settings-mini-button is-primary" type="submit">
                  <Save size={14} />
                  Simpan Account
                </button>
              </div>
            </form>
          </section>

          {/* ── ACCESS & SECURITY ───────────────────────────── */}
          <section className="settings-section">
            <div className="settings-section-head-row">
              <h3 className="settings-section-title">Access &amp; Security</h3>
              <button className="settings-mini-button" type="button" onClick={copyAccountUid}>
                <Clipboard size={13} />
                Copy UID
              </button>
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
          </section>

        </section>
      )}

      {activeSubpage === 'fee-settings' && isOwnerAdminUser(currentUser) && (
        <OperatorFeeSettingsPanel currentUser={currentUser} />
      )}

      {activeSubpage === 'danger' && isOwnerAdminUser(currentUser) && (
        <section className="settings-section settings-owner-danger-zone" aria-label="Danger zone reset data app">
          <div className="settings-danger-hero">
            <span className="settings-danger-icon" aria-hidden="true">
              <DatabaseZap size={24} />
            </span>
            <div>
              <p>Owner Only</p>
              <h3>Hapus Seluruh Data App</h3>
              <span>
                Reset data operasional Firestore untuk testing ulang atau mulai dari nol. Aksi ini tidak menghapus Firebase Auth users dan tidak menghapus file eksternal Cloudinary.
              </span>
            </div>
          </div>

          <div className="settings-danger-alert">
            <ShieldAlert size={18} />
            <div>
              <strong>Aksi permanen</strong>
              <p>
                Data booking, customer, bukti pembayaran, pesan, inventory, pembukuan, gallery metadata, settings, dan notifikasi akan dihapus. Akun owner yang sedang login tetap dipertahankan agar app tidak terkunci.
              </p>
            </div>
          </div>

          <div className="settings-danger-collections" aria-label="Daftar data yang akan dihapus">
            {dangerZoneCollections.map((item) => {
              const progress = dangerProgress[item.key] || {};
              const statusLabel =
                progress.status === 'done'
                  ? 'Selesai'
                  : progress.status === 'empty'
                    ? 'Kosong'
                    : progress.status === 'error'
                      ? 'Gagal'
                      : progress.status === 'deleting'
                        ? 'Menghapus'
                        : 'Siap';

              return (
                <article className={'settings-danger-collection is-' + (progress.status || 'idle')} key={item.key}>
                  <span>
                    <strong>{item.label}</strong>
                    <small>{item.collectionName}{item.preserveCurrentOwner ? ' · owner aktif dipertahankan' : ''}</small>
                  </span>
                  <em>{statusLabel} · {Number(progress.deleted || 0)} docs</em>
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
                disabled={dangerIsDeleting}
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
                disabled={dangerIsDeleting}
                id="danger-final-check"
                type="checkbox"
                onChange={(event) => {
                  setDangerFinalCheck(event.target.checked);
                  if (dangerMessage) setDangerMessage('');
                }}
              />
              <span>Saya paham data operasional akan dihapus permanen dari Firestore.</span>
            </label>
          </div>

          {dangerMessage ? (
            <p className="settings-danger-message" role="status">
              <AlertTriangle size={15} />
              {dangerMessage}
            </p>
          ) : null}

          <div className="settings-danger-summary">
            <span>Total terhapus: <strong>{getDangerZoneProgressSummary(dangerProgress).deleted}</strong></span>
            <span>Error collection: <strong>{getDangerZoneProgressSummary(dangerProgress).errors}</strong></span>
          </div>

          <div className="settings-form-actions settings-danger-actions">
            <button
              className="settings-mini-button is-ghost"
              disabled={dangerIsDeleting}
              type="button"
              onClick={() => {
                setDangerConfirmText('');
                setDangerFinalCheck(false);
                setDangerMessage('');
                setDangerProgress(createDangerZoneInitialProgress());
              }}
            >
              Reset Form
            </button>

            <button
              className="settings-mini-button is-danger"
              disabled={
                dangerIsDeleting ||
                dangerConfirmText !== DANGER_ZONE_CONFIRM_TEXT ||
                !dangerFinalCheck
              }
              type="button"
              onClick={handleDangerZoneDeleteAllData}
            >
              <Trash2 size={15} />
              {dangerIsDeleting ? 'Menghapus Data...' : 'Hapus Seluruh Data App'}
            </button>
          </div>
        </section>
      )}

      {activeSubpage === 'studio' && (
        <section className="settings-section" aria-label="Studio settings">

          {/* ── STUDIO IDENTITY ─────────────────────────────── */}
          <h3 className="settings-section-title">Studio Identity</h3>

          <form className="settings-studio-form" onSubmit={saveStudioSettingsPage}>
            <div className="settings-studio-grid">
              <StudioTextField
                id="studio-setting-name"
                label="Nama Studio"
                placeholder="37 Music Studio"
                value={studioSettings.studioName}
                onChange={updateStudioSetting('studioName')}
              />

              <StudioTextField
                id="studio-setting-phone"
                inputMode="tel"
                label="WhatsApp / Telepon"
                placeholder="08xxxxxxxxxx"
                value={studioSettings.studioPhone}
                onChange={updateStudioSetting('studioPhone')}
              />
            </div>

            <label className="settings-textarea-field" htmlFor="studio-setting-address">
              <span>Alamat Studio</span>
              <textarea
                id="studio-setting-address"
                placeholder="Jl. Studio No. 37, Tangerang"
                value={studioSettings.studioAddress}
                onChange={updateStudioSetting('studioAddress')}
              />
            </label>

            {/* Preview strip */}
            <div className="settings-studio-preview-strip" aria-label="Preview studio identity">
              <strong>{studioSettings.studioName || defaultStudioSettings.studioName}</strong>
              {studioSettings.studioPhone ? <span>· {studioSettings.studioPhone}</span> : null}
              {studioSettings.studioAddress ? <span>· {studioSettings.studioAddress}</span> : null}
            </div>

            {/* ── TRANSFER & QRIS ──────────────────────────── */}
            <h3 className="settings-section-title settings-section-divider">Transfer &amp; QRIS</h3>

            <div className="settings-studio-grid settings-studio-grid-3">
              <StudioTextField
                id="studio-setting-bank-name"
                label="Nama Bank"
                placeholder="Bank BCA"
                value={studioSettings.bankName}
                onChange={updateStudioSetting('bankName')}
              />

              <StudioTextField
                id="studio-setting-bank-account"
                inputMode="numeric"
                label="Nomor Rekening"
                placeholder="3728902822"
                value={studioSettings.bankAccountNumber}
                onChange={updateStudioSetting('bankAccountNumber')}
              />

              <StudioTextField
                id="studio-setting-bank-holder"
                label="Nama Pemilik"
                placeholder="37 MUSIC STUDIO"
                value={studioSettings.bankAccountHolder}
                onChange={updateStudioSetting('bankAccountHolder')}
              />

              <StudioTextField
                id="studio-setting-qris-label"
                label="Label QRIS"
                placeholder="Scan di kasir studio"
                value={studioSettings.qrisLabel}
                onChange={updateStudioSetting('qrisLabel')}
              />

              <StudioTextField
                id="studio-setting-qris-note"
                label="Catatan QRIS"
                placeholder="Mendukung GoPay, OVO, ShopeePay"
                value={studioSettings.qrisNote}
                onChange={updateStudioSetting('qrisNote')}
              />
            </div>

            {/* Payment preview strip */}
            <div className="settings-studio-preview-strip" aria-label="Preview rekening studio">
              <strong>{studioSettings.bankName || defaultStudioSettings.bankName}</strong>
              <span>· {studioSettings.bankAccountNumber || defaultStudioSettings.bankAccountNumber}</span>
              <span>· A/N: {studioSettings.bankAccountHolder || defaultStudioSettings.bankAccountHolder}</span>
              <span>· {studioSettings.qrisLabel || defaultStudioSettings.qrisLabel}</span>
            </div>

            {/* ── KETENTUAN PEMBAYARAN ─────────────────────── */}
            <div className="settings-section-head-row settings-section-divider">
              <h3 className="settings-section-title">Ketentuan Pembayaran</h3>
              <button className="settings-mini-button is-ghost" type="button" onClick={addStudioPaymentTerm}>
                + Tambah
              </button>
            </div>

            <div className="settings-payment-terms-list">
              {(studioSettings.paymentTerms || defaultStudioSettings.paymentTerms).map((term, index) => (
                <div className="settings-payment-term-row" key={'studio-payment-term-' + index}>
                  <textarea
                    id={'studio-setting-payment-term-' + index}
                    className="settings-payment-term-input"
                    placeholder="Tulis ketentuan pembayaran..."
                    rows={2}
                    value={term}
                    onChange={updateStudioTerm(index)}
                  />
                  <button
                    aria-label={'Hapus ketentuan ' + (index + 1)}
                    className="settings-term-delete-btn"
                    type="button"
                    onClick={() => removeStudioPaymentTerm(index)}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>

            {/* ── ACTIONS ──────────────────────────────────── */}
            {studioSettingsMessage ? (
              <p className="settings-invoice-message" role="status">{studioSettingsMessage}</p>
            ) : null}

            <div className="settings-studio-actions">
              <button className="settings-mini-button is-ghost" type="button" onClick={resetStudioSettingsPage}>
                Reset Default
              </button>
              <button className="settings-mini-button is-primary" type="submit">
                <Save size={14} />
                Simpan Studio Settings
              </button>
            </div>
          </form>

        </section>
      )}

      {activeSubpage === 'pricing' && (
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

      {activeSubpage === 'invoice' && (
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

      {activeSubpage === 'user-settings' && isOwnerAdminUser(currentUser) && (
        <section className="settings-section settings-user-access-section">
          
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
                            : `${enabledCount}/${assignablePages.length} halaman${user.role === 'admin' && user.isGuard ? ` (+ Guard: ${getLinkedGuardName(user.guardId)})` : ''}`}
                        </span>
                      </div>
                    </div>

                    <div className="settings-user-controls-col">
                      {canEditPermissions ? (
                        <>
                          {/* Role select dropdown */}
                          <select
                            value={user.role}
                            onChange={(e) => handleUpdateUserRole(user.id, e.target.value)}
                            className="settings-role-select"
                            aria-label="Update user role"
                          >
                            <option value="admin">Admin</option>
                            <option value="studio_guard">Guard</option>
                          </select>

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

                          {/* Set as Guard checkbox (only for Admins) */}
                          {user.role === 'admin' && (
                            <button
                              type="button"
                              aria-label="Set as Guard"
                              title={user.isGuard ? "Bisa absen jaga (Aktif)" : "Jadikan Penjaga"}
                              onClick={() => {
                                if (user.isGuard) {
                                  handleToggleUserIsGuard(user.id, true);
                                } else {
                                  setSelectingGuardUser(user);
                                  setSelectedCrewId(user.guardId || null);
                                }
                              }}
                              className="settings-icon-action-btn"
                              style={{ 
                                color: user.isGuard ? 'var(--auth-success)' : 'var(--auth-text-muted)',
                                borderColor: user.isGuard ? 'var(--auth-success)' : '',
                                background: user.isGuard ? 'var(--auth-success-soft)' : ''
                              }}
                            >
                              <UserRound size={12} />
                            </button>
                          )}

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
                              onChange={() => handleToggleUserStatus(user.id, user.status)}
                            />
                            <span className="settings-user-toggle-slider"></span>
                          </label>

                          {/* Delete user button */}
                          <button
                            type="button"
                            aria-label="Hapus user"
                            title="Hapus user"
                            onClick={() => handleDeleteUser(user.id, user.email || user.displayName)}
                            className="settings-icon-action-btn is-delete"
                            style={{ marginLeft: '4px' }}
                          >
                            <Trash2 size={12} />
                          </button>
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
                        onClick={() => handleToggleUserStatus(user.id, 'rejected')}
                        className="settings-mini-button is-primary settings-approval-icon-button is-approve"
                        style={{ height: '26px', minHeight: '26px', padding: '0 8px', fontSize: '10px' }}
                      >
                        <ShieldCheck size={11} />
                        Aktifkan
                      </button>

                      <button
                        type="button"
                        aria-label="Hapus user"
                        title="Hapus user"
                        onClick={() => handleDeleteUser(user.id, user.email || user.displayName)}
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

          {approvalSettingsMessage ? (
            <p className="settings-invoice-message" role="status">{approvalSettingsMessage}</p>
          ) : null}

          {/* ── DRAWER MODAL ATUR PERMISSION ── */}
        </section>
      )}
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
                <small>Hubungkan Penjaga Studio</small>
                <h3 id="guard-select-title">Pilih Identitas Crew Penjaga</h3>
                <span>Pilih crew penjaga yang sesuai untuk menghubungkan absensi admin ini.</span>
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
                onClick={() => handleToggleUserIsGuard(selectingGuardUser.id, false, selectedCrewId)}
              >
                Simpan Penjaga
              </button>
            </footer>
          </div>
        </div>
      ) : null}

      <ConfirmDialog config={confirmConfig} onClose={() => setConfirmConfig(null)} />
    </>
  );
}
