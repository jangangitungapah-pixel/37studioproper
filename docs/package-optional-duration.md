# Package Optional Duration

Model paket sekarang:

```txt
Durasi paket boleh kosong.
Jika durasi kosong atau 0, paket dianggap tidak memakai studio utama.
```

Contoh paket tanpa durasi:

```txt
Mixing + Mastering 1 Lagu
Vocal Editing
Tune Vocal
Remote Mixing
Aransemen
```

Dampak di app:

```txt
1. Settings -> Pricing and Session -> Paket tidak lagi wajib mengisi durasi.
2. Package tanpa durasi tetap punya harga dan tetap bisa masuk invoice/tagihan.
3. Booking package tanpa durasi tidak memblok kalender studio utama.
4. Client calendar tidak membuat slot publik untuk package tanpa durasi.
5. Firestore rules menerima durationHours = 0 untuk bookings.
```

Catatan:

```txt
Jika paket perlu memakai studio utama, isi durasi seperti biasa.
Jika paket tidak perlu studio utama, kosongkan durasi.
```

# Package Optional Duration

Hotfix:

```txt
Paket sekarang boleh disimpan dengan durasi kosong atau 0.
Validasi save package hanya mewajibkan nama dan harga.
```

Contoh paket valid:

```txt
Nama: Mixing + Mastering 1 Lagu
Detail: Mixing dan mastering untuk 1 lagu
Durasi: kosong / 0
Harga: 500000
```

Catatan:

```txt
Durasi kosong berarti paket tidak memakai studio utama dan tidak seharusnya memblok kalender studio.
```
