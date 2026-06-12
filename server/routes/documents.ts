import type { Hono } from 'hono'
import { readFileSync, writeFileSync, rmSync } from 'fs'
import { join } from 'path'
import {
  listDocuments,
  getDocument,
  getDocumentByShareToken,
  createDocument,
  updateDocument,
  deleteDocument,
  listFolders,
  generateShareToken,
  getStorageDir,
} from '../stores/documents-store'

const BRAND = () => process.env.BRAND ?? 'default'
const DATA_DIR = process.env.AIOS_DATA_DIR ?? join(process.env.HOME ?? '/tmp', '.ai-os')

export function registerDocuments(app: Hono): void {
  // GET /api/documents — list documents
  app.get('/api/documents', (c) => {
    const brand = c.req.query('brand') ?? BRAND()
    const folder = c.req.query('folder')
    const contact_id = c.req.query('contact_id')
    const docs = listDocuments(brand, {
      folder: folder !== undefined ? folder : undefined,
      contact_id: contact_id ?? undefined,
    })
    return c.json({ documents: docs })
  })

  // GET /api/documents/folders — list unique folders
  app.get('/api/documents/folders', (c) => {
    const brand = c.req.query('brand') ?? BRAND()
    return c.json({ folders: listFolders(brand) })
  })

  // GET /api/documents/shared/:token — PUBLIC: metadata by share token
  app.get('/api/documents/shared/:token', (c) => {
    const token = c.req.param('token')
    const result = getDocumentByShareToken(token)
    if (!result) return c.json({ error: 'Not found' }, 404)
    return c.json({ document: result.doc })
  })

  // GET /api/documents/:id — metadata
  app.get('/api/documents/:id', (c) => {
    const brand = c.req.query('brand') ?? BRAND()
    const doc = getDocument(brand, c.req.param('id'))
    if (!doc) return c.json({ error: 'Not found' }, 404)
    return c.json({ document: doc })
  })

  // POST /api/documents/upload — multipart file upload
  app.post('/api/documents/upload', async (c) => {
    const brand = c.req.query('brand') ?? BRAND()
    let body: Record<string, unknown>
    try {
      body = await c.req.parseBody() as Record<string, unknown>
    } catch {
      return c.json({ error: 'Failed to parse body' }, 400)
    }

    const file = body['file']
    if (!file || !(file instanceof File)) {
      return c.json({ error: 'file is required' }, 400)
    }

    const id = (await import('nanoid')).nanoid()
    const filename = (typeof body['name'] === 'string' && body['name'].trim())
      ? body['name'].trim()
      : file.name

    const storageDir = getStorageDir(brand, id)
    const filePath = join(storageDir, filename)

    // Write file to disk
    const arrayBuffer = await file.arrayBuffer()
    writeFileSync(filePath, Buffer.from(arrayBuffer))

    const storagePath = join('documents', brand, id, filename)

    const tagsRaw = body['tags']
    const tags = typeof tagsRaw === 'string' && tagsRaw.trim()
      ? tagsRaw.split(',').map(t => t.trim()).filter(Boolean)
      : undefined

    const doc = createDocument(brand, {
      name: filename,
      description: typeof body['description'] === 'string' ? body['description'] : undefined,
      folder: typeof body['folder'] === 'string' && body['folder'].trim() ? body['folder'].trim() : undefined,
      mime_type: file.type || 'application/octet-stream',
      size_bytes: file.size,
      contact_id: typeof body['contact_id'] === 'string' && body['contact_id'].trim() ? body['contact_id'].trim() : undefined,
      contact_name: typeof body['contact_name'] === 'string' && body['contact_name'].trim() ? body['contact_name'].trim() : undefined,
      tags,
      shared: false,
      storage_path: storagePath,
      uploaded_by: typeof body['uploaded_by'] === 'string' ? body['uploaded_by'] : undefined,
    })

    // Persist the id into the storage path (rewrite with correct id now that we have it)
    // The id was pre-generated above, so storage_path is already correct.
    return c.json({ document: doc }, 201)
  })

  // PATCH /api/documents/:id — update metadata
  app.patch('/api/documents/:id', async (c) => {
    const brand = c.req.query('brand') ?? BRAND()
    const id = c.req.param('id')
    const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>

    const patch: Record<string, unknown> = {}
    if (typeof body['name'] === 'string') patch['name'] = body['name']
    if (typeof body['description'] === 'string') patch['description'] = body['description']
    if (typeof body['folder'] === 'string') patch['folder'] = body['folder']
    if (Array.isArray(body['tags'])) patch['tags'] = body['tags']
    if (typeof body['contact_id'] === 'string') patch['contact_id'] = body['contact_id']
    if (typeof body['contact_name'] === 'string') patch['contact_name'] = body['contact_name']

    const doc = updateDocument(brand, id, patch)
    if (!doc) return c.json({ error: 'Not found' }, 404)
    return c.json({ document: doc })
  })

  // DELETE /api/documents/:id — delete record and file
  app.delete('/api/documents/:id', (c) => {
    const brand = c.req.query('brand') ?? BRAND()
    const id = c.req.param('id')
    const doc = getDocument(brand, id)
    if (!doc) return c.json({ error: 'Not found' }, 404)

    // Delete file from disk
    try {
      const fileDir = join(DATA_DIR, 'documents', brand, id)
      rmSync(fileDir, { recursive: true, force: true })
    } catch { /* best effort */ }

    const ok = deleteDocument(brand, id)
    return ok ? c.json({ ok: true }) : c.json({ error: 'Not found' }, 404)
  })

  // POST /api/documents/:id/share — generate share token
  app.post('/api/documents/:id/share', (c) => {
    const brand = c.req.query('brand') ?? BRAND()
    const id = c.req.param('id')
    const doc = generateShareToken(brand, id)
    if (!doc) return c.json({ error: 'Not found' }, 404)
    return c.json({ document: doc })
  })

  // DELETE /api/documents/:id/unshare — remove sharing
  app.delete('/api/documents/:id/unshare', (c) => {
    const brand = c.req.query('brand') ?? BRAND()
    const id = c.req.param('id')
    const doc = updateDocument(brand, id, { shared: false, share_token: undefined })
    if (!doc) return c.json({ error: 'Not found' }, 404)
    return c.json({ document: doc })
  })

  // GET /api/documents/:id/download — stream file
  app.get('/api/documents/:id/download', (c) => {
    const brand = c.req.query('brand') ?? BRAND()
    const id = c.req.param('id')
    const token = c.req.query('token')

    // Allow if: user is authenticated (brand query present) OR valid share token
    let doc = getDocument(brand, id)

    // If not found by brand, try by share token
    if (!doc && token) {
      const result = getDocumentByShareToken(token)
      if (result && result.doc.id === id) doc = result.doc
    }

    if (!doc) return c.json({ error: 'Not found' }, 404)

    const filePath = join(DATA_DIR, doc.storage_path)
    let data: Buffer
    try {
      data = readFileSync(filePath)
    } catch {
      return c.json({ error: 'File not found on disk' }, 404)
    }

    return new Response(new Uint8Array(data), {
      headers: {
        'Content-Type': doc.mime_type,
        'Content-Disposition': `attachment; filename="${doc.name}"`,
      },
    })
  })
}
