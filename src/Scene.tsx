import React, { Suspense, useEffect, useMemo, useState } from 'react';
import { Environment } from '@react-three/drei';
import { useGameStore, type GameState } from './store/gameStore';
import { useShallow } from 'zustand/react/shallow';
import type { NPCFleet } from './types/simulation';
import { Ship } from './components/Ship';
import { AIShip } from './components/AIShip';
import { VisualFleet } from './components/VisualFleet';

import { Planet } from './components/Planet';
import { Station } from './components/Station';
import { Gate } from './components/Gate';
import { Sun } from './components/Sun';
import { Dust } from './components/Dust';
import { NavigationIndicator } from './components/NavigationIndicator';
import { StarfieldSky } from './components/StarfieldSky';

import * as THREE from 'three';

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
                station: parsed.station ? { ...DEFAULT_SECTOR_CONFIG.station, ...parsed.station } : DEFAULT_SECTOR_CONFIG.station
            };
        } catch {
            return DEFAULT_SECTOR_CONFIG;
        }
    }, []);
    const currentSectorId = useGameStore((s: GameState) => s.currentSectorId);
    // Use useShallow to prevent re-renders when fleets array reference changes but content is same
    const fleets = useGameStore(useShallow((s: GameState) => s.fleets));
    const economyStations = useGameStore(useShallow((s: GameState) => s.stations));
    const layout = useMemo(() => getSectorLayoutById(currentSectorId || 'seizewell'), [currentSectorId]);
    const background = layout?.background || cfg.background;

    useEffect(() => {
        // console.log(`[Scene] Loaded layout for ${currentSectorId}:`, layout);
        // console.log(`[Scene] Background config:`, background);
        if (background?.texturePath) {
            // console.log(`[Scene] Using skybox texture: ${background.texturePath}`);
        }
    }, [layout, background, currentSectorId]);

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
            // console.log(`[Scene] Fleets: ${fleets.length} total, ${result.length} in ${currentSectorId}`);
        }
        return result;
    }, [fleets, currentSectorId]);

    // Build station position map for NPC traders
    // Maps economy station IDs to layout station positions by matching names


    // Build gate positions for NPC trader navigation


    // Merge static and dynamic stations for rendering
    const stationsToRender = useMemo(() => {
        if (!layout) return [];
        const list = layout.stations.map(st => ({
            ...st,
            renderPosition: place(st.position),
        }));

        const layoutNames = new Set(layout.stations.map(s => s.name));

        economyStations.forEach(st => {
            if (st.sectorId === currentSectorId && st.position && !layoutNames.has(st.name)) {
                list.push({
                    name: st.name,
                    position: [0, 0, 0], // Unused in renderPosition logic below
                    renderPosition: st.position,
                    modelPath: st.modelPath,
                    scale: 30, // Default scale for dynamic stations
                    rotationSpeed: 0.02,
                    rotationAxis: 'y',
                    collisions: true,
                });
            }
        });
        return list;
    }, [layout, economyStations, currentSectorId]); // place depends on constant spacing

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
            <StarfieldSky
                sunPosition={sunPosition}
                density={0.02}
                brightness={0.7}
                milkyWayStrength={0.2}
                orientation={[0.0, 0.25, 0.97]}
                radius={2000000}
                fadeMin={0.2}
                fadeMax={0.9}
                viewFadeMin={0.6}
                viewFadeMax={0.85}
                texturePath={background?.texturePath}
            />
            <Environment preset="night" />
            {!hdr && <ambientLight intensity={layout?.ambientLight?.intensity ?? 0.05} color={layout?.ambientLight?.color} />}
            {!hdr && <hemisphereLight args={['#445577', '#050505', 0.2]} />}
            <Sun position={sunPosition} size={layout ? layout.sun.size : cfg.sun.size} color={layout ? layout.sun.color : cfg.sun.color} intensity={layout ? layout.sun.intensity : cfg.sun.intensity} hdr={hdr} />

            {/* Player */}
            <Ship enableLights={!hdr} position={shipPos} />

            {/* Environment Objects */}
            <Planet
                position={layout ? layout.planet.position : cfg.planet.position}
                size={(() => {
                    if (layout?.planet.config?.size) return layout.planet.config.size;
                    const id = currentSectorId || 'seizewell';
                    const p = PLANET_DATABASE[id];
                    const base = (layout ? layout.planet.size : cfg.planet.size);
                    return p && typeof p.size === 'number' ? p.size : base;
                })()}
                color="#4466aa"
                hdr={hdr}
                sunPosition={sunPosition}

                cloudsParams={(() => {
                    if (layout?.planet.config) {
                        return { enabled: true, opacity: layout.planet.config.cloudOpacity, alphaTest: 0.0 };
                    }
                    const id = currentSectorId || 'seizewell';
                    const p = PLANET_DATABASE[id];
                    return p ? { enabled: true, opacity: p.cloudOpacity, alphaTest: 0.0 } : { enabled: true, opacity: 0.8, alphaTest: 0.0 };
                })()}
                config={(() => {
                    if (layout?.planet.config) return layout.planet.config;
                    const id = currentSectorId || 'seizewell';
                    return PLANET_DATABASE[id];
                })()}
            />
            {layout
                ? (
                    <>
                        {stationsToRender.map((st) => (
                            <Station
                                key={st.name}
                                position={st.renderPosition}
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
                                <VisualFleet key={fleet.id} fleet={fleet} />
                            ))}

                        </Suspense>
                    </>
                )
                : (
                    <Station position={cfg.station.position} showLights={!hdr} scale={cfg.station.scale} modelPath={cfg.station.modelPath} rotationSpeed={cfg.station.rotationSpeed} rotationAxis={cfg.station.rotationAxis} />
                )}
            <Dust key={`dust-${currentSectorId}`} count={5000} range={10000} center={[0, 0, 0]} color="#aaccff" size={0.8} opacity={0.15} />

            {/* Navigation indicator for selected target */}
            <NavigationIndicator />

        </>
    );
};


