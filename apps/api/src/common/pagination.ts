export const DEFAULT_PAGE_SIZE = 25;
export const MAX_PAGE_SIZE = 100;

export type PaginationParams = { page: number; pageSize: number; skip: number; take: number };

export function parsePagination(page?: string, pageSize?: string): PaginationParams {
  const parsedPage = Number(page);
  const parsedPageSize = Number(pageSize);
  const safePage = Number.isFinite(parsedPage) && parsedPage > 0 ? Math.floor(parsedPage) : 1;
  const safePageSize =
    Number.isFinite(parsedPageSize) && parsedPageSize > 0
      ? Math.min(Math.floor(parsedPageSize), MAX_PAGE_SIZE)
      : DEFAULT_PAGE_SIZE;

  return { page: safePage, pageSize: safePageSize, skip: (safePage - 1) * safePageSize, take: safePageSize };
}

export type PaginatedResult<T> = { items: T[]; total: number; page: number; pageSize: number };
