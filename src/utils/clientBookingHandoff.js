const CLIENT_PORTAL_PATH =
  '/client/portal';

const PUBLIC_BOOKING_PATH =
  '/book';

function isIsoDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(
    String(value || ''),
  );
}

function isValidStartHour(value) {
  const numericValue =
    Number(value);

  return (
    Number.isFinite(
      numericValue,
    ) &&
    numericValue >= 0 &&
    numericValue <= 23
  );
}

export function buildClientBookingResumePath({
  date,
  startHour,
}) {
  const cleanDate =
    String(
      date || '',
    ).trim();

  if (
    !isIsoDate(
      cleanDate,
    ) ||
    !isValidStartHour(
      startHour,
    )
  ) {
    return CLIENT_PORTAL_PATH;
  }

  const params =
    new URLSearchParams();

  params.set(
    'bookDate',
    cleanDate,
  );

  params.set(
    'bookStart',
    String(
      Number(
        startHour,
      ),
    ),
  );

  return (
    CLIENT_PORTAL_PATH +
    '?' +
    params.toString()
  );
}

export function parseClientBookingResume(
  search,
) {
  const params =
    new URLSearchParams(
      String(
        search || '',
      ),
    );

  const date =
    String(
      params.get(
        'bookDate',
      ) || '',
    ).trim();

  const startHour =
    Number(
      params.get(
        'bookStart',
      ),
    );

  if (
    !isIsoDate(date) ||
    !isValidStartHour(
      startHour,
    )
  ) {
    return null;
  }

  return {
    date,
    startHour,
  };
}

export function getSafeClientNextPath(
  search,
) {
  const params =
    new URLSearchParams(
      String(
        search || '',
      ),
    );

  const next =
    String(
      params.get(
        'next',
      ) || '',
    ).trim();

  if (
    !next ||
    !next.startsWith('/') ||
    next.startsWith('//')
  ) {
    return CLIENT_PORTAL_PATH;
  }

  const isClientPortal =
    next ===
      CLIENT_PORTAL_PATH ||
    next.startsWith(
      CLIENT_PORTAL_PATH +
        '?',
    );

  const isPublicBooking =
    next ===
      PUBLIC_BOOKING_PATH ||
    next.startsWith(
      PUBLIC_BOOKING_PATH +
        '?',
    );

  return (
    isClientPortal ||
    isPublicBooking
  )
    ? next
    : CLIENT_PORTAL_PATH;
}

export function isBookingStartOccupied(
  slots,
  date,
  startHour,
) {
  const safeSlots =
    Array.isArray(slots)
      ? slots
      : [];

  const targetStart =
    Number(
      startHour,
    );

  if (
    !isIsoDate(date) ||
    !isValidStartHour(
      targetStart,
    )
  ) {
    return false;
  }

  return safeSlots.some(
    (slot) => {
      if (
        slot?.date !==
        date
      ) {
        return false;
      }

      const slotStart =
        Number(
          slot?.startHour,
        );

      const duration =
        Math.max(
          0.5,
          Number(
            slot?.durationHours,
          ) ||
            1,
        );

      if (
        !Number.isFinite(
          slotStart,
        )
      ) {
        return false;
      }

      return (
        targetStart >=
          slotStart &&
        targetStart <
          slotStart +
            duration
      );
    },
  );
}
