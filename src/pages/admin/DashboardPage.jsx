import StatusPill from '../../components/ui/StatusPill.jsx';
import '../../styles/modules/dashboard.css';

import {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  useNavigate,
} from 'react-router-dom';

import {
  AlertCircle,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  CircleCheck,
  Clock3,
  CreditCard,
  Inbox,
  PackageOpen,
  ReceiptText,
  UsersRound,
  WalletCards,
  Wrench,
} from 'lucide-react';

import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import StudioSelect from '../../components/ui/StudioSelect.jsx';

import {
  ADMIN_NAV_ITEMS,
} from '../../config/adminNavigation.js';

import {
  adminBookingRepository,
} from '../../services/adminBookingRepository.js';

import {
  adminCustomerRepository,
} from '../../services/adminCustomerRepository.js';

import {
  bookkeepingRepository,
} from '../../services/bookkeepingRepository.js';

import {
  inventoryRepository,
} from '../../services/inventoryRepository.js';

import {
  getBookingRequestStatus,
  getLegacyBookingPaymentStatus,
  isBookingCancelled,
  isBookingRequestActionable,
} from '../../domain/booking/bookingSelectors.js';

import {
  buildBookingFinanceTransactions,
  getBookingFinanceTotals,
} from '../../utils/bookingPaymentUtils.js';

const chartRangeOptions = [
  {
    key: 'week',
    label: 'Minggu',
    description: 'Cashflow minggu ini',
  },
  {
    key: 'month',
    label: 'Bulan',
    description: 'Cashflow bulan ini',
  },
  {
    key: 'year',
    label: 'Tahun',
    description: 'Cashflow tahun ini',
  },
];

function getAdminPath(
  key,
  fallback,
) {
  return (
    ADMIN_NAV_ITEMS.find(
      (
        item,
      ) =>
        item.key ===
        key,
    )?.path ||
    fallback
  );
}

const DASHBOARD_PATHS =
  Object.freeze({
    billing:
      getAdminPath(
        'billing',
        '/admin/billing',
      ),

    inventory:
      getAdminPath(
        'inventory',
        '/admin/inventory',
      ),

    requests:
      getAdminPath(
        'requests',
        '/admin/bookings/requests',
      ),

    schedule:
      getAdminPath(
        'schedule',
        '/admin/schedule',
      ),
  });

function cleanText(value) {
  return String(
    value || '',
  ).trim();
}

function toNumber(value) {
  const parsed =
    Number(
      value,
    );

  return Number.isFinite(
    parsed,
  )
    ? Math.max(
        0,
        parsed,
      )
    : 0;
}

function parseDate(value) {
  if (!value) {
    return null;
  }

  if (
    value instanceof
    Date
  ) {
    return Number.isNaN(
      value.getTime(),
    )
      ? null
      : new Date(
          value,
        );
  }

  if (
    typeof value?.toDate ===
      'function'
  ) {
    const converted =
      value.toDate();

    return Number.isNaN(
      converted?.getTime?.(),
    )
      ? null
      : converted;
  }

  const text =
    String(
      value,
    );

  const date =
    new Date(
      text.includes(
        'T',
      )
        ? text
        : text +
            'T00:00:00',
    );

  return Number.isNaN(
    date.getTime(),
  )
    ? null
    : date;
}

function startOfDay(value) {
  const date =
    new Date(
      value,
    );

  date.setHours(
    0,
    0,
    0,
    0,
  );

  return date;
}

function endOfDay(value) {
  const date =
    new Date(
      value,
    );

  date.setHours(
    23,
    59,
    59,
    999,
  );

  return date;
}

function addDays(
  value,
  amount,
) {
  const date =
    new Date(
      value,
    );

  date.setDate(
    date.getDate() +
      amount,
  );

  return date;
}

function addMonths(
  value,
  amount,
) {
  const date =
    new Date(
      value,
    );

  date.setMonth(
    date.getMonth() +
      amount,
  );

  return date;
}

function isSameDay(
  value,
  target = new Date(),
) {
  const date =
    parseDate(
      value,
    );

  if (!date) {
    return false;
  }

  return (
    date.getFullYear() ===
      target.getFullYear() &&
    date.getMonth() ===
      target.getMonth() &&
    date.getDate() ===
      target.getDate()
  );
}

function isSameMonth(
  value,
  target = new Date(),
) {
  const date =
    parseDate(
      value,
    );

  if (!date) {
    return false;
  }

  return (
    date.getFullYear() ===
      target.getFullYear() &&
    date.getMonth() ===
      target.getMonth()
  );
}

function formatCurrency(value) {
  return new Intl.NumberFormat(
    'id-ID',
    {
      currency:
        'IDR',

      maximumFractionDigits:
        0,

      style:
        'currency',
    },
  ).format(
    Number(
      value || 0,
    ),
  );
}

function formatCompactCurrency(value) {
  const safeValue =
    Number(
      value || 0,
    );

  if (
    Math.abs(
      safeValue,
    ) >= 1000000
  ) {
    return (
      'Rp' +
      Math.round(
        safeValue /
          1000000,
      ) +
      'jt'
    );
  }

  if (
    Math.abs(
      safeValue,
    ) >= 1000
  ) {
    return (
      'Rp' +
      Math.round(
        safeValue /
          1000,
      ) +
      'rb'
    );
  }

  return (
    'Rp' +
    safeValue
  );
}

function formatLongDate(
  value = new Date(),
) {
  return new Intl.DateTimeFormat(
    'id-ID',
    {
      day:
        'numeric',

      month:
        'long',

      weekday:
        'long',
    },
  ).format(
    value,
  );
}

function formatHourValue(
  value,
) {
  const safeHour =
    Number(
      value,
    );

  if (
    !Number.isFinite(
      safeHour,
    )
  ) {
    return '';
  }

  const wholeHour =
    Math.floor(
      safeHour,
    );

  const minutes =
    Math.round(
      (
        safeHour -
        wholeHour
      ) *
        60,
    );

  return (
    String(
      wholeHour,
    ).padStart(
      2,
      '0',
    ) +
    '.' +
    String(
      minutes,
    ).padStart(
      2,
      '0',
    )
  );
}

function getBookingTimeLabel(
  booking,
) {
  const explicit =
    cleanText(
      booking?.startTimeLabel,
    );

  if (explicit) {
    return explicit;
  }

  const startHour =
    Number(
      booking?.startHour,
    );

  if (
    !Number.isFinite(
      startHour,
    )
  ) {
    return 'Jam belum diisi';
  }

  const duration =
    Number(
      booking?.durationHours ??
        booking?.duration,
    );

  if (
    !Number.isFinite(
      duration,
    ) ||
    duration <= 0
  ) {
    return (
      formatHourValue(
        startHour,
      ) +
      ' WIB'
    );
  }

  return (
    formatHourValue(
      startHour,
    ) +
    '–' +
    formatHourValue(
      startHour +
        duration,
    ) +
    ' WIB'
  );
}

function getServiceLabel(
  booking,
) {
  return (
    booking?.packageLabel ||
    booking?.recordingTypeLabel ||
    booking?.sessionLabel ||
    booking?.title ||
    'Sesi Studio'
  );
}

function getBookingStatus(
  booking,
) {
  return (
    getLegacyBookingPaymentStatus(
      booking,
    )
  );
}

function isUnscheduledClientRequest(
  booking,
) {
  const requestStatus =
    getBookingRequestStatus(
      booking,
    );

  return (
    booking?.source ===
      'clientPortal' &&
    [
      'submitted',
      'rejected',
      'cancelled',
    ].includes(
      requestStatus,
    )
  );
}

function getTodayScheduleBookings(
  bookings,
) {
  const today =
    new Date();

  return bookings
    .filter(
      (
        booking,
      ) =>
        isSameDay(
          booking?.date ||
            booking?.createdAt,
          today,
        ),
    )
    .filter(
      (
        booking,
      ) =>
        !isBookingCancelled(
          booking,
        ) &&
        !isUnscheduledClientRequest(
          booking,
        ),
    )
    .sort(
      (
        first,
        second,
      ) =>
        (
          Number(
            first?.startHour,
          ) || 0
        ) -
        (
          Number(
            second?.startHour,
          ) || 0
        ),
    );
}

function buildBookkeepingTransactions(
  bookings,
  entries,
) {
  const bookingTransactions =
    buildBookingFinanceTransactions(
      bookings,
    );

  const manualEntries =
    entries
      .filter(
        (
          entry,
        ) =>
          entry.type ===
            'income' ||
          entry.type ===
            'expense',
      )
      .map(
        (
          entry,
        ) => ({
          amount:
            toNumber(
              entry.amount,
            ),

          date:
            entry.date ||
            entry.createdAt,

          id:
            'entry-' +
            entry.id,

          source:
            'manual',

          title:
            entry.title,

          type:
            entry.type ===
            'income'
              ? 'income'
              : 'expense',
        }),
      );

  return [
    ...bookingTransactions,
    ...manualEntries,
  ];
}

function getInventoryStatus(
  item,
) {
  if (
    item.status ===
      'inactive' ||
    item.status ===
      'lost' ||
    item.status ===
      'broken'
  ) {
    return item.status;
  }

  if (
    item.condition ===
      'maintenance' ||
    item.status ===
      'maintenance'
  ) {
    return 'maintenance';
  }

  if (
    Number(
      item.minStock,
    ) > 0 &&
    Number(
      item.quantity,
    ) <=
      Number(
        item.minStock,
      )
  ) {
    return 'low_stock';
  }

  return (
    item.status ||
    'active'
  );
}

function getUniqueCustomerCount(
  bookings,
  manualCustomers,
) {
  const ids =
    new Set();

  manualCustomers.forEach(
    (
      customer,
    ) => {
      ids.add(
        customer.id ||
          customer.phone ||
          customer.name,
      );
    },
  );

  bookings.forEach(
    (
      booking,
    ) => {
      ids.add(
        booking.customerId ||
          booking.phone ||
          booking.customer ||
          booking.id,
      );
    },
  );

  return ids.size;
}

function getChartBuckets(
  range,
) {
  const now =
    new Date();

  if (
    range ===
    'year'
  ) {
    const yearStart =
      new Date(
        now.getFullYear(),
        0,
        1,
      );

    return Array.from(
      {
        length:
          12,
      },
      (
        _,
        index,
      ) => {
        const start =
          addMonths(
            yearStart,
            index,
          );

        const end =
          endOfDay(
            new Date(
              start.getFullYear(),
              start.getMonth() +
                1,
              0,
            ),
          );

        return {
          label:
            new Intl.DateTimeFormat(
              'id-ID',
              {
                month:
                  'short',
              },
            ).format(
              start,
            ),

          start,

          end,
        };
      },
    );
  }

  if (
    range ===
    'month'
  ) {
    const monthStart =
      new Date(
        now.getFullYear(),
        now.getMonth(),
        1,
      );

    const monthEnd =
      endOfDay(
        new Date(
          now.getFullYear(),
          now.getMonth() +
            1,
          0,
        ),
      );

    const buckets =
      [];

    let cursor =
      startOfDay(
        monthStart,
      );

    let index =
      1;

    while (
      cursor <=
      monthEnd
    ) {
      const start =
        new Date(
          cursor,
        );

      const end =
        endOfDay(
          addDays(
            cursor,
            6,
          ),
        );

      buckets.push({
        label:
          'M' +
          index,

        start,

        end:
          end >
          monthEnd
            ? monthEnd
            : end,
      });

      cursor =
        addDays(
          cursor,
          7,
        );

      index += 1;
    }

    return buckets;
  }

  const dayIndex =
    now.getDay() ||
    7;

  const weekStart =
    startOfDay(
      addDays(
        now,
        1 -
          dayIndex,
      ),
    );

  return Array.from(
    {
      length:
        7,
    },
    (
      _,
      index,
    ) => {
      const start =
        addDays(
          weekStart,
          index,
        );

      return {
        label:
          new Intl.DateTimeFormat(
            'id-ID',
            {
              weekday:
                'short',
            },
          ).format(
            start,
          ),

        start,

        end:
          endOfDay(
            start,
          ),
      };
    },
  );
}

function buildChartData(
  transactions,
  range,
) {
  return getChartBuckets(
    range,
  ).map(
    (
      bucket,
    ) => {
      const transactionsInBucket =
        transactions.filter(
          (
            transaction,
          ) => {
            const date =
              parseDate(
                transaction.date,
              );

            return (
              date &&
              date >=
                bucket.start &&
              date <=
                bucket.end
            );
          },
        );

      const income =
        transactionsInBucket
          .filter(
            (
              transaction,
            ) =>
              transaction.type ===
              'income',
          )
          .reduce(
            (
              sum,
              transaction,
            ) =>
              sum +
              toNumber(
                transaction.amount,
              ),
            0,
          );

      const expense =
        transactionsInBucket
          .filter(
            (
              transaction,
            ) =>
              transaction.type ===
              'expense',
          )
          .reduce(
            (
              sum,
              transaction,
            ) =>
              sum +
              toNumber(
                transaction.amount,
              ),
            0,
          );

      return {
        label:
          bucket.label,

        pemasukan:
          income,

        pengeluaran:
          expense,

        saldo:
          income -
          expense,
      };
    },
  );
}

function getDashboardStats({
  bookings,
  entries,
  inventoryItems,
  manualCustomers,
}) {
  const transactions =
    buildBookkeepingTransactions(
      bookings,
      entries,
    );

  const monthTransactions =
    transactions.filter(
      (
        transaction,
      ) =>
        isSameMonth(
          transaction.date,
        ),
    );

  const cashIn =
    monthTransactions
      .filter(
        (
          transaction,
        ) =>
          transaction.type ===
          'income',
      )
      .reduce(
        (
          sum,
          transaction,
        ) =>
          sum +
          toNumber(
            transaction.amount,
          ),
        0,
      );

  const cashOut =
    monthTransactions
      .filter(
        (
          transaction,
        ) =>
          transaction.type ===
          'expense',
      )
      .reduce(
        (
          sum,
          transaction,
        ) =>
          sum +
          toNumber(
            transaction.amount,
          ),
        0,
      );

  const todaySchedule =
    getTodayScheduleBookings(
      bookings,
    );

  const actionableRequests =
    bookings.filter(
      isBookingRequestActionable,
    );

  const cancellationRequests =
    actionableRequests.filter(
      (
        booking,
      ) =>
        getBookingRequestStatus(
          booking,
        ) ===
        'cancellation_requested',
    );

  const financeTotals =
    getBookingFinanceTotals(
      bookings,
    );

  const inventoryAttention =
    inventoryItems.filter(
      (
        item,
      ) =>
        [
          'low_stock',
          'maintenance',
          'broken',
          'lost',
        ].includes(
          getInventoryStatus(
            item,
          ),
        ),
    );

  return {
    actionableRequests:
      actionableRequests.length,

    attentionTotal:
      actionableRequests.length +
      financeTotals.openInvoices +
      inventoryAttention.length,

    cancellationRequests:
      cancellationRequests.length,

    cashIn,

    cashOut,

    customers:
      getUniqueCustomerCount(
        bookings,
        manualCustomers,
      ),

    inventoryAttention:
      inventoryAttention.length,

    inventoryTotal:
      inventoryItems.length,

    net:
      cashIn -
      cashOut,

    openInvoices:
      financeTotals.openInvoices,

    outstanding:
      financeTotals.outstanding,

    todaySchedule,

    transactions,

    transactionCount:
      transactions.length,
  };
}

function DashboardLoading() {
  return (
    <section
      aria-label="Memuat dashboard"
      className="dashboard-loading"
      role="status"
    >
      <span className="dashboard-skeleton dashboard-skeleton-focus" />

      <span className="dashboard-skeleton dashboard-skeleton-focus" />

      <span className="dashboard-skeleton dashboard-skeleton-strip" />

      <span className="dashboard-skeleton dashboard-skeleton-secondary" />
    </section>
  );
}

function DashboardErrorState({
  message,
  onRetry,
}) {
  return (
    <section
      className="dashboard-state dashboard-error-state"
      role="alert"
    >
      <span
        aria-hidden="true"
        className="dashboard-state-icon"
      >
        <AlertCircle
          size={21}
          strokeWidth={2}
        />
      </span>

      <div>
        <small>
          Dashboard belum siap
        </small>

        <strong>
          Data operasional belum dapat dimuat.
        </strong>

        <p>
          {message ||
            'Periksa koneksi lalu coba lagi.'}
        </p>
      </div>

      <button
        type="button"
        onClick={
          onRetry
        }
      >
        Muat ulang
      </button>
    </section>
  );
}

function DashboardEmptyState({
  onOpenRequests,
  onOpenSchedule,
}) {
  return (
    <section className="dashboard-state dashboard-empty-state">
      <span
        aria-hidden="true"
        className="dashboard-state-icon"
      >
        <CircleCheck
          size={22}
          strokeWidth={1.9}
        />
      </span>

      <div>
        <small>
          Workspace masih kosong
        </small>

        <strong>
          Belum ada aktivitas studio untuk diringkas.
        </strong>

        <p>
          Dashboard akan terisi otomatis saat booking, request, transaksi,
          customer, atau inventory mulai tersedia.
        </p>
      </div>

      <div className="dashboard-state-actions">
        <button
          type="button"
          onClick={
            onOpenSchedule
          }
        >
          <CalendarDays
            aria-hidden="true"
            size={15}
          />

          Calendar
        </button>

        <button
          className="is-secondary"
          type="button"
          onClick={
            onOpenRequests
          }
        >
          <Inbox
            aria-hidden="true"
            size={15}
          />

          Request Inbox
        </button>
      </div>
    </section>
  );
}

function DashboardAttentionHub({
  stats,
  onOpenBilling,
  onOpenInventory,
  onOpenRequests,
}) {
  const hasAttention =
    stats.attentionTotal >
    0;

  const inventoryDetail =
    stats.inventoryTotal
      ? stats.inventoryAttention +
        ' dari ' +
        stats.inventoryTotal +
        ' item perlu dicek'
      : 'Belum ada data inventory';

  return (
    <section
      aria-label="Needs attention"
      className={
        hasAttention
          ? 'dashboard-attention-hub has-attention'
          : 'dashboard-attention-hub is-clear'
      }
    >
      <header className="dashboard-surface-heading">
        <div>
          <span className="dashboard-kicker">
            Needs attention
          </span>

          <h3>
            {hasAttention
              ? stats.attentionTotal +
                ' item perlu ditindak'
              : 'Operasional terkendali'}
          </h3>

          <p>
            Request, pembayaran, dan inventory yang butuh keputusan.
          </p>
        </div>

        <span
          aria-label={
            stats.attentionTotal +
            ' item perlu perhatian'
          }
          className="dashboard-attention-orb"
        >
          {hasAttention ? (
            <AlertCircle
              aria-hidden="true"
              size={18}
              strokeWidth={2}
            />
          ) : (
            <CircleCheck
              aria-hidden="true"
              size={18}
              strokeWidth={2}
            />
          )}

          <strong>
            {stats.attentionTotal}
          </strong>
        </span>
      </header>

      <div className="dashboard-action-queue">
        <button
          className={
            stats.actionableRequests
              ? 'dashboard-action-row has-attention'
              : 'dashboard-action-row'
          }
          type="button"
          onClick={
            onOpenRequests
          }
        >
          <span
            aria-hidden="true"
            className="dashboard-action-icon is-request"
          >
            <Inbox
              size={17}
              strokeWidth={2}
            />
          </span>

          <span className="dashboard-action-copy">
            <strong>
              Request menunggu keputusan
            </strong>

            <small>
              {stats.cancellationRequests
                ? stats.cancellationRequests +
                  ' di antaranya permintaan pembatalan'
                : 'Request baru dan pembatalan client'}
            </small>
          </span>

          <span className="dashboard-action-value">
            {stats.actionableRequests}
          </span>

          <ArrowRight
            aria-hidden="true"
            className="dashboard-action-arrow"
            size={15}
          />
        </button>

        <button
          className={
            stats.openInvoices
              ? 'dashboard-action-row has-attention'
              : 'dashboard-action-row'
          }
          type="button"
          onClick={
            onOpenBilling
          }
        >
          <span
            aria-hidden="true"
            className="dashboard-action-icon is-billing"
          >
            <CreditCard
              size={17}
              strokeWidth={2}
            />
          </span>

          <span className="dashboard-action-copy">
            <strong>
              Pembayaran masih terbuka
            </strong>

            <small>
              {formatCurrency(
                stats.outstanding,
              ) +
                ' outstanding'}
            </small>
          </span>

          <span className="dashboard-action-value">
            {stats.openInvoices}
          </span>

          <ArrowRight
            aria-hidden="true"
            className="dashboard-action-arrow"
            size={15}
          />
        </button>

        <button
          className={
            stats.inventoryAttention
              ? 'dashboard-action-row has-attention'
              : 'dashboard-action-row'
          }
          type="button"
          onClick={
            onOpenInventory
          }
        >
          <span
            aria-hidden="true"
            className="dashboard-action-icon is-inventory"
          >
            <Wrench
              size={17}
              strokeWidth={2}
            />
          </span>

          <span className="dashboard-action-copy">
            <strong>
              Kondisi inventory
            </strong>

            <small>
              {inventoryDetail}
            </small>
          </span>

          <span className="dashboard-action-value">
            {stats.inventoryAttention}
          </span>

          <ArrowRight
            aria-hidden="true"
            className="dashboard-action-arrow"
            size={15}
          />
        </button>
      </div>
    </section>
  );
}

function DashboardTodayTimeline({
  bookings,
  onOpenSchedule,
}) {
  const visibleBookings =
    bookings.slice(
      0,
      6,
    );

  const remaining =
    Math.max(
      0,
      bookings.length -
        visibleBookings.length,
    );

  return (
    <section
      aria-label="Jadwal hari ini"
      className="dashboard-today-surface"
    >
      <header className="dashboard-surface-heading">
        <div>
          <span className="dashboard-kicker">
            Today
          </span>

          <h3>
            Jadwal studio
          </h3>

          <p>
            {bookings.length
              ? bookings.length +
                ' sesi aktif hari ini'
              : 'Tidak ada sesi aktif hari ini'}
          </p>
        </div>

        <button
          className="dashboard-surface-link"
          type="button"
          onClick={
            onOpenSchedule
          }
        >
          Calendar

          <ArrowRight
            aria-hidden="true"
            size={14}
          />
        </button>
      </header>

      {visibleBookings.length ? (
        <div className="dashboard-timeline">
          {visibleBookings.map(
            (
              booking,
              index,
            ) => {
              const paymentStatus =
                getBookingStatus(
                  booking,
                );

              return (
                <article
                  className="dashboard-timeline-row"
                  key={
                    booking.id ||
                    booking.bookingId ||
                    booking.createdAt ||
                    booking.date +
                      ':' +
                      index
                  }
                >
                  <span className="dashboard-timeline-time">
                    <Clock3
                      aria-hidden="true"
                      size={13}
                      strokeWidth={2}
                    />

                    {getBookingTimeLabel(
                      booking,
                    )}
                  </span>

                  <span
                    aria-hidden="true"
                    className="dashboard-timeline-track"
                  >
                    <span />
                  </span>

                  <span className="dashboard-timeline-copy">
                    <strong>
                      {booking.customer ||
                        booking.bandName ||
                        booking.name ||
                        'Booking'}
                    </strong>

                    <small>
                      {getServiceLabel(
                        booking,
                      )}
                    </small>
                  </span>

                  <StatusPill
                    status={
                      paymentStatus
                    }
                  >
                    {paymentStatus}
                  </StatusPill>
                </article>
              );
            },
          )}

          {remaining ? (
            <button
              className="dashboard-timeline-more"
              type="button"
              onClick={
                onOpenSchedule
              }
            >
              +{remaining} sesi lainnya
            </button>
          ) : null}
        </div>
      ) : (
        <div className="dashboard-today-empty">
          <CalendarDays
            aria-hidden="true"
            size={20}
            strokeWidth={1.8}
          />

          <strong>
            Hari ini masih longgar.
          </strong>

          <span>
            Tidak ada booking aktif yang masuk timeline.
          </span>
        </div>
      )}
    </section>
  );
}

function DashboardMetricObject({
  helper,
  icon: Icon,
  label,
  tone,
  value,
}) {
  return (
    <article
      className={
        'dashboard-metric-object ' +
        tone
      }
    >
      <span
        aria-hidden="true"
        className="dashboard-metric-icon"
      >
        <Icon
          size={16}
          strokeWidth={2}
        />
      </span>

      <span className="dashboard-metric-copy">
        <small>
          {label}
        </small>

        <strong>
          {value}
        </strong>

        <em>
          {helper}
        </em>
      </span>
    </article>
  );
}

function DashboardMetricStrip({
  stats,
}) {
  return (
    <section
      aria-label="Metric operasional"
      className="dashboard-metric-strip"
    >
      <DashboardMetricObject
        helper="Sesi aktif"
        icon={CalendarDays}
        label="Hari ini"
        tone="is-schedule"
        value={
          stats.todaySchedule.length
        }
      />

      <DashboardMetricObject
        helper={
          stats.cancellationRequests
            ? stats.cancellationRequests +
              ' pembatalan'
            : 'Butuh keputusan'
        }
        icon={Inbox}
        label="Request aktif"
        tone="is-request"
        value={
          stats.actionableRequests
        }
      />

      <DashboardMetricObject
        helper={
          stats.openInvoices +
          ' invoice'
        }
        icon={CreditCard}
        label="Outstanding"
        tone="is-billing"
        value={
          formatCurrency(
            stats.outstanding,
          )
        }
      />

      <DashboardMetricObject
        helper={
          'Masuk ' +
          formatCompactCurrency(
            stats.cashIn,
          )
        }
        icon={WalletCards}
        label="Net bulan ini"
        tone="is-finance"
        value={
          formatCurrency(
            stats.net,
          )
        }
      />
    </section>
  );
}

function DashboardChart({
  chartData,
  range,
  onRangeChange,
}) {
  const hasActivity =
    chartData.some(
      (
        item,
      ) =>
        item.pemasukan ||
        item.pengeluaran ||
        item.saldo,
    );

  return (
    <section
      aria-label="Cashflow studio"
      className="dashboard-secondary-surface dashboard-cashflow-surface"
    >
      <header className="dashboard-secondary-heading">
        <div>
          <span className="dashboard-kicker">
            Cashflow
          </span>

          <h3>
            Arus kas studio
          </h3>

          <p>
            Tren masuk, keluar, dan saldo untuk keputusan operasional.
          </p>
        </div>

        <div className="dashboard-chart-filter">
          <StudioSelect
            label="Periode"
            options={
              chartRangeOptions
            }
            selectedKey={
              range
            }
            onChange={
              onRangeChange
            }
          />
        </div>
      </header>

      {hasActivity ? (
        <div className="dashboard-chart-shell">
          <ResponsiveContainer
            height={214}
            width="100%"
          >
            <ComposedChart
              data={
                chartData
              }
              margin={{
                bottom:
                  14,

                left:
                  -8,

                right:
                  8,

                top:
                  8,
              }}
            >
              <CartesianGrid
                stroke="var(--dashboard-chart-grid)"
                strokeDasharray="3 5"
                vertical={false}
              />

              <XAxis
                axisLine={false}
                dataKey="label"
                height={28}
                tick={{
                  fill:
                    'var(--studio-text-tertiary)',

                  fontSize:
                    10,

                  fontWeight:
                    560,
                }}
                tickLine={false}
                tickMargin={8}
              />

              <YAxis
                axisLine={false}
                tick={{
                  fill:
                    'var(--studio-text-tertiary)',

                  fontSize:
                    9,

                  fontWeight:
                    540,
                }}
                tickFormatter={
                  formatCompactCurrency
                }
                tickLine={false}
                width={48}
              />

              <Tooltip
                cursor={{
                  fill:
                    'var(--dashboard-chart-cursor)',
                }}
                contentStyle={{
                  background:
                    'var(--studio-surface-floating)',

                  border:
                    '1px solid var(--studio-edge-normal)',

                  borderRadius:
                    '14px',

                  boxShadow:
                    'var(--studio-shadow-floating)',

                  color:
                    'var(--studio-text-primary)',

                  fontSize:
                    '12px',
                }}
                formatter={
                  (
                    value,
                    name,
                  ) => [
                    formatCurrency(
                      value,
                    ),
                    name,
                  ]
                }
                labelFormatter={
                  (
                    label,
                  ) =>
                    'Periode ' +
                    label
                }
              />

              <Bar
                dataKey="pemasukan"
                fill="var(--dashboard-income-soft)"
                name="Pemasukan"
                radius={[
                  7,
                  7,
                  2,
                  2,
                ]}
                stroke="var(--dashboard-income)"
                strokeWidth={1}
              />

              <Bar
                dataKey="pengeluaran"
                fill="var(--dashboard-expense-soft)"
                name="Pengeluaran"
                radius={[
                  7,
                  7,
                  2,
                  2,
                ]}
                stroke="var(--dashboard-expense)"
                strokeWidth={1}
              />

              <Line
                dataKey="saldo"
                dot={false}
                name="Saldo"
                stroke="var(--dashboard-net)"
                strokeWidth={2}
                type="monotone"
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div className="dashboard-chart-empty">
          <ReceiptText
            aria-hidden="true"
            size={19}
          />

          <strong>
            Belum ada arus kas di periode ini.
          </strong>

          <span>
            Grafik muncul saat transaksi mulai tercatat.
          </span>
        </div>
      )}
    </section>
  );
}

function DashboardStudioHealth({
  stats,
}) {
  const inventoryHealth =
    stats.inventoryTotal
      ? stats.inventoryAttention
        ? stats.inventoryAttention +
          ' perlu cek'
        : 'Semua aman'
      : 'Belum ada item';

  return (
    <section
      aria-label="Quick studio health"
      className="dashboard-secondary-surface dashboard-health-surface"
    >
      <header className="dashboard-secondary-heading">
        <div>
          <span className="dashboard-kicker">
            Studio health
          </span>

          <h3>
            Snapshot operasional
          </h3>

          <p>
            Angka pendukung tanpa mengganggu prioritas utama.
          </p>
        </div>
      </header>

      <div className="dashboard-health-list">
        <article>
          <span
            aria-hidden="true"
            className="dashboard-health-icon is-customer"
          >
            <UsersRound
              size={16}
            />
          </span>

          <span>
            <small>
              Customer
            </small>

            <strong>
              {stats.customers}
            </strong>
          </span>

          <em>
            Unik
          </em>
        </article>

        <article>
          <span
            aria-hidden="true"
            className="dashboard-health-icon is-inventory"
          >
            <PackageOpen
              size={16}
            />
          </span>

          <span>
            <small>
              Inventory
            </small>

            <strong>
              {inventoryHealth}
            </strong>
          </span>

          <em>
            {stats.inventoryTotal}
          </em>
        </article>

        <article>
          <span
            aria-hidden="true"
            className="dashboard-health-icon is-income"
          >
            <ArrowUpRight
              size={16}
            />
          </span>

          <span>
            <small>
              Pemasukan bulan ini
            </small>

            <strong>
              {formatCurrency(
                stats.cashIn,
              )}
            </strong>
          </span>

          <em>
            Masuk
          </em>
        </article>

        <article>
          <span
            aria-hidden="true"
            className="dashboard-health-icon is-expense"
          >
            <ArrowDownRight
              size={16}
            />
          </span>

          <span>
            <small>
              Pengeluaran bulan ini
            </small>

            <strong>
              {formatCurrency(
                stats.cashOut,
              )}
            </strong>
          </span>

          <em>
            Keluar
          </em>
        </article>

        <article>
          <span
            aria-hidden="true"
            className="dashboard-health-icon is-transaction"
          >
            <ReceiptText
              size={16}
            />
          </span>

          <span>
            <small>
              Transaksi terbaca
            </small>

            <strong>
              {stats.transactionCount}
            </strong>
          </span>

          <em>
            Tahun ini
          </em>
        </article>
      </div>
    </section>
  );
}

export default function DashboardPage() {
  const navigate =
    useNavigate();

  const [
    bookings,
    setBookings,
  ] =
    useState([]);

  const [
    manualCustomers,
    setManualCustomers,
  ] =
    useState([]);

  const [
    entries,
    setEntries,
  ] =
    useState([]);

  const [
    inventoryItems,
    setInventoryItems,
  ] =
    useState([]);

  const [
    chartRange,
    setChartRange,
  ] =
    useState(
      'month',
    );

  const [
    loadingSources,
    setLoadingSources,
  ] =
    useState({
      bookings:
        true,

      customers:
        true,

      entries:
        true,

      inventory:
        true,
    });

  const [
    sourceErrors,
    setSourceErrors,
  ] =
    useState({
      bookings:
        '',

      customers:
        '',

      entries:
        '',

      inventory:
        '',
    });

  const currentYearStart =
    useMemo(
      () =>
        new Date(
          new Date().getFullYear(),
          0,
          1,
        )
          .toISOString()
          .slice(
            0,
            10,
          ),
      [],
    );

  useEffect(() => {
    const unsubscribe =
      adminBookingRepository
        .subscribeManualBookings(
          {
            startDate:
              currentYearStart,
          },
          (
            data,
          ) => {
            setBookings(
              data,
            );

            setLoadingSources(
              (
                current,
              ) => ({
                ...current,

                bookings:
                  false,
              }),
            );

            setSourceErrors(
              (
                current,
              ) => ({
                ...current,

                bookings:
                  '',
              }),
            );

            adminBookingRepository
              .syncClientCalendarSlotsFromBookings(
                data,
              )
              .catch(
                (
                  error,
                ) =>
                  console.error(
                    'Gagal sinkron slot client calendar dashboard:',
                    error,
                  ),
              );
          },
          (
            error,
          ) => {
            console.error(
              'Gagal memuat booking dashboard:',
              error,
            );

            setLoadingSources(
              (
                current,
              ) => ({
                ...current,

                bookings:
                  false,
              }),
            );

            setSourceErrors(
              (
                current,
              ) => ({
                ...current,

                bookings:
                  'Data booking belum tersinkron.',
              }),
            );
          },
        );

    return unsubscribe;
  }, [
    currentYearStart,
  ]);

  useEffect(() => {
    const unsubscribe =
      adminCustomerRepository
        .subscribeManualCustomers(
          {
            limitCount:
              250,
          },
          (
            data,
          ) => {
            setManualCustomers(
              data,
            );

            setLoadingSources(
              (
                current,
              ) => ({
                ...current,

                customers:
                  false,
              }),
            );

            setSourceErrors(
              (
                current,
              ) => ({
                ...current,

                customers:
                  '',
              }),
            );
          },
          (
            error,
          ) => {
            console.error(
              'Gagal memuat customer dashboard:',
              error,
            );

            setLoadingSources(
              (
                current,
              ) => ({
                ...current,

                customers:
                  false,
              }),
            );

            setSourceErrors(
              (
                current,
              ) => ({
                ...current,

                customers:
                  'Data customer belum tersinkron.',
              }),
            );
          },
        );

    return unsubscribe;
  }, []);

  useEffect(() => {
    const unsubscribe =
      bookkeepingRepository
        .subscribeBookkeepingEntries(
          {
            startDate:
              currentYearStart,
          },
          (
            data,
          ) => {
            setEntries(
              data,
            );

            setLoadingSources(
              (
                current,
              ) => ({
                ...current,

                entries:
                  false,
              }),
            );

            setSourceErrors(
              (
                current,
              ) => ({
                ...current,

                entries:
                  '',
              }),
            );
          },
          (
            error,
          ) => {
            console.error(
              'Gagal memuat pembukuan dashboard:',
              error,
            );

            setLoadingSources(
              (
                current,
              ) => ({
                ...current,

                entries:
                  false,
              }),
            );

            setSourceErrors(
              (
                current,
              ) => ({
                ...current,

                entries:
                  'Data pembukuan belum tersinkron.',
              }),
            );
          },
        );

    return unsubscribe;
  }, [
    currentYearStart,
  ]);

  useEffect(() => {
    const unsubscribe =
      inventoryRepository
        .subscribeInventoryItems(
          {
            limitCount:
              150,
          },
          (
            data,
          ) => {
            setInventoryItems(
              data,
            );

            setLoadingSources(
              (
                current,
              ) => ({
                ...current,

                inventory:
                  false,
              }),
            );

            setSourceErrors(
              (
                current,
              ) => ({
                ...current,

                inventory:
                  '',
              }),
            );
          },
          (
            error,
          ) => {
            console.error(
              'Gagal memuat inventory dashboard:',
              error,
            );

            setLoadingSources(
              (
                current,
              ) => ({
                ...current,

                inventory:
                  false,
              }),
            );

            setSourceErrors(
              (
                current,
              ) => ({
                ...current,

                inventory:
                  'Data inventory belum tersinkron.',
              }),
            );
          },
        );

    return unsubscribe;
  }, []);

  const stats =
    useMemo(
      () =>
        getDashboardStats({
          bookings,
          entries,
          inventoryItems,
          manualCustomers,
        }),
      [
        bookings,
        entries,
        inventoryItems,
        manualCustomers,
      ],
    );

  const chartData =
    useMemo(
      () =>
        buildChartData(
          stats.transactions,
          chartRange,
        ),
      [
        chartRange,
        stats.transactions,
      ],
    );

  const isLoading =
    useMemo(
      () =>
        Object.values(
          loadingSources,
        ).some(
          Boolean,
        ),
      [
        loadingSources,
      ],
    );

  const syncError =
    useMemo(
      () =>
        Object.values(
          sourceErrors,
        )
          .filter(
            Boolean,
          )
          .join(
            ' ',
          ),
      [
        sourceErrors,
      ],
    );

  const hasOperationalData =
    Boolean(
      bookings.length ||
      manualCustomers.length ||
      entries.length ||
      inventoryItems.length,
    );

  const hasFatalLoadError =
    Boolean(
      !isLoading &&
      syncError &&
      !hasOperationalData
    );

  return (
    <section
      aria-label="Dashboard admin"
      className="dashboard-page"
      data-dashboard-ui="ui-1-spatial"
    >
      <header className="dashboard-editorial-header">
        <div className="dashboard-editorial-copy">
          <span className="dashboard-kicker">
            Operational overview
          </span>

          <h2>
            Yang perlu perhatian hari ini
          </h2>

          <p>
            Prioritas operasional, jadwal studio, dan kondisi finansial
            yang perlu dilihat sebelum masuk ke detail.
          </p>
        </div>

        <div
          aria-label={
            'Hari ini ' +
            formatLongDate(
              new Date(),
            )
          }
          className="dashboard-date-object"
        >
          <CalendarDays
            aria-hidden="true"
            size={18}
            strokeWidth={2}
          />

          <span>
            <small>
              Hari ini
            </small>

            <strong>
              {formatLongDate(
                new Date(),
              )}
            </strong>
          </span>
        </div>
      </header>

      {syncError &&
      !hasFatalLoadError ? (
        <section
          className="dashboard-sync-alert"
          role="status"
        >
          <AlertCircle
            aria-hidden="true"
            size={16}
          />

          <span>
            {syncError}
          </span>
        </section>
      ) : null}

      {isLoading ? (
        <DashboardLoading />
      ) : hasFatalLoadError ? (
        <DashboardErrorState
          message={
            syncError
          }
          onRetry={() =>
            window.location.reload()
          }
        />
      ) : !hasOperationalData ? (
        <DashboardEmptyState
          onOpenRequests={() =>
            navigate(
              DASHBOARD_PATHS.requests,
            )
          }
          onOpenSchedule={() =>
            navigate(
              DASHBOARD_PATHS.schedule,
            )
          }
        />
      ) : (
        <>
          <section className="dashboard-focus-grid">
            <DashboardAttentionHub
              stats={
                stats
              }
              onOpenBilling={() =>
                navigate(
                  DASHBOARD_PATHS.billing,
                )
              }
              onOpenInventory={() =>
                navigate(
                  DASHBOARD_PATHS.inventory,
                )
              }
              onOpenRequests={() =>
                navigate(
                  DASHBOARD_PATHS.requests,
                )
              }
            />

            <DashboardTodayTimeline
              bookings={
                stats.todaySchedule
              }
              onOpenSchedule={() =>
                navigate(
                  DASHBOARD_PATHS.schedule,
                )
              }
            />
          </section>

          <DashboardMetricStrip
            stats={
              stats
            }
          />

          <section className="dashboard-secondary-grid">
            <DashboardChart
              chartData={
                chartData
              }
              range={
                chartRange
              }
              onRangeChange={
                setChartRange
              }
            />

            <DashboardStudioHealth
              stats={
                stats
              }
            />
          </section>
        </>
      )}
    </section>
  );
}
