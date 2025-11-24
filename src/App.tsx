import { Suspense, useRef, useState, useEffect } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { Scene } from './Scene';
import { Loader, ArcballControls, Grid, GizmoHelper, GizmoViewport, Text, OrthographicCamera, PerspectiveCamera as DreiPerspectiveCamera, Line, Environment } from '@react-three/drei';
import { HUD } from './components/HUD';
import { TradingInterface } from './components/TradingInterface';
import { SimpleEffects } from './components/SimpleEffects';
import { Cockpit } from './components/Cockpit';
import type { PerspectiveCamera, Scene as ThreeScene, Mesh, MeshStandardMaterial, WebGLRenderer } from 'three';
import { Box3, Vector3, Vector2, SRGBColorSpace, ACESFilmicToneMapping, PCFSoftShadowMap, Raycaster } from 'three';
import { Station } from './components/Station';
import { PhysicsStepper } from './physics/PhysicsStepper';

const SDR_EXPOSURE = 1.2;

function App() {
  const sceneRef = useRef<ThreeScene | null>(null);
  const cameraRef = useRef<PerspectiveCamera | null>(null);
  const glRef = useRef<WebGLRenderer | null>(null);
  const params = new URLSearchParams(window.location.search);
  const isViewer = params.get('viewer') === 'station';
  const modelParam = params.get('model') || null;
  const adminMode = params.get('admin') === 'ship';
  const adminModel = params.get('model') || '/models/00000.obj';
  const path = window.location.pathname;

  if (isViewer) {
    return (
      <div style={{ width: '100vw', height: '100vh', background: '#e9eef5' }}>
        <ViewerCanvas modelPath={modelParam || undefined} />
      </div>
    );
  }

  if (path === '/admin') {
    return (
      <AdminHome />
    );
  }

  if (adminMode || path.startsWith('/admin/ship')) {
    const modelFromPath = new URLSearchParams(window.location.search).get('model') || adminModel;
    return (
      <div style={{ width: '100vw', height: '100vh', background: '#0b1016' }}>
        <ShipEditorCanvas modelPath={modelFromPath} />
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
          gl.toneMappingExposure = SDR_EXPOSURE;
          gl.shadowMap.enabled = true;
          gl.shadowMap.type = PCFSoftShadowMap;
          glRef.current = gl as WebGLRenderer;
          sceneRef.current = scene;
          cameraRef.current = camera as PerspectiveCamera;
        }}
      >
        <Suspense fallback={null}>
          <Scene hdr={false} />
          <SimpleEffects />
          <PhysicsStepper />
        </Suspense>
      </Canvas>
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
        <p>C: Dock (when close to station)</p>
      </div>
    </div>
  );
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
  const CameraController = ({ frameIndex, view, ortho, center, dims }: { frameIndex: number; view: 'iso' | 'front' | 'right' | 'top'; ortho: boolean; center: [number, number, number]; dims: [number, number, number] }) => {
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
    }, [frameIndex, view, ortho, camera, controls, center, dims]);
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
            minDistance={2}
            maxDistance={500}
          />
          <CameraController frameIndex={frameIndex} view={view} ortho={ortho} center={center} dims={dims} />
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
      <Text position={[cx + hx + px + 0.5, cy, cz - hz]} fontSize={0.6} color="#c3e7ff">{dy.toFixed(2)}</Text>
      <Line points={[[cx - hx - px, cy + hy + py, cz - hz], [cx - hx - px, cy + hy + py, cz + hz]]} color="#ff8c3f" lineWidth={2} dashed dashSize={0.3} gapSize={0.2} />
      <Text position={[cx - hx - px - 0.5, cy + hy + py, cz]} fontSize={0.6} color="#c3e7ff">{dz.toFixed(2)}</Text>
    </>
  );
}
function ShipEditorCanvas({ modelPath }: { modelPath?: string }) {
  const key = 'ship:engineMarkers:' + (modelPath || '/models/00000.obj');
  const rawInit = typeof window !== 'undefined' ? window.localStorage.getItem(key) : null;
  let initialMarkers: { x: number; y: number; z: number }[] = [];
  if (rawInit) {
    try {
      const parsed = JSON.parse(rawInit) as { positions?: { x: number; y: number; z: number }[] };
      initialMarkers = parsed.positions || [];
    } catch { initialMarkers = []; }
  }
  const [markers, setMarkers] = useState<{ x: number; y: number; z: number }[]>(initialMarkers);
  const [status, setStatus] = useState<string | null>(initialMarkers.length > 0 ? `Loaded ${initialMarkers.length} markers` : null);
  const sceneRef = useRef<ThreeScene | null>(null);
  const cameraRef = useRef<PerspectiveCamera | null>(null);
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      const s = sceneRef.current;
      const c = cameraRef.current;
      if (!s || !c) return;
      const x = (e.clientX / window.innerWidth) * 2 - 1;
      const y = -(e.clientY / window.innerHeight) * 2 + 1;
      const rc = new Raycaster();
      rc.setFromCamera(new Vector2(x, y), c);
      const target = s.getObjectByName('CockpitEditor');
      if (!target) return;
      const hits = rc.intersectObject(target, true);
      if (hits.length > 0) {
        const p = hits[0].point.clone();
        const parent = target.parent || s;
        parent.worldToLocal(p);
        setMarkers((m) => [...m, { x: p.x, y: p.y, z: p.z }]);
      }
    };
    window.addEventListener('mousedown', onDown);
    return () => window.removeEventListener('mousedown', onDown);
  }, []);
  useEffect(() => {
    if (!status) return;
    const t = setTimeout(() => setStatus(null), 2000);
    return () => clearTimeout(t);
  }, [status]);
  return (
    <>
      <Canvas
        onCreated={({ scene, camera }) => {
          sceneRef.current = scene;
          cameraRef.current = camera as PerspectiveCamera;
        }}
      >
        <Suspense fallback={null}>
          <color attach="background" args={["#0b1016"]} />
          <hemisphereLight args={["#bcdfff", "#223344", 0.6]} />
          <directionalLight position={[10, 12, 10]} intensity={1.4} color="#ffffff" />
          <ambientLight intensity={0.2} />
          <Cockpit enableLights={false} editorMode name="CockpitEditor" modelPath={modelPath} />
          {markers.map((m, i) => (
            <mesh key={i} position={[m.x, m.y, m.z]}>
              <sphereGeometry args={[0.25, 16, 16]} />
              <meshBasicMaterial color="#76baff" />
            </mesh>
          ))}
          <ArcballControls makeDefault enablePan enableZoom dampingFactor={0.08} minDistance={2} maxDistance={500} />
        </Suspense>
      </Canvas>
      <div style={{ position: 'absolute', top: 20, left: 20, display: 'flex', gap: '8px', fontFamily: 'monospace' }}>
        <button onClick={() => { try { window.localStorage.setItem(key, JSON.stringify({ positions: markers })); setStatus(`Saved ${markers.length} markers`); } catch { setStatus('Save failed'); } }} style={{ padding: '6px 10px', border: '1px solid #3fb6ff', background: '#0f2230', color: '#c3e7ff' }}>Save</button>
        <button onClick={() => { setMarkers([]); window.localStorage.removeItem(key); setStatus('Cleared'); }} style={{ padding: '6px 10px', border: '1px solid #3fb6ff', background: '#0f2230', color: '#c3e7ff' }}>Clear</button>
        <button onClick={() => { navigator.clipboard.writeText(JSON.stringify({ positions: markers })); }} style={{ padding: '6px 10px', border: '1px solid #3fb6ff', background: '#0f2230', color: '#c3e7ff' }}>Copy JSON</button>
        {status && <span style={{ marginLeft: 8, color: '#8ab6d6' }}>{status}</span>}
      </div>
    </>
  );
}
function AdminHome() {
  const [tab, setTab] = useState<'root' | 'ships'>('root');
  const [model, setModel] = useState('/models/00000.obj');
  if (tab === 'root') {
    return (
      <div style={{ width: '100vw', height: '100vh', background: '#0b1016', color: '#c3e7ff', fontFamily: 'monospace' }}>
        <div style={{ padding: 20 }}>
          <h2>Admin</h2>
          <div style={{ display: 'flex', gap: 12 }}>
            <button onClick={() => setTab('ships')} style={{ padding: '8px 12px', border: '1px solid #3fb6ff', background: '#0f2230', color: '#c3e7ff' }}>Edit Ships</button>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div style={{ width: '100vw', height: '100vh', background: '#0b1016', color: '#c3e7ff', fontFamily: 'monospace' }}>
      <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 640 }}>
        <h2>Select Ship</h2>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>Model path</span>
          <input value={model} onChange={(e) => setModel(e.target.value)} placeholder="/models/00000.obj" style={{ flex: 1, padding: '6px 10px', background: '#0f2230', border: '1px solid #3fb6ff', color: '#c3e7ff' }} />
        </label>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => { window.location.href = `/admin/ship?model=${encodeURIComponent(model)}`; }} style={{ padding: '8px 12px', border: '1px solid #3fb6ff', background: '#0f2230', color: '#c3e7ff' }}>Open Editor</button>
          <button onClick={() => setTab('root')} style={{ padding: '8px 12px', border: '1px solid #3fb6ff', background: '#0f2230', color: '#c3e7ff' }}>Back</button>
        </div>
        <div style={{ marginTop: 16 }}>
          <div style={{ marginBottom: 8, color: '#8ab6d6' }}>Quick picks</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setModel('/models/00000.obj')} style={{ padding: '6px 10px', border: '1px solid #3fb6ff', background: '#0f2230', color: '#c3e7ff' }}>00000.obj</button>
          </div>
        </div>
      </div>
    </div>
  );
}
