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

interface PlanetProps {
    position: [number, number, number];
    size: number;
    color: string;
    hdr?: boolean;
    sunPosition?: [number, number, number];
    cloudsParams?: CloudsParams;
    config?: PlanetDatabaseEntry;
}



export const Planet: React.FC<PlanetProps> = ({ position, size, cloudsParams, config }) => {
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
            ` + shader.fragmentShader;

            shader.vertexShader = shader.vertexShader.replace(
                '#include <begin_vertex>',
                `
                #include <begin_vertex>
                vRawPos = normalize(position);
                
                // Base low freq shape
                float baseShape = fbm(vRawPos * (uScale * 0.5), 4, 0.5, 2.0);
                
                // Domain warping for continents
                vec3 warp = vec3(
                    fbm(vRawPos * uScale + vec3(0.0), 4, 0.5, 2.0),
                    fbm(vRawPos * uScale + vec3(5.2), 4, 0.5, 2.0),
                    fbm(vRawPos * uScale + vec3(1.3), 4, 0.5, 2.0)
                );
                
                // Detailed ridged mountains
                float mountain = ridgedFbm(vRawPos * uScale + warp * 0.5, 8, 0.5, 2.0);
                
                // Combine
                float h = baseShape * 0.5 + mountain * 0.5;
                
                // Continents mask
                float continents = smoothstep(-0.2, 0.2, baseShape);
                
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
                    col = mix(uColorDeepOcean, uColorShallowOcean, smoothstep(-0.1, 0.05, h_frag));
                } else if (h_frag < 0.12) {
                    col = mix(uColorShallowOcean, uColorBeach, smoothstep(0.05, 0.12, h_frag));
                } else if (h_frag < 0.25) {
                    col = mix(uColorBeach, uColorGrass, smoothstep(0.12, 0.25, h_frag));
                } else if (h_frag < 0.5) {
                    col = mix(uColorGrass, uColorForest, smoothstep(0.25, 0.5, h_frag));
                } else if (h_frag < 0.8) {
                    col = mix(uColorForest, uColorRock, smoothstep(0.5, 0.8, h_frag));
                } else {
                    col = mix(uColorRock, uColorSnow, smoothstep(0.8, 1.0, h_frag));
                }
                
                // Atmosphere Glow (Fresnel)
                // Use custom View Space position
                vec3 viewDir = normalize(vMyViewPosition);
                vec3 fresnelNormal = normalize(vNormal);
                float fresnel = pow(1.0 - max(0.0, dot(viewDir, fresnelNormal)), 3.0);
                vec3 atmosphereColor = vec3(0.4, 0.6, 1.0); // Sky blue glow
                
                // Add glow to base color
                col = mix(col, atmosphereColor, fresnel * 0.6);
                
                diffuseColor.rgb = col;
                `
            );

            shader.fragmentShader = shader.fragmentShader.replace(
                '#include <roughnessmap_fragment>',
                `
                #include <roughnessmap_fragment>
                float rVal = 0.9;
                if (vHeight < 0.05) rVal = 0.6; // Ocean is much rougher to diffuse sun (was 0.4)
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
            shader.uniforms.uDensity = { value: 0.3 };
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
                
                float n = fbm(pos + vec3(time, time * 0.2, 0.0), 6, 0.5, 2.0);
                
                float cloud = smoothstep(0.3, 0.7, n + uDensity * 0.2);
                
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
                <Icosahedron args={[size, 128]} castShadow receiveShadow>
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
            </group>
        </group>
    );
};
