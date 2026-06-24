import { forwardRef } from 'react';
import { AlertCircle } from 'lucide-react';
import Button from './Button';
import '../../styles/modules/shared.css';

const ErrorState = forwardRef(function ErrorState(
  { title = 'Terjadi Kesalahan', message, onRetry, className = '', ...props },
  ref
) {
  return (
    <div ref={ref} className={`studio-error-state ${className}`} role="alert" {...props}>
      <span className="studio-state-icon is-error" aria-hidden="true">
        <AlertCircle size={22} />
      </span>
      <h3 className="studio-error-title">{title}</h3>
      {message && <p className="studio-error-desc">{message}</p>}
      {onRetry && (
        <Button variant="danger" size="sm" onClick={onRetry} className="studio-error-action">
          Coba Lagi
        </Button>
      )}
    </div>
  );
});

export default ErrorState;
