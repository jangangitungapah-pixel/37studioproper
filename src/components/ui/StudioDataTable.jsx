import { tableFeatures, useTable } from '@tanstack/react-table';
import { cn } from '../../lib/utils.js';

const coreFeatures = tableFeatures({});

/**
 * Headless TanStack Table v9 adapter with Studio-owned semantic markup.
 * Consumers own their columns and row identity; this component owns states and
 * accessible table structure.
 */
export default function StudioDataTable({
  ariaLabel = 'Data table',
  className = '',
  columns = [],
  data = [],
  emptyMessage = 'Belum ada data.',
  getRowId,
  loading = false,
}) {
  const table = useTable({
    features: coreFeatures,
    columns,
    data,
    getRowId,
  });

  if (loading) {
    return (
      <div aria-live="polite" className="studio-table-state" role="status">
        Memuat data…
      </div>
    );
  }

  if (!data.length) {
    return (
      <div className="studio-table-state" role="status">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className={cn('studio-data-table-wrap', className)}>
      <table aria-label={ariaLabel} className="studio-data-table">
        <thead>
          {table.getHeaderGroups().map((group) => (
            <tr key={group.id}>
              {group.headers.map((header) => (
                <th key={header.id} scope="col">
                  {header.isPlaceholder ? null : <table.FlexRender header={header} />}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr key={row.id}>
              {row.getAllCells().map((cell) => (
                <td key={cell.id}>
                  <table.FlexRender cell={cell} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
