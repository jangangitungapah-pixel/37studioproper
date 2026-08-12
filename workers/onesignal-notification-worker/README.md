# Studio 37 OneSignal Notification Worker

Cloudflare Worker ini memproses antrean Firestore:

```txt
notificationEvents/{eventId}
```

Lalu mengirim push lewat OneSignal REST API.

## Flow

```txt
React PWA
→ notificationEvents pending
→ Cloudflare Worker (Firebase ID token + users/{uid} authorization)
→ notificationSubscriptions
→ OneSignal REST API
→ event status sent / failed
```

## Setup

Install dependency lokal:

```powershell
cd workers/onesignal-notification-worker
npm install
Copy-Item wrangler.toml.example wrangler.toml
Copy-Item .dev.vars.example .dev.vars
```

Edit `.dev.vars` untuk local dev.

Jalankan focused security contract:

```powershell
npm test
```

## Production secrets

Jangan taruh secret di `wrangler.toml`.

Set secret production:

```powershell
cd workers/onesignal-notification-worker
npx wrangler secret put ONESIGNAL_REST_API_KEY
npx wrangler secret put FIREBASE_CLIENT_EMAIL
npx wrangler secret put FIREBASE_PRIVATE_KEY
```

Pastikan `wrangler.toml` punya vars non-secret:

```toml
FIREBASE_PROJECT_ID = "studio-proper"
ONESIGNAL_APP_ID = "03b8a3dc-1adf-4dfd-8758-6fd0425d6d14"
SITE_ORIGIN = "https://studio-37.web.app"
DEFAULT_LIMIT = "10"
```

## Local test

```powershell
npm run dev
```

Endpoint HTTP untuk health dan operasi memerlukan Firebase ID token akun aktif.
Selain `/dispatch`, akun harus berstatus Owner atau Admin yang memiliki permission
`notifications`. Dokumen lama yang belum mempunyai key tersebut sementara memakai
`settings` sebagai compatibility fallback.

Health check terautentikasi:

```powershell
$firebaseIdToken = Read-Host 'Firebase ID token'
curl.exe http://localhost:8787/health -H "Authorization: Bearer $firebaseIdToken"
```

Process pending event dry-run:

```powershell
curl.exe -X POST http://localhost:8787/process `
  -H "Authorization: Bearer $firebaseIdToken" `
  -H "Content-Type: application/json" `
  -d '{"dryRun":true,"limit":3,"reason":"Local authenticated dry-run","requestId":"local-dry-run-1"}'
```

Process pending event live:

```powershell
curl.exe -X POST http://localhost:8787/process `
  -H "Authorization: Bearer $firebaseIdToken" `
  -H "Content-Type: application/json" `
  -d '{"dryRun":false,"limit":3,"reason":"Local authenticated process","requestId":"local-process-1"}'
```

Normal production operation should use the authenticated Notification Console instead
of copying tokens into a terminal.

Each process claims a pending event with an optimistic Firestore precondition and a
short lease. Retry/cancel/process actions write immutable records to
`notificationEventAudits`. Failed or cancelled events can be retried; `sent` events
cannot be replayed through the normal endpoint.

## Deploy

```powershell
npm run deploy
```

Worker juga punya cron:

```txt
* * * * *
```

Artinya worker mencoba memproses event pending tiap 1 menit.

## OS Phase 6 - Deploy Checklist

Phase ini memakai file production config:

```txt
wrangler.toml
```

Isi `wrangler.toml` hanya vars non-secret.

Secret wajib diset lewat Wrangler dan tidak pernah dikirim ke browser:

```txt
ONESIGNAL_REST_API_KEY
FIREBASE_CLIENT_EMAIL
FIREBASE_PRIVATE_KEY
```

Deploy command:

```powershell
npm run deploy
```

Manual process command memakai Firebase ID token akun berizin:

```powershell
curl.exe -X POST "$workerUrl/process" `
  -H "Authorization: Bearer $firebaseIdToken" `
  -H "Content-Type: application/json" `
  -d '{"dryRun":true,"limit":3,"reason":"Deployment verification","requestId":"deploy-check-1"}'
```
