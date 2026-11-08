37STUDIO PROPER - REGRESSION TEST RUNNER V3
===========================================

FITUR
-----
- Menjalankan semua test yang terdaftar di scripts.test:serial.
- Tidak berhenti saat satu file test gagal.
- Menyimpan stdout dan stderr LENGKAP dari setiap test ke satu file:
  FULL-TEST-OUTPUT.txt
- Menyimpan ringkasan PASS/FAIL ke SUMMARY.txt.
- Menyimpan log individual masing-masing test (.log).
- Tetap mengembalikan exit code 1 jika ada test yang gagal.
- Output terminal dibuat ringkas agar tidak memenuhi scrollback.
- Tidak mengubah source aplikasi, dependency, commit, push, merge, atau deploy.

CARA MEMASANG
-------------
1. Ekstrak seluruh isi ZIP ke root repository 37studioproper.
2. Jika diminta, izinkan overwrite file scripts/run-all-tests.mjs dan
   install-regression-runner.ps1.
3. Buka PowerShell 7 di root repository.
4. Jalankan:

   pwsh -NoLogo -NoProfile -ExecutionPolicy Bypass -File .\install-regression-runner.ps1

Installer membuat backup package.json sebelum mengubah scripts.test.
Script test lama disimpan sebagai scripts.test:serial.
Jika runner sudah terpasang, installer tidak menimpa script lama.

CARA MENJALANKAN
----------------
Jalankan:

   npm test

OUTPUT
------
Semua laporan disimpan di folder TEMP Windows dengan pola:

   %TEMP%\37studioproper-test-report-<timestamp>\

File utama:
- FULL-TEST-OUTPUT.txt : seluruh stdout dan stderr untuk seluruh test.
- SUMMARY.txt          : ringkasan total PASS/FAIL dan daftar test gagal.
- SUMMARY.md           : ringkasan format Markdown.
- *.log                : log individual per test.

Terminal akan menampilkan lokasi FULL-TEST-OUTPUT.txt dan SUMMARY.txt.
Salin path FULL-TEST-OUTPUT.txt dari terminal, lalu buka langsung di Notepad.

CATATAN
-------
Runner melanjutkan ke file test berikutnya setelah satu file gagal. Di dalam
satu file test, assertion bawaan node:assert tetap berhenti pada assertion
pertama yang gagal. Runner mengumpulkan seluruh kegagalan antar-file test.
