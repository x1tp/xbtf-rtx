import React, { useMemo, useEffect, useState, useRef } from 'react';
import { Sphere } from '@react-three/drei';
import * as THREE from 'three';
import { TextureLoader, SRGBColorSpace, LinearSRGBColorSpace, ClampToEdgeWrapping, RepeatWrapping } from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { ensureRapier, getWorld, getWorldSync } from '../physics/RapierWorld';
import type RAPIERType from '@dimforge/rapier3d-compat';
import { AtmosphereShader } from '../shaders/AtmosphereShader';
import { useGameStore } from '../store/gameStore';
import type { PlanetDatabaseEntry } from '../config/planetDatabase';

type AtmosphereParams = {
    rimPower?: number;
    rayleigh?: number;
    mie?: number;
    forwardG?: number;
    noiseScale?: number;
    noiseAmp?: number;
    radiusMul?: number;
    innerColor?: string;
    outerColor?: string;
    sunMaskMin?: number;
    sunMaskMax?: number;
};
type CloudsParams = {
    enabled?: boolean;
    opacity?: number;
    alphaTest?: number;
};
type CloudUniforms = {
    uMask: { value: THREE.Texture | null };
    uTime: { value: number };
    uOpacity: { value: number };
    uAlphaTest: { value: number };
    uLightDir: { value: THREE.Vector3 };
};
interface PlanetProps {
    position: [number, number, number];
    size: number;
    color: string; // Kept for fallback, but textures override this
    onTexturesLoaded?: () => void;
    hdr?: boolean;
    sunPosition?: [number, number, number];
    atmosphereParams?: AtmosphereParams;
    cloudsParams?: CloudsParams;
    atmosphereEnabled?: boolean;
    config?: PlanetDatabaseEntry;
}

export const Planet: React.FC<PlanetProps> = ({ position, size, onTexturesLoaded, cloudsParams, atmosphereEnabled = true, sunPosition, config }) => {
    const surfaceShaderUniformsRef = useRef<Record<string, { value: unknown }> | null>(null);

    // 1. THE EARTH SURFACE MATERIAL
    // We removed clearcoat because it makes land look like plastic.
    // We rely entirely on the roughnessMap to make oceans shiny and land matte.
    const onBeforeCompile = useMemo(() => {
        return (shader: Parameters<THREE.Material['onBeforeCompile']>[0]) => {
            (shader.uniforms as Record<string, { value: unknown }>).cloudsMap = { value: null };
            (shader.uniforms as Record<string, { value: unknown }>).cloudShadowOffset = { value: 0 };
            surfaceShaderUniformsRef.current = shader.uniforms as Record<string, { value: unknown }>;
            shader.fragmentShader = shader.fragmentShader.replace(
                '#include <common>',
                '#include <common>\nuniform sampler2D cloudsMap;\nuniform float cloudShadowOffset;'
            );
            shader.fragmentShader = shader.fragmentShader.replace(
                '#include <map_fragment>',
                '#include <map_fragment>\n#ifdef USE_UV\nvec4 cloudColor = texture2D(cloudsMap, vec2(vUv.x + cloudShadowOffset, vUv.y));\ndiffuseColor.rgb *= (1.0 - cloudColor.r * 0.6);\n#endif'
            );
            shader.fragmentShader = shader.fragmentShader.replace(
                '#include <output_fragment>',
                'vec3 viewDir = normalize(-vViewPosition);\nfloat viewDot = clamp(dot(normal, viewDir), 0.0, 1.0);\nfloat horizonHaze = pow(1.0 - viewDot, 1.5);\nvec3 hazeTint = vec3(0.55, 0.63, 0.78);\ndiffuseColor.rgb = mix(diffuseColor.rgb, hazeTint, horizonHaze * 0.32);\n#include <output_fragment>'
            );
        };
    }, []);

    // 2. THE CLOUD MATERIAL
    // Clouds
    const initialCloudOpacity = (cloudsParams && typeof cloudsParams.opacity === 'number') ? cloudsParams.opacity : 1.0;
    const initialCloudAlphaTest = (cloudsParams && typeof cloudsParams.alphaTest === 'number') ? cloudsParams.alphaTest : 0.0;
    const [earthMap, setEarthMap] = useState<THREE.Texture | null>(null);
    const [earthRough, setEarthRough] = useState<THREE.Texture | null>(null);
    const [earthBump, setEarthBump] = useState<THREE.Texture | null>(null);
    const [earthNormal, setEarthNormal] = useState<THREE.Texture | null>(null);
    const [cloudTex, setCloudTex] = useState<THREE.Texture | null>(null);
    const [cloudOpacity, setCloudOpacity] = useState<number>(initialCloudOpacity);
    const [cloudAlphaTest] = useState<number>(initialCloudAlphaTest);

    const cloudShaderMaterial = useMemo(() => {
        return new THREE.ShaderMaterial({
            uniforms: {
                uMask: { value: null as unknown as THREE.Texture | null },
                uTime: { value: 0 },
                uOpacity: { value: initialCloudOpacity },
                uAlphaTest: { value: initialCloudAlphaTest },
                uLightDir: { value: new THREE.Vector3(1, 0, 0) }
            },
            vertexShader: `
                varying vec2 vUv;
                varying vec3 vN;
                void main(){
                    vUv = uv;
                    vN = normalize(normalMatrix * normal);
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
                }
            `,
            fragmentShader: `
                uniform sampler2D uMask;
                uniform float uTime;
                uniform float uOpacity;
                uniform float uAlphaTest;
                uniform vec3 uLightDir;
                varying vec2 vUv;
                varying vec3 vN;
                float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453123); }
                float noise(vec2 p){ vec2 i = floor(p); vec2 f = fract(p); vec2 u = f*f*(3.0-2.0*f); float a = hash(i); float b = hash(i+vec2(1.0,0.0)); float c = hash(i+vec2(0.0,1.0)); float d = hash(i+vec2(1.0,1.0)); return mix(mix(a,b,u.x), mix(c,d,u.x), u.y); }
                float fbm(vec2 p){ float v=0.0; float a=0.5; for(int i=0;i<5;i++){ v+=noise(p)*a; p*=2.0; a*=0.5; } return v; }
                void main(){
                    vec2 uv = vUv;
                    float t = uTime * 0.08;
                    vec2 wind = vec2(0.06, -0.03);
                    vec2 p = uv * 4.0 + wind * t;
                    float f1 = fbm(p);
                    float f2 = fbm(p * 1.7 + vec2(19.3, 7.1));
                    float detail = clamp(f1*0.6 + f2*0.4, 0.0, 1.0);
                    float mask = texture2D(uMask, uv).r;
                    float base = clamp(mask * 0.85 + detail * 0.85, 0.0, 1.0);
                    float density = clamp(base, 0.0, 1.0);
                    float lambert = clamp(dot(normalize(uLightDir), normalize(vN)), 0.0, 1.0);
                    float phase = pow(1.0 - lambert, 3.0);
                    vec3 baseCol = vec3(0.96, 0.98, 1.0);
                    vec3 col = baseCol * (0.55 + 0.45 * lambert) + vec3(0.04,0.05,0.06) * phase;
                    col = mix(col, vec3(1.0), 0.5);
                    float alpha = clamp(density * uOpacity, 0.0, 1.0);
                    if(alpha <= uAlphaTest) discard;
                    gl_FragColor = vec4(col, alpha);
                }
            `,
            transparent: true,
            side: THREE.DoubleSide,
            depthWrite: false
        });
    }, [initialCloudOpacity, initialCloudAlphaTest]);
    const cloudUniformsRef = useRef<CloudUniforms | null>(null);
    useEffect(() => { cloudUniformsRef.current = cloudShaderMaterial.uniforms as CloudUniforms; }, [cloudShaderMaterial]);

    const [ready, setReady] = useState(false);
    const { gl } = useThree();
    const timeScale = useGameStore((state) => state.timeScale);
    const currentSectorId = useGameStore((s) => s.currentSectorId);
    const rotationSpeedRef = useRef<number>(config?.rotationSpeed ?? 0.001);
    const cloudRotationSpeedRef = useRef<number>(config?.cloudRotationSpeed ?? 0.004);

    useEffect(() => {
        const run = async () => {
        const maxAnisotropy = gl.capabilities.getMaxAnisotropy();
        const setupTexture = (t: THREE.Texture | null, isColor: boolean) => {
            if (!t) return;
            t.colorSpace = isColor ? SRGBColorSpace : LinearSRGBColorSpace;
            t.wrapS = RepeatWrapping;
            t.wrapT = ClampToEdgeWrapping;
            t.offset.x = 0.0005;
            t.repeat.set(0.999, 1);
            t.anisotropy = maxAnisotropy;
            t.generateMipmaps = true;
        };
        const tryLoadDisk = async (folder: string) => {
            const loader = new TextureLoader();
            const paths = [
                `/materials/${folder}/baseColor.png`,
                `/materials/${folder}/roughness.png`,
                `/materials/${folder}/normal.png`,
                `/materials/${folder}/cloudsAlpha.png`
            ];
            const [map, rough, normal, cloudsAlpha] = await Promise.all(paths.map((p) => loader.loadAsync(p).catch(() => null)));
            if (!map && !rough && !normal && !cloudsAlpha) return false;
            if (map) { setupTexture(map as THREE.Texture, true); setEarthMap(map as THREE.Texture); }
            if (rough) { setupTexture(rough as THREE.Texture, false); setEarthRough(rough as THREE.Texture); }
            if (normal) { setupTexture(normal as THREE.Texture, false); setEarthNormal(normal as THREE.Texture); }
            if (cloudsAlpha) { setupTexture(cloudsAlpha as THREE.Texture, false); setCloudTex(cloudsAlpha as THREE.Texture); }
            setCloudOpacity(typeof cloudsParams?.opacity === 'number' ? cloudsParams.opacity : (config?.cloudOpacity ?? 0.8));
            setReady(true);
            onTexturesLoaded?.();
            return true;
        };
        const gen = (cfg: PlanetDatabaseEntry) => {
            const w = 1024, h = 512;
            const baseCanvas = document.createElement('canvas');
            baseCanvas.width = w; baseCanvas.height = h;
            const roughCanvas = document.createElement('canvas');
            roughCanvas.width = w; roughCanvas.height = h;
            const bumpCanvas = document.createElement('canvas');
            bumpCanvas.width = w; bumpCanvas.height = h;
            const cloudsCanvas = document.createElement('canvas');
            cloudsCanvas.width = w; cloudsCanvas.height = h;
            const baseCtx = baseCanvas.getContext('2d');
            const roughCtx = roughCanvas.getContext('2d');
            const bumpCtx = bumpCanvas.getContext('2d');
            const cloudsCtx = cloudsCanvas.getContext('2d');
            if (!baseCtx || !roughCtx || !bumpCtx || !cloudsCtx) return null;
            const s = cfg.seed >>> 0;
            const hash = (x: number, y: number) => {
                let n = x * 374761393 + y * 668265263 + s * 69069;
                n = (n ^ (n >>> 13)) * 1274126177;
                n = n ^ (n >>> 16);
                return (n >>> 0) / 4294967295;
            };
            const vnoise = (x: number, y: number) => {
                const xi = Math.floor(x), yi = Math.floor(y);
                const xf = x - xi, yf = y - yi;
                const u = xf * xf * (3 - 2 * xf);
                const v = yf * yf * (3 - 2 * yf);
                const a = hash(xi, yi);
                const b = hash(xi + 1, yi);
                const c = hash(xi, yi + 1);
                const d = hash(xi + 1, yi + 1);
                const m = (a * (1 - u) + b * u);
                const n = (c * (1 - u) + d * u);
                return m * (1 - v) + n * v;
            };
            const fbm = (x: number, y: number, oct: number) => {
                let val = 0, amp = 0.5, freq = 1;
                for (let i = 0; i < oct; i++) {
                    val += vnoise(x * freq, y * freq) * amp;
                    amp *= 0.5; freq *= 2;
                }
                return val;
            };
            const pal = cfg.colorPalette.map((c) => {
                const r = parseInt(c.slice(1, 3), 16), g = parseInt(c.slice(3, 5), 16), b = parseInt(c.slice(5, 7), 16);
                return [r, g, b] as [number, number, number];
            });
            const ocean = pal[0];
            const landLow = pal[2];
            const landMid = pal[3];
            const landHigh = pal[4];
            const ns = cfg.noiseScale;
            const wl = cfg.waterLevel;
            const landR = Math.max(0, Math.min(1, cfg.landRoughness));
            const oceanR = Math.max(0, Math.min(1, cfg.oceanRoughness));
            const cloudD = cfg.cloudDensity;
            const cloudO = cfg.cloudOpacity;
            const baseImg = baseCtx.createImageData(w, h);
            const roughImg = roughCtx.createImageData(w, h);
            const bumpImg = bumpCtx.createImageData(w, h);
            const cloudsImg = cloudsCtx.createImageData(w, h);
            for (let y = 0; y < h; y++) {
                const v = y / h;
                for (let x = 0; x < w; x++) {
                    const u = x / w;
                    const px = u * ns * 4;
                    const py = v * ns * 2;
                    const h1 = fbm(px, py, 5);
                    const h2 = fbm(px * 0.5 + 37.1, py * 0.5 + 91.7, 4);
                    const height = Math.max(0, Math.min(1, 0.6 * h1 + 0.4 * h2));
                    const isWater = height < wl;
                    let r = 0, g = 0, b = 0;
                    if (isWater) {
                        const t = Math.pow((wl - height) / Math.max(wl, 1e-3), 0.5);
                        r = ocean[0] * (0.7 + 0.3 * t);
                        g = ocean[1] * (0.7 + 0.3 * t);
                        b = ocean[2] * (0.8 + 0.2 * t);
                    } else {
                        const t = (height - wl) / Math.max(1e-3, 1 - wl);
                        if (t < 0.4) {
                            r = landLow[0] * (0.9 + 0.1 * t);
                            g = landLow[1] * (0.9 + 0.1 * t);
                            b = landLow[2] * (0.9 + 0.1 * t);
                        } else if (t < 0.75) {
                            const k = (t - 0.4) / 0.35;
                            r = landLow[0] * (1 - k) + landMid[0] * k;
                            g = landLow[1] * (1 - k) + landMid[1] * k;
                            b = landLow[2] * (1 - k) + landMid[2] * k;
                        } else {
                            const k = (t - 0.75) / 0.25;
                            r = landMid[0] * (1 - k) + landHigh[0] * k;
                            g = landMid[1] * (1 - k) + landHigh[1] * k;
                            b = landMid[2] * (1 - k) + landHigh[2] * k;
                        }
                    }
                    const i = (y * w + x) * 4;
                    baseImg.data[i] = Math.max(0, Math.min(255, Math.round(r)));
                    baseImg.data[i + 1] = Math.max(0, Math.min(255, Math.round(g)));
                    baseImg.data[i + 2] = Math.max(0, Math.min(255, Math.round(b)));
                    baseImg.data[i + 3] = 255;
                    const rough = isWater ? oceanR : landR;
                    const roughV = Math.max(0, Math.min(255, Math.round(rough * 255)));
                    roughImg.data[i] = roughV;
                    roughImg.data[i + 1] = roughV;
                    roughImg.data[i + 2] = roughV;
                    roughImg.data[i + 3] = 255;
                    const bumpV = Math.max(0, Math.min(255, Math.round(height * 255)));
                    bumpImg.data[i] = bumpV;
                    bumpImg.data[i + 1] = bumpV;
                    bumpImg.data[i + 2] = bumpV;
                    bumpImg.data[i + 3] = 255;
                    const c1 = fbm(px * 1.7 + 11.4, py * 1.7 + 29.3, 4);
                    const c2 = fbm(px * 3.1 + 97.8, py * 3.1 + 73.2, 3);
                    const cloudsV = Math.max(0, Math.min(1, 0.5 * c1 + 0.5 * c2));
                    const mask = cloudsV > (1.0 - cloudD) ? 255 : Math.round(cloudsV * cloudD * 255);
                    cloudsImg.data[i] = mask;
                    cloudsImg.data[i + 1] = mask;
                    cloudsImg.data[i + 2] = mask;
                    cloudsImg.data[i + 3] = Math.round(cloudO * mask);
                }
            }
            baseCtx.putImageData(baseImg, 0, 0);
            roughCtx.putImageData(roughImg, 0, 0);
            bumpCtx.putImageData(bumpImg, 0, 0);
            cloudsCtx.putImageData(cloudsImg, 0, 0);
            const baseTex = new THREE.CanvasTexture(baseCanvas);
            const roughTex = new THREE.CanvasTexture(roughCanvas);
            const bumpTex = new THREE.CanvasTexture(bumpCanvas);
            const cloudsTex = new THREE.CanvasTexture(cloudsCanvas);
            return { baseTex, roughTex, bumpTex, cloudsTex };
        };
        const diskFolderCandidates = [
            currentSectorId ? `planet_${currentSectorId}` : '',
            'planet_earth'
        ].filter(Boolean);
        let loadedFromDisk = false;
        for (const f of diskFolderCandidates) {
            const ok = await tryLoadDisk(f);
            if (ok) { loadedFromDisk = true; break; }
        }
        if (!loadedFromDisk && config) {
            const t = gen(config);
            if (t) {
                setupTexture(t.baseTex, true);
                setupTexture(t.roughTex, false);
                setupTexture(t.bumpTex, false);
                setupTexture(t.cloudsTex, false);
                queueMicrotask(() => {
                    setEarthMap(t.baseTex);
                    setEarthRough(t.roughTex);
                    setEarthBump(t.bumpTex);
                    setCloudTex(t.cloudsTex);
                    setCloudOpacity(config.cloudOpacity);
                    setReady(true);
                    onTexturesLoaded?.();
                    if (cloudUniformsRef.current) {
                        cloudUniformsRef.current.uMask.value = t.cloudsTex;
                    }
                });
                return;
            }
        }
        if (!loadedFromDisk) {
            const ok = await tryLoadDisk('planet_earth');
            if (!ok) setReady(true);
        }
        };
        run();
    }, [onTexturesLoaded, gl, config, currentSectorId, cloudsParams]);

    useEffect(() => {
        if (cloudUniformsRef.current) {
            cloudUniformsRef.current.uOpacity.value = cloudOpacity;
            cloudUniformsRef.current.uAlphaTest.value = cloudAlphaTest;
        }
    }, [cloudOpacity, cloudAlphaTest]);

    useEffect(() => {
        if (cloudUniformsRef.current) {
            cloudUniformsRef.current.uMask.value = cloudTex || null;
        }
    }, [cloudTex]);

    const planetRef = useRef<THREE.Group>(null);
    const cloudsRef = useRef<THREE.Mesh>(null);
    const planetBodyRef = useRef<RAPIERType.RigidBody | null>(null);


    useFrame((_, rawDelta) => {
        const delta = rawDelta * timeScale;
        if (planetRef.current) {
            planetRef.current.rotation.y += delta * rotationSpeedRef.current;
        }
        if (cloudsRef.current) {
            cloudsRef.current.rotation.y += delta * cloudRotationSpeedRef.current;
        }

        // Update Cloud Shadows
        if (surfaceShaderUniformsRef.current && cloudsRef.current && planetRef.current) {
            const uniforms = surfaceShaderUniformsRef.current;
            const cloudRot = cloudsRef.current.rotation.y;
            const planetRot = planetRef.current.rotation.y;

            const offset = (cloudRot - planetRot) / (2 * Math.PI);
            uniforms.cloudShadowOffset.value = -offset;
            if (!uniforms.cloudsMap.value && cloudTex) {
                uniforms.cloudsMap.value = cloudTex;
            }
        }

        if (cloudUniformsRef.current && cloudsRef.current) {
            cloudUniformsRef.current.uTime.value += delta;
            const sunVec = new THREE.Vector3(...(sunPosition || [1000,0,0]));
            cloudsRef.current.worldToLocal(sunVec);
            cloudUniformsRef.current.uLightDir.value.copy(sunVec).normalize();
        }

        if (planetBodyRef.current && planetRef.current) {
            const p = new THREE.Vector3().fromArray(position);
            planetBodyRef.current.setTranslation({ x: p.x, y: p.y, z: p.z }, true);
        }
    });

    useEffect(() => {
        let cancelled = false;
        (async () => {
            const RAPIER = await ensureRapier();
            if (cancelled) return;
            const world = await getWorld();
            if (cancelled) return;
            const bodyDesc = RAPIER.RigidBodyDesc.fixed();
            const body = world.createRigidBody(bodyDesc);
            const collDesc = RAPIER.ColliderDesc.ball(size);
            world.createCollider(collDesc, body);
            if (cancelled) {
                world.removeRigidBody(body);
                return;
            }
            planetBodyRef.current = body;
        })();
        return () => {
            cancelled = true;
            if (planetBodyRef.current) {
                const w = getWorldSync();
                if (w) {
                    w.removeRigidBody(planetBodyRef.current);
                }
                planetBodyRef.current = null;
            }
        };
    }, [size]);

    return (
        <group position={position} name="PlanetGroup">
            {/* EARTH */}
            <group ref={planetRef} name="Planet">
                <Sphere args={[size, 128, 128]} castShadow receiveShadow>
                    <meshPhysicalMaterial
                        color={new THREE.Color(0xffffff)}
                        roughness={1.0}
                        metalness={0.0}
                        ior={1.5}
                        sheen={0.0}
                        sheenRoughness={1.0}
                        specularIntensity={0.1}
                        map={earthMap || undefined}
                        roughnessMap={earthRough || undefined}
                        bumpMap={earthBump || undefined}
                        bumpScale={config?.bumpIntensity ?? 0.6}
                        normalMap={earthNormal || undefined}
                        normalScale={new THREE.Vector2(0.8, 0.8)}
                        onBeforeCompile={onBeforeCompile}
                    />
                </Sphere>
                {/* CLOUDS */}
                {/* Slightly larger to avoid z-fighting with the surface */}
                {ready && ((cloudsParams?.enabled ?? true)) && (
                    <Sphere ref={cloudsRef} args={[size * 1.025, 128, 128]} renderOrder={10}>
                        <primitive object={cloudShaderMaterial} attach="material" />
                    </Sphere>
                )}
            </group>

            {/* ATMOSPHERE */}
            {atmosphereEnabled && (
                <Atmosphere size={size} sunPosition={sunPosition || [1000, 0, 0]} />
            )}
        </group>
    );
};

const Atmosphere: React.FC<{ size: number; sunPosition: [number, number, number] }> = ({ size, sunPosition }) => {
    const { camera } = useThree();
    const mesh = useRef<THREE.Mesh>(null);

    const material = useMemo(() => {
        return new THREE.ShaderMaterial({
            uniforms: THREE.UniformsUtils.clone(AtmosphereShader.uniforms),
            vertexShader: AtmosphereShader.vertexShader,
            fragmentShader: AtmosphereShader.fragmentShader,
            side: THREE.FrontSide,
            blending: THREE.AdditiveBlending,
            transparent: true,
            depthWrite: false,
        });
    }, []);

    useFrame(() => {
        if (mesh.current) {
            const uniforms = (mesh.current.material as THREE.ShaderMaterial).uniforms;

            // Transform camera position to local space (Planet-centric)
            uniforms.v3CameraPos.value.copy(camera.position);
            mesh.current.worldToLocal(uniforms.v3CameraPos.value);

            // Calculate sun direction in local space
            const sunVec = new THREE.Vector3(...sunPosition);
            mesh.current.worldToLocal(sunVec);
            uniforms.v3LightPosition.value.copy(sunVec).normalize();

            uniforms.fCameraHeight.value = uniforms.v3CameraPos.value.length();
            uniforms.fCameraHeight2.value = uniforms.fCameraHeight.value * uniforms.fCameraHeight.value;

            const innerRadius = size;
            const outerRadius = size * 0.515;

            uniforms.fInnerRadius.value = innerRadius;
            uniforms.fInnerRadius2.value = innerRadius * innerRadius;
            uniforms.fOuterRadius.value = outerRadius;
            uniforms.fOuterRadius2.value = outerRadius * outerRadius;
            uniforms.fScale.value = 1 / (outerRadius - innerRadius);

            // Scale depth should be constant 0.25 to match the math for fScale = 1 / Thickness
            // This ensures density drops by e^-4 at the top of the atmosphere
            uniforms.fScaleDepth.value = 0.25;
            uniforms.fScaleOverScaleDepth.value = uniforms.fScale.value / uniforms.fScaleDepth.value;
        }
    });

    return (
        <mesh ref={mesh}>
            <sphereGeometry args={[size * 1.025, 128, 128]} />
            <primitive object={material} attach="material" />
        </mesh>
    );
};
