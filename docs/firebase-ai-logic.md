# 37 AI — Firebase AI Logic integration

## Runtime architecture

37 AI uses the Firebase AI Logic Web SDK with the Gemini Developer API. The default model is `gemini-3.7-flash`, but the model is resolved through Firebase Remote Config so it can be changed without a frontend deployment.

The assistant supports:

- streaming multi-turn answers;
- structured JSON briefings with risks and priority actions;
- JPG, PNG, and WEBP analysis up to 7 MB;
- role-specific system instructions;
- permission-scoped, PII-minimized application context;
- App Check limited-use tokens when App Check is configured;
- no chat persistence in Firestore or localStorage.

37 AI is intentionally read-only. It never approves, pays, refunds, voids, deletes, transfers ownership, clocks attendance, or writes business data. Those operations remain in their canonical portal workflows.

## Role data boundaries

| Role | Context sent to Gemini | Data excluded |
| --- | --- | --- |
| Public booking | Selected date and only the currently visible available start hours | Visitor identity, other customers, occupied booking details |
| Client | Own booking status, schedule, service, duration, totals, and payment state | Email, phone, UID, customer data, proof URL |
| Guard | Own shift status, duration, approval state, meal amount, and recent attendance | Email, UID, other users, account credentials |
| Admin | Only the active module when its permission is enabled | Modules without permission, customer PII, proof URLs |
| Owner | Sanitized cross-module operational digest | Customer email/phone, auth data, secrets, raw proof assets |

## Required production setup

### 1. Firebase AI Logic

The Firebase project is `studio-proper` and the Web App is `37studioproper-web`.

The guided AI Logic setup must use the Gemini Developer API for this Web App. The CLI initializer may ask for the Web App interactively; if the Console flow has already completed successfully, no additional SDK key is stored in this repository.

### 2. Firebase App Check

1. In Firebase Console, open **App Check**.
2. Register `37studioproper-web` with **reCAPTCHA Enterprise**.
3. The public reCAPTCHA Enterprise site key for `studio-37.web.app` is included as the project default. It can be overridden per environment with:

   ```text
   VITE_FIREBASE_APPCHECK_SITE_KEY=<recaptcha-enterprise-site-key>
   ```

4. Enable App Check enforcement for Firebase AI Logic.
5. Enable replay protection after verifying normal traffic. The app automatically uses limited-use App Check tokens whenever App Check is initialized.

For local development only, set `VITE_FIREBASE_APPCHECK_DEBUG_TOKEN=true`, open the local app once, copy the generated debug token from the browser console, register it in Firebase App Check, and then replace `true` with that registered token. Never commit the token.

The production build intentionally disables AI calls when no App Check site key can be resolved.

### 3. Remote Config

Create these Remote Config parameters:

| Parameter | Default | Purpose |
| --- | --- | --- |
| `studio37_ai_enabled` | `true` | Emergency AI kill switch |
| `studio37_ai_model` | `gemini-3.7-flash` | Explicit stable Firebase AI Logic model |
| `studio37_ai_temperature` | `0.35` | Response creativity, clamped to `0..1` |
| `studio37_ai_max_output_tokens` | `2048` | Response ceiling, clamped to `256..4096` |

Do not use a `-latest` model alias. Review Firebase model lifecycle notices before changing the model.

## Operational safety

- AI responses are advisory and visibly labelled as potentially incorrect.
- Database values are marked as untrusted context so prompt-like content in notes cannot override system instructions.
- Context loaders unsubscribe immediately after the first snapshot.
- Admin data loaders enforce the same permission helpers used by navigation.
- High-risk operations remain unavailable to the model and require the existing confirmation/authorization workflows.
- Image attachments are processed in memory and are not written by this integration.

## Troubleshooting

- `PERMISSION_DENIED`: verify AI Logic is enabled for the Web App and App Check enforcement/debug token matches the current domain.
- `App Check production belum dikonfigurasi`: add `VITE_FIREBASE_APPCHECK_SITE_KEY` before building.
- `429` or quota message: review Gemini Developer API quota and Firebase AI Logic usage.
- Model `404`: change `studio37_ai_model` to a currently supported stable model.
