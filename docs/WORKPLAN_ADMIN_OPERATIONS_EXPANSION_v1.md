# Workplan Implementasi — 37Studio Admin Operations Expansion

| Metadata | Nilai |
|---|---|
| Versi | 1.0 |
| Tanggal audit | 5 November 2026 |
| Repository | `jangangitungapah-pixel/37studioproper` |
| Baseline implementasi yang diaudit | `audit/foundation-and-admin-portal-2026-10-20` |
| Commit baseline | `c511da6c96a34d0087e7de27779014f8d268fd34` |
| PR fondasi | [#1 — Draft, belum merge](https://github.com/jangangitungapah-pixel/37studioproper/pull/1) |
| Status dokumen | Workplan, belum mengubah kode aplikasi |
| Aturan governance | **Tidak merge PR dan tidak deploy production tanpa izin eksplisit Owner.** |

---

## 1. Tujuan dan ruang lingkup

Workplan ini menambahkan lima kemampuan operasional yang melengkapi Admin Portal:

1. Session Operations
2. Daily Closing & Reconciliation
3. Equipment Maintenance
4. Customer Follow-up Center
5. Procurement Management

Prinsip implementasi: **perluas workspace yang sudah ada, jangan menambah menu top-level tanpa kebutuhan yang jelas.** Semua aksi yang memengaruhi booking, uang, stok, dan ownership harus melalui server-authoritative operation di Admin Operations Worker, memakai validasi domain, idempotency key, precondition/concurrency check, dan audit event.

### Keputusan information architecture

| Kemampuan | Workspace induk | Permission existing |
|---|---|---|
| Session Operations | Calendar + Booking Detail + Dashboard | `schedule` |
| Daily Closing | Bookkeeping / Finance | `bookkeeping` |
| Equipment Maintenance | Inventory | `inventory` |
| Customer Follow-up Center | Customers | `customers` |
| Procurement Management | Inventory, dengan integrasi Bookkeeping | `inventory` + `bookkeeping` untuk pembayaran |

Tidak ada permission key baru pada MVP. Owner tetap mempunyai full access sesuai kontrak yang sudah ada. Penambahan permission terpisah hanya boleh dilakukan setelah kebutuhan operasional dan migrasinya disetujui.

---

## 2. Hasil audit repository

Audit membaca branch fondasi terbaru yang tersedia pada saat penyusunan, bukan hanya default branch `main`.

### 2.1 Baseline Git

- `main` berada di commit `3da18e39c03b9e3fe76b422cb2d65c3215cfeafd`.
- Branch `audit/foundation-and-admin-portal-2026-10-20` berada di `c511da6c96a34d0087e7de27779014f8d268fd34`.
- PR #1 masih **Open + Draft**, target `main`, belum merged.
- Quality Gates run #132 pada commit audit tersebut berstatus success untuk build, lint, regression, Firestore Rules emulator, dan responsive browser smoke. Run ini tidak membuktikan authenticated Admin acceptance atau live staging workflow.
- Karena PR #1 belum merge, seluruh implementasi baru harus memakai baseline audit tersebut sebagai dependency source, bukan diam-diam dibangun dari `main` yang lebih lama.

Referensi:
- [PR #1](https://github.com/jangangitungapah-pixel/37studioproper/pull/1)
- [Quality Gates #132](https://github.com/jangangitungapah-pixel/37studioproper/actions/runs/40904635301)
- [Admin Portal PRD v3.0](https://github.com/jangangitungapah-pixel/37studioproper/blob/main/PRD_37Studio_Admin_Portal_UI_UX_Complete_v3.0.md)

### 2.2 Komponen yang sudah tersedia dan harus dipakai ulang

| Area | Implementasi existing | Implikasi |
|---|---|---|
| Admin shell | `src/pages/AdminPage.jsx`, `src/config/adminNavigation.js`, `src/utils/adminPermissions.js` | Tambahkan sub-workspace/route sesuai permission existing |
| Calendar | `src/pages/admin/SchedulePage.jsx` | Titik utama Session Operations |
| Booking detail | `src/components/booking/BookingDetailDrawer.jsx` | Tempat action dan histori sesi |
| Booking domain | `src/domain/booking/bookingStatus.js`, `bookingSelectors.js`, `normalizeBooking.js` | Perlu memisahkan status pelaksanaan sesi dari status waktu jadwal |
| Booking Worker | `workers/admin-operations-worker/src/domain/bookings.js` | Perlu action lifecycle khusus, bukan generic edit |
| Worker router | `workers/admin-operations-worker/src/index.js` | Tambahkan endpoint operasi baru |
| Client untuk Worker | `src/services/adminOperationsRepository.js` | Tambahkan wrapper operation baru |
| Bookkeeping | `src/pages/admin/BookkeepingPage.jsx`, `src/services/bookkeepingRepository.js` | Pakai ledger existing sebagai sumber rekonsiliasi |
| Inventory | `src/pages/admin/InventoryPage.jsx`, `src/services/inventoryRepository.js` | Perlu work order dan pengadaan; stok harus tetap server-authoritative |
| Inventory Worker | `workers/admin-operations-worker/src/domain/inventory.js` | Saat ini sudah ada atomic stock adjustment, belum ada receipt/procurement |
| Customers | `src/pages/admin/CustomerPage.jsx`, `src/services/adminCustomerRepository.js` | Follow-up saat ini baru berupa kandidat + template WhatsApp |
| Guard attendance | `src/services/guardAttendanceRepository.js`, `src/pages/admin/GuardAttendancePage.jsx` | Pola attendance/review dapat dijadikan referensi, bukan disamakan dengan session pelanggan |
| Security | `firestore.rules`, `scripts/firestore-rules-behavior-test.mjs` | Setiap collection baru perlu rule dan emulator test eksplisit |

### 2.3 Temuan dan risiko yang wajib ditangani

**A. Session status sudah ada, tetapi lifecycle operasional belum ada.**

- Domain mengenal `upcoming`, `in_progress`, `completed`, `no_show`, dan `cancelled`.
- `normalizeBooking.js` dapat menyimpulkan sesi sudah `completed` hanya karena tanggal/jam booking telah lewat jika tidak ada status eksplisit. Waktu yang lewat tidak membuktikan sesi benar-benar terlaksana.
- `sessionStatus` termasuk field yang dapat ikut pada generic manual booking update di Worker, tetapi belum ada state-transition policy khusus untuk check-in, mulai, selesai, dan no-show.
- Booking Detail menampilkan session status, tetapi belum menyediakan command lifecycle sesi yang lengkap.

**Keputusan:** status pelaksanaan harus berasal dari aksi operasional eksplisit. Status waktu jadwal (belum mulai/sedang dalam rentang waktu/sudah lewat) menjadi derived context terpisah. Booking lama yang waktunya lewat tanpa bukti pelaksanaan harus ditandai perlu review, bukan otomatis dianggap selesai.

**B. Inventory mempunyai risiko partial-success pada create/edit/archive.**

- `InventoryPage.jsx` melakukan create/update item terlebih dahulu, lalu memanggil `inventoryRepository.createInventoryMovement()` dari browser.
- `archiveItem()` juga memperbarui item terlebih dahulu lalu mencoba menulis movement dari browser.
- `inventoryRepository.createInventoryMovement()` memakai Firestore client SDK.
- Firestore Rules pada branch audit menolak create/update/delete langsung pada `inventoryMovements`; penulisan stok yang sudah benar justru dilakukan lewat `adjustCanonicalInventory()` dan Worker.

**Dampak:** metadata/item dapat sudah berubah ketika pencatatan movement gagal. UI kemudian menampilkan operasi gagal, padahal write pertama mungkin sudah berhasil.

**Keputusan:** perbaiki jalur create/update/archive inventory sebagai fondasi Phase 0. Item + movement harus satu operasi atomik di Worker, atau UI tidak boleh mengklaim transaksi selesai sebelum kedua write terkonfirmasi sebagai satu operasi.

**C. Daily Closing belum ada dan sumber pembukuan saat ini bukan closing snapshot.**

- Bookkeeping menggabungkan booking finance dengan `bookkeepingEntries`.
- Page saat ini subscribe booking dan entries dengan `limitCount: 150`. Data ini tidak boleh dipakai sebagai satu-satunya sumber perhitungan closing yang harus akurat untuk satu tanggal.
- Belum ditemukan model/flow cash closing, counted cash, variance, review, dan locked close.

**Keputusan:** closing harus memakai query berdasarkan rentang tanggal bisnis dan sumber ledger kanonis, bukan menghitung dari daftar UI yang dibatasi 150 record.

**D. Equipment Maintenance baru berupa atribut kondisi.**

- Inventory sudah memiliki status/condition seperti maintenance, broken, lost, dan low stock, serta movement history.
- Belum ditemukan work order, assignment PIC, jadwal servis, approval, verification, atau lifecycle biaya maintenance.

**E. Customer Follow-up belum menjadi task management.**

- Follow-up Center saat ini menyusun target dari outstanding, follow-up flag, duplicate, atau customer idle.
- Action WhatsApp membuat link dengan template yang sudah ada.
- Belum ditemukan follow-up task dengan due date, assignee, outcome, completion log, dan reminder queue.

**F. Procurement belum tersedia.**

- Audit pencarian source tidak menemukan supplier, purchase order, purchase request, goods receipt, maupun procurement payment model.
- Stock-in saat ini adalah adjustment stok, bukan bukti penerimaan barang dari PO.

**Keputusan:** goods receipt harus menjadi satu-satunya jalur penerimaan barang yang menambah stok untuk transaksi pengadaan. Purchase order yang baru dibuat tidak boleh otomatis menambah inventory.

---

## 3. Prinsip arsitektur lintas fase

1. **Firebase Spark/no-billing tetap menjadi constraint.** Tidak menambahkan Cloud Functions, layanan berbayar, atau dependency billing-incompatible. Semua penambahan harus lolos Spark compatibility gate.
2. **Admin Operations Worker menjadi otoritas mutation.** Browser tidak boleh menulis financial ledger, stock movement, session events, closing events, maintenance cost, maupun procurement receipt secara langsung.
3. **Idempotency wajib.** Retry, double click, refresh, dan network retry tidak boleh membuat payment, expense, stock movement, closing, receipt, atau event ganda.
4. **Precondition wajib.** Gunakan update-time/revision precondition untuk record yang dapat berubah bersamaan. Operasi konflik mengembalikan conflict state dan meminta UI memuat data terbaru.
5. **Event history append-only.** Koreksi terhadap aksi final dilakukan lewat reversal, void, reopen, atau correction event dengan actor dan reason; bukan overwrite histori.
6. **Firestore deny-by-default dipertahankan.** Collection baru mendapat rule read yang scoped sesuai permission. Jangan membuka client write hanya agar UI lebih mudah.
7. **Tanggal bisnis konsisten.** Seluruh tanggal laporan dan closing memakai zona waktu `Asia/Jakarta`, dengan field tanggal bisnis `YYYY-MM-DD`. Timestamp audit disimpan sebagai ISO timestamp.
8. **Tidak ada auto-send WhatsApp.** Tombol WhatsApp hanya membuka draft/link. User harus mengonfirmasi outcome komunikasi secara eksplisit.
9. **Tidak ada auto-no-show.** Status no-show memerlukan keputusan Admin dan reason, bukan disimpulkan dari waktu.
10. **Tidak ada optimistic success untuk mutasi sensitif.** UI hanya menampilkan sukses setelah Worker mengembalikan hasil operasi yang sudah committed.

---

## 4. Phase 0 — Foundation & Data Integrity

Phase ini wajib selesai sebelum lima fitur berjalan di atasnya.

### P0.1 — Kunci kontrak dan schema lintas domain

- Buat data dictionary untuk session, closing, maintenance, follow-up task, supplier, PO, receipt, dan procurement payment.
- Tetapkan source-of-truth setiap nilai, actor, timestamp, status, transition, reason, dan idempotency key.
- Tentukan field yang immutable setelah status final.
- Tentukan query scope dan pagination untuk seluruh queue/ledger.
- Tambahkan index Firestore hanya berdasarkan query yang benar-benar dipakai dan uji emulator.

### P0.2 — Perbaiki Inventory mutation flow

Target:
- Tambah/update/archive inventory melalui Worker.
- Metadata item dan movement/audit event ditulis dalam satu idempotent operation.
- Jangan memanggil client-side `createInventoryMovement()` setelah write item.
- Stock quantity hanya berubah lewat operation server-authoritative.
- Archive/deactivate tidak menghapus movement history.

Suggested files:
- `src/pages/admin/InventoryPage.jsx`
- `src/services/inventoryRepository.js`
- `src/services/adminOperationsRepository.js`
- `workers/admin-operations-worker/src/index.js`
- `workers/admin-operations-worker/src/domain/inventory.js`
- `firestore.rules`
- `scripts/admin-operations-worker-contract-test.mjs`
- test baru untuk atomic inventory metadata + movement.

### P0.3 — Test dan governance baseline

- Tambahkan test baru ke script `npm test` dan `npm run test:prd` sesuai jenis kontraknya.
- Tambahkan worker operation regression untuk idempotency, stale update, unauthorized actor, dan duplicate request.
- Pastikan workflow Quality Gates menjalankan seluruh test baru.
- Tidak ada data produksi yang disentuh selama pengembangan atau staging acceptance.

**Exit gate Phase 0:** tidak ada jalur Inventory UI yang menampilkan sukses/gagal secara ambigu setelah partial write; semua perubahan inventory mempunyai movement/audit yang konsisten.

---

## 5. Phase 1 — Session Operations

**Outcome:** setiap booking dapat dilacak dari kedatangan customer sampai sesi benar-benar selesai.

### P1.1 — Lifecycle dan domain rules

Gunakan state machine berikut:

| Current state | Action | Next state | Persyaratan |
|---|---|---|---|
| Upcoming | Check-in | Upcoming + `checkedInAt` | Booking confirmed, actor, timestamp |
| Upcoming | Start session | In Progress | Actor, `actualStartAt`; check-in atau override dengan reason |
| In Progress | Complete session | Completed | `actualEndAt`, actual duration, completion note opsional |
| Upcoming | Mark no-show | No Show | Jadwal sudah melewati grace window yang ditetapkan, reason wajib |
| Cancelled / No Show / Completed | Normal transition | Ditolak | Terminal state |
| Terminal state | Correction | Tetap melalui correction flow | Owner/authorized review, reason, audit event |

Detail:
- `checkedInAt`, `actualStartAt`, dan `actualEndAt` disimpan eksplisit.
- `sessionStatus` hanya berubah lewat dedicated session operation, bukan generic metadata edit.
- `scheduleTiming` (upcoming/current/elapsed) dipisahkan dari bukti pelaksanaan.
- Booking historis yang tanggalnya lewat tanpa execution event masuk ke queue **Perlu Review**, bukan otomatis Completed.
- Overtime dihitung dari actual end vs planned end. MVP mencatat actual duration/overtime; penagihan tambahan baru boleh dilakukan setelah aturan pricing dan approval ditetapkan.
- No-show dan cancellation tidak boleh mengubah payment/refund ledger secara otomatis.

### P1.2 — Backend dan audit

Suggested operation:
- `POST /v1/bookings/sessions/action` dengan action check-in/start/complete/no-show/correction.
- Implementasi di `workers/admin-operations-worker/src/domain/bookings.js` atau domain session terpisah.
- Tambah wrapper di `src/services/adminOperationsRepository.js`.
- Simpan event di collection `bookingSessionEvents` (append-only).
- Tambahkan actor UID/name, occurredAt, action, before/after, reason, idempotency key.
- Validasi request status, payment context sesuai policy, cancellation/void, dan stale booking revision.
- Update booking + event dalam satu idempotent operation.

### P1.3 — Admin UI

- Calendar block: quick state dan indikator sesi dimulai/berlangsung/terlambat.
- Booking Detail Drawer: tab/section Session dengan check-in, start, complete, no-show, actual time, notes, dan timeline.
- Dashboard: Today Sessions dengan tiga queue: akan dimulai, sedang berlangsung, perlu ditutup.
- All Bookings: filter execution status dan overdue/needs-review.
- Mobile: sticky action di detail sheet; no-show dan correction berada di action menu dengan confirmation.
- Tidak menambah top-level navigation item pada MVP.

### P1.4 — Regression & acceptance

- Semua transition valid/invalid teruji.
- Dua Admin memulai atau menyelesaikan sesi bersamaan: hanya satu operasi commit.
- Booking cancelled/void tidak dapat dimulai.
- Sesi selesai tidak dapat diubah menjadi upcoming lewat generic update.
- Historical booking tidak otomatis berubah menjadi Completed hanya karena tanggal lewat.
- Timestamp dan durasi konsisten pada Calendar, Booking Detail, Dashboard, dan All Bookings.
- 390 px, 768 px, dan 1440 px; tambah 320 px untuk reflow.

**Exit gate Phase 1:** seluruh sesi yang berlangsung memiliki jejak check-in/start/complete/no-show yang dapat diaudit; tidak ada perubahan lifecycle melalui generic booking update.

---

## 6. Phase 2 — Daily Closing & Reconciliation

**Outcome:** Owner dapat menutup transaksi satu tanggal bisnis dengan angka yang dapat ditelusuri ke ledger.

### P2.1 — Definisikan scope closing

MVP:
- Satu closing per tanggal bisnis dan register/till. Register default `main`; desain tetap memungkinkan register tambahan.
- `businessDate` mengikuti `Asia/Jakarta`.
- Kanal minimal: Cash, Transfer, QRIS, Other.
- Cash physical count dipisahkan dari rekonsiliasi saldo digital. Transfer/QRIS tidak dianggap uang tunai.
- Opening float, expected cash, counted cash, variance, dan reason dicatat.
- Data transaksi berasal dari canonical payment/refund/bookkeeping source, bukan dari angka dashboard yang dibatasi 150 record.
- Snapshot menyimpan transaction references/watermark dan waktu cutoff agar transaksi terlambat dapat dikenali.

### P2.2 — Model dan operation

Suggested collections:
- `cashClosingSessions`
- `cashClosingEvents`

Suggested closing state:
- Draft → Submitted/Ready for Review → Closed.
- Closed menjadi read-only.
- Reopen hanya Owner, dengan fresh authorization/reason dan event baru.
- Perubahan setelah cutoff menjadi late-posting exception; jangan diam-diam mengubah closing yang sudah closed.

Suggested fields:
- businessDate, registerId, status.
- openedAt/openedByUid, closedAt/closedByUid.
- openingCash, expectedCash, countedCash, variance.
- totalsByMethod, transactionCount, cutoffAt, sourceWatermark.
- varianceReason, reviewNote, idempotency key.

Expected cash formula harus disepakati dan dites, sekurangnya:
`opening cash + cash income - cash refunds - cash expenses`.
Digital channel total direkonsiliasi terpisah.

Suggested Worker actions:
- Preview closing.
- Open/prepare closing.
- Submit/close.
- Reopen (Owner-only).
- Read closing detail/report.

Semua perhitungan authoritative dilakukan berdasarkan date-range query dan transaksi canonical. Jangan memakai `limitCount: 150` dari Bookkeeping page sebagai basis final.

### P2.3 — Admin UI

- Tambahkan tab **Daily Closing** di Bookkeeping.
- Tampilkan expected by method, cash count, variance, transactions included, cutoff, dan exceptions.
- Input cash count dapat menggunakan denomination breakdown; total dihitung otomatis.
- Variance non-zero mewajibkan reason.
- Detail closing menampilkan transaction references, actor, dan timeline.
- Export closing report mengikuti snapshot yang sudah closed.

### P2.4 — Regression & acceptance

- Total per method sama dengan sumber ledger pada tanggal bisnis yang sama.
- Boundary UTC vs Asia/Jakarta dites di sekitar pergantian hari.
- Booking payment, proof approval, refund, dan manual expense tidak double-count.
- Transaksi setelah cutoff muncul sebagai late posting, bukan mengubah snapshot closed.
- Closing ganda pada register/tanggal yang sama diblokir.
- Reopen menghasilkan audit event dan tidak menghapus histori close sebelumnya.
- Variance tidak dapat disimpan tanpa reason.

**Exit gate Phase 2:** closing harian bisa direproduksi dari transaction references dan cutoff, dengan selisih yang terlihat serta dapat dijelaskan.

---

## 7. Phase 3 — Equipment Maintenance

**Outcome:** kondisi equipment berkembang dari flag menjadi alur pekerjaan yang dapat ditugaskan, dijadwalkan, diselesaikan, dan diaudit.

### P3.1 — Maintenance work order

Suggested collections:
- `maintenanceWorkOrders`
- `maintenanceEvents`

Suggested lifecycle:
- Reported → Triaged → Approved/Assigned → In Progress → Waiting Parts (optional) → Completed → Verified.
- Cancelled hanya dengan reason.
- Work order final tidak dihapus; koreksi menggunakan event/reopen yang diaudit.

Field minimum:
- workOrderId, inventoryItemId, title, description, priority.
- reportedBy, reportedAt, assignedToUid/name.
- plannedAt/dueAt, startedAt, completedAt, verifiedAt.
- diagnosis, repairNotes, vendor, estimatedCost, actualCost.
- attachment references, status, reason, timestamps.

### P3.2 — Inventory dan finance integration

- Membuat work order dapat menandai item sebagai Maintenance/Out of Service.
- Perubahan status equipment harus dilakukan lewat Worker bersama maintenance event.
- Complete belum otomatis berarti equipment dapat digunakan lagi; perlu verification.
- Actual maintenance cost dicatat ke canonical Bookkeeping sebagai expense source `maintenance`, immutable dan linked ke workOrderId.
- Tidak boleh ada pengeluaran ganda ketika work order di-retry.
- Movement/status event tetap tersimpan setelah item diarsipkan.
- Threshold approval biaya belum ditentukan dalam repository; jangan hardcode nominal sampai policy Owner ditetapkan.

### P3.3 — Admin UI

- Tambahkan tab **Maintenance** di Inventory.
- Queue: reported, overdue, in progress, waiting parts, awaiting verification.
- Detail work order: item, fault, PIC, schedule, notes, attachments, cost, status history.
- Dashboard: equipment out of service dan work order overdue.
- Filter dan tindakan tetap mengikuti permission `inventory`; posting biaya mengikuti `bookkeeping` atau Owner.

### P3.4 — Regression & acceptance

- Satu item tidak dapat memiliki dua active work order yang tidak kompatibel tanpa override.
- Item tidak dapat aktif kembali sebelum verification.
- Complete/verify tidak membuat expense ganda.
- Actual cost harus sama dengan expense linked pada Bookkeeping.
- Actor, reason, timestamp, dan attachment reference dapat ditelusuri.
- Worker menolak stale update dan unauthorized transition.

**Exit gate Phase 3:** tiap issue equipment memiliki work order, PIC, status, hasil verifikasi, dan biaya yang terhubung tanpa double posting.

---

## 8. Phase 4 — Customer Follow-up Center

**Outcome:** follow-up bukan hanya daftar customer dan tombol WhatsApp, tetapi task yang punya owner, due date, outcome, dan histori.

### P4.1 — Follow-up task model

Suggested collections:
- `customerFollowUpTasks`
- `customerFollowUpEvents`

Field minimum:
- taskId, customerId, optional bookingId.
- title, reason/category, templateKey, channel.
- assignedToUid/name, dueAt, nextDueAt.
- status: Scheduled, Due, Completed, Snoozed, Cancelled.
- outcome: Sent/Contacted, No Answer, Deferred, Booked, Not Interested, Other.
- createdBy/createdAt, completedBy/completedAt, notes.
- idempotency key dan audit timestamps.

Due/overdue adalah derived state dari dueAt + status, bukan status yang ditulis manual tiap menit.

### P4.2 — Workflow

- Create follow-up dari Customer detail, outstanding invoice, completed session, atau manual action.
- Queue dikelompokkan Due Today, Overdue, Upcoming, Completed.
- Task dapat di-assign ke Admin yang mempunyai akses Customers.
- WhatsApp tetap dibuka dengan template yang telah dipilih.
- Setelah kembali, Admin harus mencatat outcome secara manual; aplikasi tidak boleh mengklaim pesan terkirim hanya karena link WhatsApp dibuka.
- Snooze/reschedule mewajibkan nextDueAt.
- Customer timeline menampilkan riwayat follow-up tanpa mengubah histori booking/payment.
- Dashboard menampilkan jumlah due/overdue sebagai attention item.

### P4.3 — Notification policy

- MVP cukup menyediakan due/overdue queue saat Admin membuka aplikasi.
- Jangan menjanjikan background reminder/push tanpa scheduler yang benar-benar dikonfigurasi dan diuji.
- Integrasi Notification Console dapat ditambahkan sebagai in-app event jika ada trigger yang aman.
- Tidak ada otomatisasi WhatsApp/API blast.

### P4.4 — Regression & acceptance

- Task selalu terkait customer valid; bookingId opsional harus mengarah ke booking yang benar.
- Task yang completed tidak muncul lagi sebagai due.
- Snooze mempertahankan riwayat due sebelumnya.
- Double submit tidak menggandakan task/event.
- Link WA memakai nomor normalized, tetapi format nomor asli tetap ditampilkan.
- Completion outcome dan actor tercatat.
- Filter URL/deep link mempertahankan queue context.

**Exit gate Phase 4:** setiap follow-up dapat diketahui siapa PIC-nya, kapan jatuh tempo, apa hasilnya, dan kapan harus ditindaklanjuti lagi.

---

## 9. Phase 5 — Procurement Management

**Outcome:** pembelian barang menjadi proses yang terlacak dari supplier sampai barang diterima dan pembayaran dicatat.

### P5.1 — Procurement model

Suggested collections:
- `suppliers`
- `purchaseOrders`
- `goodsReceipts`
- `procurementEvents`

Purchase order fields:
- purchaseOrderId, supplierId, orderDate, expectedAt.
- lines: inventoryItemId (optional), itemName, unit, orderedQty, receivedQty, unitCost.
- subtotal, discount, tax/fee only if policy exists, total.
- status, notes, attachment references.
- createdBy, approvedBy, orderedAt, receivedAt, timestamps.

Suggested lifecycle:
- Draft → Submitted → Approved → Ordered → Partially Received → Received.
- Cancelled requires reason and cannot erase receipt/payment history.

### P5.2 — Receiving dan stok

- PO tidak menambah quantity inventory.
- Goods Receipt adalah satu-satunya event procurement yang menambah stock.
- Receipt mencatat acceptedQty, rejectedQty, condition, discrepancy, receivedBy, receivedAt.
- Worker atomik memperbarui inventory quantity, membuat inventory movement, dan menulis receipt/event.
- Receipt quantity tidak boleh melebihi outstanding PO quantity tanpa explicit correction/approval.
- Barang rusak/ditolak tidak masuk available stock.
- Retry receipt tidak boleh menggandakan movement.

### P5.3 — Supplier payment dan Bookkeeping

- Catat supplier invoice/reference, amount due, amount paid, payment method, payment date.
- Setiap pembayaran yang benar-benar terjadi menghasilkan canonical Bookkeeping expense source `procurement-payment` yang linked ke PO/supplier.
- Payment history immutable; partial payment diperbolehkan jika data model dan policy mendukung.
- Outstanding supplier dihitung dari PO total dikurangi canonical supplier payments.
- MVP ini bukan full accounts-payable/general-ledger system. Jangan mengklaim accrual accounting lengkap sebelum ada desain chart of accounts dan policy accounting terpisah.
- Supplier payment dan goods receipt harus idempotent dan atomic pada batas transaksi masing-masing.

### P5.4 — Admin UI

- Tambahkan tab **Procurement** di Inventory.
- Supplier directory + supplier detail.
- Purchase order list dengan filter draft/pending approval/ordered/partial/received.
- PO detail berisi line item, approval, delivery, receipt, dan payment history.
- Receiving form menggunakan item lookup dari Inventory.
- Payment action hanya muncul kepada Owner/Admin dengan permission Bookkeeping.
- Dashboard menampilkan PO menunggu approval, barang belum diterima, dan receipt discrepancy.

### P5.5 — Regression & acceptance

- PO tidak mengubah stok sebelum receipt.
- Satu receipt tidak bisa diposting dua kali.
- Partial receipt dan remaining quantity konsisten.
- Rejected/damaged quantity tidak menjadi available stock.
- Inventory movement, receipt, dan PO totals cocok.
- Payment membuat satu expense canonical per payment event.
- Outstanding supplier sama dengan total PO dikurangi payment history.
- Supplier/PO history tetap tersedia ketika item dinonaktifkan.

**Exit gate Phase 5:** seluruh pembelian dapat ditelusuri dari supplier, approval, PO, receipt, stock movement, sampai pembayaran.

---

## 10. Cross-phase testing dan Definition of Done

Setiap phase wajib menjalankan:

```powershell
npm ci
npm run lint
npm test
npm run test:prd
npm run build
git diff --check
```

Test baru wajib didaftarkan ke script package.json dan GitHub Actions Quality Gates. Jangan hanya membuat file test yang tidak ikut pipeline.

### Minimum test matrix

| Area | Required regression |
|---|---|
| Session | Valid/invalid transition, stale booking, no-show reason, terminal state, concurrency, history |
| Closing | Business timezone, method totals, cutoff, late posting, duplicate close, variance, reopen |
| Maintenance | Duplicate work order, assignment, state transition, verification, expense idempotency |
| Follow-up | Due/overdue, assignment, snooze, completion outcome, deep link, duplicate prevention |
| Procurement | PO approval, partial receipt, excess receipt, damaged quantity, stock movement, duplicate payment |
| Shared | Owner/Admin/Client/Guard isolation, direct URL, Firestore Rules emulator, mobile keyboard, light/dark, offline/error state |

### Visual/responsive QA

- Desktop 1440×900 Light/Dark.
- Desktop 1920×1080.
- Tablet 768×1024.
- Mobile 390×844 Light/Dark.
- Mobile 320×568 untuk reflow dan overlay.
- Semua modal/drawer diuji dengan loading, validation error, long data, keyboard, dan safe area.

### Release acceptance

- Seluruh flow authenticated diuji pada staging terpisah.
- Tidak ada mutating test ke production.
- Tidak ada open P0/P1 data integrity atau authorization bug.
- Firebase Spark/no-billing gate tetap lulus.
- Rollback dan backup/restore plan tersedia.
- Owner melakukan UAT untuk transaksi, closing, maintenance expense, follow-up, dan procurement.
- Production deployment hanya setelah persetujuan eksplisit.

---

## 11. Urutan delivery dan dependency

| Urutan | Workstream | Dependency utama | Status awal |
|---:|---|---|---|
| 0 | Foundation & Inventory integrity | PR #1 audit baseline, Worker + Rules | Wajib lebih dulu |
| 1 | Session Operations | Booking domain + Worker transition | Belum ada lifecycle lengkap |
| 2 | Daily Closing | Canonical finance ledger + date-range query | Belum ada closing |
| 3 | Equipment Maintenance | Inventory Worker atomic mutation + Bookkeeping source | Baru ada condition flag |
| 4 | Customer Follow-up Center | Customer repository + task/events Worker | Baru ada candidate queue + WA link |
| 5 | Procurement Management | Inventory receipt + supplier/PO + Bookkeeping payment | Belum ada procurement model |

Jangan mulai lima workstream secara paralel. Session dan closing menyentuh domain kritikal; Inventory integrity menjadi dependency untuk maintenance dan procurement.

---

## 12. Branching, PR, dan governance

1. PR #1 tetap Draft/Open sampai Owner memberi instruksi berbeda.
2. Tidak ada merge otomatis atau deployment setelah CI hijau.
3. Implementasi dimulai dari baseline audit commit `c511da6` agar mendapat hardening dan concurrency fixes yang belum ada di `main`.
4. Setiap phase memakai branch implementasi terpisah, contoh:
   - `feat/session-operations`
   - `feat/daily-closing-reconciliation`
   - `feat/equipment-maintenance`
   - `feat/customer-follow-up-center`
   - `feat/procurement-management`
5. Satu phase selesai setelah code, tests, CI, dan UAT criteria terpenuhi; setelah itu buat PR untuk review.
6. PR boleh dibuat dan diperbarui, tetapi **tidak boleh merge tanpa izin eksplisit Owner**.
7. Tidak melakukan production deploy, data migration production, atau destructive operation tanpa izin eksplisit.
8. Jika PR #1 belum merge saat feature siap, gunakan stacked PR/target branch yang disepakati; jangan mengganti base branch secara diam-diam.
9. Setiap handoff wajib mencantumkan branch, base SHA, commit, file yang berubah, test yang dijalankan, hasil CI, known gap, dan command pull.

### Command baseline saat implementasi dimulai

```powershell
git fetch origin
git switch audit/foundation-and-admin-portal-2026-10-20
git pull origin audit/foundation-and-admin-portal-2026-10-20
git status --short
```

Command di atas hanya menyamakan working tree dengan branch audit. Command tersebut tidak merge PR dan tidak deploy aplikasi.

---

## 13. Out of scope untuk lima phase ini

- Payment gateway otomatis baru.
- Payroll penuh.
- Automatic WhatsApp send/blast.
- Background notification scheduler yang belum dikonfigurasi.
- Full accounting/general ledger dan accrual accounts payable.
- Multi-branch/multi-location procurement atau closing sebelum kebutuhan bisnis dikonfirmasi.
- Database reset/migrasi destruktif di production.
- Perubahan Firebase ke paket berbayar.

**Keputusan akhir:** kerjakan Phase 0 terlebih dahulu, lalu jalankan lima fase sesuai urutan. Setiap fase harus berakhir dengan bukti test, bukan sekadar halaman UI yang terlihat selesai.
