import React, { useMemo, useRef, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useGameStore } from '../store/gameStore';
import { Mesh, ShaderMaterial, Color, AdditiveBlending, CanvasTexture, SpriteMaterial, SRGBColorSpace, Vector3, DirectionalLight, Object3D } from 'three';

interface SunProps {
    position?: [number, number, number];
    size?: number;
    color?: string;
    intensity?: number;
    hdrIntensity?: number;
    hdr?: boolean;
    lensFlares?: boolean;
}

export const Sun: React.FC<SunProps> = ({
    position = [5000, 2000, 5000],
    size = 500,
    color = '#ffaa00',
    intensity = 2,
    hdrIntensity = intensity * 5000,
    hdr = false,
    lensFlares = true
}) => {
    const meshRef = useRef<Mesh>(null);
    const sunAdapt = useGameStore((state) => state.sunAdapt);
    const sunIntensity = useGameStore((state) => state.sunIntensity);
    const { camera, scene } = useThree();
    const lightRef = useRef<DirectionalLight>(null);
    const targetRef = useRef<Object3D>(new Object3D());

    useEffect(() => {
        if (targetRef.current) scene.add(targetRef.current);
        return () => {
            if (targetRef.current) scene.remove(targetRef.current);
        };
    }, [scene]);

    // Direction from origin toward the sun; used for lighting and flares
    const sunDir = useMemo(() => {
        const v = new Vector3(...position);
        if (v.lengthSq() < 1e-6) return new Vector3(1, 0, 0);
        return v.normalize();
    }, [position]);

    // New Exposure Logic:
    // 1. Initial hit (sunIntensity=1, sunAdapt=0): Exposure drops hard (0.05).
    // 2. Adaptation (sunIntensity=1, sunAdapt->1): Exposure recovers (0.55).
    // 3. Look away (sunIntensity=0): Exposure returns to 1.0 immediately.
    const exposureFactor = 1.0 - sunIntensity * (0.95 - sunAdapt * 0.5);
    const currentIntensity = (hdr ? hdrIntensity : intensity) * exposureFactor;

    // Dynamic Sun Size (Glare):
    // Starts big (Initial hit), shrinks as we adapt.
    const dynamicSize = size * (1.0 + sunIntensity * (2.0 - sunAdapt * 2.0));

    const limbMaterial = useMemo(() => {
        const c = new Color(color);
        return new ShaderMaterial({
            uniforms: {
                uColor: { value: c },
                uIntensity: { value: 3.0 },
                uDarkening: { value: 0.45 }
            },
            vertexShader: `
                varying vec3 vNormal;
                varying vec3 vViewDir;
                void main() {
                    vec3 n = normalize(normalMatrix * normal);
                    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                    vNormal = n;
                    vViewDir = normalize(-mvPosition.xyz);
                    gl_Position = projectionMatrix * mvPosition;
                }
            `,
            fragmentShader: `
                varying vec3 vNormal;
                varying vec3 vViewDir;
                uniform vec3 uColor;
                uniform float uIntensity;
                uniform float uDarkening;
                void main() {
                    float mu = clamp(dot(normalize(vNormal), normalize(vViewDir)), 0.0, 1.0);
                    float I = 1.0 - uDarkening * (1.0 - mu);
                    vec3 col = uColor * (I * uIntensity);
                    gl_FragColor = vec4(col, 1.0);
                }
            `,
            transparent: false,
            depthWrite: true,
            toneMapped: true
        });
    }, [color]);

    const haloMaterial = useMemo(() => {
        const s = 256;
        const canvas = document.createElement('canvas');
        canvas.width = s;
        canvas.height = s;
        const ctx = canvas.getContext('2d');
        if (ctx) {
            const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
            g.addColorStop(0.0, 'rgba(255,235,210,0.8)');
            g.addColorStop(0.4, 'rgba(255,230,200,0.35)');
            g.addColorStop(1.0, 'rgba(255,230,200,0.0)');
            ctx.fillStyle = g;
            ctx.fillRect(0, 0, s, s);
        }
        const tex = new CanvasTexture(canvas);
        tex.colorSpace = SRGBColorSpace;
        return new SpriteMaterial({ map: tex, transparent: true, depthWrite: false, blending: AdditiveBlending });
    }, []);

    // Soft flare used for multiple ghosts along the lens axis
    const flareMaterial = useMemo(() => {
        const s = 256;
        const canvas = document.createElement('canvas');
        canvas.width = s;
        canvas.height = s;
        const ctx = canvas.getContext('2d');
        if (ctx) {
            const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
            g.addColorStop(0.0, 'rgba(255,221,170,0.35)');
            g.addColorStop(0.35, 'rgba(255,221,170,0.18)');
            g.addColorStop(1.0, 'rgba(255,221,170,0.0)');
            ctx.fillStyle = g;
            ctx.fillRect(0, 0, s, s);
        }
        const tex = new CanvasTexture(canvas);
        tex.colorSpace = SRGBColorSpace;
        return new SpriteMaterial({
            map: tex,
            transparent: true,
            depthWrite: false,
            blending: AdditiveBlending,
            opacity: hdr ? 0.85 : 0.6
        });
    }, [hdr]);

    // Harder-edged hex flare to mimic camera iris reflections
    const hexFlareMaterial = useMemo(() => {
        const s = 256;
        const canvas = document.createElement('canvas');
        canvas.width = s;
        canvas.height = s;
        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.translate(s / 2, s / 2);
            const radius = s * 0.38;
            const sides = 6;
            const path = new Path2D();
            for (let i = 0; i < sides; i++) {
                const a = (Math.PI * 2 * i) / sides;
                const x = Math.cos(a) * radius;
                const y = Math.sin(a) * radius;
                if (i === 0) path.moveTo(x, y); else path.lineTo(x, y);
            }
            path.closePath();
            const grd = ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
            grd.addColorStop(0.0, 'rgba(120,170,255,0.4)');
            grd.addColorStop(0.65, 'rgba(120,170,255,0.14)');
            grd.addColorStop(1.0, 'rgba(120,170,255,0.0)');
            ctx.fillStyle = grd;
            ctx.fill(path);
        }
        const tex = new CanvasTexture(canvas);
        tex.colorSpace = SRGBColorSpace;
        return new SpriteMaterial({
            map: tex,
            transparent: true,
            depthWrite: false,
            blending: AdditiveBlending,
            opacity: hdr ? 0.9 : 0.75
        });
    }, [hdr]);

    const flareOffsets = useMemo(() => {
        const dir = sunDir.clone().multiplyScalar(-1);
        // Mix soft ghosts and harder hex ghosts along the axis back toward the camera
        return [
            { scale: size * 0.7, offset: size * 0.55, material: flareMaterial },
            { scale: size * 0.3, offset: size * 1.4, material: hexFlareMaterial },
            { scale: size * 0.22, offset: size * -1.0, material: flareMaterial },
            { scale: size * 0.14, offset: size * 2.6, material: hexFlareMaterial },
            { scale: size * 0.1, offset: size * -2.4, material: flareMaterial },
            { scale: size * 0.08, offset: size * 4.6, material: hexFlareMaterial }
        ].map((entry) => ({
            scale: entry.scale,
            pos: dir.clone().multiplyScalar(entry.offset),
            material: entry.material
        }));
    }, [sunDir, size, flareMaterial, hexFlareMaterial]);

    // Keep the light close enough for stable shadows, but aligned with the sun direction
    const lightDistance = 150000;
    const lightPosition = sunDir.clone().multiplyScalar(lightDistance);

    const flareVisibility = sunIntensity; // Stronger when looking near the sun

    useFrame(() => {
        if (lightRef.current && targetRef.current) {
            // Keep shadow camera focused on viewer for max resolution
            const center = camera.position;
            targetRef.current.position.copy(center);

            // Offset light to maintain sun direction relative to player
            const offset = sunDir.clone().multiplyScalar(5000);
            lightRef.current.position.copy(center).add(offset);
            lightRef.current.target = targetRef.current;
            lightRef.current.updateMatrixWorld();
        }
    });

    return (
        <>
            <group position={position}>
                {/* Visual representation of the sun */}
                <mesh ref={meshRef} name="SunMesh">
                    <sphereGeometry args={[dynamicSize, 32, 32]} />
                    {hdr ? <primitive object={limbMaterial} attach="material" /> : (
                        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={200} toneMapped={false} />
                    )}
                </mesh>

                {/* Veiling glare halo to mimic camera washout near the sun */}
                <sprite scale={[dynamicSize * (hdr ? 6 : 5), dynamicSize * (hdr ? 6 : 5), 1]}>
                    <primitive attach="material" object={haloMaterial} />
                </sprite>

                {/* Lens flare sprites aligned toward the scene origin */}
                {lensFlares && flareOffsets.map((entry, idx) => (
                    <sprite key={idx} position={entry.pos} scale={[entry.scale * (1 + flareVisibility), entry.scale * (1 + flareVisibility), 1]}>
                        <primitive attach="material" object={entry.material} />
                    </sprite>
                ))}

                {/* Add a glow effect using a sprite or another larger inverted sphere if needed later */}
            </group>

            {/* Directional light, kept near the scene but aligned with the sun */}
            <directionalLight
                ref={lightRef}
                position={lightPosition.toArray() as [number, number, number]}
                intensity={currentIntensity}
                color={color}
                castShadow
                shadow-mapSize-width={4096}
                shadow-mapSize-height={4096}
                shadow-camera-near={1}
                shadow-camera-far={10000}
                shadow-camera-left={-4000}
                shadow-camera-right={4000}
                shadow-camera-top={4000}
                shadow-camera-bottom={-4000}
                shadow-bias={-0.001}
                shadow-normalBias={0.04}
                shadow-radius={2}
            />
        </>
    );
};
