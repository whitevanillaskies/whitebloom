import { createReadStream } from 'fs'
import { stat } from 'fs/promises'
import { extname } from 'path'
import { Readable } from 'stream'
import { protocol } from 'electron'
import { resolveResource } from '../resource-uri'
import type { MainProcessContext } from '../state/main-process-context'
import { createLogger } from '../../shared/logger'

type ManagedScheme = 'wloc' | 'wbapp'
const logger = createLogger('resource-protocol')
const MIME_TYPES: Record<string, string> = {
  '.avif': 'image/avif',
  '.bmp': 'image/bmp',
  '.gif': 'image/gif',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.m4v': 'video/mp4',
  '.mov': 'video/quicktime',
  '.mp4': 'video/mp4',
  '.ogg': 'video/ogg',
  '.ogv': 'video/ogg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.tif': 'image/tiff',
  '.tiff': 'image/tiff',
  '.webm': 'video/webm',
  '.webp': 'image/webp'
}

function getContentType(filePath: string): string {
  return MIME_TYPES[extname(filePath).toLowerCase()] ?? 'application/octet-stream'
}

function parseByteRange(rangeHeader: string, fileSize: number): { start: number; end: number } | null {
  const match = /^bytes=(\d*)-(\d*)$/i.exec(rangeHeader.trim())
  if (!match) return null

  const [, startToken, endToken] = match

  if (!startToken && !endToken) return null

  if (!startToken) {
    const suffixLength = Number(endToken)
    if (!Number.isInteger(suffixLength) || suffixLength <= 0) return null

    const clampedLength = Math.min(suffixLength, fileSize)
    return {
      start: Math.max(0, fileSize - clampedLength),
      end: Math.max(0, fileSize - 1)
    }
  }

  const start = Number(startToken)
  const rawEnd = endToken ? Number(endToken) : fileSize - 1

  if (!Number.isInteger(start) || !Number.isInteger(rawEnd)) return null
  if (start < 0 || start >= fileSize) return null

  const end = Math.min(rawEnd, fileSize - 1)
  if (end < start) return null

  return { start, end }
}

async function createFileResponse(filePath: string, request: GlobalRequest): Promise<Response> {
  const fileStats = await stat(filePath)
  if (!fileStats.isFile()) {
    return new Response('Not Found', { status: 404 })
  }

  const fileSize = fileStats.size
  const contentType = getContentType(filePath)
  const baseHeaders = new Headers({
    'Accept-Ranges': 'bytes',
    'Content-Type': contentType
  })

  const rangeHeader = request.headers.get('range')
  if (rangeHeader) {
    const byteRange = parseByteRange(rangeHeader, fileSize)
    if (!byteRange) {
      return new Response('Requested Range Not Satisfiable', {
        status: 416,
        headers: new Headers({
          'Accept-Ranges': 'bytes',
          'Content-Range': `bytes */${fileSize}`
        })
      })
    }

    const { start, end } = byteRange
    const headers = new Headers(baseHeaders)
    headers.set('Content-Length', String(end - start + 1))
    headers.set('Content-Range', `bytes ${start}-${end}/${fileSize}`)

    if (request.method === 'HEAD') {
      return new Response(null, { status: 206, headers })
    }

    const stream = createReadStream(filePath, { start, end })
    return new Response(Readable.toWeb(stream) as BodyInit, {
      status: 206,
      headers
    })
  }

  const headers = new Headers(baseHeaders)
  headers.set('Content-Length', String(fileSize))

  if (request.method === 'HEAD') {
    return new Response(null, { status: 200, headers })
  }

  const stream = createReadStream(filePath)
  return new Response(Readable.toWeb(stream) as BodyInit, {
    status: 200,
    headers
  })
}

function registerScheme(scheme: ManagedScheme): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme,
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        corsEnabled: true,
        stream: true
      }
    }
  ])
}

function registerProtocolHandler(scheme: ManagedScheme, context: MainProcessContext): void {
  protocol.handle(scheme, async (request) => {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response('Method Not Allowed', {
        status: 405,
        headers: new Headers({ Allow: 'GET, HEAD' })
      })
    }

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
      return await createFileResponse(absolutePath, request)
    } catch (err) {
      logger.error(`failed to resolve/fetch resource for ${scheme}:`, resourceUri, err)
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
        corsEnabled: true,
        stream: true
      }
    },
    {
      scheme: 'wbapp',
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        corsEnabled: true,
        stream: true
      }
    }
  ])
}

export function registerResourceProtocols(context: MainProcessContext): void {
  registerProtocolHandler('wloc', context)
  registerProtocolHandler('wbapp', context)
}
