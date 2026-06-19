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
