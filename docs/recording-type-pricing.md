# Recording Type Pricing

Model harga Recording sekarang:

```txt
Recording session tidak punya harga per jam.
Harga Recording selalu diambil dari Settings -> Pricing and Session -> Recording Type.
Durasi Recording juga mengikuti Recording Type.
```

Dampak:

```txt
1. Session List menampilkan Recording sebagai "Harga dari Recording Type".
2. Form booking admin mengunci durasi saat Recording dipilih.
3. Portal client tidak menampilkan opsi "Sewa Flat Per Jam" untuk Recording.
4. Booking Recording wajib memilih Recording Type.
5. Jika belum ada Recording Type, booking Recording tidak bisa disimpan/request.
```

Contoh Recording Type:

```txt
Live Recording - 3 jam - Rp450.000
Vocal Tracking - 2 jam - Rp300.000
Full Band Tracking - 5 jam - Rp750.000
```
