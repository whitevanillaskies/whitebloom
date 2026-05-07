import type { ReactElement } from 'react'
import { Globe } from 'lucide-react'

export function WebBloomIcon({ size = 24 }: { size?: number }): ReactElement {
  return <Globe size={size} strokeWidth={1.6} />
}
