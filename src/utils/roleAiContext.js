function cleanText(value, fallback = '') {
  return String(value ?? fallback).trim().slice(0, 180);
}

function finiteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function sanitizeBooking(booking) {
  return {
    date: cleanText(booking.date),
    durationHours: finiteNumber(booking.durationHours || booking.duration),
    paidAmount: finiteNumber(booking.paidAmount || booking.dpAmount),
    paymentStatus: cleanText(
      booking.paymentStatusCanonical || booking.paymentStatus || booking.statusPayment,
      'unpaid',
    ),
    requestStatus: cleanText(
      booking.bookingRequestStatus || booking.requestStatus,
      'unknown',
    ),
    sessionStatus: cleanText(
      booking.sessionStatus || booking.status,
      'unknown',
    ),
    service: cleanText(
      booking.sessionLabel || booking.packageLabel || booking.title,
      'Studio session',
    ),
    startHour: finiteNumber(booking.startHour),
    total: finiteNumber(booking.total),
  };
}

function sanitizeAttendance(session) {
  return {
    approvalStatus: cleanText(session.approvalStatus),
    clockInAt: cleanText(session.clockInAt),
    clockOutAt: cleanText(session.clockOutAt),
    date: cleanText(session.date),
    durationHours: finiteNumber(session.durationHours),
    mealAmount: finiteNumber(session.mealAmount),
    status: cleanText(session.status),
  };
}

export function createClientAiContext({
  activeTab,
  bookings,
  pendingPaymentProofs,
  stats,
  upcomingBooking,
}) {
  const rows = (bookings || []).slice(0, 40).map(sanitizeBooking);

  return {
    activeTab: cleanText(activeTab),
    bookingSummary: {
      count: rows.length,
      pendingPaymentProofs: finiteNumber(pendingPaymentProofs),
      recent: rows.slice(0, 20),
      stats: {
        completedBookings: finiteNumber(stats?.completedBookings),
        outstandingAmount: finiteNumber(stats?.outstandingAmount || stats?.unpaidAmount),
        totalBookings: finiteNumber(stats?.totalBookings),
        totalDuration: finiteNumber(stats?.totalDuration),
      },
      upcoming: upcomingBooking ? sanitizeBooking(upcomingBooking) : null,
    },
    privacy: 'Hanya booking milik client aktif; tanpa email, telepon, UID, atau URL bukti pembayaran.',
  };
}

export function createGuardAiContext({
  currentSession,
  isOnline,
  recentSessions,
  stats,
}) {
  return {
    connectivity: isOnline ? 'online' : 'offline',
    currentShift: currentSession ? sanitizeAttendance(currentSession) : null,
    history: (recentSessions || []).slice(0, 12).map(sanitizeAttendance),
    stats: {
      approvedDays: finiteNumber(stats?.approvedDays),
      pendingApproval: finiteNumber(stats?.pending),
      totalApprovedHours: finiteNumber(stats?.totalHours),
    },
  };
}
