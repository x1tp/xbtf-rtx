import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Environment } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { useGameStore } from './store/gameStore';
import { Ship } from './components/Ship';
import { Planet } from './components/Planet';
import { Station } from './components/Station';
import { Sun } from './components/Sun';
import { InstancedMesh, TextureLoader, SRGBColorSpace, LinearSRGBColorSpace, RepeatWrapping, BackSide } from 'three';
import * as THREE from 'three';
import { ensureRapier, getWorld, getWorldSync } from './physics/RapierWorld';
import type RAPIERType from '@dimforge/rapier3d-compat';

interface SceneProps { hdr?: boolean }
import { DEFAULT_SECTOR_CONFIG, type SectorConfig } from './config/sector';
export const Scene: React.FC<SceneProps> = ({ hdr = false }) => {
    const cfg: SectorConfig = React.useMemo(() => {
        const raw = typeof window !== 'undefined' ? window.localStorage.getItem('sector:config') : null;
        if (!raw) return DEFAULT_SECTOR_CONFIG;
        try {
            const parsed = JSON.parse(raw) as Partial<SectorConfig>;
            return {
                sun: parsed.sun ? { ...DEFAULT_SECTOR_CONFIG.sun, ...parsed.sun } : DEFAULT_SECTOR_CONFIG.sun,
                planet: parsed.planet ? { ...DEFAULT_SECTOR_CONFIG.planet, ...parsed.planet } : DEFAULT_SECTOR_CONFIG.planet,
                station: parsed.station ? { ...DEFAULT_SECTOR_CONFIG.station, ...parsed.station } : DEFAULT_SECTOR_CONFIG.station,
                asteroids: parsed.asteroids ? { ...DEFAULT_SECTOR_CONFIG.asteroids, ...parsed.asteroids } : DEFAULT_SECTOR_CONFIG.asteroids
            };
        } catch {
            return DEFAULT_SECTOR_CONFIG;
        }
    }, []);
    const sunPosition: [number, number, number] = cfg.sun.position;
    const StarfieldSky: React.FC<{ density?: number; brightness?: number; milkyWayStrength?: number; orientation?: [number, number, number]; radius?: number; fadeMin?: number; fadeMax?: number; viewFadeMin?: number; viewFadeMax?: number }> = ({ density = 0.15, brightness = 0.5, milkyWayStrength = 0.22, orientation = [0.0, 0.25, 0.97], radius = 18000, fadeMin = 0.2, fadeMax = 0.95, viewFadeMin = 0.6, viewFadeMax = 0.85 }) => {
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
            u.uSunVisible.value = visible ? 1 : 0;
            useGameStore.getState().setSunVisible(visible && d >= viewFadeMin);
            const target = visible ? Math.max(0, Math.min(1, (d - viewFadeMin) / Math.max(0.0001, (viewFadeMax - viewFadeMin)))) : 0;
            // Slower adaptation to let the user "see more" for longer before it darkens
            const k = 0.5;
            const t = 1 - Math.exp(-k * delta);
            adaptRef.current = adaptRef.current + (target - adaptRef.current) * t;
            useGameStore.getState().setSunAdapt(adaptRef.current);
            useGameStore.getState().setSunIntensity(target);
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
                <sphereGeometry args={[radius, 64, 64]} />
                <shaderMaterial ref={matRef} side={BackSide} vertexShader={vertexShader} fragmentShader={fragmentShader} uniforms={uniforms} depthWrite={false} toneMapped={false} />
            </mesh>
        );
    };
    return (
        <>
            <color attach="background" args={['#000005']} />

            {/* Environment */}
            <StarfieldSky density={0.02} brightness={0.7} milkyWayStrength={0.2} orientation={[0.0, 0.25, 0.97]} radius={18000} fadeMin={0.2} fadeMax={0.9} viewFadeMin={0.6} viewFadeMax={0.85} />
            <Environment preset="night" />
            {!hdr && <ambientLight intensity={0.05} />}
            <Sun position={sunPosition} size={cfg.sun.size} color={cfg.sun.color} intensity={cfg.sun.intensity} hdr={hdr} />

            {/* Player */}
            <Ship enableLights={!hdr} position={[0, 10, 450]} />

            {/* Environment Objects */}
            <Planet position={cfg.planet.position} size={cfg.planet.size} color="#4466aa" hdr={hdr} sunPosition={sunPosition} />
            <Station position={cfg.station.position} showLights={!hdr} scale={cfg.station.scale} modelPath={cfg.station.modelPath} rotationSpeed={cfg.station.rotationSpeed} rotationAxis={cfg.station.rotationAxis} />
            <Asteroids count={cfg.asteroids.count} range={cfg.asteroids.range} />


        </>
    );
};

interface AsteroidsProps { count: number; range: number }
const Asteroids: React.FC<AsteroidsProps> = ({ count, range }) => {
    const meshRef = useRef<InstancedMesh>(null);
    const positionsRef = useRef<THREE.Vector3[]>([]);
    const velocitiesRef = useRef<THREE.Vector3[]>([]);
    const scalesRef = useRef<number[]>([]);
    const bodiesRef = useRef<RAPIERType.RigidBody[]>([]);
    type AsteroidUserData = { positions: THREE.Vector3[]; velocities: THREE.Vector3[]; scales: number[] };
    const mobileThreshold = 10.0;

    const [particles] = useState(() => {
        const temp: { position: [number, number, number]; scale: number }[] = [];
        for (let i = 0; i < count; i++) {
            const x = (Math.random() - 0.5) * range;
            const y = (Math.random() - 0.5) * range;
            const z = (Math.random() - 0.5) * range;
            const scale = 0.8 + Math.random() * 4.2;
            temp.push({ position: [x, y, z], scale });
        }
        return temp;
    });

    useEffect(() => {
        let cancelled = false;
        if (!meshRef.current) return;
        positionsRef.current = particles.map((p) => new THREE.Vector3(p.position[0], p.position[1], p.position[2]));
        velocitiesRef.current = new Array(particles.length).fill(0).map(() => new THREE.Vector3());
        scalesRef.current = particles.map((p) => p.scale);
        const dummy = new THREE.Object3D();
        for (let i = 0; i < particles.length; i++) {
            const pos = positionsRef.current[i];
            const s = scalesRef.current[i];
            dummy.position.copy(pos);
            dummy.scale.set(s, s, s);
            dummy.rotation.set(0, 0, 0);
            dummy.updateMatrix();
            meshRef.current!.setMatrixAt(i, dummy.matrix);
        }
        meshRef.current.instanceMatrix.needsUpdate = true;
        meshRef.current.frustumCulled = false;
        const ud = meshRef.current.userData as AsteroidUserData;
        ud.positions = positionsRef.current;
        ud.velocities = velocitiesRef.current;
        ud.scales = scalesRef.current;

        (async () => {
            const RAPIER = await ensureRapier();
            if (cancelled) return;
            const world = await getWorld();
            if (cancelled) return;
            const bodies: RAPIERType.RigidBody[] = [];
            const randVec = (scale: number) => ({
                x: (Math.random() - 0.5) * 3.2 * scale,
                y: (Math.random() - 0.5) * 1.2 * scale,
                z: (Math.random() - 0.5) * 3.2 * scale
            });
            for (let i = 0; i < positionsRef.current.length; i++) {
                if (cancelled) break;
                const pos = positionsRef.current[i];
                const s = scalesRef.current[i];
                const isMobile = s <= mobileThreshold;
                const rbDesc = isMobile
                    ? RAPIER.RigidBodyDesc.dynamic()
                        .setTranslation(pos.x, pos.y, pos.z)
                        .setLinearDamping(0.0)
                        .setAngularDamping(0.005)
                        .setCcdEnabled(true)
                        .setCanSleep(false)
                    : RAPIER.RigidBodyDesc.fixed()
                        .setTranslation(pos.x, pos.y, pos.z);
                const body = world.createRigidBody(rbDesc);
                const collDesc = RAPIER.ColliderDesc.ball(s)
                    .setRestitution(isMobile ? 0.4 : 0.0)
                    .setFriction(isMobile ? 0.35 : 0.8);
                if (isMobile && 'setDensity' in collDesc) {
                    (collDesc as unknown as { setDensity: (d: number) => unknown }).setDensity(0.1);
                }
                world.createCollider(collDesc, body);
                if (isMobile && 'setAngvel' in body) {
                    (body as unknown as { setAngvel: (v: { x: number; y: number; z: number }, wake: boolean) => void })
                        .setAngvel({ x: (Math.random() - 0.5) * 0.1, y: (Math.random() - 0.5) * 0.1, z: (Math.random() - 0.5) * 0.1 }, true);
                }
                if (isMobile && 'setLinvel' in body) {
                    (body as unknown as { setLinvel: (v: { x: number; y: number; z: number }, wake: boolean) => void })
                        .setLinvel(randVec(1.0), true);
                }
                bodies.push(body);
            }
            if (cancelled) {
                bodies.forEach(b => world.removeRigidBody(b));
                return;
            }
            bodiesRef.current = bodies;
            console.log('Asteroids created:', bodies.length, 'bodies in world:', world.bodies.len());
        })();

        return () => {
            cancelled = true;
            if (bodiesRef.current.length > 0) {
                const w = getWorldSync();
                if (w) {
                    bodiesRef.current.forEach(b => w.removeRigidBody(b));
                }
                bodiesRef.current = [];
            }
        };
    }, [particles]);

    useFrame(() => {
        const mesh = meshRef.current;
        if (!mesh) return;
        const dummy = new THREE.Object3D();
        const bodies = bodiesRef.current || [];
        for (let i = 0; i < bodies.length; i++) {
            const body = bodies[i];
            const t = body.translation();
            const r = body.rotation();
            positionsRef.current[i].set(t.x, t.y, t.z);
            const s = scalesRef.current[i];
            dummy.position.set(t.x, t.y, t.z);
            dummy.scale.set(s, s, s);
            dummy.quaternion.set(r.x, r.y, r.z, r.w);
            dummy.updateMatrix();
            mesh.setMatrixAt(i, dummy.matrix);
            if (s <= mobileThreshold) {
                const lv = body.linvel();
                const speed = Math.hypot(lv.x, lv.y, lv.z);
                if (speed < 0.6 && 'setLinvel' in body) {
                    (body as unknown as { setLinvel: (v: { x: number; y: number; z: number }, wake: boolean) => void })
                        .setLinvel({ x: (Math.random() - 0.5) * 2.5, y: (Math.random() - 0.5) * 0.8, z: (Math.random() - 0.5) * 2.5 }, true);
                }
            }
        }
        mesh.instanceMatrix.needsUpdate = true;
    });

    const matRef = useRef<THREE.MeshStandardMaterial | null>(null);
    useEffect(() => {
        const loader = new TextureLoader();
        const paths = [
            '/materials/asteroid/baseColor.png',
            '/materials/asteroid/roughness.png',
            '/materials/asteroid/metallic.png',
            '/materials/asteroid/normal.png'
        ];
        Promise.all(paths.map((p) => loader.loadAsync(p).catch(() => null))).then(([map, rough, metal, normal]) => {
            if (!matRef.current) return;
            const aniso = 4;
            if (map) { map.colorSpace = SRGBColorSpace; map.wrapS = RepeatWrapping; map.wrapT = RepeatWrapping; map.anisotropy = aniso; matRef.current.map = map as THREE.Texture; }
            if (rough) { rough.colorSpace = LinearSRGBColorSpace; rough.wrapS = RepeatWrapping; rough.wrapT = RepeatWrapping; rough.anisotropy = aniso; matRef.current.roughnessMap = rough as THREE.Texture; }
            if (metal) { metal.colorSpace = LinearSRGBColorSpace; metal.wrapS = RepeatWrapping; metal.wrapT = RepeatWrapping; metal.anisotropy = aniso; matRef.current.metalnessMap = metal as THREE.Texture; }
            if (normal) { normal.colorSpace = LinearSRGBColorSpace; normal.wrapS = RepeatWrapping; normal.wrapT = RepeatWrapping; normal.anisotropy = aniso; matRef.current.normalMap = normal as THREE.Texture; }
            matRef.current.roughness = 0.9;
            matRef.current.metalness = 0.02;
            matRef.current.needsUpdate = true;
        });
    }, []);

    return (
        <instancedMesh ref={meshRef} name="AsteroidField" args={[undefined, undefined, count]} castShadow receiveShadow>
            <dodecahedronGeometry args={[1, 0]} />
            <meshStandardMaterial ref={matRef} color="#554433" roughness={0.9} />
        </instancedMesh>
    );
};
