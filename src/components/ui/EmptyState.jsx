import { forwardRef } from 'react';
import '../../styles/modules/shared.css';

const EmptyState = forwardRef(function EmptyState(
  { icon: Icon, title, description, action, children, className = '', ...props },
  ref
) {
  const body = description || children;

  return (
    <div ref={ref} className={`studio-empty-state ${className}`} {...props}>
      {Icon ? (
        <span className="studio-state-icon is-neutral" aria-hidden="true">
          <Icon size={22} />
        </span>
      ) : null}
      {title && <h3 className="studio-empty-title">{title}</h3>}
      {body ? <div className="studio-empty-desc">{body}</div> : null}
      {action && <div className="studio-empty-action">{action}</div>}
    </div>
  );
});

export default EmptyState;
