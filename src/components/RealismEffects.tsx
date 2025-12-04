import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as POSTPROCESSING from 'postprocessing';
import { SSGIEffect, TRAAEffect, MotionBlurEffect, VelocityDepthNormalPass, HBAOEffect } from 'realism-effects';
import type { WebGLRenderer, Scene, PerspectiveCamera } from 'three';
import { useGameStore } from '../store/gameStore';

export interface RealismEffectsProps {
    /** Enable Screen Space Global Illumination */
    ssgi?: boolean;
    /** Enable Temporal Reprojection Anti-Aliasing */
    traa?: boolean;
    /** Enable Motion Blur */
    motionBlur?: boolean;
    /** Enable Horizon-Based Ambient Occlusion */
    hbao?: boolean;
    /** Enable Bloom */
    bloom?: boolean;
    /** SSGI options override */
    ssgiOptions?: Partial<SSGIOptions>;
    /** Motion blur intensity (0-1) */
    motionBlurIntensity?: number;
}

interface SSGIOptions {
    distance: number;
    thickness: number;
    autoThickness: boolean;
    maxRoughness: number;
    blend: number;
    denoiseIterations: number;
    denoiseKernel: number;
    denoiseDiffuse: number;
    denoiseSpecular: number;
    depthPhi: number;
    normalPhi: number;
    roughnessPhi: number;
    envBlur: number;
    importanceSampling: boolean;
    directLightMultiplier: number;
    steps: number;
    refineSteps: number;
    spp: number;
    resolutionScale: number;
    missedRays: boolean;
}

const DEFAULT_SSGI_OPTIONS: Partial<SSGIOptions> = {
    distance: 10,
    thickness: 10,
    autoThickness: false,
    maxRoughness: 1,
    blend: 0.9,
    denoiseIterations: 1,
    denoiseKernel: 2,
    denoiseDiffuse: 10,
    denoiseSpecular: 10,
    depthPhi: 2,
    normalPhi: 50,
    roughnessPhi: 1,
    envBlur: 0.5,
    importanceSampling: true,
    directLightMultiplier: 1,
    steps: 20,
    refineSteps: 5,
    spp: 1,
    resolutionScale: 1,
    missedRays: false,
};

/**
 * RealismEffects - A component that integrates realism-effects library with R3F
 * 
 * NOTE: This library is designed for indoor/architectural scenes.
 * For space games with large scales and logarithmic depth buffers, the effects
 * may not work well:
 * - SSGI: Doesn't work with logarithmic depth buffer
 * - TRAA: Causes visible jittering/shakiness when camera is stationary
 * - HBAO: Not useful for space scenes (designed for close-range AO)
 * 
 * Consider using SimpleEffects (SMAA + Bloom) instead for space scenes.
 */
export const RealismEffects: React.FC<RealismEffectsProps> = ({
    ssgi = false,
    traa = true,
    motionBlur = false,
    hbao = true,
    bloom = true,
    ssgiOptions = {},
    motionBlurIntensity = 0.5,
}) => {
    const { gl, scene, camera, size } = useThree();
    const composerRef = useRef<POSTPROCESSING.EffectComposer | null>(null);
    const isReadyRef = useRef(false);

    // Store references to effects for potential GUI integration
    const effectsRef = useRef<{
        ssgi?: SSGIEffect;
        traa?: TRAAEffect;
        motionBlur?: MotionBlurEffect;
        hbao?: HBAOEffect;
        velocityPass?: VelocityDepthNormalPass;
    }>({});

    const sunIntensity = useGameStore((s) => s.sunIntensity);
    const sunVisible = useGameStore((s) => s.sunVisible);

    // Merged SSGI options
    const mergedSsgiOptions = useMemo(() => ({
        ...DEFAULT_SSGI_OPTIONS,
        ...ssgiOptions,
    }), [ssgiOptions]);

    // Dynamic bloom intensity based on sun visibility
    const bloomIntensity = useMemo(() => {
        return 0.9 + (sunVisible ? sunIntensity * 1.25 : 0);
    }, [sunVisible, sunIntensity]);

    // Disable R3F's internal rendering - we'll handle it with our composer
    useEffect(() => {
        if (!gl) return;
        const renderer = gl as WebGLRenderer;
        // Store original state
        const originalAutoClear = renderer.autoClear;
        // Disable auto-clearing so our composer can take over
        renderer.autoClear = false;
        
        return () => {
            renderer.autoClear = originalAutoClear;
        };
    }, [gl]);

    // Initialize composer and effects
    useEffect(() => {
        if (!gl || !scene || !camera) return;

        const perspCamera = camera as PerspectiveCamera;
        
        // Create effect composer
        const composer = new POSTPROCESSING.EffectComposer(gl as WebGLRenderer);
        composerRef.current = composer;

        // Velocity/Depth/Normal pass - required for TRAA, Motion Blur, and SSGI
        const velocityDepthNormalPass = new VelocityDepthNormalPass(scene as Scene, perspCamera);
        composer.addPass(velocityDepthNormalPass);
        effectsRef.current.velocityPass = velocityDepthNormalPass;

        // If not using SSGI, we need a RenderPass to render the scene
        // SSGI does its own rendering internally
        // Always add a RenderPass first - SSGI in realism-effects v1 doesn't do its own scene rendering
        const renderPass = new POSTPROCESSING.RenderPass(scene as Scene, perspCamera);
        composer.addPass(renderPass);

        const effects: POSTPROCESSING.Effect[] = [];

        // SSGI Effect - Screen Space Global Illumination
        if (ssgi) {
            try {
                const ssgiEffect = new SSGIEffect(
                    scene as Scene,
                    perspCamera,
                    velocityDepthNormalPass,
                    mergedSsgiOptions
                );
                effectsRef.current.ssgi = ssgiEffect;
                effects.push(ssgiEffect);
                console.log('[RealismEffects] SSGI enabled');
            } catch (e) {
                console.warn('[RealismEffects] SSGI initialization failed:', e);
            }
        }

        // HBAO Effect - Horizon-Based Ambient Occlusion
        // Tuned for large-scale space scenes
        if (hbao) {
            try {
                const hbaoEffect = new HBAOEffect(composer, perspCamera, scene as Scene, {
                    aoRadius: 0.5,          // Smaller radius for space (was 2)
                    distanceFalloff: 0.5,   // Faster falloff (was 1)
                    intensity: 0.5,         // Subtler effect (was 1)
                    bias: 0.01,             // Less bias (was 0.025)
                    thickness: 0.5,         // Thinner (was 1)
                    quality: 'low',         // Lower quality for performance
                });
                effectsRef.current.hbao = hbaoEffect;
                effects.push(hbaoEffect);
                console.log('[RealismEffects] HBAO enabled');
            } catch (e) {
                console.warn('[RealismEffects] HBAO initialization failed:', e);
            }
        }

        // TRAA Effect - Temporal Reprojection Anti-Aliasing
        if (traa) {
            try {
                const traaEffect = new TRAAEffect(scene as Scene, perspCamera, velocityDepthNormalPass);
                effectsRef.current.traa = traaEffect;
                effects.push(traaEffect);
                console.log('[RealismEffects] TRAA enabled');
            } catch (e) {
                console.warn('[RealismEffects] TRAA initialization failed:', e);
            }
        }

        // Motion Blur Effect
        if (motionBlur) {
            try {
                const motionBlurEffect = new MotionBlurEffect(velocityDepthNormalPass, {
                    intensity: motionBlurIntensity,
                    jitter: 1,
                    samples: 16,
                });
                effectsRef.current.motionBlur = motionBlurEffect;
                effects.push(motionBlurEffect);
                console.log('[RealismEffects] Motion Blur enabled');
            } catch (e) {
                console.warn('[RealismEffects] Motion Blur initialization failed:', e);
            }
        }

        // Bloom Effect
        if (bloom) {
            const bloomEffect = new POSTPROCESSING.BloomEffect({
                intensity: bloomIntensity,
                luminanceThreshold: 0.18,
                luminanceSmoothing: 0.08,
                mipmapBlur: true,
            });
            effects.push(bloomEffect);
        }

        // Tone Mapping
        const toneMappingEffect = new POSTPROCESSING.ToneMappingEffect({
            mode: POSTPROCESSING.ToneMappingMode.ACES_FILMIC,
        });
        effects.push(toneMappingEffect);

        // Add effect pass with all effects
        if (effects.length > 0) {
            const effectPass = new POSTPROCESSING.EffectPass(perspCamera, ...effects);
            composer.addPass(effectPass);
        }

        // Handle resize
        composer.setSize(size.width, size.height);

        isReadyRef.current = true;

        return () => {
            composer.dispose();
            composerRef.current = null;
            effectsRef.current = {};
            isReadyRef.current = false;
        };
    }, [gl, scene, camera, ssgi, traa, motionBlur, hbao, bloom, mergedSsgiOptions, motionBlurIntensity, bloomIntensity, size.width, size.height]);

    // Take over rendering from R3F completely
    useFrame(() => {
        if (composerRef.current && isReadyRef.current) {
            composerRef.current.render();
        }
    }, 1);

    // This component doesn't render anything - it takes over rendering via the composer
    return null;
};

/**
 * Lightweight version with just TRAA for better anti-aliasing
 * HBAO disabled - not useful for large-scale space scenes
 */
export const RealismEffectsLite: React.FC = () => {
    return (
        <RealismEffects
            ssgi={false}
            traa={true}
            motionBlur={false}
            hbao={false}
            bloom={true}
        />
    );
};

/**
 * Full quality version with motion blur
 * SSGI disabled - doesn't work well with space scenes / logarithmic depth buffer
 * HBAO disabled for space scenes
 */
export const RealismEffectsFull: React.FC = () => {
    return (
        <RealismEffects
            ssgi={false}
            traa={true}
            motionBlur={true}
            hbao={false}
            bloom={true}
            motionBlurIntensity={0.5}
        />
    );
};

export default RealismEffects;
