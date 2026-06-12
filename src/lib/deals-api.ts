const API = '/api/deals'

export type DealStage = 'lead' | 'qualified' | 'proposal' | 'negotiation' | 'won' | 'lost'

export interface Deal {
  id: string
  brand?: string
  title: string
  contact_id?: string
  contact_name?: string
  value: number       // cents
  stage: DealStage
  probability?: number
  close_date?: string
  notes?: string
  tags?: string[]
  created_at: string
  updated_at: string
  closed_at?: string
}

export async function listDeals(brand?: string): Promise<Deal[]> {
  const url = brand ? `${API}?brand=${brand}` : API
  const res = await fetch(url)
  const d = await res.json() as { deals?: Deal[] }
  return d.deals ?? []
}

export async function createDeal(data: Partial<Deal>): Promise<Deal> {
  const res = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  return res.json() as Promise<Deal>
}

export async function updateDeal(id: string, data: Partial<Deal>): Promise<Deal> {
  const res = await fetch(`${API}/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  return res.json() as Promise<Deal>
}

export async function deleteDeal(id: string): Promise<void> {
  await fetch(`${API}/${id}`, { method: 'DELETE' })
}
