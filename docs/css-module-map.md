# CSS Module Map - 37 Studio Proper

Dokumen ini memetakan arsitektur pemecahan modul CSS di dalam folder `src/styles/modules/` dari yang awalnya berupa satu file monolitik raksasa menjadi struktur modular berbasis domain.

## Hierarki Import Utama
File entry utama adalah `src/styles/admin-auth.css`. File ini **TIDAK** memuat gaya apa pun, melainkan hanya bertindak sebagai *aggregator* urutan kompilasi CSS:

```css
@import './modules/base.css';
@import './modules/shared.css';
@import './modules/auth.css';
@import './modules/admin-shell.css';
@import './modules/schedule.css';
/* ... module feature lainnya */
```

## Daftar Modul Berdasarkan Domain

| Nama Modul | Fungsi & Cakupan Utama | Dependencies |
| --- | --- | --- |
| `base.css` | Memuat deklarasi CSS Variables (`--auth-*`, `--ui-*`), CSS reset, gaya tema dasar (`.auth-page`), global radius, & color scheme shadow. | Tidak ada. (Akar) |
| `shared.css` | Komponen primitive dan shared UI yang digunakan antar-page (misal: Select dropdown, Pagination, Modal Backdrop Panel, Feedback Alert). | `base.css` (tokens) |
| `admin-shell.css` | Struktur layout aplikasi Admin: Sidebar Desktop, Topbar, Bottom Navigation Mobile. | `base.css` |
| `auth.css` | Halaman autentikasi login (Client & Admin), serta kotak login di Guard Portal. | `base.css` |
| `booking.css` | Modul fungsionalitas pemesanan (Booking form, Smart Pricing Note, modal discount row, detail form). | `shared.css` |
| `schedule.css` | Tampilan kalender jadwal harian/mingguan dan tab filter segment. | `shared.css` |
| `customer.css` | Halaman database pelanggan, ukuran sepatu pelanggan. | `shared.css` |
| `billing.css` | Point-of-Sales, nota kasir (invoice receipt layout), diskon. | `shared.css` |
| `settings.css` | Modul pengaturan operasional dan manajemen permission staff. | `shared.css` |
| `inventory.css` | Modul manajemen barang dan persediaan di studio. | `shared.css` |
| `bookkeeping.css` | Pembukuan transaksi manual dan mutasi (cashflow). | `shared.css` |
| `dashboard.css` | Widget grafik analitik utama dan *quick stat* di dashboard. | `shared.css` |
| `gallery.css` | Manajemen foto dan aset profil. | `shared.css` |
| `operator-fee.css` | Modul sistem komisi. (Saat ini bersifat *placeholder* tanpa CSS custom aktif). | N/A |
| `notifications.css` | Modul log sistem. (Saat ini bersifat *placeholder* tanpa CSS custom aktif). | N/A |
| `guard-attendance.css`| Styling UI mesin absensi untuk Penjaga (Check in/out). | `base.css` |

## Catatan Audit Fase UI-8

- Ekstraksi `.schedule-actions` dari `shared.css` ke `schedule.css`.
- Ekstraksi `.booking-price-note` dari `shared.css` ke `booking.css`.
- `notifications.css` dan `operator-fee.css` dikonfirmasi sebagai *placeholder file* murni yang normal dan tidak mengandung CSS liar.
- `base.css` dipastikan bebas dari global element selectors berbahaya (seperti `button {}` / `input {}`). Semua styling element dilakukan via *class*.
