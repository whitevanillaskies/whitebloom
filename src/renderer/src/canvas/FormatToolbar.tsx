import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import {
  $getSelection,
  $isRangeSelection,
  COMMAND_PRIORITY_LOW,
  FORMAT_TEXT_COMMAND,
  SELECTION_CHANGE_COMMAND,
} from 'lexical'
import { $getSelectionStyleValueForProperty } from '@lexical/selection'
import { Bold, Italic } from 'lucide-react'
import { CanvasToolbar, CanvasToolbarBtn, CanvasToolbarSep, CanvasToolbarSwatch, useCanvasToolbarPopover } from './CanvasToolbar'
import { CanvasPopover } from './CanvasPopover'
import { WHITEBLOOM_DEFAULT_PALETTE, type PaletteSwatch } from './palette'
import { TEXT_COLOR_COMMAND } from './textEditorCommands'

// ── Text color control ────────────────────────────────────────────────────────

type TextColorControlProps = {
  selectionColor: string
}

function TextColorControl({ selectionColor }: TextColorControlProps) {
  const { t } = useTranslation()
  const [editor] = useLexicalComposerContext()
  const popoverId = useId()
  const { open, setOpen } = useCanvasToolbarPopover(popoverId)
  const controlRef = useRef<HTMLDivElement>(null)
  const colorInputRef = useRef<HTMLInputElement>(null)

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handle = (e: MouseEvent) => {
      if (controlRef.current && !controlRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [open, setOpen])

  // Close on Escape
  useEffect(() => {
    if (!open) return
    const handle = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('keydown', handle)
    return () => document.removeEventListener('keydown', handle)
  }, [open, setOpen])

  function applyColor(cssColor: string) {
    editor.dispatchCommand(TEXT_COLOR_COMMAND, cssColor)
  }

  function isSwatchActive(swatch: PaletteSwatch): boolean {
    return !!selectionColor && selectionColor.toLowerCase() === swatch.value.toLowerCase()
  }

  // The swatch shows the active selection color, falling back to the foreground token
  const displayColor = selectionColor || 'var(--color-primary-fg)'

  // Convert raw CSS color to a hex value for the native color input
  function toInputHex(): string {
    if (!selectionColor || selectionColor.startsWith('var(')) return '#2b2b2b'
    return selectionColor.startsWith('#') ? selectionColor : '#2b2b2b'
  }

  const palette = WHITEBLOOM_DEFAULT_PALETTE

  return (
    <div className="canvas-control" ref={controlRef}>
      <CanvasToolbarBtn
        aria-label={t('formatToolbar.textColorLabel')}
        popoverId={popoverId}
        active={open}
      >
        <CanvasToolbarSwatch color={displayColor} />
      </CanvasToolbarBtn>

      {open && (
        <CanvasPopover anchorRef={controlRef} className="canvas-color-picker">
          <div className="canvas-color-picker__palette-name">{palette.name}</div>

          <div className="canvas-color-picker__swatches">
            {palette.swatches.map((swatch) => (
              <button
                key={swatch.id}
                type="button"
                tabIndex={-1}
                className={`canvas-color-picker__swatch${isSwatchActive(swatch) ? ' canvas-color-picker__swatch--selected' : ''}`}
                style={{ backgroundColor: swatch.value }}
                aria-label={swatch.label}
                title={swatch.label}
                onClick={() => applyColor(swatch.value)}
              />
            ))}
          </div>

          <div className="canvas-popover__sep" />

          {/* Clear inline color — restores inherited/default text color */}
          <button
            type="button"
            className="canvas-color-picker__option"
            onClick={() => applyColor('')}
          >
            <CanvasToolbarSwatch color="var(--color-primary-fg)" />
            <span className="canvas-color-picker__custom-label">{t('formatToolbar.textColorDefault')}</span>
          </button>

          <div className="canvas-popover__sep" />

          <div
            className="canvas-color-picker__option"
            onClick={() => colorInputRef.current?.click()}
          >
            <input
              ref={colorInputRef}
              type="color"
              className="canvas-color-picker__custom-input"
              value={toInputHex()}
              onChange={(e) => applyColor(e.target.value)}
              tabIndex={-1}
            />
            <span className="canvas-color-picker__custom-label">Custom</span>
          </div>
        </CanvasPopover>
      )}
    </div>
  )
}

// ── FormatToolbar ─────────────────────────────────────────────────────────────

export function FormatToolbar() {
  const { t } = useTranslation()
  const [editor] = useLexicalComposerContext()
  const [isBold, setIsBold] = useState(false)
  const [isItalic, setIsItalic] = useState(false)
  const [selectionColor, setSelectionColor] = useState('')

  const syncFormats = useCallback(() => {
    editor.getEditorState().read(() => {
      const selection = $getSelection()
      if (!$isRangeSelection(selection)) {
        setIsBold(false)
        setIsItalic(false)
        setSelectionColor('')
        return
      }
      setIsBold(selection.hasFormat('bold'))
      setIsItalic(selection.hasFormat('italic'))
      setSelectionColor($getSelectionStyleValueForProperty(selection, 'color', ''))
    })
  }, [editor])

  useEffect(() => {
    return editor.registerCommand(
      SELECTION_CHANGE_COMMAND,
      () => {
        syncFormats()
        return false
      },
      COMMAND_PRIORITY_LOW
    )
  }, [editor, syncFormats])

  return (
    <CanvasToolbar onMouseDown={(e) => e.preventDefault()}>
      <CanvasToolbarBtn
        active={isBold}
        onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'bold')}
        aria-label={t('formatToolbar.boldLabel')}
      >
        <Bold size={13} strokeWidth={2.5} />
      </CanvasToolbarBtn>
      <CanvasToolbarBtn
        active={isItalic}
        onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'italic')}
        aria-label={t('formatToolbar.italicLabel')}
      >
        <Italic size={13} strokeWidth={2.5} />
      </CanvasToolbarBtn>
      <CanvasToolbarSep />
      <TextColorControl selectionColor={selectionColor} />
    </CanvasToolbar>
  )
}
