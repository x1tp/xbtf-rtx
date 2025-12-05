import { Suspense, useState, useEffect } from 'react';
import { ShipModel } from './ShipModel';
import { Bounds, Environment } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import { SRGBColorSpace, ACESFilmicToneMapping } from 'three';
import { persist } from '../services/persist';

interface ModelCardProps {
    modelPath: string;
    onClick: () => void;
    selected?: boolean;
}

export const CATEGORIES = [
    'Station',
    'Ship',
    'random crap',
    'station addon',
    'interior station',
    'bullet model',
    'missile',
    'produce / resource icon',
    'game ui'
];

export function ModelCard({ modelPath, onClick, selected }: ModelCardProps) {
    const [hovered, setHovered] = useState(false);
    const [category, setCategory] = useState<string>('');
    const [name, setName] = useState<string>('');

    useEffect(() => {
        const update = () => {
            const cat = persist.getCategory(modelPath) || '';
            const n = persist.getName(modelPath) || '';
            setCategory(cat);
            setName(n);
        };
        update(); // Initial load
        return persist.subscribe(update);
    }, [modelPath]);

    const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newCat = e.target.value;
        setCategory(newCat);
        persist.setCategory(modelPath, newCat);
        e.stopPropagation();
    };

    const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setName(e.target.value);
    };

    const handleNameBlur = () => {
        persist.setName(modelPath, name);
    };

    return (
        <div
            onClick={onClick}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            style={{
                width: '100%',
                background: selected ? '#1a3b50' : hovered ? '#0f2230' : '#0b1016',
                border: `1px solid ${selected ? '#3fb6ff' : hovered ? '#3fb6ff' : '#184b6a'}`,
                borderRadius: 8,
                overflow: 'hidden',
                position: 'relative',
                transition: 'all 0.2s ease',
                display: 'flex',
                flexDirection: 'column'
            }}
        >
            <div style={{ aspectRatio: '4/3', position: 'relative', cursor: 'pointer' }}>
                <Canvas
                    style={{ width: '100%', height: '100%' }}
                    gl={{ logarithmicDepthBuffer: true, outputColorSpace: SRGBColorSpace, toneMapping: ACESFilmicToneMapping, toneMappingExposure: 1.15 }}
                    camera={{ position: [6, 5, 7], fov: 45 }}
                >
                    <Suspense fallback={null}>
                        <color attach="background" args={['#0b1016']} />
                        <Bounds fit clip observe margin={1.2}>
                            <ShipModel modelPath={modelPath} enableLights={false} />
                        </Bounds>
                        <Environment preset="night" />
                        <ambientLight intensity={0.1} />
                        <hemisphereLight args={['#bcdfff', '#223344', 0.2]} />
                        <directionalLight position={[6, 8, 6]} intensity={1.4} color="#ffffff" castShadow />
                        <directionalLight position={[-8, 4, -6]} intensity={1.1} color="#c2ddff" />
                        <directionalLight position={[0, -6, 4]} intensity={0.4} color="#88aaff" />
                    </Suspense>
                </Canvas>
            </div>
            <div style={{
                padding: '8px 12px',
                borderTop: `1px solid ${selected ? '#3fb6ff' : '#184b6a'}`,
                background: selected ? '#122836' : '#0c161e',
                color: selected ? '#fff' : '#c3e7ff',
                display: 'flex',
                flexDirection: 'column',
                gap: 6
            }}>
                <div style={{
                    fontSize: '0.85rem',
                    fontFamily: 'monospace',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    cursor: 'pointer'
                }}>
                    {modelPath.split('/').pop()}
                </div>
                <input
                    type="text"
                    value={name}
                    onChange={handleNameChange}
                    onBlur={handleNameBlur}
                    onClick={(e) => e.stopPropagation()}
                    placeholder="Item Name..."
                    style={{
                        background: '#0f2230',
                        border: '1px solid #184b6a',
                        color: '#c3e7ff',
                        fontSize: '0.75rem',
                        padding: '2px 4px',
                        borderRadius: 4,
                        width: '100%',
                        marginBottom: 4
                    }}
                />
                <select
                    value={category}
                    onChange={handleCategoryChange}
                    onClick={(e) => e.stopPropagation()}
                    style={{
                        background: '#0f2230',
                        border: '1px solid #184b6a',
                        color: '#8ab6d6',
                        fontSize: '0.75rem',
                        padding: '2px 4px',
                        borderRadius: 4,
                        width: '100%',
                        cursor: 'pointer'
                    }}
                >
                    <option value="">Uncategorized</option>
                    {CATEGORIES.map((c) => (
                        <option key={c} value={c}>{c}</option>
                    ))}
                </select>
            </div>
        </div>
    );
}
