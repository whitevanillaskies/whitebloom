import { createPortal } from 'react-dom'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import './PetalMenu.css'

export type PetalMenuItem = {
  id: string
  label: string
  icon?: ReactNode
  intent?: 'default' | 'destructive'
  onActivate: () => void
  disabled?: boolean
}

type PetalMenuProps = {
  items: PetalMenuItem[]
  anchor: { x: number; y: number }
  onClose: () => void
}

export default function PetalMenu({ items, anchor, onClose }: PetalMenuProps) {
  const { t } = useTranslation()
  const menuRef = useRef<HTMLDivElement>(null)
  const [activeIndex, setActiveIndex] = useState(0)

  const activate = useCallback(
    (item: PetalMenuItem) => {
      if (item.disabled) return
      item.onActivate()
      onClose()
    },
    [onClose]
  )

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
        setActiveIndex((i) => (i + 1) % Math.max(1, items.length))
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActiveIndex((i) => (i - 1 + Math.max(1, items.length)) % Math.max(1, items.length))
        return
      }
      if (e.key === 'Enter') {
        e.preventDefault()
        const item = items[activeIndex]
        if (item) activate(item)
      }
    }

    document.addEventListener('keydown', onKeyDown, true)
    return () => document.removeEventListener('keydown', onKeyDown, true)
  }, [items, activeIndex, activate, onClose])

  // Dismiss on pointer down outside the menu
  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [onClose])

  return createPortal(
    <div
      ref={menuRef}
      className="petal-menu"
      style={{ top: anchor.y, left: anchor.x }}
      onMouseDown={(e) => e.preventDefault()}
    >
      {items.length === 0 ? (
        <div className="petal-menu__empty">{t('petalMenu.empty')}</div>
      ) : (
        items.map((item, i) => (
          <button
            key={item.id}
            className={[
              'petal-menu__item',
              i === activeIndex ? 'petal-menu__item--active' : '',
              item.intent === 'destructive' ? 'petal-menu__item--destructive' : ''
            ]
              .filter(Boolean)
              .join(' ')}
            onClick={() => activate(item)}
            onMouseEnter={() => setActiveIndex(i)}
            tabIndex={-1}
            disabled={item.disabled}
          >
            {item.icon && <span className="petal-menu__item-icon">{item.icon}</span>}
            {item.label}
          </button>
        ))
      )}
    </div>,
    document.body
  )
}
