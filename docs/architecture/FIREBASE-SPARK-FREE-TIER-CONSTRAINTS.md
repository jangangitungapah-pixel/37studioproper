# Firebase Spark / No-Billing Architecture Contract

**Status:** Mandatory architecture constraint  
**Effective date:** 2026-10-29  
**Applies to:** 37 Studio Proper application, Firebase project configuration, CI, and future dependencies

## Non-negotiable rule

The application must run on Firebase no-cost Spark without attaching a Google Cloud Billing account, upgrading to Blaze, or enabling a dependency that requires either. This is a product requirement, not a temporary development preference.

A change is not acceptable merely because a service has a free allowance on Blaze. Confirm that the chosen feature and configuration can be enabled on Spark with no billing account attached. Do not add billing configuration, a payment method, a Cloud Billing link, or automatic paid fallback to solve a quota or availability problem.

Official plan reference: https://firebase.google.com/docs/projects/billing/firebase-pricing-plans

## Allowed architecture

- **Firebase Authentication:** Email/password and Google sign-in. Keep role resolution and authorization checks independent of login provider.
- **Cloud Firestore:** Use within Spark quotas and enforce access with rules plus server-side authorization where applicable.
- **Firebase Hosting:** Static SPA hosting only within Spark no-cost limits. Do not point this project at Firebase App Hosting or paid Google Cloud hosting products.
- **Firebase AI Logic:** Use the Gemini Developer API backend (**GoogleAIBackend**) and only model IDs documented not to require billing. The model allowlist lives in **src/services/firebaseAiService.js**; Remote Config must not introduce an unreviewed model.
- **Admin operations:** Keep protected mutations in the existing separately hosted Cloudflare Worker. Do not migrate them to Firebase Cloud Functions. The Worker has its own provider, quotas, and secrets; verify those separately.
- **External image upload:** The current implementation uses Cloudinary, not Firebase Storage. Treat Cloudinary quota/plan as a separate external dependency and do not assume it is free without checking its current plan.

## Prohibited additions without an approved architecture change

- Firebase Phone Authentication / SMS OTP. Phone Auth is not available on Spark; SMS sends are billed per message on the billing-enabled plan.
- Firebase Cloud Functions, callable functions, or function-triggered backend logic.
- Firebase Extensions, including the Trigger Email Extension. Extensions require Blaze-accessible infrastructure and must not be used as an invisible fallback.
- Firebase Storage bucket APIs for this project. The current Spark pricing/eligibility table marks the newer default and additional bucket paths as unavailable on Spark.
- Gemini Agent Platform / Vertex AI backend, billing-required models, or preview/media models whose current documentation says billing is required.
- Firebase deploy or Extension install actions from CI before a dedicated staging project, explicit staging target checks, and deployment approvals are implemented.
- Any fallback that silently changes provider, writes to an Extension queue, enables a paid feature, or claims delivery succeeded after provider failure.

This list is a gate, not a complete list of every paid Google Cloud service. Any new SDK, API, model, Firebase product, external provider, or CI workflow must be checked against official plan and pricing documentation before merge.

## Current compatibility debt to resolve

The gate explicitly caps the already-present occurrences below to prevent them growing while follow-up work removes them:

1. SMS OTP remains referenced in **src/pages/LoginPage.jsx**, **src/pages/ClientLoginPage.jsx**, and **src/services/adminAuthRepository.js**. Replace/remove Firebase SMS flow while retaining email/password and Google login.
2. **src/services/emailService.js** falls back to writing the Firestore **mail** collection for Firebase Trigger Email Extension. Remove that fallback. Email failure must be observable, and the app must not tell the user an email was sent when delivery has not been confirmed.
3. **src/lib/firebase.js** initializes one ReCaptcha Enterprise App Check provider. This does not itself require attaching billing, but its free allowance is finite. On Essentials projects without billing, the documented 10,000 monthly organization-wide assessment allowance is enforced; requests beyond it return a quota error instead of being billed. Monitor shared quota and choose fail-safe behavior.

The AI model-selection risk is addressed by enforcing a reviewed model allowlist rather than accepting any string that happens to begin with **gemini-**.

## Spark quotas and operational behavior

Quota values and product availability can change. Recheck official pages during release review. Current published Firebase pricing/plan pages list the following Standard Firestore Spark allowances:

- 1 GiB stored data.
- 50,000 document reads per day.
- 20,000 document writes per day.
- 20,000 document deletes per day.
- 10 GiB monthly network egress.
- Firebase Hosting: 10 GB storage and 360 MB/day data transfer under the Spark allowance.
- Email/password and social sign-in are no-cost; SMS phone authentication is unavailable on Spark.
- Cloud Functions and Extensions are not available as Spark architecture dependencies.
- Firebase AI Logic does not automatically mean every model is free. With Gemini Developer API free tier, a project can remain on Spark, but model and feature selection determine billing eligibility.
- Remote Config has usage limits too; do not assume unlimited fetches. Keep configuration fetches cached and bounded.

When a no-billing quota is exhausted, fail safely and show an actionable error. Do not request billing activation or bypass quota by silently switching services.

## Automated Spark gate

Run **npm run test:spark** or **npm test**. The **Quality Gates** GitHub Actions workflow executes **npm test**, so this policy is part of CI.

The scanner checks for newly introduced SMS OTP, Firebase mail-Extension fallback, Cloud Functions, Firebase Storage, Firebase Extension installation, Vertex/Agent Platform AI, excessive App Check Enterprise provider instances, unguarded Firebase deployment workflows, and unsafe AI model overrides.

Existing known exceptions are path- and count-bounded. Reducing/removing them is allowed; adding occurrences or moving usage into a new file fails the gate. This static scanner is not a complete semantic billing analyzer: reviewers must still inspect official pricing/plan documentation when a dependency or configuration changes.

## Official references

- Firebase plan and billing requirements: https://firebase.google.com/docs/projects/billing/firebase-pricing-plans
- Firebase pricing and Spark product table / current quotas: https://firebase.google.com/pricing
- Firestore quotas and limits: https://firebase.google.com/docs/firestore/quotas
- Firebase AI Logic billing requirements: https://firebase.google.com/docs/ai-logic/pricing?api=dev
- Firebase AI Logic supported models and billing flags: https://firebase.google.com/docs/ai-logic/models?api=dev
- reCAPTCHA Enterprise billing / no-billing quota behavior: https://docs.cloud.google.com/recaptcha/docs/billing-information
- Firebase Extensions overview: https://firebase.google.com/docs/extensions/overview-use-extensions
