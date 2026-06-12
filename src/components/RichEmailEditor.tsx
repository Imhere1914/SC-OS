import { useRef, useEffect, useCallback, useState } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  TextBoldIcon,
  TextItalicIcon,
  TextUnderlineIcon,
  LeftToRightListBulletIcon,
  LeftToRightListNumberIcon,
  TextAlignLeftIcon,
  TextAlignCenterIcon,
  TextAlignRightIcon,
  Link01Icon,
  Unlink01Icon,
  TextClearIcon,
  ArrowDown01Icon,
} from '@hugeicons/core-free-icons'

interface RichEmailEditorProps {
  value: string
  onChange: (html: string) => void
  placeholder?: string
  minHeight?: number
}

const VARIABLES = [
  '{{contact_name}}',
  '{{first_name}}',
  '{{brand_name}}',
  '{{current_date}}',
]

const FORMAT_OPTIONS = [
  { label: 'Paragraph', value: 'p' },
  { label: 'Heading 1', value: 'h1' },
  { label: 'Heading 2', value: 'h2' },
]

function ToolbarButton({
  onClick,
  active,
  title,
  children,
}: {
  onClick: () => void
  active?: boolean
  title: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => {
        e.preventDefault()
        onClick()
      }}
      title={title}
      className="flex h-6 w-6 items-center justify-center rounded transition-colors"
      style={{
        background: active ? 'var(--theme-accent-soft)' : 'transparent',
        color: active ? 'var(--theme-accent)' : 'var(--theme-muted)',
      }}
      onMouseEnter={(e) => {
        if (!active) {
          ;(e.currentTarget as HTMLButtonElement).style.background =
            'var(--theme-hover)'
        }
      }}
      onMouseLeave={(e) => {
        if (!active) {
          ;(e.currentTarget as HTMLButtonElement).style.background = 'transparent'
        }
      }}
    >
      {children}
    </button>
  )
}

function Divider() {
  return (
    <span
      className="mx-0.5 h-4 w-px shrink-0"
      style={{ background: 'var(--theme-border)' }}
    />
  )
}

export function RichEmailEditor({
  value,
  onChange,
  placeholder = 'Write your email body here…',
  minHeight = 200,
}: RichEmailEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null)
  const isInternalChange = useRef(false)
  const [activeStates, setActiveStates] = useState({
    bold: false,
    italic: false,
    underline: false,
    justifyLeft: false,
    justifyCenter: false,
    justifyRight: false,
    insertUnorderedList: false,
    insertOrderedList: false,
  })
  const [showVarDropdown, setShowVarDropdown] = useState(false)
  const [showFormatDropdown, setShowFormatDropdown] = useState(false)
  const [currentBlock, setCurrentBlock] = useState('p')
  const varDropdownRef = useRef<HTMLDivElement>(null)
  const formatDropdownRef = useRef<HTMLDivElement>(null)

  // Sync external value → editor DOM (only when not caused by internal input)
  useEffect(() => {
    const el = editorRef.current
    if (!el) return
    if (isInternalChange.current) {
      isInternalChange.current = false
      return
    }
    if (el.innerHTML !== value) {
      el.innerHTML = value
    }
  }, [value])

  const emitChange = useCallback(() => {
    const el = editorRef.current
    if (!el) return
    isInternalChange.current = true
    onChange(el.innerHTML)
  }, [onChange])

  const refreshActiveStates = useCallback(() => {
    try {
      setActiveStates({
        bold: document.queryCommandState('bold'),
        italic: document.queryCommandState('italic'),
        underline: document.queryCommandState('underline'),
        justifyLeft: document.queryCommandState('justifyLeft'),
        justifyCenter: document.queryCommandState('justifyCenter'),
        justifyRight: document.queryCommandState('justifyRight'),
        insertUnorderedList: document.queryCommandState('insertUnorderedList'),
        insertOrderedList: document.queryCommandState('insertOrderedList'),
      })
      // Detect current block format
      const block = document.queryCommandValue('formatBlock')
      setCurrentBlock(block || 'p')
    } catch {
      // ignore
    }
  }, [])

  const exec = useCallback(
    (command: string, value?: string) => {
      editorRef.current?.focus()
      document.execCommand(command, false, value)
      refreshActiveStates()
      emitChange()
    },
    [refreshActiveStates, emitChange],
  )

  const handleLink = useCallback(() => {
    const url = window.prompt('Enter URL:', 'https://')
    if (url) exec('createLink', url)
  }, [exec])

  const insertVariable = useCallback(
    (v: string) => {
      editorRef.current?.focus()
      document.execCommand('insertText', false, v)
      refreshActiveStates()
      emitChange()
      setShowVarDropdown(false)
    },
    [refreshActiveStates, emitChange],
  )

  const applyFormat = useCallback(
    (tag: string) => {
      exec('formatBlock', tag)
      setShowFormatDropdown(false)
    },
    [exec],
  )

  // Close dropdowns on outside click
  useEffect(() => {
    const handle = (e: MouseEvent) => {
      if (
        varDropdownRef.current &&
        !varDropdownRef.current.contains(e.target as Node)
      ) {
        setShowVarDropdown(false)
      }
      if (
        formatDropdownRef.current &&
        !formatDropdownRef.current.contains(e.target as Node)
      ) {
        setShowFormatDropdown(false)
      }
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  const currentFormatLabel =
    FORMAT_OPTIONS.find((f) => f.value === currentBlock)?.label ?? 'Paragraph'

  const isEmpty =
    !value || value === '' || value === '<br>' || value === '<p><br></p>'

  return (
    <div
      className="rounded-xl border border-[var(--theme-border)]"
      style={{ background: 'var(--theme-hover)' }}
    >
      {/* Toolbar */}
      <div
        className="flex flex-wrap items-center gap-0.5 rounded-t-xl border-b border-[var(--theme-border)] px-2 py-1.5"
        style={{ background: 'var(--theme-card)' }}
      >
        {/* Bold / Italic / Underline */}
        <ToolbarButton
          onClick={() => exec('bold')}
          active={activeStates.bold}
          title="Bold"
        >
          <HugeiconsIcon icon={TextBoldIcon} size={13} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => exec('italic')}
          active={activeStates.italic}
          title="Italic"
        >
          <HugeiconsIcon icon={TextItalicIcon} size={13} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => exec('underline')}
          active={activeStates.underline}
          title="Underline"
        >
          <HugeiconsIcon icon={TextUnderlineIcon} size={13} />
        </ToolbarButton>

        <Divider />

        {/* Block format dropdown */}
        <div className="relative" ref={formatDropdownRef}>
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault()
              setShowFormatDropdown((v) => !v)
              setShowVarDropdown(false)
            }}
            className="flex h-6 items-center gap-0.5 rounded px-1.5 text-[10px] font-medium transition-colors"
            style={{ color: 'var(--theme-muted)' }}
            onMouseEnter={(e) => {
              ;(e.currentTarget as HTMLButtonElement).style.background =
                'var(--theme-hover)'
            }}
            onMouseLeave={(e) => {
              ;(e.currentTarget as HTMLButtonElement).style.background = 'transparent'
            }}
            title="Paragraph format"
          >
            {currentFormatLabel}
            <HugeiconsIcon icon={ArrowDown01Icon} size={10} />
          </button>
          {showFormatDropdown && (
            <div
              className="absolute left-0 top-full z-50 mt-1 min-w-[110px] overflow-hidden rounded-lg border border-[var(--theme-border)] shadow-lg"
              style={{ background: 'var(--theme-card)' }}
            >
              {FORMAT_OPTIONS.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault()
                    applyFormat(f.value)
                  }}
                  className="block w-full px-3 py-1.5 text-left text-xs transition-colors"
                  style={{
                    color:
                      currentBlock === f.value
                        ? 'var(--theme-accent)'
                        : 'var(--theme-text)',
                    background:
                      currentBlock === f.value
                        ? 'var(--theme-accent-soft)'
                        : 'transparent',
                    fontWeight: f.value === 'h1' ? 700 : f.value === 'h2' ? 600 : 400,
                    fontSize: f.value === 'h1' ? '13px' : f.value === 'h2' ? '12px' : '11px',
                  }}
                  onMouseEnter={(e) => {
                    if (currentBlock !== f.value) {
                      (e.currentTarget as HTMLButtonElement).style.background = 'var(--theme-hover)'
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (currentBlock !== f.value) {
                      (e.currentTarget as HTMLButtonElement).style.background =
                        currentBlock === f.value ? 'var(--theme-accent-soft)' : 'transparent'
                    }
                  }}
                >
                  {f.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <Divider />

        {/* Lists */}
        <ToolbarButton
          onClick={() => exec('insertUnorderedList')}
          active={activeStates.insertUnorderedList}
          title="Bullet list"
        >
          <HugeiconsIcon icon={LeftToRightListBulletIcon} size={13} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => exec('insertOrderedList')}
          active={activeStates.insertOrderedList}
          title="Ordered list"
        >
          <HugeiconsIcon icon={LeftToRightListNumberIcon} size={13} />
        </ToolbarButton>

        <Divider />

        {/* Alignment */}
        <ToolbarButton
          onClick={() => exec('justifyLeft')}
          active={activeStates.justifyLeft}
          title="Align left"
        >
          <HugeiconsIcon icon={TextAlignLeftIcon} size={13} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => exec('justifyCenter')}
          active={activeStates.justifyCenter}
          title="Align center"
        >
          <HugeiconsIcon icon={TextAlignCenterIcon} size={13} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => exec('justifyRight')}
          active={activeStates.justifyRight}
          title="Align right"
        >
          <HugeiconsIcon icon={TextAlignRightIcon} size={13} />
        </ToolbarButton>

        <Divider />

        {/* Link / Unlink */}
        <ToolbarButton onClick={handleLink} title="Insert link">
          <HugeiconsIcon icon={Link01Icon} size={13} />
        </ToolbarButton>
        <ToolbarButton onClick={() => exec('unlink')} title="Remove link">
          <HugeiconsIcon icon={Unlink01Icon} size={13} />
        </ToolbarButton>

        <Divider />

        {/* Clear formatting */}
        <ToolbarButton onClick={() => exec('removeFormat')} title="Clear formatting">
          <HugeiconsIcon icon={TextClearIcon} size={13} />
        </ToolbarButton>

        <Divider />

        {/* Variable inserter */}
        <div className="relative" ref={varDropdownRef}>
          <button
            type="button"
            onMouseDown={(e) => {
              e.preventDefault()
              setShowVarDropdown((v) => !v)
              setShowFormatDropdown(false)
            }}
            className="flex h-6 items-center gap-0.5 rounded px-1.5 font-mono text-[10px] transition-colors"
            style={{ color: 'var(--theme-accent)' }}
            onMouseEnter={(e) => {
              ;(e.currentTarget as HTMLButtonElement).style.background =
                'var(--theme-accent-soft)'
            }}
            onMouseLeave={(e) => {
              ;(e.currentTarget as HTMLButtonElement).style.background = 'transparent'
            }}
            title="Insert variable"
          >
            {'{{…}}'}
            <HugeiconsIcon icon={ArrowDown01Icon} size={10} />
          </button>
          {showVarDropdown && (
            <div
              className="absolute right-0 top-full z-50 mt-1 min-w-[160px] overflow-hidden rounded-lg border border-[var(--theme-border)] shadow-lg"
              style={{ background: 'var(--theme-card)' }}
            >
              {VARIABLES.map((v) => (
                <button
                  key={v}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault()
                    insertVariable(v)
                  }}
                  className="block w-full px-3 py-1.5 text-left font-mono text-[10px] transition-colors"
                  style={{ color: 'var(--theme-accent)' }}
                  onMouseEnter={(e) => {
                    ;(e.currentTarget as HTMLButtonElement).style.background =
                      'var(--theme-accent-soft)'
                  }}
                  onMouseLeave={(e) => {
                    ;(e.currentTarget as HTMLButtonElement).style.background =
                      'transparent'
                  }}
                >
                  {v}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Editable area */}
      <div className="relative">
        {isEmpty && (
          <div
            className="pointer-events-none absolute left-3 top-3 text-sm"
            style={{ color: 'var(--theme-muted)', opacity: 0.6 }}
          >
            {placeholder}
          </div>
        )}
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          onInput={emitChange}
          onKeyUp={refreshActiveStates}
          onMouseUp={refreshActiveStates}
          onFocus={refreshActiveStates}
          style={{ minHeight, color: 'var(--theme-text)' }}
          className="rich-email-editor w-full rounded-b-xl px-3 py-3 text-sm focus:outline-none"
        />
      </div>

      {/* Editor styles */}
      <style>{`
        .rich-email-editor p { margin: 0 0 8px 0; }
        .rich-email-editor h1 { font-size: 1.4em; font-weight: 700; margin: 0 0 8px 0; }
        .rich-email-editor h2 { font-size: 1.2em; font-weight: 600; margin: 0 0 8px 0; }
        .rich-email-editor ul { list-style: disc; padding-left: 1.5em; margin: 0 0 8px 0; }
        .rich-email-editor ol { list-style: decimal; padding-left: 1.5em; margin: 0 0 8px 0; }
        .rich-email-editor a { color: var(--theme-accent); text-decoration: underline; }
        .rich-email-editor:focus { outline: none; }
      `}</style>
    </div>
  )
}
