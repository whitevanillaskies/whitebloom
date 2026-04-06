import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Background,
  type Connection,
  type Edge,
  type Node,
  type NodeChange,
  Panel,
  ReactFlow,
  applyNodeChanges
} from '@xyflow/react'
import type { BudEditorProps } from '../types'
import CanvasToolbar from './CanvasToolbar'
import TableNode from './TableNode'
import {
  addColumn,
  addRelationship,
  createEmptySchema,
  createTable,
  dropColumn,
  dropTable,
  loadSchema,
  renameColumn,
  renameTable,
  saveSchema,
  type SchemaDocument
} from './schema'
import './SchemaBloomEditor.css'
import '@xyflow/react/dist/style.css'

const AUTOSAVE_DELAY_MS = 400

export function SchemaBloomEditor({ initialData, onSave, onClose }: BudEditorProps): JSX.Element {
  const [schema, setSchema] = useState<SchemaDocument>(() => {
    try {
      return loadSchema(initialData)
    } catch {
      return createEmptySchema()
    }
  })

  const schemaRef = useRef(schema)
  schemaRef.current = schema

  const nodeTypes = useMemo(() => ({ tableNode: TableNode }), [])

  // ── Autosave ────────────────────────────────────────────────────
  // Skip the initial mount so we don't immediately re-save what we just loaded.
  // Schema mutations are discrete events, so the debounce is a safety net.
  const isMountedRef = useRef(false)

  useEffect(() => {
    if (!isMountedRef.current) {
      isMountedRef.current = true
      return
    }
    const timer = setTimeout(() => {
      onSave(saveSchema(schema)).catch(() => {})
    }, AUTOSAVE_DELAY_MS)
    return () => clearTimeout(timer)
  }, [schema, onSave])

  // ── Escape to close ─────────────────────────────────────────────
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  // ── Schema mutation callbacks ───────────────────────────────────

  const onRenameTable = useCallback((tableId: string, newName: string) => {
    setSchema((s) => renameTable(s, tableId, newName))
  }, [])

  const onAddColumn = useCallback((tableId: string) => {
    setSchema((s) => addColumn(s, tableId).schema)
  }, [])

  const onRenameColumn = useCallback((tableId: string, columnId: string, newName: string) => {
    setSchema((s) => renameColumn(s, tableId, columnId, newName))
  }, [])

  const onDropColumn = useCallback((tableId: string, columnId: string) => {
    setSchema((s) => dropColumn(s, tableId, columnId))
  }, [])

  const onAddTable = useCallback(() => {
    const current = schemaRef.current
    const nextPosition = {
      x: 120 + current.tables.length * 40,
      y: 80 + current.tables.length * 24
    }
    setSchema((s) => createTable(s, { position: nextPosition }).schema)
  }, [])

  // ── Manual save (toolbar button) ────────────────────────────────
  const onSaveManual = useCallback(() => {
    onSave(saveSchema(schemaRef.current)).catch(() => {})
  }, [onSave])

  // ── Connection handling ─────────────────────────────────────────
  const onConnect = useCallback((connection: Connection) => {
    const fromColumnId = connection.sourceHandle?.replace(/-source$/, '')
    const toColumnId = connection.targetHandle?.replace(/-target$/, '')
    if (!fromColumnId || !toColumnId) return
    setSchema((s) => addRelationship(s, fromColumnId, toColumnId))
  }, [])

  const isValidConnection = useCallback((connection: Connection | Edge) => {
    return connection.source !== connection.target
  }, [])

  // ── Derive ReactFlow edges from schema ──────────────────────────
  const edges: Edge[] = useMemo(
    () =>
      schema.relationships.map((rel) => ({
        id: rel.id,
        source: schema.tables.find((t) => t.columns.some((c) => c.id === rel.fromColumnId))!.id,
        target: schema.tables.find((t) => t.columns.some((c) => c.id === rel.toColumnId))!.id,
        sourceHandle: `${rel.fromColumnId}-source`,
        targetHandle: `${rel.toColumnId}-target`
      })),
    [schema]
  )

  // ── Derive ReactFlow nodes from schema ──────────────────────────
  const schemaNodes: Node[] = useMemo(
    () =>
      schema.tables.map((table) => ({
        id: table.id,
        position: table.position,
        type: 'tableNode' as const,
        data: {
          tableName: table.name,
          columns: table.columns,
          onRename: (newName: string) => onRenameTable(table.id, newName),
          onAddColumn: () => onAddColumn(table.id),
          onRenameColumn: (colId: string, newName: string) =>
            onRenameColumn(table.id, colId, newName),
          onDropColumn: (colId: string) => onDropColumn(table.id, colId)
        }
      })),
    [schema, onRenameTable, onAddColumn, onRenameColumn, onDropColumn]
  )

  // ReactFlow owns node positions during drag — keep local state that syncs
  // back from schemaNodes whenever schema changes (but not mid-drag).
  const [nodes, setNodes] = useState<Node[]>(schemaNodes)

  useEffect(() => {
    setNodes(schemaNodes)
  }, [schemaNodes])

  // ── ReactFlow change handler ────────────────────────────────────
  const onNodesChange = useCallback((changes: NodeChange<Node>[]) => {
    setNodes((nds) => applyNodeChanges(changes, nds))

    // Sync drag-end positions back to schema
    const endedPositions = changes.filter(
      (c): c is Extract<NodeChange<Node>, { type: 'position' }> =>
        c.type === 'position' && c.dragging === false
    )
    if (endedPositions.length > 0) {
      setSchema((s) => ({
        ...s,
        tables: s.tables.map((table) => {
          const change = endedPositions.find((c) => c.id === table.id)
          return change?.position ? { ...table, position: change.position } : table
        })
      }))
    }

    // Remove deleted tables from schema (node id = table id)
    const removals = changes.filter(
      (c): c is Extract<NodeChange<Node>, { type: 'remove' }> => c.type === 'remove'
    )
    if (removals.length > 0) {
      setSchema((s) => removals.reduce((acc, r) => dropTable(acc, r.id), s))
    }
  }, [])

  // ── Keyboard shortcuts ──────────────────────────────────────────
  const nodesRef = useRef(nodes)
  nodesRef.current = nodes

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.repeat) return
      const target = e.target as HTMLElement | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return

      const key = e.key.toLowerCase()
      if (key === 't') {
        e.preventDefault()
        onAddTable()
      } else if (key === 'c') {
        const selected = nodesRef.current.filter((n) => n.selected)
        if (selected.length === 0) return
        e.preventDefault()
        for (const node of selected) onAddColumn(node.id)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onAddTable, onAddColumn])

  // ── Render ──────────────────────────────────────────────────────

  return (
    <div className="sbe-root">
      <ReactFlow
        nodes={nodes}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        edges={edges}
        onConnect={onConnect}
        isValidConnection={isValidConnection}
        deleteKeyCode="Delete"
        fitView
      >
        <Background gap={24} size={1} color="rgba(0,0,0,0.06)" />
        <Panel position="bottom-center">
          <CanvasToolbar onAddTable={onAddTable} onSave={onSaveManual} />
        </Panel>
      </ReactFlow>
    </div>
  )
}
