import { forwardRef } from 'react';
import '../../styles/modules/shared.css';

const Card = forwardRef(function Card(
  { as: Element = 'div', children, className = '', variant = 'elevated', padding = 'md', ...props },
  ref
) {
  const combinedClassName = ['studio-card', `is-${variant}`, `has-padding-${padding}`, className]
    .filter(Boolean)
    .join(' ');

  return (
    <Element ref={ref} className={combinedClassName} {...props}>
      {children}
    </Element>
  );
});

export default Card;
