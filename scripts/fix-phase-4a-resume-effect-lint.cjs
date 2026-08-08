const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();

const portalFile = path.join(
  ROOT,
  'src',
  'pages',
  'ClientPortalPage.jsx',
);

const testFile = path.join(
  ROOT,
  'scripts',
  'public-booking-entry-contract-test.mjs',
);

function fail(message) {
  console.error('');
  console.error('[phase-4a-lint] ' + message);
  console.error('');
  process.exit(1);
}

function read(file) {
  if (!fs.existsSync(file)) {
    fail(
      'File tidak ditemukan: ' +
        path.relative(ROOT, file),
    );
  }

  return fs
    .readFileSync(file, 'utf8')
    .replace(/\r\n/g, '\n');
}

function write(file, source) {
  fs.writeFileSync(
    file,
    source,
    'utf8',
  );
}

/**
 * ============================================================
 * 1. REPAIR CLIENT PORTAL RESUME EFFECT
 * ============================================================
 */

let portalSource =
  read(portalFile);

const startMarker =
  '  // Resume a slot selected from the public /book entry after authentication.';

const endMarker =
  '  // Load payment proofs submitted by current client';

const startIndex =
  portalSource.indexOf(
    startMarker,
  );

const endIndex =
  portalSource.indexOf(
    endMarker,
    startIndex,
  );

if (
  startIndex < 0 ||
  endIndex < 0
) {
  fail(
    'Resume effect markers tidak ditemukan.',
  );
}

const currentBlock =
  portalSource.slice(
    startIndex,
    endIndex,
  );

const alreadyFixed =
  currentBlock.includes(
    'const resumeTimer = window.setTimeout(',
  ) &&
  currentBlock.includes(
    'window.clearTimeout(resumeTimer)',
  );

if (!alreadyFixed) {
  if (
    !currentBlock.includes(
      "setActionFeedback('Jam booking yang dipilih sudah tidak valid.",
    ) ||
    !currentBlock.includes(
      'setIsSimulatorOpen(true);',
    )
  ) {
    fail(
      'Resume effect baseline tidak sesuai expected Phase 4A.',
    );
  }

  const replacement = [
    '  // Resume a slot selected from the public /book entry after authentication.',
    '  useEffect(() => {',
    '    if (!currentUser || !calendarSlotsReady) return;',
    '',
    '    const resume = parseClientBookingResume(location.search);',
    '    if (!resume) return;',
    '',
    "    const resumeKey = resume.date + ':' + String(resume.startHour);",
    '',
    '    if (publicBookingResumeKeyRef.current === resumeKey) return;',
    '',
    '    const hasValidBusinessHour = businessHours.some(',
    '      (hour) => Number(hour.start) === Number(resume.startHour)',
    '    );',
    '',
    "    const resumeDate = new Date(resume.date + 'T00:00:00');",
    '    const isResumeDateValid = !Number.isNaN(resumeDate.getTime());',
    '    const isResumeOccupied =',
    '      isResumeDateValid &&',
    '      isBookingStartOccupied(',
    '        calendarSlots,',
    '        resume.date,',
    '        resume.startHour',
    '      );',
    '',
    '    /**',
    '     * Defer the UI state transition out of the synchronous effect body.',
    '     * This keeps the effect responsible for reacting to the external',
    '     * URL/auth/Firestore handoff without causing cascading renders.',
    '     */',
    '    const resumeTimer = window.setTimeout(() => {',
    '      if (publicBookingResumeKeyRef.current === resumeKey) return;',
    '',
    '      publicBookingResumeKeyRef.current = resumeKey;',
    '',
    '      if (!hasValidBusinessHour) {',
    "        setActionFeedback('Jam booking yang dipilih sudah tidak valid. Silakan pilih ulang dari kalender.');",
    "        setActiveTab('calendar');",
    "        navigate('/client/portal', { replace: true });",
    '        return;',
    '      }',
    '',
    '      if (!isResumeDateValid || isResumeOccupied) {',
    "        setActionFeedback('Slot yang dipilih sudah terisi. Silakan pilih jadwal lain.');",
    "        setActiveTab('calendar');",
    '',
    '        if (isResumeDateValid) {',
    '          setCalendarSelectedDate(startOfDay(resumeDate));',
    '        }',
    '',
    "        navigate('/client/portal', { replace: true });",
    '        return;',
    '      }',
    '',
    '      setCalendarSelectedDate(startOfDay(resumeDate));',
    "      setActiveTab('calendar');",
    '      setSimulatorDate(resume.date);',
    '      setSimulatorStartHour(String(resume.startHour));',
    "      setSimSessionType('rehearsal');",
    "      setSimPackageId('none');",
    "      setSimRecordingTypeId('none');",
    "      setSimDuration('2');",
    "      setSimCustomDuration('');",
    "      setSimCustomerName(currentUser.displayName || currentUser.email?.split('@')[0] || '');",
    "      setSimCustomerPhone(currentUser.phoneNumber || '');",
    '      setSimProofEnabled(false);',
    "      setSimProofCategory('dp');",
    "      setSimProofMethod('transfer');",
    "      setSimProofAmount('');",
    '      setSimProofFile(null);',
    "      setSimProofNote('');",
    '      setIsSimulatorOpen(true);',
    "      navigate('/client/portal', { replace: true });",
    '    }, 0);',
    '',
    '    return () => {',
    '      window.clearTimeout(resumeTimer);',
    '    };',
    '  }, [',
    '    calendarSlots,',
    '    calendarSlotsReady,',
    '    currentUser,',
    '    location.search,',
    '    navigate,',
    '  ]);',
    '',
    '',
  ].join('\n');

  portalSource =
    portalSource.slice(
      0,
      startIndex,
    ) +
    replacement +
    portalSource.slice(
      endIndex,
    );

  write(
    portalFile,
    portalSource,
  );

  console.log(
    '✅ Client Portal resume state transition deferred safely.',
  );
} else {
  console.log(
    '✅ Client Portal resume effect already lint-safe.',
  );
}

/**
 * ============================================================
 * 2. STRENGTHEN PHASE 4A CONTRACT
 * ============================================================
 */

let testSource =
  read(testFile);

const testAnchor = [
  'assert.equal(',
  '  portalSource.includes(',
  "    'calendarSlotsReady',",
  '  ),',
  '  true,',
  ');',
].join('\n');

const testAddition = [
  testAnchor,
  '',
  'assert.equal(',
  '  portalSource.includes(',
  "    'const resumeTimer = window.setTimeout(',",
  '  ),',
  '  true,',
  "  'Auth-resume state changes must be deferred outside the synchronous effect body.',",
  ');',
  '',
  'assert.equal(',
  '  portalSource.includes(',
  "    'window.clearTimeout(resumeTimer)',",
  '  ),',
  '  true,',
  "  'Deferred auth-resume work must be cancellable during effect cleanup.',",
  ');',
].join('\n');

if (
  testSource.includes(
    "'const resumeTimer = window.setTimeout('",
  )
) {
  console.log(
    '✅ Phase 4A lint-safety contract already present.',
  );
} else {
  const count =
    testSource.split(
      testAnchor,
    ).length - 1;

  if (count !== 1) {
    fail(
      'Expected exactly 1 calendarSlotsReady test anchor, found ' +
        count,
    );
  }

  testSource =
    testSource.replace(
      testAnchor,
      testAddition,
    );

  write(
    testFile,
    testSource,
  );

  console.log(
    '✅ Phase 4A lint-safety contract added.',
  );
}

console.log('');
console.log(
  '✅ Phase 4A resume effect lint repair prepared.',
);