import assert from 'node:assert/strict';
import {
  readFileSync,
} from 'node:fs';
import {
  resolve,
} from 'node:path';

function read(
  file,
) {
  return readFileSync(
    resolve(
      file,
    ),
    'utf8',
  );
}

const repositorySource =
  read(
    'src/services/paymentProofRepository.js',
  );

const billingSource =
  read(
    'src/pages/admin/BillingPage.jsx',
  );

const commandSource =
  read(
    'src/components/billing/PaymentProofCommandCenter.jsx',
  );

const cssSource =
  read(
    'src/styles/modules/billing.css',
  );

assert.equal(
  repositorySource.includes(
    'export function subscribePaymentProofs(',
  ),
  true,
  'Repository must expose a global realtime payment proof subscription.',
);

assert.equal(
  repositorySource.includes(
    'subscribePaymentProofs,',
  ),
  true,
  'Global subscription must be exposed through paymentProofRepository.',
);

assert.equal(
  repositorySource.includes(
    '/admin/finance/invoices?paymentProofId=',
  ),
  true,
  'Payment notifications must use canonical Finance route.',
);

assert.equal(
  repositorySource.includes(
    '/admin/billing?paymentProofId=',
  ),
  false,
  'New payment notifications must not emit the legacy Billing URL.',
);

assert.equal(
  repositorySource.includes(
    'reviewCanonicalPaymentProof(',
  ),
  true,
  'Protected canonical accounting service must own payment approval.',
);

assert.equal(
  billingSource.includes(
    "import { useSearchParams } from 'react-router-dom';",
  ),
  true,
);

assert.equal(
  billingSource.includes(
    'PaymentProofCommandCenter',
  ),
  true,
);

assert.equal(
  billingSource.includes(
    '.subscribePaymentProofs(',
  ),
  true,
  'Billing must consume full proof history.',
);

assert.equal(
  billingSource.includes(
    '.subscribePendingPaymentProofs(',
  ),
  false,
  'Billing Command Center must not subscribe only to pending proofs.',
);

assert.equal(
  billingSource.includes(
    'selectedPaymentProofId',
  ),
  true,
  'Selection must be ID-based so realtime proof updates cannot leave stale modal data.',
);

assert.equal(
  billingSource.includes(
    "searchParams.get('paymentProofId')",
  ),
  true,
  'Billing must consume paymentProofId notification deep links.',
);

assert.equal(
  billingSource.includes(
    "nextParams.set(\n        'paymentProofId'",
  ),
  true,
);

assert.equal(
  billingSource.includes(
    "proof.status !== 'pending'",
  ),
  true,
  'Reviewed proofs must expose audit/read-only behavior.',
);

assert.equal(
  billingSource.includes(
    'PaymentProofReviewQueue',
  ),
  false,
  'Old six-item pending queue must be removed.',
);

for (
  const required
  of [
    'proofStatusFilterOptions',
    'billing-proof-command-stats',
    'billing-proof-command-search',
    'billing-proof-command-list',
    'PaginationControls',
    "'pending'",
    "'approved'",
    "'rejected'",
    'reviewedByName',
    'reviewedAt',
  ]
) {
  assert.equal(
    commandSource.includes(
      required,
    ),
    true,
    'Command Center missing contract: ' +
      required,
  );
}

assert.equal(
  commandSource.includes(
    'slice(0, 6)',
  ),
  false,
  'Proof history must not be arbitrarily capped at six rows.',
);

assert.equal(
  cssSource.includes(
    'Phase 5B — Payment Proof Command Center',
  ),
  true,
);

assert.equal(
  cssSource.includes(
    '.billing-proof-command-center',
  ),
  true,
);

assert.equal(
  cssSource.includes(
    '.billing-proof-review-audit',
  ),
  true,
);

const packageJson =
  JSON.parse(
    read(
      'package.json',
    ),
  );

assert.equal(
  packageJson.scripts.test.includes(
    'payment-accounting-core-contract-test.mjs',
  ),
  true,
  'Phase 5A contract must remain.',
);

assert.equal(
  packageJson.scripts.test.includes(
    'payment-proof-command-center-contract-test.mjs',
  ),
  true,
  'Phase 5B contract must be registered.',
);

process.stdout.write(
  '✅ Payment Proof Command Center contract passed.\n',
);
