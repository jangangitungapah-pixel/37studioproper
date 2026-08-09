import {
  CheckCircle2,
  LoaderCircle,
  Utensils,
} from 'lucide-react';

import {
  GUARD_ATTENDANCE_APPROVAL_STATUSES,
  GUARD_ATTENDANCE_STATUSES,
  GUARD_MEAL_BOOKKEEPING_STATUSES,
  postGuardMealToBookkeeping,
} from '../../services/guardAttendanceRepository.js';

import {
  formatOperatorFeeCurrency,
} from '../../settings/operatorFeeSettings.js';

function getDateValue(
  value,
) {
  if (!value) {
    return null;
  }

  const date =
    new Date(
      String(
        value,
      ).includes(
        'T',
      )
        ? value
        : value +
            'T00:00:00',
    );

  return Number.isNaN(
    date.getTime(),
  )
    ? null
    : date;
}

function isDateInPeriod(
  value,
  period,
) {
  if (
    period ===
    'all'
  ) {
    return true;
  }

  const date =
    getDateValue(
      value,
    );

  if (!date) {
    return false;
  }

  const now =
    new Date();

  if (
    period ===
    'today'
  ) {
    return (
      date.getFullYear() ===
        now.getFullYear() &&
      date.getMonth() ===
        now.getMonth() &&
      date.getDate() ===
        now.getDate()
    );
  }

  if (
    period ===
    'month'
  ) {
    return (
      date.getFullYear() ===
        now.getFullYear() &&
      date.getMonth() ===
        now.getMonth()
    );
  }

  return true;
}

function formatDate(
  value,
) {
  const date =
    getDateValue(
      value,
    );

  if (!date) {
    return '-';
  }

  return new Intl.DateTimeFormat(
    'id-ID',
    {
      day:
        '2-digit',

      month:
        'short',

      year:
        'numeric',
    },
  ).format(
    date,
  );
}

function getGuardPerson(
  settings,
  guardPersonId,
) {
  return (
    settings?.people ||
    []
  ).find(
    (
      person,
    ) =>
      person.id ===
      guardPersonId,
  ) ||
    null;
}

export default function GuardMealReconciliationPanel({
  busyKey,
  currentUser,
  onBusyChange,
  onMessage,
  period,
  sessions = [],
  settings,
}) {
  const rows =
    sessions
      .filter(
        (
          session,
        ) =>
          session.approvalStatus ===
            GUARD_ATTENDANCE_APPROVAL_STATUSES.APPROVED &&
          session.mealEligible ===
            true &&
          Number(
            session.mealAmount,
          ) >
            0,
      )
      .filter(
        (
          session,
        ) =>
          isDateInPeriod(
            session.date,
            period,
          ),
      )
      .sort(
        (
          first,
          second,
        ) =>
          String(
            second.date ||
              '',
          ).localeCompare(
            String(
              first.date ||
                '',
            ),
          ),
      )
      .map(
        (
          session,
        ) => {
          const person =
            getGuardPerson(
              settings,
              session.guardPersonId,
            );

          const posted =
            session.mealBookkeepingStatus ===
            GUARD_MEAL_BOOKKEEPING_STATUSES.POSTED;

          const closed =
            session.status ===
            GUARD_ATTENDANCE_STATUSES.CLOSED;

          return {
            closed,

            paymentMethod:
              person?.defaultPaymentMethod ||
              'cash',

            person,

            posted,

            postable:
              closed &&
              !posted,

            session,
          };
        },
      );

  const readyRows =
    rows.filter(
      (
        row,
      ) =>
        row.postable,
    );

  const postedRows =
    rows.filter(
      (
        row,
      ) =>
        row.posted,
    );

  const readyAmount =
    readyRows.reduce(
      (
        total,
        row,
      ) =>
        total +
        Number(
          row.session.mealAmount ||
            0,
        ),
      0,
    );

  const postedAmount =
    postedRows.reduce(
      (
        total,
        row,
      ) =>
        total +
        Number(
          row.session.mealAmount ||
            0,
        ),
      0,
    );

  async function postOne(
    row,
  ) {
    if (
      !row.postable
    ) {
      return;
    }

    const actionKey =
      'guard-meal-' +
      row.session.id;

    onBusyChange(
      actionKey,
    );

    try {
      await postGuardMealToBookkeeping(
        row.session,
        currentUser,
        {
          paymentMethod:
            row.paymentMethod,
        },
      );

      onMessage(
        'Uang makan ' +
          row.session.guardName +
          ' tanggal ' +
          row.session.date +
          ' berhasil diposting ke pembukuan.',
      );
    } catch (error) {
      console.error(
        '[guard-meal] Posting gagal:',
        error,
      );

      onMessage(
        error?.message ||
          'Posting uang makan ke pembukuan gagal.',
      );
    } finally {
      onBusyChange(
        '',
      );
    }
  }

  async function postAll() {
    if (
      !readyRows.length
    ) {
      onMessage(
        'Tidak ada uang makan yang siap diposting.',
      );

      return;
    }

    onBusyChange(
      'guard-meal-bulk',
    );

    try {
      let count =
        0;

      for (
        const row
        of readyRows
      ) {
        await postGuardMealToBookkeeping(
          row.session,
          currentUser,
          {
            paymentMethod:
              row.paymentMethod,
          },
        );

        count +=
          1;
      }

      onMessage(
        count +
          ' uang makan berhasil diposting ke pembukuan.',
      );
    } catch (error) {
      console.error(
        '[guard-meal] Bulk posting gagal:',
        error,
      );

      onMessage(
        error?.message ||
          'Bulk posting uang makan gagal.',
      );
    } finally {
      onBusyChange(
        '',
      );
    }
  }

  return (
    <section
      aria-labelledby="guard-meal-reconciliation-title"
    >
      <section className="operator-fee-queue-hero">
        <span aria-hidden="true">
          <Utensils
            size={22}
          />
        </span>

        <div>
          <p>
            Attendance Reconciliation
          </p>

          <h3 id="guard-meal-reconciliation-title">
            Uang Makan dari Absen
          </h3>

          <small>
            Uang makan hanya berasal dari attendance approved.
            Posting ke pembukuan dilakukan setelah shift selesai.
          </small>
        </div>
      </section>

      <section
        className="operator-fee-queue-summary"
        aria-label="Ringkasan uang makan attendance"
      >
        <article>
          <small>
            Siap Post
          </small>

          <strong>
            {readyRows.length}
          </strong>

          <span>
            {formatOperatorFeeCurrency(
              readyAmount,
            )}
          </span>
        </article>

        <article>
          <small>
            Posted
          </small>

          <strong>
            {postedRows.length}
          </strong>

          <span>
            {formatOperatorFeeCurrency(
              postedAmount,
            )}
          </span>
        </article>

        <article>
          <small>
            Attendance
          </small>

          <strong>
            {rows.length}
          </strong>

          <span>
            approved + meal eligible
          </span>
        </article>
      </section>

      <section
        className="operator-fee-queue-actions"
        aria-label="Aksi uang makan attendance"
      >
        <button
          disabled={
            busyKey !==
              '' ||
            !readyRows.length
          }
          type="button"
          onClick={
            postAll
          }
        >
          {busyKey ===
          'guard-meal-bulk' ? (
            <LoaderCircle
              className="auth-spin"
              size={14}
            />
          ) : (
            <CheckCircle2
              size={14}
            />
          )}

          Post Semua Uang Makan

          <small>
            {readyRows.length} attendance
          </small>
        </button>
      </section>

      <section
        className="operator-fee-queue-list"
        aria-label="Daftar uang makan attendance"
      >
        {rows.length ? (
          rows.map(
            (
              row,
            ) => {
              const session =
                row.session;

              const actionKey =
                'guard-meal-' +
                session.id;

              const isBusy =
                busyKey ===
                actionKey;

              const statusLabel =
                row.posted
                  ? 'Posted'
                  : row.closed
                    ? 'Siap Post'
                    : 'Menunggu Selesai Jaga';

              const statusTone =
                row.posted
                  ? 'success'
                  : row.closed
                    ? 'info'
                    : 'warning';

              return (
                <article
                  className="operator-fee-queue-row"
                  key={
                    'meal-' +
                    session.id
                  }
                >
                  <div className="operator-fee-queue-main">
                    <div className="operator-fee-queue-info">
                      <div className="operator-fee-meta-top">
                        <span>
                          {formatDate(
                            session.date,
                          )}
                        </span>

                        <span className="dot-separator">
                          ·
                        </span>

                        <span>
                          Attendance
                        </span>
                      </div>

                      <strong className="operator-fee-customer">
                        {session.guardName}
                      </strong>

                      <div className="operator-fee-meta-bottom">
                        <span>
                          {Number(
                            session.durationHours ||
                              0,
                          ).toFixed(
                            1,
                          )}{' '}
                          jam
                        </span>

                        <span className="dot-separator">
                          ·
                        </span>

                        <span>
                          {row.paymentMethod.toUpperCase()}
                        </span>
                      </div>
                    </div>

                    <div className="operator-fee-amount-col">
                      <b className="operator-fee-total-amount">
                        {formatOperatorFeeCurrency(
                          session.mealAmount,
                        )}
                      </b>

                      <span
                        className={
                          'operator-fee-status-dot is-' +
                          statusTone
                        }
                      >
                        <span className="status-dot"></span>

                        {statusLabel}
                      </span>
                    </div>

                    <div className="operator-fee-action-col">
                      <button
                        disabled={
                          busyKey !==
                            '' ||
                          !row.postable
                        }
                        type="button"
                        className="operator-fee-row-btn"
                        onClick={() =>
                          postOne(
                            row,
                          )
                        }
                      >
                        {isBusy ? (
                          <LoaderCircle
                            className="auth-spin"
                            size={13}
                          />
                        ) : null}

                        {row.posted
                          ? 'Posted'
                          : row.closed
                            ? 'Post Uang Makan'
                            : 'Tunggu Shift'}
                      </button>
                    </div>
                  </div>
                </article>
              );
            },
          )
        ) : (
          <section className="operator-fee-empty">
            <Utensils
              size={30}
            />

            <h3>
              Belum ada uang makan
            </h3>

            <p>
              Attendance approved dan meal eligible akan muncul di sini.
            </p>
          </section>
        )}
      </section>
    </section>
  );
}
