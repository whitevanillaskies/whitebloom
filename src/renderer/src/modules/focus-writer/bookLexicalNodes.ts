import {
  $applyNodeReplacement,
  ElementNode,
  type LexicalNode,
  type NodeKey,
  type SerializedElementNode
} from 'lexical'

type SerializedBookElementNode = SerializedElementNode & {
  className: string
  tagName: string
}

class BookElementNode extends ElementNode {
  __className: string
  __tagName: string

  static getType(): string {
    return 'book-element'
  }

  static clone(node: BookElementNode): BookElementNode {
    return new BookElementNode(node.__className, node.__tagName, node.__key)
  }

  static importJSON(serializedNode: SerializedBookElementNode): BookElementNode {
    return $createBookElementNode(serializedNode.className, serializedNode.tagName).updateFromJSON(
      serializedNode
    )
  }

  constructor(className: string, tagName = 'div', key?: NodeKey) {
    super(key)
    this.__className = className
    this.__tagName = tagName
  }

  createDOM(): HTMLElement {
    const element = document.createElement(this.__tagName)
    element.className = this.__className
    return element
  }

  updateDOM(prevNode: BookElementNode, dom: HTMLElement): boolean {
    if (prevNode.__tagName !== this.__tagName) return true
    if (prevNode.__className !== this.__className) {
      dom.className = this.__className
    }
    return false
  }

  exportJSON(): SerializedBookElementNode {
    return {
      ...super.exportJSON(),
      type: 'book-element',
      version: 1,
      className: this.__className,
      tagName: this.__tagName
    }
  }
}

export const BOOK_LEXICAL_NODES = [BookElementNode]

export function $createBookElementNode(className: string, tagName = 'div'): BookElementNode {
  return $applyNodeReplacement(new BookElementNode(className, tagName))
}

export function $isBookElementNode(node: LexicalNode | null | undefined): node is BookElementNode {
  return node instanceof BookElementNode
}
