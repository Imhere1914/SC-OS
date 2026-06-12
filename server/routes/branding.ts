import type { Hono } from 'hono'
import { mkdirSync, writeFileSync } from 'fs'
import { join, extname } from 'path'
import { getBrandingProfile, upsertBrandingProfile } from '../stores/branding-store'
import { getBrandId } from '../lib/brand'

const DATA_DIR = process.env.AIOS_DATA_DIR ?? join(process.env.HOME ?? '/tmp', '.ai-os')

export function registerBranding(app: Hono): void {
  // GET /api/branding — return current brand's profile
  app.get('/api/branding', (c) => {
    const brand = getBrandId(c)
    return c.json(getBrandingProfile(brand))
  })

  // PUT /api/branding — full upsert
  app.put('/api/branding', async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>
    const brand = typeof body.brand === 'string' ? body.brand : getBrandId(c)
    const profile = upsertBrandingProfile(brand, body)
    return c.json(profile)
  })

  // PATCH /api/branding — partial update
  app.patch('/api/branding', async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>
    const brand = typeof body.brand === 'string' ? body.brand : getBrandId(c)
    const profile = upsertBrandingProfile(brand, body)
    return c.json(profile)
  })

  // POST /api/branding/upload-logo — multipart logo upload
  app.post('/api/branding/upload-logo', async (c) => {
    const brand = getBrandId(c)
    let formData: FormData
    try {
      formData = await c.req.formData()
    } catch {
      return c.json({ error: 'Expected multipart/form-data' }, 400)
    }
    const file = formData.get('logo')
    if (!file || typeof file === 'string') {
      return c.json({ error: 'No file uploaded' }, 400)
    }

    const f = file as File
    const ext = extname(f.name).toLowerCase() || '.png'
    const allowedExts = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp']
    if (!allowedExts.includes(ext)) {
      return c.json({ error: `File type ${ext} not allowed` }, 400)
    }

    const brandingDir = join(DATA_DIR, 'branding', brand)
    mkdirSync(brandingDir, { recursive: true })

    const filename = `logo${ext}`
    const filepath = join(brandingDir, filename)
    const buffer = Buffer.from(await f.arrayBuffer())
    writeFileSync(filepath, buffer)

    // Store a relative URL that can be served — we'll serve from /branding-assets/
    const logo_url = `/branding-assets/${brand}/${filename}`
    upsertBrandingProfile(brand, { logo_url })

    return c.json({ logo_url })
  })
}
