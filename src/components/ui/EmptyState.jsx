import { forwardRef } from 'react';
import '../../styles/modules/shared.css';

const EmptyState = forwardRef(function EmptyState(
  { icon: Icon, title, description, action, className = '', ...props },
  ref
) {
  return (
    <div ref={ref} className={`studio-empty-state ${className}`} {...props}>
      <div className="studio-empty-orb">
        {Icon && <Icon size={32} className="studio-empty-icon" />}
      </div>
      {title && <h3 className="studio-empty-title">{title}</h3>}
      {description && <p className="studio-empty-desc">{description}</p>}
      {action && <div className="studio-empty-action">{action}</div>}
    </div>
  );
});

export default EmptyState;
