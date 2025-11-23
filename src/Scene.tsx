import React from 'react';
import { Stars, Environment, Sky } from '@react-three/drei';
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
            <Stars radius={5000} depth={50} count={10000} factor={4} saturation={0} fade speed={0} />
            {!hdr && (
                <Sky
                    distance={45000}
                    sunPosition={sunPosition}
                    turbidity={6}
                    rayleigh={2}
                    mieCoefficient={0.0045}
                    mieDirectionalG={0.9}
                    azimuth={180}
                    inclination={0.49}
                />
            )}
            {!hdr && <Environment preset="warehouse" />}
            {!hdr && <ambientLight intensity={0.05} />}
            <Sun position={sunPosition} size={200} color="#ffddaa" intensity={13.0} hdr={hdr} />

            {/* Player */}
            <Ship enableLights={!hdr} />

            {/* Environment Objects */}
            <Planet position={[3000, 500, -6000]} size={4000} color="#4466aa" hdr={hdr} sunPosition={sunPosition} />
            <Station position={[50, 0, -120]} showLights={!hdr} scale={40} modelPath={'/models/00001.obj'} rotationSpeed={-0.05} rotationAxis={'z'} />
            <AsteroidField count={500} range={400} />

            
        </>
    );
};
