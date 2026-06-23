import { forwardRef } from 'react';
import '../../styles/modules/shared.css';

const StatusPill = forwardRef(function StatusPill(
  { children, className = '', status = 'neutral', ...props },
  ref
) {
  const baseClass = 'studio-status-pill';
  const statusClass = `is-${status}`; // 'pending' | 'approved' | 'rejected' | 'active' | 'neutral'
  
  const combinedClassName = [baseClass, statusClass, className]
    .filter(Boolean)
    .join(' ');

  return (
    <div ref={ref} className={combinedClassName} {...props}>
      {children}
    </div>
  );
});

export default StatusPill;
