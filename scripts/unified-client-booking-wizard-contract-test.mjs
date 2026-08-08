import assert from 'node:assert/strict';
import {
  existsSync,
  readFileSync,
} from 'node:fs';
import {
  resolve,
} from 'node:path';

const portalSource =
  readFileSync(
    resolve(
      'src/pages/ClientPortalPage.jsx',
    ),
    'utf8',
  );

const landingSource =
  readFileSync(
    resolve(
      'src/pages/ClientLandingPage.jsx',
    ),
    'utf8',
  );

const wizardSource =
  readFileSync(
    resolve(
      'src/components/client/ClientBookingWizard.jsx',
    ),
    'utf8',
  );

const wizardCss =
  readFileSync(
    resolve(
      'src/styles/modules/client-booking-wizard.css',
    ),
    'utf8',
  );

assert.equal(
  portalSource.includes(
    "import ClientBookingWizard from '../components/client/ClientBookingWizard.jsx';",
  ),
  true,
);

assert.equal(
  portalSource.includes(
    '<ClientBookingWizard',
  ),
  true,
);

assert.equal(
  portalSource.includes(
    'Booking Simulator Modal (Interactive request booking from Empty Slot)',
  ),
  false,
  'Legacy inline simulator must be removed from ClientPortalPage.',
);

assert.equal(
  portalSource.includes(
    'return {\n        booking: createdBooking,',
  ),
  true,
  'Authenticated submit must return the created booking for confirmation.',
);

assert.equal(
  portalSource.includes(
    'handleCreatedBookingView',
  ),
  true,
);

assert.equal(
  portalSource.includes(
    'createClientBookingRequest(currentUser',
  ),
  true,
  'Authenticated Portal remains the booking write owner.',
);

assert.equal(
  landingSource.includes(
    'adminBookingRepository.createClientBookingRequest(currentUser',
  ),
  false,
  'Landing must no longer create booking requests.',
);

assert.equal(
  landingSource.includes(
    "navigate('/book');",
  ),
  true,
  'Landing booking CTA must enter public availability.',
);

assert.equal(
  landingSource.includes(
    'PILIH SLOT TERSEDIA',
  ),
  true,
);

assert.equal(
  wizardSource.includes(
    "const [\n    step,\n    setStep,\n  ] = useState(\n    'details',",
  ),
  true,
  'Wizard must start on Detail.',
);

assert.equal(
  wizardSource.includes(
    "setStep(\n                    'review',",
  ),
  true,
  'Wizard must expose Review step.',
);

assert.equal(
  wizardSource.includes(
    "setStep(\n      'confirmation',",
  ),
  true,
  'Successful submit must enter Confirmation.',
);

assert.equal(
  wizardSource.includes(
    'View Booking',
  ),
  true,
  'Confirmation primary action must be View Booking.',
);

assert.equal(
  wizardSource.includes(
    'WhatsApp',
  ),
  true,
  'Confirmation must expose WhatsApp as a secondary action.',
);

assert.equal(
  wizardSource.includes(
    'onSubmit',
  ),
  true,
);

assert.equal(
  wizardSource.includes(
    'createClientBookingRequest',
  ),
  false,
  'Wizard UI must not own Firestore booking writes.',
);

assert.equal(
  wizardSource.includes(
    'Request belum menjadi jadwal aktif sampai admin mengonfirmasinya.',
  ),
  true,
  'Wizard review must preserve request/confirmed scheduling semantics.',
);

assert.equal(
  wizardCss.includes(
    '.client-booking-wizard',
  ),
  true,
);

assert.equal(
  wizardCss.includes(
    '.client-booking-wizard-confirmation-actions',
  ),
  true,
);

assert.equal(
  existsSync(
    resolve(
      'scripts/fix-phase-4a-multiline-contract.cjs',
    ),
  ),
  false,
  'Temporary Phase 4A repair script must not remain tracked.',
);

const phase4aSource =
  readFileSync(
    resolve(
      'scripts/public-booking-entry-contract-test.mjs',
    ),
    'utf8',
  );

assert.equal(
  phase4aSource.includes(
    'Auth-resume must re-check selected slot occupancy after login.',
  ),
  true,
  'Phase 4A auth-resume guard must remain.',
);

const packageJson =
  JSON.parse(
    readFileSync(
      resolve(
        'package.json',
      ),
      'utf8',
    ),
  );

assert.equal(
  packageJson.scripts.test.includes(
    'public-booking-entry-contract-test.mjs',
  ),
  true,
);

assert.equal(
  packageJson.scripts.test.includes(
    'unified-client-booking-wizard-contract-test.mjs',
  ),
  true,
);

process.stdout.write(
  '✅ Unified Client Booking Wizard contract passed.\n',
);
