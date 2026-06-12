import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useBrand } from '@/contexts/BrandContext'
import { toast } from '@/components/toast'
import {
  Add01Icon,
  Delete02Icon,
  PencilEdit02Icon,
  Cancel01Icon,
  Package01Icon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'

export const Route = createFileRoute('/products')({ component: ProductsScreen })

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Product {
  id: string
  brand: string
  name: string
  description?: string
  unit_price_cents: number
  category?: string
  sku?: string
  taxable: boolean
  active: boolean
  created_at: string
  updated_at: string
}

// ── API helpers ───────────────────────────────────────────────────────────────

async function fetchProducts(brand: string, active?: boolean, category?: string): Promise<Product[]> {
  const params = new URLSearchParams({ brand })
  if (active !== undefined) params.set('active', String(active))
  if (category) params.set('category', category)
  const res = await fetch(`/api/products?${params}`)
  const d = await res.json() as { products?: Product[] }
  return d.products ?? []
}

async function apiCreateProduct(brand: string, data: Partial<Product>): Promise<Product> {
  const res = await fetch(`/api/products?brand=${brand}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error((await res.json() as { error?: string }).error ?? 'Failed to create')
  return res.json() as Promise<Product>
}

async function apiUpdateProduct(brand: string, id: string, data: Partial<Product>): Promise<Product> {
  const res = await fetch(`/api/products/${id}?brand=${brand}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error((await res.json() as { error?: string }).error ?? 'Failed to update')
  return res.json() as Promise<Product>
}

async function apiDeleteProduct(brand: string, id: string): Promise<void> {
  await fetch(`/api/products/${id}?brand=${brand}`, { method: 'DELETE' })
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtPrice(cents: number): string {
  return (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

// ── Design tokens (shared vocabulary with Payments / Payroll / Mission Control) ──

const ACCENT_GRADIENT = 'linear-gradient(135deg, var(--theme-accent), color-mix(in srgb, var(--theme-accent) 65%, #000))'
const ACCENT_GLOW = '0 2px 8px color-mix(in srgb, var(--theme-accent) 38%, transparent)'

const primaryBtnCls = 'flex items-center gap-1.5 rounded-xl px-4 py-2 text-[12px] font-semibold text-white transition-all duration-150 hover:-translate-y-px hover:shadow-md disabled:opacity-50 disabled:hover:translate-y-0'
const primaryBtnStyle: React.CSSProperties = { background: ACCENT_GRADIENT, boxShadow: ACCENT_GLOW }

const INPUT = 'w-full rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input,var(--theme-card))] px-3 py-2 text-sm text-[var(--theme-text)] placeholder-[var(--theme-muted)] outline-none transition-all duration-150 focus:border-[var(--theme-accent)]'

function TintedPill({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold"
      style={{
        background: `color-mix(in srgb, ${color} 12%, var(--theme-card))`,
        color,
        border: `1px solid color-mix(in srgb, ${color} 30%, transparent)`,
      }}
    >
      {children}
    </span>
  )
}

// ── Product modal ─────────────────────────────────────────────────────────────

function ProductModal({
  initial,
  onClose,
  onSave,
}: {
  initial?: Product
  onClose: () => void
  onSave: (data: Partial<Product>) => void
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [priceStr, setPriceStr] = useState(initial ? String(initial.unit_price_cents / 100) : '')
  const [category, setCategory] = useState(initial?.category ?? '')
  const [sku, setSku] = useState(initial?.sku ?? '')
  const [taxable, setTaxable] = useState(initial?.taxable ?? true)
  const [active, setActive] = useState(initial?.active ?? true)

  const handleSave = () => {
    const unit_price_cents = Math.round(parseFloat(priceStr || '0') * 100)
    onSave({
      name: name.trim(),
      description: description || undefined,
      unit_price_cents,
      category: category || undefined,
      sku: sku || undefined,
      taxable,
      active,
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
      <div
        className="w-full max-w-md rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-card)] shadow-xl motion-safe:animate-[fadeSlideIn_150ms_ease-out]"
        style={{ backdropFilter: 'blur(10px)' }}
      >
        <div className="flex items-center justify-between border-b border-[var(--theme-border)] px-5 py-4">
          <div className="flex items-center gap-2.5">
            <span
              className="flex h-8 w-8 items-center justify-center rounded-lg"
              style={{ background: ACCENT_GRADIENT, boxShadow: ACCENT_GLOW }}
            >
              <HugeiconsIcon icon={Package01Icon} size={15} className="text-white" />
            </span>
            <div>
              <h2 className="text-[15px] font-bold leading-tight text-[var(--theme-text)]">
                {initial ? 'Edit product' : 'New product'}
              </h2>
              <p className="text-[11px] text-[var(--theme-muted)]">Catalog item for invoices and proposals</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-[var(--theme-muted)] transition-all duration-150 hover:bg-[var(--theme-hover)] hover:text-[var(--theme-text)]"
          >
            <HugeiconsIcon icon={Cancel01Icon} size={16} />
          </button>
        </div>
        <div className="p-5 space-y-3 max-h-[70vh] overflow-y-auto">
          <div>
            <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]">Details</label>
            <input
              placeholder="Product name *"
              value={name}
              onChange={e => setName(e.target.value)}
              className={INPUT}
            />
          </div>
          <textarea
            rows={2}
            placeholder="Description"
            value={description}
            onChange={e => setDescription(e.target.value)}
            className={`${INPUT} resize-y`}
          />
          <div className="grid grid-cols-2 gap-3">
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-sm text-[var(--theme-muted)]">$</span>
              <input
                type="number"
                min={0}
                step="0.01"
                placeholder="0.00"
                value={priceStr}
                onChange={e => setPriceStr(e.target.value)}
                className={`${INPUT} pl-6 tabular-nums`}
              />
            </div>
            <input
              placeholder="Category"
              value={category}
              onChange={e => setCategory(e.target.value)}
              className={INPUT}
            />
          </div>
          <input
            placeholder="SKU (optional)"
            value={sku}
            onChange={e => setSku(e.target.value)}
            className={`${INPUT} font-mono`}
          />
          <div className="flex items-center gap-6 pt-1">
            <label className="flex items-center gap-2 cursor-pointer">
              <div
                onClick={() => setTaxable(v => !v)}
                className="relative h-5 w-9 rounded-full transition-colors duration-150"
                style={{ background: taxable ? 'var(--theme-accent)' : 'var(--theme-border)' }}
              >
                <span
                  className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform duration-150 ${taxable ? 'translate-x-4' : 'translate-x-0.5'}`}
                />
              </div>
              <span className="text-sm text-[var(--theme-text)]">Taxable</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <div
                onClick={() => setActive(v => !v)}
                className="relative h-5 w-9 rounded-full transition-colors duration-150"
                style={{ background: active ? '#10b981' : 'var(--theme-border)' }}
              >
                <span
                  className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform duration-150 ${active ? 'translate-x-4' : 'translate-x-0.5'}`}
                />
              </div>
              <span className="text-sm text-[var(--theme-text)]">Active</span>
            </label>
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-[var(--theme-border)] px-5 py-4">
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm text-[var(--theme-muted)] transition-all duration-150 hover:text-[var(--theme-text)]"
          >
            Cancel
          </button>
          <button
            disabled={!name.trim()}
            onClick={handleSave}
            className={primaryBtnCls}
            style={primaryBtnStyle}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Product card ──────────────────────────────────────────────────────────────

function ProductCard({
  product,
  onEdit,
  onDelete,
}: {
  product: Product
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <div
      className="group relative flex flex-col gap-2 overflow-hidden rounded-xl border border-[var(--theme-border)] bg-[var(--theme-card)] p-4 transition-all duration-150 hover:-translate-y-px hover:shadow-md hover:border-[color-mix(in_srgb,var(--theme-accent)_45%,var(--theme-border))]"
      style={{ backdropFilter: 'blur(10px)' }}
    >
      <div
        className="absolute left-0 top-0 h-full w-[3px]"
        style={{
          background: product.active
            ? 'linear-gradient(180deg, var(--theme-accent), color-mix(in srgb, var(--theme-accent) 40%, transparent))'
            : 'var(--theme-border)',
        }}
      />
      <div className="flex items-start justify-between gap-2 pl-1.5">
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-[var(--theme-text)] text-sm">{product.name}</p>
          {product.sku && (
            <span className="mt-1 inline-flex rounded-md border border-[var(--theme-border)] bg-[var(--theme-hover)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--theme-muted)]">
              {product.sku}
            </span>
          )}
        </div>
        <div className="flex gap-1 shrink-0 opacity-0 transition-opacity duration-150 group-hover:opacity-100 focus-within:opacity-100">
          <button
            onClick={onEdit}
            className="rounded-lg p-1.5 text-[var(--theme-muted)] transition-all duration-150 hover:bg-[var(--theme-hover)] hover:text-[var(--theme-text)]"
            title="Edit"
          >
            <HugeiconsIcon icon={PencilEdit02Icon} size={14} />
          </button>
          <button
            onClick={onDelete}
            className="rounded-lg p-1.5 text-[var(--theme-muted)] transition-all duration-150 hover:bg-[var(--theme-hover)] hover:text-[#ef4444]"
            title="Delete"
          >
            <HugeiconsIcon icon={Delete02Icon} size={14} />
          </button>
        </div>
      </div>

      {product.description && (
        <p className="pl-1.5 text-xs text-[var(--theme-muted)] line-clamp-2 leading-relaxed">{product.description}</p>
      )}

      <div className="mt-auto flex items-end justify-between gap-2 pl-1.5 pt-1">
        <span className="text-[20px] font-bold leading-none tabular-nums text-[var(--theme-text)]">
          {fmtPrice(product.unit_price_cents)}
        </span>
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          {product.category && (
            <TintedPill color="#8b5cf6">{product.category}</TintedPill>
          )}
          {product.taxable && (
            <TintedPill color="#f59e0b">taxable</TintedPill>
          )}
          {product.active ? (
            <TintedPill color="#10b981">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: '#10b981' }} />
              active
            </TintedPill>
          ) : (
            <TintedPill color="#94a3b8">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: '#94a3b8' }} />
              inactive
            </TintedPill>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Main screen ───────────────────────────────────────────────────────────────

function ProductsScreen() {
  const brand = useBrand()
  const qc = useQueryClient()
  const [modal, setModal] = useState<'new' | Product | null>(null)
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null)

  const { data: products = [], isLoading } = useQuery({
    queryKey: ['products', brand.id],
    queryFn: () => fetchProducts(brand.id),
  })

  // Derive unique categories
  const categories = Array.from(new Set(products.map(p => p.category).filter(Boolean) as string[])).sort()

  const filtered = categoryFilter ? products.filter(p => p.category === categoryFilter) : products

  const invalidate = () => void qc.invalidateQueries({ queryKey: ['products', brand.id] })

  const createMut = useMutation({
    mutationFn: (data: Partial<Product>) => apiCreateProduct(brand.id, data),
    onSuccess: () => { invalidate(); setModal(null); toast('Product created') },
    onError: (e: Error) => toast(e.message, { type: 'error' }),
  })

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Product> }) => apiUpdateProduct(brand.id, id, data),
    onSuccess: () => { invalidate(); setModal(null); toast('Product updated') },
    onError: (e: Error) => toast(e.message, { type: 'error' }),
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => apiDeleteProduct(brand.id, id),
    onSuccess: () => { invalidate(); toast('Product deleted') },
    onError: () => toast('Failed to delete', { type: 'error' }),
  })

  const handleSave = (data: Partial<Product>) => {
    if (modal === 'new') {
      createMut.mutate(data)
    } else if (modal && typeof modal !== 'string') {
      updateMut.mutate({ id: modal.id, data })
    }
  }

  const handleDelete = (product: Product) => {
    if (confirm(`Delete "${product.name}"?`)) deleteMut.mutate(product.id)
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div
        className="flex items-center justify-between border-b px-6 py-4"
        style={{ borderColor: 'var(--theme-border)', background: 'var(--theme-card)' }}
      >
        <div className="flex items-center gap-2.5">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-lg"
            style={{ background: ACCENT_GRADIENT, boxShadow: ACCENT_GLOW }}
          >
            <HugeiconsIcon icon={Package01Icon} size={17} className="text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold leading-tight text-[var(--theme-text)]">Products &amp; Services</h1>
            <p className="text-[11px] text-[var(--theme-muted)]">
              <span className="tabular-nums">{products.length}</span> item{products.length !== 1 ? 's' : ''}
              {categories.length > 0 && <> · <span className="tabular-nums">{categories.length}</span> categor{categories.length !== 1 ? 'ies' : 'y'}</>}
            </p>
          </div>
        </div>
        <button onClick={() => setModal('new')} className={primaryBtnCls} style={primaryBtnStyle}>
          <HugeiconsIcon icon={Add01Icon} size={14} />
          New Product
        </button>
      </div>

      {/* Category filter — segmented control */}
      {categories.length > 0 && (
        <div className="flex overflow-x-auto px-6 py-2.5 border-b border-[var(--theme-border)]" style={{ background: 'var(--theme-card)' }}>
          <div className="flex shrink-0 items-center gap-0.5 rounded-lg border border-[var(--theme-border)] p-0.5">
            <button
              onClick={() => setCategoryFilter(null)}
              className={`shrink-0 rounded-md px-3 py-1.5 text-xs font-medium transition-all duration-150 ${
                categoryFilter === null ? '' : 'text-[var(--theme-muted)] hover:text-[var(--theme-text)]'
              }`}
              style={categoryFilter === null ? {
                background: 'color-mix(in srgb, var(--theme-accent) 14%, var(--theme-card))',
                color: 'var(--theme-accent)',
              } : undefined}
            >
              All <span className="tabular-nums text-[10px] text-[var(--theme-muted)]">{products.length}</span>
            </button>
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat === categoryFilter ? null : cat)}
                className={`shrink-0 rounded-md px-3 py-1.5 text-xs font-medium transition-all duration-150 ${
                  categoryFilter === cat ? '' : 'text-[var(--theme-muted)] hover:text-[var(--theme-text)]'
                }`}
                style={categoryFilter === cat ? {
                  background: 'color-mix(in srgb, var(--theme-accent) 14%, var(--theme-card))',
                  color: 'var(--theme-accent)',
                } : undefined}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Product grid */}
      <div className="flex-1 overflow-y-auto p-6">
        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {[0, 1, 2, 3, 4, 5].map(i => (
              <div
                key={i}
                className="h-32 animate-pulse rounded-xl border border-[var(--theme-border)]"
                style={{ background: 'color-mix(in srgb, var(--theme-card) 60%, transparent)' }}
              />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex h-52 flex-col items-center justify-center gap-3">
            <div
              className="flex h-14 w-14 items-center justify-center rounded-full"
              style={{ background: ACCENT_GRADIENT, boxShadow: ACCENT_GLOW }}
            >
              <HugeiconsIcon icon={Package01Icon} size={26} className="text-white" />
            </div>
            <p className="text-sm font-semibold text-[var(--theme-text)]">
              {categoryFilter ? 'No products in this category' : 'No products yet'}
            </p>
            <p className="text-xs text-[var(--theme-muted)]">Build a catalog to reuse on invoices and proposals</p>
            {!categoryFilter && (
              <button onClick={() => setModal('new')} className={`mt-1 ${primaryBtnCls}`} style={primaryBtnStyle}>
                Create your first product
              </button>
            )}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filtered.map(product => (
              <ProductCard
                key={product.id}
                product={product}
                onEdit={() => setModal(product)}
                onDelete={() => handleDelete(product)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Modal */}
      {modal && (
        <ProductModal
          initial={modal === 'new' ? undefined : modal}
          onClose={() => setModal(null)}
          onSave={handleSave}
        />
      )}
    </div>
  )
}
