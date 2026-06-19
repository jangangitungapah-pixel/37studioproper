# Studio Settings Integration Audit

Generated: 2026-06-19T16:39:54.428Z

## Verdict

Studio Settings perlu dibuat sebagai source of truth baru untuk identitas dan pembayaran studio.

Jangan gabungkan semua ke Invoice Settings, karena Invoice Settings sebaiknya fokus ke tampilan invoice seperti subtitle, footer, dan ukuran thermal.

## Recommended Firestore Document

```txt
settings/studio
```

## Recommended Shape

```js
{
  studioName: '37 Music Studio',
  studioAddress: '',
  studioPhone: '',
  bankName: 'Bank BCA',
  bankAccountNumber: '',
  bankAccountHolder: '37 MUSIC STUDIO',
  qrisLabel: 'Scan di kasir studio',
  qrisNote: 'Mendukung GoPay, OVO, ShopeePay',
  paymentTerms: [
    'DP minimal sebesar Rp 50.000 diperlukan untuk mengunci slot jika melakukan booking jarak jauh.',
    'Pelunasan dapat dilakukan langsung di studio sebelum latihan dimulai.',
    'Pembatalan sesi < 24 jam menyebabkan DP hangus.'
  ],
  updatedAt: ''
}
```

## Checklist

| Status | Area | Detail |
|---|---|---|
| ✅ PASS | SettingsPage | SettingsPage punya subpage account, pricing, invoice, dan approvals owner, tapi belum punya Studio Settings. |
| ✅ PASS | Invoice Settings | Invoice Settings sudah menyimpan studioName, phone, dan address ke settings/invoice. Ini overlap dengan kebutuhan Studio Settings. |
| ⚠️ WARN | Client Portal | Nomor rekening client portal masih hardcoded dan harus dipindah ke settings/studio. |
| ⚠️ WARN | Client Portal | Nomor WhatsApp client portal masih memakai invoiceSettings.phone dan fallback dummy. |
| ✅ PASS | Billing | Billing sudah pakai invoiceSettings untuk identitas invoice. Nanti perlu dialihkan ke Studio Settings untuk nama, alamat, dan phone. |
| ✅ PASS | Firestore Rules | Rules settings sudah punya pola yang bisa ditiru untuk settings/studio. |
| ✅ PASS | Pricing Settings | Pricing Settings punya pola hook/subscribe/save yang cocok dijadikan template untuk studioSettings.js. |

## Integration Plan

1. Buat `src/settings/studioSettings.js` dengan pola mirip `invoiceSettings.js` dan `pricingSettings.js`.
2. Tambah `validStudioSettings(data)` di `firestore.rules`.
3. Tambah `match /settings/studio` dengan public read dan admin settings write.
4. Tambah subpage `Studio Settings` di `SettingsPage.jsx`.
5. Pindahkan input nama studio, alamat, dan phone dari Invoice Settings ke Studio Settings.
6. Biarkan Invoice Settings fokus ke subtitle, footer, dan paperSize.
7. Update `ClientPortalPage.jsx` agar rekening, bank, A/N, QRIS, terms, dan WA memakai Studio Settings.
8. Update `BillingPage.jsx` agar reminder/share/thermal invoice memakai Studio Settings untuk nama, alamat, dan phone.

## Do Not Put Here

- API key
- Firebase token
- Secret payment gateway
- Data customer internal
- Catatan admin internal
