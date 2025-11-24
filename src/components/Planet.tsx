import React, { useMemo, useEffect, useState, useRef } from 'react';
import { Sphere } from '@react-three/drei';
import * as THREE from 'three';
import { useGameStore } from '../store/gameStore';
import { TextureLoader, SRGBColorSpace, LinearSRGBColorSpace, ClampToEdgeWrapping, RepeatWrapping, ShaderMaterial, AdditiveBlending, Color, Vector3 } from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { ensureRapier, getWorld, getWorldSync } from '../physics/RapierWorld';
import type RAPIERType from '@dimforge/rapier3d-compat';

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
}

export const Planet: React.FC<PlanetProps> = ({ position, size, onTexturesLoaded, hdr = false, sunPosition = [5000, 2000, 5000], atmosphereParams, cloudsParams }) => {
    const sunAdapt = useGameStore((state) => state.sunAdapt);
    const sunIntensity = useGameStore((state) => state.sunIntensity);

    // 1. THE EARTH SURFACE MATERIAL
    // We removed clearcoat because it makes land look like plastic.
    // We rely entirely on the roughnessMap to make oceans shiny and land matte.
    const earthMaterial = useMemo(() => {
        return new THREE.MeshPhysicalMaterial({
            color: new THREE.Color(0xffffff),
            roughness: 0.9,
            metalness: 0.02,
            ior: 1.5,
            sheen: 0.0,
            sheenRoughness: 1.0,
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
    const atmosphereRef = useRef<ShaderMaterial | null>(null);
    const planetBodyRef = useRef<RAPIERType.RigidBody | null>(null);
    const sunDir = useMemo(() => {
        const sun = new THREE.Vector3().fromArray(sunPosition);
        const planet = new THREE.Vector3().fromArray(position);
        return sun.sub(planet).normalize();
    }, [position, sunPosition]);

    const atmoDefaults: Required<AtmosphereParams> = {
        rimPower: 2.6,
        rayleigh: 1.8,
        mie: 0.7,
        forwardG: 0.6,
        noiseScale: 0.8,
        noiseAmp: 0.25,
        radiusMul: hdr ? 1.015 : 1.03,
        innerColor: '#7fc0ff',
        outerColor: '#b2e0ff',
        sunMaskMin: 0.45,
        sunMaskMax: 0.95
    };
    const atmo = { ...atmoDefaults, ...(atmosphereParams || {}) };
    const atmosphereMaterial = useMemo(() => {
        return new ShaderMaterial({
            transparent: true,
            depthWrite: false,
            blending: AdditiveBlending,
            side: THREE.BackSide,
            uniforms: {
                uSunDir: { value: new Vector3() },
                uInnerColor: { value: new Color(atmo.innerColor) },
                uOuterColor: { value: new Color(atmo.outerColor) },
                uTime: { value: 0.0 },
                uRimPower: { value: atmo.rimPower },
                uRayleigh: { value: atmo.rayleigh },
                uMie: { value: atmo.mie },
                uForwardG: { value: atmo.forwardG },
                uNoiseScale: { value: atmo.noiseScale },
                uNoiseAmp: { value: atmo.noiseAmp },
                uSunMaskMin: { value: atmo.sunMaskMin },
                uSunMaskMin: { value: atmo.sunMaskMin },
                uSunMaskMax: { value: atmo.sunMaskMax },
                uViewAdapt: { value: 0.0 },
                uSunIntensity: { value: 0.0 }
            },
            vertexShader: `
                varying vec3 vNormal;
                varying vec3 vPos;
                void main() {
                    vec3 n = normalize(normalMatrix * normal);
                    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                    vNormal = n;
                    vPos = position;
                    gl_Position = projectionMatrix * mvPosition;
                }
            `,
            fragmentShader: `
                varying vec3 vNormal;
                varying vec3 vPos;
                uniform vec3 uSunDir;
                uniform vec3 uInnerColor;
                uniform vec3 uOuterColor;
                uniform float uTime;
                uniform float uRimPower;
                uniform float uRayleigh;
                uniform float uMie;
                uniform float uForwardG;
                uniform float uNoiseScale;
                uniform float uNoiseAmp;
                uniform float uSunMaskMin;
                uniform float uSunMaskMax;
                uniform float uViewAdapt;
                uniform float uSunIntensity;
                float hash(float n){return fract(sin(n)*43758.5453123);} 
                float noise(vec3 x){
                    vec3 p=floor(x);
                    vec3 f=fract(x);
                    f=f*f*(3.0-2.0*f);
                    float n=p.x+p.y*57.0+113.0*p.z;
                    return mix(mix(mix(hash(n+0.0),hash(n+1.0),f.x),mix(hash(n+57.0),hash(n+58.0),f.x),f.y),mix(mix(hash(n+113.0),hash(n+114.0),f.x),mix(hash(n+170.0),hash(n+171.0),f.x),f.y),f.z);
                }
                void main(){
                    vec3 n=normalize(vNormal);
                    vec3 s=normalize(uSunDir);
                    float ndotl=clamp(dot(n,s),0.0,1.0);
                    float sunRamp=pow(ndotl,uRayleigh);
                    float term=1.0-abs(ndotl);
                    float rim=pow(clamp(term,0.0,1.0),uRimPower)*ndotl;
                    float n3=noise(vPos*uNoiseScale+vec3(0.0,0.0,uTime*1.5));
                    float rimMod=rim*(1.0+uNoiseAmp*(n3-0.5));
                    float sunMask=smoothstep(uSunMaskMin,uSunMaskMax,ndotl);
                    float glow=rimMod*0.9+sunRamp*0.6;
                    float alpha=smoothstep(0.12,0.7,glow)*0.75*sunMask;
                    vec3 base=mix(uInnerColor,uOuterColor,rim);
                    vec3 col=base*(0.5+sunRamp*1.1)*sunMask;
                    // Apply exposure adaptation: Initial Hit (Dark) -> Recovery (Brighter)
                    float exposure = 1.0 - uSunIntensity * (0.95 - uViewAdapt * 0.5);
                    col *= exposure;
                    gl_FragColor=vec4(col*alpha,alpha);
                }
            `
        });
    }, [atmo.innerColor, atmo.outerColor, atmo.rimPower, atmo.rayleigh, atmo.mie, atmo.forwardG, atmo.noiseScale, atmo.noiseAmp, atmo.sunMaskMin, atmo.sunMaskMax]);

    useEffect(() => {
        if (atmosphereRef.current && atmosphereRef.current.uniforms) {
            (atmosphereRef.current.uniforms.uSunDir as { value: Vector3 }).value.copy(sunDir);
        }
    }, [sunDir]);
    useEffect(() => {
        if (!atmosphereRef.current) return;
        const u = atmosphereRef.current.uniforms;
        (u.uRimPower as { value: number }).value = (atmosphereParams && atmosphereParams.rimPower !== undefined) ? atmosphereParams.rimPower : 2.6;
        (u.uRayleigh as { value: number }).value = (atmosphereParams && atmosphereParams.rayleigh !== undefined) ? atmosphereParams.rayleigh : 1.8;
        (u.uMie as { value: number }).value = (atmosphereParams && atmosphereParams.mie !== undefined) ? atmosphereParams.mie : 0.7;
        (u.uForwardG as { value: number }).value = (atmosphereParams && atmosphereParams.forwardG !== undefined) ? atmosphereParams.forwardG : 0.6;
        (u.uNoiseScale as { value: number }).value = (atmosphereParams && atmosphereParams.noiseScale !== undefined) ? atmosphereParams.noiseScale : 0.8;
        (u.uNoiseAmp as { value: number }).value = (atmosphereParams && atmosphereParams.noiseAmp !== undefined) ? atmosphereParams.noiseAmp : 0.25;
        (u.uSunMaskMin as { value: number }).value = (atmosphereParams && atmosphereParams.sunMaskMin !== undefined) ? atmosphereParams.sunMaskMin : 0.45;
        (u.uSunMaskMax as { value: number }).value = (atmosphereParams && atmosphereParams.sunMaskMax !== undefined) ? atmosphereParams.sunMaskMax : 0.95;
        (u.uInnerColor as { value: Color }).value.set((atmosphereParams && atmosphereParams.innerColor) || '#7fc0ff');
        (u.uOuterColor as { value: Color }).value.set((atmosphereParams && atmosphereParams.outerColor) || '#b2e0ff');
    }, [atmosphereParams]);
    void cloudMaterial;
    useEffect(() => {
        atmosphereRef.current = atmosphereMaterial;
    }, [atmosphereMaterial]);
    const atmoTimeRef = useRef(0);
    useFrame((_, delta) => {
        if (planetRef.current) {
            planetRef.current.rotation.y += delta * 0.005; // Slow rotation
        }
        // Rotate clouds slightly faster for realism
        if (cloudsRef.current) {
            cloudsRef.current.rotation.y += delta * 0.002;
        }
        atmoTimeRef.current += delta;
        if (atmosphereRef.current && atmosphereRef.current.uniforms && 'uTime' in atmosphereRef.current.uniforms) {
            (atmosphereRef.current.uniforms.uTime as { value: number }).value = atmoTimeRef.current;
            (atmosphereRef.current.uniforms.uViewAdapt as { value: number }).value = sunAdapt;
            (atmosphereRef.current.uniforms.uSunIntensity as { value: number }).value = sunIntensity;
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
            <Sphere args={[size * ((atmosphereParams && atmosphereParams.radiusMul) !== undefined ? (atmosphereParams as Required<AtmosphereParams>).radiusMul! : (hdr ? 1.015 : 1.03)), 128, 128]}>
                <primitive attach="material" object={atmosphereMaterial} />
            </Sphere>
        </group>
    );
};
