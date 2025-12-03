
import { Canvas } from '@react-three/fiber';
import { Suspense, useState } from 'react';
import { ShipModel } from './ShipModel';
import { Bounds, Environment } from '@react-three/drei';
import { SRGBColorSpace, ACESFilmicToneMapping } from 'three';

interface ModelCardProps {
    modelPath: string;
    onClick: () => void;
    selected?: boolean;
}

export function ModelCard({ modelPath, onClick, selected }: ModelCardProps) {
    const [hovered, setHovered] = useState(false);

    return (
        <div
            onClick={onClick}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            style={{
                width: '100%',
                aspectRatio: '4/3',
                background: selected ? '#1a3b50' : hovered ? '#0f2230' : '#0b1016',
                border: `1px solid ${selected ? '#3fb6ff' : hovered ? '#3fb6ff' : '#184b6a'}`,
                borderRadius: 8,
                cursor: 'pointer',
                overflow: 'hidden',
                position: 'relative',
                transition: 'all 0.2s ease',
                display: 'flex',
                flexDirection: 'column'
            }}
        >
            <div style={{ flex: 1, position: 'relative' }}>
                <Canvas
                    shadows
                    camera={{ position: [6, 5, 7], fov: 45 }}
                    gl={{ logarithmicDepthBuffer: true, outputColorSpace: SRGBColorSpace, toneMapping: ACESFilmicToneMapping, toneMappingExposure: 1.15 }}
                >
                    <Suspense fallback={null}>
                        <color attach="background" args={[selected ? '#1a3b50' : hovered ? '#0f2230' : '#0b1016']} />
                        <Environment preset="night" />
                        <ambientLight intensity={0.1} />
                        <hemisphereLight args={['#bcdfff', '#223344', 0.2]} />
                        <directionalLight position={[6, 8, 6]} intensity={1.4} color="#ffffff" castShadow />
                        <directionalLight position={[-8, 4, -6]} intensity={1.1} color="#c2ddff" />
                        <directionalLight position={[0, -6, 4]} intensity={0.4} color="#88aaff" />
                        <Bounds fit clip observe margin={1.2}>
                            <ShipModel modelPath={modelPath} enableLights={false} markerOverrides={[]} />
                        </Bounds>
                    </Suspense>
                </Canvas>
            </div>
            <div style={{
                padding: '8px 12px',
                borderTop: `1px solid ${selected ? '#3fb6ff' : '#184b6a'}`,
                background: selected ? '#122836' : '#0c161e',
                color: selected ? '#fff' : '#c3e7ff',
                fontSize: '0.85rem',
                fontFamily: 'monospace',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
            }}>
                {modelPath.split('/').pop()}
            </div>
        </div>
    );
}
