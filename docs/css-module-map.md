# CSS Module Map - 37 Studio Proper

Dokumen ini memetakan arsitektur CSS berbasis route dan domain. CSS inti berada di `src/styles/routes/`, sedangkan style workspace tetap berada di `src/styles/modules/` dan dimuat oleh lazy page/component pemiliknya.

## Hierarki Import Utama

Tidak ada lagi aggregator global yang memasukkan seluruh workspace ke setiap route. Masing-masing surface memiliki entry inti:

| Route core | Pemakai | Isi |
| --- | --- | --- |
| `routes/auth.css` | Login admin, login client, PWA launch | `base`, `shared`, `modal`, `auth` |
| `routes/admin.css` | Shell admin | `base`, `shared`, `modal`, `auth`, `admin-shell` |
| `routes/client.css` | Landing dan portal client | `base`, `shared`, `modal` |
| `routes/public.css` | Public booking | `base` |
| `routes/guard.css` | Portal guard standalone | `base`, `auth`, `guard-attendance` |

Feature admin dimuat oleh lazy entry pemiliknya. Contoh:

```js
// src/pages/admin/SchedulePage.jsx
import '../../styles/modules/schedule.css';

// src/components/schedule/BookingFormModal.jsx
import '../../styles/modules/booking.css';
```

Dengan pola ini, login/public/client tidak lagi mengunduh CSS schedule, billing, inventory, settings, atau workspace admin lain yang tidak dirender.

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
| `operator-fee.css` | Modul sistem komisi dan settings fee operator. | `shared.css` |
| `notifications.css` | Console event dan kontrol notifikasi admin. | `shared.css` |
| `guard-attendance.css`| Styling UI mesin absensi untuk Penjaga (Check in/out). | `base.css` |

## Aturan Kepemilikan

- Route core hanya boleh memuat token, primitive bersama, dan shell milik route tersebut.
- Lazy admin page mengimpor satu modul workspace miliknya; modul tambahan hanya boleh masuk bila komponen embedded benar-benar memakai selector tersebut.
- CSS komponen lintas-workspace, seperti `booking.css` untuk `BookingFormModal` dan `BookingConversationPanel`, diimpor oleh komponen pemilik agar hanya ikut saat komponen dirender.
- `base.css` tetap bebas dari global element selector berbahaya seperti `button {}` atau `input {}`.
