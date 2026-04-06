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

  /**
   * React component that renders the module's icon.
   * Can be anything — a Lucide icon, a custom SVG, a PNG with transparency, etc.
   * Used in icon-style nodes, the palette, context menus, and any other UI
   * chrome that needs to represent this module type.
   */
  IconComponent: React.ComponentType<{ size?: number }>
  /**
   * CSS variable name for the module's accent color, e.g. `'--color-accent-blue'`.
   * Used as the badge background tint for icon-style nodes and anywhere the
   * module needs a consistent color identity across the UI.
   */
  accentColor: string

  NodeComponent: React.ComponentType<BudNodeProps>
  /** Present only for `defaultRenderer: 'internal'` modules */
  EditorComponent?: React.ComponentType<BudEditorProps>
}
