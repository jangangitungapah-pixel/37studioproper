# Firestore audit: OneSignal removal

Target: `studio-proper/(default)` — Standard edition, Firestore Native mode.

## Paths being retired

- `notificationSubscriptions/{uid}`: browser push subscription snapshot.
- `notificationSubscriptionDevices/{deviceId}`: per-device push subscription.
- `notificationEventAudits/{auditId}`: delivery-worker audit trail.

All three paths become unused and default-denied after the browser SDK and
delivery worker are removed. Existing documents are cleanup-only data and are
not queried by the application.

## Notification events retained

`notificationEvents/{eventId}` remains as the authenticated in-app activity
feed. New documents use a strict `channel: in_app`, `provider: firestore`, and
`status: sent` schema. Creation remains actor-bound; update and delete remain
denied from clients. Existing legacy events remain readable for history but are
not dispatched.

## Queries retained

- All activity events: `collection(notificationEvents)` realtime listener.
- Optional legacy status filter: `where(status, ==, status)`.

## Attack review

- Public list/get: denied because event reads require authentication and the
  Notifications permission, actor UID, or target UID.
- Actor spoofing: denied by `notificationEventActorMatches`.
- Arbitrary fields, oversized strings, invalid types: denied by the strict
  `validNotificationEvent` validator.
- Delivery-field pollution: denied because new in-app creates must omit worker
  lease/action/provider-ID fields.
- Update/delete bypass: denied for every browser client.
- Retired subscription/audit access: denied by the final catch-all rule after
  their explicit match blocks are removed.
