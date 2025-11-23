import React, { useMemo, useEffect, useState, useRef } from 'react';
import { Sphere } from '@react-three/drei';
import * as THREE from 'three';
import { TextureLoader, SRGBColorSpace, LinearSRGBColorSpace, ClampToEdgeWrapping, RepeatWrapping, ShaderMaterial, AdditiveBlending, Color, Vector3 } from 'three';
import { useFrame, useThree } from '@react-three/fiber';

interface PlanetProps {
    position: [number, number, number];
    size: number;
    color: string; // Kept for fallback, but textures override this
    onTexturesLoaded?: () => void;
    hdr?: boolean;
    sunPosition?: [number, number, number];
}

export const Planet: React.FC<PlanetProps> = ({ position, size, onTexturesLoaded, hdr = false, sunPosition = [5000, 2000, 5000] }) => {

    // 1. THE EARTH SURFACE MATERIAL
    // We removed clearcoat because it makes land look like plastic.
    // We rely entirely on the roughnessMap to make oceans shiny and land matte.
    const earthMaterial = useMemo(() => {
        return new THREE.MeshPhysicalMaterial({
            color: new THREE.Color(0xffffff),
            roughness: 0.9,
            metalness: 0.02,
            ior: 1.5,
            // Sheen simulates the atmosphere scattering light at the edges (Fresnel effect)
            sheen: 1.0,
            sheenRoughness: 0.5,
            sheenColor: new THREE.Color('#3a7e9c'),
        });
    }, []);

    // 2. THE CLOUD MATERIAL
    // Critical Fix: alphaTest allows rays to pass through the empty parts of the texture
    const cloudMaterial = useMemo(() => {
        return new THREE.MeshStandardMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.9,
            side: THREE.DoubleSide, // Helps with volume feel
            alphaTest: 0.3, // <--- CRITICAL FIX FOR BLACK ARTIFACTS
            depthWrite: false, // Standard rendering helper
            roughness: 0.9,
        });
    }, []);

    const [ready, setReady] = useState(false);
    const { gl } = useThree();

    useEffect(() => {
        const loader = new TextureLoader();
        const paths = [
            '/materials/planet_earth/baseColor.png',
            '/materials/planet_earth/roughness.png',
            '/materials/planet_earth/metallic.png',
            '/materials/planet_earth/normal.png',
            '/materials/planet_earth/cloudsAlpha.png'
        ];

        const maxAnisotropy = gl.capabilities.getMaxAnisotropy();

        Promise.all(paths.map((p) => loader.loadAsync(p).catch(() => null))).then(([map, rough, , normal, cloudsAlpha]) => {

            // Helper to apply texture settings consistently
            const setupTexture = (t: THREE.Texture | null, isColor: boolean) => {
                if (!t) return;
                t.colorSpace = isColor ? SRGBColorSpace : LinearSRGBColorSpace;
                t.wrapS = RepeatWrapping;
                t.wrapT = ClampToEdgeWrapping;
                // Offset fix to hide the seam
                t.offset.x = 0.0005;
                t.repeat.set(0.999, 1);
                t.anisotropy = maxAnisotropy;
                t.generateMipmaps = true;
            };

            // Apply textures to Earth
            if (map) {
                setupTexture(map as THREE.Texture, true);
                earthMaterial.map = map as THREE.Texture;
            }
            if (rough) {
                setupTexture(rough as THREE.Texture, false);
                earthMaterial.roughnessMap = rough as THREE.Texture;
            }
            if (normal) {
                setupTexture(normal as THREE.Texture, false);
                earthMaterial.normalMap = normal as THREE.Texture;
                earthMaterial.normalScale = new THREE.Vector2(0.8, 0.8); // Subtler surface wobble to avoid plastic spec
            }

            earthMaterial.needsUpdate = true;

            // Apply texture to Clouds
            if (cloudsAlpha) {
                setupTexture(cloudsAlpha as THREE.Texture, false);
                cloudMaterial.alphaMap = cloudsAlpha as THREE.Texture;
                cloudMaterial.needsUpdate = true;
            }

            setReady(true);
            onTexturesLoaded?.();
        });
    }, [earthMaterial, cloudMaterial, onTexturesLoaded, gl]);

    const planetRef = useRef<THREE.Group>(null);
    const cloudsRef = useRef<THREE.Mesh>(null);
    const sunDir = useMemo(() => {
        const sun = new THREE.Vector3().fromArray(sunPosition);
        const planet = new THREE.Vector3().fromArray(position);
        return sun.sub(planet).normalize();
    }, [position, sunPosition]);

    // Atmosphere shell sticks to the planet (no billboarding) using a rim + sun-facing term
    const atmosphereMaterial = useMemo(() => {
        return new ShaderMaterial({
            transparent: true,
            depthWrite: false,
            blending: AdditiveBlending,
            uniforms: {
                uSunDir: { value: new Vector3() },
                uInnerColor: { value: new Color('#7fc0ff') },
                uOuterColor: { value: new Color('#b2e0ff') }
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
                uniform vec3 uSunDir;
                uniform vec3 uInnerColor;
                uniform vec3 uOuterColor;
                void main() {
                    vec3 n = normalize(vNormal);
                    vec3 v = normalize(vViewDir);
                    float ndotl = clamp(dot(n, normalize(uSunDir)), 0.0, 1.0);
                    float viewDot = clamp(dot(n, v), 0.0, 1.0);
                    float rim = pow(1.0 - viewDot, 3.0);
                    float sunRamp = pow(ndotl, 1.4);

                    float glow = rim * 0.55 + sunRamp * 0.4;
                    // Push alpha to fade earlier and softer to avoid a hard ring
                    float alpha = smoothstep(0.08, 0.3, glow) * 0.45;

                    vec3 col = mix(uInnerColor, uOuterColor, rim) * (alpha * 1.2);
                    gl_FragColor = vec4(col, alpha);
                }
            `
        });
    }, []);

    useEffect(() => {
        if (atmosphereMaterial && atmosphereMaterial.uniforms) {
            atmosphereMaterial.uniforms.uSunDir.value.copy(sunDir);
        }
    }, [atmosphereMaterial, sunDir]);
    useFrame((_, delta) => {
        if (planetRef.current) {
            planetRef.current.rotation.y += delta * 0.005; // Slow rotation
        }
        // Rotate clouds slightly faster for realism
        if (cloudsRef.current) {
            cloudsRef.current.rotation.y += delta * 0.002;
        }
    });

    return (
        <group position={position} name="PlanetGroup">
            {/* EARTH */}
            <group ref={planetRef} name="Planet">
                <Sphere args={[size, 128, 128]}>
                    <primitive object={earthMaterial} attach="material" />
                </Sphere>
            </group>
            {/* CLOUDS */}
            {/* Increased size slightly (1.02) to prevent z-fighting artifacts in the BVH */}
            {ready && (
                <group ref={cloudsRef}>
                    <Sphere args={[size * 1.02, 128, 128]}>
                        <primitive object={cloudMaterial} attach="material" />
                    </Sphere>
                </group>
            )}
            {hdr && (
                <Sphere args={[size * 1.015, 128, 128]}>
                    <primitive attach="material" object={atmosphereMaterial} />
                </Sphere>
            )}
        </group>
    );
};
