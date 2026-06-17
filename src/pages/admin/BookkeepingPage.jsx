import { useEffect, useMemo, useState } from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  Download,
  Landmark,
  Pencil,
  Plus,
  ReceiptText,
  Trash2,
  WalletCards,
  X,
} from 'lucide-react';
import StudioSelect from '../../components/ui/StudioSelect.jsx';
import { adminBookingRepository } from '../../services/adminBookingRepository.js';
import { bookkeepingRepository } from '../../services/bookkeepingRepository.js';

const periodOptions = [
  { key: 'today', label: 'Hari Ini', description: 'Transaksi hari ini' },
  { key: 'month', label: 'Bulan Ini', description: 'Transaksi bulan berjalan' },
  { key: 'year', label: 'Tahun Ini', description: 'Transaksi tahun berjalan' },
  { key: 'all', label: 'Semua', description: 'Semua transaksi' },
];

const expenseCategoryOptions = [
  { key: 'maintenance', label: 'Maintenance', description: 'Servis alat dan perbaikan' },
  { key: 'utility', label: 'Operasional', description: 'Listrik, internet, kebersihan' },
  { key: 'inventory', label: 'Inventory', description: 'Kabel, senar, stick, aksesoris' },
  { key: 'crew', label: 'Crew', description: 'Fee operator atau helper' },
  { key: 'promotion', label: 'Promosi', description: 'Iklan dan konten' },
  { key: 'rent', label: 'Sewa', description: 'Biaya sewa tempat' },
  { key: 'other', label: 'Lainnya', description: 'Biaya lain' },
];

const paymentMethodOptions = [
  { key: 'cash', label: 'Cash', description: 'Tunai' },
  { key: 'transfer', label: 'Transfer', description: 'Bank transfer' },
  { key: 'qris', label: 'QRIS', description: 'Pembayaran QRIS' },
  { key: 'other', label: 'Lainnya', description: 'Metode lain' },
];

const emptyExpenseForm = {
  title: '',
  amount: '',
  date: getTodayIsoDate(),
  category: 'utility',
  paymentMethod: 'cash',
  note: '',
};

function cleanText(value) {
  return String(value || '').trim();
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

function formatCurrency(value) {
  return new Intl.NumberFormat('id-ID', {
    currency: 'IDR',
    maximumFractionDigits: 0,
    style: 'currency',
  }).format(Number(value || 0));
}

function formatShortDate(value) {
  if (!value) return '-';

  const date = new Date(String(value).includes('T') ? value : String(value) + 'T00:00:00');

  if (Number.isNaN(date.getTime())) return '-';

  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
  }).format(date);
}

function getOptionLabel(options, key, fallback = '-') {
  return options.find((item) => item.key === key)?.label || fallback;
}

function getDateFromValue(value) {
  if (!value) return null;

  const date = new Date(String(value).includes('T') ? value : String(value) + 'T00:00:00');

  return Number.isNaN(date.getTime()) ? null : date;
}

function isDateInPeriod(value, period) {
  if (period === 'all') return true;

  const date = getDateFromValue(value);
  const now = new Date();

  if (!date) return false;

  if (period === 'today') {
    return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate();
  }

  if (period === 'month') {
    return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
  }

  if (period === 'year') {
    return date.getFullYear() === now.getFullYear();
  }

  return true;
}

function getPaymentAmount(payment) {
  return toNumber(payment?.amount ?? payment?.value ?? payment?.nominal ?? payment?.paidAmount);
}

function getPaymentDate(payment, booking) {
  return payment?.date || payment?.createdAt || payment?.paidAt || booking?.date || booking?.createdAt || getTodayIsoDate();
}

function getPaymentMethod(payment, booking) {
  return cleanText(payment?.method || payment?.paymentMethod || booking?.lastPaymentMethod || booking?.paymentMethod || 'other');
}

function getBookingTotal(booking) {
  return toNumber(
    booking?.totalPrice ??
    booking?.totalAmount ??
    booking?.grandTotal ??
    booking?.invoiceTotal ??
    booking?.amount
  );
}

function getBookingPaymentHistory(booking) {
  if (Array.isArray(booking?.paymentHistory) && booking.paymentHistory.length) {
    return booking.paymentHistory.filter((payment) => getPaymentAmount(payment) > 0);
  }

  const paidAmount = toNumber(booking?.paidAmount || booking?.dpAmount);

  if (paidAmount > 0 && booking?.paymentStatus !== 'void') {
    return [
      {
        id: 'legacy-payment',
        amount: paidAmount,
        createdAt: booking?.lastPaymentAt || booking?.updatedAt || booking?.createdAt || booking?.date,
        method: booking?.lastPaymentMethod || booking?.paymentMethod || 'other',
      },
    ];
  }

  return [];
}

function getBookingPaidAmount(booking) {
  return getBookingPaymentHistory(booking).reduce((total, payment) => total + getPaymentAmount(payment), 0);
}

function getBookingReceivableAmount(booking) {
  if (booking?.paymentStatus === 'void' || booking?.status === 'void') return 0;
  if (booking?.paymentStatus === 'lunas') return 0;

  const invoiceAmount = toNumber(booking?.invoiceAmount);

  if (invoiceAmount > 0) return invoiceAmount;

  const total = getBookingTotal(booking);
  const paid = getBookingPaidAmount(booking);

  return Math.max(0, total - paid);
}

function buildIncomeTransactions(bookings) {
  return bookings.flatMap((booking) => {
    const payments = getBookingPaymentHistory(booking);

    return payments.map((payment, index) => {
      const amount = getPaymentAmount(payment);

      return {
        id: 'booking-' + (booking.id || booking.bookingId || index) + '-' + (payment.id || index),
        source: 'booking',
        type: 'income',
        title: 'Booking - ' + (booking.customer || booking.customerName || booking.name || 'Customer'),
        amount,
        date: getPaymentDate(payment, booking),
        method: getPaymentMethod(payment, booking),
        note: booking.invoiceNumber || booking.bookingCode || 'Pembayaran booking',
      };
    });
  });
}

function buildExpenseTransactions(entries) {
  return entries
    .filter((entry) => entry.type === 'expense')
    .map((entry) => ({
      id: 'expense-' + entry.id,
      entryId: entry.id,
      source: 'manual',
      type: 'expense',
      title: entry.title,
      amount: toNumber(entry.amount),
      date: entry.date,
      method: entry.paymentMethod,
      note: getOptionLabel(expenseCategoryOptions, entry.category, entry.category) + (entry.note ? ' • ' + entry.note : ''),
    }));
}

function escapeCsvCell(value) {
  const text = String(value ?? '').replace(/\r?\n/g, ' ').trim();

  if (/[",;]/.test(text)) {
    return '"' + text.replace(/"/g, '""') + '"';
  }

  return text;
}

function getPeriodLabel(period) {
  return getOptionLabel(periodOptions, period, period);
}

function buildBookkeepingCsv(transactions, bookings, period) {
  const stats = getBookkeepingStats(transactions, bookings, period);
  const summaryRows = [
    ['Ringkasan Pembukuan', ''],
    ['Periode', getPeriodLabel(period)],
    ['Cash Masuk', stats.cashIn],
    ['Pengeluaran', stats.cashOut],
    ['Saldo Bersih', stats.net],
    ['Piutang', stats.receivable],
    ['', ''],
    ['Tanggal', 'Tipe', 'Judul', 'Metode', 'Nominal', 'Sumber', 'Catatan'],
  ];

  const transactionRows = transactions.map((transaction) => [
    formatShortDate(transaction.date),
    transaction.type === 'income' ? 'Masuk' : 'Keluar',
    transaction.title,
    getOptionLabel(paymentMethodOptions, transaction.method, transaction.method),
    toNumber(transaction.amount),
    transaction.source === 'booking' ? 'Booking' : 'Manual',
    transaction.note || '',
  ]);

  return '\uFEFF' + [...summaryRows, ...transactionRows]
    .map((row) => row.map(escapeCsvCell).join(','))
    .join('\n');
}

function downloadBookkeepingCsv(filename, csvContent) {
  if (typeof document === 'undefined' || typeof Blob === 'undefined' || typeof URL === 'undefined') {
    return false;
  }

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = filename;
  link.style.display = 'none';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  window.setTimeout(() => URL.revokeObjectURL(url), 250);

  return true;
}

function getBookkeepingStats(transactions, bookings, period) {
  const cashIn = transactions
    .filter((transaction) => transaction.type === 'income')
    .reduce((total, transaction) => total + toNumber(transaction.amount), 0);
  const cashOut = transactions
    .filter((transaction) => transaction.type === 'expense')
    .reduce((total, transaction) => total + toNumber(transaction.amount), 0);
  const receivable = bookings
    .filter((booking) => isDateInPeriod(booking.date || booking.createdAt, period))
    .reduce((total, booking) => total + getBookingReceivableAmount(booking), 0);

  return {
    cashIn,
    cashOut,
    net: cashIn - cashOut,
    receivable,
  };
}

function BookkeepingSummary({ bookings, period, transactions }) {
  const stats = getBookkeepingStats(transactions, bookings, period);

  return (
    <section className="bookkeeping-summary-grid" aria-label="Ringkasan pembukuan">
      <article className="bookkeeping-summary-card is-income">
        <span><ArrowUpRight size={15} /></span>
        <small>Cash Masuk</small>
        <strong>{formatCurrency(stats.cashIn)}</strong>
      </article>

      <article className="bookkeeping-summary-card is-expense">
        <span><ArrowDownRight size={15} /></span>
        <small>Pengeluaran</small>
        <strong>{formatCurrency(stats.cashOut)}</strong>
      </article>

      <article className="bookkeeping-summary-card">
        <span><WalletCards size={15} /></span>
        <small>Saldo Bersih</small>
        <strong>{formatCurrency(stats.net)}</strong>
      </article>

      <article className="bookkeeping-summary-card is-receivable">
        <span><ReceiptText size={15} /></span>
        <small>Piutang</small>
        <strong>{formatCurrency(stats.receivable)}</strong>
      </article>
    </section>
  );
}

function BookkeepingToolbar({ exportDisabled, onAddExpense, onExportTransactions, onPeriodChange, period }) {
  return (
    <section className="bookkeeping-toolbar" aria-label="Filter pembukuan">
      <StudioSelect
        label="Periode"
        options={periodOptions}
        selectedKey={period}
        onChange={onPeriodChange}
      />

      <button
        className="bookkeeping-export-button"
        disabled={exportDisabled}
        type="button"
        onClick={onExportTransactions}
      >
        <Download size={14} />
        Export
      </button>

      <button className="bookkeeping-add-button" title="Tambah pengeluaran" type="button" onClick={onAddExpense}>
        <Plus size={14} />
        Tambah
      </button>
    </section>
  );
}

function BookkeepingTransactionList({ onDeleteExpense, onEditExpense, transactions }) {
  if (!transactions.length) {
    return (
      <section className="bookkeeping-empty-state">
        <Landmark size={22} />
        <strong>Belum ada transaksi</strong>
        <span>Cash masuk dari billing dan pengeluaran manual akan muncul di sini.</span>
      </section>
    );
  }

  return (
    <section className="bookkeeping-list" aria-label="Daftar transaksi pembukuan">
      {transactions.map((transaction) => {
        const isIncome = transaction.type === 'income';
        const isManualExpense = transaction.source === 'manual' && transaction.type === 'expense';

        return (
          <article className={isIncome ? 'bookkeeping-row is-income' : 'bookkeeping-row is-expense'} key={transaction.id}>
            <span className="bookkeeping-row-icon">
              {isIncome ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
            </span>

            <div className="bookkeeping-row-copy">
              <strong>{transaction.title}</strong>
              <small>
                {formatShortDate(transaction.date)} • {getOptionLabel(paymentMethodOptions, transaction.method, transaction.method)}
              </small>
              {transaction.note ? <em>{transaction.note}</em> : null}
            </div>

            <div className="bookkeeping-row-tail">
              <b>{isIncome ? '+' : '-'}{formatCurrency(transaction.amount)}</b>

              {isManualExpense ? (
                <div className="bookkeeping-row-actions" aria-label="Aksi pengeluaran">
                  <button type="button" aria-label="Edit pengeluaran" onClick={() => onEditExpense(transaction)}>
                    <Pencil size={12} />
                  </button>

                  <button className="is-danger" type="button" aria-label="Hapus pengeluaran" onClick={() => onDeleteExpense(transaction)}>
                    <Trash2 size={12} />
                  </button>
                </div>
              ) : null}
            </div>
          </article>
        );
      })}
    </section>
  );
}

function ExpenseFormModal({ entry, onClose, onSave }) {
  const [form, setForm] = useState(() => ({
    ...emptyExpenseForm,
    ...(entry || {}),
    amount: entry?.amount != null ? String(entry.amount) : '',
    date: entry?.date || emptyExpenseForm.date,
  }));
  const [error, setError] = useState('');
  const isEditing = Boolean(entry?.id || form.id);

  function updateField(field) {
    return (event) => {
      setForm((current) => ({
        ...current,
        [field]: event.target.value,
      }));

      if (error) setError('');
    };
  }

  function updateValue(field) {
    return (nextValue) => {
      setForm((current) => ({
        ...current,
        [field]: nextValue,
      }));

      if (error) setError('');
    };
  }

  function handleSubmit(event) {
    event.preventDefault();

    const title = cleanText(form.title);
    const amount = toNumber(form.amount);

    if (!title) {
      setError('Judul pengeluaran wajib diisi.');
      return;
    }

    if (!amount) {
      setError('Nominal pengeluaran wajib lebih dari 0.');
      return;
    }

    onSave({
      ...form,
      id: entry?.id || form.id,
      type: 'expense',
      title,
      amount,
      note: cleanText(form.note),
    });
  }

  return (
    <div className="bookkeeping-modal-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section className="bookkeeping-modal-panel" role="dialog" aria-modal="true" aria-labelledby="bookkeeping-expense-title">
        <header className="bookkeeping-modal-head">
          <div>
            <p>Pengeluaran</p>
            <h2 id="bookkeeping-expense-title">{isEditing ? 'Edit Biaya' : 'Tambah Biaya'}</h2>
          </div>

          <button type="button" aria-label="Tutup form pengeluaran" onClick={onClose}>
            <X size={17} />
          </button>
        </header>

        <form className="bookkeeping-form" onSubmit={handleSubmit}>
          <label>
            <span>Judul</span>
            <input value={form.title} placeholder="Contoh: Listrik Studio" onChange={updateField('title')} />
          </label>

          <div className="bookkeeping-form-grid">
            <label>
              <span>Nominal</span>
              <input inputMode="numeric" min="0" placeholder="350000" type="number" value={form.amount} onChange={updateField('amount')} />
            </label>

            <label>
              <span>Tanggal</span>
              <input type="date" value={form.date} onChange={updateField('date')} />
            </label>
          </div>

          <div className="bookkeeping-form-grid">
            <StudioSelect
              label="Kategori"
              options={expenseCategoryOptions}
              selectedKey={form.category}
              onChange={updateValue('category')}
            />

            <StudioSelect
              label="Metode"
              options={paymentMethodOptions}
              selectedKey={form.paymentMethod}
              onChange={updateValue('paymentMethod')}
            />
          </div>

          <label>
            <span>Catatan</span>
            <textarea value={form.note} placeholder="Opsional..." onChange={updateField('note')} />
          </label>

          {error ? <p className="bookkeeping-form-error" role="alert">{error}</p> : null}

          <footer>
            <button type="button" onClick={onClose}>Batal</button>
            <button className="is-primary" type="submit">{isEditing ? 'Update' : 'Simpan'}</button>
          </footer>
        </form>
      </section>
    </div>
  );
}

export default function BookkeepingPage() {
  const [bookings, setBookings] = useState([]);
  const [entries, setEntries] = useState([]);
  const [period, setPeriod] = useState('month');
  const [isExpenseFormOpen, setIsExpenseFormOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    const unsubscribe = adminBookingRepository.subscribeManualBookings(
      (data) => setBookings(data),
      (error) => {
        console.error('Gagal memuat booking untuk pembukuan:', error);
        setToast({
          title: 'Booking belum tersinkron',
          message: 'Cash masuk dari booking belum bisa dimuat.',
        });
      }
    );

    return unsubscribe;
  }, []);

  useEffect(() => {
    const unsubscribe = bookkeepingRepository.subscribeBookkeepingEntries(
      (data) => setEntries(data),
      (error) => {
        console.error('Gagal memuat pembukuan:', error);
        setToast({
          title: 'Pembukuan belum tersinkron',
          message: 'Data pengeluaran belum bisa dimuat dari Firestore.',
        });
      }
    );

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!toast) return undefined;

    const timerId = window.setTimeout(() => setToast(null), 4200);

    return () => window.clearTimeout(timerId);
  }, [toast]);

  const filteredTransactions = useMemo(() => {
    const incomeTransactions = buildIncomeTransactions(bookings);
    const expenseTransactions = buildExpenseTransactions(entries);

    return [...incomeTransactions, ...expenseTransactions]
      .filter((transaction) => isDateInPeriod(transaction.date, period))
      .sort((first, second) => {
        const firstDate = getDateFromValue(first.date)?.getTime() || 0;
        const secondDate = getDateFromValue(second.date)?.getTime() || 0;

        return secondDate - firstDate;
      });
  }, [bookings, entries, period]);

  function exportBookkeepingCsv() {
    const stats = getBookkeepingStats(filteredTransactions, bookings, period);

    if (!filteredTransactions.length && stats.receivable <= 0) {
      setToast({
        title: 'Tidak ada data',
        message: 'Belum ada transaksi pembukuan untuk periode ini.',
      });
      return;
    }

    const today = new Date().toISOString().slice(0, 10);
    const csvContent = buildBookkeepingCsv(filteredTransactions, bookings, period);
    const isDownloaded = downloadBookkeepingCsv('pembukuan-37musicstudio-' + period + '-' + today + '.csv', csvContent);

    setToast({
      title: isDownloaded ? 'Export berhasil' : 'Export tidak tersedia',
      message: isDownloaded
        ? 'Data pembukuan periode ' + getPeriodLabel(period) + ' sudah dibuat menjadi file CSV.'
        : 'Browser tidak mendukung download file otomatis.',
    });
  }

  function openAddExpense() {
    setEditingExpense(null);
    setIsExpenseFormOpen(true);
  }

  function closeExpenseForm() {
    setIsExpenseFormOpen(false);
    setEditingExpense(null);
  }

  function openEditExpense(transaction) {
    const targetEntry = entries.find((entry) => entry.id === transaction.entryId);

    if (!targetEntry) {
      setToast({
        title: 'Data tidak ditemukan',
        message: 'Pengeluaran ini belum bisa diedit karena data sumber tidak ditemukan.',
      });
      return;
    }

    setEditingExpense(targetEntry);
    setIsExpenseFormOpen(true);
  }

  async function saveExpense(entry) {
    try {
      const isEditing = Boolean(entry.id);
      const savedEntry = isEditing
        ? await bookkeepingRepository.updateBookkeepingEntry(entry)
        : await bookkeepingRepository.createBookkeepingEntry(entry);

      closeExpenseForm();
      setToast({
        title: isEditing ? 'Pengeluaran diperbarui' : 'Pengeluaran tersimpan',
        message: savedEntry.title + ' masuk ke pembukuan.',
      });
    } catch (error) {
      console.error('Gagal menyimpan pengeluaran:', error);
      setToast({
        title: 'Gagal menyimpan',
        message: 'Pengeluaran belum berhasil disimpan ke Firestore.',
      });
    }
  }

  async function deleteExpense(transaction) {
    try {
      const confirmed = typeof window === 'undefined'
        ? true
        : window.confirm('Hapus pengeluaran "' + transaction.title + '" dari pembukuan?');

      if (!confirmed) return;

      await bookkeepingRepository.deleteBookkeepingEntry(transaction.entryId);

      setToast({
        title: 'Pengeluaran dihapus',
        message: transaction.title + ' sudah dihapus dari pembukuan.',
      });
    } catch (error) {
      console.error('Gagal menghapus pengeluaran:', error);
      setToast({
        title: 'Gagal menghapus',
        message: 'Pengeluaran belum berhasil dihapus dari Firestore.',
      });
    }
  }

  return (
    <section className="bookkeeping-page" aria-label="Halaman pembukuan">
      <BookkeepingSummary bookings={bookings} period={period} transactions={filteredTransactions} />

      <BookkeepingToolbar
        exportDisabled={!filteredTransactions.length && getBookkeepingStats(filteredTransactions, bookings, period).receivable <= 0}
        period={period}
        onAddExpense={openAddExpense}
        onExportTransactions={exportBookkeepingCsv}
        onPeriodChange={setPeriod}
      />

      <BookkeepingTransactionList
        transactions={filteredTransactions}
        onDeleteExpense={deleteExpense}
        onEditExpense={openEditExpense}
      />

      {isExpenseFormOpen ? (
        <ExpenseFormModal
          key={editingExpense?.id || 'new-expense'}
          entry={editingExpense}
          onClose={closeExpenseForm}
          onSave={saveExpense}
        />
      ) : null}

      {toast ? (
        <aside className="schedule-toast is-warning" role="status" aria-live="polite">
          <span className="schedule-toast-orb" aria-hidden="true" />
          <span className="schedule-toast-copy">
            <strong>{toast.title}</strong>
            <span>{toast.message}</span>
          </span>
          <button
            aria-label="Tutup notifikasi"
            className="schedule-toast-close"
            type="button"
            onClick={() => setToast(null)}
          >
            ×
          </button>
        </aside>
      ) : null}
    </section>
  );
}
