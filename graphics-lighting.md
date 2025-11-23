# XBTF-RTX Graphics & Lighting Improvement Research

**Date**: 2025-11-21

## Current Pipeline (Summary)
- Path tracing overlay uses `three-gpu-pathtracer` with WebGL2 + BVH, 5 bounces, glossy filter and tiled rendering in `src/components/PathTracerOverlay.tsx:118–140` and accumulation reset on camera movement in `src/components/PathTracerOverlay.tsx:164–179`.
- Raster post stack applies `N8AO`, `Bloom`, and `ToneMapping` when RTX overlay is off in `src/components/RTXEffects.tsx:11–24`.
- Materials and color space management are consistent:
  - Planet uses `MeshPhysicalMaterial` with SRGB/Linear maps, anisotropy and normal scaling in `src/components/Planet.tsx:63–78` and rotation updates in `src/components/Planet.tsx:114–120`.
  - Station/Cockpit assign generated PBR sets and emissive channels in `src/components/Station.tsx:61–71` and `src/components/Cockpit.tsx:81–104`.
- Lighting includes ambient fill, a sun directional light with shadows, and star field in `src/Scene.tsx:13–21` and `src/components/Sun.tsx:23–45`.
- Procedural/AI PBR pipeline exists (`scripts/generate-pbr.mjs:323–400`) with material specs in `scripts/*.json`.

## Recommendations

### WebGPU Renderer
- Integrate `WebGPURenderer` where supported for higher throughput and modern shader pipelines (TSL/WGSL). Keep WebGL2 fallback.
- R3F integration pattern: `import { WebGPURenderer } from 'three/webgpu'` and `<Canvas gl={canvas => new WebGPURenderer({ canvas })}>`.
- References: Three/WebGPU tutorial (https://sbcode.net/threejs/webgpu-renderer/), R3F integration status (https://github.com/Tresjs/tres/issues/883), renderer support discussion (https://discourse.threejs.org/t/currently-does-threejs-fully-support-the-webgpu-api/52592).

### Path Tracing Efficiency
- Adopt ReSTIR DI/GI for spatiotemporal reservoir resampling to dramatically cut noise at low spp in scenes with many emissive/point lights.
  - Start with screen-space reservoirs, temporal clamping, neighborhood spatial reuse; biased mode for added stability.
- Use `BlurredEnvMapGenerator` to preblur environment for faster convergence with softer reflections.
- Enable an interactive mode while moving (`dynamicLowRes = true` or reduced `renderScale`) and reset accumulation on stop, already supported in `PathTracerOverlay`.
- Prefer `setSceneAsync` and BVH worker for non-blocking geometry/material updates.
- References: ReSTIR overview (https://benedikt-bitterli.me/restir/), ReSTIR GI (https://research.nvidia.com/publication/2021-06_restir-gi-path-resampling-real-time-path-tracing), three-gpu-pathtracer API (https://github.com/gkjohnson/three-gpu-pathtracer).

### Denoising & Temporal Stability
- Add a denoiser to the path tracer output:
  - Initial: GLSL Smart Denoise as final pass (noted in three-gpu-pathtracer).
  - Advanced: SVGF (temporal accumulation + variance-guided A-Trous wavelet), maintaining motion vectors and G-buffer (normals, depth, object IDs) to prevent ghosting.
- References: SVGF (https://research.nvidia.com/publication/2017-07_spatiotemporal-variance-guided-filtering-real-time-reconstruction-path-traced), SVGF implementations (https://github.com/jacquespillet/SVGF, https://github.com/HummaWhite/Project4-CUDA-Denoiser).

### Raster Enhancements (RTX-Off)
- Add SSR for glossy reflections and SSGI for diffuse bounce, alongside `N8AO` and `Bloom`.
- Use SMAA for AA with AO active; tune AO resolution and enable depth-aware upsampling.
- References: React Postprocessing SSAO docs (https://react-postprocessing.docs.pmnd.rs/effects/ssao), postprocessing overview (https://www.balazsfarago.dev/blog/postprocessing-react-three-fibe), examples (https://codesandbox.io/examples/package/@react-three/postprocessing).

### Lighting & Shadows
- Replace single-frustum sun shadows with Cascaded Shadow Maps (CSM) for stable large-distance shadows.
- Consider subtle volumetrics (god rays/fog) to enhance solar feel without heavy cost.

### Color Pipeline & Tone Mapping
- Unify renderer output color space and tone mapping across raster and path tracer:
  - Set `renderer.outputColorSpace = SRGBColorSpace` and consistent tone mapping/exposure on the main canvas.
  - Consider AgX or Khronos PBR Neutral when ACES hue shifts are undesirable; ACES remains fine for cinematic looks.
- References: Tone mapping overview and hue shift discussion (https://discourse.threejs.org/t/tone-mapping-overview/75204, https://discourse.threejs.org/t/pmndrs-post-processing-tone-mapping-guidance/59374).

### Environment & Materials
- Use HDRI IBL (`<Environment/>`) in the main scene (not just viewer) with PMREM prefiltering.
- Keep texture color spaces consistent (SRGB for albedo, Linear for data maps) as in Planet/Station.

## Quick Wins
- Enable SSR + SMAA and tune N8AO.
- Add HDRI environment to the main scene and align tone mapping/exposure between raster and path tracer.
- Use blurred env map in the path tracer and interactive low-res sampling while moving.

## Mid Term
- Integrate a denoiser (GLSL Smart Denoise → SVGF) and maintain motion vectors/G-buffer.
- Switch sun to CSM.

## Long Term
- Integrate ReSTIR DI/GI into the path tracer overlay.
- Migrate to WebGPU renderer where supported; keep WebGL2 fallback.
- Consider a WebGPU path tracer aligned with OpenPBR; existing work demonstrates near real-time viability (https://arxiv.org/html/2407.19977v1).

## Code References
- Path tracer setup and parameters: `src/components/PathTracerOverlay.tsx:118–140`.
- Accumulation reset on camera change: `src/components/PathTracerOverlay.tsx:164–179`.
- Raster post stack (AO, Bloom, ToneMapping): `src/components/RTXEffects.tsx:11–24`.
- Planet material and texture color spaces: `src/components/Planet.tsx:63–78`.
- Station material application: `src/components/Station.tsx:61-71`.
- Sun directional light + shadows: `src/components/Sun.tsx:23-45`.

## References (External)
- Three.js WebGPU renderer tutorial: https://sbcode.net/threejs/webgpu-renderer/
- R3F WebGPU integration (r171): https://github.com/Tresjs/tres/issues/883
- WebGPU renderer support discussion: https://discourse.threejs.org/t/currently-does-threejs-fully-support-the-webgpu-api/52592
- ReSTIR (DI) overview: https://benedikt-bitterli.me/restir/
- ReSTIR GI (HPG 2021): https://research.nvidia.com/publication/2021-06_restir-gi-path-resampling-real-time-path-tracing
- SVGF (HPG 2017): https://research.nvidia.com/publication/2017-07_spatiotemporal-variance-guided-filtering-real-time-reconstruction-path-traced
- SVGF implementations: https://github.com/jacquespillet/SVGF, https://github.com/HummaWhite/Project4-CUDA-Denoiser
- three-gpu-pathtracer repo: https://github.com/gkjohnson/three-gpu-pathtracer
- React postprocessing SSAO docs: https://react-postprocessing.docs.pmnd.rs/effects/ssao
- Postprocessing overview and AO/AA guidance: https://www.balazsfarago.dev/blog/postprocessing-react-three-fibe
- Tone mapping overview and guidance: https://discourse.threejs.org/t/tone-mapping-overview/75204, https://discourse.threejs.org/t/pmndrs-post-processing-tone-mapping-guidance/59374

## New Implementation Ideas

### Physical Sky & Atmosphere
- Implement a Hosek-Wilkie/Hillaire sky: use a CPU precompute for transmittance/irradiance LUTs or leverage `Sky` shader as baseline; drive sun direction/intensity from `src/components/Sun.tsx` so raster and path tracer share the same celestial data.
- Bind the sky to both pipelines: set `<Environment map={pmremFromSky} background />` in raster (`src/Scene.tsx` or `src/components/RTXEffects.tsx`) and feed the same env/gradient into the path tracer background.
- Add aerial perspective: exponential height fog with view-height falloff; apply in raster post and as a participating medium term in the path tracer for long vistas.
- Provide controls: turbidity, ground albedo, rayleigh/mie scale, exposure; sync with tone mapping.

### Volumetrics (Fog/God Rays)
- Lightweight froxel grid: build low-res volume aligned to camera frustum; integrate forward scattering using sun light/shadow map; reuse depth + temporal reprojection to stabilize.
- Sun shafts: modulate scattering by sun shadow/CSM to avoid overbright regions; clamp phase function to keep performance stable. Blur pass for shafts to reduce banding.
- Cost controls: adjustable froxel resolution, bilateral upscale, and temporal accumulation reset on rapid camera moves; debug view for volume weight/shafts.
- Pipeline placement: insert volumetric resolve before bloom/tone mapping in raster; for path tracer, approximate a single-scatter medium or disable when RTX overlay is active if perf-bound.
