const API = '/api/segments'

export type FilterOperator = 'equals' | 'not_equals' | 'contains' | 'not_contains' | 'is_set' | 'is_not_set' | 'gt' | 'lt'

export interface SegmentFilter {
  field: string
  operator: FilterOperator
  value?: string
}

export interface Segment {
  id: string
  brand?: string
  name: string
  description?: string
  filters: SegmentFilter[]
  created_at: string
  updated_at: string
}

export async function listSegments(brand?: string): Promise<Segment[]> {
  const url = brand ? `${API}?brand=${brand}` : API
  const res = await fetch(url)
  const d = await res.json() as { segments?: Segment[] }
  return d.segments ?? []
}

export async function createSegment(data: Partial<Segment>): Promise<Segment> {
  const res = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  return res.json() as Promise<Segment>
}

export async function updateSegment(id: string, data: Partial<Segment>): Promise<Segment> {
  const res = await fetch(`${API}/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  return res.json() as Promise<Segment>
}

export async function deleteSegment(id: string): Promise<void> {
  await fetch(`${API}/${id}`, { method: 'DELETE' })
}

export async function previewSegment(
  filters: SegmentFilter[],
  brand?: string,
): Promise<{ count: number; contacts: unknown[] }> {
  const res = await fetch(`${API}/preview`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ filters, brand }),
  })
  return res.json() as Promise<{ count: number; contacts: unknown[] }>
}
