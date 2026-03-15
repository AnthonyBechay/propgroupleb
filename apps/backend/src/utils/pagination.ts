import type { PaginationResponse } from '../types/index.js';

export function parsePagination(query: { page?: string; limit?: string }): {
  page: number;
  limit: number;
  skip: number;
} {
  const page = Math.max(1, parseInt(query.page || '1', 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit || '10', 10) || 10));
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}

export function buildPaginationResponse(
  page: number,
  limit: number,
  total: number
): PaginationResponse {
  return {
    page,
    limit,
    total,
    pages: Math.ceil(total / limit),
  };
}
