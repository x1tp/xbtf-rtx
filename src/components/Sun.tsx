import React, { useMemo, useRef } from 'react';
import { useGameStore } from '../store/gameStore';
import { Mesh, ShaderMaterial, Color, AdditiveBlending, CanvasTexture, SpriteMaterial, SRGBColorSpace, Vector3 } from 'three';

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
            g.addColorStop(0.0, 'rgba(255,221,170,0.6)');
            g.addColorStop(0.6, 'rgba(255,221,170,0.2)');
            g.addColorStop(1.0, 'rgba(255,221,170,0.0)');
            ctx.fillStyle = g;
            ctx.fillRect(0, 0, s, s);
        }
        const tex = new CanvasTexture(canvas);
        tex.colorSpace = SRGBColorSpace;
        return new SpriteMaterial({ map: tex, transparent: true, depthWrite: false, blending: AdditiveBlending });
    }, []);

    const flareMaterial = useMemo(() => {
        const s = 256;
        const canvas = document.createElement('canvas');
        canvas.width = s;
        canvas.height = s;
        const ctx = canvas.getContext('2d');
        if (ctx) {
            const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
            g.addColorStop(0.0, 'rgba(255,221,170,0.4)');
            g.addColorStop(0.4, 'rgba(255,221,170,0.2)');
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
            opacity: hdr ? 0.75 : 0.5
        });
    }, [hdr]);

    const flareOffsets = useMemo(() => {
        const dir = new Vector3().fromArray(position).normalize().multiplyScalar(-1);
        return [
            { scale: size * 0.55, offset: size * 0.6 },
            { scale: size * 0.25, offset: size * 1.8 },
            { scale: size * 0.15, offset: size * -1.2 },
            { scale: size * 0.08, offset: size * 3.4 }
        ].map((entry) => ({
            scale: entry.scale,
            pos: dir.clone().multiplyScalar(entry.offset)
        }));
    }, [position, size]);

    return (
        <group position={position}>
            {/* Visual representation of the sun */}
            <mesh ref={meshRef} name="SunMesh">
                <sphereGeometry args={[dynamicSize, 32, 32]} />
                {hdr ? <primitive object={limbMaterial} attach="material" /> : (
                    <meshStandardMaterial color={color} emissive={color} emissiveIntensity={50} toneMapped={false} />
                )}
            </mesh>

            {hdr && <sprite scale={[dynamicSize * 4, dynamicSize * 4, 1]}>
                <primitive attach="material" object={haloMaterial} />
            </sprite>}

            {/* Simple lens flare sprites aligned toward the scene origin; gives sun streaks without a heavy post effect */}
            {lensFlares && flareOffsets.map((entry, idx) => (
                <sprite key={idx} position={entry.pos} scale={[entry.scale, entry.scale, 1]}>
                    <primitive attach="material" object={flareMaterial} />
                </sprite>
            ))}

            {/* Light source */}
            {/* We position the light at the sun's position, but since we are inside a group
          at 'position', the light should be at 0,0,0 relative to the group.
       */}
            <directionalLight
                intensity={currentIntensity}
                color={color}
                castShadow
                shadow-mapSize-width={4096}
                shadow-mapSize-height={4096}
                shadow-camera-near={1}
                shadow-camera-far={100000}
                shadow-camera-left={-10000}
                shadow-camera-right={10000}
                shadow-camera-top={10000}
                shadow-camera-bottom={-10000}
                shadow-bias={-0.0005}
                shadow-normalBias={0.02}
                shadow-radius={2}
            />

            {/* Add a glow effect using a sprite or another larger inverted sphere if needed later */}
        </group>
    );
};
