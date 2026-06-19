# Payment Proof Upload Audit

Generated: 2026-06-19T17:07:59.515Z

## Goal

Client bisa upload bukti pembayaran untuk DP atau Pelunasan, lalu admin meninjau sebelum pembayaran dianggap sah.

## Desired Flow

### Client via booking form

1. Client pilih slot dan isi booking form.
2. Client opsional memilih ingin bayar DP sekarang.
3. Client pilih kategori pembayaran: DP atau Pelunasan.
4. Client upload bukti pembayaran.
5. Client submit request booking.
6. Status bukti di client: Pending Review.
7. Admin review bukti.
8. Jika admin approve, booking paymentHistory bertambah dan status pembayaran berubah menjadi DP/Lunas.
9. Jika admin reject, client melihat status bukti ditolak dan bisa upload ulang.

### Client via tab Tagihan

1. Client buka Tagihan.
2. Client pilih booking/invoice yang masih pending atau DP.
3. Client klik Upload Bukti.
4. Client pilih kategori DP atau Pelunasan.
5. Client upload file.
6. Submit.
7. Status bukti: Pending Review sampai admin konfirmasi.

### Admin

1. Admin buka Billing.
2. Admin melihat queue Bukti Pembayaran Pending.
3. Admin buka bukti pembayaran.
4. Admin pilih Approve atau Reject.
5. Approve menjalankan payment recorder resmi yang update paymentHistory.
6. Reject hanya mengubah status bukti, tidak mengubah paymentHistory.

## Recommended Data Model

Gunakan collection khusus:

```txt
paymentProofs/{proofId}
```

Shape:

```js
{
  id: 'proof_xxx',
  bookingId: 'booking_doc_id',
  bookingCode: 'BKG-...',
  invoiceNumber: 'INV-...',
  clientUid: 'firebase_uid',
  customer: 'Nama Client',
  category: 'dp' | 'pelunasan',
  amount: 50000,
  method: 'transfer' | 'qris',
  status: 'pending' | 'approved' | 'rejected',
  proofUrl: 'https://res.cloudinary.com/...',
  proofPublicId: '...',
  proofFileName: 'bukti.jpg',
  proofMimeType: 'image/jpeg',
  clientNote: '',
  adminNote: '',
  createdAt: 'ISO',
  updatedAt: 'ISO',
  reviewedAt: '',
  reviewedByUid: '',
  reviewedByName: ''
}
```

## Why Separate Collection?

- Menghindari client update langsung field paymentHistory di booking.
- Memudahkan admin review pending bukti.
- Riwayat bukti tetap ada walaupun ditolak.
- Approval bisa diarahkan ke satu fungsi payment recorder resmi.
- Tidak mengotori booking document dengan file upload sementara.

## Single Source of Truth

Pembayaran sah tetap ada di:

```txt
bookings/{bookingId}.paymentHistory
bookings/{bookingId}.paymentStatus
bookings/{bookingId}.paidAmount
bookings/{bookingId}.invoiceAmount
```

paymentProofs hanya tempat review bukti. Kalau approved, paymentHistory di booking baru berubah.

## Required Implementation Files

| File | Change |
|---|---|
| src/services/cloudinaryUploadService.js | Tambah generic uploadImageFile() dan uploadPaymentProofFile(). uploadGalleryImageFile() jadi wrapper agar tidak duplikasi. |
| src/services/paymentProofRepository.js | Service baru untuk submit proof, subscribe pending proofs, approve/reject proof. |
| firestore.rules | Tambah validPaymentProof, match /paymentProofs/{proofId}. Client create/read own proof, admin review. |
| src/pages/ClientPortalPage.jsx | Tambah upload bukti di booking modal dan tab Tagihan. |
| src/pages/admin/BillingPage.jsx | Tambah payment proof review queue dan approve/reject. |
| src/styles/... | Tambah styling modal/queue proof. |

## Rule Strategy

Client:
- boleh create paymentProof hanya untuk booking miliknya sendiri.
- boleh read paymentProof miliknya sendiri.
- tidak boleh approve/reject.
- tidak boleh update paymentHistory booking.

Admin:
- boleh read semua paymentProof.
- boleh update status proof ke approved/rejected.
- approval harus update booking paymentHistory lewat admin app.

## Audit Findings

| Status | Area | Detail |
|---|---|---|
| ✅ PASS | Cloudinary Upload | Cloudinary service sudah ada, tapi masih bernama gallery-specific. Perlu dibuat generic uploadPaymentProofFile() tanpa duplikasi fetch/upload logic. |
| ⚠️ WARN | Client Portal Billing | Client Portal masih mengarahkan bukti bayar via WhatsApp. Perlu diganti/ditambah flow Upload Bukti di app. |
| ✅ PASS | Client Booking Form | Booking form client sudah punya submit request. Perlu opsi bayar DP + upload bukti sebelum submit request, tanpa memaksa semua client upload. |
| ✅ PASS | Admin Billing | Billing admin sudah punya payment recorder resmi. Approval bukti pembayaran harus memakai logic pembayaran yang sama, bukan bikin status updater baru. |
| ✅ PASS | Payment History | Booking sudah mendukung paymentHistory. Bukti yang admin approve sebaiknya masuk ke paymentHistory sebagai source of truth pembayaran. |
| ⚠️ WARN | Firestore Rules | Client update booking saat ini hanya untuk message/cancellation/read. Perlu rule khusus submit payment proof pending. |
| ✅ PASS | Admin Review | Admin Billing punya area review invoice. Perlu queue/review bukti bayar agar admin bisa approve/reject tanpa membuka jalur manual dobel. |

## Implementation Phases

### Phase 2
Implement Cloudinary generic upload + paymentProofRepository + Firestore rules.

### Phase 3
Client upload proof from booking modal and Tagihan page.

### Phase 4
Admin Billing review queue with approve/reject.

### Phase 5
Polish UI, edge cases, duplicate prevention, and status badges.
