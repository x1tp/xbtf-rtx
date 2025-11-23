import { Suspense, useRef, useState, useEffect } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { Scene } from './Scene';
import { Loader, ArcballControls, Grid, GizmoHelper, GizmoViewport, Text, OrthographicCamera, PerspectiveCamera as DreiPerspectiveCamera, Line, Environment } from '@react-three/drei';
import { HUD } from './components/HUD';
import { TradingInterface } from './components/TradingInterface';
import { RTXEffects } from './components/RTXEffects';
import { PathTracerOverlay } from './components/PathTracerOverlay';
import type { PerspectiveCamera, Scene as ThreeScene, Mesh, MeshStandardMaterial, WebGLRenderer } from 'three';
import { Box3, Vector3, SRGBColorSpace, ACESFilmicToneMapping } from 'three';
import { Station } from './components/Station';

const SDR_EXPOSURE = 1.2;
const HDR_EXPOSURE = 0.9;

function App() {
  const sceneRef = useRef<ThreeScene | null>(null);
  const cameraRef = useRef<PerspectiveCamera | null>(null);
  const glRef = useRef<WebGLRenderer | null>(null);
  const params = new URLSearchParams(window.location.search);
  const isViewer = params.get('viewer') === 'station';
  const modelParam = params.get('model') || null;

  function detectFloatSupport() {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2');
    if (!gl) return { supported: false, reason: 'WebGL2 not available' };
    const hasFloat = Boolean(gl.getExtension('EXT_color_buffer_float'));
    if (!hasFloat) return { supported: false, reason: 'Missing EXT_color_buffer_float' };
    return { supported: true, reason: null };
  }

  const det = detectFloatSupport();
  const [pathTracerEnabled, setPathTracerEnabled] = useState(true);
  const [ptStatus, setPtStatus] = useState<'idle' | 'ready' | 'unsupported' | 'error'>(
    det.supported ? 'idle' : 'unsupported'
  );
  const [ptMessage, setPtMessage] = useState<string | null>(det.reason);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'KeyR' && ptStatus !== 'unsupported') {
        setPathTracerEnabled((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [ptStatus]);

  if (isViewer) {
    return (
      <div style={{ width: '100vw', height: '100vh', background: '#e9eef5' }}>
        <ViewerCanvas modelPath={modelParam || undefined} />
      </div>
    );
  }

  return (
    <div style={{ width: '100vw', height: '100vh', background: 'black' }}>
      <Canvas
        shadows
        camera={{ fov: 75, near: 0.1, far: 20000 }}
        onCreated={({ gl, scene, camera }) => {
          gl.outputColorSpace = SRGBColorSpace;
          gl.toneMapping = ACESFilmicToneMapping;
          gl.toneMappingExposure = pathTracerEnabled ? HDR_EXPOSURE : SDR_EXPOSURE;
          gl.shadowMap.enabled = true;
          // import { PCFSoftShadowMap } from 'three'
          // ensure type is available
          // set via any to avoid type issues in TSX without extra imports
          (gl.shadowMap as any).type = (require('three') as any).PCFSoftShadowMap;
          glRef.current = gl as WebGLRenderer;
          sceneRef.current = scene;
          cameraRef.current = camera as PerspectiveCamera;
        }}
      >
        <Suspense fallback={null}>
          <Scene hdr={pathTracerEnabled} />
          <RTXEffects enabled={!pathTracerEnabled} />
        </Suspense>
      </Canvas>
      <ExposureSync enabled={pathTracerEnabled} glRef={glRef} />
      <PathTracerOverlay
        enabled={pathTracerEnabled}
        sceneRef={sceneRef}
        cameraRef={cameraRef}
        onStatus={(status, message) => {
          setPtStatus(status);
          setPtMessage(message ?? null);
          if (status === 'unsupported' || status === 'error') {
            setPathTracerEnabled(false);
          }
        }}
      />
      <Loader />
      <HUD />
      <TradingInterface />
      <div style={{
        position: 'absolute',
        top: 20,
        left: 20,
        color: 'white',
        fontFamily: 'monospace',
        pointerEvents: 'none'
      }}>
        <h1>XBTF-RTX</h1>
        <p>WASD: Pitch/Roll | Mouse: Pitch/Yaw</p>
        <p>W/S (Hold): Throttle</p>
        <p>Arrows: Orbit camera</p>
        <p>[ / ]: Camera distance</p>
        <p>R: Toggle RTX</p>
        <p>C: Dock (when close to station)</p>
      </div>
      <div style={{
        position: 'absolute',
        top: 20,
        right: 20,
        color: '#c3e7ff',
        fontFamily: 'monospace',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        width: '220px'
      }}>
        <button
          onClick={() => {
            if (ptStatus === 'unsupported') return;
            setPtMessage(null);
            setPathTracerEnabled((prev) => !prev);
          }}
          disabled={ptStatus === 'unsupported'}
          style={{
            padding: '8px 10px',
            background:
              ptStatus === 'ready' && pathTracerEnabled
                ? 'linear-gradient(90deg, #3fb6ff, #00ffa6)'
                : '#0f2230',
            border: '1px solid #3fb6ff',
            color: ptStatus === 'ready' && pathTracerEnabled ? '#001216' : '#c3e7ff',
            fontWeight: 700,
            cursor: ptStatus === 'unsupported' ? 'not-allowed' : 'pointer',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            borderRadius: '4px',
            boxShadow: ptStatus === 'ready' && pathTracerEnabled ? '0 0 10px #3fb6ff' : 'none'
          }}
        >
          {ptStatus === 'unsupported'
            ? 'Path Tracer: unavailable'
            : pathTracerEnabled
              ? 'Path Tracer: ON'
              : 'Path Tracer: OFF'}
        </button>
        <div style={{ fontSize: '12px', lineHeight: 1.4, color: '#8ab6d6' }}>
          Experimental path tracer (WebGL2 + float targets). Ship controls pause while active so the view stays stable;
          stop moving for a moment to let it converge. Disables the faux RTX post.
          {ptMessage ? ` - ${ptMessage}` : ''}
        </div>
      </div>
    </div>
  );
}

function ExposureSync({ enabled, glRef }: { enabled: boolean; glRef: React.MutableRefObject<WebGLRenderer | null> }) {
  useEffect(() => {
    const gl = glRef.current;
    if (!gl) return;
    gl.toneMappingExposure = enabled ? HDR_EXPOSURE : SDR_EXPOSURE;
  }, [enabled, glRef]);
  return null;
}

export default App;

function ViewerCanvas({ modelPath }: { modelPath?: string }) {
  const [ortho, setOrtho] = useState(false);
  const [showGrid, setShowGrid] = useState(false);
  const [showAxes, setShowAxes] = useState(true);
  const [showDims, setShowDims] = useState(true);
  const [wireframe, setWireframe] = useState(false);
  const [view, setView] = useState<'iso' | 'front' | 'right' | 'top'>('iso');
  const [frameIndex, setFrameIndex] = useState(0);
  const sceneRef = useRef<ThreeScene | null>(null);
  const cameraRef = useRef<PerspectiveCamera | null>(null);
  const [dims, setDims] = useState<[number, number, number]>([0, 0, 0]);
  const [center, setCenter] = useState<[number, number, number]>([0, 0, 0]);
  useEffect(() => {
    const t = setInterval(() => {
      const s = sceneRef.current;
      if (!s) return;
      const obj = s.getObjectByName('Station');
      if (!obj) return;
      const bbox = new Box3().setFromObject(obj);
      const size = bbox.getSize(new Vector3());
      const c = bbox.getCenter(new Vector3());
      setDims([size.x, size.y, size.z]);
      setCenter([c.x, c.y, c.z]);
    }, 200);
    return () => clearInterval(t);
  }, []);
  useEffect(() => { setFrameIndex((i) => i + 1); }, []);
  useEffect(() => {
    const s = sceneRef.current;
    if (!s) return;
    const obj = s.getObjectByName('Station');
    if (!obj) return;
    obj.traverse((o) => {
      const mesh = o as Mesh;
      const mat = mesh.material as MeshStandardMaterial | MeshStandardMaterial[] | null | undefined;
      if (!mat) return;
      if (Array.isArray(mat)) mat.forEach((mm) => (mm.wireframe = wireframe)); else (mat as MeshStandardMaterial).wireframe = wireframe;
    });
  }, [wireframe]);
  const CameraController = () => {
    const state = useThree();
    const camera = state.camera as PerspectiveCamera;
    type ControlsLike = { setTarget?: (x: number, y: number, z: number) => void; target?: { set: (x: number, y: number, z: number) => void }; update?: () => void };
    const controls = (state as unknown as { controls?: ControlsLike }).controls;
    useEffect(() => {
      const c = center;
      const d = dims;
      if (!camera) return;
      const cx = c[0];
      const cy = c[1];
      const cz = c[2];
      const kx = Math.max(d[0], 1) * 1.2;
      const ky = Math.max(d[1], 1) * 1.2;
      const kz = Math.max(d[2], 1) * 1.2;
      if (view === 'front') camera.position.set(cx, cy, cz + kz);
      else if (view === 'right') camera.position.set(cx + kx, cy, cz);
      else if (view === 'top') camera.position.set(cx, cy + ky, cz);
      else camera.position.set(cx + kx, cy + ky, cz + kz);
      camera.lookAt(cx, cy, cz);
      if (controls) {
        if (typeof controls.setTarget === 'function') {
          controls.setTarget(cx, cy, cz);
        } else if (controls.target && typeof controls.target.set === 'function') {
          controls.target.set(cx, cy, cz);
        }
        if (typeof controls.update === 'function') controls.update();
      }
    }, [frameIndex, view, ortho]);
    return null;
  };
  return (
    <>
      <Canvas
        orthographic={false}
        onCreated={({ scene, camera }) => {
          sceneRef.current = scene;
          cameraRef.current = camera as PerspectiveCamera;
        }}
      >
        <Suspense fallback={null}>
          {ortho ? (
            <OrthographicCamera makeDefault position={[10, 10, 10]} zoom={40} />
          ) : (
            <DreiPerspectiveCamera makeDefault fov={50} position={[10, 10, 10]} />
          )}
          <color attach="background" args={["#e9eef5"]} />
          <hemisphereLight args={["#bcdfff", "#223344", 0.5]} />
          <directionalLight position={[10, 10, 10]} intensity={1.25} color="#ffffff" />
          <directionalLight position={[-10, 6, -12]} intensity={0.8} color="#a9c9ff" />
          <ambientLight intensity={0.1} />
          <Environment preset="warehouse" />
          <Station position={[0, 0, 0]} rotate={false} showLights={false} modelPath={modelPath} />
          {showGrid && (
            <Grid
              position={[center[0], center[1] - dims[1] / 2 - 0.5, center[2]]}
              args={[100, 100]}
              cellSize={1}
              cellThickness={0.5}
              sectionSize={10}
              sectionThickness={1}
              followCamera
              infiniteGrid
            />
          )}
          {showAxes && (
            <GizmoHelper alignment="bottom-right" margin={[80, 80]}>
              <GizmoViewport axisColors={["#f00", "#0f0", "#00f"]} labelColor="#fff" />
            </GizmoHelper>
          )}
          {showDims && <Dimensions center={center} dims={dims} />}
          <ArcballControls
            makeDefault
            enablePan
            enableZoom
            dampingFactor={0.08}
            zoomSpeed={1}
            panSpeed={1}
            minDistance={2}
            maxDistance={500}
          />
          <CameraController />
        </Suspense>
      </Canvas>
      <div style={{
        position: 'absolute',
        top: 20,
        left: 20,
        color: '#c3e7ff',
        fontFamily: 'monospace',
        display: 'flex',
        gap: '8px'
      }}>
        <button onClick={() => { setOrtho((p) => !p); setFrameIndex((i) => i + 1); }} style={{ padding: '6px 10px', border: '1px solid #3fb6ff', background: '#0f2230', color: '#c3e7ff' }}>{ortho ? 'Ortho' : 'Persp'}</button>
        <button onClick={() => { setView('iso'); setFrameIndex((i) => i + 1); }} style={{ padding: '6px 10px', border: '1px solid #3fb6ff', background: view === 'iso' ? '#3fb6ff' : '#0f2230', color: view === 'iso' ? '#001216' : '#c3e7ff' }}>Iso</button>
        <button onClick={() => { setView('front'); setFrameIndex((i) => i + 1); }} style={{ padding: '6px 10px', border: '1px solid #3fb6ff', background: view === 'front' ? '#3fb6ff' : '#0f2230', color: view === 'front' ? '#001216' : '#c3e7ff' }}>Front</button>
        <button onClick={() => { setView('right'); setFrameIndex((i) => i + 1); }} style={{ padding: '6px 10px', border: '1px solid #3fb6ff', background: view === 'right' ? '#3fb6ff' : '#0f2230', color: view === 'right' ? '#001216' : '#c3e7ff' }}>Right</button>
        <button onClick={() => { setView('top'); setFrameIndex((i) => i + 1); }} style={{ padding: '6px 10px', border: '1px solid #3fb6ff', background: view === 'top' ? '#3fb6ff' : '#0f2230', color: view === 'top' ? '#001216' : '#c3e7ff' }}>Top</button>
        <button onClick={() => setFrameIndex((i) => i + 1)} style={{ padding: '6px 10px', border: '1px solid #3fb6ff', background: '#0f2230', color: '#c3e7ff' }}>Frame</button>
        <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <input type="checkbox" checked={showGrid} onChange={(e) => setShowGrid(e.target.checked)} /> Grid
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <input type="checkbox" checked={showAxes} onChange={(e) => setShowAxes(e.target.checked)} /> Axes
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <input type="checkbox" checked={showDims} onChange={(e) => setShowDims(e.target.checked)} /> Dims
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <input type="checkbox" checked={wireframe} onChange={(e) => setWireframe(e.target.checked)} /> Wireframe
        </label>
      </div>
      <Loader />
    </>
  );
}

function Dimensions({ center, dims }: { center: [number, number, number]; dims: [number, number, number] }) {
  const cx = center[0];
  const cy = center[1];
  const cz = center[2];
  const dx = dims[0];
  const dy = dims[1];
  const dz = dims[2];
  const hx = dx / 2;
  const hy = dy / 2;
  const hz = dz / 2;
  const px = 0.2;
  const pz = 0.2;
  const py = 0.2;
  return (
    <>
      <Line points={[[cx - hx, cy - hy - py, cz + hz + pz], [cx + hx, cy - hy - py, cz + hz + pz]]} color="#3fb6ff" lineWidth={2} dashed dashSize={0.3} gapSize={0.2} />
      <Text position={[cx, cy - hy - py - 0.5, cz + hz + pz]} fontSize={0.6} color="#c3e7ff">{dx.toFixed(2)}</Text>
      <Line points={[[cx + hx + px, cy - hy, cz - hz], [cx + hx + px, cy + hy, cz - hz]]} color="#00ffa6" lineWidth={2} dashed dashSize={0.3} gapSize={0.2} />
      <Text position={[cx + hx + px + 0.5, cy, cz - hz]} fontSize={0.6} color="#c3e7ff">{dy.toFixed(2)}</T