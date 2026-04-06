import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Handle, NodeToolbar, Position, type NodeProps, useReactFlow, useUpdateNodeInternals } from '@xyflow/react'
import { CONNECTION_HANDLE_OUTSET_PX, NODE_HANDLE_IDS } from './canvas-constants'
import { useBoardStore } from '@renderer/stores/board'
import type { WidthMode } from '@renderer/shared/types'
import { isLexicalContentEmpty } from '@renderer/shared/types'
import { LexicalComposer } from '@lexical/react/LexicalComposer'
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin'
import { ContentEditable } from '@lexical/react/LexicalContentEditable'
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary'
import { KEY_DOWN_COMMAND, COMMAND_PRIORITY_EDITOR, type LexicalEditor } from 'lexical'
import { HeadingNode, QuoteNode } from '@lexical/rich-text'
import { ListNode, ListItemNode } from '@lexical/list'
import { ListPlugin } from '@lexical/react/LexicalListPlugin'
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin'
import { MoveHorizontal } from 'lucide-react'
import { FormatToolbar } from './FormatToolbar'
import { SlashCommandPlugin } from './SlashCommandPlugin'
import './TextNode.css'

const RICH_TEXT_NODES = [HeadingNode, QuoteNode, ListNode, ListItemNode]

const RICH_TEXT_THEME = {
  paragraph: 'tn-p',
  heading: {
    h1: 'tn-h1',
    h2: 'tn-h2',
    h3: 'tn-h3',
  },
  list: {
    ul: 'tn-ul',
    ol: 'tn-ol',
    listitem: 'tn-li',
    nested: { listitem: 'tn-li-nested' },
  },
  quote: 'tn-quote',
  text: {
    bold: 'tn-bold',
    italic: 'tn-italic',
  },
}

const SAFE_ZONE_FRACTION = 0.13
const MIN_AUTO_WIDTH = 180
const MIN_WRAP_WIDTH = 120
const EDGE_RESIZE_ZONE_PX = 6
const EDGE_ICON_OFFSET_PX = 10

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
  autoEditToken?: number
}

type TextEditorPluginsProps = {
  editing: boolean
  onCommit: () => void
  onCancel: () => void
  onEditorReady: (editor: LexicalEditor) => void
  initialCaretClientPoint: { x: number; y: number } | null
}

function TextEditorPlugins({
  editing,
  onCommit,
  onCancel,
  onEditorReady,
  initialCaretClientPoint
}: TextEditorPluginsProps) {
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

      // Try to place the caret at the original double-click location.
      // If browser hit-testing fails, default to end-of-text.
      let placedAtPoint = false
      const clickPoint = initialCaretClientPoint
      if (clickPoint) {
        const anyDocument = document as Document & {
          caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null
          caretRangeFromPoint?: (x: number, y: number) => Range | null
        }

        const caretPos = anyDocument.caretPositionFromPoint?.(clickPoint.x, clickPoint.y)
        if (caretPos?.offsetNode && root.contains(caretPos.offsetNode)) {
          range.setStart(caretPos.offsetNode, caretPos.offset)
          range.collapse(true)
          placedAtPoint = true
        } else {
          const caretRange = anyDocument.caretRangeFromPoint?.(clickPoint.x, clickPoint.y)
          if (caretRange && root.contains(caretRange.startContainer)) {
            range.setStart(caretRange.startContainer, caretRange.startOffset)
            range.collapse(true)
            placedAtPoint = true
          }
        }
      }

      if (!placedAtPoint) {
        range.selectNodeContents(root)
        range.collapse(false)
      }

      selection.removeAllRanges()
      selection.addRange(range)
    })

    return () => window.cancelAnimationFrame(frame)
  }, [editor, editing, initialCaretClientPoint])

  return null
}

// ── Text node ────────────────────────────────────────────────────
export function TextNode({ id, data, selected, dragging, positionAbsoluteX, positionAbsoluteY }: NodeProps) {
  const { content, widthMode, wrapWidth, size, autoEditToken } = data as TextNodeData
  const updateNodeText = useBoardStore((s) => s.updateNodeText)
  const updateNodeSize = useBoardStore((s) => s.updateNodeSize)
  const updateNodePosition = useBoardStore((s) => s.updateNodePosition)
  const deleteNode = useBoardStore((s) => s.deleteNode)
  const { getViewport, setViewport } = useReactFlow()
  const updateNodeInternals = useUpdateNodeInternals()
  const [editing, setEditing] = useState(false)
  const [draftContent, setDraftContent] = useState(content)
  const [editorSession, setEditorSession] = useState(0)
  const [maxAutoWidth, setMaxAutoWidth] = useState<number>(MIN_AUTO_WIDTH)
  const [editingWidth, setEditingWidth] = useState<number | null>(null)
  const [resizePreviewWidth, setResizePreviewWidth] = useState<number | null>(null)
  const [resizing, setResizing] = useState(false)
  const [resizeHoverEdge, setResizeHoverEdge] = useState<ResizeEdge | null>(null)
  const draftContentRef = useRef(content)
  const editorRef = useRef<LexicalEditor | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const sizeRef = useRef<{ w: number; h: number }>({ w: size?.w ?? 0, h: size?.h ?? 0 })
  const resizeSessionRef = useRef<ResizeSession | null>(null)
  const resizePreviewWidthRef = useRef<number | null>(null)
  const pendingCaretClientPointRef = useRef<{ x: number; y: number } | null>(null)
  const handledAutoEditTokenRef = useRef<number | null>(null)

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
    const next = draftContentRef.current
    const shouldDeleteNode = isLexicalContentEmpty(next)

    if (shouldDeleteNode) {
      setEditing(false)
      setEditingWidth(null)
      deleteNode(id)
      return
    }

    persistMeasuredSize()
    setEditing(false)
    setEditingWidth(null)
    const autoWrappedToSafetyLimit =
      widthMode === 'auto' && editingWidth !== null && editingWidth >= maxAutoWidth
    const nextWidthMode: WidthMode = autoWrappedToSafetyLimit ? 'fixed' : widthMode
    const nextWrapWidth = autoWrappedToSafetyLimit
      ? Math.max(MIN_WRAP_WIDTH, Math.round(maxAutoWidth))
      : wrapWidth
    const layoutChanged = nextWidthMode !== widthMode || nextWrapWidth !== wrapWidth

    if (next !== content || layoutChanged) {
      updateNodeText(id, { content: next, widthMode: nextWidthMode, wrapWidth: nextWrapWidth })
    }
  }, [
    content,
    editingWidth,
    id,
    maxAutoWidth,
    deleteNode,
    persistMeasuredSize,
    updateNodeText,
    widthMode,
    wrapWidth
  ])

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
      theme: RICH_TEXT_THEME,
      nodes: RICH_TEXT_NODES,
      editorState: draftContent,
      onError: (error: Error) => {
        throw error
      }
    }),
    [draftContent, editorSession, id]
  )

  const openEditing = useCallback((event?: React.MouseEvent<HTMLDivElement>) => {
    pendingCaretClientPointRef.current = event ? { x: event.clientX, y: event.clientY } : null
    setDraftContent(content)
    draftContentRef.current = content
    setEditorSession((v) => v + 1)
    applyViewportFramingAndMaxWidth()
    setEditing(true)
  }, [applyViewportFramingAndMaxWidth, content])

  useEffect(() => {
    if (typeof autoEditToken !== 'number') return
    if (handledAutoEditTokenRef.current === autoEditToken) return

    handledAutoEditTokenRef.current = autoEditToken
    openEditing()
  }, [autoEditToken, openEditing])

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
    if (editing || resizing) return
    if (widthMode !== 'auto') return

    const frame = window.requestAnimationFrame(() => {
      syncNodeDimensions()
      persistMeasuredSize()
    })

    return () => window.cancelAnimationFrame(frame)
  }, [content, editing, persistMeasuredSize, resizing, syncNodeDimensions, widthMode])

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

      return { width: 'max-content', maxWidth: 'none', height: 'auto' as const }
    }

    if (widthMode === 'fixed') {
      return { width: `${Math.max(1, wrapWidth ?? MIN_AUTO_WIDTH)}px`, height: 'auto' as const }
    }

    if (!editingWidth || editingWidth < maxAutoWidth) {
      return { width: 'max-content', maxWidth: 'none', height: 'auto' as const }
    }

    return { width: `${editingWidth}px`, maxWidth: `${maxAutoWidth}px`, height: 'auto' as const }
  }, [editing, editingWidth, maxAutoWidth, resizePreviewWidth, widthMode, wrapWidth])

  const displayConfig = useMemo(
    () => ({
      namespace: `text-node-readonly-${id}`,
      editable: false,
      theme: RICH_TEXT_THEME,
      nodes: RICH_TEXT_NODES,
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
      setResizeHoverEdge(null)

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
      setResizeHoverEdge(edge)

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

  const activeResizeEdge = resizeSessionRef.current?.edge ?? resizeHoverEdge

  return (
    <>
      <div
        ref={containerRef}
        className={`text-node${selected ? ' text-node--selected' : ''}${editing ? ' nodrag nopan' : ''}${resizing ? ' text-node--resizing nodrag nopan' : ''}${activeResizeEdge === 'left' ? ' text-node--resize-hover-left' : ''}${activeResizeEdge === 'right' ? ' text-node--resize-hover-right' : ''}`}
        style={nodeStyle}
      >
        {editing ? (
          <LexicalComposer initialConfig={editorConfig}>
            <NodeToolbar isVisible position={Position.Top} offset={8}>
              <FormatToolbar />
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
                initialCaretClientPoint={pendingCaretClientPointRef.current}
                onEditorReady={(editor) => {
                  editorRef.current = editor
                }}
              />
              <ListPlugin />
              <HistoryPlugin />
              <SlashCommandPlugin />
            </div>
          </LexicalComposer>
        ) : (
          <div className="text-node__content" onDoubleClick={(event) => openEditing(event)}>
            <LexicalComposer key={content} initialConfig={displayConfig}>
              <RichTextPlugin
                contentEditable={<ContentEditable className="text-node__contentEditable" />}
                placeholder={null}
                ErrorBoundary={LexicalErrorBoundary}
              />
            </LexicalComposer>
          </div>
        )}

        {selected && !dragging && (
          <>
            <div
              className="text-node__resize-zone text-node__resize-zone--left nodrag nopan"
              style={{ width: EDGE_RESIZE_ZONE_PX }}
              onPointerDownCapture={beginResize('left')}
              onPointerEnter={() => setResizeHoverEdge('left')}
              onPointerLeave={() => {
                if (!resizing) {
                  setResizeHoverEdge((current) => (current === 'left' ? null : current))
                }
              }}
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
              }}
            />
            <div
              className="text-node__resize-zone text-node__resize-zone--right nodrag nopan"
              style={{ width: EDGE_RESIZE_ZONE_PX }}
              onPointerDownCapture={beginResize('right')}
              onPointerEnter={() => setResizeHoverEdge('right')}
              onPointerLeave={() => {
                if (!resizing) {
                  setResizeHoverEdge((current) => (current === 'right' ? null : current))
                }
              }}
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
              }}
            />
          </>
        )}

        {(selected || resizing) && activeResizeEdge && (
          <div
            className={`text-node__resize-cue text-node__resize-cue--${activeResizeEdge}`}
            style={activeResizeEdge === 'left' ? { left: EDGE_ICON_OFFSET_PX } : { right: EDGE_ICON_OFFSET_PX }}
            aria-hidden="true"
          >
            <MoveHorizontal size={12} strokeWidth={2} />
          </div>
        )}

        <Handle
          id={NODE_HANDLE_IDS.top}
          type="target"
          position={Position.Top}
          style={{ top: -CONNECTION_HANDLE_OUTSET_PX }}
        />
        <Handle
          id={NODE_HANDLE_IDS.left}
          type="target"
          position={Position.Left}
          style={{ left: -CONNECTION_HANDLE_OUTSET_PX }}
        />
        <Handle
          id={NODE_HANDLE_IDS.bottom}
          type="source"
          position={Position.Bottom}
          style={{ bottom: -CONNECTION_HANDLE_OUTSET_PX }}
        />
        <Handle
          id={NODE_HANDLE_IDS.right}
          type="source"
          position={Position.Right}
          style={{ right: -CONNECTION_HANDLE_OUTSET_PX }}
        />
      </div>
    </>
  )
}
