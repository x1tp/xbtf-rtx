import React, { useMemo, useRef, useLayoutEffect } from 'react';
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

    // Generate random positions and initial phases
    const particles = useMemo(() => {
        const temp = [];
        for (let i = 0; i < count; i++) {
            const x = (Math.random() - 0.5) * range + center[0];
            const y = (Math.random() - 0.5) * range + center[1];
            const z = (Math.random() - 0.5) * range + center[2];
            const scale = size * (0.5 + Math.random());
            const speed = 0.2 + Math.random() * 0.5;
            const offset = Math.random() * 100;
            temp.push({ x, y, z, scale, speed, offset });
        }
        return temp;
    }, [count, range, center, size]);

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
        if (material) {
            material.uniforms.uTime.value = state.clock.elapsedTime;
        }
    });

    return (
        <instancedMesh ref={meshRef} args={[undefined, undefined, count]} frustumCulled={false}>
            <dodecahedronGeometry args={[1, 0]} />
            <primitive object={material} attach="material" />
        </instancedMesh>
    );
};
