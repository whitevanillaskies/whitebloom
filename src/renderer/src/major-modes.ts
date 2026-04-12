import type { ActiveBloom } from './canvas/BloomContext'

export type WhitebloomMajorMode =
  | {
      id: 'canvas-mode'
      kind: 'canvas'
      title: 'Canvas'
      emptyLabel: string
    }
  | {
      id: `module:${string}`
      kind: 'module'
      moduleId: string
      title: string
      emptyLabel: string
    }

function titleCaseWords(value: string): string {
  return value
    .split(/[\s-]+/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ')
}

function deriveModuleTitle(moduleId: string): string {
  const leaf = moduleId.split('.').filter(Boolean).at(-1) ?? moduleId
  return titleCaseWords(leaf)
}

export function createCanvasMajorMode(): WhitebloomMajorMode {
  return {
    id: 'canvas-mode',
    kind: 'canvas',
    title: 'Canvas',
    emptyLabel: 'No canvas commands available.'
  }
}

export function createModuleMajorMode(bloom: ActiveBloom): WhitebloomMajorMode {
  const title = bloom.module.majorModeLabel?.trim() || deriveModuleTitle(bloom.module.id)
  return {
    id: `module:${bloom.module.id}`,
    kind: 'module',
    moduleId: bloom.module.id,
    title,
    emptyLabel: `No commands available in ${title} mode yet.`
  }
}
