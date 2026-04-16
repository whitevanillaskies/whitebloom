import { createPortal } from 'react-dom'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useAppSettingsStore } from '@renderer/stores/app-settings'
import {
  executeCommandById,
  getRegisteredCommandsForMajorMode,
  listVirtualCommandNamespaces,
  searchCoreCommands,
  searchPresentedCommands,
  type AnyWhitebloomCommandContext,
  type WhitebloomCommandFlowStep,
  type WhitebloomCommandFlowTransition,
  type WhitebloomCommandInteractionController,
  type WhitebloomCommandLatentState,
  type WhitebloomRegisteredCommandForContext
} from '@renderer/commands'
import './PetalPalette.css'

export type PaletteMode = {
  id: string
  title?: string
  subtitle?: string
  items: PaletteItem[]
  placeholder?: string
  emptyLabel?: string
}

export type PaletteInputMode = {
  id: string
  type: 'input'
  title?: string
  subtitle?: string
  placeholder?: string
  submitLabel?: string
  initialValue?: string
  onSubmit: (value: string) => PaletteActivation | void | Promise<PaletteActivation | void>
}

type PaletteListMode = {
  id: string
  type?: 'list'
  title?: string
  subtitle?: string
  items: PaletteItem[]
  placeholder?: string
  emptyLabel?: string
}

type PaletteAnyMode = PaletteListMode | PaletteInputMode

export type PaletteActivation =
  | { type: 'close' }
  | { type: 'keep-open' }
  | { type: 'set-mode'; mode: PaletteAnyMode }

export type PaletteItem = {
  id: string
  label: string
  subtitle?: string
  icon?: ReactNode
  /** Keyboard shortcut badge shown on the right, e.g. "T" or "⌘S" */
  hint?: string
  onActivate: () => PaletteActivation | void | Promise<PaletteActivation | void>
}

export type PaletteCommandBrowseMode = 'visual' | 'meta'

export type PaletteCommandSession = {
  context: AnyWhitebloomCommandContext
  initialMode?: PaletteCommandBrowseMode
  source?: string
}

type PaletteRenderedEntry = {
  id: string
  label: string
  subtitle?: string
  icon?: ReactNode
  hint?: string
  commandId?: string
  onActivate: () => PaletteActivation | void | Promise<PaletteActivation | void>
}

type PaletteLegacyNamespaceEntry = {
  id: string
  segment: string
  hasChildren: boolean
  hasDirectItem: boolean
}

type PetalPaletteProps = {
  items: PaletteItem[]
  onClose: () => void
  placeholder?: string
  emptyLabel?: string
  commandSession?: PaletteCommandSession
}

const MAX_VISIBLE_ITEMS = 8
const ITEM_HEIGHT_PX = 36
const ABORT_GRACE_MS = 3000
const NOOP_INTERACTION_CONTROLLER: WhitebloomCommandInteractionController = {
  signal: new AbortController().signal,
  setBusyState: () => {}
}

type PaletteAbortPhase = 'idle' | 'requested' | 'stalled'
type ActivePaletteOperation = {
  token: number
  abortController: AbortController
  interaction: WhitebloomCommandInteractionController
}

function normalizeSearchValue(value: string): string {
  return value.trim().toLowerCase()
}

function splitCommandId(id: string): string[] {
  return id
    .split('.')
    .map((segment) => segment.trim())
    .filter(Boolean)
}

function getParentNamespace(namespace: string | null): string | null {
  if (!namespace) return null
  const segments = splitCommandId(namespace)
  if (segments.length <= 1) return null
  return segments.slice(0, -1).join('.')
}

function canPaletteLaunchCommand(entry: WhitebloomRegisteredCommandForContext<any>): boolean {
  return entry.command.flow !== undefined || entry.command.core.argsSchema === undefined
}

function isDirectCommandInNamespace(commandId: string, namespace: string | null): boolean {
  const commandSegments = splitCommandId(commandId)
  const namespaceSegments = splitCommandId(namespace ?? '')
  if (namespaceSegments.length > commandSegments.length) return false

  const isWithinNamespace = namespaceSegments.every(
    (segment, index) => commandSegments[index] === segment
  )
  if (!isWithinNamespace) return false

  return commandSegments.length === namespaceSegments.length + 1
}

function isCommandWithinNamespace(commandId: string, namespace: string | null): boolean {
  const commandSegments = splitCommandId(commandId)
  const namespaceSegments = splitCommandId(namespace ?? '')
  if (namespaceSegments.length === 0) return true
  if (namespaceSegments.length > commandSegments.length) return false
  return namespaceSegments.every((segment, index) => commandSegments[index] === segment)
}

function getPaletteItemNamespaceKey(item: PaletteItem): string {
  return item.id.trim() || item.label.trim()
}

function matchesNormalizedLegacyItemQuery(item: PaletteItem, normalizedQuery: string): boolean {
  if (!normalizedQuery) return true
  if (item.label.toLowerCase().includes(normalizedQuery)) return true
  if (item.subtitle?.toLowerCase().includes(normalizedQuery)) return true
  if (item.hint?.toLowerCase().includes(normalizedQuery)) return true
  if (getPaletteItemNamespaceKey(item).toLowerCase().includes(normalizedQuery)) return true
  return false
}

function isDirectLegacyItemInNamespace(item: PaletteItem, namespace: string | null): boolean {
  return isDirectCommandInNamespace(getPaletteItemNamespaceKey(item), namespace)
}

function listLegacyNamespaces(
  items: PaletteItem[],
  namespace: string | null
): PaletteLegacyNamespaceEntry[] {
  const namespaceMap = new Map<string, PaletteLegacyNamespaceEntry>()
  const namespaceSegments = splitCommandId(namespace ?? '')
  const depth = namespaceSegments.length

  for (const item of items) {
    const namespaceKey = getPaletteItemNamespaceKey(item)
    if (!isCommandWithinNamespace(namespaceKey, namespace)) continue

    const segments = splitCommandId(namespaceKey)
    const nextSegment = segments[depth]
    if (!nextSegment) continue

    const namespaceId = [...namespaceSegments, nextSegment].join('.')
    const existing = namespaceMap.get(namespaceId)
    if (existing) {
      existing.hasDirectItem ||= segments.length === depth + 1
      existing.hasChildren ||= segments.length > depth + 1
      continue
    }

    namespaceMap.set(namespaceId, {
      id: namespaceId,
      segment: nextSegment,
      hasChildren: segments.length > depth + 1,
      hasDirectItem: segments.length === depth + 1
    })
  }

  return Array.from(namespaceMap.values()).sort((left, right) =>
    left.segment.localeCompare(right.segment)
  )
}

function isAltXShortcut(event: KeyboardEvent): boolean {
  return (
    event.key.toLowerCase() === 'x' &&
    event.altKey &&
    !event.ctrlKey &&
    !event.metaKey &&
    !event.shiftKey
  )
}

function clampProgress(progress: number): number {
  return Math.max(0, Math.min(1, progress))
}

export default function PetalPalette({
  items,
  onClose,
  placeholder,
  emptyLabel,
  commandSession
}: PetalPaletteProps) {
  const { t } = useTranslation()
  const initialMode = useMemo<PaletteListMode>(
    () => ({
      id: 'root',
      type: 'list',
      items,
      placeholder
    }),
    [items, placeholder]
  )
  const [mode, setMode] = useState<PaletteAnyMode>(initialMode)
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const [commandBrowseMode, setCommandBrowseMode] = useState<PaletteCommandBrowseMode>(
    commandSession?.initialMode ?? 'visual'
  )
  const [commandNamespace, setCommandNamespace] = useState<string | null>(null)
  const [busyState, setBusyState] = useState<WhitebloomCommandLatentState | null>(null)
  const [abortPhase, setAbortPhase] = useState<PaletteAbortPhase>('idle')
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const mountedRef = useRef(false)
  const operationTokenRef = useRef(0)
  const activeOperationRef = useRef<ActivePaletteOperation | null>(null)
  const abortTimerRef = useRef<number | null>(null)
  // Always tracks the latest commandSession so that closures baked into stored
  // flow-mode items read the current context rather than a stale snapshot.
  const commandSessionRef = useRef(commandSession)
  commandSessionRef.current = commandSession
  const commandAliases = useAppSettingsStore((state) => state.commands.aliases)
  const updateCommandAlias = useAppSettingsStore((state) => state.updateCommandAlias)

  useEffect(() => {
    setMode(initialMode)
  }, [initialMode])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      if (abortTimerRef.current !== null) {
        window.clearTimeout(abortTimerRef.current)
        abortTimerRef.current = null
      }
    }
  }, [])

  useEffect(() => {
    setCommandBrowseMode(commandSession?.initialMode ?? 'visual')
    setCommandNamespace(null)
  }, [commandSession])

  const clearAbortTimer = useCallback(() => {
    if (abortTimerRef.current !== null) {
      window.clearTimeout(abortTimerRef.current)
      abortTimerRef.current = null
    }
  }, [])

  const beginOperation = useCallback(() => {
    clearAbortTimer()
    const token = operationTokenRef.current + 1
    operationTokenRef.current = token
    const abortController = new AbortController()
    const interaction: WhitebloomCommandInteractionController = {
      signal: abortController.signal,
      setBusyState: (state) => {
        if (!mountedRef.current) return
        if (activeOperationRef.current?.token !== token) return

        if (!state) {
          setBusyState(null)
          return
        }

        setBusyState({
          ...state,
          ...(typeof state.progress === 'number' ? { progress: clampProgress(state.progress) } : {})
        })
      }
    }

    activeOperationRef.current = {
      token,
      abortController,
      interaction
    }
    setAbortPhase('idle')
    setBusyState(null)
    return token
  }, [clearAbortTimer])

  const finishOperation = useCallback(
    (token: number) => {
      if (activeOperationRef.current?.token !== token) return
      activeOperationRef.current = null
      clearAbortTimer()
      if (!mountedRef.current) return
      setAbortPhase('idle')
      setBusyState(null)
    },
    [clearAbortTimer]
  )

  const invalidateActiveOperation = useCallback(() => {
    operationTokenRef.current += 1
    activeOperationRef.current?.abortController.abort()
    activeOperationRef.current = null
    clearAbortTimer()
    setAbortPhase('idle')
    setBusyState(null)
  }, [clearAbortTimer])

  const closePalette = useCallback(() => {
    invalidateActiveOperation()
    setMode(initialMode)
    setQuery('')
    setActiveIndex(0)
    setCommandBrowseMode(commandSession?.initialMode ?? 'visual')
    setCommandNamespace(null)
    onClose()
  }, [commandSession, initialMode, invalidateActiveOperation, onClose])

  const requestAbortCurrentOperation = useCallback(() => {
    const activeOperation = activeOperationRef.current
    if (!activeOperation || busyState === null) return false

    if (abortPhase === 'stalled') {
      closePalette()
      return true
    }

    if (abortPhase === 'requested') {
      return true
    }

    activeOperation.abortController.abort()
    setAbortPhase('requested')
    setBusyState({
      title: t('petalPalette.cancellingTitle'),
      label: t('petalPalette.cancellingLabel'),
      progress: null
    })

    clearAbortTimer()
    abortTimerRef.current = window.setTimeout(() => {
      if (!mountedRef.current) return
      if (activeOperationRef.current?.token !== activeOperation.token) return

      setAbortPhase('stalled')
      setBusyState({
        title: t('petalPalette.stalledTitle'),
        label: t('petalPalette.stalledLabel'),
        progress: null
      })
    }, ABORT_GRACE_MS)

    return true
  }, [abortPhase, busyState, clearAbortTimer, closePalette, t])

  const getActiveInteractionController = useCallback(() => {
    return activeOperationRef.current?.interaction ?? NOOP_INTERACTION_CONTROLLER
  }, [])

  const isBusy = busyState !== null

  const executePaletteCommand = useCallback(
    async (commandId: string, args?: unknown) => {
      // Use the ref so that flow commands, whose final submission may arrive many
      // async steps after the palette was opened, always execute against the context
      // that is current at dispatch time rather than the one captured at flow-start.
      const session = commandSessionRef.current
      if (!session) return { type: 'keep-open' as const }

      const result = await executeCommandById(commandId, args, session.context, {
        source: session.source ?? 'palette',
        interaction: getActiveInteractionController(),
        metadata: {
          browseMode: commandBrowseMode,
          ...(commandNamespace ? { namespace: commandNamespace } : {})
        }
      })

      if (!result.ok) {
        console.warn(`[commands] ${result.commandId} failed`, result)
        return { type: 'keep-open' as const }
      }

      return { type: 'close' as const }
    },
    [commandBrowseMode, commandNamespace, getActiveInteractionController]
  )

  function createCommandFlowMode(
    entry: WhitebloomRegisteredCommandForContext<any>,
    step: WhitebloomCommandFlowStep<any, any>
  ): PaletteAnyMode {
    if (step.kind === 'input') {
      return {
        id: `command-flow:${entry.command.core.id}:${step.id}`,
        type: 'input',
        title: step.title,
        subtitle: step.subtitle,
        placeholder: step.placeholder,
        submitLabel: step.submitLabel,
        initialValue: step.initialValue,
        onSubmit: async (value) => {
          const session = commandSessionRef.current
          if (!session) return { type: 'keep-open' as const }
          const transition = await step.onSubmit(
            value,
            session.context,
            getActiveInteractionController()
          )
          return handleCommandFlowTransition(entry, transition)
        }
      }
    }

    return {
      id: `command-flow:${entry.command.core.id}:${step.id}`,
      type: 'list',
      title: step.title,
      subtitle: step.subtitle,
      placeholder: step.placeholder,
      emptyLabel: step.emptyLabel,
      items: step.items.map((choice) => {
        const Icon = choice.icon
        return {
          id: `command-flow:${entry.command.core.id}:${step.id}:${choice.id}`,
          label: choice.title,
          subtitle: choice.subtitle,
          icon: Icon ? <Icon size={14} /> : undefined,
          hint: choice.hotkey,
          onActivate: async () => {
            const session = commandSessionRef.current
            if (!session) return { type: 'keep-open' as const }
            const transition = await choice.onSelect(
              session.context,
              getActiveInteractionController()
            )
            return handleCommandFlowTransition(entry, transition)
          }
        }
      })
    }
  }

  async function handleCommandFlowTransition(
    entry: WhitebloomRegisteredCommandForContext<any>,
    transition: WhitebloomCommandFlowTransition<any, any>
  ): Promise<PaletteActivation | void> {
    switch (transition.type) {
      case 'cancel':
        return { type: 'set-mode', mode: initialMode }
      case 'submit':
        return executePaletteCommand(entry.command.core.id, transition.args)
      case 'step':
        return {
          type: 'set-mode',
          mode: createCommandFlowMode(entry, transition.step)
        }
    }
  }

  const activateRegisteredCommand = useCallback(
    async (entry: WhitebloomRegisteredCommandForContext<any>) => {
      if (entry.command.flow) {
        const session = commandSessionRef.current
        if (!session) return { type: 'keep-open' as const }
        const transition = await entry.command.flow.start(
          session.context,
          getActiveInteractionController()
        )
        return handleCommandFlowTransition(entry, transition)
      }

      return executePaletteCommand(entry.command.core.id)
    },
    [executePaletteCommand, getActiveInteractionController]
  )

  const filtered = useMemo<PaletteRenderedEntry[]>(() => {
    if (mode.type === 'input') return []

    const normalizedQuery = normalizeSearchValue(query)
    const shouldRenderModeItems =
      mode.id !== 'root' ||
      commandSession === undefined ||
      commandBrowseMode === 'visual' ||
      mode.items.length > 0
    const legacyEntries = shouldRenderModeItems
      ? mode.items
          .filter((item) => matchesNormalizedLegacyItemQuery(item, normalizedQuery))
          .map<PaletteRenderedEntry>((item) => ({
            id: item.id,
            label: item.label,
            subtitle: item.subtitle,
            icon: item.icon,
            hint: item.hint,
            onActivate: item.onActivate
          }))
      : []

    if (mode.id !== 'root' || !commandSession) {
      return legacyEntries
    }

    if (commandBrowseMode === 'visual') {
      const legacyLabels = new Set(legacyEntries.map((entry) => entry.label.trim().toLowerCase()))
      const commandEntries = searchPresentedCommands(query, commandSession.context)
        .filter((result) => canPaletteLaunchCommand(result.entry))
        .filter((result) => {
          const title = result.presentation?.title.trim().toLowerCase()
          return !title || !legacyLabels.has(title)
        })
        .map<PaletteRenderedEntry>((result) => {
          const Icon = result.presentation?.icon
          return {
            id: `command:${result.entry.command.core.id}`,
            label: result.presentation?.title ?? result.entry.command.core.id,
            subtitle: result.presentation?.subtitle,
            icon: Icon ? <Icon size={14} /> : undefined,
            hint: result.presentation?.hotkey,
            commandId: result.entry.command.core.id,
            onActivate: () => activateRegisteredCommand(result.entry)
          }
        })

      return [...commandEntries, ...legacyEntries]
    }

    const showNamespaceEntries = commandNamespace !== null || normalizedQuery.length > 0
    const runtimeCommandsById = new Map(
      getRegisteredCommandsForMajorMode(commandSession.context.majorMode).map(
        (entry) => [entry.command.core.id, entry] as const
      )
    )
    const legacyNamespaceEntries = showNamespaceEntries
      ? listLegacyNamespaces(mode.items, commandNamespace)
          .filter((namespace) => namespace.hasChildren)
          .filter(
            (namespace) =>
              !normalizedQuery || namespace.segment.toLowerCase().includes(normalizedQuery)
          )
          .map<PaletteRenderedEntry>((namespace) => ({
            id: `legacy-namespace:${namespace.id}`,
            label: namespace.segment,
            hint: 'Enter',
            onActivate: () => {
              setCommandNamespace(namespace.id)
              setQuery('')
              return { type: 'keep-open' as const }
            }
          }))
      : []
    const namespaceEntries = showNamespaceEntries
      ? listVirtualCommandNamespaces(commandSession.context, {
          namespace: commandNamespace ?? undefined
        })
          .filter((namespace) => namespace.hasChildren)
          .map<PaletteRenderedEntry | null>((namespace) => {
            const runnableEntries = namespace.entries.filter((entry) =>
              canPaletteLaunchCommand(entry)
            )
            if (runnableEntries.length === 0) return null

            return {
              id: `namespace:${namespace.id}`,
              label: namespace.segment,
              hint: 'Enter',
              onActivate: () => {
                setCommandNamespace(namespace.id)
                setQuery('')
                return { type: 'keep-open' as const }
              }
            } satisfies PaletteRenderedEntry
          })
          .filter((entry): entry is PaletteRenderedEntry => entry !== null)
          .filter(
            (entry) => !normalizedQuery || entry.label.toLowerCase().includes(normalizedQuery)
          )
      : []

    const legacyCommandEntries = mode.items
      .filter((item) => {
        const namespaceKey = getPaletteItemNamespaceKey(item)
        if (!isCommandWithinNamespace(namespaceKey, commandNamespace)) {
          return false
        }

        if (!normalizedQuery) {
          return isDirectLegacyItemInNamespace(item, commandNamespace)
        }

        return matchesNormalizedLegacyItemQuery(item, normalizedQuery)
      })
      .map<PaletteRenderedEntry>((item) => ({
        id: `legacy-command:${item.id}`,
        label: item.label,
        subtitle: item.subtitle,
        icon: item.icon,
        hint: item.hint,
        onActivate: item.onActivate
      }))

    const commandEntries = searchCoreCommands('', commandSession.context, {
      namespace: commandNamespace ?? undefined
    })
      .filter((result) => canPaletteLaunchCommand(result.entry))
      .filter(
        (result) =>
          normalizedQuery ||
          commandNamespace === null ||
          isDirectCommandInNamespace(result.entry.command.core.id, commandNamespace)
      )
      .map<PaletteRenderedEntry>((result) => {
        const presentation = result.entry.command.presentations?.find(
          (candidate) => candidate.mode === commandSession.context.majorMode
        )
        const customAlias = commandAliases[result.entry.command.core.id]
        const primaryAlias = customAlias ?? result.entry.command.core.aliases?.[0]
        return {
          id: `command:${result.entry.command.core.id}`,
          label: result.entry.command.core.id,
          subtitle: presentation?.title,
          hint: (primaryAlias ?? presentation?.hotkey)?.toLowerCase(),
          commandId: result.entry.command.core.id,
          onActivate: () => activateRegisteredCommand(result.entry)
        }
      })
      .filter((entry) => {
        if (!normalizedQuery) return true
        if (entry.label.toLowerCase().includes(normalizedQuery)) return true
        if (entry.subtitle?.toLowerCase().includes(normalizedQuery)) return true
        if (entry.hint?.toLowerCase().includes(normalizedQuery)) return true
        const builtInAliases =
          runtimeCommandsById.get(entry.commandId ?? '')?.command.core.aliases ?? []
        if (builtInAliases.some((alias) => alias.toLowerCase().includes(normalizedQuery))) {
          return true
        }
        return false
      })

    const combined = [
      ...legacyNamespaceEntries,
      ...namespaceEntries,
      ...legacyCommandEntries,
      ...commandEntries
    ]

    if (!normalizedQuery) return combined

    const strictHintMatches = combined.filter((e) => e.hint?.toLowerCase() === normalizedQuery)
    return strictHintMatches.length > 0 ? strictHintMatches : combined
  }, [
    activateRegisteredCommand,
    commandBrowseMode,
    commandAliases,
    commandNamespace,
    commandSession,
    mode,
    query
  ])

  const inputPlaceholder = useMemo(() => {
    if (mode.type === 'input') {
      return mode.placeholder ?? t('petalPalette.searchPlaceholder')
    }

    if (mode.id === 'root' && commandSession && commandBrowseMode === 'meta') {
      return t('petalPalette.metaSearchPlaceholder')
    }

    return mode.placeholder ?? t('petalPalette.searchPlaceholder')
  }, [commandBrowseMode, commandSession, mode, t])

  const busyTitle =
    abortPhase === 'requested'
      ? t('petalPalette.cancellingTitle')
      : abortPhase === 'stalled'
        ? t('petalPalette.stalledTitle')
        : (busyState?.title ?? t('petalPalette.busyTitle'))
  const busyLabel =
    abortPhase === 'requested'
      ? t('petalPalette.cancellingLabel')
      : abortPhase === 'stalled'
        ? t('petalPalette.stalledLabel')
        : (busyState?.label ?? t('petalPalette.busyLabel'))
  const busyProgress =
    abortPhase === 'idle' && typeof busyState?.progress === 'number'
      ? clampProgress(busyState.progress)
      : null

  // Reset active index when filtered list changes
  useEffect(() => {
    setActiveIndex(0)
  }, [filtered.length])

  useEffect(() => {
    setQuery(mode.type === 'input' ? (mode.initialValue ?? '') : '')
    setActiveIndex(0)
  }, [mode])

  // Scroll active item into view
  useEffect(() => {
    const list = listRef.current
    if (!list) return
    const activeEl = list.children[activeIndex] as HTMLElement | undefined
    activeEl?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex])

  const activate = useCallback(
    async (item: PaletteRenderedEntry) => {
      const operationToken = beginOperation()
      try {
        const result = await item.onActivate()

        if (!result || result.type === 'close') {
          closePalette()
          return
        }

        if (result.type === 'keep-open') {
          return
        }

        setMode(result.mode)
      } catch (error) {
        console.warn('[petal-palette] command activation failed', error)
      } finally {
        finishOperation(operationToken)
      }
    },
    [beginOperation, closePalette, finishOperation]
  )

  const submitInputMode = useCallback(async () => {
    if (mode.type !== 'input') return

    const operationToken = beginOperation()
    try {
      const result = await mode.onSubmit(query)
      if (!result || result.type === 'close') {
        closePalette()
        return
      }

      if (result.type === 'keep-open') {
        return
      }

      setMode(result.mode)
    } catch (error) {
      console.warn('[petal-palette] input submission failed', error)
    } finally {
      finishOperation(operationToken)
    }
  }, [beginOperation, closePalette, finishOperation, mode, query])

  const openAliasEditor = useCallback(() => {
    if (mode.type === 'input') return
    if (mode.id !== 'root') return
    if (!commandSession) return
    if (commandBrowseMode !== 'meta') return

    const item = filtered[activeIndex]
    if (!item?.commandId) return

    const commandId = item.commandId
    const currentAlias = commandAliases[commandId] ?? ''

    setMode({
      id: `alias:${commandId}`,
      type: 'input',
      title: 'Set Command Alias',
      subtitle: commandId,
      placeholder: 'Type a short alias or leave blank to clear',
      submitLabel: 'Save Alias',
      initialValue: currentAlias,
      onSubmit: async (value) => {
        await updateCommandAlias(commandId, value)
        setCommandBrowseMode('meta')
        setCommandNamespace(null)
        setQuery('')
        setActiveIndex(0)
        return { type: 'set-mode', mode: initialMode }
      }
    })
  }, [
    activeIndex,
    commandAliases,
    commandBrowseMode,
    commandSession,
    filtered,
    initialMode,
    mode.type,
    updateCommandAlias
  ])

  // Keyboard — capture phase so it fires before Canvas bubble-phase listeners
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isBusy) {
        event.preventDefault()
        event.stopImmediatePropagation()
        if (event.key === 'Escape') {
          requestAbortCurrentOperation()
        }
        return
      }

      if (isAltXShortcut(event) && commandSession && mode.id === 'root') {
        event.preventDefault()
        event.stopImmediatePropagation()
        setCommandBrowseMode((current) => (current === 'visual' ? 'meta' : 'visual'))
        setCommandNamespace(null)
        setQuery('')
        setActiveIndex(0)
        return
      }

      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopImmediatePropagation()
        closePalette()
        return
      }

      if (
        event.key === 'F2' &&
        commandSession &&
        mode.type !== 'input' &&
        mode.id === 'root' &&
        commandBrowseMode === 'meta'
      ) {
        event.preventDefault()
        event.stopImmediatePropagation()
        void openAliasEditor()
        return
      }

      if (event.key === 'Tab') {
        event.preventDefault()
        event.stopImmediatePropagation()
        closePalette()
        return
      }

      if (
        event.key === 'Backspace' &&
        commandSession &&
        mode.id === 'root' &&
        commandBrowseMode === 'meta' &&
        query.length === 0 &&
        commandNamespace !== null &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey &&
        !event.shiftKey
      ) {
        event.preventDefault()
        setCommandNamespace(getParentNamespace(commandNamespace))
        setActiveIndex(0)
        return
      }

      if (event.key === 'ArrowDown') {
        if (mode.type === 'input') return
        event.preventDefault()
        setActiveIndex((index) => (index + 1) % Math.max(1, filtered.length))
        return
      }

      if (event.key === 'ArrowUp') {
        if (mode.type === 'input') return
        event.preventDefault()
        setActiveIndex(
          (index) => (index - 1 + Math.max(1, filtered.length)) % Math.max(1, filtered.length)
        )
        return
      }

      if (event.key === 'Enter') {
        event.preventDefault()
        if (mode.type === 'input') {
          void submitInputMode()
          return
        }
        const item = filtered[activeIndex]
        if (item) {
          void activate(item)
        }
      }
    }

    document.addEventListener('keydown', onKeyDown, true)
    return () => document.removeEventListener('keydown', onKeyDown, true)
  }, [
    activeIndex,
    activate,
    closePalette,
    commandBrowseMode,
    commandNamespace,
    commandSession,
    filtered,
    isBusy,
    mode,
    openAliasEditor,
    query.length,
    requestAbortCurrentOperation,
    submitInputMode
  ])

  // Dismiss on pointer down outside
  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      if (isBusy) return
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        closePalette()
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [closePalette, isBusy])

  // Auto-focus input on mount
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const listMaxHeight = MAX_VISIBLE_ITEMS * ITEM_HEIGHT_PX

  return createPortal(
    <div
      className={[
        'petal-palette__backdrop',
        isBusy ? 'petal-palette__backdrop--busy' : '',
        abortPhase === 'stalled' ? 'petal-palette__backdrop--stalled' : ''
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div
        ref={containerRef}
        className={[
          'petal-palette',
          commandSession && commandBrowseMode === 'meta' ? 'petal-palette--meta' : '',
          isBusy ? 'petal-palette--busy' : '',
          abortPhase === 'stalled' ? 'petal-palette--stalled' : ''
        ]
          .filter(Boolean)
          .join(' ')}
        role="dialog"
        aria-modal="true"
        aria-label={t('petalPalette.ariaLabel')}
        onMouseDown={(e) => e.preventDefault()}
      >
        <div className="petal-palette__search">
          {commandBrowseMode === 'meta' && commandNamespace !== null ? (
            <span className="petal-palette__input-prefix">{commandNamespace}</span>
          ) : null}
          <input
            ref={inputRef}
            className="petal-palette__input"
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={inputPlaceholder}
            autoComplete="off"
            spellCheck={false}
            readOnly={isBusy}
            aria-disabled={isBusy}
          />
        </div>

        {mode.title || mode.subtitle ? (
          <div className="petal-palette__mode-copy">
            {mode.title ? <div className="petal-palette__mode-title">{mode.title}</div> : null}
            {mode.subtitle ? (
              <div className="petal-palette__mode-subtitle">{mode.subtitle}</div>
            ) : null}
          </div>
        ) : null}

        {isBusy ? (
          <div className="petal-palette__busy" role="status" aria-live="polite" aria-busy="true">
            <div className="petal-palette__busy-spinner" aria-hidden="true" />
            <div className="petal-palette__busy-title">{busyTitle}</div>
            <div className="petal-palette__busy-label">{busyLabel}</div>
            {busyProgress !== null ? (
              <div className="petal-palette__busy-progress" aria-hidden="true">
                <div
                  className="petal-palette__busy-progress-fill"
                  style={{ width: `${busyProgress * 100}%` }}
                />
              </div>
            ) : null}
          </div>
        ) : mode.type === 'input' ? (
          <div className="petal-palette__submit-wrap">
            <button
              type="button"
              className="petal-palette__submit"
              disabled={isBusy}
              onClick={() => {
                void submitInputMode()
              }}
            >
              {mode.submitLabel ?? 'Submit'}
            </button>
          </div>
        ) : (
          <div
            ref={listRef}
            className="petal-palette__list"
            style={{ maxHeight: listMaxHeight }}
            role="listbox"
          >
            {filtered.length === 0 ? (
              <div className="petal-palette__empty">
                {mode.emptyLabel ?? emptyLabel ?? t('petalPalette.noResults')}
              </div>
            ) : (
              filtered.map((item, i) => (
                <button
                  key={item.id}
                  className={[
                    'petal-palette__item',
                    i === activeIndex ? 'petal-palette__item--active' : ''
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  role="option"
                  aria-selected={i === activeIndex}
                  onClick={() => {
                    void activate(item)
                  }}
                  onMouseEnter={() => setActiveIndex(i)}
                  tabIndex={-1}
                >
                  {item.icon && <span className="petal-palette__item-icon">{item.icon}</span>}
                  <span className="petal-palette__item-copy">
                    <span className="petal-palette__item-label">{item.label}</span>
                    {item.subtitle ? (
                      <span className="petal-palette__item-subtitle">{item.subtitle}</span>
                    ) : null}
                  </span>
                  {item.hint && <span className="petal-palette__item-hint">{item.hint}</span>}
                </button>
              ))
            )}
          </div>
        )}
      </div>
    </div>,
    document.body
  )
}
