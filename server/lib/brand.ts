import type { Context } from 'hono'

export function getBrandId(c: Context): string {
  return (
    c.req.query('brand') ??
    c.req.header('x-brand') ??
    process.env.BRAND ??
    'default'
  )
}
