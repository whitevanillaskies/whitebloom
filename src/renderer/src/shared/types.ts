export type Position = { x: number; y: number }
export type Size = { w: number; h: number }
export type WidthMode = 'auto' | 'fixed'

export type BoardNode = {
  id: string
  kind: 'bud' | 'leaf'
  type: string
  position: Position
  size: Size
  label?: string
  content?: string // Lexical EditorState JSON
  plain?: string // Plain-text mirror of content for agents/LLMs
  widthMode?: WidthMode
  wrapWidth?: number | null
  resource?: string
}

export type BoardEdge = {
  id: string
  from: string
  to: string
  label?: string
}

export type Board = {
  version: number
  nodes: BoardNode[]
  edges: BoardEdge[]
}

/** Create a minimal Lexical EditorState JSON for a plain-text string. */
export function makeLexicalContent(text: string): string {
  return JSON.stringify({
    root: {
      children: [
        {
          children: [
            { detail: 0, format: 0, mode: 'normal', style: '', text, type: 'text', version: 1 }
          ],
          direction: 'ltr',
          format: '',
          indent: 0,
          type: 'paragraph',
          version: 1
        }
      ],
      direction: 'ltr',
      format: '',
      indent: 0,
      type: 'root',
      version: 1
    }
  })
}

type LexicalJsonNode = {
  type?: string
  text?: string
  children?: LexicalJsonNode[]
}

const BLOCK_NODE_TYPES = new Set(['paragraph', 'heading', 'quote', 'listitem'])

function collectLexicalText(node: LexicalJsonNode | undefined): string {
  if (!node) return ''

  if (node.type === 'text') {
    return node.text ?? ''
  }

  if (!Array.isArray(node.children)) {
    return ''
  }

  return node.children.map((child) => collectLexicalText(child)).join('')
}

function collectLexicalPlainText(node: LexicalJsonNode | undefined): string {
  if (!node) return ''

  if (node.type === 'text') {
    return node.text ?? ''
  }

  if (node.type === 'linebreak') {
    return '\n'
  }

  if (!Array.isArray(node.children)) {
    return ''
  }

  const text = node.children.map((child) => collectLexicalPlainText(child)).join('')
  if (text.length === 0) return ''

  return BLOCK_NODE_TYPES.has(node.type ?? '') ? `${text}\n` : text
}

/** Convert Lexical EditorState JSON into plain text for machine-friendly reading. */
export function lexicalContentToPlainText(content: string): string {
  try {
    const parsed = JSON.parse(content) as { root?: LexicalJsonNode }
    return collectLexicalPlainText(parsed.root)
      .replace(/\n{3,}/g, '\n\n')
      .trimEnd()
  } catch {
    return ''
  }
}

/** Return true when a Lexical EditorState JSON has no non-whitespace text content. */
export function isLexicalContentEmpty(content: string): boolean {
  try {
    const parsed = JSON.parse(content) as { root?: LexicalJsonNode }
    const plainText = collectLexicalText(parsed.root)
    return plainText.trim().length === 0
  } catch {
    // Treat malformed content as non-empty so we do not destroy user data.
    return false
  }
}
