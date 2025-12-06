import React, { useMemo, useEffect, useState, useRef } from 'react';
import { Icosahedron } from '@react-three/drei';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { ensureRapier, getWorld, getWorldSync } from '../physics/RapierWorld';
import type RAPIERType from '@dimforge/rapier3d-compat';
import type { PlanetDatabaseEntry } from '../config/planetDatabase';
import { simplex3dChunk, fbmChunk, ridgedFbmChunk } from '../shaders/ProceduralPlanetChunks';

type Shader = {
    uniforms: { [key: string]: { value: unknown } };
    vertexShader: string;
    fragmentShader: string;
};

type CloudsParams = {
    enabled?: boolean;
    opacity?: number;
    alphaTest?: number;
};

type AtmosphereParams = {
    radiusMul: number;
    rimPower: number;
    rayleigh: number;
    noiseScale: number;
    noiseAmp: number;
    sunMaskMin: number;
    sunMaskMax: number;
    innerColor: string;
    outerColor: string;
};

interface PlanetProps {
    position: [number, number, number];
    size: number;
    color: string;
    hdr?: boolean;
    sunPosition?: [number, number, number];
    cloudsParams?: CloudsParams;
    atmosphereParams?: AtmosphereParams;
    atmosphereEnabled?: boolean;
    config?: PlanetDatabaseEntry;
}



export const Planet: React.FC<PlanetProps> = ({ position, size, cloudsParams, config, sunPosition }) => {
    const surfaceShaderUniformsRef = useRef<Record<string, { value: unknown }> | null>(null);

    // Procedural Planet Shader Logic
    const onBeforeCompile = useMemo(() => {
        return (shader: Shader) => {
            surfaceShaderUniformsRef.current = shader.uniforms;

            shader.uniforms.uTime = { value: 0 };
            shader.uniforms.uRadius = { value: size };
            shader.uniforms.uScale = { value: config?.noiseScale ?? 3.0 };
            shader.uniforms.uBumpStrength = { value: (config?.bumpIntensity ?? 0.6) * 0.2 };
            shader.uniforms.uSeed = { value: config?.seed ?? Math.random() * 100.0 };
            shader.uniforms.uOceanRoughness = { value: config?.oceanRoughness ?? 0.6 };
            shader.uniforms.uLandRoughness = { value: config?.landRoughness ?? 0.9 };
            shader.uniforms.uCloudDensity = { value: config?.cloudDensity ?? 0.5 };
            shader.uniforms.uCloudOpacity = { value: cloudsParams?.opacity ?? 0.6 };
            shader.uniforms.uSunPosition = { value: new THREE.Vector3(...(sunPosition ?? [10000, 0, 0])) };

            const palette = config?.colorPalette ?? [
                '#001a26', // Deep Ocean - Dark Teal
                '#004d66', // Shallow Ocean - Cyan/Turquoise
                '#8c99a6', // Beach - Grey/Sand
                '#2d4030', // Grass - Muted Green/Grey
                '#1a261a', // Forest - Dark Green/Grey
                '#555555', // Rock - Grey
                '#ffffff'  // Snow - White
            ];
            const c = [
                new THREE.Color(palette[0]),
                new THREE.Color(palette[1]),
                new THREE.Color(palette[2]),
                new THREE.Color(palette[3]),
                new THREE.Color(palette[4]),
                new THREE.Color(palette[5]),
                new THREE.Color(palette[6])
            ];

            shader.uniforms.uColorDeepOcean = { value: c[0] };
            shader.uniforms.uColorShallowOcean = { value: c[1] };
            shader.uniforms.uColorBeach = { value: c[2] };
            shader.uniforms.uColorGrass = { value: c[3] };
            shader.uniforms.uColorForest = { value: c[4] };
            shader.uniforms.uColorRock = { value: c[5] };
            shader.uniforms.uColorSnow = { value: c[6] };

            shader.vertexShader = `
                ${simplex3dChunk}
                ${fbmChunk}
                ${ridgedFbmChunk}
                uniform float uTime;
                uniform float uRadius;
                uniform float uScale;
                uniform float uBumpStrength;
                uniform float uSeed;
                varying float vHeight;
                varying vec3 vRawPos;
                varying vec3 vMyViewPosition;
                varying vec3 vWorldPos;
                
                // Domain warping for more natural shapes
                vec3 getWarp(vec3 p) {
                    return vec3(
                        fbm(p + vec3(0.0, 0.0, 0.0), 4, 0.5, 2.0),
                        fbm(p + vec3(5.2, 1.3, 2.8), 4, 0.5, 2.0),
                        fbm(p + vec3(1.3, 2.8, 5.2), 4, 0.5, 2.0)
                    );
                }
            ` + shader.vertexShader;

            shader.fragmentShader = `
                ${simplex3dChunk}
                ${fbmChunk}
                ${ridgedFbmChunk}
                uniform float uTime;
                uniform float uScale;
                uniform float uBumpStrength;
                uniform float uOceanRoughness;
                uniform float uLandRoughness;
                uniform float uCloudDensity;
                uniform float uCloudOpacity;
                uniform vec3 uSunPosition;
                uniform vec3 uColorDeepOcean;
                uniform vec3 uColorShallowOcean;
                uniform vec3 uColorBeach;
                uniform vec3 uColorGrass;
                uniform vec3 uColorForest;
                uniform vec3 uColorRock;
                uniform vec3 uColorSnow;
                varying float vHeight;
                varying vec3 vRawPos;
                varying vec3 vMyViewPosition;
                varying vec3 vWorldPos;
            ` + shader.fragmentShader;

            shader.vertexShader = shader.vertexShader.replace(
                '#include <begin_vertex>',
                `
                #include <begin_vertex>
                vRawPos = normalize(position);
                vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
                
                // Base low freq shape
                float baseShape = fbm(vRawPos * (uScale * 0.5), 4, 0.5, 2.0);
                
                // Domain warping for continents
                vec3 warp = vec3(
                    fbm(vRawPos * uScale + vec3(0.0), 4, 0.5, 2.0),
                    fbm(vRawPos * uScale + vec3(5.2), 4, 0.5, 2.0),
                    fbm(vRawPos * uScale + vec3(1.3), 4, 0.5, 2.0)
                );
                
                // Detailed ridged mountains
                // Reduced octaves from 8 to 6 for perf
                float mountain = ridgedFbm(vRawPos * uScale + warp * 0.5, 6, 0.5, 2.0);
                
                // Combine
                float h = baseShape * 0.5 + mountain * 0.5;
                
                // Continents mask
                // Reduced octaves from 4 to 2
                float coastNoise = fbm(vRawPos * 30.0, 2, 0.5, 2.0);
                float continents = smoothstep(-0.2, 0.2, baseShape + coastNoise * 0.1);
                
                // Final height
                float finalHeight = mix(baseShape * 0.2, mountain, continents);
                
                float displacement = finalHeight * uBumpStrength * uRadius * 0.04; 
                transformed += normal * displacement;
                vHeight = finalHeight;
                
                // Calculate view position for Fresnel
                vec4 mvPos = modelViewMatrix * vec4(transformed, 1.0);
                vMyViewPosition = -mvPos.xyz;
                `
            );

            shader.fragmentShader = shader.fragmentShader.replace(
                '#include <map_fragment>',
                `
                #include <map_fragment>
                // Re-calculate height in fragment for crisp color transitions (optional, can use vHeight)
                // Using vHeight is faster but less detailed. Let's use vHeight for now to save perf.
                float h_frag = vHeight;
                
                vec3 col = uColorDeepOcean;
                if (h_frag < 0.05) {
                    col = mix(uColorDeepOcean, uColorShallowOcean, smoothstep(-0.05, 0.05, h_frag));
                } else if (h_frag < 0.1) {
                    // Widened transition from 0.08 to 0.1 for smoother look
                    col = mix(uColorShallowOcean, uColorBeach, smoothstep(0.05, 0.1, h_frag));
                } else if (h_frag < 0.25) {
                    col = mix(uColorBeach, uColorGrass, smoothstep(0.1, 0.25, h_frag));
                } else if (h_frag < 0.5) {
                    col = mix(uColorGrass, uColorForest, smoothstep(0.25, 0.5, h_frag));
                } else if (h_frag < 0.8) {
                    col = mix(uColorForest, uColorRock, smoothstep(0.5, 0.8, h_frag));
                } else {
                    col = mix(uColorRock, uColorSnow, smoothstep(0.8, 1.0, h_frag));
                }
                
                // Land Detail (Grit)
                if (h_frag >= 0.05) {
                    // Reduced octaves from 4 to 2
                    float landDetail = fbm(vRawPos * 80.0, 2, 0.5, 2.0);
                    col *= mix(0.9, 1.1, landDetail);
                }
                
                // Day/Night cycle
                vec3 sunDir = normalize(uSunPosition - vWorldPos);
                float dayFactor = smoothstep(-0.2, 0.2, dot(normalize(vNormal), sunDir));
                
                // City Lights (Night Side)
                // Optimization: Only calculate city noise if it's night and on land
                if (dayFactor < 0.99 && h_frag >= 0.05) {
                     // Generate city mask with clumping
                     float regionNoise = fbm(vRawPos * 20.0, 2, 0.5, 2.0); // Macro distribution
                     // Reduced octaves from 4 to 2
                     float streetNoise = fbm(vRawPos * 200.0, 2, 0.5, 2.0); // Micro details
                     
                     // Only show streets where regions are dense
                     // Lowered threshold to 0.4 for more cities
                     float cityMask = smoothstep(0.4, 0.8, regionNoise) * smoothstep(0.4, 0.6, streetNoise);
                     // Mask by height (only on land, avoid high mountains/snow)
                     cityMask *= smoothstep(0.05, 0.06, h_frag) * (1.0 - smoothstep(0.8, 0.9, h_frag));
                     
                     vec3 cityColor = vec3(1.0, 0.8, 0.6); // Warm city lights
                     vec3 nightLights = cityColor * cityMask * (1.0 - dayFactor) * 2.0;
                     col += nightLights;
                }
                
                // Atmosphere Glow (Fresnel)
                // Use custom View Space position
                vec3 viewDir = normalize(vMyViewPosition);
                vec3 fresnelNormal = normalize(vNormal);
                // Sharper, brighter rim for X3 style
                float fresnel = pow(1.0 - max(0.0, dot(viewDir, fresnelNormal)), 4.0);
                vec3 atmosphereColor = vec3(0.3, 0.6, 1.0) * 2.5; // Intense blue glow
                
                // Add glow to base color
                col = mix(col, atmosphereColor, fresnel * 0.8);
                
                // Cloud Shadows
                // Re-calculate cloud noise to determine shadows
                // We use vRawPos (object space) to match the cloud sphere's coordinate system
                // Cloud sphere is scaled 1.015, so we might need to adjust, but noise is 3D so it should be close enough.
                vec3 cloudPos = vRawPos * 2.5; // Cloud scale is hardcoded to 2.5 in cloud shader
                float cloudTime = uTime * 0.002;
                float s = sin(cloudTime * 0.5);
                float c = cos(cloudTime * 0.5);
                mat2 rot = mat2(c, -s, s, c);
                cloudPos.xz = rot * cloudPos.xz;
                
                // Reduced octaves from 6 to 4
                float cloudN = fbm(cloudPos + vec3(cloudTime, cloudTime * 0.2, 0.0), 4, 0.5, 2.0);
                float cloudVal = smoothstep(0.3, 0.7, cloudN + uCloudDensity * 0.2);
                
                // Darken surface where clouds are
                // Only apply shadow if cloud opacity is high enough
                // Increased shadow intensity (0.5 -> 0.3)
                col *= mix(1.0, 0.3, cloudVal * uCloudOpacity); 
                
                diffuseColor.rgb = col;
                `
            );

            shader.fragmentShader = shader.fragmentShader.replace(
                '#include <roughnessmap_fragment>',
                `
                #include <roughnessmap_fragment>
                float rVal = uLandRoughness;
                if (vHeight < 0.05) {
                    // Ocean Sparkles: Perturb roughness with high freq noise
                    // Increased scale to 2000.0 for micro-surface sheen
                    float wave = fbm(vRawPos * 2000.0 + uTime * 0.5, 2, 0.5, 2.0);
                    // Mix between rough (0.6) and shiny (0.2) based on waves
                    rVal = mix(uOceanRoughness, 0.2, wave * 0.5); 
                }
                roughnessFactor = rVal;
                `
            );
        };
    }, [config, size]);

    const cloudShaderUniformsRef = useRef<Record<string, { value: unknown }> | null>(null);
    const onBeforeCompileClouds = useMemo(() => {
        return (shader: Shader) => {
            cloudShaderUniformsRef.current = shader.uniforms;
            shader.uniforms.uTime = { value: 0 };
            shader.uniforms.uScale = { value: 2.5 };
            shader.uniforms.uDensity = { value: config?.cloudDensity ?? 0.5 };
            shader.uniforms.uOpacity = { value: cloudsParams?.opacity ?? 0.6 };

            shader.vertexShader = `
                ${simplex3dChunk}
                ${fbmChunk}
                varying vec3 vRawPos;
            ` + shader.vertexShader;

            shader.vertexShader = shader.vertexShader.replace(
                '#include <begin_vertex>',
                `
                #include <begin_vertex>
                vRawPos = normalize(position);
                `
            );

            shader.fragmentShader = `
                ${simplex3dChunk}
                ${fbmChunk}
                uniform float uTime;
                uniform float uScale;
                uniform float uDensity;
                uniform float uOpacity;
                varying vec3 vRawPos;
            ` + shader.fragmentShader;

            shader.fragmentShader = shader.fragmentShader.replace(
                '#include <map_fragment>',
                `
                #include <map_fragment>
                vec3 pos = vRawPos * uScale;
                float time = uTime * 0.002;
                // Rotate noise field
                float s = sin(time * 0.5);
                float c = cos(time * 0.5);
                mat2 rot = mat2(c, -s, s, c);
                pos.xz = rot * pos.xz;
                
                // Reduced octaves from 6 to 4
                float n = fbm(pos + vec3(time, time * 0.2, 0.0), 4, 0.5, 2.0);
                // Detail noise for wispy look
                // Reduced octaves from 4 to 3
                float detail = fbm(pos * 4.0 + vec3(time * 2.0, 0.0, 0.0), 3, 0.5, 2.0);
                // Edge erosion noise
                // Increased octaves to 3 and strength for rougher edges
                float edgeNoise = fbm(pos * 10.0 + time, 3, 0.5, 2.0);
                
                float finalDensity = n + detail * 0.2 - edgeNoise * 0.2;
                float cloud = smoothstep(0.3, 0.7, finalDensity + uDensity * 0.2);
                
                if (cloud < 0.05) discard;
                
                diffuseColor.a *= cloud * uOpacity;
                diffuseColor.rgb = vec3(0.95, 0.95, 1.0);
                `
            );
        };
    }, [cloudsParams]);

    const planetRef = useRef<THREE.Group>(null);
    const planetBodyRef = useRef<RAPIERType.RigidBody | null>(null);
    const [ready, setReady] = useState(false);



    useFrame((_, delta) => {
        if (!ready) setReady(true);

        if (surfaceShaderUniformsRef.current) {
            (surfaceShaderUniformsRef.current.uTime.value as number) += delta;
        }

        if (cloudShaderUniformsRef.current) {
            (cloudShaderUniformsRef.current.uTime.value as number) += delta;
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
            <group ref={planetRef} name="Planet">
                {/* Reduced segments from 256 to 200 for perf */}
                <Icosahedron args={[size, 200]} castShadow receiveShadow>
                    <meshPhysicalMaterial
                        color={new THREE.Color(0xffffff)}
                        roughness={0.8}
                        metalness={0.1}
                        onBeforeCompile={onBeforeCompile}
                    />
                </Icosahedron>
                {/* Cloud Sphere */}
                {(cloudsParams?.enabled ?? true) && (
                    <mesh scale={[1.015, 1.015, 1.015]}>
                        <icosahedronGeometry args={[size, 64]} />
                        <meshStandardMaterial
                            transparent
                            opacity={cloudsParams?.opacity ?? 0.8}
                            side={THREE.DoubleSide}
                            onBeforeCompile={onBeforeCompileClouds}
                            depthWrite={false}
                            blending={THREE.NormalBlending}
                        />
                    </mesh>
                )}
                {/* Atmosphere Halo */}
                <mesh scale={[1.03, 1.03, 1.03]}>
                    <icosahedronGeometry args={[size, 64]} />
                    <shaderMaterial
                        blending={THREE.AdditiveBlending}
                        side={THREE.BackSide}
                        transparent
                        depthWrite={false}
                        uniforms={{
                            uColor: { value: new THREE.Color(0.3, 0.6, 1.0) },
                            uPower: { value: 6.0 }, // Sharper falloff
                            uIntensity: { value: 1.5 },
                            uSunPosition: { value: new THREE.Vector3(...(sunPosition ?? [10000, 0, 0])) }
                        }}
                        vertexShader={`
                            varying vec3 vNormal;
                            varying vec3 vWorldNormal;
                            void main() {
                                vNormal = normalize(normalMatrix * normal);
                                vWorldNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
                                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                            }
                        `}
                        fragmentShader={`
                            uniform vec3 uColor;
                            uniform float uPower;
                            uniform float uIntensity;
                            uniform vec3 uSunPosition;
                            varying vec3 vNormal;
                            varying vec3 vWorldNormal;
                            void main() {
                                vec3 viewDir = vec3(0.0, 0.0, 1.0); // Camera is at 0,0,0 looking down -Z
                                vec3 normal = normalize(vNormal);
                                
                                // Fresnel glow (rim effect)
                                // We are rendering BackSide, so normals point IN. 
                                // But we want the rim, where normal is perpendicular to view.
                                float viewDot = abs(dot(normal, viewDir)); // abs to handle backfaces correctly
                                float fresnel = pow(1.0 - viewDot, uPower);
                                
                                // Day/Night masking
                                vec3 sunDir = normalize(uSunPosition);
                                float sunFactor = smoothstep(-0.3, 0.5, dot(vWorldNormal, sunDir));
                                
                                gl_FragColor = vec4(uColor, 1.0) * fresnel * uIntensity * sunFactor;
                            }
                        `}
                    />
                </mesh>
            </group>
        </group>
    );
};
