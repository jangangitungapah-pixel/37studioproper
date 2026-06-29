import StatusPill from '../../components/ui/StatusPill.jsx';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  ArrowDownRight,
  ArrowUpRight,
  CalendarDays,
  CreditCard,
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
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import StudioSelect from '../../components/ui/StudioSelect.jsx';
import { adminBookingRepository } from '../../services/adminBookingRepository.js';
import { adminCustomerRepository } from '../../services/adminCustomerRepository.js';
import { bookkeepingRepository } from '../../services/bookkeepingRepository.js';
import { inventoryRepository } from '../../services/inventoryRepository.js';

const chartRangeOptions = [
  { key: 'week', label: 'Minggu', description: 'Cashflow minggu ini' },
  { key: 'month', label: 'Bulan', description: 'Cashflow bulan ini' },
  { key: 'year', label: 'Tahun', description: 'Cashflow tahun ini' },
];

function cleanText(value) {
  return String(value || '').trim();
}

function cleanLower(value) {
  return cleanText(value).toLowerCase();
}

function toNumber(value) {
  const parsed = Number(value);

  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

function getTodayIsoDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');

  return year + '-' + month + '-' + day;
}

function parseDate(value) {
  if (!value) return null;

  const date = new Date(String(value).includes('T') ? value : String(value) + 'T00:00:00');

  return Number.isNaN(date.getTime()) ? null : date;
}

function startOfDay(value) {
  const date = new Date(value);
  date.setHours(0, 0, 0, 0);

  return date;
}

function endOfDay(value) {
  const date = new Date(value);
  date.setHours(23, 59, 59, 999);

  return date;
}

function addDays(value, amount) {
  const date = new Date(value);
  date.setDate(date.getDate() + amount);

  return date;
}

function addMonths(value, amount) {
  const date = new Date(value);
  date.setMonth(date.getMonth() + amount);

  return date;
}

function formatCurrency(value) {
  return new Intl.NumberFormat('id-ID', {
    currency: 'IDR',
    maximumFractionDigits: 0,
    style: 'currency',
  }).format(Number(value || 0));
}

function formatCompactCurrency(value) {
  const safeValue = Number(value || 0);

  if (Math.abs(safeValue) >= 1000000) return 'Rp' + Math.round(safeValue / 1000000) + 'jt';
  if (Math.abs(safeValue) >= 1000) return 'Rp' + Math.round(safeValue / 1000) + 'rb';

  return 'Rp' + safeValue;
}

function formatShortDate(value) {
  const date = parseDate(value);

  if (!date) return '-';

  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
  }).format(date);
}

function isSameDay(value, target = new Date()) {
  const date = parseDate(value);

  if (!date) return false;

  return date.getFullYear() === target.getFullYear() &&
    date.getMonth() === target.getMonth() &&
    date.getDate() === target.getDate();
}

function isSameMonth(value, target = new Date()) {
  const date = parseDate(value);

  if (!date) return false;

  return date.getFullYear() === target.getFullYear() && date.getMonth() === target.getMonth();
}

function getBookingStatus(booking) {
  return cleanLower(booking?.paymentStatus || booking?.status || 'pending');
}

function getBookingTotal(booking) {
  return toNumber(
    booking?.total ??
    booking?.subtotal ??
    booking?.totalPrice ??
    booking?.totalAmount ??
    booking?.grandTotal
  );
}

function getBookingPaymentHistory(booking) {
  if (Array.isArray(booking?.paymentHistory) && booking.paymentHistory.length) {
    return booking.paymentHistory.filter((payment) => toNumber(payment.amount) > 0);
  }

  const paidAmount = toNumber(booking?.paidAmount || booking?.dpAmount);

  if (paidAmount > 0 && getBookingStatus(booking) !== 'void') {
    return [
      {
        id: 'legacy-payment',
        amount: paidAmount,
        createdAt: booking?.lastPaymentAt || booking?.updatedAt || booking?.createdAt || booking?.date,
        date: booking?.lastPaymentAt || booking?.date || booking?.createdAt,
        method: booking?.lastPaymentMethod || booking?.paymentMethod || 'other',
      },
    ];
  }

  return [];
}

function getBookingPaidAmount(booking) {
  return getBookingPaymentHistory(booking).reduce((sum, payment) => sum + toNumber(payment.amount), 0);
}

function getBookingOutstanding(booking) {
  const status = getBookingStatus(booking);

  if (status === 'void' || status === 'lunas') return 0;

  const invoiceAmount = toNumber(booking?.invoiceAmount);

  if (invoiceAmount > 0) return invoiceAmount;

  return Math.max(0, getBookingTotal(booking) - getBookingPaidAmount(booking));
}

function getPaymentDate(payment, booking) {
  return payment?.date || payment?.createdAt || payment?.paidAt || booking?.date || booking?.createdAt || getTodayIsoDate();
}

function buildBookkeepingTransactions(bookings, entries) {
  const bookingPayments = bookings.flatMap((booking) =>
    getBookingPaymentHistory(booking).map((payment, index) => ({
      id: 'booking-' + (booking.id || index) + '-' + (payment.id || index),
      type: 'income',
      source: 'booking',
      title: 'Booking - ' + (booking.customer || booking.customerName || 'Customer'),
      amount: toNumber(payment.amount),
      date: getPaymentDate(payment, booking),
    }))
  );

  const manualEntries = entries
    .filter((entry) => entry.type === 'income' || entry.type === 'expense')
    .map((entry) => ({
      id: 'entry-' + entry.id,
      type: entry.type === 'income' ? 'income' : 'expense',
      source: 'manual',
      title: entry.title,
      amount: toNumber(entry.amount),
      date: entry.date || entry.createdAt,
    }));

  return [...bookingPayments, ...manualEntries];
}

function getInventoryStatus(item) {
  if (item.status === 'inactive' || item.status === 'lost' || item.status === 'broken') return item.status;
  if (item.condition === 'maintenance' || item.status === 'maintenance') return 'maintenance';
  if (Number(item.minStock) > 0 && Number(item.quantity) <= Number(item.minStock)) return 'low_stock';

  return item.status || 'active';
}

function getUniqueCustomerCount(bookings, manualCustomers) {
  const ids = new Set();

  manualCustomers.forEach((customer) => {
    ids.add(customer.id || customer.phone || customer.name);
  });

  bookings.forEach((booking) => {
    ids.add(booking.customerId || booking.phone || booking.customer || booking.id);
  });

  return ids.size;
}

function getChartBuckets(range) {
  const now = new Date();

  if (range === 'year') {
    const yearStart = new Date(now.getFullYear(), 0, 1);

    return Array.from({ length: 12 }, (_, index) => {
      const start = addMonths(yearStart, index);
      const end = endOfDay(new Date(start.getFullYear(), start.getMonth() + 1, 0));

      return {
        label: new Intl.DateTimeFormat('id-ID', { month: 'short' }).format(start),
        start,
        end,
      };
    });
  }

  if (range === 'month') {
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = endOfDay(new Date(now.getFullYear(), now.getMonth() + 1, 0));
    const buckets = [];
    let cursor = startOfDay(monthStart);
    let index = 1;

    while (cursor <= monthEnd) {
      const start = new Date(cursor);
      const end = endOfDay(addDays(cursor, 6));

      buckets.push({
        label: 'M' + index,
        start,
        end: end > monthEnd ? monthEnd : end,
      });

      cursor = addDays(cursor, 7);
      index += 1;
    }

    return buckets;
  }

  const dayIndex = now.getDay() || 7;
  const weekStart = startOfDay(addDays(now, 1 - dayIndex));

  return Array.from({ length: 7 }, (_, index) => {
    const start = addDays(weekStart, index);

    return {
      label: new Intl.DateTimeFormat('id-ID', { weekday: 'short' }).format(start),
      start,
      end: endOfDay(start),
    };
  });
}

function buildChartData(transactions, range) {
  return getChartBuckets(range).map((bucket) => {
    const transactionsInBucket = transactions.filter((transaction) => {
      const date = parseDate(transaction.date);

      return date && date >= bucket.start && date <= bucket.end;
    });

    const income = transactionsInBucket
      .filter((transaction) => transaction.type === 'income')
      .reduce((sum, transaction) => sum + toNumber(transaction.amount), 0);
    const expense = transactionsInBucket
      .filter((transaction) => transaction.type === 'expense')
      .reduce((sum, transaction) => sum + toNumber(transaction.amount), 0);

    return {
      label: bucket.label,
      pemasukan: income,
      pengeluaran: expense,
      saldo: income - expense,
    };
  });
}

function getDashboardStats({ bookings, entries, inventoryItems, manualCustomers }) {
  const transactions = buildBookkeepingTransactions(bookings, entries);
  const monthTransactions = transactions.filter((transaction) => isSameMonth(transaction.date));
  const cashIn = monthTransactions
    .filter((transaction) => transaction.type === 'income')
    .reduce((sum, transaction) => sum + toNumber(transaction.amount), 0);
  const cashOut = monthTransactions
    .filter((transaction) => transaction.type === 'expense')
    .reduce((sum, transaction) => sum + toNumber(transaction.amount), 0);
  const todayBookings = bookings.filter((booking) => isSameDay(booking.date || booking.createdAt));
  const openBookings = bookings.filter((booking) => ['pending', 'dp'].includes(getBookingStatus(booking)));
  const outstanding = openBookings.reduce((sum, booking) => sum + getBookingOutstanding(booking), 0);
  const inventoryAttention = inventoryItems.filter((item) => ['low_stock', 'maintenance', 'broken', 'lost'].includes(getInventoryStatus(item)));

  return {
    cashIn,
    cashOut,
    customers: getUniqueCustomerCount(bookings, manualCustomers),
    inventoryAttention: inventoryAttention.length,
    net: cashIn - cashOut,
    openInvoices: openBookings.length,
    outstanding,
    todayBookings: todayBookings.length,
    transactions,
  };
}

function DashboardMetricCard({ icon: Icon, label, tone = '', value, helper }) {
  return (
    <article className={tone ? 'dashboard-metric-card ' + tone : 'dashboard-metric-card'}>
      <span className="dashboard-metric-icon">
        <Icon size={17} />
      </span>
      <small>{label}</small>
      <strong>{value}</strong>
      <em>{helper}</em>
    </article>
  );
}

function DashboardChart({ chartData, range, onRangeChange }) {
  return (
    <section className="dashboard-chart-card" aria-label="Chart pembukuan">
      <header>
        <div>
          <small>Pembukuan</small>
          <strong>Cashflow Studio</strong>
          <span>Masuk, keluar, saldo.</span>
        </div>

        <div className="dashboard-chart-filter">
          <StudioSelect
            label="View"
            options={chartRangeOptions}
            selectedKey={range}
            onChange={onRangeChange}
          />
        </div>
      </header>

      <div className="dashboard-chart-shell">
        <ResponsiveContainer width="100%" height={200}>
          <ComposedChart data={chartData} margin={{ top: 8, right: 10, bottom: 24, left: -6 }}>
            <CartesianGrid stroke="var(--dashboard-chart-grid)" strokeDasharray="3 3" />
            <XAxis
              dataKey="label"
              height={30}
              tick={{ fill: 'var(--auth-text-muted)', fontSize: 10, fontWeight: 520 }}
              tickMargin={8}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: 'var(--auth-text-muted)', fontSize: 9, fontWeight: 520 }}
              axisLine={false}
              tickLine={false}
              width={44}
              tickFormatter={formatCompactCurrency}
            />
            <Tooltip
              cursor={{ fill: 'var(--dashboard-chart-cursor)' }}
              formatter={(value, name) => [formatCurrency(value), name]}
              labelFormatter={(label) => 'Periode ' + label}
              contentStyle={{
                background: 'var(--auth-bg-card)',
                border: '1px solid var(--auth-border)',
                borderRadius: 14,
                color: 'var(--auth-text-main)',
              }}
            />
            <Legend wrapperStyle={{ color: 'var(--auth-text-muted)', fontSize: 10, fontWeight: 560, paddingTop: 6 }} />
            <Area
              type="monotone"
              dataKey="pemasukan"
              name="Pemasukan"
              stroke="var(--dashboard-income)"
              fill="var(--dashboard-income-soft)"
              strokeWidth={2}
            />
            <Bar
              dataKey="pengeluaran"
              name="Pengeluaran"
              fill="var(--dashboard-expense-soft)"
              stroke="var(--dashboard-expense)"
              radius={[8, 8, 0, 0]}
            />
            <Line
              type="monotone"
              dataKey="saldo"
              name="Saldo"
              stroke="var(--dashboard-net)"
              strokeWidth={2}
              dot={{ r: 2.5, fill: 'var(--dashboard-net)' }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}

function DashboardUpcoming({ bookings, onOpenSchedule }) {
  const upcoming = bookings
    .filter((booking) => {
      const date = parseDate(booking.date || booking.createdAt);

      return date && date >= startOfDay(new Date());
    })
    .sort((first, second) => {
      const firstDate = parseDate(first.date || first.createdAt)?.getTime() || 0;
      const secondDate = parseDate(second.date || second.createdAt)?.getTime() || 0;

      return firstDate - secondDate;
    })
    .slice(0, 5);

  return (
    <section className="dashboard-list-card">
      <header>
        <div>
          <small>Schedule</small>
          <strong>Booking Terdekat</strong>
        </div>
        <button type="button" onClick={onOpenSchedule}>Buka</button>
      </header>

      {upcoming.length ? (
        <div className="dashboard-mini-list">
          {upcoming.map((booking) => (
            <article key={booking.id || booking.createdAt || booking.date}>
              <span>
                <strong>{booking.customer || booking.bandName || booking.title || 'Booking'}</strong>
                <small>{formatShortDate(booking.date || booking.createdAt)} · {booking.startTimeLabel || booking.startHour || 'Jam belum diisi'}</small>
              </span>
              <StatusPill status={getBookingStatus(booking)}>{getBookingStatus(booking)}</StatusPill>
            </article>
          ))}
        </div>
      ) : (
        <p className="dashboard-empty-copy">Belum ada booking terdekat.</p>
      )}
    </section>
  );
}

function DashboardAttention({ inventoryItems, openInvoices, onOpenBilling, onOpenInventory }) {
  const attentionItems = inventoryItems
    .filter((item) => ['low_stock', 'maintenance', 'broken', 'lost'].includes(getInventoryStatus(item)))
    .slice(0, 4);
  const totalAttention = openInvoices + attentionItems.length;

  return (
    <section className="dashboard-list-card dashboard-attention-card">
      <header>
        <div>
          <small>Alert</small>
          <strong>Perlu Perhatian</strong>
        </div>

        <span className="dashboard-attention-total">{totalAttention}</span>
      </header>

      <div className="dashboard-attention-list">
        <button className="dashboard-attention-row is-billing" type="button" onClick={onOpenBilling}>
          <span className="dashboard-attention-icon">
            <CreditCard size={14} />
          </span>

          <span className="dashboard-attention-copy">
            <strong>Invoice belum lunas</strong>
            <small>Perlu follow-up.</small>
          </span>

          <b>{openInvoices}</b>
        </button>

        <button className="dashboard-attention-row is-inventory" type="button" onClick={onOpenInventory}>
          <span className="dashboard-attention-icon">
            <PackageOpen size={14} />
          </span>

          <span className="dashboard-attention-copy">
            <strong>Inventory dicek</strong>
            <small>Stock / maintenance.</small>
          </span>

          <b>{attentionItems.length}</b>
        </button>
      </div>
    </section>
  );
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const [bookings, setBookings] = useState([]);
  const [manualCustomers, setManualCustomers] = useState([]);
  const [entries, setEntries] = useState([]);
  const [inventoryItems, setInventoryItems] = useState([]);
  const [chartRange, setChartRange] = useState('month');
  const [syncError, setSyncError] = useState('');

  const currentYearStart = useMemo(() => {
    return new Date(new Date().getFullYear(), 0, 1).toISOString().slice(0, 10);
  }, []);

  useEffect(() => {
    const unsubscribe = adminBookingRepository.subscribeManualBookings(
      { startDate: currentYearStart },
      (data) => {
        setBookings(data);
        adminBookingRepository.syncClientCalendarSlotsFromBookings(data)
          .catch((err) => console.error('Gagal sinkron slot client calendar dashboard:', err));
      },
      (error) => {
        console.error('Gagal memuat booking dashboard:', error);
        setSyncError('Sebagian data booking belum tersinkron.');
      }
    );

    return unsubscribe;
  }, [currentYearStart]);

  useEffect(() => {
    const unsubscribe = adminCustomerRepository.subscribeManualCustomers(
      { limitCount: 250 },
      (data) => setManualCustomers(data),
      (error) => {
        console.error('Gagal memuat customer dashboard:', error);
      }
    );

    return unsubscribe;
  }, []);

  useEffect(() => {
    const unsubscribe = bookkeepingRepository.subscribeBookkeepingEntries(
      { startDate: currentYearStart },
      (data) => setEntries(data),
      (error) => {
        console.error('Gagal memuat pembukuan dashboard:', error);
        setSyncError('Sebagian data pembukuan belum tersinkron.');
      }
    );

    return unsubscribe;
  }, [currentYearStart]);

  useEffect(() => {
    const unsubscribe = inventoryRepository.subscribeInventoryItems(
      { limitCount: 150 },
      (data) => setInventoryItems(data),
      (error) => {
        console.error('Gagal memuat inventory dashboard:', error);
      }
    );

    return unsubscribe;
  }, []);

  const stats = useMemo(
    () => getDashboardStats({ bookings, entries, inventoryItems, manualCustomers }),
    [bookings, entries, inventoryItems, manualCustomers]
  );

  const chartData = useMemo(
    () => buildChartData(stats.transactions, chartRange),
    [chartRange, stats.transactions]
  );

  return (
    <section className="dashboard-page" aria-label="Dashboard admin">
      <section className="dashboard-hero">
        <div>
          <p>Studio Command Center</p>
          <h2>Ringkasan Hari Ini</h2>
          <span>Operasional studio hari ini.</span>
        </div>

        <button type="button" onClick={() => navigate('/admin/schedule')}>
          <CalendarDays size={16} />
          Buka
        </button>
      </section>

      {syncError ? (
        <section className="dashboard-sync-alert" role="status">
          <AlertCircle size={16} />
          <span>{syncError}</span>
        </section>
      ) : null}

      <section className="dashboard-metric-grid" aria-label="Metric utama dashboard">
        <DashboardMetricCard
          icon={CalendarDays}
          label="Booking Hari Ini"
          value={stats.todayBookings}
          helper="Hari ini"
          tone="is-schedule"
        />
        <DashboardMetricCard
          icon={CreditCard}
          label="Outstanding"
          value={formatCurrency(stats.outstanding)}
          helper={stats.openInvoices + ' invoice'}
          tone="is-billing"
        />
        <DashboardMetricCard
          icon={WalletCards}
          label="Saldo Bulan Ini"
          value={formatCurrency(stats.net)}
          helper={'Masuk ' + formatCompactCurrency(stats.cashIn)}
          tone="is-bookkeeping"
        />
        <DashboardMetricCard
          icon={UsersRound}
          label="Customer"
          value={stats.customers}
          helper="Total unik"
          tone="is-customer"
        />
      </section>

      <section className="dashboard-main-grid">
        <DashboardChart
          chartData={chartData}
          range={chartRange}
          onRangeChange={setChartRange}
        />

        <section className="dashboard-side-stack">
          <DashboardUpcoming
            bookings={bookings}
            onOpenSchedule={() => navigate('/admin/schedule')}
          />

          <DashboardAttention
            inventoryItems={inventoryItems}
            openInvoices={stats.openInvoices}
            onOpenBilling={() => navigate('/admin/billing')}
            onOpenInventory={() => navigate('/admin/inventory')}
          />
        </section>
      </section>

      <section className="dashboard-bottom-grid">
        <article className="dashboard-mini-card is-income">
          <span><ArrowUpRight size={16} /></span>
          <small>Pemasukan</small>
          <strong>{formatCurrency(stats.cashIn)}</strong>
        </article>

        <article className="dashboard-mini-card is-expense">
          <span><ArrowDownRight size={16} /></span>
          <small>Pengeluaran</small>
          <strong>{formatCurrency(stats.cashOut)}</strong>
        </article>

        <article className="dashboard-mini-card is-inventory">
          <span><Wrench size={16} /></span>
          <small>Inventory</small>
          <strong>{stats.inventoryAttention} item</strong>
        </article>

        <article className="dashboard-mini-card is-bookkeeping">
          <span><ReceiptText size={16} /></span>
          <small>Transaksi</small>
          <strong>{stats.transactions.length}</strong>
        </article>
      </section>
    </section>
  );
}


