import type {
  ArrangementsCommandContext,
  CanvasCommandContext,
  WhitebloomCommandModeKey
} from './types'

export function createCanvasCommandContext(
  input: Omit<CanvasCommandContext, 'majorMode'> & { majorMode: WhitebloomCommandModeKey }
): CanvasCommandContext {
  return input
}

export function createArrangementsCommandContext(
  input: Omit<ArrangementsCommandContext, 'majorMode'> & { majorMode?: WhitebloomCommandModeKey }
): ArrangementsCommandContext {
  return {
    ...input,
    majorMode: input.majorMode ?? 'canvas-mode'
  }
}
