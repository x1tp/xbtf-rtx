import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Environment } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { useGameStore, type GameState } from './store/gameStore';
import { useShallow } from 'zustand/react/shallow';
import type { NPCFleet } from './types/simulation';
import { Ship } from './components/Ship';
import { AIShip } from './components/AIShip';
import { NPCTrader } from './components/NPCTrader';
import { Planet } from './components/Planet';
import { Station } from './components/Station';
import { Gate } from './components/Gate';
import { Sun } from './components/Sun';
import { Dust } from './components/Dust';
import { NavigationIndicator } from './components/NavigationIndicator';
import { StarfieldSky } from './components/StarfieldSky';
import { InstancedMesh, TextureLoader, SRGBColorSpace, LinearSRGBColorSpace, RepeatWrapping, LinearMipmapLinearFilter, LinearFilter } from 'three';
import * as THREE from 'three';
import { ensureRapier, getWorld, getWorldSync } from './physics/RapierWorld';
import type RAPIERType from '@dimforge/rapier3d-compat';

interface SceneProps { hdr?: boolean }
import { DEFAULT_SECTOR_CONFIG, type SectorConfig, getSectorLayoutById } from './config/sector';
import { PLANET_DATABASE } from './config/planetDatabase';
import { useAiNavigation } from './ai/useAiNavigation';
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
    const currentSectorId = useGameStore((s: GameState) => s.currentSectorId);
    // Use useShallow to prevent re-renders when fleets array reference changes but content is same
    const fleets = useGameStore(useShallow((s: GameState) => s.fleets));
    const economyStations = useGameStore(useShallow((s: GameState) => s.stations));
    const reportShipAction = useGameStore((s: GameState) => s.reportShipAction);
    const layout = useMemo(() => getSectorLayoutById(currentSectorId || 'seizewell'), [currentSectorId]);
    const background = layout?.background || cfg.background;
    const spacing = 30; // spread layout objects apart to avoid overlaps
    const place = (p: [number, number, number]): [number, number, number] => [p[0] * spacing, p[1] * spacing, p[2] * spacing];
    
    // Filter NPC fleets to current sector
    // Include in-transit fleets that are departing FROM this sector (so we see them fly to the gate)
    const sectorFleets = useMemo(() => {
        const result = fleets.filter((f: NPCFleet) => {
            // Show fleets that are in this sector (not in-transit)
            if (f.currentSectorId === currentSectorId && f.state !== 'in-transit') {
                return true;
            }
            // Also show in-transit fleets that are departing FROM this sector
            if (f.state === 'in-transit' && f.currentSectorId === currentSectorId) {
                return true;
            }
            return false;
        });
        if (fleets.length > 0 || result.length > 0) {
            console.log(`[Scene] Fleets: ${fleets.length} total, ${result.length} in ${currentSectorId}`);
        }
        return result;
    }, [fleets, currentSectorId]);
    
    // Build station position map for NPC traders
    // Maps economy station IDs to layout station positions by matching names
    const stationPositions = useMemo(() => {
        const map = new Map<string, [number, number, number]>();
        if (layout) {
            // First, map layout stations by their exact names
            const layoutByName = new Map<string, [number, number, number]>();
            for (const st of layout.stations) {
                layoutByName.set(st.name, place(st.position));
            }
            
            // Then map economy station IDs to positions by matching names
            for (const econStation of economyStations) {
                const layoutPos = layoutByName.get(econStation.name);
                if (layoutPos) {
                    // Map by ID (e.g., 'sz_spp_b')
                    map.set(econStation.id, layoutPos);
                    // Also map by name for fallback
                    map.set(econStation.name, layoutPos);
                }
            }
            
            // Also add layout stations by name directly (for stations not in economy)
            for (const st of layout.stations) {
                if (!map.has(st.name)) {
                    map.set(st.name, place(st.position));
                }
            }
        }
        return map;
    }, [layout, economyStations]);
    
    // Build gate positions for NPC trader navigation
    const gatePositions = useMemo(() => {
        if (!layout) return [];
        return layout.gates
            .filter(g => g.destinationSectorId)
            .map(g => ({
                position: place(g.position) as [number, number, number],
                destinationSectorId: g.destinationSectorId!,
                radius: (g.scale ?? 40) * 5
            }));
    }, [layout]);
    
    const placedShips = React.useMemo(
        () => layout ? layout.ships.map((s) => ({ ...s, placedPosition: place(s.position) })) : [],
        [layout]
    );
    const arrivalGate = useGameStore((s: GameState) => s.arrivalGate);
    const initialShipPos = useMemo<[number, number, number]>(() => {
        if (arrivalGate && layout) {
            const gate = layout.gates.find(g => g.gateType === arrivalGate);
            if (gate) {
                const p = place(gate.position);
                // Gate trigger radius is approx 5 * scale. We need to spawn safely outside.
                // For scale 300, radius is 1500. Let's start at 2500 (scale * 8 + margin).
                const safeDist = (gate.scale ?? 40) * 8 + 300;
                // Offset towards center (0,0,0)
                const toCenter = new THREE.Vector3(-p[0], 0, -p[2]).normalize();

                // If the gate is at 0,0,0 (e.g. invalid config), fallback.
                if (toCenter.lengthSq() < 0.001) toCenter.set(0, 0, 1);

                return [p[0] + toCenter.x * safeDist, p[1], p[2] + toCenter.z * safeDist] as [number, number, number];
            }
        }
        return layout ? place(layout.playerStart || [0, 10, 450]) : [0, 10, 450];
    }, [layout, arrivalGate]);

    const [shipPos, setShipPos] = useState<[number, number, number]>(initialShipPos);
    const navData = useAiNavigation(layout, spacing);
    useEffect(() => {
        setShipPos(initialShipPos);
    }, [initialShipPos]);
    const sunPosition: [number, number, number] = layout ? layout.sun.position : cfg.sun.position;
    return (
        <>
            <color attach="background" args={['#000005']} />

            {/* Environment */}
            <StarfieldSky sunPosition={sunPosition} density={0.02} brightness={0.7} milkyWayStrength={0.2} orientation={[0.0, 0.25, 0.97]} radius={2000000} fadeMin={0.2} fadeMax={0.9} viewFadeMin={0.6} viewFadeMax={0.85} texturePath={background?.texturePath} />
            <Environment preset="night" />
            {!hdr && <ambientLight intensity={0.05} />}
            {!hdr && <hemisphereLight args={['#445577', '#050505', 0.2]} />}
            <Sun position={sunPosition} size={layout ? layout.sun.size : cfg.sun.size} color={layout ? layout.sun.color : cfg.sun.color} intensity={layout ? layout.sun.intensity : cfg.sun.intensity} hdr={hdr} />

            {/* Player */}
            <Ship enableLights={!hdr} position={shipPos} />

            {/* Environment Objects */}
            <Planet
                position={layout ? layout.planet.position : cfg.planet.position}
                size={(() => { const id = currentSectorId || 'seizewell'; const p = PLANET_DATABASE[id]; const base = (layout ? layout.planet.size : cfg.planet.size); return p && typeof p.size === 'number' ? p.size : base; })()}
                color="#4466aa"
                hdr={hdr}
                sunPosition={sunPosition}

                cloudsParams={(() => {
                    const id = currentSectorId || 'seizewell';
                    const p = PLANET_DATABASE[id];
                    return p ? { enabled: true, opacity: p.cloudOpacity, alphaTest: 0.0 } : { enabled: true, opacity: 0.8, alphaTest: 0.0 };
                })()}
                config={(() => {
                    const id = currentSectorId || 'seizewell';
                    return PLANET_DATABASE[id];
                })()}
            />
            {layout
                ? (
                    <>
                        {layout.stations.map((st) => (
                            <Station
                                key={st.name}
                                position={place(st.position)}
                                showLights={!hdr}
                                rotate
                                scale={st.scale ?? 30}
                                modelPath={st.modelPath}
                                rotationSpeed={st.rotationSpeed ?? 0.04}
                                rotationAxis={st.rotationAxis ?? 'y'}
                                collisions={st.collisions ?? true}
                                objectName={st.name}
                                navRadius={(st.scale ?? 30) * 1.25}
                            />
                        ))}
                        {layout.gates.map((g) => (
                            <Gate
                                key={g.name}
                                position={place(g.position)}
                                modelPath={g.modelPath}
                                rotation={g.rotation}
                                destinationSectorId={g.destinationSectorId}
                                gateType={g.gateType}
                                objectName={g.name}
                                scale={g.scale}
                            />
                        ))}
                        {
                            placedShips.map((s) => (
                                <AIShip
                                    key={s.name}
                                    name={s.name}
                                    modelPath={s.modelPath}
                                    position={s.placedPosition}
                                    navGraph={navData.graph}
                                    obstacles={navData.obstacles}
                                    size={s.scale ?? 24}
                                />
                            ))
                        }
                        {/* NPC Trader Fleets */}
                        <Suspense fallback={null}>
                            {sectorFleets.map((fleet: NPCFleet) => (
                                <NPCTrader
                                    key={fleet.id}
                                    fleet={fleet}
                                    stationPositions={stationPositions}
                                    gatePositions={gatePositions}
                                    navGraph={navData.graph}
                                    obstacles={navData.obstacles}
                                    onReport={reportShipAction}
                                />
                            ))}
                        </Suspense>
                    </>
                )
                : (
                    <Station position={cfg.station.position} showLights={!hdr} scale={cfg.station.scale} modelPath={cfg.station.modelPath} rotationSpeed={cfg.station.rotationSpeed} rotationAxis={cfg.station.rotationAxis} />
                )}
            <Asteroids count={layout ? layout.asteroids.count : cfg.asteroids.count} range={layout ? layout.asteroids.range * spacing : cfg.asteroids.range} center={layout ? place(layout.asteroids.center) : cfg.asteroids.center} />
            <Dust count={5000} range={layout ? layout.asteroids.range * spacing : cfg.asteroids.range} center={layout ? place(layout.asteroids.center) : cfg.asteroids.center} color="#aaccff" size={0.8} opacity={0.15} />

            {/* Navigation indicator for selected target */}
            <NavigationIndicator />

        </>
    );
};

interface AsteroidsProps { count: number; range: number; center: [number, number, number] }
const Asteroids: React.FC<AsteroidsProps> = ({ count, range, center }) => {
    const meshRef = useRef<InstancedMesh>(null);
    const positionsRef = useRef<THREE.Vector3[]>([]);
    const velocitiesRef = useRef<THREE.Vector3[]>([]);
    const scalesRef = useRef<number[]>([]);
    const bodiesRef = useRef<RAPIERType.RigidBody[]>([]);
    const { gl } = useThree();
    const maxAniso = useMemo(() => gl.capabilities?.getMaxAnisotropy?.() ?? 4, [gl]);
    type AsteroidUserData = { positions: THREE.Vector3[]; velocities: THREE.Vector3[]; scales: number[] };
    const mobileThreshold = 0.0; // Disable dynamic physics for asteroids to keep perf sane in large sectors

    const [particles] = useState(() => {
        const temp: { position: [number, number, number]; scale: number }[] = [];
        const desiredLarge = Math.max(3, Math.floor(count * 0.08));
        const largeCount = Math.min(count, desiredLarge);
        const largeIndices = new Set<number>();
        while (largeIndices.size < largeCount) {
            largeIndices.add(Math.floor(Math.random() * count));
        }
        for (let i = 0; i < count; i++) {
            const x = (Math.random() - 0.5) * range + center[0];
            const y = (Math.random() - 0.5) * range + center[1];
            const z = (Math.random() - 0.5) * range + center[2];
            const isLarge = largeIndices.has(i);
            const scale = isLarge ? 12 + Math.random() * 10 : 0.8 + Math.random() * 4.2;
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
            const aniso = Math.max(1, maxAniso || 1);
            const setupTexture = (t: THREE.Texture | null, isColor: boolean) => {
                if (!t) return;
                t.colorSpace = isColor ? SRGBColorSpace : LinearSRGBColorSpace;
                t.wrapS = RepeatWrapping;
                t.wrapT = RepeatWrapping;
                t.anisotropy = aniso;
                t.generateMipmaps = true;
                t.minFilter = LinearMipmapLinearFilter;
                t.magFilter = LinearFilter;
                t.needsUpdate = true;
            };
            if (map) { setupTexture(map as THREE.Texture, true); matRef.current.map = map as THREE.Texture; }
            if (rough) { setupTexture(rough as THREE.Texture, false); matRef.current.roughnessMap = rough as THREE.Texture; }
            if (metal) { setupTexture(metal as THREE.Texture, false); matRef.current.metalnessMap = metal as THREE.Texture; }
            if (normal) { setupTexture(normal as THREE.Texture, false); matRef.current.normalMap = normal as THREE.Texture; }
            matRef.current.roughness = 0.9;
            matRef.current.metalness = 0.02;
            matRef.current.needsUpdate = true;
        });
    }, [maxAniso]);

    return (
        <instancedMesh ref={meshRef} name="AsteroidField" args={[undefined, undefined, count]} castShadow receiveShadow>
            <dodecahedronGeometry args={[1, 0]} />
            <meshStandardMaterial ref={matRef} color="#554433" roughness={0.9} />
        </instancedMesh>
    );
};
