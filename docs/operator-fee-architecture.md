# Operator Fee Architecture Map

## Tujuan

Membuat halaman baru:

```txt
/admin/operator-fee
```

Halaman ini hanya bisa diakses owner.

Membuat subpage baru di Settings:

```txt
/admin/settings -> Fee Settings
```

Subpage ini hanya tampil dan bisa diakses owner.

## Prinsip Desain

Operator Fee bukan harga customer.

```txt
Harga customer tetap berasal dari Pricing and Session.
Operator Fee adalah biaya internal studio.
```

Flow ideal:

```txt
Schedule booking masuk
-> Operator Fee membaca booking + pricing settings
-> Owner memilih / assign penjaga studio dan operator
-> Sistem menghitung estimasi fee
-> Owner review
-> Owner posting fee ke Pembukuan sebagai expense kategori crew
```

## Default Fee yang Disempurnakan

Default awal dari request owner diterjemahkan menjadi konfigurasi fleksibel:

```txt
1. Penjaga studio rehearsal
   Rp10.000 / jam
   Berlaku untuk session Rehearsal.

2. Uang makan penjaga studio
   Rp40.000 / hari aktif
   Dihitung 1 kali per orang per tanggal jika ada jadwal assigned.

3. Komisi penjaga studio untuk recording track
   Rp50.000 / base block
   Default base block 6 jam.
   Berlaku hanya untuk penjaga yang assigned / jaga.

4. Overtime recording untuk penjaga studio
   Rp10.000 / jam overtime
   Berlaku jika durasi recording melewati base block.
   Berlaku hanya untuk penjaga yang assigned / jaga.

5. Fee operator recording track
   Rp450.000 / session block
   Default reference: harga customer Rp950.000, 6 jam.

6. Fee operator recording live
   Rp285.000 / session block
   Default reference: harga customer Rp600.000, 3 jam.
```

Catatan:

```txt
Angka di atas hanya default awal.
Owner bisa mengubah semua angka di Fee Settings.
```

## Model Konfigurasi

Collection / document utama:

```txt
settings/operatorFees
```

Shape rekomendasi:

```js
{
  updatedAt,
  updatedByUid,

  people: [
    {
      id,
      name,
      role: 'guard' | 'recording_operator' | 'both',
      active,
      defaultPaymentMethod: 'cash' | 'transfer' | 'qris' | 'other',
      note
    }
  ],

  rules: [
    {
      id,
      name,
      active,
      targetType: 'session' | 'recordingType' | 'package' | 'manual',
      targetId,
      targetLabel,

      payeeRole: 'guard' | 'recording_operator',
      calculationMode: 'hourly' | 'daily' | 'flat' | 'perBlock' | 'overtimeHourly' | 'percentage',

      amount,
      percentage,
      baseHours,
      overtimeAfterHours,

      appliesWhen: {
        pricingMode: 'session' | 'recording-type' | 'package' | 'any',
        requireAssignedPerson: true,
        onlyForNoDurationPackage: false
      },

      bookkeeping: {
        category: 'crew',
        titleTemplate
      }
    }
  ],

  options: {
    autoIncludeMeal: true,
    mealPerPersonPerDay: 40000,
    postMode: 'manual-review',
    duplicateProtection: true
  }
}
```

## Target Link ke Pricing Settings

Fee Settings harus membaca:

```txt
sessions
recordingTypes
packages
```

Dari:

```txt
src/settings/pricingSettings.js
```

Mapping contoh:

```txt
Session: Rehearsal
-> Penjaga studio Rp10.000 / jam

Recording Type: Recording Track 6 Jam
-> Penjaga studio Rp50.000 / block
-> Operator recording Rp450.000 / block
-> Overtime penjaga Rp10.000 / jam setelah 6 jam

Recording Type: Recording Live 3 Jam
-> Operator recording Rp285.000 / block

Package: Mixing + Mastering 1 Lagu
-> Bisa diset manual sebagai fee operator flat
-> Bisa no-duration package
-> Tidak harus memblok kalender
```

## Halaman Operator Fee

Halaman baru:

```txt
src/pages/admin/OperatorFeePage.jsx
```

Akses:

```txt
Owner only.
```

Isi utama:

```txt
1. Summary
   - Estimasi fee bulan ini
   - Sudah diposting ke pembukuan
   - Belum diposting
   - Jumlah shift / jadwal yang butuh assignment

2. Filter
   - Hari ini
   - Bulan ini
   - Semua
   - Belum diposting
   - Sudah diposting
   - Per orang

3. Schedule-derived fee list
   - Booking code
   - Customer / layanan
   - Tanggal
   - Assigned penjaga
   - Assigned operator
   - Estimasi fee penjaga
   - Estimasi fee operator
   - Meal
   - Total internal fee
   - Status posting

4. Actions
   - Assign penjaga
   - Assign operator
   - Override fee
   - Mark reviewed
   - Post to Pembukuan
```

## Integrasi Schedule

Schedule tetap menjadi sumber booking.

Operator Fee membaca:

```txt
bookings
pricingSettings
operatorFeeSettings
operatorFeeEntries
```

Schedule tidak langsung otomatis membuat expense.

Alur aman:

```txt
Booking masuk di Schedule
-> Muncul di Operator Fee sebagai Draft/Estimated
-> Owner assign crew/operator
-> Owner review angka
-> Owner klik Post to Pembukuan
```

Kenapa tidak auto-post?

```txt
Agar tidak dobel expense saat booking diedit, dibatalkan, atau payment belum jelas.
```

## Integrasi Pembukuan

Saat owner klik Post to Pembukuan:

```txt
createBookkeepingEntry({
  type: 'expense',
  category: 'crew',
  title: 'Operator Fee - {bookingCode} - {personName}',
  amount,
  date: booking.date,
  paymentMethod,
  note,
  source: 'operatorFee',
  sourceBookingId,
  sourceFeeEntryId
})
```

Idempotency:

```txt
sourceFeeEntryId mencegah posting dobel.
Jika sudah posted, tombol berubah menjadi "Sudah masuk pembukuan".
```

## Collection Rekomendasi

```txt
settings/operatorFees
operatorFeeEntries/{entryId}
bookkeepingEntries/{entryId}
```

operatorFeeEntries shape:

```js
{
  id,
  bookingId,
  bookingCode,
  bookingDate,

  personId,
  personName,
  personRole,

  ruleId,
  ruleName,

  amount,
  mealAmount,
  overtimeAmount,
  totalAmount,

  status: 'draft' | 'reviewed' | 'posted' | 'void',
  postedBookkeepingEntryId,

  sourcePricingType: 'session' | 'recordingType' | 'package',
  sourcePricingId,
  sourcePricingLabel,

  createdAt,
  updatedAt,
  postedAt,
  postedByUid
}
```

## Firestore Rules Rekomendasi

Owner only:

```txt
settings/operatorFees
operatorFeeEntries
```

Pembukuan tetap memakai rule existing, tetapi entry dari Operator Fee hanya dibuat lewat action owner.

## Fase Implementasi

### OPF-2: Settings Service + Firestore Rules

Membuat:

```txt
src/settings/operatorFeeSettings.js
src/services/operatorFeeRepository.js
firestore.rules patch
```

### OPF-3: Fee Settings Subpage

Patch:

```txt
SettingsPage.jsx
admin-auth.css
```

Isi:

```txt
People / Payee
Rules
Default meal
Default overtime
Target mapping ke sessions, recordingTypes, packages
```

### OPF-4: Operator Fee Page

Patch:

```txt
AdminPage.jsx
src/pages/admin/OperatorFeePage.jsx
admin-auth.css
```

Owner only.

### OPF-5: Pembukuan Integration

Patch:

```txt
operatorFeeRepository.js
bookkeepingRepository.js usage
BookkeepingPage display source operatorFee
```

### OPF-6: Schedule Integration Polish

Opsional:

```txt
Badge di booking detail:
"Fee belum direview"
"Fee sudah diposting"
```

## Guardrail

Tidak dilakukan di fase awal:

```txt
Tidak otomatis mengurangi invoice customer.
Tidak otomatis mengubah total booking.
Tidak otomatis membuat expense tanpa review owner.
Tidak membuka akses operator fee untuk admin biasa.
```
