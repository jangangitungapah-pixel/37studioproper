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
    <div className="client-billing-tab" style={{ gap: '12px' }}>
      <div className="client-billing-summary-card" style={{
        padding: '14px',
        background: 'var(--studio-surface-1)',
        border: '1px solid var(--studio-border)',
        borderRadius: 'var(--studio-radius-lg)',
        position: 'relative',
        overflow: 'hidden'
      }}>
        <div style={{ position: 'absolute', top: 0, right: 0, width: '120px', height: '120px', borderRadius: '50%', background: 'var(--studio-accent-soft)', filter: 'blur(28px)', opacity: 0.15, pointerEvents: 'none' }} />
        <span style={{ fontSize: '10px', uppercase: 'true', tracking: '0.05em', color: 'var(--auth-text-muted)', fontWeight: '700' }}>Total Sisa Tagihan Aktif</span>
        <strong style={{ fontSize: '1.8rem', fontWeight: '800', color: '#fff', display: 'block', margin: '2px 0' }}>{formatRupiah(stats.unpaidAmount)}</strong>
        <p style={{ margin: 0, fontSize: '11px', color: 'var(--auth-text-muted)', lineHeight: '1.45' }}>
          Silakan transfer sesuai sisa tagihan, lalu upload bukti pembayaran. Admin akan mereview sebelum status pembayaran dinyatakan lunas.
        </p>
      </div>

      {unpaidBookings.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <h4 style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', tracking: '0.05em', color: 'var(--auth-text-muted)', margin: '0 0 2px' }}>Daftar Tagihan Pending / DP</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {unpaidBookings.map((b) => {
              const status = getBookingStatus(b);
              const amountToPay = status === 'dp'
                ? Math.max(0, (b.total || 0) - (b.dpAmount || 0))
                : (b.total || 0);
              const latestProof = getLatestPaymentProof(b);
              const hasPendingProof = latestProof?.status === 'pending';

              return (
                <div key={b.id} className="client-billing-item" style={{
                  display: 'flex',
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px',
                  padding: '10px 12px',
                  background: 'var(--studio-surface-1)',
                  border: '1px solid var(--studio-border)',
                  borderRadius: 'var(--studio-radius-lg)'
                }}>
                  {/* Left: Invoice code, Title, Date */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0, flex: 1 }}>
                    <h5 style={{ margin: 0, fontSize: '12px', fontWeight: '800', color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {b.sessionLabel || b.packageLabel || b.title || 'Sesi Latihan'}
                    </h5>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '9px', color: 'var(--studio-text-muted)' }}>
                      <span className="client-booking-code" style={{ fontSize: '8px', padding: '1px 3px' }}>{b.bookingCode || 'BKG'}</span>
                      <span>•</span>
                      <span>{new Date(`${b.date}T00:00:00`).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}</span>
                    </div>
                  </div>

                  {/* Middle-Right: Nominal Tagihan */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '1px', flexShrink: 0, textAlign: 'right', minWidth: '70px' }}>
                    <strong style={{ fontSize: '12px', fontWeight: '800', color: 'var(--auth-accent)' }}>
                      {formatRupiah(amountToPay)}
                    </strong>
                    {latestProof ? (
                      <span className={'client-proof-status ' + getProofTone(latestProof.status)} style={{ fontSize: '8px', padding: '1px 4px', borderRadius: '3px' }}>
                        {getPaymentProofStatusLabel(latestProof.status)}
                      </span>
                    ) : null}
                  </div>

                  {/* Far Right: Actions */}
                  <div className="client-proof-actions" style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                    <button
                      className="client-upload-proof-button"
                      disabled={hasPendingProof}
                      type="button"
                      onClick={() => openPaymentProofModal(b)}
                      style={{ height: '32px', padding: '0 8px', fontSize: '10px', fontWeight: '700' }}
                    >
                      <UploadCloud size={11} />
                      <span>{hasPendingProof ? 'Review' : 'Bayar'}</span>
                    </button>
                    <a
                      href={getBookingWhatsAppUrl(b)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="client-proof-wa-button"
                      style={{ height: '32px', width: '32px', display: 'grid', placeItems: 'center', padding: 0 }}
                    >
                      WA
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="client-payment-info-card" style={{
        padding: '12px',
        background: 'var(--studio-surface-1)',
        border: '1px solid var(--studio-border)',
        borderRadius: 'var(--studio-radius-lg)'
      }}>
        <h4 style={{ fontSize: '11px', fontWeight: '700', color: '#fff', margin: '0 0 8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Receipt size={13} className="text-[#ff8a2a]" />
          <span>Informasi Rekening Studio</span>
        </h4>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '8px' }}>
          <div className="client-payment-method-card" style={{ padding: '10px', background: 'var(--studio-surface-2)', border: '1px solid var(--studio-border)', borderRadius: 'var(--studio-radius-md)' }}>
            <span style={{ fontSize: '8px', color: 'var(--studio-text-muted)', textTransform: 'uppercase' }}>{studioSettings.bankName || defaultStudioSettings.bankName}</span>
            <strong style={{ fontSize: '13px', color: '#fff', fontWeight: '800', tracking: '0.05em' }}>{formatBankAccountNumber(transferAccountNumber)}</strong>
            <span style={{ fontSize: '10px', color: 'var(--studio-text-muted)', margin: '1px 0 6px' }}>A/N: {studioSettings.bankAccountHolder || defaultStudioSettings.bankAccountHolder}</span>
            <button className="client-copy-account" type="button" onClick={() => copyText(transferAccountNumber, 'Nomor rekening disalin.')}>
              <Copy size={10} /> Salin
            </button>
          </div>
          <div className="client-payment-method-card" style={{ padding: '10px', background: 'var(--studio-surface-2)', border: '1px solid var(--studio-border)', borderRadius: 'var(--studio-radius-md)' }}>
            <span style={{ fontSize: '8px', color: 'var(--studio-text-muted)', textTransform: 'uppercase' }}>Metode QRIS</span>
            <strong style={{ fontSize: '12px', color: '#fff', fontWeight: '800' }}>{studioSettings.qrisLabel || defaultStudioSettings.qrisLabel}</strong>
            <span style={{ fontSize: '10px', color: 'var(--studio-text-muted)', marginTop: '1px' }}>{studioSettings.qrisNote || defaultStudioSettings.qrisNote}</span>
          </div>
        </div>

        <div className="client-payment-terms-card" style={{
          padding: '10px',
          background: 'rgba(255, 138, 42, 0.05)',
          border: '1px solid rgba(255, 138, 42, 0.15)',
          borderRadius: 'var(--studio-radius-md)',
          fontSize: '10px',
          color: 'var(--studio-text-muted)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#fff', fontWeight: '700', marginBottom: '4px' }}>
            <Info size={11} className="text-orange-400" />
            <span>Ketentuan Pembayaran:</span>
          </div>
          {studioPaymentTerms.map((term, index) => (
            <p key={term + '-' + index} style={{ margin: '2px 0 0' }}>• {term}</p>
          ))}
        </div>
      </div>
    </div>
  );
}
