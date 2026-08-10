import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  LoaderCircle,
  ShieldCheck,
  Utensils,
} from 'lucide-react';

import {
  GUARD_ATTENDANCE_APPROVAL_STATUSES,
  GUARD_ATTENDANCE_STATUSES,
  GUARD_MEAL_BOOKKEEPING_STATUSES,
  postGuardMealToBookkeeping,
} from '../../services/guardAttendanceRepository.js';
import { formatOperatorFeeCurrency } from '../../settings/operatorFeeSettings.js';

function getDateValue(value) {
  if (!value) return null;

  const date = new Date(String(value).includes('T') ? value : value + 'T00:00:00');
  return Number.isNaN(date.getTime()) ? null : date;
}

function isDateInPeriod(value, period) {
  if (period === 'all') return true;

  const date = getDateValue(value);
  if (!date) return false;

  const now = new Date();

  if (period === 'today') {
    return date.getFullYear() === now.getFullYear() &&
      date.getMonth() === now.getMonth() &&
      date.getDate() === now.getDate();
  }

  if (period === 'month') {
    return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
  }

  return true;
}

function formatDate(value) {
  const date = getDateValue(value);
  if (!date) return '-';

  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

function getGuardPerson(settings, guardPersonId) {
  return (settings?.people || []).find((person) => person.id === guardPersonId) || null;
}

function GuardMealState({ type }) {
  if (type === 'loading') {
    return (
      <div className="operator-fee-meal-state" role="status">
        <LoaderCircle className="auth-spin" size={18} aria-hidden="true" />
        <strong>Menyinkronkan uang makan...</strong>
        <span>Attendance approved sedang dibaca.</span>
      </div>
    );
  }

  if (type === 'error') {
    return (
      <div className="operator-fee-meal-state is-error" role="alert">
        <AlertTriangle size={18} aria-hidden="true" />
        <strong>Uang makan belum berhasil dimuat</strong>
        <span>Cek koneksi atau izin attendance.</span>
      </div>
    );
  }

  return (
    <div className="operator-fee-meal-state">
      <Utensils size={18} aria-hidden="true" />
      <strong>Belum ada uang makan</strong>
      <span>Attendance approved dan meal eligible akan muncul di sini.</span>
    </div>
  );
}

export default function GuardMealReconciliationPanel({
  busyKey,
  currentUser,
  isLoading = false,
  loadError = '',
  onBusyChange,
  onMessage,
  period,
  sessions = [],
  settings,
}) {
  const rows = sessions
    .filter((session) =>
      session.approvalStatus === GUARD_ATTENDANCE_APPROVAL_STATUSES.APPROVED &&
      session.mealEligible === true &&
      Number(session.mealAmount) > 0
    )
    .filter((session) => isDateInPeriod(session.date, period))
    .sort((first, second) => String(second.date || '').localeCompare(String(first.date || '')))
    .map((session) => {
      const person = getGuardPerson(settings, session.guardPersonId);
      const posted = session.mealBookkeepingStatus === GUARD_MEAL_BOOKKEEPING_STATUSES.POSTED;
      const closed = session.status === GUARD_ATTENDANCE_STATUSES.CLOSED;

      return {
        closed,
        paymentMethod: person?.defaultPaymentMethod || 'cash',
        person,
        posted,
        postable: closed && !posted,
        session,
      };
    });

  const readyRows = rows.filter((row) => row.postable);
  const postedRows = rows.filter((row) => row.posted);
  const readyAmount = readyRows.reduce(
    (total, row) => total + Number(row.session.mealAmount || 0),
    0,
  );
  const postedAmount = postedRows.reduce(
    (total, row) => total + Number(row.session.mealAmount || 0),
    0,
  );

  async function postOne(row) {
    if (!row.postable) return;

    const actionKey = 'guard-meal-' + row.session.id;
    onBusyChange(actionKey);

    try {
      await postGuardMealToBookkeeping(row.session, currentUser, {
        paymentMethod: row.paymentMethod,
      });

      onMessage(
        'Uang makan ' + row.session.guardName + ' tanggal ' + row.session.date +
        ' berhasil diposting ke pembukuan.',
      );
    } catch (error) {
      console.error('[guard-meal] Posting gagal:', error);
      onMessage(error?.message || 'Posting uang makan ke pembukuan gagal.');
    } finally {
      onBusyChange('');
    }
  }

  async function postAll() {
    if (!readyRows.length) {
      onMessage('Tidak ada uang makan yang siap diposting.');
      return;
    }

    onBusyChange('guard-meal-bulk');

    try {
      let count = 0;

      for (const row of readyRows) {
        await postGuardMealToBookkeeping(row.session, currentUser, {
          paymentMethod: row.paymentMethod,
        });
        count += 1;
      }

      onMessage(count + ' uang makan berhasil diposting ke pembukuan.');
    } catch (error) {
      console.error('[guard-meal] Bulk posting gagal:', error);
      onMessage(error?.message || 'Bulk posting uang makan gagal.');
    } finally {
      onBusyChange('');
    }
  }

  return (
    <section
      className="operator-fee-meal-surface"
      aria-labelledby="guard-meal-reconciliation-title"
      aria-busy={isLoading ? 'true' : 'false'}
    >
      <header className="operator-fee-meal-header">
        <div>
          <span className="operator-fee-meal-icon" aria-hidden="true">
            <Utensils size={16} />
          </span>
          <span>
            <small>Attendance reconciliation</small>
            <h3 id="guard-meal-reconciliation-title">Uang Makan dari Absen</h3>
            <p>Hanya attendance approved dan shift selesai yang dapat diposting.</p>
          </span>
        </div>

        <button
          disabled={busyKey !== '' || !readyRows.length}
          type="button"
          onClick={postAll}
        >
          {busyKey === 'guard-meal-bulk' ? (
            <LoaderCircle className="auth-spin" size={14} />
          ) : (
            <CheckCircle2 size={14} />
          )}
          <span>
            Post Semua Uang Makan
            <small>{readyRows.length} attendance</small>
          </span>
        </button>
      </header>

      <section className="operator-fee-meal-pulse" aria-label="Ringkasan uang makan attendance">
        <span>
          <small>Siap Post</small>
          <strong>{readyRows.length}</strong>
          <em>{formatOperatorFeeCurrency(readyAmount)}</em>
        </span>
        <span>
          <small>Posted</small>
          <strong>{postedRows.length}</strong>
          <em>{formatOperatorFeeCurrency(postedAmount)}</em>
        </span>
        <span>
          <small>Attendance</small>
          <strong>{rows.length}</strong>
          <em>approved + meal eligible</em>
        </span>
      </section>

      {isLoading && !rows.length ? <GuardMealState type="loading" /> : null}
      {!isLoading && loadError && !rows.length ? <GuardMealState type="error" /> : null}
      {!isLoading && !loadError && !rows.length ? <GuardMealState type="empty" /> : null}

      {rows.length ? (
        <div className="operator-fee-meal-list" aria-label="Daftar uang makan attendance">
          {rows.map((row) => {
            const session = row.session;
            const actionKey = 'guard-meal-' + session.id;
            const isBusy = busyKey === actionKey;
            const statusLabel = row.posted
              ? 'Posted'
              : row.closed
                ? 'Siap Post'
                : 'Menunggu Selesai Jaga';
            const statusTone = row.posted ? 'success' : row.closed ? 'info' : 'warning';

            return (
              <article className={'operator-fee-meal-row is-' + statusTone} key={'meal-' + session.id}>
                <span className="operator-fee-meal-row-icon" aria-hidden="true">
                  {row.posted ? <ShieldCheck size={14} /> : <Clock3 size={14} />}
                </span>
                <span className="operator-fee-meal-copy">
                  <small>{formatDate(session.date)} · {row.paymentMethod.toUpperCase()}</small>
                  <strong>{session.guardName}</strong>
                  <em>{Number(session.durationHours || 0).toFixed(1)} jam · {statusLabel}</em>
                </span>
                <span className="operator-fee-meal-amount">
                  <small>Uang makan</small>
                  <strong>{formatOperatorFeeCurrency(session.mealAmount)}</strong>
                </span>
                <button
                  disabled={busyKey !== '' || !row.postable}
                  type="button"
                  onClick={() => postOne(row)}
                >
                  {isBusy ? <LoaderCircle className="auth-spin" size={13} /> : null}
                  {row.posted ? 'Posted' : row.closed ? 'Post Uang Makan' : 'Tunggu Shift'}
                </button>
              </article>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
