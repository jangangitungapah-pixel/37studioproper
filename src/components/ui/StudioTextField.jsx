function collapseNativeInputSelection(event) {
  const input = event.currentTarget;

  window.requestAnimationFrame(() => {
    if (
      input &&
      input.value &&
      input.selectionStart === 0 &&
      input.selectionEnd === input.value.length &&
      typeof input.setSelectionRange === 'function'
    ) {
      input.setSelectionRange(input.value.length, input.value.length);
    }
  });
}

export default function StudioTextField({
  autoComplete = 'off',
  disabled = false,
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
  required = false,
  step,
  type = 'text',
  value,
}) {
  function handleFocus(event) {
    collapseNativeInputSelection(event);
    onFocus?.(event);
  }

  return (
    <label className={disabled ? 'studio-field is-disabled' : 'studio-field'} htmlFor={id}>
      <span className="studio-field-head">
        <span>{label}</span>
        {helper ? <span className="studio-field-helper">{helper}</span> : null}
      </span>

      <span className="studio-input-wrap">
        {Icon ? (
          <span className="studio-input-icon" aria-hidden="true">
            <Icon size={18} strokeWidth={2.2} />
          </span>
        ) : null}

        <input
          autoComplete={autoComplete}
          className="studio-native-input"
          data-1p-ignore="true"
          data-form-type="other"
          data-lpignore="true"
          disabled={disabled}
          id={id}
          inputMode={inputMode}
          min={min}
          name={name || id}
          onChange={onChange}
          onFocus={handleFocus}
          placeholder={placeholder}
          required={required}
          spellCheck={false}
          step={step}
          type={type}
          value={value}
        />
      </span>
    </label>
  );
}
