import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Handle, NodeToolbar, Position, type NodeProps, useReactFlow, useUpdateNodeInternals } from '@xyflow/react'
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

const SAFE_ZONE_FRACTION = 0.13
const MIN_AUTO_WIDTH = 180

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
export function TextNode({ id, data, selected, dragging, positionAbsoluteX }: NodeProps) {
  const { content, widthMode, wrapWidth } = data as TextNodeData
  const updateNodeText = useBoardStore((s) => s.updateNodeText)
  const updateNodeSize = useBoardStore((s) => s.updateNodeSize)
  const { getViewport, setViewport } = useReactFlow()
  const updateNodeInternals = useUpdateNodeInternals()
  const [editing, setEditing] = useState(false)
  const [draftContent, setDraftContent] = useState(content)
  const [editorSession, setEditorSession] = useState(0)
  const [maxAutoWidth, setMaxAutoWidth] = useState<number>(MIN_AUTO_WIDTH)
  const [editingWidth, setEditingWidth] = useState<number | null>(null)
  const draftContentRef = useRef(content)
  const containerRef = useRef<HTMLDivElement>(null)
  const lastPersistedSizeRef = useRef<{ w: number; h: number } | null>(null)

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
    setEditingWidth(null)
    const next = draftContentRef.current
    if (next !== content) {
      updateNodeText(id, { content: next, widthMode, wrapWidth })
    }
  }, [content, id, updateNodeText, widthMode, wrapWidth])

  const syncNodeDimensions = useCallback(() => {
    const nodeEl = containerRef.current
    if (!nodeEl) return
    nodeEl.style.height = 'auto'
    const measuredW = Math.round(nodeEl.offsetWidth)
    const measuredH = Math.round(nodeEl.offsetHeight)

    const previous = lastPersistedSizeRef.current
    if (!previous || previous.w !== measuredW || previous.h !== measuredH) {
      updateNodeSize(id, measuredW, measuredH)
      lastPersistedSizeRef.current = { w: measuredW, h: measuredH }
    }

    updateNodeInternals(id)
  }, [id, updateNodeInternals, updateNodeSize])

  const measureAutoWidth = useCallback(() => {
    const nodeEl = containerRef.current
    if (!nodeEl || !editing) return
    if (widthMode !== 'auto') return

    const next = Math.min(nodeEl.offsetWidth, maxAutoWidth)
    setEditingWidth((prev) => (prev === next ? prev : next))
    syncNodeDimensions()
  }, [editing, maxAutoWidth, syncNodeDimensions, widthMode])

  const applyViewportFramingAndMaxWidth = useCallback(() => {
    const nodeEl = containerRef.current
    if (!nodeEl) return

    const safeInsetX = window.innerWidth * SAFE_ZONE_FRACTION
    const safeInsetY = window.innerHeight * SAFE_ZONE_FRACTION

    const rect = nodeEl.getBoundingClientRect()
    const viewport = getViewport()

    let dx = 0
    let dy = 0

    if (rect.left < safeInsetX) {
      dx = safeInsetX - rect.left
    } else if (rect.right > window.innerWidth - safeInsetX) {
      dx = window.innerWidth - safeInsetX - rect.right
    }

    if (rect.top < safeInsetY) {
      dy = safeInsetY - rect.top
    } else if (rect.bottom > window.innerHeight - safeInsetY) {
      dy = window.innerHeight - safeInsetY - rect.bottom
    }

    const outsideSafeZone = dx !== 0 || dy !== 0

    let nextViewportX = viewport.x
    let nextViewportY = viewport.y

    if (outsideSafeZone) {
      const nodeCenterFlowX = (rect.left + rect.width / 2 - viewport.x) / viewport.zoom
      const nodeCenterFlowY = (rect.top + rect.height / 2 - viewport.y) / viewport.zoom
      nextViewportX = window.innerWidth / 2 - nodeCenterFlowX * viewport.zoom
      nextViewportY = window.innerHeight / 2 - nodeCenterFlowY * viewport.zoom

      setViewport({ x: nextViewportX, y: nextViewportY, zoom: viewport.zoom }, { duration: 0 })
    }

    const leftScreen = positionAbsoluteX * viewport.zoom + nextViewportX
    const available = (window.innerWidth * (1 - SAFE_ZONE_FRACTION) - leftScreen) / viewport.zoom
    setMaxAutoWidth(Math.max(MIN_AUTO_WIDTH, Math.floor(available)))
  }, [getViewport, positionAbsoluteX, setViewport])

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
    applyViewportFramingAndMaxWidth()
    setEditing(true)
  }, [applyViewportFramingAndMaxWidth, content])

  useEffect(() => {
    if (!editing) return
    const frame = window.requestAnimationFrame(() => {
      if (widthMode === 'fixed') {
        setEditingWidth(wrapWidth ?? MIN_AUTO_WIDTH)
        syncNodeDimensions()
        return
      }
      measureAutoWidth()
    })

    return () => window.cancelAnimationFrame(frame)
  }, [editing, measureAutoWidth, syncNodeDimensions, widthMode, wrapWidth])

  useEffect(() => {
    if (editing) return
    syncNodeDimensions()
  }, [content, editing, syncNodeDimensions])

  const nodeStyle = useMemo(() => {
    if (!editing) return undefined

    if (widthMode === 'fixed') {
      return { width: `${Math.max(1, wrapWidth ?? MIN_AUTO_WIDTH)}px`, height: 'auto' as const }
    }

    if (!editingWidth || editingWidth < maxAutoWidth) {
      return { width: 'max-content', maxWidth: 'none', height: 'auto' as const }
    }

    return { width: `${editingWidth}px`, maxWidth: `${maxAutoWidth}px`, height: 'auto' as const }
  }, [editing, editingWidth, maxAutoWidth, widthMode, wrapWidth])

  return (
    <>
      <div
        ref={containerRef}
        className={`text-node${selected ? ' text-node--selected' : ''}${editing ? ' nodrag nopan' : ''}`}
        style={nodeStyle}
      >
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
                  if (widthMode === 'auto') {
                    window.requestAnimationFrame(() => {
                      measureAutoWidth()
                    })
                  } else {
                    window.requestAnimationFrame(() => {
                      syncNodeDimensions()
                    })
                  }
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
