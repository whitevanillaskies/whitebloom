import { useCallback, useEffect, useState } from 'react'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import {
  $getSelection,
  $isRangeSelection,
  COMMAND_PRIORITY_LOW,
  FORMAT_TEXT_COMMAND,
  SELECTION_CHANGE_COMMAND,
} from 'lexical'
import { Bold, Italic } from 'lucide-react'
import './FormatToolbar.css'

export function FormatToolbar() {
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
    <div className="format-toolbar" data-board-capture="exclude" onMouseDown={(e) => e.preventDefault()}>
      <button
        className={`format-toolbar__btn${isBold ? ' format-toolbar__btn--active' : ''}`}
        onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'bold')}
        aria-label="Bold"
        tabIndex={-1}
      >
        <Bold size={13} strokeWidth={2.5} />
      </button>
      <button
        className={`format-toolbar__btn${isItalic ? ' format-toolbar__btn--active' : ''}`}
        onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'italic')}
        aria-label="Italic"
        tabIndex={-1}
      >
        <Italic size={13} strokeWidth={2.5} />
      </button>
    </div>
  )
}
