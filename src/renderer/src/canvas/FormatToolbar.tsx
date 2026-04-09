import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import {
  $getSelection,
  $isRangeSelection,
  COMMAND_PRIORITY_LOW,
  FORMAT_TEXT_COMMAND,
  SELECTION_CHANGE_COMMAND,
} from 'lexical'
import { Bold, Italic } from 'lucide-react'
import { CanvasToolbar, CanvasToolbarBtn } from './CanvasToolbar'

export function FormatToolbar() {
  const { t } = useTranslation()
  const [editor] = useLexicalComposerContext()
  const [isBold, setIsBold] = useState(false)
  const [isItalic, setIsItalic] = useState(false)

  const syncFormats = useCallback(() => {
    editor.getEditorState().read(() => {
      const selection = $getSelection()
      if (!$isRangeSelection(selection)) {
        setIsBold(false)
        setIsItalic(false)
        return
      }
      setIsBold(selection.hasFormat('bold'))
      setIsItalic(selection.hasFormat('italic'))
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
    </CanvasToolbar>
  )
}
