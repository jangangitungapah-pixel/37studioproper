import { CheckCircle2, Copy, Info, Landmark, MessageCircle, Receipt, UploadCloud } from 'lucide-react';
import { motion } from 'motion/react';
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
  paymentProofsLoading = false,
  paymentProofsError = '',
  bookingsLoading = false,
  bookingsError = '',
}) {
  return (
    <motion.section
      animate={{ opacity: 1, y: 0 }}
      className="client-billing-tab"
      aria-labelledby="client-billing-title"
      initial={{ opacity: 0, y: 6 }}
      transition={{ duration: 0.18, ease: 'easeOut' }}
    >
      <header className="client-billing-summary-card">
        <div>
          <span>Pembayaran aktif</span>
          <h3 id="client-billing-title">Sisa tagihan</h3>
          <p>Transfer sesuai nominal booking, lalu kirim kode referensi untuk direview admin.</p>
        </div>
        <strong>{bookingsLoading || bookingsError ? '—' : formatRupiah(stats.unpaidAmount)}</strong>
      </header>

      <div aria-label="Cara verifikasi pembayaran" className="client-billing-how-it-works">
        <div>
          <b>1</b>
          <span>Transfer ke rekening studio di bawah atau bayar via QRIS</span>
        </div>
        <div>
          <b>2</b>
          <span>Klik tombol <strong>Kirim bukti</strong> dan masukkan nomor referensi bank</span>
        </div>
        <div>
          <b>3</b>
          <span>Admin memverifikasi transaksi dan status otomatis menjadi lunas</span>
        </div>
      </div>

      {bookingsLoading ? (
        <div className="client-billing-clear" role="status">
          <span><Info size={22} /></span>
          <div><strong>Memuat tagihan</strong><small>Memeriksa booking dan sisa pembayaran Anda.</small></div>
        </div>
      ) : bookingsError ? (
        <div className="client-billing-clear is-unavailable" role="alert">
          <span><Info size={22} /></span>
          <div><strong>Tagihan belum dapat diperiksa</strong><small>Data booking belum berhasil dimuat. Coba lagi melalui pemberitahuan di atas.</small></div>
        </div>
      ) : unpaidBookings.length > 0 ? (
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
              const proofStatusUnavailable = paymentProofsLoading || Boolean(paymentProofsError);

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
                    {paymentProofsLoading ? (
                      <span className="client-proof-status is-empty">Memuat status bukti</span>
                    ) : paymentProofsError ? (
                      <span className="client-proof-status is-error">Belum dapat diperiksa</span>
                    ) : latestProof ? (
                      <span className={`client-proof-status ${getProofTone(latestProof.status)}`}>
                        {getPaymentProofStatusLabel(latestProof.status)}
                      </span>
                    ) : <span className="client-proof-status is-empty">Belum dikirim</span>}
                  </div>
                  <div className="client-proof-actions">
                    <button
                      className="client-upload-proof-button"
                      disabled={hasPendingProof || proofStatusUnavailable}
                      type="button"
                      onClick={() => openPaymentProofModal(b)}
                    >
                      {hasPendingProof ? <CheckCircle2 size={14} /> : proofStatusUnavailable ? <Info size={14} /> : <UploadCloud size={14} />}
                      <span>{paymentProofsLoading ? 'Memuat status' : paymentProofsError ? 'Status belum tersedia' : hasPendingProof ? 'Menunggu review' : 'Kirim bukti'}</span>
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
    </motion.section>
  );
}
