import { Image } from 'lucide-react'

export function ImageIcon({ size = 16 }: { size?: number }): JSX.Element {
  return <Image size={size} strokeWidth={1.5} />
}
