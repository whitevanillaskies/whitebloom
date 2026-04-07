import { join, normalize } from 'path'
import { pathToFileURL } from 'url'
import { describe, expect, it, vi } from 'vitest'

vi.mock('../src/main/services/app-storage', () => ({
  getAppDataRoot: () => 'D:/whitebloom-appdata'
}))

import { resolveResource } from '../src/main/resource-uri'

describe('resource-uri', () => {
  it('resolves workspace-local resources inside the workspace root', () => {
    const workspaceRoot = 'D:/whitebloom/workspaces/demo'

    expect(resolveResource('wloc:res/flower.png', workspaceRoot)).toBe(
      normalize(join(workspaceRoot, 'res', 'flower.png'))
    )
    expect(resolveResource('wloc:/boards/board.wb.json', workspaceRoot)).toBe(
      normalize(join(workspaceRoot, 'boards', 'board.wb.json'))
    )
  })

  it('resolves wbapp resources only from supported top-level directories', () => {
    expect(resolveResource('wbapp:boards/session.wb.json', 'D:/ignored')).toBe(
      normalize('D:/whitebloom-appdata/boards/session.wb.json')
    )
    expect(resolveResource('wbapp:res/icons/petal.png', 'D:/ignored')).toBe(
      normalize('D:/whitebloom-appdata/res/icons/petal.png')
    )
  })

  it('resolves file URIs to absolute filesystem paths', () => {
    const absolutePath = normalize('D:/whitebloom/workspaces/demo/res/flower.png')
    const uri = pathToFileURL(absolutePath).toString()

    expect(resolveResource(uri, 'D:/ignored')).toBe(absolutePath)
  })

  it('rejects empty and unsupported resource URIs', () => {
    expect(() => resolveResource('   ', 'D:/workspace')).toThrow('Resource URI cannot be empty.')
    expect(() => resolveResource('https://example.com/file.png', 'D:/workspace')).toThrow(
      'Unsupported resource URI scheme: https://example.com/file.png'
    )
  })

  it('rejects managed URIs with an authority component', () => {
    expect(() => resolveResource('wloc://res/flower.png', 'D:/workspace')).toThrow(
      'Invalid wloc URI (authority not allowed): wloc://res/flower.png'
    )
    expect(() => resolveResource('wbapp://boards/session.wb.json', 'D:/workspace')).toThrow(
      'Invalid wbapp URI (authority not allowed): wbapp://boards/session.wb.json'
    )
  })

  it('rejects workspace-local URIs that escape the workspace root', () => {
    expect(() => resolveResource('wloc:../secret.txt', 'D:/workspace')).toThrow(
      'wloc URI escapes root: wloc:../secret.txt'
    )
    expect(() => resolveResource('wloc:res/%2E%2E/%2E%2E/secret.txt', 'D:/workspace')).toThrow(
      'wloc URI escapes root: wloc:res/%2E%2E/%2E%2E/secret.txt'
    )
  })

  it('rejects wbapp URIs that escape app storage or target unsupported folders', () => {
    expect(() => resolveResource('wbapp:trash/../../secret.txt', 'D:/workspace')).toThrow(
      'wbapp URI escapes root: wbapp:trash/../../secret.txt'
    )
    expect(() => resolveResource('wbapp:logs/app.log', 'D:/workspace')).toThrow(
      'Unsupported wbapp URI path: wbapp:logs/app.log'
    )
  })

  it('rejects missing workspace roots and invalid managed URI paths', () => {
    expect(() => resolveResource('wloc:res/flower.png', '   ')).toThrow(
      'wloc URI requires an active root path: wloc:res/flower.png'
    )
    expect(() => resolveResource('wloc:/', 'D:/workspace')).toThrow(
      'Invalid wloc URI path: wloc:/'
    )
    expect(() => resolveResource('wbapp:.', 'D:/workspace')).toThrow(
      'Invalid wbapp URI path: wbapp:.'
    )
  })
})
