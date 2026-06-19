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
