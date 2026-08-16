import {
  lazy,
  Suspense,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Info,
  LoaderCircle,
  LockKeyhole,
  Music2,
  RefreshCw,
  ShieldCheck,
  Wifi,
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
} from '../constants/scheduleConfig.js';
import {
  buildClientBookingResumePath,
  isBookingStartOccupied,
} from '../utils/clientBookingHandoff.js';
import '../styles/routes/public.css';
import '../styles/public-booking.css';

const RoleAiAssistant = lazy(() => import('../components/ai/RoleAiAssistant.jsx'));

function getLocalDateKey(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

function parseLocalDate(value) {
  return new Date(String(value) + 'T00:00:00');
}

function formatDateLabel(value) {
  const date = parseLocalDate(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'long',
    weekday: 'long',
    year: 'numeric',
  }).format(date);
}

function formatShortDay(value) {
  const date = parseLocalDate(value);

  return {
    day: new Intl.DateTimeFormat('id-ID', {
      weekday: 'short',
    }).format(date).replace('.', ''),
    date: new Intl.DateTimeFormat('id-ID', {
      day: '2-digit',
    }).format(date),
  };
}

function formatMonthLabel(value) {
  return new Intl.DateTimeFormat('id-ID', {
    month: 'long',
    year: 'numeric',
  }).format(parseLocalDate(value));
}

function formatStartHour(value) {
  return String(Number(value)).padStart(2, '0') + '.00';
}

function isPastSlot(date, startHour) {
  const slotDate = parseLocalDate(date);

  if (Number.isNaN(slotDate.getTime())) {
    return true;
  }

  slotDate.setHours(Number(startHour), 0, 0, 0);
  return slotDate.getTime() <= Date.now();
}

function getDateWindow(todayKey, offset) {
  const startDate = parseLocalDate(todayKey);
  startDate.setDate(startDate.getDate() + (offset * 7));

  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + index);
    return getLocalDateKey(date);
  });
}

function SlotGroup({
  items,
  label,
  selectedStartHour,
  onSelect,
}) {
  if (items.length === 0) {
    return null;
  }

  const availableCount = items.filter((item) => item.available).length;
  const labelId = `public-slot-${label.toLowerCase()}`;

  return (
    <section className="public-booking-slot-group" aria-labelledby={labelId}>
      <header>
        <div>
          <span className="public-booking-slot-line" aria-hidden="true" />
          <strong id={labelId}>{label}</strong>
        </div>

        <span>{availableCount} slot tersedia</span>
      </header>

      <div className="public-booking-hours" role="group" aria-label={`Pilihan jam ${label.toLowerCase()}`}>
        {items.map((item) => {
          const isSelected = selectedStartHour === item.startHour;
          const status = item.past
            ? 'Sudah lewat'
            : item.occupied
              ? 'Sudah terisi'
              : 'Tersedia';

          return (
            <button
              aria-label={`${formatStartHour(item.startHour)} WIB, ${status}`}
              aria-pressed={isSelected}
              className={isSelected
                ? 'is-selected'
                : item.available
                  ? ''
                  : 'is-unavailable'}
              disabled={!item.available}
              key={item.key || item.startHour}
              type="button"
              onClick={() => onSelect(item.startHour)}
            >
              <span className="public-booking-slot-check" aria-hidden="true">
                {isSelected ? <Check size={14} strokeWidth={3} /> : null}
              </span>

              <strong>{formatStartHour(item.startHour)}</strong>
              <span>{status}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

export default function PublicBookingPage() {
  const navigate = useNavigate();
  const todayKey = useMemo(() => getLocalDateKey(new Date()), []);
  const [selectedDate, setSelectedDate] = useState(todayKey);
  const [selectedStartHour, setSelectedStartHour] = useState(null);
  const [dateWindowOffset, setDateWindowOffset] = useState(0);
  const [slots, setSlots] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [subscriptionVersion, setSubscriptionVersion] = useState(0);

  useEffect(() => {
    const unsubscribe = adminBookingRepository.subscribeClientCalendarSlots(
      (data) => {
        setSlots(data);
        setLoadError('');
        setIsLoading(false);
      },
      (error) => {
        console.error('[public-booking] Gagal membaca availability:', error);
        setLoadError('Jadwal belum dapat dimuat. Periksa koneksi lalu coba lagi.');
        setIsLoading(false);
      },
    );

    return unsubscribe;
  }, [subscriptionVersion]);

  const dateWindow = useMemo(
    () => getDateWindow(todayKey, dateWindowOffset),
    [dateWindowOffset, todayKey],
  );

  const availability = useMemo(
    () => businessHours.map((hour) => {
      const startHour = Number(hour.start);
      const occupied = isBookingStartOccupied(slots, selectedDate, startHour);
      const past = isPastSlot(selectedDate, startHour);

      return {
        ...hour,
        startHour,
        occupied,
        past,
        available: !occupied && !past,
      };
    }),
    [selectedDate, slots],
  );

  const availableCount = availability.filter((item) => item.available).length;
  const afternoonSlots = availability.filter((item) => item.startHour < 16);
  const eveningSlots = availability.filter((item) => item.startHour >= 16);
  const selectedSlot = availability.find(
    (item) => item.startHour === selectedStartHour && item.available,
  );
  const canContinue = Boolean(selectedSlot);
  const publicAiContext = useMemo(() => ({
    calendar: {
      availableStartHours: availability
        .filter((item) => item.available)
        .map((item) => item.startHour),
      date: selectedDate,
      selectedStartHour,
      timezone: 'Asia/Jakarta',
    },
    journey: 'Pilih waktu, masuk akun Client, lengkapi detail, lalu kirim request booking.',
    privacy: 'Konteks publik tanpa identitas pengunjung atau data booking customer lain.',
  }), [availability, selectedDate, selectedStartHour]);

  function changeDate(value) {
    if (!value || value < todayKey) {
      return;
    }

    setSelectedDate(value);
    setSelectedStartHour(null);
  }

  function retryAvailability() {
    setIsLoading(true);
    setLoadError('');
    setSubscriptionVersion((version) => version + 1);
  }

  function continueBooking() {
    if (!canContinue) {
      return;
    }

    const resumePath = buildClientBookingResumePath({
      date: selectedDate,
      startHour: selectedStartHour,
    });

    if (firebaseAuth?.currentUser) {
      navigate(resumePath);
      return;
    }

    navigate('/client/login?next=' + encodeURIComponent(resumePath));
  }

  return (
    <main className="public-booking-page theme-container">
      <a className="public-booking-skip" href="#public-booking-calendar">
        Lewati ke kalender
      </a>

      <header className="public-booking-header">
        <button
          aria-label="Kembali ke halaman client"
          className="public-booking-back"
          type="button"
          onClick={() => navigate('/client')}
        >
          <ArrowLeft size={18} />
        </button>

        <button
          aria-label="Kembali ke halaman client"
          className="public-booking-brand"
          type="button"
          onClick={() => navigate('/client')}
        >
          <span>37</span>
          <span>
            <strong>Music Studio</strong>
            <small>Public calendar</small>
          </span>
        </button>

        <div className="public-booking-live" role="status">
          <span aria-hidden="true" />
          <Wifi size={14} />
          Jadwal realtime
        </div>
      </header>

      <section className="public-booking-intro" aria-labelledby="public-booking-title">
        <div>
          <span className="public-booking-eyebrow">
            <Music2 size={15} />
            Booking studio
          </span>
          <h1 id="public-booking-title">Temukan waktu untuk sesi berikutnya.</h1>
          <p>
            Lihat jadwal studio yang tersedia, pilih jam terbaik, lalu login hanya saat Anda siap mengirim request.
          </p>
        </div>

        <ol className="public-booking-progress" aria-label="Tahapan booking">
          <li className="is-active">
            <span>01</span>
            <strong>Pilih waktu</strong>
          </li>
          <li>
            <span>02</span>
            <strong>Masuk akun</strong>
          </li>
          <li>
            <span>03</span>
            <strong>Kirim request</strong>
          </li>
        </ol>
      </section>

      <div className="public-booking-workspace">
        <section
          className="public-booking-calendar"
          id="public-booking-calendar"
          aria-labelledby="public-booking-calendar-title"
        >
          <header className="public-booking-calendar-head">
            <div>
              <span>Kalender studio</span>
              <h2 id="public-booking-calendar-title">{formatMonthLabel(selectedDate)}</h2>
            </div>

            <div className="public-booking-calendar-nav" aria-label="Navigasi minggu">
              <button
                aria-label="Minggu sebelumnya"
                disabled={dateWindowOffset === 0}
                type="button"
                onClick={() => setDateWindowOffset((offset) => Math.max(0, offset - 1))}
              >
                <ChevronLeft size={19} />
              </button>
              <button
                aria-label="Minggu berikutnya"
                type="button"
                onClick={() => setDateWindowOffset((offset) => offset + 1)}
              >
                <ChevronRight size={19} />
              </button>
            </div>
          </header>

          <div className="public-booking-date-strip" role="group" aria-label="Pilih tanggal booking">
            {dateWindow.map((date) => {
              const dateParts = formatShortDay(date);
              const isSelected = date === selectedDate;

              return (
                <button
                  aria-label={formatDateLabel(date)}
                  aria-pressed={isSelected}
                  className={isSelected ? 'is-selected' : ''}
                  key={date}
                  type="button"
                  onClick={() => changeDate(date)}
                >
                  <span>{dateParts.day}</span>
                  <strong>{dateParts.date}</strong>
                  <small>{date === todayKey ? 'Hari ini' : '\u00a0'}</small>
                </button>
              );
            })}
          </div>

          <div className="public-booking-date-custom">
            <div>
              <CalendarDays size={17} />
              <span>Butuh tanggal lain?</span>
            </div>
            <label>
              <span className="sr-only">Pilih tanggal lain</span>
              <input
                min={todayKey}
                type="date"
                value={selectedDate}
                onChange={(event) => changeDate(event.target.value)}
              />
            </label>
          </div>

          <div className="public-booking-availability-head">
            <div>
              <Clock3 size={18} />
              <div>
                <span>Jam mulai</span>
                <strong>{formatDateLabel(selectedDate)}</strong>
              </div>
            </div>

            <span>{availableCount} tersedia</span>
          </div>

          {isLoading ? (
            <div className="public-booking-state" role="status">
              <LoaderCircle className="is-spinning" size={25} />
              <strong>Memeriksa jadwal studio</strong>
              <p>Sinkronisasi availability terbaru...</p>
            </div>
          ) : loadError ? (
            <div className="public-booking-state is-error" role="alert">
              <Info size={24} />
              <strong>Jadwal belum dapat dimuat</strong>
              <p>{loadError}</p>
              <button type="button" onClick={retryAvailability}>
                <RefreshCw size={15} />
                Coba lagi
              </button>
            </div>
          ) : (
            <div className="public-booking-slot-list">
              <SlotGroup
                items={afternoonSlots}
                label="Siang"
                selectedStartHour={selectedStartHour}
                onSelect={setSelectedStartHour}
              />
              <SlotGroup
                items={eveningSlots}
                label="Malam"
                selectedStartHour={selectedStartHour}
                onSelect={setSelectedStartHour}
              />
            </div>
          )}

          <footer className="public-booking-legend" aria-label="Keterangan status slot">
            <span><i className="is-available" /> Tersedia</span>
            <span><i className="is-selected" /> Dipilih</span>
            <span><i className="is-unavailable" /> Terisi / lewat</span>
          </footer>
        </section>

        <aside className="public-booking-summary" aria-label="Ringkasan pilihan booking">
          <div className="public-booking-summary-image" aria-hidden="true">
            <img src="/images/studio_hero_banner.png" alt="" />
            <span><Music2 size={15} /> 37 Music Studio</span>
          </div>

          <div className="public-booking-summary-content">
            <span className="public-booking-summary-kicker">Pilihan Anda</span>

            <div className="public-booking-summary-value">
              <CalendarDays size={19} />
              <div>
                <span>Tanggal</span>
                <strong>{formatDateLabel(selectedDate)}</strong>
              </div>
            </div>

            <div className="public-booking-summary-value">
              <Clock3 size={19} />
              <div>
                <span>Jam mulai</span>
                <strong>
                  {selectedStartHour === null
                    ? 'Belum dipilih'
                    : `${formatStartHour(selectedStartHour)} WIB`}
                </strong>
              </div>
            </div>

            <p className="public-booking-summary-hint">
              Harga dan durasi dipilih setelah Anda masuk ke akun client.
            </p>

            <button disabled={!canContinue} type="button" onClick={continueBooking}>
              <span>{canContinue ? 'Lanjut Booking' : 'Pilih jam terlebih dahulu'}</span>
              <ArrowRight size={17} />
            </button>

            <small>
              <LockKeyhole size={13} />
              Login diperlukan di langkah berikutnya
            </small>
          </div>

          <div className="public-booking-trust">
            <ShieldCheck size={17} />
            <p>
              <strong>Aman dan tanpa komitmen.</strong>
              Data customer belum diminta pada tahap ini.
            </p>
          </div>
        </aside>
      </div>

      <Suspense fallback={null}>
        <RoleAiAssistant
          context={publicAiContext}
          role="client"
          surface="public-booking"
          user={firebaseAuth?.currentUser || null}
        />
      </Suspense>
    </main>
  );
}
