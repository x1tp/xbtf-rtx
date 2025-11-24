import type { FC } from 'react';
import { useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { EffectComposer, Bloom, ToneMapping } from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';
import { useGameStore } from '../store/gameStore';

export const SimpleEffects: FC = () => {
    const baseExp = 1.15;
    const flashAmp = 0.85;
    const flashRef = useRef(0);
    const wasVisibleRef = useRef(false);
    const sunAdapt = useGameStore((s) => s.sunAdapt);
    const [exposure, setExposure] = useState(baseExp);
    const [bloomIntensity, setBloomIntensity] = useState(1.5);
    useFrame((_, delta) => {
        const prev = wasVisibleRef.current;
        const now = sunAdapt > 0.1;
        if (!prev && now) flashRef.current = 1;
        wasVisibleRef.current = now;
        const k = 2.8;
        flashRef.current = Math.max(0, flashRef.current - delta * k);
        const e = baseExp - 0.55 * sunAdapt + flashAmp * flashRef.current * flashRef.current;
        const b = 1.5 + 0.4 * sunAdapt + 1.2 * flashRef.current;
        if (Math.abs(e - exposure) > 0.001) setExposure(e);
        if (Math.abs(b - bloomIntensity) > 0.001) setBloomIntensity(b);
    });
    return (
        <EffectComposer multisampling={0} enableNormalPass={false}>
            <Bloom intensity={bloomIntensity} luminanceThreshold={0.9} luminanceSmoothing={0.025} mipmapBlur />
            <ToneMapping mode={ToneMappingMode.ACES_FILMIC} exposure={exposure} adaptive={false} />
        </EffectComposer>
    );
};
