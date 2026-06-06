import { Canvas } from '@react-three/fiber'
import { Stats, Loader } from '@react-three/drei'
import { Suspense } from 'react'
import VoxelTerrain from './VoxelTerrain'
import './App.css'

function App() {
  return (
    <div id="canvas-container">
      <Suspense fallback={<div className="loading">Initializing Voxel Engine...</div>}>
        <Canvas
          camera={{ position: [0, 0, 1] }}
          gl={{
            antialias: false,
            powerPreference: "high-performance",
            preserveDrawingBuffer: true
          }}
          dpr={[1, 2]}
        >
          <VoxelTerrain />
        </Canvas>
      </Suspense>

      <div className="ui-overlay">
        <footer>
          <div className="controls-hint">
            <span className="key">W</span> <span className="key">A</span> <span className="key">S</span> <span className="key">D</span>
            <span className="key">Q</span> <span className="key">E</span>
          </div>
        </footer>

        <div className="stats-container">
          <Stats />
        </div>
      </div>
      <Loader />
    </div>
  )
}

export default App
