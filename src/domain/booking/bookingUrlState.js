export const BOOKING_DETAIL_TABS = Object.freeze([
  'overview',
  'messages',
  'payment',
  'activity',
]);

function toSearchParams(value) {
  if (value instanceof URLSearchParams) {
    return new URLSearchParams(value);
  }

  return new URLSearchParams(
    String(value || '').replace(/^\?/, ''),
  );
}

function cleanValue(value, maxLength = 240) {
  return String(value || '').trim().slice(0, maxLength);
}

function getAllowedValue(value, allowed, fallback) {
  return allowed.includes(value)
    ? value
    : fallback;
}

function getConfig(config = {}) {
  return {
    paymentFilters: config.paymentFilters || ['all'],
    paymentParam: config.paymentParam || 'payment',
    requestFilters: config.requestFilters || ['all'],
    requestParam: config.requestParam || 'request',
    sessionFilters: config.sessionFilters || ['all'],
    sessionParam: config.sessionParam || 'session',
  };
}

export function parseBookingListUrlState(value, config = {}) {
  const params = toSearchParams(value);
  const normalized = getConfig(config);
  const rawPage = Number(params.get('page'));
  const rawTab = cleanValue(params.get('tab'), 40);

  return {
    bookingId: cleanValue(params.get('bookingId')),
    page:
      Number.isInteger(rawPage) && rawPage > 0
        ? rawPage
        : 1,
    paymentFilter: getAllowedValue(
      cleanValue(params.get(normalized.paymentParam), 80),
      normalized.paymentFilters,
      'all',
    ),
    query: cleanValue(params.get('q'), 160),
    requestFilter: getAllowedValue(
      cleanValue(params.get(normalized.requestParam), 80),
      normalized.requestFilters,
      'all',
    ),
    sessionFilter: getAllowedValue(
      cleanValue(params.get(normalized.sessionParam), 80),
      normalized.sessionFilters,
      'all',
    ),
    tab: BOOKING_DETAIL_TABS.includes(rawTab)
      ? rawTab
      : 'overview',
  };
}

function writeDefaultable(params, key, value, fallback = 'all') {
  const clean = cleanValue(value);

  if (!clean || clean === fallback) {
    params.delete(key);
  } else {
    params.set(key, clean);
  }
}

export function updateBookingListSearch(
  value,
  patch = {},
  config = {},
) {
  const params = toSearchParams(value);
  const normalized = getConfig(config);

  if (Object.hasOwn(patch, 'query')) {
    writeDefaultable(params, 'q', patch.query, '');
  }

  if (Object.hasOwn(patch, 'requestFilter')) {
    writeDefaultable(
      params,
      normalized.requestParam,
      patch.requestFilter,
    );
  }

  if (Object.hasOwn(patch, 'paymentFilter')) {
    writeDefaultable(
      params,
      normalized.paymentParam,
      patch.paymentFilter,
    );
  }

  if (Object.hasOwn(patch, 'sessionFilter')) {
    writeDefaultable(
      params,
      normalized.sessionParam,
      patch.sessionFilter,
    );
  }

  if (Object.hasOwn(patch, 'page')) {
    const page = Number(patch.page);

    if (!Number.isInteger(page) || page <= 1) {
      params.delete('page');
    } else {
      params.set('page', String(page));
    }
  }

  if (Object.hasOwn(patch, 'bookingId')) {
    writeDefaultable(
      params,
      'bookingId',
      patch.bookingId,
      '',
    );
  }

  if (Object.hasOwn(patch, 'tab')) {
    const tab = BOOKING_DETAIL_TABS.includes(patch.tab)
      ? patch.tab
      : 'overview';

    writeDefaultable(params, 'tab', tab, 'overview');
  }

  if (!params.get('bookingId')) {
    params.delete('tab');
  }

  return params.toString();
}

