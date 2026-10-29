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

## Compatibility debt and current resolution status

- [x] **Firebase SMS OTP removed from both login entry points and the shared auth repository.** Email/password and Google remain supported. Phone numbers may still be stored as account profile data; there is no Firebase Phone Auth send/verify flow.
- [x] **Firebase Trigger Email Extension fallback removed.** Admin signup only attempts EmailJS when all three EmailJS settings are configured. Missing configuration or provider failure returns an explicit unsent result and logs a visible warning; the account/request remains saved in the normal `users/{uid}` identity record and can be reviewed in the Admin Portal. No `mail` queue write is attempted.
- [ ] **reCAPTCHA Enterprise App Check quota remains an operational risk.** **src/lib/firebase.js** initializes the existing provider. It does not itself require attaching billing, but its free allowance is finite. On Essentials projects without billing, the published 10,000 monthly organization-wide assessment allowance applies; beyond it, requests return a quota error instead of being billed. Monitor the shared quota and verify fail-safe behavior.
- [x] **AI model selection is constrained.** Remote Config can only select from the reviewed Gemini Developer API model allowlist; it can no longer switch to an arbitrary `gemini-*` identifier.

The Spark gate now rejects any remaining SMS Phone Auth or Firebase mail-Extension fallback reference in application/Worker source. All other new paid dependencies remain blocked by the corresponding rules.

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

The scanner checks for newly introduced SMS OTP, Firebase mail-Extension fallback, Cloud Functions, Firebase Storage, Firebase Extension installation, Vertex/Agent Platform AI, excessive App Check Enterprise provider instances, prohibited dependencies in root/Worker package manifests, disallowed Firebase products in firebase.json, unsafe Firebase/Cloudflare deploy workflows, and unsafe AI model overrides.

Any SMS Phone Auth or Firebase mail-Extension fallback occurrence now fails CI, regardless of path. Cloud Functions, Firebase Storage, Firebase Extensions, and Vertex/Agent Platform usage are also disallowed. The gate additionally rejects known billing-incompatible Google/Firebase package dependencies, Firebase config keys for Functions/Storage/Extensions/App Hosting/Data Connect, and any deployment action/command in routine workflows until environment isolation and explicit approval guards exist. The existing App Check Enterprise provider has a narrow count bound because it is Spark-eligible but quota-limited. This static scanner is not a complete semantic billing analyzer: reviewers must still inspect official pricing/plan documentation when a dependency or configuration changes.

## Official references

- Firebase plan and billing requirements: https://firebase.google.com/docs/projects/billing/firebase-pricing-plans
- Firebase pricing and Spark product table / current quotas: https://firebase.google.com/pricing
- Firestore quotas and limits: https://firebase.google.com/docs/firestore/quotas
- Firebase AI Logic billing requirements: https://firebase.google.com/docs/ai-logic/pricing?api=dev
- Firebase AI Logic supported models and billing flags: https://firebase.google.com/docs/ai-logic/models?api=dev
- reCAPTCHA Enterprise billing / no-billing quota behavior: https://docs.cloud.google.com/recaptcha/docs/billing-information
- Firebase Extensions overview: https://firebase.google.com/docs/extensions/overview-use-extensions
