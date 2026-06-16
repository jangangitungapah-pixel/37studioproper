
export function ThemeContainer({ children, className = '' }) {
  return <div className={['theme-container', className].filter(Boolean).join(' ')}>{children}</div>;
}
