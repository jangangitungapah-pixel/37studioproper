export const ADMIN_LIST_PAGE_SIZE = 10;

export function clampPage(page, totalPages) {
  const numericPage = Number(page) || 1;
  return Math.min(Math.max(1, numericPage), Math.max(1, totalPages));
}

export function getPaginationSlice(items, page, pageSize = ADMIN_LIST_PAGE_SIZE) {
  const source = Array.isArray(items) ? items : [];
  const totalPages = Math.max(1, Math.ceil(source.length / pageSize));
  const safePage = clampPage(page, totalPages);
  const startIndex = (safePage - 1) * pageSize;

  return source.slice(startIndex, startIndex + pageSize);
}
