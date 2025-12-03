import { Suspense, useRef, useState, useEffect, useMemo } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { Scene } from './Scene';
import { ArcballControls, Grid, GizmoHelper, GizmoViewport, Text, OrthographicCamera, PerspectiveCamera as DreiPerspectiveCamera, Line, Environment, TransformControls, useProgress } from '@react-three/drei';
import { Perf } from 'r3f-perf';
import type { ArcballControls as ArcballControlsImpl } from 'three-stdlib';
import { HUD } from './components/HUD';
import { TradingInterface } from './components/TradingInterface';
import { SimpleEffects } from './components/SimpleEffects';
import { ShipModel } from './components/ShipModel';
import type { PerspectiveCamera, Scene as ThreeScene, Mesh, MeshStandardMaterial, WebGLRenderer, Object3D } from 'three';
import { Box3, Vector3, Vector2, SRGBColorSpace, ACESFilmicToneMapping, NoToneMapping, PCFSoftShadowMap, Raycaster } from 'three';
import { Station } from './components/Station';
import { PhysicsStepper } from './physics/PhysicsStepper';
import { PlanetEditor } from './admin/PlanetEditor';
import { getPhysicsMetrics } from './physics/RapierWorld';
import { ModelGrid } from './components/ModelGrid';



import { SectorMap2D } from './components/SectorMap2D';
import { OffScreenArrow } from './components/NavigationIndicator';
import { SEIZEWELL_BLUEPRINT } from './config/seizewell';

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

  // Calculate sector map objects (moved from Scene.tsx to be outside Canvas)
  const sectorObjects = useMemo(() => {
      const layout = SEIZEWELL_BLUEPRINT;
      if (!layout) return [];
      const spacing = 30;
      const place = (p: [number, number, number]): [number, number, number] => [p[0] * spacing, p[1] * spacing, p[2] * spacing];
      const objects: { name: string; position: [number, number, number]; type: 'station' | 'gate' | 'ship' }[] = [];
      for (const st of layout.stations) objects.push({ name: st.name, position: place(st.position), type: 'station' });
      for (const g of layout.gates) objects.push({ name: g.name, position: place(g.position), type: 'gate' });
      for (const s of layout.ships) objects.push({ name: s.name, position: place(s.position), type: 'ship' });
      return objects;
  }, []);

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

  if (path.startsWith('/admin/sector')) {
    return (
      <PlanetEditor />
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
        gl={{ logarithmicDepthBuffer: true }}
        camera={{ fov: 75, near: 1, far: 600000000000 }}
        onCreated={({ gl, scene, camera }) => {
          gl.outputColorSpace = SRGBColorSpace;
          gl.toneMapping = NoToneMapping;
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
          <Perf position="top-right" />
        </Suspense>
      </Canvas>
      <SmartLoader />
      <HUD />
      <SectorMap2D objects={sectorObjects} />
      <OffScreenArrow />
      <TradingInterface />
      <PerfOverlay glRef={glRef} sceneRef={sceneRef} />
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
      <SmartLoader />
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
  const arcballRef = useRef<ArcballControlsImpl | null>(null);
  const markerRefs = useRef<Record<number, Object3D | null>>({});
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [selectedObject, setSelectedObject] = useState<Object3D | null>(null);
  const isTransformingRef = useRef(false);
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (e.button !== 2) return; // only right click adds markers
      if (isTransformingRef.current) return;
      const targetEl = e.target as HTMLElement | null;
      if (targetEl && targetEl.closest('.ship-editor-ui')) return;
      const s = sceneRef.current;
      const c = cameraRef.current;
      if (!s || !c) return;
      const x = (e.clientX / window.innerWidth) * 2 - 1;
      const y = -(e.clientY / window.innerHeight) * 2 + 1;
      const rc = new Raycaster();
      rc.setFromCamera(new Vector2(x, y), c);
      const markerObjects = Object.values(markerRefs.current).filter(Boolean) as Object3D[];
      const markerHits = markerObjects.length > 0 ? rc.intersectObjects(markerObjects, true) : [];
      if (markerHits.length > 0) return;
      const target = s.getObjectByName('ShipModelEditor');
      if (!target) return;
      const hits = rc.intersectObject(target, true);
      if (hits.length > 0) {
        const p = hits[0].point.clone();
        const parent = target.parent || s;
        parent.worldToLocal(p);
        setMarkers((m) => {
          const next = [...m, { x: p.x, y: p.y, z: p.z }];
          setSelectedIndex(next.length - 1);
          return next;
        });
      }
    };
    const preventContextMenu = (e: MouseEvent) => {
      const targetEl = e.target as HTMLElement | null;
      if (targetEl && targetEl.closest('.ship-editor-ui')) return;
      e.preventDefault();
    };
    window.addEventListener('mousedown', onDown);
    window.addEventListener('contextmenu', preventContextMenu);
    return () => {
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('contextmenu', preventContextMenu);
    };
  }, []);
  useEffect(() => {
    void selectedIndex;
    void markers.length;
  }, [markers.length, selectedIndex]);
  useEffect(() => {
    if (!status) return;
    const t = setTimeout(() => setStatus(null), 2000);
    return () => clearTimeout(t);
  }, [status]);
  return (
    <>
      <Canvas
        shadows
        gl={{ logarithmicDepthBuffer: true, outputColorSpace: SRGBColorSpace, toneMapping: ACESFilmicToneMapping, toneMappingExposure: 1.15 }}
        onCreated={({ scene, camera }) => {
          sceneRef.current = scene;
          cameraRef.current = camera as PerspectiveCamera;
        }}
      >
        <Suspense fallback={null}>
          <color attach="background" args={["#0b1016"]} />
          <Environment preset="night" />
          <hemisphereLight args={["#bcdfff", "#223344", 0.2]} />
          <directionalLight position={[10, 12, 10]} intensity={1.4} color="#ffffff" castShadow />
          <ambientLight intensity={0.1} />
          <ShipModel enableLights={false} editorMode name="ShipModelEditor" modelPath={modelPath} markerOverrides={markers} />
          {markers.map((m, i) => (
            <group
              key={i}
              ref={(ref) => { markerRefs.current[i] = ref; }}
              position={[m.x, m.y, m.z]}
              onClick={(e) => { e.stopPropagation(); setSelectedIndex(i); setSelectedObject(markerRefs.current[i] || null); }}
            >
              <mesh>
                <sphereGeometry args={[0.25, 16, 16]} />
                <meshBasicMaterial color={selectedIndex === i ? "#9bffb0" : "#76baff"} />
              </mesh>
              <mesh>
                <boxGeometry args={[1, 1, 1]} />
                <meshBasicMaterial color={selectedIndex === i ? "#7bffb0" : "#3fb6ff"} wireframe opacity={0.35} transparent />
              </mesh>
              <mesh onPointerDown={(e) => { e.stopPropagation(); setSelectedIndex(i); }}>
                <boxGeometry args={[1.4, 1.4, 1.4]} />
                <meshBasicMaterial transparent opacity={0.01} />
              </mesh>
            </group>
          ))}
          {selectedObject && (
            <TransformControls
              object={selectedObject || undefined}
              mode="translate"
              size={0.75}
              onMouseDown={() => { isTransformingRef.current = true; if (arcballRef.current) arcballRef.current.enabled = false; }}
              onMouseUp={() => { isTransformingRef.current = false; if (arcballRef.current) arcballRef.current.enabled = true; }}
              onObjectChange={() => {
                const obj = selectedObject;
                if (!obj) return;
                const { x, y, z } = obj.position;
                setMarkers((m) => m.map((mm, idx) => (idx === selectedIndex ? { x, y, z } : mm)));
              }}
            />
          )}
          <ArcballControls ref={arcballRef} makeDefault enablePan enableZoom dampingFactor={0.08} minDistance={2} maxDistance={500} />
        </Suspense>
      </Canvas>
      <div className="ship-editor-ui" style={{ position: 'absolute', top: 20, left: 20, display: 'flex', gap: '8px', fontFamily: 'monospace', alignItems: 'center', background: 'rgba(12,22,32,0.8)', padding: '8px 10px', borderRadius: 6, border: '1px solid #184b6a' }}>
        <button onClick={() => { try { window.localStorage.setItem(key, JSON.stringify({ positions: markers })); setStatus(`Saved ${markers.length} markers`); } catch { setStatus('Save failed'); } }} style={{ padding: '6px 10px', border: '1px solid #3fb6ff', background: '#0f2230', color: '#c3e7ff' }}>Save</button>
        <button onClick={() => { setMarkers([]); setSelectedIndex(null); setSelectedObject(null); window.localStorage.removeItem(key); setStatus('Cleared'); }} style={{ padding: '6px 10px', border: '1px solid #3fb6ff', background: '#0f2230', color: '#c3e7ff' }}>Clear</button>
        <button onClick={() => { navigator.clipboard.writeText(JSON.stringify({ positions: markers })); }} style={{ padding: '6px 10px', border: '1px solid #3fb6ff', background: '#0f2230', color: '#c3e7ff' }}>Copy JSON</button>
        <span style={{ color: '#8ab6d6', fontSize: 13 }}>Right-click the hull to add markers. Left-click a marker to select and drag it.</span>
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
            <button onClick={() => { window.location.assign('/admin/sector'); }} style={{ padding: '8px 12px', border: '1px solid #3fb6ff', background: '#0f2230', color: '#c3e7ff' }}>Edit Sector</button>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div style={{ width: '100vw', height: '100vh', background: '#0b1016', color: '#c3e7ff', fontFamily: 'monospace' }}>
      <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 1400, height: '100%', boxSizing: 'border-box', margin: '0 auto' }}>
        <h2>Select Ingame Object</h2>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>Model path</span>
          <input value={model} onChange={(e) => setModel(e.target.value)} placeholder="/models/00000.obj" style={{ flex: 1, padding: '6px 10px', background: '#0f2230', border: '1px solid #3fb6ff', color: '#c3e7ff' }} />
        </label>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => { window.location.href = `/admin/ship?model=${encodeURIComponent(model)}`; }} style={{ padding: '8px 12px', border: '1px solid #3fb6ff', background: '#0f2230', color: '#c3e7ff' }}>Open Editor</button>
          <button onClick={() => setTab('root')} style={{ padding: '8px 12px', border: '1px solid #3fb6ff', background: '#0f2230', color: '#c3e7ff' }}>Back</button>
        </div>
        <div style={{ marginTop: 16, flex: 1, overflowY: 'auto', minHeight: 0 }}>
          <div style={{ marginBottom: 8, color: '#8ab6d6' }}>Select Model</div>
          <ModelGrid onSelect={(path) => setModel(path)} currentModel={model} />
        </div>
      </div>
    </div>
  );
}

function PerfOverlay({ glRef, sceneRef }: { glRef: React.RefObject<WebGLRenderer | null>; sceneRef: React.RefObject<ThreeScene | null> }) {
  const [fps, setFps] = useState(0);
  const [frameMs, setFrameMs] = useState(0);
  const [calls, setCalls] = useState(0);
  const [tris, setTris] = useState(0);
  const [geoms, setGeoms] = useState(0);
  const [tex, setTex] = useState(0);
  const [progs, setProgs] = useState(0);
  const [physMs, setPhysMs] = useState(0);
  const [bodies, setBodies] = useState(0);
  const [colliders, setColliders] = useState(0);
  const [heap, setHeap] = useState(0);
  const [topMeshes, setTopMeshes] = useState<{ name: string; tris: number }[]>([]);
  useEffect(() => {
    let last = performance.now();
    let rafId = 0 as number;
    const tick = () => {
      const now = performance.now();
      const dt = now - last;
      last = now;
      if (dt > 0) setFps(1000 / dt);
      setFrameMs(dt);
      const gl = glRef.current;
      if (gl) {
        const info = (gl.info as unknown as { render?: { calls?: number; triangles?: number }; memory?: { geometries?: number; textures?: number }; programs?: unknown[] });
        setCalls(info.render?.calls || 0);
        setTris(info.render?.triangles || 0);
        setGeoms(info.memory?.geometries || 0);
        setTex(info.memory?.textures || 0);
        setProgs(Array.isArray(info.programs) ? info.programs.length : 0);
      }
      const scene = sceneRef.current;
      if (scene && now % 1000 < 16) {
        const arr: { name: string; tris: number }[] = [];
        scene.traverse((o) => {
          const m = o as unknown as { geometry?: unknown; name?: string };
          const g = m.geometry as unknown as { getIndex?: () => { count: number } | null; getAttribute?: (k: string) => { count: number } | null };
          if (!g) return;
          const idx = g.getIndex ? g.getIndex() : null;
          const pos = g.getAttribute ? g.getAttribute('position') : null;
          let t = 0;
          if (idx && typeof idx.count === 'number') t = Math.floor(idx.count / 3);
          else if (pos && typeof pos.count === 'number') t = Math.floor(pos.count / 3);
          if (t > 0) arr.push({ name: o.name || (m.name || 'Mesh'), tris: t });
        });
        arr.sort((a, b) => b.tris - a.tris);
        setTopMeshes(arr.slice(0, 5));
      }
      const phys = getPhysicsMetrics();
      setPhysMs(phys.lastStepMs || 0);
      setBodies(phys.bodies || 0);
      setColliders(phys.colliders || 0);
      const mem = (performance as unknown as { memory?: { usedJSHeapSize?: number } }).memory;
      setHeap(mem && mem.usedJSHeapSize ? mem.usedJSHeapSize / (1024 * 1024) : 0);
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(rafId); };
  }, [glRef, sceneRef]);
  return (
    <div style={{ position: 'absolute', bottom: 20, right: 20, color: '#c3e7ff', fontFamily: 'monospace', background: 'rgba(12,22,32,0.8)', padding: 12, border: '1px solid #184b6a', borderRadius: 6 }}>
      <div>FPS {fps.toFixed(0)} | Frame {frameMs.toFixed(1)} ms</div>
      <div>Calls {calls} | Tris {tris}</div>
      <div>Geom {geoms} | Tex {tex} | Prog {progs}</div>
      <div>Physics {physMs.toFixed(2)} ms | Bodies {bodies} | Colliders {colliders}</div>
      {heap > 0 && <div>Heap {heap.toFixed(1)} MB</div>}
      {topMeshes.length > 0 && (
        <div style={{ marginTop: 8 }}>
          {topMeshes.map((m, i) => (
            <div key={i}>{m.name}: {m.tris}</div>
          ))}
        </div>
      )}
    </div>
  );
}

function SmartLoader() {
  const { active, progress } = useProgress();
  if (!active || progress <= 0) return null;
  return (
    <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', color: '#c3e7ff', fontFamily: 'monospace' }}>
      Loading {progress.toFixed(2)}%
    </div>
  );
}
