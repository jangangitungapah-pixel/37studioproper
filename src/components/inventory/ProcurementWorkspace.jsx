import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Building2,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  LoaderCircle,
  PackageCheck,
  Plus,
  RefreshCw,
  ShoppingCart,
  Truck,
  Wallet,
  X,
} from 'lucide-react';
import {
  createCanonicalPurchaseOrder,
  createCanonicalSupplier,
  receiveCanonicalPurchaseOrder,
  recordCanonicalProcurementPayment,
  transitionCanonicalPurchaseOrder,
} from '../../services/adminOperationsRepository.js';
import {
  subscribeGoodsReceipts,
  subscribeProcurementPayments,
  subscribePurchaseOrders,
  subscribeSuppliers,
} from '../../services/inventoryRepository.js';

const STATUS_META = Object.freeze({
  draft: { label: 'Draft', tone: 'draft' },
  submitted: { label: 'Menunggu approval', tone: 'submitted' },
  approved: { label: 'Disetujui', tone: 'approved' },
  ordered: { label: 'Dipesan', tone: 'ordered' },
  partially_received: { label: 'Diterima sebagian', tone: 'partial' },
  received: { label: 'Diterima lengkap', tone: 'received' },
  cancelled: { label: 'Dibatalkan', tone: 'cancelled' },
});

function localDateValue() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return year + '-' + month + '-' + day;
}

function formatRupiah(value) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(Math.max(0, Number(value) || 0));
}

function formatDate(value) {
  if (!value) return '-';
  const date = new Date(String(value).slice(0, 10) + 'T00:00:00');
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

function remainingAmount(order) {
  return Math.max(0, Number(order?.totalAmount || 0) - Number(order?.paidAmount || 0));
}

function orderItemSummary(order) {
  const items = Array.isArray(order?.items) ? order.items : [];
  if (!items.length) return 'Tidak ada item';
  if (items.length === 1) return items[0].name + ' · ' + items[0].quantity + ' ' + items[0].unit;
  return items[0].name + ' + ' + (items.length - 1) + ' item lainnya';
}

function Field({ children, hint, label, name }) {
  return (
    <label className="procurement-field" htmlFor={name}>
      <span>{label}</span>
      {children}
      {hint ? <small>{hint}</small> : null}
    </label>
  );
}

function StatusPill({ status }) {
  const meta = STATUS_META[status] || { label: status || 'Unknown', tone: 'draft' };
  return <span className={'procurement-status is-' + meta.tone}>{meta.label}</span>;
}

function EmptyState({ description, title }) {
  return (
    <div className="procurement-empty-state">
      <span><ClipboardList size={19} aria-hidden="true" /></span>
      <strong>{title}</strong>
      <small>{description}</small>
    </div>
  );
}

export default function ProcurementWorkspace({ currentUser, inventoryItems = [] }) {
  const [suppliers, setSuppliers] = useState([]);
  const [orders, setOrders] = useState([]);
  const [receipts, setReceipts] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loadState, setLoadState] = useState({
    suppliers: 'loading',
    orders: 'loading',
    receipts: 'loading',
    payments: 'idle',
    error: '',
  });
  const [retryKey, setRetryKey] = useState(0);
  const [message, setMessage] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSupplierForm, setShowSupplierForm] = useState(false);
  const [showOrderForm, setShowOrderForm] = useState(false);
  const [supplierDraft, setSupplierDraft] = useState({
    name: '',
    contactName: '',
    phone: '',
    email: '',
    address: '',
    notes: '',
  });
  const [orderDraft, setOrderDraft] = useState({
    supplierId: '',
    expectedAt: '',
    notes: '',
    items: [{ inventoryItemId: '', quantity: '1', unitPrice: '' }],
  });
  const [receiptOrderId, setReceiptOrderId] = useState('');
  const [receiptQuantities, setReceiptQuantities] = useState({});
  const [receiptNote, setReceiptNote] = useState('');
  const [paymentOrderId, setPaymentOrderId] = useState('');
  const [paymentDraft, setPaymentDraft] = useState({
    amount: '',
    paymentMethod: 'transfer',
    date: localDateValue(),
    reference: '',
    note: '',
  });
  const [cancelOrderId, setCancelOrderId] = useState('');
  const [cancelReason, setCancelReason] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const canRecordPayments = currentUser?.role === 'owner' ||
    currentUser?.isOwner === true ||
    currentUser?.permissions?.bookkeeping === true;

  useEffect(() => {
    const subscriptions = [
      subscribeSuppliers(
        (rows) => {
          setSuppliers(rows);
          setLoadState((current) => ({ ...current, suppliers: 'ready' }));
        },
        (error) => {
          setLoadState((current) => ({
            ...current,
            suppliers: 'error',
            error: error?.message || 'Daftar supplier belum bisa dimuat.',
          }));
        },
      ),
      subscribePurchaseOrders(
        (rows) => {
          setOrders(rows);
          setLoadState((current) => ({ ...current, orders: 'ready' }));
        },
        (error) => {
          setLoadState((current) => ({
            ...current,
            orders: 'error',
            error: error?.message || 'Purchase Order belum bisa dimuat.',
          }));
        },
      ),
      subscribeGoodsReceipts(
        (rows) => {
          setReceipts(rows);
          setLoadState((current) => ({ ...current, receipts: 'ready' }));
        },
        (error) => {
          setLoadState((current) => ({
            ...current,
            receipts: 'error',
            error: error?.message || 'Riwayat penerimaan belum bisa dimuat.',
          }));
        },
      ),
    ];

    if (canRecordPayments) {
      subscriptions.push(subscribeProcurementPayments(
        (rows) => {
          setPayments(rows);
          setLoadState((current) => ({ ...current, payments: 'ready' }));
        },
        (error) => {
          setLoadState((current) => ({
            ...current,
            payments: 'error',
            error: error?.message || 'Riwayat pembayaran supplier belum bisa dimuat.',
          }));
        },
      ));
    }

    return () => subscriptions.forEach((unsubscribe) => unsubscribe?.());
  }, [retryKey, canRecordPayments]);

  const activeInventoryItems = useMemo(
    () => inventoryItems.filter((item) => item.status !== 'inactive'),
    [inventoryItems],
  );
  const activeOrders = useMemo(
    () => orders.filter((order) => !['received', 'cancelled'].includes(order.status)),
    [orders],
  );
  const visibleOrders = useMemo(
    () => statusFilter === 'all'
      ? orders
      : orders.filter((order) => order.status === statusFilter),
    [orders, statusFilter],
  );
  const pendingApprovalCount = orders.filter((order) => order.status === 'submitted').length;
  const inTransitCount = orders.filter((order) => ['ordered', 'partially_received'].includes(order.status)).length;
  const outstandingTotal = orders.reduce((sum, order) => sum + remainingAmount(order), 0);
  const supplierLoading = loadState.suppliers === 'loading';
  const orderLoading = loadState.orders === 'loading';
  const receiptLoading = loadState.receipts === 'loading';
  const paymentLoading = canRecordPayments && ['idle', 'loading'].includes(loadState.payments);
  const isLoading = supplierLoading || orderLoading || receiptLoading || paymentLoading;
  const receiptOrder = orders.find((order) => order.id === receiptOrderId) || null;
  const paymentOrder = orders.find((order) => order.id === paymentOrderId) || null;

  function retrySubscriptions() {
    setLoadState({
      suppliers: 'loading',
      orders: 'loading',
      receipts: 'loading',
      payments: canRecordPayments ? 'loading' : 'idle',
      error: '',
    });
    setRetryKey((value) => value + 1);
  }

  function showFeedback(tone, title, detail) {
    setMessage({ tone, title, detail });
  }

  function updateSupplierField(field, value) {
    setSupplierDraft((current) => ({ ...current, [field]: value }));
  }

  function updateOrderField(field, value) {
    setOrderDraft((current) => ({ ...current, [field]: value }));
  }

  function updateOrderLine(index, field, value) {
    setOrderDraft((current) => ({
      ...current,
      items: current.items.map((item, itemIndex) => itemIndex === index
        ? { ...item, [field]: value }
        : item),
    }));
  }

  function addOrderLine() {
    setOrderDraft((current) => ({
      ...current,
      items: [...current.items, { inventoryItemId: '', quantity: '1', unitPrice: '' }],
    }));
  }

  function removeOrderLine(index) {
    setOrderDraft((current) => ({
      ...current,
      items: current.items.length > 1
        ? current.items.filter((item, itemIndex) => itemIndex !== index)
        : current.items,
    }));
  }

  async function submitSupplier(event) {
    event.preventDefault();
    if (isSubmitting) return;
    if (supplierDraft.name.trim().length < 2) {
      showFeedback('error', 'Nama supplier belum valid', 'Isi nama supplier minimal 2 karakter.');
      return;
    }
    setIsSubmitting(true);
    try {
      await createCanonicalSupplier(supplierDraft);
      setSupplierDraft({ name: '', contactName: '', phone: '', email: '', address: '', notes: '' });
      setShowSupplierForm(false);
      showFeedback('success', 'Supplier tersimpan', 'Supplier baru sudah masuk ke direktori.');
    } catch (error) {
      showFeedback('error', 'Supplier gagal disimpan', error?.message || 'Periksa data lalu coba lagi.');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function submitPurchaseOrder(event) {
    event.preventDefault();
    if (isSubmitting) return;
    const validLines = orderDraft.items.filter((item) =>
      item.inventoryItemId &&
      Number(item.quantity) > 0 &&
      Number(item.unitPrice) > 0,
    );
    if (!orderDraft.supplierId || validLines.length !== orderDraft.items.length || !validLines.length) {
      showFeedback('error', 'Detail PO belum lengkap', 'Pilih supplier, item inventory, jumlah, dan harga untuk setiap baris.');
      return;
    }
    const itemIds = validLines.map((item) => item.inventoryItemId);
    if (new Set(itemIds).size !== itemIds.length) {
      showFeedback('error', 'Item duplikat', 'Satu item inventory hanya boleh muncul satu kali dalam satu PO.');
      return;
    }
    setIsSubmitting(true);
    try {
      await createCanonicalPurchaseOrder({
        supplierId: orderDraft.supplierId,
        orderDate: localDateValue(),
        expectedAt: orderDraft.expectedAt,
        notes: orderDraft.notes,
        items: validLines.map((item) => ({
          inventoryItemId: item.inventoryItemId,
          quantity: Number(item.quantity),
          unitPrice: Number(item.unitPrice),
        })),
      });
      setOrderDraft({
        supplierId: '',
        expectedAt: '',
        notes: '',
        items: [{ inventoryItemId: '', quantity: '1', unitPrice: '' }],
      });
      setShowOrderForm(false);
      showFeedback('success', 'Purchase Order dibuat', 'PO tersimpan sebagai Draft. Stok belum berubah sampai barang diterima.');
    } catch (error) {
      showFeedback('error', 'Purchase Order gagal dibuat', error?.message || 'Periksa supplier dan item yang dipilih.');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function changeOrderStatus(order, status, reason = '') {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      await transitionCanonicalPurchaseOrder({
        purchaseOrderId: order.id,
        status,
        expectedUpdatedAt: order.updatedAt,
        reason,
      });
      setCancelOrderId('');
      setCancelReason('');
      showFeedback('success', 'Status PO diperbarui', order.poNumber + ' sekarang berstatus ' + (STATUS_META[status]?.label || status) + '.');
    } catch (error) {
      showFeedback('error', 'Status PO tidak berubah', error?.message || 'Muat ulang data dan coba lagi.');
    } finally {
      setIsSubmitting(false);
    }
  }

  function openReceipt(order) {
    const initial = Object.fromEntries((order.items || []).map((item) => [
      item.lineId,
      String(Math.max(0, Number(item.quantity || 0) - Number(item.receivedQuantity || 0))),
    ]));
    setReceiptQuantities(initial);
    setReceiptNote('');
    setReceiptOrderId(order.id);
    setPaymentOrderId('');
    setCancelOrderId('');
  }

  async function submitGoodsReceipt(event) {
    event.preventDefault();
    if (!receiptOrder || isSubmitting) return;
    const lines = (receiptOrder.items || [])
      .map((item) => ({
        lineId: item.lineId,
        quantity: Number(receiptQuantities[item.lineId] || 0),
        remaining: Math.max(0, Number(item.quantity || 0) - Number(item.receivedQuantity || 0)),
      }))
      .filter((item) => item.quantity > 0);
    if (!lines.length || lines.some((item) => item.quantity > item.remaining)) {
      showFeedback('error', 'Jumlah penerimaan tidak valid', 'Isi jumlah yang diterima dan jangan melebihi sisa pesanan.');
      return;
    }
    setIsSubmitting(true);
    try {
      await receiveCanonicalPurchaseOrder({
        purchaseOrderId: receiptOrder.id,
        expectedUpdatedAt: receiptOrder.updatedAt,
        items: lines.map(({ lineId, quantity }) => ({ lineId, quantity })),
        note: receiptNote,
      });
      setReceiptOrderId('');
      setReceiptQuantities({});
      showFeedback('success', 'Goods Receipt tersimpan', 'Stok inventory bertambah sesuai barang yang benar-benar diterima.');
    } catch (error) {
      showFeedback('error', 'Penerimaan belum tersimpan', error?.message || 'Muat ulang PO dan periksa jumlah barang.');
    } finally {
      setIsSubmitting(false);
    }
  }

  function openPayment(order) {
    setPaymentDraft({
      amount: '',
      paymentMethod: 'transfer',
      date: localDateValue(),
      reference: '',
      note: '',
    });
    setPaymentOrderId(order.id);
    setReceiptOrderId('');
    setCancelOrderId('');
  }

  async function submitPayment(event) {
    event.preventDefault();
    if (!paymentOrder || isSubmitting) return;
    const amount = Number(paymentDraft.amount);
    if (!(amount > 0) || amount > remainingAmount(paymentOrder)) {
      showFeedback('error', 'Nominal pembayaran tidak valid', 'Nominal harus lebih dari nol dan tidak boleh melebihi sisa kewajiban PO.');
      return;
    }
    setIsSubmitting(true);
    try {
      await recordCanonicalProcurementPayment({
        purchaseOrderId: paymentOrder.id,
        expectedUpdatedAt: paymentOrder.updatedAt,
        amount,
        paymentMethod: paymentDraft.paymentMethod,
        date: paymentDraft.date,
        reference: paymentDraft.reference,
        note: paymentDraft.note,
      });
      setPaymentOrderId('');
      showFeedback('success', 'Pembayaran dicatat', 'Pembayaran parsial masuk ke PO dan ledger pengeluaran.');
    } catch (error) {
      showFeedback('error', 'Pembayaran gagal dicatat', error?.message || 'Periksa izin Pembukuan dan sisa tagihan PO.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="procurement-workspace" aria-label="Procurement Management">
      <header className="procurement-header">
        <div>
          <span className="procurement-eyebrow">Inventory · Supply operations</span>
          <h2>Procurement Management</h2>
          <p>Kelola supplier, pesanan pembelian, penerimaan barang, dan pembayaran dalam satu alur yang terlacak.</p>
        </div>
        <div className="procurement-header-actions">
          <button className="procurement-button is-secondary" type="button" onClick={retrySubscriptions}>
            <RefreshCw size={14} aria-hidden="true" /> Refresh
          </button>
          <button className="procurement-button" type="button" onClick={() => { setShowSupplierForm((value) => !value); setShowOrderForm(false); }}>
            <Building2 size={14} aria-hidden="true" /> Supplier
          </button>
          <button className="procurement-button is-primary" type="button" disabled={!suppliers.length} onClick={() => { setShowOrderForm((value) => !value); setShowSupplierForm(false); }}>
            <Plus size={14} aria-hidden="true" /> Buat PO
          </button>
        </div>
      </header>

      <div className="procurement-metrics" aria-label="Ringkasan procurement">
        <article><span><ShoppingCart size={16} /></span><small>Total PO</small><strong>{orders.length}</strong><em>Seluruh pesanan</em></article>
        <article className="is-warning"><span><ClipboardList size={16} /></span><small>Menunggu approval</small><strong>{pendingApprovalCount}</strong><em>Perlu keputusan</em></article>
        <article className="is-info"><span><Truck size={16} /></span><small>Dalam pengiriman</small><strong>{inTransitCount}</strong><em>Menunggu penerimaan</em></article>
        <article className="is-money"><span><Wallet size={16} /></span><small>Sisa kewajiban</small><strong>{formatRupiah(outstandingTotal)}</strong><em>Belum dibayar</em></article>
      </div>

      {message ? (
        <div className={'procurement-feedback is-' + message.tone} role={message.tone === 'error' ? 'alert' : 'status'}>
          {message.tone === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          <span><strong>{message.title}</strong><small>{message.detail}</small></span>
          <button type="button" aria-label="Tutup notifikasi" onClick={() => setMessage(null)}><X size={15} /></button>
        </div>
      ) : null}

      {loadState.error ? (
        <div className="procurement-load-error" role="alert">
          <AlertCircle size={17} />
          <span><strong>Data procurement belum lengkap</strong><small>{loadState.error}</small></span>
          <button className="procurement-button is-secondary" type="button" onClick={retrySubscriptions}>Coba lagi</button>
        </div>
      ) : null}

      {showSupplierForm ? (
        <form className="procurement-form-panel" onSubmit={submitSupplier}>
          <header><div><span>Direktori vendor</span><h3>Tambah supplier</h3></div><button type="button" className="procurement-icon-button" aria-label="Tutup form supplier" onClick={() => setShowSupplierForm(false)}><X size={17} /></button></header>
          <div className="procurement-form-grid">
            <Field label="Nama supplier *" name="supplier-name"><input id="supplier-name" required minLength={2} maxLength={160} value={supplierDraft.name} onChange={(event) => updateSupplierField('name', event.target.value)} placeholder="Nama perusahaan / toko" /></Field>
            <Field label="Nama kontak" name="supplier-contact"><input id="supplier-contact" maxLength={120} value={supplierDraft.contactName} onChange={(event) => updateSupplierField('contactName', event.target.value)} placeholder="PIC supplier" /></Field>
            <Field label="Nomor telepon" name="supplier-phone"><input id="supplier-phone" maxLength={40} value={supplierDraft.phone} onChange={(event) => updateSupplierField('phone', event.target.value)} placeholder="08xx / +62" /></Field>
            <Field label="Email" name="supplier-email"><input id="supplier-email" type="email" maxLength={160} value={supplierDraft.email} onChange={(event) => updateSupplierField('email', event.target.value)} placeholder="kontak@supplier.id" /></Field>
            <Field label="Alamat" name="supplier-address"><input id="supplier-address" maxLength={500} value={supplierDraft.address} onChange={(event) => updateSupplierField('address', event.target.value)} placeholder="Alamat supplier" /></Field>
            <Field label="Catatan" name="supplier-notes"><input id="supplier-notes" maxLength={1000} value={supplierDraft.notes} onChange={(event) => updateSupplierField('notes', event.target.value)} placeholder="Syarat pembayaran, jam operasional..." /></Field>
          </div>
          <footer><button className="procurement-button is-secondary" type="button" disabled={isSubmitting} onClick={() => setShowSupplierForm(false)}>Batal</button><button className="procurement-button is-primary" type="submit" disabled={isSubmitting}>{isSubmitting ? 'Menyimpan...' : 'Simpan supplier'}</button></footer>
        </form>
      ) : null}

      {showOrderForm ? (
        <form className="procurement-form-panel" onSubmit={submitPurchaseOrder}>
          <header><div><span>Purchase order</span><h3>Buat pesanan pembelian</h3><p>PO baru berstatus Draft dan tidak mengubah stok.</p></div><button type="button" className="procurement-icon-button" aria-label="Tutup form PO" onClick={() => setShowOrderForm(false)}><X size={17} /></button></header>
          <div className="procurement-form-grid">
            <Field label="Supplier *" name="po-supplier">
              <select id="po-supplier" required value={orderDraft.supplierId} onChange={(event) => updateOrderField('supplierId', event.target.value)}>
                <option value="">Pilih supplier</option>
                {suppliers.filter((supplier) => supplier.status === 'active').map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
              </select>
            </Field>
            <Field label="Estimasi barang datang" name="po-expected-date"><input id="po-expected-date" type="date" min={localDateValue()} value={orderDraft.expectedAt} onChange={(event) => updateOrderField('expectedAt', event.target.value)} /></Field>
            <Field label="Catatan pesanan" name="po-notes"><input id="po-notes" maxLength={1200} value={orderDraft.notes} onChange={(event) => updateOrderField('notes', event.target.value)} placeholder="Catatan untuk supplier" /></Field>
          </div>
          <div className="procurement-lines-heading"><div><strong>Item pesanan</strong><small>Pilih item dari inventory kanonis.</small></div><button className="procurement-button is-secondary" type="button" onClick={addOrderLine}><Plus size={14} /> Tambah item</button></div>
          <div className="procurement-order-lines">
            {orderDraft.items.map((line, index) => (
              <div className="procurement-order-line" key={'po-line-' + index}>
                <Field label="Item inventory *" name={'po-item-' + index}>
                  <select id={'po-item-' + index} required value={line.inventoryItemId} onChange={(event) => updateOrderLine(index, 'inventoryItemId', event.target.value)}>
                    <option value="">Pilih item</option>
                    {activeInventoryItems.filter((item) => item.id === line.inventoryItemId || !orderDraft.items.some((other, otherIndex) => otherIndex !== index && other.inventoryItemId === item.id)).map((item) => <option key={item.id} value={item.id}>{item.name} · stok {item.quantity} {item.unit}</option>)}
                  </select>
                </Field>
                <Field label="Jumlah *" name={'po-quantity-' + index}><input id={'po-quantity-' + index} required type="number" min="0.001" step="0.001" value={line.quantity} onChange={(event) => updateOrderLine(index, 'quantity', event.target.value)} /></Field>
                <Field label="Harga satuan (Rp) *" name={'po-price-' + index}><input id={'po-price-' + index} required type="number" min="1" step="1" value={line.unitPrice} onChange={(event) => updateOrderLine(index, 'unitPrice', event.target.value)} placeholder="0" /></Field>
                <button className="procurement-icon-button is-danger" type="button" aria-label="Hapus item PO" disabled={orderDraft.items.length === 1} onClick={() => removeOrderLine(index)}><X size={15} /></button>
              </div>
            ))}
          </div>
          <footer><span className="procurement-footnote">Stok baru bertambah setelah Goods Receipt.</span><button className="procurement-button is-secondary" type="button" disabled={isSubmitting} onClick={() => setShowOrderForm(false)}>Batal</button><button className="procurement-button is-primary" type="submit" disabled={isSubmitting || !activeInventoryItems.length}>{isSubmitting ? 'Menyimpan...' : 'Buat Purchase Order'}</button></footer>
          {!activeInventoryItems.length ? <small className="procurement-inline-warning">Tambahkan item aktif di Inventory sebelum membuat PO.</small> : null}
        </form>
      ) : null}

      {receiptOrder ? (
        <form className="procurement-form-panel" onSubmit={submitGoodsReceipt}>
          <header><div><span>Goods receipt · {receiptOrder.poNumber}</span><h3>Catat penerimaan barang</h3><p>Jumlah yang diterima akan ditambahkan ke stok dan dicatat dalam movement log.</p></div><button type="button" className="procurement-icon-button" aria-label="Tutup penerimaan" onClick={() => setReceiptOrderId('')}><X size={17} /></button></header>
          <div className="procurement-receipt-lines">
            {(receiptOrder.items || []).map((item) => {
              const remaining = Math.max(0, Number(item.quantity || 0) - Number(item.receivedQuantity || 0));
              return (
                <div className="procurement-receipt-line" key={item.lineId}>
                  <div><strong>{item.name}</strong><small>Pesanan {item.quantity} {item.unit} · Sudah diterima {item.receivedQuantity || 0} · Sisa {remaining}</small></div>
                  <label><span>Diterima sekarang</span><input aria-label={'Jumlah diterima untuk ' + item.name} type="number" min="0" max={remaining} step="0.001" value={receiptQuantities[item.lineId] || ''} onChange={(event) => setReceiptQuantities((current) => ({ ...current, [item.lineId]: event.target.value }))} /></label>
                </div>
              );
            })}
          </div>
          <Field label="Catatan penerimaan" name="receipt-note"><input id="receipt-note" maxLength={800} value={receiptNote} onChange={(event) => setReceiptNote(event.target.value)} placeholder="Kondisi barang, nomor surat jalan..." /></Field>
          <footer><button className="procurement-button is-secondary" type="button" disabled={isSubmitting} onClick={() => setReceiptOrderId('')}>Batal</button><button className="procurement-button is-primary" type="submit" disabled={isSubmitting}>{isSubmitting ? 'Menyimpan...' : 'Konfirmasi penerimaan'}</button></footer>
        </form>
      ) : null}

      {paymentOrder ? (
        <form className="procurement-form-panel" onSubmit={submitPayment}>
          <header><div><span>Procurement payment · {paymentOrder.poNumber}</span><h3>Catat pembayaran supplier</h3><p>Sisa kewajiban {formatRupiah(remainingAmount(paymentOrder))}. Pembayaran diposting sebagai pengeluaran immutable di Pembukuan.</p></div><button type="button" className="procurement-icon-button" aria-label="Tutup pembayaran" onClick={() => setPaymentOrderId('')}><X size={17} /></button></header>
          <div className="procurement-form-grid">
            <Field label="Nominal pembayaran (Rp) *" name="payment-amount"><input id="payment-amount" required type="number" min="1" max={remainingAmount(paymentOrder)} step="1" value={paymentDraft.amount} onChange={(event) => setPaymentDraft((current) => ({ ...current, amount: event.target.value }))} /></Field>
            <Field label="Metode pembayaran" name="payment-method"><select id="payment-method" value={paymentDraft.paymentMethod} onChange={(event) => setPaymentDraft((current) => ({ ...current, paymentMethod: event.target.value }))}><option value="transfer">Transfer</option><option value="cash">Cash</option><option value="qris">QRIS</option></select></Field>
            <Field label="Tanggal pembayaran" name="payment-date"><input id="payment-date" type="date" required value={paymentDraft.date} onChange={(event) => setPaymentDraft((current) => ({ ...current, date: event.target.value }))} /></Field>
            <Field label="Referensi transaksi" name="payment-reference"><input id="payment-reference" maxLength={120} value={paymentDraft.reference} onChange={(event) => setPaymentDraft((current) => ({ ...current, reference: event.target.value }))} placeholder="Nomor transfer / bukti" /></Field>
            <Field label="Catatan" name="payment-note"><input id="payment-note" maxLength={800} value={paymentDraft.note} onChange={(event) => setPaymentDraft((current) => ({ ...current, note: event.target.value }))} placeholder="DP, termin kedua..." /></Field>
          </div>
          <footer><button className="procurement-button is-secondary" type="button" disabled={isSubmitting} onClick={() => setPaymentOrderId('')}>Batal</button><button className="procurement-button is-primary" type="submit" disabled={isSubmitting}>{isSubmitting ? 'Menyimpan...' : 'Simpan pembayaran'}</button></footer>
        </form>
      ) : null}

      {cancelOrderId ? (
        <form className="procurement-cancel-panel" onSubmit={(event) => { event.preventDefault(); const target = orders.find((order) => order.id === cancelOrderId); if (target) changeOrderStatus(target, 'cancelled', cancelReason); }}>
          <div><strong>Batalkan Purchase Order</strong><small>PO hanya dapat dibatalkan sebelum ada pembayaran atau penerimaan barang.</small></div>
          <input aria-label="Alasan pembatalan PO" required minLength={4} maxLength={600} value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} placeholder="Alasan pembatalan minimal 4 karakter" />
          <button className="procurement-button is-danger" type="submit" disabled={isSubmitting}>Konfirmasi batal</button>
          <button className="procurement-icon-button" type="button" aria-label="Tutup pembatalan" onClick={() => { setCancelOrderId(''); setCancelReason(''); }}><X size={15} /></button>
        </form>
      ) : null}

      <div className="procurement-content-grid">
        <section className="procurement-main-panel">
          <header className="procurement-section-header">
            <div><span>Order pipeline</span><h3>Purchase Orders</h3><small>{visibleOrders.length} pesanan ditampilkan</small></div>
            <select aria-label="Filter status Purchase Order" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="all">Semua status</option>
              {Object.entries(STATUS_META).map(([status, meta]) => <option key={status} value={status}>{meta.label}</option>)}
            </select>
          </header>
          {orderLoading ? (
            <div className="procurement-loading"><LoaderCircle size={18} className="auth-spin" /> Memuat Purchase Order...</div>
          ) : visibleOrders.length ? (
            <div className="procurement-order-list">
              {visibleOrders.map((order) => {
                const dueAmount = remainingAmount(order);
                return (
                  <article className="procurement-po-card" key={order.id}>
                    <div className="procurement-po-topline"><div><span className="procurement-po-number">{order.poNumber}</span><StatusPill status={order.status} /></div><small>{formatDate(order.orderDate)}</small></div>
                    <h4>{order.supplierName || 'Supplier tidak diketahui'}</h4>
                    <p>{orderItemSummary(order)}</p>
                    <div className="procurement-po-finance">
                      <div><small>Total PO</small><strong>{formatRupiah(order.totalAmount)}</strong></div>
                      <div><small>Terbayar</small><strong>{formatRupiah(order.paidAmount)}</strong></div>
                      <div><small>Sisa</small><strong className={dueAmount > 0 ? 'is-outstanding' : ''}>{formatRupiah(dueAmount)}</strong></div>
                    </div>
                    <div className="procurement-po-meta">
                      <span><CalendarDays size={12} /> Estimasi {formatDate(order.expectedAt)}</span>
                      <span><PackageCheck size={12} /> {(order.items || []).reduce((sum, item) => sum + Number(item.receivedQuantity || 0), 0)} / {(order.items || []).reduce((sum, item) => sum + Number(item.quantity || 0), 0)} unit diterima</span>
                    </div>
                    <div className="procurement-po-actions">
                      {order.status === 'draft' ? <button type="button" className="procurement-button is-secondary" disabled={isSubmitting} onClick={() => changeOrderStatus(order, 'submitted')}>Ajukan approval</button> : null}
                      {order.status === 'submitted' ? <button type="button" className="procurement-button is-primary" disabled={isSubmitting} onClick={() => changeOrderStatus(order, 'approved')}>Approve PO</button> : null}
                      {order.status === 'approved' ? <button type="button" className="procurement-button is-primary" disabled={isSubmitting} onClick={() => changeOrderStatus(order, 'ordered')}>Tandai dipesan</button> : null}
                      {['ordered', 'partially_received'].includes(order.status) ? <button type="button" className="procurement-button is-primary" disabled={isSubmitting} onClick={() => openReceipt(order)}><PackageCheck size={13} /> Goods Receipt</button> : null}
                      {canRecordPayments && !['draft', 'cancelled'].includes(order.status) && dueAmount > 0 ? <button type="button" className="procurement-button is-secondary" disabled={isSubmitting} onClick={() => openPayment(order)}><Wallet size={13} /> Pembayaran</button> : null}
                      {['draft', 'submitted', 'approved'].includes(order.status) ? <button type="button" className="procurement-button is-danger" disabled={isSubmitting} onClick={() => { setCancelOrderId(order.id); setCancelReason(''); setReceiptOrderId(''); setPaymentOrderId(''); }}>Batalkan</button> : null}
                      {order.status === 'received' ? <span className="procurement-complete-label"><CheckCircle2 size={13} /> Penerimaan lengkap</span> : null}
                    </div>
                    {!canRecordPayments && !['draft', 'cancelled'].includes(order.status) && dueAmount > 0 ? <small className="procurement-permission-note">Pencatatan pembayaran memerlukan izin Pembukuan.</small> : null}
                  </article>
                );
              })}
            </div>
          ) : (
            <EmptyState title="Belum ada Purchase Order" description="Buat PO pertama setelah supplier dan item inventory siap." />
          )}
        </section>

        <aside className="procurement-side-column">
          <section className="procurement-side-panel">
            <header className="procurement-section-header"><div><span>Vendor directory</span><h3>Supplier</h3><small>{suppliers.length} supplier</small></div></header>
            {supplierLoading ? <div className="procurement-loading"><LoaderCircle size={16} className="auth-spin" /> Memuat supplier...</div> : suppliers.length ? (
              <div className="procurement-supplier-list">
                {suppliers.slice(0, 8).map((supplier) => (
                  <article key={supplier.id}><span><Building2 size={15} /></span><div><strong>{supplier.name}</strong><small>{supplier.contactName || supplier.phone || supplier.email || 'Kontak belum diisi'}</small></div><i className={supplier.status === 'active' ? 'is-active' : ''}>{supplier.status === 'active' ? 'Aktif' : 'Nonaktif'}</i></article>
                ))}
                {suppliers.length > 8 ? <small className="procurement-list-footnote">Menampilkan 8 dari {suppliers.length} supplier.</small> : null}
              </div>
            ) : <EmptyState title="Supplier belum ada" description="Tambahkan supplier untuk membuat Purchase Order." />}
          </section>

          <section className="procurement-side-panel">
            <header className="procurement-section-header"><div><span>Goods receipt log</span><h3>Penerimaan terbaru</h3><small>{receipts.length} receipt tersimpan</small></div></header>
            {receiptLoading ? <div className="procurement-loading"><LoaderCircle size={16} className="auth-spin" /> Memuat penerimaan...</div> : receipts.length ? (
              <div className="procurement-receipt-list">
                {receipts.slice(0, 6).map((receipt) => (
                  <article key={receipt.id}><span><PackageCheck size={15} /></span><div><strong>{receipt.poNumber}</strong><small>{receipt.supplierName} · {formatDate(receipt.receivedAt)}</small><em>{(receipt.items || []).length} baris diterima</em></div></article>
                ))}
              </div>
            ) : <EmptyState title="Belum ada penerimaan" description="Goods Receipt akan muncul di sini setelah barang diterima." />}
          </section>

          {canRecordPayments ? (
            <section className="procurement-side-panel">
              <header className="procurement-section-header"><div><span>Payment ledger</span><h3>Pembayaran terbaru</h3><small>{payments.length} pembayaran tersinkron</small></div></header>
              {paymentLoading ? (
                <div className="procurement-loading"><LoaderCircle size={16} className="auth-spin" /> Memuat pembayaran...</div>
              ) : loadState.payments === 'error' ? (
                <div className="procurement-inline-warning" role="alert">Riwayat pembayaran belum bisa dimuat.</div>
              ) : payments.length ? (
                <div className="procurement-payment-list">
                  {payments.slice(0, 6).map((payment) => (
                    <article key={payment.id}>
                      <span><Wallet size={15} aria-hidden="true" /></span>
                      <div>
                        <strong>{formatRupiah(payment.amount)}</strong>
                        <small>{payment.poNumber} · {payment.supplierName}</small>
                        <em>{formatDate(payment.date)} · {String(payment.paymentMethod || '').toUpperCase()}</em>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <EmptyState title="Belum ada pembayaran" description="Pembayaran supplier yang dicatat akan muncul di sini." />
              )}
            </section>
          ) : null}
        </aside>
      </div>

      {isLoading ? <div className="procurement-bottom-sync"><LoaderCircle size={13} className="auth-spin" /> Sinkronisasi data procurement aktif</div> : null}
      {!activeOrders.length && !orders.length ? <p className="procurement-footnote">Alur procurement dimulai dari supplier → PO → approval → order → goods receipt → pembayaran.</p> : null}
    </section>
  );
}
