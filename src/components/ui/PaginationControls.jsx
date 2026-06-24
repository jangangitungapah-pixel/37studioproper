import { ADMIN_LIST_PAGE_SIZE, clampPage } from '../../utils/pagination.js';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function PaginationControls({
  label = 'data',
  page,
  pageSize = ADMIN_LIST_PAGE_SIZE,
  totalItems,
  onPageChange,
}) {
  const safeTotal = Math.max(0, Number(totalItems) || 0);
  const totalPages = Math.max(1, Math.ceil(safeTotal / pageSize));
  const safePage = clampPage(page, totalPages);

  if (safeTotal <= pageSize) return null;

  const startItem = (safePage - 1) * pageSize + 1;
  const endItem = Math.min(safeTotal, safePage * pageSize);

  function goToPage(nextPage) {
    onPageChange(clampPage(nextPage, totalPages));
  }

  return (
    <nav className="admin-pagination" aria-label={'Pagination ' + label}>
      <span className="admin-pagination-copy">
        <strong>{startItem}-{endItem}</strong>
        <small>dari {safeTotal} {label}</small>
      </span>

      <div className="admin-pagination-actions">
        <button
          type="button"
          disabled={safePage <= 1}
          onClick={() => goToPage(safePage - 1)}
        >
          <ChevronLeft aria-hidden="true" size={15} />
          Sebelumnya
        </button>

        <span aria-current="page">
          {safePage} / {totalPages}
        </span>

        <button
          type="button"
          disabled={safePage >= totalPages}
          onClick={() => goToPage(safePage + 1)}
        >
          Berikutnya
          <ChevronRight aria-hidden="true" size={15} />
        </button>
      </div>
    </nav>
  );
}
