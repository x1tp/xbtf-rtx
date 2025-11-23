import type { FC } from 'react';
import { useLoader, useFrame } from '@react-three/fiber';
import { OBJLoader, MTLLoader } from 'three-stdlib';
import { Color, Mesh, MeshPhongMaterial, MeshStandardMaterial, MeshPhysicalMaterial } from 'three';
import { useRef } from 'react';
import { useGameStore } from '../store/gameStore';

interface CockpitProps {
    enableLights?: boolean;
}

export const Cockpit: FC<CockpitProps> = ({ enableLights = true }) => {
    const materials = useLoader(MTLLoader, '/models/00000.mtl');
    const obj = useLoader(OBJLoader, '/models/00000.obj', (loader) => {
        materials.preload();
        loader.setMaterials(materials);
    });
    const emissiveMatsRef = useRef<(MeshPhongMaterial | MeshStandardMaterial | MeshPhysicalMaterial)[]>([]);
    const groupRef = useRef<THREE.Group>(null);
    useFrame(() => {
        if (emissiveMatsRef.current.length === 0) {
            obj.traverse((o) => {
                const mesh = o as Mesh;
                const mat = mesh.material as MeshPhongMaterial | MeshStandardMaterial | MeshPhysicalMaterial | MeshPhongMaterial[] | MeshStandardMaterial[] | MeshPhysicalMaterial[] | null | undefined;
                const collect = (m: MeshPhongMaterial | MeshStandardMaterial | MeshPhysicalMaterial) => {
                    const name = m.name?.toLowerCase?.() || '';
                    const tex = (m as unknown as { map?: { image?: { src?: string }; source?: { data?: { src?: string } } } }).map;
                    const src = tex && (tex.image?.src || tex.source?.data?.src) || '';
                    const isEngine = name === 'mat_5' || src.includes('/176');
                    if (isEngine) {
                        const c = new Color('#76baff');
                        if ((m as MeshPhongMaterial).emissive) (m as MeshPhongMaterial).emissive.copy(c);
                        (m as unknown as { emissiveIntensity?: number }).emissiveIntensity = 0.0;
                        (m as unknown as { toneMapped?: boolean }).toneMapped = false;
                        emissiveMatsRef.current.push(m);
                    }
                };
                if (Array.isArray(mat)) mat.forEach(collect); else if (mat) collect(mat as MeshPhongMaterial | MeshStandardMaterial | MeshPhysicalMaterial);
            });
        }
        const t = useGameStore.getState().throttle;
        const k = Math.max(0, t);
        const base = 0.05;
        const maxBoost = 3.5;
        const val = base + k * maxBoost;
        for (const m of emissiveMatsRef.current) {
            (m as unknown as { emissiveIntensity?: number }).emissiveIntensity = val;
        }
    });

    return (
        <group ref={groupRef} position={[0, -0.3, 0.0]}>
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
