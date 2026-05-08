export type BookMarkupRange = {
  start: number
  end: number
}

type BookMarkupSource = {
  source: string
  sourceRange: BookMarkupRange
}

export type BookMarkupMetadataName = 'type' | 'title' | 'author'

export type BookMarkupMetadata = {
  type: 'book'
  title?: string
  author?: string
}

export type BookMarkupMetadataBlock = BookMarkupSource & {
  kind: 'metadata'
  name: BookMarkupMetadataName
  value: string
  range: BookMarkupRange
  directiveRange: BookMarkupRange
  contentRange: BookMarkupRange
}

export type BookMarkupHeadingBlock = BookMarkupSource & {
  kind: 'heading'
  depth: 1 | 2 | 3
  text: string
  range: BookMarkupRange
  markerRange: BookMarkupRange
  contentRange: BookMarkupRange
}

export type BookMarkupParagraphBlock = BookMarkupSource & {
  kind: 'paragraph'
  text: string
  range: BookMarkupRange
}

export type BookMarkupDirectiveName = 'margin' | 'note'

export type BookMarkupDirectiveBlock = BookMarkupSource & {
  kind: BookMarkupDirectiveName
  value: string
  form: 'inline' | 'block'
  range: BookMarkupRange
  directiveRange: BookMarkupRange
  contentRange: BookMarkupRange
}

export type BookMarkupBlock =
  | BookMarkupMetadataBlock
  | BookMarkupHeadingBlock
  | BookMarkupParagraphBlock
  | BookMarkupDirectiveBlock

export type BookMarkupSeparatorNode = BookMarkupSource & {
  kind: 'separator'
  range: BookMarkupRange
}

export type BookMarkupRawNode = BookMarkupSource & {
  kind: 'raw'
  text: string
  reason: 'unknown-directive' | 'unsupported-syntax'
  range: BookMarkupRange
}

export type BookMarkupNode = BookMarkupBlock | BookMarkupSeparatorNode | BookMarkupRawNode

export type BookMarkupDocument =
  | {
      mode: 'plaintext'
      text: string
    }
  | {
      mode: 'book'
      text: string
      metadata: BookMarkupMetadata
      blocks: BookMarkupBlock[]
      nodes: BookMarkupNode[]
    }

export type BookMarkupLiveNodeText = {
  nodeIndex: number
  text: string
}

type SourceLine = {
  text: string
  content: string
  start: number
  end: number
  fullEnd: number
}

const DIRECTIVE_PATTERN = /^\s*::([A-Za-z][A-Za-z0-9_-]*)(?:\s+(.*))?$/
const HEADING_PATTERN = /^(#{1,3})\s+(.*?)\s*$/

function getSourceLines(text: string): SourceLine[] {
  if (!text) return []

  const lines: SourceLine[] = []
  const pattern = /([^\r\n]*)(\r\n|\n|\r|$)/g
  let match: RegExpExecArray | null

  while ((match = pattern.exec(text))) {
    const content = match[1]
    const newline = match[2]
    const start = match.index
    const end = start + content.length
    const fullEnd = end + newline.length

    if (start === text.length && content === '' && newline === '') break

    lines.push({
      text: content + newline,
      content,
      start,
      end,
      fullEnd
    })

    if (newline === '') break
  }

  return lines
}

function isBlank(line: SourceLine): boolean {
  return line.content.trim() === ''
}

function parseDirective(line: SourceLine): { name: string; value: string | null } | null {
  const match = line.content.match(DIRECTIVE_PATTERN)
  if (!match) return null
  return {
    name: match[1].toLowerCase(),
    value: match[2] === undefined ? null : match[2].trim()
  }
}

function hasFollowingContentLine(lines: SourceLine[], index: number): boolean {
  const nextLine = lines[index + 1]
  return nextLine !== undefined && !isBlank(nextLine)
}

function shouldParseUnknownDirectiveAsRaw(
  lines: SourceLine[],
  index: number,
  directive: { value: string | null }
): boolean {
  return directive.value !== null || hasFollowingContentLine(lines, index)
}

function shouldParagraphStopAtLine(lines: SourceLine[], index: number): boolean {
  const line = lines[index]
  if (isBlank(line)) return true
  if (parseHeadingBlock(line)) return true

  const directive = parseDirective(line)
  if (!directive) return false
  if (
    (directive.name === 'type' || directive.name === 'title' || directive.name === 'author') &&
    directive.value !== null
  ) {
    return true
  }
  if (directive.name === 'margin' || directive.name === 'note') {
    return directive.value !== null || hasFollowingContentLine(lines, index)
  }
  return shouldParseUnknownDirectiveAsRaw(lines, index, directive)
}

function valueStartOffset(line: SourceLine, value: string): number {
  if (!value) return line.end
  const valueIndex = line.content.indexOf(value)
  return valueIndex === -1 ? line.end : line.start + valueIndex
}

function findFirstMeaningfulLine(lines: SourceLine[]): SourceLine | null {
  return lines.find((line) => !isBlank(line)) ?? null
}

function isBookTypeLine(line: SourceLine | null): boolean {
  if (!line) return false
  const directive = parseDirective(line)
  return directive?.name === 'type' && directive.value?.toLowerCase() === 'book'
}

function parseMetadataBlock(
  line: SourceLine,
  name: BookMarkupMetadataName,
  value: string
): BookMarkupMetadataBlock {
  const contentStart = valueStartOffset(line, value)
  return {
    kind: 'metadata',
    name,
    value,
    range: { start: line.start, end: line.end },
    source: line.text,
    sourceRange: { start: line.start, end: line.fullEnd },
    directiveRange: { start: line.start, end: line.end },
    contentRange: { start: contentStart, end: contentStart + value.length }
  }
}

function parseHeadingBlock(line: SourceLine): BookMarkupHeadingBlock | null {
  const match = line.content.match(HEADING_PATTERN)
  if (!match) return null

  const depth = match[1].length as 1 | 2 | 3
  const text = match[2]
  const markerStart = line.content.indexOf(match[1])
  const contentStart = text ? line.content.indexOf(text, markerStart + match[1].length) : line.end

  return {
    kind: 'heading',
    depth,
    text,
    range: { start: line.start, end: line.end },
    source: line.text,
    sourceRange: { start: line.start, end: line.fullEnd },
    markerRange: { start: line.start + markerStart, end: line.start + markerStart + depth },
    contentRange: { start: line.start + contentStart, end: line.start + contentStart + text.length }
  }
}

function parseDirectiveBlock(
  lines: SourceLine[],
  index: number,
  name: BookMarkupDirectiveName,
  value: string | null
): { block: BookMarkupDirectiveBlock; nextIndex: number } {
  const line = lines[index]

  if (value !== null) {
    const contentStart = valueStartOffset(line, value)
    return {
      block: {
        kind: name,
        value,
        form: 'inline',
        range: { start: line.start, end: line.end },
        source: line.text,
        sourceRange: { start: line.start, end: line.fullEnd },
        directiveRange: { start: line.start, end: line.end },
        contentRange: { start: contentStart, end: contentStart + value.length }
      },
      nextIndex: index + 1
    }
  }

  let endIndex = index + 1
  while (endIndex < lines.length && !isBlank(lines[endIndex])) {
    endIndex++
  }

  const contentStart = lines[index + 1]?.start ?? line.end
  const contentEnd = lines[endIndex - 1]?.end ?? line.end
  const sourceEnd = lines[endIndex - 1]?.fullEnd ?? line.fullEnd
  const rawContent = lines
    .slice(index + 1, endIndex)
    .map((contentLine) => contentLine.content)
    .join('\n')

  return {
    block: {
      kind: name,
      value: rawContent.trimEnd(),
      form: 'block',
      range: { start: line.start, end: contentEnd },
      source: lines
        .slice(index, endIndex)
        .map((sourceLine) => sourceLine.text)
        .join(''),
      sourceRange: { start: line.start, end: sourceEnd },
      directiveRange: { start: line.start, end: line.end },
      contentRange: { start: contentStart, end: contentEnd }
    },
    nextIndex: endIndex
  }
}

function parseParagraphBlock(
  lines: SourceLine[],
  index: number
): { block: BookMarkupParagraphBlock; nextIndex: number } {
  let endIndex = index + 1

  while (endIndex < lines.length) {
    if (shouldParagraphStopAtLine(lines, endIndex)) break
    endIndex++
  }

  const paragraphLines = lines.slice(index, endIndex)
  const text = paragraphLines
    .map((line) => line.content)
    .join('\n')
    .trimEnd()

  return {
    block: {
      kind: 'paragraph',
      text,
      source: paragraphLines.map((line) => line.text).join(''),
      sourceRange: {
        start: lines[index].start,
        end: paragraphLines[paragraphLines.length - 1].fullEnd
      },
      range: {
        start: lines[index].start,
        end: paragraphLines[paragraphLines.length - 1].end
      }
    },
    nextIndex: endIndex
  }
}

function parseSeparatorNode(
  lines: SourceLine[],
  index: number
): { node: BookMarkupSeparatorNode; nextIndex: number } {
  let endIndex = index + 1
  while (endIndex < lines.length && isBlank(lines[endIndex])) {
    endIndex++
  }

  const separatorLines = lines.slice(index, endIndex)
  return {
    node: {
      kind: 'separator',
      range: {
        start: separatorLines[0].start,
        end: separatorLines[separatorLines.length - 1].end
      },
      source: separatorLines.map((line) => line.text).join(''),
      sourceRange: {
        start: separatorLines[0].start,
        end: separatorLines[separatorLines.length - 1].fullEnd
      }
    },
    nextIndex: endIndex
  }
}

function parseRawNode(
  lines: SourceLine[],
  index: number,
  reason: BookMarkupRawNode['reason']
): { node: BookMarkupRawNode; nextIndex: number } {
  const line = lines[index]
  const directive = parseDirective(line)
  let endIndex = index + 1

  if (reason === 'unknown-directive' && directive?.value === null) {
    while (endIndex < lines.length && !isBlank(lines[endIndex])) {
      endIndex++
    }
  }

  const rawLines = lines.slice(index, endIndex)

  return {
    node: {
      kind: 'raw',
      text: rawLines.map((rawLine) => rawLine.content).join('\n'),
      reason,
      range: { start: line.start, end: rawLines[rawLines.length - 1].end },
      source: rawLines.map((rawLine) => rawLine.text).join(''),
      sourceRange: { start: line.start, end: rawLines[rawLines.length - 1].fullEnd }
    },
    nextIndex: endIndex
  }
}

export function parseBookMarkup(text: string): BookMarkupDocument {
  const lines = getSourceLines(text)
  const firstMeaningfulLine = findFirstMeaningfulLine(lines)

  if (!isBookTypeLine(firstMeaningfulLine)) {
    return { mode: 'plaintext', text }
  }

  const metadata: BookMarkupMetadata = { type: 'book' }
  const blocks: BookMarkupBlock[] = []
  const nodes: BookMarkupNode[] = []
  let index = 0

  while (index < lines.length) {
    const line = lines[index]

    if (isBlank(line)) {
      const parsed = parseSeparatorNode(lines, index)
      nodes.push(parsed.node)
      index = parsed.nextIndex
      continue
    }

    const directive = parseDirective(line)
    if (directive) {
      if (
        (directive.name === 'type' || directive.name === 'title' || directive.name === 'author') &&
        directive.value !== null
      ) {
        const name = directive.name as BookMarkupMetadataName
        const block = parseMetadataBlock(line, name, directive.value)
        blocks.push(block)
        nodes.push(block)

        if (name === 'title') metadata.title = directive.value
        if (name === 'author') metadata.author = directive.value

        index++
        continue
      }

      if (
        (directive.name === 'margin' || directive.name === 'note') &&
        (directive.value !== null || hasFollowingContentLine(lines, index))
      ) {
        const parsed = parseDirectiveBlock(
          lines,
          index,
          directive.name as BookMarkupDirectiveName,
          directive.value
        )
        blocks.push(parsed.block)
        nodes.push(parsed.block)
        index = parsed.nextIndex
        continue
      }

      if (shouldParseUnknownDirectiveAsRaw(lines, index, directive)) {
        const parsed = parseRawNode(lines, index, 'unknown-directive')
        nodes.push(parsed.node)
        index = parsed.nextIndex
        continue
      }
    }

    const heading = parseHeadingBlock(line)
    if (heading) {
      blocks.push(heading)
      nodes.push(heading)
      index++
      continue
    }

    const paragraph = parseParagraphBlock(lines, index)
    blocks.push(paragraph.block)
    nodes.push(paragraph.block)
    index = paragraph.nextIndex
  }

  return {
    mode: 'book',
    text,
    metadata,
    blocks,
    nodes
  }
}

function serializeMetadataNode(node: BookMarkupMetadataBlock): string {
  return `::${node.name} ${node.value}`
}

function serializeHeadingNode(node: BookMarkupHeadingBlock): string {
  return `${'#'.repeat(node.depth)} ${node.text}`
}

function serializeDirectiveNode(node: BookMarkupDirectiveBlock): string {
  if (node.form === 'inline') return `::${node.kind} ${node.value}`
  return `::${node.kind}\n${node.value}`
}

function serializeNodeWithoutTrailingSource(node: BookMarkupNode): string {
  if (node.kind === 'metadata') return serializeMetadataNode(node)
  if (node.kind === 'heading') return serializeHeadingNode(node)
  if (node.kind === 'paragraph') return node.text
  if (node.kind === 'margin' || node.kind === 'note') return serializeDirectiveNode(node)
  return node.source
}

export function serializeBookMarkup(document: BookMarkupDocument): string {
  if (document.mode === 'plaintext') return document.text
  return document.nodes
    .map((node) => {
      if (node.kind === 'separator' || node.kind === 'raw') return node.source
      const serialized = serializeNodeWithoutTrailingSource(node)
      const trailingSource = node.source.slice(node.range.end - node.sourceRange.start)
      return serialized + trailingSource
    })
    .join('')
}

export function serializeBookMarkupWithTextEdits(
  document: BookMarkupDocument,
  edits: ReadonlyMap<number, string>
): string {
  if (document.mode === 'plaintext') return document.text

  return document.nodes
    .map((node, index) => {
      if (node.kind === 'raw') return node.source

      const editedText = edits.get(index)
      if (editedText === undefined) {
        if (node.kind === 'separator') return node.source
        const serialized = serializeNodeWithoutTrailingSource(node)
        const trailingSource = node.source.slice(node.range.end - node.sourceRange.start)
        return serialized + trailingSource
      }

      if (node.kind === 'separator') {
        return editedText ? `${node.source}${editedText}${node.source}${node.source}` : node.source
      }

      if (
        node.kind !== 'heading' &&
        node.kind !== 'paragraph' &&
        node.kind !== 'margin' &&
        node.kind !== 'note'
      ) {
        const serialized = serializeNodeWithoutTrailingSource(node)
        const trailingSource = node.source.slice(node.range.end - node.sourceRange.start)
        return serialized + trailingSource
      }

      const serialized = (() => {
        if (node.kind === 'heading') return `${'#'.repeat(node.depth)} ${editedText}`
        if (node.kind === 'margin' || node.kind === 'note') {
          return serializeDirectiveNode({ ...node, value: editedText })
        }
        return editedText
      })()
      const trailingSource = node.source.slice(node.range.end - node.sourceRange.start)
      return serialized + trailingSource
    })
    .join('')
}

export function serializeBookMarkupFromLiveNodes(
  document: BookMarkupDocument,
  liveNodes: readonly BookMarkupLiveNodeText[]
): string {
  if (document.mode === 'plaintext') return document.text

  return liveNodes
    .map(({ nodeIndex, text }, liveIndex) => {
      const node = document.nodes[nodeIndex]
      if (!node) {
        if (!text) return liveNodes[liveIndex + 1] ? '\n' : ''
        const separator = document.text.endsWith('\n\n')
          ? ''
          : document.text.endsWith('\n')
            ? ''
            : '\n'
        return `${separator}${text}`
      }
      if (node.kind === 'raw') return node.source

      if (node.kind === 'separator') {
        return text ? `${node.source}${text}${node.source}${node.source}` : node.source
      }

      const serialized = (() => {
        if (node.kind === 'heading') return `${'#'.repeat(node.depth)} ${text}`
        if (node.kind === 'margin' || node.kind === 'note') {
          return serializeDirectiveNode({ ...node, value: text })
        }
        if (node.kind === 'paragraph') return text
        return serializeNodeWithoutTrailingSource(node)
      })()
      const nextLiveNode = liveNodes[liveIndex + 1]
      const isOriginalDocumentEnd = node.sourceRange.end === document.text.length
      const trailingSource =
        nextLiveNode || isOriginalDocumentEnd
          ? node.source.slice(node.range.end - node.sourceRange.start)
          : ''
      return serialized + trailingSource
    })
    .join('')
}

export function findBookMarkupBlockAtOffset(
  document: BookMarkupDocument,
  offset: number
): BookMarkupBlock | null {
  if (document.mode !== 'book') return null

  const clampedOffset = Math.max(0, Math.min(offset, document.text.length))
  return (
    document.blocks.find(
      (block) => block.range.start <= clampedOffset && clampedOffset <= block.range.end
    ) ?? null
  )
}
