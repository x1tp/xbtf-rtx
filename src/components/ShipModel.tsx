import type { FC } from 'react';
import { useEffect, useMemo, useRef } from 'react';
import { useLoader, useFrame, useThree } from '@react-three/fiber';
import { OBJLoader, MTLLoader } from 'three-stdlib';
import { NebulaPlume } from './NebulaPlume';
import { AdditiveBlending, Box3, CanvasTexture, Color, Group, SpriteMaterial, Vector3, Texture, LinearMipmapLinearFilter, LinearFilter, SRGBColorSpace, LinearSRGBColorSpace, Mesh, RepeatWrapping, DoubleSide, Material, TextureLoader, MeshPhongMaterial } from 'three';
import { useGameStore } from '../store/gameStore';
import { getAllPresets } from '../config/plumes';


interface ShipModelProps {
    enableLights?: boolean;
    editorMode?: boolean;
    disableTextures?: boolean;
    name?: string;
    modelPath?: string;
    markerOverrides?: { x: number; y: number; z: number; type?: string }[];
    plumePositions?: { x: number; y: number; z: number; type?: string }[];
    cockpitPosition?: { x: number; y: number; z: number };
    weaponPositions?: { x: number; y: number; z: number }[];
    throttle?: number;
}

export const ShipModel: FC<ShipModelProps> = ({ enableLights = true, name = 'ShipModel', modelPath, editorMode = false, disableTextures = false, markerOverrides, plumePositions, cockpitPosition, weaponPositions, throttle }) => {
    const objPath = modelPath || '/models/00000.obj';
    const mtlPath = objPath.endsWith('.obj') ? objPath.replace('.obj', '.mtl') : '/models/00000.mtl';
    // Most converted BOD models need flipY disabled to display textures correctly
    const needsFlipYFix = true; // Apply to all models for consistency with Blender
    const materials = useLoader(MTLLoader, mtlPath, (loader) => {
        const rp = mtlPath.slice(0, mtlPath.lastIndexOf('/') + 1);
        loader.setResourcePath(rp);
        loader.setCrossOrigin('anonymous');
    });
    const obj = useLoader(OBJLoader, objPath, (loader) => {
        if (!disableTextures) {
            materials.preload();
            loader.setMaterials(materials);
        }
    });
    useEffect(() => {
        obj.traverse((child) => {
            if (child instanceof Mesh) {
                child.castShadow = true;
                child.receiveShadow = true;
                if (child.geometry && 'computeVertexNormals' in child.geometry) {
                    // Keep original normals; some converted OBJ files include authored normals.
                }
                // Enable double-sided rendering to match Blender's default behavior
                if (child.material) {
                    const mats = Array.isArray(child.material) ? child.material : [child.material];
                    mats.forEach((m: Material) => {
                        m.side = DoubleSide;
                        if ((m as MeshPhongMaterial).isMeshPhongMaterial) {
                            // Trust MTL values for specular/shininess
                        }
                        m.needsUpdate = true;
                    });
                }
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
                tex.wrapS = RepeatWrapping;
                tex.wrapT = RepeatWrapping;

                // BOD-converted models need flipY disabled to match Blender UV layout
                if (needsFlipYFix) {
                    tex.flipY = false;
                }

                tex.needsUpdate = true;
            };
            apply();
        };

        if (!disableTextures) {
            materials.preload();

            // Apply texture settings to all materials
            Object.values(materials.materials).forEach((mat) => {
                const m = mat as unknown as { map?: Texture | null; bumpMap?: Texture | null; normalMap?: Texture | null; emissiveMap?: Texture | null; side?: number };
                // Enable double-sided rendering to match Blender's default behavior
                m.side = DoubleSide;

                // Apply settings to diffuse/albedo map
                applyTextureSettings(m.map, true);

                // Apply settings to emissive map
                applyTextureSettings(m.emissiveMap, true);

                // Convert bump map to normal map if no normal map exists
                if (m.bumpMap && !m.normalMap) {
                    m.normalMap = m.bumpMap;
                    m.bumpMap = null;
                }

                // Apply settings to normal map
                applyTextureSettings(m.normalMap, false);

                // Ensure ship writes to depth buffer so it occludes plumes
                (m as Material).depthWrite = true;
            });
        }
    }, [gl, materials, objPath, needsFlipYFix, disableTextures]);
    useEffect(() => {
        if (disableTextures) return;
        const run = async () => {
            const maxAniso = gl?.capabilities?.getMaxAnisotropy?.() ?? 4;
            const tloader = new TextureLoader();
            const base = mtlPath.slice(0, mtlPath.lastIndexOf('/') + 1);
            const text = await fetch(mtlPath).then((r) => r.text()).catch(() => '');
            const map: Record<string, { kd?: string; bump?: string }> = {};
            let cur = '';
            text.split(/\r?\n/).forEach((ln) => {
                const a = ln.match(/^\s*newmtl\s+(.+)$/i);
                if (a) { cur = a[1].trim(); if (!map[cur]) map[cur] = {}; return; }
                const kd = ln.match(/^\s*map_Kd\s+(.+)$/i);
                if (kd && cur) {
                    const s = kd[1].trim();
                    const m = s.match(/([^\s]+\.(?:jpe?g|png|tga|bmp))/i);
                    map[cur].kd = (m ? m[1] : s);
                }
                const mb = ln.match(/^\s*map_bump\s+(.+)$/i) || ln.match(/^\s*bump\s+(.+)$/i);
                if (mb && cur) {
                    const s = mb[1].trim();
                    const m2 = s.match(/([^\s]+\.(?:jpe?g|png|tga|bmp))/i);
                    map[cur].bump = (m2 ? m2[1] : s);
                }
            });
            const applyTex = (tex: Texture | null, isColor: boolean) => {
                if (!tex) return;
                tex.colorSpace = isColor ? SRGBColorSpace : LinearSRGBColorSpace;
                tex.anisotropy = maxAniso;
                tex.generateMipmaps = true;
                tex.minFilter = LinearMipmapLinearFilter;
                tex.magFilter = LinearFilter;
                tex.wrapS = RepeatWrapping;
                tex.wrapT = RepeatWrapping;
                tex.flipY = false;
                tex.needsUpdate = true;
            };
            const tryLoad = async (p: string | undefined): Promise<Texture | null> => {
                if (!p) return null;
                const normalize = (s: string) => {
                    const stripped = s.replace(/^['"]|['"]$/g, '').trim();
                    const last = stripped.match(/([^\s]+\.(?:jpe?g|png|tga|bmp))/i);
                    const val = last ? last[1] : stripped;
                    const slashed = val.replace(/\\/g, '/').replace(/^\.\/+/, '');
                    return slashed;
                };
                const make = (u: string) => (u.startsWith('/') ? u : base + u);
                const urls: string[] = [];
                const np = normalize(p);
                urls.push(make(np));
                const lower = np.replace(/\.(JPE?G|PNG|TGA|BMP)$/i, (m) => m.toLowerCase());
                if (lower !== p) urls.push(make(lower));
                const bn = np.split('/').pop() || np;
                urls.push('/models/true/' + bn);
                urls.push('/models/tex/' + bn);
                for (const u of urls) {
                    const tex = await tloader.loadAsync(u).catch(() => null);
                    if (tex) return tex;
                }
                return null;
            };
            Object.entries(materials.materials).forEach(([name, mat]) => {
                const m = mat as unknown as { map?: Texture | null; normalMap?: Texture | null; bumpMap?: Texture | null };
                const srcs = map[name] || {};
                const loadMaps = async () => {
                    if (!m.map && srcs.kd) {
                        const tex = await tryLoad(srcs.kd);
                        if (tex) { m.map = tex; applyTex(tex, true); }
                    }
                    if (!m.normalMap && srcs.bump) {
                        const tex = await tryLoad(srcs.bump);
                        if (tex) { m.normalMap = tex; applyTex(tex, false); m.bumpMap = null; }
                    }
                };
                void loadMaps();
            });

            obj.traverse((child) => {
                const mesh = child as Mesh;
                const mm = mesh.material as Material | Material[] | null | undefined;
                const applyMatFix = async (mat: Material) => {
                    const nm = (mat as unknown as { name?: string }).name || '';
                    const srcs = map[nm] || {};
                    const m = mat as unknown as { map?: Texture | null; normalMap?: Texture | null; bumpMap?: Texture | null };
                    if (m.bumpMap && !m.normalMap) {
                        m.normalMap = m.bumpMap;
                        m.bumpMap = null;
                    }
                    if (!m.map && srcs.kd) {
                        const tx = await tryLoad(srcs.kd);
                        if (tx) { m.map = tx; applyTex(tx, true); }
                    }
                    if (!m.normalMap && srcs.bump) {
                        const tx = await tryLoad(srcs.bump);
                        if (tx) { m.normalMap = tx; applyTex(tx, false); m.bumpMap = null; }
                    }
                };
                if (Array.isArray(mm)) {
                    mm.forEach((m) => { void applyMatFix(m); });
                } else if (mm) {
                    void applyMatFix(mm);
                }
            });
        };
        void run();
    }, [gl, materials, mtlPath, obj, disableTextures]);
    const initialMarkers = useMemo(() => {
        const rawInit = typeof window !== 'undefined' ? window.localStorage.getItem('ship:engineMarkers:' + objPath) : null;
        if (rawInit) {
            try {
                const parsed = JSON.parse(rawInit) as { positions?: { x: number; y: number; z: number; type?: string }[] };
                return parsed.positions || [];
            } catch { return []; }
        }
        return [] as { x: number; y: number; z: number; type?: string }[];
    }, [objPath]);
    const markers = useMemo(() => {
        if (plumePositions) return plumePositions;
        if (markerOverrides) return markerOverrides;
        if (initialMarkers.length > 0) return initialMarkers;
        const box = new Box3().setFromObject(obj);
        const size = box.getSize(new Vector3());
        const center = box.getCenter(new Vector3());
        const zBack = box.max.z - size.z * 0.08; // near the rear so exhaust trails behind
        const y = center.y - size.y * 0.04;
        const spread = Math.max(size.x * 0.28, 0.6);
        return [
            { x: center.x - spread, y, z: zBack, type: 'standard' },
            { x: center.x + spread, y, z: zBack, type: 'standard' }
        ];
    }, [initialMarkers, markerOverrides, plumePositions, obj]);
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
    const spriteMat = useMemo(() => new SpriteMaterial({ map: glowTex, blending: AdditiveBlending, transparent: true, depthWrite: false, depthTest: true, color: new Color('#9bd0ff') }), [glowTex]);
    useEffect(() => { spriteMatRef.current = spriteMat; }, [spriteMat]);
    const groupsRef = useRef<Record<number, Group | null>>({});

    // Use passed throttle or fallback to store (legacy/player)
    const storeThrottle = useGameStore((state) => state.throttle);
    const currentThrottle = throttle !== undefined ? throttle : storeThrottle;

    useFrame(() => {
        const k = Math.max(0, currentThrottle);
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
        const k = Math.max(0, currentThrottle);
        // Turn off plumes if throttle is near zero
        if (k <= 0.01) m.opacity = 0;
        else m.opacity = k * 0.85 + 0.15;
    });


    return (
        <group position={[0, -0.3, 0.0]} name={name}>
            <primitive object={obj} />
            {markers.map((m, i) => {
                const allPresets = getAllPresets();
                const config = allPresets[m.type || 'standard'] || allPresets['standard'];
                return (
                    <group key={`fx-${i}`} ref={(g) => { groupsRef.current[i] = g; }} frustumCulled={false} position={[m.x, m.y, m.z]}>
                        <NebulaPlume
                            position={[0, 0, 0.6]}
                            length={config.length ?? 2.5}
                            radius={config.radius ?? 0.5}
                            color={config.color ?? '#76baff'}
                            throttle={currentThrottle}
                            particleCount={config.particleCount ?? 10}
                            emissionRate={config.emissionRate ?? 0.075}
                            particleLife={config.particleLife ?? 0.75}
                            startScale={config.startScale ?? 2.0}
                            endScale={config.endScale ?? 0.3}
                            startAlpha={config.startAlpha ?? 0.8}
                            velocity={config.velocity ?? 15}
                            spread={config.spread ?? 12}
                            textureSoftness={config.textureSoftness ?? 0.5}
                        />
                        <sprite name="EngineGlow" position={[0, 0, 0.8]} scale={[config.radius * 2.4, config.radius * 2.4, 1]} frustumCulled={false} renderOrder={2}>
                            <primitive object={spriteMat} attach="material" />
                        </sprite>
                        {enableLights && (
                            <pointLight
                                position={[0, 0, 0.5]}
                                intensity={config.glow * currentThrottle * 2.0}
                                distance={8}
                                decay={2}
                                color={config.color}
                            />
                        )}
                    </group>
                );
            })}
            {editorMode && cockpitPosition && (
                <mesh position={[cockpitPosition.x, cockpitPosition.y, cockpitPosition.z]}>
                    <boxGeometry args={[0.5, 0.5, 0.5]} />
                    <meshBasicMaterial color="#00ff00" wireframe />
                </mesh>
            )}
            {editorMode && weaponPositions && weaponPositions.map((p, i) => (
                <mesh key={`wp-${i}`} position={[p.x, p.y, p.z]}>
                    <sphereGeometry args={[0.2, 8, 8]} />
                    <meshBasicMaterial color="#ff0000" wireframe />
                </mesh>
            ))}
            {enableLights && (
                <>
                    {/* Ambient fill */}
                    <pointLight position={[0, 2, 0]} intensity={0.5} distance={10} decay={2} color="#ffffff" />
                </>
            )}
        </group>
    );
};
