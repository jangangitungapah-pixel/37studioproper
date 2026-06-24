import { forwardRef } from 'react';
import '../../styles/modules/shared.css';

const StatusPill = forwardRef(function StatusPill(
  { children, className = '', status = 'neutral', ...props },
  ref
) {
  const combinedClassName = ['studio-status-pill', `is-${status}`, className]
    .filter(Boolean)
    .join(' ');

  return (
    <span ref={ref} className={combinedClassName} {...props}>
      {children}
    </span>
  );
});

export default StatusPill;
