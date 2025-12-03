import React from 'react';
import { useGameStore } from '../store/gameStore';
import type { NavTarget } from '../store/gameStore';

interface SectorObject {
    name: string;
    position: [number, number, number];
    type: 'station' | 'gate' | 'ship';
}

interface SectorMapProps {
    objects: SectorObject[];
}

export const SectorMap: React.FC<SectorMapProps> = ({ objects }) => {
    const sectorMapOpen = useGameStore((s) => s.sectorMapOpen);
    const setSectorMapOpen = useGameStore((s) => s.setSectorMapOpen);
    const setSelectedTarget = useGameStore((s) => s.setSelectedTarget);
    const selectedTarget = useGameStore((s) => s.selectedTarget);

    if (!sectorMapOpen) return null;

    const handleSelect = (obj: SectorObject) => {
        const target: NavTarget = {
            name: obj.name,
            position: obj.position,
            type: obj.type,
        };
        setSelectedTarget(target);
        setSectorMapOpen(false);
    };

    const handleClose = () => {
        setSectorMapOpen(false);
    };

    // Group objects by type
    const stations = objects.filter((o) => o.type === 'station');
    const gates = objects.filter((o) => o.type === 'gate');
    const ships = objects.filter((o) => o.type === 'ship');

    return (
        <div
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100vw',
                height: '100vh',
                background: 'rgba(0, 5, 15, 0.92)',
                zIndex: 1000,
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                fontFamily: 'monospace',
            }}
            onClick={handleClose}
        >
            <div
                style={{
                    background: 'linear-gradient(180deg, rgba(20, 40, 60, 0.95) 0%, rgba(10, 25, 40, 0.98) 100%)',
                    border: '2px solid #3090c0',
                    borderRadius: 8,
                    padding: 24,
                    minWidth: 400,
                    maxWidth: 600,
                    maxHeight: '80vh',
                    overflowY: 'auto',
                    boxShadow: '0 0 40px rgba(48, 144, 192, 0.3), inset 0 0 60px rgba(0, 20, 40, 0.5)',
                }}
                onClick={(e) => e.stopPropagation()}
            >
                <div
                    style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: 20,
                        borderBottom: '1px solid #2a6080',
                        paddingBottom: 12,
                    }}
                >
                    <h2 style={{ margin: 0, color: '#6ad0ff', fontSize: 18, letterSpacing: 2 }}>
                        SECTOR MAP
                    </h2>
                    <button
                        onClick={handleClose}
                        style={{
                            background: 'none',
                            border: '1px solid #4a8ab0',
                            color: '#8ac0e0',
                            padding: '4px 12px',
                            cursor: 'pointer',
                            fontSize: 12,
                        }}
                    >
                        CLOSE [M]
                    </button>
                </div>

                {stations.length > 0 && (
                    <ObjectGroup
                        title="STATIONS"
                        objects={stations}
                        selectedName={selectedTarget?.name}
                        onSelect={handleSelect}
                        color="#00cc88"
                    />
                )}

                {gates.length > 0 && (
                    <ObjectGroup
                        title="GATES"
                        objects={gates}
                        selectedName={selectedTarget?.name}
                        onSelect={handleSelect}
                        color="#cc8800"
                    />
                )}

                {ships.length > 0 && (
                    <ObjectGroup
                        title="SHIPS"
                        objects={ships}
                        selectedName={selectedTarget?.name}
                        onSelect={handleSelect}
                        color="#cc4488"
                    />
                )}

                {objects.length === 0 && (
                    <div style={{ color: '#6090a0', textAlign: 'center', padding: 20 }}>
                        No sector objects available
                    </div>
                )}

                <div
                    style={{
                        marginTop: 20,
                        paddingTop: 12,
                        borderTop: '1px solid #2a6080',
                        color: '#5090b0',
                        fontSize: 11,
                        textAlign: 'center',
                    }}
                >
                    Click an object to set as navigation target
                </div>
            </div>
        </div>
    );
};

interface ObjectGroupProps {
    title: string;
    objects: SectorObject[];
    selectedName?: string;
    onSelect: (obj: SectorObject) => void;
    color: string;
}

const ObjectGroup: React.FC<ObjectGroupProps> = ({ title, objects, selectedName, onSelect, color }) => {
    return (
        <div style={{ marginBottom: 16 }}>
            <div
                style={{
                    color,
                    fontSize: 11,
                    letterSpacing: 1,
                    marginBottom: 8,
                    opacity: 0.9,
                }}
            >
                ▸ {title}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {objects.map((obj) => {
                    const isSelected = selectedName === obj.name;
                    return (
                        <button
                            key={obj.name}
                            onClick={() => onSelect(obj)}
                            style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                background: isSelected
                                    ? 'rgba(48, 144, 192, 0.3)'
                                    : 'rgba(30, 50, 70, 0.6)',
                                border: isSelected
                                    ? `1px solid ${color}`
                                    : '1px solid rgba(60, 100, 140, 0.5)',
                                borderRadius: 4,
                                padding: '10px 14px',
                                cursor: 'pointer',
                                color: isSelected ? '#ffffff' : '#c0e0ff',
                                fontSize: 13,
                                textAlign: 'left',
                                transition: 'all 0.15s ease',
                            }}
                            onMouseEnter={(e) => {
                                if (!isSelected) {
                                    e.currentTarget.style.background = 'rgba(40, 70, 100, 0.7)';
                                    e.currentTarget.style.borderColor = 'rgba(80, 140, 200, 0.7)';
                                }
                            }}
                            onMouseLeave={(e) => {
                                if (!isSelected) {
                                    e.currentTarget.style.background = 'rgba(30, 50, 70, 0.6)';
                                    e.currentTarget.style.borderColor = 'rgba(60, 100, 140, 0.5)';
                                }
                            }}
                        >
                            <span>{obj.name}</span>
                            {isSelected && (
                                <span style={{ color, fontSize: 10, marginLeft: 10 }}>
                                    ◉ SELECTED
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>
        </div>
    );
};
