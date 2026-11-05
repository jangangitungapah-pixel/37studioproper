import { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, ClipboardCheck, FileClock, LockKeyhole, RefreshCw, ShieldCheck, Wallet, XCircle } from 'lucide-react';
import { adminOperationsRepository } from '../../services/adminOperationsRepository.js';
import { adminAuthRepository } from '../../services/adminAuthRepository.js';
import '../../styles/modules/bookkeeping-daily-closing.css';

const DENOMINATIONS = [
  { value: 100000, label: 'Rp100.000' },
  { value: 50000, label: 'Rp50.000' },
  { value: 20000, label: 'Rp20.000' },
  { value: 10000, label: 'Rp10.000' },
  { value: 5000, label: 'Rp5.000' },
  { value: 2000, label: 'Rp2.000' },
  { value: 1000, label: 'Rp1.000' },
  { value: 500, label: 'Rp500' },
  { value: 200, label: 'Rp200' },
  { value: 100, label: 'Rp100' },
];

const METHODS = [
  { key: 'cash', label: 'Cash' },
  { key: 'transfer', label: 'Transfer' },
  { key: 'qris', label: 'QRIS' },
  { key: 'other', label: 'Lainnya' },
];

function getJakartaDate() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    day: '2-digit',
    month: '2-digit',
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
  }).formatToParts(new Date());
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return value.year + '-' + value.month + '-' + value.day;
}

function formatCurrency(value) {
  return new Intl.NumberFormat('id-ID', {
    currency: 'IDR',
    maximumFractionDigits: 0,
    style: 'currency',
  }).format(Number(value || 0));
}

function formatTimestamp(value) {
  if (!value) return 'Belum tersedia';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Jakarta',
  }).format(date) + ' WIB';
}

function safeNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0;
}

function buildEmptyDenominations() {
  return Object.fromEntries(DENOMINATIONS.map(({ value }) => [String(value), '0']));
}

function Metric({ label, value, note, tone = '' }) {
  return (
    <article className={'daily-closing-metric ' + tone}>
      <span>{label}</span>
      <strong>{formatCurrency(value)}</strong>
      {note ? <small>{note}</small> : null}
    </article>
  );
}

function StatusLabel({ status }) {
  if (status === 'closed') {
    return <span className="daily-closing-status is-closed"><LockKeyhole size={12} /> Closed</span>;
  }
  if (status === 'reopened') {
    return <span className="daily-closing-status is-reopened"><RefreshCw size={12} /> Reopened</span>;
  }
  return <span className="daily-closing-status is-open"><FileClock size={12} /> Belum ditutup</span>;
}

export default function DailyClosingWorkspace() {
  const [businessDate, setBusinessDate] = useState(getJakartaDate);
  const [registerId, setRegisterId] = useState('main');
  const [openingCash, setOpeningCash] = useState('0');
  const [denominations, setDenominations] = useState(buildEmptyDenominations);
  const [digitalCounts, setDigitalCounts] = useState({ transfer: '0', qris: '0', other: '0' });
  const [varianceReason, setVarianceReason] = useState('');
  const [reviewNote, setReviewNote] = useState('');
  const [preview, setPreview] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [isPasswordPromptOpen, setIsPasswordPromptOpen] = useState(false);
  const [reauthPassword, setReauthPassword] = useState('');
  const [pendingReopenReason, setPendingReopenReason] = useState('');

  const countedCash = useMemo(
    () => DENOMINATIONS.reduce((total, item) => total + item.value * safeNumber(denominations[String(item.value)]), 0),
    [denominations],
  );

  const payload = useMemo(() => ({
    businessDate,
    registerId,
    openingCash: Number(openingCash || 0),
    countedCash,
    cashDenominations: denominations,
    digitalCounts: {
      transfer: Number(digitalCounts.transfer || 0),
      qris: Number(digitalCounts.qris || 0),
      other: Number(digitalCounts.other || 0),
    },
    varianceReason: varianceReason.trim(),
    reviewNote: reviewNote.trim(),
  }), [businessDate, registerId, openingCash, countedCash, denominations, digitalCounts, varianceReason, reviewNote]);

  function resetPreview() {
    setPreview(null);
    setFeedback(null);
  }

  async function loadPreview({ preserveFeedback = false } = {}) {
    setIsLoading(true);
    if (!preserveFeedback) setFeedback(null);
    try {
      const result = await adminOperationsRepository.previewDailyClosing({
        businessDate,
        registerId,
        openingCash: Number(openingCash || 0),
        countedCash,
        cashDenominations: denominations,
        digitalCounts: payload.digitalCounts,
      });
      if (result.isClosed) {
        setOpeningCash(String(result.counts?.openingCash ?? 0));
        setDigitalCounts({ transfer: String(result.counts?.digitalCounts?.transfer ?? 0), qris: String(result.counts?.digitalCounts?.qris ?? 0), other: String(result.counts?.digitalCounts?.other ?? 0) });
        if (result.counts?.cashDenominations) {
          setDenominations(Object.fromEntries(DENOMINATIONS.map(({ value }) => [String(value), String(result.counts.cashDenominations[String(value)] ?? 0)])));
        }
      }
      setPreview(result);
    } catch (error) {
      setFeedback({ type: 'error', message: error?.message || 'Preview closing gagal dimuat.' });
    } finally {
      setIsLoading(false);
    }
  }

  async function closeRegister() {
    if (!preview || preview.isClosed) return;
    setIsSubmitting(true);
    setFeedback(null);
    try {
      const result = await adminOperationsRepository.closeDailyClosing(payload);
      setFeedback({
        type: 'success',
        message: result.duplicate
          ? 'Request sebelumnya sudah tercatat. Tidak ada closing ganda.'
          : 'Closing tersimpan dan snapshot transaksi berhasil dikunci.',
      });
      await loadPreview({ preserveFeedback: true });
    } catch (error) {
      setFeedback({ type: 'error', message: error?.message || 'Closing belum berhasil disimpan.' });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function performReopen(reason, password = '') {
    setIsSubmitting(true);
    setFeedback(null);
    try {
      await adminAuthRepository.reauthenticateCurrentAdmin(password ? { password } : {});
      await adminOperationsRepository.reopenDailyClosing({
        businessDate,
        registerId,
        reason,
      });
      setIsPasswordPromptOpen(false);
      setReauthPassword('');
      setPendingReopenReason('');
      setFeedback({ type: 'success', message: 'Closing dibuka kembali oleh Owner. Snapshot sebelumnya tetap tersimpan di histori.' });
      await loadPreview({ preserveFeedback: true });
    } catch (error) {
      if (error?.code === 'account-password/current-password-required' && !password) {
        setPendingReopenReason(reason);
        setIsPasswordPromptOpen(true);
      } else {
        setFeedback({ type: 'error', message: error?.message || 'Reopen belum berhasil.' });
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  async function reopenRegister() {
    if (!preview?.canReopen || !preview?.isClosed) return;
    const reason = window.prompt('Alasan Owner membuka kembali closing ini (minimal 4 karakter):');
    if (reason === null) return;
    if (reason.trim().length < 4) {
      setFeedback({ type: 'error', message: 'Alasan reopen minimal 4 karakter.' });
      return;
    }
    const confirmed = window.confirm('Snapshot closing akan dibuka kembali. Histori close tetap disimpan. Lanjutkan?');
    if (!confirmed) return;
    await performReopen(reason.trim());
  }

  async function submitPasswordReauthentication(event) {
    event.preventDefault();
    if (!pendingReopenReason || !reauthPassword) return;
    await performReopen(pendingReopenReason, reauthPassword);
  }

  const reconciliation = preview?.reconciliation;
  const varianceExists = Boolean(reconciliation?.hasVariance);
  const canClose = Boolean(preview && !preview.isClosed && !isSubmitting && (!varianceExists || varianceReason.trim().length >= 4));
  const references = preview?.transactionReferences || preview?.existingSession?.transactionReferences || [];
  const session = preview?.existingSession;
  const totals = preview?.totalsByMethod || session?.totalsByMethod || {};

  return (
    <section className="daily-closing-workspace" aria-labelledby="daily-closing-title" aria-busy={isLoading || isSubmitting}>
      <header className="daily-closing-header">
        <div>
          <span className="daily-closing-eyebrow">FINANCE CONTROL / DAILY OPERATIONS</span>
          <h3 id="daily-closing-title">Daily Closing</h3>
          <p>Rekonsiliasi transaksi berdasarkan tanggal bisnis WIB. Snapshot akan terkunci setelah closing.</p>
        </div>
        <StatusLabel status={preview?.status || 'not_opened'} />
      </header>

      <div className="daily-closing-filter-row">
        <label>
          <span>Tanggal bisnis (WIB)</span>
          <input type="date" value={businessDate} onChange={(event) => { setBusinessDate(event.target.value); resetPreview(); }} />
        </label>
        <label>
          <span>Register / Till ID</span>
          <input value={registerId} readOnly aria-describedby="daily-closing-register-note" />
          <small id="daily-closing-register-note" className="daily-closing-register-note">Register main (MVP)</small>
        </label>
        <button type="button" className="daily-closing-preview-button" disabled={isLoading || !businessDate || !registerId} onClick={loadPreview}>
          <ClipboardCheck size={15} /> {isLoading ? 'Menghitung...' : 'Hitung Preview'}
        </button>
      </div>

      <div className="daily-closing-work-grid">
        <section className="daily-closing-panel">
          <div className="daily-closing-panel-title">
            <div><span>01 / PHYSICAL CASH</span><h4>Kas fisik</h4></div>
            <Wallet size={18} />
          </div>
          <label className="daily-closing-field">
            <span>Opening float</span>
            <div className="daily-closing-input-prefix"><b>Rp</b><input type="number" min="0" step="1000" disabled={preview?.isClosed} value={openingCash} onChange={(event) => { setOpeningCash(event.target.value); resetPreview(); }} /></div>
          </label>
          <div className="daily-closing-subheading">
            <strong>Hitung uang fisik</strong>
            <small>Masukkan jumlah lembar / keping</small>
          </div>
          <div className="daily-closing-denominations">
            {DENOMINATIONS.map((item) => (
              <label key={item.value}>
                <span>{item.label}</span>
                <input type="number" min="0" step="1" inputMode="numeric" disabled={preview?.isClosed} value={denominations[String(item.value)]} onChange={(event) => { setDenominations((current) => ({ ...current, [String(item.value)]: event.target.value })); resetPreview(); }} />
              </label>
            ))}
          </div>
          <div className="daily-closing-counted-total"><span>Total kas terhitung</span><strong>{formatCurrency(countedCash)}</strong></div>
        </section>

        <section className="daily-closing-panel">
          <div className="daily-closing-panel-title">
            <div><span>02 / DIGITAL RECONCILIATION</span><h4>Verifikasi non-tunai</h4></div>
            <ShieldCheck size={18} />
          </div>
          <p className="daily-closing-panel-note">Masukkan nilai net mutasi hari ini (masuk dikurangi keluar) yang cocok dengan rekening atau dashboard kanal. Nilainya boleh negatif; ini bukan saldo rekening total.</p>
          {METHODS.filter((method) => method.key !== 'cash').map((method) => (
            <label className="daily-closing-field" key={method.key}>
              <span>{method.label} net terverifikasi</span>
              <div className="daily-closing-input-prefix"><b>Rp</b><input type="number" min="-1000000000000" step="1000" disabled={preview?.isClosed} value={digitalCounts[method.key]} onChange={(event) => { setDigitalCounts((current) => ({ ...current, [method.key]: event.target.value })); resetPreview(); }} /></div>
            </label>
          ))}
          <div className="daily-closing-panel-footnote">Expected digital dihitung terpisah dari kas fisik. QRIS dan transfer tidak menambah cash drawer.</div>
        </section>
      </div>

      {preview ? (
        <>
          <section className="daily-closing-results">
            <div className="daily-closing-section-heading">
              <div><span>03 / SYSTEM CALCULATION</span><h4>Hasil rekonsiliasi</h4></div>
              <small>{preview.transactionCount || 0} transaksi • cutoff {formatTimestamp(session?.cutoffAt || preview.cutoffAt || preview.generatedAt)}</small>
            </div>
            <div className="daily-closing-metrics-grid">
              <Metric label="Opening cash" value={preview.counts?.openingCash ?? session?.openingCash} />
              <Metric label="Expected cash" value={preview.expectedCash ?? session?.expectedCash} note="Opening + cash masuk - cash keluar" />
              <Metric label="Cash terhitung" value={preview.counts?.countedCash ?? session?.countedCash} />
              <Metric label="Variance cash" value={reconciliation?.cashVariance ?? session?.cashVariance} tone={Number(reconciliation?.cashVariance ?? session?.cashVariance) === 0 ? 'is-balanced' : 'is-variance'} />
            </div>
            <div className="daily-closing-method-table">
              <div className="daily-closing-method-row is-heading"><span>Kanal</span><span>Masuk</span><span>Keluar</span><span>Expected net</span><span>Terverifikasi</span><span>Selisih</span></div>
              {METHODS.map((method) => {
                const methodTotal = totals[method.key] || { income: 0, expense: 0, net: 0 };
                const digital = reconciliation?.digital?.[method.key] || session?.digitalReconciliation?.[method.key];
                const counted = method.key === 'cash'
                  ? (preview.counts?.countedCash ?? session?.countedCash)
                  : (digital?.counted ?? session?.digitalCounts?.[method.key]);
                const expected = method.key === 'cash' ? preview.expectedCash : methodTotal.net;
                const variance = method.key === 'cash'
                  ? (reconciliation?.cashVariance ?? session?.cashVariance)
                  : digital?.variance;
                return (
                  <div className="daily-closing-method-row" key={method.key}>
                    <strong>{method.label}</strong>
                    <span>{formatCurrency(methodTotal.income)}</span>
                    <span>{formatCurrency(methodTotal.expense)}</span>
                    <span>{formatCurrency(expected)}</span>
                    <span>{counted === null || counted === undefined ? 'Belum diisi' : formatCurrency(counted)}</span>
                    <span className={Number(variance) === 0 ? 'is-balanced' : 'is-variance'}>{variance === null || variance === undefined ? 'Belum dihitung' : formatCurrency(variance)}</span>
                  </div>
                );
              })}
            </div>
            {!preview.isClosed ? (
              <>
                <label className="daily-closing-field daily-closing-reason">
                  <span>Alasan selisih <b>{varianceExists ? 'Wajib' : 'Isi bila ada selisih'}</b></span>
                  <textarea rows="2" maxLength={600} value={varianceReason} onChange={(event) => setVarianceReason(event.target.value)} placeholder="Contoh: Selisih Rp20.000 karena uang kembalian belum tercatat." />
                </label>
                <label className="daily-closing-field daily-closing-reason">
                  <span>Catatan closing (opsional)</span>
                  <textarea rows="2" maxLength={1000} value={reviewNote} onChange={(event) => setReviewNote(event.target.value)} placeholder="Catatan tambahan untuk Owner atau shift berikutnya." />
                </label>
              </>
            ) : (
              <div className="daily-closing-foot-meta">
                <span>Alasan selisih: {session?.varianceReason || 'Tidak ada selisih yang dicatat.'}</span>
                {session?.reviewNote ? <span>Catatan: {session.reviewNote}</span> : null}
              </div>
            )}
            <div className="daily-closing-foot-meta">
              <span>Fingerprint <code>{preview.sourceFingerprint?.slice(0, 18) || session?.sourceFingerprint?.slice(0, 18) || '-'}</code></span>
              <span>Watermark {formatTimestamp(preview.sourceWatermark || session?.sourceWatermark)}</span>
            </div>
          </section>

          {preview.latePostingCount > 0 ? (
            <section className="daily-closing-late-postings" role="status">
              <div><AlertTriangle size={17} /><strong>{preview.latePostingCount} transaksi terlambat ditemukan</strong></div>
              <p>Transaksi ini dibuat setelah snapshot ditutup. Nilai closing lama tidak diubah otomatis.</p>
              {preview.latePostingExceptions.slice(0, 12).map((row) => (
                <article key={row.id}><span>{row.source} / {row.method.toUpperCase()}</span><strong>{row.type === 'income' ? '+' : '-'}{formatCurrency(row.amount)}</strong><small>{row.id}</small></article>
              ))}
            </section>
          ) : null}

          {preview.events?.length ? (
            <details className="daily-closing-event-history">
              <summary>Riwayat audit closing ({preview.events.length})</summary>
              <div className="daily-closing-event-timeline">
                {preview.events.map((event) => (
                  <article key={event.id}>
                    <span className={'daily-closing-event-marker is-' + event.action} />
                    <div>
                      <strong>{event.action === 'closed' ? 'Closing dikunci' : 'Closing dibuka kembali'} · Revision {event.revision}</strong>
                      <small>{formatTimestamp(event.createdAt)} • {event.actorName || event.actorUid}</small>
                      {event.reason ? <p>{event.reason}</p> : null}
                      {event.snapshot?.reviewNote ? <p>{event.snapshot.reviewNote}</p> : null}
                      {event.snapshot ? <small>{event.snapshot.transactionCount} transaksi • {event.snapshot.sourceFingerprint?.slice(0, 18)}</small> : null}
                    </div>
                  </article>
                ))}
              </div>
            </details>
          ) : null}

          {references.length ? (
            <details className="daily-closing-reference-list">
              <summary>Transaksi dalam snapshot ({references.length})</summary>
              <div className="daily-closing-reference-table">
                {references.slice(0, 30).map((row) => (
                  <article key={row.id}>
                    <span>{row.source} • {row.method.toUpperCase()}</span>
                    <strong className={row.type === 'income' ? 'is-income' : 'is-expense'}>{row.type === 'income' ? '+' : '-'}{formatCurrency(row.amount)}</strong>
                    <small>{row.id}</small>
                  </article>
                ))}
                {references.length > 30 ? <p>{references.length - 30} transaksi lainnya tetap tersimpan di snapshot.</p> : null}
              </div>
            </details>
          ) : null}

          <div className="daily-closing-action-row">
            {preview.isClosed ? (
              <div className="daily-closing-locked-note"><LockKeyhole size={15} /> Snapshot revision {session?.revision || 1} terkunci sejak {formatTimestamp(session?.closedAt)}.</div>
            ) : (
              <button type="button" className="daily-closing-close-button" disabled={!canClose || isLoading} onClick={closeRegister}>
                <LockKeyhole size={15} /> {isSubmitting ? 'Menyimpan...' : 'Tutup dan kunci kas'}
              </button>
            )}
            {preview.isClosed && preview.canReopen ? (
              <button type="button" className="daily-closing-reopen-button" disabled={isSubmitting} onClick={reopenRegister}>
                <RefreshCw size={15} /> Reopen sebagai Owner
              </button>
            ) : null}
          </div>
        </>
      ) : (
        <div className="daily-closing-empty">
          <ClipboardCheck size={24} />
          <strong>Belum ada preview closing</strong>
          <span>Pilih tanggal bisnis, isi opening float dan hasil hitung kas, lalu hitung preview untuk melihat semua transaksi yang masuk.</span>
        </div>
      )}

      {isPasswordPromptOpen ? (
        <div className="daily-closing-password-backdrop">
          <form className="daily-closing-password-dialog" role="dialog" aria-modal="true" aria-labelledby="daily-closing-password-title" onSubmit={submitPasswordReauthentication}>
            <span className="daily-closing-eyebrow">OWNER SECURITY CHECK</span>
            <h4 id="daily-closing-password-title">Verifikasi ulang akun</h4>
            <p>Sesi akun memerlukan password saat ini sebelum snapshot dibuka kembali.</p>
            <label className="daily-closing-field">
              <span>Password Owner</span>
              <input type="password" autoComplete="current-password" required value={reauthPassword} onChange={(event) => setReauthPassword(event.target.value)} />
            </label>
            <div className="daily-closing-action-row">
              <button type="button" className="daily-closing-reopen-button" disabled={isSubmitting} onClick={() => { setIsPasswordPromptOpen(false); setPendingReopenReason(''); setReauthPassword(''); }}>Batal</button>
              <button type="submit" className="daily-closing-close-button" disabled={isSubmitting || !reauthPassword}>{isSubmitting ? 'Memverifikasi...' : 'Verifikasi & Reopen'}</button>
            </div>
          </form>
        </div>
      ) : null}

      {feedback ? (
        <div className={'daily-closing-feedback ' + (feedback.type === 'success' ? 'is-success' : 'is-error')} role="status">
          {feedback.type === 'success' ? <CheckCircle2 size={15} /> : <XCircle size={15} />}
          <span>{feedback.message}</span>
        </div>
      ) : null}
    </section>
  );
}
