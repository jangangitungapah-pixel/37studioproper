import { useEffect, useMemo, useState } from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  Download,
  Landmark,
  Pencil,
  Plus,
  ReceiptText,
  Search,
  Trash2,
  WalletCards,
  X,
} from 'lucide-react';
import StudioSelect from '../../components/ui/StudioSelect.jsx';
import PaginationControls from '../../components/ui/PaginationControls.jsx';
import { ADMIN_LIST_PAGE_SIZE, getPaginationSlice } from '../../utils/pagination.js';
import { adminBookingRepository } from '../../services/adminBookingRepository.js';
import { bookkeepingRepository } from '../../services/bookkeepingRepository.js';

const periodOptions = [
  { key: 'today', label: 'Hari Ini', description: 'Transaksi hari ini' },
  { key: 'month', label: 'Bulan Ini', description: 'Transaksi bulan berjalan' },
  { key: 'year', label: 'Tahun Ini', description: 'Transaksi tahun berjalan' },
  { key: 'all', label: 'Semua', description: 'Semua transaksi' },
];

const transactionKindOptions = [
  { key: 'income', label: 'Pemasukan', description: 'Cash masuk manual' },
  { key: 'expense', label: 'Pengeluaran', description: 'Biaya atau transaksi keluar' },
];

const transactionTypeFilterOptions = [
  { key: 'all', label: 'Semua', description: 'Pemasukan dan pengeluaran' },
  { key: 'income', label: 'Pemasukan', description: 'Cash masuk manual dan booking' },
  { key: 'expense', label: 'Pengeluaran', description: 'Biaya dan transaksi keluar' },
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

const incomeCategoryOptions = [
  { key: 'walk-in', label: 'Walk-in', description: 'Pemasukan langsung di studio' },
  { key: 'rental', label: 'Sewa Alat', description: 'Sewa alat atau ruang tambahan' },
  { key: 'retail', label: 'Retail', description: 'Jual kabel, senar, stick, aksesoris' },
  { key: 'service', label: 'Service', description: 'Jasa tambahan non-booking' },
  { key: 'other', label: 'Lainnya', description: 'Pemasukan lain' },
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

const emptyIncomeForm = {
  title: '',
  amount: '',
  date: getTodayIsoDate(),
  category: 'walk-in',
  paymentMethod: 'cash',
  note: '',
};

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

function getEntryCategoryOptions(type) {
  return type === 'income' ? incomeCategoryOptions : expenseCategoryOptions;
}

function getEntryTypeLabel(type) {
  return type === 'income' ? 'Pemasukan' : 'Pengeluaran';
}

function getEntryActionLabel(type) {
  return type === 'income' ? 'pemasukan' : 'pengeluaran';
}

function buildExpenseTransactions(entries) {
  return entries
    .filter((entry) => entry.type === 'expense' || entry.type === 'income')
    .map((entry) => {
      const entryType = entry.type === 'income' ? 'income' : 'expense';
      const categoryOptions = getEntryCategoryOptions(entryType);

      return {
        id: entryType + '-' + entry.id,
        entryId: entry.id,
        source: entry.source || 'manual',
        type: entryType,
        title: entry.title,
        amount: toNumber(entry.amount),
        date: entry.date,
        method: entry.paymentMethod,
        note: (entry.source === 'operatorFee' ? 'Operator Fee • ' : '') + getOptionLabel(categoryOptions, entry.category, entry.category) + (entry.note ? ' • ' + entry.note : ''),
      };
    });
}

function getPeriodLabel(period) {
  return getOptionLabel(periodOptions, period, period);
}

const XLSX_THEME = {
  accent: 'FFFF8A2A',
  accentDark: 'FFE66D13',
  black: 'FF0B0B0C',
  panel: 'FF171719',
  panelSoft: 'FF242428',
  white: 'FFFFFFFF',
  textDark: 'FF171717',
  textMuted: 'FF706B65',
  border: 'FFD8D1C8',
  borderDark: 'FF3B3733',
  incomeFill: 'FFEAF8EF',
  incomeText: 'FF176B3A',
  expenseFill: 'FFFFEEEE',
  expenseText: 'FF9B1C1C',
  neutralFill: 'FFF6F1EA',
  receivableFill: 'FFFFF4DF',
  headerFill: 'FF201F1D',
};

const XLSX_MIME_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
const IDR_NUMBER_FORMAT = '"Rp"#,##0;[Red]-"Rp"#,##0';
const DATE_NUMBER_FORMAT = 'dd mmm yyyy';

function getExcelModule(mod) {
  return mod?.default || mod;
}

function getExcelDateValue(value) {
  const date = getDateFromValue(value);

  return date || cleanText(value) || '-';
}

function getExportTimestampLabel() {
  return new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date());
}

function getBookingCustomerLabel(booking) {
  return cleanText(
    booking?.customer ||
    booking?.customerName ||
    booking?.name ||
    booking?.clientName ||
    booking?.phone ||
    'Customer'
  );
}

function getBookingReferenceLabel(booking) {
  return cleanText(
    booking?.invoiceNumber ||
    booking?.bookingCode ||
    booking?.id ||
    '-'
  );
}

function getBookingStatusLabel(booking) {
  return cleanText(
    booking?.paymentStatus ||
    booking?.status ||
    '-'
  );
}

function buildReceivableRows(bookings, period) {
  return bookings
    .filter((booking) => isDateInPeriod(booking.date || booking.createdAt, period))
    .map((booking) => {
      const total = getBookingTotal(booking);
      const paid = getBookingPaidAmount(booking);
      const receivable = getBookingReceivableAmount(booking);

      return {
        booking,
        total,
        paid,
        receivable,
      };
    })
    .filter((row) => row.receivable > 0)
    .sort((first, second) => {
      const firstDate = getDateFromValue(first.booking.date || first.booking.createdAt)?.getTime() || 0;
      const secondDate = getDateFromValue(second.booking.date || second.booking.createdAt)?.getTime() || 0;

      return secondDate - firstDate;
    });
}

function setCellStyle(cell, style = {}) {
  if (style.font) cell.font = style.font;
  if (style.fill) cell.fill = style.fill;
  if (style.border) cell.border = style.border;
  if (style.alignment) cell.alignment = style.alignment;
  if (style.numFmt) cell.numFmt = style.numFmt;
}

function solidFill(argb) {
  return {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb },
  };
}

function thinBorder(argb = XLSX_THEME.border) {
  return {
    top: { style: 'thin', color: { argb } },
    left: { style: 'thin', color: { argb } },
    bottom: { style: 'thin', color: { argb } },
    right: { style: 'thin', color: { argb } },
  };
}

function styleWorksheetTitle(sheet, title, subtitle, columnCount) {
  sheet.mergeCells(1, 1, 1, columnCount);
  sheet.mergeCells(2, 1, 2, columnCount);

  const titleCell = sheet.getCell(1, 1);
  titleCell.value = title;
  setCellStyle(titleCell, {
    fill: solidFill(XLSX_THEME.black),
    font: {
      bold: true,
      color: { argb: XLSX_THEME.white },
      size: 18,
    },
    alignment: {
      horizontal: 'left',
      vertical: 'middle',
    },
  });

  const subtitleCell = sheet.getCell(2, 1);
  subtitleCell.value = subtitle;
  setCellStyle(subtitleCell, {
    fill: solidFill(XLSX_THEME.panel),
    font: {
      color: { argb: 'FFD8D1C8' },
      size: 10,
    },
    alignment: {
      horizontal: 'left',
      vertical: 'middle',
    },
  });

  sheet.getRow(1).height = 30;
  sheet.getRow(2).height = 22;

  for (let columnIndex = 1; columnIndex <= columnCount; columnIndex += 1) {
    setCellStyle(sheet.getCell(1, columnIndex), {
      fill: solidFill(XLSX_THEME.black),
    });
    setCellStyle(sheet.getCell(2, columnIndex), {
      fill: solidFill(XLSX_THEME.panel),
    });
  }
}

function styleHeaderRow(row) {
  row.height = 24;

  row.eachCell((cell) => {
    setCellStyle(cell, {
      fill: solidFill(XLSX_THEME.headerFill),
      font: {
        bold: true,
        color: { argb: XLSX_THEME.white },
        size: 10,
      },
      border: thinBorder(XLSX_THEME.borderDark),
      alignment: {
        horizontal: 'center',
        vertical: 'middle',
        wrapText: true,
      },
    });
  });
}

function styleDataRow(row, options = {}) {
  const fillColor = options.fillColor || XLSX_THEME.white;

  row.eachCell((cell) => {
    setCellStyle(cell, {
      fill: solidFill(fillColor),
      border: thinBorder(),
      alignment: {
        vertical: 'middle',
        wrapText: true,
      },
      font: {
        color: { argb: XLSX_THEME.textDark },
        size: 10,
      },
    });
  });
}

function addSummarySheet(workbook, transactions, bookings, period) {
  const sheet = workbook.addWorksheet('Ringkasan', {
    properties: {
      defaultRowHeight: 22,
    },
    views: [
      {
        showGridLines: false,
      },
    ],
  });

  sheet.columns = [
    { key: 'metric', width: 24 },
    { key: 'value', width: 18 },
    { key: 'note', width: 46 },
  ];

  const stats = getBookkeepingStats(transactions, bookings, period);
  const receivableRows = buildReceivableRows(bookings, period);

  styleWorksheetTitle(
    sheet,
    'Ringkasan Pembukuan 37 Music Studio',
    'Dibuat otomatis dari halaman Pembukuan • ' + getExportTimestampLabel(),
    3
  );

  sheet.addRow([]);
  sheet.addRow(['Periode', getPeriodLabel(period), 'Filter periode yang sedang aktif saat export.']);
  sheet.addRow(['Jumlah Transaksi', transactions.length, 'Mengikuti filter search, periode, dan tipe transaksi saat ini.']);
  sheet.addRow(['Jumlah Piutang', receivableRows.length, 'Booking dalam periode ini yang masih memiliki sisa tagihan.']);
  sheet.addRow([]);

  const summaryHeader = sheet.addRow(['Komponen', 'Nominal', 'Keterangan']);
  styleHeaderRow(summaryHeader);

  const rows = [
    ['Cash Masuk', stats.cashIn, 'Total pemasukan dari booking dan transaksi manual.'],
    ['Pengeluaran', stats.cashOut, 'Total pengeluaran manual yang tercatat.'],
    ['Saldo Bersih', stats.net, 'Cash masuk dikurangi pengeluaran.'],
    ['Piutang', stats.receivable, 'Estimasi tagihan booking yang belum lunas.'],
  ];

  rows.forEach((rowData) => {
    const row = sheet.addRow(rowData);
    const [label] = rowData;
    const fillColor = label === 'Cash Masuk'
      ? XLSX_THEME.incomeFill
      : label === 'Pengeluaran'
        ? XLSX_THEME.expenseFill
        : label === 'Piutang'
          ? XLSX_THEME.receivableFill
          : XLSX_THEME.neutralFill;

    styleDataRow(row, { fillColor });
    row.getCell(1).font = { bold: true, color: { argb: XLSX_THEME.textDark }, size: 10 };
    row.getCell(2).numFmt = IDR_NUMBER_FORMAT;
    row.getCell(2).font = { bold: true, color: { argb: XLSX_THEME.textDark }, size: 10 };
  });

  sheet.getColumn(2).alignment = {
    horizontal: 'right',
    vertical: 'middle',
  };

  return sheet;
}

function addTransactionsSheet(workbook, transactions, period) {
  const sheet = workbook.addWorksheet('Transaksi', {
    properties: {
      defaultRowHeight: 22,
    },
    views: [
      {
        state: 'frozen',
        ySplit: 4,
        showGridLines: false,
      },
    ],
  });

  sheet.columns = [
    { key: 'date', width: 15 },
    { key: 'type', width: 15 },
    { key: 'title', width: 32 },
    { key: 'method', width: 15 },
    { key: 'amount', width: 18 },
    { key: 'source', width: 15 },
    { key: 'note', width: 42 },
  ];

  styleWorksheetTitle(
    sheet,
    'Detail Transaksi Pembukuan',
    'Periode: ' + getPeriodLabel(period) + ' • Total baris: ' + transactions.length,
    7
  );

  sheet.addRow([]);

  const header = sheet.addRow(['Tanggal', 'Tipe', 'Judul', 'Metode', 'Nominal', 'Sumber', 'Catatan']);
  styleHeaderRow(header);

  transactions.forEach((transaction) => {
    const isIncome = transaction.type === 'income';
    const row = sheet.addRow([
      getExcelDateValue(transaction.date),
      isIncome ? 'Pemasukan' : 'Pengeluaran',
      transaction.title || '-',
      getOptionLabel(paymentMethodOptions, transaction.method, transaction.method),
      toNumber(transaction.amount),
      transaction.source === 'booking' ? 'Booking' : 'Manual',
      transaction.note || '',
    ]);

    styleDataRow(row, {
      fillColor: isIncome ? XLSX_THEME.incomeFill : XLSX_THEME.expenseFill,
    });

    row.getCell(1).numFmt = DATE_NUMBER_FORMAT;
    row.getCell(2).font = {
      bold: true,
      color: {
        argb: isIncome ? XLSX_THEME.incomeText : XLSX_THEME.expenseText,
      },
      size: 10,
    };
    row.getCell(5).numFmt = IDR_NUMBER_FORMAT;
    row.getCell(5).font = {
      bold: true,
      color: {
        argb: isIncome ? XLSX_THEME.incomeText : XLSX_THEME.expenseText,
      },
      size: 10,
    };
  });

  if (!transactions.length) {
    const emptyRow = sheet.addRow(['-', '-', 'Tidak ada transaksi untuk filter ini.', '-', 0, '-', '-']);
    styleDataRow(emptyRow, {
      fillColor: XLSX_THEME.neutralFill,
    });
    emptyRow.getCell(5).numFmt = IDR_NUMBER_FORMAT;
  }

  sheet.autoFilter = {
    from: 'A4',
    to: 'G4',
  };

  sheet.getColumn(5).alignment = {
    horizontal: 'right',
    vertical: 'middle',
  };

  return sheet;
}

function addReceivablesSheet(workbook, bookings, period) {
  const sheet = workbook.addWorksheet('Piutang', {
    properties: {
      defaultRowHeight: 22,
    },
    views: [
      {
        state: 'frozen',
        ySplit: 4,
        showGridLines: false,
      },
    ],
  });

  sheet.columns = [
    { key: 'date', width: 15 },
    { key: 'customer', width: 26 },
    { key: 'reference', width: 22 },
    { key: 'status', width: 16 },
    { key: 'total', width: 18 },
    { key: 'paid', width: 18 },
    { key: 'receivable', width: 18 },
  ];

  const receivableRows = buildReceivableRows(bookings, period);

  styleWorksheetTitle(
    sheet,
    'Daftar Piutang Booking',
    'Periode: ' + getPeriodLabel(period) + ' • Total piutang aktif: ' + receivableRows.length,
    7
  );

  sheet.addRow([]);

  const header = sheet.addRow(['Tanggal', 'Customer', 'Referensi', 'Status', 'Total', 'Terbayar', 'Sisa Piutang']);
  styleHeaderRow(header);

  receivableRows.forEach(({ booking, total, paid, receivable }) => {
    const row = sheet.addRow([
      getExcelDateValue(booking.date || booking.createdAt),
      getBookingCustomerLabel(booking),
      getBookingReferenceLabel(booking),
      getBookingStatusLabel(booking),
      total,
      paid,
      receivable,
    ]);

    styleDataRow(row, {
      fillColor: XLSX_THEME.receivableFill,
    });

    row.getCell(1).numFmt = DATE_NUMBER_FORMAT;
    row.getCell(7).font = {
      bold: true,
      color: { argb: XLSX_THEME.accentDark },
      size: 10,
    };
  });

  if (!receivableRows.length) {
    const emptyRow = sheet.addRow(['-', 'Tidak ada piutang untuk periode ini.', '-', '-', 0, 0, 0]);
    styleDataRow(emptyRow, {
      fillColor: XLSX_THEME.neutralFill,
    });
  }

  sheet.autoFilter = {
    from: 'A4',
    to: 'G4',
  };

  [5, 6, 7].forEach((columnNumber) => {
    sheet.getColumn(columnNumber).numFmt = IDR_NUMBER_FORMAT;
    sheet.getColumn(columnNumber).alignment = {
      horizontal: 'right',
      vertical: 'middle',
    };
  });

  return sheet;
}

async function buildBookkeepingWorkbook(transactions, bookings, period) {
  const excelModule = await import('exceljs');
  const ExcelJS = getExcelModule(excelModule);
  const workbook = new ExcelJS.Workbook();

  workbook.creator = '37 Music Studio Admin';
  workbook.lastModifiedBy = '37 Music Studio Admin';
  workbook.created = new Date();
  workbook.modified = new Date();
  workbook.subject = 'Pembukuan 37 Music Studio';
  workbook.title = 'Export Pembukuan 37 Music Studio';
  workbook.description = 'File export pembukuan otomatis berformat XLSX dengan ringkasan, transaksi, dan piutang.';

  addSummarySheet(workbook, transactions, bookings, period);
  addTransactionsSheet(workbook, transactions, period);
  addReceivablesSheet(workbook, bookings, period);

  return workbook;
}

async function downloadBookkeepingXlsx(filename, transactions, bookings, period) {
  if (typeof document === 'undefined' || typeof Blob === 'undefined' || typeof URL === 'undefined') {
    return false;
  }

  const workbook = await buildBookkeepingWorkbook(transactions, bookings, period);
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: XLSX_MIME_TYPE });
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

function BookkeepingToolbar({
  exportDisabled,
  onAddTransaction,
  onExportTransactions,
  onPeriodChange,
  onSearchChange,
  onTypeFilterChange,
  period,
  searchText,
  typeFilter,
}) {
  return (
    <section className="bookkeeping-toolbar" aria-label="Filter pembukuan">
      <div className="bookkeeping-search-shell">
        <Search size={15} aria-hidden="true" />
        <input
          aria-label="Cari transaksi pembukuan"
          placeholder="Cari judul, metode, catatan..."
          type="search"
          value={searchText}
          onChange={(event) => onSearchChange(event.target.value)}
        />
      </div>

      <div className="bookkeeping-period-filter">
        <StudioSelect
          label="Periode"
          options={periodOptions}
          selectedKey={period}
          onChange={onPeriodChange}
        />
      </div>

      <div className="bookkeeping-type-filter">
        <StudioSelect
          label="Tipe"
          options={transactionTypeFilterOptions}
          selectedKey={typeFilter}
          onChange={onTypeFilterChange}
        />
      </div>

      <button
        className="bookkeeping-export-button"
        disabled={exportDisabled}
        type="button"
        onClick={onExportTransactions}
      >
        <Download size={14} />
        Export XLSX
      </button>

      <button className="bookkeeping-add-button" title="Tambah transaksi pembukuan" type="button" onClick={onAddTransaction}>
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
        <span>Cash masuk dari billing, pemasukan manual, dan pengeluaran manual akan muncul di sini.</span>
      </section>
    );
  }

  return (
    <section className="bookkeeping-list" aria-label="Daftar transaksi pembukuan">
      {transactions.map((transaction) => {
        const isIncome = transaction.type === 'income';
        const isManualEntry = transaction.source === 'manual';

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

              {isManualEntry ? (
                <div className="bookkeeping-row-actions" aria-label="Aksi transaksi manual">
                  <button type="button" aria-label={'Edit ' + getEntryActionLabel(transaction.type)} onClick={() => onEditExpense(transaction)}>
                    <Pencil size={12} />
                  </button>

                  <button className="is-danger" type="button" aria-label={'Hapus ' + getEntryActionLabel(transaction.type)} onClick={() => onDeleteExpense(transaction)}>
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


function ExpenseFormModal({ entry, mode = 'expense', onClose, onSave }) {
  const initialType = entry?.type === 'income' || mode === 'income' ? 'income' : 'expense';
  const initialForm = initialType === 'income' ? emptyIncomeForm : emptyExpenseForm;
  const [form, setForm] = useState(() => ({
    ...initialForm,
    ...(entry || {}),
    type: initialType,
    category: entry?.category || initialForm.category,
    amount: entry?.amount != null ? String(entry.amount) : '',
    date: entry?.date || initialForm.date,
  }));
  const [error, setError] = useState('');
  const activeType = form.type === 'income' ? 'income' : 'expense';
  const categoryOptions = getEntryCategoryOptions(activeType);
  const typeLabel = getEntryTypeLabel(activeType);
  const isIncome = activeType === 'income';
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
      setForm((current) => {
        if (field === 'type') {
          const nextType = nextValue === 'income' ? 'income' : 'expense';
          const nextInitialForm = nextType === 'income' ? emptyIncomeForm : emptyExpenseForm;
          const currentCategoryOptions = getEntryCategoryOptions(nextType);
          const hasMatchingCategory = currentCategoryOptions.some((option) => option.key === current.category);

          return {
            ...current,
            type: nextType,
            category: hasMatchingCategory ? current.category : nextInitialForm.category,
          };
        }

        return {
          ...current,
          [field]: nextValue,
        };
      });

      if (error) setError('');
    };
  }

  function handleSubmit(event) {
    event.preventDefault();

    const title = cleanText(form.title);
    const amount = toNumber(form.amount);

    if (!title) {
      setError('Judul ' + typeLabel.toLowerCase() + ' wajib diisi.');
      return;
    }

    if (!amount) {
      setError('Nominal ' + typeLabel.toLowerCase() + ' wajib lebih dari 0.');
      return;
    }

    onSave({
      ...form,
      id: entry?.id || form.id,
      type: activeType,
      title,
      amount,
      category: form.category || (isIncome ? emptyIncomeForm.category : emptyExpenseForm.category),
      note: cleanText(form.note),
    });
  }

  return (
    <div className="bookkeeping-modal-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section className="bookkeeping-modal-panel" role="dialog" aria-modal="true" aria-labelledby="bookkeeping-entry-title">
        <header className="bookkeeping-modal-head">
          <div>
            <p>Transaksi Pembukuan</p>
            <h2 id="bookkeeping-entry-title">{isEditing ? 'Edit ' + typeLabel : 'Tambah Transaksi'}</h2>
          </div>

          <button type="button" aria-label="Tutup form pembukuan" onClick={onClose}>
            <X size={17} />
          </button>
        </header>

        <form className="bookkeeping-form" onSubmit={handleSubmit}>
          <div className="bookkeeping-form-grid">
            <StudioSelect
              label="Jenis Transaksi"
              options={transactionKindOptions}
              selectedKey={activeType}
              onChange={updateValue('type')}
            />

            <StudioSelect
              label="Kategori"
              options={categoryOptions}
              selectedKey={form.category}
              onChange={updateValue('category')}
            />
          </div>

          <label>
            <span>Judul</span>
            <input
              value={form.title}
              placeholder={isIncome ? 'Contoh: Jual senar gitar' : 'Contoh: Listrik Studio'}
              onChange={updateField('title')}
            />
          </label>

          <div className="bookkeeping-form-grid">
            <label>
              <span>Nominal</span>
              <input
                inputMode="numeric"
                min="0"
                placeholder={isIncome ? '150000' : '350000'}
                type="number"
                value={form.amount}
                onChange={updateField('amount')}
              />
            </label>

            <label>
              <span>Tanggal</span>
              <input type="date" value={form.date} onChange={updateField('date')} />
            </label>
          </div>

          <StudioSelect
            label="Metode"
            options={paymentMethodOptions}
            selectedKey={form.paymentMethod}
            onChange={updateValue('paymentMethod')}
          />

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
  const [transactionSearchText, setTransactionSearchText] = useState('');
  const [transactionTypeFilter, setTransactionTypeFilter] = useState('all');
  const [transactionPage, setTransactionPage] = useState(1);
  const [isExpenseFormOpen, setIsExpenseFormOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [entryFormMode, setEntryFormMode] = useState('expense');
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
    const queryText = cleanLower(transactionSearchText);
    const incomeTransactions = buildIncomeTransactions(bookings);
    const expenseTransactions = buildExpenseTransactions(entries);

    return [...incomeTransactions, ...expenseTransactions]
      .filter((transaction) => {
        const matchesPeriod = isDateInPeriod(transaction.date, period);
        const matchesType = transactionTypeFilter === 'all' || transaction.type === transactionTypeFilter;
        const typeLabel = transaction.type === 'income' ? 'pemasukan masuk cash income' : 'pengeluaran keluar biaya expense';
        const sourceLabel = transaction.source === 'booking' ? 'booking otomatis billing' : 'manual';
        const haystack = [
          transaction.title,
          transaction.note,
          transaction.method,
          getOptionLabel(paymentMethodOptions, transaction.method, transaction.method),
          typeLabel,
          sourceLabel,
        ].join(' ').toLowerCase();
        const matchesSearch = !queryText || haystack.includes(queryText);

        return matchesPeriod && matchesType && matchesSearch;
      })
      .sort((first, second) => {
        const firstDate = getDateFromValue(first.date)?.getTime() || 0;
        const secondDate = getDateFromValue(second.date)?.getTime() || 0;

        return secondDate - firstDate;
      });
  }, [bookings, entries, period, transactionSearchText, transactionTypeFilter]);

  const paginatedTransactions = useMemo(
    () => getPaginationSlice(filteredTransactions, transactionPage, ADMIN_LIST_PAGE_SIZE),
    [filteredTransactions, transactionPage]
  );

  function handlePeriodChange(nextPeriod) {
    setPeriod(nextPeriod);
    setTransactionPage(1);
  }

  function handleTransactionSearchChange(nextSearchText) {
    setTransactionSearchText(nextSearchText);
    setTransactionPage(1);
  }

  function handleTransactionTypeFilterChange(nextTypeFilter) {
    setTransactionTypeFilter(nextTypeFilter);
    setTransactionPage(1);
  }

  async function exportBookkeepingXlsx() {
    const stats = getBookkeepingStats(filteredTransactions, bookings, period);

    if (!filteredTransactions.length && stats.receivable <= 0) {
      setToast({
        title: 'Tidak ada data',
        message: 'Belum ada transaksi pembukuan untuk periode ini.',
      });
      return;
    }

    try {
      const today = new Date().toISOString().slice(0, 10);
      const filename = 'pembukuan-37musicstudio-' + period + '-' + today + '.xlsx';
      const isDownloaded = await downloadBookkeepingXlsx(filename, filteredTransactions, bookings, period);

      setToast({
        title: isDownloaded ? 'Export berhasil' : 'Export tidak tersedia',
        message: isDownloaded
          ? 'Data pembukuan periode ' + getPeriodLabel(period) + ' sudah dibuat menjadi file XLSX yang rapi.'
          : 'Browser tidak mendukung download file otomatis.',
      });
    } catch (error) {
      console.error('Gagal export pembukuan XLSX:', error);
      setToast({
        title: 'Export gagal',
        message: 'File XLSX belum berhasil dibuat. Cek console untuk detail error.',
      });
    }
  }

  function openAddTransaction() {
    setEditingExpense(null);
    setEntryFormMode('expense');
    setIsExpenseFormOpen(true);
  }

  function closeExpenseForm() {
    setIsExpenseFormOpen(false);
    setEditingExpense(null);
    setEntryFormMode('expense');
  }

  function openEditExpense(transaction) {
    const targetEntry = entries.find((entry) => entry.id === transaction.entryId);

    if (!targetEntry) {
      setToast({
        title: 'Data tidak ditemukan',
        message: 'Transaksi manual ini belum bisa diedit karena data sumber tidak ditemukan.',
      });
      return;
    }

    setEditingExpense(targetEntry);
    setEntryFormMode(targetEntry.type === 'income' ? 'income' : 'expense');
    setIsExpenseFormOpen(true);
  }

  async function saveExpense(entry) {
    try {
      const isEditing = Boolean(entry.id);
      const savedEntry = isEditing
        ? await bookkeepingRepository.updateBookkeepingEntry(entry)
        : await bookkeepingRepository.createBookkeepingEntry(entry);
      const typeLabel = getEntryTypeLabel(savedEntry.type);

      closeExpenseForm();
      setToast({
        title: typeLabel + (isEditing ? ' diperbarui' : ' tersimpan'),
        message: savedEntry.title + ' masuk ke pembukuan.',
      });
    } catch (error) {
      console.error('Gagal menyimpan transaksi pembukuan:', error);
      setToast({
        title: 'Gagal menyimpan',
        message: 'Transaksi belum berhasil disimpan ke Firestore.',
      });
    }
  }

  async function deleteExpense(transaction) {
    const actionLabel = getEntryActionLabel(transaction.type);

    try {
      const confirmed = typeof window === 'undefined'
        ? true
        : window.confirm('Hapus ' + actionLabel + ' "' + transaction.title + '" dari pembukuan?');

      if (!confirmed) return;

      await bookkeepingRepository.deleteBookkeepingEntry(transaction.entryId);

      setToast({
        title: getEntryTypeLabel(transaction.type) + ' dihapus',
        message: transaction.title + ' sudah dihapus dari pembukuan.',
      });
    } catch (error) {
      console.error('Gagal menghapus transaksi pembukuan:', error);
      setToast({
        title: 'Gagal menghapus',
        message: 'Transaksi belum berhasil dihapus dari Firestore.',
      });
    }
  }

  return (
    <section className="bookkeeping-page" aria-label="Halaman pembukuan">
      <BookkeepingSummary bookings={bookings} period={period} transactions={filteredTransactions} />

      <BookkeepingToolbar
        exportDisabled={!filteredTransactions.length && getBookkeepingStats(filteredTransactions, bookings, period).receivable <= 0}
        period={period}
        searchText={transactionSearchText}
        typeFilter={transactionTypeFilter}
        onAddTransaction={openAddTransaction}
        onExportTransactions={exportBookkeepingXlsx}
        onPeriodChange={handlePeriodChange}
        onSearchChange={handleTransactionSearchChange}
        onTypeFilterChange={handleTransactionTypeFilterChange}
      />

      <BookkeepingTransactionList
        transactions={paginatedTransactions}
        onDeleteExpense={deleteExpense}
        onEditExpense={openEditExpense}
      />

      <PaginationControls
        label="transaksi"
        page={transactionPage}
        pageSize={ADMIN_LIST_PAGE_SIZE}
        totalItems={filteredTransactions.length}
        onPageChange={setTransactionPage}
      />

      {isExpenseFormOpen ? (
        <ExpenseFormModal
          key={editingExpense?.id || entryFormMode + '-entry'}
          entry={editingExpense}
          mode={entryFormMode}
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
