import { useEffect, useMemo, useState } from 'react';
import { Edit3, Save, Trash2 } from 'lucide-react';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { firestoreDb } from '../../lib/firebase.js';
import StudioSelect from '../../components/ui/StudioSelect.jsx';
import StudioTextField from '../../components/ui/StudioTextField.jsx';
import {
  formatRupiah,
  getSessionOptions,
  makeSettingItemId,
  normalizePricingSettings,
  usePricingSettings,
  savePricingSettings,
} from '../../settings/pricingSettings.js';


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
        key: 'pricing',
        label: 'Pricing and Session',
        description: 'Harga session, discount, recording type, dan paket.',
      }
    ];
    if (currentUser?.email?.toLowerCase() === 'marsicprod@gmail.com') {
      pages.push({
        key: 'approvals',
        label: 'Persetujuan Admin',
        description: 'Menyetujui atau menghapus akun admin pendaftaran baru.',
      });
    }
    return pages;
  }, [currentUser]);

  const [activeSubpage, setActiveSubpage] = useState('pricing');
  const remoteSettings = usePricingSettings();
  const [settings, setSettings] = useState(() => remoteSettings);

  useEffect(() => {
    setSettings(remoteSettings);
  }, [remoteSettings]);

  const [sessionForm, setSessionForm] = useState(emptySessionForm);
  const [discountForm, setDiscountForm] = useState(emptyDiscountForm);
  const [recordingForm, setRecordingForm] = useState(emptyRecordingForm);
  const [packageForm, setPackageForm] = useState(emptyPackageForm);

  // Approvals State
  const [registeredUsers, setRegisteredUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);

  const sessionOptions = useMemo(() => getSessionOptions(settings), [settings]);

  useEffect(() => {
    savePricingSettings(settings);
  }, [settings]);

  // Sync users list for approvals
  useEffect(() => {
    if (activeSubpage !== 'approvals' || currentUser?.email?.toLowerCase() !== 'marsicprod@gmail.com') return;

    setUsersLoading(true);
    const usersRef = collection(firestoreDb, 'users');
    const q = query(usersRef, orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          if (data.email?.toLowerCase() !== 'marsicprod@gmail.com') {
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

    return unsubscribe;
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

  async function handleDeleteUser(userId) {
    if (window.confirm('Apakah Anda yakin ingin menghapus akun ini? Akun tersebut tidak akan dapat masuk.')) {
      try {
        const docRef = doc(firestoreDb, 'users', userId);
        await deleteDoc(docRef);
      } catch (err) {
        console.error('Failed to delete user:', err);
      }
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

  const activePageInfo = useMemo(() => {
    return subpages.find((page) => page.key === activeSubpage) || subpages[0];
  }, [subpages, activeSubpage]);

  return (
    <section className="settings-page" aria-labelledby="settings-title">
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

      {activeSubpage === 'approvals' && (
        <section className="settings-section">
          <div className="settings-section-head">
            <div>
              <h3>Daftar Registrasi Admin</h3>
              <p>Akun baru yang mendaftar melalui Email, Google, atau Nomor HP. Setujui untuk memberi akses atau hapus untuk menolak.</p>
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
                    <span>
                      {user.email && `Email: ${user.email}`}
                      {user.email && user.phoneNumber && ' • '}
                      {user.phoneNumber && `No HP: ${user.phoneNumber}`}
                      {` (${user.provider})`}
                    </span>
                    <span style={{ display: 'block', fontSize: '0.75rem', opacity: 0.6, marginTop: '4px' }}>
                      Terdaftar: {new Date(user.createdAt).toLocaleString('id-ID')}
                    </span>
                  </div>
                  <div className="settings-row-actions" style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
                    {user.status !== 'approved' ? (
                      <button 
                        type="button" 
                        onClick={() => handleApproveUser(user.id)}
                        className="settings-mini-button is-primary"
                        style={{ padding: '4px 10px', fontSize: '0.75rem', minHeight: 'auto', background: '#2ecc71', borderColor: '#27ae60', color: '#fff' }}
                      >
                        Setujui
                      </button>
                    ) : (
                      <span style={{ color: '#2ecc71', fontSize: '0.78rem', fontWeight: 'bold', marginRight: '8px', display: 'flex', alignItems: 'center' }}>
                        Aktif
                      </span>
                    )}
                    <button 
                      type="button" 
                      onClick={() => handleDeleteUser(user.id)}
                      className="settings-mini-button"
                      style={{ padding: '4px 10px', fontSize: '0.75rem', minHeight: 'auto', color: 'var(--auth-danger)', borderColor: 'rgba(255, 107, 107, 0.3)' }}
                    >
                      Hapus
                    </button>
                  </div>
                </article>
              ))
            ) : (
              <p className="settings-empty-text">Tidak ada registrasi admin lain saat ini.</p>
            )}
          </div>
        </section>
      )}
    </section>
  );
}
