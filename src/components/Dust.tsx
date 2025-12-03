import React, { useMemo, useRef, useLayoutEffect, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface DustProps {
    count?: number;
    range?: number;
    center?: [number, number, number];
    color?: string;
    size?: number;
    opacity?: number;
}

export const Dust: React.FC<DustProps> = ({
    count = 2000,
    range = 400,
    center = [0, 0, 0],
    color = '#88ccff',
    size = 0.5,
    opacity = 0.4
}) => {
    const meshRef = useRef<THREE.InstancedMesh>(null);
    const materialRef = useRef<THREE.ShaderMaterial | null>(null);

    // Deterministic pseudo-random values to stay pure during render
    const baseSeed = useMemo(() => {
        let seed = 1234567;
        seed ^= Math.imul(count, 1103515245);
        seed ^= Math.imul(Math.floor(range * 100), 2654435761);
        seed ^= Math.imul(Math.floor(center[0] * 100), 2246822519);
        seed ^= Math.imul(Math.floor(center[1] * 100), 3266489917);
        seed ^= Math.imul(Math.floor(center[2] * 100), 668265263);
        seed ^= Math.imul(Math.floor(size * 1000), 374761393);
        return seed >>> 0;
    }, [center, count, range, size]);

    const particles = useMemo(() => {
        const hashRand = (i: number, salt: number) => {
            const x = Math.sin((i + 1) * 12.9898 + (baseSeed + salt) * 78.233) * 43758.5453;
            return x - Math.floor(x);
        };
        const temp = [];
        for (let i = 0; i < count; i++) {
            const rx = hashRand(i, 17);
            const ry = hashRand(i, 23);
            const rz = hashRand(i, 31);
            const rScale = hashRand(i, 41);
            const rSpeed = hashRand(i, 53);
            const rOffset = hashRand(i, 67);
            const x = (rx - 0.5) * range + center[0];
            const y = (ry - 0.5) * range + center[1];
            const z = (rz - 0.5) * range + center[2];
            const scale = size * (0.5 + rScale);
            const speed = 0.2 + rSpeed * 0.5;
            const offset = rOffset * 100;
            temp.push({ x, y, z, scale, speed, offset });
        }
        return temp;
    }, [baseSeed, center, count, range, size]);

    useLayoutEffect(() => {
        if (!meshRef.current) return;
        const tempObject = new THREE.Object3D();
        for (let i = 0; i < count; i++) {
            const p = particles[i];
            tempObject.position.set(p.x, p.y, p.z);
            tempObject.scale.set(p.scale, p.scale, p.scale);
            tempObject.updateMatrix();
            meshRef.current.setMatrixAt(i, tempObject.matrix);
        }
        meshRef.current.instanceMatrix.needsUpdate = true;
    }, [particles, count]);

    // Custom shader material to make them drift and fade
    const material = useMemo(() => {
        return new THREE.ShaderMaterial({
            uniforms: {
                uTime: { value: 0 },
                uColor: { value: new THREE.Color(color) },
                uOpacity: { value: opacity },
                uSize: { value: size }
            },
            vertexShader: `
                uniform float uTime;
                attribute float aSpeed;
                attribute float aOffset;
                attribute float aScale;
                varying float vAlpha;
                
                void main() {
                    vec3 pos = position;
                    
                    // Simple drift animation
                    // We can't easily modify the instance matrix in vertex shader without extra attributes for original pos
                    // So we'll just rely on the CPU update for movement if we want complex movement, 
                    // OR we use a simple wobble here if we pass attributes.
                    
                    // For now, let's just use the instance matrix as is and add a wobble
                    vec4 worldPos = instanceMatrix * vec4(pos, 1.0);
                    
                    // Wobble based on time and offset
                    float wobble = sin(uTime * aSpeed + aOffset) * 2.0;
                    worldPos.y += wobble;
                    worldPos.x += cos(uTime * aSpeed * 0.5 + aOffset) * 2.0;
                    
                    vec4 mvPosition = viewMatrix * worldPos;
                    gl_Position = projectionMatrix * mvPosition;
                    
                    // Fade based on distance or just constant
                    vAlpha = 1.0;
                }
            `,
            fragmentShader: `
                uniform vec3 uColor;
                uniform float uOpacity;
                varying float vAlpha;
                
                void main() {
                    // Circular particle
                    // vec2 uv = gl_PointCoord - 0.5; // Only for Points
                    // For mesh, we just output color
                    
                    gl_FragColor = vec4(uColor, uOpacity * vAlpha);
                }
            `,
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending
        });
    }, [color, opacity, size]);

    useEffect(() => {
        materialRef.current = material;
    }, [material]);

    // We need to pass attributes for the shader animation
    useLayoutEffect(() => {
        if (!meshRef.current) return;
        const speeds = new Float32Array(count);
        const offsets = new Float32Array(count);
        const scales = new Float32Array(count);

        for (let i = 0; i < count; i++) {
            speeds[i] = particles[i].speed;
            offsets[i] = particles[i].offset;
            scales[i] = particles[i].scale;
        }

        meshRef.current.geometry.setAttribute('aSpeed', new THREE.InstancedBufferAttribute(speeds, 1));
        meshRef.current.geometry.setAttribute('aOffset', new THREE.InstancedBufferAttribute(offsets, 1));
        meshRef.current.geometry.setAttribute('aScale', new THREE.InstancedBufferAttribute(scales, 1));
    }, [count, particles]);

    useFrame((state) => {
        const mat = materialRef.current;
        if (mat) {
            mat.uniforms.uTime.value = state.clock.elapsedTime;
        }
    });

    return (
        <instancedMesh ref={meshRef} args={[undefined, undefined, count]} frustumCulled={false}>
            <dodecahedronGeometry args={[1, 0]} />
            <primitive object={material} attach="material" />
        </instancedMesh>
    );
};
