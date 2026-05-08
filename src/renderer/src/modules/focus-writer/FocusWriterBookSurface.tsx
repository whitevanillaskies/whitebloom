import { useMemo, type JSX } from 'react'
import { LexicalComposer } from '@lexical/react/LexicalComposer'
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin'
import { ContentEditable } from '@lexical/react/LexicalContentEditable'
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary'
import { $createTextNode, $getRoot, type InitialEditorStateType } from 'lexical'
import { BOOK_LEXICAL_NODES, $createBookElementNode } from './bookLexicalNodes'
import type { BookMarkupDocument, BookMarkupNode } from './bookMarkup'

type BookDocument = Extract<BookMarkupDocument, { mode: 'book' }>

type FocusWriterBookSurfaceProps = {
  document: BookDocument
  modeLabel: string
  typewriter: boolean
  onClose: () => void
  onPreview: () => void
  onSetDynamic: () => void
  onSetTypewriter: () => void
}

const BOOK_LEXICAL_THEME = {
  root: 'fw-book-lexical__root'
}

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

function createEditorState(document: BookDocument): InitialEditorStateType {
  return () => {
    const root = $getRoot()
    root.clear()

    for (const node of document.nodes) {
      const elementNode = $createBookElementNode(getNodeClassName(node), getNodeTagName(node))
      const text = getNodeText(node)
      if (text) elementNode.append($createTextNode(text))
      root.append(elementNode)
    }
  }
}

export function FocusWriterBookSurface({
  document,
  modeLabel,
  typewriter,
  onClose,
  onPreview,
  onSetDynamic,
  onSetTypewriter
}: FocusWriterBookSurfaceProps): JSX.Element {
  const editorConfig = useMemo(
    () => ({
      namespace: 'focus-writer-book-readonly',
      editable: false,
      theme: BOOK_LEXICAL_THEME,
      nodes: BOOK_LEXICAL_NODES,
      editorState: createEditorState(document),
      onError: (error: Error) => {
        throw error
      }
    }),
    [document]
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
        <LexicalComposer key={document.text} initialConfig={editorConfig}>
          <RichTextPlugin
            contentEditable={<ContentEditable className="fw-book-lexical__content" />}
            placeholder={null}
            ErrorBoundary={LexicalErrorBoundary}
          />
        </LexicalComposer>
      </div>
      <span className="fw-editor__mode-indicator" aria-hidden="true">
        {modeLabel}
      </span>
    </div>
  )
}
