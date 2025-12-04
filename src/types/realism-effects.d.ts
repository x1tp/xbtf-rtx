declare module 'realism-effects' {
    import type { Scene, Camera, PerspectiveCamera } from 'three';
    import type { Effect, EffectComposer, Pass } from 'postprocessing';

    export interface SSGIOptions {
        distance?: number;
        thickness?: number;
        autoThickness?: boolean;
        maxRoughness?: number;
        blend?: number;
        denoiseIterations?: number;
        denoiseKernel?: number;
        denoiseDiffuse?: number;
        denoiseSpecular?: number;
        depthPhi?: number;
        normalPhi?: number;
        roughnessPhi?: number;
        envBlur?: number;
        importanceSampling?: boolean;
        directLightMultiplier?: number;
        steps?: number;
        refineSteps?: number;
        spp?: number;
        resolutionScale?: number;
        missedRays?: boolean;
    }

    export interface HBAOOptions {
        aoRadius?: number;
        distanceFalloff?: number;
        intensity?: number;
        bias?: number;
        thickness?: number;
        quality?: 'low' | 'medium' | 'high' | 'ultra';
    }

    export interface MotionBlurOptions {
        intensity?: number;
        jitter?: number;
        samples?: number;
    }

    export class VelocityDepthNormalPass extends Pass {
        constructor(scene: Scene, camera: Camera);
    }

    export class SSGIEffect extends Effect {
        constructor(
            scene: Scene,
            camera: PerspectiveCamera,
            velocityDepthNormalPass: VelocityDepthNormalPass,
            options?: SSGIOptions
        );
    }

    export class TRAAEffect extends Effect {
        constructor(
            scene: Scene,
            camera: PerspectiveCamera,
            velocityDepthNormalPass: VelocityDepthNormalPass
        );
    }

    export class MotionBlurEffect extends Effect {
        constructor(
            velocityDepthNormalPass: VelocityDepthNormalPass,
            options?: MotionBlurOptions
        );
    }

    export class HBAOEffect extends Effect {
        constructor(
            composer: EffectComposer,
            camera: PerspectiveCamera,
            scene: Scene,
            options?: HBAOOptions
        );
    }

    export class SSAOEffect extends Effect {
        constructor(
            camera: PerspectiveCamera,
            normalPass: Pass,
            options?: object
        );
    }
}
