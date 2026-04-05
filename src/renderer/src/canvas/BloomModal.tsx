import { useCallback, useEffect, useState } from 'react'
import type { ActiveBloom } from './BloomContext'
import './BloomModal.css'

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; initialData: string }

type Props = {
  bloom: ActiveBloom
  workspaceRoot: string
  onClose: () => void
}

export function BloomModal({ bloom, workspaceRoot, onClose }: Props) {
  const [loadState, setLoadState] = useState<LoadState>({ status: 'loading' })

  useEffect(() => {
    setLoadState({ status: 'loading' })
    window.api
      .readBlossom(workspaceRoot, bloom.resource)
      .then((data) => setLoadState({ status: 'ready', initialData: data }))
      .catch((err) =>
        setLoadState({
          status: 'error',
          message: err instanceof Error ? err.message : 'Unable to read blossom file.'
        })
      )
  }, [workspaceRoot, bloom.resource])

  const handleSave = useCallback(
    async (data: string): Promise<void> => {
      const result = await window.api.writeBlossom(workspaceRoot, bloom.resource, data)
      if (!result.ok) throw new Error('Unable to save blossom file.')
    },
    [workspaceRoot, bloom.resource]
  )

  const { EditorComponent } = bloom.module

  return (
    <div className="bloom-modal" role="dialog" aria-modal="true">
      {loadState.status === 'loading' && <div className="bloom-modal__loading" />}

      {loadState.status === 'error' && (
        <div className="bloom-modal__error">
          <p className="bloom-modal__error-message">{loadState.message}</p>
          <button type="button" className="bloom-modal__error-close" onClick={onClose}>
            Close
          </button>
        </div>
      )}

      {loadState.status === 'ready' && !EditorComponent && (
        <div className="bloom-modal__error">
          <p className="bloom-modal__error-message">No editor available for this module.</p>
          <button type="button" className="bloom-modal__error-close" onClick={onClose}>
            Close
          </button>
        </div>
      )}

      {loadState.status === 'ready' && EditorComponent && (
        <EditorComponent
          resource={bloom.resource}
          workspaceRoot={workspaceRoot}
          initialData={loadState.initialData}
          onSave={handleSave}
          onClose={onClose}
        />
      )}
    </div>
  )
}
