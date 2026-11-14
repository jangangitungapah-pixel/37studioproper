# Payment Proof Reference Audit

Updated: 2026-11-09

## Decision

Payment confirmation is metadata-only. The client does not upload a screenshot or receipt image. A payment proof is a pending claim containing the payment amount, category, method, sender name, transaction reference, optional note, and booking identity.

The client is responsible for entering a reference that can be checked against the bank or QRIS provider transaction history. Admin review remains the point at which the payment becomes an official booking payment.

## Client flow

### Booking wizard

1. Client selects an available slot and completes the booking details.
2. Client may optionally submit a DP/reference claim with the booking request.
3. The client enters the amount, method, transaction reference, sender name, and optional note.
4. The booking request is created first. Its stable booking request ID is retained for retry.
5. The payment-reference request is then written to `paymentProofs/{proofId}` with a stable, booking-scoped idempotency key.
6. If payment-reference submission fails after the booking has been saved, the UI reports that the booking exists and the reference must be retried. It does not create a second booking.

### Client billing

1. Client opens Tagihan and selects an open invoice.
2. Client chooses DP or Pelunasan, enters amount and method, then supplies the bank/QRIS transaction reference and payer name.
3. The client submits the reference. The UI does not request a file, call Cloudinary, or display a remote proof URL.
4. The reference remains pending until Admin reviews it.

## Admin review

1. Billing shows the full reference-review history.
2. The review panel displays the booking, invoice, amount, category, payment method, transaction reference, sender name, and client note.
3. Admin checks the reference against the payment provider's source-of-truth transaction history.
4. Approve writes the booking payment event, immutable bookkeeping ledger entry, reviewed proof state, activity fence, and repository idempotency marker in one Firestore transaction.
5. Reject writes the review decision and audit metadata without changing booking payment history.
6. A repeated request with the same actor, operation, request ID, and payload replays the original result rather than posting cash twice.

## Firestore data model

Collection:

```text
paymentProofs/{proofId}
```

Current client-created document shape:

```js
{
  id: 'proof_<stable-request-id>',
  bookingId: 'booking_doc_id',
  bookingCode: 'BKG-...',
  invoiceNumber: 'INV-...',
  clientUid: 'firebase_uid',
  customer: 'Nama Client',
  category: 'dp' | 'pelunasan',
  amount: 50000,
  method: 'transfer' | 'qris',
  payerName: 'Nama pemilik rekening / pengirim',
  transactionReference: 'Kode referensi bank atau QRIS',
  status: 'pending' | 'approved' | 'rejected',
  clientNote: '',
  adminNote: '',
  createdAt: 'ISO',
  updatedAt: 'ISO',
  reviewedAt: '',
  reviewedByUid: '',
  reviewedByName: '',
  reviewDecision: '',
  reviewOperationId: '',
  // Legacy compatibility only. New proof records leave these blank.
  proofUrl: '',
  proofPublicId: '',
  proofFileName: '',
  proofMimeType: ''
}
```

The legacy image fields remain readable as historical metadata for old Firestore documents. They are not populated by new submissions and are not rendered by the client portal, Billing queue, review modal, booking history, or finance projection.

## Accounting source of truth

Official payments remain in:

```text
bookings/{bookingId}.paymentHistory
bookings/{bookingId}.paymentStatusCanonical
bookings/{bookingId}.paidAmount
bookings/{bookingId}.invoiceAmount
bookkeepingEntries/{immutableLedgerEntryId}
```

`paymentProofs` is a review inbox, not an accounting ledger. Approval must update the booking, ledger, proof review state, activity fence, and idempotency marker atomically. Rejection must never modify booking payment history.

## Security contract

- Client can create a pending reference only for a booking owned by that authenticated client.
- Client can read only their own payment-reference documents.
- Client cannot approve, reject, or change review metadata.
- Admin with Billing permission can review references and post finance operations.
- Payment, refund, proof approval, void, manual journal writes, and daily closing use the Firebase repository path and transaction markers.
- Firestore Rules require booking/ledger/proof/fence companions to match within the same atomic write.
- A closed business date rejects new finance activity until an Owner reopens the closing.
- Reviewed payment references are immutable to clients and cannot be reviewed a second time.

## Removed media path

New payment-reference submissions no longer use `uploadPaymentProofFile()` or the `studio37/payment-proofs` Cloudinary folder. The generic Cloudinary upload service remains available for unrelated gallery images. Gallery upload is outside this payment/accounting flow.

## Verification focus

- Client booking wizard and Tagihan have no payment file input or upload call.
- Billing queue and booking drawer show transaction reference metadata, not an image preview/link.
- Payment approval and rejection call `firestoreFinanceRepository`, not the Admin Operations Worker.
- Manual bookkeeping create/update/delete include idempotency markers and business-date activity fencing.
- Daily closing preview/close/reopen use the Firestore repository implementation.
- Emulator Rules tests verify the allowed atomic transaction shapes and deny direct unpaired writes.
