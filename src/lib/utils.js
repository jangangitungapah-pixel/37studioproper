import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merge conditional class names and resolve Tailwind utility conflicts.
 * Use this only for utility-class composition; semantic feature CSS remains
 * in its existing route/module owner.
 */
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}
