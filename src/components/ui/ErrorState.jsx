import { forwardRef } from 'react';
import { AlertCircle } from 'lucide-react';
import Button from './Button';
import '../../styles/modules/shared.css';

const ErrorState = forwardRef(function ErrorState(
  { title = 'Terjadi Kesalahan', message, onRetry, className = '', ...props },
  ref
) {
  return (
    <div ref={ref} className={`studio-error-state ${className}`} {...props}>
      <AlertCircle size={36} className="studio-error-icon" />
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
