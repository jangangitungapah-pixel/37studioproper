import { useEffect, useState } from 'react';
import { animate, useReducedMotion } from 'motion/react';
import { cn } from '../../lib/utils.js';

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
  const numericValue = Number(value);
  const numericStart = Number(
    startValue ?? (direction === 'down' ? numericValue * 1.25 : 0),
  );
  const [displayValue, setDisplayValue] = useState(numericStart);

  useEffect(() => {
    if (!Number.isFinite(numericValue) || !Number.isFinite(numericStart)) {
      setDisplayValue(0);
      return undefined;
    }

    if (reduceMotion) {
      setDisplayValue(numericValue);
      return undefined;
    }

    setDisplayValue(numericStart);
    const controls = animate(numericStart, numericValue, {
      duration: Math.max(0.15, duration),
      delay: Math.max(0, delay),
      ease: [0.16, 1, 0.3, 1],
      onUpdate: setDisplayValue,
    });

    return () => controls.stop();
  }, [delay, duration, numericStart, numericValue, reduceMotion]);

  const formatted = formatter
    ? formatter(displayValue)
    : new Intl.NumberFormat('id-ID', {
        maximumFractionDigits: decimalPlaces,
        minimumFractionDigits: decimalPlaces,
      }).format(displayValue);

  const accessibleValue = formatter
    ? formatter(numericValue)
    : new Intl.NumberFormat('id-ID', {
        maximumFractionDigits: decimalPlaces,
        minimumFractionDigits: decimalPlaces,
      }).format(numericValue);

  return (
    <span
      aria-label={accessibleValue}
      className={cn('magicui-number-ticker', className)}
    >
      {formatted}
    </span>
  );
}
