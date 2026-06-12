export interface PaginatedResult<T> {
  data: T[]
  total: number
  limit: number
  offset: number
  has_more: boolean
}

export function paginate<T>(items: T[], limit = 50, offset = 0): PaginatedResult<T> {
  const data = items.slice(offset, offset + limit)
  return { data, total: items.length, limit, offset, has_more: offset + data.length < items.length }
}

export function paginationParams(query: Record<string, string | undefined>): { limit: number; offset: number } {
  const limit = Math.min(parseInt(query['limit'] ?? '50', 10) || 50, 200)
  const offset = parseInt(query['offset'] ?? '0', 10) || 0
  return { limit, offset }
}
