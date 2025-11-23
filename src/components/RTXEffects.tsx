import type { FC } from 'react';
import { useEffect, useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import { EffectComposer as RPEffectComposer, Bloom, ToneMapping, N8AO, SMAA, GodRays } from '@react-three/postprocessing';
import type { Mesh } from 'three';
import { BlendFunction, ToneMappingMode } from 'postprocessing';
import { SSREffect } from 'screen-space-reflections';

interface RTXEffectsProps {
    enabled: boolean;
}

// Lightweight post stack to mimic RTX-style richness (AO + bloom + ACES tone map) on WebGL.
export const RTXEffects: FC<RTXEffectsProps> = ({ enabled }) => {
    const { scene, camera } = useThree();
    const ssrEffect = useMemo(() => new SSREffect(scene, camera), [scene, camera]);
    const sunMesh = scene.getObjectByName('SunMesh') as Mesh | null;
    useEffect(() => {}, [enabled]);

    if (!enabled) return null;

    return (
        <RPEffectComposer multisampling={0} enableNormalPass>
            <SMAA />
            <N8AO aoRadius={12} distanceFalloff={1.2} intensity={1.3} aoSamples={16} halfRes={true} />
            {sunMesh && <GodRays sun={sunMesh} samples={60} density={0.06} decay={0.95} exposure={0.6} clampMax={1.0} />}
            {ssrEffect && <primitive object={ssrEffect} />}
            <Bloom
                intensity={0.9}
                mipmapBlur
                luminanceThreshold={0.25}
                luminanceSmoothing={0.85}
                blendFunction={BlendFunction.SCREEN}
            />
            <ToneMapping
                mode={ToneMappingMode.ACES_FILMIC}
                exposure={1.2}
                adaptive={false}
            />
        </RPEffectComposer>
    );
};
