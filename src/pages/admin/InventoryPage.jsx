import { useEffect, useMemo, useRef, useState } from 'react';
import '../../styles/modules/inventory.css';
import { Dialog } from 'radix-ui';
import {
  AlertTriangle,
  Archive,
  Boxes,
  CheckCircle2,
  Download,
  History,
  LoaderCircle,
  MapPin,
  Minus,
  PackageOpen,
  Pencil,
  Plus,
  Search,
  SlidersHorizontal,
  Wrench,
  X,
} from 'lucide-react';
import StudioSelect from '../../components/ui/StudioSelect.jsx';
import PaginationControls from '../../components/ui/PaginationControls.jsx';
import { ADMIN_LIST_PAGE_SIZE, getPaginationSlice } from '../../utils/pagination.js';
import { inventoryRepository } from '../../services/inventoryRepository.js';
import { adjustCanonicalInventory } from '../../services/adminOperationsRepository.js';

const categoryOptions = [
  { key: 'all', label: 'Semua Kategori', description: 'Tampilkan semua item' },
  { key: 'studio_gear', label: 'Alat Studio', description: 'Amplifier, mixer, interface' },
  { key: 'cable', label: 'Kabel', description: 'Kabel jack, mic, power' },
  { key: 'drum', label: 'Drum', description: 'Stick, cymbal, pedal, part drum' },
  { key: 'guitar_bass', label: 'Gitar / Bass', description: 'Senar, pick, strap, spare part' },
  { key: 'recording', label: 'Recording', description: 'Mic, headphone, audio tools' },
  { key: 'accessory', label: 'Aksesoris', description: 'Stand, adaptor, holder' },
  { key: 'consumable', label: 'Consumable', description: 'Barang habis pakai' },
  { key: 'other', label: 'Lainnya', description: 'Item lain' },
];

const formCategoryOptions = categoryOptions.filter((item) => item.key !== 'all');

const typeOptions = [
  { key: 'asset', label: 'Asset', description: 'Barang utama studio' },
  { key: 'consumable', label: 'Consumable', description: 'Barang habis pakai' },
];

const unitOptions = [
  { key: 'pcs', label: 'Pcs', description: 'Satuan buah' },
  { key: 'unit', label: 'Unit', description: 'Satuan unit' },
  { key: 'set', label: 'Set', description: 'Satuan set' },
  { key: 'pack', label: 'Pack', description: 'Satuan pack' },
  { key: 'roll', label: 'Roll', description: 'Satuan roll' },
];

const conditionOptions = [
  { key: 'good', label: 'Baik', description: 'Siap digunakan' },
  { key: 'fair', label: 'Cukup', description: 'Masih aman, perlu dipantau' },
  { key: 'maintenance', label: 'Maintenance', description: 'Perlu dicek atau servis' },
  { key: 'broken', label: 'Rusak', description: 'Tidak layak pakai' },
];

const statusOptions = [
  { key: 'active', label: 'Aktif', description: 'Dipakai operasional' },
  { key: 'maintenance', label: 'Maintenance', description: 'Sedang/perlu perbaikan' },
  { key: 'broken', label: 'Rusak', description: 'Rusak' },
  { key: 'lost', label: 'Hilang', description: 'Tidak ditemukan' },
  { key: 'inactive', label: 'Nonaktif', description: 'Tidak dipakai' },
];

const filterStatusOptions = [
  { key: 'all', label: 'Semua Status', description: 'Tampilkan semua status' },
  { key: 'active', label: 'Aktif', description: 'Barang aktif' },
  { key: 'low_stock', label: 'Stok Menipis', description: 'Qty di bawah minimal' },
  { key: 'maintenance', label: 'Maintenance', description: 'Perlu perbaikan' },
  { key: 'broken', label: 'Rusak', description: 'Rusak' },
  { key: 'lost', label: 'Hilang', description: 'Tidak ditemukan' },
  { key: 'inactive', label: 'Nonaktif', description: 'Tidak aktif' },
];

const emptyForm = {
  id: '',
  name: '',
  category: 'studio_gear',
  type: 'asset',
  quantity: '1',
  unit: 'pcs',
  minStock: '0',
  condition: 'good',
  status: 'active',
  location: '',
  note: '',
};

function cleanText(value) {
  return String(value || '').trim();
}

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

function getOptionLabel(options, key, fallback = '-') {
  return options.find((item) => item.key === key)?.label || fallback;
}

function getEffectiveStatus(item) {
  if (item.status === 'inactive' || item.status === 'lost' || item.status === 'broken') {
    return item.status;
  }

  if (item.condition === 'maintenance' || item.status === 'maintenance') return 'maintenance';
  if (Number(item.minStock) > 0 && Number(item.quantity) <= Number(item.minStock)) {
    return 'low_stock';
  }

  return item.status || 'active';
}

function getStatusLabel(status) {
  if (status === 'low_stock') return 'Stok Menipis';
  if (status === 'maintenance') return 'Maintenance';
  if (status === 'broken') return 'Rusak';
  if (status === 'lost') return 'Hilang';
  if (status === 'inactive') return 'Nonaktif';
  return 'Aktif';
}

function formatMovementDate(value) {
  if (!value) return '-';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';

  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
  }).format(date);
}

function getMovementTypeLabel(type) {
  if (type === 'create') return 'Item Baru';
  if (type === 'edit') return 'Update Item';
  if (type === 'in' || type === 'stock-in') return 'Stok Masuk';
  if (type === 'out' || type === 'stock-out') return 'Stok Keluar';
  if (type === 'inactive') return 'Nonaktif';
  return 'Aktivitas';
}

function escapeCsvCell(value) {
  const text = String(value ?? '').replace(/\r?\n/g, ' ').trim();

  if (/[",;]/.test(text)) {
    return '"' + text.replace(/"/g, '""') + '"';
  }

  return text;
}

function buildInventoryCsv(items) {
  const header = [
    'Nama Item',
    'Kategori',
    'Tipe',
    'Qty',
    'Satuan',
    'Minimal Stok',
    'Status',
    'Kondisi',
    'Lokasi',
    'Catatan',
  ];

  const rows = items.map((item) => {
    const status = getEffectiveStatus(item);

    return [
      item.name,
      getOptionLabel(formCategoryOptions, item.category, item.category),
      item.type === 'consumable' ? 'Consumable' : 'Asset',
      item.quantity,
      item.unit,
      item.minStock,
      getStatusLabel(status),
      getOptionLabel(conditionOptions, item.condition, item.condition),
      item.location,
      item.note,
    ];
  });

  return '\uFEFF' + [header, ...rows]
    .map((row) => row.map(escapeCsvCell).join(','))
    .join('\n');
}

function downloadInventoryCsv(filename, csvContent) {
  if (
    typeof document === 'undefined' ||
    typeof Blob === 'undefined' ||
    typeof URL === 'undefined'
  ) {
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

function getInventoryStats(items) {
  return items.reduce(
    (stats, item) => {
      const status = getEffectiveStatus(item);

      stats.total += 1;
      if (status === 'active') stats.active += 1;
      if (status === 'low_stock') stats.lowStock += 1;
      if (status === 'maintenance') stats.maintenance += 1;
      if (['low_stock', 'maintenance', 'broken', 'lost'].includes(status)) stats.attention += 1;
      return stats;
    },
    {
      active: 0,
      attention: 0,
      lowStock: 0,
      maintenance: 0,
      total: 0,
    },
  );
}

function getInventoryAttentionItems(items) {
  return items
    .map((item) => ({
      ...item,
      effectiveStatus: getEffectiveStatus(item),
    }))
    .filter((item) => ['low_stock', 'maintenance', 'broken', 'lost'].includes(item.effectiveStatus))
    .sort((first, second) => {
      const priority = {
        broken: 1,
        lost: 2,
        low_stock: 3,
        maintenance: 4,
      };

      return (priority[first.effectiveStatus] || 9) - (priority[second.effectiveStatus] || 9);
    });
}

function InventoryEditorialHeader({ items }) {
  const stats = getInventoryStats(items);

  return (
    <header className="inventory-editorial-header">
      <div className="inventory-heading">
        <span className="inventory-kicker">Equipment operations</span>
        <h2 id="inventory-title">Studio Inventory</h2>
        <p>Jaga alat, stok habis pakai, kondisi, dan kebutuhan service dalam satu workspace.</p>
      </div>

      <div className="inventory-health-context" aria-label="Konteks kesehatan inventory">
        <span className="inventory-context-icon"><Boxes size={16} aria-hidden="true" /></span>
        <span>
          <small>Equipment health</small>
          <strong>{stats.total} item tercatat</strong>
          <em>{stats.attention} perlu perhatian</em>
        </span>
      </div>
    </header>
  );
}

function InventorySummary({ items }) {
  const stats = getInventoryStats(items);
  const metrics = [
    {
      detail: 'equipment registry',
      icon: Boxes,
      label: 'Total Item',
      tone: '',
      value: stats.total,
    },
    {
      detail: 'siap operasional',
      icon: CheckCircle2,
      label: 'Aktif',
      tone: 'is-success',
      value: stats.active,
    },
    {
      detail: 'perlu restock',
      icon: PackageOpen,
      label: 'Stok Menipis',
      tone: 'is-warning',
      value: stats.lowStock,
    },
    {
      detail: 'perlu dicek / service',
      icon: Wrench,
      label: 'Maintenance',
      tone: 'is-info',
      value: stats.maintenance,
    },
  ];

  return (
    <section className="inventory-pulse" aria-label="Ringkasan inventory">
      {metrics.map((metric) => {
        const Icon = metric.icon;

        return (
          <article className={'inventory-pulse-metric ' + metric.tone} key={metric.label}>
            <span className="inventory-pulse-icon"><Icon size={16} aria-hidden="true" /></span>
            <span>
              <small>{metric.label}</small>
              <strong>{metric.value}</strong>
              <em>{metric.detail}</em>
            </span>
          </article>
        );
      })}
    </section>
  );
}

function InventoryToolbar({
  categoryFilter,
  exportDisabled,
  isFiltered,
  onAddItem,
  onCategoryChange,
  onExportItems,
  onResetFilters,
  onSearchChange,
  onStatusChange,
  resultCount,
  searchText,
  statusFilter,
  totalItems,
}) {
  return (
    <section className="inventory-command-shelf" aria-label="Inventory controls">
      <label className="inventory-search-shell">
        <Search size={16} aria-hidden="true" />
        <input
          aria-label="Cari inventory"
          placeholder="Cari item, lokasi, catatan..."
          type="search"
          value={searchText}
          onChange={(event) => onSearchChange(event.target.value)}
        />
      </label>

      <div className="inventory-toolbar-filters">
        <StudioSelect
          label="Kategori"
          options={categoryOptions}
          selectedKey={categoryFilter}
          onChange={onCategoryChange}
        />

        <StudioSelect
          label="Status"
          options={filterStatusOptions}
          selectedKey={statusFilter}
          onChange={onStatusChange}
        />
      </div>

      <div className="inventory-toolbar-actions">
        <button
          className="inventory-export-button"
          disabled={exportDisabled}
          type="button"
          onClick={onExportItems}
        >
          <Download size={14} aria-hidden="true" />
          <span>Export</span>
        </button>

        <button className="inventory-add-button" type="button" onClick={onAddItem}>
          <Plus size={14} aria-hidden="true" />
          <span>Tambah Item</span>
        </button>
      </div>

      <div className="inventory-filter-context">
        <SlidersHorizontal size={13} aria-hidden="true" />
        <span><strong>{resultCount}</strong><small>dari {totalItems} item</small></span>
        {isFiltered ? (
          <button type="button" onClick={onResetFilters}>Reset</button>
        ) : (
          <em>semua inventory</em>
        )}
      </div>
    </section>
  );
}

function InventoryInsightState({ type }) {
  if (type === 'loading') {
    return (
      <div className="inventory-insight-state" role="status">
        <LoaderCircle className="auth-spin" size={18} aria-hidden="true" />
        <strong>Menyinkronkan inventory...</strong>
        <span>Equipment registry sedang dibaca.</span>
      </div>
    );
  }

  if (type === 'error') {
    return (
      <div className="inventory-insight-state is-error" role="alert">
        <AlertTriangle size={18} aria-hidden="true" />
        <strong>Data belum tersinkron</strong>
        <span>Cek koneksi atau izin inventory.</span>
      </div>
    );
  }

  if (type === 'clear') {
    return (
      <div className="inventory-insight-state is-clear">
        <CheckCircle2 size={18} aria-hidden="true" />
        <strong>Semua equipment terkontrol</strong>
        <span>Belum ada stok, kondisi, atau status yang butuh tindakan.</span>
      </div>
    );
  }

  return (
    <div className="inventory-insight-state">
      <History size={18} aria-hidden="true" />
      <strong>Belum ada movement</strong>
      <span>Perubahan stok dan item akan tercatat di sini.</span>
    </div>
  );
}

function InventoryAttentionPanel({ adjustingItemIds, isLoading, items, loadError, onAdjustStock, onEdit }) {
  const attentionItems = getInventoryAttentionItems(items);

  return (
    <section className="inventory-attention-panel" aria-label="Inventory yang perlu perhatian">
      <header>
        <span className="inventory-panel-icon"><Wrench size={15} aria-hidden="true" /></span>
        <div>
          <small>Action queue</small>
          <strong>Equipment perlu perhatian</strong>
          <em>{attentionItems.length} item terdeteksi</em>
        </div>
      </header>

      {isLoading ? <InventoryInsightState type="loading" /> : null}
      {!isLoading && loadError ? <InventoryInsightState type="error" /> : null}
      {!isLoading && !loadError && !attentionItems.length ? (
        <InventoryInsightState type="clear" />
      ) : null}

      {!isLoading && !loadError && attentionItems.length ? (
        <div className="inventory-attention-list">
          {attentionItems.slice(0, 4).map((item) => {
            const isLowStock = item.effectiveStatus === 'low_stock';

            return (
              <article className={'inventory-attention-row is-' + item.effectiveStatus} key={item.id}>
                <span className={'inventory-status-dot is-' + item.effectiveStatus} aria-hidden="true" />
                <div className="inventory-attention-info">
                  <strong>{item.name}</strong>
                  <span>
                    {getStatusLabel(item.effectiveStatus)} · {item.quantity} {item.unit}
                    {Number(item.minStock) > 0 ? ' / min ' + item.minStock + ' ' + item.unit : ''}
                  </span>
                </div>

                <button
                  type="button"
                  className="inventory-attention-btn"
                  disabled={adjustingItemIds.has(item.id)}
                  onClick={() => {
                    if (isLowStock) {
                      onAdjustStock(item, 'in');
                      return;
                    }

                    onEdit(item);
                  }}
                >
                  {isLowStock ? <Plus size={12} aria-hidden="true" /> : <Pencil size={12} aria-hidden="true" />}
                  <span>{isLowStock ? 'Restock' : 'Review'}</span>
                </button>
              </article>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}

function InventoryMovementPanel({ isLoading, loadError, movements }) {
  return (
    <section className="inventory-movement-panel" aria-label="Aktivitas inventory terbaru">
      <header>
        <span className="inventory-panel-icon"><History size={15} aria-hidden="true" /></span>
        <div>
          <small>Movement log</small>
          <strong>Aktivitas terbaru</strong>
          <em>{movements.length} movement tersinkron</em>
        </div>
      </header>

      {isLoading ? <InventoryInsightState type="loading" /> : null}
      {!isLoading && loadError ? <InventoryInsightState type="error" /> : null}
      {!isLoading && !loadError && !movements.length ? <InventoryInsightState type="empty" /> : null}

      {!isLoading && !loadError && movements.length ? (
        <div className="inventory-movement-list">
          {movements.slice(0, 4).map((movement) => {
            const isStockOut = movement.type === 'out' || movement.type === 'stock-out';
            const movementClass = movement.type === 'stock-in'
              ? 'in'
              : isStockOut
                ? 'out'
                : movement.type;

            return (
              <article className={'inventory-movement-row is-' + movementClass} key={movement.id}>
                <span className="inventory-movement-mark" aria-hidden="true">
                  {isStockOut ? <Minus size={12} /> : <Plus size={12} />}
                </span>
                <div className="inventory-movement-info">
                  <strong>{movement.itemName}</strong>
                  <span>{getMovementTypeLabel(movement.type)} · {formatMovementDate(movement.createdAt)}</span>
                  {movement.reason || movement.note ? <em>{movement.reason || movement.note}</em> : null}
                  {movement.actorName ? <small>Oleh {movement.actorName}</small> : null}
                </div>
                <b>
                  {isStockOut ? '-' : '+'}{movement.quantity} {movement.unit}
                </b>
              </article>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}

function InventoryLedgerState({ hasInventory, type }) {
  if (type === 'loading') {
    return (
      <div className="inventory-ledger-state" role="status">
        <span className="inventory-state-icon"><LoaderCircle className="auth-spin" size={19} /></span>
        <strong>Menyinkronkan equipment registry...</strong>
        <span>Inventory dan kondisi terbaru sedang dimuat.</span>
        <div className="inventory-state-skeleton" aria-hidden="true"><i /><i /><i /></div>
      </div>
    );
  }

  if (type === 'error') {
    return (
      <div className="inventory-ledger-state is-error" role="alert">
        <span className="inventory-state-icon"><AlertTriangle size={19} /></span>
        <strong>Inventory belum berhasil dimuat</strong>
        <span>Periksa koneksi atau izin akses Firestore.</span>
      </div>
    );
  }

  return (
    <div className="inventory-ledger-state">
      <span className="inventory-state-icon"><PackageOpen size={19} /></span>
      <strong>{hasInventory ? 'Tidak ada item di filter ini' : 'Inventory masih kosong'}</strong>
      <span>
        {hasInventory
          ? 'Ubah pencarian, kategori, atau status untuk melihat equipment lain.'
          : 'Tambahkan alat studio, kabel, aksesoris, atau barang habis pakai.'}
      </span>
    </div>
  );
}

function InventoryList({
  adjustingItemIds,
  hasInventory,
  isLoading,
  items,
  loadError,
  onArchive,
  onAdjustStock,
  onEdit,
  resultCount,
}) {
  return (
    <section className="inventory-ledger" aria-label="Daftar inventory">
      <header className="inventory-ledger-header">
        <div>
          <span>Equipment registry</span>
          <strong>{resultCount} item ditemukan</strong>
        </div>
        <p><History size={13} aria-hidden="true" /> Adjustment stok menulis movement log</p>
      </header>

      <div className="inventory-ledger-columns" aria-hidden="true">
        <span>Equipment / condition</span>
        <span>Stock</span>
        <span>Actions</span>
      </div>

      {isLoading ? <InventoryLedgerState hasInventory={hasInventory} type="loading" /> : null}
      {!isLoading && loadError ? <InventoryLedgerState hasInventory={hasInventory} type="error" /> : null}
      {!isLoading && !loadError && !items.length ? (
        <InventoryLedgerState hasInventory={hasInventory} type="empty" />
      ) : null}

      {!isLoading && !loadError && items.length ? (
        <div className="inventory-ledger-rows">
          {items.map((item) => {
            const status = getEffectiveStatus(item);
            const isAlertStatus = ['broken', 'lost', 'maintenance', 'low_stock'].includes(status);
            const isAdjusting = adjustingItemIds.has(item.id);

            return (
              <article className={'inventory-item-row is-' + status} key={item.id}>
                <span className="inventory-item-icon"><PackageOpen size={15} aria-hidden="true" /></span>

                <div className="inventory-item-info">
                  <div className="inventory-item-name-line">
                    <strong className="inventory-item-name" title={item.name}>{item.name}</strong>
                    <span className="inventory-item-badge">
                      {getOptionLabel(formCategoryOptions, item.category, 'Kategori')}
                    </span>
                    <span className={'inventory-status-pill is-' + status}>
                      <i aria-hidden="true" />{getStatusLabel(status)}
                    </span>
                  </div>

                  <div className="inventory-item-details">
                    <span><MapPin size={11} aria-hidden="true" />{item.location || 'Belum ada lokasi'}</span>
                    <span className="dot-separator">·</span>
                    <span>{getOptionLabel(conditionOptions, item.condition, 'Baik')}</span>
                    {item.note ? (
                      <>
                        <span className="dot-separator">·</span>
                        <span className="inventory-note-preview" title={item.note}>{item.note}</span>
                      </>
                    ) : null}
                  </div>
                </div>

                <div className="inventory-item-stock-col">
                  <small>Stok</small>
                  <strong className={'inventory-qty ' + (isAlertStatus ? 'is-alert' : '')}>
                    {item.quantity} <em>{item.unit}</em>
                  </strong>
                  {Number(item.minStock) > 0 ? (
                    <span className="inventory-min-stock">Min. {item.minStock}</span>
                  ) : null}
                </div>

                <div className="inventory-item-actions-col">
                  <div className="inventory-adjust-group" aria-label={'Adjustment stok ' + item.name}>
                    <button
                      aria-label={'Kurangi stok ' + item.name}
                      className="inventory-adjust-btn is-out"
                      disabled={isAdjusting}
                      title="Stok keluar"
                      type="button"
                      onClick={() => onAdjustStock(item, 'out')}
                    >
                      <Minus size={12} />
                    </button>
                    <button
                      aria-label={'Tambah stok ' + item.name}
                      className="inventory-adjust-btn is-in"
                      disabled={isAdjusting}
                      title="Stok masuk"
                      type="button"
                      onClick={() => onAdjustStock(item, 'in')}
                    >
                      <Plus size={12} />
                    </button>
                  </div>

                  <div className="inventory-crud-group" aria-label={'Pengelolaan ' + item.name}>
                    <button
                      aria-label={'Edit item ' + item.name}
                      className="inventory-crud-btn"
                      title="Edit item"
                      type="button"
                      onClick={() => onEdit(item)}
                    >
                      <Pencil size={11} />
                    </button>
                    {item.status !== 'inactive' ? (
                      <button
                        aria-label={'Nonaktifkan item ' + item.name}
                        className="inventory-crud-btn"
                        title="Nonaktifkan item"
                        type="button"
                        onClick={() => onArchive(item)}
                      >
                        <Archive size={11} />
                      </button>
                    ) : null}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}

function StockAdjustmentModal({ isSubmitting, item, mode, onClose, onSubmit }) {
  const [quantity, setQuantity] = useState('1');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  const isStockIn = mode === 'in';
  const title = isStockIn ? 'Tambah Stok' : 'Kurangi Stok';
  const currentQuantity = Number(item?.quantity || 0);

  async function handleSubmit(event) {
    event.preventDefault();

    if (isSubmitting) return;

    const amount = toNumber(quantity);

    if (!amount) {
      setError('Jumlah adjustment wajib lebih dari 0.');
      return;
    }

    if (!isStockIn && amount > currentQuantity) {
      setError('Stok keluar tidak boleh lebih besar dari stok saat ini.');
      return;
    }

    const reason = cleanText(note);
    if (reason.length < 4) {
      setError('Alasan adjustment wajib diisi minimal 4 karakter.');
      return;
    }

    const result = await onSubmit(item, {
      amount,
      mode,
      note: reason,
    });

    if (result?.error) setError(result.error);
  }

  return (
    <Dialog.Root modal open onOpenChange={(nextOpen) => {
      if (!nextOpen && !isSubmitting) onClose();
    }}>
      <Dialog.Portal>
        <Dialog.Overlay className="inventory-modal-backdrop" />
        <Dialog.Content className="inventory-modal-panel inventory-adjustment-panel" data-inventory-modal-ui="ui-9-spatial">
          <header className="inventory-modal-head">
            <div>
              <span>{title}</span>
              <Dialog.Title asChild>
                <h2>{item?.name || 'Inventory'}</h2>
              </Dialog.Title>
              <Dialog.Description asChild>
                <p>Catat perubahan stok agar movement log tetap memiliki jejak yang jelas.</p>
              </Dialog.Description>
            </div>

            <Dialog.Close asChild>
              <button type="button" aria-label="Tutup adjustment stok" disabled={isSubmitting}><X size={18} /></button>
            </Dialog.Close>
          </header>

          <form className="inventory-form inventory-adjustment-form" onSubmit={handleSubmit}>
            <div className="inventory-adjustment-current">
              <small>Stok Saat Ini</small>
              <strong>{currentQuantity} {item?.unit || 'pcs'}</strong>
            </div>

            <label>
              <span>{isStockIn ? 'Jumlah Masuk' : 'Jumlah Keluar'}</span>
              <input
                inputMode="numeric"
                min="1"
                placeholder="Contoh: 2"
                type="number"
                value={quantity}
                onChange={(event) => {
                  setQuantity(event.target.value);
                  if (error) setError('');
                }}
              />
            </label>

            <label>
              <span>Alasan adjustment</span>
              <textarea
                aria-required="true"
                placeholder={isStockIn ? 'Contoh: pembelian stok baru...' : 'Contoh: dipakai untuk sesi Studio A...'}
                required
                value={note}
                onChange={(event) => {
                  setNote(event.target.value);
                  if (error) setError('');
                }}
              />
            </label>

            {error ? <p className="inventory-form-error" role="alert">{error}</p> : null}

            <footer>
              <Dialog.Close asChild><button type="button" disabled={isSubmitting}>Batal</button></Dialog.Close>
              <button aria-busy={isSubmitting} className="is-primary" disabled={isSubmitting} type="submit">
                {isSubmitting ? 'Menyimpan...' : title}
              </button>
            </footer>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function InventoryFormModal({ item, onClose, onSave }) {
  const isEditing = Boolean(item?.id);
  const [form, setForm] = useState(() => ({
    ...emptyForm,
    ...(item || {}),
    quantity: String(item?.quantity ?? emptyForm.quantity),
    minStock: String(item?.minStock ?? emptyForm.minStock),
  }));
  const [error, setError] = useState('');

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

    const name = cleanText(form.name);
    if (!name) {
      setError('Nama item wajib diisi.');
      return;
    }

    onSave({
      ...form,
      name,
      location: cleanText(form.location),
      note: cleanText(form.note),
      quantity: isEditing ? toNumber(item?.quantity) : toNumber(form.quantity),
      minStock: toNumber(form.minStock),
    });
  }

  return (
    <Dialog.Root modal open onOpenChange={(nextOpen) => {
      if (!nextOpen) onClose();
    }}>
      <Dialog.Portal>
        <Dialog.Overlay className="inventory-modal-backdrop" />
        <Dialog.Content className="inventory-modal-panel" data-inventory-modal-ui="ui-9-spatial">
          <header className="inventory-modal-head">
            <div>
              <span>{form.id ? 'Edit equipment' : 'New equipment'}</span>
              <Dialog.Title asChild>
                <h2>{form.id ? 'Edit Inventory' : 'Tambah Inventory'}</h2>
              </Dialog.Title>
              <Dialog.Description asChild>
                <p>Kelola identitas, stok, lokasi, kondisi, dan status operasional item.</p>
              </Dialog.Description>
            </div>

            <Dialog.Close asChild>
              <button type="button" aria-label="Tutup inventory form"><X size={18} /></button>
            </Dialog.Close>
          </header>

          <form className="inventory-form" onSubmit={handleSubmit}>
            <label>
              <span>Nama Item</span>
              <input value={form.name} placeholder="Contoh: Kabel Jack 3 Meter" onChange={updateField('name')} />
            </label>

            <div className="inventory-form-grid">
              <StudioSelect
                label="Kategori"
                options={formCategoryOptions}
                selectedKey={form.category}
                onChange={updateValue('category')}
              />
              <StudioSelect
                label="Tipe"
                options={typeOptions}
                selectedKey={form.type}
                onChange={updateValue('type')}
              />
            </div>

            <div className="inventory-form-grid">
              <label>
                <span>{isEditing ? 'Stok saat ini' : 'Jumlah awal'}</span>
                <input
                  aria-describedby={isEditing ? 'inventory-quantity-edit-hint' : undefined}
                  disabled={isEditing}
                  inputMode="numeric"
                  min="0"
                  readOnly={isEditing}
                  type="number"
                  value={form.quantity}
                  onChange={updateField('quantity')}
                />
                {isEditing ? (
                  <small id="inventory-quantity-edit-hint">Gunakan Tambah/Kurangi Stok agar perubahan tercatat di movement log.</small>
                ) : null}
              </label>
              <StudioSelect
                label="Satuan"
                options={unitOptions}
                selectedKey={form.unit}
                onChange={updateValue('unit')}
              />
            </div>

            <label>
              <span>Minimal Stok</span>
              <input inputMode="numeric" type="number" min="0" value={form.minStock} onChange={updateField('minStock')} />
            </label>

            <div className="inventory-form-grid">
              <StudioSelect
                label="Kondisi"
                options={conditionOptions}
                selectedKey={form.condition}
                onChange={updateValue('condition')}
              />
              <StudioSelect
                label="Status"
                options={statusOptions}
                selectedKey={form.status}
                onChange={updateValue('status')}
              />
            </div>

            <label>
              <span>Lokasi</span>
              <input value={form.location} placeholder="Contoh: Rak Kabel" onChange={updateField('location')} />
            </label>

            <label>
              <span>Catatan</span>
              <textarea value={form.note} placeholder="Opsional, contoh: jack agak longgar..." onChange={updateField('note')} />
            </label>

            {error ? <p className="inventory-form-error" role="alert">{error}</p> : null}

            <footer>
              <Dialog.Close asChild><button type="button">Batal</button></Dialog.Close>
              <button className="is-primary" type="submit">Simpan</button>
            </footer>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export default function InventoryPage() {
  const [items, setItems] = useState([]);
  const [movements, setMovements] = useState([]);
  const [searchText, setSearchText] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [inventoryPage, setInventoryPage] = useState(1);
  const [editingItem, setEditingItem] = useState(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [stockAdjustment, setStockAdjustment] = useState(null);
  const [toast, setToast] = useState(null);
  const [isItemsLoading, setIsItemsLoading] = useState(true);
  const [itemsLoadError, setItemsLoadError] = useState('');
  const [isMovementsLoading, setIsMovementsLoading] = useState(true);
  const [movementsLoadError, setMovementsLoadError] = useState('');
  const [adjustingItemIds, setAdjustingItemIds] = useState(() => new Set());
  const adjustingItemIdsRef = useRef(new Set());

  useEffect(() => {
    const unsubscribe = inventoryRepository.subscribeInventoryItems(
      (data) => {
        setItems(data);
        setIsItemsLoading(false);
        setItemsLoadError('');
      },
      (error) => {
        console.error('Gagal memuat inventory:', error);
        setIsItemsLoading(false);
        setItemsLoadError('Data inventory belum bisa dimuat dari Firestore.');
        setToast({
          title: 'Inventory belum tersinkron',
          message: 'Data inventory belum bisa dimuat dari Firestore.',
        });
      },
    );

    return unsubscribe;
  }, []);

  useEffect(() => {
    const unsubscribe = inventoryRepository.subscribeInventoryMovements(
      (data) => {
        setMovements(data);
        setIsMovementsLoading(false);
        setMovementsLoadError('');
      },
      (error) => {
        console.error('Gagal memuat movement inventory:', error);
        setIsMovementsLoading(false);
        setMovementsLoadError('Movement log belum bisa dimuat.');
      },
      8,
    );

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!toast) return undefined;
    const timerId = window.setTimeout(() => setToast(null), 4200);
    return () => window.clearTimeout(timerId);
  }, [toast]);

  const filteredItems = useMemo(() => {
    const queryText = searchText.trim().toLowerCase();

    return items.filter((item) => {
      const status = getEffectiveStatus(item);
      const matchesCategory = categoryFilter === 'all' || item.category === categoryFilter;
      const matchesStatus = statusFilter === 'all' || status === statusFilter;
      const haystack = [
        item.name,
        item.category,
        item.type,
        item.location,
        item.note,
        item.unit,
      ].join(' ').toLowerCase();
      const matchesSearch = !queryText || haystack.includes(queryText);

      return matchesCategory && matchesStatus && matchesSearch;
    });
  }, [categoryFilter, items, searchText, statusFilter]);

  const paginatedItems = useMemo(
    () => getPaginationSlice(filteredItems, inventoryPage, ADMIN_LIST_PAGE_SIZE),
    [filteredItems, inventoryPage],
  );

  const isFiltered = Boolean(searchText.trim()) || categoryFilter !== 'all' || statusFilter !== 'all';

  function handleInventorySearchChange(nextSearchText) {
    setSearchText(nextSearchText);
    setInventoryPage(1);
  }

  function handleInventoryCategoryChange(nextCategory) {
    setCategoryFilter(nextCategory);
    setInventoryPage(1);
  }

  function handleInventoryStatusChange(nextStatus) {
    setStatusFilter(nextStatus);
    setInventoryPage(1);
  }

  function resetFilters() {
    setSearchText('');
    setCategoryFilter('all');
    setStatusFilter('all');
    setInventoryPage(1);
  }

  function exportInventoryCsv() {
    if (!filteredItems.length) {
      setToast({
        title: 'Tidak ada data',
        message: 'Tidak ada item inventory yang bisa diexport dari filter saat ini.',
      });
      return;
    }

    const today = new Date().toISOString().slice(0, 10);
    const csvContent = buildInventoryCsv(filteredItems);
    const isDownloaded = downloadInventoryCsv('inventory-37musicstudio-' + today + '.csv', csvContent);

    setToast({
      title: isDownloaded ? 'Export berhasil' : 'Export tidak tersedia',
      message: isDownloaded
        ? filteredItems.length + ' item inventory sudah dibuat menjadi file CSV.'
        : 'Browser tidak mendukung download file otomatis.',
    });
  }

  function openAddForm() {
    setEditingItem(null);
    setIsFormOpen(true);
  }

  function openEditForm(item) {
    setEditingItem(item);
    setIsFormOpen(true);
  }

  function openStockAdjustment(item, mode) {
    if (adjustingItemIdsRef.current.has(item.id)) return;
    setStockAdjustment({ item, mode });
  }

  async function saveItem(nextItem) {
    try {
      const isEditing = Boolean(nextItem.id);
      const savedItem = isEditing
        ? await inventoryRepository.updateInventoryItem({
            ...nextItem,
            quantity: editingItem?.quantity ?? nextItem.quantity,
          })
        : await inventoryRepository.createInventoryItem(nextItem);

      await inventoryRepository.createInventoryMovement({
        itemId: savedItem.id,
        itemName: savedItem.name,
        type: isEditing ? 'edit' : 'create',
        quantity: savedItem.quantity,
        previousQuantity: savedItem.quantity,
        nextQuantity: savedItem.quantity,
        unit: savedItem.unit,
        note: isEditing ? 'Update data inventory' : 'Item baru ditambahkan',
      });

      setIsFormOpen(false);
      setEditingItem(null);
      setToast({
        title: 'Inventory tersimpan',
        message: savedItem.name + ' sudah diperbarui.',
      });
    } catch (error) {
      console.error('Gagal menyimpan inventory:', error);
      setToast({
        title: 'Gagal menyimpan',
        message: 'Inventory belum berhasil disimpan ke Firestore.',
      });
    }
  }

  async function adjustStock(item, adjustment) {
    if (adjustingItemIdsRef.current.has(item.id)) {
      return { error: 'Adjustment item ini masih diproses.' };
    }

    adjustingItemIdsRef.current.add(item.id);
    setAdjustingItemIds(new Set(adjustingItemIdsRef.current));

    try {
      const amount = Number(adjustment.amount || 0);
      const delta = adjustment.mode === 'in' ? amount : -amount;
      const result = await adjustCanonicalInventory({
        delta,
        itemId: item.id,
        reason: adjustment.note,
      });
      const nextQuantity = Number(result?.item?.quantity ?? item.quantity);

      setStockAdjustment(null);
      setToast({
        title: 'Stok diperbarui',
        message: item.name + ' sekarang ' + nextQuantity + ' ' + item.unit + '.',
      });
      return { result };
    } catch (error) {
      console.error('Gagal update stok inventory:', error);
      const message = error?.message || 'Perubahan stok belum berhasil disimpan.';
      setToast({
        title: 'Gagal update stok',
        message,
      });
      return { error: message };
    } finally {
      adjustingItemIdsRef.current.delete(item.id);
      setAdjustingItemIds(new Set(adjustingItemIdsRef.current));
    }
  }

  async function archiveItem(item) {
    try {
      const savedItem = await inventoryRepository.updateInventoryItem({
        ...item,
        status: 'inactive',
        lastMovementAt: new Date().toISOString(),
        lastMovementType: 'inactive',
      });

      await inventoryRepository.createInventoryMovement({
        itemId: savedItem.id,
        itemName: savedItem.name,
        type: 'inactive',
        quantity: savedItem.quantity,
        previousQuantity: savedItem.quantity,
        nextQuantity: savedItem.quantity,
        unit: savedItem.unit,
        note: 'Item dinonaktifkan',
      });

      setToast({
        title: 'Item dinonaktifkan',
        message: item.name + ' tidak lagi dihitung sebagai item aktif.',
      });
    } catch (error) {
      console.error('Gagal menonaktifkan inventory:', error);
      setToast({
        title: 'Gagal menonaktifkan',
        message: 'Status item belum berhasil diperbarui.',
      });
    }
  }

  return (
    <section
      aria-labelledby="inventory-title"
      className="inventory-page"
      data-inventory-ui="ui-9-spatial"
    >
      <InventoryEditorialHeader items={items} />
      <InventorySummary items={items} />

      <InventoryToolbar
        categoryFilter={categoryFilter}
        exportDisabled={!filteredItems.length}
        isFiltered={isFiltered}
        resultCount={filteredItems.length}
        searchText={searchText}
        statusFilter={statusFilter}
        totalItems={items.length}
        onAddItem={openAddForm}
        onCategoryChange={handleInventoryCategoryChange}
        onExportItems={exportInventoryCsv}
        onResetFilters={resetFilters}
        onSearchChange={handleInventorySearchChange}
        onStatusChange={handleInventoryStatusChange}
      />

      <div className="inventory-operations-grid">
        <InventoryAttentionPanel
          adjustingItemIds={adjustingItemIds}
          isLoading={isItemsLoading}
          items={items}
          loadError={itemsLoadError}
          onAdjustStock={openStockAdjustment}
          onEdit={openEditForm}
        />

        <InventoryMovementPanel
          isLoading={isMovementsLoading}
          loadError={movementsLoadError}
          movements={movements}
        />
      </div>

      <InventoryList
        adjustingItemIds={adjustingItemIds}
        hasInventory={Boolean(items.length)}
        isLoading={isItemsLoading}
        items={paginatedItems}
        loadError={itemsLoadError}
        resultCount={filteredItems.length}
        onArchive={archiveItem}
        onAdjustStock={openStockAdjustment}
        onEdit={openEditForm}
      />

      <PaginationControls
        label="item"
        page={inventoryPage}
        pageSize={ADMIN_LIST_PAGE_SIZE}
        totalItems={filteredItems.length}
        onPageChange={setInventoryPage}
      />

      {stockAdjustment ? (
        <StockAdjustmentModal
          key={stockAdjustment.item?.id + '-' + stockAdjustment.mode}
          item={stockAdjustment.item}
          isSubmitting={adjustingItemIds.has(stockAdjustment.item?.id)}
          mode={stockAdjustment.mode}
          onClose={() => setStockAdjustment(null)}
          onSubmit={adjustStock}
        />
      ) : null}

      {isFormOpen ? (
        <InventoryFormModal
          key={editingItem?.id || 'new-inventory'}
          item={editingItem}
          onClose={() => {
            setIsFormOpen(false);
            setEditingItem(null);
          }}
          onSave={saveItem}
        />
      ) : null}

      {toast ? (
        <aside className="inventory-toast" role="status" aria-live="polite">
          <span className="inventory-toast-icon" aria-hidden="true">
            <CheckCircle2 size={14} />
          </span>
          <span className="inventory-toast-copy">
            <strong>{toast.title}</strong>
            <span>{toast.message}</span>
          </span>
          <button
            aria-label="Tutup notifikasi"
            className="inventory-toast-close"
            type="button"
            onClick={() => setToast(null)}
          >
            <X size={14} aria-hidden="true" />
          </button>
        </aside>
      ) : null}
    </section>
  );
}
