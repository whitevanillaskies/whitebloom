import { createPortal } from 'react-dom'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import './PetalMenu.css'

type PetalMenuActionItem = {
  id: string
  label: string
  icon?: ReactNode
  subtitle?: string
  hint?: string
  intent?: 'default' | 'destructive'
  onActivate: () => void
  disabled?: boolean
}

type PetalMenuSeparatorItem = {
  id: string
  type: 'separator'
}

export type PetalMenuItem = PetalMenuActionItem | PetalMenuSeparatorItem

type PetalMenuProps = {
  items: PetalMenuItem[]
  anchor: { x: number; y: number }
  onClose: () => void
}

const VIEWPORT_PADDING = 10

function isActionItem(item: PetalMenuItem): item is PetalMenuActionItem {
  return !('type' in item)
}

function getFirstEnabledIndex(items: PetalMenuItem[]): number {
  return items.findIndex((item) => isActionItem(item) && !item.disabled)
}

function getNextEnabledIndex(
  items: PetalMenuItem[],
  startIndex: number,
  direction: 1 | -1
): number {
  if (items.length === 0) return -1

  for (let offset = 1; offset <= items.length; offset += 1) {
    const index = (startIndex + offset * direction + items.length) % items.length
    const item = items[index]
    if (isActionItem(item) && !item.disabled) return index
  }

  return -1
}

export default function PetalMenu({ items, anchor, onClose }: PetalMenuProps) {
  const { t } = useTranslation()
  const menuRef = useRef<HTMLDivElement>(null)
  const [activeIndex, setActiveIndex] = useState(() => getFirstEnabledIndex(items))
  const [position, setPosition] = useState(anchor)

  const hasActions = useMemo(
    () => items.some((item) => isActionItem(item) && !item.disabled),
    [items]
  )

  const activate = useCallback(
    (item: PetalMenuActionItem) => {
      if (item.disabled) return
      item.onActivate()
      onClose()
    },
    [onClose]
  )

  useEffect(() => {
    setActiveIndex(getFirstEnabledIndex(items))
  }, [items])

  useLayoutEffect(() => {
    const menu = menuRef.current
    if (!menu) {
      setPosition(anchor)
      return
    }

    const rect = menu.getBoundingClientRect()
    const maxX = Math.max(VIEWPORT_PADDING, window.innerWidth - rect.width - VIEWPORT_PADDING)
    const maxY = Math.max(VIEWPORT_PADDING, window.innerHeight - rect.height - VIEWPORT_PADDING)

    setPosition({
      x: Math.min(Math.max(anchor.x, VIEWPORT_PADDING), maxX),
      y: Math.min(Math.max(anchor.y, VIEWPORT_PADDING), maxY)
    })
  }, [anchor, items])

  // Keyboard: Escape closes, arrows navigate, Enter activates.
  // Capture phase so this fires before Canvas.tsx's bubble-phase window listener.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopImmediatePropagation()
        onClose()
        return
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        if (!hasActions) return
        setActiveIndex((i) => getNextEnabledIndex(items, i < 0 ? items.length - 1 : i, 1))
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        if (!hasActions) return
        setActiveIndex((i) => getNextEnabledIndex(items, i < 0 ? 0 : i, -1))
        return
      }
      if (e.key === 'Enter') {
        e.preventDefault()
        const item = items[activeIndex]
        if (item && isActionItem(item)) activate(item)
      }
    }

    document.addEventListener('keydown', onKeyDown, true)
    return () => document.removeEventListener('keydown', onKeyDown, true)
  }, [items, activeIndex, activate, hasActions, onClose])

  // Dismiss on pointer down outside the menu
  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    const onWindowBlur = () => onClose()
    const onViewportChange = () => onClose()
    document.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('blur', onWindowBlur)
    window.addEventListener('resize', onViewportChange)
    window.addEventListener('scroll', onViewportChange, true)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('blur', onWindowBlur)
      window.removeEventListener('resize', onViewportChange)
      window.removeEventListener('scroll', onViewportChange, true)
    }
  }, [onClose])

  return createPortal(
    <div
      ref={menuRef}
      className="petal-menu"
      style={{ top: position.y, left: position.x }}
      role="menu"
      aria-orientation="vertical"
      // Portaled menu events still bubble through the React tree, so fence them
      // off here before desktop/bin drag handlers can treat a menu click as a drag.
      onPointerDown={(e) => e.stopPropagation()}
      onPointerUp={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.preventDefault()}
    >
      {items.length === 0 ? (
        <div className="petal-menu__empty">{t('petalMenu.empty')}</div>
      ) : (
        items.map((item, i) => (
          isActionItem(item) ? (
            <button
              key={item.id}
              className={[
                'petal-menu__item',
                i === activeIndex ? 'petal-menu__item--active' : '',
                item.intent === 'destructive' ? 'petal-menu__item--destructive' : ''
              ]
                .filter(Boolean)
                .join(' ')}
              role="menuitem"
              aria-disabled={item.disabled ? 'true' : undefined}
              onClick={() => activate(item)}
              onMouseEnter={() => {
                if (!item.disabled) setActiveIndex(i)
              }}
              tabIndex={-1}
              disabled={item.disabled}
            >
              {item.icon && <span className="petal-menu__item-icon">{item.icon}</span>}
              <span className="petal-menu__item-copy">
                <span className="petal-menu__item-label">{item.label}</span>
                {item.subtitle ? (
                  <span className="petal-menu__item-subtitle">{item.subtitle}</span>
                ) : null}
              </span>
              {item.hint ? <span className="petal-menu__item-hint">{item.hint}</span> : null}
            </button>
          ) : (
            <div key={item.id} className="petal-menu__separator" role="separator" />
          )
        ))
      )}
    </div>,
    document.body
  )
}
