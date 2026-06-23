# Transfer Mobile Shell Audit - 37 Studio Proper

Generated at: 2026-06-23T19:34:17.611Z

## Git State

- Branch: `main`
- Last commit: `7278db1 Add comprehensive UI audit prompt for Midnight Linear + Bento Box overhaul`

```txt
M .firebase/hosting.ZGlzdA.cache
?? docs/ui-overhaul-damage-audit.json
?? docs/ui-overhaul-damage-audit.md
?? docs/ui-precision-damage-audit.json
?? docs/ui-precision-damage-audit.md
?? scripts/audit-ui-overhaul-damage.cjs
?? scripts/precision-ui-damage-audit.cjs
?? scripts/transfer-mobile-shell-audit.cjs
```

## Summary

Audit ini dibuat untuk sesi chat baru agar konteks mobile shell tidak hilang.

Fokus utama:

1. Bottom nav overlap.
2. Topbar terlalu besar.
3. CSS coverage class admin shell.
4. Guard CSS coverage.
5. File terkait yang berisiko.

## Findings

| Severity | Area | Problem | Recommendation |
| --- | --- | --- | --- |
| P1 | Mobile Shell | .admin-bottom-nav fixed, rawan overlap content. | Pastikan .admin-shell/.admin-stage/page wrapper punya padding-bottom cukup dan section terakhir punya scroll margin. |
| P1 | Mobile Shell | Bottom nav terdeteksi repeat(2), padahal screenshot menunjukkan 4 item. | Verifikasi override layer. Samakan CSS final dengan jumlah item aktual: Dashboard, Schedule, Billing, More. |
| P1 | Mobile Topbar | Title mobile memakai clamp dengan 8vw, terlihat terlalu besar di screenshot. | Compact mobile topbar: kecilkan h1 clamp, rapikan action Notifikasi/Keluar. |
| P1 | CSS Coverage | 4 admin shell class tidak ditemukan di admin-shell/primitives CSS. | admin-notification-badge, admin-notification-shortcut, admin-topbar-actions, admin-page-loading |

## CSS Blocks Snapshot

```json
{
  "adminShell": {
    "paddingBottom": "calc(90px + env(safe-area-inset-bottom))"
  },
  "adminStage": {
    "padding": "18px"
  },
  "adminTopbar": {
    "position": "sticky",
    "margin": "-18px -18px 16px",
    "padding": "16px 18px 12px"
  },
  "adminTopbarH1": {
    "fontSize": "clamp(1.48rem, 8vw, 2.1rem)",
    "lineHeight": "1"
  },
  "adminBottomNav": {
    "position": "fixed",
    "left": "12px",
    "right": "12px",
    "bottom": "calc(12px + env(safe-area-inset-bottom))",
    "zIndex": "30",
    "gridTemplateColumns": "repeat(2, minmax(0, 1fr))",
    "padding": "8px",
    "borderRadius": "24px"
  }
}
```

## Admin Shell Class Coverage

| Class | admin-shell.css | primitives-override.css | AdminPage | BottomNav | Topbar |
| --- | --- | --- | --- | --- | --- |
| admin-shell | true | true | true | false | true |
| admin-stage | true | true | true | false | false |
| admin-topbar | true | true | false | false | true |
| admin-bottom-nav | true | true | false | true | false |
| admin-bottom-item | true | true | false | true | false |
| admin-shell-icon-button | true | true | false | false | true |
| admin-notification-badge | false | false | false | false | false |
| admin-notification-shortcut | false | false | false | false | true |
| admin-topbar-actions | false | false | false | false | true |
| admin-page-loading | false | false | true | false | false |

## Guard CSS Coverage

| Class | guard-attendance.css |
| --- | --- |
| guard-shift-page | true |
| guard-shift-shell | true |
| guard-shift-card | true |
| guard-shift-hero | true |
| guard-shift-main-button | true |
| guard-shift-history | true |

## File Stats

| File | Exists | Lines | Hex Colors | Inline Styles |
| --- | --- | --- | --- | --- |
| src/styles/modules/admin-shell.css | true | 352 | 1 | 0 |
| src/styles/modules/primitives-override.css | true | 1008 | 33 | 0 |
| src/styles/admin-auth.css | true | 39 | 0 | 0 |
| src/pages/AdminPage.jsx | true | 557 | 0 | 4 |
| src/components/admin/AdminBottomNav.jsx | true | 84 | 0 | 0 |
| src/components/admin/AdminTopbar.jsx | true | 41 | 0 | 0 |
| src/styles/modules/guard-attendance.css | true | 879 | 10 | 0 |

## Recommended Next Phase

PHASE UI-D1A: Admin Mobile Shell Rescue

Goal:

1. Fix bottom nav overlap lintas halaman.
2. Compact mobile topbar.
3. Tambah safe bottom area.
4. Jangan ubah business logic.
5. Jangan refactor page besar dulu.
