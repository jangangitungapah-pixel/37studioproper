import { useEffect, useRef } from 'react';
import { AlertTriangle, Trash2, X } from 'lucide-react';

/**
 * ConfirmDialog — pengganti `window.confirm()` yang bisa di-style dan accessible.
 *
 * Penggunaan:
 * ```jsx
 * const [confirm, setConfirm] = useState(null);
 *
 * // Trigger:
 * setConfirm({
 *   title: 'Hapus Item?',
 *   message: 'Tindakan ini tidak dapat dibatalkan.',
 *   variant: 'danger', // 'danger' | 'warning' | 'info'
 *   confirmLabel: 'Ya, Hapus',
 *   onConfirm: () => handleDelete(id),
 * });
 *
 * // Render:
 * <ConfirmDialog config={confirm} onClose={() => setConfirm(null)} />
 * ```
 */
export default function ConfirmDialog({ config, onClose }) {
  const confirmBtnRef = useRef(null);

  useEffect(() => {
    if (config) {
      // Focus confirm button for keyboard accessibility
      setTimeout(() => confirmBtnRef.current?.focus(), 50);

      const handleKeyDown = (e) => {
        if (e.key === 'Escape') onClose();
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [config, onClose]);

  if (!config) return null;

  const {
    title = 'Konfirmasi',
    message = 'Apakah Anda yakin?',
    detail = '',
    variant = 'danger',
    confirmLabel = 'Ya, Lanjutkan',
    cancelLabel = 'Batal',
    onConfirm,
  } = config;

  const variantColors = {
    danger: {
      icon: <Trash2 size={18} />,
      iconBg: 'rgba(255,75,75,0.15)',
      iconColor: '#ff6b6b',
      btnBg: 'linear-gradient(135deg, #ff4b4b, #cc2020)',
      btnHover: '#cc2020',
    },
    warning: {
      icon: <AlertTriangle size={18} />,
      iconBg: 'rgba(255,176,32,0.15)',
      iconColor: '#ffb020',
      btnBg: 'linear-gradient(135deg, #ffb020, #cc8000)',
      btnHover: '#cc8000',
    },
    info: {
      icon: <AlertTriangle size={18} />,
      iconBg: 'rgba(255,138,42,0.15)',
      iconColor: '#ff8a2a',
      btnBg: 'linear-gradient(135deg, #ff8a2a, #ff5f15)',
      btnHover: '#ff5f15',
    },
  };

  const colors = variantColors[variant] || variantColors.danger;

  function handleConfirm() {
    onClose();
    onConfirm?.();
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        background: 'rgba(0,0,0,0.72)',
        backdropFilter: 'blur(8px)',
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-message"
        style={{
          width: 'min(100%, 420px)',
          borderRadius: '24px',
          border: '1px solid rgba(255,255,255,0.1)',
          background: '#111113',
          boxShadow: '0 32px 80px rgba(0,0,0,0.7)',
          overflow: 'hidden',
          animation: 'confirm-rise 180ms cubic-bezier(0.16, 1, 0.3, 1) both',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'auto minmax(0,1fr) auto',
          alignItems: 'center',
          gap: '12px',
          padding: '18px 18px 16px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '14px',
            background: colors.iconBg,
            color: colors.iconColor,
            display: 'grid',
            placeItems: 'center',
            flexShrink: 0,
          }}>
            {colors.icon}
          </div>
          <h2 id="confirm-title" style={{
            margin: 0,
            color: '#f7f3ec',
            fontSize: '1rem',
            fontWeight: 700,
            letterSpacing: '-0.02em',
            lineHeight: 1.25,
          }}>
            {title}
          </h2>
          <button
            onClick={onClose}
            aria-label="Tutup dialog"
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '12px',
              border: '1px solid rgba(255,255,255,0.1)',
              background: 'rgba(255,255,255,0.05)',
              color: 'rgba(247,243,236,0.5)',
              display: 'grid',
              placeItems: 'center',
              cursor: 'pointer',
            }}
          >
            <X size={15} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '16px 18px' }}>
          <p id="confirm-message" style={{
            margin: '0 0 8px',
            color: 'rgba(247,243,236,0.75)',
            fontSize: '0.9rem',
            lineHeight: 1.6,
          }}>
            {message}
          </p>
          {detail && (
            <p style={{
              margin: 0,
              color: 'rgba(247,243,236,0.45)',
              fontSize: '0.8rem',
              lineHeight: 1.5,
              fontStyle: 'italic',
            }}>
              {detail}
            </p>
          )}
        </div>

        {/* Footer */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '8px',
          padding: '0 18px 18px',
        }}>
          <button
            onClick={onClose}
            style={{
              minHeight: '44px',
              borderRadius: '14px',
              border: '1px solid rgba(255,255,255,0.1)',
              background: 'rgba(255,255,255,0.05)',
              color: 'rgba(247,243,236,0.75)',
              fontSize: '0.88rem',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmBtnRef}
            onClick={handleConfirm}
            style={{
              minHeight: '44px',
              borderRadius: '14px',
              border: '0',
              background: colors.btnBg,
              color: '#fff',
              fontSize: '0.88rem',
              fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes confirm-rise {
          from { opacity: 0; transform: translateY(8px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  );
}
