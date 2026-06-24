import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
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

function getFloatingListStyle(rect) {
  const viewportWidth = Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0);
  const viewportHeight = Math.max(document.documentElement.clientHeight || 0, window.innerHeight || 0);
  const gutter = 12;
  const bottomReserve = window.matchMedia('(max-width: 767px)').matches ? 118 : gutter;
  const maxViewportWidth = Math.max(180, viewportWidth - gutter * 2);
  const width = Math.min(Math.max(rect.width, 220), maxViewportWidth);
  const left = Math.min(Math.max(gutter, rect.left), viewportWidth - width - gutter);
  const spaceBelow = viewportHeight - rect.bottom - bottomReserve - 8;
  const spaceAbove = rect.top - gutter - 8;
  const shouldOpenUp = spaceBelow < 180 && spaceAbove > spaceBelow;
  const availableHeight = shouldOpenUp ? spaceAbove : spaceBelow;
  const maxHeight = Math.min(320, Math.max(144, availableHeight));
  const preferredTop = shouldOpenUp ? rect.top - maxHeight - 8 : rect.bottom + 8;
  const top = Math.max(gutter, Math.min(preferredTop, viewportHeight - bottomReserve - maxHeight));

  return {
    bottom: 'auto',
    left: Math.round(left) + 'px',
    maxHeight: Math.round(maxHeight) + 'px',
    right: 'auto',
    top: Math.round(top) + 'px',
    width: Math.round(width) + 'px',
  };
}

export default function StudioSelect({
  className = '',
  disabled = false,
  helper,
  inlineList = false,
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
  const listRef = useRef(null);
  const listboxId = selectId + '-listbox';
  const [isOpen, setIsOpen] = useState(false);
  const [listStyle, setListStyle] = useState(null);

  const selectedSummary = useMemo(() => {
    if (multiple) return getMultiLabel(options, selectedKeys, placeholder);

    return getSingleLabel(options, selectedKey, placeholder);
  }, [multiple, options, placeholder, selectedKey, selectedKeys]);

  const updateListPosition = useCallback(() => {
    if (inlineList) {
      setListStyle(null);
      return;
    }

    const rect = rootRef.current?.getBoundingClientRect();

    if (!rect) return;

    setListStyle(getFloatingListStyle(rect));
  }, [inlineList]);

  useEffect(() => {
    function handlePointerDown(event) {
      const target = event.target;

      if (rootRef.current?.contains(target) || listRef.current?.contains(target)) {
        return;
      }

      setIsOpen(false);
    }

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        setIsOpen(false);
        setListStyle(null);
      }
    }

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  useEffect(() => {
    if (!isOpen) return undefined;

    let frameId = window.requestAnimationFrame(updateListPosition);

    function handleReposition() {
      window.cancelAnimationFrame(frameId);
      frameId = window.requestAnimationFrame(updateListPosition);
    }

    window.addEventListener('resize', handleReposition);
    window.addEventListener('scroll', handleReposition, true);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener('resize', handleReposition);
      window.removeEventListener('scroll', handleReposition, true);
    };
  }, [isOpen, options.length, updateListPosition]);

  function handleToggleOption(optionKey) {
    if (disabled) return;

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

  function toggleOpen() {
    if (disabled) return;

    if (isOpen) {
      setListStyle(null);
      setIsOpen(false);
      return;
    }

    if (!inlineList) updateListPosition();
    setIsOpen(true);
  }

  const rootClassName = [
    'studio-select',
    isOpen ? 'is-open' : '',
    disabled ? 'is-disabled' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const fallbackListStyle = {
    bottom: 'auto',
    left: '-9999px',
    maxHeight: '240px',
    right: 'auto',
    top: '0px',
    width: '240px',
  };

  const listbox = isOpen && !disabled ? (
    <div
      aria-label={label}
      className="studio-select-list"
      data-inline={inlineList ? 'true' : 'false'}
      data-option-count={options.length}
      data-portal={inlineList ? 'false' : 'true'}
      data-ready={inlineList || listStyle ? 'true' : 'false'}
      id={listboxId}
      ref={listRef}
      role="listbox"
      style={inlineList ? undefined : (listStyle || fallbackListStyle)}
      aria-multiselectable={multiple || undefined}
      onPointerDown={(event) => event.stopPropagation()}
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
            <span className={option.tone ? 'studio-select-dot is-' + option.tone : 'studio-select-dot'} />
            <span className="studio-select-option-text">
              <strong>{option.label}</strong>
              {option.description ? <span>{option.description}</span> : null}
            </span>
            {selected ? <Check size={16} aria-hidden="true" /> : null}
          </button>
        );
      })}
      {!options.length ? (
        <div className="studio-select-empty">Belum ada opsi.</div>
      ) : null}
    </div>
  ) : null;

  return (
    <div className={rootClassName} ref={rootRef}>
      <button
        aria-controls={listboxId}
        aria-disabled={disabled}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-label={label}
        className={disabled ? 'studio-select-trigger is-disabled' : 'studio-select-trigger'}
        disabled={disabled}
        type="button"
        onClick={toggleOpen}
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

      {listbox && typeof document !== 'undefined' && !inlineList ? createPortal(listbox, document.body) : listbox}
    </div>
  );
}
