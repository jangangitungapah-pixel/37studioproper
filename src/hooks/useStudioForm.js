import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';

/**
 * Standard schema-backed form hook for new and migrated UI flows.
 * Domain mutations remain in their canonical repositories/Workers.
 */
export function useStudioForm({
  schema,
  mode = 'onBlur',
  ...options
}) {
  if (!schema || typeof schema.safeParse !== 'function') {
    throw new TypeError('useStudioForm requires a Zod schema.');
  }

  return useForm({
    mode,
    ...options,
    resolver: zodResolver(schema),
  });
}
