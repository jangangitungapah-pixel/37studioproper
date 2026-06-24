import { Receipt, UploadCloud, Copy, Info } from 'lucide-react';
import { formatRupiah } from '../../settings/pricingSettings.js';
import { getPaymentProofStatusLabel } from '../../services/paymentProofRepository.js';
import { formatBankAccountNumber } from '../../settings/studioSettings.js';
import { defaultStudioSettings } from '../../settings/studioSettings.js';

export default function ClientBillingTab({
  stats,
  unpaidBookings,
  getBookingStatus,
  getLatestPaymentProof,
  getProofTone,
  openPaymentProofModal,
  getBookingWhatsAppUrl,
  studioSettings,
  transferAccountNumber,
  studioPaymentTerms,
  copyText
}) {
  return (
    <div className="client-billing-tab">
      <div className="client-billing-summary-card">
        <div className="absolute top-0 right-0 w-[140px] h-[140px] rounded-full bg-orange-500/5 filter blur-[35px] pointer-events-none" />
        <span className="text-[11px] uppercase tracking-wider text-[var(--ui-text-muted)] font-semibold">Total Sisa Tagihan Aktif</span>
        <strong className="text-3xl text-white font-bold">{formatRupiah(stats.unpaidAmount)}</strong>
        <p className="text-xs text-[var(--ui-text-muted)] leading-relaxed mt-1">
          Silakan transfer sesuai sisa tagihan, lalu upload bukti pembayaran. Admin akan review sebelum status pembayaran dianggap berhasil.
        </p>
      </div>

      {unpaidBookings.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-xs uppercase tracking-wider text-[var(--ui-text-muted)] font-semibold">Daftar Tagihan Pending / DP</h4>
          <div className="space-y-3">
            {unpaidBookings.map((b) => {
              const status = getBookingStatus(b);
              const amountToPay = status === 'dp'
                ? Math.max(0, (b.total || 0) - (b.dpAmount || 0))
                : (b.total || 0);
              const latestProof = getLatestPaymentProof(b);
              const hasPendingProof = latestProof?.status === 'pending';

              return (
                <div key={b.id} className="client-billing-item">
                  <div className="space-y-1">
                    <span className="text-[9px] uppercase tracking-wider bg-white/5 border border-white/10 px-2 py-0.5 rounded text-[var(--ui-text-muted)]">
                      {b.bookingCode || 'BKG'}
                    </span>
                    <h5 className="text-sm text-white font-bold">{b.sessionLabel || b.packageLabel || b.title || 'Sesi Latihan'}</h5>
                    <p className="text-[11px] text-[var(--ui-text-muted)]">{b.date} • {b.startHour}.00 WIB ({b.durationHours} Jam)</p>
                  </div>

                  <div className="flex sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto gap-2 border-t sm:border-t-0 border-white/5 pt-2 sm:pt-0">
                    <div className="text-left sm:text-right">
                      <span className="text-[10px] text-[var(--ui-text-muted)] block">Harus Dibayar</span>
                      <strong className="text-sm text-orange-400">{formatRupiah(amountToPay)}</strong>
                    </div>
                    {latestProof ? (
                      <span className={'client-proof-status ' + getProofTone(latestProof.status)}>
                        {getPaymentProofStatusLabel(latestProof.status)}
                      </span>
                    ) : null}
                    <div className="client-proof-actions">
                      <button
                        className="client-upload-proof-button"
                        disabled={hasPendingProof}
                        type="button"
                        onClick={() => openPaymentProofModal(b)}
                      >
                        <UploadCloud size={12} />
                        <span>{hasPendingProof ? 'Menunggu Review' : 'Upload Bukti'}</span>
                      </button>
                      <a
                        href={getBookingWhatsAppUrl(b)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="client-proof-wa-button"
                      >
                        WA
                      </a>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="client-payment-info-card">
        <h4 className="text-xs uppercase tracking-wider text-white font-bold flex items-center gap-1.5">
          <Receipt size={14} className="text-[#ff8a2a]" />
          <span>Informasi Rekening Studio</span>
        </h4>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="client-payment-method-card">
            <span className="text-[10px] text-[var(--ui-text-muted)] uppercase block">{studioSettings.bankName || defaultStudioSettings.bankName}</span>
            <strong className="text-base text-white tracking-wide">{formatBankAccountNumber(transferAccountNumber)}</strong>
            <span className="text-[11px] text-[var(--ui-text-muted)] block mt-1">A/N: {studioSettings.bankAccountHolder || defaultStudioSettings.bankAccountHolder}</span>
            <button className="client-copy-account" type="button" onClick={() => copyText(transferAccountNumber, 'Nomor rekening disalin.')}>
              <Copy size={12} /> Salin rekening
            </button>
          </div>
          <div className="client-payment-method-card">
            <span className="text-[10px] text-[var(--ui-text-muted)] uppercase block">Metode QRIS</span>
            <strong className="text-sm text-white">{studioSettings.qrisLabel || defaultStudioSettings.qrisLabel}</strong>
            <span className="text-[11px] text-[var(--ui-text-muted)] block mt-1">{studioSettings.qrisNote || defaultStudioSettings.qrisNote}</span>
          </div>
        </div>

        <div className="client-payment-terms-card">
          <div className="flex items-center gap-1 text-white font-bold mb-1">
            <Info size={12} className="text-orange-400" />
            <span>Ketentuan Pembayaran:</span>
          </div>
          {studioPaymentTerms.map((term, index) => (
            <p key={term + '-' + index}>• {term}</p>
          ))}
        </div>
      </div>
    </div>
  );
}
