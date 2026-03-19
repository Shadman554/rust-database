export interface PaginationParams {
  page: number;
  limit: number;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

export function parsePagination(query: Record<string, unknown>): PaginationParams {
  const page = Math.max(1, parseInt(String(query.page ?? "1"), 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(String(query.limit ?? "20"), 10) || 20));
  return { page, limit };
}

export function buildPagination(page: number, limit: number, total: number): PaginationMeta {
  return {
    page,
    limit,
    total,
    pages: Math.ceil(total / limit),
  };
}

export function getOffset(page: number, limit: number): number {
  return (page - 1) * limit;
}

/**
 * Safely extracts a string query param.
 * Express parses `?q=a&q=b` as string[], not string. This helper returns the
 * value only when it is actually a string, preventing type-confusion bugs where
 * an array would silently pass a char-length guard or be stringified by the DB.
 */
export function toStr(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}
