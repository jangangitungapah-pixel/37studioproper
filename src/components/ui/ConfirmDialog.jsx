import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { AlertTriangle, Info, Trash2, X } from 'lucide-react';
import Button from './Button.jsx';
import '../../styles/modules/shared.css';
import '../../styles/modules/modal.css';

const VARIANT_ICONS = {
  danger: Trash2,
  warning: AlertTriangle,
  info: Info,
};

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

function getConfirmErrorMessage(error, config) {
  if (config?.errorMessage) return config.errorMessage;

  if (error instanceof Error && error.message) {
    return error.message.slice(0, 240);
  }

  return 'Tindakan belum berhasil. Periksa koneksi lalu coba lagi.';
}

export default function ConfirmDialog({ config, onClose }) {
  const dialogId = useId();
  const dialogRef = useRef(null);
  const cancelButtonRef = useRef(null);
  const previousFocusRef = useRef(null);
  const backdropPointerRef = useRef(null);
  const configRef = useRef(config);
  const onCloseRef = useRef(onClose);
  const pendingRef = useRef(false);
  const [operationState, setOperationState] = useState({
    config: null,
    error: '',
    pending: false,
  });
  const [verificationState, setVerificationState] = useState({ config: null, value: '' });

  const isOpen = Boolean(config);
  const isPending = operationState.config === config && operationState.pending;
  const operationError = operationState.config === config ? operationState.error : '';

  useLayoutEffect(() => {
    configRef.current = config;
    onCloseRef.current = onClose;
    pendingRef.current = isPending;
  }, [config, isPending, onClose]);

  useEffect(() => {
    if (!isOpen) return undefined;

    previousFocusRef.current = document.activeElement;
    const focusFrame = window.requestAnimationFrame(() => cancelButtonRef.current?.focus());

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        if (!pendingRef.current) onCloseRef.current?.();
        return;
      }

      if (event.key !== 'Tab') return;

      const focusableElements = Array.from(
        dialogRef.current?.querySelectorAll(FOCUSABLE_SELECTOR) || [],
      ).filter((element) => !element.hasAttribute('disabled') && element.getAttribute('aria-hidden') !== 'true');

      if (!focusableElements.length) {
        event.preventDefault();
        dialogRef.current?.focus();
        return;
      }

      const firstElement = focusableElements[0];
      const lastElement = focusableElements.at(-1);

      if (event.shiftKey && (document.activeElement === firstElement || !dialogRef.current?.contains(document.activeElement))) {
        event.preventDefault();
        lastElement?.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement?.focus();
      }
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown, true);

    return () => {
      window.cancelAnimationFrame(focusFrame);
      window.removeEventListener('keydown', handleKeyDown, true);
      document.body.style.overflow = previousOverflow;

      const previousFocus = previousFocusRef.current;
      if (previousFocus?.isConnected) previousFocus.focus?.();
    };
  }, [isOpen]);

  if (!config) return null;

  const {
    title = 'Konfirmasi',
    message = 'Apakah Anda yakin?',
    detail = '',
    variant = 'danger',
    confirmLabel = 'Ya, Lanjutkan',
    cancelLabel = 'Batal',
    onConfirm,
    verificationExpected = '',
    verificationLabel = '',
  } = config;
  const Icon = VARIANT_ICONS[variant] || AlertTriangle;
  const titleId = `${dialogId}-title`;
  const messageId = `${dialogId}-message`;
  const detailId = `${dialogId}-detail`;
  const errorId = `${dialogId}-error`;
  const describedBy = [messageId, detail ? detailId : null, operationError ? errorId : null]
    .filter(Boolean)
    .join(' ');
  const verificationInput = verificationState.config === config ? verificationState.value : '';
  const normalizedVerification = verificationInput.trim().toLocaleLowerCase('id-ID');
  const normalizedExpected = String(verificationExpected).trim().toLocaleLowerCase('id-ID');
  const verificationMatches = !normalizedExpected || normalizedVerification === normalizedExpected;

  function requestClose() {
    if (!isPending) onCloseRef.current?.();
  }

  async function handleConfirm() {
    if (isPending || !verificationMatches) return;

    const submittedConfig = config;
    setOperationState({ config: submittedConfig, error: '', pending: true });

    try {
      await onConfirm?.();

      // Give React a commit boundary so a synchronous callback can replace the
      // active config (for example, a deliberate two-stage confirmation).
      await new Promise((resolve) => window.setTimeout(resolve, 0));

      // A synchronous callback may replace this dialog with a second confirmation.
      // Only close when the submitted configuration is still the active one.
      if (configRef.current === submittedConfig) onCloseRef.current?.();
    } catch (error) {
      if (configRef.current === submittedConfig) {
        setOperationState({
          config: submittedConfig,
          error: getConfirmErrorMessage(error, submittedConfig),
          pending: false,
        });
      }
    } finally {
      if (configRef.current === submittedConfig) {
        setOperationState((current) => (
          current.config === submittedConfig && current.pending
            ? { ...current, pending: false }
            : current
        ));
      }
    }
  }

  return (
    <div
      className="studio-confirm-backdrop"
      onPointerCancel={() => {
        backdropPointerRef.current = null;
      }}
      onPointerDown={(event) => {
        backdropPointerRef.current = event.target === event.currentTarget ? event.pointerId : null;
      }}
      onPointerUp={(event) => {
        const startedOnBackdrop = backdropPointerRef.current === event.pointerId;
        backdropPointerRef.current = null;

        if (startedOnBackdrop && event.target === event.currentTarget) requestClose();
      }}
    >
      <section
        aria-busy={isPending || undefined}
        aria-describedby={describedBy}
        aria-labelledby={titleId}
        aria-modal="true"
        className={`studio-confirm-dialog is-${variant}`}
        ref={dialogRef}
        role="alertdialog"
        tabIndex={-1}
      >
        <header className="studio-confirm-header">
          <span className="studio-confirm-icon" aria-hidden="true">
            <Icon size={19} />
          </span>

          <h2 id={titleId}>{title}</h2>

          <button
            aria-label="Tutup dialog"
            className="studio-confirm-close"
            disabled={isPending}
            type="button"
            onClick={requestClose}
          >
            <X aria-hidden="true" size={16} />
          </button>
        </header>

        <div className="studio-confirm-body">
          <p id={messageId}>{message}</p>
          {detail ? <p className="studio-confirm-detail" id={detailId}>{detail}</p> : null}
          {normalizedExpected ? (
            <label className="studio-confirm-verification">
              <span>{verificationLabel || `Ketik ${verificationExpected} untuk melanjutkan`}</span>
              <input
                autoComplete="off"
                disabled={isPending}
                spellCheck="false"
                type="text"
                value={verificationInput}
                onChange={(event) => setVerificationState({ config, value: event.target.value })}
              />
            </label>
          ) : null}
          {operationError ? (
            <p className="studio-confirm-error" id={errorId} role="alert">
              {operationError}
            </p>
          ) : null}
        </div>

        <footer className="studio-confirm-actions">
          <Button
            disabled={isPending}
            ref={cancelButtonRef}
            variant="secondary"
            onClick={requestClose}
          >
            {cancelLabel}
          </Button>
          <Button
            disabled={!verificationMatches}
            isLoading={isPending}
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
