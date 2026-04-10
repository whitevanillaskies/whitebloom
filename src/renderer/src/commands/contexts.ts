import type {
  ArrangementsCommandContext,
  CanvasCommandContext
} from './types'

export function createCanvasCommandContext(
  input: Omit<CanvasCommandContext, 'kind'>
): CanvasCommandContext {
  return {
    kind: 'canvas',
    ...input
  }
}

export function createArrangementsCommandContext(
  input: Omit<ArrangementsCommandContext, 'kind'>
): ArrangementsCommandContext {
  return {
    kind: 'arrangements',
    ...input
  }
}
