# Firebase data audit

Target: Firebase project `studio-proper`, Firestore `(default)` Standard edition.

## Authentication surfaces

- Admin: Firebase Auth email/password, Google, and phone; authorization comes from `/users/{uid}`.
- Client: Firebase Auth email/password, Google, and phone; customer identity is mirrored to `/customers/auth_{uid}`.
- Bootstrap owner: verified `marsicprod@gmail.com`; subsequent authorization uses the immutable admin role managed by the current owner.

## Firestore paths and operations

| Path | Readers | Writers | Queries |
| --- | --- | --- | --- |
| `users/{uid}` | own user, owner | self-safe fields, owner admin fields | owner list ordered by `createdAt desc` |
| `bookings/{id}` | permitted admin, owning client | permitted admin; owning client creates strict pending requests | admin `date desc`; client OR by `clientUid`, email, phone, phone key |
| `clientCalendarSlots/{id}` | authenticated users | permitted admin | `date asc` |
| `customers/{id}` | customer admin, owning client profile | customer admin, owning client profile | `createdAt desc`; equality by `phoneKey` |
| `settings/pricing` | public | settings admin | document listener |
| `settings/invoice` | public | settings admin | document listener |
| `gallery/{id}` | gallery admin | gallery admin | `createdAt desc` |
| `bookkeepingEntries/{id}` | bookkeeping admin | bookkeeping admin | `date desc` |
| `inventoryItems/{id}` | inventory admin | inventory admin | `updatedAt desc` |
| `inventoryMovements/{id}` | inventory admin | create-only by inventory admin | `createdAt desc`, limit |
| `mail/{id}` | none via client SDK | signed-in pending admin, constrained approval email only | none |
| `bookingMessages/{id}` | permitted booking admin, owning client | participants create; each participant may only mark its own read flag | equality by `bookingId`; client also filters by `clientUid` |

## Integration decisions

- Browser local storage remains only as an offline/migration cache for pricing, invoice, old bookings/customers, UI theme, and sidebar state. Firestore is authoritative for business data.
- Client profiles are synced into the CRM customer collection with immutable `authUid` ownership.
- New admin bookings resolve matching customer phone records and persist `clientUid` and email, allowing stable client ownership reads.
- Authenticated client booking actions persist a strict pending request to Firestore before opening WhatsApp; admin Schedule and Dashboard consume the same booking stream.
- Booking conversations are real-time and scoped by `bookingId` plus immutable `clientUid`; booking documents only retain the latest-message summary needed for unread indicators.
- Client cancellation is a request state, not a direct cancellation. Only an approved booking admin can confirm, reject, or finalize it.
- Public reads are limited to `settings/pricing` and `settings/invoice` because the unauthenticated client landing page renders those business-facing values.
- Gallery metadata, status, and real-time lists are admin-only and authoritative in Firestore. Image binaries remain on the existing Cloudinary service because Firebase Storage is not provisioned and billing is disabled on this project.

## Index assessment

All active ordered queries use one field and are covered by automatic single-field indexes. Client booking ownership uses OR equality filters and is sorted in the application. No composite index is currently required.
