import React, { useCallback, useContext } from 'react'
import { type NodeProps } from '@xyflow/react'
import { HelpCircle, AlertCircle } from 'lucide-react'
import { resolveModuleById } from '../modules/registry'
import type { Size } from '../shared/types'
import { BloomContext } from './BloomContext'
import { NativeFileBudNode } from './NativeFileBudNode'
import type { WhitebloomModule } from '../modules/types'
import { CardinalHandles } from './CardinalHandles'

// ---------------------------------------------------------------------------
// Data shape stored in the RF node's `data` field for all bud nodes
// ---------------------------------------------------------------------------

export type BudData = {
  /** Module id for concrete-typed buds; null for void-typed buds handled natively by the OS. */
  moduleType: string | null
  resource: string
  size: Size
  label?: string
}

// ---------------------------------------------------------------------------
// Error boundary
// ---------------------------------------------------------------------------

type ErrorBoundaryState = { error: Error | null }
type ErrorBoundaryProps = { children: React.ReactNode; fallback: (error: Error) => React.ReactNode }

class BudErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error }
  }

  render(): React.ReactNode {
    if (this.state.error) {
      return this.props.fallback(this.state.error)
    }
    return this.props.children
  }
}

// ---------------------------------------------------------------------------
// Placeholder: unknown module type
// ---------------------------------------------------------------------------

function UnknownBudNode({
  label,
  moduleType,
  size,
  selected
}: {
  label?: string
  moduleType: string
  size: Size
  selected: boolean
}) {
  const displayLabel = label || moduleType

  return (
    <div
      style={{
        width: size.w,
        height: size.h,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        borderRadius: 8,
        border: `1.5px dashed var(--color-secondary-fg)`,
        background: 'var(--color-bg)',
        opacity: 0.7,
        outline: selected ? '2px solid var(--color-accent)' : 'none',
        outlineOffset: 2
      }}
    >
      <HelpCircle size={20} strokeWidth={1.5} color="var(--color-secondary-fg)" />
      <span
        style={{
          fontSize: 11,
          color: 'var(--color-secondary-fg)',
          maxWidth: '80%',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap'
        }}
      >
        {displayLabel}
      </span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Placeholder: render error
// ---------------------------------------------------------------------------

function ErrorBudNode({
  label,
  size,
  selected,
  reason
}: {
  label?: string
  size: Size
  selected: boolean
  reason: string
}) {
  return (
    <div
      style={{
        width: size.w,
        height: size.h,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        borderRadius: 8,
        border: '1.5px dashed var(--color-destructive, #e05)',
        background: 'var(--color-bg)',
        opacity: 0.8,
        outline: selected ? '2px solid var(--color-destructive, #e05)' : 'none',
        outlineOffset: 2
      }}
    >
      <AlertCircle size={20} strokeWidth={1.5} color="var(--color-destructive, #e05)" />
      {label ? (
        <span
          style={{
            fontSize: 11,
            color: 'var(--color-secondary-fg)',
            maxWidth: '80%',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}
        >
          {label}
        </span>
      ) : null}
      <span
        style={{
          fontSize: 10,
          color: 'var(--color-destructive, #e05)',
          maxWidth: '80%',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          textAlign: 'center'
        }}
      >
        {reason}
      </span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Inner component — separated so hooks run unconditionally after module lookup
// ---------------------------------------------------------------------------

function BudNodeInner({
  id,
  data,
  selected,
  dragging,
  module
}: {
  id: string
  data: BudData
  selected: boolean
  dragging: boolean
  module: WhitebloomModule
}) {
  const bloomSetter = useContext(BloomContext)

  const onBloom = useCallback(() => {
    bloomSetter?.({ nodeId: id, module, resource: data.resource })
  }, [bloomSetter, id, module, data.resource])

  return (
    <BudErrorBoundary
      fallback={(error) => (
        <ErrorBudNode
          label={data.label}
          size={data.size}
          selected={selected}
          reason={error.message}
        />
      )}
    >
      <module.NodeComponent
        id={id}
        label={data.label}
        resource={data.resource}
        size={data.size}
        selected={selected}
        dragging={dragging}
        onBloom={onBloom}
      />
    </BudErrorBoundary>
  )
}

// ---------------------------------------------------------------------------
// BudNode — the single ReactFlow node component for all bud types
// ---------------------------------------------------------------------------

export function BudNode({ id, data, selected, dragging }: NodeProps) {
  const budData = data as BudData
  const module = resolveModuleById(budData.moduleType)
  // Void-typed bud (type: null) — no handler registered, open with OS default
  if (budData.moduleType === null) {
    return (
      <>
        <NativeFileBudNode
          id={id}
          resource={budData.resource}
          label={budData.label}
          size={budData.size}
          selected={selected ?? false}
          onOpen={() => void window.api.openFile(budData.resource)}
        />
        <CardinalHandles hidden={dragging} />
      </>
    )
  }

  // Concrete-typed bud whose module isn't installed
  if (!module) {
    return (
      <>
        <UnknownBudNode
          label={budData.label}
          moduleType={budData.moduleType}
          size={budData.size}
          selected={selected ?? false}
        />
        <CardinalHandles hidden={dragging} />
      </>
    )
  }

  return (
    <>
      <BudNodeInner
        id={id}
        data={budData}
        selected={selected ?? false}
        dragging={dragging ?? false}
        module={module}
      />
      <CardinalHandles hidden={dragging} />
    </>
  )
}
