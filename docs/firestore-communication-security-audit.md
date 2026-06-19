# Firestore communication rules attack audit

Target: `bookingMessages/{messageId}` and client-owned updates to `bookings/{bookingId}`.

| Attack | Outcome |
| --- | --- |
| Public list | Denied; authentication and participant/admin ownership are required. |
| Unauthorized read/write | Denied by immutable `clientUid` and booking permission checks. |
| Update bypass | Denied; message updates run the full schema validator. |
| Ownership hijack on create | Denied; client UID and sender UID must equal the auth UID and booking owner. |
| Ownership hijack on update | Denied; participants may only change their own read flag. |
| Immutable field modification | Denied by `affectedKeys().hasOnly(...)`. |
| Type juggling | Denied by explicit string, enum, bool, and timestamp-string checks. |
| Create/update validation mismatch | Denied; `validBookingMessage` runs on create and update. |
| Oversized payload | Denied; text 600, preview 180, names 120, identifiers 128 characters. |
| Required field omission | Denied by strict schema plus direct access to every required field. |
| Privilege escalation | Denied; sender role `admin` requires an approved booking admin. |
| Schema pollution | Denied by `keys().hasOnly(...)`. |
| Invalid state transition | Denied for client cancellation; only submitted/confirmed may request cancellation. |
| Path scoping | Denied; batched latest-message summary must reference a message created for the same booking and UID. |
| Timestamp manipulation | Bounded ISO strings; ordering does not grant authorization. Residual clock skew is non-authoritative. |
| Numeric overflow | Communication schema contains no client-controlled numeric counters. |
| Mixed-content leak | Denied; only the owning client and approved booking admins can read messages. |
| Counter replay | Not applicable; unread state uses booleans, not mutable counters. |
| Orphan access | Denied; message create requires an existing parent booking. |
| Query mismatch | Client query includes `bookingId` and `clientUid`; admin query is permission-gated. |
| Validator coverage | Passed; all message create/update paths call `validBookingMessage`. |

Residual risk: ISO timestamps originate from clients and should not be used as an authorization signal. They are used only for display ordering.
