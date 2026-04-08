import { useCallback, useMemo, useState } from 'react'

export type ArrangementsMaterialSelection = {
  selectedKeys: string[]
  selectedKeySet: Set<string>
  isSelected: (key: string) => boolean
  select: (key: string, additive: boolean) => void
  replace: (keys: Iterable<string>) => void
  clear: () => void
  retain: (keys: Iterable<string>) => void
}

function dedupeSelection(keys: Iterable<string>): string[] {
  return [...new Set(keys)]
}

function toggleSelection(current: string[], key: string, additive: boolean): string[] {
  if (!additive) return [key]

  const next = new Set(current)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  return [...next]
}

function retainSelection(current: string[], keys: Iterable<string>): string[] {
  const allowed = new Set(keys)
  return current.filter((key) => allowed.has(key))
}

function useArrangementsMaterialSelectionState(
  selectedKeys: string[],
  setSelectedKeys: (next: string[] | ((current: string[]) => string[])) => void
): ArrangementsMaterialSelection {
  const selectedKeySet = useMemo(() => new Set(selectedKeys), [selectedKeys])

  const replace = useCallback(
    (keys: Iterable<string>) => {
      setSelectedKeys(dedupeSelection(keys))
    },
    [setSelectedKeys]
  )

  const clear = useCallback(() => {
    setSelectedKeys([])
  }, [setSelectedKeys])

  const retain = useCallback(
    (keys: Iterable<string>) => {
      setSelectedKeys((current) => retainSelection(current, keys))
    },
    [setSelectedKeys]
  )

  const select = useCallback(
    (key: string, additive: boolean) => {
      setSelectedKeys((current) => toggleSelection(current, key, additive))
    },
    [setSelectedKeys]
  )

  const isSelected = useCallback((key: string) => selectedKeySet.has(key), [selectedKeySet])

  return {
    selectedKeys,
    selectedKeySet,
    isSelected,
    select,
    replace,
    clear,
    retain
  }
}

export function useLocalArrangementsMaterialSelection(
  initialKeys: string[] = []
): ArrangementsMaterialSelection {
  const [selectedKeys, setSelectedKeys] = useState<string[]>(() => dedupeSelection(initialKeys))
  return useArrangementsMaterialSelectionState(selectedKeys, setSelectedKeys)
}

export function useControlledArrangementsMaterialSelection(
  selectedKeys: string[],
  onChange: (selectedKeys: string[]) => void
): ArrangementsMaterialSelection {
  const setSelectedKeys = useCallback(
    (next: string[] | ((current: string[]) => string[])) => {
      onChange(typeof next === 'function' ? next(selectedKeys) : next)
    },
    [onChange, selectedKeys]
  )

  return useArrangementsMaterialSelectionState(selectedKeys, setSelectedKeys)
}
