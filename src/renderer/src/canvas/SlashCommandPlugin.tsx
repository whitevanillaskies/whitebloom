import { createPortal } from 'react-dom'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext'
import {
  $createParagraphNode,
  $getSelection,
  $isElementNode,
  $isRangeSelection,
  $isTextNode,
  COMMAND_PRIORITY_HIGH,
  KEY_DOWN_COMMAND,
  type LexicalCommand,
  type ElementNode,
  type RangeSelection,
} from 'lexical'
import { $setBlocksType } from '@lexical/selection'
import { $createHeadingNode, $createQuoteNode } from '@lexical/rich-text'
import { INSERT_ORDERED_LIST_COMMAND, INSERT_UNORDERED_LIST_COMMAND } from '@lexical/list'
import './SlashCommandPlugin.css'

// ── Block definitions ─────────────────────────────────────────────

type BlockDef =
  | { id: string; label: string; keywords: string[]; kind: 'block'; create: () => ElementNode }
  | { id: string; label: string; keywords: string[]; kind: 'list'; command: LexicalCommand<void> }

const BLOCKS: BlockDef[] = [
  {
    id: 'paragraph',
    label: 'Paragraph',
    keywords: ['paragraph', 'text', 'p'],
    kind: 'block',
    create: () => $createParagraphNode(),
  },
  {
    id: 'h1',
    label: 'Heading 1',
    keywords: ['heading', 'h1', 'title'],
    kind: 'block',
    create: () => $createHeadingNode('h1'),
  },
  {
    id: 'h2',
    label: 'Heading 2',
    keywords: ['heading', 'h2', 'subtitle'],
    kind: 'block',
    create: () => $createHeadingNode('h2'),
  },
  {
    id: 'h3',
    label: 'Heading 3',
    keywords: ['heading', 'h3'],
    kind: 'block',
    create: () => $createHeadingNode('h3'),
  },
  {
    id: 'bullet',
    label: 'Bulleted List',
    keywords: ['bullet', 'list', 'ul', 'unordered'],
    kind: 'list',
    command: INSERT_UNORDERED_LIST_COMMAND,
  },
  {
    id: 'numbered',
    label: 'Numbered List',
    keywords: ['number', 'numbered', 'list', 'ol', 'ordered'],
    kind: 'list',
    command: INSERT_ORDERED_LIST_COMMAND,
  },
  {
    id: 'quote',
    label: 'Quote',
    keywords: ['quote', 'blockquote'],
    kind: 'block',
    create: () => $createQuoteNode(),
  },
]

function filterBlocks(query: string): BlockDef[] {
  if (!query) return BLOCKS
  const q = query.toLowerCase()
  return BLOCKS.filter(
    (b) => b.label.toLowerCase().includes(q) || b.keywords.some((k) => k.startsWith(q))
  )
}

// ── Menu UI ───────────────────────────────────────────────────────

type SlashMenuProps = {
  items: BlockDef[]
  activeIndex: number
  position: { top: number; left: number }
  onSelect: (item: BlockDef) => void
  onHover: (index: number) => void
}

function SlashMenu({ items, activeIndex, position, onSelect, onHover }: SlashMenuProps) {
  const activeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex])

  return (
    <div
      className="slash-menu"
      style={{ top: position.top, left: position.left }}
      onMouseDown={(e) => e.preventDefault()}
    >
      {items.length === 0 ? (
        <div className="slash-menu__empty">No results</div>
      ) : (
        items.map((item, i) => (
          <button
            key={item.id}
            ref={i === activeIndex ? activeRef : null}
            className={`slash-menu__item${i === activeIndex ? ' slash-menu__item--active' : ''}`}
            onClick={() => onSelect(item)}
            onMouseEnter={() => onHover(i)}
            tabIndex={-1}
          >
            {item.label}
          </button>
        ))
      )}
    </div>
  )
}

// ── Plugin ────────────────────────────────────────────────────────

type MenuState = {
  query: string
  position: { top: number; left: number }
}

function getActiveSlash(selection: RangeSelection): { query: string; offset: number } | null {
  if (!selection.isCollapsed()) return null

  const anchorNode = selection.anchor.getNode()
  if (!$isTextNode(anchorNode)) return null

  const offset = selection.anchor.offset
  if (offset < 1) return null

  const textBeforeCaret = anchorNode.getTextContent().slice(0, offset)
  if (!textBeforeCaret.startsWith('/')) return null

  const query = textBeforeCaret.slice(1)
  if (query.includes(' ')) return null

  // Only trigger slash-menu when slash starts at the beginning of the block.
  const parent = anchorNode.getParent()
  if (!$isElementNode(parent)) return null

  const firstText = parent.getFirstDescendant()
  if (!$isTextNode(firstText) || firstText.getKey() !== anchorNode.getKey()) return null

  return { query, offset }
}

export function SlashCommandPlugin() {
  const [editor] = useLexicalComposerContext()
  const [menuState, setMenuState] = useState<MenuState | null>(null)
  const [activeIndex, setActiveIndex] = useState(0)
  const menuStateRef = useRef<MenuState | null>(null)
  menuStateRef.current = menuState

  const closeMenu = useCallback(() => {
    setMenuState(null)
    setActiveIndex(0)
  }, [])

  // ── Watch editor state for slash trigger ──────────────────────────
  useEffect(() => {
    let rafId: number | null = null

    const unregister = editor.registerUpdateListener(() => {
      if (rafId !== null) cancelAnimationFrame(rafId)

      rafId = requestAnimationFrame(() => {
        rafId = null

        const activeQuery = editor.getEditorState().read(() => {
          const selection = $getSelection()
          if (!$isRangeSelection(selection)) return null
          return getActiveSlash(selection)?.query ?? null
        })

        if (activeQuery === null) {
          setMenuState(null)
          return
        }

        const domSel = window.getSelection()
        if (!domSel || domSel.rangeCount === 0) {
          setMenuState(null)
          return
        }

        const rect = domSel.getRangeAt(0).getBoundingClientRect()
        const nextPosition = { top: rect.bottom + 6, left: rect.left }

        const prevQuery = menuStateRef.current?.query
        if (prevQuery !== activeQuery) {
          setActiveIndex(0)
        }
        setMenuState({ query: activeQuery, position: nextPosition })
      })
    })

    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId)
      unregister()
    }
  }, [editor])

  // ── Apply a block item ────────────────────────────────────────────
  const applyBlock = useCallback(
    (item: BlockDef) => {
      editor.update(() => {
        const selection = $getSelection()
        if (!$isRangeSelection(selection)) return

        const activeSlash = getActiveSlash(selection)
        if (activeSlash) {
          const node = selection.anchor.getNode()
          if ($isTextNode(node)) {
            // Move selection with the mutation so follow-up block transforms keep a valid caret.
            node.spliceText(0, activeSlash.offset, '', true)
          }
        }

        if (item.kind === 'block') {
          const newSel = $getSelection()
          if ($isRangeSelection(newSel)) {
            $setBlocksType(newSel, item.create)
          }
        }
      })

      if (item.kind === 'list') {
        editor.dispatchCommand(item.command, undefined)
      }

      closeMenu()
    },
    [editor, closeMenu]
  )

  // ── Keyboard navigation ───────────────────────────────────────────
  useEffect(() => {
    if (!menuState) return

    return editor.registerCommand(
      KEY_DOWN_COMMAND,
      (e) => {
        if (!(e instanceof KeyboardEvent)) return false

        if (e.key === 'Escape') {
          e.preventDefault()
          // Delete the slash text and close without transforming
          editor.update(() => {
            const selection = $getSelection()
            if (!$isRangeSelection(selection)) return

            const activeSlash = getActiveSlash(selection)
            if (!activeSlash) return

            const node = selection.anchor.getNode()
            if ($isTextNode(node)) {
              node.spliceText(0, activeSlash.offset, '', true)
            }
          })
          closeMenu()
          return true
        }

        if (e.key === 'ArrowDown') {
          const currentItems = filterBlocks(menuStateRef.current?.query ?? '')
          e.preventDefault()
          setActiveIndex((i) => (i + 1) % Math.max(1, currentItems.length))
          return true
        }

        if (e.key === 'ArrowUp') {
          const currentItems = filterBlocks(menuStateRef.current?.query ?? '')
          e.preventDefault()
          setActiveIndex(
            (i) => (i - 1 + Math.max(1, currentItems.length)) % Math.max(1, currentItems.length)
          )
          return true
        }

        if (e.key === 'Enter') {
          const currentItems = filterBlocks(menuStateRef.current?.query ?? '')
          const item = currentItems[activeIndex]
          if (!item && currentItems.length > 0) {
            e.preventDefault()
            applyBlock(currentItems[0])
            return true
          }
          if (item) {
            e.preventDefault()
            applyBlock(item)
            return true
          }
          return false
        }

        return false
      },
      COMMAND_PRIORITY_HIGH
    )
  }, [editor, menuState, activeIndex, applyBlock, closeMenu])

  if (!menuState) return null

  return createPortal(
    <SlashMenu
      items={filterBlocks(menuState.query)}
      activeIndex={activeIndex}
      position={menuState.position}
      onSelect={applyBlock}
      onHover={setActiveIndex}
    />,
    document.body
  )
}
