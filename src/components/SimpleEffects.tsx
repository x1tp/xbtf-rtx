import type { FC } from 'react';
import { useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { EffectComposer, Bloom, ToneMapping, SMAA } from '@react-three/postprocessing';
import { ToneMappingMode, EdgeDetectionMode, PredicationMode } from 'postprocessing';
import { Mesh } from 'three';
import { useGameStore } from '../store/gameStore';

export const SimpleEffects: FC = () => {
    const baseExp = 1.35;
    const sunIntensity = useGameStore((s) => s.sunIntensity);
    const sunVisible = useGameStore((s) => s.sunVisible);
    const [exposure, setExposure] = useState(baseExp);
    const [bloomIntensity, setBloomIntensity] = useState(0.5);
    const { scene } = useThree();
    const [sunMesh, setSunMesh] = useState<Mesh | null>(null);

    // Grab the rendered sun mesh once so we can feed it into God Rays
    useFrame(() => {
        if (sunMesh) return;
        const obj = scene.getObjectByName('SunMesh');
        if (obj && obj instanceof Mesh) setSunMesh(obj);
    });

    useFrame(() => {
        // Keep space readable but let the sun push bloom/exposure up when it's in view
        const targetExposure = baseExp + (sunVisible ? sunIntensity * 0.6 : 0);
        const targetBloom = 0.9 + (sunVisible ? sunIntensity * 1.25 : 0);
        if (Math.abs(targetExposure - exposure) > 0.001) setExposure(targetExposure);
        if (Math.abs(targetBloom - bloomIntensity) > 0.001) setBloomIntensity(targetBloom);
    });

    return (
        <EffectComposer multisampling={0} enableNormalPass={false}>
            <SMAA 
                edgeDetectionMode={EdgeDetectionMode.COLOR} 
                predicationMode={PredicationMode.DEPTH}
            />
            <Bloom intensity={bloomIntensity} luminanceThreshold={0.18} luminanceSmoothing={0.08} mipmapBlur />
            <ToneMapping mode={ToneMappingMode.ACES_FILMIC} exposure={exposure} adaptive={false} />
        </EffectComposer>
    );
};
