import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown } from 'lucide-react';

const TYPEAHEAD_RESET_MS = 650;

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

function normalizeTypeaheadValue(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLocaleLowerCase('id-ID');
}

function getEnabledIndices(options) {
  return options.reduce((indices, option, index) => {
    if (!option.disabled) indices.push(index);
    return indices;
  }, []);
}

function getFloatingListStyle(rect) {
  const viewportWidth = Math.max(document.documentElement.clientWidth || 0, window.innerWidth || 0);
  const viewportHeight = Math.max(document.documentElement.clientHeight || 0, window.innerHeight || 0);
  const gutter = 12;
  const bottomReserve = window.matchMedia('(max-width: 899px)').matches ? 118 : gutter;
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
  const triggerRef = useRef(null);
  const listRef = useRef(null);
  const optionRefs = useRef(new Map());
  const typeaheadRef = useRef('');
  const typeaheadTimerRef = useRef(null);
  const listboxId = selectId + '-listbox';
  const labelId = selectId + '-label';
  const helperId = selectId + '-helper';
  const [isOpen, setIsOpen] = useState(false);
  const [listStyle, setListStyle] = useState(null);
  const [activeIndex, setActiveIndex] = useState(-1);

  const enabledIndices = useMemo(() => getEnabledIndices(options), [options]);

  const selectedSummary = useMemo(() => {
    if (multiple) return getMultiLabel(options, selectedKeys, placeholder);

    return getSingleLabel(options, selectedKey, placeholder);
  }, [multiple, options, placeholder, selectedKey, selectedKeys]);

  const preferredActiveIndex = useMemo(() => {
    const selectedIndex = options.findIndex((option) => (
      !option.disabled && (multiple ? selectedKeys.includes(option.key) : option.key === selectedKey)
    ));

    return selectedIndex >= 0 ? selectedIndex : (enabledIndices[0] ?? -1);
  }, [enabledIndices, multiple, options, selectedKey, selectedKeys]);

  const updateListPosition = useCallback(() => {
    if (inlineList) {
      setListStyle(null);
      return;
    }

    const rect = rootRef.current?.getBoundingClientRect();

    if (!rect) return;

    setListStyle(getFloatingListStyle(rect));
  }, [inlineList]);

  const closeList = useCallback(({ restoreFocus = false } = {}) => {
    setIsOpen(false);
    setListStyle(null);
    typeaheadRef.current = '';

    if (restoreFocus) triggerRef.current?.focus();
  }, []);

  const openList = useCallback((index = preferredActiveIndex) => {
    if (disabled) return;

    if (!inlineList) updateListPosition();
    setActiveIndex(index);
    setIsOpen(true);
  }, [disabled, inlineList, preferredActiveIndex, updateListPosition]);

  useEffect(() => {
    function handlePointerDown(event) {
      const target = event.target;

      if (rootRef.current?.contains(target) || listRef.current?.contains(target)) return;

      closeList();
    }

    document.addEventListener('pointerdown', handlePointerDown);

    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [closeList]);

  useEffect(() => () => {
    if (typeaheadTimerRef.current) window.clearTimeout(typeaheadTimerRef.current);
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

  useEffect(() => {
    if (!isOpen || activeIndex < 0) return;

    optionRefs.current.get(activeIndex)?.scrollIntoView?.({ block: 'nearest' });
  }, [activeIndex, isOpen]);

  function handleToggleOption(optionKey) {
    if (disabled) return;

    const option = options.find((item) => item.key === optionKey);
    if (!option || option.disabled) return;

    if (!multiple) {
      onChange(optionKey);
      closeList({ restoreFocus: true });
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

  function moveActive(direction) {
    if (!enabledIndices.length) return;

    const currentPosition = enabledIndices.indexOf(activeIndex);
    const nextPosition = currentPosition < 0
      ? (direction > 0 ? 0 : enabledIndices.length - 1)
      : (currentPosition + direction + enabledIndices.length) % enabledIndices.length;

    setActiveIndex(enabledIndices[nextPosition]);
  }

  function handleTypeahead(character) {
    const nextBuffer = typeaheadRef.current + normalizeTypeaheadValue(character);
    const repeatedCharacter = nextBuffer.length > 1
      && nextBuffer.split('').every((value) => value === nextBuffer[0]);
    const query = repeatedCharacter ? nextBuffer[0] : nextBuffer;

    typeaheadRef.current = query;
    if (typeaheadTimerRef.current) window.clearTimeout(typeaheadTimerRef.current);
    typeaheadTimerRef.current = window.setTimeout(() => {
      typeaheadRef.current = '';
    }, TYPEAHEAD_RESET_MS);

    if (!enabledIndices.length) return;

    const currentPosition = enabledIndices.indexOf(activeIndex);
    const orderedIndices = [
      ...enabledIndices.slice(currentPosition + 1),
      ...enabledIndices.slice(0, currentPosition + 1),
    ];
    const matchingIndex = orderedIndices.find((index) => (
      normalizeTypeaheadValue(options[index]?.label).startsWith(query)
    ));

    if (matchingIndex === undefined) return;

    if (!isOpen) openList(matchingIndex);
    else setActiveIndex(matchingIndex);
  }

  function handleTriggerKeyDown(event) {
    if (disabled) return;

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        if (!isOpen) openList();
        else moveActive(1);
        return;
      case 'ArrowUp':
        event.preventDefault();
        if (!isOpen) openList(enabledIndices.at(-1) ?? -1);
        else moveActive(-1);
        return;
      case 'Home':
        event.preventDefault();
        if (!isOpen) openList(enabledIndices[0] ?? -1);
        else setActiveIndex(enabledIndices[0] ?? -1);
        return;
      case 'End':
        event.preventDefault();
        if (!isOpen) openList(enabledIndices.at(-1) ?? -1);
        else setActiveIndex(enabledIndices.at(-1) ?? -1);
        return;
      case 'Enter':
      case ' ':
        event.preventDefault();
        if (!isOpen) openList();
        else if (activeIndex >= 0) handleToggleOption(options[activeIndex]?.key);
        return;
      case 'Escape':
        if (!isOpen) return;
        event.preventDefault();
        event.stopPropagation();
        closeList({ restoreFocus: true });
        return;
      case 'Tab':
        closeList();
        return;
      default:
        if (event.key.length === 1 && !event.altKey && !event.ctrlKey && !event.metaKey) {
          event.preventDefault();
          handleTypeahead(event.key);
        }
    }
  }

  function toggleOpen() {
    if (disabled) return;
    if (isOpen) closeList();
    else openList();
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
      aria-labelledby={labelId}
      aria-multiselectable={multiple || undefined}
      className="studio-select-list"
      data-inline={inlineList ? 'true' : 'false'}
      data-option-count={options.length}
      data-portal={inlineList ? 'false' : 'true'}
      data-ready={inlineList || listStyle ? 'true' : 'false'}
      id={listboxId}
      ref={listRef}
      role="listbox"
      style={inlineList ? undefined : (listStyle || fallbackListStyle)}
      onPointerDown={(event) => event.stopPropagation()}
    >
      {options.map((option, index) => {
        const selected = isSelected(option.key);
        const active = activeIndex === index;

        return (
          <div
            aria-disabled={option.disabled || undefined}
            aria-selected={selected}
            className={[
              'studio-select-option',
              selected ? 'is-selected' : '',
              active ? 'is-active' : '',
              option.disabled ? 'is-disabled' : '',
            ].filter(Boolean).join(' ')}
            id={`${selectId}-option-${index}`}
            key={option.key}
            ref={(element) => {
              if (element) optionRefs.current.set(index, element);
              else optionRefs.current.delete(index);
            }}
            role="option"
            onClick={() => handleToggleOption(option.key)}
            onPointerDown={(event) => event.preventDefault()}
            onPointerMove={() => {
              if (!option.disabled) setActiveIndex(index);
            }}
          >
            <span className={option.tone ? 'studio-select-dot is-' + option.tone : 'studio-select-dot'} />
            <span className="studio-select-option-text">
              <strong>{option.label}</strong>
              {option.description ? <span>{option.description}</span> : null}
            </span>
            {selected ? <Check size={16} aria-hidden="true" /> : null}
          </div>
        );
      })}
      {!options.length ? <div className="studio-select-empty">Belum ada opsi.</div> : null}
    </div>
  ) : null;

  return (
    <div className={rootClassName} ref={rootRef}>
      <button
        aria-activedescendant={isOpen && activeIndex >= 0 ? `${selectId}-option-${activeIndex}` : undefined}
        aria-autocomplete="none"
        aria-controls={listboxId}
        aria-describedby={helper ? helperId : undefined}
        aria-disabled={disabled}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-labelledby={labelId}
        className={disabled ? 'studio-select-trigger is-disabled' : 'studio-select-trigger'}
        disabled={disabled}
        ref={triggerRef}
        role="combobox"
        type="button"
        onClick={toggleOpen}
        onKeyDown={handleTriggerKeyDown}
      >
        <span className="studio-select-copy">
          <span className="studio-select-label" id={labelId}>{label}</span>
          <strong>{selectedSummary}</strong>
        </span>

        {helper ? <span className="studio-select-helper" id={helperId}>{helper}</span> : null}

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
