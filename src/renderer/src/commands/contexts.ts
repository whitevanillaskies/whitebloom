import type {
  ArrangementsCommandContext,
  CanvasCommandContext,
  FocusWriterCommandContext,
  GenericModuleCommandContext,
  PdfCommandContext,
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

export function createPdfCommandContext(
  input: Omit<PdfCommandContext, 'majorMode'>
): PdfCommandContext {
  return {
    ...input,
    majorMode: 'module:com.whitebloom.pdf'
  }
}

export function createFocusWriterCommandContext(
  input: Omit<FocusWriterCommandContext, 'majorMode'>
): FocusWriterCommandContext {
  return {
    ...input,
    majorMode: 'module:com.whitebloom.focus-writer'
  }
}

export function createGenericModuleCommandContext(
  input: Omit<GenericModuleCommandContext, 'majorMode'>
): GenericModuleCommandContext {
  return {
    ...input,
    majorMode: `module:${input.subjectSnapshot.moduleId}`
  }
}
