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
    const { scene, camera, size } = useThree();
    const ssrEffect = useMemo(() => new SSREffect(scene, camera, {
        temporalResolve: true,
        temporalResolveMix: 0.9,
        temporalResolveCorrectionMix: 0.4,
        resolutionScale: 0.5,
        ENABLE_BLUR: true,
        blurMix: 0.6,
        blurKernelSize: 8,
        blurSharpness: 0.6,
        intensity: 1.1,
        maxRoughness: 0.6,
        thickness: 10,
        ior: 1.45,
        MAX_STEPS: 20,
        NUM_BINARY_SEARCH_STEPS: 5,
        maxDepthDifference: 3,
        rayStep: 0.1,
        STRETCH_MISSED_RAYS: true,
        USE_MRT: true,
        USE_NORMALMAP: true,
        USE_ROUGHNESSMAP: true
    }), [scene, camera]);
    const sunMesh = scene.getObjectByName('SunMesh') as Mesh | null;
    useEffect(() => { ssrEffect.setSize(size.width, size.height); }, [enabled, ssrEffect, size]);

    if (!enabled) return null;

    return (
        <RPEffectComposer multisampling={0} enableNormalPass>
            <SMAA />
            <N8AO aoRadius={9} distanceFalloff={1.0} intensity={1.1} aoSamples={12} halfRes={true} />
            {sunMesh && <GodRays sun={sunMesh} samples={60} density={0.06} decay={0.95} exposure={0.6} clampMax={1.0} />}
            {ssrEffect && <primitive object={ssrEffect} />}
            <Bloom
                intensity={0.7}
                mipmapBlur
                luminanceThreshold={0.25}
                luminanceSmoothing={0.8}
                blendFunction={BlendFunction.SCREEN}
            />
            <ToneMapping
                mode={ToneMappingMode.ACES_FILMIC}
                exposure={1.1}
                adaptive={false}
            />
        </RPEffectComposer>
    );
};
