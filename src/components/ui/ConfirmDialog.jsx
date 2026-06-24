import { useEffect, useRef } from 'react';
import { AlertTriangle, Info, Trash2, X } from 'lucide-react';
import Button from './Button.jsx';
import '../../styles/modules/shared.css';

const VARIANT_ICONS = {
  danger: Trash2,
  warning: AlertTriangle,
  info: Info,
};

export default function ConfirmDialog({ config, onClose }) {
  const cancelButtonRef = useRef(null);
  const confirmButtonRef = useRef(null);
  const previousFocusRef = useRef(null);

  useEffect(() => {
    if (!config) return undefined;

    previousFocusRef.current = document.activeElement;
    const focusFrame = window.requestAnimationFrame(() => confirmButtonRef.current?.focus());

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== 'Tab') return;

      const firstElement = cancelButtonRef.current;
      const lastElement = confirmButtonRef.current;

      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement?.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement?.focus();
      }
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.cancelAnimationFrame(focusFrame);
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previousFocusRef.current?.focus?.();
    };
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
  const Icon = VARIANT_ICONS[variant] || AlertTriangle;

  function handleConfirm() {
    onClose();
    onConfirm?.();
  }

  return (
    <div
      className="studio-confirm-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        aria-describedby="confirm-message"
        aria-labelledby="confirm-title"
        aria-modal="true"
        className={`studio-confirm-dialog is-${variant}`}
        role="alertdialog"
      >
        <header className="studio-confirm-header">
          <span className="studio-confirm-icon" aria-hidden="true">
            <Icon size={19} />
          </span>

          <h2 id="confirm-title">{title}</h2>

          <button
            aria-label="Tutup dialog"
            className="studio-confirm-close"
            type="button"
            onClick={onClose}
          >
            <X aria-hidden="true" size={16} />
          </button>
        </header>

        <div className="studio-confirm-body">
          <p id="confirm-message">{message}</p>
          {detail ? <p className="studio-confirm-detail">{detail}</p> : null}
        </div>

        <footer className="studio-confirm-actions">
          <Button ref={cancelButtonRef} variant="secondary" onClick={onClose}>
            {cancelLabel}
          </Button>
          <Button
            ref={confirmButtonRef}
            variant={variant === 'danger' ? 'danger' : variant === 'warning' ? 'warning' : 'primary'}
            onClick={handleConfirm}
          >
            {confirmLabel}
          </Button>
        </footer>
      </section>
    </div>
  );
}
