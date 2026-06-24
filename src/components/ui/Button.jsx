import { forwardRef } from 'react';
import { LoaderCircle } from 'lucide-react';
import '../../styles/modules/shared.css';

const Button = forwardRef(function Button(
  {
    children,
    className = '',
    variant = 'primary',
    size = 'md',
    isLoading = false,
    disabled = false,
    type = 'button',
    ...props
  },
  ref
) {
  const combinedClassName = [
    'studio-button',
    `is-${variant}`,
    `is-size-${size}`,
    isLoading ? 'is-loading' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      ref={ref}
      type={type}
      className={combinedClassName}
      disabled={disabled || isLoading}
      aria-busy={isLoading || undefined}
      {...props}
    >
      {isLoading ? <LoaderCircle aria-hidden="true" className="studio-button-spinner" size={16} /> : null}
      <span className="studio-button-content">{children}</span>
    </button>
  );
});

export default Button;
