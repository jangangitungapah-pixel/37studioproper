# Account Role Audit

## Current identity paths

- Firebase Authentication is the shared identity provider for both portals.
- `users/{uid}` currently stores admin approval data only (`owner|admin`, `pending|approved`).
- Client login and protected client pages currently trust Firebase Auth without an authoritative role document.
- Admin auth currently creates `users/{uid}` as `admin/pending` when a signed-in account has no document.

## Failure scenarios

1. A legacy client without `users/{uid}` can visit admin login and be registered as `admin/pending` while still using the client portal.
2. A pending or approved admin can enter the client portal because client guards only check whether Firebase Auth has a user.
3. Firestore `isApproved()` currently checks `status == approved` without requiring `role == admin|owner`.
4. Owner approval UI lists every `users` document, so future client identity documents could be approved accidentally.
5. Deleting an admin request document does not delete the Firebase Auth account; the next login can recreate a different role document.

## Target state machine

| Role | Status | Admin portal | Client portal |
| --- | --- | --- | --- |
| `owner` | `approved` | allowed | blocked, offer admin portal |
| `admin` | `approved` | allowed | blocked, offer admin portal |
| `admin` | `pending` | pending screen | decision: cancel admin request and become client, or cancel client login |
| `admin` | `rejected` | blocked | decision: become client, or cancel client login |
| `client` | `active` | blocked, offer client portal | allowed |

## Security requirements

- One authoritative `users/{uid}` role per Firebase Auth UID.
- Client self-create is limited to `client/active` with all admin permissions false.
- Admin self-create is limited to `admin/pending`; it cannot self-approve.
- The only client-controlled role transition is `admin/pending|rejected -> client/active`.
- Approved admin/owner cannot self-convert through the client portal.
- All client-owned Firestore operations require `client/active`, not just a matching UID/email/phone.
- All privileged Firestore operations require both an admin/owner role and approved status.
