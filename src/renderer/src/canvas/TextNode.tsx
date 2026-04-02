import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Handle, NodeToolbar, Position, type NodeProps } from '@xyflow/react'
import { useBoardStore } from '@renderer/stores/board'
import type { WidthMode } from '@renderer/shared/types'
import { LexicalComposer } from '@lexical/react/LexicalComposer'
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin'
import { ContentEditable } from '@lexical/react/LexicalContentEditable'
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary'
import { KEY_DOWN_COMMAND, COMMAND_PRIORITY_EDITOR } from 'lexical'
import './TextNode.css'

type TextNodeData = {
  content: string // Lexical EditorState JSON
  widthMode: WidthMode
  wrapWidth: number | null
}

/** Extract plain text from Lexical EditorState JSON for temporary display until WU4. */
function extractPlainText(lexicalJson: string): string {
  try {
    const state = JSON.parse(lexicalJson)
    return (state.root.children as any[])
      .flatMap((p) => (p.children as any[]).map((n) => n.text ?? ''))
      .join('\n')
  } catch {
    return lexicalJson
  }
}

type TextEditorPluginsProps = {
  editing: boolean
  onCommit: () => void
  onCancel: () => void
}

function TextEditorPlugins({ editing, onCommit, onCancel }: TextEditorPluginsProps) {
  const [editor] = useLexicalComposerContext()

  useEffect(() => {
    if (!editing) return

    const remove = editor.registerCommand(
      KEY_DOWN_COMMAND,
      (event) => {
        if (!(event instanceof KeyboardEvent)) return false

        if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
          event.preventDefault()
          event.stopPropagation()
          onCommit()
          return true
        }

        if (event.key === 'Escape') {
          event.preventDefault()
          event.stopPropagation()
          onCancel()
          return true
        }

        return false
      },
      COMMAND_PRIORITY_EDITOR
    )

    return remove
  }, [editor, editing, onCancel, onCommit])

  useEffect(() => {
    if (!editing) return

    editor.focus()

    const frame = window.requestAnimationFrame(() => {
      const root = editor.getRootElement()
      if (!root) return
      const selection = window.getSelection()
      if (!selection) return
      const range = document.createRange()
      range.selectNodeContents(root)
      selection.removeAllRanges()
      selection.addRange(range)
    })

    return () => window.cancelAnimationFrame(frame)
  }, [editor, editing])

  return null
}

function TextNodeToolbarContent() {
  // WU2 scaffolds shared editor context for upcoming rich-text controls.
  useLexicalComposerContext()
  return <span className="text-node-toolbar__placeholder">text</span>
}

// ── Text node ────────────────────────────────────────────────────
export function TextNode({ id, data, selected, dragging }: NodeProps) {
  const { content, widthMode, wrapWidth } = data as TextNodeData
  const updateNodeText = useBoardStore((s) => s.updateNodeText)
  const [editing, setEditing] = useState(false)
  const [draftContent, setDraftContent] = useState(content)
  const [editorSession, setEditorSession] = useState(0)
  const draftContentRef = useRef(content)

  const plainText = extractPlainText(content)

  useEffect(() => {
    if (!editing) {
      setDraftContent(content)
      draftContentRef.current = content
    }
  }, [content, editing])

  const cancelEdit = useCallback(() => {
    setDraftContent(content)
    draftContentRef.current = content
    setEditing(false)
  }, [content])

  const commitEdit = useCallback(() => {
    setEditing(false)
    const next = draftContentRef.current
    if (next !== content) {
      updateNodeText(id, { content: next, widthMode, wrapWidth })
    }
  }, [content, id, updateNodeText, widthMode, wrapWidth])

  const editorConfig = useMemo(
    () => ({
      namespace: `text-node-${id}-${editorSession}`,
      editable: true,
      theme: {},
      editorState: draftContent,
      onError: (error: Error) => {
        throw error
      }
    }),
    [draftContent, editorSession, id]
  )

  const openEditing = useCallback(() => {
    setDraftContent(content)
    draftContentRef.current = content
    setEditorSession((v) => v + 1)
    setEditing(true)
  }, [content])

  return (
    <>
      <div className={`text-node${selected ? ' text-node--selected' : ''}${editing ? ' nodrag nopan' : ''}`}>
        {editing ? (
          <LexicalComposer initialConfig={editorConfig}>
            <NodeToolbar isVisible={selected && !dragging} position={Position.Top} offset={8}>
              <div className="text-node-toolbar" onPointerDown={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()}>
                <TextNodeToolbarContent />
              </div>
            </NodeToolbar>

            <div className="text-node__editor nodrag nopan nowheel" onPointerDown={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()}>
              <RichTextPlugin
                contentEditable={
                  <ContentEditable
                    className="text-node__input"
                    onBlur={commitEdit}
                    onPointerDown={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                  />
                }
                placeholder={<span className="text-node__placeholder">Text</span>}
                ErrorBoundary={LexicalErrorBoundary}
              />
              <OnChangePlugin
                onChange={(editorState) => {
                  const next = JSON.stringify(editorState.toJSON())
                  draftContentRef.current = next
                  setDraftContent(next)
                }}
              />
              <TextEditorPlugins editing={editing} onCommit={commitEdit} onCancel={cancelEdit} />
            </div>
          </LexicalComposer>
        ) : (
          <span
            className="text-node__content"
            onDoubleClick={openEditing}
          >
            {plainText || ''}
          </span>
        )}

        {!editing && selected && !dragging && (
          <NodeToolbar isVisible={selected && !dragging} position={Position.Top} offset={8}>
            <div className="text-node-toolbar">
              <span className="text-node-toolbar__placeholder">text</span>
            </div>
          </NodeToolbar>
        )}

        <Handle type="target" position={Position.Top} />
        <Handle type="target" position={Position.Left} />
        <Handle type="source" position={Position.Bottom} />
        <Handle type="source" position={Position.Right} />
      </div>
    </>
  )
}
