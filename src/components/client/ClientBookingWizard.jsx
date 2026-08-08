import {
  useState,
} from 'react';
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  MessageCircle,
  Send,
  UploadCloud,
  X,
} from 'lucide-react';
import StudioSelect from '../ui/StudioSelect.jsx';
import {
  formatRupiah,
  isRecordingSessionId,
} from '../../settings/pricingSettings.js';
import {
  paymentProofCategoryOptions,
  paymentProofMethodOptions,
} from '../../services/paymentProofRepository.js';
import {
  durationOptions,
} from '../../pages/admin/scheduleConfig.js';
import '../../styles/modules/client-booking-wizard.css';

function formatBookingDate(
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
    return value || '-';
  }

  return new Intl.DateTimeFormat(
    'id-ID',
    {
      day:
        'numeric',
      month:
        'long',
      weekday:
        'short',
      year:
        'numeric',
    },
  ).format(date);
}

function getSelectedServiceLabel({
  packageId,
  packageOptions,
  recordingTypeId,
  recordingTypeOptions,
  sessionOptions,
  sessionType,
}) {
  if (
    packageId !==
    'none'
  ) {
    return (
      packageOptions.find(
        (item) =>
          item.key ===
          packageId,
      )?.label ||
      'Paket Studio'
    );
  }

  if (
    isRecordingSessionId(
      sessionType,
    )
  ) {
    return (
      recordingTypeOptions.find(
        (item) =>
          item.key ===
          recordingTypeId,
      )?.label ||
      'Recording'
    );
  }

  return (
    sessionOptions.find(
      (item) =>
        item.key ===
        sessionType,
    )?.label ||
    'Sesi Studio'
  );
}

function WizardProgress({
  step,
}) {
  const steps = [
    {
      key:
        'details',
      label:
        'Detail',
    },
    {
      key:
        'review',
      label:
        'Review',
    },
    {
      key:
        'confirmation',
      label:
        'Selesai',
    },
  ];

  const activeIndex =
    steps.findIndex(
      (item) =>
        item.key ===
        step,
    );

  return (
    <div
      className="client-booking-wizard-progress"
      aria-label="Tahap booking"
    >
      {steps.map(
        (
          item,
          index,
        ) => (
          <div
            className={
              index <=
              activeIndex
                ? 'is-active'
                : ''
            }
            key={
              item.key
            }
          >
            <span>
              {index + 1}
            </span>

            <small>
              {
                item.label
              }
            </small>
          </div>
        ),
      )}
    </div>
  );
}

export default function ClientBookingWizard({
  actualDuration,
  customerName,
  customerPhone,
  customDuration,
  date,
  duration,
  getSupportUrl,
  isSubmitting,
  onClose,
  onPackageChange,
  onSessionTypeChange,
  onSubmit,
  onViewBooking,
  packageId,
  packageOptions,
  pricingBreakdown,
  proofAmount,
  proofCategory,
  proofEnabled,
  proofFile,
  proofMethod,
  proofNote,
  recordingTypeId,
  recordingTypeOptions,
  sessionOptions,
  sessionType,
  setCustomerName,
  setCustomerPhone,
  setCustomDuration,
  setDuration,
  setProofAmount,
  setProofCategory,
  setProofEnabled,
  setProofFile,
  setProofMethod,
  setProofNote,
  setRecordingTypeId,
  startHour,
}) {
  const [
    step,
    setStep,
  ] = useState(
    'details',
  );

  const [
    confirmation,
    setConfirmation,
  ] = useState(null);

  const serviceLabel =
    getSelectedServiceLabel({
      packageId,
      packageOptions,
      recordingTypeId,
      recordingTypeOptions,
      sessionOptions,
      sessionType,
    });

  const canReview =
    Boolean(
      customerName.trim(),
    ) &&
    Boolean(
      customerPhone.trim(),
    ) &&
    Boolean(
      date,
    );

  async function submitRequest() {
    if (
      isSubmitting
    ) {
      return;
    }

    const result =
      await onSubmit();

    if (
      !result?.booking
    ) {
      return;
    }

    setConfirmation(
      result,
    );

    setStep(
      'confirmation',
    );
  }

  if (
    step ===
    'confirmation' &&
    confirmation?.booking
  ) {
    const booking =
      confirmation.booking;

    const supportUrl =
      getSupportUrl(
        booking,
      );

    return (
      <div
        className="client-booking-wizard-backdrop"
        role="presentation"
      >
        <section
          aria-label="Booking berhasil dikirim"
          aria-modal="true"
          className="client-booking-wizard is-confirmation"
          role="dialog"
        >
          <div className="client-booking-wizard-success-icon">
            <CheckCircle2
              size={34}
            />
          </div>

          <span className="client-booking-wizard-eyebrow">
            Request Terkirim
          </span>

          <h2>
            Booking sedang menunggu konfirmasi admin.
          </h2>

          <p>
            Slot pilihan Anda sudah tercatat sebagai request. Pantau statusnya dari halaman booking Anda.
          </p>

          <div className="client-booking-wizard-confirmation-card">
            <div>
              <span>
                Kode Booking
              </span>

              <strong>
                {
                  booking.bookingCode ||
                  booking.id
                }
              </strong>
            </div>

            <div>
              <span>
                Jadwal
              </span>

              <strong>
                {
                  formatBookingDate(
                    booking.date,
                  )
                }
                {' · '}
                {
                  String(
                    booking.startHour,
                  ).padStart(
                    2,
                    '0',
                  )
                }
                .00 WIB
              </strong>
            </div>

            <div>
              <span>
                Layanan
              </span>

              <strong>
                {
                  booking.sessionLabel ||
                  booking.packageLabel ||
                  booking.title ||
                  'Sesi Studio'
                }
              </strong>
            </div>

            <div>
              <span>
                Estimasi
              </span>

              <strong>
                {
                  formatRupiah(
                    booking.total ||
                    0,
                  )
                }
              </strong>
            </div>
          </div>

          {confirmation.warning ? (
            <div
              className="client-booking-wizard-warning"
              role="status"
            >
              {
                confirmation.warning
              }
            </div>
          ) : null}

          <div className="client-booking-wizard-confirmation-actions">
            <button
              className="is-primary"
              type="button"
              onClick={() =>
                onViewBooking(
                  booking,
                )
              }
            >
              <span>
                View Booking
              </span>

              <ArrowRight
                size={16}
              />
            </button>

            <a
              href={
                supportUrl
              }
              rel="noopener noreferrer"
              target="_blank"
            >
              <MessageCircle
                size={15}
              />

              <span>
                WhatsApp
              </span>
            </a>
          </div>

          <button
            className="client-booking-wizard-close-text"
            type="button"
            onClick={
              onClose
            }
          >
            Tutup
          </button>
        </section>
      </div>
    );
  }

  return (
    <div
      className="client-booking-wizard-backdrop"
      role="presentation"
    >
      <section
        aria-label="Booking studio"
        aria-modal="true"
        className="client-booking-wizard"
        role="dialog"
      >
        <header className="client-booking-wizard-header">
          <div>
            <span>
              Booking Studio
            </span>

            <strong>
              {step ===
              'review'
                ? 'Review Request'
                : 'Lengkapi Booking'}
            </strong>
          </div>

          <button
            aria-label="Tutup booking"
            disabled={
              isSubmitting
            }
            type="button"
            onClick={
              onClose
            }
          >
            <X
              size={18}
            />
          </button>
        </header>

        <WizardProgress
          step={
            step
          }
        />

        {step ===
        'details' ? (
          <div className="client-booking-wizard-body">
            <section className="client-booking-wizard-slot">
              <CalendarDays
                size={18}
              />

              <div>
                <span>
                  Jadwal pilihan
                </span>

                <strong>
                  {
                    formatBookingDate(
                      date,
                    )
                  }
                  {' · '}
                  {
                    String(
                      startHour,
                    ).padStart(
                      2,
                      '0',
                    )
                  }
                  .00 WIB
                </strong>
              </div>
            </section>

            <div className="client-booking-wizard-grid">
              <label>
                <span>
                  Nama Pelanggan
                </span>

                <input
                  required
                  type="text"
                  value={
                    customerName
                  }
                  onChange={(
                    event,
                  ) =>
                    setCustomerName(
                      event.target.value,
                    )
                  }
                />
              </label>

              <label>
                <span>
                  No. HP / WhatsApp
                </span>

                <input
                  required
                  type="tel"
                  value={
                    customerPhone
                  }
                  onChange={(
                    event,
                  ) =>
                    setCustomerPhone(
                      event.target.value,
                    )
                  }
                />
              </label>
            </div>

            <div className="client-booking-wizard-mode">
              <button
                className={
                  packageId ===
                  'none'
                    ? 'is-active'
                    : ''
                }
                type="button"
                onClick={() =>
                  onPackageChange(
                    'none',
                  )
                }
              >
                Sewa Reguler
              </button>

              <button
                className={
                  packageId !==
                  'none'
                    ? 'is-active'
                    : ''
                }
                disabled={
                  !packageOptions.length
                }
                type="button"
                onClick={() =>
                  onPackageChange(
                    packageOptions[
                      0
                    ]?.key ||
                      'none',
                  )
                }
              >
                Paket
              </button>
            </div>

            {packageId !==
            'none' ? (
              <StudioSelect
                label="Pilihan Paket"
                options={
                  packageOptions
                }
                selectedKey={
                  packageId
                }
                onChange={
                  onPackageChange
                }
              />
            ) : (
              <>
                <StudioSelect
                  label="Layanan Studio"
                  options={
                    sessionOptions
                  }
                  selectedKey={
                    sessionType
                  }
                  onChange={
                    onSessionTypeChange
                  }
                />

                {isRecordingSessionId(
                  sessionType,
                ) &&
                recordingTypeOptions.length ? (
                  <StudioSelect
                    label="Jenis Recording"
                    options={
                      recordingTypeOptions
                    }
                    selectedKey={
                      recordingTypeId
                    }
                    onChange={
                      setRecordingTypeId
                    }
                  />
                ) : null}

                {!isRecordingSessionId(
                  sessionType,
                ) ? (
                  <>
                    <StudioSelect
                      label="Durasi"
                      options={
                        durationOptions
                      }
                      selectedKey={
                        duration
                      }
                      onChange={
                        setDuration
                      }
                    />

                    {duration ===
                    'custom' ? (
                      <label className="client-booking-wizard-custom-duration">
                        <span>
                          Durasi Kustom
                        </span>

                        <input
                          max="24"
                          min="1"
                          type="number"
                          value={
                            customDuration
                          }
                          onChange={(
                            event,
                          ) =>
                            setCustomDuration(
                              event.target.value,
                            )
                          }
                        />
                      </label>
                    ) : null}
                  </>
                ) : null}
              </>
            )}

            <section className="client-booking-wizard-estimate">
              <div>
                <span>
                  Layanan
                </span>

                <strong>
                  {
                    serviceLabel
                  }
                </strong>
              </div>

              <div>
                <span>
                  Durasi
                </span>

                <strong>
                  {actualDuration
                    ? actualDuration +
                      ' Jam'
                    : 'Tanpa durasi studio'}
                </strong>
              </div>

              <div>
                <span>
                  Subtotal
                </span>

                <strong>
                  {
                    formatRupiah(
                      pricingBreakdown.subtotal,
                    )
                  }
                </strong>
              </div>

              {pricingBreakdown.discountAmount >
              0 ? (
                <div className="is-discount">
                  <span>
                    Promo
                  </span>

                  <strong>
                    -
                    {
                      formatRupiah(
                        pricingBreakdown.discountAmount,
                      )
                    }
                  </strong>
                </div>
              ) : null}

              <div className="is-total">
                <span>
                  Total Estimasi
                </span>

                <strong>
                  {
                    formatRupiah(
                      pricingBreakdown.total,
                    )
                  }
                </strong>
              </div>
            </section>

            <section className="client-booking-wizard-proof">
              <label className="client-booking-wizard-proof-toggle">
                <input
                  checked={
                    proofEnabled
                  }
                  type="checkbox"
                  onChange={(
                    event,
                  ) => {
                    const checked =
                      event.target
                        .checked;

                    setProofEnabled(
                      checked,
                    );

                    if (
                      checked &&
                      !proofAmount
                    ) {
                      setProofAmount(
                        String(
                          Math.min(
                            pricingBreakdown.total ||
                              50000,
                            50000,
                          ),
                        ),
                      );
                    }
                  }}
                />

                <span>
                  <strong>
                    Upload bukti pembayaran sekarang
                  </strong>

                  <small>
                    Opsional. Bisa dilakukan setelah request terkirim.
                  </small>
                </span>
              </label>

              {proofEnabled ? (
                <div className="client-booking-wizard-proof-grid">
                  <label>
                    <span>
                      Kategori
                    </span>

                    <select
                      value={
                        proofCategory
                      }
                      onChange={(
                        event,
                      ) =>
                        setProofCategory(
                          event.target.value,
                        )
                      }
                    >
                      {paymentProofCategoryOptions.map(
                        (
                          option,
                        ) => (
                          <option
                            key={
                              option.key
                            }
                            value={
                              option.key
                            }
                          >
                            {
                              option.label
                            }
                          </option>
                        ),
                      )}
                    </select>
                  </label>

                  <label>
                    <span>
                      Metode
                    </span>

                    <select
                      value={
                        proofMethod
                      }
                      onChange={(
                        event,
                      ) =>
                        setProofMethod(
                          event.target.value,
                        )
                      }
                    >
                      {paymentProofMethodOptions.map(
                        (
                          option,
                        ) => (
                          <option
                            key={
                              option.key
                            }
                            value={
                              option.key
                            }
                          >
                            {
                              option.label
                            }
                          </option>
                        ),
                      )}
                    </select>
                  </label>

                  <label>
                    <span>
                      Nominal
                    </span>

                    <input
                      min="1"
                      type="number"
                      value={
                        proofAmount
                      }
                      onChange={(
                        event,
                      ) =>
                        setProofAmount(
                          event.target.value,
                        )
                      }
                    />
                  </label>

                  <label className="client-booking-wizard-file">
                    <span>
                      File Bukti
                    </span>

                    <span className="client-booking-wizard-file-button">
                      <UploadCloud
                        size={14}
                      />

                      <b>
                        {proofFile
                          ? proofFile.name
                          : 'Pilih Foto'}
                      </b>

                      <input
                        accept="image/*"
                        type="file"
                        onChange={(
                          event,
                        ) =>
                          setProofFile(
                            event.target
                              .files?.[
                              0
                            ] ||
                              null,
                          )
                        }
                      />
                    </span>
                  </label>

                  <label className="client-booking-wizard-proof-note">
                    <span>
                      Catatan
                    </span>

                    <textarea
                      placeholder="Opsional"
                      value={
                        proofNote
                      }
                      onChange={(
                        event,
                      ) =>
                        setProofNote(
                          event.target.value,
                        )
                      }
                    />
                  </label>
                </div>
              ) : null}
            </section>
          </div>
        ) : (
          <div className="client-booking-wizard-body">
            <section className="client-booking-wizard-review">
              <span className="client-booking-wizard-eyebrow">
                Periksa sebelum kirim
              </span>

              <h3>
                Pastikan detail booking sudah benar.
              </h3>

              <dl>
                <div>
                  <dt>
                    Customer
                  </dt>

                  <dd>
                    {
                      customerName
                    }
                  </dd>
                </div>

                <div>
                  <dt>
                    WhatsApp
                  </dt>

                  <dd>
                    {
                      customerPhone
                    }
                  </dd>
                </div>

                <div>
                  <dt>
                    Jadwal
                  </dt>

                  <dd>
                    {
                      formatBookingDate(
                        date,
                      )
                    }
                    {' · '}
                    {
                      String(
                        startHour,
                      ).padStart(
                        2,
                        '0',
                      )
                    }
                    .00 WIB
                  </dd>
                </div>

                <div>
                  <dt>
                    Layanan
                  </dt>

                  <dd>
                    {
                      serviceLabel
                    }
                  </dd>
                </div>

                <div>
                  <dt>
                    Durasi
                  </dt>

                  <dd>
                    {actualDuration
                      ? actualDuration +
                        ' Jam'
                      : 'Tanpa durasi studio'}
                  </dd>
                </div>

                <div>
                  <dt>
                    Total
                  </dt>

                  <dd className="is-total">
                    {
                      formatRupiah(
                        pricingBreakdown.total,
                      )
                    }
                  </dd>
                </div>

                <div>
                  <dt>
                    Pembayaran
                  </dt>

                  <dd>
                    {proofEnabled
                      ? 'Bukti akan dikirim bersama request'
                      : 'Belum mengirim bukti pembayaran'}
                  </dd>
                </div>
              </dl>

              <p>
                Request belum menjadi jadwal aktif sampai admin mengonfirmasinya.
              </p>
            </section>
          </div>
        )}

        <footer className="client-booking-wizard-footer">
          {step ===
          'details' ? (
            <>
              <button
                className="is-secondary"
                type="button"
                onClick={
                  onClose
                }
              >
                Batal
              </button>

              <button
                className="is-primary"
                disabled={
                  !canReview
                }
                type="button"
                onClick={() =>
                  setStep(
                    'review',
                  )
                }
              >
                <span>
                  Review Booking
                </span>

                <ArrowRight
                  size={15}
                />
              </button>
            </>
          ) : (
            <>
              <button
                className="is-secondary"
                disabled={
                  isSubmitting
                }
                type="button"
                onClick={() =>
                  setStep(
                    'details',
                  )
                }
              >
                <ArrowLeft
                  size={15}
                />

                <span>
                  Kembali
                </span>
              </button>

              <button
                className="is-primary"
                disabled={
                  isSubmitting
                }
                type="button"
                onClick={
                  submitRequest
                }
              >
                <Send
                  size={15}
                />

                <span>
                  {isSubmitting
                    ? 'Mengirim...'
                    : 'Kirim Request'}
                </span>
              </button>
            </>
          )}
        </footer>
      </section>
    </div>
  );
}
