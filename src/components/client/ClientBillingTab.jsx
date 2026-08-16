import { CheckCircle2, Copy, Info, Landmark, MessageCircle, Receipt, UploadCloud } from 'lucide-react';
import { formatRupiah } from '../../settings/pricingSettings.js';
import { getBookingOutstandingAmount } from '../../utils/bookingPaymentUtils.js';
import { getPaymentProofStatusLabel } from '../../services/paymentProofRepository.js';
import { defaultStudioSettings, formatBankAccountNumber } from '../../settings/studioSettings.js';

export default function ClientBillingTab({
  stats,
  unpaidBookings,
  getLatestPaymentProof,
  getProofTone,
  openPaymentProofModal,
  getBookingWhatsAppUrl,
  studioSettings,
  transferAccountNumber,
  studioPaymentTerms,
  copyText,
}) {
  return (
    <section className="client-billing-tab" aria-labelledby="client-billing-title">
      <header className="client-billing-summary-card">
        <div>
          <span>Pembayaran aktif</span>
          <h3 id="client-billing-title">Sisa tagihan</h3>
          <p>Transfer sesuai nominal booking, lalu kirim bukti untuk direview admin.</p>
        </div>
        <strong>{formatRupiah(stats.unpaidAmount)}</strong>
      </header>

      {unpaidBookings.length > 0 ? (
        <section className="client-billing-worklist" aria-labelledby="client-billing-worklist-title">
          <header>
            <div>
              <span>Perlu tindakan</span>
              <h4 id="client-billing-worklist-title">Tagihan booking</h4>
            </div>
            <small>{unpaidBookings.length} aktif</small>
          </header>

          <div className="client-billing-list">
            {unpaidBookings.map((b) => {
              const amountToPay = getBookingOutstandingAmount(b);
              const latestProof = getLatestPaymentProof(b);
              const hasPendingProof = latestProof?.status === 'pending';

              return (
                <article className="client-billing-item" key={b.id}>
                  <span className="client-billing-item-icon"><Receipt size={17} /></span>
                  <div className="client-billing-item-copy">
                    <strong>{b.sessionLabel || b.packageLabel || b.title || 'Sesi Studio'}</strong>
                    <small>{b.bookingCode || 'BKG'} · {new Date(`${b.date}T00:00:00`).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}</small>
                  </div>
                  <div className="client-billing-item-amount">
                    <small>Sisa</small>
                    <strong>{formatRupiah(amountToPay)}</strong>
                  </div>
                  <div className="client-billing-item-state">
                    {latestProof ? (
                      <span className={`client-proof-status ${getProofTone(latestProof.status)}`}>
                        {getPaymentProofStatusLabel(latestProof.status)}
                      </span>
                    ) : <span className="client-proof-status is-empty">Belum dikirim</span>}
                  </div>
                  <div className="client-proof-actions">
                    <button
                      className="client-upload-proof-button"
                      disabled={hasPendingProof}
                      type="button"
                      onClick={() => openPaymentProofModal(b)}
                    >
                      {hasPendingProof ? <CheckCircle2 size={14} /> : <UploadCloud size={14} />}
                      <span>{hasPendingProof ? 'Menunggu review' : 'Kirim bukti'}</span>
                    </button>
                    <a
                      href={getBookingWhatsAppUrl(b)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="client-proof-wa-button"
                      aria-label={`Hubungi admin untuk ${b.bookingCode || b.id}`}
                    >
                      <MessageCircle size={15} />
                    </a>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      ) : (
        <div className="client-billing-clear">
          <span><CheckCircle2 size={22} /></span>
          <div><strong>Semua pembayaran beres</strong><small>Tidak ada tagihan aktif saat ini.</small></div>
        </div>
      )}

      <div className="client-payment-layout">
        <section className="client-payment-info-card">
          <header>
            <span><Landmark size={18} /></span>
            <div><small>Transfer bank</small><h4>Rekening studio</h4></div>
          </header>

          <div className="client-payment-account">
            <span>{studioSettings.bankName || defaultStudioSettings.bankName}</span>
            <strong>{formatBankAccountNumber(transferAccountNumber)}</strong>
            <small>a.n. {studioSettings.bankAccountHolder || defaultStudioSettings.bankAccountHolder}</small>
            <button type="button" onClick={() => copyText(transferAccountNumber, 'Nomor rekening disalin.')}>
              <Copy size={14} /> Salin nomor
            </button>
          </div>

          <div className="client-payment-qris">
            <small>QRIS</small>
            <strong>{studioSettings.qrisLabel || defaultStudioSettings.qrisLabel}</strong>
            <span>{studioSettings.qrisNote || defaultStudioSettings.qrisNote}</span>
          </div>
        </section>

        <aside className="client-payment-terms-card">
          <header><Info size={17} /><h4>Ketentuan pembayaran</h4></header>
          <ol>
            {studioPaymentTerms.map((term, index) => <li key={`${term}-${index}`}>{term}</li>)}
          </ol>
        </aside>
      </div>
    </section>
  );
}
