const API = '/api/review-requests'

export type ReviewRequestStatus = 'sent' | 'clicked' | 'reviewed'

export interface ReviewRequest {
  id: string
  brand?: string
  contact_id?: string
  contact_name: string
  contact_email: string
  message?: string
  review_url?: string
  status: ReviewRequestStatus
  sent_at: string
  clicked_at?: string
  reviewed_at?: string
}

export interface CreateReviewRequestInput {
  brand?: string
  contact_id?: string
  contact_name: string
  contact_email: string
  message?: string
  review_url?: string
}

export async function listReviewRequests(brand?: string): Promise<ReviewRequest[]> {
  const url = brand ? `${API}?brand=${brand}` : API
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to load review requests (${res.status})`)
  const d = (await res.json()) as { review_requests?: ReviewRequest[] }
  return d.review_requests ?? []
}

export async function createReviewRequest(input: CreateReviewRequestInput): Promise<ReviewRequest> {
  const res = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) {
    const e = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(e.error || `Failed to send review request (${res.status})`)
  }
  const d = (await res.json()) as { review_request?: ReviewRequest } & ReviewRequest
  return d.review_request ?? (d as ReviewRequest)
}

export async function deleteReviewRequest(id: string): Promise<void> {
  const res = await fetch(`${API}/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(`Failed to delete review request (${res.status})`)
}
