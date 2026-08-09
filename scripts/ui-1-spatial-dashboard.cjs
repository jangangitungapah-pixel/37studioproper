const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();

const FILES = {
  dashboard: path.join(
    ROOT,
    'src',
    'pages',
    'admin',
    'DashboardPage.jsx',
  ),

  dashboardCss: path.join(
    ROOT,
    'src',
    'styles',
    'modules',
    'dashboard.css',
  ),

  adminPage: path.join(
    ROOT,
    'src',
    'pages',
    'AdminPage.jsx',
  ),

  packageJson: path.join(
    ROOT,
    'package.json',
  ),

  contract: path.join(
    ROOT,
    'scripts',
    'admin-spatial-dashboard-contract-test.mjs',
  ),
};

const staged = new Map();

const CSS_MARKER =
  '/* UI-1 — Spatial Operational Dashboard */';

function normalize(value) {
  return String(
    value,
  ).replace(
    /\r\n/g,
    '\n',
  );
}

function fail(message) {
  console.error('');
  console.error(
    '❌ [ui-1-dashboard] ' +
      message,
  );
  console.error('');

  process.exit(1);
}

function readDisk(file) {
  if (
    !fs.existsSync(
      file,
    )
  ) {
    fail(
      'File tidak ditemukan: ' +
        path.relative(
          ROOT,
          file,
        ),
    );
  }

  return normalize(
    fs.readFileSync(
      file,
      'utf8',
    ),
  );
}

function read(file) {
  if (
    staged.has(
      file,
    )
  ) {
    return staged.get(
      file,
    );
  }

  return readDisk(
    file,
  );
}

function stage(
  file,
  content,
) {
  staged.set(
    file,
    normalize(
      content,
    ),
  );
}

function stageExact(
  file,
  content,
  label,
) {
  const next =
    normalize(
      content,
    );

  if (
    fs.existsSync(
      file,
    ) &&
    readDisk(
      file,
    ) === next
  ) {
    console.log(
      'ℹ️ Already correct: ' +
        label,
    );

    return;
  }

  stage(
    file,
    next,
  );

  console.log(
    '✅ Staged: ' +
      label,
  );
}

function stageNewFile(
  file,
  content,
  label,
) {
  const next =
    normalize(
      content,
    );

  if (
    fs.existsSync(
      file,
    )
  ) {
    const existing =
      readDisk(
        file,
      );

    if (
      existing === next
    ) {
      console.log(
        'ℹ️ Already correct: ' +
          label,
      );

      return;
    }

    fail(
      label +
        ' sudah ada dengan isi berbeda.',
    );
  }

  stage(
    file,
    next,
  );

  console.log(
    '✅ Staged new file: ' +
      label,
  );
}

function countOccurrences(
  source,
  needle,
) {
  return (
    source.split(
      needle,
    ).length -
    1
  );
}

function replaceOnce({
  file,
  before,
  after,
  alreadyMarker,
  label,
}) {
  const source =
    read(
      file,
    );

  if (
    alreadyMarker &&
    source.includes(
      alreadyMarker,
    )
  ) {
    console.log(
      'ℹ️ Already applied: ' +
        label,
    );

    return;
  }

  const count =
    countOccurrences(
      source,
      before,
    );

  if (
    count !== 1
  ) {
    fail(
      label +
        ': expected 1 anchor, found ' +
        count,
    );
  }

  stage(
    file,
    source.replace(
      before,
      after,
    ),
  );

  console.log(
    '✅ Staged: ' +
      label,
  );
}

function assertIncludes(
  source,
  values,
  context,
) {
  for (
    const value
    of values
  ) {
    if (
      !source.includes(
        value,
      )
    ) {
      fail(
        context +
          ' kehilangan: ' +
          value,
      );
    }
  }
}

function assertExcludes(
  source,
  values,
  context,
) {
  for (
    const value
    of values
  ) {
    if (
      source.includes(
        value,
      )
    ) {
      fail(
        context +
          ' masih mengandung: ' +
          value,
      );
    }
  }
}

/**
 * ============================================================
 * BASELINE
 * ============================================================
 */

const dashboardBaseline =
  read(
    FILES.dashboard,
  );

const alreadyUi1 =
  dashboardBaseline.includes(
    'data-admin-dashboard="ui-1"',
  );

if (
  alreadyUi1
) {
  assertIncludes(
    dashboardBaseline,
    [
      'dashboard-attention-board',
      'dashboard-today-surface',
      'dashboard-pulse-strip',
      'dashboard-cashflow-surface',
      'dashboard-loading-skeleton',
      'isBookingRequestActionable',
      'isBookingScheduleActive',
      'syncClientCalendarSlotsFromBookings',
    ],
    'Existing UI-1 Dashboard',
  );
} else {
  assertIncludes(
    dashboardBaseline,
    [
      'DashboardMetricCard',
      'DashboardChart',
      'DashboardUpcoming',
      'DashboardAttention',
      'dashboard-hero',
      'dashboard-metric-grid',
      'dashboard-main-grid',
      'dashboard-bottom-grid',
      'subscribeManualBookings',
      'subscribeManualCustomers',
      'subscribeBookkeepingEntries',
      'subscribeInventoryItems',
      'syncClientCalendarSlotsFromBookings',
      'getBookingFinanceTotals',
    ],
    'Dashboard baseline',
  );
}

const cssBaseline =
  read(
    FILES.dashboardCss,
  );

if (
  cssBaseline.includes(
    CSS_MARKER,
  )
) {
  assertIncludes(
    cssBaseline,
    [
      '.dashboard-attention-board',
      '.dashboard-today-surface',
      '.dashboard-pulse-strip',
      '.dashboard-cashflow-surface',
    ],
    'Existing UI-1 Dashboard CSS',
  );
} else {
  assertIncludes(
    cssBaseline,
    [
      '.dashboard-page',
      '.dashboard-hero',
      '.dashboard-metric-card',
      '.dashboard-chart-card',
      '.dashboard-list-card',
    ],
    'Dashboard CSS baseline',
  );
}

const adminPageBaseline =
  read(
    FILES.adminPage,
  );

assertIncludes(
  adminPageBaseline,
  [
    "if (activeKey === 'dashboard')",
    '<DashboardPage',
    'renderAdminContent(activeItem.key, authState.user)',
  ],
  'AdminPage dashboard baseline',
);

const packageBaseline =
  read(
    FILES.packageJson,
  );

assertIncludes(
  packageBaseline,
  [
    'admin-spatial-shell-hardening-contract-test.mjs',
  ],
  'UI-0 final package baseline',
);

/**
 * ============================================================
 * 1. DASHBOARD PAGE
 * ============================================================
 */

const dashboardSource = `import {
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
  ArrowUpRight,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
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
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import StatusPill from '../../components/ui/StatusPill.jsx';
import StudioSelect from '../../components/ui/StudioSelect.jsx';

import {
  ADMIN_NAV_ITEMS,
} from '../../config/adminNavigation.js';

import {
  getBookingRequestStatus,
  getLegacyBookingPaymentStatus,
  isBookingRequestActionable,
  isBookingScheduleActive,
} from '../../domain/booking/bookingSelectors.js';

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
  hasAdminPagePermission,
} from '../../utils/adminPermissions.js';

import {
  buildBookingFinanceTransactions,
  getBookingFinanceTotals,
} from '../../utils/bookingPaymentUtils.js';

const chartRangeOptions = [
  {
    key:
      'week',

    label:
      'Minggu',

    description:
      'Cashflow minggu ini',
  },

  {
    key:
      'month',

    label:
      'Bulan',

    description:
      'Cashflow bulan ini',
  },

  {
    key:
      'year',

    label:
      'Tahun',

    description:
      'Cashflow tahun ini',
  },
];

const INITIAL_SOURCE_READY =
  Object.freeze({
    bookings:
      false,

    customers:
      false,

    bookkeeping:
      false,

    inventory:
      false,
  });

const INITIAL_SOURCE_ERRORS =
  Object.freeze({
    bookings:
      '',

    customers:
      '',

    bookkeeping:
      '',

    inventory:
      '',
  });

const ADMIN_DESTINATIONS =
  Object.freeze(
    Object.fromEntries(
      ADMIN_NAV_ITEMS.map(
        (
          item,
        ) => [
          item.key,
          item,
        ],
      ),
    ),
  );

function toNumber(
  value,
) {
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

function parseDate(
  value,
) {
  if (!value) {
    return null;
  }

  const source =
    String(
      value,
    );

  const date =
    new Date(
      source.includes(
        'T',
      )
        ? source
        : source +
            'T00:00:00',
    );

  return Number.isNaN(
    date.getTime(),
  )
    ? null
    : date;
}

function startOfDay(
  value,
) {
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

function endOfDay(
  value,
) {
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

function formatCurrency(
  value,
) {
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

function formatCompactCurrency(
  value,
) {
  const safeValue =
    Number(
      value || 0,
    );

  const absolute =
    Math.abs(
      safeValue,
    );

  const sign =
    safeValue < 0
      ? '-'
      : '';

  if (
    absolute >=
    1000000000
  ) {
    return (
      sign +
      'Rp' +
      Math.round(
        absolute /
          1000000000,
      ) +
      'M'
    );
  }

  if (
    absolute >=
    1000000
  ) {
    return (
      sign +
      'Rp' +
      Math.round(
        absolute /
          1000000,
      ) +
      'jt'
    );
  }

  if (
    absolute >=
    1000
  ) {
    return (
      sign +
      'Rp' +
      Math.round(
        absolute /
          1000,
      ) +
      'rb'
    );
  }

  return (
    sign +
    'Rp' +
    absolute
  );
}

function formatShortDate(
  value,
) {
  const date =
    parseDate(
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
    },
  ).format(
    date,
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

      year:
        'numeric',
    },
  ).format(
    value,
  );
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

function getBookingWindowLabel(
  booking,
) {
  if (
    booking
      ?.startTimeLabel
  ) {
    return booking.startTimeLabel;
  }

  const startHour =
    Number(
      booking
        ?.startHour,
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
      booking
        ?.durationHours ??
      booking
        ?.duration,
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
    ' – ' +
    formatHourValue(
      startHour +
        duration,
    )
  );
}

function getBookingServiceLabel(
  booking,
) {
  return (
    booking
      ?.packageLabel ||
    booking
      ?.recordingTypeLabel ||
    booking
      ?.sessionLabel ||
    booking
      ?.title ||
    'Sesi Studio'
  );
}

function getBookingTitle(
  booking,
) {
  return (
    booking
      ?.customer ||
    booking
      ?.bandName ||
    booking
      ?.title ||
    'Booking'
  );
}

function getBookingKey(
  booking,
) {
  return (
    booking
      ?.id ||
    booking
      ?.bookingCode ||
    booking
      ?.bookingId ||
    [
      booking
        ?.date,
      booking
        ?.customer,
      booking
        ?.startHour,
    ]
      .filter(
        Boolean,
      )
      .join(
        ':',
      )
  );
}

function getBookingStartTimestamp(
  booking,
) {
  const date =
    parseDate(
      booking
        ?.date ||
      booking
        ?.createdAt,
    );

  if (!date) {
    return 0;
  }

  const startHour =
    Number(
      booking
        ?.startHour,
    );

  if (
    Number.isFinite(
      startHour,
    )
  ) {
    const hours =
      Math.floor(
        startHour,
      );

    const minutes =
      Math.round(
        (
          startHour -
          hours
        ) *
          60,
      );

    date.setHours(
      hours,
      minutes,
      0,
      0,
    );
  }

  return date.getTime();
}

function sortBookingsChronologically(
  first,
  second,
) {
  return (
    getBookingStartTimestamp(
      first,
    ) -
    getBookingStartTimestamp(
      second,
    )
  );
}

function getBookingStatus(
  booking,
) {
  return getLegacyBookingPaymentStatus(
    booking,
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

      index +=
        1;
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

  const activeBookings =
    bookings.filter(
      isBookingScheduleActive,
    );

  const todayBookings =
    activeBookings
      .filter(
        (
          booking,
        ) =>
          isSameDay(
            booking.date ||
            booking.createdAt,
          ),
      )
      .sort(
        sortBookingsChronologically,
      );

  const todayEnd =
    endOfDay(
      new Date(),
    );

  const upcomingBookings =
    activeBookings
      .filter(
        (
          booking,
        ) => {
          const date =
            parseDate(
              booking.date ||
              booking.createdAt,
            );

          return (
            date &&
            date >
              todayEnd
          );
        },
      )
      .sort(
        sortBookingsChronologically,
      )
      .slice(
        0,
        5,
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

  const inventoryAttentionItems =
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

  const requestAttention =
    actionableRequests.length;

  const inventoryAttention =
    inventoryAttentionItems.length;

  const attentionTotal =
    requestAttention +
    financeTotals.openInvoices +
    inventoryAttention;

  return {
    actionableRequests,
    attentionTotal,
    cancellationRequests:
      cancellationRequests.length,

    cashIn,
    cashOut,

    customers:
      getUniqueCustomerCount(
        bookings,
        manualCustomers,
      ),

    inventoryAttention,

    inventoryAttentionItems,

    net:
      cashIn -
      cashOut,

    openInvoices:
      financeTotals.openInvoices,

    outstanding:
      financeTotals.outstanding,

    requestAttention,

    todayBookings,

    transactions,

    upcomingBookings,
  };
}

function getAdminDestination(
  key,
) {
  return (
    ADMIN_DESTINATIONS[
      key
    ] ||
    null
  );
}

function canOpenDestination(
  user,
  key,
) {
  const item =
    getAdminDestination(
      key,
    );

  if (!item) {
    return false;
  }

  return hasAdminPagePermission(
    user,
    item.permissionKey ||
      item.key,
  );
}

function markSourceReady(
  setSourceReady,
  key,
) {
  setSourceReady(
    (
      current,
    ) => ({
      ...current,
      [key]:
        true,
    }),
  );
}

function clearSourceError(
  setSourceErrors,
  key,
) {
  setSourceErrors(
    (
      current,
    ) => {
      if (
        !current[
          key
        ]
      ) {
        return current;
      }

      return {
        ...current,
        [key]:
          '',
      };
    },
  );
}

function markSourceError(
  setSourceReady,
  setSourceErrors,
  key,
  message,
) {
  markSourceReady(
    setSourceReady,
    key,
  );

  setSourceErrors(
    (
      current,
    ) => ({
      ...current,
      [key]:
        message,
    }),
  );
}

function DashboardLoadingSkeleton() {
  return (
    <section
      aria-busy="true"
      aria-label="Memuat dashboard admin"
      className="dashboard-page dashboard-loading-skeleton"
      data-admin-dashboard="ui-1"
    >
      <div className="dashboard-skeleton dashboard-skeleton-header">
        <span />
        <span />
        <span />
      </div>

      <div className="dashboard-skeleton-primary-grid">
        <div className="dashboard-skeleton dashboard-skeleton-panel">
          <span />
          <span />
          <span />
          <span />
        </div>

        <div className="dashboard-skeleton dashboard-skeleton-panel">
          <span />
          <span />
          <span />
          <span />
        </div>
      </div>

      <div className="dashboard-skeleton dashboard-skeleton-strip">
        <span />
        <span />
        <span />
        <span />
      </div>

      <div className="dashboard-skeleton dashboard-skeleton-chart">
        <span />
        <span />
      </div>
    </section>
  );
}

function DashboardSourceAlert({
  messages,
}) {
  if (
    !messages.length
  ) {
    return null;
  }

  return (
    <section
      aria-label="Status sinkronisasi dashboard"
      className="dashboard-source-alert"
      role="status"
    >
      <span
        aria-hidden="true"
        className="dashboard-source-alert-icon"
      >
        <AlertCircle
          size={17}
          strokeWidth={2}
        />
      </span>

      <span className="dashboard-source-alert-copy">
        <strong>
          Sebagian data belum lengkap
        </strong>

        <small>
          {messages.join(
            ' ',
          )}
        </small>
      </span>
    </section>
  );
}

function DashboardOperationalHeader({
  attentionTotal,
  canOpenSchedule,
  onOpenSchedule,
  todayCount,
}) {
  const hasAttention =
    attentionTotal > 0;

  return (
    <section
      aria-labelledby="dashboard-operational-heading"
      className="dashboard-operational-header"
    >
      <div className="dashboard-operational-copy">
        <span className="dashboard-date-kicker">
          <span
            aria-hidden="true"
            className={
              hasAttention
                ? 'dashboard-live-dot has-attention'
                : 'dashboard-live-dot'
            }
          />

          {formatLongDate()}
        </span>

        <h2 id="dashboard-operational-heading">
          {hasAttention
            ? attentionTotal +
              ' hal perlu perhatian hari ini.'
            : 'Operasional studio terlihat terkendali.'}
        </h2>

        <p>
          {hasAttention
            ? 'Prioritaskan request, pembayaran, dan kondisi studio sebelum melihat statistik sekunder.'
            : 'Tidak ada antrean tindakan utama. Fokus bisa diarahkan ke jadwal