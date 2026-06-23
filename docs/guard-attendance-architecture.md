# Guard Attendance Architecture

## Masalah yang Diperbaiki

Uang makan penjaga studio tidak boleh dihitung per booking.

Sebelumnya:

```txt
Booking A -> uang makan Rp40.000
Booking B -> uang makan Rp40.000
Booking C -> uang makan Rp40.000
```

Itu salah karena uang makan adalah benefit harian.

Yang benar:

```txt
Penjaga Studio absen 1 hari
-> uang makan Rp40.000 untuk tanggal itu
-> tidak peduli ada 1 booking atau 10 booking
```

## Immediate Fix OPF-6A

```txt
DAILY fee rule tidak lagi ikut createEstimatedOperatorFeeLines().
```

Artinya rule seperti:

```txt
guard-daily-meal
calculationMode: daily
```

tidak akan muncul lagi sebagai fee per booking di halaman Operator Fee.

## Role Baru

Role aplikasi yang direkomendasikan:

```txt
studio_guard
```

Akses role ini:

```txt
1. Login.
2. Tidak masuk full admin shell.
3. Hanya melihat halaman Absen Penjaga.
4. Bisa clock-in dan clock-out untuk dirinya sendiri.
5. Tidak bisa lihat Billing, Pembukuan, Settings, Customer, Inventory.
```

Owner tetap bisa melihat semua data absen.

## Halaman Baru

Route yang direkomendasikan:

```txt
/guard/attendance
```

Alternatif di admin shell owner:

```txt
/admin/guard-attendance
```

## Flow Penjaga Studio

```txt
Penjaga login
-> buka halaman Absen
-> klik Mulai Jaga
-> sistem membuat attendance session aktif
-> setelah selesai, klik Selesai Jaga
-> sistem menutup session
```

Validasi penting:

```txt
1. Satu user tidak boleh punya 2 shift aktif di waktu yang sama.
2. Clock-in wajib punya tanggal.
3. Clock-out harus lebih besar dari clock-in.
4. Absen void hanya owner.
5. Edit manual hanya owner.
```

## Collection Firestore

### guardAttendanceSessions/{attendanceId}

```js
{
  id,
  guardUid,
  guardEmail,
  guardPersonId,
  guardName,

  date: '2026-06-23',
  clockInAt,
  clockOutAt,

  status: 'active' | 'closed' | 'void',
  durationHours,

  mealAmount: 40000,
  mealEligible: true,

  source: 'guardAttendance',
  note,

  createdAt,
  updatedAt,
  closedAt,
  voidedAt,
  voidedByUid
}
```

## Cara Hitung Uang Makan

Uang makan dihitung dari absen, bukan booking.

Formula:

```txt
Untuk setiap guardPersonId + date:
jika ada minimal 1 attendance session valid
-> mealAmount = settings.operatorFees.options.mealPerPersonPerDay
```

Proteksi dobel:

```txt
1 guard + 1 tanggal = maksimal 1 uang makan.
```

Contoh deterministic key:

```txt
meal__{guardPersonId}__{YYYY-MM-DD}
```

## Integrasi Operator Fee

Halaman Operator Fee nanti punya dua section:

```txt
1. Booking Fee
   - fee rehearsal
   - fee recording
   - fee operator
   - overtime

2. Uang Makan dari Absen
   - penjaga
   - tanggal
   - status absen
   - meal amount
   - status post pembukuan
```

## Integrasi Pembukuan

Saat owner post uang makan:

```js
createBookkeepingEntry({
  id: 'guardmeal__{guardPersonId}__{date}',
  type: 'expense',
  category: 'crew',
  title: 'Uang Makan Penjaga - {guardName} - {date}',
  amount: mealAmount,
  date,
  paymentMethod,
  source: 'guardAttendanceMeal',
  sourceAttendanceDate: date,
  sourceGuardPersonId: guardPersonId,
  note
})
```

## Fase Lanjutan

### ATT-2 Role + Repository + Rules

```txt
src/services/guardAttendanceRepository.js
firestore.rules
role studio_guard
```

### ATT-3 Guard Attendance Page

```txt
src/pages/guard/GuardAttendancePage.jsx
route /guard/attendance
clock-in / clock-out
```

### ATT-4 Owner Attendance Review

```txt
Owner melihat rekap absen penjaga
filter tanggal / penjaga
void / koreksi
```

### ATT-5 Operator Fee Integration

```txt
Operator Fee menampilkan uang makan dari attendance
post uang makan ke pembukuan
duplicate protection per guard per date
```

## Guardrail

```txt
1. Uang makan tidak lagi dihitung dari booking.
2. Uang makan tidak otomatis masuk pembukuan tanpa owner review.
3. Role studio_guard tidak dapat akses data sensitif admin.
4. Booking fee dan attendance meal dipisah supaya owner tidak salah baca.
```

## ATT-2 - Guard Attendance Foundation

Fondasi absen penjaga dibuat.

Files:

```txt
src/services/guardAttendanceRepository.js
src/utils/adminPermissions.js
src/services/notificationEventRepository.js
firestore.rules
```

Role baru:

```txt
studio_guard
```

Behavior role:

```txt
1. studio_guard tidak punya akses admin page.
2. studio_guard bisa membuat absen miliknya sendiri.
3. owner bisa membaca, approve, reject, void semua absen.
4. self-register sebagai studio_guard tidak dibuka. Owner harus assign role ini dari data user.
```

Status absen:

```txt
pending_approval
active
closed
rejected
void
```

Approval:

```txt
pending
approved
rejected
```

Flow:

```txt
Penjaga klik Mulai Jaga
-> guardAttendanceSessions dibuat status pending_approval
-> notificationEvents dibuat ke owner/admin
-> owner approve
-> absen jadi active atau closed
-> fee penjaga di tanggal itu boleh dihitung
```

Catatan bisnis penting:

```txt
Absen dipakai sebagai bukti jaga harian, bukan cut-off jam booking.
Jika booking jam 10-12 dan penjaga absen jam 13, fee booking tanggal itu tetap boleh dihitung setelah absen disetujui owner.
```

Helper siap pakai:

```txt
hasApprovedGuardAttendanceForDate()
isGuardFeeLineEligibleByAttendance()
createGuardMealBookkeepingPayload()
```

Uang makan:

```txt
Uang makan tetap dihitung dari attendance approved per guard per tanggal, bukan dari booking.
Deterministic bookkeeping id:
guardmeal__{guardPersonId}__{YYYY-MM-DD}
```

Notifikasi:

```txt
Event baru:
guard_attendance_submitted
```

Target:

```txt
Owner/admin menerima notifikasi saat penjaga mengajukan absen.
Modal approval owner dibuat di fase UI berikutnya.
```
