import { forwardRef } from 'react';
import { LoaderCircle } from 'lucide-react';
import '../../styles/modules/shared.css';

const LoadingState = forwardRef(function LoadingState(
  { message = 'Memuat data...', fullHeight = false, className = '', ...props },
  ref
) {
  return (
    <div 
      ref={ref} 
      className={`studio-loading-state ${fullHeight ? 'is-full-height' : ''} ${className}`} 
      {...props}
    >
      <LoaderCircle size={32} className="studio-loading-spinner auth-spin" />
      <p className="studio-loading-text">{message}</p>
    </div>
  );
});

export default LoadingState;
