import { useEffect, useMemo, useRef, type JSX } from 'react'
import { LexicalComposer } from '@lexical/react/LexicalComposer'
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin'
import { ContentEditable } from '@lexical/react/LexicalContentEditable'
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin'
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import {
  $createTextNode,
  $getRoot,
  $getSelection,
  $isRangeSelection,
  COMMAND_PRIORITY_HIGH,
  KEY_ENTER_COMMAND,
  type EditorState,
  type InitialEditorStateType
} from 'lexical'
import { BOOK_LEXICAL_NODES, $createBookElementNode, $isBookElementNode } from './bookLexicalNodes'
import {
  serializeBookMarkupFromLiveNodes,
  serializeBookMarkupWithTextEdits,
  type BookMarkupDocument,
  type BookMarkupLiveNodeText,
  type BookMarkupNode
} from './bookMarkup'

type BookDocument = Extract<BookMarkupDocument, { mode: 'book' }>

type FocusWriterBookSurfaceProps = {
  document: BookDocument
  editorKey: number
  focusNodeIndex: number | null
  modeLabel: string
  typewriter: boolean
  onClose: () => void
  onPreview: () => void
  onRaw: () => void
  onTextChange: (value: string) => void
  onSetDynamic: () => void
  onSetTypewriter: () => void
}

const BOOK_LEXICAL_THEME = {
  root: 'fw-book-lexical__root'
}

const SYNTHETIC_DRAFT_NODE_INDEX = -1

function getNodeClassName(node: BookMarkupNode): string {
  if (node.kind === 'metadata') return 'fw-book-lexical__metadata'
  if (node.kind === 'heading')
    return `fw-book-lexical__heading fw-book-lexical__heading--${node.depth}`
  if (node.kind === 'paragraph') return 'fw-book-lexical__para'
  if (node.kind === 'margin') return 'fw-book-lexical__margin'
  if (node.kind === 'note') return 'fw-book-lexical__note'
  if (node.kind === 'raw') return 'fw-book-lexical__raw'
  return 'fw-book-lexical__separator'
}

function getNodeTagName(node: BookMarkupNode): string {
  if (node.kind === 'heading') return `h${Math.min(node.depth + 1, 4)}`
  if (node.kind === 'metadata' || node.kind === 'raw' || node.kind === 'separator') return 'div'
  if (node.kind === 'margin') return 'aside'
  return 'p'
}

function getNodeText(node: BookMarkupNode): string {
  if (node.kind === 'metadata') return `::${node.name} ${node.value}`
  if (node.kind === 'heading') return node.text
  if (node.kind === 'paragraph') return node.text
  if (node.kind === 'margin' || node.kind === 'note') return node.value
  if (node.kind === 'raw') return node.text
  return ''
}

function isEditableNode(node: BookMarkupNode): boolean {
  return (
    node.kind === 'heading' ||
    node.kind === 'paragraph' ||
    node.kind === 'margin' ||
    node.kind === 'note' ||
    node.kind === 'separator'
  )
}

function createEditorState(
  document: BookDocument,
  focusNodeIndex: number | null
): InitialEditorStateType {
  return () => {
    const root = $getRoot()
    root.clear()

    document.nodes.forEach((node, index) => {
      const elementNode = $createBookElementNode(
        getNodeClassName(node),
        getNodeTagName(node),
        index,
        isEditableNode(node)
      )
      const text = getNodeText(node)
      if (text || isEditableNode(node)) elementNode.append($createTextNode(text))
      root.append(elementNode)
      if (index === focusNodeIndex) elementNode.selectEnd()
    })

    const draftNode = $createBookElementNode(
      'fw-book-lexical__separator fw-book-lexical__draft-line',
      'div',
      SYNTHETIC_DRAFT_NODE_INDEX,
      true
    )
    draftNode.append($createTextNode(''))
    root.append(draftNode)
    if (focusNodeIndex === SYNTHETIC_DRAFT_NODE_INDEX) draftNode.selectEnd()
  }
}

function serializeEditorState(document: BookDocument, editorState: EditorState): string {
  const edits = new Map<number, string>()
  const liveNodes: BookMarkupLiveNodeText[] = []

  editorState.read(() => {
    for (const child of $getRoot().getChildren()) {
      if (!$isBookElementNode(child)) continue

      const nodeIndex = child.getNodeIndex()
      if (nodeIndex === SYNTHETIC_DRAFT_NODE_INDEX) {
        const draftText = child.getTextContent()
        liveNodes.push({ nodeIndex, text: draftText })
        continue
      }

      const sourceNode = document.nodes[nodeIndex]
      if (!sourceNode) continue

      const nextText = child.getTextContent()
      liveNodes.push({ nodeIndex, text: nextText })

      if (!isEditableNode(sourceNode)) continue

      if (sourceNode.kind === 'separator') {
        if (nextText) edits.set(nodeIndex, nextText)
        continue
      }

      if (nextText !== getNodeText(sourceNode)) {
        edits.set(nodeIndex, nextText)
      }
    }
  })

  const liveText = serializeBookMarkupFromLiveNodes(document, liveNodes)
  if (liveText !== document.text) return liveText
  if (edits.size === 0) return document.text
  return serializeBookMarkupWithTextEdits(document, edits)
}

function BookOnChangePlugin({
  document,
  onTextChange
}: {
  document: BookDocument
  onTextChange: (value: string) => void
}): JSX.Element {
  const baseDocumentRef = useRef(document)

  return (
    <OnChangePlugin
      ignoreSelectionChange
      onChange={(editorState) => {
        const baseDocument = baseDocumentRef.current
        const nextText = serializeEditorState(baseDocument, editorState)
        if (nextText !== baseDocument.text) onTextChange(nextText)
      }}
    />
  )
}

function BookEnterPlugin(): null {
  const [editor] = useLexicalComposerContext()

  useEffect(() => {
    return editor.registerCommand(
      KEY_ENTER_COMMAND,
      (event) => {
        event?.preventDefault()
        const selection = $getSelection()
        if (!$isRangeSelection(selection)) return false

        const topLevelElement = selection.anchor.getNode().getTopLevelElement()
        if (!$isBookElementNode(topLevelElement)) return false

        selection.insertLineBreak()
        return true
      },
      COMMAND_PRIORITY_HIGH
    )
  }, [editor])

  return null
}

export function FocusWriterBookSurface({
  document,
  editorKey,
  focusNodeIndex,
  modeLabel,
  typewriter,
  onClose,
  onPreview,
  onRaw,
  onTextChange,
  onSetDynamic,
  onSetTypewriter
}: FocusWriterBookSurfaceProps): JSX.Element {
  const editorConfig = useMemo(
    () => ({
      namespace: 'focus-writer-book',
      editable: true,
      theme: BOOK_LEXICAL_THEME,
      nodes: BOOK_LEXICAL_NODES,
      editorState: createEditorState(document, focusNodeIndex),
      onError: (error: Error) => {
        throw error
      }
    }),
    [document, focusNodeIndex]
  )

  return (
    <div
      className={`fw-book-lexical${typewriter ? ' fw-book-lexical--typewriter' : ''}`}
      onKeyDown={(event) => {
        const isMod = event.ctrlKey || event.metaKey

        if (event.key === 'Escape') {
          event.preventDefault()
          onClose()
          return
        }

        if (isMod && event.key.toLowerCase() === 'p') {
          event.preventDefault()
          onPreview()
          return
        }

        if (isMod && event.key.toLowerCase() === 'e') {
          event.preventDefault()
          onRaw()
          return
        }

        if (isMod && event.key.toLowerCase() === 'd') {
          event.preventDefault()
          onSetDynamic()
          return
        }

        if (isMod && event.key.toLowerCase() === 't') {
          event.preventDefault()
          onSetTypewriter()
        }
      }}
    >
      <div className="fw-book-lexical__shell">
        <LexicalComposer key={editorKey} initialConfig={editorConfig}>
          <RichTextPlugin
            contentEditable={
              <ContentEditable className="fw-book-lexical__content" spellCheck={false} />
            }
            placeholder={null}
            ErrorBoundary={LexicalErrorBoundary}
          />
          <BookOnChangePlugin document={document} onTextChange={onTextChange} />
          <BookEnterPlugin />
        </LexicalComposer>
      </div>
      <span className="fw-editor__mode-indicator" aria-hidden="true">
        {modeLabel}
      </span>
    </div>
  )
}
