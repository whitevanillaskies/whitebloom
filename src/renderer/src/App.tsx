import { useEffect } from 'react'
import { ReactFlowProvider } from '@xyflow/react'
import { Canvas } from './canvas/Canvas'
import { useBoardStore } from './stores/board'
import { makeLexicalContent } from './shared/types'

function App(): React.JSX.Element {
  const addNode = useBoardStore((s) => s.addNode)
  const nodes = useBoardStore((s) => s.nodes)

  // Seed a couple of text nodes so the canvas isn't empty
  useEffect(() => {
    if (nodes.length > 0) return
    addNode({
      id: 'node-1',
      kind: 'leaf',
      type: 'text',
      position: { x: 100, y: 100 },
      size: { w: 200, h: 80 },
      content: makeLexicalContent('Hello Whitebloom'),
      widthMode: 'auto',
      wrapWidth: null
    })
    addNode({
      id: 'node-2',
      kind: 'leaf',
      type: 'text',
      position: { x: 400, y: 250 },
      size: { w: 200, h: 80 },
      content: makeLexicalContent('Drag me around'),
      widthMode: 'auto',
      wrapWidth: null
    })
  }, [])

  return (
    <ReactFlowProvider>
      <div style={{ width: '100vw', height: '100vh' }}>
        <Canvas />
      </div>
    </ReactFlowProvider>
  )
}

export default App
