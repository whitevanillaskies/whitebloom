import { describe, expect, it } from 'vitest'
import {
  findBookMarkupBlockAtOffset,
  parseBookMarkup,
  serializeBookMarkup
} from '../src/renderer/src/modules/focus-writer/bookMarkup'

describe('focus writer book markup parser', () => {
  it('keeps documents without a book type directive in plaintext mode', () => {
    expect(parseBookMarkup('Just a normal file.')).toEqual({
      mode: 'plaintext',
      text: 'Just a normal file.'
    })
  })

  it('treats the first meaningful book type directive as book mode', () => {
    const document = parseBookMarkup('\n::type book\n::title The Work\n::author Ada\n')

    expect(document.mode).toBe('book')
    if (document.mode !== 'book') return

    expect(document.metadata).toEqual({
      type: 'book',
      title: 'The Work',
      author: 'Ada'
    })
    expect(document.blocks).toMatchObject([
      { kind: 'metadata', name: 'type', value: 'book' },
      { kind: 'metadata', name: 'title', value: 'The Work' },
      { kind: 'metadata', name: 'author', value: 'Ada' }
    ])
  })

  it('parses headings as author-defined hierarchy', () => {
    const document = parseBookMarkup('::type book\n\n# One\n## Two\n### Three\n#### Four\n')

    expect(document.mode).toBe('book')
    if (document.mode !== 'book') return

    expect(document.blocks).toMatchObject([
      { kind: 'metadata', name: 'type' },
      { kind: 'heading', depth: 1, text: 'One' },
      { kind: 'heading', depth: 2, text: 'Two' },
      { kind: 'heading', depth: 3, text: 'Three' },
      { kind: 'paragraph', text: '#### Four' }
    ])
  })

  it('parses blank-line terminated margin and note blocks', () => {
    const document = parseBookMarkup(
      [
        '::type book',
        '',
        '::margin',
        'This sits in the margin.',
        'Still margin.',
        '',
        'Body text.',
        '',
        '::note',
        'Muted thought.',
        '',
        'More body.'
      ].join('\n')
    )

    expect(document.mode).toBe('book')
    if (document.mode !== 'book') return

    expect(document.blocks).toMatchObject([
      { kind: 'metadata', name: 'type' },
      { kind: 'margin', form: 'block', value: 'This sits in the margin.\nStill margin.' },
      { kind: 'paragraph', text: 'Body text.' },
      { kind: 'note', form: 'block', value: 'Muted thought.' },
      { kind: 'paragraph', text: 'More body.' }
    ])
  })

  it('parses inline notes without consuming the next paragraph', () => {
    const document = parseBookMarkup('::type book\n\nBody.\n::note Check timeline.\nStill body.\n')

    expect(document.mode).toBe('book')
    if (document.mode !== 'book') return

    expect(document.blocks).toMatchObject([
      { kind: 'metadata', name: 'type' },
      { kind: 'paragraph', text: 'Body.' },
      { kind: 'note', form: 'inline', value: 'Check timeline.' },
      { kind: 'paragraph', text: 'Still body.' }
    ])
  })

  it('finds the book block containing a caret offset', () => {
    const text = '::type book\n\n::note\nRemember this.\n\nMain text.'
    const document = parseBookMarkup(text)
    const noteOffset = text.indexOf('Remember')
    const blankOffset = text.indexOf('\n\nMain') + 1
    const bodyOffset = text.indexOf('Main')

    expect(findBookMarkupBlockAtOffset(document, noteOffset)).toMatchObject({ kind: 'note' })
    expect(findBookMarkupBlockAtOffset(document, blankOffset)).toBe(null)
    expect(findBookMarkupBlockAtOffset(document, bodyOffset)).toMatchObject({ kind: 'paragraph' })
  })

  it('preserves separators in the full AST stream', () => {
    const document = parseBookMarkup('::type book\n\n\n# One\n\nBody.')

    expect(document.mode).toBe('book')
    if (document.mode !== 'book') return

    expect(document.nodes).toMatchObject([
      { kind: 'metadata', name: 'type' },
      { kind: 'separator', source: '\n\n' },
      { kind: 'heading', text: 'One' },
      { kind: 'separator', source: '\n' },
      { kind: 'paragraph', text: 'Body.' }
    ])
  })

  it('keeps unknown directives as raw nodes outside the semantic block list', () => {
    const document = parseBookMarkup('::type book\n\n::dedication\nFor A.\n\nBody.')

    expect(document.mode).toBe('book')
    if (document.mode !== 'book') return

    expect(document.blocks).toMatchObject([
      { kind: 'metadata', name: 'type' },
      { kind: 'paragraph', text: 'Body.' }
    ])
    expect(document.nodes).toMatchObject([
      { kind: 'metadata', name: 'type' },
      { kind: 'separator' },
      { kind: 'raw', reason: 'unknown-directive', text: '::dedication\nFor A.' },
      { kind: 'separator' },
      { kind: 'paragraph', text: 'Body.' }
    ])
  })

  it('serializes parsed book markup back to source text', () => {
    const source = [
      '::type book',
      '::title My Book',
      '',
      '# One',
      '',
      '::margin',
      'Side thought.',
      '',
      'Body text.',
      '::unknown Preserve me.',
      '',
      '::note Inline note.'
    ].join('\n')

    expect(serializeBookMarkup(parseBookMarkup(source))).toBe(source)
  })

  it('serializes semantic field edits canonically while preserving separators and raw nodes', () => {
    const document = parseBookMarkup('::type book\n\n# One\n\n::unknown Preserve me.\n')

    expect(document.mode).toBe('book')
    if (document.mode !== 'book') return

    const heading = document.blocks.find((block) => block.kind === 'heading')
    if (!heading || heading.kind !== 'heading') return
    heading.text = 'Two'

    expect(serializeBookMarkup(document)).toBe('::type book\n\n# Two\n\n::unknown Preserve me.\n')
  })
})
