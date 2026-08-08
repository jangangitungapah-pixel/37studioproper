import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const scheduleSource = readFileSync(
  resolve('src/pages/admin/SchedulePage.jsx'),
  'utf8',
);

const formSource = readFileSync(
  resolve('src/components/schedule/BookingFormModal.jsx'),
  'utf8',
);

assert.equal(
  scheduleSource.includes(
    'resolveBookingCustomerIdentity(booking, current => bookings)',
  ),
  false,
  'Calendar save must not pass a function to customer identity resolution.',
);

assert.equal(
  scheduleSource.includes(
    'resolveBookingCustomerIdentity(booking, bookings)',
  ),
  true,
  'Calendar save must pass the bookings array.',
);

const resolverStart = scheduleSource.indexOf(
  'function resolveBookingCustomerIdentity(',
);

const resolverEnd = scheduleSource.indexOf(
  'function getBookingStatus(',
  resolverStart,
);

const resolverSource = scheduleSource.slice(
  resolverStart,
  resolverEnd,
);

assert.equal(
  resolverSource.includes(
    'currentBookings.filter(',
  ),
  true,
  'Customer resolver must consume an array.',
);

assert.equal(
  formSource.includes(
    'const [isSaving, setIsSaving] = useState(false);',
  ),
  true,
);

assert.equal(
  formSource.includes(
    'if (isSaving) return;',
  ),
  true,
);

assert.equal(
  formSource.includes(
    'disabled={isSaving}',
  ),
  true,
);

assert.equal(
  formSource.includes(
    "'Menyimpan...'",
  ),
  true,
);

assert.equal(
  formSource.includes(
    'didSave = await onSave({',
  ),
  true,
);

assert.equal(
  formSource.includes(
    '} catch (saveError) {',
  ),
  true,
);

process.stdout.write('✅ Calendar booking save regression contract passed.\n');
