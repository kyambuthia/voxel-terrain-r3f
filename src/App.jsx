import { Canvas } from '@react-three/fiber'
import { Stats, Loader, KeyboardControls } from '@react-three/drei'
import { Suspense, useMemo } from 'react'
import VoxelTerrain from './VoxelTerrain'
import './App.css'

function App() {
  const mapArr = useMemo(() => [
    { name: 'forward', keys: ['ArrowUp', 'w', 'W'] },
    { name: 'backward', keys: ['ArrowDown', 's', 'S'] },
    { name: 'left', keys: ['ArrowLeft', 'a', 'A'] },
    { name: 'right', keys: ['ArrowRight', 'd', 'D'] },
    { name: 'up', keys: ['q', 'Q'] },
    { name: 'down', keys: ['e', 'E'] },
  ], [])

  return (
    <KeyboardControls map={mapArr}>
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
          <header>
            <h1>Plain Planes</h1>
            <div className="badge">Voxel Engine v2.0</div>
          </header>

          <footer>
            <div className="controls-hint">
              <div className="control-group">
                <span className="key">W</span> <span className="key">A</span> <span className="key">S</span> <span className="key">D</span>
                <span className="label">Fly & Steer</span>
              </div>
              <div className="control-group">
                <span className="key">Q</span> <span className="key">E</span>
                <span className="label">Altitude</span>
              </div>
            </div>
          </footer>

          <div className="stats-container">
            <Stats />
          </div>
        </div>
        <Loader />
      </div>
    </KeyboardControls>
  )
}

export default App
