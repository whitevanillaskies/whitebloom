import { describe, expect, it } from 'vitest'
import {
  SCHEMA_VERSION,
  addColumn,
  addRelationship,
  createEmptySchema,
  createTable,
  dropColumn,
  dropRelationship,
  dropTable,
  loadSchema,
  renameColumn,
  renameTable,
  saveSchema
} from '../src/renderer/src/modules/schemabloom/schema'

describe('schemabloom schema', () => {
  it('creates a table with default name and position', () => {
    const schema = createEmptySchema()

    const result = createTable(schema)

    expect(result.schema.tables).toHaveLength(1)
    expect(result.table.name).toBe('table')
    expect(result.table.position).toEqual({ x: 120, y: 80 })
    expect(result.table.columns).toEqual([])
  })

  it('uses provided table input with trimming preserved in the stored name', () => {
    const schema = createEmptySchema()

    const result = createTable(schema, {
      name: '  Users  ',
      position: { x: 32, y: 64 }
    })

    expect(result.table.name).toBe('Users')
    expect(result.table.position).toEqual({ x: 32, y: 64 })
  })

  it('renames a table with trimmed text and ignores blank names', () => {
    const schema = createEmptySchema()
    const { schema: withTable, table } = createTable(schema, { name: 'Users' })

    const renamed = renameTable(withTable, table.id, '  Customers  ')
    const unchanged = renameTable(renamed, table.id, '   ')

    expect(renamed.tables[0].name).toBe('Customers')
    expect(unchanged.tables[0].name).toBe('Customers')
  })

  it('adds a column with schema defaults and renames it with trimmed text', () => {
    const schema = createEmptySchema()
    const { schema: withTable, table } = createTable(schema, { name: 'Users' })

    const added = addColumn(withTable, table.id)
    const renamed = renameColumn(added.schema, table.id, added.column.id, '  email  ')
    const unchanged = renameColumn(renamed, table.id, added.column.id, '   ')
    const column = unchanged.tables[0].columns[0]

    expect(column).toMatchObject({
      id: added.column.id,
      name: 'email',
      isKey: false,
      nullable: false,
      type: 'text'
    })
  })

  it('drops relationships connected to a dropped column', () => {
    const empty = createEmptySchema()

    const first = createTable(empty, { name: 'Users' })
    const second = createTable(first.schema, { name: 'Posts' })

    const firstColumn = addColumn(second.schema, first.table.id)
    const secondColumn = addColumn(firstColumn.schema, second.table.id)

    const withRelationship = addRelationship(
      secondColumn.schema,
      firstColumn.column.id,
      secondColumn.column.id
    )

    const afterDrop = dropColumn(withRelationship, first.table.id, firstColumn.column.id)

    expect(withRelationship.relationships).toHaveLength(1)
    expect(afterDrop.relationships).toHaveLength(0)
  })

  it('prevents invalid relationships', () => {
    const empty = createEmptySchema()
    const first = createTable(empty, { name: 'Users' })
    const withCols = addColumn(first.schema, first.table.id)
    const colA = withCols.column
    const withCols2 = addColumn(withCols.schema, first.table.id)
    const colB = withCols2.column

    const sameColumn = addRelationship(withCols2.schema, colA.id, colA.id)
    const sameTable = addRelationship(withCols2.schema, colA.id, colB.id)
    const missingColumn = addRelationship(withCols2.schema, colA.id, 'c_missing')

    expect(sameColumn.relationships).toHaveLength(0)
    expect(sameTable.relationships).toHaveLength(0)
    expect(missingColumn.relationships).toHaveLength(0)
  })

  it('deduplicates relationships even when added in reverse order', () => {
    const empty = createEmptySchema()
    const users = createTable(empty, { name: 'Users' })
    const posts = createTable(users.schema, { name: 'Posts' })

    const userId = addColumn(posts.schema, users.table.id)
    const postUserId = addColumn(userId.schema, posts.table.id)

    const linked = addRelationship(postUserId.schema, userId.column.id, postUserId.column.id)
    const duplicate = addRelationship(linked, postUserId.column.id, userId.column.id)

    expect(linked.relationships).toHaveLength(1)
    expect(duplicate.relationships).toHaveLength(1)
    expect(duplicate.relationships[0]).toEqual(linked.relationships[0])
  })

  it('drops a relationship by id without affecting others', () => {
    const empty = createEmptySchema()
    const users = createTable(empty, { name: 'Users' })
    const posts = createTable(users.schema, { name: 'Posts' })
    const comments = createTable(posts.schema, { name: 'Comments' })

    const userId = addColumn(comments.schema, users.table.id)
    const postUserId = addColumn(userId.schema, posts.table.id)
    const commentPostId = addColumn(postUserId.schema, comments.table.id)

    const linkedOnce = addRelationship(
      commentPostId.schema,
      userId.column.id,
      postUserId.column.id
    )
    const linkedTwice = addRelationship(
      linkedOnce,
      postUserId.column.id,
      commentPostId.column.id
    )

    const [firstRelationship, secondRelationship] = linkedTwice.relationships
    const afterDrop = dropRelationship(linkedTwice, firstRelationship.id)

    expect(afterDrop.relationships).toHaveLength(1)
    expect(afterDrop.relationships[0]).toEqual(secondRelationship)
  })

  it('removes related links when a table is dropped', () => {
    const empty = createEmptySchema()
    const users = createTable(empty, { name: 'Users' })
    const posts = createTable(users.schema, { name: 'Posts' })

    const userIdCol = addColumn(posts.schema, users.table.id)
    const postUserIdCol = addColumn(userIdCol.schema, posts.table.id)

    const linked = addRelationship(
      postUserIdCol.schema,
      userIdCol.column.id,
      postUserIdCol.column.id
    )

    const afterDrop = dropTable(linked, users.table.id)

    expect(afterDrop.tables.map((t) => t.id)).toEqual([posts.table.id])
    expect(afterDrop.relationships).toHaveLength(0)
  })

  it('round-trips through save/load and fills missing column defaults', () => {
    const raw = JSON.stringify({
      meta: { version: SCHEMA_VERSION },
      tables: [
        {
          id: 't1',
          name: 'Users',
          position: { x: 10, y: 20 },
          columns: [{ id: 'c1', name: 'email' }]
        }
      ],
      relationships: []
    })

    const loaded = loadSchema(raw)
    const column = loaded.tables[0].columns[0]
    const saved = saveSchema(loaded)

    expect(column.isKey).toBe(false)
    expect(column.nullable).toBe(false)
    expect(column.type).toBe('text')
    expect(JSON.parse(saved)).toEqual(loaded)
  })

  it('rejects invalid JSON, invalid shapes, and unsupported versions', () => {
    expect(() => loadSchema('{not json')).toThrow('Invalid schema JSON.')

    expect(() =>
      loadSchema(
        JSON.stringify({
          meta: { version: SCHEMA_VERSION },
          tables: [{ id: 't1', name: 'Users', columns: [] }],
          relationships: []
        })
      )
    ).toThrow('Invalid schema shape.')

    expect(() =>
      loadSchema(
        JSON.stringify({
          meta: { version: SCHEMA_VERSION + 1 },
          tables: [],
          relationships: []
        })
      )
    ).toThrow(`Unsupported schema version ${SCHEMA_VERSION + 1}. Expected ${SCHEMA_VERSION}.`)
  })
})
