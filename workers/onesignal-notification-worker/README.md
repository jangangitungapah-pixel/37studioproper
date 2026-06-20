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
→ Cloudflare Worker
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

## Production secrets

Jangan taruh secret di `wrangler.toml`.

Set secret production:

```powershell
cd workers/onesignal-notification-worker
npx wrangler secret put WORKER_SECRET
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

Health check:

```powershell
curl http://localhost:8787/health
```

Process pending event dry-run:

```powershell
curl -X POST http://localhost:8787/process \
  -H "Content-Type: application/json" \
  -H "x-studio37-worker-secret: ganti-dengan-secret-panjang" \
  -d "{\"dryRun\":true,\"limit\":3}"
```

Process pending event live:

```powershell
curl -X POST http://localhost:8787/process \
  -H "Content-Type: application/json" \
  -H "x-studio37-worker-secret: ganti-dengan-secret-panjang" \
  -d "{\"limit\":3}"
```

## Deploy

```powershell
npm run deploy
```

Worker juga punya cron:

```txt
*/5 * * * *
```

Artinya worker mencoba memproses event pending tiap 5 menit.

## OS Phase 6 - Deploy Checklist

Phase ini memakai file production config:

```txt
wrangler.toml
```

Isi `wrangler.toml` hanya vars non-secret.

Secret wajib diset lewat Wrangler:

```txt
WORKER_SECRET
ONESIGNAL_REST_API_KEY
FIREBASE_CLIENT_EMAIL
FIREBASE_PRIVATE_KEY
```

Deploy command:

```powershell
npm run deploy
```

Manual process command:

```powershell
curl.exe -X POST "$workerUrl/process" `
  -H "Content-Type: application/json" `
  -H "x-studio37-worker-secret: $WORKER_SECRET" `
  -d "{\"dryRun\":true,\"limit\":3}"
```
