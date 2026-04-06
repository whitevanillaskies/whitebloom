import { PetalField } from '@renderer/components/petal'

type BoardSectionProps = {
  name: string | undefined
  brief: string | undefined
  onChange: (patch: { name?: string; brief?: string }) => void
}

export default function BoardSection({ name, brief, onChange }: BoardSectionProps) {
  return (
    <div className="settings-section">
      <h2 className="settings-section__title">Board</h2>
      <div className="settings-section__fields">
        <PetalField
          label="Board name"
          value={name ?? ''}
          placeholder="Untitled"
          onChange={(e) => onChange({ name: e.target.value })}
        />
        <PetalField
          as="textarea"
          label="Brief"
          hint="A message for AI agents — describe what this board is for, what context they should keep in mind, or how you'd like them to help."
          value={brief ?? ''}
          placeholder="This board is for…"
          rows={6}
          onChange={(e) => onChange({ brief: e.target.value })}
        />
      </div>
    </div>
  )
}
