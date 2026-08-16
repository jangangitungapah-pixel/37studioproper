# 37 Music Studio - Owner Danger Zone Data Reset

Danger Zone tersedia di:

```txt
/admin/settings -> Danger Zone
```

Akses:

```txt
Owner only.
```

Data Firestore yang dihapus:

```txt
bookings
paymentProofs
bookingMessages
clientCalendarSlots
customers
bookkeepingEntries
inventoryItems
inventoryMovements
gallery
notificationEvents
settings
users, kecuali akun owner yang sedang login
```

Yang tidak dihapus:

```txt
Firebase Auth users
File eksternal Cloudinary
Akun owner aktif yang sedang login
```

Konfirmasi wajib:

```txt
HAPUS DATA 37 STUDIO
```

Catatan operasional:

```txt
Gunakan hanya saat reset data testing atau ingin mulai ulang database app.
Pastikan export/backup manual dilakukan sebelum menjalankan aksi ini.
```
