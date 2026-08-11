import assert from 'node:assert/strict';

import {
  readFileSync,
} from 'node:fs';

import {
  resolve,
} from 'node:path';

function read(file) {
  return readFileSync(
    resolve(
      file,
    ),
    'utf8',
  );
}

const modalSource =
  read(
    'src/components/schedule/BookingFormModal.jsx',
  );

for (
  const required
  of [
    "import { useEffect, useMemo, useRef, useState } from 'react';",
    "from 'radix-ui';",
    'Dialog.Root',
    'Dialog.Portal',
    'Dialog.Overlay',
    'Dialog.Content',
    'Dialog.Title',
    'Dialog.Description',
    'Dialog.Close',
    'data-booking-modal-ui="ui-3c-mobile-first"',
    'bookingFormLayoutRef',
    'bookingStepItems',
    'nextBookingStepKey',
    'navigateToBookingStep',
    'booking-step-rail',
    'booking-step-jump',
    'aria-label="Langkah Booking"',
    "aria-current={",
    "scrollIntoView({",
    "preventScroll: true",
    'booking-form-layout',
    'booking-form-fields',
    'booking-form-section',
    'booking-form-summary',
    'booking-summary-hero',
    'booking-summary-slot',
    'booking-summary-money',
    'booking-modal-progress',
    'bookingStepStates',
    'completedStepCount',
    'bookingReadinessLabel',
    'customerStepComplete',
    'serviceStepComplete',
    'slotStepComplete',
    'paymentStepComplete',
    'booking-summary-readiness',
    'data-booking-step="customer"',
    'data-booking-step="service"',
    'data-booking-step="slot"',
    'data-booking-step="payment"',
    'formatBookingModalDate',
    'Estimasi tagihan',
    'Slot preview',
  ]
) {
  assert.equal(
    modalSource.includes(
      required,
    ),
    true,
    'UI-3C modal missing: ' +
      required,
  );
}

assert.equal(
  modalSource.indexOf(
    'className="booking-form-summary"'
  ) <
    modalSource.indexOf(
      'className="booking-form-fields"'
    ),
  true,
  'UI-3C summary must precede the fields in DOM for mobile-first reading order.',
);

for (
  const deprecated
  of [
    'data-booking-modal-ui="ui-3b-guided"',
    'handleBackdropClick',
    "document.addEventListener('keydown', handleKeyDown);",
    "document.body.style.overflow = 'hidden';",
    'role="presentation"',
    'role="dialog"',
    'aria-modal="true"',
  ]
) {
  assert.equal(
    modalSource.includes(
      deprecated,
    ),
    false,
    'UI-3C must remove deprecated modal behavior/marker: ' +
      deprecated,
  );
}

for (
  const invariant
  of [
    'const [isSaving, setIsSaving] = useState(false);',
    'if (isSaving) return;',
    'didSave = await onSave({',
    '} catch (saveError) {',
    'disabled={isSaving}',
    "'Menyimpan...'",
    'buildInitialPaymentHistory({',
    'resolveBookingPricing({',
    'paymentHistory,',
    'paidAmount,',
    'invoiceAmount,',
    'paymentStatus: resolvedPaymentStatus,',
    'status: resolvedPaymentStatus,',
    'createdAt: editingBooking?.createdAt || now,',
    "updatedAt: editingBooking ? now : '',",
  ]
) {
  assert.equal(
    modalSource.includes(
      invariant,
    ),
    true,
    'Booking save invariant missing: ' +
      invariant,
  );
}

for (
  const field
  of [
    'booking-name',
    'booking-band-name',
    'booking-phone',
    'booking-date',
    'booking-custom-duration',
    'booking-dp-amount',
    "updateValue('packageId')",
    "updateValue('sessionType')",
    "updateValue('recordingTypeId')",
    "updateValue('startHour')",
    "updateValue('duration')",
    "updateValue('paymentStatus')",
    "updateValue('paymentMethod')",
  ]
) {
  assert.equal(
    modalSource.includes(
      field,
    ),
    true,
    'Booking field/control missing: ' +
      field,
  );
}

assert.equal(
  modalSource.includes(
    'disabled={!isBookingReady || isSaving}'
  ),
  false,
  'Readiness presentation must not replace authoritative submit validation.',
);

const saveContract =
  read(
    'scripts/calendar-booking-save-regression-test.mjs',
  );

for (
  const invariant
  of [
    'didSave = await onSave({',
    'disabled={isSaving}',
  ]
) {
  assert.equal(
    saveContract.includes(
      invariant,
    ),
    true,
    'Calendar booking save contract lost invariant: ' +
      invariant,
  );
}

const bookingCss =
  read(
    'src/styles/modules/booking.css',
  );

const cssMarker =
  '/* UI-3C — Mobile-First Booking Composer */';

const modalCssStart =
  bookingCss.indexOf(
    cssMarker,
  );

assert.notEqual(
  modalCssStart,
  -1,
  'UI-3C mobile-first CSS marker must exist.',
);

const modalCss =
  bookingCss.slice(
    modalCssStart,
  );

assert.match(
  modalCss,
  /\/\* UI-3C\.1 — Slot Studio field baseline alignment \*\/[\s\S]*?\.booking-form-section-grid\.is-slot-grid\s*\{[\s\S]*?align-items:\s*end;/,
  'UI-3C.1 Slot Studio date, start time, and duration controls must share one bottom baseline.',
);

const compactModalCss =
  modalCss
    .replace(
      /\s+/g,
      ' ',
    )
    .trim();

for (
  const required
  of [
    ".booking-modal-panel[data-booking-modal-ui='ui-3c-mobile-first']",
    'position: fixed;',
    'bottom: calc(6px + env(safe-area-inset-bottom));',
    'translate: -50% 0;',
    'grid-template-rows: auto auto minmax(0, 1fr);',
    '.booking-step-rail',
    '.booking-step-jump',
    'min-height: 44px;',
    '.booking-form-layout',
    "grid-template-areas: 'summary' 'fields';",
    '.booking-form-fields',
    '.booking-form-section',
    'scroll-margin-top: 10px;',
    '.booking-form-section-grid',
    '.booking-form-summary',
    '.booking-summary-readiness',
    '.booking-summary-hero',
    '.booking-summary-slot',
    '.booking-summary-money',
    '.booking-form-actions',
    'min-height: 48px;',
    'env(safe-area-inset-bottom)',
    '@media (min-width: 768px)',
    'top: 50%;',
    'bottom: auto;',
    'translate: -50% -50%;',
    "grid-template-areas: 'fields summary';",
    'position: sticky;',
    '@media (min-width: 1024px)',
    '@media (max-width: 340px)',
    '@media (forced-colors: active)',
    '@media (prefers-reduced-motion: reduce)',
    '--studio-surface-1',
    '--studio-surface-2',
    '--studio-surface-floating',
    '--studio-text-primary',
    '--studio-text-secondary',
    '--studio-text-tertiary',
    '--studio-edge-soft',
    '--studio-edge-normal',
    '--studio-accent',
    '--studio-accent-soft',
    '--studio-success',
    '--studio-warning',
    '--studio-danger',
  ]
) {
  assert.equal(
    compactModalCss.includes(
      required,
    ),
    true,
    'UI-3C modal CSS missing: ' +
      required,
  );
}

const basePanelStart =
  compactModalCss.indexOf(
    ".booking-modal-panel[data-booking-modal-ui='ui-3c-mobile-first'] {"
  );

const basePanelEnd =
  compactModalCss.indexOf(
    ".booking-modal-panel[data-booking-modal-ui='ui-3c-mobile-first'] .booking-modal-head",
    basePanelStart,
  );

const basePanelCss =
  compactModalCss.slice(
    basePanelStart,
    basePanelEnd,
  );

for (
  const required
  of [
    'position: fixed;',
    'bottom: calc(6px + env(safe-area-inset-bottom));',
    '--z-modal-backdrop',
    'translate: -50% 0;',
  ]
) {
  assert.equal(
    basePanelCss.includes(
      required,
    ),
    true,
    'UI-3C mobile base panel missing: ' +
      required,
  );
}

assert.match(
  modalCss,
  /@media \(min-width: 768px\)[\s\S]*?\.booking-step-rail\s*\{[\s\S]*?display:\s*none;/,
  'UI-3C desktop must hide the mobile step rail.',
);

assert.match(
  modalCss,
  /@media \(min-width: 768px\)[\s\S]*?\.booking-form-summary\s*\{[\s\S]*?position:\s*sticky;[\s\S]*?top:\s*0;/,
  'UI-3C desktop live summary must remain sticky.',
);

assert.equal(
  modalCss.includes(
    '--auth-'
  ),
  false,
  'UI-3C CSS must use Spatial semantic tokens.',
);

const rawHexMatches =
  modalCss.match(
    /#[0-9a-fA-F]{3,8}/g,
  ) ||
  [];

assert.equal(
  rawHexMatches.length,
  0,
  'UI-3C CSS must not contain raw hex colors.',
);

for (
  const accessibility
  of [
    'Dialog.Title',
    'Dialog.Description',
    'aria-busy={',
    'aria-label="Ringkasan booking"',
    'aria-label="Detail pembayaran"',
    'aria-label="Langkah Booking"',
    'aria-current={',
    '@media (forced-colors: active)',
    '@media (prefers-reduced-motion: reduce)',
  ]
) {
  assert.equal(
    (
      modalSource +
      modalCss
    ).includes(
      accessibility,
    ),
    true,
    'UI-3C accessibility marker missing: ' +
      accessibility,
  );
}

const packageJson =
  JSON.parse(
    read(
      'package.json',
    ),
  );

for (
  const forbidden
  of [
    '@mui/material',
    'antd',
    'bootstrap',
    '@chakra-ui/react',
    '@mantine/core',
  ]
) {
  assert.equal(
    Boolean(
      packageJson
        .dependencies[
          forbidden
        ],
    ),
    false,
    'UI-3C must not introduce generic visual framework: ' +
      forbidden,
  );
}

assert.equal(
  packageJson
    .dependencies[
      'radix-ui'
    ] !==
    undefined,
  true,
  'UI-3C expects the existing radix-ui dependency.',
);

assert.equal(
  packageJson
    .scripts
    .test
    .includes(
      'admin-spatial-booking-form-modal-contract-test.mjs'
    ),
  true,
  'UI-3C modal contract must remain registered.',
);

process.stdout.write(
  '✅ Admin Mobile-First Booking Composer UI-3C contract passed.\n',
);
