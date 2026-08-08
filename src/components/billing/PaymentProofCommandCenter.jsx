import {
  useMemo,
  useState,
} from 'react';
import {
  CheckCircle2,
  Clock3,
  Image,
  Search,
  UploadCloud,
  XCircle,
} from 'lucide-react';
import PaginationControls from '../ui/PaginationControls.jsx';
import StudioSelect from '../ui/StudioSelect.jsx';
import {
  getPaymentProofStatusLabel,
} from '../../services/paymentProofRepository.js';
import {
  getPaginationSlice,
} from '../../utils/pagination.js';

const PROOF_PAGE_SIZE = 8;

const proofStatusFilterOptions = [
  {
    key:
      'all',

    label:
      'Semua',

    description:
      'Semua bukti pembayaran',
  },

  {
    key:
      'pending',

    label:
      'Menunggu Review',

    description:
      'Perlu tindakan admin',
  },

  {
    key:
      'approved',

    label:
      'Approved',

    description:
      'Pembayaran tervalidasi',
  },

  {
    key:
      'rejected',

    label:
      'Rejected',

    description:
      'Bukti pembayaran ditolak',
  },
];

function formatMoney(
  value,
) {
  return new Intl.NumberFormat(
    'id-ID',
    {
      currency:
        'IDR',

      maximumFractionDigits:
        0,

      style:
        'currency',
    },
  ).format(
    Math.max(
      0,
      Number(
        value,
      ) ||
        0,
    ),
  );
}

function formatDateTime(
  value,
) {
  if (
    !value
  ) {
    return '-';
  }

  const date =
    new Date(
      value,
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
        '2-digit',

      hour:
        '2-digit',

      minute:
        '2-digit',

      month:
        'short',

      year:
        'numeric',
    },
  ).format(
    date,
  );
}

function getCategoryLabel(
  value,
) {
  return value ===
    'pelunasan'
    ? 'Pelunasan'
    : 'DP';
}

function getMethodLabel(
  value,
) {
  if (
    value ===
    'qris'
  ) {
    return 'QRIS';
  }

  if (
    value ===
    'transfer'
  ) {
    return 'Transfer';
  }

  return (
    value ||
    'Lainnya'
  );
}

function getProofTone(
  status,
) {
  if (
    status ===
    'approved'
  ) {
    return 'is-approved';
  }

  if (
    status ===
    'rejected'
  ) {
    return 'is-rejected';
  }

  return 'is-pending';
}

function getBookingForProof(
  bookingsById,
  proof,
) {
  if (
    !proof?.bookingId ||
    !bookingsById ||
    typeof bookingsById.get !==
      'function'
  ) {
    return null;
  }

  return (
    bookingsById.get(
      proof.bookingId,
    ) ||
    null
  );
}

function getBookingCode(
  proof,
  booking,
) {
  return (
    booking?.bookingCode ||
    booking?.bookingId ||
    proof?.bookingCode ||
    proof?.bookingId ||
    '-'
  );
}

function getInvoiceNumber(
  proof,
  booking,
) {
  return (
    booking?.invoiceNumber ||
    proof?.invoiceNumber ||
    '-'
  );
}

function getProofSearchHaystack(
  proof,
  booking,
) {
  return [
    proof?.customer,
    proof?.bookingCode,
    proof?.bookingId,
    proof?.invoiceNumber,
    proof?.method,
    proof?.category,
    proof?.status,
    proof?.adminNote,
    proof?.clientNote,
    proof?.reviewedByName,

    booking?.customer,
    booking?.phone,
    booking?.bandName,
    booking?.bookingCode,
    booking?.bookingId,
    booking?.invoiceNumber,
  ]
    .join(
      ' ',
    )
    .toLowerCase();
}

export default function PaymentProofCommandCenter({
  bookingsById,
  onOpenProof,
  proofs,
}) {
  const [
    activeFilter,
    setActiveFilter,
  ] =
    useState(
      'pending',
    );

  const [
    query,
    setQuery,
  ] =
    useState(
      '',
    );

  const [
    page,
    setPage,
  ] =
    useState(
      1,
    );

  const stats =
    useMemo(
      () => {
        return proofs.reduce(
          (
            result,
            proof,
          ) => {
            result.total +=
              1;

            result.amount +=
              Math.max(
                0,
                Number(
                  proof.amount,
                ) ||
                  0,
              );

            if (
              proof.status ===
              'pending'
            ) {
              result.pending +=
                1;
            }

            if (
              proof.status ===
              'approved'
            ) {
              result.approved +=
                1;
            }

            if (
              proof.status ===
              'rejected'
            ) {
              result.rejected +=
                1;
            }

            return result;
          },

          {
            amount:
              0,

            approved:
              0,

            pending:
              0,

            rejected:
              0,

            total:
              0,
          },
        );
      },

      [
        proofs,
      ],
    );

  const filteredProofs =
    useMemo(
      () => {
        const normalizedQuery =
          query
            .trim()
            .toLowerCase();

        return proofs.filter(
          (
            proof,
          ) => {
            const booking =
              getBookingForProof(
                bookingsById,
                proof,
              );

            const matchesStatus =
              activeFilter ===
                'all' ||
              proof.status ===
                activeFilter;

            if (
              !matchesStatus
            ) {
              return false;
            }

            if (
              !normalizedQuery
            ) {
              return true;
            }

            return getProofSearchHaystack(
              proof,
              booking,
            ).includes(
              normalizedQuery,
            );
          },
        );
      },

      [
        activeFilter,
        bookingsById,
        proofs,
        query,
      ],
    );

  const totalPages =
    Math.max(
      1,
      Math.ceil(
        filteredProofs.length /
          PROOF_PAGE_SIZE,
      ),
    );

  const safePage =
    Math.min(
      page,
      totalPages,
    );

  const visibleProofs =
    getPaginationSlice(
      filteredProofs,
      safePage,
      PROOF_PAGE_SIZE,
    );

  function handleFilterChange(
    nextFilter,
  ) {
    setActiveFilter(
      nextFilter,
    );

    setPage(
      1,
    );
  }

  function handleSearchChange(
    event,
  ) {
    setQuery(
      event.target.value,
    );

    setPage(
      1,
    );
  }

  return (
    <section
      className="billing-proof-command-center"
      aria-labelledby="billing-proof-command-title"
    >
      <header className="billing-proof-command-header">
        <div>
          <span>
            Payment Verification
          </span>

          <h3 id="billing-proof-command-title">
            Bukti Pembayaran
          </h3>

          <p>
            Review transfer client, lihat histori approval, dan audit setiap keputusan pembayaran.
          </p>
        </div>

        <div className="billing-proof-command-pending">
          <UploadCloud
            size={17}
          />

          <span>
            <small>
              Perlu Review
            </small>

            <strong>
              {
                stats.pending
              }
            </strong>
          </span>
        </div>
      </header>

      <div className="billing-proof-command-stats">
        <article className="is-pending">
          <Clock3
            size={16}
          />

          <span>
            <small>
              Pending
            </small>

            <strong>
              {
                stats.pending
              }
            </strong>
          </span>
        </article>

        <article className="is-approved">
          <CheckCircle2
            size={16}
          />

          <span>
            <small>
              Approved
            </small>

            <strong>
              {
                stats.approved
              }
            </strong>
          </span>
        </article>

        <article className="is-rejected">
          <XCircle
            size={16}
          />

          <span>
            <small>
              Rejected
            </small>

            <strong>
              {
                stats.rejected
              }
            </strong>
          </span>
        </article>

        <article>
          <UploadCloud
            size={16}
          />

          <span>
            <small>
              Submitted
            </small>

            <strong>
              {
                formatMoney(
                  stats.amount,
                )
              }
            </strong>
          </span>
        </article>
      </div>

      <div className="billing-proof-command-toolbar">
        <label className="billing-proof-command-search">
          <Search
            size={16}
          />

          <input
            aria-label="Cari bukti pembayaran"
            placeholder="Cari customer, invoice, booking ID..."
            type="search"
            value={
              query
            }
            onChange={
              handleSearchChange
            }
          />
        </label>

        <div className="billing-proof-command-filter">
          <StudioSelect
            label="Status Bukti"
            options={
              proofStatusFilterOptions
            }
            selectedKey={
              activeFilter
            }
            onChange={
              handleFilterChange
            }
          />
        </div>
      </div>

      {visibleProofs.length ? (
        <div className="billing-proof-command-list">
          {visibleProofs.map(
            (
              proof,
            ) => {
              const booking =
                getBookingForProof(
                  bookingsById,
                  proof,
                );

              const reviewed =
                proof.status !==
                'pending';

              return (
                <button
                  className="billing-proof-command-row"
                  key={
                    proof.id
                  }
                  type="button"
                  onClick={() =>
                    onOpenProof(
                      proof,
                    )
                  }
                >
                  <span className="billing-proof-command-thumb">
                    {proof.proofUrl ? (
                      <img
                        alt=""
                        loading="lazy"
                        src={
                          proof.proofUrl
                        }
                      />
                    ) : (
                      <Image
                        size={16}
                      />
                    )}
                  </span>

                  <span className="billing-proof-command-main">
                    <strong>
                      {
                        proof.customer ||
                        booking?.customer ||
                        'Client'
                      }
                    </strong>

                    <small>
                      {
                        getInvoiceNumber(
                          proof,
                          booking,
                        )
                      }
                      {' · '}
                      {
                        getBookingCode(
                          proof,
                          booking,
                        )
                      }
                    </small>

                    <em>
                      {
                        getCategoryLabel(
                          proof.category,
                        )
                      }
                      {' · '}
                      {
                        getMethodLabel(
                          proof.method,
                        )
                      }
                    </em>
                  </span>

                  <span className="billing-proof-command-audit">
                    <small>
                      {
                        reviewed
                          ? 'Reviewed'
                          : 'Submitted'
                      }
                    </small>

                    <strong>
                      {
                        formatDateTime(
                          reviewed
                            ? proof.reviewedAt
                            : proof.createdAt,
                        )
                      }
                    </strong>

                    {reviewed ? (
                      <em>
                        {
                          proof.reviewedByName ||
                          'Admin'
                        }
                      </em>
                    ) : null}
                  </span>

                  <span className="billing-proof-command-amount">
                    <strong>
                      {
                        formatMoney(
                          proof.amount,
                        )
                      }
                    </strong>

                    <b
                      className={
                        'billing-proof-status ' +
                        getProofTone(
                          proof.status,
                        )
                      }
                    >
                      {
                        getPaymentProofStatusLabel(
                          proof.status,
                        )
                      }
                    </b>
                  </span>
                </button>
              );
            },
          )}
        </div>
      ) : (
        <div className="billing-proof-command-empty">
          <UploadCloud
            size={22}
          />

          <strong>
            Tidak ada bukti pembayaran
          </strong>

          <span>
            Ubah pencarian atau filter status untuk melihat data lain.
          </span>
        </div>
      )}

      <PaginationControls
        label="bukti pembayaran"
        page={
          safePage
        }
        pageSize={
          PROOF_PAGE_SIZE
        }
        totalItems={
          filteredProofs.length
        }
        onPageChange={
          setPage
        }
      />
    </section>
  );
}
