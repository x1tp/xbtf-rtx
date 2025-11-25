import type { FC } from 'react';
import { useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { EffectComposer, Bloom, ToneMapping } from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';
import { Mesh } from 'three';
import { useGameStore } from '../store/gameStore';

export const SimpleEffects: FC = () => {
    const baseExp = 1.15;
    const flashAmp = 0.85;
    const flashRef = useRef(0); // flare when the sun slams into view
    const occlusionFlashRef = useRef(0); // brief over-exposure when the sun is suddenly blocked
    const wasAdaptedRef = useRef(false);
    const wasSunVisibleRef = useRef(false);
    const sunAdapt = useGameStore((s) => s.sunAdapt);
    const sunVisible = useGameStore((s) => s.sunVisible);
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

    useFrame((_, delta) => {
        const wasAdapted = wasAdaptedRef.current;
        const adaptedNow = sunAdapt > 0.1;
        const sunWasVisible = wasSunVisibleRef.current;
        if (!wasAdapted && adaptedNow) flashRef.current = 1;
        if (sunWasVisible && !sunVisible) {
            // When the sun just got blocked, over-expose briefly while the eye/camera adapts
            occlusionFlashRef.current = 1;
        }
        wasAdaptedRef.current = adaptedNow;
        wasSunVisibleRef.current = sunVisible;
        const k = 2.8;
        const occlusionDecay = 2.2;
        flashRef.current = Math.max(0, flashRef.current - delta * k);
        occlusionFlashRef.current = Math.max(0, occlusionFlashRef.current - delta * occlusionDecay);
        const exposureBase = baseExp - 0.55 * sunAdapt + flashAmp * flashRef.current * flashRef.current;
        const occlusionBoost = occlusionFlashRef.current * occlusionFlashRef.current;
        const targetExposure = exposureBase + 1.4 * occlusionBoost;
        const targetBloom = 1.5 + 0.4 * sunAdapt + 1.2 * flashRef.current + 0.5 * occlusionBoost;
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
