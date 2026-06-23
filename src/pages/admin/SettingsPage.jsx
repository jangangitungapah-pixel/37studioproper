import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Clipboard, Crown, DatabaseZap, Edit3, KeyRound, Mail, MonitorSmartphone, Phone, RefreshCcw, Save, ShieldAlert, ShieldCheck, SlidersHorizontal, Trash2, UserRound, X } from 'lucide-react';
import { collection, getDocs, query, orderBy, onSnapshot, doc, updateDoc, writeBatch } from 'firebase/firestore';
import { firestoreDb } from '../../lib/firebase.js';
import StudioSelect from '../../components/ui/StudioSelect.jsx';
import StudioTextField from '../../components/ui/StudioTextField.jsx';
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
  adminPermissionPages,
  countEnabledAdminPermissions,
  defaultAdminPermissions,
  isOwnerAdminUser,
  normalizeAdminPermissions,
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
  makeSettingItemId,
  normalizePricingSettings,
  usePricingSettings,
  savePricingSettings,
} from '../../settings/pricingSettings.js';


const OWNER_EMAIL = 'marsicprod@gmail.com';
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

export default function SettingsPage({ currentUser }) {
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
        key: 'approvals',
        label: 'Persetujuan Admin',
        description: 'Menyetujui atau menghapus akun admin pendaftaran baru.',
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
    savePricingSettings(settings);
  }, [settings]);

  // Sync users list for approvals
  useEffect(() => {
    if (activeSubpage !== 'approvals' || !isOwnerAdminUser(currentUser)) return;

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
          if (doc.id !== currentUser?.uid && data.role !== 'client') {
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

  async function handleRejectUser(userId) {
    if (window.confirm('Tolak atau nonaktifkan request admin ini? Akun tidak akan mendapat akses admin, tetapi pemilik akun masih dapat memilih beralih menjadi client.')) {
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
  }

  function openPermissionSettings(user) {
    setSelectedPermissionUser(user);
    setPermissionDraft(normalizeAdminPermissions(user.permissions));
    setApprovalSettingsMessage('');
  }

  function closePermissionSettings() {
    setSelectedPermissionUser(null);
    setPermissionDraft(defaultAdminPermissions);
  }

  function togglePermissionPage(pageKey) {
    setPermissionDraft((current) => {
      const normalized = normalizeAdminPermissions(current);

      return {
        ...normalized,
        [pageKey]: !normalized[pageKey],
      };
    });

    if (approvalSettingsMessage) setApprovalSettingsMessage('');
  }

  function grantAllPermissions() {
    setPermissionDraft(defaultAdminPermissions);
    if (approvalSettingsMessage) setApprovalSettingsMessage('');
  }

  async function savePermissionSettings(event) {
    event.preventDefault();

    if (!selectedPermissionUser?.id) {
      setApprovalSettingsMessage('User belum dipilih.');
      return;
    }

    const normalized = normalizeAdminPermissions(permissionDraft);
    const enabledCount = countEnabledAdminPermissions(normalized);

    if (!enabledCount) {
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
    const confirmed = window.confirm(
      'Transfer ownership ke ' + targetLabel + '?\\n\\nAkun owner saat ini akan berubah menjadi admin biasa.'
    );

    if (!confirmed) return;

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
      setApprovalSettingsMessage('Ownership belum berhasil ditransfer ke Firestore.');
    }
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

    const item = {
      id: sessionForm.id || makeSettingItemId('session'),
      name: cleanName,
      description: sessionForm.description.trim() || 'Session studio',
      price: toNumber(sessionForm.price),
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
      durationHours: String(item.durationHours),
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

    if (!item.name || !item.durationHours || !item.price) return;

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

    if (!item.name || !item.durationHours || !item.price) return;

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
      durationHours: String(item.durationHours),
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

    const firstConfirm = window.confirm(
      'Aksi ini akan menghapus data operasional app dari Firestore. Data tidak bisa dikembalikan dari UI. Lanjutkan?'
    );

    if (!firstConfirm) return;

    const secondConfirm = window.confirm(
      'Konfirmasi terakhir: hapus data booking, customer, inventory, pembukuan, gallery metadata, notifikasi, settings, dan akun non-owner?'
    );

    if (!secondConfirm) return;

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
    <section
      className={
        activeSubpage === 'account'
          ? 'settings-page is-account-settings'
          : activeSubpage === 'approvals'
            ? 'settings-page is-approvals-settings'
            : activeSubpage === 'danger'
              ? 'settings-page is-danger-settings'
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
          <section className="settings-section settings-account-hero">
            <div className="settings-account-avatar" aria-hidden="true">
              <UserRound size={22} />
            </div>

            <div className="settings-account-hero-copy">
              <p>Admin Account</p>
              <h3>{currentUser?.displayName || currentUser?.email || currentUser?.phoneNumber || 'Admin 37 Music'}</h3>
              <span>{accountContactValue}</span>
            </div>

            <div className="settings-account-badges" aria-label="Status akun">
              <span className="settings-account-badge is-approved">
                <ShieldCheck size={13} />
                {accountStatusLabel}
              </span>
              <span className="settings-account-badge">
                <KeyRound size={13} />
                {accountRoleLabel}
              </span>
            </div>
          </section>

          <section className="settings-section">
            <div className="settings-section-head">
              <div>
                <h3>Identitas Login</h3>
                <p>Informasi dasar akun admin yang sedang aktif di perangkat ini.</p>
              </div>
            </div>

            <div className="settings-account-info-grid">
              <article className="settings-account-info-item">
                <span className="settings-account-info-icon">
                  <Mail size={14} />
                </span>
                <span className="settings-account-info-copy">
                  <small>Email</small>
                  <strong title={currentUser?.email || 'Belum tersedia'}>{currentUser?.email || 'Belum tersedia'}</strong>
                </span>
              </article>

              <article className="settings-account-info-item">
                <span className="settings-account-info-icon">
                  <Phone size={14} />
                </span>
                <span className="settings-account-info-copy">
                  <small>Nomor HP</small>
                  <strong title={currentUser?.phoneNumber || 'Belum tersedia'}>{currentUser?.phoneNumber || 'Belum tersedia'}</strong>
                </span>
              </article>

              <article className="settings-account-info-item">
                <span className="settings-account-info-icon">
                  <MonitorSmartphone size={14} />
                </span>
                <span className="settings-account-info-copy">
                  <small>Provider Login</small>
                  <strong title={accountProviderLabel}>{accountProviderLabel}</strong>
                </span>
              </article>

              <article className="settings-account-info-item">
                <span className="settings-account-info-icon">
                  <KeyRound size={14} />
                </span>
                <span className="settings-account-info-copy">
                  <small>User ID</small>
                  <strong title={currentUser?.uid || accountUidLabel}>{accountUidLabel}</strong>
                </span>
              </article>
            </div>
          </section>

          <section className="settings-section settings-account-profile-section">
            <div className="settings-section-head">
              <div>
                <h3>Profil Akun</h3>
                <p>Ubah nama tampilan admin dan kirim email reset password untuk akun email.</p>
              </div>
            </div>

            <form className="settings-account-form settings-account-profile-form" onSubmit={saveAccountProfilePage}>
              <StudioTextField
                id="account-profile-display-name"
                label="Nama Tampilan"
                placeholder="Contoh: Owner 37 Music"
                value={accountProfileForm.displayName}
                onChange={updateAccountProfileField('displayName')}
              />

              <div className="settings-account-profile-help">
                <small>Reset Password</small>
                <p>Email reset hanya bisa dikirim jika akun ini punya email login.</p>
              </div>

              {accountProfileMessage ? (
                <p className="settings-invoice-message" role="status">{accountProfileMessage}</p>
              ) : null}

              <div className="settings-form-actions settings-account-actions">
                <button
                  className="settings-mini-button is-ghost"
                  disabled={!currentUser?.email}
                  type="button"
                  onClick={sendPasswordResetPage}
                >
                  Kirim Reset Password
                </button>

                <button className="settings-mini-button is-primary" type="submit">
                  <Save size={15} />
                  Simpan Profil
                </button>
              </div>
            </form>
          </section>

          <section className="settings-section">
            <div className="settings-section-head">
              <div>
                <h3>Preferensi Account</h3>
                <p>Preferensi ini disimpan lokal di perangkat dan tidak mengubah data booking, billing, atau pembukuan.</p>
              </div>
            </div>

            <form className="settings-account-form" onSubmit={saveAccountSettingsPage}>
              <StudioSelect
                label="Halaman Awal Admin"
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

              <div className="settings-account-preview">
                <small>Preview Preferensi</small>
                <span>Landing: <strong>{accountLandingLabel}</strong></span>
                <span>Kontak: <strong>{accountPreferredContactLabel}</strong></span>
                <span>Notifikasi: <strong>{accountNotificationLabel}</strong></span>
              </div>

              {accountSettingsMessage ? (
                <p className="settings-invoice-message" role="status">{accountSettingsMessage}</p>
              ) : null}

              <div className="settings-form-actions settings-account-actions">
                <button className="settings-mini-button is-ghost" type="button" onClick={resetAccountSettingsPage}>
                  <RefreshCcw size={15} />
                  Reset Lokal
                </button>
                <button className="settings-mini-button is-primary" type="submit">
                  <Save size={15} />
                  Simpan Account
                </button>
              </div>
            </form>
          </section>

          <section className="settings-section settings-account-security">
            <div className="settings-section-head">
              <div>
                <h3>Access & Security</h3>
                <p>Ringkasan status akses akun. Aksi sensitif tetap mengikuti Firebase Auth dan approval owner.</p>
              </div>
            </div>

            <div className="settings-account-security-list">
              <article>
                <ShieldCheck size={15} />
                <span>
                  <strong>Status akses</strong>
                  <small>{accountStatusLabel}</small>
                </span>
              </article>

              <article>
                <Mail size={15} />
                <span>
                  <strong>Verifikasi email</strong>
                  <small>{currentUser?.emailVerified ? 'Email sudah verified' : 'Belum verified atau tidak tersedia'}</small>
                </span>
              </article>

              <article>
                <MonitorSmartphone size={15} />
                <span>
                  <strong>Login aktif</strong>
                  <small>{accountProviderLabel}</small>
                </span>
              </article>
            </div>

            <div className="settings-account-danger-zone">
              <button className="settings-mini-button" type="button" onClick={copyAccountUid}>
                <Clipboard size={15} />
                Copy UID
              </button>
            </div>
          </section>
        </section>
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
        <section className="settings-section settings-studio-section">
          <div className="settings-section-head">
            <div>
              <h3>Studio Identity</h3>
              <p>Data ini menjadi sumber utama untuk client portal, invoice, reminder WhatsApp, dan informasi pembayaran.</p>
            </div>
          </div>

          <form className="settings-form settings-studio-form" onSubmit={saveStudioSettingsPage}>
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
              label="Nomor Telepon / WhatsApp Studio"
              placeholder="08xxxxxxxxxx"
              value={studioSettings.studioPhone}
              onChange={updateStudioSetting('studioPhone')}
            />

            <label className="settings-textarea-field" htmlFor="studio-setting-address">
              <span>Alamat Studio</span>
              <textarea
                id="studio-setting-address"
                placeholder="Contoh: Jl. Studio No. 37, Tangerang"
                value={studioSettings.studioAddress}
                onChange={updateStudioSetting('studioAddress')}
              />
            </label>

            <div className="settings-invoice-preview" aria-label="Preview studio identity">
              <small>Preview Identitas Studio</small>
              <strong>{studioSettings.studioName || defaultStudioSettings.studioName}</strong>
              {studioSettings.studioAddress ? <span>{studioSettings.studioAddress}</span> : null}
              {studioSettings.studioPhone ? <span>{studioSettings.studioPhone}</span> : null}
              <em>Dipakai lintas portal</em>
            </div>

            <div className="settings-section-head settings-studio-subhead">
              <div>
                <h3>Transfer & QRIS</h3>
                <p>Informasi ini tampil di tab Tagihan client dan dipakai untuk instruksi pembayaran.</p>
              </div>
            </div>

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
              label="Nomor Rekening Transfer"
              placeholder="3728902822"
              value={studioSettings.bankAccountNumber}
              onChange={updateStudioSetting('bankAccountNumber')}
            />

            <StudioTextField
              id="studio-setting-bank-holder"
              label="Nama Pemilik Rekening"
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

            <div className="settings-invoice-preview" aria-label="Preview rekening studio">
              <small>Preview Pembayaran</small>
              <strong>{studioSettings.bankName || defaultStudioSettings.bankName}</strong>
              <span>{studioSettings.bankAccountNumber || defaultStudioSettings.bankAccountNumber}</span>
              <span>A/N: {studioSettings.bankAccountHolder || defaultStudioSettings.bankAccountHolder}</span>
              <em>{studioSettings.qrisLabel || defaultStudioSettings.qrisLabel}</em>
            </div>

            <label className="settings-textarea-field" htmlFor="studio-setting-payment-term-0">
              <span>Ketentuan Pembayaran</span>
              <div className="settings-list">
                {(studioSettings.paymentTerms || defaultStudioSettings.paymentTerms).map((term, index) => (
                  <article className="settings-list-item" key={'studio-payment-term-' + index}>
                    <textarea
                      id={'studio-setting-payment-term-' + index}
                      placeholder="Tulis ketentuan pembayaran..."
                      value={term}
                      onChange={updateStudioTerm(index)}
                    />
                    <div className="settings-row-actions">
                      <button type="button" onClick={() => removeStudioPaymentTerm(index)}>
                        <Trash2 size={15} />
                        Hapus
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </label>

            <div className="settings-form-actions">
              <button className="settings-mini-button is-ghost" type="button" onClick={addStudioPaymentTerm}>
                Tambah Ketentuan
              </button>
              <button className="settings-mini-button is-ghost" type="button" onClick={resetStudioSettingsPage}>
                Reset Default
              </button>
              <button className="settings-mini-button is-primary" type="submit">
                <Save size={15} />
                Simpan Studio Settings
              </button>
            </div>

            {studioSettingsMessage ? (
              <p className="settings-invoice-message" role="status">{studioSettingsMessage}</p>
            ) : null}
          </form>
        </section>
      )}

      {activeSubpage === 'pricing' && (
        <>
          <section className="settings-section">
        <div className="settings-section-head">
          <div>
            <h3>Session List</h3>
            <p>Harga default untuk Rehearsal, Recording, Mixing, Mastering, dan session tambahan.</p>
          </div>
        </div>

        <div className="settings-list">
          {settings.sessions.length ? (
            settings.sessions.map((item) => (
              <article className="settings-list-item" key={item.id}>
                <div>
                  <strong>{item.name}</strong>
                  <span>{item.description}</span>
                </div>
                <em>{formatRupiah(item.price)}</em>
                <div className="settings-row-actions">
                  <button type="button" onClick={() => editSession(item)}>
                    <Edit3 size={15} />
                    Edit
                  </button>
                  <button type="button" onClick={() => deleteSession(item.id)}>
                    <Trash2 size={15} />
                    Hapus
                  </button>
                </div>
              </article>
            ))
          ) : (
            <EmptyState>Belum ada session. Tambahkan minimal satu session agar booking form punya pilihan.</EmptyState>
          )}
        </div>

        <form className="settings-form" onSubmit={saveSession}>
          <StudioTextField
            id="setting-session-name"
            label="Nama Session"
            placeholder="Contoh: Podcast"
            value={sessionForm.name}
            onChange={updateForm(setSessionForm, 'name')}
          />
          <StudioTextField
            id="setting-session-description"
            label="Subsession / Deskripsi kecil"
            placeholder="Contoh: Recording podcast ringan"
            value={sessionForm.description}
            onChange={updateForm(setSessionForm, 'description')}
          />
          <StudioTextField
            id="setting-session-price"
            inputMode="numeric"
            label="Harga Session"
            min="0"
            placeholder="Contoh 100000"
            type="number"
            value={sessionForm.price}
            onChange={updateForm(setSessionForm, 'price')}
          />
          <FormActions editing={Boolean(sessionForm.id)} onCancel={() => setSessionForm(emptySessionForm)} />
        </form>
      </section>

      <section className="settings-section">
        <div className="settings-section-head">
          <div>
            <h3>Discount</h3>
            <p>Discount berdasarkan durasi dan tipe session tertentu.</p>
          </div>
        </div>

        <div className="settings-list">
          {settings.discounts.length ? (
            settings.discounts.map((item) => (
              <article className="settings-list-item" key={item.id}>
                <div>
                  <strong>{formatRupiah(item.nominal)}</strong>
                  <span>{item.durationHours} jam • {getSessionLabel(item.sessionId)}</span>
                </div>
                <em>Discount</em>
                <div className="settings-row-actions">
                  <button type="button" onClick={() => editDiscount(item)}>
                    <Edit3 size={15} />
                    Edit
                  </button>
                  <button type="button" onClick={() => deleteDiscount(item.id)}>
                    <Trash2 size={15} />
                    Hapus
                  </button>
                </div>
              </article>
            ))
          ) : (
            <EmptyState>Belum ada discount.</EmptyState>
          )}
        </div>

        <form className="settings-form" onSubmit={saveDiscount}>
          <StudioTextField
            id="setting-discount-nominal"
            inputMode="numeric"
            label="Nominal Discount"
            min="0"
            placeholder="Contoh 25000"
            type="number"
            value={discountForm.nominal}
            onChange={updateForm(setDiscountForm, 'nominal')}
          />
          <StudioTextField
            id="setting-discount-duration"
            inputMode="decimal"
            label="Durasi yang dikenakan discount"
            min="0"
            placeholder="Contoh 3"
            step="0.5"
            type="number"
            value={discountForm.durationHours}
            onChange={updateForm(setDiscountForm, 'durationHours')}
          />
          <StudioSelect
            label="Tipe Session Discount"
            options={sessionOptions}
            selectedKey={discountForm.sessionId}
            onChange={(nextValue) => setDiscountForm((current) => ({ ...current, sessionId: nextValue }))}
          />
          <FormActions editing={Boolean(discountForm.id)} onCancel={() => setDiscountForm(emptyDiscountForm)} />
        </form>
      </section>

      <section className="settings-section">
        <div className="settings-section-head">
          <div>
            <h3>Recording Type</h3>
            <p>Pilihan tambahan yang muncul saat booking memilih session Recording.</p>
          </div>
        </div>

        <div className="settings-list">
          {settings.recordingTypes.length ? (
            settings.recordingTypes.map((item) => (
              <article className="settings-list-item" key={item.id}>
                <div>
                  <strong>{item.name}</strong>
                  <span>{item.durationHours} jam</span>
                </div>
                <em>{formatRupiah(item.price)}</em>
                <div className="settings-row-actions">
                  <button type="button" onClick={() => editRecording(item)}>
                    <Edit3 size={15} />
                    Edit
                  </button>
                  <button type="button" onClick={() => deleteRecording(item.id)}>
                    <Trash2 size={15} />
                    Hapus
                  </button>
                </div>
              </article>
            ))
          ) : (
            <EmptyState>Belum ada tipe recording.</EmptyState>
          )}
        </div>

        <form className="settings-form" onSubmit={saveRecording}>
          <StudioTextField
            id="setting-recording-name"
            label="Nama Tipe Recording"
            placeholder="Contoh: Live Recording"
            value={recordingForm.name}
            onChange={updateForm(setRecordingForm, 'name')}
          />
          <StudioTextField
            id="setting-recording-duration"
            inputMode="decimal"
            label="Durasi Recording"
            min="0"
            placeholder="Contoh 3"
            step="0.5"
            type="number"
            value={recordingForm.durationHours}
            onChange={updateForm(setRecordingForm, 'durationHours')}
          />
          <StudioTextField
            id="setting-recording-price"
            inputMode="numeric"
            label="Harga Recording"
            min="0"
            placeholder="Contoh 450000"
            type="number"
            value={recordingForm.price}
            onChange={updateForm(setRecordingForm, 'price')}
          />
          <FormActions editing={Boolean(recordingForm.id)} onCancel={() => setRecordingForm(emptyRecordingForm)} />
        </form>
      </section>

      <section className="settings-section">
        <div className="settings-section-head">
          <div>
            <h3>Paket</h3>
            <p>Paket booking khusus. Kalau paket dipilih di form booking, session dan durasi akan terkunci.</p>
          </div>
        </div>

        <div className="settings-list">
          {settings.packages.length ? (
            settings.packages.map((item) => (
              <article className="settings-list-item" key={item.id}>
                <div>
                  <strong>{item.name}</strong>
                  <span>{item.detail} • {item.durationHours} jam</span>
                </div>
                <em>{formatRupiah(item.price)}</em>
                <div className="settings-row-actions">
                  <button type="button" onClick={() => editPackage(item)}>
                    <Edit3 size={15} />
                    Edit
                  </button>
                  <button type="button" onClick={() => deletePackage(item.id)}>
                    <Trash2 size={15} />
                    Hapus
                  </button>
                </div>
              </article>
            ))
          ) : (
            <EmptyState>Belum ada paket.</EmptyState>
          )}
        </div>

        <form className="settings-form" onSubmit={savePackage}>
          <StudioTextField
            id="setting-package-name"
            label="Nama Paket"
            placeholder="Contoh: Band Starter"
            value={packageForm.name}
            onChange={updateForm(setPackageForm, 'name')}
          />
          <StudioTextField
            id="setting-package-detail"
            label="Detail Paket"
            placeholder="Contoh: 3 jam rehearsal + basic recording"
            value={packageForm.detail}
            onChange={updateForm(setPackageForm, 'detail')}
          />
          <StudioTextField
            id="setting-package-duration"
            inputMode="decimal"
            label="Durasi Paket"
            min="0"
            placeholder="Contoh 4"
            step="0.5"
            type="number"
            value={packageForm.durationHours}
            onChange={updateForm(setPackageForm, 'durationHours')}
          />
          <StudioTextField
            id="setting-package-price"
            inputMode="numeric"
            label="Harga Paket"
            min="0"
            placeholder="Contoh 350000"
            type="number"
            value={packageForm.price}
            onChange={updateForm(setPackageForm, 'price')}
          />
          <FormActions editing={Boolean(packageForm.id)} onCancel={() => setPackageForm(emptyPackageForm)} />
        </form>
      </section>
      </>
      )}

      {activeSubpage === 'invoice' && (
        <section className="settings-section settings-invoice-section">
          <div className="settings-section-head">
            <div>
              <h3>Invoice Thermal</h3>
              <p>Atur identitas studio dan tampilan invoice digital yang dipakai di halaman Billing/POS.</p>
            </div>
          </div>

          <form className="settings-form settings-invoice-form" onSubmit={saveInvoiceSettingsPage}>
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

            <StudioSelect
              label="Ukuran Thermal"
              options={paperSizeOptions}
              selectedKey={invoiceSettings.paperSize}
              onChange={updateInvoiceValue('paperSize')}
            />

            <label className="settings-textarea-field" htmlFor="invoice-setting-footer">
              <span>Footer Invoice</span>
              <textarea
                id="invoice-setting-footer"
                placeholder="Terima kasih sudah booking."
                value={invoiceSettings.footer}
                onChange={updateInvoiceSetting('footer')}
              />
            </label>

            <div className="settings-invoice-preview" aria-label="Preview invoice settings">
              <small>Preview Header</small>
              <strong>{invoiceSettings.studioName || defaultInvoiceSettings.studioName}</strong>
              <span>{invoiceSettings.subtitle || defaultInvoiceSettings.subtitle}</span>
              {invoiceSettings.address ? <span>{invoiceSettings.address}</span> : null}
              {invoiceSettings.phone ? <span>{invoiceSettings.phone}</span> : null}
              <em>{invoiceSettings.paperSize || defaultInvoiceSettings.paperSize}</em>
            </div>

            {invoiceSettingsMessage ? (
              <p className="settings-invoice-message" role="status">{invoiceSettingsMessage}</p>
            ) : null}

            <div className="settings-form-actions">
              <button className="settings-mini-button is-ghost" type="button" onClick={resetInvoiceSettingsPage}>
                Reset Default
              </button>
              <button className="settings-mini-button is-primary" type="submit">
                <Save size={15} />
                Simpan Settings
              </button>
            </div>
          </form>
        </section>
      )}

      {activeSubpage === 'approvals' && (
        <section className="settings-section">
          <div className="settings-section-head">
            <div>
              <h3>Daftar Registrasi Admin</h3>
              <p>Hanya akun dengan role admin yang tampil di sini. Setujui untuk memberi akses atau tolak tanpa menghapus identitas Firebase.</p>
            </div>
          </div>

          <div className="settings-list">
            {usersLoading ? (
              <p className="settings-empty-text">Memuat daftar user...</p>
            ) : registeredUsers.length ? (
              registeredUsers.map((user) => (
                <article className="settings-list-item" key={user.id}>
                  <div>
                    <strong>{user.displayName || 'User'}</strong>
                    <span className="settings-approval-date">
                      Terdaftar: {new Date(user.createdAt).toLocaleString('id-ID')}
                    </span>
                  </div>
                  <div className="settings-row-actions settings-approval-actions">
                    {user.role === 'owner' ? (
                      <span className="settings-owner-status-pill" title="Owner aktif" aria-label="Owner aktif">
                        <Crown size={13} />
                      </span>
                    ) : user.status !== 'approved' ? (
                      <button
                        type="button"
                        aria-label="Setujui user"
                        title="Setujui user"
                        onClick={() => handleApproveUser(user.id)}
                        className="settings-mini-button is-primary settings-approval-icon-button is-approve"
                      >
                        <ShieldCheck size={13} />
                      </button>
                    ) : (
                      <span className="settings-approval-status-pill" title="User aktif">
                        Aktif
                      </span>
                    )}

                    {user.role !== 'owner' ? (
                      <button
                        type="button"
                        aria-label="Transfer owner ke user ini"
                        title="Transfer owner ke user ini"
                        onClick={() => transferOwnershipToUser(user)}
                        className="settings-mini-button settings-owner-transfer-button settings-approval-icon-button"
                      >
                        <Crown size={13} />
                      </button>
                    ) : null}

                    <button
                      type="button"
                      aria-label="Atur permission halaman user"
                      title={'Permission: ' + countEnabledAdminPermissions(user.permissions) + '/' + adminPermissionPages.length}
                      onClick={() => openPermissionSettings(user)}
                      className="settings-mini-button settings-permission-open-button settings-approval-icon-button"
                    >
                      <SlidersHorizontal size={13} />
                    </button>

                    <button
                      type="button"
                      aria-label="Tolak atau nonaktifkan admin"
                      title="Tolak atau nonaktifkan admin"
                      onClick={() => handleRejectUser(user.id)}
                      className="settings-mini-button settings-approval-delete-button settings-approval-icon-button"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </article>
              ))
            ) : (
              <p className="settings-empty-text">Tidak ada registrasi admin lain saat ini.</p>
            )}
          </div>

          {approvalSettingsMessage ? (
            <p className="settings-invoice-message" role="status">{approvalSettingsMessage}</p>
          ) : null}

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
                    <small>Permission Settings</small>
                    <h3 id="permission-panel-title">{selectedPermissionUser.displayName || selectedPermissionUser.email || 'Admin User'}</h3>
                    <span>{selectedPermissionUser.email || selectedPermissionUser.phoneNumber || selectedPermissionUser.id}</span>
                  </div>

                  <button type="button" aria-label="Tutup permission settings" onClick={closePermissionSettings}>
                    <X size={16} />
                  </button>
                </header>

                <div className="settings-permission-grid" aria-label="Daftar permission halaman admin">
                  {adminPermissionPages.map((page) => {
                    const enabled = Boolean(permissionDraft[page.key]);

                    return (
                      <button
                        className={enabled ? 'settings-permission-row is-enabled' : 'settings-permission-row'}
                        key={page.key}
                        type="button"
                        onClick={() => togglePermissionPage(page.key)}
                      >
                        <span className="settings-permission-toggle" aria-hidden="true">
                          {enabled ? '✓' : ''}
                        </span>

                        <span>
                          <strong>{page.label}</strong>
                          <small>{page.description}</small>
                        </span>
                      </button>
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

        </section>
      )}
    </section>
  );
}
