import {
  $applyNodeReplacement,
  ElementNode,
  type LexicalNode,
  type NodeKey,
  type SerializedElementNode
} from 'lexical'

type SerializedBookElementNode = SerializedElementNode & {
  className: string
  editable: boolean
  nodeIndex: number
  tagName: string
}

class BookElementNode extends ElementNode {
  __className: string
  __editable: boolean
  __nodeIndex: number
  __tagName: string

  static getType(): string {
    return 'book-element'
  }

  static clone(node: BookElementNode): BookElementNode {
    return new BookElementNode(
      node.__className,
      node.__tagName,
      node.__nodeIndex,
      node.__editable,
      node.__key
    )
  }

  static importJSON(serializedNode: SerializedBookElementNode): BookElementNode {
    return $createBookElementNode(
      serializedNode.className,
      serializedNode.tagName,
      serializedNode.nodeIndex,
      serializedNode.editable
    ).updateFromJSON(serializedNode)
  }

  constructor(className: string, tagName = 'div', nodeIndex = -1, editable = true, key?: NodeKey) {
    super(key)
    this.__className = className
    this.__editable = editable
    this.__nodeIndex = nodeIndex
    this.__tagName = tagName
  }

  getNodeIndex(): number {
    return this.getLatest().__nodeIndex
  }

  createDOM(): HTMLElement {
    const element = document.createElement(this.__tagName)
    element.className = this.__className
    if (!this.__editable) element.contentEditable = 'false'
    return element
  }

  updateDOM(prevNode: BookElementNode, dom: HTMLElement): boolean {
    if (prevNode.__tagName !== this.__tagName) return true
    if (prevNode.__className !== this.__className) {
      dom.className = this.__className
    }
    if (prevNode.__editable !== this.__editable) {
      if (this.__editable) {
        dom.removeAttribute('contenteditable')
      } else {
        dom.contentEditable = 'false'
      }
    }
    return false
  }

  exportJSON(): SerializedBookElementNode {
    return {
      ...super.exportJSON(),
      type: 'book-element',
      version: 1,
      className: this.__className,
      editable: this.__editable,
      nodeIndex: this.__nodeIndex,
      tagName: this.__tagName
    }
  }
}

export const BOOK_LEXICAL_NODES = [BookElementNode]

export function $createBookElementNode(
  className: string,
  tagName = 'div',
  nodeIndex = -1,
  editable = true
): BookElementNode {
  return $applyNodeReplacement(new BookElementNode(className, tagName, nodeIndex, editable))
}

export function $isBookElementNode(node: LexicalNode | null | undefined): node is BookElementNode {
  return node instanceof BookElementNode
}
