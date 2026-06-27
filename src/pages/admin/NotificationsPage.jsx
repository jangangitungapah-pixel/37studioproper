import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  BellRing,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock3,
  KeyRound,
  LoaderCircle,
  RadioTower,
  RefreshCcw,
  RotateCcw,
  Send,
  ShieldAlert,
  Wifi,
  XCircle,
} from 'lucide-react';
import {
  cancelNotificationEvent,
  getNotificationEventStatusLabel,
  notificationEventStatusOptions,
  retryNotificationEvent,
  subscribeNotificationEvents,
} from '../../services/notificationEventRepository.js';
import {
  getBrowserNotificationPermission,
  getOneSignalState,
  isOneSignalBrowserSupported,
  isOneSignalConfigured,
} from '../../services/oneSignalService.js';
import {
  fetchNotificationSubscription,
  isNotificationSubscriptionActive,
} from '../../services/notificationSubscriptionRepository.js';
import '../../styles/admin-auth.css';

const DEFAULT_WORKER_URL =
  import.meta.env.VITE_NOTIFICATION_WORKER_URL ||
  'https://studio37-onesignal-notification-worker.studio37.workers.dev';

const visibleStatusOptions = notificationEventStatusOptions.filter((item) =>
  ['all', 'pending', 'sent', 'failed', 'cancelled'].includes(item.key)
);

function formatRelativeTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  const diffMs = Date.now() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);
  if (diffSec < 60) return diffSec + 'd';
  if (diffMin < 60) return diffMin + 'm';
  if (diffHour < 24) return diffHour + 'j';
  return diffDay + 'h';
}

function formatDateTime(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

function formatTypeLabel(type) {
  return String(type || 'event')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function getEventTypeIcon(type) {
  const t = String(type || '');
  if (t.includes('booking')) return 'BOOK';
  if (t.includes('payment') || t.includes('proof')) return 'PAY';
  if (t.includes('guard') || t.includes('attendance')) return 'GUARD';
  if (t.includes('message')) return 'MSG';
  return 'BELL';
}

function getStatusDotClass(status) {
  if (status === 'sent') return 'notif-dot-sent';
  if (status === 'failed' || status === 'cancelled') return 'notif-dot-error';
  if (status === 'processing') return 'notif-dot-processing';
  return 'notif-dot-pending';
}

function getStatusBadgeClass(status) {
  if (status === 'sent') return 'notif-badge-sent';
  if (status === 'failed' || status === 'cancelled') return 'notif-badge-error';
  if (status === 'processing') return 'notif-badge-processing';
  return 'notif-badge-pending';
}

function getReadinessTone(isReady) { return isReady ? 'success' : 'warning'; }

function formatHealthValue(value) {
  if (value === true) return 'Ya';
  if (value === false) return 'Tidak';
  return String(value || '-');
}

function createReadinessItem({ helper = '', isReady = false, label, value }) {
  return { helper, label, tone: getReadinessTone(isReady), value: formatHealthValue(value) };
}

function buildReadinessItems({ eventStats, oneSignalState, registry, workerHealth }) {
  const permission = oneSignalState?.permission || getBrowserNotificationPermission();
  const isBrowserReady = Boolean(isOneSignalConfigured() && isOneSignalBrowserSupported());
  const isOneSignalReady = Boolean(
    oneSignalState?.supported && permission === 'granted' && oneSignalState?.optedIn && oneSignalState?.subscriptionId
  );
  const isRegistryReady = isNotificationSubscriptionActive(registry);
  const isWorkerReady = workerHealth?.ok === true;
  const isQueueReady = Number(eventStats?.failed || 0) === 0;
  return [
    createReadinessItem({ helper: 'App ID, HTTPS, Notification API, Service Worker.', isReady: isBrowserReady, label: 'Browser Support', value: isBrowserReady }),
    createReadinessItem({ helper: 'Permission granted, opted-in, subscriptionId tersedia.', isReady: isOneSignalReady, label: 'OneSignal Device', value: oneSignalState?.subscriptionId ? 'Subscribed' : permission }),
    createReadinessItem({ helper: 'Dokumen notificationSubscriptions milik user aktif.', isReady: isRegistryReady, label: 'Firestore Registry', value: registry?.updatedAt ? 'Synced' : 'Belum synced' }),
    createReadinessItem({ helper: 'Endpoint /health dari Cloudflare Worker.', isReady: isWorkerReady, label: 'Worker Health', value: workerHealth?.message || (isWorkerReady ? 'Online' : 'Belum dicek') }),
    createReadinessItem({ helper: 'Failed event harus nol.', isReady: isQueueReady, label: 'Queue Health', value: Number(eventStats?.pending || 0) + ' pending / ' + Number(eventStats?.failed || 0) + ' failed' }),
  ];
}

function createWorkerResult({ tone = 'info', title = 'Worker Result', text = '' } = {}) {
  return { text: String(text || ''), title: String(title || 'Worker Result'), tone: ['success', 'info', 'warning', 'error'].includes(tone) ? tone : 'info' };
}

function summarizeWorkerResult(result) {
  if (!result) return null;
  if (result.error) return createWorkerResult({ tone: 'error', title: 'Worker Error', text: result.error });
  const rows = Array.isArray(result.results) ? result.results : [];
  if (!rows.length) return createWorkerResult({ tone: 'info', title: 'Queue Kosong', text: 'Processed ' + Number(result.count || 0) + ' event.' });
  const hasError = rows.some((r) => r.error || (!r.sent && !r.dryRun));
  const hasSent = rows.some((r) => r.sent);
  const hasDryRun = rows.some((r) => r.dryRun);
  const text = rows.map((r) => (r.eventId || 'event') + ': ' + (r.sent ? 'sent' : r.dryRun ? 'dry-run' : 'failed') + ', target=' + (r.subscriptionCount ?? 0) + (r.error ? ', error=' + r.error : '')).join('\n');
  if (hasError) return createWorkerResult({ tone: 'error', title: 'Process Bermasalah', text });
  if (hasSent) return createWorkerResult({ tone: 'success', title: 'Push Terkirim', text });
  if (hasDryRun) return createWorkerResult({ tone: 'info', title: 'Dry-run Berhasil', text });
  return createWorkerResult({ tone: 'warning', title: 'Worker Selesai', text });
}

function NotifRow({ event, onRetry, onCancel, onSelect, isSelected }) {
  const relTime = formatRelativeTime(event.createdAt);
  const typeLabel = formatTypeLabel(event.type);
  const statusLabel = getNotificationEventStatusLabel(event.status);
  const dotClass = getStatusDotClass(event.status);
  const badgeClass = getStatusBadgeClass(event.status);
  const canRetry = event.status === 'failed' || event.status === 'cancelled';
  const canCancel = event.status === 'pending';
  return (
    <article className={'notif-row' + (isSelected ? ' is-selected' : '')} role="listitem">
      <div className="notif-row-left" aria-hidden="true">
        <span className={'notif-dot ' + dotClass} />
        <span className="notif-type-tag">{getEventTypeIcon(event.type)}</span>
      </div>
      <div className="notif-row-body">
        <p className="notif-row-title">
          <span className={'notif-badge ' + badgeClass}>{statusLabel}</span>
          <span className="notif-row-title-text">{event.title || typeLabel}</span>
        </p>
        <p className="notif-row-msg">{event.message || 'Tidak ada isi pesan.'}</p>
        {event.errorMessage ? <p className="notif-row-error">{event.errorMessage}</p> : null}
      </div>
      <div className="notif-row-right">
        <time className="notif-row-time" dateTime={event.createdAt} title={formatDateTime(event.createdAt)}>{relTime}</time>
        <div className="notif-row-actions" role="group" aria-label="Aksi">
          <button className={'notif-action-btn' + (isSelected ? ' is-active' : '')} title="Pilih event" type="button" onClick={() => onSelect(event)} aria-pressed={isSelected}>
            <RadioTower size={11} />
          </button>
          {canRetry ? (
            <button className="notif-action-btn" title="Retry" type="button" onClick={() => onRetry(event)}>
              <RotateCcw size={11} />
            </button>
          ) : null}
          {canCancel ? (
            <button className="notif-action-btn is-danger" title="Cancel" type="button" onClick={() => onCancel(event)}>
              <XCircle size={11} />
            </button>
          ) : null}
        </div>
      </div>
    </article>
  );
}

export default function NotificationsPage({ currentUser }) {
  const [events, setEvents] = useState([]);
  const [filterStatus, setFilterStatus] = useState('all');
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [workerUrl, setWorkerUrl] = useState(DEFAULT_WORKER_URL);
  const [workerSecret, setWorkerSecret] = useState('');
  const [workerLimit, setWorkerLimit] = useState(3);
  const [workerDryRun, setWorkerDryRun] = useState(true);
  const [workerEventId, setWorkerEventId] = useState('');
  const [workerResult, setWorkerResult] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [isHealthOpen, setIsHealthOpen] = useState(false);
  const [isWorkerOpen, setIsWorkerOpen] = useState(false);
  const [readinessState, setReadinessState] = useState({
    isChecking: false, oneSignalState: null, registry: null, workerHealth: null, errorMessage: '', checkedAt: '',
  });

  useEffect(() => {
    const loadingFrameId = window.requestAnimationFrame(() => { setIsLoading(true); setErrorMessage(''); });
    const unsubscribe = subscribeNotificationEvents(
      { status: filterStatus },
      (nextEvents) => { setEvents(nextEvents); setIsLoading(false); },
      (error) => { setErrorMessage(error?.message || 'Gagal membaca notification events.'); setIsLoading(false); },
    );
    return () => { window.cancelAnimationFrame(loadingFrameId); unsubscribe(); };
  }, [filterStatus]);

  const stats = useMemo(() => events.reduce(
    (result, event) => ({ ...result, [event.status]: (result[event.status] || 0) + 1, total: result.total + 1 }),
    { cancelled: 0, failed: 0, pending: 0, processing: 0, sent: 0, total: 0 },
  ), [events]);

  const visibleEvents = useMemo(() => events.slice(0, 80), [events]);

  const readinessItems = useMemo(() => buildReadinessItems({
    eventStats: stats, oneSignalState: readinessState.oneSignalState,
    registry: readinessState.registry, workerHealth: readinessState.workerHealth,
  }), [stats, readinessState.oneSignalState, readinessState.registry, readinessState.workerHealth]);

  const readinessScore = useMemo(() => {
    const readyCount = readinessItems.filter((item) => item.tone === 'success').length;
    return { readyCount, totalCount: readinessItems.length };
  }, [readinessItems]);

  const handleRefreshReadiness = useCallback(async ({ includeWorker = true, reason = 'manual' } = {}) => {
    setReadinessState((current) => ({ ...current, errorMessage: '', isChecking: true }));
    try {
      const [oneSignalState, registry] = await Promise.all([
        getOneSignalState().catch((error) => ({
          errorMessage: error?.message || 'Gagal membaca OneSignal state.',
          permission: getBrowserNotificationPermission(), supported: isOneSignalBrowserSupported(),
        })),
        fetchNotificationSubscription(currentUser?.uid).catch((error) => ({
          errorMessage: error?.message || 'Gagal membaca registry subscription.',
        })),
      ]);
      let workerHealth = null;
      if (includeWorker && workerUrl.trim()) {
        const healthResponse = await fetch(workerUrl.trim().replace(/\/$/, '') + '/health');
        const healthPayload = await healthResponse.json();
        workerHealth = { checkedAt: new Date().toISOString(), message: healthPayload?.service || healthPayload?.message || 'Online', ok: healthResponse.ok && healthPayload?.ok !== false, status: healthResponse.status };
      }
      setReadinessState({ checkedAt: new Date().toISOString(), errorMessage: oneSignalState?.errorMessage || registry?.errorMessage || '', isChecking: false, oneSignalState, registry, workerHealth });
      if (reason !== 'auto') setWorkerResult(createWorkerResult({ tone: 'info', title: 'Health Check Selesai', text: 'Readiness panel sudah diperbarui.' }));
    } catch (error) {
      setReadinessState((current) => ({ ...current, checkedAt: new Date().toISOString(), errorMessage: error?.message || 'Health check gagal.', isChecking: false }));
    }
  }, [currentUser?.uid, workerUrl]);

  useEffect(() => {
    const readinessFrameId = window.requestAnimationFrame(() => {
      handleRefreshReadiness({ includeWorker: true, reason: 'auto' }).catch((error) => { console.error('[notification-health] Auto readiness check failed:', error); });
    });
    return () => { window.cancelAnimationFrame(readinessFrameId); };
  }, [handleRefreshReadiness]);

  async function handleRetryEvent(event) {
    setErrorMessage('');
    try { await retryNotificationEvent(event); setWorkerEventId(event.id); }
    catch (error) { setErrorMessage(error?.message || 'Gagal retry event.'); }
  }

  async function handleCancelEvent(event) {
    setErrorMessage('');
    try { await cancelNotificationEvent(event); }
    catch (error) { setErrorMessage(error?.message || 'Gagal cancel event.'); }
  }

  async function handleProcessWorker() {
    const cleanUrl = workerUrl.trim().replace(/\/$/, '');
    if (!cleanUrl) { setWorkerResult(createWorkerResult({ tone: 'warning', title: 'Worker URL Kosong', text: 'Isi Worker URL dulu.' })); return; }
    if (!workerSecret.trim()) { setWorkerResult(createWorkerResult({ tone: 'warning', title: 'Worker Secret Kosong', text: 'Isi Worker Secret dulu.' })); return; }
    setIsProcessing(true); setWorkerResult(null);
    try {
      const body = { dryRun: workerDryRun, limit: Math.max(1, Math.min(20, Number(workerLimit) || 1)) };
      if (workerEventId.trim()) body.eventId = workerEventId.trim();
      const response = await fetch(cleanUrl + '/process', {
        body: JSON.stringify(body),
        headers: { 'content-type': 'application/json', 'x-studio37-worker-secret': workerSecret.trim() },
        method: 'POST',
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error || 'Worker error: ' + response.status);
      const nextWorkerResult = summarizeWorkerResult(payload);
      setWorkerResult(nextWorkerResult);
      if (!workerDryRun && nextWorkerResult?.tone === 'success') { setWorkerDryRun(true); setWorkerEventId(''); }
    } catch (error) {
      setWorkerResult(createWorkerResult({ tone: 'error', title: 'Worker Process Gagal', text: error?.message || 'Worker process gagal.' }));
    } finally { setIsProcessing(false); }
  }

  const allReady = readinessScore.readyCount === readinessScore.totalCount;

  return (
    <section className="notif-page" aria-labelledby="notif-page-title">
      <header className="notif-hero">
        <div className="notif-hero-left">
          <span className="notif-hero-icon" aria-hidden="true"><BellRing size={14} /></span>
          <div className="notif-hero-copy">
            <h2 id="notif-page-title">Notification Console</h2>
            <p>Push event queue &amp; manual worker ops</p>
          </div>
        </div>
        <div className="notif-hero-operator">
          <span>Operator</span>
          <strong>{currentUser?.displayName || currentUser?.email || 'Admin'}</strong>
        </div>
      </header>

      <div className="notif-stats" role="list" aria-label="Ringkasan notifikasi">
        <div className="notif-stat" role="listitem"><span>Total</span><strong>{stats.total}</strong></div>
        <div className={'notif-stat' + (stats.pending > 0 ? ' is-warn' : '')} role="listitem"><span>Pending</span><strong>{stats.pending}</strong></div>
        <div className={'notif-stat' + (stats.sent > 0 ? ' is-ok' : '')} role="listitem"><span>Sent</span><strong>{stats.sent}</strong></div>
        <div className={'notif-stat' + (stats.failed > 0 ? ' is-err' : '')} role="listitem"><span>Failed</span><strong>{stats.failed}</strong></div>
      </div>

      <section className="notif-health-wrap" aria-labelledby="notif-health-title">
        <button className="notif-health-toggle" type="button" aria-expanded={isHealthOpen} onClick={() => setIsHealthOpen((v) => !v)}>
          <span className="notif-health-toggle-left">
            <Activity size={12} />
            <span id="notif-health-title">System Health</span>
            <span className={'notif-health-score' + (allReady ? ' is-ok' : ' is-warn')}>{readinessScore.readyCount}/{readinessScore.totalCount}</span>
          </span>
          <span className="notif-health-toggle-right">
            {readinessState.checkedAt ? <span className="notif-checked-time">{formatRelativeTime(readinessState.checkedAt)} ago</span> : null}
            <button className="notif-mini-btn" disabled={readinessState.isChecking} type="button" title="Refresh health" onClick={(e) => { e.stopPropagation(); handleRefreshReadiness({ includeWorker: true }); }}>
              {readinessState.isChecking ? <LoaderCircle className="auth-spin" size={11} /> : <Wifi size={11} />}
            </button>
            {isHealthOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </span>
        </button>
        {isHealthOpen ? (
          <div className="notif-health-body">
            {readinessState.errorMessage ? <div className="notif-alert" role="alert"><ShieldAlert size={12} /><span>{readinessState.errorMessage}</span></div> : null}
            <div className="notif-health-grid">
              {readinessItems.map((item) => (
                <div className={'notif-health-row is-' + item.tone} key={item.label}>
                  <span className="notif-health-row-icon">{item.tone === 'success' ? <CheckCircle2 size={11} /> : <ShieldAlert size={11} />}</span>
                  <span className="notif-health-row-label">{item.label}</span>
                  <span className="notif-health-row-value">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </section>

      <div className="notif-grid">
        <section className="notif-panel" aria-labelledby="notif-queue-title">
          <div className="notif-panel-head">
            <h3 id="notif-queue-title">Antrean Event</h3>
            <nav className="notif-filter-strip" aria-label="Filter status">
              {visibleStatusOptions.map((item) => (
                <button className={'notif-filter-pill' + (filterStatus === item.key ? ' is-active' : '')} key={item.key} type="button" onClick={() => setFilterStatus(item.key)} aria-pressed={filterStatus === item.key}>
                  {item.label}
                  {item.key !== 'all' && stats[item.key] > 0 ? <span className="notif-filter-count">{stats[item.key]}</span> : null}
                </button>
              ))}
            </nav>
          </div>
          {errorMessage ? <div className="notif-alert" role="alert"><ShieldAlert size={12} /><span>{errorMessage}</span></div> : null}
          {workerEventId ? (
            <div className="notif-selected-banner">
              <RadioTower size={10} />
              <span>Event dipilih: <code>{workerEventId.slice(0, 24)}…</code></span>
              <button type="button" onClick={() => setWorkerEventId('')}>✕</button>
            </div>
          ) : null}
          {isLoading ? (
            <div className="notif-empty"><LoaderCircle className="auth-spin" size={20} /><span>Memuat events…</span></div>
          ) : visibleEvents.length ? (
            <div className="notif-list" role="list">
              {visibleEvents.map((event) => (
                <NotifRow event={event} isSelected={workerEventId === event.id} key={event.id} onCancel={handleCancelEvent} onRetry={handleRetryEvent} onSelect={(ev) => setWorkerEventId(ev.id === workerEventId ? '' : ev.id)} />
              ))}
            </div>
          ) : (
            <div className="notif-empty"><CheckCircle2 size={20} /><span>Tidak ada event untuk filter ini.</span></div>
          )}
        </section>

        <aside className="notif-worker-wrap">
          <button className="notif-worker-toggle" type="button" aria-expanded={isWorkerOpen} onClick={() => setIsWorkerOpen((v) => !v)}>
            <span className="notif-worker-toggle-left"><RefreshCcw size={12} /> Manual Processor</span>
            {isWorkerOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
          <div className={'notif-worker-body' + (isWorkerOpen ? ' is-open' : '')}>
            <label className="notif-field"><span>Worker URL</span><input type="url" value={workerUrl} onChange={(e) => setWorkerUrl(e.target.value)} /></label>
            <label className="notif-field"><span className="notif-field-icon-label"><KeyRound size={11} /> Worker Secret</span><input autoComplete="off" placeholder="Tempel secret hanya saat proses manual" type="password" value={workerSecret} onChange={(e) => setWorkerSecret(e.target.value)} /></label>
            <label className="notif-field"><span>Event ID <em>(opsional)</em></span><input placeholder="Kosongkan untuk proses queue pending" type="text" value={workerEventId} onChange={(e) => setWorkerEventId(e.target.value)} /></label>
            <div className="notif-worker-quick">
              <button type="button" onClick={() => setWorkerEventId('')}>Kosongkan ID</button>
              <button type="button" onClick={() => setWorkerDryRun(true)}>Mode Aman</button>
            </div>
            <label className="notif-field"><span>Limit (maks 20)</span><input max="20" min="1" type="number" value={workerLimit} onChange={(e) => setWorkerLimit(e.target.value)} /></label>
            <label className="notif-check"><input checked={workerDryRun} type="checkbox" onChange={(e) => setWorkerDryRun(e.target.checked)} /><span>Dry-run — jangan kirim push asli</span></label>
            <button className="notif-process-btn" disabled={isProcessing} type="button" onClick={handleProcessWorker}>
              {isProcessing ? <LoaderCircle className="auth-spin" size={13} /> : <Send size={13} />}
              {workerDryRun ? 'Test Worker' : 'Process Push'}
            </button>
            {workerResult ? (
              <div className={'notif-worker-result is-' + workerResult.tone} role={workerResult.tone === 'error' ? 'alert' : 'status'}>
                <strong>{workerResult.title}</strong><pre>{workerResult.text}</pre>
              </div>
            ) : (
              <p className="notif-worker-hint">Secret tidak disimpan permanen. Gunakan untuk retry manual tanpa buka terminal.</p>
            )}
          </div>
        </aside>
      </div>
    </section>
  );
}
