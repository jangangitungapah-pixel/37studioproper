import { useId } from 'react';

function collapseNativeInputSelection(event) {
  const input = event.currentTarget;

  window.requestAnimationFrame(() => {
    if (
      input
      && input.value
      && input.selectionStart === 0
      && input.selectionEnd === input.value.length
      && typeof input.setSelectionRange === 'function'
    ) {
      input.setSelectionRange(input.value.length, input.value.length);
    }
  });
}

export default function StudioTextField({
  autoComplete = 'off',
  className = '',
  disabled = false,
  error = '',
  helper,
  icon: Icon,
  id,
  inputMode,
  label,
  min,
  name,
  onChange,
  onFocus,
  placeholder,
  readOnly = false,
  required = false,
  step,
  type = 'text',
  value,
}) {
  const generatedId = useId();
  const inputId = id || `${generatedId}-input`;
  const helperId = `${inputId}-helper`;
  const errorId = `${inputId}-error`;
  const describedBy = [helper ? helperId : null, error ? errorId : null]
    .filter(Boolean)
    .join(' ') || undefined;

  function handleFocus(event) {
    collapseNativeInputSelection(event);
    onFocus?.(event);
  }

  return (
    <label
      className={[
        'studio-field',
        disabled ? 'is-disabled' : '',
        error ? 'has-error' : '',
        className,
      ].filter(Boolean).join(' ')}
      htmlFor={inputId}
    >
      <span className="studio-field-head">
        <span className="studio-field-label">
          {label}
          {required ? <span aria-hidden="true" className="studio-field-required">*</span> : null}
        </span>
        {helper ? <span className="studio-field-helper" id={helperId}>{helper}</span> : null}
      </span>

      <span className="studio-input-wrap">
        {Icon ? (
          <span className="studio-input-icon" aria-hidden="true">
            <Icon size={18} strokeWidth={2.2} />
          </span>
        ) : null}

        <input
          aria-describedby={describedBy}
          aria-errormessage={error ? errorId : undefined}
          aria-invalid={error ? true : undefined}
          aria-required={required || undefined}
          autoComplete={autoComplete}
          className="studio-native-input"
          data-1p-ignore="true"
          data-form-type="other"
          data-lpignore="true"
          disabled={disabled}
          id={inputId}
          inputMode={inputMode}
          min={min}
          name={name || inputId}
          onChange={onChange}
          onFocus={handleFocus}
          placeholder={placeholder}
          readOnly={readOnly}
          required={required}
          spellCheck={false}
          step={step}
          type={type}
          value={value}
        />
      </span>

      {error ? (
        <span aria-live="polite" className="studio-field-error" id={errorId} role="alert">
          {error}
        </span>
      ) : null}
    </label>
  );
}
