

## Smart PWA Launch Route

PWA sekarang menggunakan:

```txt
start_url: /launch
```

Route `/launch` menentukan portal berdasarkan akun yang sedang login:

```txt
Owner/Admin approved -> /admin/dashboard
Admin pending/rejected -> /admin
Client active -> /client/portal
Belum login / fallback -> /client
```

Catatan:

```txt
Jika PWA lama masih membuka /client, hapus ikon PWA lama lalu install ulang dari browser.
Beberapa browser menyimpan start_url manifest lama sampai app di-reinstall.
```
