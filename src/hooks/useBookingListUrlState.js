import {
  useCallback,
  useMemo,
} from 'react';
import {
  useSearchParams,
} from 'react-router-dom';
import {
  parseBookingListUrlState,
  updateBookingListSearch,
} from '../domain/booking/bookingUrlState.js';

export default function useBookingListUrlState(config = {}) {
  const [searchParams, setSearchParams] =
    useSearchParams();
  const search = searchParams.toString();
  const requestFiltersKey =
    (config.requestFilters || []).join('|');
  const paymentFiltersKey =
    (config.paymentFilters || []).join('|');
  const sessionFiltersKey =
    (config.sessionFilters || []).join('|');
  const requestParam = config.requestParam || 'request';
  const paymentParam = config.paymentParam || 'payment';
  const sessionParam = config.sessionParam || 'session';

  const normalizedConfig = useMemo(
    () => ({
      paymentFilters:
        paymentFiltersKey.split('|').filter(Boolean),
      paymentParam,
      requestFilters:
        requestFiltersKey.split('|').filter(Boolean),
      requestParam,
      sessionFilters:
        sessionFiltersKey.split('|').filter(Boolean),
      sessionParam,
    }),
    [
      paymentFiltersKey,
      paymentParam,
      requestFiltersKey,
      requestParam,
      sessionFiltersKey,
      sessionParam,
    ],
  );

  const state = useMemo(
    () =>
      parseBookingListUrlState(
        search,
        normalizedConfig,
      ),
    [normalizedConfig, search],
  );

  const update = useCallback(
    (patch, { replace = true } = {}) => {
      setSearchParams(
        (current) =>
          new URLSearchParams(
            updateBookingListSearch(
              current,
              patch,
              normalizedConfig,
            ),
          ),
        {
          preventScrollReset: true,
          replace,
        },
      );
    },
    [normalizedConfig, setSearchParams],
  );

  const openDetail = useCallback(
    (bookingId, tab = 'overview') => {
      update(
        {
          bookingId,
          tab,
        },
        { replace: false },
      );
    },
    [update],
  );

  const closeDetail = useCallback(
    () => {
      update({
        bookingId: '',
        tab: 'overview',
      });
    },
    [update],
  );

  const setPage = useCallback(
    (page) => update({ page }),
    [update],
  );

  const setTab = useCallback(
    (tab) => update({ tab }),
    [update],
  );

  return {
    ...state,
    closeDetail,
    openDetail,
    setPage,
    setTab,
    update,
  };
}
