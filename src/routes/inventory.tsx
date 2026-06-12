import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useBrand } from '@/contexts/BrandContext'
import { toast } from '@/components/toast'
import { cn } from '@/lib/utils'
import {
  Add01Icon,
  Cancel01Icon,
  Delete02Icon,
  PencilEdit02Icon,
  WarehouseIcon,
  PackageOutOfStockIcon,
  AlertCircleIcon,
  ArrowDown01Icon,
  ArrowUp01Icon,
  MoreHorizontalCircle01Icon,
  RefreshIcon,
  ViewIcon,
  PackageIcon,
  CheckmarkCircle02Icon,
  DollarCircleIcon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'

export const Route = createFileRoute('/inventory')({ component: InventoryScreen })

// ── Types ─────────────────────────────────────────────────────────────────────

export interface InventoryItem {
  id: string
  brand: string
  product_id?: string
  sku: string
  name: string
  description?: string
  category?: string
  unit: string
  cost_price_cents: number
  selling_price_cents: number
  quantity_on_hand: number
  quantity_reserved: number
  quantity_reorder_point: number
  quantity_reorder_quantity: number
  location?: string
  supplier_name?: string
  supplier_contact?: string
  is_active: boolean
  tags: string[]
  created_at: string
  updated_at: string
}

export interface StockMovement {
  id: string
  brand: string
  item_id: string
  type: 'receive' | 'ship' | 'adjust' | 'transfer'
  quantity: number
  reference?: string
  notes?: string
  actor?: string
  created_at: string
}

export interface InventorySummary {
  total_items: number
  active_items: number
  total_value_cents: number
  low_stock_count: number
}

// ── API helpers ───────────────────────────────────────────────────────────────

async function fetchItems(brand: string, search?: string, category?: string, lowStock?: boolean): Promise<InventoryItem[]> {
  const p = new URLSearchParams({ brand })
  if (search) p.set('search', search)
  if (category) p.set('category', category)
  if (lowStock) p.set('low_stock', 'true')
  const res = await fetch(`/api/inventory?${p}`)
  const d = await res.json() as { items?: InventoryItem[] }
  return d.items ?? []
}

async function fetchSummary(brand: string): Promise<InventorySummary> {
  const res = await fetch(`/api/inventory/summary?brand=${brand}`)
  return res.json() as Promise<InventorySummary>
}

async function fetchMovements(brand: string, itemId: string): Promise<StockMovement[]> {
  const res = await fetch(`/api/inventory/${itemId}/movements?brand=${brand}`)
  const d = await res.json() as { movements?: StockMovement[] }
  return d.movements ?? []
}

async function apiCreateItem(brand: string, data: Partial<InventoryItem>): Promise<InventoryItem> {
  const res = await fetch(`/api/inventory?brand=${brand}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error((await res.json() as { error?: string }).error ?? 'Failed to create')
  return res.json() as Promise<InventoryItem>
}

async function apiUpdateItem(brand: string, id: string, data: Partial<InventoryItem>): Promise<InventoryItem> {
  const res = await fetch(`/api/inventory/${id}?brand=${brand}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error((await res.json() as { error?: string }).error ?? 'Failed to update')
  return res.json() as Promise<InventoryItem>
}

async function apiDeleteItem(brand: string, id: string): Promise<void> {
  await fetch(`/api/inventory/${id}?brand=${brand}`, { method: 'DELETE' })
}

async function apiAdjustStock(brand: string, id: string, data: {
  quantity: number
  type: string
  reference?: string
  notes?: string
}): Promise<StockMovement> {
  const res = await fetch(`/api/inventory/${id}/adjust?brand=${brand}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) throw new Error((await res.json() as { error?: string }).error ?? 'Failed to adjust')
  return res.json() as Promise<StockMovement>
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtCents(cents: number): string {
  return (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' })
}

function marginPct(cost: number, sell: number): number | null {
  if (sell <= 0) return null
  return ((sell - cost) / sell) * 100
}

function marginColor(pct: number | null): string {
  if (pct == null) return 'var(--theme-muted)'
  if (pct < 0) return '#ef4444'
  if (pct < 20) return '#f59e0b'
  return '#10b981'
}

// ── Shared design tokens ──────────────────────────────────────────────────────

const ACCENT_GRADIENT = 'linear-gradient(135deg, var(--theme-accent), color-mix(in srgb, var(--theme-accent) 65%, #000))'
const ACCENT_GLOW = '0 2px 8px color-mix(in srgb, var(--theme-accent) 35%, transparent)'

const primaryBtnCls = 'flex items-center gap-1.5 rounded-xl px-4 py-2 text-[12px] font-semibold text-white transition-all hover:-translate-y-px hover:shadow-md disabled:opacity-50 disabled:hover:translate-y-0'
const primaryBtnStyle: React.CSSProperties = { background: ACCENT_GRADIENT, boxShadow: ACCENT_GLOW }

const INPUT = 'w-full rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input)] px-3 py-2 text-sm text-[var(--theme-text)] placeholder-[var(--theme-muted)] outline-none focus:ring-1 focus:ring-[var(--theme-accent)]'
const SELECT = `${INPUT} cursor-pointer`

const MOVEMENT_LABELS: Record<string, string> = {
  receive: 'Received',
  ship: 'Shipped',
  adjust: 'Adjusted',
  transfer: 'Transferred',
}

const MOVEMENT_HEX: Record<string, string> = {
  receive: '#10b981',
  ship: '#ef4444',
  adjust: '#3b82f6',
  transfer: '#f59e0b',
}

const UNITS = ['each', 'box', 'case', 'pack', 'kg', 'lb', 'oz', 'g', 'liter', 'ml', 'pair', 'set', 'roll', 'sheet', 'bag']

// Mono SKU chip, accent tinted
function SkuChip({ sku }: { sku: string }) {
  return (
    <span
      className="inline-flex rounded-md px-1.5 py-0.5 font-mono text-[10px] font-semibold"
      style={{
        background: 'color-mix(in srgb, var(--theme-accent) 10%, var(--theme-card))',
        color: 'var(--theme-accent)',
        border: '1px solid color-mix(in srgb, var(--theme-accent) 25%, transparent)',
      }}
    >
      {sku}
    </span>
  )
}

// Stat card with left accent bar + gradient icon chip
function StatCard({ label, value, sub, color, icon }: {
  label: string
  value: string | number
  sub?: string
  color: string
  icon: typeof PackageIcon
}) {
  return (
    <div
      className="relative overflow-hidden rounded-xl border p-4 transition-all duration-150 hover:-translate-y-1 hover:shadow-md"
      style={{ background: 'var(--theme-card)', borderColor: 'var(--theme-border)', backdropFilter: 'blur(10px)' }}
    >
      <div
        className="absolute left-0 top-0 h-full w-[3px] rounded-l-xl"
        style={{ background: `linear-gradient(180deg, ${color}, color-mix(in srgb, ${color} 40%, transparent))` }}
      />
      <div className="pl-1.5">
        <span
          className="mb-3 flex h-8 w-8 items-center justify-center rounded-lg"
          style={{
            background: `linear-gradient(135deg, ${color}, color-mix(in srgb, ${color} 65%, #000))`,
            boxShadow: `0 2px 8px color-mix(in srgb, ${color} 35%, transparent)`,
          }}
        >
          <HugeiconsIcon icon={icon} size={15} className="text-white" />
        </span>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]">{label}</p>
        <p className="mt-1 text-[22px] font-bold leading-none tabular-nums" style={{ color: color === '#ef4444' ? color : 'var(--theme-text)' }}>{value}</p>
        {sub && <p className="mt-1 text-[11px] text-[var(--theme-muted)]">{sub}</p>}
      </div>
    </div>
  )
}

// Modal header with gradient icon chip
function ModalHeader({ icon, title, subtitle, onClose }: {
  icon: typeof PackageIcon
  title: string
  subtitle?: string
  onClose: () => void
}) {
  return (
    <div className="flex items-center justify-between border-b border-[var(--theme-border)] px-5 py-3.5">
      <div className="flex items-center gap-3">
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
          style={{ background: ACCENT_GRADIENT, boxShadow: ACCENT_GLOW }}
        >
          <HugeiconsIcon icon={icon} size={16} className="text-white" />
        </span>
        <div>
          <h2 className="text-[14px] font-semibold text-[var(--theme-text)]">{title}</h2>
          {subtitle && <p className="text-[11px] text-[var(--theme-muted)]">{subtitle}</p>}
        </div>
      </div>
      <button onClick={onClose} className="rounded-lg p-1.5 transition-colors hover:bg-[var(--theme-hover)]">
        <HugeiconsIcon icon={Cancel01Icon} size={16} className="text-[var(--theme-muted)]" />
      </button>
    </div>
  )
}

// ── Item modal ────────────────────────────────────────────────────────────────

function ItemModal({
  initial,
  onClose,
  onSave,
}: {
  initial?: InventoryItem
  onClose: () => void
  onSave: (data: Partial<InventoryItem>) => void
}) {
  const [sku, setSku] = useState(initial?.sku ?? '')
  const [name, setName] = useState(initial?.name ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [category, setCategory] = useState(initial?.category ?? '')
  const [unit, setUnit] = useState(initial?.unit ?? 'each')
  const [costStr, setCostStr] = useState(initial ? String(initial.cost_price_cents / 100) : '')
  const [sellStr, setSellStr] = useState(initial ? String(initial.selling_price_cents / 100) : '')
  const [qtyOnHand, setQtyOnHand] = useState(String(initial?.quantity_on_hand ?? 0))
  const [qtyReorderPt, setQtyReorderPt] = useState(String(initial?.quantity_reorder_point ?? 0))
  const [qtyReorderQty, setQtyReorderQty] = useState(String(initial?.quantity_reorder_quantity ?? 0))
  const [location, setLocation] = useState(initial?.location ?? '')
  const [supplierName, setSupplierName] = useState(initial?.supplier_name ?? '')
  const [supplierContact, setSupplierContact] = useState(initial?.supplier_contact ?? '')
  const [isActive, setIsActive] = useState(initial?.is_active ?? true)

  const handleSave = () => {
    onSave({
      sku: sku.trim(),
      name: name.trim(),
      description: description || undefined,
      category: category || undefined,
      unit,
      cost_price_cents: Math.round(parseFloat(costStr || '0') * 100),
      selling_price_cents: Math.round(parseFloat(sellStr || '0') * 100),
      quantity_on_hand: parseInt(qtyOnHand || '0', 10),
      quantity_reserved: initial?.quantity_reserved ?? 0,
      quantity_reorder_point: parseInt(qtyReorderPt || '0', 10),
      quantity_reorder_quantity: parseInt(qtyReorderQty || '0', 10),
      location: location || undefined,
      supplier_name: supplierName || undefined,
      supplier_contact: supplierContact || undefined,
      is_active: isActive,
      tags: initial?.tags ?? [],
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-card)] shadow-2xl">
        <ModalHeader
          icon={PackageIcon}
          title={initial ? 'Edit Item' : 'New Inventory Item'}
          subtitle={initial ? `${initial.name} · ${initial.sku}` : 'Add an item to your inventory'}
          onClose={onClose}
        />
        <div className="max-h-[70vh] space-y-3 overflow-y-auto p-5">
          {/* Name + SKU */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <input placeholder="Item name *" value={name} onChange={e => setName(e.target.value)} className={INPUT} />
            </div>
            <input placeholder="SKU *" value={sku} onChange={e => setSku(e.target.value)} className={`${INPUT} font-mono`} />
          </div>
          <textarea rows={2} placeholder="Description" value={description} onChange={e => setDescription(e.target.value)} className={`${INPUT} resize-y`} />
          {/* Category + Unit */}
          <div className="grid grid-cols-2 gap-3">
            <input placeholder="Category" value={category} onChange={e => setCategory(e.target.value)} className={INPUT} />
            <select value={unit} onChange={e => setUnit(e.target.value)} className={SELECT}>
              {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
          </div>
          {/* Prices */}
          <div className="grid grid-cols-2 gap-3">
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-sm text-[var(--theme-muted)]">$</span>
              <input type="number" min={0} step="0.01" placeholder="Cost price" value={costStr} onChange={e => setCostStr(e.target.value)} className={`${INPUT} pl-6 tabular-nums`} />
            </div>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-sm text-[var(--theme-muted)]">$</span>
              <input type="number" min={0} step="0.01" placeholder="Selling price" value={sellStr} onChange={e => setSellStr(e.target.value)} className={`${INPUT} pl-6 tabular-nums`} />
            </div>
          </div>
          {/* Quantities */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="mb-1 block text-[11px] font-medium text-[var(--theme-muted)]">Qty on Hand</label>
              <input type="number" min={0} value={qtyOnHand} onChange={e => setQtyOnHand(e.target.value)} className={`${INPUT} tabular-nums`} />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-[var(--theme-muted)]">Reorder Point</label>
              <input type="number" min={0} value={qtyReorderPt} onChange={e => setQtyReorderPt(e.target.value)} className={`${INPUT} tabular-nums`} />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-[var(--theme-muted)]">Reorder Qty</label>
              <input type="number" min={0} value={qtyReorderQty} onChange={e => setQtyReorderQty(e.target.value)} className={`${INPUT} tabular-nums`} />
            </div>
          </div>
          {/* Location */}
          <input placeholder="Location (e.g. Warehouse A / Shelf B3)" value={location} onChange={e => setLocation(e.target.value)} className={INPUT} />
          {/* Supplier */}
          <div className="grid grid-cols-2 gap-3">
            <input placeholder="Supplier name" value={supplierName} onChange={e => setSupplierName(e.target.value)} className={INPUT} />
            <input placeholder="Supplier contact / email" value={supplierContact} onChange={e => setSupplierContact(e.target.value)} className={INPUT} />
          </div>
          {/* Active toggle */}
          <label className="flex cursor-pointer items-center gap-2">
            <div
              onClick={() => setIsActive(v => !v)}
              className={`relative h-5 w-9 rounded-full transition-colors ${isActive ? 'bg-[var(--theme-accent)]' : 'bg-[var(--theme-border)]'}`}
            >
              <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${isActive ? 'translate-x-4' : 'translate-x-0.5'}`} />
            </div>
            <span className="text-sm text-[var(--theme-text)]">Active</span>
          </label>
        </div>
        <div className="flex justify-end gap-2 border-t border-[var(--theme-border)] px-5 py-3">
          <button onClick={onClose} className="rounded-xl px-4 py-2 text-[12px] font-medium text-[var(--theme-muted)] transition-colors hover:bg-[var(--theme-hover)]">Cancel</button>
          <button
            disabled={!name.trim() || !sku.trim()}
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

// ── Adjust Stock modal ────────────────────────────────────────────────────────

const MOVEMENT_TYPE_OPTIONS: { value: 'receive' | 'ship' | 'adjust' | 'transfer'; label: string }[] = [
  { value: 'receive', label: 'Receive' },
  { value: 'ship', label: 'Ship' },
  { value: 'adjust', label: 'Adjust' },
  { value: 'transfer', label: 'Transfer' },
]

function AdjustModal({
  item,
  onClose,
  onAdjust,
}: {
  item: InventoryItem
  onClose: () => void
  onAdjust: (qty: number, type: string, reference?: string, notes?: string) => void
}) {
  const [qty, setQty] = useState('')
  const [type, setType] = useState<'receive' | 'ship' | 'adjust' | 'transfer'>('receive')
  const [reference, setReference] = useState('')
  const [notes, setNotes] = useState('')

  const parsed = parseInt(qty || '0', 10)
  const isOut = type === 'ship'
  const finalQty = isOut ? -Math.abs(parsed) : Math.abs(parsed)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl border border-[var(--theme-border)] bg-[var(--theme-card)] shadow-2xl">
        <ModalHeader
          icon={RefreshIcon}
          title="Adjust Stock"
          subtitle={`${item.name} — ${item.quantity_on_hand} ${item.unit} on hand`}
          onClose={onClose}
        />
        <div className="space-y-4 p-5">
          <div>
            <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]">Movement Type</label>
            <div className="flex gap-1 rounded-lg border border-[var(--theme-border)] bg-[var(--theme-hover)] p-1">
              {MOVEMENT_TYPE_OPTIONS.map(opt => {
                const c = MOVEMENT_HEX[opt.value]
                return (
                  <button
                    key={opt.value}
                    onClick={() => setType(opt.value)}
                    className={cn(
                      'flex-1 rounded-md px-2 py-1.5 text-[11px] font-semibold transition-all',
                      type === opt.value ? 'shadow-sm' : 'text-[var(--theme-muted)] hover:text-[var(--theme-text)]',
                    )}
                    style={type === opt.value ? {
                      background: `color-mix(in srgb, ${c} 14%, var(--theme-card))`,
                      color: c,
                    } : undefined}
                  >
                    {opt.label}
                  </button>
                )
              })}
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]">Quantity</label>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setQty(v => String(Math.max(0, parseInt(v || '0', 10) - 1)))}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[var(--theme-border)] transition-all hover:-translate-y-px hover:border-[var(--theme-accent)] hover:shadow-sm"
                style={{ background: 'color-mix(in srgb, var(--theme-hover) 60%, var(--theme-card))' }}
              >
                <HugeiconsIcon icon={ArrowDown01Icon} size={18} className="text-[var(--theme-text)]" />
              </button>
              <input
                type="number"
                min={0}
                value={qty}
                onChange={e => setQty(e.target.value)}
                className={`${INPUT} text-center text-[18px] font-bold tabular-nums`}
                placeholder="0"
              />
              <button
                onClick={() => setQty(v => String(parseInt(v || '0', 10) + 1))}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[var(--theme-border)] transition-all hover:-translate-y-px hover:border-[var(--theme-accent)] hover:shadow-sm"
                style={{ background: 'color-mix(in srgb, var(--theme-hover) 60%, var(--theme-card))' }}
              >
                <HugeiconsIcon icon={ArrowUp01Icon} size={18} className="text-[var(--theme-text)]" />
              </button>
            </div>
            {parsed > 0 && (
              <p className="mt-1.5 text-[11px] text-[var(--theme-muted)]">
                New on-hand: <span className="font-bold tabular-nums" style={{ color: item.quantity_on_hand + finalQty < 0 ? '#ef4444' : 'var(--theme-text)' }}>
                  {item.quantity_on_hand + finalQty}
                </span> {item.unit}
              </p>
            )}
          </div>
          <input placeholder="Reference (PO #, Order ID, etc.)" value={reference} onChange={e => setReference(e.target.value)} className={INPUT} />
          <textarea rows={2} placeholder="Notes" value={notes} onChange={e => setNotes(e.target.value)} className={`${INPUT} resize-none`} />
        </div>
        <div className="flex justify-end gap-2 border-t border-[var(--theme-border)] px-5 py-3">
          <button onClick={onClose} className="rounded-xl px-4 py-2 text-[12px] font-medium text-[var(--theme-muted)] transition-colors hover:bg-[var(--theme-hover)]">Cancel</button>
          <button
            disabled={parsed <= 0}
            onClick={() => onAdjust(finalQty, type, reference || undefined, notes || undefined)}
            className={primaryBtnCls}
            style={primaryBtnStyle}
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Movement History panel ────────────────────────────────────────────────────

function MovementsPanel({
  item,
  brand,
  onClose,
}: {
  item: InventoryItem
  brand: string
  onClose: () => void
}) {
  const { data: movements = [], isLoading } = useQuery({
    queryKey: ['inventory-movements', brand, item.id],
    queryFn: () => fetchMovements(brand, item.id),
  })

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="flex w-full max-w-md flex-col border-l border-[var(--theme-border)] bg-[var(--theme-card)] shadow-2xl">
        <ModalHeader
          icon={ViewIcon}
          title="Movement History"
          subtitle={`${item.name} · ${item.sku}`}
          onClose={onClose}
        />
        <div className="flex-1 overflow-y-auto p-4">
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-16 animate-pulse rounded-xl" style={{ background: 'var(--theme-card)', opacity: 0.6, border: '1px solid var(--theme-border)' }} />
              ))}
            </div>
          ) : movements.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
              <span
                className="flex h-12 w-12 items-center justify-center rounded-full"
                style={{
                  background: 'linear-gradient(135deg, color-mix(in srgb, var(--theme-accent) 18%, var(--theme-card)), color-mix(in srgb, #000 14%, var(--theme-card)))',
                  color: 'var(--theme-accent)',
                }}
              >
                <HugeiconsIcon icon={MoreHorizontalCircle01Icon} size={22} />
              </span>
              <p className="text-[13px] font-semibold text-[var(--theme-text)]">No movements yet</p>
              <p className="text-[11px] text-[var(--theme-muted)]">Stock adjustments will appear here.</p>
            </div>
          ) : (
            <div className="relative space-y-2 pl-4">
              {/* timeline rail */}
              <div className="absolute bottom-2 left-[5px] top-2 w-px" style={{ background: 'var(--theme-border)' }} />
              {movements.map(m => {
                const c = MOVEMENT_HEX[m.type] ?? '#94a3b8'
                return (
                  <div key={m.id} className="relative">
                    <span
                      className="absolute -left-[15px] top-3.5 h-2.5 w-2.5 rounded-full border-2"
                      style={{ background: c, borderColor: 'var(--theme-card)', boxShadow: `0 0 6px color-mix(in srgb, ${c} 50%, transparent)` }}
                    />
                    <div
                      className="rounded-xl border p-3 transition-colors hover:bg-[var(--theme-hover)]"
                      style={{ borderColor: `color-mix(in srgb, ${c} 25%, var(--theme-border))`, background: `color-mix(in srgb, ${c} 4%, var(--theme-card))` }}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold"
                          style={{
                            background: `color-mix(in srgb, ${c} 12%, var(--theme-card))`,
                            color: c,
                            border: `1px solid color-mix(in srgb, ${c} 30%, transparent)`,
                          }}
                        >
                          <span className="h-1.5 w-1.5 rounded-full" style={{ background: c }} />
                          {MOVEMENT_LABELS[m.type] ?? m.type}
                        </span>
                        <span className="text-sm font-bold tabular-nums" style={{ color: m.quantity > 0 ? '#10b981' : '#ef4444' }}>
                          {m.quantity > 0 ? '+' : ''}{m.quantity}
                        </span>
                      </div>
                      {m.reference && (
                        <p className="mt-1 font-mono text-[11px] text-[var(--theme-muted)]">Ref: {m.reference}</p>
                      )}
                      {m.notes && (
                        <p className="mt-0.5 text-[11px] text-[var(--theme-muted)]">{m.notes}</p>
                      )}
                      <p className="mt-1.5 text-[10px] text-[var(--theme-muted)] opacity-60">
                        {new Date(m.created_at).toLocaleString()}
                        {m.actor ? ` · ${m.actor}` : ''}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Main screen ───────────────────────────────────────────────────────────────

function InventoryScreen() {
  const brand = useBrand()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [lowStockOnly, setLowStockOnly] = useState(false)
  const [modal, setModal] = useState<'new' | InventoryItem | null>(null)
  const [adjustItem, setAdjustItem] = useState<InventoryItem | null>(null)
  const [historyItem, setHistoryItem] = useState<InventoryItem | null>(null)

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['inventory', brand.id, search, categoryFilter, lowStockOnly],
    queryFn: () => fetchItems(brand.id, search || undefined, categoryFilter || undefined, lowStockOnly || undefined),
  })

  const { data: summary } = useQuery({
    queryKey: ['inventory-summary', brand.id],
    queryFn: () => fetchSummary(brand.id),
  })

  const categories = Array.from(new Set(items.map(i => i.category).filter(Boolean) as string[])).sort()

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['inventory', brand.id] })
    void qc.invalidateQueries({ queryKey: ['inventory-summary', brand.id] })
  }

  const createMut = useMutation({
    mutationFn: (data: Partial<InventoryItem>) => apiCreateItem(brand.id, data),
    onSuccess: () => { invalidate(); setModal(null); toast('Item created') },
    onError: (e: Error) => toast(e.message, { type: 'error' }),
  })

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<InventoryItem> }) => apiUpdateItem(brand.id, id, data),
    onSuccess: () => { invalidate(); setModal(null); toast('Item updated') },
    onError: (e: Error) => toast(e.message, { type: 'error' }),
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => apiDeleteItem(brand.id, id),
    onSuccess: () => { invalidate(); toast('Item deleted') },
    onError: () => toast('Failed to delete', { type: 'error' }),
  })

  const adjustMut = useMutation({
    mutationFn: ({ id, qty, type, reference, notes }: { id: string; qty: number; type: string; reference?: string; notes?: string }) =>
      apiAdjustStock(brand.id, id, { quantity: qty, type, reference, notes }),
    onSuccess: () => {
      invalidate()
      void qc.invalidateQueries({ queryKey: ['inventory-movements', brand.id] })
      setAdjustItem(null)
      toast('Stock adjusted')
    },
    onError: (e: Error) => toast(e.message, { type: 'error' }),
  })

  const handleSave = (data: Partial<InventoryItem>) => {
    if (modal === 'new') {
      createMut.mutate(data)
    } else if (modal && typeof modal !== 'string') {
      updateMut.mutate({ id: modal.id, data })
    }
  }

  const handleDelete = (item: InventoryItem) => {
    if (confirm(`Delete "${item.name}"?`)) deleteMut.mutate(item.id)
  }

  const lowStockCount = summary?.low_stock_count ?? 0

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[var(--theme-border)] px-6 py-4">
        <div className="flex items-center gap-3">
          <div
            className="flex h-9 w-9 items-center justify-center rounded-xl"
            style={{ background: ACCENT_GRADIENT, boxShadow: ACCENT_GLOW }}
          >
            <HugeiconsIcon icon={WarehouseIcon} size={17} className="text-white" />
          </div>
          <div>
            <h1 className="text-[18px] font-bold text-[var(--theme-text)]">Inventory</h1>
            <p className="text-[11px] text-[var(--theme-muted)]">{items.length} item{items.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
        <button
          onClick={() => setModal('new')}
          className={primaryBtnCls}
          style={primaryBtnStyle}
        >
          <HugeiconsIcon icon={Add01Icon} size={14} />
          New Item
        </button>
      </div>

      {/* Low stock alert banner */}
      {lowStockCount > 0 && (
        <div
          className="flex items-center gap-3 border-b px-6 py-2.5"
          style={{
            background: 'color-mix(in srgb, #f59e0b 10%, var(--theme-card))',
            borderColor: 'color-mix(in srgb, #f59e0b 30%, var(--theme-border))',
          }}
        >
          <span
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg"
            style={{ background: 'color-mix(in srgb, #f59e0b 18%, var(--theme-card))', color: '#f59e0b' }}
          >
            <HugeiconsIcon icon={AlertCircleIcon} size={14} />
          </span>
          <p className="text-[12px]" style={{ color: '#f59e0b' }}>
            <span className="font-bold tabular-nums">{lowStockCount} item{lowStockCount !== 1 ? 's' : ''}</span> at or below reorder point
          </p>
          <button
            onClick={() => setLowStockOnly(true)}
            className="ml-auto rounded-lg px-2 py-1 text-[11px] font-semibold transition-colors"
            style={{ color: '#f59e0b' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'color-mix(in srgb, #f59e0b 14%, var(--theme-card))' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
          >
            View →
          </button>
        </div>
      )}

      {/* Stat cards */}
      {summary && (
        <div className="grid grid-cols-2 gap-4 border-b border-[var(--theme-border)] px-6 py-4 sm:grid-cols-4">
          <StatCard label="Total Items" value={summary.total_items} sub="in catalog" icon={PackageIcon} color="#0ea5e9" />
          <StatCard label="Active" value={summary.active_items} sub="available for sale" icon={CheckmarkCircle02Icon} color="#10b981" />
          <StatCard label="Total Value" value={fmtCents(summary.total_value_cents)} sub="at cost" icon={DollarCircleIcon} color="#8b5cf6" />
          <StatCard
            label="Low Stock"
            value={summary.low_stock_count}
            sub={summary.low_stock_count > 0 ? 'needs reordering' : 'all stocked'}
            icon={PackageOutOfStockIcon}
            color={summary.low_stock_count > 0 ? '#ef4444' : '#94a3b8'}
          />
        </div>
      )}

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3 border-b border-[var(--theme-border)] px-6 py-3">
        <input
          type="search"
          placeholder="Search by name, SKU, supplier…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-56 rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input)] px-3 py-1.5 text-[12px] text-[var(--theme-text)] placeholder-[var(--theme-muted)] outline-none focus:ring-1 focus:ring-[var(--theme-accent)]"
        />
        {categories.length > 0 && (
          <select
            value={categoryFilter}
            onChange={e => setCategoryFilter(e.target.value)}
            className="cursor-pointer rounded-lg border border-[var(--theme-border)] bg-[var(--theme-input)] px-3 py-1.5 text-[12px] text-[var(--theme-text)] outline-none focus:ring-1 focus:ring-[var(--theme-accent)]"
          >
            <option value="">All categories</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        )}
        <button
          onClick={() => setLowStockOnly(v => !v)}
          className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[12px] font-medium transition-all duration-150"
          style={lowStockOnly ? {
            borderColor: 'color-mix(in srgb, #ef4444 40%, transparent)',
            background: 'color-mix(in srgb, #ef4444 12%, var(--theme-card))',
            color: '#ef4444',
          } : {
            borderColor: 'var(--theme-border)',
            color: 'var(--theme-muted)',
          }}
        >
          <HugeiconsIcon icon={PackageOutOfStockIcon} size={13} />
          Low Stock
        </button>
        {(search || categoryFilter || lowStockOnly) && (
          <button
            onClick={() => { setSearch(''); setCategoryFilter(''); setLowStockOnly(false) }}
            className="flex items-center gap-1 text-[11px] font-medium text-[var(--theme-muted)] transition-colors hover:text-[var(--theme-text)]"
          >
            <HugeiconsIcon icon={RefreshIcon} size={11} />
            Reset
          </button>
        )}
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="space-y-2 p-6">
            <div className="h-9 animate-pulse rounded-xl" style={{ background: 'var(--theme-card)', opacity: 0.6 }} />
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="h-11 animate-pulse rounded-xl" style={{ background: 'var(--theme-card)', opacity: 0.6 }} />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 py-14 text-center">
            <span
              className="flex h-12 w-12 items-center justify-center rounded-full"
              style={{
                background: 'linear-gradient(135deg, color-mix(in srgb, var(--theme-accent) 18%, var(--theme-card)), color-mix(in srgb, #000 14%, var(--theme-card)))',
                color: 'var(--theme-accent)',
              }}
            >
              <HugeiconsIcon icon={WarehouseIcon} size={22} />
            </span>
            <p className="text-[13px] font-semibold text-[var(--theme-text)]">No items found</p>
            <p className="text-[11px] text-[var(--theme-muted)]">Adjust the filters or add your first item.</p>
            {!search && !categoryFilter && !lowStockOnly && (
              <button
                onClick={() => setModal('new')}
                className={cn(primaryBtnCls, 'mt-2')}
                style={primaryBtnStyle}
              >
                <HugeiconsIcon icon={Add01Icon} size={13} /> Add first item
              </button>
            )}
          </div>
        ) : (
          <table className="w-full text-[12px]">
            <thead className="sticky top-0 border-b border-[var(--theme-border)]" style={{ background: 'var(--theme-hover)' }}>
              <tr>
                {['SKU', 'Name', 'Category', 'On Hand', 'Reserved', 'Cost', 'Price', 'Margin', 'Location', 'Supplier', ''].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-[var(--theme-muted)]">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map(item => {
                const isLow = item.quantity_on_hand <= item.quantity_reorder_point
                const margin = marginPct(item.cost_price_cents, item.selling_price_cents)
                return (
                  <tr
                    key={item.id}
                    className="group border-b border-[var(--theme-border)] transition-colors hover:bg-[var(--theme-hover)]"
                  >
                    <td className="px-4 py-2.5"><SkuChip sku={item.sku} /></td>
                    <td className="max-w-[160px] px-4 py-2.5">
                      <p className="truncate font-medium text-[var(--theme-text)]">{item.name}</p>
                      {item.description && (
                        <p className="truncate text-[10px] text-[var(--theme-muted)]">{item.description}</p>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-[var(--theme-muted)]">{item.category ?? '—'}</td>
                    <td className="px-4 py-2.5">
                      <span
                        className={cn('inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-semibold tabular-nums', !isLow && 'text-[var(--theme-text)]')}
                        style={isLow ? {
                          background: 'color-mix(in srgb, #ef4444 12%, var(--theme-card))',
                          color: '#ef4444',
                          border: '1px solid color-mix(in srgb, #ef4444 30%, transparent)',
                        } : undefined}
                      >
                        {item.quantity_on_hand}
                        {isLow && <span className="text-[9px] font-bold uppercase">low</span>}
                      </span>
                      <span className="ml-1 text-[10px] text-[var(--theme-muted)]">{item.unit}</span>
                    </td>
                    <td className="px-4 py-2.5 tabular-nums text-[var(--theme-muted)]">{item.quantity_reserved}</td>
                    <td className="px-4 py-2.5 tabular-nums text-[var(--theme-muted)]">{fmtCents(item.cost_price_cents)}</td>
                    <td className="px-4 py-2.5 font-medium tabular-nums text-[var(--theme-text)]">{fmtCents(item.selling_price_cents)}</td>
                    <td className="px-4 py-2.5 font-semibold tabular-nums" style={{ color: marginColor(margin) }}>
                      {margin == null ? '—' : `${margin.toFixed(0)}%`}
                    </td>
                    <td className="px-4 py-2.5 text-[11px] text-[var(--theme-muted)]">{item.location ?? '—'}</td>
                    <td className="max-w-[120px] px-4 py-2.5 text-[11px] text-[var(--theme-muted)]">
                      <p className="truncate">{item.supplier_name ?? '—'}</p>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
                        <button
                          onClick={() => setAdjustItem(item)}
                          title="Adjust stock"
                          className="rounded-lg p-1.5 transition-colors hover:bg-[var(--theme-accent-soft)]"
                        >
                          <HugeiconsIcon icon={RefreshIcon} size={13} className="text-[var(--theme-accent)]" />
                        </button>
                        <button
                          onClick={() => setHistoryItem(item)}
                          title="View movements"
                          className="rounded-lg p-1.5 text-[var(--theme-muted)] transition-colors hover:bg-[var(--theme-hover)] hover:text-[var(--theme-text)]"
                        >
                          <HugeiconsIcon icon={ViewIcon} size={13} />
                        </button>
                        <button
                          onClick={() => setModal(item)}
                          title="Edit"
                          className="rounded-lg p-1.5 text-[var(--theme-muted)] transition-colors hover:bg-[var(--theme-hover)] hover:text-[var(--theme-text)]"
                        >
                          <HugeiconsIcon icon={PencilEdit02Icon} size={13} />
                        </button>
                        <button
                          onClick={() => handleDelete(item)}
                          title="Delete"
                          className="rounded-lg p-1.5 transition-colors"
                          onMouseEnter={e => { e.currentTarget.style.background = 'color-mix(in srgb, #ef4444 12%, var(--theme-card))' }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                        >
                          <HugeiconsIcon icon={Delete02Icon} size={13} className="text-red-500" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Modals */}
      {modal && (
        <ItemModal
          initial={modal === 'new' ? undefined : modal}
          onClose={() => setModal(null)}
          onSave={handleSave}
        />
      )}
      {adjustItem && (
        <AdjustModal
          item={adjustItem}
          onClose={() => setAdjustItem(null)}
          onAdjust={(qty, type, reference, notes) =>
            adjustMut.mutate({ id: adjustItem.id, qty, type, reference, notes })
          }
        />
      )}
      {historyItem && (
        <MovementsPanel
          item={historyItem}
          brand={brand.id}
          onClose={() => setHistoryItem(null)}
        />
      )}
    </div>
  )
}
