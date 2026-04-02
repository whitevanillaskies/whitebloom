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
