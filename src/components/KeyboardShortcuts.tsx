/**
 * Keyboard shortcuts cheat-sheet.
 * Open with Shift+? globally. Also callable from the command palette.
 */
import { useEffect } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import { Cancel01Icon, KeyboardIcon } from '@hugeicons/core-free-icons'

type Shortcut = { keys: string[]; description: string }
type Section = { title: string; shortcuts: Shortcut[] }

const SECTIONS: Section[] = [
  {
    title: 'Navigation',
    shortcuts: [
      { keys: ['⌘', 'K'], description: 'Open command palette' },
      { keys: ['Shift', '?'], description: 'Show this shortcut guide' },
      { keys: ['Esc'], description: 'Close any modal or panel' },
    ],
  },
  {
    title: 'Contacts',
    shortcuts: [
      { keys: ['N'], description: 'New contact (when on Contacts screen)' },
      { keys: ['I'], description: 'Import CSV (when on Contacts screen)' },
      { keys: ['F'], description: 'Focus search bar' },
    ],
  },
  {
    title: 'Conversations',
    shortcuts: [
      { keys: ['↓', '↑'], description: 'Navigate thread list' },
      { keys: ['Enter'], description: 'Open selected thread' },
      { keys: ['⌘', 'Enter'], description: 'Send reply' },
    ],
  },
  {
    title: 'Global',
    shortcuts: [
      { keys: ['⌘', '/'], description: 'Focus sidebar search' },
      { keys: ['⌘', 'Shift', 'N'], description: 'New conversation' },
      { keys: ['⌘', 'B'], description: 'Toggle sidebar (mobile)' },
    ],
  },
]

function Key({ label }: { label: string }) {
  return (
    <kbd className="inline-flex min-w-[22px] items-center justify-center rounded border border-[var(--theme-border)] bg-[var(--theme-hover)] px-1.5 py-0.5 font-mono text-[10px] font-medium text-[var(--theme-text)] shadow-sm">
      {label}
    </kbd>
  )
}

export function KeyboardShortcutsModal({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-2xl border border-[var(--theme-border)] shadow-2xl"
        style={{ background: 'var(--theme-card)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--theme-border)] px-5 py-3">
          <div className="flex items-center gap-2">
            <HugeiconsIcon icon={KeyboardIcon} size={16} className="text-[var(--theme-accent)]" />
            <h2 className="text-sm font-semibold text-[var(--theme-text)]">Keyboard Shortcuts</h2>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-[var(--theme-hover)]">
            <HugeiconsIcon icon={Cancel01Icon} size={14} className="text-[var(--theme-muted)]" />
          </button>
        </div>

        {/* Sections */}
        <div className="max-h-[70vh] overflow-y-auto p-5">
          <div className="grid gap-6 sm:grid-cols-2">
            {SECTIONS.map(section => (
              <div key={section.title}>
                <h3 className="mb-2.5 text-[10px] font-semibold uppercase tracking-widest text-[var(--theme-muted)]">
                  {section.title}
                </h3>
                <div className="space-y-1.5">
                  {section.shortcuts.map((s, i) => (
                    <div key={i} className="flex items-center justify-between gap-4">
                      <span className="text-[12px] text-[var(--theme-text)]">{s.description}</span>
                      <div className="flex shrink-0 items-center gap-1">
                        {s.keys.map((k, j) => (
                          <span key={j} className="flex items-center gap-1">
                            <Key label={k} />
                            {j < s.keys.length - 1 && (
                              <span className="text-[10px] text-[var(--theme-muted)]">+</span>
                            )}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-[var(--theme-border)] px-5 py-2.5">
          <span className="text-[10px] text-[var(--theme-muted)]">
            Press <Key label="Shift" /> + <Key label="?" /> anytime to show this
          </span>
          <span className="text-[10px] text-[var(--theme-muted)]">
            <Key label="Esc" /> to close
          </span>
        </div>
      </div>
    </div>
  )
}

/** Hook — listens globally for Shift+? */
export function useKeyboardShortcuts() {
  return { open: false } // state managed in __root.tsx
}
