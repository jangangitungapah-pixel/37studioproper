import { forwardRef } from 'react';
import '../../styles/modules/shared.css';

const Badge = forwardRef(function Badge(
  { children, className = '', variant = 'quiet', shape = 'pill', ...props },
  ref
) {
  const baseClass = 'studio-badge';
  const variantClass = `is-${variant}`; // 'danger' | 'warning' | 'info' | 'success' | 'quiet'
  const shapeClass = `is-shape-${shape}`; // 'pill' | 'circle'
  
  const combinedClassName = [baseClass, variantClass, shapeClass, className]
    .filter(Boolean)
    .join(' ');

  return (
    <span ref={ref} className={combinedClassName} {...props}>
      {children}
    </span>
  );
});

export default Badge;
