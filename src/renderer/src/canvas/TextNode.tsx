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
import { KEY_DOWN_COMMAND, COMMAND_PRIORITY_EDITOR, type LexicalEditor } from 'lexical'
import './TextNode.css'

const SAFE_ZONE_FRACTION = 0.13
const MIN_AUTO_WIDTH = 180
const MIN_WRAP_WIDTH = 120

type ResizeEdge = 'left' | 'right'

type ResizeSession = {
  edge: ResizeEdge
  startClientX: number
  startWidth: number
  startRight: number
  startY: number
}

type TextNodeData = {
  content: string // Lexical EditorState JSON
  widthMode: WidthMode
  wrapWidth: number | null
  size?: { w: number; h: number }
}

type TextEditorPluginsProps = {
  editing: boolean
  onCommit: () => void
  onCancel: () => void
  onEditorReady: (editor: LexicalEditor) => void
}

function TextEditorPlugins({ editing, onCommit, onCancel, onEditorReady }: TextEditorPluginsProps) {
  const [editor] = useLexicalComposerContext()

  useEffect(() => {
    onEditorReady(editor)
  }, [editor, onEditorReady])

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
export function TextNode({ id, data, selected, dragging, positionAbsoluteX, positionAbsoluteY }: NodeProps) {
  const { content, widthMode, wrapWidth, size } = data as TextNodeData
  const updateNodeText = useBoardStore((s) => s.updateNodeText)
  const updateNodeSize = useBoardStore((s) => s.updateNodeSize)
  const updateNodePosition = useBoardStore((s) => s.updateNodePosition)
  const { getViewport, setViewport } = useReactFlow()
  const updateNodeInternals = useUpdateNodeInternals()
  const [editing, setEditing] = useState(false)
  const [draftContent, setDraftContent] = useState(content)
  const [editorSession, setEditorSession] = useState(0)
  const [maxAutoWidth, setMaxAutoWidth] = useState<number>(MIN_AUTO_WIDTH)
  const [editingWidth, setEditingWidth] = useState<number | null>(null)
  const [resizePreviewWidth, setResizePreviewWidth] = useState<number | null>(null)
  const [resizing, setResizing] = useState(false)
  const draftContentRef = useRef(content)
  const editorRef = useRef<LexicalEditor | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const sizeRef = useRef<{ w: number; h: number }>({ w: size?.w ?? 0, h: size?.h ?? 0 })
  const resizeSessionRef = useRef<ResizeSession | null>(null)
  const resizePreviewWidthRef = useRef<number | null>(null)

  useEffect(() => {
    if (!editing) {
      setDraftContent(content)
      draftContentRef.current = content
    }
  }, [content, editing])

  useEffect(() => {
    if (!size) return
    sizeRef.current = { w: size.w, h: size.h }
  }, [size])

  const cancelEdit = useCallback(() => {
    setDraftContent(content)
    draftContentRef.current = content
    setEditing(false)
    setEditingWidth(null)
  }, [content])

  const persistMeasuredSize = useCallback(() => {
    const nodeEl = containerRef.current
    if (!nodeEl) return

    const measuredW = Math.round(nodeEl.offsetWidth)
    const measuredH = Math.round(nodeEl.offsetHeight)
    const previous = sizeRef.current
    if (previous.w === measuredW && previous.h === measuredH) return

    sizeRef.current = { w: measuredW, h: measuredH }
    updateNodeSize(id, measuredW, measuredH)
  }, [id, updateNodeSize])

  const commitEdit = useCallback(() => {
    persistMeasuredSize()
    setEditing(false)
    setEditingWidth(null)
    const next = draftContentRef.current
    if (next !== content) {
      updateNodeText(id, { content: next, widthMode, wrapWidth })
    }
  }, [content, persistMeasuredSize, id, updateNodeText, widthMode, wrapWidth])

  const focusEditor = useCallback(() => {
    const editor = editorRef.current
    if (!editor) return
    window.requestAnimationFrame(() => {
      editor.focus()
    })
  }, [])

  const handleEditorBlur = useCallback(() => {
    if (resizeSessionRef.current) {
      focusEditor()
      return
    }
    commitEdit()
  }, [commitEdit, focusEditor])

  const syncNodeDimensions = useCallback(() => {
    const nodeEl = containerRef.current
    if (!nodeEl) return
    nodeEl.style.height = 'auto'
    updateNodeInternals(id)
  }, [id, updateNodeInternals])

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
    if (resizePreviewWidth !== null) {
      return { width: `${Math.max(1, resizePreviewWidth)}px`, height: 'auto' as const }
    }

    if (!editing) {
      if (widthMode === 'fixed') {
        return { width: `${Math.max(1, wrapWidth ?? MIN_AUTO_WIDTH)}px`, height: 'auto' as const }
      }

      if (size?.w) {
        return { width: `${Math.max(1, size.w)}px`, height: 'auto' as const }
      }

      return undefined
    }

    if (widthMode === 'fixed') {
      return { width: `${Math.max(1, wrapWidth ?? MIN_AUTO_WIDTH)}px`, height: 'auto' as const }
    }

    if (!editingWidth || editingWidth < maxAutoWidth) {
      return { width: 'max-content', maxWidth: 'none', height: 'auto' as const }
    }

    return { width: `${editingWidth}px`, maxWidth: `${maxAutoWidth}px`, height: 'auto' as const }
  }, [editing, editingWidth, maxAutoWidth, resizePreviewWidth, size?.w, widthMode, wrapWidth])

  const displayConfig = useMemo(
    () => ({
      namespace: `text-node-readonly-${id}`,
      editable: false,
      theme: {},
      editorState: content,
      onError: (error: Error) => {
        throw error
      }
    }),
    [content, id]
  )

  const onResizePointerMove = useCallback(
    (event: PointerEvent) => {
      const session = resizeSessionRef.current
      if (!session) return

      event.preventDefault()

      const zoom = getViewport().zoom || 1
      const deltaFlow = (event.clientX - session.startClientX) / zoom

      let nextWidth = session.edge === 'right' ? session.startWidth + deltaFlow : session.startWidth - deltaFlow
      nextWidth = Math.max(MIN_WRAP_WIDTH, Math.round(nextWidth))

      setResizePreviewWidth(nextWidth)
      resizePreviewWidthRef.current = nextWidth

      if (session.edge === 'left') {
        const nextX = session.startRight - nextWidth
        updateNodePosition(id, nextX, session.startY)
      }

      updateNodeInternals(id)
    },
    [getViewport, id, updateNodeInternals, updateNodePosition]
  )

  const stopResize = useCallback(
    (persist: boolean) => {
      const session = resizeSessionRef.current
      if (!session) return

      resizeSessionRef.current = null
      setResizing(false)

      const finalWidth = Math.max(MIN_WRAP_WIDTH, Math.round(resizePreviewWidthRef.current ?? session.startWidth))
      const finalX = session.edge === 'left' ? session.startRight - finalWidth : null

      if (session.edge === 'left' && finalX !== null && Number.isFinite(finalX) && Number.isFinite(session.startY)) {
        updateNodePosition(id, finalX, session.startY)
      }

      setResizePreviewWidth(null)
      resizePreviewWidthRef.current = null

      if (editing) {
        focusEditor()
      }

      if (!persist) return

      updateNodeText(id, {
        content: draftContentRef.current,
        widthMode: 'fixed',
        wrapWidth: finalWidth
      })

      const nodeEl = containerRef.current
      const measuredH = nodeEl ? Math.round(nodeEl.offsetHeight) : sizeRef.current.h
      sizeRef.current = { w: finalWidth, h: measuredH }
      updateNodeSize(id, finalWidth, measuredH)
      updateNodeInternals(id)
    },
    [editing, focusEditor, id, updateNodeInternals, updateNodePosition, updateNodeSize, updateNodeText]
  )

  const onResizePointerUp = useCallback(() => {
    window.removeEventListener('pointermove', onResizePointerMove)
    stopResize(true)
  }, [onResizePointerMove, stopResize])

  const beginResize = useCallback(
    (edge: ResizeEdge) => (event: React.PointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) return

      const nodeEl = containerRef.current
      if (!nodeEl) return

      event.preventDefault()
      event.stopPropagation()
      event.currentTarget.setPointerCapture(event.pointerId)

      const startWidth = Math.max(MIN_WRAP_WIDTH, Math.round(nodeEl.offsetWidth))
      const startX = Number.isFinite(positionAbsoluteX) ? positionAbsoluteX : 0
      const startY = Number.isFinite(positionAbsoluteY) ? positionAbsoluteY : 0

      resizeSessionRef.current = {
        edge,
        startClientX: event.clientX,
        startWidth,
        startRight: startX + startWidth,
        startY
      }

      setResizePreviewWidth(startWidth)
      resizePreviewWidthRef.current = startWidth
      setResizing(true)
      updateNodeInternals(id)

      window.removeEventListener('pointermove', onResizePointerMove)
      window.removeEventListener('pointerup', onResizePointerUp)
      window.addEventListener('pointermove', onResizePointerMove)
      window.addEventListener('pointerup', onResizePointerUp, { once: true })
    },
    [id, onResizePointerMove, onResizePointerUp, positionAbsoluteX, positionAbsoluteY, updateNodeInternals]
  )

  useEffect(() => {
    return () => {
      window.removeEventListener('pointermove', onResizePointerMove)
      window.removeEventListener('pointerup', onResizePointerUp)
    }
  }, [onResizePointerMove, onResizePointerUp])

  useEffect(() => {
    if (!resizing) return

    const onWindowBlur = () => {
      window.removeEventListener('pointermove', onResizePointerMove)
      window.removeEventListener('pointerup', onResizePointerUp)
      stopResize(false)
    }
    window.addEventListener('blur', onWindowBlur)
    return () => {
      window.removeEventListener('blur', onWindowBlur)
    }
  }, [onResizePointerMove, onResizePointerUp, resizing, stopResize])

  return (
    <>
      <div
        ref={containerRef}
        className={`text-node${selected ? ' text-node--selected' : ''}${editing ? ' nodrag nopan' : ''}${resizing ? ' text-node--resizing nodrag nopan' : ''}`}
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
                    onBlur={handleEditorBlur}
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
              <TextEditorPlugins
                editing={editing}
                onCommit={commitEdit}
                onCancel={cancelEdit}
                onEditorReady={(editor) => {
                  editorRef.current = editor
                }}
              />
            </div>
          </LexicalComposer>
        ) : (
          <div className="text-node__content" onDoubleClick={openEditing}>
            <LexicalComposer key={content} initialConfig={displayConfig}>
              <RichTextPlugin
                contentEditable={<ContentEditable className="text-node__contentEditable" />}
                placeholder={null}
                ErrorBoundary={LexicalErrorBoundary}
              />
            </LexicalComposer>
          </div>
        )}

        {!editing && selected && !dragging && (
          <NodeToolbar isVisible={selected && !dragging} position={Position.Top} offset={8}>
            <div className="text-node-toolbar">
              <span className="text-node-toolbar__placeholder">text</span>
            </div>
          </NodeToolbar>
        )}

        {selected && !dragging && (
          <>
            <div
              className="text-node__resize-zone text-node__resize-zone--left nodrag nopan"
              onPointerDownCapture={beginResize('left')}
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
              }}
            />
            <div
              className="text-node__resize-zone text-node__resize-zone--right nodrag nopan"
              onPointerDownCapture={beginResize('right')}
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
              }}
            />
          </>
        )}

        <Handle type="target" position={Position.Top} />
        <Handle type="target" position={Position.Left} />
        <Handle type="source" position={Position.Bottom} />
        <Handle type="source" position={Position.Right} />
      </div>
    </>
  )
}
