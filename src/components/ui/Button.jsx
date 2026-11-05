import { forwardRef } from 'react';
import { cva } from 'class-variance-authority';
import { LoaderCircle } from 'lucide-react';
import { cn } from '../../lib/utils.js';
import '../../styles/modules/shared.css';

const studioButtonVariants = cva(
  'studio-button',
  {
    variants: {
      variant: {
        primary: 'is-primary',
        secondary: 'is-secondary',
        ghost: 'is-ghost',
        danger: 'is-danger',
        warning: 'is-warning',
      },
      size: {
        sm: 'is-size-sm',
        md: 'is-size-md',
        lg: 'is-size-lg',
        icon: 'is-size-icon',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  },
);

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
  const combinedClassName = cn(
    studioButtonVariants({ variant, size }),
    isLoading && 'is-loading',
    className,
  );

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
