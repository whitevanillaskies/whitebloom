import { createContext } from 'react'
import type { WhitebloomModule } from '../modules/types'

export type ActiveBloom = {
  nodeId: string
  module: WhitebloomModule
  resource: string
}

export type BloomSetter = (bloom: ActiveBloom) => void

export const BloomContext = createContext<BloomSetter | null>(null)
