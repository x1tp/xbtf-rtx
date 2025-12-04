import React, { useMemo, useEffect, useState, useRef } from 'react';
import { Icosahedron, Sphere } from '@react-three/drei';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { ensureRapier, getWorld, getWorldSync } from '../physics/RapierWorld';
import type RAPIERType from '@dimforge/rapier3d-compat';
import type { PlanetDatabaseEntry } from '../config/planetDatabase';
import { simplex3dChunk, fbmChunk } from '../shaders/ProceduralPlanetChunks';

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
    color: string; // Fallback/Base color
    hdr?: boolean;
    sunPosition?: [number, number, number];
    cloudsParams?: CloudsParams;
    config?: PlanetDatabaseEntry;
}

export const Planet: React.FC<PlanetProps> = ({ position, size, cloudsParams, sunPosition, config }) => {
    const surfaceShaderUniformsRef = useRef<Record<string, { value: unknown }> | null>(null);

    // Procedural Planet Shader Logic
    const onBeforeCompile = useMemo(() => {
        return (shader: Shader) => {
            surfaceShaderUniformsRef.current = shader.uniforms;
            
            // Add Uniforms
            shader.uniforms.uTime = { value: 0 };
            shader.uniforms.uRadius = { value: size };
            shader.uniforms.uScale = { value: config?.noiseScale ?? 2.0 };
            shader.uniforms.uBumpStrength = { value: (config?.bumpIntensity ?? 0.6) * 0.2 };
            shader.uniforms.uSeed = { value: config?.seed ?? Math.random() * 100.0 };
            shader.uniforms.cloudsMap = { value: null };
            shader.uniforms.cloudShadowOffset = { value: 0 };

            // Colors
            // Default Palette if config missing
            const palette = config?.colorPalette ?? [
                '#14285A', // Deep Ocean
                '#285A8C', // Shallow Ocean
                '#BEB48C', // Beach
                '#96AA50', // Grass/Savanna
                '#286432', // Forest
                '#645A55', // Rock
                '#F0F5FF'  // Snow
            ];
            // Safely map input palette to 7 slots
            const c = [
                new THREE.Color(palette[0] || '#14285A'),
                new THREE.Color(palette[1] || '#285A8C'),
                new THREE.Color(palette[2] || '#BEB48C'),
                new THREE.Color(palette[3] || '#96AA50'),
                new THREE.Color(palette[4] || '#286432'),
                new THREE.Color(palette[5] || (palette.length > 0 ? palette[palette.length-1] : '#645A55')),
                new THREE.Color(palette[6] || (palette.length > 0 ? palette[palette.length-1] : '#F0F5FF'))
            ];
            
            shader.uniforms.uColorDeepOcean = { value: c[0] };
            shader.uniforms.uColorShallowOcean = { value: c[1] };
            shader.uniforms.uColorBeach = { value: c[2] };
            shader.uniforms.uColorGrass = { value: c[3] };
            shader.uniforms.uColorForest = { value: c[4] };
            shader.uniforms.uColorRock = { value: c[5] };
            shader.uniforms.uColorSnow = { value: c[6] };

            // Inject Noise Functions & Varyings
            shader.vertexShader = `
                ${simplex3dChunk}
                ${fbmChunk}
                uniform float uTime;
                uniform float uRadius;
                uniform float uScale;
                uniform float uBumpStrength;
                uniform float uSeed;
                varying float vHeight;
                varying vec3 vRawPos; // Normalized position for consistent noise
            ` + shader.vertexShader;

            shader.fragmentShader = `
                ${simplex3dChunk}
                ${fbmChunk}
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
            ` + shader.fragmentShader;

            // Vertex Main
            shader.vertexShader = shader.vertexShader.replace(
                '#include <begin_vertex>',
                `
                #include <begin_vertex>
                
                // Normalize local position for noise lookup (avoids precision issues with large coordinates)
                vRawPos = normalize(position);
                
                // Calculate Displacement
                // Use lower frequency for large shapes, high freq for detail
                float noiseVal = fbm(vRawPos * uScale, 6, 0.45, 2.0); 
                
                // We displace along normal
                // Scale displacement based on planet radius (uRadius)
                // e.g. max 2% of radius for mountains
                float displacement = noiseVal * uBumpStrength * uRadius * 0.02; 
                
                // Apply displacement to position
                transformed += normal * displacement;
                
                vHeight = noiseVal; // Pass to fragment
                `
            );

            // Fragment Main - Replace map_fragment to inject color logic
            shader.fragmentShader = shader.fragmentShader.replace(
                '#include <map_fragment>',
                `
                #include <map_fragment>
                
                // Recalculate FBM for per-pixel detail
                float h_frag = fbm(vRawPos * uScale, 8, 0.45, 2.0);
                
                // Perturb normal for bump mapping effect
                // Simple derivative-based bump or just rely on color for now?
                // Let's do color first
                
                vec3 col = uColorDeepOcean;
                
                if (h_frag < -0.05) {
                    col = mix(uColorDeepOcean, uColorShallowOcean, smoothstep(-0.5, -0.05, h_frag));
                } else if (h_frag < 0.05) {
                    col = mix(uColorShallowOcean, uColorBeach, smoothstep(-0.05, 0.05, h_frag));
                } else if (h_frag < 0.15) {
                    col = mix(uColorBeach, uColorGrass, smoothstep(0.05, 0.15, h_frag));
                } else if (h_frag < 0.4) {
                    col = mix(uColorGrass, uColorForest, smoothstep(0.15, 0.4, h_frag));
                } else if (h_frag < 0.7) {
                    col = mix(uColorForest, uColorRock, smoothstep(0.4, 0.7, h_frag));
                } else {
                    col = mix(uColorRock, uColorSnow, smoothstep(0.7, 0.9, h_frag));
                }
                
                // Simple fake bump based on noise derivative
                // We can adjust roughness based on biome
                float roughnessVal = 0.8;
                if (h_frag < 0.0) roughnessVal = 0.2; // Water is shiny
                
                diffuseColor.rgb = col;
                `
            );

            // Inject roughness control
            shader.fragmentShader = shader.fragmentShader.replace(
                '#include <roughnessmap_fragment>',
                `
                #include <roughnessmap_fragment>
                float rVal = 0.8;
                if (fbm(vRawPos * uScale, 8, 0.45, 2.0) < 0.0) rVal = 0.2;
                roughnessFactor = rVal;
                `
            );
        };
    }, [config, size]);

    const planetRef = useRef<THREE.Group>(null);
    const cloudsRef = useRef<THREE.Mesh>(null);
    const planetBodyRef = useRef<RAPIERType.RigidBody | null>(null);
    const [ready, setReady] = useState(false);

    // Clouds Material
    const cloudShaderMaterial = useMemo(() => {
        return new THREE.ShaderMaterial({
            uniforms: {
                uMask: { value: null },
                uTime: { value: 0 },
                uOpacity: { value: cloudsParams?.opacity ?? 0.8 },
                uAlphaTest: { value: cloudsParams?.alphaTest ?? 0.2 },
                uLightDir: { value: new THREE.Vector3(1, 0, 0) },
                uScale: { value: 3.0 }
            },
            vertexShader: `
                varying vec2 vUv;
                varying vec3 vWorldPos;
                varying vec3 vNormal;
                void main() {
                    vUv = uv;
                    vNormal = normalize(normalMatrix * normal);
                    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
                    vWorldPos = worldPosition.xyz;
                    gl_Position = projectionMatrix * viewMatrix * worldPosition;
                }
            `,
            fragmentShader: `
                uniform float uTime;
                uniform float uOpacity;
                uniform vec3 uLightDir;
                uniform float uScale;
                varying vec3 vWorldPos;
                varying vec3 vNormal;
                
                ${simplex3dChunk}
                ${fbmChunk}

                void main() {
                    // Cloud noise
                    // Normalize pos for noise stability
                    vec3 pos = normalize(vWorldPos);
                    
                    // Moving clouds
                    vec3 offset = vec3(uTime * 0.02, 0.0, 0.0);
                    float noise = fbm((pos + offset) * uScale, 6, 0.5, 2.0);
                    
                    // Mask
                    float cloudDensity = smoothstep(0.2, 0.6, noise);
                    
                    if (cloudDensity < 0.1) discard;
                    
                    // Simple Lighting
                    float light = max(0.0, dot(vNormal, normalize(uLightDir)));
                    light = mix(0.4, 1.0, light); // Ambient + Diffuse
                    
                    gl_FragColor = vec4(vec3(1.0) * light, cloudDensity * uOpacity);
                }
            `,
            transparent: true,
            depthWrite: false,
            depthTest: true,
            side: THREE.DoubleSide
        });
    }, [cloudsParams]);

    useFrame((_, delta) => {
        if (!ready) setReady(true);

        if (surfaceShaderUniformsRef.current) {
            (surfaceShaderUniformsRef.current.uTime.value as number) += delta;
        }
        
        if (cloudsRef.current && cloudShaderMaterial) {
             cloudShaderMaterial.uniforms.uTime.value += delta;
             const sunVec = new THREE.Vector3(...(sunPosition || [1000, 0, 0]));
             cloudsRef.current.worldToLocal(sunVec);
             cloudShaderMaterial.uniforms.uLightDir.value.copy(sunVec).normalize();
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
                <Icosahedron args={[size, 128]} castShadow receiveShadow>
                    <meshPhysicalMaterial
                        color={new THREE.Color(0xffffff)}
                        roughness={0.8}
                        metalness={0.1}
                        onBeforeCompile={onBeforeCompile}
                    />
                </Icosahedron>
                {/* CLOUDS */}
                {ready && ((cloudsParams?.enabled ?? true)) && (
                    <Sphere ref={cloudsRef} args={[size * 1.04, 128, 128]} renderOrder={10}>
                         <primitive object={cloudShaderMaterial} attach="material" />
                    </Sphere>
                )}
            </group>
        </group>
    );
};