import { useEffect, useMemo, useState } from 'react';
import {
  BellRing,
  CheckCircle2,
  Clock3,
  KeyRound,
  LoaderCircle,
  RadioTower,
  RefreshCcw,
  RotateCcw,
  Send,
  ShieldAlert,
  XCircle,
} from 'lucide-react';
import {
  cancelNotificationEvent,
  getNotificationEventStatusLabel,
  notificationEventStatusOptions,
  retryNotificationEvent,
  subscribeNotificationEvents,
} from '../../services/notificationEventRepository.js';
import '../../styles/admin-auth.css';

const DEFAULT_WORKER_URL =
  import.meta.env.VITE_NOTIFICATION_WORKER_URL ||
  'https://studio37-onesignal-notification-worker.studio37.workers.dev';

const visibleStatusOptions = notificationEventStatusOptions.filter((item) =>
  ['all', 'pending', 'sent', 'failed', 'cancelled'].includes(item.key)
);

function formatDateTime(value) {
  if (!value) return '-';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function formatTypeLabel(type) {
  return String(type || 'event')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function getStatusIcon(status) {
  if (status === 'sent') return <CheckCircle2 size={15} />;
  if (status === 'failed') return <ShieldAlert size={15} />;
  if (status === 'cancelled') return <XCircle size={15} />;
  if (status === 'processing') return <LoaderCircle className="auth-spin" size={15} />;

  return <Clock3 size={15} />;
}

function createWorkerResult({ tone = 'info', title = 'Worker Result', text = '' } = {}) {
  return {
    text: String(text || ''),
    title: String(title || 'Worker Result'),
    tone: ['success', 'info', 'warning', 'error'].includes(tone) ? tone : 'info',
  };
}

function summarizeWorkerResult(result) {
  if (!result) {
    return null;
  }

  if (result.error) {
    return createWorkerResult({
      tone: 'error',
      title: 'Worker Error',
      text: result.error,
    });
  }

  const rows = Array.isArray(result.results) ? result.results : [];

  if (!rows.length) {
    return createWorkerResult({
      tone: 'info',
      title: 'Queue Kosong',
      text: `Processed ${Number(result.count || 0)} event. Tidak ada event pending yang perlu diproses.`,
    });
  }

  const hasError = rows.some((row) => row.error || (!row.sent && !row.dryRun));
  const hasSent = rows.some((row) => row.sent);
  const hasDryRun = rows.some((row) => row.dryRun);

  const text = rows
    .map((row) => {
      const status = row.sent ? 'sent' : row.dryRun ? 'dry-run' : 'failed';
      const subscriptionCount = row.subscriptionCount ?? 0;

      return `${row.eventId || 'event'}: ${status}, target=${subscriptionCount}${row.error ? `, error=${row.error}` : ''}`;
    })
    .join('\n');

  if (hasError) {
    return createWorkerResult({
      tone: 'error',
      title: 'Process Bermasalah',
      text,
    });
  }

  if (hasSent) {
    return createWorkerResult({
      tone: 'success',
      title: 'Push Terkirim',
      text,
    });
  }

  if (hasDryRun) {
    return createWorkerResult({
      tone: 'info',
      title: 'Dry-run Berhasil',
      text,
    });
  }

  return createWorkerResult({
    tone: 'warning',
    title: 'Worker Selesai',
    text,
  });
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

  useEffect(() => {
    const loadingFrameId = window.requestAnimationFrame(() => {
      setIsLoading(true);
      setErrorMessage('');
    });

    const unsubscribe = subscribeNotificationEvents(
      { status: filterStatus },
      (nextEvents) => {
        setEvents(nextEvents);
        setIsLoading(false);
      },
      (error) => {
        setErrorMessage(error?.message || 'Gagal membaca notification events.');
        setIsLoading(false);
      },
    );

    return () => {
      window.cancelAnimationFrame(loadingFrameId);
      unsubscribe();
    };
  }, [filterStatus]);

  const stats = useMemo(() => {
    return events.reduce(
      (result, event) => ({
        ...result,
        [event.status]: (result[event.status] || 0) + 1,
        total: result.total + 1,
      }),
      {
        cancelled: 0,
        failed: 0,
        pending: 0,
        processing: 0,
        sent: 0,
        total: 0,
      },
    );
  }, [events]);

  const visibleEvents = useMemo(() => events.slice(0, 80), [events]);

  async function handleRetryEvent(event) {
    setErrorMessage('');

    try {
      await retryNotificationEvent(event);
      setWorkerEventId(event.id);
    } catch (error) {
      setErrorMessage(error?.message || 'Gagal retry event.');
    }
  }

  async function handleCancelEvent(event) {
    setErrorMessage('');

    try {
      await cancelNotificationEvent(event);
    } catch (error) {
      setErrorMessage(error?.message || 'Gagal cancel event.');
    }
  }

  async function handleProcessWorker() {
    const cleanUrl = workerUrl.trim().replace(/\/$/, '');

    if (!cleanUrl) {
      setWorkerResult(createWorkerResult({
        tone: 'warning',
        title: 'Worker URL Kosong',
        text: 'Isi Worker URL dulu.',
      }));
      return;
    }

    if (!workerSecret.trim()) {
      setWorkerResult(createWorkerResult({
        tone: 'warning',
        title: 'Worker Secret Kosong',
        text: 'Isi Worker Secret dulu. Secret tidak disimpan permanen oleh console ini.',
      }));
      return;
    }

    setIsProcessing(true);
    setWorkerResult(null);

    try {
      const body = {
        dryRun: workerDryRun,
        limit: Math.max(1, Math.min(20, Number(workerLimit) || 1)),
      };

      if (workerEventId.trim()) {
        body.eventId = workerEventId.trim();
      }

      const response = await fetch(`${cleanUrl}/process`, {
        body: JSON.stringify(body),
        headers: {
          'content-type': 'application/json',
          'x-studio37-worker-secret': workerSecret.trim(),
        },
        method: 'POST',
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.error || `Worker error: ${response.status}`);
      }

      const nextWorkerResult = summarizeWorkerResult(payload);
      setWorkerResult(nextWorkerResult);

      if (!workerDryRun && nextWorkerResult?.tone === 'success') {
        setWorkerDryRun(true);
        setWorkerEventId('');
      }
    } catch (error) {
      setWorkerResult(createWorkerResult({
        tone: 'error',
        title: 'Worker Process Gagal',
        text: error?.message || 'Worker process gagal.',
      }));
    } finally {
      setIsProcessing(false);
    }
  }

  return (
    <section className="notification-console-page" aria-labelledby="notification-console-title">
      <div className="notification-console-hero">
        <div className="notification-console-hero-copy">
          <p className="notification-console-kicker">
            <BellRing size={16} />
            Notification Ops
          </p>
          <h2 id="notification-console-title">Admin Notification Console</h2>
          <p>
            Pantau antrean push notification, retry event gagal, dan proses manual lewat Cloudflare Worker.
          </p>
        </div>

        <div className="notification-console-operator">
          <span>Operator</span>
          <strong>{currentUser?.displayName || currentUser?.email || 'Admin Studio'}</strong>
        </div>
      </div>

      <div className="notification-console-stats" aria-label="Ringkasan notifikasi">
        <article>
          <span>Total</span>
          <strong>{stats.total}</strong>
        </article>
        <article>
          <span>Pending</span>
          <strong>{stats.pending}</strong>
        </article>
        <article>
          <span>Sent</span>
          <strong>{stats.sent}</strong>
        </article>
        <article>
          <span>Failed</span>
          <strong>{stats.failed}</strong>
        </article>
      </div>

      <div className="notification-console-grid">
        <section className="notification-console-panel">
          <div className="notification-console-panel-head">
            <div>
              <p>Event Stream</p>
              <h3>Antrean Firestore</h3>
            </div>

            <div className="notification-console-tabs">
              {visibleStatusOptions.map((item) => (
                <button
                  className={filterStatus === item.key ? 'is-active' : ''}
                  key={item.key}
                  type="button"
                  onClick={() => setFilterStatus(item.key)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {errorMessage ? (
            <div className="notification-console-alert">
              <ShieldAlert size={16} />
              <span>{errorMessage}</span>
            </div>
          ) : null}

          {isLoading ? (
            <div className="notification-console-empty">
              <LoaderCircle className="auth-spin" size={28} />
              <span>Memuat notification events...</span>
            </div>
          ) : visibleEvents.length ? (
            <div className="notification-event-list">
              {visibleEvents.map((event) => (
                <article className="notification-event-card" key={event.id}>
                  <div className="notification-event-main">
                    <span className={`notification-status-pill is-${event.status}`}>
                      {getStatusIcon(event.status)}
                      {getNotificationEventStatusLabel(event.status)}
                    </span>
                    <h4>{event.title || formatTypeLabel(event.type)}</h4>
                    <p>{event.message || 'Tidak ada isi pesan.'}</p>
                  </div>

                  <dl className="notification-event-meta">
                    <div>
                      <dt>Type</dt>
                      <dd>{formatTypeLabel(event.type)}</dd>
                    </div>
                    <div>
                      <dt>Target</dt>
                      <dd>{event.targetMode === 'user' ? event.targetUid || 'User' : event.targetRole}</dd>
                    </div>
                    <div>
                      <dt>Created</dt>
                      <dd>{formatDateTime(event.createdAt)}</dd>
                    </div>
                    <div>
                      <dt>Attempts</dt>
                      <dd>{event.attempts}</dd>
                    </div>
                  </dl>

                  {event.errorMessage ? (
                    <pre className="notification-event-error">{event.errorMessage}</pre>
                  ) : null}

                  <div className="notification-event-actions">
                    <button
                      type="button"
                      onClick={() => setWorkerEventId(event.id)}
                    >
                      <RadioTower size={14} />
                      Pilih Event
                    </button>

                    {event.status === 'failed' || event.status === 'cancelled' ? (
                      <button
                        type="button"
                        onClick={() => handleRetryEvent(event)}
                      >
                        <RotateCcw size={14} />
                        Retry
                      </button>
                    ) : null}

                    {event.status === 'pending' ? (
                      <button
                        type="button"
                        onClick={() => handleCancelEvent(event)}
                      >
                        <XCircle size={14} />
                        Cancel
                      </button>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="notification-console-empty">
              <CheckCircle2 size={28} />
              <span>Tidak ada event untuk filter ini.</span>
            </div>
          )}
        </section>

        <aside className="notification-console-panel notification-worker-panel">
          <div className="notification-console-panel-head">
            <div>
              <p>Cloudflare Worker</p>
              <h3>Manual Processor</h3>
            </div>
            <RefreshCcw size={18} />
          </div>

          <label className="notification-console-field">
            <span>Worker URL</span>
            <input
              type="url"
              value={workerUrl}
              onChange={(event) => setWorkerUrl(event.target.value)}
            />
          </label>

          <label className="notification-console-field">
            <span>
              <KeyRound size={14} />
              Worker Secret
            </span>
            <input
              autoComplete="off"
              placeholder="Tempel secret hanya saat perlu proses manual"
              type="password"
              value={workerSecret}
              onChange={(event) => setWorkerSecret(event.target.value)}
            />
          </label>

          <label className="notification-console-field">
            <span>Event ID opsional</span>
            <input
              placeholder="Kosongkan untuk proses queue pending"
              type="text"
              value={workerEventId}
              onChange={(event) => setWorkerEventId(event.target.value)}
            />
          </label>

          <div className="notification-worker-inline-actions" aria-label="Aksi cepat worker">
            <button type="button" onClick={() => setWorkerEventId('')}>
              Kosongkan Event ID
            </button>
            <button type="button" onClick={() => setWorkerDryRun(true)}>
              Mode Aman
            </button>
          </div>

          <label className="notification-console-field">
            <span>Limit</span>
            <input
              max="20"
              min="1"
              type="number"
              value={workerLimit}
              onChange={(event) => setWorkerLimit(event.target.value)}
            />
          </label>

          <label className="notification-console-check">
            <input
              checked={workerDryRun}
              type="checkbox"
              onChange={(event) => setWorkerDryRun(event.target.checked)}
            />
            <span>Dry-run dulu, jangan kirim push asli</span>
          </label>

          <button
            className="notification-worker-action"
            disabled={isProcessing}
            type="button"
            onClick={handleProcessWorker}
          >
            {isProcessing ? <LoaderCircle className="auth-spin" size={16} /> : <Send size={16} />}
            {workerDryRun ? 'Test Worker' : 'Process Push'}
          </button>

          {workerResult ? (
            <div
              className={`notification-worker-result is-${workerResult.tone}`}
              role={workerResult.tone === 'error' ? 'alert' : 'status'}
            >
              <strong>{workerResult.title}</strong>
              <pre>{workerResult.text}</pre>
            </div>
          ) : (
            <p className="notification-worker-hint">
              Secret tidak disimpan permanen. Gunakan tombol ini untuk retry manual tanpa buka terminal.
            </p>
          )}
        </aside>
      </div>
    </section>
  );
}
