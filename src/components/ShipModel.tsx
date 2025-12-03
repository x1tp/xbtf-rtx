import type { FC } from 'react';
import { useEffect, useMemo, useRef } from 'react';
import { useLoader, useFrame, useThree } from '@react-three/fiber';
import { OBJLoader, MTLLoader } from 'three-stdlib';
import { EnginePlume } from './EnginePlume';
import { AdditiveBlending, Box3, CanvasTexture, Color, Group, SpriteMaterial, Vector3, Texture, LinearMipmapLinearFilter, LinearFilter, SRGBColorSpace, LinearSRGBColorSpace, Mesh, ClampToEdgeWrapping, TextureLoader } from 'three';
import { useGameStore } from '../store/gameStore';


interface ShipModelProps {
    enableLights?: boolean;
    editorMode?: boolean;
    name?: string;
    modelPath?: string;
    markerOverrides?: { x: number; y: number; z: number }[];
}

export const ShipModel: FC<ShipModelProps> = ({ enableLights = true, name = 'ShipModel', modelPath, editorMode = false, markerOverrides }) => {
    const objPath = modelPath || '/models/00000.obj';
    const mtlPath = objPath.endsWith('.obj') ? objPath.replace('.obj', '.mtl') : '/models/00000.mtl';
    const materials = useLoader(MTLLoader, mtlPath, (loader) => {
        loader.setResourcePath('/models/');
        loader.setCrossOrigin('anonymous');
    });
    const obj = useLoader(OBJLoader, objPath, (loader) => {
        materials.preload();
        loader.setMaterials(materials);
    });
    useEffect(() => {
        obj.traverse((child) => {
            if (child instanceof Mesh) {
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });
    }, [obj]);
    const { gl } = useThree();
    useEffect(() => {
        const maxAniso = gl?.capabilities?.getMaxAnisotropy?.() ?? 4;
        const applyTextureSettings = (tex?: Texture | null, isColor?: boolean) => {
            if (!tex) return;
            const apply = () => {
                tex.colorSpace = isColor ? SRGBColorSpace : LinearSRGBColorSpace;
                tex.anisotropy = maxAniso;
                tex.generateMipmaps = true;
                tex.minFilter = LinearMipmapLinearFilter;
                tex.magFilter = LinearFilter;
                tex.wrapS = ClampToEdgeWrapping;
                tex.wrapT = ClampToEdgeWrapping;
                tex.needsUpdate = true;
            };
            // If the image isn't ready yet, wait for the texture's first upload.
            if (!tex.image) {
                const onUpdate = () => {
                    (tex as any).removeEventListener?.('update', onUpdate);
                    apply();
                };
                (tex as any).addEventListener?.('update', onUpdate);
                return;
            }
            apply();
        };
        materials.preload();
        const loader = new TextureLoader();
        const tryLoad = (urls: string[]) => new Promise<Texture | null>((resolve) => {
            const next = () => {
                const url = urls.shift();
                if (!url) { resolve(null); return; }
                loader.load(url, (tex) => resolve(tex), undefined, () => next());
            };
            next();
        });
        const tweakAndReplace = async (target: Texture | null | undefined, isColor: boolean) => {
            if (!target) return null;
            const src = ((target as unknown as { source?: { data?: { src?: string } } }).source?.data?.src ||
                (target.image && (target.image as { currentSrc?: string; src?: string }).currentSrc) ||
                (target.image && (target.image as { src?: string }).src) ||
                target.name ||
                '') as string;
            const base = src.split('/').pop() || '';
            const candidates: string[] = [];
            if (base) {
                candidates.push(`/models/true/${base}`);
                candidates.push(`/models/tex/${base}`);
            }
            const replacement = await tryLoad(candidates);
            const tex = replacement || target;
            applyTextureSettings(tex, isColor);
            return replacement;
        };
        Object.values(materials.materials).forEach((mat) => {
            const m = mat as unknown as { map?: Texture | null; bumpMap?: Texture | null; normalMap?: Texture | null; emissiveMap?: Texture | null };
            tweakAndReplace(m.map, true).then((rep) => { if (rep) m.map = rep; });
            tweakAndReplace(m.emissiveMap, true).then((rep) => { if (rep) m.emissiveMap = rep; });
            const bump = m.bumpMap ?? m.normalMap;
            tweakAndReplace(bump, false).then((rep) => {
                if (rep) {
                    if (m.bumpMap) m.bumpMap = rep;
                    else if (m.normalMap) m.normalMap = rep;
                }
            });
            applyTextureSettings(m.map, true);
            applyTextureSettings(m.emissiveMap, true);
            applyTextureSettings(bump, false);
        });
    }, [gl, materials]);
    const initialMarkers = useMemo(() => {
        const rawInit = typeof window !== 'undefined' ? window.localStorage.getItem('ship:engineMarkers:' + objPath) : null;
        if (rawInit) {
            try {
                const parsed = JSON.parse(rawInit) as { positions?: { x: number; y: number; z: number }[] };
                return parsed.positions || [];
            } catch { return []; }
        }
        return [] as { x: number; y: number; z: number }[];
    }, [objPath]);
    const markers = useMemo(() => {
        if (markerOverrides) return markerOverrides;
        if (initialMarkers.length > 0) return initialMarkers;
        const box = new Box3().setFromObject(obj);
        const size = box.getSize(new Vector3());
        const center = box.getCenter(new Vector3());
        const zBack = box.max.z - size.z * 0.08; // near the rear so exhaust trails behind
        const y = center.y - size.y * 0.04;
        const spread = Math.max(size.x * 0.28, 0.6);
        return [
            { x: center.x - spread, y, z: zBack },
            { x: center.x + spread, y, z: zBack }
        ];
    }, [initialMarkers, markerOverrides, obj]);
    const glowTex = useMemo(() => {
        const c = document.createElement('canvas');
        c.width = 128; c.height = 128;
        const g = c.getContext('2d');
        if (!g) return null as unknown as CanvasTexture;
        const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
        grd.addColorStop(0.0, 'rgba(155,208,255,1.0)');
        grd.addColorStop(0.35, 'rgba(118,186,255,0.85)');
        grd.addColorStop(1.0, 'rgba(118,186,255,0.0)');
        g.fillStyle = grd;
        g.fillRect(0, 0, 128, 128);
        const t = new CanvasTexture(c);
        t.needsUpdate = true;
        return t;
    }, []);
    const spriteMatRef = useRef<SpriteMaterial | null>(null);
    const spriteMat = useMemo(() => new SpriteMaterial({ map: glowTex, blending: AdditiveBlending, transparent: true, depthWrite: false, color: new Color('#9bd0ff') }), [glowTex]);
    useEffect(() => { spriteMatRef.current = spriteMat; }, [spriteMat]);
    const groupsRef = useRef<Record<number, Group | null>>({});
    const computeEnginePower = () => {
        const state = useGameStore.getState();
        const throttle = Math.max(0, state.throttle);
        const speedFactor = state.maxSpeed > 0 ? Math.min(1, state.speed / state.maxSpeed) : 0;
        return Math.max(throttle, speedFactor);
    };
    useEffect(() => {
        if (!editorMode) return;
        const store = useGameStore.getState();
        const prev = store.throttle;
        store.setThrottle(0.75);
        return () => store.setThrottle(prev);
    }, [editorMode]);
    useFrame(() => {
        const k = computeEnginePower();
        const lx = 1.0 + 0.8 * k;
        const ry = 1.0 + 0.25 * k;
        const rz = 1.0 + 0.25 * k;
        for (let i = 0; i < markers.length; i++) {
            const g = groupsRef.current[i];
            if (!g) continue;
            g.scale.set(lx, ry, rz);
        }
    });
    useFrame(() => {
        const m = spriteMatRef.current;
        if (!m) return;
        m.opacity = computeEnginePower() * 0.85 + 0.15;
    });


    return (
        <group position={[0, -0.3, 0.0]} name={name}>
            <primitive object={obj} />
            {markers.map((m, i) => (
                <group key={`fx-${i}`} ref={(g) => { groupsRef.current[i] = g; }} frustumCulled={false} position={[m.x, m.y, m.z]}>
                    <EnginePlume position={[0, 0, 0]} length={3.8} radius={0.58} color="#9bd0ff" density={1.05} steps={72} glow={5.0} noiseScale={2.4} shock={1.2} />
                    <EnginePlume position={[0, 0, 0]} length={5.0} radius={1.35} color="#76baff" density={0.6} steps={52} glow={3.0} noiseScale={1.7} shock={0.7} />
                    <sprite name="EngineGlow" position={[0, 0, 0]} scale={[1.2, 1.2, 1]} frustumCulled={false}>
                        <primitive object={spriteMat} attach="material" />
                    </sprite>
                </group>
            ))}
            {enableLights && (
                <>
                    <pointLight position={[0, 1.2, -0.8]} intensity={1.6} distance={8} decay={2} color="#bcdfff" />
                    <pointLight position={[0, -0.3, -1.1]} intensity={1} distance={6} decay={2} color="#ffc372" />
                    <pointLight position={[0, 0.6, 0.8]} intensity={0.7} distance={5} decay={2} color="#9fc4ff" />
                </>
            )}
        </group>
    );
};
