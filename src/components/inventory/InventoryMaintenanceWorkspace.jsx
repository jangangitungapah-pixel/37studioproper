import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CalendarClock, CheckCircle2, ClipboardList, Clock3, Plus, RefreshCw, Wrench, X } from 'lucide-react';
import { inventoryRepository } from '../../services/inventoryRepository.js';
import { maintenanceRepository } from '../../services/maintenanceRepository.js';
import { adminAuthRepository } from '../../services/adminAuthRepository.js';
import {
  actOnCanonicalMaintenanceWorkOrder,
  recordCanonicalMaintenanceCost,
  reopenCanonicalMaintenanceWorkOrder,
  reportCanonicalMaintenanceWorkOrder,
} from '../../services/adminOperationsRepository.js';

const STATUS_LABELS = {
  reported: 'Dilaporkan',
  triaged: 'Ditinjau',
  approved: 'Disetujui',
  assigned: 'Ditugaskan',
  in_progress: 'Sedang Dikerjakan',
  waiting_parts: 'Menunggu Spare Part',
  completed: 'Menunggu Verifikasi',
  verified: 'Terverifikasi',
  cancelled: 'Dibatalkan',
};

const PRIORITY_LABELS = {
  low: 'Rendah',
  normal: 'Normal',
  high: 'Tinggi',
  urgent: 'Kritis',
};

const ACTION_LABELS = {
  triage: 'Mulai Triage',
  approve: 'Setujui Pekerjaan',
  assign: 'Tetapkan PIC & Jadwal',
  start: 'Mulai Pengerjaan',
  waiting_parts: 'Tunggu Spare Part',
  resume: 'Lanjutkan Pengerjaan',
  complete: 'Tandai Selesai',
  verify: 'Verifikasi Equipment',
  cancel: 'Batalkan Work Order',
  reopen: 'Reopen Work Order (Owner)',
};

function cleanText(value) {
  return String(value || '').trim();
}

function localBusinessDate() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    day: '2-digit',
    month: '2-digit',
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return values.year + '-' + values.month + '-' + values.day;
}

function formatDateTime(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Jakarta',
  }).format(date);
}

function formatMoney(value) {
  return new Intl.NumberFormat('id-ID', {
    maximumFractionDigits: 0,
    style: 'currency',
    currency: 'IDR',
  }).format(Number(value || 0));
}

function parseAttachmentRefs(value) {
  return String(value || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 10)
    .map((url) => ({ label: url.split('/').pop()?.slice(0, 100) || 'Lampiran', url }));
}

function getQueueKey(workOrder, now) {
  if (workOrder.status === 'reported' || workOrder.status === 'triaged') return 'reported';
  if (workOrder.status === 'waiting_parts') return 'waiting_parts';
  if (workOrder.status === 'completed') return 'verification';
  if (workOrder.dueAt && new Date(workOrder.dueAt).getTime() < now && !['verified', 'cancelled'].includes(workOrder.status)) return 'overdue';
  if (['assigned', 'in_progress', 'approved'].includes(workOrder.status)) return 'active';
  return 'all';
}

function getAvailableActions(workOrder) {
  const actions = {
    reported: ['triage', 'cancel'],
    triaged: ['approve', 'cancel'],
    approved: ['assign', 'cancel'],
    assigned: ['start', 'cancel'],
    in_progress: ['waiting_parts', 'complete', 'cancel'],
    waiting_parts: ['resume', 'cancel'],
    completed: ['verify'],
    verified: ['reopen'],
  };
  return actions[workOrder.status] || [];
}

function StatusPill({ status }) {
  return <span className={'maintenance-status-pill is-' + status}>{STATUS_LABELS[status] || status}</span>;
}

function MaintenanceMetric({ icon: Icon, label, value, tone = '' }) {
  return (
    <article className={'maintenance-metric ' + tone}>
      <span><Icon size={16} aria-hidden="true" /></span>
      <small>{label}</small>
      <strong>{value}</strong>
    </article>
  );
}

function MaintenanceActionForm({ action, busy, onCancel, onSubmit }) {
  const [form, setForm] = useState({
    diagnosis: '',
    priority: 'normal',
    note: '',
    assignedToName: '',
    assignedToUid: '',
    plannedAt: '',
    dueAt: '',
    reason: '',
    repairNotes: '',
    verificationCondition: 'good',
    verificationNote: '',
    password: '',
  });
  const [error, setError] = useState('');

  function setField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
    if (error) setError('');
  }

  async function submit(event) {
    event.preventDefault();
    let payload = {};
    if (action === 'triage') {
      if (cleanText(form.diagnosis).length < 4) return setError('Diagnosis minimal 4 karakter.');
      payload = { diagnosis: form.diagnosis, priority: form.priority };
    } else if (action === 'assign') {
      if (!cleanText(form.assignedToName)) return setError('Nama PIC wajib diisi.');
      if (form.plannedAt && form.dueAt && new Date(form.dueAt) < new Date(form.plannedAt)) {
        return setError('Target selesai tidak boleh sebelum jadwal maintenance.');
      }
      payload = {
        assignedToName: form.assignedToName,
        assignedToUid: form.assignedToUid,
        plannedAt: form.plannedAt ? new Date(form.plannedAt).toISOString() : '',
        dueAt: form.dueAt ? new Date(form.dueAt).toISOString() : '',
      };
    } else if (action === 'waiting_parts' || action === 'cancel' || action === 'reopen') {
      if (cleanText(form.reason).length < 4) return setError('Alasan minimal 4 karakter.');
      payload = { reason: form.reason, ...(action === 'reopen' ? { password: form.password } : {}) };
    } else if (action === 'complete') {
      if (cleanText(form.repairNotes).length < 4) return setError('Catatan perbaikan minimal 4 karakter.');
      payload = { repairNotes: form.repairNotes };
    } else if (action === 'verify') {
      if (form.verificationCondition === 'broken' && cleanText(form.verificationNote).length < 4) {
        return setError('Catatan wajib diisi bila equipment masih rusak.');
      }
      payload = {
        verificationCondition: form.verificationCondition,
        verificationNote: form.verificationNote,
      };
    } else {
      payload = { note: form.note };
    }

    const result = await onSubmit(payload);
    if (result?.error) setError(result.error);
  }

  return (
    <form className="maintenance-action-form" onSubmit={submit}>
      <header>
        <div>
          <small>Work order action</small>
          <strong>{ACTION_LABELS[action]}</strong>
        </div>
        <button aria-label="Tutup form aksi" disabled={busy} type="button" onClick={onCancel}><X size={16} /></button>
      </header>

      {action === 'triage' ? (
        <>
          <label><span>Diagnosis awal</span><textarea required value={form.diagnosis} onChange={(event) => setField('diagnosis', event.target.value)} placeholder="Jelaskan hasil pemeriksaan awal..." /></label>
          <label><span>Prioritas</span><select value={form.priority} onChange={(event) => setField('priority', event.target.value)}><option value="low">Rendah</option><option value="normal">Normal</option><option value="high">Tinggi</option><option value="urgent">Kritis</option></select></label>
        </>
      ) : null}

      {action === 'assign' ? (
        <>
          <label><span>Nama PIC / Teknisi</span><input required value={form.assignedToName} onChange={(event) => setField('assignedToName', event.target.value)} placeholder="Nama teknisi" /></label>
          <label><span>UID PIC (opsional)</span><input value={form.assignedToUid} onChange={(event) => setField('assignedToUid', event.target.value)} placeholder="Firebase UID jika tersedia" /></label>
          <div className="maintenance-form-grid">
            <label><span>Jadwal maintenance</span><input type="datetime-local" value={form.plannedAt} onChange={(event) => setField('plannedAt', event.target.value)} /></label>
            <label><span>Target selesai</span><input type="datetime-local" value={form.dueAt} onChange={(event) => setField('dueAt', event.target.value)} /></label>
          </div>
        </>
      ) : null}

      {action === 'waiting_parts' || action === 'cancel' || action === 'reopen' ? (
        <label><span>Alasan</span><textarea required value={form.reason} onChange={(event) => setField('reason', event.target.value)} placeholder={action === 'cancel' ? 'Alasan pembatalan...' : action === 'reopen' ? 'Alasan work order dibuka kembali...' : 'Spare part apa yang ditunggu dan mengapa...'} /></label>
      ) : null}

      {action === 'reopen' ? (
        <label><span>Password saat ini (akun Google dapat memakai popup)</span><input autoComplete="current-password" type="password" value={form.password} onChange={(event) => setField('password', event.target.value)} placeholder="Kosongkan untuk verifikasi Google bila tersedia" /></label>
      ) : null}

      {action === 'complete' ? (
        <label><span>Catatan perbaikan</span><textarea required value={form.repairNotes} onChange={(event) => setField('repairNotes', event.target.value)} placeholder="Jelaskan tindakan perbaikan dan hasilnya..." /></label>
      ) : null}

      {action === 'verify' ? (
        <>
          <label><span>Hasil pemeriksaan</span><select value={form.verificationCondition} onChange={(event) => setField('verificationCondition', event.target.value)}><option value="good">Baik, siap dipakai</option><option value="fair">Cukup, masih aman digunakan</option><option value="broken">Masih rusak, tetap nonaktif</option></select></label>
          <label><span>Catatan verifikasi</span><textarea value={form.verificationNote} onChange={(event) => setField('verificationNote', event.target.value)} placeholder="Catatan pemeriksaan akhir..." /></label>
        </>
      ) : null}

      {action === 'approve' || action === 'resume' ? (
        <label><span>Catatan (opsional)</span><textarea value={form.note} onChange={(event) => setField('note', event.target.value)} placeholder="Catatan operasional..." /></label>
      ) : null}

      {error ? <p className="maintenance-error" role="alert">{error}</p> : null}
      <footer>
        <button disabled={busy} type="button" onClick={onCancel}>Batal</button>
        <button className="is-primary" disabled={busy} type="submit">{busy ? 'Memproses...' : 'Konfirmasi Aksi'}</button>
      </footer>
    </form>
  );
}

export default function InventoryMaintenanceWorkspace() {
  const [items, setItems] = useState([]);
  const [adminSession, setAdminSession] = useState(null);
  const [workOrders, setWorkOrders] = useState([]);
  const [events, setEvents] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [queue, setQueue] = useState('all');
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(false);
  const [showReportForm, setShowReportForm] = useState(false);
  const [pendingAction, setPendingAction] = useState('');
  const [costForm, setCostForm] = useState({ amount: '', paymentMethod: 'cash', date: localBusinessDate(), note: '' });
  const [reportForm, setReportForm] = useState({
    inventoryItemId: '',
    title: '',
    description: '',
    priority: 'normal',
    plannedAt: '',
    dueAt: '',
    vendor: '',
    estimatedCost: '',
    attachmentsText: '',
  });

  useEffect(() => adminAuthRepository.subscribeAdminAuth((state) => {
    setAdminSession(state?.user || null);
  }), []);

  useEffect(() => {
    const stopOrders = maintenanceRepository.subscribeMaintenanceWorkOrders(
      (rows) => {
        setWorkOrders(rows);
        setIsLoading(false);
        setLoadError('');
      },
      (error) => {
        setIsLoading(false);
        setLoadError(error?.message || 'Work order belum dapat dimuat.');
      },
      300,
    );
    const stopEvents = maintenanceRepository.subscribeMaintenanceEvents(
      setEvents,
      (error) => setLoadError(error?.message || 'Riwayat maintenance belum dapat dimuat.'),
      500,
    );
    const stopItems = inventoryRepository.subscribeInventoryItems(
      setItems,
      (error) => setLoadError(error?.message || 'Inventory belum dapat dimuat.'),
    );
    return () => {
      stopOrders();
      stopEvents();
      stopItems();
    };
  }, []);

  const now = Date.now();
  const queueCounts = useMemo(() => workOrders.reduce((counts, row) => {
    const key = getQueueKey(row, now);
    counts.all += 1;
    if (key !== 'all') counts[key] = (counts[key] || 0) + 1;
    return counts;
  }, { all: 0, reported: 0, active: 0, overdue: 0, waiting_parts: 0, verification: 0 }), [workOrders, now]);

  const filteredOrders = useMemo(() => workOrders.filter((row) => {
    if (queue === 'all') return true;
    return getQueueKey(row, now) === queue;
  }), [now, queue, workOrders]);

  const selectedOrder = workOrders.find((row) => row.id === selectedId) || filteredOrders[0] || null;
  const selectedEvents = useMemo(
    () => events.filter((event) => event.workOrderId === selectedOrder?.id)
      .sort((first, second) => String(second.createdAt || '').localeCompare(String(first.createdAt || ''))),
    [events, selectedOrder?.id],
  );

  const metrics = useMemo(() => ({
    outOfService: items.filter((item) => ['maintenance', 'broken'].includes(item.status) || item.condition === 'maintenance').length,
    overdue: workOrders.filter((row) => getQueueKey(row, now) === 'overdue').length,
    awaitingVerification: workOrders.filter((row) => row.status === 'completed').length,
    inProgress: workOrders.filter((row) => ['assigned', 'in_progress', 'waiting_parts'].includes(row.status)).length,
  }), [items, now, workOrders]);

  function patchReport(field, value) {
    setReportForm((current) => ({ ...current, [field]: value }));
  }

  async function createReport(event) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      const result = await reportCanonicalMaintenanceWorkOrder({
        ...reportForm,
        estimatedCost: Number(reportForm.estimatedCost || 0),
        plannedAt: reportForm.plannedAt ? new Date(reportForm.plannedAt).toISOString() : '',
        dueAt: reportForm.dueAt ? new Date(reportForm.dueAt).toISOString() : '',
        attachments: parseAttachmentRefs(reportForm.attachmentsText),
      });
      setSelectedId(result.workOrder?.id || '');
      setShowReportForm(false);
      setReportForm({
        inventoryItemId: '',
        title: '',
        description: '',
        priority: 'normal',
        plannedAt: '',
        dueAt: '',
        vendor: '',
        estimatedCost: '',
        attachmentsText: '',
      });
      setNotice({ type: 'success', message: 'Work order berhasil dibuat dan equipment dikunci ke status Maintenance.' });
    } catch (error) {
      setNotice({ type: 'error', message: error?.message || 'Work order gagal dibuat.' });
    } finally {
      setBusy(false);
    }
  }

  async function submitAction(payload) {
    if (!selectedOrder || busy) return { error: 'Work order belum dipilih.' };
    setBusy(true);
    try {
      let result;
      if (pendingAction === 'reopen') {
        await adminAuthRepository.reauthenticateCurrentAdmin({ password: payload.password || '' });
        result = await reopenCanonicalMaintenanceWorkOrder({
          expectedRevision: selectedOrder.revision,
          reason: payload.reason,
          workOrderId: selectedOrder.id,
        });
      } else {
        result = await actOnCanonicalMaintenanceWorkOrder({
          ...payload,
          action: pendingAction,
          expectedRevision: selectedOrder.revision,
          expectedStatus: selectedOrder.status,
          workOrderId: selectedOrder.id,
        });
      }
      setSelectedId(result.workOrder?.id || selectedOrder.id);
      setPendingAction('');
      setNotice({ type: 'success', message: 'Status work order diperbarui: ' + (STATUS_LABELS[result.workOrder?.status] || 'berhasil') + '.' });
      return { result };
    } catch (error) {
      const message = error?.message || 'Aksi maintenance gagal.';
      setNotice({ type: 'error', message });
      return { error: message };
    } finally {
      setBusy(false);
    }
  }

  async function submitCost(event) {
    event.preventDefault();
    if (!selectedOrder || busy) return;
    setBusy(true);
    try {
      await recordCanonicalMaintenanceCost({
        workOrderId: selectedOrder.id,
        expectedRevision: selectedOrder.revision,
        amount: Number(costForm.amount),
        paymentMethod: costForm.paymentMethod,
        date: costForm.date,
        note: costForm.note,
      });
      setCostForm({ amount: '', paymentMethod: 'cash', date: localBusinessDate(), note: '' });
      setNotice({ type: 'success', message: 'Expense maintenance sudah diposting ke Bookkeeping dan ditautkan ke work order.' });
    } catch (error) {
      setNotice({ type: 'error', message: error?.message || 'Biaya maintenance gagal dicatat.' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="inventory-maintenance-workspace" aria-label="Equipment maintenance workspace">
      <header className="maintenance-editorial-header">
        <div>
          <span className="maintenance-kicker">Equipment reliability</span>
          <h2>Maintenance Work Orders</h2>
          <p>Laporkan gangguan, tugaskan teknisi, pantau perbaikan, dan verifikasi sebelum alat kembali digunakan.</p>
        </div>
        <button className="maintenance-primary-button" type="button" onClick={() => setShowReportForm((value) => !value)}>
          <Plus size={15} /> Laporkan Kerusakan
        </button>
      </header>

      <div className="maintenance-metrics">
        <MaintenanceMetric icon={Wrench} label="Out of Service" value={metrics.outOfService} tone="is-warning" />
        <MaintenanceMetric icon={Clock3} label="Sedang Ditangani" value={metrics.inProgress} />
        <MaintenanceMetric icon={CalendarClock} label="Overdue" value={metrics.overdue} tone="is-danger" />
        <MaintenanceMetric icon={CheckCircle2} label="Awaiting Verification" value={metrics.awaitingVerification} tone="is-info" />
      </div>

      {notice ? (
        <div className={'maintenance-notice is-' + notice.type} role={notice.type === 'error' ? 'alert' : 'status'}>
          <span>{notice.message}</span>
          <button type="button" aria-label="Tutup notifikasi" onClick={() => setNotice(null)}><X size={14} /></button>
        </div>
      ) : null}

      {showReportForm ? (
        <form className="maintenance-report-panel" onSubmit={createReport}>
          <header><div><small>New maintenance ticket</small><strong>Laporkan Equipment Bermasalah</strong></div><button aria-label="Tutup form" type="button" onClick={() => setShowReportForm(false)}><X size={16} /></button></header>
          <div className="maintenance-form-grid">
            <label><span>Equipment</span><select required value={reportForm.inventoryItemId} onChange={(event) => patchReport('inventoryItemId', event.target.value)}><option value="">Pilih equipment</option>{items.filter((item) => !['inactive', 'lost'].includes(item.status)).map((item) => <option key={item.id} value={item.id}>{item.name} · {item.location || 'Lokasi belum diatur'}</option>)}</select></label>
            <label><span>Prioritas</span><select value={reportForm.priority} onChange={(event) => patchReport('priority', event.target.value)}><option value="low">Rendah</option><option value="normal">Normal</option><option value="high">Tinggi</option><option value="urgent">Kritis</option></select></label>
          </div>
          <label><span>Judul masalah</span><input required minLength="3" value={reportForm.title} onChange={(event) => patchReport('title', event.target.value)} placeholder="Contoh: Channel kanan mixer tidak mengeluarkan audio" /></label>
          <label><span>Deskripsi / gejala</span><textarea required minLength="4" value={reportForm.description} onChange={(event) => patchReport('description', event.target.value)} placeholder="Ceritakan gejala, kondisi terakhir, dan kapan masalah muncul..." /></label>
          <div className="maintenance-form-grid maintenance-form-grid-three">
            <label><span>Jadwal maintenance</span><input type="datetime-local" value={reportForm.plannedAt} onChange={(event) => patchReport('plannedAt', event.target.value)} /></label>
            <label><span>Target selesai</span><input type="datetime-local" value={reportForm.dueAt} onChange={(event) => patchReport('dueAt', event.target.value)} /></label>
            <label><span>Estimasi biaya (Rp)</span><input min="0" step="1000" type="number" value={reportForm.estimatedCost} onChange={(event) => patchReport('estimatedCost', event.target.value)} placeholder="Opsional" /></label>
          </div>
          <div className="maintenance-form-grid">
            <label><span>Vendor / tempat servis</span><input value={reportForm.vendor} onChange={(event) => patchReport('vendor', event.target.value)} placeholder="Opsional" /></label>
            <label><span>Referensi lampiran (URL, satu per baris)</span><textarea value={reportForm.attachmentsText} onChange={(event) => patchReport('attachmentsText', event.target.value)} placeholder="https://..." /></label>
          </div>
          <footer><span>Item langsung diberi status Maintenance setelah laporan tersimpan.</span><button className="is-primary" disabled={busy} type="submit">{busy ? 'Menyimpan...' : 'Buat Work Order'}</button></footer>
        </form>
      ) : null}

      <div className="maintenance-queue-tabs" role="tablist" aria-label="Filter work order">
        {[
          ['all', 'Semua', queueCounts.all],
          ['reported', 'Perlu Triage', queueCounts.reported],
          ['active', 'Aktif', queueCounts.active],
          ['overdue', 'Overdue', queueCounts.overdue],
          ['waiting_parts', 'Spare Part', queueCounts.waiting_parts],
          ['verification', 'Verifikasi', queueCounts.verification],
        ].map(([key, label, count]) => (
          <button aria-selected={queue === key} className={queue === key ? 'is-active' : ''} key={key} role="tab" type="button" onClick={() => setQueue(key)}>
            {label}<strong>{count}</strong>
          </button>
        ))}
      </div>

      {loadError ? <div className="maintenance-empty-state is-error"><AlertTriangle size={18} /><strong>Data maintenance belum lengkap</strong><span>{loadError}</span></div> : null}
      {!loadError && isLoading ? <div className="maintenance-empty-state"><RefreshCw className="auth-spin" size={18} /><span>Memuat work order...</span></div> : null}
      {!isLoading && !loadError ? (
        <div className="maintenance-workspace-grid">
          <div className="maintenance-work-order-list">
            {filteredOrders.length ? filteredOrders.map((row) => (
              <button className={'maintenance-work-order-card ' + (selectedOrder?.id === row.id ? 'is-selected' : '')} key={row.id} type="button" onClick={() => { setSelectedId(row.id); setPendingAction(''); }}>
                <div><span>{row.itemName || 'Equipment'}</span><StatusPill status={row.status} /></div>
                <strong>{row.title}</strong>
                <p>{row.description}</p>
                <footer><small>{PRIORITY_LABELS[row.priority] || row.priority} · PIC {row.assignedToName || 'Belum ditugaskan'}</small><small>{row.dueAt ? 'Due ' + formatDateTime(row.dueAt) : 'Belum ada due date'}</small></footer>
              </button>
            )) : (
              <div className="maintenance-empty-state"><ClipboardList size={20} /><strong>Queue masih kosong</strong><span>Belum ada work order pada filter ini.</span></div>
            )}
          </div>

          <aside className="maintenance-detail-panel">
            {selectedOrder ? (
              <>
                <header className="maintenance-detail-header">
                  <div><small>Work order · {selectedOrder.id.slice(0, 10)}</small><h3>{selectedOrder.title}</h3><span>{selectedOrder.itemName}</span></div>
                  <StatusPill status={selectedOrder.status} />
                </header>
                <p className="maintenance-detail-description">{selectedOrder.description}</p>
                <div className="maintenance-detail-facts">
                  <div><small>Prioritas</small><strong>{PRIORITY_LABELS[selectedOrder.priority] || selectedOrder.priority}</strong></div>
                  <div><small>PIC</small><strong>{selectedOrder.assignedToName || 'Belum ditugaskan'}</strong></div>
                  <div><small>Jadwal</small><strong>{formatDateTime(selectedOrder.plannedAt)}</strong></div>
                  <div><small>Target selesai</small><strong>{formatDateTime(selectedOrder.dueAt)}</strong></div>
                  <div><small>Estimasi biaya</small><strong>{formatMoney(selectedOrder.estimatedCost)}</strong></div>
                  <div><small>Biaya aktual</small><strong>{selectedOrder.costEntryId ? formatMoney(selectedOrder.actualCost) : 'Belum dicatat'}</strong></div>
                </div>

                {selectedOrder.diagnosis ? <div className="maintenance-detail-note"><small>Diagnosis</small><p>{selectedOrder.diagnosis}</p></div> : null}
                {selectedOrder.repairNotes ? <div className="maintenance-detail-note"><small>Catatan perbaikan</small><p>{selectedOrder.repairNotes}</p></div> : null}
                {selectedOrder.verificationNote ? <div className="maintenance-detail-note"><small>Verifikasi</small><p>{selectedOrder.verificationNote} · {selectedOrder.verificationCondition}</p></div> : null}
                {selectedOrder.attachments?.length ? <div className="maintenance-detail-note"><small>Lampiran</small>{selectedOrder.attachments.map((attachment) => <a href={attachment.url} key={attachment.url} rel="noreferrer" target="_blank">{attachment.label || attachment.url}</a>)}</div> : null}

                <div className="maintenance-detail-actions">
                  {getAvailableActions(selectedOrder).filter((action) => action !== 'reopen' || adminSession?.isOwner === true).map((action) => (
                    <button className={action === 'cancel' ? 'is-subtle-danger' : action === 'verify' ? 'is-primary' : ''} key={action} type="button" onClick={() => setPendingAction(action)}>{ACTION_LABELS[action]}</button>
                  ))}
                </div>

                {pendingAction ? (
                  <MaintenanceActionForm action={pendingAction} busy={busy} onCancel={() => setPendingAction('')} onSubmit={submitAction} />
                ) : null}

                {['completed', 'verified'].includes(selectedOrder.status) && !selectedOrder.costEntryId && (adminSession?.isOwner === true || adminSession?.permissions?.bookkeeping === true) ? (
                  <form className="maintenance-cost-form" onSubmit={submitCost}>
                    <header><div><small>Finance integration</small><strong>Catat Biaya Maintenance</strong></div></header>
                    <label><span>Nominal aktual (Rp)</span><input required min="1" step="1000" type="number" value={costForm.amount} onChange={(event) => setCostForm((current) => ({ ...current, amount: event.target.value }))} /></label>
                    <div className="maintenance-form-grid">
                      <label><span>Tanggal transaksi</span><input required type="date" value={costForm.date} onChange={(event) => setCostForm((current) => ({ ...current, date: event.target.value }))} /></label>
                      <label><span>Metode pembayaran</span><select value={costForm.paymentMethod} onChange={(event) => setCostForm((current) => ({ ...current, paymentMethod: event.target.value }))}><option value="cash">Cash</option><option value="transfer">Transfer</option><option value="qris">QRIS</option><option value="other">Lainnya</option></select></label>
                    </div>
                    <label><span>Catatan</span><textarea required minLength="4" value={costForm.note} onChange={(event) => setCostForm((current) => ({ ...current, note: event.target.value }))} placeholder="Vendor, invoice, atau rincian biaya..." /></label>
                    <button className="is-primary" disabled={busy} type="submit">{busy ? 'Memposting...' : 'Posting Expense'}</button>
                  </form>
                ) : null}
                {selectedOrder.costEntryId ? <div className="maintenance-cost-posted"><CheckCircle2 size={15} /> Biaya sudah tercatat di Bookkeeping · {selectedOrder.costEntryId.slice(0, 12)}</div> : null}

                <section className="maintenance-timeline">
                  <header><small>Audit trail</small><strong>Riwayat Work Order</strong></header>
                  {selectedEvents.length ? selectedEvents.map((event) => (
                    <article key={event.id}><span className="maintenance-timeline-dot" /><div><strong>{ACTION_LABELS[event.action] || event.action}</strong><small>{formatDateTime(event.createdAt)} · {event.actorName || 'Admin'}</small>{event.reason ? <p>{event.reason}</p> : null}</div></article>
                  )) : <span className="maintenance-muted">Belum ada event tercatat.</span>}
                </section>
              </>
            ) : (
              <div className="maintenance-empty-state"><Wrench size={20} /><strong>Pilih work order</strong><span>Detail, tindakan, dan audit trail akan tampil di sini.</span></div>
            )}
          </aside>
        </div>
      ) : null}
    </section>
  );
}
