export const SCHEMA_VERSION = 1

export type Position = {
  x: number
  y: number
}

export type Column = {
  id: string
  name: string
  isKey: boolean
  nullable: boolean
  type: string
}

// The defaults for optional column fields. When loading an old schema that
// doesn't have these fields, normalizeColumn fills them in from here.
// When creating a new column, we spread these in too — single source of truth.
const COLUMN_DEFAULTS = {
  isKey: false,
  nullable: false,
  type: 'text'
} as const satisfies Partial<Column>

export type Table = {
  id: string
  name: string
  position: Position
  columns: Column[]
}

export type Relationship = {
  id: string
  fromColumnId: string
  toColumnId: string
}

export type SchemaMeta = {
  version: number
}

export type SchemaDocument = {
  meta: SchemaMeta
  tables: Table[]
  relationships: Relationship[]
}

export type CreateTableInput = {
  name?: string
  position?: Position
}

function makeId(prefix: string): string {
  const random =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().replace(/-/g, '')
      : Math.random().toString(36).slice(2)

  return `${prefix}_${random}`
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

function isPosition(value: unknown): value is Position {
  if (!value || typeof value !== 'object') return false

  const v = value as Record<string, unknown>
  return isFiniteNumber(v.x) && isFiniteNumber(v.y)
}

// Validates that value has the minimum fields a column has always had.
// New optional fields (nullable, type, etc.) are NOT checked here —
// they get filled in by normalizeColumn after validation passes.
function isColumnLike(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false

  const v = value as Record<string, unknown>
  return typeof v.id === 'string' && typeof v.name === 'string'
}

// Fills in defaults for any fields missing from an older schema version.
function normalizeColumn(raw: Record<string, unknown>): Column {
  return {
    id: raw.id as string,
    name: raw.name as string,
    isKey: typeof raw.isKey === 'boolean' ? raw.isKey : COLUMN_DEFAULTS.isKey,
    nullable: typeof raw.nullable === 'boolean' ? raw.nullable : COLUMN_DEFAULTS.nullable,
    type: typeof raw.type === 'string' ? raw.type : COLUMN_DEFAULTS.type
  }
}

function isTable(value: unknown): value is Table {
  if (!value || typeof value !== 'object') return false

  const v = value as Record<string, unknown>
  return (
    typeof v.id === 'string' &&
    typeof v.name === 'string' &&
    isPosition(v.position) &&
    Array.isArray(v.columns) &&
    v.columns.every(isColumnLike)
  )
}

function isRelationship(value: unknown): value is Relationship {
  if (!value || typeof value !== 'object') return false

  const v = value as Record<string, unknown>
  return (
    typeof v.id === 'string' &&
    typeof v.fromColumnId === 'string' &&
    typeof v.toColumnId === 'string'
  )
}

function isSchemaDocument(value: unknown): value is SchemaDocument {
  if (!value || typeof value !== 'object') return false

  const v = value as Record<string, unknown>
  const meta = v.meta as Record<string, unknown> | undefined
  return (
    !!meta &&
    typeof meta.version === 'number' &&
    Array.isArray(v.tables) &&
    v.tables.every(isTable) &&
    Array.isArray(v.relationships) &&
    v.relationships.every(isRelationship)
  )
}

export function createEmptySchema(): SchemaDocument {
  return {
    meta: { version: SCHEMA_VERSION },
    tables: [],
    relationships: []
  }
}

export function createTable(
  schema: SchemaDocument,
  input: CreateTableInput = {}
): { schema: SchemaDocument; table: Table } {
  const table: Table = {
    id: makeId('t'),
    name: input.name?.trim() || 'table',
    position: input.position ?? { x: 120, y: 80 },
    columns: []
  }

  return {
    schema: {
      ...schema,
      tables: [...schema.tables, table]
    },
    table
  }
}

export function renameTable(
  schema: SchemaDocument,
  tableId: string,
  newName: string
): SchemaDocument {
  const trimmed = newName.trim()
  if (!trimmed) return schema

  return {
    ...schema,
    tables: schema.tables.map((table) =>
      table.id === tableId ? { ...table, name: trimmed } : table
    )
  }
}

export function addColumn(
  schema: SchemaDocument,
  tableId: string
): { schema: SchemaDocument; column: Column } {
  const column: Column = {
    id: makeId('c'),
    name: 'column',
    ...COLUMN_DEFAULTS
  }

  return {
    schema: {
      ...schema,
      tables: schema.tables.map((table) =>
        table.id === tableId
          ? { ...table, columns: [...table.columns, column] }
          : table
      )
    },
    column
  }
}

export function renameColumn(
  schema: SchemaDocument,
  tableId: string,
  columnId: string,
  newName: string
): SchemaDocument {
  const trimmed = newName.trim()
  if (!trimmed) return schema

  return {
    ...schema,
    tables: schema.tables.map((table) =>
      table.id === tableId
        ? {
            ...table,
            columns: table.columns.map((col) =>
              col.id === columnId ? { ...col, name: trimmed } : col
            )
          }
        : table
    )
  }
}

export function dropColumn(
  schema: SchemaDocument,
  tableId: string,
  columnId: string
): SchemaDocument {
  return {
    ...schema,
    tables: schema.tables.map((table) =>
      table.id === tableId
        ? { ...table, columns: table.columns.filter((col) => col.id !== columnId) }
        : table
    ),
    relationships: schema.relationships.filter(
      (r) => r.fromColumnId !== columnId && r.toColumnId !== columnId
    )
  }
}

function findTableForColumn(schema: SchemaDocument, columnId: string): Table | undefined {
  return schema.tables.find((t) => t.columns.some((c) => c.id === columnId))
}

// De-duplicate key: sorted pair so A→B and B→A are treated as the same link.
function relationshipKey(fromColumnId: string, toColumnId: string): string {
  const a = fromColumnId < toColumnId ? fromColumnId : toColumnId
  const b = fromColumnId < toColumnId ? toColumnId : fromColumnId
  return `${a}::${b}`
}

export function addRelationship(
  schema: SchemaDocument,
  fromColumnId: string,
  toColumnId: string
): SchemaDocument {
  // Prevent self-links
  if (fromColumnId === toColumnId) return schema

  // Prevent same-table links
  const fromTable = findTableForColumn(schema, fromColumnId)
  const toTable = findTableForColumn(schema, toColumnId)
  if (!fromTable || !toTable || fromTable.id === toTable.id) return schema

  // Prevent duplicates
  const key = relationshipKey(fromColumnId, toColumnId)
  const exists = schema.relationships.some(
    (r) => relationshipKey(r.fromColumnId, r.toColumnId) === key
  )
  if (exists) return schema

  const relationship: Relationship = {
    id: makeId('r'),
    fromColumnId,
    toColumnId
  }

  return {
    ...schema,
    relationships: [...schema.relationships, relationship]
  }
}

export function dropRelationship(schema: SchemaDocument, relationshipId: string): SchemaDocument {
  return {
    ...schema,
    relationships: schema.relationships.filter((r) => r.id !== relationshipId)
  }
}

export function dropTable(schema: SchemaDocument, tableId: string): SchemaDocument {
  const droppedColumnIds = new Set(
    schema.tables.find((t) => t.id === tableId)?.columns.map((c) => c.id) ?? []
  )
  return {
    ...schema,
    tables: schema.tables.filter((table) => table.id !== tableId),
    relationships: schema.relationships.filter(
      (r) => !droppedColumnIds.has(r.fromColumnId) && !droppedColumnIds.has(r.toColumnId)
    )
  }
}

export function saveSchema(schema: SchemaDocument): string {
  return JSON.stringify(schema, null, 2)
}

export function loadSchema(serialized: string): SchemaDocument {
  let parsed: unknown

  try {
    parsed = JSON.parse(serialized)
  } catch {
    throw new Error('Invalid schema JSON.')
  }

  if (!isSchemaDocument(parsed)) {
    throw new Error('Invalid schema shape.')
  }

  if (parsed.meta.version !== SCHEMA_VERSION) {
    throw new Error(
      `Unsupported schema version ${parsed.meta.version}. Expected ${SCHEMA_VERSION}.`
    )
  }

  // Normalize: fill in defaults for any fields added after the file was saved.
  // This is what makes old files forward-compatible — isSchemaDocument checks
  // the minimum shape, and normalizeColumn fills in the rest.
  return {
    ...parsed,
    tables: parsed.tables.map((table) => ({
      ...table,
      columns: table.columns.map((col) =>
        normalizeColumn(col as unknown as Record<string, unknown>)
      )
    }))
  }
}
