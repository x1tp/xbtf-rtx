import React, { useMemo, useEffect, useState, useRef } from 'react';
import { Sphere } from '@react-three/drei';
import * as THREE from 'three';
import { TextureLoader, SRGBColorSpace, LinearSRGBColorSpace, ClampToEdgeWrapping, RepeatWrapping, ShaderMaterial, AdditiveBlending, Color, Vector3 } from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { ensureRapier, getWorld, getWorldSync } from '../physics/RapierWorld';
import type RAPIERType from '@dimforge/rapier3d-compat';

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
    const atmosphereRef = useRef<ShaderMaterial | null>(null);
    const planetBodyRef = useRef<RAPIERType.RigidBody | null>(null);
    const sunDir = useMemo(() => {
        const sun = new THREE.Vector3().fromArray(sunPosition);
        const planet = new THREE.Vector3().fromArray(position);
        return sun.sub(planet).normalize();
    }, [position, sunPosition]);

    const atmosphereMaterial = useMemo(() => {
        return new ShaderMaterial({
            transparent: true,
            depthWrite: false,
            blending: AdditiveBlending,
            side: THREE.BackSide,
            uniforms: {
                uSunDir: { value: new Vector3() },
                uInnerColor: { value: new Color('#7fc0ff') },
                uOuterColor: { value: new Color('#b2e0ff') },
                uTime: { value: 0.0 },
                uRimPower: { value: 2.6 },
                uRayleigh: { value: 1.8 },
                uMie: { value: 0.7 },
                uForwardG: { value: 0.6 },
                uNoiseScale: { value: 0.8 },
                uNoiseAmp: { value: 0.25 }
            },
            vertexShader: `
                varying vec3 vNormal;
                varying vec3 vViewDir;
                varying vec3 vPos;
                void main() {
                    vec3 n = normalize(normalMatrix * normal);
                    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                    vNormal = n;
                    vViewDir = normalize(-mvPosition.xyz);
                    vPos = position;
                    gl_Position = projectionMatrix * mvPosition;
                }
            `,
            fragmentShader: `
                varying vec3 vNormal;
                varying vec3 vViewDir;
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
                    vec3 v=normalize(vViewDir);
                    vec3 s=normalize(uSunDir);
                    float ndotl=clamp(dot(n,s),0.0,1.0);
                    float viewDot=clamp(dot(n,v),0.0,1.0);
                    float rim=pow(1.0-viewDot,uRimPower);
                    float sunRamp=pow(ndotl,uRayleigh);
                    float cosTheta=clamp(dot(v,s),-1.0,1.0);
                    float g=uForwardG;
                    float hg=(1.0-g*g)/pow(1.0+g*g-2.0*g*cosTheta,1.5);
                    float n3=noise(vPos*uNoiseScale+vec3(0.0,0.0,uTime*1.5));
                    float rimMod=rim*(1.0+uNoiseAmp*(n3-0.5));
                    float sunMask=smoothstep(0.15,0.5,ndotl);
                    float mie=(hg*uMie)*rim*sunMask;
                    float rimSun=rimMod*sunMask;
                    float glow=rimSun*0.8+sunRamp*0.5+mie*0.4;
                    float alpha=smoothstep(0.12,0.65,glow)*0.7*sunMask;
                    vec3 base=mix(uInnerColor,uOuterColor,rim);
                    vec3 col=base*(0.6+sunRamp*0.9)+uOuterColor*mie*0.5;
                    gl_FragColor=vec4(col*alpha,alpha);
                }
            `
        });
    }, []);

    useEffect(() => {
        if (atmosphereRef.current && atmosphereRef.current.uniforms) {
            (atmosphereRef.current.uniforms.uSunDir as { value: Vector3 }).value.copy(sunDir);
        }
    }, [sunDir]);
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
            {ready && (
                <group ref={cloudsRef}>
                    <Sphere args={[size * 1.02, 128, 128]}>
                        <primitive object={cloudMaterial} attach="material" />
                    </Sphere>
                </group>
            )}
            <Sphere args={[size * (hdr ? 1.015 : 1.03), 128, 128]}>
                <primitive attach="material" object={atmosphereMaterial} />
            </Sphere>
        </group>
    );
};
