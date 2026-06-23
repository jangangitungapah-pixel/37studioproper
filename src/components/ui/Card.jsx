import { forwardRef } from 'react';
import '../../styles/modules/shared.css';

const Card = forwardRef(function Card(
  { children, className = '', variant = 'elevated', padding = 'md', ...props },
  ref
) {
  const baseClass = 'studio-card';
  const variantClass = `is-${variant}`;
  const paddingClass = `has-padding-${padding}`; // 'none' | 'sm' | 'md' | 'lg'
  
  const combinedClassName = [baseClass, variantClass, paddingClass, className]
    .filter(Boolean)
    .join(' ');

  return (
    <div ref={ref} className={combinedClassName} {...props}>
      {children}
    </div>
  );
});

export default Card;
