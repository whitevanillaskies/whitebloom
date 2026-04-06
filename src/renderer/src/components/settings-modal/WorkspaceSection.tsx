import { useState } from 'react'
import { PetalField } from '@renderer/components/petal'
import { useWorkspaceStore } from '@renderer/stores/workspace'

export default function WorkspaceSection() {
  const config = useWorkspaceStore((s) => s.config)
  const updateConfig = useWorkspaceStore((s) => s.updateConfig)

  const [name, setName] = useState(config?.name ?? '')
  const [brief, setBrief] = useState(config?.brief ?? '')

  const handleNameBlur = () => {
    void updateConfig({ name, brief: config?.brief })
  }

  const handleBriefBlur = () => {
    void updateConfig({ name: config?.name, brief })
  }

  return (
    <div className="settings-section">
      <h2 className="settings-section__title">Workspace</h2>
      <div className="settings-section__fields">
        <PetalField
          label="Workspace name"
          value={name}
          placeholder="Untitled workspace"
          onChange={(e) => setName(e.target.value)}
          onBlur={handleNameBlur}
        />
        <PetalField
          as="textarea"
          label="Brief"
          hint="A message for AI agents — describe what this workspace is about, the project context, and how agents should approach it across all boards."
          value={brief}
          placeholder="This workspace is for…"
          rows={6}
          onChange={(e) => setBrief(e.target.value)}
          onBlur={handleBriefBlur}
        />
      </div>
    </div>
  )
}
