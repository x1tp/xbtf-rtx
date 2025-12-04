import React, { useMemo, useEffect, useState, useRef } from 'react';
import { Icosahedron } from '@react-three/drei';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
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
    color: string;
    hdr?: boolean;
    sunPosition?: [number, number, number];
    cloudsParams?: CloudsParams;
    config?: PlanetDatabaseEntry;
}

// Create cloud texture (cached) - procedural wispy cloud
let cachedCloudTextures: THREE.CanvasTexture[] = [];
function getCloudTexture(variant: number = 0): THREE.CanvasTexture {
    if (cachedCloudTextures[variant]) return cachedCloudTextures[variant];
    
    const canvas = document.createElement('canvas');
    const size = 256;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (ctx) {
        const imageData = ctx.createImageData(size, size);
        const data = imageData.data;
        
        // Better noise function with interpolation
        const hash = (x: number, y: number, seed: number) => {
            const n = Math.sin(x * 127.1 + y * 311.7 + seed * 758.5453) * 43758.5453;
            return n - Math.floor(n);
        };
        
        // Smooth noise with interpolation
        const smoothNoise = (x: number, y: number, seed: number) => {
            const ix = Math.floor(x);
            const iy = Math.floor(y);
            const fx = x - ix;
            const fy = y - iy;
            
            // Smooth interpolation
            const sx = fx * fx * (3 - 2 * fx);
            const sy = fy * fy * (3 - 2 * fy);
            
            const n00 = hash(ix, iy, seed);
            const n10 = hash(ix + 1, iy, seed);
            const n01 = hash(ix, iy + 1, seed);
            const n11 = hash(ix + 1, iy + 1, seed);
            
            const nx0 = n00 * (1 - sx) + n10 * sx;
            const nx1 = n01 * (1 - sx) + n11 * sx;
            
            return nx0 * (1 - sy) + nx1 * sy;
        };
        
        // Fractal noise for cloud-like pattern
        const fbm = (x: number, y: number, seed: number) => {
            let value = 0;
            let amplitude = 0.6;
            let frequency = 1;
            for (let i = 0; i < 6; i++) {
                value += amplitude * smoothNoise(x * frequency, y * frequency, seed + i * 100);
                amplitude *= 0.5;
                frequency *= 2.0;
            }
            return value;
        };
        
        const cx = size / 2;
        const cy = size / 2;
        
        // Different stretch factors per variant for variety
        const stretches = [
            { sx: 1.0, sy: 0.4 }, // Horizontal streak
            { sx: 0.5, sy: 0.8 }, // Vertical-ish
            { sx: 1.2, sy: 0.6 }, // Wide horizontal
            { sx: 0.7, sy: 0.7 }, // More round
        ];
        const stretch = stretches[variant % stretches.length];
        const seedOffset = variant * 1000;
        
        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                const idx = (y * size + x) * 4;
                
                // Distance from center with stretch for elongated shapes
                const dx = (x - cx) / cx * stretch.sx;
                const dy = (y - cy) / cy * stretch.sy;
                const dist = Math.sqrt(dx * dx + dy * dy);
                
                // Smoother radial falloff
                const radialFade = Math.max(0, 1 - Math.pow(dist, 2.0));
                
                // Noise-based cloud density
                const n = fbm(x * 0.015 + seedOffset, y * 0.015, seedOffset);
                
                // Streak-like pattern by adding directional noise
                const streak = fbm(x * 0.03 + seedOffset, y * 0.008, seedOffset + 500);
                
                // Combine noises for wispy effect
                const combined = (n * 0.6 + streak * 0.4);
                const cloudDensity = Math.pow(Math.max(0, combined - 0.25) * 1.8, 0.7);
                
                // Final alpha
                const alpha = radialFade * cloudDensity * 280;
                
                data[idx] = 255;
                data[idx + 1] = 255;
                data[idx + 2] = 255;
                data[idx + 3] = Math.min(255, alpha);
            }
        }
        
        ctx.putImageData(imageData, 0, 0);
        
        // Multiple blur passes for softer edges
        ctx.filter = 'blur(4px)';
        ctx.drawImage(canvas, 0, 0);
        ctx.filter = 'blur(2px)';
        ctx.drawImage(canvas, 0, 0);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    cachedCloudTextures[variant] = texture;
    return texture;
}

export const Planet: React.FC<PlanetProps> = ({ position, size, cloudsParams, config }) => {
    const surfaceShaderUniformsRef = useRef<Record<string, { value: unknown }> | null>(null);
    const { scene } = useThree();

    // Procedural Planet Shader Logic
    const onBeforeCompile = useMemo(() => {
        return (shader: Shader) => {
            surfaceShaderUniformsRef.current = shader.uniforms;
            
            shader.uniforms.uTime = { value: 0 };
            shader.uniforms.uRadius = { value: size };
            shader.uniforms.uScale = { value: config?.noiseScale ?? 2.0 };
            shader.uniforms.uBumpStrength = { value: (config?.bumpIntensity ?? 0.6) * 0.2 };
            shader.uniforms.uSeed = { value: config?.seed ?? Math.random() * 100.0 };

            const palette = config?.colorPalette ?? [
                '#14285A', '#285A8C', '#BEB48C', '#96AA50', '#286432', '#645A55', '#F0F5FF'
            ];
            const c = [
                new THREE.Color(palette[0] || '#14285A'),
                new THREE.Color(palette[1] || '#285A8C'),
                new THREE.Color(palette[2] || '#BEB48C'),
                new THREE.Color(palette[3] || '#96AA50'),
                new THREE.Color(palette[4] || '#286432'),
                new THREE.Color(palette[5] || '#645A55'),
                new THREE.Color(palette[6] || '#F0F5FF')
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
                uniform float uTime;
                uniform float uRadius;
                uniform float uScale;
                uniform float uBumpStrength;
                uniform float uSeed;
                varying float vHeight;
                varying vec3 vRawPos;
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

            shader.vertexShader = shader.vertexShader.replace(
                '#include <begin_vertex>',
                `
                #include <begin_vertex>
                vRawPos = normalize(position);
                float noiseVal = fbm(vRawPos * uScale, 6, 0.45, 2.0); 
                float displacement = noiseVal * uBumpStrength * uRadius * 0.02; 
                transformed += normal * displacement;
                vHeight = noiseVal;
                `
            );

            shader.fragmentShader = shader.fragmentShader.replace(
                '#include <map_fragment>',
                `
                #include <map_fragment>
                float h_frag = fbm(vRawPos * uScale, 8, 0.45, 2.0);
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
                diffuseColor.rgb = col;
                `
            );

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
    const planetBodyRef = useRef<RAPIERType.RigidBody | null>(null);
    const [ready, setReady] = useState(false);

    // Generate cloud data - positioned tangent to sphere
    const cloudData = useMemo(() => {
        const count = 350; // More clouds for better coverage
        const baseRadius = size * 1.003; // Very close to surface
        const data: { position: THREE.Vector3; scaleX: number; scaleY: number; opacity: number; normal: THREE.Vector3; rotation: number }[] = [];
        
        let seed = 12345;
        const seededRandom = () => {
            seed = (seed * 1103515245 + 12345) & 0x7fffffff;
            return seed / 0x7fffffff;
        };
        
        for (let i = 0; i < count; i++) {
            // Random point on unit sphere using spherical coordinates for even distribution
            const theta = seededRandom() * Math.PI * 2;
            const phi = Math.acos(2 * seededRandom() - 1);
            const nx = Math.sin(phi) * Math.cos(theta);
            const ny = Math.cos(phi); // Y-up
            const nz = Math.sin(phi) * Math.sin(theta);
            
            const r = baseRadius;
            const pos = new THREE.Vector3(nx * r, ny * r, nz * r);
            const normal = new THREE.Vector3(nx, ny, nz);
            
            // Varied cloud sizes - some small wisps, some larger formations
            const sizeVariant = seededRandom();
            let baseScale: number;
            if (sizeVariant < 0.3) {
                baseScale = size * 0.01 + seededRandom() * size * 0.015; // Small wisps
            } else if (sizeVariant < 0.7) {
                baseScale = size * 0.02 + seededRandom() * size * 0.025; // Medium
            } else {
                baseScale = size * 0.035 + seededRandom() * size * 0.03; // Large formations
            }
            
            data.push({
                position: pos,
                scaleX: baseScale * (1.2 + seededRandom() * 0.8),
                scaleY: baseScale * (1.0 + seededRandom() * 0.6),
                opacity: 0.15 + seededRandom() * 0.25,
                normal: normal,
                rotation: seededRandom() * Math.PI * 2
            });
        }
        return data;
    }, [size]);

    // Cloud mesh refs
    const cloudMeshesRef = useRef<THREE.Mesh[]>([]);

    // Initialize cloud meshes (not sprites - actual planes tangent to sphere)
    useEffect(() => {
        if (!ready || !(cloudsParams?.enabled ?? true)) return;
        
        const meshes = cloudMeshesRef.current;
        
        // Pre-generate multiple texture variants
        const numVariants = 4;
        const cloudTextures: THREE.CanvasTexture[] = [];
        for (let i = 0; i < numVariants; i++) {
            cloudTextures.push(getCloudTexture(i));
        }
        
        // Clear old meshes
        meshes.forEach(m => {
            m.removeFromParent();
            m.geometry.dispose();
            (m.material as THREE.Material).dispose();
        });
        meshes.length = 0;
        
        // Shared geometry - simple plane
        const planeGeo = new THREE.PlaneGeometry(1, 1);
        
        // Create cloud meshes tangent to sphere surface
        cloudData.forEach((data, i) => {
            // Use different texture variants for variety
            const textureVariant = i % numVariants;
            
            const material = new THREE.MeshBasicMaterial({
                map: cloudTextures[textureVariant],
                color: 0xffffff,
                transparent: true,
                opacity: data.opacity * (cloudsParams?.opacity ?? 0.7),
                depthWrite: false,
                depthTest: true,
                side: THREE.DoubleSide,
                blending: THREE.NormalBlending,
            });
            
            const mesh = new THREE.Mesh(planeGeo.clone(), material);
            
            // Position in world space
            const worldPos = new THREE.Vector3(...position).add(data.position);
            mesh.position.copy(worldPos);
            
            // Orient to face outward from planet (normal = radial direction)
            mesh.lookAt(worldPos.clone().add(data.normal));
            
            // Apply random rotation around the normal
            mesh.rotateZ(data.rotation);
            
            // Scale
            mesh.scale.set(data.scaleX, data.scaleY, 1);
            
            scene.add(mesh);
            meshes.push(mesh);
        });
        
        return () => {
            meshes.forEach(m => {
                m.removeFromParent();
                m.geometry.dispose();
                (m.material as THREE.Material).dispose();
            });
            meshes.length = 0;
        };
    }, [ready, cloudData, cloudsParams, scene, position]);

    useFrame((_, delta) => {
        if (!ready) setReady(true);

        if (surfaceShaderUniformsRef.current) {
            (surfaceShaderUniformsRef.current.uTime.value as number) += delta;
        }
        
        // Slowly rotate clouds around planet
        if (cloudMeshesRef.current.length > 0) {
            const rotSpeed = 0.00002; // Very slow rotation
            const angle = delta * rotSpeed;
            const center = new THREE.Vector3(...position);
            const axis = new THREE.Vector3(0, 1, 0); // Rotate around Y
            
            cloudMeshesRef.current.forEach(mesh => {
                // Rotate position around planet center
                const rel = mesh.position.clone().sub(center);
                rel.applyAxisAngle(axis, angle);
                mesh.position.copy(center.clone().add(rel));
                
                // Also rotate the mesh orientation
                mesh.rotateOnWorldAxis(axis, angle);
            });
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
            </group>
        </group>
    );
};
