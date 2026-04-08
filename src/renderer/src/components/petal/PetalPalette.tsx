import { createPortal } from 'react-dom'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import './PetalPalette.css'

export type PaletteMode = {
  id: string
  items: PaletteItem[]
  placeholder?: string
  emptyLabel?: string
}

export type PaletteInputMode = {
  id: string
  type: 'input'
  placeholder?: string
  submitLabel?: string
  initialValue?: string
  onSubmit: (value: string) => PaletteActivation | void
}

type PaletteListMode = {
  id: string
  type?: 'list'
  items: PaletteItem[]
  placeholder?: string
  emptyLabel?: string
}

type PaletteAnyMode = PaletteListMode | PaletteInputMode

export type PaletteActivation =
  | { type: 'close' }
  | { type: 'keep-open' }
  | { type: 'set-mode'; mode: PaletteAnyMode }

export type PaletteItem = {
  id: string
  label: string
  subtitle?: string
  icon?: ReactNode
  /** Keyboard shortcut badge shown on the right, e.g. "T" or "⌘S" */
  hint?: string
  onActivate: () => PaletteActivation | void
}

type PetalPaletteProps = {
  items: PaletteItem[]
  onClose: () => void
  placeholder?: string
}

const MAX_VISIBLE_ITEMS = 8
const ITEM_HEIGHT_PX = 36

export default function PetalPalette({ items, onClose, placeholder }: PetalPaletteProps) {
  const { t } = useTranslation()
  const initialMode = useMemo<PaletteListMode>(
    () => ({
      id: 'root',
      type: 'list',
      items,
      placeholder
    }),
    [items, placeholder]
  )
  const [mode, setMode] = useState<PaletteAnyMode>(initialMode)
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setMode(initialMode)
  }, [initialMode])

  const closePalette = useCallback(() => {
    setMode(initialMode)
    setQuery('')
    setActiveIndex(0)
    onClose()
  }, [initialMode, onClose])

  const filtered = useMemo(() => {
    if (mode.type === 'input') return []
    const q = query.trim().toLowerCase()
    if (!q) return mode.items
    return mode.items.filter((item) => item.label.toLowerCase().includes(q))
  }, [mode, query])

  // Reset active index when filtered list changes
  useEffect(() => {
    setActiveIndex(0)
  }, [filtered.length])

  useEffect(() => {
    setQuery(mode.type === 'input' ? (mode.initialValue ?? '') : '')
    setActiveIndex(0)
  }, [mode])

  // Scroll active item into view
  useEffect(() => {
    const list = listRef.current
    if (!list) return
    const activeEl = list.children[activeIndex] as HTMLElement | undefined
    activeEl?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex])

  const activate = useCallback(
    (item: PaletteItem) => {
      const result = item.onActivate()

      if (!result || result.type === 'close') {
        closePalette()
        return
      }

      if (result.type === 'keep-open') {
        return
      }

      setMode(result.mode)
    },
    [closePalette, setMode]
  )

  const submitInputMode = useCallback(() => {
    if (mode.type !== 'input') return

    const result = mode.onSubmit(query)
    if (!result || result.type === 'close') {
      closePalette()
      return
    }

    if (result.type === 'keep-open') {
      return
    }

    setMode(result.mode)
  }, [closePalette, mode, query])

  // Keyboard — capture phase so it fires before Canvas bubble-phase listeners
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopImmediatePropagation()
        closePalette()
        return
      }

      // Tab toggles closed (caller handles open)
      if (e.key === 'Tab') {
        e.preventDefault()
        e.stopImmediatePropagation()
        closePalette()
        return
      }

      if (e.key === 'ArrowDown') {
        if (mode.type === 'input') return
        e.preventDefault()
        setActiveIndex((i) => (i + 1) % Math.max(1, filtered.length))
        return
      }

      if (e.key === 'ArrowUp') {
        if (mode.type === 'input') return
        e.preventDefault()
        setActiveIndex((i) => (i - 1 + Math.max(1, filtered.length)) % Math.max(1, filtered.length))
        return
      }

      if (e.key === 'Enter') {
        e.preventDefault()
        if (mode.type === 'input') {
          submitInputMode()
          return
        }
        const item = filtered[activeIndex]
        if (item) activate(item)
      }
    }

    document.addEventListener('keydown', onKeyDown, true)
    return () => document.removeEventListener('keydown', onKeyDown, true)
  }, [filtered, activeIndex, activate, closePalette, mode.type, submitInputMode])

  // Dismiss on pointer down outside
  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        closePalette()
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [closePalette])

  // Auto-focus input on mount
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const listMaxHeight = MAX_VISIBLE_ITEMS * ITEM_HEIGHT_PX

  return createPortal(
    <div className="petal-palette__backdrop">
      <div
        ref={containerRef}
        className="petal-palette"
        role="dialog"
        aria-modal="true"
        aria-label={t('petalPalette.ariaLabel')}
        onMouseDown={(e) => e.preventDefault()}
      >
        <div className="petal-palette__search">
          <input
            ref={inputRef}
            className="petal-palette__input"
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={mode.placeholder ?? t('petalPalette.searchPlaceholder')}
            autoComplete="off"
            spellCheck={false}
          />
        </div>

        {mode.type === 'input' ? (
          <div className="petal-palette__submit-wrap">
            <button
              type="button"
              className="petal-palette__submit"
              onClick={submitInputMode}
            >
              {mode.submitLabel ?? 'Submit'}
            </button>
          </div>
        ) : (
          <div
            ref={listRef}
            className="petal-palette__list"
            style={{ maxHeight: listMaxHeight }}
            role="listbox"
          >
            {filtered.length === 0 ? (
              <div className="petal-palette__empty">{mode.emptyLabel ?? t('petalPalette.noResults')}</div>
            ) : (
              filtered.map((item, i) => (
                <button
                  key={item.id}
                  className={[
                    'petal-palette__item',
                    i === activeIndex ? 'petal-palette__item--active' : ''
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  role="option"
                  aria-selected={i === activeIndex}
                  onClick={() => activate(item)}
                  onMouseEnter={() => setActiveIndex(i)}
                  tabIndex={-1}
                >
                  {item.icon && (
                    <span className="petal-palette__item-icon">{item.icon}</span>
                  )}
                  <span className="petal-palette__item-copy">
                    <span className="petal-palette__item-label">{item.label}</span>
                    {item.subtitle ? (
                      <span className="petal-palette__item-subtitle">{item.subtitle}</span>
                    ) : null}
                  </span>
                  {item.hint && (
                    <span className="petal-palette__item-hint">{item.hint}</span>
                  )}
                </button>
              ))
            )}
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}
