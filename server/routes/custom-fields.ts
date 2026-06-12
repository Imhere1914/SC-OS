import type { Hono } from 'hono'
import {
  listSchemas,
  createSchema,
  updateSchema,
  deleteSchema,
  type EntityType,
  type FieldType,
} from '../stores/custom-field-schemas-store'

const BRAND = process.env.BRAND ?? 'default'

const VALID_ENTITIES: EntityType[] = ['deal', 'contact']
const VALID_TYPES: FieldType[] = ['text', 'number', 'date', 'select', 'boolean', 'url']

export function registerCustomFields(app: Hono) {
  // GET /api/custom-fields?entity=deal|contact
  app.get('/api/custom-fields', (c) => {
    const brand = c.req.query('brand') ?? BRAND
    const entity = c.req.query('entity') as EntityType | undefined
    if (entity && !VALID_ENTITIES.includes(entity)) {
      return c.json({ error: 'invalid entity' }, 400)
    }
    const schemas = listSchemas(brand, entity)
    return c.json({ schemas })
  })

  // POST /api/custom-fields
  app.post('/api/custom-fields', async (c) => {
    const brand = c.req.query('brand') ?? BRAND
    const body = await c.req.json() as {
      entity?: string
      name?: string
      type?: string
      options?: string[]
      required?: boolean
      sort_order?: number
    }
    if (!body.entity || !VALID_ENTITIES.includes(body.entity as EntityType)) {
      return c.json({ error: 'entity must be "deal" or "contact"' }, 400)
    }
    if (!body.name?.trim()) {
      return c.json({ error: 'name is required' }, 400)
    }
    if (!body.type || !VALID_TYPES.includes(body.type as FieldType)) {
      return c.json({ error: `type must be one of: ${VALID_TYPES.join(', ')}` }, 400)
    }
    const schema = createSchema(brand, {
      entity: body.entity as EntityType,
      name: body.name.trim(),
      type: body.type as FieldType,
      options: body.options,
      required: body.required,
      sort_order: body.sort_order,
    })
    return c.json(schema, 201)
  })

  // PATCH /api/custom-fields/:id
  app.patch('/api/custom-fields/:id', async (c) => {
    const brand = c.req.query('brand') ?? BRAND
    const id = c.req.param('id')
    const body = await c.req.json() as {
      name?: string
      type?: string
      options?: string[]
      required?: boolean
      sort_order?: number
    }
    if (body.type && !VALID_TYPES.includes(body.type as FieldType)) {
      return c.json({ error: `type must be one of: ${VALID_TYPES.join(', ')}` }, 400)
    }
    const updated = updateSchema(brand, id, {
      name: body.name,
      type: body.type as FieldType | undefined,
      options: body.options,
      required: body.required,
      sort_order: body.sort_order,
    })
    if (!updated) return c.json({ error: 'not found' }, 404)
    return c.json(updated)
  })

  // DELETE /api/custom-fields/:id
  app.delete('/api/custom-fields/:id', (c) => {
    const brand = c.req.query('brand') ?? BRAND
    const id = c.req.param('id')
    const ok = deleteSchema(brand, id)
    return ok ? c.json({ ok: true }) : c.json({ error: 'not found' }, 404)
  })
}
