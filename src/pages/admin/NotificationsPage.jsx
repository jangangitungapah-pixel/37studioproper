import { useEffect, useMemo, useState } from 'react';
import { ArrowUpRight, BellRing, Search, ShieldCheck } from 'lucide-react';
import {
  getNotificationEventStatusLabel,
  notificationEventStatusOptions,
  subscribeNotificationEvents,
} from '../../services/notificationEventRepository.js';
import '../../styles/modules/notifications.css';

function formatDateTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function formatTypeLabel(type) {
  return String(type || 'activity')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function getTypeTag(type) {
  const value = String(type || '');
  if (value.includes('payment') || value.includes('proof')) return 'PAY';
  if (value.includes('guard') || value.includes('attendance')) return 'GUARD';
  if (value.includes('message')) return 'MSG';
  return 'BOOK';
}

function getSafeDestination(url) {
  const value = String(url || '').trim();
  return value.startsWith('/') && !value.startsWith('//') ? value : '';
}

export default function NotificationsPage({ currentUser }) {
  const [events, setEvents] = useState([]);
  const [status, setStatus] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loadState, setLoadState] = useState('loading');

  useEffect(() => {
    return subscribeNotificationEvents(
      { status },
      (nextEvents) => {
        setEvents(nextEvents);
        setLoadState('ready');
      },
      () => setLoadState('error'),
    );
  }, [status]);

  const visibleEvents = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    if (!normalizedQuery) return events;
    return events.filter((event) => [
      event.title,
      event.message,
      event.type,
      event.bookingId,
    ].some((value) => String(value || '').toLowerCase().includes(normalizedQuery)));
  }, [events, searchQuery]);

  const stats = useMemo(() => ({
    booking: events.filter((event) => String(event.type).includes('booking')).length,
    high: events.filter((event) => event.priority === 'high').length,
    payment: events.filter((event) => /payment|proof/.test(String(event.type))).length,
    total: events.length,
  }), [events]);

  return (
    <section className="notif-page" data-notification-ui="in-app-activity">
      <header className="notif-editorial-header">
        <div className="notif-hero-left">
          <span className="notif-hero-icon" aria-hidden="true"><BellRing size={20} /></span>
          <div className="notif-hero-copy">
            <span className="notif-editorial-kicker">Activity center</span>
            <h2>Notifikasi dalam aplikasi</h2>
            <p>Riwayat booking, pembayaran, pesan, dan attendance tanpa push eksternal.</p>
          </div>
        </div>
        <span className="notif-context-operator">
          <ShieldCheck size={15} aria-hidden="true" />
          <span>
            <small>Masuk sebagai</small>
            <strong>{currentUser?.displayName || currentUser?.email || 'Admin'}</strong>
          </span>
        </span>
      </header>

      <div className="notif-ops-strip" aria-label="Ringkasan aktivitas">
        <article className="notif-stat"><span>Total</span><strong>{stats.total}</strong><small>aktivitas</small></article>
        <article className="notif-stat"><span>Booking</span><strong>{stats.booking}</strong><small>perubahan</small></article>
        <article className="notif-stat"><span>Pembayaran</span><strong>{stats.payment}</strong><small>transaksi</small></article>
        <article className="notif-stat"><span>Prioritas</span><strong>{stats.high}</strong><small>perlu perhatian</small></article>
      </div>

      <div className="notif-toolbar">
        <label className="notif-search">
          <Search size={17} aria-hidden="true" />
          <span className="sr-only">Cari aktivitas</span>
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Cari booking, pesan, atau pembayaran"
          />
        </label>
        <div className="notif-filter-strip" aria-label="Filter status">
          {notificationEventStatusOptions.map((option) => (
            <button
              className={`notif-filter-pill${status === option.key ? ' is-active' : ''}`}
              key={option.key}
              onClick={() => setStatus(option.key)}
              type="button"
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <section className="notif-panel" aria-live="polite">
        <div className="notif-panel-head">
          <div className="notif-panel-title-group">
            <span>{visibleEvents.length}</span>
            <div>
              <h3>Activity feed</h3>
              <p>Disimpan di Firestore dan hanya terlihat sesuai izin akun.</p>
            </div>
          </div>
        </div>

        {loadState === 'loading' && <div className="notif-empty">Memuat aktivitas…</div>}
        {loadState === 'error' && <div className="notif-empty is-error">Aktivitas belum dapat dimuat. Coba refresh halaman.</div>}
        {loadState === 'ready' && visibleEvents.length === 0 && (
          <div className="notif-empty">Belum ada aktivitas yang cocok dengan filter.</div>
        )}

        {loadState === 'ready' && visibleEvents.length > 0 && (
          <div className="notif-list">
            {visibleEvents.map((event) => {
              const destination = getSafeDestination(event.url);
              return (
                <article className="notif-row" key={event.id}>
                  <span className={`notif-type-tag is-${getTypeTag(event.type).toLowerCase()}`} aria-hidden="true">
                    {getTypeTag(event.type)}
                  </span>
                  <div className="notif-row-body">
                    <div className="notif-row-title">
                      <strong>{event.title || formatTypeLabel(event.type)}</strong>
                      {event.priority === 'high' && <span className="notif-priority">Prioritas</span>}
                    </div>
                    <p>{event.message || 'Aktivitas tercatat.'}</p>
                    <div className="notif-row-meta">
                      <span>{formatTypeLabel(event.type)}</span>
                      <span>{getNotificationEventStatusLabel(event.status)}</span>
                      {event.bookingId && <span>Booking #{event.bookingId.slice(-8)}</span>}
                      <time dateTime={event.createdAt}>{formatDateTime(event.createdAt)}</time>
                    </div>
                  </div>
                  {destination && (
                    <a className="notif-context-link" href={destination} aria-label={`Buka ${event.title || 'aktivitas'}`}>
                      <ArrowUpRight size={18} aria-hidden="true" />
                    </a>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>
    </section>
  );
}
