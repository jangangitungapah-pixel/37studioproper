import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';

function getSingleLabel(options, selectedKey, placeholder) {
  return options.find((option) => option.key === selectedKey)?.label || placeholder;
}

function getMultiLabel(options, selectedKeys, placeholder) {
  if (!selectedKeys.length) return placeholder;

  if (selectedKeys.length === options.length) return 'Semua status';

  return options
    .filter((option) => selectedKeys.includes(option.key))
    .map((option) => option.label)
    .join(', ');
}

export default function StudioSelect({
  helper,
  label,
  multiple = false,
  onChange,
  options,
  placeholder = 'Pilih opsi',
  selectedKey,
  selectedKeys = [],
}) {
  const selectId = useId();
  const rootRef = useRef(null);
  const listboxId = `${selectId}-listbox`;
  const [isOpen, setIsOpen] = useState(false);

  const selectedSummary = useMemo(() => {
    if (multiple) return getMultiLabel(options, selectedKeys, placeholder);

    return getSingleLabel(options, selectedKey, placeholder);
  }, [multiple, options, placeholder, selectedKey, selectedKeys]);

  useEffect(() => {
    function handlePointerDown(event) {
      if (!rootRef.current?.contains(event.target)) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  function handleToggleOption(optionKey) {
    if (!multiple) {
      onChange(optionKey);
      setIsOpen(false);
      return;
    }

    if (selectedKeys.includes(optionKey)) {
      onChange(selectedKeys.filter((key) => key !== optionKey));
      return;
    }

    onChange([...selectedKeys, optionKey]);
  }

  function isSelected(optionKey) {
    return multiple ? selectedKeys.includes(optionKey) : selectedKey === optionKey;
  }

  return (
    <div className="studio-select" ref={rootRef}>
      <button
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-label={label}
        className="studio-select-trigger"
        type="button"
        onClick={() => setIsOpen((current) => !current)}
      >
        <span className="studio-select-copy">
          <span className="studio-select-label">{label}</span>
          <strong>{selectedSummary}</strong>
        </span>

        {helper ? <span className="studio-select-helper">{helper}</span> : null}

        <ChevronDown
          className={isOpen ? 'studio-select-chevron is-open' : 'studio-select-chevron'}
          size={17}
          aria-hidden="true"
        />
      </button>

      {isOpen ? (
        <div
          aria-label={label}
          className="studio-select-list"
          data-option-count={options.length}
          id={listboxId}
          role="listbox"
          aria-multiselectable={multiple || undefined}
        >
          {options.map((option) => {
            const selected = isSelected(option.key);

            return (
              <button
                aria-selected={selected}
                className={selected ? 'studio-select-option is-selected' : 'studio-select-option'}
                key={option.key}
                role="option"
                type="button"
                onClick={() => handleToggleOption(option.key)}
              >
                <span className={option.tone ? `studio-select-dot is-${option.tone}` : 'studio-select-dot'} />
                <span className="studio-select-option-text">
                  <strong>{option.label}</strong>
                  {option.description ? <span>{option.description}</span> : null}
                </span>
                {selected ? <Check size={16} aria-hidden="true" /> : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
