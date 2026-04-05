import { net, protocol } from 'electron'
import { pathToFileURL } from 'url'
import { resolveResource } from '../resource-uri'
import type { MainProcessContext } from '../state/main-process-context'

type ManagedScheme = 'wloc' | 'wbapp'

function registerScheme(scheme: ManagedScheme): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme,
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        corsEnabled: true
      }
    }
  ])
}

function registerProtocolHandler(scheme: ManagedScheme, context: MainProcessContext): void {
  protocol.handle(scheme, async (request) => {
    const requestUrl = new URL(request.url)
    const queryResource = requestUrl.searchParams.get('resource')
    const queryWorkspaceRoot = requestUrl.searchParams.get('workspaceRoot')

    const resourceUri = queryResource ?? request.url
    const workspaceRoot = queryWorkspaceRoot ?? context.getActiveWorkspaceRoot()

    if (!workspaceRoot && resourceUri.startsWith('wloc:')) {
      return new Response('Workspace root not set for wloc URI', { status: 400 })
    }

    try {
      const absolutePath = resolveResource(resourceUri, workspaceRoot ?? '')
      return net.fetch(pathToFileURL(absolutePath).toString())
    } catch (err) {
      console.error(`[${scheme}] Failed to resolve/fetch resource:`, resourceUri, err)
      return new Response('Not Found', { status: 404 })
    }
  })
}

export function registerWlocScheme(): void {
  registerScheme('wloc')
}

export function registerWbappScheme(): void {
  registerScheme('wbapp')
}

export function registerWlocProtocol(context: MainProcessContext): void {
  registerProtocolHandler('wloc', context)
}

export function registerWbappProtocol(context: MainProcessContext): void {
  registerProtocolHandler('wbapp', context)
}

export function registerResourceSchemes(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: 'wloc',
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        corsEnabled: true
      }
    },
    {
      scheme: 'wbapp',
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        corsEnabled: true
      }
    }
  ])
}

export function registerResourceProtocols(context: MainProcessContext): void {
  registerProtocolHandler('wloc', context)
  registerProtocolHandler('wbapp', context)
}
