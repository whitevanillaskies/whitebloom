import { describe, expect, it } from 'vitest'
import type { WhitebloomModule } from '../src/renderer/src/modules/types'
import { registerModule } from '../src/renderer/src/modules/registry'
import { createCanvasCommandContext } from '../src/renderer/src/commands/contexts'
import {
  listVirtualCommandNamespaces,
  resolveCommandProvider,
  searchCoreCommands
} from '../src/renderer/src/commands'

const DummyComponent = () => null

describe('module command contribution', () => {
  it('registers module command families into the shared command registry', () => {
    const moduleId = `com.whitebloom.test-org-${crypto.randomUUID()}`

    const module: WhitebloomModule = {
      id: moduleId,
      extensions: ['.org'],
      defaultRenderer: 'internal',
      IconComponent: DummyComponent,
      accentColor: '--color-accent-green',
      NodeComponent: DummyComponent,
      EditorComponent: DummyComponent,
      commands: {
        canvas: [
          {
            core: {
              id: 'org.task.clock-in',
              run: () => undefined
            }
          },
          {
            core: {
              id: 'org.task.clock-out',
              run: () => undefined
            }
          },
          {
            core: {
              id: 'org.table.insert-column',
              run: () => undefined
            }
          }
        ]
      }
    }

    registerModule(module)

    const provider = resolveCommandProvider(`module:${moduleId}`)
    expect(provider?.source).toEqual({ kind: 'module', moduleId })
    expect(provider?.commands.canvas?.map((command) => command.core.id)).toEqual([
      'org.task.clock-in',
      'org.task.clock-out',
      'org.table.insert-column'
    ])

    const context = createCanvasCommandContext({
      selection: {
        nodeIds: [],
        edgeIds: []
      },
      capabilities: {},
      actions: {}
    })

    expect(listVirtualCommandNamespaces(context).map((namespace) => namespace.id)).toContain('org')
    expect(
      listVirtualCommandNamespaces(context, { namespace: 'org' }).map((namespace) => namespace.id)
    ).toEqual(expect.arrayContaining(['org.task', 'org.table']))
    expect(
      searchCoreCommands('clock', context, { namespace: 'org.task' }).map(
        (result) => result.entry.command.core.id
      )
    ).toEqual(['org.task.clock-in', 'org.task.clock-out'])
  })
})
