import obsidianLogoUrl from './obsidian-logo.svg'

export function ObsidianBloomIcon({ size = 16 }: { size?: number }) {
  return (
    <img
      src={obsidianLogoUrl}
      width={size}
      height={size}
      alt=""
      draggable={false}
    />
  )
}
