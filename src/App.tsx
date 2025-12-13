import { Suspense, useRef, useState, useEffect, Fragment } from 'react';
import { persist } from './services/persist';
import { Canvas, useThree } from '@react-three/fiber';
import { Scene } from './Scene';
import { ArcballControls, Grid, GizmoHelper, GizmoViewport, Text, OrthographicCamera, PerspectiveCamera as DreiPerspectiveCamera, Line, Environment, TransformControls, useProgress } from '@react-three/drei';
import type { ArcballControls as ArcballControlsImpl } from 'three-stdlib';
import { HUD } from './components/HUD';
import { TradingInterface } from './components/TradingInterface';
import { SimpleEffects } from './components/SimpleEffects';
import { RealismEffectsLite, RealismEffectsFull } from './components/RealismEffects';
import { ShipModel } from './components/ShipModel';
import type { PerspectiveCamera, Scene as ThreeScene, Mesh, MeshStandardMaterial, WebGLRenderer, Object3D } from 'three';
import { Box3, Vector3, Vector2, SRGBColorSpace, ACESFilmicToneMapping, NoToneMapping, PCFSoftShadowMap, Raycaster } from 'three';
import { Station } from './components/Station';
import { PhysicsStepper } from './physics/PhysicsStepper';
import { PlanetEditor } from './admin/PlanetEditor';
import { PlumeEditor } from './admin/PlumeEditor';
import { getPhysicsMetrics } from './physics/RapierWorld';
import { ModelGrid } from './components/ModelGrid';



import { SectorMap2D } from './components/SectorMap2D';
import { OffScreenArrow } from './components/NavigationIndicator';
import { ShipControlCursor } from './components/ShipControlCursor';
import { getSectorLayoutById } from './config/sector';
import { UNIVERSE_SECTORS_XBTF } from './config/universe_xbtf';
import { useGameStore } from './store/gameStore';
import { EnginePlume } from './components/EnginePlume';
import { UniverseMap } from './components/UniverseMap';
import { EconomyTicker } from './components/EconomyTicker';
import { getAllPresets } from './config/plumes';
import { StationInfo } from './components/StationInfo';
import { FleetSimulator } from './simulation/FleetSimulator';
import { getStationPriceMap } from './services/stationPricing';
import { SimpleLineChart } from './components/SimpleLineChart';
import { CorpAIAgentTab } from './components/CorpAIAgentTab';
import { MultiCorpAIAgentTab } from './components/MultiCorpAIAgentTab';




function OverExposureOverlay() {
  const [alpha, setAlpha] = useState(0)
  const alphaRef = useRef(0)
  const lastIntensityRef = useRef(0)
  useEffect(() => {
    let raf = 0
    let last = performance.now()
    const step = () => {
      const now = performance.now()
      const dt = (now - last) * 0.001
      last = now
      const s = useGameStore.getState()
      const base = Math.max(0, Math.min(1, s.sunIntensity * (1 - s.sunAdapt)))
      const deltaI = s.sunIntensity - lastIntensityRef.current
      lastIntensityRef.current = s.sunIntensity
      const shock = Math.max(0, deltaI) * 0.8
      const target = Math.max(base, Math.min(1, shock))
      const current = alphaRef.current
      const k = target > current ? 12.0 : 3.0
      const t = 1 - Math.exp(-k * dt)
      const next = current + (target - current) * t
      alphaRef.current = next
      setAlpha(next)
      raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [])
  const op = Math.max(0, Math.min(0.85, alpha))
  return (
    <div style={{ position: 'fixed', left: 0, top: 0, width: '100vw', height: '100vh', background: 'white', opacity: op, pointerEvents: 'none', zIndex: 900 }} />
  )
}

function App() {
  const sceneRef = useRef<ThreeScene | null>(null);
  const cameraRef = useRef<PerspectiveCamera | null>(null);
  const glRef = useRef<WebGLRenderer | null>(null);
  const params = new URLSearchParams(window.location.search);
  const isViewer = params.get('viewer') === 'station';
  const modelParam = params.get('model') || null;
  const adminMode = params.get('admin') === 'ship';
  const adminModel = params.get('model') || '/models/00000.obj';
  const effectsMode = params.get('effects') || 'simple'; // 'simple' | 'realism' | 'realism-full'
  const path = window.location.pathname;
  const setNavObjects = useGameStore((s) => s.setNavObjects);
  const currentSectorId = useGameStore((s) => s.currentSectorId);

  useEffect(() => {
    // Debug code removed
  }, []);

  // Initialize Simulation Loop
  useEffect(() => {
    let rafId = 0;
    let lastTime = performance.now();
    const loop = () => {
      const now = performance.now();
      const dt = Math.min((now - lastTime) / 1000, 0.1); // Cap dt at 100ms
      lastTime = now;

      const timeScale = useGameStore.getState().timeScale;
      if (timeScale > 0) {
        FleetSimulator.getInstance().update(dt * timeScale);
      }

      rafId = requestAnimationFrame(loop);
    };
    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, []);

  const economyStations = useGameStore((s) => s.stations);

  useEffect(() => {
    persist.init();
    const layout = getSectorLayoutById(currentSectorId || 'seizewell');
    const spacing = 30;
    const place = (p: [number, number, number]): [number, number, number] => [p[0] * spacing, p[1] * spacing, p[2] * spacing];

    // 1. Static objects from layout
    const sector = UNIVERSE_SECTORS_XBTF.find((s) => s.id === (currentSectorId || 'seizewell')) || UNIVERSE_SECTORS_XBTF[0];
    const nbNames = (sector?.neighbors || []).slice(0, layout.gates.length);
    const nb = nbNames
      .map((nm) => UNIVERSE_SECTORS_XBTF.find((x) => x.name === nm)?.id)
      .filter((x): x is string => !!x);

    const objects: { name: string; position: [number, number, number]; type: 'station' | 'gate' | 'ship'; targetSectorId?: string }[] = [];

    // Add layout stations
    const layoutStationNames = new Set(layout.stations.map(s => s.name));
    for (const st of layout.stations) objects.push({ name: st.name, position: place(st.position), type: 'station' });

    // Add dynamic stations from economy store
    // Only add if they are in this sector, have a position, AND are not already in the layout (to avoid double rendering static ones)
    economyStations.forEach(st => {
      if (st.sectorId === (currentSectorId || 'seizewell') && st.position && !layoutStationNames.has(st.name)) {
        // Dynamic stations store position in raw units, need to ensure scale is correct.
        // Builder uses `randomPos` which returns [-5000..5000]. 
        // `place` function scales by 30. 
        // If `randomPos` was already "world space", we shouldn't scale?
        // randomPos in vite.config.ts: `(Math.random() - 0.5) * 10000`.
        // Layout positions are small integers (e.g. 10, -5). Scaling by 30 makes them 300.
        // 10000 is HUGE compared to 300.
        // It seems dynamic stations use a different scale or the visual scale is much larger.
        // Let's assume dynamic positions are absolute and don't need `place` scaling if they are already large.
        // IF however they are small like layout, they need scaling.
        // `randomPos` seems to return large numbers.
        // Let's pass them raw for now, or check coordinate magnitude.
        objects.push({ name: st.name, position: st.position, type: 'station' });
      }
    });

    layout.gates.forEach((g, i) => { objects.push({ name: g.name, position: place(g.position), type: 'gate', targetSectorId: nb[i] }); });
    for (const s of layout.ships) objects.push({ name: s.name, position: place(s.position), type: 'ship' });
    setNavObjects(objects);
  }, [setNavObjects, currentSectorId, economyStations]);

  if (isViewer) {
    return (
      <div style={{ width: '100vw', height: '100vh', background: '#e9eef5' }}>
        <ViewerCanvas modelPath={modelParam || undefined} />
      </div>
    );
  }

  if (path === '/admin') {
    return (
      <>

        <AdminHome />
      </>
    );
  }

  if (path.startsWith('/admin/sector')) {
    return (
      <>

        <PlanetEditor />
      </>
    );
  }

  if (path.startsWith('/admin/economy')) {
    return (
      <>
        {/* Ensure construction TLs keep simulating even when only the economy admin is open */}
        <EconomyAdmin />
      </>
    );
  }

  if (path.startsWith('/admin/plume')) {
    return (
      <>

        <PlumeEditor />
      </>
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
      {/* Always simulate construction TLs, even in current sector, to keep them moving cross-sector */}
      <Canvas
        shadows
        gl={{ logarithmicDepthBuffer: true, antialias: true }}
        camera={{ fov: 60, near: 1, far: 600000000000 }}
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
          {effectsMode === 'simple' && <SimpleEffects />}
          {effectsMode === 'realism' && <RealismEffectsLite />}
          {effectsMode === 'realism-full' && <RealismEffectsFull />}
          <PhysicsStepper />
          <EconomyTicker />
        </Suspense>
      </Canvas>
      <OverExposureOverlay />
      <ShipControlCursor />
      <SmartLoader />
      <HUD />
      <StationInfo />
      <SectorMap2D />
      <UniverseMap />
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
  const model = modelPath || '/models/00000.obj';
  /* Unused keys removed */
  // const plumeKey = 'ship:engineMarkers:' + model;
  // const cockpitKey = 'ship:cockpit:' + model;
  // const weaponKey = 'ship:weapons:' + model;
  // const loadList = (k: string) => { ... }
  // const loadSingle = (k: string) => { ... }

  /* Initial state load is fine, but we need to update if init() finishes late */
  const [plumes, setPlumes] = useState<{ x: number; y: number; z: number; type?: string }[]>(() => persist.getPlumes(model));
  const [cockpit, setCockpit] = useState<{ x: number; y: number; z: number } | null>(() => persist.getCockpit(model));
  const [weapons, setWeapons] = useState<{ x: number; y: number; z: number }[]>(() => persist.getWeapons(model));

  useEffect(() => {
    const update = () => {
      setPlumes(persist.getPlumes(model));
      setCockpit(persist.getCockpit(model));
      setWeapons(persist.getWeapons(model));
    };
    return persist.subscribe(update);
  }, [model]);

  const [mode, setMode] = useState<'plume' | 'cockpit' | 'weapon'>('plume');
  const [selectedPlumeType, setSelectedPlumeType] = useState('standard');
  const [allPlumePresets, setAllPlumePresets] = useState(() => getAllPresets());
  const [status, setStatus] = useState<string | null>(null);

  const sceneRef = useRef<ThreeScene | null>(null);
  const cameraRef = useRef<PerspectiveCamera | null>(null);
  const arcballRef = useRef<ArcballControlsImpl | null>(null);
  const markerRefs = useRef<Record<string, Object3D | null>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);
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

      // Check if we clicked an existing marker
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
        const pos = { x: p.x, y: p.y, z: p.z };

        if (mode === 'plume') {
          setPlumes(prev => [...prev, { ...pos, type: selectedPlumeType }]);
        } else if (mode === 'cockpit') {
          setCockpit(pos);
          setSelectedId('cockpit');
        } else if (mode === 'weapon') {
          setWeapons(prev => [...prev, pos]);
        }
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
  }, [mode, selectedPlumeType]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Delete' || e.code === 'Backspace') {
        if (selectedId && selectedId.startsWith('plume-')) {
          const idx = parseInt(selectedId.split('-')[1]);
          if (!isNaN(idx)) {
            setPlumes(prev => prev.filter((_, i) => i !== idx));
            setSelectedId(null);
            setSelectedObject(null);
            setStatus('Deleted plume');
          }
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedId]);

  useEffect(() => {
    if (!status) return;
    const t = setTimeout(() => setStatus(null), 2000);
    return () => clearTimeout(t);
  }, [status]);

  const save = async () => {
    try {
      await persist.setPlumes(model, plumes);
      await persist.setCockpit(model, cockpit);
      await persist.setWeapons(model, weapons);
      setStatus('Saved all');
    } catch { setStatus('Save failed'); }
  };

  const clear = () => {
    if (mode === 'plume') setPlumes([]);
    if (mode === 'cockpit') setCockpit(null);
    if (mode === 'weapon') setWeapons([]);
    setSelectedId(null);
    setSelectedObject(null);
    setStatus(`Cleared ${mode}`);
  };

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
          <ShipModel
            enableLights={false}
            editorMode
            name="ShipModelEditor"
            modelPath={modelPath}
            plumePositions={plumes}
            cockpitPosition={cockpit || undefined}
            weaponPositions={weapons}
            throttle={0.75}
          />

          {/* Plume Markers */}
          {plumes.map((m, i) => {
            const id = `plume-${i}`;
            const isSel = selectedId === id;
            return (
              <group
                key={id}
                ref={(ref) => { markerRefs.current[id] = ref; }}
                position={[m.x, m.y, m.z]}
                onClick={(e) => { e.stopPropagation(); setSelectedId(id); setSelectedObject(markerRefs.current[id] || null); }}
              >
                <mesh>
                  <sphereGeometry args={[0.25, 16, 16]} />
                  <meshBasicMaterial color={isSel ? "#9bffb0" : "#76baff"} />
                </mesh>
                {isSel && (
                  <mesh>
                    <boxGeometry args={[1, 1, 1]} />
                    <meshBasicMaterial color="#7bffb0" wireframe opacity={0.35} transparent />
                  </mesh>
                )}
              </group>
            );
          })}

          {/* Cockpit Marker */}
          {cockpit && (
            <group
              key="cockpit"
              ref={(ref) => { markerRefs.current['cockpit'] = ref; }}
              position={[cockpit.x, cockpit.y, cockpit.z]}
              onClick={(e) => { e.stopPropagation(); setSelectedId('cockpit'); setSelectedObject(markerRefs.current['cockpit'] || null); }}
            >
              <mesh>
                <boxGeometry args={[0.4, 0.4, 0.4]} />
                <meshBasicMaterial color={selectedId === 'cockpit' ? "#ffff00" : "#00ff00"} />
              </mesh>
            </group>
          )}

          {/* Weapon Markers */}
          {weapons.map((m, i) => {
            const id = `weapon-${i}`;
            const isSel = selectedId === id;
            return (
              <group
                key={id}
                ref={(ref) => { markerRefs.current[id] = ref; }}
                position={[m.x, m.y, m.z]}
                onClick={(e) => { e.stopPropagation(); setSelectedId(id); setSelectedObject(markerRefs.current[id] || null); }}
              >
                <mesh>
                  <sphereGeometry args={[0.15, 16, 16]} />
                  <meshBasicMaterial color={isSel ? "#ff9b9b" : "#ff0000"} />
                </mesh>
              </group>
            );
          })}

          {selectedObject && (
            <TransformControls
              object={selectedObject || undefined}
              mode="translate"
              size={0.75}
              onMouseDown={() => { isTransformingRef.current = true; if (arcballRef.current) arcballRef.current.enabled = false; }}
              onMouseUp={() => { isTransformingRef.current = false; if (arcballRef.current) arcballRef.current.enabled = true; }}
              onObjectChange={() => {
                const obj = selectedObject;
                if (!obj || !selectedId) return;
                const { x, y, z } = obj.position;

                if (selectedId.startsWith('plume-')) {
                  const idx = parseInt(selectedId.split('-')[1]);
                  setPlumes(prev => prev.map((p, i) => i === idx ? { ...p, x, y, z } : p));
                } else if (selectedId === 'cockpit') {
                  setCockpit({ x, y, z });
                } else if (selectedId.startsWith('weapon-')) {
                  const idx = parseInt(selectedId.split('-')[1]);
                  setWeapons(prev => prev.map((p, i) => i === idx ? { x, y, z } : p));
                }
              }}
            />
          )}
          <ArcballControls ref={arcballRef} makeDefault enablePan enableZoom dampingFactor={0.08} minDistance={2} maxDistance={500} />
        </Suspense>
      </Canvas>
      <div className="ship-editor-ui" style={{ position: 'absolute', top: 20, left: 20, display: 'flex', flexDirection: 'column', gap: 8, fontFamily: 'monospace', background: 'rgba(12,22,32,0.9)', padding: 12, borderRadius: 6, border: '1px solid #184b6a' }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setMode('plume')} style={{ padding: '6px 10px', border: '1px solid #3fb6ff', background: mode === 'plume' ? '#3fb6ff' : '#0f2230', color: mode === 'plume' ? '#001216' : '#c3e7ff' }}>Plumes</button>
          <button onClick={() => setMode('cockpit')} style={{ padding: '6px 10px', border: '1px solid #3fb6ff', background: mode === 'cockpit' ? '#3fb6ff' : '#0f2230', color: mode === 'cockpit' ? '#001216' : '#c3e7ff' }}>Cockpit</button>
          <button onClick={() => setMode('weapon')} style={{ padding: '6px 10px', border: '1px solid #3fb6ff', background: mode === 'weapon' ? '#3fb6ff' : '#0f2230', color: mode === 'weapon' ? '#001216' : '#c3e7ff' }}>Weapons</button>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={save} style={{ padding: '6px 10px', border: '1px solid #3fb6ff', background: '#0f2230', color: '#c3e7ff' }}>Save All</button>
          <button onClick={clear} style={{ padding: '6px 10px', border: '1px solid #3fb6ff', background: '#0f2230', color: '#c3e7ff' }}>Clear {mode}</button>
          <button onClick={() => { navigator.clipboard.writeText(JSON.stringify({ plumes, cockpit, weapons }, null, 2)); }} style={{ padding: '6px 10px', border: '1px solid #3fb6ff', background: '#0f2230', color: '#c3e7ff' }}>Copy JSON</button>
          <button onClick={() => {
            const p = new URLSearchParams(window.location.search);
            const page = p.get('page') || '0';
            window.location.href = `/admin?tab=ships&page=${page}`;
          }} style={{ padding: '6px 10px', border: '1px solid #3fb6ff', background: '#0f2230', color: '#c3e7ff' }}>Back</button>
        </div>
        <span style={{ color: '#8ab6d6', fontSize: 13 }}>Right-click hull to add {mode}. Click marker to edit.</span>
        {status && <span style={{ color: '#8ab6d6' }}>{status}</span>}
      </div>
      {mode === 'plume' && (
        <div style={{ position: 'absolute', top: 20, right: 20, width: 220, background: 'rgba(12,22,32,0.9)', padding: 12, borderRadius: 6, border: '1px solid #184b6a', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ color: '#c3e7ff', fontFamily: 'monospace', marginBottom: 4 }}>Plume Type</div>
          <div style={{ maxHeight: 400, overflowY: 'auto' }}>
            {Object.keys(allPlumePresets).map((type) => (
              <div
                key={type}
                onClick={() => setSelectedPlumeType(type)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: 4,
                  cursor: 'pointer',
                  background: selectedPlumeType === type ? '#1a3b50' : 'transparent',
                  border: selectedPlumeType === type ? '1px solid #3fb6ff' : '1px solid transparent',
                  borderRadius: 4
                }}
              >
                <div style={{ width: 40, height: 40, background: '#000', position: 'relative', overflow: 'hidden', borderRadius: 4 }}>
                  <Canvas camera={{ position: [0, 0, 5], fov: 45 }}>
                    <ambientLight intensity={0.5} />
                    <EnginePlume position={[0, -1, 0]} {...allPlumePresets[type]} />
                  </Canvas>
                </div>
                <span style={{ color: '#c3e7ff', fontFamily: 'monospace', fontSize: 12 }}>{type}</span>
              </div>
            ))}
          </div>
          <button
            onClick={() => setAllPlumePresets(getAllPresets())}
            style={{ marginTop: 8, padding: '4px 8px', border: '1px solid #3fb6ff', background: '#0f2230', color: '#c3e7ff', fontSize: 11, cursor: 'pointer' }}
          >
            Refresh Presets
          </button>
        </div>
      )}
    </>
  );
}
function AdminHome() {
  const [tab, setTab] = useState<'root' | 'ships'>(() => {
    const p = new URLSearchParams(window.location.search);
    return (p.get('tab') as 'root' | 'ships') || 'root';
  });
  const [page, setPage] = useState(() => {
    const p = new URLSearchParams(window.location.search);
    return parseInt(p.get('page') || '0', 10);
  });
  const [model, setModel] = useState('/models/00000.obj');
  if (tab === 'root') {
    return (
      <div style={{ width: '100vw', height: '100vh', background: '#0b1016', color: '#c3e7ff', fontFamily: 'monospace' }}>
        <div style={{ padding: 20 }}>
          <h2>Admin</h2>
          <div style={{ display: 'flex', gap: 12 }}>
            <button onClick={() => setTab('ships')} style={{ padding: '8px 12px', border: '1px solid #3fb6ff', background: '#0f2230', color: '#c3e7ff' }}>Edit Ships</button>
            <button onClick={() => { window.location.assign('/admin/sector'); }} style={{ padding: '8px 12px', border: '1px solid #3fb6ff', background: '#0f2230', color: '#c3e7ff' }}>Edit Sector</button>
            <button onClick={() => { window.location.assign('/admin/plume'); }} style={{ padding: '8px 12px', border: '1px solid #3fb6ff', background: '#0f2230', color: '#c3e7ff' }}>Edit Plumes</button>
            <button onClick={() => { window.location.assign('/admin/economy'); }} style={{ padding: '8px 12px', border: '1px solid #3fb6ff', background: '#0f2230', color: '#c3e7ff' }}>View Economy</button>
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
          <button onClick={() => { window.location.href = `/admin/ship?model=${encodeURIComponent(model)}&page=${page}`; }} style={{ padding: '8px 12px', border: '1px solid #3fb6ff', background: '#0f2230', color: '#c3e7ff' }}>Open Editor</button>
          <button onClick={() => setTab('root')} style={{ padding: '8px 12px', border: '1px solid #3fb6ff', background: '#0f2230', color: '#c3e7ff' }}>Back</button>
        </div>
        <div style={{ marginTop: 16, flex: 1, overflowY: 'auto', minHeight: 0 }}>
          <div style={{ marginBottom: 8, color: '#8ab6d6' }}>Select Model</div>
          <ModelGrid
            onSelect={(path) => {
              setModel(path);
              window.location.assign(`/admin/ship?model=${encodeURIComponent(path)}&page=${page}`);
            }}
            currentModel={model}
            page={page}
            onPageChange={setPage}
          />
        </div>
      </div>
    </div>
  );
}
function EconomyAdmin() {
  const wares = useGameStore((s) => s.wares)
  const recipes = useGameStore((s) => s.recipes)
  const stations = useGameStore((s) => s.stations)
  const sectorPrices = useGameStore((s) => s.sectorPrices)
  const fleets = useGameStore((s) => s.fleets)
  const corporations = useGameStore((s) => s.corporations)
  const tradeLog = useGameStore((s) => s.tradeLog)
  const initEconomy = useGameStore((s) => s.initEconomy)
  const tickEconomy = useGameStore((s) => s.tickEconomy)
  const timeScale = useGameStore((s) => s.timeScale)
  const setTimeScale = useGameStore((s) => s.setTimeScale)
  const elapsedTimeSec = useGameStore((s) => s.elapsedTimeSec)
  const syncEconomy = useGameStore((s) => s.syncEconomy)
  const syncEconomyHistory = useGameStore((s) => s.syncEconomyHistory)
  const [sectorFilter, setSectorFilter] = useState('all')
  const [activeTab, setActiveTab] = useState<'economy' | 'fleets' | 'corporations' | 'teladi_ai' | 'corp_ai_2' | 'characters' | 'graphs'>('economy')
  const [graphWareId, setGraphWareId] = useState<string>('all')
  const [selectedCorpId, setSelectedCorpId] = useState<string | null>(null)
  const [selectedStationId, setSelectedStationId] = useState<string | null>(null)
  const [selectedFleetId, setSelectedFleetId] = useState<string | null>(null)
  const economyHistory = useGameStore((s) => s.economyHistory)
  const sectorList = Array.from(new Set<string>([...stations.map((st) => st.sectorId), ...Object.keys(sectorPrices)])).sort()
  const wareMap = new Map<string, string>(wares.map((w) => [w.id, w.name]))
  const warePriceMap = new Map<string, number>(wares.map((w) => [w.id, w.basePrice]))
  const recipeMap = new Map<string, { id: string; productId: string; inputs: { wareId: string; amount: number }[]; cycleTimeSec: number; batchSize: number }>(recipes.map((r) => [r.id, r]))
  const visibleStations = stations.filter((st) => sectorFilter === 'all' || st.sectorId === sectorFilter)
  const visibleFleets = fleets.filter((f) => sectorFilter === 'all' || f.currentSectorId === sectorFilter || f.destinationSectorId === sectorFilter)
  const selectedCorp = selectedCorpId ? corporations.find((c) => c.id === selectedCorpId) : null
  const selectedStation = selectedStationId ? stations.find((s) => s.id === selectedStationId) : null
  const selectedFleet = selectedFleetId ? fleets.find((f) => f.id === selectedFleetId) : null

  // Calculate Total Economy Value
  const totalStationValue = stations.reduce((sum, st) => {
    return sum + Object.entries(st.inventory).reduce((s, [wid, qty]) => s + qty * (warePriceMap.get(wid) || 0), 0)
  }, 0)
  const totalFleetValue = fleets.reduce((sum, f) => {
    const cargoVal = Object.entries(f.cargo).reduce((s, [wid, qty]) => s + qty * (warePriceMap.get(wid) || 0), 0)
    return sum + f.credits + cargoVal
  }, 0)
  const totalCorpValue = corporations.reduce((sum, c) => sum + c.credits, 0)
  const totalEconomyValue = totalStationValue + totalFleetValue + totalCorpValue

  useEffect(() => { syncEconomy() }, [syncEconomy])
  useEffect(() => { const id = setInterval(() => syncEconomy(), 1000); return () => clearInterval(id) }, [syncEconomy])
  useEffect(() => {
    if (activeTab !== 'graphs') return
    syncEconomyHistory()
    const id = setInterval(() => syncEconomyHistory(), 2000)
    return () => clearInterval(id)
  }, [activeTab, syncEconomyHistory])
  useEffect(() => {
    if (!selectedCorpId) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (selectedStationId) { setSelectedStationId(null); return }
      if (selectedFleetId) { setSelectedFleetId(null); return }
      setSelectedCorpId(null)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [selectedCorpId, selectedStationId, selectedFleetId])

  const getStateColor = (state: string) => {
    switch (state) {
      case 'idle': return '#6090a0'
      case 'loading': return '#44aaff'
      case 'unloading': return '#ff9944'
      case 'in-transit': return '#88cc44'
      case 'docking': return '#aa88ff'
      case 'undocking': return '#ff88aa'
      default: return '#888888'
    }
  }

  const isInternalTransfer = (t: { buyStationName: string; sellStationName: string }) => {
    const buyStation = stations.find((s) => s.name === t.buyStationName)
    const sellStation = stations.find((s) => s.name === t.sellStationName)
    return !!buyStation?.ownerId && buyStation.ownerId === sellStation?.ownerId
  }

  const getStationOwnerIdByName = (stationName: string) => {
    return stations.find((s) => s.name === stationName)?.ownerId ?? null
  }
  const getOwnerLabelById = (ownerId: string | null) => {
    if (!ownerId) return 'unowned'
    if (ownerId === 'player') return 'Player'
    const corp = corporations.find((c) => c.id === ownerId)
    return corp?.name ?? ownerId
  }
  const touchesTraderOwner = (t: { fleetId: string; buyStationName: string; sellStationName: string }) => {
    const traderOwnerId = fleets.find((f) => f.id === t.fleetId)?.ownerId ?? null
    if (!traderOwnerId) return false
    const buyOwnerId = getStationOwnerIdByName(t.buyStationName)
    const sellOwnerId = getStationOwnerIdByName(t.sellStationName)
    return buyOwnerId === traderOwnerId || sellOwnerId === traderOwnerId
  }

  const getOwnerColor = (owner: string) => {
    switch (owner) {
      case 'argon': return '#6ad0ff'
      case 'boron': return '#66ffa6'
      case 'paranid': return '#ffcc66'
      case 'split': return '#ff8888'
      case 'teladi': return '#a6ff66'
      case 'pirate': return '#ffaa66'
      case 'xenon': return '#cccccc'
      default: return '#888888'
    }
  }


  const formatDuration = (seconds: number) => {
    const totalSeconds = Math.max(0, Math.floor(seconds))
    const hrs = Math.floor(totalSeconds / 3600)
    const mins = Math.floor((totalSeconds % 3600) / 60)
    const secs = totalSeconds % 60
    if (hrs > 0) return `${hrs}h ${String(mins).padStart(2, '0')}m ${String(secs).padStart(2, '0')}s`
    if (mins > 0) return `${mins}m ${String(secs).padStart(2, '0')}s`
    return `${secs}s`
  }
  return (
    <div style={{ width: '100vw', height: '100vh', background: '#0b1016', color: '#c3e7ff', fontFamily: 'monospace', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ padding: '12px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #184b6a', background: '#0a1520' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ fontSize: 18, fontWeight: 'bold' }}>Economy Admin</span>
          <span style={{ color: '#8ab6d6' }}>{wares.length} wares • {recipes.length} recipes • {stations.length} stations • {fleets.length} fleets</span>
          <span style={{ padding: '4px 10px', border: '1px solid #184b6a', borderRadius: 6, background: '#0f2230', color: '#c3e7ff' }}>Ingame time: {formatDuration(elapsedTimeSec)}</span>
          <span style={{ padding: '4px 10px', border: '1px solid #88cc44', borderRadius: 6, background: '#0f2230', color: '#88cc44', fontWeight: 'bold' }}>
            Total Value: {Math.floor(totalEconomyValue).toLocaleString()} Cr
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={() => {
            if (confirm('Are you sure you want to start a NEW GAME? This will archive your current save and restart the universe.')) {
              useGameStore.getState().resetEconomy()
            }
          }} style={{ padding: '6px 10px', border: '1px solid #ff4444', background: '#0f2230', color: '#ff4444', cursor: 'pointer', fontWeight: 'bold' }}>New Game</button>
          <button onClick={() => initEconomy()} style={{ padding: '6px 10px', border: '1px solid #3fb6ff', background: '#0f2230', color: '#c3e7ff', cursor: 'pointer' }}>Init</button>
          <button onClick={() => tickEconomy(10)} style={{ padding: '6px 10px', border: '1px solid #3fb6ff', background: '#0f2230', color: '#c3e7ff', cursor: 'pointer' }}>Tick +10s</button>
          <button onClick={() => setTimeScale(timeScale === 1 ? 30 : 1, { bypassSafety: true })} style={{ padding: '6px 10px', border: '1px solid #3fb6ff', background: '#0f2230', color: '#c3e7ff', cursor: 'pointer' }}>Time {timeScale.toFixed(1)}x</button>
          <button onClick={() => { window.location.assign('/admin'); }} style={{ padding: '6px 10px', border: '1px solid #3fb6ff', background: '#0f2230', color: '#c3e7ff', cursor: 'pointer' }}>Back</button>
        </div>
      </div>

      {/* Tabs and Filter */}
      <div style={{ padding: '8px 20px', display: 'flex', alignItems: 'center', gap: 16, borderBottom: '1px solid #184b6a', background: '#0c1820' }}>
        <div style={{ display: 'flex', gap: 4 }}>
          <button
            onClick={() => setActiveTab('economy')}
            style={{
              padding: '6px 16px',
              border: activeTab === 'economy' ? '1px solid #3fb6ff' : '1px solid #184b6a',
              background: activeTab === 'economy' ? '#1a3a50' : '#0f2230',
              color: activeTab === 'economy' ? '#fff' : '#8ab6d6',
              cursor: 'pointer',
              borderRadius: '4px 4px 0 0'
            }}
          >Economy</button>
          <button
            onClick={() => setActiveTab('fleets')}
            style={{
              padding: '6px 16px',
              border: activeTab === 'fleets' ? '1px solid #3fb6ff' : '1px solid #184b6a',
              background: activeTab === 'fleets' ? '#1a3a50' : '#0f2230',
              color: activeTab === 'fleets' ? '#fff' : '#8ab6d6',
              cursor: 'pointer',
              borderRadius: '4px 4px 0 0'
            }}
          >Fleets ({fleets.length})</button>
          <button
            onClick={() => setActiveTab('corporations')}
            style={{
              padding: '6px 16px',
              border: activeTab === 'corporations' ? '1px solid #3fb6ff' : '1px solid #184b6a',
              background: activeTab === 'corporations' ? '#1a3a50' : '#0f2230',
              color: activeTab === 'corporations' ? '#fff' : '#8ab6d6',
              cursor: 'pointer',
              borderRadius: '4px 4px 0 0'
            }}
          >Corporations ({corporations.length})</button>
          <button
            onClick={() => setActiveTab('teladi_ai')}
            style={{
              padding: '6px 16px',
              border: activeTab === 'teladi_ai' ? '1px solid #88cc44' : '1px solid #184b6a',
              background: activeTab === 'teladi_ai' ? '#203a2a' : '#0f2230',
              color: activeTab === 'teladi_ai' ? '#88cc44' : '#8ab6d6',
              cursor: 'pointer',
              borderRadius: '4px 4px 0 0'
            }}
          >Teladi AI</button>
          <button
            onClick={() => setActiveTab('corp_ai_2')}
            style={{
              padding: '6px 16px',
              border: activeTab === 'corp_ai_2' ? '1px solid #3fb6ff' : '1px solid #184b6a',
              background: activeTab === 'corp_ai_2' ? '#1a3a50' : '#0f2230',
              color: activeTab === 'corp_ai_2' ? '#fff' : '#8ab6d6',
              cursor: 'pointer',
              borderRadius: '4px 4px 0 0'
            }}
          >Corp AI 2</button>
          <button
            onClick={() => setActiveTab('characters')}
            style={{
              padding: '6px 16px',
              border: activeTab === 'characters' ? '1px solid #ffcc44' : '1px solid #184b6a',
              background: activeTab === 'characters' ? '#2a3a20' : '#0f2230',
              color: activeTab === 'characters' ? '#ffcc44' : '#8ab6d6',
              cursor: 'pointer',
              borderRadius: '4px 4px 0 0'
            }}
          >Characters</button>
          <button
            onClick={() => setActiveTab('graphs')}
            style={{
              padding: '6px 16px',
              border: activeTab === 'graphs' ? '1px solid #aa88ff' : '1px solid #184b6a',
              background: activeTab === 'graphs' ? '#2a203a' : '#0f2230',
              color: activeTab === 'graphs' ? '#aa88ff' : '#8ab6d6',
              cursor: 'pointer',
              borderRadius: '4px 4px 0 0'
            }}
          >Graphs</button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span>Sector</span>
          <select value={sectorFilter} onChange={(e) => setSectorFilter(e.target.value)} style={{ padding: '6px 10px', background: '#0f2230', border: '1px solid #3fb6ff', color: '#c3e7ff' }}>
            <option value="all">all</option>
            {sectorList.map((sid) => (<option key={sid} value={sid}>{sid}</option>))}
          </select>
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, padding: 20, overflow: 'auto' }}>
        {activeTab === 'economy' ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, height: '100%' }}>
            <div style={{ background: '#0f2230', border: '1px solid #184b6a', borderRadius: 6, padding: 12, overflow: 'auto' }}>
              <div style={{ marginBottom: 8, color: '#8ab6d6' }}>Sector Prices</div>
              {sectorFilter === 'all' ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {Object.keys(sectorPrices).map((sid) => {
                    const sp = sectorPrices[sid] || {}
                    const items = Object.entries(sp)
                    return (
                      <div key={sid} style={{ border: '1px solid #184b6a', borderRadius: 6, padding: 8 }}>
                        <div style={{ color: '#c3e7ff', marginBottom: 6 }}>{sid}</div>
                        {items.length === 0 ? (
                          <div style={{ color: '#6090a0' }}>no prices</div>
                        ) : (
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 4 }}>
                            {items.map(([wid, price]) => (
                              <Fragment key={wid}>
                                <div style={{ color: '#c3e7ff' }}>{wareMap.get(wid) || wid}</div>
                                <div style={{ color: '#88cc44', textAlign: 'right' }}>{Math.round(price)}</div>
                              </Fragment>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              ) : (
                (() => {
                  const sp = sectorPrices[sectorFilter] || {}
                  const items = Object.entries(sp)
                  return items.length === 0 ? (
                    <div style={{ color: '#6090a0' }}>no prices</div>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 4 }}>
                      {items.map(([wid, price]) => (
                        <Fragment key={wid}>
                          <div style={{ color: '#c3e7ff' }}>{wareMap.get(wid) || wid}</div>
                          <div style={{ color: '#88cc44', textAlign: 'right' }}>{Math.round(price)}</div>
                        </Fragment>
                      ))}
                    </div>
                  )
                })()
              )}
            </div>
            <div style={{ background: '#0f2230', border: '1px solid #184b6a', borderRadius: 6, padding: 12, overflow: 'auto' }}>
              <div style={{ marginBottom: 8, color: '#8ab6d6' }}>Stations</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 8 }}>
                {visibleStations.length === 0 ? (
                  <div style={{ color: '#6090a0' }}>no stations</div>
                ) : (
                  visibleStations.map((st) => {
                    const r = recipeMap.get(st.recipeId)
                    const prodName = r ? (wareMap.get(r.productId) || r.productId) : st.recipeId
                    const stationPrices = getStationPriceMap(st, r, wares)
                    const combinedWares = r
                      ? Array.from(new Set<string>([
                        ...Object.keys(st.inventory),
                        ...r.inputs.map((i) => i.wareId),
                        r.productId,
                      ]))
                      : Object.keys(st.inventory)
                    const inv = combinedWares.map((wid) => {
                      const qty = st.inventory[wid] || 0
                      const price =
                        stationPrices[wid] ??
                        (sectorPrices[st.sectorId]?.[wid] !== undefined
                          ? Math.round(sectorPrices[st.sectorId]?.[wid] || 0)
                          : warePriceMap.get(wid))
                      const mode = r
                        ? (r.productId === wid ? 'sell' : r.inputs.some((i) => i.wareId === wid) ? 'buy' : 'store')
                        : 'store'
                      return { wid, qty, price, mode }
                    })
                    return (
                      <div key={st.id} style={{ border: '1px solid #184b6a', borderRadius: 6, padding: 8 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                          <div style={{ color: '#c3e7ff' }}>{st.name}</div>
                          <div style={{ color: '#88cc44' }}>{st.sectorId}</div>
                        </div>
                        <div style={{ color: '#8ab6d6', marginBottom: 6 }}>{prodName}</div>
                        {inv.length === 0 ? (
                          <div style={{ color: '#6090a0' }}>empty</div>
                        ) : (
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 4 }}>
                            {inv.map((row) => (
                              <Fragment key={row.wid}>
                                <div style={{ color: '#c3e7ff' }}>{wareMap.get(row.wid) || row.wid}</div>
                                <div style={{ color: row.mode === 'sell' ? '#88cc44' : '#ffaa44', textAlign: 'right' }}>
                                  {Math.round(row.qty)}
                                </div>
                                <div style={{ color: row.mode === 'buy' ? '#66ffcc' : '#c3e7ff', textAlign: 'right' }}>
                                  {row.price ? (
                                    <>
                                      {row.mode === 'buy' ? 'Bid ' : 'Ask '}
                                      {Math.round(row.price)}
                                    </>
                                  ) : (
                                    <span style={{ color: '#3a4b5c' }}>n/a</span>
                                  )}
                                </div>
                              </Fragment>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })
                )}
              </div>
            </div>
            <div style={{ background: '#0f2230', border: '1px solid #184b6a', borderRadius: 6, padding: 12, overflow: 'auto' }}>
              <div style={{ marginBottom: 8, color: '#8ab6d6' }}>Wares</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 4 }}>
                {wares.map((w) => (
                  <Fragment key={w.id}>
                    <div style={{ color: '#c3e7ff' }}>{w.name}</div>
                    <div style={{ color: '#6090a0', textAlign: 'right' }}>{w.category}</div>
                    <div style={{ color: '#88cc44', textAlign: 'right' }}>{w.basePrice}</div>
                  </Fragment>
                ))}
              </div>
            </div>
            <div style={{ background: '#0f2230', border: '1px solid #184b6a', borderRadius: 6, padding: 12, overflow: 'auto' }}>
              <div style={{ marginBottom: 8, color: '#8ab6d6' }}>Recipes</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 4 }}>
                {recipes.map((r) => (
                  <Fragment key={r.id}>
                    <div style={{ color: '#c3e7ff' }}>{wareMap.get(r.productId) || r.productId}</div>
                    <div style={{ color: '#6090a0', textAlign: 'right' }}>{r.batchSize}</div>
                    <div style={{ color: '#6090a0', textAlign: 'right' }}>{r.cycleTimeSec}s</div>
                  </Fragment>
                ))}
              </div>
            </div>
          </div>
        ) : activeTab === 'fleets' ? (
          /* Fleets Tab */
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16, height: '100%' }}>
            {/* Active Fleets */}
            <div style={{ background: '#0f2230', border: '1px solid #184b6a', borderRadius: 6, padding: 12, overflow: 'auto' }}>
              <div style={{ marginBottom: 12, color: '#8ab6d6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Active Fleets ({visibleFleets.length})</span>
                <div style={{ display: 'flex', gap: 8, fontSize: 11 }}>
                  <span style={{ color: getStateColor('idle') }}>● idle</span>
                  <span style={{ color: getStateColor('loading') }}>● loading</span>
                  <span style={{ color: getStateColor('in-transit') }}>● transit</span>
                  <span style={{ color: getStateColor('unloading') }}>● unloading</span>
                </div>
              </div>
              {visibleFleets.length === 0 ? (
                <div style={{ color: '#6090a0', padding: 20, textAlign: 'center' }}>
                  No fleets active. Fleet simulation not yet initialized.
                  <br /><br />
                  <span style={{ fontSize: 11 }}>Fleets will appear here once the background simulation is running.</span>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {visibleFleets.map((f) => {
                    const cargoEntries = Object.entries(f.cargo)
                    const cargoTotal = cargoEntries.reduce((sum, [, qty]) => sum + qty, 0)
                    const now = Date.now()
                    const timeInState = f.stateStartTime ? (now - f.stateStartTime) / 1000 : 0

                    return (
                      <div key={f.id} style={{ border: '1px solid #184b6a', borderRadius: 6, padding: 10, background: '#0a1520', height: '220px', display: 'flex', flexDirection: 'column' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, flexShrink: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ color: getOwnerColor(f.ownerType), fontWeight: 'bold' }}>{f.name}</span>
                            <span style={{ color: '#6090a0', fontSize: 11 }}>{f.shipType}</span>
                          </div>
                          <span style={{ color: getStateColor(f.state), fontSize: 12, textTransform: 'uppercase' }}>{f.state}</span>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 12, marginBottom: 8, flexShrink: 0 }}>
                          <div>
                            <span style={{ color: '#6090a0' }}>Location: </span>
                            <span style={{ color: '#c3e7ff' }}>{f.currentSectorId}</span>
                          </div>
                          <div style={{ height: 18 }}>
                            {f.destinationSectorId && f.state === 'in-transit' && (
                              <>
                                <span style={{ color: '#6090a0' }}>→ </span>
                                <span style={{ color: '#88cc44' }}>{f.destinationSectorId}</span>
                              </>
                            )}
                          </div>
                          <div style={{ height: 18 }}>
                            {f.targetStationId && (
                              <>
                                <span style={{ color: '#6090a0' }}>Target: </span>
                                <span style={{ color: '#44aaff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block', maxWidth: '120px' }}>{f.targetStationId}</span>
                              </>
                            )}
                          </div>
                          <div>
                            <span style={{ color: '#6090a0' }}>Cargo: </span>
                            <span style={{ color: cargoTotal > 0 ? '#ffaa44' : '#6090a0' }}>
                              {cargoTotal > 0 ? `${cargoTotal} units` : 'empty'}
                            </span>
                          </div>
                        </div>

                        {/* Transit progress bar - Fixed height container */}
                        <div style={{ height: 24, marginBottom: 4, flexShrink: 0 }}>
                          {f.state === 'in-transit' && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, marginBottom: 2 }}>
                              <span style={{ color: '#6090a0' }}>In Transit</span>
                              <span style={{ color: '#88cc44' }}>{timeInState.toFixed(0)}s</span>
                            </div>
                          )}
                        </div>

                        {/* Cargo details - Fixed height container (scrollable if needed) */}
                        <div style={{ height: 20, marginBottom: 4, overflow: 'hidden', flexShrink: 0 }}>
                          {cargoEntries.length > 0 && (
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 2, fontSize: 11 }}>
                              {cargoEntries.map(([wareId, qty]) => (
                                <Fragment key={wareId}>
                                  <span style={{ color: '#8ab6d6' }}>{wareMap.get(wareId) || wareId}</span>
                                  <span style={{ color: '#ffaa44', textAlign: 'right' }}>{qty}</span>
                                </Fragment>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Current order info - Fills remaining space */}
                        <div style={{ flexGrow: 1, background: '#0f1a25', borderRadius: 4, padding: 6, fontSize: 11, overflow: 'hidden' }}>
                          {f.currentOrder ? (
                            <>
                              <div style={{ color: '#6090a0', marginBottom: 4 }}>Current Order:</div>
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 2 }}>
                                <span>Buy {f.currentOrder.buyWareName}</span>
                                <span style={{ color: '#ff6666' }}>-{f.currentOrder.buyPrice * f.currentOrder.buyQty}</span>
                                <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Sell @ {f.currentOrder.sellStationName}</span>
                                <span style={{ color: '#66ff66' }}>+{f.currentOrder.sellPrice * f.currentOrder.sellQty}</span>
                                <span style={{ color: '#8ab6d6' }}>Expected Profit</span>
                                <span style={{ color: '#88cc44', fontWeight: 'bold' }}>{f.currentOrder.expectedProfit}</span>
                              </div>
                            </>
                          ) : (
                            <div style={{ color: '#3a4b5c', fontStyle: 'italic', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              No active orders
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Fleet Summary & Trade Log */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Fleet Summary */}
              <div style={{ background: '#0f2230', border: '1px solid #184b6a', borderRadius: 6, padding: 12 }}>
                <div style={{ marginBottom: 8, color: '#8ab6d6' }}>Fleet Summary</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 6, fontSize: 12 }}>
                  <span style={{ color: getStateColor('idle') }}>●</span>
                  <span>Idle</span>
                  <span style={{ color: '#c3e7ff' }}>{fleets.filter(f => f.state === 'idle').length}</span>

                  <span style={{ color: getStateColor('loading') }}>●</span>
                  <span>Loading</span>
                  <span style={{ color: '#c3e7ff' }}>{fleets.filter(f => f.state === 'loading').length}</span>

                  <span style={{ color: getStateColor('in-transit') }}>●</span>
                  <span>In Transit</span>
                  <span style={{ color: '#c3e7ff' }}>{fleets.filter(f => f.state === 'in-transit').length}</span>

                  <span style={{ color: getStateColor('unloading') }}>●</span>
                  <span>Unloading</span>
                  <span style={{ color: '#c3e7ff' }}>{fleets.filter(f => f.state === 'unloading').length}</span>
                </div>
                <div style={{ borderTop: '1px solid #184b6a', marginTop: 12, paddingTop: 8 }}>
                  <div style={{ marginBottom: 6, color: '#6090a0', fontSize: 11 }}>By Owner</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 4, fontSize: 11 }}>
                    {Array.from(new Set(fleets.map(f => f.ownerType))).map(ownerType => (
                      <Fragment key={ownerType}>
                        <span style={{ color: getOwnerColor(ownerType) }}>●</span>
                        <span style={{ textTransform: 'capitalize' }}>{ownerType}</span>
                        <span style={{ color: '#c3e7ff' }}>{fleets.filter(f => f.ownerType === ownerType).length}</span>
                      </Fragment>
                    ))}
                  </div>
                </div>
              </div>

              {/* Recent Trade Log */}
              <div style={{ background: '#0f2230', border: '1px solid #184b6a', borderRadius: 6, padding: 12, flex: 1, overflow: 'auto' }}>
                <div style={{ marginBottom: 8, color: '#8ab6d6' }}>Recent Trades</div>
                {tradeLog.length === 0 ? (
                  <div style={{ color: '#6090a0', fontSize: 12 }}>No trades recorded yet</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {tradeLog.slice(0, 20).map((t) => (
                      <div
                        key={t.id}
                        style={{
                          fontSize: 11,
                          padding: 6,
                          background: touchesTraderOwner(t) ? '#102535' : '#0a1520',
                          borderRadius: 4,
                          border: touchesTraderOwner(t) ? '1px solid #3fb6ff' : '1px solid transparent',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                          <span style={{ color: '#8ab6d6' }}>{t.fleetName}</span>
                          <span style={{ color: t.profit >= 0 ? '#88cc44' : '#ff6666' }}>{t.profit >= 0 ? `+${t.profit}` : t.profit}</span>
                        </div>
                        <div style={{ color: '#6090a0' }}>
                          {isInternalTransfer(t) && (
                            <span style={{ marginRight: 6, color: '#8ab6d6' }}>(internal transfer)</span>
                          )}
                          {t.quantity}x {t.wareName} • {t.buySectorId} → {t.sellSectorId}
                        </div>
                        <div style={{ color: '#8ab6d6', fontSize: 10, marginTop: 2 }}>
                          Buy owner: {getOwnerLabelById(getStationOwnerIdByName(t.buyStationName))} → Sell owner: {getOwnerLabelById(getStationOwnerIdByName(t.sellStationName))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

        ) : activeTab === 'corporations' ? (
          /* Corporations Tab */
          <div style={{ background: '#0f2230', border: '1px solid #184b6a', borderRadius: 6, padding: 12, overflow: 'auto', height: '100%' }}>
            <div style={{ marginBottom: 12, color: '#8ab6d6', fontSize: 16, fontWeight: 'bold' }}>Corporations</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
              {corporations.map((corp) => (
                <div
                  key={corp.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedCorpId(corp.id)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setSelectedCorpId(corp.id) }}
                  style={{
                    background: '#0a1520',
                    border: '1px solid #184b6a',
                    borderRadius: 6,
                    padding: 16,
                    cursor: 'pointer',
                    transition: 'border-color 120ms ease, box-shadow 120ms ease',
                    boxShadow: selectedCorpId === corp.id ? '0 0 0 2px rgba(63,182,255,0.35)' : 'none'
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = '#3fb6ff' }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = '#184b6a' }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <span style={{ fontSize: 16, fontWeight: 'bold', color: getOwnerColor(corp.race) }}>{corp.name}</span>
                    <span style={{ fontSize: 12, color: '#6090a0', textTransform: 'capitalize' }}>{corp.type}</span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: 13 }}>
                    <div>
                      <div style={{ color: '#6090a0', marginBottom: 2 }}>Credits</div>
                      <div style={{ color: '#c3e7ff', fontSize: 15 }}>{Math.floor(corp.credits).toLocaleString()} Cr</div>
                    </div>
                    <div>
                      <div style={{ color: '#6090a0', marginBottom: 2 }}>Net Worth</div>
                      <div style={{ color: '#88cc44', fontSize: 15 }}>{Math.floor(corp.netWorth).toLocaleString()} Cr</div>
                    </div>
                    <div>
                      <div style={{ color: '#6090a0', marginBottom: 2 }}>Stations</div>
                      <div style={{ color: '#c3e7ff' }}>{corp.stationIds.length}</div>
                    </div>
                    <div>
                      <div style={{ color: '#6090a0', marginBottom: 2 }}>Fleets</div>
                      <div style={{ color: '#c3e7ff' }}>{corp.fleetIds.length}</div>
                    </div>
                    <div>
                      <div style={{ color: '#6090a0', marginBottom: 2 }}>Lifetime Profit</div>
                      <div style={{ color: '#88cc44' }}>{Math.floor(corp.lifetimeProfit).toLocaleString()} Cr</div>
                    </div>
                    <div>
                      <div style={{ color: '#6090a0', marginBottom: 2 }}>Trades Completed</div>
                      <div style={{ color: '#c3e7ff' }}>{corp.lifetimeTrades}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {selectedCorp && (
              <div
                onClick={() => setSelectedCorpId(null)}
                style={{
                  position: 'fixed',
                  inset: 0,
                  background: 'rgba(0,0,0,0.6)',
                  zIndex: 1000,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 24
                }}
              >
                <div
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    width: 'min(900px, 95vw)',
                    maxHeight: '90vh',
                    overflow: 'auto',
                    background: '#06121a',
                    border: '1px solid #3fb6ff',
                    borderRadius: 8,
                    padding: 16,
                    boxShadow: '0 12px 60px rgba(0,0,0,0.7)'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                      <span style={{ fontSize: 20, fontWeight: 'bold', color: getOwnerColor(selectedCorp.race) }}>{selectedCorp.name}</span>
                      <span style={{ fontSize: 12, color: '#6090a0', textTransform: 'capitalize' }}>{selectedCorp.type}</span>
                      <span style={{ fontSize: 12, color: '#8ab6d6' }}>{selectedCorp.race.toUpperCase()}</span>
                    </div>
                    <button
                      onClick={() => setSelectedCorpId(null)}
                      style={{ padding: '6px 10px', border: '1px solid #3fb6ff', background: '#0f2230', color: '#c3e7ff', cursor: 'pointer' }}
                    >
                      Close
                    </button>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: 12, marginBottom: 14 }}>
                    <div style={{ background: '#0f2230', border: '1px solid #184b6a', borderRadius: 6, padding: 10 }}>
                      <div style={{ color: '#6090a0', fontSize: 10, marginBottom: 4 }}>FUNDS</div>
                      <div style={{ color: '#c3e7ff', fontSize: 15 }}>{Math.floor(selectedCorp.credits).toLocaleString()} Cr</div>
                    </div>
                    <div style={{ background: '#0f2230', border: '1px solid #184b6a', borderRadius: 6, padding: 10 }}>
                      <div style={{ color: '#6090a0', fontSize: 10, marginBottom: 4 }}>NET WORTH</div>
                      <div style={{ color: '#88cc44', fontSize: 15 }}>{Math.floor(selectedCorp.netWorth).toLocaleString()} Cr</div>
                    </div>
                  </div>

                  {(() => {
                    const ownedStations = stations.filter((st) => selectedCorp.stationIds.includes(st.id) || st.ownerId === selectedCorp.id)
                    const ownedFleets = fleets.filter((f) => selectedCorp.fleetIds.includes(f.id) || f.ownerId === selectedCorp.id)
                    return (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                        <div style={{ background: '#0a1520', border: '1px solid #184b6a', borderRadius: 6, padding: 10, minHeight: 160 }}>
                          <div style={{ marginBottom: 8, color: '#8ab6d6', fontWeight: 'bold' }}>Owned Stations ({ownedStations.length})</div>
                          {ownedStations.length === 0 ? (
                            <div style={{ color: '#6090a0', fontSize: 12 }}>None</div>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                              {ownedStations.map((st) => {
                                const recipe = recipeMap.get(st.recipeId)
                                const productName = recipe ? (wareMap.get(recipe.productId) || recipe.productId) : st.recipeId
                                return (
                                  <div
                                    key={st.id}
                                    role="button"
                                    tabIndex={0}
                                    onClick={() => setSelectedStationId(st.id)}
                                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setSelectedStationId(st.id) }}
                                    style={{ fontSize: 12, padding: 6, background: '#0f2230', borderRadius: 4, border: '1px solid #12384f', cursor: 'pointer' }}
                                  >
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                      <span style={{ color: '#c3e7ff' }}>{st.name}</span>
                                      <span style={{ color: '#6090a0' }}>{st.sectorId}</span>
                                    </div>
                                    <div style={{ color: '#8ab6d6', fontSize: 11 }}>{productName}</div>
                                  </div>
                                )
                              })}
                            </div>
                          )}
                        </div>

                        <div style={{ background: '#0a1520', border: '1px solid #184b6a', borderRadius: 6, padding: 10, minHeight: 160 }}>
                          <div style={{ marginBottom: 8, color: '#8ab6d6', fontWeight: 'bold' }}>Owned Ships ({ownedFleets.length})</div>
                          {ownedFleets.length === 0 ? (
                            <div style={{ color: '#6090a0', fontSize: 12 }}>None</div>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                              {ownedFleets.map((f) => (
                                <div
                                  key={f.id}
                                  role="button"
                                  tabIndex={0}
                                  onClick={() => setSelectedFleetId(f.id)}
                                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setSelectedFleetId(f.id) }}
                                  style={{ fontSize: 12, padding: 6, background: '#0f2230', borderRadius: 4, border: '1px solid #12384f', cursor: 'pointer' }}
                                >
                                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ color: '#c3e7ff' }}>{f.name}</span>
                                    <span style={{ color: '#6090a0' }}>{f.currentSectorId}</span>
                                  </div>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#8ab6d6' }}>
                                    <span>{f.shipType}</span>
                                    <span style={{ textTransform: 'capitalize', color: getStateColor(f.state) }}>{f.state}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })()}
                </div>

                {selectedStation && (
                  <div
                    onClick={() => setSelectedStationId(null)}
                    style={{
                      position: 'fixed',
                      inset: 0,
                      background: 'rgba(0,0,0,0.65)',
                      zIndex: 1100,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: 24
                    }}
                  >
                    <div
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        width: 'min(900px, 95vw)',
                        maxHeight: '90vh',
                        overflow: 'auto',
                        background: '#06121a',
                        border: '1px solid #3fb6ff',
                        borderRadius: 8,
                        padding: 14
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                        <div style={{ fontSize: 18, fontWeight: 'bold', color: '#c3e7ff' }}>{selectedStation.name}</div>
                        <button
                          onClick={() => setSelectedStationId(null)}
                          style={{ padding: '6px 10px', border: '1px solid #3fb6ff', background: '#0f2230', color: '#c3e7ff', cursor: 'pointer' }}
                        >
                          Close
                        </button>
                      </div>

                      {(() => {
                        const stationNameLower = selectedStation.name.toLowerCase()
                        const stationTrades = tradeLog.filter((t) =>
                          t.buyStationName.toLowerCase() === stationNameLower ||
                          t.sellStationName.toLowerCase() === stationNameLower
                        )
                        return (
                          <div>
                            <div style={{ marginBottom: 8, color: '#8ab6d6' }}>Transactions ({stationTrades.length})</div>
                            {stationTrades.length === 0 ? (
                              <div style={{ color: '#6090a0', fontSize: 12 }}>No trades recorded for this station yet</div>
                            ) : (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                {stationTrades.slice(0, 200).map((t) => (
                                  <div key={t.id} style={{ fontSize: 12, padding: 8, background: '#0f2230', borderRadius: 4, border: '1px solid #12384f' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                                      <span style={{ color: '#c3e7ff' }}>{t.quantity}x {t.wareName}</span>
                                      <span style={{ color: t.profit >= 0 ? '#88cc44' : '#ff6666' }}>{t.profit >= 0 ? `+${t.profit}` : t.profit} Cr</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#8ab6d6', fontSize: 11 }}>
                                      <span>{t.buyStationName} ({t.buySectorId}) → {t.sellStationName} ({t.sellSectorId})</span>
                                      <span>{t.fleetName}</span>
                                    </div>
                                    {isInternalTransfer(t) && (
                                      <div style={{ color: '#8ab6d6', fontSize: 10, marginTop: 2 }}>(internal transfer)</div>
                                    )}
                                    <div style={{ color: '#6090a0', fontSize: 11 }}>Buy {t.buyPrice} / Sell {t.sellPrice}</div>
                                  </div>
                                ))}
                                {stationTrades.length > 200 && (
                                  <div style={{ color: '#6090a0', fontSize: 11 }}>Showing first 200 entries</div>
                                )}
                              </div>
                            )}
                          </div>
                        )
                      })()}
                    </div>
                  </div>
                )}

                {selectedFleet && (
                  <div
                    onClick={() => setSelectedFleetId(null)}
                    style={{
                      position: 'fixed',
                      inset: 0,
                      background: 'rgba(0,0,0,0.65)',
                      zIndex: 1100,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: 24
                    }}
                  >
                    <div
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        width: 'min(900px, 95vw)',
                        maxHeight: '90vh',
                        overflow: 'auto',
                        background: '#06121a',
                        border: '1px solid #3fb6ff',
                        borderRadius: 8,
                        padding: 14
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
                          <div style={{ fontSize: 18, fontWeight: 'bold', color: '#c3e7ff' }}>{selectedFleet.name}</div>
                          <div style={{ fontSize: 12, color: '#8ab6d6' }}>{selectedFleet.shipType}</div>
                        </div>
                        <button
                          onClick={() => setSelectedFleetId(null)}
                          style={{ padding: '6px 10px', border: '1px solid #3fb6ff', background: '#0f2230', color: '#c3e7ff', cursor: 'pointer' }}
                        >
                          Close
                        </button>
                      </div>

                      {(() => {
                        const fleetTrades = tradeLog.filter((t) => t.fleetId === selectedFleet.id)
                        return (
                          <div>
                            <div style={{ marginBottom: 8, color: '#8ab6d6' }}>Trade Log ({fleetTrades.length})</div>
                            {fleetTrades.length === 0 ? (
                              <div style={{ color: '#6090a0', fontSize: 12 }}>No trades recorded for this ship yet</div>
                            ) : (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                {fleetTrades.slice(0, 200).map((t) => (
                                  <div key={t.id} style={{ fontSize: 12, padding: 8, background: '#0f2230', borderRadius: 4, border: '1px solid #12384f' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                                      <span style={{ color: '#c3e7ff' }}>{t.quantity}x {t.wareName}</span>
                                      <span style={{ color: t.profit >= 0 ? '#88cc44' : '#ff6666' }}>{t.profit >= 0 ? `+${t.profit}` : t.profit} Cr</span>
                                    </div>
                                    <div style={{ color: '#8ab6d6', fontSize: 11 }}>
                                      {isInternalTransfer(t) && (
                                        <span style={{ marginRight: 6, color: '#8ab6d6' }}>(internal transfer)</span>
                                      )}
                                      {t.buyStationName} ({t.buySectorId}) → {t.sellStationName} ({t.sellSectorId})
                                    </div>
                                    <div style={{ color: '#6090a0', fontSize: 11 }}>Buy {t.buyPrice} / Sell {t.sellPrice}</div>
                                  </div>
                                ))}
                                {fleetTrades.length > 200 && (
                                  <div style={{ color: '#6090a0', fontSize: 11 }}>Showing first 200 entries</div>
                                )}
                              </div>
                            )}
                          </div>
                        )
                      })()}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : activeTab === 'teladi_ai' ? (
          <div style={{ height: '100%' }}>
            <CorpAIAgentTab corpId="teladi_company" corporations={corporations} stations={stations} fleets={fleets} />
          </div>
        ) : activeTab === 'corp_ai_2' ? (
          <div style={{ height: '100%' }}>
            <MultiCorpAIAgentTab corporations={corporations} stations={stations} fleets={fleets} />
          </div>
        ) : activeTab === 'characters' ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {/* CEOs Section */}
            <div style={{ marginBottom: 24 }}>
              <div style={{ color: '#88cc44', fontSize: 14, marginBottom: 8, borderBottom: '1px solid #184b6a', paddingBottom: 4 }}>
                Corporation CEOs
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 12 }}>
                {corporations.map((corp) => (
                  <div key={corp.id} style={{ background: '#0f2230', border: '1px solid #184b6a', borderRadius: 6, padding: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                      <div>
                        <div style={{ fontWeight: 'bold', color: '#ffcc44', fontSize: 14 }}>CEO of {corp.name}</div>
                        <div style={{ fontSize: 11, color: '#6090a0' }}>{corp.type.toUpperCase()} - {corp.race.toUpperCase()}</div>
                      </div>
                      <div style={{ textAlign: 'right', fontSize: 11, color: '#8ab6d6' }}>
                        <div>{corp.stationIds.length} Stations</div>
                        <div>{corp.fleetIds.length} Fleets</div>
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 12, marginBottom: 12 }}>
                      <div style={{ background: '#1a2a30', padding: 4, borderRadius: 4 }}>
                        <div style={{ color: '#6090a0', fontSize: 10 }}>FUNDS</div>
                        <div style={{ color: '#c3e7ff' }}>{Math.floor(corp.credits).toLocaleString()} Cr</div>
                      </div>
                      <div style={{ background: '#1a2a30', padding: 4, borderRadius: 4 }}>
                        <div style={{ color: '#6090a0', fontSize: 10 }}>NET WORTH</div>
                        <div style={{ color: '#88cc44' }}>{Math.floor(corp.netWorth).toLocaleString()} Cr</div>
                      </div>
                    </div>

                    {/* CEO Focus */}
                    <div style={{ marginBottom: 12, background: '#0a1a24', border: '1px solid #184b6a', borderRadius: 6, padding: 10 }}>
                      <div style={{ color: '#6090a0', fontSize: 10, marginBottom: 6 }}>CURRENT GOAL</div>
                      {(() => {
                        const goal = (corp.aiState?.currentGoal ?? 'stabilize') as 'stabilize' | 'expand' | 'war'
                        const pending = corp.aiState?.pendingConstructions ?? []
                        const goalColors: Record<'stabilize' | 'expand' | 'war', string> = {
                          stabilize: '#ffcc44',
                          expand: '#88cc44',
                          war: '#ff6666'
                        }
                        const goalCopy: Record<'stabilize' | 'expand' | 'war', string> = {
                          stabilize: 'Shoring up profits and cash reserves',
                          expand: 'Pushing for new stations and fleets',
                          war: 'Aggressive moves and risky trades'
                        }
                        return (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ color: goalColors[goal], fontWeight: 'bold' }}>{goal.toUpperCase()}</span>
                              <span style={{ color: '#8ab6d6', fontSize: 11, textAlign: 'right' }}>{goalCopy[goal]}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                              <span style={{ color: '#6090a0' }}>Pending builds</span>
                              <span style={{ color: pending.length > 0 ? '#88cc44' : '#3a4b5c' }}>
                                {pending.length > 0 ? `${pending.length} in queue` : 'none'}
                              </span>
                            </div>
                            {pending.length > 0 && (
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 4, fontSize: 11, background: '#0f2230', border: '1px solid #184b6a', borderRadius: 4, padding: 6 }}>
                                {pending.slice(0, 3).map((job) => (
                                  <Fragment key={job.id}>
                                    <span style={{ color: '#c3e7ff' }}>{job.stationType} → {job.targetSectorId}</span>
                                    <span style={{ color: '#8ab6d6', textTransform: 'capitalize' }}>{job.status}</span>
                                  </Fragment>
                                ))}
                                {pending.length > 3 && (
                                  <span style={{ gridColumn: '1 / span 2', color: '#6090a0' }}>+{pending.length - 3} more queued</span>
                                )}
                              </div>
                            )}
                          </div>
                        )
                      })()}
                    </div>

                    {/* Personality Traits */}
                    <div style={{ fontSize: 11 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <div style={{ width: 80, color: '#6090a0' }}>Aggressiveness</div>
                        <div style={{ flex: 1, height: 4, background: '#183040', borderRadius: 2 }}>
                          <div style={{ width: `${corp.aggressiveness * 100}%`, height: '100%', background: '#ff8888', borderRadius: 2 }} />
                        </div>
                        <div style={{ width: 30, textAlign: 'right', color: '#888' }}>{(corp.aggressiveness * 100).toFixed(0)}%</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <div style={{ width: 80, color: '#6090a0' }}>Risk Tolerance</div>
                        <div style={{ flex: 1, height: 4, background: '#183040', borderRadius: 2 }}>
                          <div style={{ width: `${corp.riskTolerance * 100}%`, height: '100%', background: '#ffcc44', borderRadius: 2 }} />
                        </div>
                        <div style={{ width: 30, textAlign: 'right', color: '#888' }}>{(corp.riskTolerance * 100).toFixed(0)}%</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 80, color: '#6090a0' }}>Expansion $$$</div>
                        <div style={{ color: '#8ab6d6' }}>{corp.expansionBudget.toLocaleString()} Cr</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Independent Traders Section */}
            <div>
              <div style={{ color: '#ff9944', fontSize: 14, marginBottom: 8, borderBottom: '1px solid #184b6a', paddingBottom: 4 }}>
                Independent Traders (Sole Proprietors)
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 12 }}>
                {fleets.filter(f => f.ownerType === 'independent').map((trader) => {
                  const promotionProgress = Math.min(100, (trader.credits / 500000) * 100)
                  return (
                    <div key={trader.id} style={{ background: '#0f2230', border: '1px solid #184b6a', borderRadius: 6, padding: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                        <div>
                          <div style={{ fontWeight: 'bold', color: '#ff9944' }}>{trader.name}</div>
                          <div style={{ fontSize: 11, color: '#6090a0' }}>{trader.shipType} - Home: {trader.homeSectorId}</div>
                        </div>
                        <div style={{ padding: '2px 8px', background: '#1a2a30', borderRadius: 4, fontSize: 11, color: getStateColor(trader.state), border: `1px solid ${getStateColor(trader.state)}44` }}>
                          {trader.state.toUpperCase()}
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 12, marginBottom: 12 }}>
                        <div style={{ background: '#1a2a30', padding: 4, borderRadius: 4 }}>
                          <div style={{ color: '#6090a0', fontSize: 10 }}>FUNDS</div>
                          <div style={{ color: '#c3e7ff' }}>{Math.floor(trader.credits).toLocaleString()} Cr</div>
                        </div>
                        <div style={{ background: '#1a2a30', padding: 4, borderRadius: 4 }}>
                          <div style={{ color: '#6090a0', fontSize: 10 }}>PROFIT</div>
                          <div style={{ color: '#88cc44' }}>+{Math.floor(trader.totalProfit).toLocaleString()} Cr</div>
                        </div>
                      </div>

                      {/* Current Activity / Order */}
                      <div style={{ background: '#0a1520', padding: 6, borderRadius: 4, marginBottom: 12, fontSize: 11, minHeight: 32 }}>
                        <div style={{ color: '#6090a0', fontSize: 9, marginBottom: 2 }}>CURRENT ACTIVITY</div>
                        {trader.currentOrder ? (
                          <div style={{ color: '#c3e7ff' }}>
                            {trader.state === 'loading' || trader.state === 'in-transit' && Object.keys(trader.cargo).length === 0 ? (
                              <span>Buying <span style={{ color: '#fff' }}>{trader.currentOrder.buyWareName}</span> at {trader.currentOrder.buyStationName}</span>
                            ) : (
                              <span>Selling <span style={{ color: '#fff' }}>{trader.currentOrder.sellWareName}</span> at {trader.currentOrder.sellStationName}</span>
                            )}
                          </div>
                        ) : (
                          <div style={{ color: '#888', fontStyle: 'italic' }}>Thinking... ({trader.currentSectorId})</div>
                        )}
                      </div>

                      {/* Promotion Progress Bar */}
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#6090a0', marginBottom: 2 }}>
                          <span>Corp Founding Progress</span>
                          <span>{promotionProgress.toFixed(0)}%</span>
                        </div>
                        <div style={{ height: 4, background: '#1a2a30', borderRadius: 2, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${promotionProgress}%`, background: promotionProgress >= 100 ? '#88cc44' : '#ffcc44', transition: 'width 0.3s' }} />
                        </div>
                      </div>
                    </div>
                  )
                })}
                {fleets.filter(f => f.ownerType === 'independent').length === 0 && (
                  <div style={{ color: '#6090a0', fontStyle: 'italic' }}>No independent traders yet. They spawn over time...</div>
                )}
              </div>
            </div>
          </div>
        ) : activeTab === 'graphs' ? (
          <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 20, height: '100%' }}>
            {/* Chart Controls */}
            <div style={{ display: 'flex', gap: 16, alignItems: 'center', background: '#0f2230', padding: 12, borderRadius: 6, border: '1px solid #184b6a' }}>
              <span style={{ color: '#c3e7ff' }}>Ware Selection:</span>
              <select
                value={graphWareId}
                onChange={(e) => setGraphWareId(e.target.value)}
                style={{ padding: '6px 10px', background: '#0a1520', border: '1px solid #3fb6ff', color: '#c3e7ff', borderRadius: 4 }}
              >
                <option value="all">All Wares (Aggregate)</option>
                {wares.map(w => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
              <span style={{ color: '#8ab6d6', fontSize: 13 }}>
                History: {economyHistory.length} snapshots ({((economyHistory.length * 10) / 60).toFixed(1)} min)
              </span>
            </div>

            <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
              {/* Stock Level Chart */}
              <div style={{ flex: 1, minWidth: 400 }}>
                <SimpleLineChart
                  title={`Universe Stock Levels: ${graphWareId === 'all' ? 'All Wares' : (wareMap.get(graphWareId) || graphWareId)}`}
                  data={economyHistory.map(h => {
                    const date = new Date(h.timestamp);
                    const label = `${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}:${String(date.getSeconds()).padStart(2, '0')}`;
                    let value = 0;
                    if (graphWareId === 'all') {
                      value = Object.values(h.totalStock).reduce((a, b) => a + b, 0);
                    } else {
                      value = h.totalStock[graphWareId] || 0;
                    }
                    return { label, value };
                  })}
                  width={500}
                  height={300}
                  color="#ffaa44"
                  yLabel="Units"
                />
              </div>

              {/* Price Chart */}
              <div style={{ flex: 1, minWidth: 400 }}>
                <SimpleLineChart
                  title={`Average Price: ${graphWareId === 'all' ? 'Price Index' : (wareMap.get(graphWareId) || graphWareId)}`}
                  data={economyHistory.map(h => {
                    const date = new Date(h.timestamp);
                    const label = `${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}:${String(date.getSeconds()).padStart(2, '0')}`;
                    let value = 0;
                    if (graphWareId === 'all') {
                      // Simple average of all averages
                      const prices = Object.values(h.avgPrices);
                      value = prices.length > 0 ? prices.reduce((a, b) => a + b, 0) / prices.length : 0;
                    } else {
                      value = h.avgPrices[graphWareId] || 0;
                    }
                    return { label, value };
                  })}
                  width={500}
                  height={300}
                  color="#88cc44"
                  yLabel="Credits"
                />
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
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
