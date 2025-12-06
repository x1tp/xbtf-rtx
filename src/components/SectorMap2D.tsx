import React, { useState, useRef, useEffect } from 'react';
import { useGameStore, type GameState } from '../store/gameStore';
import type { NavTarget } from '../store/gameStore';
import type { NPCFleet } from '../types/simulation';
import { UNIVERSE_SECTORS_XBTF } from '../config/universe_xbtf';
import { getSectorLayoutById } from '../config/sector';

import { useFleetPositions } from '../store/fleetPositions';

interface SectorObject {
    name: string;
    position: [number, number, number];
    type: 'station' | 'gate' | 'ship' | 'planet' | 'asteroid';
    targetSectorId?: string;
}

interface SectorMapProps {
    objects?: SectorObject[];
    playerPosition?: [number, number, number];
}

type TabType = 'ships' | 'all' | 'stations';

// Icon shapes for different object types
const getObjectIcon = (type: string, isSelected: boolean, isPlayer: boolean) => {
    const baseColor = isPlayer ? '#00ff00' : isSelected ? '#ffff00' :
        type === 'station' ? '#00aaff' :
            type === 'gate' ? '#ff8800' :
                type === 'ship' ? '#ff4488' : '#888888';

    if (isPlayer) {
        // Player ship - green crosshair
        return (
            <g>
                <line x1="-8" y1="0" x2="8" y2="0" stroke={baseColor} strokeWidth="2" />
                <line x1="0" y1="-8" x2="0" y2="8" stroke={baseColor} strokeWidth="2" />
                <circle cx="0" cy="0" r="4" fill="none" stroke={baseColor} strokeWidth="1.5" />
            </g>
        );
    }

    if (type === 'station') {
        // Station - square with dots
        return (
            <g>
                <rect x="-5" y="-5" width="10" height="10" fill={baseColor} opacity="0.8" />
                <rect x="-5" y="-5" width="10" height="10" fill="none" stroke={baseColor} strokeWidth="1" />
            </g>
        );
    }

    if (type === 'gate') {
        // Gate - diamond shape
        return (
            <g>
                <polygon points="0,-6 6,0 0,6 -6,0" fill={baseColor} opacity="0.8" />
                <polygon points="0,-6 6,0 0,6 -6,0" fill="none" stroke={baseColor} strokeWidth="1" />
            </g>
        );
    }

    // Ship - triangle
    return (
        <g>
            <polygon points="0,-6 5,5 -5,5" fill={baseColor} opacity="0.8" />
            <polygon points="0,-6 5,5 -5,5" fill="none" stroke={baseColor} strokeWidth="1" />
        </g>
    );
};

type AxisView = 'xz' | 'xy' | 'yz';

export const SectorMap2D: React.FC<SectorMapProps> = ({ objects, playerPosition = [0, 0, 0] }) => {
    const sectorMapOpen = useGameStore((s: GameState) => s.sectorMapOpen);
    const setSectorMapOpen = useGameStore((s: GameState) => s.setSectorMapOpen);
    const setUniverseMapOpen = useGameStore((s: GameState) => s.setUniverseMapOpen);
    const setCurrentSectorId = useGameStore((s: GameState) => s.setCurrentSectorId);
    const currentSectorId = useGameStore((s: GameState) => s.currentSectorId);
    const selectedSectorId = useGameStore((s: GameState) => s.selectedSectorId);
    const setSelectedTarget = useGameStore((s: GameState) => s.setSelectedTarget);
    const selectedTarget = useGameStore((s: GameState) => s.selectedTarget);
    const storePosition = useGameStore((s: GameState) => s.position);
    const storeObjects = useGameStore((s: GameState) => s.navObjects);
    const fleets = useGameStore((s: GameState) => s.fleets);
    const fleetPositions = useFleetPositions(30); // Poll at 30fps

    const [activeTab, setActiveTab] = useState<TabType>('all');
    const [zoom, setZoom] = useState(1);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const [hoveredObject, setHoveredObject] = useState<SectorObject | null>(null);
    const [mapWidth, setMapWidth] = useState(800);
    const [mapHeight, setMapHeight] = useState(600);
    const [axisView, setAxisView] = useState<AxisView>('xz');

    // Compute objects to display:
    // 1. If props.objects provided, use them.
    // 2. If viewing a remote sector (selectedSectorId != currentSectorId), generate them.
    // 3. Otherwise use storeObjects (live current sector objects) + NPC fleets.
    const objectsToRender = React.useMemo(() => {
        if (objects) return objects;

        // Helper to get sector ID to filter fleets
        const targetSectorId = selectedSectorId || currentSectorId;

        // If we are looking at a different sector than the one we are in
        if (selectedSectorId && selectedSectorId !== currentSectorId) {
            const layout = getSectorLayoutById(selectedSectorId);
            if (!layout) return [];

            // Replicate App.tsx scaling logic
            const spacing = 30;
            const place = (p: [number, number, number]): [number, number, number] => [p[0] * spacing, p[1] * spacing, p[2] * spacing];

            const sector = UNIVERSE_SECTORS_XBTF.find((s) => s.id === selectedSectorId);
            const nbNames = (sector?.neighbors || []).slice(0, layout.gates.length);
            const nb = nbNames.map((nm) => UNIVERSE_SECTORS_XBTF.find((x) => x.name === nm)?.id).filter((x): x is string => !!x);

            const list: SectorObject[] = [];
            for (const st of layout.stations) list.push({ name: st.name, position: place(st.position), type: 'station' });
            layout.gates.forEach((g, i) => { list.push({ name: g.name, position: place(g.position), type: 'gate', targetSectorId: nb[i] }); });
            for (const s of layout.ships) list.push({ name: s.name, position: place(s.position), type: 'ship' });

            // Add NPC fleets in this sector
            const sectorFleets = fleets.filter((f: NPCFleet) => f.currentSectorId === targetSectorId);
            for (const f of sectorFleets) {
                list.push({ name: f.name, position: f.position, type: 'ship' });
            }

            return list;
        }

        // Current sector: combine static objects with live fleet positions
        const sectorFleets = fleets.filter((f: NPCFleet) => f.currentSectorId === targetSectorId);
        const fleetObjects: SectorObject[] = sectorFleets.map((f: NPCFleet) => ({
            name: f.name,
            position: fleetPositions[f.id] || f.position,
            type: 'ship' as const
        }));

        return [...storeObjects, ...fleetObjects];
    }, [objects, selectedSectorId, currentSectorId, storeObjects, fleets, fleetPositions]);

    const mapRef = useRef<SVGSVGElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // Axis view labels
    const axisLabels: Record<AxisView, { horizontal: string; vertical: string; name: string }> = {
        'xz': { horizontal: 'X', vertical: 'Z', name: 'Top (X-Z)' },
        'xy': { horizontal: 'X', vertical: 'Y', name: 'Front (X-Y)' },
        'yz': { horizontal: 'Y', vertical: 'Z', name: 'Side (Y-Z)' },
    };

    // Handle Insert key for axis switching
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Insert' && sectorMapOpen) {
                setAxisView(prev => {
                    if (prev === 'xz') return 'xy';
                    if (prev === 'xy') return 'yz';
                    return 'xz';
                });
                // Reset pan when switching views
                setPan({ x: 0, y: 0 });
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [sectorMapOpen]);

    // Resize map to fit container
    useEffect(() => {
        const updateSize = () => {
            if (containerRef.current) {
                const rect = containerRef.current.getBoundingClientRect();
                setMapWidth(Math.max(400, rect.width));
                setMapHeight(Math.max(300, rect.height));
            }
        };
        updateSize();
        window.addEventListener('resize', updateSize);
        // Also update after a short delay to catch layout changes
        const timeout = setTimeout(updateSize, 100);
        return () => {
            window.removeEventListener('resize', updateSize);
            clearTimeout(timeout);
        };
    }, [sectorMapOpen]);

    // Use store position if available
    const currentPlayerPos: [number, number, number] = [
        storePosition?.x ?? playerPosition[0],
        storePosition?.y ?? playerPosition[1],
        storePosition?.z ?? playerPosition[2]
    ];

    if (!sectorMapOpen) return null;

    // Get coordinates based on current axis view
    const getAxisCoords = (pos: [number, number, number]): [number, number] => {
        switch (axisView) {
            case 'xz': return [pos[0], pos[2]]; // Top-down (X horizontal, Z vertical)
            case 'xy': return [pos[0], -pos[1]]; // Front view (X horizontal, Y vertical, inverted)
            case 'yz': return [pos[2], -pos[1]]; // Side view (Z horizontal, Y vertical, inverted)
        }
    };

    const objectsList = objectsToRender;

    // Calculate bounds for auto-scaling based on current view
    const allPositions = [...objectsList.map(o => o.position), currentPlayerPos];
    const allCoords = allPositions.map(p => getAxisCoords(p));
    const minH = Math.min(...allCoords.map(c => c[0])) - 500;
    const maxH = Math.max(...allCoords.map(c => c[0])) + 500;
    const minV = Math.min(...allCoords.map(c => c[1])) - 500;
    const maxV = Math.max(...allCoords.map(c => c[1])) + 500;

    const rangeH = maxH - minH;
    const rangeV = maxV - minV;
    const scale = Math.min(mapWidth / rangeH, mapHeight / rangeV) * 0.85;

    // Transform world coordinates to map coordinates
    const worldToMap = (pos: [number, number, number]) => {
        const [h, v] = getAxisCoords(pos);
        const centerH = (minH + maxH) / 2;
        const centerV = (minV + maxV) / 2;
        return {
            x: ((h - centerH) * scale * zoom) + mapWidth / 2 + pan.x,
            y: ((v - centerV) * scale * zoom) + mapHeight / 2 + pan.y
        };
    };

    const handleSelect = (obj: SectorObject) => {
        const target: NavTarget = {
            name: obj.name,
            position: obj.position,
            type: obj.type,
            targetSectorId: obj.targetSectorId,
        };
        setSelectedTarget(target);
    };

    const handleClose = () => {
        setSectorMapOpen(false);
    };

    const handleWheel = (e: React.WheelEvent) => {
        e.preventDefault();
        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        setZoom(z => Math.max(0.2, Math.min(5, z * delta)));
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        if (e.button === 0 || e.button === 2) {
            setIsDragging(true);
            setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
        }
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (isDragging) {
            setPan({
                x: e.clientX - dragStart.x,
                y: e.clientY - dragStart.y
            });
        }
    };

    const handleMouseUp = () => {
        setIsDragging(false);
    };

    // Filter objects by tab
    const filteredObjects = objectsList.filter(o => {
        if (activeTab === 'all') return true;
        if (activeTab === 'ships') return o.type === 'ship';
        if (activeTab === 'stations') return o.type === 'station' || o.type === 'gate';
        return true;
    });

    // Calculate distance from player
    const getDistance = (pos: [number, number, number]) => {
        const dx = pos[0] - currentPlayerPos[0];
        const dy = pos[1] - currentPlayerPos[1];
        const dz = pos[2] - currentPlayerPos[2];
        return Math.sqrt(dx * dx + dy * dy + dz * dz);
    };

    const formatDistance = (d: number) => {
        if (d < 1000) return `${d.toFixed(0)}m`;
        return `${(d / 1000).toFixed(2)}km`;
    };

    // Grid lines
    const gridLines = [];
    const gridSpacing = 2000 / zoom; // Adjust grid based on zoom
    const gridCount = 30;
    for (let i = -gridCount; i <= gridCount; i++) {
        const offset = i * gridSpacing * scale * zoom;
        gridLines.push(
            <line
                key={`h${i}`}
                x1={0} y1={mapHeight / 2 + offset + pan.y}
                x2={mapWidth} y2={mapHeight / 2 + offset + pan.y}
                stroke="rgba(40, 80, 120, 0.3)"
                strokeWidth="1"
            />,
            <line
                key={`v${i}`}
                x1={mapWidth / 2 + offset + pan.x} y1={0}
                x2={mapWidth / 2 + offset + pan.x} y2={mapHeight}
                stroke="rgba(40, 80, 120, 0.3)"
                strokeWidth="1"
            />
        );
    }

    return (
        <div
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100vw',
                height: '100vh',
                background: 'rgba(0, 5, 15, 0.95)',
                zIndex: 1000,
                display: 'flex',
                fontFamily: 'monospace',
            }}
            onContextMenu={(e) => e.preventDefault()}
        >
            {/* Main Map Panel */}
            <div
                style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    borderRight: '2px solid #1a3a50',
                }}
            >
                {/* Header */}
                <div
                    style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '8px 16px',
                        background: 'linear-gradient(180deg, rgba(30, 50, 70, 0.9) 0%, rgba(20, 35, 50, 0.95) 100%)',
                        borderBottom: '1px solid #2a5070',
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                        <span style={{ color: '#6ad0ff', fontSize: 14, letterSpacing: 1 }}>
                            Sector Map
                        </span>
                        <span style={{ color: '#ffaa44', fontSize: 12 }}>
                            {axisLabels[axisView].name}
                        </span>
                        <span style={{ color: '#4a8ab0', fontSize: 12 }}>
                            +{zoom.toFixed(1)}
                        </span>
                        <span style={{ color: '#4a8ab0', fontSize: 12 }}>
                            {formatDistance(rangeH)}
                        </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <button
                            onClick={() => { setSectorMapOpen(false); setUniverseMapOpen(true); }}
                            style={{
                                background: 'none',
                                border: '1px solid #4a6a80',
                                color: '#8ac0e0',
                                padding: '4px 10px',
                                cursor: 'pointer',
                                fontSize: 11,
                            }}
                        >
                            {'<'}
                        </button>
                        <button
                            onClick={() => { if (selectedTarget && selectedTarget.type === 'gate' && selectedTarget.targetSectorId) { setCurrentSectorId(selectedTarget.targetSectorId); setSectorMapOpen(false); setUniverseMapOpen(false); } }}
                            disabled={!(selectedTarget && selectedTarget.type === 'gate' && selectedTarget.targetSectorId)}
                            style={{
                                background: 'none',
                                border: '1px solid #4a6a80',
                                color: '#8ac0e0',
                                padding: '4px 10px',
                                cursor: 'pointer',
                                fontSize: 11,
                                opacity: (selectedTarget && selectedTarget.type === 'gate' && selectedTarget.targetSectorId) ? 1 : 0.5,
                            }}
                        >
                            Jump
                        </button>
                        <button
                            onClick={handleClose}
                            style={{
                                background: 'none',
                                border: '1px solid #4a6a80',
                                color: '#8ac0e0',
                                padding: '4px 12px',
                                cursor: 'pointer',
                                fontSize: 11,
                            }}
                        >
                            ✕
                        </button>
                    </div>
                </div>

                {/* Map View */}
                <div
                    ref={containerRef}
                    style={{
                        flex: 1,
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        background: 'linear-gradient(180deg, rgba(10, 25, 40, 0.95) 0%, rgba(5, 15, 25, 0.98) 100%)',
                        overflow: 'hidden',
                        position: 'relative',
                    }}
                >
                    <svg
                        ref={mapRef}
                        width={mapWidth}
                        height={mapHeight}
                        style={{
                            cursor: isDragging ? 'grabbing' : 'grab',
                            background: 'transparent',
                            position: 'absolute',
                            top: 0,
                            left: 0,
                        }}
                        onWheel={handleWheel}
                        onMouseDown={handleMouseDown}
                        onMouseMove={handleMouseMove}
                        onMouseUp={handleMouseUp}
                        onMouseLeave={handleMouseUp}
                    >
                        {/* Grid lines */}
                        <g>
                            {gridLines}

                            {/* Axis lines */}
                            <line
                                x1={0} y1={mapHeight / 2 + pan.y}
                                x2={mapWidth} y2={mapHeight / 2 + pan.y}
                                stroke="rgba(60, 120, 160, 0.5)"
                                strokeWidth="1"
                            />
                            <line
                                x1={mapWidth / 2 + pan.x} y1={0}
                                x2={mapWidth / 2 + pan.x} y2={mapHeight}
                                stroke="rgba(60, 120, 160, 0.5)"
                                strokeWidth="1"
                            />

                            {/* Axis labels */}
                            <text x={mapWidth - 25} y={mapHeight / 2 + pan.y - 5} fill="#4080a0" fontSize="11">+{axisLabels[axisView].horizontal.toLowerCase()}</text>
                            <text x={10} y={mapHeight / 2 + pan.y - 5} fill="#4080a0" fontSize="11">-{axisLabels[axisView].horizontal.toLowerCase()}</text>
                            <text x={mapWidth / 2 + pan.x + 5} y={20} fill="#4080a0" fontSize="11">-{axisLabels[axisView].vertical.toLowerCase()}</text>
                            <text x={mapWidth / 2 + pan.x + 5} y={mapHeight - 10} fill="#4080a0" fontSize="11">+{axisLabels[axisView].vertical.toLowerCase()}</text>
                        </g>

                        {/* Objects */}
                        <g>
                            {filteredObjects.map((obj, i) => {
                                const pos = worldToMap(obj.position);
                                const isSelected = selectedTarget?.name === obj.name;
                                const isHovered = hoveredObject?.name === obj.name;

                                return (
                                    <g
                                        key={obj.name + i}
                                        transform={`translate(${pos.x}, ${pos.y})`}
                                        style={{ cursor: 'pointer' }}
                                        onClick={() => handleSelect(obj)}
                                        onMouseEnter={() => setHoveredObject(obj)}
                                        onMouseLeave={() => setHoveredObject(null)}
                                    >
                                        {/* Selection indicator */}
                                        {isSelected && (
                                            <rect
                                                x="-12" y="-12" width="24" height="24"
                                                fill="none"
                                                stroke="#ffff00"
                                                strokeWidth="1"
                                                strokeDasharray="4,2"
                                            />
                                        )}
                                        {/* Hover highlight */}
                                        {isHovered && !isSelected && (
                                            <circle r="10" fill="rgba(255,255,255,0.1)" />
                                        )}
                                        {getObjectIcon(obj.type, isSelected, false)}
                                        {/* Label on hover */}
                                        {(isHovered || isSelected) && (
                                            <text
                                                y="18"
                                                textAnchor="middle"
                                                fill={isSelected ? '#ffff00' : '#ffffff'}
                                                fontSize="9"
                                                style={{ pointerEvents: 'none' }}
                                            >
                                                {obj.name.length > 15 ? obj.name.substring(0, 15) + '...' : obj.name}
                                            </text>
                                        )}
                                    </g>
                                );
                            })}

                            {/* Player position */}
                            {(() => {
                                // Only show player if we are in the current sector
                                if (selectedSectorId && selectedSectorId !== currentSectorId) return null;

                                const playerPos = worldToMap(currentPlayerPos);
                                return (
                                    <g transform={`translate(${playerPos.x}, ${playerPos.y})`}>
                                        {getObjectIcon('ship', false, true)}
                                        <text y="18" textAnchor="middle" fill="#00ff00" fontSize="9">
                                            YOU
                                        </text>
                                    </g>
                                );
                            })()}
                        </g>
                    </svg>

                    {/* Zoom controls */}
                    <div style={{
                        position: 'absolute',
                        top: 10,
                        right: 10,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 4,
                    }}>
                        <button
                            onClick={() => setZoom(z => Math.min(5, z * 1.2))}
                            style={{
                                width: 24, height: 24,
                                background: 'rgba(30, 50, 70, 0.8)',
                                border: '1px solid #3a6a90',
                                color: '#8ac0e0',
                                cursor: 'pointer',
                                fontSize: 14,
                            }}
                        >+</button>
                        <button
                            onClick={() => setZoom(z => Math.max(0.2, z * 0.8))}
                            style={{
                                width: 24, height: 24,
                                background: 'rgba(30, 50, 70, 0.8)',
                                border: '1px solid #3a6a90',
                                color: '#8ac0e0',
                                cursor: 'pointer',
                                fontSize: 14,
                            }}
                        >−</button>
                        <button
                            onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}
                            style={{
                                width: 24, height: 24,
                                background: 'rgba(30, 50, 70, 0.8)',
                                border: '1px solid #3a6a90',
                                color: '#8ac0e0',
                                cursor: 'pointer',
                                fontSize: 10,
                            }}
                        >⟲</button>
                    </div>
                </div>

                {/* Footer info */}
                <div
                    style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        padding: '8px 16px',
                        background: 'rgba(20, 35, 50, 0.9)',
                        borderTop: '1px solid #2a5070',
                        color: '#6090a0',
                        fontSize: 11,
                    }}
                >
                    <span>
                        {hoveredObject ? (
                            <>
                                {hoveredObject.name} | {formatDistance(getDistance(hoveredObject.position))}
                            </>
                        ) : selectedTarget ? (
                            <>
                                Selected: {selectedTarget.name} | {formatDistance(getDistance(selectedTarget.position))}
                            </>
                        ) : (
                            'Click object to select target'
                        )}
                    </span>
                    <span>
                        {currentPlayerPos[0].toFixed(0)}, {currentPlayerPos[1].toFixed(0)}, {currentPlayerPos[2].toFixed(0)}
                    </span>
                </div>
            </div>

            {/* Right Panel - Object List */}
            <div
                style={{
                    width: 280,
                    display: 'flex',
                    flexDirection: 'column',
                    background: 'linear-gradient(180deg, rgba(25, 45, 65, 0.95) 0%, rgba(15, 30, 45, 0.98) 100%)',
                }}
            >
                {/* Sector Name */}
                <div
                    style={{
                        padding: '8px 12px',
                        borderBottom: '1px solid #2a5070',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                    }}
                >
                    <span style={{ color: '#ff9944', fontSize: 14, fontWeight: 'bold' }}>
                        {(() => { const s = UNIVERSE_SECTORS_XBTF.find((x) => x.id === (selectedSectorId || currentSectorId || 'seizewell')); return s ? s.name : (selectedSectorId || currentSectorId || 'seizewell'); })()}
                    </span>
                    <span style={{ color: '#6090a0', fontSize: 10 }}>
                        &lt;&lt; Select a position &gt;&gt;
                    </span>
                </div>

                {/* Tabs */}
                <div style={{ display: 'flex', borderBottom: '1px solid #2a5070' }}>
                    {(['ships', 'all', 'stations'] as TabType[]).map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            style={{
                                flex: 1,
                                padding: '8px',
                                background: activeTab === tab
                                    ? 'rgba(50, 90, 130, 0.6)'
                                    : 'transparent',
                                border: 'none',
                                borderBottom: activeTab === tab
                                    ? '2px solid #6ad0ff'
                                    : '2px solid transparent',
                                color: activeTab === tab ? '#ffffff' : '#6090a0',
                                cursor: 'pointer',
                                fontSize: 11,
                                textTransform: 'capitalize',
                            }}
                        >
                            {tab}
                        </button>
                    ))}
                </div>

                {/* Object List */}
                <div
                    style={{
                        flex: 1,
                        overflowY: 'auto',
                        padding: '4px',
                    }}
                >
                    {/* Player entry */}
                    {(!selectedSectorId || selectedSectorId === currentSectorId) && (
                        <div
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                padding: '6px 8px',
                                background: 'rgba(0, 100, 0, 0.3)',
                                borderLeft: '3px solid #00ff00',
                                marginBottom: 2,
                            }}
                        >
                            <span style={{ color: '#00ff00', fontSize: 11, flex: 1 }}>
                                ▶ Your Ship
                            </span>
                            <span style={{ color: '#00aa00', fontSize: 10 }}>
                                HERE
                            </span>
                        </div>
                    )}

                    {filteredObjects.map((obj, i) => {
                        const isSelected = selectedTarget?.name === obj.name;
                        const distance = getDistance(obj.position);
                        const typeColor = obj.type === 'station' ? '#00aaff' :
                            obj.type === 'gate' ? '#ff8800' : '#ff4488';

                        return (
                            <div
                                key={obj.name + i}
                                onClick={() => handleSelect(obj)}
                                onMouseEnter={() => setHoveredObject(obj)}
                                onMouseLeave={() => setHoveredObject(null)}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    padding: '6px 8px',
                                    background: isSelected
                                        ? 'rgba(80, 120, 40, 0.4)'
                                        : 'rgba(30, 50, 70, 0.3)',
                                    borderLeft: `3px solid ${isSelected ? '#88cc44' : typeColor}`,
                                    marginBottom: 1,
                                    cursor: 'pointer',
                                    transition: 'background 0.1s',
                                }}
                            >
                                <span
                                    style={{
                                        color: isSelected ? '#ccff88' : '#c0d0e0',
                                        fontSize: 11,
                                        flex: 1,
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap',
                                    }}
                                >
                                    {obj.name}
                                </span>
                                <span style={{
                                    color: isSelected ? '#88cc44' : '#6090a0',
                                    fontSize: 10,
                                    marginLeft: 8,
                                }}>
                                    {formatDistance(distance)}
                                </span>
                            </div>
                        );
                    })}
                </div>

                {/* Bottom info */}
                <div
                    style={{
                        padding: '8px 12px',
                        borderTop: '1px solid #2a5070',
                        color: '#5080a0',
                        fontSize: 10,
                        textAlign: 'center',
                    }}
                >
                    {filteredObjects.length} objects | Insert: Switch View | M: Close
                </div>
            </div>
        </div>
    );
};
