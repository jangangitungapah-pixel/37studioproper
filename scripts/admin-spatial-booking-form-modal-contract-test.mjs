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
    "from 'radix-ui';",
    'Dialog.Root',
    'Dialog.Portal',
    'Dialog.Overlay',
    'Dialog.Content',
    'Dialog.Title',
    'Dialog.Description',
    'Dialog.Close',
    'data-booking-modal-ui="ui-3a-spatial"',
    'booking-form-layout',
    'booking-form-fields',
    'booking-form-section',
    'booking-form-summary',
    'booking-summary-hero',
    'booking-summary-slot',
    'booking-summary-money',
    'formatBookingModalDate',
    'Live booking quote',
    'Slot preview',
  ]
) {
  assert.equal(
    modalSource.includes(
      required,
    ),
    true,
    'UI-3A modal missing: ' +
      required,
  );
}

/**
 * Radix owns modal behavior.
 */
for (
  const deprecated
  of [
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
    'UI-3A must remove manual dialog behavior: ' +
      deprecated,
  );
}

/**
 * Save/payment semantics remain unchanged.
 */
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

/**
 * Form fields remain operationally equivalent.
 */
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

/**
 * Existing Calendar save regression remains permanent.
 */
const saveContract =
  read(
    'scripts/calendar-booking-save-regression-test.mjs',
  );

assert.equal(
  saveContract.includes(
    'didSave = await onSave({'
  ),
  true,
  'Calendar booking save contract must still validate onSave.',
);

assert.equal(
  saveContract.includes(
    'disabled={isSaving}'
  ),
  true,
  'Calendar booking save contract must still validate saving lock.',
);

/**
 * CSS scope.
 */
const bookingCss =
  read(
    'src/styles/modules/booking.css',
  );

const cssMarker =
  '/* UI-3A — Spatial Booking Form Modal */';

const modalCssStart =
  bookingCss.indexOf(
    cssMarker,
  );

assert.notEqual(
  modalCssStart,
  -1,
  'UI-3A spatial modal CSS marker must exist.',
);

const modalCss =
  bookingCss.slice(
    modalCssStart,
  );

/**
 * UI-3A.1 dialog stacking regression
 *
 * Radix Dialog.Content is a sibling of Dialog.Overlay inside
 * the Portal. The content must therefore own a fixed positioned
 * layer above --z-modal-backdrop.
 */
const compactModalCss =
  modalCss
    .replace(
      /\s+/g,
      ' ',
    )
    .trim();

const spatialPanelSelector =
  ".booking-modal-panel[data-booking-modal-ui='ui-3a-spatial'] {";

const spatialPanelStart =
  compactModalCss.indexOf(
    spatialPanelSelector,
  );

assert.notEqual(
  spatialPanelStart,
  -1,
  'UI-3A spatial modal panel selector must exist.',
);

const spatialPanelEnd =
  compactModalCss.indexOf(
    ".booking-modal-panel[data-booking-modal-ui='ui-3a-spatial'] .booking-modal-head",
    spatialPanelStart,
  );

assert.notEqual(
  spatialPanelEnd,
  -1,
  'UI-3A spatial modal base panel region must be readable.',
);

const spatialPanelCss =
  compactModalCss.slice(
    spatialPanelStart,
    spatialPanelEnd,
  );

for (
  const required
  of [
    'position: fixed;',
    'top: 50%;',
    'left: 50%;',
    '--z-modal-backdrop',
    'translate: -50% -50%;',
  ]
) {
  assert.equal(
    spatialPanelCss.includes(
      required,
    ),
    true,
    'UI-3A modal stacking missing: ' +
      required,
  );
}

assert.equal(
  compactModalCss.includes(
    'translate: -50% 0;'
  ),
  true,
  'UI-3A mobile modal must remain a bottom-positioned sheet.',
);

assert.equal(
  compactModalCss.includes(
    'bottom: 0;'
  ),
  true,
  'UI-3A narrow mobile modal must remain anchored to viewport bottom.',
);

for (
  const required
  of [
    '.booking-modal-backdrop',
    ".booking-modal-panel[data-booking-modal-ui='ui-3a-spatial']",
    '.booking-modal-heading',
    '.booking-modal-kicker',
    '.booking-form-layout',
    '.booking-form-fields',
    '.booking-form-section',
    '.booking-form-section-grid',
    '.booking-form-summary',
    '.booking-summary-hero',
    '.booking-summary-slot',
    '.booking-summary-money',
    '.booking-form-actions',
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
    '@media (max-width: 767px)',
    '@media (max-width: 390px)',
    '@media (max-width: 340px)',
    '@media (forced-colors: active)',
    '@media (prefers-reduced-motion: reduce)',
  ]
) {
  assert.equal(
    modalCss.includes(
      required,
    ),
    true,
    'UI-3A modal CSS missing: ' +
      required,
  );
}

assert.equal(
  modalCss.includes(
    '--auth-'
  ),
  false,
  'UI-3A modal CSS must use Spatial semantic tokens.',
);

const rawHexMatches =
  modalCss.match(
    /#[0-9a-fA-F]{3,8}/g,
  ) ||
  [];

assert.equal(
  rawHexMatches.length,
  0,
  'UI-3A modal CSS must not contain raw hex colors.',
);

/**
 * Dialog accessibility.
 */
for (
  const accessibility
  of [
    'Dialog.Title',
    'Dialog.Description',
    'aria-busy={',
    'aria-label="Ringkasan booking"',
    'aria-label="Detail pembayaran"',
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
    'UI-3A accessibility marker missing: ' +
      accessibility,
  );
}

/**
 * No new presentation framework.
 */
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
    'UI-3A must not introduce generic visual framework: ' +
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
  'UI-3A expects the existing radix-ui dependency.',
);

assert.equal(
  packageJson
    .scripts
    .test
    .includes(
      'admin-spatial-booking-form-modal-contract-test.mjs'
    ),
  true,
  'UI-3A modal contract must be registered.',
);

process.stdout.write(
  '✅ Admin Spatial Booking Form Modal UI-3A contract passed.\n',
);
