# Account Role Rules - Red Team Results

1. Public list exploit: blocked; `users` requires own UID or owner.
2. Unauthorized read/write: blocked by UID ownership or approved admin/owner checks.
3. Update bypass: blocked because every user update calls `validUser`.
4. Ownership hijacking on create: blocked because document ID and `uid` must equal `request.auth.uid`.
5. Ownership hijacking on update: blocked by affected-field restrictions.
6. Immutable field modification: blocked; role conversion cannot change `createdAt` or identity fields.
7. Type juggling: blocked by `validUser`, `validPermissions`, and string validators.
8. Create-versus-update validation bypass: blocked by the same `validUser` validator on both paths.
9. Resource exhaustion: bounded strings, strict permission keys, and strict user document keys.
10. Required field omission: blocked by direct field access and validators.
11. Privilege escalation: blocked; self-create admin is always pending and self-update cannot approve.
12. Schema pollution: blocked by `keys().hasOnly(...)`.
13. Invalid state transition: blocked; the only self role transition is admin pending/rejected to client active.
14. Path traversal: not applicable; role documents contain no user-controlled resource paths.
15. Timestamp manipulation: timestamps are bounded ISO strings; role conversion may only change `updatedAt` and `adminRequestCancelledAt`.
16. Negative/overflow values: not applicable to role documents.
17. Mixed-content leak: blocked; user documents with PII are readable only by their owner or the system owner.
18. Counter replay: not applicable to role documents.
19. Orphaned subcollection access: not applicable; the model has no role subcollections.
20. Query mismatch: owner approval query remains allowed; client documents are filtered from admin approval UI.
21. Validator pattern: all user creates and updates call `validUser`.

## Race checks

- If a pending admin converts to client while an owner approval screen is open, approving only `status` would create the invalid pair `client/approved`; `validUser` rejects the write.
- If an approved admin calls client booking/profile APIs manually, `isClientAccount()` rejects the request.
- If a client calls admin APIs manually, `isApproved()` requires role `admin` plus status `approved` (or owner).

## New-account profile regression

- An authenticated `client/active` account can read its deterministic `customers/auth_{uid}` path before the document exists; the emulator returns `404`, not `403`.
- The same account can then create and read its own customer profile.
- Reading another deterministic customer path remains denied with `403`.
