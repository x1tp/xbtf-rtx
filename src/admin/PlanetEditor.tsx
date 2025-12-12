import { Suspense, useState, useEffect, useRef, useMemo } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { Environment, OrthographicCamera, MapControls, Grid } from '@react-three/drei';
import { Planet } from '../components/Planet';
import { Sun } from '../components/Sun';
import { Station } from '../components/Station';
import { Box3, Vector3, BackSide } from 'three';
import * as THREE from 'three';
import { DEFAULT_SECTOR_CONFIG } from '../config/sector';

export const PlanetEditor: React.FC = () => {
  const initCfg = useMemo(() => {
    try {
      const raw = typeof window !== 'undefined' ? window.localStorage.getItem('sector:config') : null;
      if (!raw) return DEFAULT_SECTOR_CONFIG;
      const parsed = JSON.parse(raw);
      return {
        sun: { ...DEFAULT_SECTOR_CONFIG.sun, ...(parsed.sun || {}) },
        planet: { ...DEFAULT_SECTOR_CONFIG.planet, ...(parsed.planet || {}) },
        station: { ...DEFAULT_SECTOR_CONFIG.station, ...(parsed.station || {}) }
      };
    } catch {
      return DEFAULT_SECTOR_CONFIG;
    }
  }, []);
  const [size, setSize] = useState(initCfg.planet.size);
  const [positionX, setPositionX] = useState(initCfg.planet.position[0]);
  const [positionY, setPositionY] = useState(initCfg.planet.position[1]);
  const [positionZ, setPositionZ] = useState(initCfg.planet.position[2]);
  const [sunX, setSunX] = useState(initCfg.sun.position[0]);
  const [sunY, setSunY] = useState(initCfg.sun.position[1]);
  const [sunZ, setSunZ] = useState(initCfg.sun.position[2]);
  const [cloudsEnabled, setCloudsEnabled] = useState(true);
  const [cloudOpacity, setCloudOpacity] = useState(0.9);
  const [cloudAlphaTest, setCloudAlphaTest] = useState(0.3);
  const [radiusMul, setRadiusMul] = useState(1.03);
  const [rimPower, setRimPower] = useState(2.6);
  const [rayleigh, setRayleigh] = useState(1.8);
  const [noiseScale, setNoiseScale] = useState(0.8);
  const [noiseAmp, setNoiseAmp] = useState(0.25);
  const [sunMaskMin, setSunMaskMin] = useState(0.45);
  const [sunMaskMax, setSunMaskMax] = useState(0.95);
  const [innerColor, setInnerColor] = useState('#7fc0ff');
  const [outerColor, setOuterColor] = useState('#b2e0ff');
  const [showGrid, setShowGrid] = useState(true);
  const [includePlanetInFit, setIncludePlanetInFit] = useState(false);
  const [fitReq, setFitReq] = useState<'none' | 'stations' | 'planet'>('none');
  const [rimMode, setRimMode] = useState<'normal' | 'hide' | 'shrink'>('normal');
  const [rimScale, setRimScale] = useState(1.02);
  const saveConfig = () => {
    const cfg = {
      sun: { position: [sunX, sunY, sunZ], size: DEFAULT_SECTOR_CONFIG.sun.size, color: DEFAULT_SECTOR_CONFIG.sun.color, intensity: DEFAULT_SECTOR_CONFIG.sun.intensity },
      planet: { position: [positionX, positionY, positionZ], size },
      station: DEFAULT_SECTOR_CONFIG.station
    };
    if (typeof window !== 'undefined') window.localStorage.setItem('sector:config', JSON.stringify(cfg));
  };
  const resetToSceneDefaults = () => {
    setPositionX(DEFAULT_SECTOR_CONFIG.planet.position[0]);
    setPositionY(DEFAULT_SECTOR_CONFIG.planet.position[1]);
    setPositionZ(DEFAULT_SECTOR_CONFIG.planet.position[2]);
    setSize(DEFAULT_SECTOR_CONFIG.planet.size);
    setSunX(DEFAULT_SECTOR_CONFIG.sun.position[0]);
    setSunY(DEFAULT_SECTOR_CONFIG.sun.position[1]);
    setSunZ(DEFAULT_SECTOR_CONFIG.sun.position[2]);
  };

  const FitCamera = ({ radius, center, includePlanet, recenterKey, onApplied }: { radius: number; center: [number, number, number]; includePlanet: boolean; recenterKey: 'none' | 'stations' | 'planet'; onApplied: () => void }) => {
    const state = useThree();
    const appliedRef = useRef(false);
    useEffect(() => {
      const camera = state.camera as unknown as { position: { set: (x: number, y: number, z: number) => void }; zoom: number; updateProjectionMatrix: () => void; lookAt: (x: number, y: number, z: number) => void };
      const controls = (state as unknown as { controls?: { target?: { set: (x: number, y: number, z: number) => void }; update?: () => void } }).controls;
      const scene = state.scene;
      const targets: THREE.Object3D[] = [];
      const s = scene.getObjectByName('Station'); if (s) targets.push(s);
      const p = scene.getObjectByName('PlanetGroup'); if ((includePlanet || recenterKey === 'planet') && p) targets.push(p);
      const bbox = new Box3();
      let haveAny = false;
      for (const obj of targets) {
        const b = new Box3().setFromObject(obj);
        if (!haveAny) { bbox.copy(b); haveAny = true; } else { bbox.union(b); }
      }
      if (!haveAny || recenterKey === 'planet') {
        const cx = center[0], cy = center[1], cz = center[2];
        camera.position.set(cx, Math.max(radius * 2, 2000), cz);
        if (controls && controls.target && typeof controls.target.set === 'function') {
          controls.target.set(cx, cy, cz);
          if (typeof controls.update === 'function') controls.update();
        }
        camera.lookAt(cx, cy, cz);
        const w = state.size.width, h = state.size.height;
        const target = radius * 2 * 1.1;
        const zoom = Math.min(w / target, h / target);
        camera.zoom = zoom;
        camera.updateProjectionMatrix();
        appliedRef.current = true;
        onApplied();
        return;
      }
      let centerVec = bbox.getCenter(new Vector3());
      const sizeVec = bbox.getSize(new Vector3());
      const w = state.size.width, h = state.size.height;
      const maxDim = Math.max(sizeVec.x, sizeVec.z) * 1.2;
      const zoom = Math.min(w / maxDim, h / maxDim);
      const halfW = w / (2 * zoom);
      const halfH = h / (2 * zoom);
      const planetCenter = new Vector3(center[0], center[1], center[2]);
      const r = radius;
      const dx = centerVec.x - planetCenter.x;
      const dz = centerVec.z - planetCenter.z;
      const dLen = Math.sqrt(dx * dx + dz * dz);
      const rectRadius = Math.sqrt(halfW * halfW + halfH * halfH);
      const margin = Math.max(500, r * 0.02);
      const includeP = includePlanet;
      if (!includeP && dLen < r + rectRadius + margin) {
        const dir = new Vector3(dx, 0, dz).normalize();
        const need = r + rectRadius + margin - dLen;
        if (isFinite(need) && isFinite(dir.x) && isFinite(dir.z)) {
          centerVec = centerVec.clone().add(dir.multiplyScalar(need));
        } else {
          centerVec = centerVec.clone().add(new Vector3(r + rectRadius + margin, 0, 0));
        }
      }
      camera.position.set(centerVec.x, Math.max(sizeVec.y * 1.5, 2000), centerVec.z);
      if (controls && controls.target && typeof controls.target.set === 'function') {
        controls.target.set(centerVec.x, centerVec.y, centerVec.z);
        if (typeof controls.update === 'function') controls.update();
      }
      camera.lookAt(centerVec.x, centerVec.y, centerVec.z);
      camera.zoom = zoom;
      camera.updateProjectionMatrix();
      appliedRef.current = true;
      onApplied();
    }, [state, state.size.width, state.size.height, radius, center, includePlanet, recenterKey, onApplied]);

    useFrame(() => {
      if (appliedRef.current) return;
      const camera = state.camera as unknown as { position: { set: (x: number, y: number, z: number) => void }; zoom: number; updateProjectionMatrix: () => void; lookAt: (x: number, y: number, z: number) => void };
      const controls = (state as unknown as { controls?: { target?: { set: (x: number, y: number, z: number) => void }; update?: () => void } }).controls;
      const scene = state.scene;
      const s = scene.getObjectByName('Station');
      const p = scene.getObjectByName('PlanetGroup');
      if (!s && !(includePlanet && p)) return;
      const bbox = new Box3();
      let haveAny = false;
      if (s) { bbox.setFromObject(s); haveAny = true; }
      if (includePlanet && p) { const pb = new Box3().setFromObject(p); if (!haveAny) { bbox.copy(pb); haveAny = true; } else { bbox.union(pb); } }
      if (!haveAny) return;
      let centerVec = bbox.getCenter(new Vector3());
      const sizeVec = bbox.getSize(new Vector3());
      const w = state.size.width, h = state.size.height;
      const maxDim = Math.max(sizeVec.x, sizeVec.z) * 1.2;
      const zoom = Math.min(w / maxDim, h / maxDim);
      const halfW = w / (2 * zoom);
      const halfH = h / (2 * zoom);
      const planetCenter = new Vector3(center[0], center[1], center[2]);
      const r = radius;
      const dx = centerVec.x - planetCenter.x;
      const dz = centerVec.z - planetCenter.z;
      const dLen = Math.sqrt(dx * dx + dz * dz);
      const rectRadius = Math.sqrt(halfW * halfW + halfH * halfH);
      const margin = Math.max(500, r * 0.02);
      const includeP2 = includePlanet;
      if (!includeP2 && dLen < r + rectRadius + margin) {
        const dir = new Vector3(dx, 0, dz).normalize();
        const need = r + rectRadius + margin - dLen;
        if (isFinite(need) && isFinite(dir.x) && isFinite(dir.z)) {
          centerVec = centerVec.clone().add(dir.multiplyScalar(need));
        } else {
          centerVec = centerVec.clone().add(new Vector3(r + rectRadius + margin, 0, 0));
        }
      }
      camera.position.set(centerVec.x, Math.max(sizeVec.y * 1.5, 2000), centerVec.z);
      if (controls && controls.target && typeof controls.target.set === 'function') {
        controls.target.set(centerVec.x, centerVec.y, centerVec.z);
        if (typeof controls.update === 'function') controls.update();
      }
      camera.lookAt(centerVec.x, centerVec.y, centerVec.z);
      camera.zoom = zoom;
      camera.updateProjectionMatrix();
      appliedRef.current = true;
      onApplied();
    });
    return null;
  };

  const StarfieldSky: React.FC<{ density?: number; brightness?: number; milkyWayStrength?: number; orientation?: [number, number, number]; fadeMin?: number; fadeMax?: number; viewFadeMin?: number; viewFadeMax?: number }> = ({ density = 0.25, brightness = 1.0, milkyWayStrength = 0.22, orientation = [0.0, 0.25, 0.97], fadeMin = 0.2, fadeMax = 0.95, viewFadeMin = 0.6, viewFadeMax = 0.85 }) => {
    const matRef = useRef<THREE.ShaderMaterial | null>(null);
    const { scene } = useThree();
    const rayRef = useRef(new THREE.Raycaster());
    const uniforms = useMemo(() => ({
      uTime: { value: 0 },
      uDensity: { value: density },
      uBrightness: { value: brightness },
      uMilkyWayStrength: { value: milkyWayStrength },
      uOrientation: { value: new THREE.Vector3(orientation[0], orientation[1], orientation[2]).normalize() },
      uSunDir: { value: new THREE.Vector3(0, 1, 0) },
      uFadeMin: { value: fadeMin },
      uFadeMax: { value: fadeMax },
      uCamSunDot: { value: 0 },
      uViewFadeMin: { value: viewFadeMin },
      uViewFadeMax: { value: viewFadeMax },
      uSunVisible: { value: 1 },
      uViewAdapt: { value: 0 }
    }), [density, brightness, milkyWayStrength, orientation, fadeMin, fadeMax, viewFadeMin, viewFadeMax]);
    const adaptRef = useRef(0);
    useFrame((state, delta) => {
      const m = matRef.current;
      if (!m) return;
      const u = m.uniforms as unknown as { uTime: { value: number }; uSunDir: { value: THREE.Vector3 }; uCamSunDot: { value: number }; uSunVisible: { value: number } };
      u.uTime.value += delta;
      const cam = state.camera;
      const camPos = new THREE.Vector3();
      cam.getWorldPosition(camPos);
      const sun = new THREE.Vector3(sunX, sunY, sunZ);
      const toSun = sun.clone().sub(camPos);
      const dist = toSun.length();
      const dir = toSun.normalize();
      u.uSunDir.value.copy(dir);
      const fwd = new THREE.Vector3();
      cam.getWorldDirection(fwd);
      const d = Math.max(0, fwd.dot(dir));
      u.uCamSunDot.value = d;
      const ray = rayRef.current;
      ray.near = 0.01;
      ray.far = dist;
      ray.set(camPos, dir);
      (ray as unknown as { camera?: THREE.Camera }).camera = cam;
      const occluders: THREE.Object3D[] = [];
      const p = scene.getObjectByName('PlanetGroup'); if (p) occluders.push(p);
      const st = scene.getObjectByName('Station'); if (st) occluders.push(st);
      const hits = ray.intersectObjects(occluders, true);
      const visible = hits.length === 0;
      u.uSunVisible.value = visible ? 1 : 0;
      const target = visible ? Math.max(0, Math.min(1, (d - viewFadeMin) / Math.max(0.0001, (viewFadeMax - viewFadeMin)))) : 0;
      const k = 3.0;
      const t = 1 - Math.exp(-k * delta);
      adaptRef.current = adaptRef.current + (target - adaptRef.current) * t;
      (m.uniforms as unknown as { uViewAdapt: { value: number } }).uViewAdapt.value = adaptRef.current;
    });
    const vertexShader = `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `;
    const fragmentShader = `
      uniform float uTime;
      uniform float uDensity;
      uniform float uBrightness;
      uniform float uMilkyWayStrength;
      uniform vec3 uOrientation;
      uniform vec3 uSunDir;
      uniform float uFadeMin;
      uniform float uFadeMax;
      uniform float uCamSunDot;
      uniform float uViewFadeMin;
      uniform float uViewFadeMax;
      uniform float uSunVisible;
      uniform float uViewAdapt;
      varying vec3 vDir;
      const float PI = 3.141592653589793;
      float hash(vec2 p) {
        p = fract(p * vec2(123.34, 345.45));
        p += dot(p, p + 34.3);
        return fract(p.x * p.y);
      }
      vec2 hash2(vec2 p) {
        float h1 = hash(p);
        float h2 = hash(p + h1);
        return vec2(h1, h2);
      }
      vec2 oct(vec3 n) {
        n = n / (abs(n.x) + abs(n.y) + abs(n.z));
        vec2 e = n.xy;
        if (n.z < 0.0) e = (1.0 - abs(e.yx)) * sign(e.xy);
        return e * 0.5 + 0.5;
      }
      vec2 rot2(vec2 p, float a) {
        float c = cos(a), s = sin(a);
        return vec2(c * p.x - s * p.y, s * p.x + c * p.y);
      }
      float vnoise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        vec2 u = f*f*(3.0-2.0*f);
        float a = hash(i);
        float b = hash(i + vec2(1.0, 0.0));
        float c = hash(i + vec2(0.0, 1.0));
        float d = hash(i + vec2(1.0, 1.0));
        return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
      }
      float star(vec2 uv, float scale, float density) {
        vec2 suv = uv * scale;
        vec2 cell = floor(suv);
        vec2 f = fract(suv);
        float rnd = hash(cell);
        float jitter = 0.6 + 0.4 * hash(cell + vec2(37.0,17.0));
        float exists = step(1.0 - density * jitter, rnd);
        vec2 off = hash2(cell);
        float r = 0.35 * (0.12 + 0.88 * rnd);
        float d = length(f - off);
        float disk = 1.0 - smoothstep(r, r + 0.018, d);
        float tw = 0.9 + 0.1 * sin(uTime * 0.2 + rnd * 6.28318);
        return exists * disk * pow(rnd, 12.0) * tw;
      }
      float stars(vec2 uv, float density) {
        vec2 w = uv;
        w += 0.0035 * vec2(vnoise(uv*87.0), vnoise(uv*71.0));
        w += 0.0018 * rot2(vec2(vnoise(uv*211.0), vnoise(uv*173.0)), 0.913);
        float s = 0.0;
        s += star(rot2(w, 0.517), 719.0, density);
        s += star(rot2(w, 1.271), 1499.0, density * 0.8);
        s += star(rot2(w, 2.083), 2903.0, density * 0.6);
        return s;
      }
      float milky(vec3 d, vec3 dir) {
        float b = 1.0 - abs(dot(normalize(d), normalize(dir)));
        return pow(max(b, 0.0), 6.0);
      }
      void main() {
        vec3 nd = normalize(vDir);
        vec2 uv = oct(nd);
        float s = stars(uv, uDensity);
        float m = milky(nd, uOrientation);
        float sunDot = max(dot(nd, normalize(uSunDir)), 0.0);
        float inViewGate = uSunVisible * smoothstep(uViewFadeMin, uViewFadeMax, uCamSunDot);
        float fadeDir = mix(1.0, 1.0 - smoothstep(uFadeMin, uFadeMax, sunDot), inViewGate);
        float viewFade = 1.0 - uViewAdapt;
        vec3 col = (vec3(s * uBrightness) + vec3(m * uMilkyWayStrength)) * fadeDir * viewFade;
        gl_FragColor = vec4(col, 1.0);
      }
    `;
    return (
      <mesh name="StarfieldSky" scale={[1, 1, 1]} frustumCulled={false}>
        <sphereGeometry args={[50000, 64, 64]} />
        <shaderMaterial ref={matRef} side={BackSide} vertexShader={vertexShader} fragmentShader={fragmentShader} uniforms={uniforms} depthWrite={false} toneMapped={false} />
      </mesh>
    );
  };

  return (
    <div style={{ width: '100vw', height: '100vh', background: '#0b1016' }}>
      <Canvas>
        <Suspense fallback={null}>
          <OrthographicCamera makeDefault position={[0, 15000, 0]} zoom={40} near={0.1} far={200000} />
          <StarfieldSky density={0.02} brightness={0.85} milkyWayStrength={0.2} orientation={[0.0, 0.25, 0.97]} fadeMin={0.2} fadeMax={0.9} />
          <Environment preset="night" />
          <Sun position={[sunX, sunY, sunZ]} size={200} color="#ffddaa" intensity={5.0} hdr={false} />
          <Station position={[50, 0, -120]} showLights={false} scale={40} modelPath={'/models/00001.obj'} rotationSpeed={-0.05} rotationAxis={'z'} />
          <Planet
            position={[positionX, positionY, positionZ]}
            size={size}
            color="#4466aa"
            hdr={false}
            sunPosition={[sunX, sunY, sunZ]}
            atmosphereParams={{
              radiusMul: rimMode === 'shrink' ? rimScale : radiusMul,
              rimPower,
              rayleigh,
              noiseScale,
              noiseAmp,
              sunMaskMin,
              sunMaskMax,
              innerColor,
              outerColor,
            }}
            atmosphereEnabled={rimMode !== 'hide'}
            cloudsParams={{ enabled: cloudsEnabled, opacity: cloudOpacity, alphaTest: cloudAlphaTest }}
          />
          {showGrid && (
            <Grid
              position={[0, 0, 0]}
              args={[10000, 10000]}
              cellSize={500}
              cellThickness={0.5}
              sectionSize={5000}
              sectionThickness={1}
              followCamera
              infiniteGrid
            />
          )}
          <FitCamera radius={size * radiusMul} center={[positionX, positionY, positionZ]} includePlanet={includePlanetInFit} recenterKey={fitReq} onApplied={() => setFitReq('none')} />
          <MapControls makeDefault enableRotate={false} minZoom={0.1} maxZoom={500} screenSpacePanning />
        </Suspense>
      </Canvas>

      <div style={{ position: 'absolute', top: 20, left: 20, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, background: 'rgba(12,22,32,0.8)', padding: 12, border: '1px solid #184b6a', borderRadius: 6, color: '#c3e7ff', fontFamily: 'monospace', maxWidth: 520 }}>
        <div>Planet Size</div>
        <input type="range" min={1000} max={20000} step={100} value={size} onChange={(e) => setSize(Number(e.target.value))} />
        <div>Position X</div>
        <input type="range" min={-20000} max={20000} step={50} value={positionX} onChange={(e) => setPositionX(Number(e.target.value))} />
        <div>Position Y</div>
        <input type="range" min={-20000} max={20000} step={50} value={positionY} onChange={(e) => setPositionY(Number(e.target.value))} />
        <div>Position Z</div>
        <input type="range" min={-20000} max={20000} step={50} value={positionZ} onChange={(e) => setPositionZ(Number(e.target.value))} />
        <div>Sun X</div>
        <input type="range" min={-20000} max={20000} step={50} value={sunX} onChange={(e) => setSunX(Number(e.target.value))} />
        <div>Sun Y</div>
        <input type="range" min={-20000} max={20000} step={50} value={sunY} onChange={(e) => setSunY(Number(e.target.value))} />
        <div>Sun Z</div>
        <input type="range" min={-20000} max={20000} step={50} value={sunZ} onChange={(e) => setSunZ(Number(e.target.value))} />
        <div>Atmos Radius</div>
        <input type="range" min={0.99} max={1.08} step={0.001} value={radiusMul} onChange={(e) => setRadiusMul(Number(e.target.value))} />
        <div>Rim Power</div>
        <input type="range" min={1.0} max={6.0} step={0.05} value={rimPower} onChange={(e) => setRimPower(Number(e.target.value))} />
        <div>Rayleigh</div>
        <input type="range" min={0.0} max={3.0} step={0.05} value={rayleigh} onChange={(e) => setRayleigh(Number(e.target.value))} />
        <div>Noise Scale</div>
        <input type="range" min={0.0} max={3.0} step={0.01} value={noiseScale} onChange={(e) => setNoiseScale(Number(e.target.value))} />
        <div>Noise Amp</div>
        <input type="range" min={0.0} max={1.0} step={0.01} value={noiseAmp} onChange={(e) => setNoiseAmp(Number(e.target.value))} />
        <div>SunMask Min</div>
        <input type="range" min={0.0} max={0.99} step={0.01} value={sunMaskMin} onChange={(e) => setSunMaskMin(Number(e.target.value))} />
        <div>SunMask Max</div>
        <input type="range" min={sunMaskMin} max={1.0} step={0.01} value={sunMaskMax} onChange={(e) => setSunMaskMax(Number(e.target.value))} />
        <div>Inner Color</div>
        <input type="color" value={innerColor} onChange={(e) => setInnerColor(e.target.value)} />
        <div>Outer Color</div>
        <input type="color" value={outerColor} onChange={(e) => setOuterColor(e.target.value)} />
        <label style={{ gridColumn: '1 / span 2', display: 'flex', alignItems: 'center', gap: 8 }}>
          <input type="checkbox" checked={cloudsEnabled} onChange={(e) => setCloudsEnabled(e.target.checked)} />
          Clouds Enabled
        </label>
        <label style={{ gridColumn: '1 / span 2', display: 'flex', alignItems: 'center', gap: 8 }}>
          <input type="checkbox" checked={showGrid} onChange={(e) => setShowGrid(e.target.checked)} />
          Show Grid
        </label>
        <label style={{ gridColumn: '1 / span 2', display: 'flex', alignItems: 'center', gap: 8 }}>
          <input type="checkbox" checked={includePlanetInFit} onChange={(e) => setIncludePlanetInFit(e.target.checked)} />
          Include Planet in Fit
        </label>
        <div style={{ gridColumn: '1 / span 2', display: 'flex', gap: 8 }}>
          <button onClick={() => { setFitReq('stations'); }} style={{ padding: '6px 10px', border: '1px solid #3fb6ff', background: '#0f2230', color: '#c3e7ff' }}>Fit Stations</button>
          <button onClick={() => { setFitReq('planet'); }} style={{ padding: '6px 10px', border: '1px solid #3fb6ff', background: '#0f2230', color: '#c3e7ff' }}>Fit Planet</button>
        </div>
        <div style={{ gridColumn: '1 / span 2', display: 'flex', gap: 8 }}>
          <button onClick={saveConfig} style={{ padding: '6px 10px', border: '1px solid #4ad07d', background: '#0f2230', color: '#c3ffde' }}>Save Sector Config</button>
          <button onClick={resetToSceneDefaults} style={{ padding: '6px 10px', border: '1px solid #bca14a', background: '#0f2230', color: '#ffeebf' }}>Reset to Scene Defaults</button>
        </div>
        <div>Atmos Rim Mode</div>
        <select value={rimMode} onChange={(e) => setRimMode(e.target.value as 'normal' | 'hide' | 'shrink')}>
          <option value="normal">Normal</option>
          <option value="hide">Hide</option>
          <option value="shrink">Shrink</option>
        </select>
        {rimMode === 'shrink' && <>
          <div>Rim Scale</div>
          <input type="range" min={1.0} max={1.06} step={0.001} value={rimScale} onChange={(e) => setRimScale(Number(e.target.value))} />
        </>}
        <div>Cloud Opacity</div>
        <input type="range" min={0.0} max={1.0} step={0.01} value={cloudOpacity} onChange={(e) => setCloudOpacity(Number(e.target.value))} />
        <div>Cloud AlphaTest</div>
        <input type="range" min={0.0} max={1.0} step={0.01} value={cloudAlphaTest} onChange={(e) => setCloudAlphaTest(Number(e.target.value))} />
      </div>
    </div>
  );
};

