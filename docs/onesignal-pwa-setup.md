# OneSignal PWA Setup

## Tujuan

Phase ini menyiapkan OneSignal Web Push tanpa mengganggu root PWA service worker.

## File penting

- `public/sw.js`: root PWA service worker.
- `public/push/onesignal/OneSignalSDKWorker.js`: worker khusus OneSignal.
- `src/services/oneSignalService.js`: loader, init, identity, permission request.
- `src/components/notifications/OneSignalPermissionWidget.jsx`: widget enable notifikasi.

## Kenapa OneSignal worker di subdirectory?

App ini sudah punya root PWA service worker di `/sw.js`.
OneSignal worker dibuat di:

```txt
/push/onesignal/OneSignalSDKWorker.js
```

Scope OneSignal:

```txt
/push/onesignal/
```

Tujuannya supaya root PWA cache tetap mengontrol app shell, sedangkan OneSignal punya worker terpisah untuk push.

## Environment

Tambahkan ke `.env.local` sebelum build/deploy:

```env
VITE_ONESIGNAL_APP_ID=isi_app_id_onesignal
```

Jangan pernah menaruh OneSignal REST API Key di frontend.

## OneSignal Dashboard

Gunakan Custom Code setup.

Service worker settings:

```txt
Path to service worker files: /push/onesignal/
Service worker filename: OneSignalSDKWorker.js
Service worker registration scope: /push/onesignal/
```

Site URL harus origin Firebase Hosting, contoh:

```txt
https://studio-37.web.app
```

## Test

1. Deploy hosting.
2. Buka `/push/onesignal/OneSignalSDKWorker.js`.
3. Harus tampil importScripts OneSignal.
4. Login ke client/admin portal.
5. Klik Aktifkan Notifikasi.
6. Cek Audience di OneSignal dashboard.

## Official OneSignal Web Snippet Mapping

Dashboard snippet:

```html
<script src="https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js" defer></script>
<script>
  window.OneSignalDeferred = window.OneSignalDeferred || [];
  OneSignalDeferred.push(async function(OneSignal) {
    await OneSignal.init({
      appId: "03b8a3dc-1adf-4dfd-8758-6fd0425d6d14",
      safari_web_id: "web.onesignal.auto.18c45a69-7bf7-46f8-9483-0a7df130c3b6",
      notifyButton: {
        enable: true,
      },
    });
  });
</script>
```

Di app React ini snippet tidak ditempel langsung ke `index.html` agar SDK tidak double init.

Mapping dilakukan di:

```txt
src/services/oneSignalService.js
```

Tambahan yang tetap dipakai karena app sudah PWA:

```js
serviceWorkerPath: "push/onesignal/OneSignalSDKWorker.js"
serviceWorkerParam: { scope: "/push/onesignal/" }
```

## External ID Login sementara dimatikan

OneSignal `login(external_id)` valid untuk menyatukan subscription dengan user yang sudah dikenal, tetapi pada setup PWA ini console sempat memunculkan error:

```txt
Unrecognized operation: login-user
```

Untuk menjaga subscribe flow tetap stabil, app ini sementara memakai tags tanpa `login()`:

```txt
app=37_music_studio
role=admin/client
uid=<firebase uid>
email=<firebase email>
```

Push targeting bisa memakai filter tag `uid` atau `role`.

## OneSignal Deferred Timeout Fix

Service `oneSignalService.js` pernah memakai `OneSignalDeferred.push()` untuk setiap operasi.

Itu bisa menyebabkan timeout saat callback baru dipush setelah SDK sudah selesai memproses deferred queue.

Strategi terbaru:

```txt
1. Pakai OneSignalDeferred hanya untuk mengambil instance SDK pertama kali.
2. Simpan instance di memory.
3. Init SDK satu kali.
4. Operasi berikutnya memakai instance langsung.
5. Hindari nested getOneSignalState() dari dalam callback deferred.
```

Ini menjaga native OneSignal bell tetap aktif, tetapi tidak membuat queue callback menggantung.

## OneSignal Tags 409 Conflict Fix

Console pernah menampilkan:

```txt
PATCH OneSignal users/by/onesignal_id/... 409 Conflict
Op failed: set-property tags
```

Penyebab paling mungkin: tag sync berjalan terlalu cepat saat OneSignal SDK masih menyelesaikan operasi user/subscription internal.

Strategi terbaru:

```txt
1. Jangan kirim tags langsung di identifyOneSignalUser().
2. Jadwalkan tag sync setelah SDK stabil.
3. Retry ringan di 4.5 detik, 14 detik, dan 32 detik.
4. Conflict tidak memblokir app, subscription tetap jalan.
```

Tags yang dikirim:

```txt
app=37_music_studio
role=admin/client
uid=<firebase uid>
email=<firebase email>
```

## OS Phase 1 - Stable Subscription Foundation

Phase ini mengunci OneSignal sebagai subscription layer saja.

Status:

```txt
✅ OneSignal Web SDK init
✅ Native OneSignal bell aktif
✅ Service worker OneSignal memakai subfolder /push/onesignal/
✅ Safari Web ID masuk config
✅ Custom permission widget tidak tampil saat native bell aktif
⏸️ OneSignal.login() frontend dimatikan
⏸️ OneSignal.User.addTags() frontend dimatikan
⏸️ OneSignal.User.removeTags() frontend dimatikan
```

Alasan:

```txt
Frontend tag sync sempat menghasilkan:
PATCH /users/by/onesignal_id/... 409 Conflict
Op failed: set-property tags
```

Untuk arsitektur final, frontend tidak menyimpan REST API Key dan tidak memaksa identity/tag sync langsung ke OneSignal.

Phase berikutnya:

```txt
OS Phase 2 - Firestore Subscription Registry
```

Registry lokal akan menyimpan mapping Firebase user ke OneSignal subscription state tanpa mengandalkan tag sync frontend.

## OS Phase 3 - Notification Event Queue

Phase ini menambahkan antrean event:

```txt
notificationEvents/{eventId}
```

Tujuan:

```txt
1. App bisa mencatat event notifikasi tanpa memanggil OneSignal REST API dari frontend.
2. REST API Key OneSignal tetap tidak pernah masuk frontend.
3. Cloudflare Worker di phase berikutnya tinggal memproses event pending.
```

Tipe event awal:

```txt
booking_request_created
booking_confirmed
booking_rejected
booking_message_created
payment_proof_submitted
payment_proof_approved
payment_proof_rejected
```

Status event:

```txt
pending
processing
sent
failed
cancelled
```

Flow final:

```txt
React app
→ create notificationEvents pending
→ Cloudflare Worker reads/processes
→ OneSignal REST API sends push
→ Worker updates status
```

## OS Phase 4 - Event Trigger Wiring

Phase ini menghubungkan aksi nyata ke antrean:

```txt
notificationEvents/{eventId}
```

Trigger yang sudah dipasang:

```txt
client booking request
→ booking_request_created
→ target admin

client payment proof submit
→ payment_proof_submitted
→ target admin

admin approve payment proof
→ payment_proof_approved
→ target client

admin reject payment proof
→ payment_proof_rejected
→ target client

admin/client booking message
→ booking_message_created
→ target lawan bicara

admin confirm booking request
→ booking_confirmed
→ target client

admin reject/cancel booking request
→ booking_rejected
→ target client

client cancellation request
→ booking_message_created
→ target admin
```

Semua event dibuat setelah aksi utama sukses. Jika pembuatan event gagal, aksi utama tetap tidak dibatalkan.
