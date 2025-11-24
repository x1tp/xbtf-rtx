import React, { useMemo, useEffect, useState, useRef } from 'react';
import { Sphere } from '@react-three/drei';
import * as THREE from 'three';
import { TextureLoader, SRGBColorSpace, LinearSRGBColorSpace, ClampToEdgeWrapping, RepeatWrapping } from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { ensureRapier, getWorld, getWorldSync } from '../physics/RapierWorld';
import type RAPIERType from '@dimforge/rapier3d-compat';
import { AtmosphereShader } from '../shaders/AtmosphereShader';

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
}

export const Planet: React.FC<PlanetProps> = ({ position, size, onTexturesLoaded, cloudsParams, atmosphereEnabled = true, sunPosition }) => {

    // 1. THE EARTH SURFACE MATERIAL
    // We removed clearcoat because it makes land look like plastic.
    // We rely entirely on the roughnessMap to make oceans shiny and land matte.
    const earthMaterial = useMemo(() => {
        return new THREE.MeshPhysicalMaterial({
            color: new THREE.Color(0xffffff),
            roughness: 1.0,
            metalness: 0.0,
            ior: 1.5,
            sheen: 0.0,
            sheenRoughness: 1.0,
            specularIntensity: 0.1,
        });
    }, []);

    // 2. THE CLOUD MATERIAL
    // Critical Fix: alphaTest allows rays to pass through the empty parts of the texture
    const initialCloudOpacity = (cloudsParams && typeof cloudsParams.opacity === 'number') ? cloudsParams.opacity : 0.9;
    const initialCloudAlphaTest = (cloudsParams && typeof cloudsParams.alphaTest === 'number') ? cloudsParams.alphaTest : 0.3;
    const cloudMaterial = useMemo(() => {
        return new THREE.MeshStandardMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: initialCloudOpacity,
            side: THREE.DoubleSide, // Helps with volume feel
            alphaTest: initialCloudAlphaTest, // <--- CRITICAL FIX FOR BLACK ARTIFACTS
            depthWrite: false, // Standard rendering helper
            roughness: 0.9,
        });
    }, [initialCloudOpacity, initialCloudAlphaTest]);

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
    const planetBodyRef = useRef<RAPIERType.RigidBody | null>(null);


    useFrame((_, delta) => {
        if (planetRef.current) {
            planetRef.current.rotation.y += delta * 0.005; // Slow rotation
        }
        // Rotate clouds slightly faster for realism
        if (cloudsRef.current) {
            cloudsRef.current.rotation.y += delta * 0.002;
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
                    <primitive object={earthMaterial} attach="material" />
                </Sphere>
            </group>
            {/* CLOUDS */}
            {/* Increased size slightly (1.02) to prevent z-fighting artifacts in the BVH */}
            {ready && ((cloudsParams?.enabled ?? true)) && (
                <group ref={cloudsRef}>
                    <Sphere args={[size * 1.02, 128, 128]}>
                        <primitive object={cloudMaterial} attach="material" />
                    </Sphere>
                </group>
            )}

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
            const outerRadius = size * 1.025;

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
