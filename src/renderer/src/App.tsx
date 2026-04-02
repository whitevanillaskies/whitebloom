import { ReactFlowProvider } from '@xyflow/react'
import { Canvas } from './canvas/Canvas'

function App(): React.JSX.Element {
  return (
    <ReactFlowProvider>
      <div style={{ width: '100vw', height: '100vh' }}>
        <Canvas />
      </div>
    </ReactFlowProvider>
  )
}

export default App
