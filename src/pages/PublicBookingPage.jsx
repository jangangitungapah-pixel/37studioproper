import {
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock3,
  LoaderCircle,
  ShieldCheck,
} from 'lucide-react';
import {
  useNavigate,
} from 'react-router-dom';
import {
  firebaseAuth,
} from '../lib/firebase.js';
import {
  adminBookingRepository,
} from '../services/adminBookingRepository.js';
import {
  businessHours,
} from './admin/scheduleConfig.js';
import {
  buildClientBookingResumePath,
  isBookingStartOccupied,
} from '../utils/clientBookingHandoff.js';
import '../styles/admin-auth.css';
import '../styles/public-booking.css';

function getLocalDateKey(
  date,
) {
  return [
    date.getFullYear(),
    String(
      date.getMonth() + 1,
    ).padStart(
      2,
      '0',
    ),
    String(
      date.getDate(),
    ).padStart(
      2,
      '0',
    ),
  ].join('-');
}

function formatDateLabel(
  value,
) {
  const date =
    new Date(
      String(value) +
        'T00:00:00',
    );

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return value;
  }

  return new Intl.DateTimeFormat(
    'id-ID',
    {
      day:
        'numeric',
      month:
        'long',
      weekday:
        'long',
      year:
        'numeric',
    },
  ).format(date);
}

function formatStartHour(
  value,
) {
  return (
    String(
      Number(value),
    ).padStart(
      2,
      '0',
    ) +
    '.00'
  );
}

function isPastSlot(
  date,
  startHour,
) {
  const slotDate =
    new Date(
      String(date) +
        'T00:00:00',
    );

  if (
    Number.isNaN(
      slotDate.getTime(),
    )
  ) {
    return true;
  }

  slotDate.setHours(
    Number(
      startHour,
    ),
    0,
    0,
    0,
  );

  return (
    slotDate.getTime() <=
    Date.now()
  );
}

export default function PublicBookingPage() {
  const navigate =
    useNavigate();

  const todayKey =
    useMemo(
      () =>
        getLocalDateKey(
          new Date(),
        ),
      [],
    );

  const [
    selectedDate,
    setSelectedDate,
  ] = useState(
    todayKey,
  );

  const [
    selectedStartHour,
    setSelectedStartHour,
  ] = useState(
    null,
  );

  const [
    slots,
    setSlots,
  ] = useState([]);

  const [
    isLoading,
    setIsLoading,
  ] = useState(true);

  const [
    loadError,
    setLoadError,
  ] = useState('');

  useEffect(() => {
    const unsubscribe =
      adminBookingRepository
        .subscribeClientCalendarSlots(
          (data) => {
            setSlots(data);
            setLoadError('');
            setIsLoading(false);
          },
          (error) => {
            console.error(
              '[public-booking] Gagal membaca availability:',
              error,
            );

            setLoadError(
              'Jadwal belum dapat dimuat. Coba refresh halaman.',
            );

            setIsLoading(false);
          },
        );

    return unsubscribe;
  }, []);

  const availability =
    useMemo(
      () =>
        businessHours.map(
          (hour) => {
            const startHour =
              Number(
                hour.start,
              );

            const occupied =
              isBookingStartOccupied(
                slots,
                selectedDate,
                startHour,
              );

            const past =
              isPastSlot(
                selectedDate,
                startHour,
              );

            return {
              ...hour,
              startHour,
              occupied,
              past,
              available:
                !occupied &&
                !past,
            };
          },
        ),
      [
        selectedDate,
        slots,
      ],
    );

  const availableCount =
    availability.filter(
      (item) =>
        item.available,
    ).length;

  function changeDate(
    value,
  ) {
    setSelectedDate(
      value,
    );

    setSelectedStartHour(
      null,
    );
  }

  function continueBooking() {
    if (
      selectedStartHour ===
      null
    ) {
      return;
    }

    const resumePath =
      buildClientBookingResumePath({
        date:
          selectedDate,
        startHour:
          selectedStartHour,
      });

    if (
      firebaseAuth
        ?.currentUser
    ) {
      navigate(
        resumePath,
      );

      return;
    }

    navigate(
      '/client/login?next=' +
        encodeURIComponent(
          resumePath,
        ),
    );
  }

  return (
    <main className="public-booking-page theme-container">
      <div
        className="public-booking-glow"
        aria-hidden="true"
      />

      <header className="public-booking-header">
        <button
          aria-label="Kembali"
          type="button"
          onClick={() =>
            navigate('/')
          }
        >
          <ArrowLeft
            size={17}
          />
        </button>

        <div>
          <span>
            37 Music Studio
          </span>

          <strong>
            Booking Slot
          </strong>
        </div>
      </header>

      <section className="public-booking-hero">
        <span>
          Availability Realtime
        </span>

        <h1>
          Pilih jadwal dulu.
          <br />
          Login belakangan.
        </h1>

        <p>
          Cek slot studio yang masih tersedia tanpa membuat akun. Login hanya diperlukan saat Anda siap mengirim request booking.
        </p>

        <div className="public-booking-flow">
          <span>
            <CheckCircle2
              size={14}
            />
            Pilih Slot
          </span>

          <ArrowRight
            size={13}
          />

          <span>
            Login
          </span>

          <ArrowRight
            size={13}
          />

          <span>
            Kirim Request
          </span>
        </div>
      </section>

      <section className="public-booking-picker">
        <header>
          <div>
            <CalendarDays
              size={17}
            />

            <span>
              Pilih Tanggal
            </span>
          </div>

          <strong>
            {formatDateLabel(
              selectedDate,
            )}
          </strong>
        </header>

        <label className="public-booking-date">
          <span>
            Tanggal booking
          </span>

          <input
            min={todayKey}
            type="date"
            value={
              selectedDate
            }
            onChange={(
              event,
            ) =>
              changeDate(
                event
                  .target
                  .value,
              )
            }
          />
        </label>

        <div className="public-booking-availability-head">
          <div>
            <Clock3
              size={16}
            />

            <strong>
              Jam Mulai
            </strong>
          </div>

          <span>
            {availableCount}
            {' '}
            tersedia
          </span>
        </div>

        {isLoading ? (
          <div
            className="public-booking-state"
            role="status"
          >
            <LoaderCircle
              className="is-spinning"
              size={24}
            />

            <strong>
              Memeriksa jadwal...
            </strong>
          </div>
        ) : loadError ? (
          <div
            className="public-booking-state is-error"
            role="alert"
          >
            <strong>
              Jadwal tidak tersedia
            </strong>

            <p>
              {loadError}
            </p>
          </div>
        ) : (
          <div
            className="public-booking-hours"
            role="group"
            aria-label="Jam booking tersedia"
          >
            {availability.map(
              (item) => {
                const isSelected =
                  selectedStartHour ===
                  item.startHour;

                return (
                  <button
                    aria-pressed={
                      isSelected
                    }
                    className={
                      isSelected
                        ? 'is-selected'
                        : item.available
                          ? ''
                          : 'is-unavailable'
                    }
                    disabled={
                      !item.available
                    }
                    key={
                      item.key ||
                      item.startHour
                    }
                    type="button"
                    onClick={() =>
                      setSelectedStartHour(
                        item.startHour,
                      )
                    }
                  >
                    <strong>
                      {
                        formatStartHour(
                          item.startHour,
                        )
                      }
                    </strong>

                    <span>
                      {item.past
                        ? 'Lewat'
                        : item.occupied
                          ? 'Terisi'
                          : 'Tersedia'}
                    </span>
                  </button>
                );
              },
            )}
          </div>
        )}
      </section>

      <section className="public-booking-summary">
        <div>
          <span>
            Pilihan Anda
          </span>

          <strong>
            {
              selectedStartHour ===
              null
                ? 'Pilih jam mulai'
                : formatDateLabel(
                  selectedDate,
                ) +
                  ' · ' +
                  formatStartHour(
                    selectedStartHour,
                  ) +
                  ' WIB'
            }
          </strong>
        </div>

        <button
          disabled={
            selectedStartHour ===
            null
          }
          type="button"
          onClick={
            continueBooking
          }
        >
          <span>
            Lanjut Booking
          </span>

          <ArrowRight
            size={16}
          />
        </button>

        <small>
          <ShieldCheck
            size={13}
          />
          Data customer belum diminta pada tahap ini.
        </small>
      </section>
    </main>
  );
}
