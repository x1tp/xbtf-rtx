import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { TextureLoader, SRGBColorSpace, LinearFilter, BackSide } from 'three';
import * as THREE from 'three';
import { useGameStore, type GameState } from '../store/gameStore';

interface StarfieldSkyProps {
  sunPosition: [number, number, number];
  density?: number;
  brightness?: number;
  milkyWayStrength?: number;
  orientation?: [number, number, number];
  radius?: number;
  fadeMin?: number;
  fadeMax?: number;
  viewFadeMin?: number;
  viewFadeMax?: number;
  texturePath?: string;
}

export const StarfieldSky: React.FC<StarfieldSkyProps> = ({
  sunPosition,
  density = 0.15,
  brightness = 0.5,
  milkyWayStrength = 0.22,
  orientation = [0.0, 0.25, 0.97],
  radius = 2000000,
  fadeMin = 0.2,
  fadeMax = 0.95,
  viewFadeMin = 0.6,
  viewFadeMax = 0.85,
  texturePath
}) => {
  const matRef = useRef<THREE.ShaderMaterial | null>(null);
  const skyRef = useRef<THREE.Mesh | null>(null);
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
    uViewAdapt: { value: 0 },
    uTexture: { value: null as THREE.Texture | null },
    uHasTexture: { value: 0 }
  }), [density, brightness, milkyWayStrength, orientation, fadeMin, fadeMax, viewFadeMin, viewFadeMax]);

  useEffect(() => {
    if (!texturePath) {
      if (matRef.current) {
        matRef.current.uniforms.uTexture.value = null;
        matRef.current.uniforms.uHasTexture.value = 0;
      }
      return;
    }
    new TextureLoader().loadAsync(texturePath).then((t) => {
      t.colorSpace = SRGBColorSpace;
      t.minFilter = LinearFilter;
      t.magFilter = LinearFilter;
      t.wrapS = THREE.RepeatWrapping;
      t.wrapT = THREE.ClampToEdgeWrapping;
      if (matRef.current) {
        matRef.current.uniforms.uTexture.value = t;
        matRef.current.uniforms.uHasTexture.value = 1;
      }
    });
  }, [texturePath]);

  const adaptRef = useRef(0);
  const visibleSmoothRef = useRef(0);
  const prevVisibleRef = useRef(true);
  const holdRef = useRef(0);
  const timeScale = useGameStore((state: GameState) => state.timeScale);

  useFrame((state, rawDelta) => {
    const delta = rawDelta * timeScale;
    const m = matRef.current;
    if (!m) return;
    const u = m.uniforms as unknown as { uTime: { value: number }; uSunDir: { value: THREE.Vector3 }; uCamSunDot: { value: number }; uSunVisible: { value: number } };
    u.uTime.value += delta;
    const cam = state.camera;
    const camPos = new THREE.Vector3();
    cam.getWorldPosition(camPos);
    const sun = new THREE.Vector3(sunPosition[0], sunPosition[1], sunPosition[2]);
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
    const sh = scene.getObjectByName('PlayerShip'); if (sh) occluders.push(sh);
    const a = scene.getObjectByName('AsteroidField'); if (a) occluders.push(a);
    const hits = ray.intersectObjects(occluders, true);
    const visible = hits.length === 0;
    if (!visible && prevVisibleRef.current && d >= viewFadeMin) {
      holdRef.current = Math.max(holdRef.current, 0.35);
    }
    if (holdRef.current > 0) {
      holdRef.current = Math.max(0, holdRef.current - delta);
    }
    const visTarget = holdRef.current > 0 ? 1 : (visible ? 1 : 0);
    const vs = visibleSmoothRef.current;
    const kv = visTarget > vs ? 8.0 : 1.8;
    const tv = 1 - Math.exp(-kv * delta);
    visibleSmoothRef.current = vs + (visTarget - vs) * tv;
    u.uSunVisible.value = visibleSmoothRef.current;
    useGameStore.getState().setSunVisible(visible && d >= viewFadeMin);
    const facing = Math.max(0, Math.min(1, (d - viewFadeMin) / Math.max(0.0001, (viewFadeMax - viewFadeMin))));
    const target = facing * visibleSmoothRef.current;
    const k = 2.6;
    const t = 1 - Math.exp(-k * delta);
    adaptRef.current = adaptRef.current + (target - adaptRef.current) * t;
    useGameStore.getState().setSunAdapt(adaptRef.current);
    useGameStore.getState().setSunIntensity(target);
    (m.uniforms as unknown as { uViewAdapt: { value: number } }).uViewAdapt.value = adaptRef.current;
    prevVisibleRef.current = visible;
    const sky = skyRef.current;
    if (sky) {
      sky.position.copy(camPos);
    }
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
    uniform sampler2D uTexture;
    uniform float uHasTexture;
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
      // Fade stars when looking toward the sun to mimic camera contrast washout
      float glare = smoothstep(uViewFadeMin, uViewFadeMax, uCamSunDot) * uSunVisible;
      float viewFade = mix(1.0, 0.25, glare * 0.7);
      
      vec3 baseCol = (vec3(s * uBrightness) + vec3(m * uMilkyWayStrength));
      if (uHasTexture > 0.5) {
        vec2 texUV = vec2(atan(nd.z, nd.x), asin(nd.y));
        texUV *= vec2(0.1591, 0.3183);
        texUV += 0.5;
        vec3 texCol = texture2D(uTexture, texUV).rgb;
        // Blend texture with stars (maybe reduce stars intensity)
        baseCol = texCol + vec3(s * uBrightness * 0.3);
      }
      
      vec3 col = baseCol * viewFade;
      gl_FragColor = vec4(col, 1.0);
    }
  `;

  return (
    <mesh ref={skyRef} name="StarfieldSky" scale={[1, 1, 1]} frustumCulled={false}>
      <sphereGeometry args={[radius, 64, 64]} />
      <shaderMaterial 
        ref={matRef} 
        side={BackSide} 
        vertexShader={vertexShader} 
        fragmentShader={fragmentShader} 
        uniforms={uniforms} 
        depthWrite={false} 
        toneMapped={false} 
      />
    </mesh>
  );
};

export default StarfieldSky;
