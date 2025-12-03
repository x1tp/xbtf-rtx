import type { FC } from 'react';
import { useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { EffectComposer, Bloom, ToneMapping } from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';
import { Mesh } from 'three';
import { useGameStore } from '../store/gameStore';

export const SimpleEffects: FC = () => {
    const baseExp = 1.15;
    // Simplified temporary constants to avoid blackout while debugging
    useGameStore((s) => s.sunAdapt);
    useGameStore((s) => s.sunVisible);
    const [exposure, setExposure] = useState(baseExp);
    const [bloomIntensity, setBloomIntensity] = useState(1.5);
    const { scene } = useThree();
    const [sunMesh, setSunMesh] = useState<Mesh | null>(null);

    // Grab the rendered sun mesh once so we can feed it into God Rays
    useFrame(() => {
        if (sunMesh) return;
        const obj = scene.getObjectByName('SunMesh');
        if (obj && obj instanceof Mesh) setSunMesh(obj);
    });

    useFrame(() => {
        // Temporarily force stable exposure to debug blackout
        const targetExposure = baseExp;
        const targetBloom = 1.6;
        if (Math.abs(targetExposure - exposure) > 0.001) setExposure(targetExposure);
        if (Math.abs(targetBloom - bloomIntensity) > 0.001) setBloomIntensity(targetBloom);
    });

    return (
        <EffectComposer multisampling={0} enableNormalPass={false}>
            <Bloom intensity={bloomIntensity} luminanceThreshold={0.9} luminanceSmoothing={0.025} mipmapBlur />
            <ToneMapping mode={ToneMappingMode.ACES_FILMIC} exposure={exposure} adaptive={false} />
        </EffectComposer>
    );
};
