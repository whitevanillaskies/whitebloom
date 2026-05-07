import { createContext, useContext } from 'react'

export const WebBloomVisibilityContext = createContext(true)

export function useWebBloomNativeViewsVisible(): boolean {
  return useContext(WebBloomVisibilityContext)
}
