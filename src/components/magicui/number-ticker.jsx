import { useEffect, useRef } from 'react';
import { animate, useReducedMotion } from 'motion/react';
import { cn } from '../../lib/utils.js';

function formatTickerValue(value, formatter, decimalPlaces) {
  if (!Number.isFinite(value)) return '0';
  if (formatter) return formatter(value);

  return new Intl.NumberFormat('id-ID', {
    maximumFractionDigits: decimalPlaces,
    minimumFractionDigits: decimalPlaces,
  }).format(value);
}

/**
 * Lightweight Magic UI Number Ticker pattern, implemented as source-owned
 * project code and animated with the existing Motion engine.
 */
export function NumberTicker({
  className = '',
  decimalPlaces = 0,
  delay = 0,
  direction = 'up',
  duration = 0.8,
  formatter,
  startValue,
  value = 0,
}) {
  const reduceMotion = useReducedMotion();
  const valueNodeRef = useRef(null);
  const numericValue = Number(value);
  const numericStart = Number(
    startValue ?? (direction === 'down' ? numericValue * 1.25 : 0),
  );
  const initialValue = reduceMotion ? numericValue : numericStart;
  const accessibleValue = formatTickerValue(numericValue, formatter, decimalPlaces);

  useEffect(() => {
    const node = valueNodeRef.current;
    if (!node) return undefined;

    const updateText = (nextValue) => {
      node.textContent = formatTickerValue(nextValue, formatter, decimalPlaces);
    };

    if (!Number.isFinite(numericValue) || !Number.isFinite(numericStart)) {
      updateText(0);
      return undefined;
    }

    if (reduceMotion) {
      updateText(numericValue);
      return undefined;
    }

    updateText(numericStart);
    const controls = animate(numericStart, numericValue, {
      duration: Math.max(0.15, duration),
      delay: Math.max(0, delay),
      ease: [0.16, 1, 0.3, 1],
      onUpdate: updateText,
    });

    return () => controls.stop();
  }, [decimalPlaces, delay, duration, formatter, numericStart, numericValue, reduceMotion]);

  return (
    <span
      aria-label={accessibleValue}
      className={cn('magicui-number-ticker', className)}
      ref={valueNodeRef}
    >
      {formatTickerValue(initialValue, formatter, decimalPlaces)}
    </span>
  );
}
