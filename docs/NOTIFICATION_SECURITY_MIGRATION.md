# Notification security and permission migration

## Runtime contract

- The browser never receives or sends a worker shared secret.
- `/health`, `/process`, `/events/retry`, and `/events/cancel` require a Firebase ID token.
- The worker verifies the token, loads `users/{uid}`, and requires an approved Owner or Admin with Notifications permission.
- `/dispatch` keeps the existing event-actor/event-target behavior, but also requires an active canonical user record.
- Client Firestore rules cannot update or delete notification events. Status operations and immutable audit creation are worker-only.
- Processing uses an optimistic Firestore update-time precondition and a short lease. A competing worker skips an event it cannot claim.
- Normal retry accepts only `failed` or `cancelled`. A `sent` event cannot be replayed through the normal endpoint.

## Compatibility window

`permissions.notifications` is authoritative when it exists. For older approved Admin documents that do not have the key, both the app and backend temporarily use `permissions.settings` as the fallback. This keeps current access stable while the migration is reviewed.

## Safe local migration report

Export the relevant `users` documents through an approved administrative process, then place only the required fields in a local JSON file:

```json
{
  "users": [
    {
      "uid": "example-user",
      "permissions": {
        "settings": true
      }
    }
  ]
}
```

Generate a deterministic migration report locally:

```powershell
node scripts/migrate-notification-permissions.mjs --input .\users-snapshot.json --output .\notification-permission-plan.json
```

The helper has no Firebase credentials, network calls, or remote write path. It copies the legacy Settings value only when `notifications` is absent and preserves every explicit Notifications value. Feeding the generated `users` array back into the helper produces zero changes, so the transformation is idempotent.

Review `summary` and every `updates[]` row before applying the permission patches through a trusted administrative migration process. Do not commit snapshots or reports containing user data.

## Rollout order

1. Deploy the compatible Firestore rules and worker.
2. Verify Owner and a legacy Settings-enabled Admin can open authenticated health.
3. Produce and review the local migration report.
4. Apply only the reviewed `permissions.notifications` patches through trusted server credentials.
5. Verify an explicit `notifications: false` Admin cannot query the queue or call operations.
6. After all user documents are migrated, schedule removal of the Settings fallback in a separate release.

