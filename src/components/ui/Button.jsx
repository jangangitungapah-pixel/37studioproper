import { forwardRef } from 'react';
import { LoaderCircle } from 'lucide-react';
import '../../styles/modules/shared.css';

const Button = forwardRef(function Button(
  {
    children,
    className = '',
    variant = 'primary', // 'primary' | 'secondary' | 'ghost' | 'danger'
    size = 'md', // 'sm' | 'md' | 'lg' | 'icon'
    isLoading = false,
    disabled = false,
    type = 'button',
    ...props
  },
  ref
) {
  const baseClass = 'studio-button';
  const variantClass = `is-${variant}`;
  const sizeClass = `is-size-${size}`;
  const stateClass = isLoading ? 'is-loading' : '';
  
  const combinedClassName = [baseClass, variantClass, sizeClass, stateClass, className]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      ref={ref}
      type={type}
      className={combinedClassName}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading && <LoaderCircle size={16} className="studio-button-spinner auth-spin" />}
      <span className="studio-button-content">{children}</span>
    </button>
  );
});

export default Button;
