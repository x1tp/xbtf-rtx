import type { FC } from 'react';
import { useLoader } from '@react-three/fiber';
import { OBJLoader, MTLLoader } from 'three-stdlib';

interface CockpitProps {
    enableLights?: boolean;
}

export const Cockpit: FC<CockpitProps> = ({ enableLights = true }) => {
    const materials = useLoader(MTLLoader, '/models/00000.mtl');
    const obj = useLoader(OBJLoader, '/models/00000.obj', (loader) => {
        materials.preload();
        loader.setMaterials(materials);
    });

    return (
        <group position={[0, -0.3, 0.0]}>
            <primitive object={obj} />
            {enableLights && (
                <>
                    <pointLight position={[0, 1.2, -0.8]} intensity={1.6} distance={8} decay={2} color="#bcdfff" />
                    <pointLight position={[0, -0.3, -1.1]} intensity={1} distance={6} decay={2} color="#ffc372" />
                    <pointLight position={[0, 0.6, 0.8]} intensity={0.7} distance={5} decay={2} color="#9fc4ff" />
                </>
            )}
        </group>
    );
};

