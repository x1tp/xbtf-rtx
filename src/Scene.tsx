import React from 'react';
import { Stars, Environment } from '@react-three/drei';
import { Ship } from './components/Ship';
import { Planet } from './components/Planet';
import { Station } from './components/Station';
import { AsteroidField } from './components/AsteroidField';
import { Sun } from './components/Sun';

interface SceneProps { hdr?: boolean }
export const Scene: React.FC<SceneProps> = ({ hdr = false }) => {
    const sunPosition: [number, number, number] = [5000, 2000, 5000];
    return (
        <>
            <color attach="background" args={['#000005']} />

            {/* Environment */}
            <Stars radius={8000} depth={80} count={16000} factor={3.5} saturation={0} fade speed={0} />
            <Environment preset="night" />
            {!hdr && <ambientLight intensity={0.05} />}
            <Sun position={sunPosition} size={200} color="#ffddaa" intensity={5.0} hdr={hdr} />

            {/* Player */}
            <Ship enableLights={!hdr} position={[0, 10, 450]} />

            {/* Environment Objects */}
            <Planet position={[3000, 500, -6000]} size={4000} color="#4466aa" hdr={hdr} sunPosition={sunPosition} />
            <Station position={[50, 0, -120]} showLights={!hdr} scale={40} modelPath={'/models/00001.obj'} rotationSpeed={-0.05} rotationAxis={'z'} />
            <AsteroidField count={500} range={400} />

            
        </>
    );
};
