# Pricing Settings Locked Sessions

Hotfix PRC-1 memastikan session locked default selalu muncul lagi walaupun dokumen Firestore/local storage pernah tersimpan tanpa salah satu session.

Locked default sessions:

```txt
1. Rehearsal
2. Recording
3. Mixing
4. Mastering
```

Alasan:

```txt
BookingFormModal membaca pilihan Tipe Session dari getSessionOptions(pricingSettings).
Jika settings/pricing kehilangan session "recording", pilihan Recording ikut hilang dari booking form.
```

Behavior setelah hotfix:

```txt
1. normalizePricingSettings() selalu merge locked default sessions.
2. Session custom tetap dipertahankan.
3. Existing locked session yang sudah diedit tetap dipertahankan, tapi id dan locked dipaksa aman.
4. Recording kembali muncul di Booking Form.
5. Harga Recording tetap 0 karena harga dan durasi mengikuti Recording Type.
```
