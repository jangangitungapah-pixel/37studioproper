# Workplan Admin Operations Roadmap

| Metadata | Nilai |
| --- | --- |
| Produk | 37 Music Studio |
| Area | Admin Operations |
| Status dokumen | Source of truth untuk rangkaian Phase 0–4 |
| Baseline audit | `audit/foundation-and-admin-portal-2026-10-20` |
| Baseline SHA saat dokumen dibuat | `8df5cc49d5d65407dcebf3cf253b63a6818359fc` |
| Tanggal pembaruan | 5 November 2026 |
| Governance | Tidak ada merge atau deployment tanpa approval eksplisit Owner |

Dokumen ini mengonsolidasikan scope, urutan, dependency, acceptance criteria, dan status implementasi Phase 0–4. Deskripsi PR menjadi catatan implementasi; dokumen ini menjadi acuan lintas sesi.

## 1. Aturan kerja dan governance

1. Semua phase 0–4 dikembangkan pada branch terpisah dan membuat Draft PR menuju baseline audit, bukan langsung ke `main`.
2. Jangan merge PR atau deploy aplikasi/Worker tanpa approval eksplisit Owner.
3. Seluruh mutasi data operasional yang sensitif harus melewati Admin Operations Worker, menggunakan autentikasi dan permission server-side, idempotency key, revision/precondition, actor attribution, serta audit record.
4. Data event dan ledger yang dinyatakan immutable tidak boleh diedit atau dihapus melalui browser.
5. Pertahankan kompatibilitas Firebase Spark/free-tier. Jangan menambahkan layanan Firebase yang membutuhkan billing atau mengubah batasan biaya yang ada.
6. Build, lint, regression tests, Firestore Rules emulator, dan browser smoke harus dijalankan sebelum PR dinyatakan siap review. Status statis atau inspeksi kode bukan pengganti hasil test.
7. Jangan menganggap suatu phase selesai hanya karena implementasi tersedia. Status selesai memerlukan acceptance criteria terpenuhi, verifikasi lulus, review Owner, dan merge yang disetujui.

## 2. Baseline dan urutan phase

| Urutan | Scope | PR | Branch | Status per 2026-11-05 |
| --- | --- | --- | --- | --- |
| Foundation | Audit dan hardening baseline | [#1](https://github.com/jangangitungapah-pixel/37studioproper/pull/1) | `audit/foundation-and-admin-portal-2026-10-20` | Draft, open; baseline audit |
| Phase 0 | Inventory Data Integrity | [#2](https://github.com/jangangitungapah-pixel/37studioproper/pull/2) | `feature/phase-0-inventory-integrity-2026-11-05` | Draft, open; belum merged |
| Phase 1 | Session Operations | [#3](https://github.com/jangangitungapah-pixel/37studioproper/pull/3) | `feature/phase-1-session-operations-2026-11-05` | Draft, open; belum merged |
| Phase 2 | Daily Closing & Reconciliation | [#4](https://github.com/jangangitungapah-pixel/37studioproper/pull/4) | `feature/phase-2-daily-closing-2026-11-05` | Draft, open; belum merged |
| Phase 3 | Equipment Maintenance | [#5](https://github.com/jangangitungapah-pixel/37studioproper/pull/5) | `feature/phase-3-equipment-maintenance-2026-11-05` | Draft, open; hardening + verification berjalan |
| Phase 4 | Persistent Customer Follow-up | [#6](https://github.com/jangangitungapah-pixel/37studioproper/pull/6) | `feature/phase-4-customer-follow-up-2026-11-05` | Draft, open; belum merged |

Semua phase PR #2–#6 saat ini menargetkan baseline audit. Jangan mengubah target PR tanpa keputusan arsitektur dan persetujuan Owner.

## 3. Foundation: audit baseline

Baseline audit adalah hasil pemeriksaan foundation, Admin Portal, Client Portal, authentication, dan public booking. PR #1 mencatat hardening booking handoff, concurrency, finance, ownership, role/security, CI quality gates, dan kesiapan staging.

Acceptance gate foundation:
- Public landing, planner, dan booking handoff bekerja dengan validasi tanggal/jam serta redirect yang aman.
- Mutasi booking dan finance yang sensitif memiliki server-side authorization, idempotency, concurrency precondition, dan regression coverage.
- Role/ownership hanya mengikuti sumber otoritatif; transfer ownership tidak meninggalkan Owner lama dengan akses permanen.
- Firebase Spark compatibility gate tetap aktif.
- Firestore Rules emulator, build, lint, regression, dan responsive smoke lulus.
- Staging acceptance terpisah dari production dan tidak boleh menggunakan data production untuk tes mutasi.

Catatan baseline: PR #1 masih Draft/open. Browser smoke dan quality gates pada baseline pernah lulus, tetapi authenticated Admin acceptance serta live staging data-flow tetap merupakan pekerjaan terpisah sampai staging Firebase project, site/Worker, dan test identities tersedia.

## 4. Phase 0 — Inventory Data Integrity

**PR:** #2 — [fix(inventory): make inventory metadata writes atomic](https://github.com/jangangitungapah-pixel/37studioproper/pull/2)

Scope:
- Route create/update/archive inventory metadata melalui Admin Operations Worker.
- Gabungkan perubahan item dan inventory movement dalam satu atomic Firestore commit.
- Gunakan idempotency key, update-time precondition, actor attribution, dan operation audit.
- Hilangkan browser-side direct writes untuk inventory movement dan lindungi canonical writes dengan Firestore Rules.

Acceptance criteria:
- Create/update/archive tidak dapat membuat metadata dan movement berada pada keadaan yang berbeda.
- Quantity hanya berubah melalui inventory adjustment operation yang terproteksi.
- Retry dengan idempotency key yang sama tidak menggandakan movement.
- Request dengan revision kedaluwarsa ditolak sebagai conflict.
- Client tidak dapat menulis canonical movement atau operation audit.
- Regression contract, Firestore Rules emulator, build, dan lint lulus.

## 5. Phase 1 — Session Operations

**PR:** #3 — [feat(sessions): add audited session operations](https://github.com/jangangitungapah-pixel/37studioproper/pull/3)

Scope:
- Worker-only lifecycle commands: check-in, start, complete, no-show, cancel, dan Owner correction.
- Persist status booking dan immutable `bookingSessionEvents` secara atomik.
- Integrasi action ke shared Booking Detail Drawer dari Request Inbox dan All Bookings.
- Mencegah generic booking edit mengubah session status.

Acceptance criteria:
- Transisi status mengikuti state machine dan validasi waktu.
- No-show tidak dapat ditandai sebelum 30 menit setelah jadwal selesai atau setelah session check-in/start.
- Session lewat tanpa bukti eksekusi menjadi `needs_review`, bukan auto-completed.
- No-show, cancellation, dan correction mewajibkan alasan.
- Concurrency, idempotency, actor attribution, dan immutable event diverifikasi.
- Firestore Rules menolak browser writes pada event collection.

## 6. Phase 2 — Daily Closing & Reconciliation

**PR:** #4 — [feat(finance): add daily closing and reconciliation](https://github.com/jangangitungapah-pixel/37studioproper/pull/4)

Scope:
- Workspace Daily Closing di Admin Bookkeeping.
- Business date, opening cash float, physical cash count, dan rekonsiliasi transfer/QRIS/kanal lain.
- Server-side ledger preview berdasarkan business date, bukan hasil dari daftar UI yang dibatasi.
- Persist closing snapshot dan immutable audit event.
- Owner-only reopen dengan alasan wajib.

Acceptance criteria:
- Expected cash dan reconciliation dihitung dari seluruh ledger untuk business date terkait.
- Snapshot merekam ledger event IDs/count, expected/count cash, variance, metode pembayaran, actor, dan timestamp.
- Close/reopen idempotent dan menggunakan Firestore update-time precondition.
- Reopen hanya tersedia bagi Owner aktif dengan alasan.
- Manual bookkeeping writes melewati Worker; browser repository menjadi read-only untuk operasi yang diproteksi.
- Firestore Rules menolak browser writes pada closing dan closing event.

## 7. Phase 3 — Equipment Maintenance

**PR:** #5 — [feat(inventory): add equipment maintenance operations](https://github.com/jangangitungapah-pixel/37studioproper/pull/5)

**Status implementasi:** fitur awal telah ada; hardening workflow dan test coverage ditambahkan pada branch Phase 3. PR tetap Draft/open dan belum merged.

Scope:
- Workspace Equipment Maintenance di area Inventory.
- Buat work order dari inventory item aktif atau rusak.
- Catat judul, gejala/deskripsi, prioritas, target selesai, pelapor, teknisi/PIC, diagnosis, spare part, resolusi, dan biaya.
- Alur status: `reported` → `triaged` → `assigned` → `in_progress` ↔ `waiting_parts` → `completed` → `verified`; status aktif juga dapat menjadi `cancelled` melalui alasan yang tercatat.
- Mutasi work order, inventory item, maintenance event, inventory movement, dan bookkeeping expense dilakukan secara server-authoritative melalui Worker.
- Maintenance events dan expense sumber maintenance immutable dari browser.

Acceptance criteria:
- Work order tampil realtime dan tetap muncul setelah reload melalui Firestore subscription.
- Item yang sudah memiliki work order aktif tidak dapat dibuatkan work order duplikat; item inactive/lost tidak dapat dipilih.
- PIC wajib ditentukan sebelum pekerjaan ditugaskan/dimulai dan tercatat pada work order.
- State transition hanya menerima jalur yang diizinkan; client wajib mengirim revision work order dan stale revision ditolak.
- Perubahan detail tanpa perubahan status tetap membuat audit event `details_updated`.
- Status `waiting_parts` dapat dilanjutkan ke `in_progress` atau `completed`.
- Penyelesaian wajib mengirim nominal biaya valid; angka 0 sah untuk pekerjaan tanpa biaya, string kosong/null tidak sah.
- Biaya positif diposting ke bookkeeping dalam transaksi atomik dengan referensi sumber maintenance yang immutable dan duplicate-post guard.
- Verifikasi hanya oleh Owner/Admin dan wajib memilih kondisi hasil pemeriksaan (`good`, `fair`, atau `broken`); kondisi akhir inventory mengikuti hasil verifikasi.
- Pembatalan wajib memiliki alasan, mengembalikan status/kondisi inventory sebelumnya, dan mempertahankan histori event.
- Firestore Rules menolak browser writes untuk work order dan maintenance events.
- Domain behavior test, maintenance contract test, full regression, Firestore Rules emulator, build, lint, dan responsive browser smoke lulus.

Perbaikan yang tercatat pada branch saat dokumen ini dibuat:
- `d06fb95`: listener realtime, penugasan dan state transition UI, biaya/verifikasi/pembatalan, CSS, contract/domain test.
- `5873794`: guard biaya kosong dan perluasan behavior test untuk PIC, revision, waiting parts, dan penyelesaian.
- `b6c767c`: gunakan semantic token `--studio-danger` pada error state agar sesuai kontrak UI-9.
- Quality Gates run [#136](https://github.com/jangangitungapah-pixel/37studioproper/actions/runs/42015241271) pada commit `b6c767c` sukses penuh: production build, ESLint, `npm test`, `npm run test:prd` termasuk Firestore Rules emulator, responsive browser smoke, dan upload screenshot artifact `browser-responsive-smoke`.

## 8. Phase 4 — Persistent Customer Follow-up

**PR:** #6 — [feat(customers): add persistent follow-up task center](https://github.com/jangangitungapah-pixel/37studioproper/pull/6)

Scope:
- Ubah shortlist Follow-up Center yang sebelumnya dihitung menjadi persisted customer follow-up tasks.
- Field due date, assignee/PIC, title, description, template, status, outcome, dan notes.
- Queue Due Today, Overdue, Upcoming, dan Completed.
- Snooze/reschedule, draft WhatsApp opening, manual outcome capture, dan task completion.
- Append-only `customerFollowUpEvents` dengan actor dan timestamp; tampilkan histori per task.
- Firestore Rules menolak browser writes pada task/event; index mendukung pembacaan event history.

Acceptance criteria:
- Task dan histori event tetap tersedia setelah reload dan tersinkron antar pengguna berizin.
- Membuka WhatsApp draft tidak otomatis menandai customer sudah dihubungi.
- Outcome hanya berubah setelah operator mencatat hasil secara eksplisit.
- Task status dan event history konsisten, immutable, dan memiliki actor/time attribution.
- Due date queue memiliki batas dan urutan yang benar untuk overdue/today/upcoming/completed.
- Security rules, regression, build, lint, dan UI smoke diverifikasi.

## 9. Dependency dan urutan lintas phase

- Phase 0 menjadi kontrak canonical inventory metadata/movement untuk Phase 3.
- Phase 1 membangun lifecycle session dan evidence yang dapat menjadi dasar data operasional/keuangan berikutnya.
- Phase 2 menggunakan ledger dari transaksi sebelumnya dan menambahkan closing snapshot tanpa mengubah histori sumber.
- Phase 3 bergantung pada inventory canonical mutation dari Phase 0 dan bookkeeping protection dari foundation/Phase 2.
- Phase 4 menggunakan customer identity dan access boundary hasil foundation audit.

Phase boleh dikembangkan paralel pada branch masing-masing, tetapi jangan menggabungkan branch antar-phase atau mengubah baseline tanpa evaluasi dependency dan persetujuan Owner.

## 10. Release checklist lintas phase

- [ ] Acceptance criteria phase terpenuhi dan dicatat.
- [ ] `npm ci` berhasil dari lockfile.
- [ ] `npm run build` lulus.
- [ ] `npm run lint` lulus.
- [ ] `npm test` lulus termasuk domain/contract regression phase terkait.
- [ ] `npm run test:prd` lulus termasuk Firestore Rules emulator.
- [ ] Responsive browser smoke lulus untuk viewport yang ditetapkan.
- [ ] Tidak ada browser write path untuk canonical operations atau immutable event/ledger.
- [ ] No production data mutation atau deployment saat validasi.
- [ ] Owner review dan approval eksplisit sebelum merge/deploy.

## 11. Current next action

Fokus berjalan: selesaikan Phase 3 PR #5 di branch `feature/phase-3-equipment-maintenance-2026-11-05`, tunggu semua Quality Gates run #135, perbaiki kegagalan bila ada, lalu minta review Owner. Jangan mulai merge Phase 3 atau mengubah PR menjadi ready-for-review secara otomatis.
