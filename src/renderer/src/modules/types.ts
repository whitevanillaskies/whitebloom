import type React from 'react'
import type { Size } from '../shared/types'

export interface BudNodeProps {
  id: string
  label?: string
  /** `wloc:` or `file:` URI — unresolved; component resolves if needed */
  resource: string
  size: Size
  selected: boolean
  /** Called by double-click; dispatched by BudNode wrapper */
  onBloom: () => void
}

export interface BudEditorProps {
  /** `wloc:` URI of the blossom file */
  resource: string
  workspaceRoot: string
  /** Raw file contents as returned by `blossom:read` */
  initialData: string
  onSave: (data: string) => Promise<void>
  onClose: () => void
}

export interface WhitebloomModule {
  /** e.g. `'com.whitebloom.focus-writer'` */
  id: string
  /** e.g. `['.md']` */
  extensions: string[]
  defaultRenderer: 'internal' | 'external'
  /** When present, marks this module as specific — first truthy result claims a dropped file */
  recognizes?(resource: string): boolean
  /** Default file content for palette-created buds */
  createDefault?(): string

  NodeComponent: React.ComponentType<BudNodeProps>
  /** Present only for `defaultRenderer: 'internal'` modules */
  EditorComponent?: React.ComponentType<BudEditorProps>
}
