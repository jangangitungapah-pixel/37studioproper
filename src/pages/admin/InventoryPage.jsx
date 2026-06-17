import { useEffect, useMemo, useState } from 'react';
import {
  Archive,
  Boxes,
  Download,
  History,
  Minus,
  PackageOpen,
  Pencil,
  Plus,
  Search,
  Wrench,
  X,
} from 'lucide-react';
import StudioSelect from '../../components/ui/StudioSelect.jsx';
import { inventoryRepository } from '../../services/inventoryRepository.js';

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
  if (item.status === 'inactive' || item.status === 'lost' || item.status === 'broken') return item.status;
  if (item.condition === 'maintenance' || item.status === 'maintenance') return 'maintenance';
  if (Number(item.minStock) > 0 && Number(item.quantity) <= Number(item.minStock)) return 'low_stock';

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
  if (type === 'in') return 'Stok Masuk';
  if (type === 'out') return 'Stok Keluar';
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

function getInventoryStats(items) {
  return items.reduce(
    (stats, item) => {
      const status = getEffectiveStatus(item);

      stats.total += 1;
      if (status === 'low_stock') stats.lowStock += 1;
      if (status === 'maintenance') stats.maintenance += 1;
      if (status === 'active') stats.active += 1;

      return stats;
    },
    {
      active: 0,
      lowStock: 0,
      maintenance: 0,
      total: 0,
    }
  );
}

function InventorySummary({ items }) {
  const stats = getInventoryStats(items);

  return (
    <section className="inventory-summary-grid" aria-label="Ringkasan inventory">
      <article className="inventory-summary-card">
        <span><Boxes size={16} /></span>
        <small>Total Item</small>
        <strong>{stats.total}</strong>
      </article>

      <article className="inventory-summary-card is-warning">
        <span><PackageOpen size={16} /></span>
        <small>Stok Menipis</small>
        <strong>{stats.lowStock}</strong>
      </article>

      <article className="inventory-summary-card is-maintenance">
        <span><Wrench size={16} /></span>
        <small>Maintenance</small>
        <strong>{stats.maintenance}</strong>
      </article>

      <article className="inventory-summary-card">
        <span><Archive size={16} /></span>
        <small>Aktif</small>
        <strong>{stats.active}</strong>
      </article>
    </section>
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
        low_stock: 1,
        maintenance: 2,
        broken: 3,
        lost: 4,
      };

      return (priority[first.effectiveStatus] || 9) - (priority[second.effectiveStatus] || 9);
    });
}

function InventoryAttentionPanel({ items, onAdjustStock, onEdit }) {
  const attentionItems = getInventoryAttentionItems(items);

  if (!attentionItems.length) return null;

  return (
    <section className="inventory-attention-panel" aria-label="Inventory yang perlu perhatian">
      <header>
        <span><Wrench size={15} /></span>
        <div>
          <small>Perlu Perhatian</small>
          <strong>{attentionItems.length} item butuh dicek</strong>
        </div>
      </header>

      <div className="inventory-attention-list">
        {attentionItems.slice(0, 4).map((item) => {
          const isLowStock = item.effectiveStatus === 'low_stock';

          return (
            <article className={'inventory-attention-row is-' + item.effectiveStatus} key={item.id}>
              <div>
                <strong>{item.name}</strong>
                <span>
                  {getStatusLabel(item.effectiveStatus)} • {item.quantity} {item.unit}
                  {Number(item.minStock) > 0 ? ' / min ' + item.minStock + ' ' + item.unit : ''}
                </span>
              </div>

              <button
                type="button"
                onClick={() => {
                  if (isLowStock) {
                    onAdjustStock(item, 'in');
                    return;
                  }

                  onEdit(item);
                }}
              >
                {isLowStock ? (
                  <>
                    <Plus size={13} />
                    Restock
                  </>
                ) : (
                  <>
                    <Pencil size={13} />
                    Edit
                  </>
                )}
              </button>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function InventoryMovementPanel({ movements }) {
  if (!movements.length) return null;

  return (
    <section className="inventory-movement-panel" aria-label="Aktivitas inventory terbaru">
      <header>
        <span><History size={15} /></span>
        <div>
          <small>Aktivitas Terbaru</small>
          <strong>Movement Log</strong>
        </div>
      </header>

      <div className="inventory-movement-list">
        {movements.slice(0, 6).map((movement) => (
          <article className={'inventory-movement-row is-' + movement.type} key={movement.id}>
            <div>
              <strong>{movement.itemName}</strong>
              <span>{getMovementTypeLabel(movement.type)} • {formatMovementDate(movement.createdAt)}</span>
              {movement.note ? <em>{movement.note}</em> : null}
            </div>

            <b>
              {movement.type === 'out' ? '-' : '+'}
              {movement.quantity} {movement.unit}
            </b>
          </article>
        ))}
      </div>
    </section>
  );
}

function InventoryToolbar({
  categoryFilter,
  exportDisabled,
  onAddItem,
  onCategoryChange,
  onExportItems,
  onSearchChange,
  onStatusChange,
  searchText,
  statusFilter,
}) {
  return (
    <section className="inventory-toolbar" aria-label="Inventory toolbar">
      <div className="inventory-search-shell">
        <Search size={16} aria-hidden="true" />
        <input
          aria-label="Cari inventory"
          placeholder="Cari item, lokasi, catatan..."
          type="search"
          value={searchText}
          onChange={(event) => onSearchChange(event.target.value)}
        />
      </div>

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

      <button
        className="inventory-export-button"
        disabled={exportDisabled}
        type="button"
        onClick={onExportItems}
      >
        <Download size={16} />
        Export
      </button>

      <button className="inventory-add-button" type="button" onClick={onAddItem}>
        <Plus size={16} />
        Tambah
      </button>
    </section>
  );
}

function InventoryList({ items, onArchive, onAdjustStock, onEdit }) {
  if (!items.length) {
    return (
      <section className="inventory-empty-state">
        <PackageOpen size={24} />
        <strong>Inventory masih kosong</strong>
        <span>Tambahkan alat studio, kabel, aksesoris, atau barang habis pakai.</span>
      </section>
    );
  }

  return (
    <section className="inventory-list" aria-label="Daftar inventory">
      {items.map((item) => {
        const status = getEffectiveStatus(item);

        return (
          <article className={'inventory-item-card is-' + status} key={item.id}>
            <div className="inventory-item-main">
              <div>
                <small>{getOptionLabel(formCategoryOptions, item.category, 'Kategori')}</small>
                <strong>{item.name}</strong>
                <span>{item.location || 'Lokasi belum diisi'}</span>
              </div>

              <b>{getStatusLabel(status)}</b>
            </div>

            <div className="inventory-item-meta">
              <span><small>Qty</small><strong>{item.quantity} {item.unit}</strong></span>
              <span><small>Minimal</small><strong>{item.minStock} {item.unit}</strong></span>
              <span><small>Kondisi</small><strong>{getOptionLabel(conditionOptions, item.condition, 'Baik')}</strong></span>
            </div>

            {item.note ? <p className="inventory-item-note">{item.note}</p> : null}

            <div className="inventory-item-actions">
              <button className="inventory-stock-button is-in" type="button" onClick={() => onAdjustStock(item, 'in')}>
                <Plus size={14} />
                <span>Masuk</span>
              </button>

              <button className="inventory-stock-button is-out" type="button" onClick={() => onAdjustStock(item, 'out')}>
                <Minus size={14} />
                <span>Keluar</span>
              </button>

              <button type="button" onClick={() => onEdit(item)}>
                <Pencil size={14} />
                Edit
              </button>

              {item.status !== 'inactive' ? (
                <button type="button" onClick={() => onArchive(item)}>
                  <Archive size={14} />
                  Off
                </button>
              ) : null}
            </div>
          </article>
        );
      })}
    </section>
  );
}

function StockAdjustmentModal({ item, mode, onClose, onSubmit }) {
  const [quantity, setQuantity] = useState('1');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  const isStockIn = mode === 'in';
  const title = isStockIn ? 'Tambah Stok' : 'Kurangi Stok';
  const currentQuantity = Number(item?.quantity || 0);

  function handleSubmit(event) {
    event.preventDefault();

    const amount = toNumber(quantity);

    if (!amount) {
      setError('Jumlah adjustment wajib lebih dari 0.');
      return;
    }

    if (!isStockIn && amount > currentQuantity) {
      setError('Stok keluar tidak boleh lebih besar dari stok saat ini.');
      return;
    }

    onSubmit(item, {
      amount,
      mode,
      note: cleanText(note),
    });
  }

  return (
    <div className="inventory-modal-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section className="inventory-modal-panel inventory-adjustment-panel" role="dialog" aria-modal="true" aria-labelledby="inventory-adjustment-title">
        <header className="inventory-modal-head">
          <div>
            <p>{title}</p>
            <h2 id="inventory-adjustment-title">{item?.name || 'Inventory'}</h2>
          </div>

          <button type="button" aria-label="Tutup adjustment stok" onClick={onClose}>
            <X size={18} />
          </button>
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
            <span>Catatan</span>
            <textarea
              placeholder={isStockIn ? 'Contoh: beli baru, restock kabel...' : 'Contoh: dipakai, rusak, hilang...'}
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          </label>

          {error ? <p className="inventory-form-error" role="alert">{error}</p> : null}

          <footer>
            <button type="button" onClick={onClose}>Batal</button>
            <button className="is-primary" type="submit">{title}</button>
          </footer>
        </form>
      </section>
    </div>
  );
}

function InventoryFormModal({ item, onClose, onSave }) {
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
      quantity: toNumber(form.quantity),
      minStock: toNumber(form.minStock),
    });
  }

  return (
    <div className="inventory-modal-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section className="inventory-modal-panel" role="dialog" aria-modal="true" aria-labelledby="inventory-form-title">
        <header className="inventory-modal-head">
          <div>
            <p>{form.id ? 'Edit Item' : 'Tambah Item'}</p>
            <h2 id="inventory-form-title">Inventory</h2>
          </div>

          <button type="button" aria-label="Tutup inventory form" onClick={onClose}>
            <X size={18} />
          </button>
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
              <span>Jumlah</span>
              <input inputMode="numeric" type="number" min="0" value={form.quantity} onChange={updateField('quantity')} />
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
            <button type="button" onClick={onClose}>Batal</button>
            <button className="is-primary" type="submit">Simpan</button>
          </footer>
        </form>
      </section>
    </div>
  );
}

export default function InventoryPage() {
  const [items, setItems] = useState([]);
  const [movements, setMovements] = useState([]);
  const [searchText, setSearchText] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [editingItem, setEditingItem] = useState(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [stockAdjustment, setStockAdjustment] = useState(null);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    const unsubscribe = inventoryRepository.subscribeInventoryItems(
      (data) => setItems(data),
      (error) => {
        console.error('Gagal memuat inventory:', error);
        setToast({
          title: 'Inventory belum tersinkron',
          message: 'Data inventory belum bisa dimuat dari Firestore.',
        });
      }
    );

    return unsubscribe;
  }, []);

  useEffect(() => {
    const unsubscribe = inventoryRepository.subscribeInventoryMovements(
      (data) => setMovements(data),
      (error) => {
        console.error('Gagal memuat movement inventory:', error);
      },
      8
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
    setStockAdjustment({
      item,
      mode,
    });
  }

  async function saveItem(nextItem) {
    try {
      const isEditing = Boolean(nextItem.id);
      const savedItem = isEditing
        ? await inventoryRepository.updateInventoryItem(nextItem)
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
    try {
      const currentQuantity = Number(item.quantity || 0);
      const amount = Number(adjustment.amount || 0);
      const nextQuantity = adjustment.mode === 'in'
        ? currentQuantity + amount
        : Math.max(0, currentQuantity - amount);
      const actionLabel = adjustment.mode === 'in' ? 'Tambah stok' : 'Kurangi stok';
      const adjustmentNote = adjustment.note
        ? '[' + actionLabel + ' ' + amount + ' ' + item.unit + '] ' + adjustment.note
        : '[' + actionLabel + ' ' + amount + ' ' + item.unit + ']';
      const nextNote = cleanText(item.note)
        ? cleanText(item.note) + '\n' + adjustmentNote
        : adjustmentNote;

      await inventoryRepository.updateInventoryItem({
        ...item,
        quantity: nextQuantity,
        note: nextNote,
        lastMovementAt: new Date().toISOString(),
        lastMovementType: adjustment.mode,
      });

      await inventoryRepository.createInventoryMovement({
        itemId: item.id,
        itemName: item.name,
        type: adjustment.mode,
        quantity: amount,
        previousQuantity: currentQuantity,
        nextQuantity,
        unit: item.unit,
        note: adjustment.note,
      });

      setStockAdjustment(null);
      setToast({
        title: 'Stok diperbarui',
        message: item.name + ' sekarang ' + nextQuantity + ' ' + item.unit + '.',
      });
    } catch (error) {
      console.error('Gagal update stok inventory:', error);
      setToast({
        title: 'Gagal update stok',
        message: 'Perubahan stok belum berhasil disimpan ke Firestore.',
      });
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
    <section className="inventory-page" aria-labelledby="inventory-title">
      <div className="inventory-title-block">
        <p>Inventory</p>
        <h2 id="inventory-title">Studio Inventory</h2>
        <span>Catat alat, stok habis pakai, kondisi barang, dan kebutuhan maintenance.</span>
      </div>

      <InventorySummary items={items} />

      <InventoryToolbar
        categoryFilter={categoryFilter}
        exportDisabled={!filteredItems.length}
        searchText={searchText}
        statusFilter={statusFilter}
        onAddItem={openAddForm}
        onCategoryChange={setCategoryFilter}
        onExportItems={exportInventoryCsv}
        onSearchChange={setSearchText}
        onStatusChange={setStatusFilter}
      />

      <InventoryAttentionPanel
        items={items}
        onAdjustStock={openStockAdjustment}
        onEdit={openEditForm}
      />

      <InventoryMovementPanel movements={movements} />

      <InventoryList
        items={filteredItems}
        onArchive={archiveItem}
        onAdjustStock={openStockAdjustment}
        onEdit={openEditForm}
      />

      {stockAdjustment ? (
        <StockAdjustmentModal
          key={stockAdjustment.item?.id + '-' + stockAdjustment.mode}
          item={stockAdjustment.item}
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
