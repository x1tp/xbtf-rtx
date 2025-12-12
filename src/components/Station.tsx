import React, { useRef, useEffect, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import type { GLTF } from 'three-stdlib';
import { OBJLoader } from 'three-stdlib';
import { MTLLoader } from 'three-stdlib';
import { Group, MeshStandardMaterial, MeshBasicMaterial, Mesh, SRGBColorSpace, LinearSRGBColorSpace, DoubleSide, Box3, Vector3, TextureLoader, BufferGeometry, Float32BufferAttribute, Texture, RepeatWrapping, Matrix4, Quaternion, LinearMipmapLinearFilter, LinearFilter, MathUtils, type Object3D } from 'three';
import { ensureRapier, getWorld, getWorldSync } from '../physics/RapierWorld';
import type RAPIERType from '@dimforge/rapier3d-compat';
import { useGameStore } from '../store/gameStore';
import { ShieldWrapEffect, type ShieldWrapEffectHandle } from './ShieldWrapEffect';

interface StationProps {
    position: [number, number, number];
    rotate?: boolean;
    showLights?: boolean;
    scale?: number;
    modelPath?: string;
    rotationSpeed?: number;
    rotationAxis?: 'x' | 'y' | 'z';
    collisions?: boolean;
    rotation?: [number, number, number];
    objectName?: string;
    navRadius?: number;
}

const DEFAULT_MODEL_PATH = '/models/X_beyond_the_frontier_1121121213_texture.glb';

type ParallaxOpts = { heightMap?: Texture | null; scale?: number; minLayers?: number; maxLayers?: number };
const applyParallaxToMaterial = (mat: MeshStandardMaterial, opts: ParallaxOpts) => {
    const heightMap = opts.heightMap || null;
    if (!heightMap || (mat as unknown as { __parallaxApplied?: boolean }).__parallaxApplied) return;
    const scale = opts.scale ?? 0.04;
    const minLayers = opts.minLayers ?? 10.0;
    const maxLayers = opts.maxLayers ?? 25.0;
    heightMap.colorSpace = LinearSRGBColorSpace;
    heightMap.minFilter = LinearMipmapLinearFilter;
    heightMap.magFilter = LinearFilter;
    heightMap.anisotropy = Math.max(heightMap.anisotropy, 4);
    heightMap.generateMipmaps = true;
    if (heightMap.image) heightMap.needsUpdate = true;
    mat.onBeforeCompile = (shader) => {
        shader.uniforms.parallaxMap = { value: heightMap };
        shader.uniforms.parallaxScale = { value: scale };
        shader.uniforms.parallaxMinLayers = { value: minLayers };
        shader.uniforms.parallaxMaxLayers = { value: maxLayers };
        shader.vertexShader = shader.vertexShader.replace(
            '#include <uv_pars_vertex>',
            `#include <uv_pars_vertex>
             varying vec3 vViewDir;`
        );
        shader.vertexShader = shader.vertexShader.replace(
            '#include <project_vertex>',
            `#include <project_vertex>
             vViewDir = vViewPosition;`
        );
        shader.fragmentShader = shader.fragmentShader.replace(
            '#include <uv_pars_fragment>',
            `#include <uv_pars_fragment>
             uniform sampler2D parallaxMap;
             uniform float parallaxScale;
             uniform float parallaxMinLayers;
             uniform float parallaxMaxLayers;
             varying vec3 vViewDir;

             vec2 parallaxOcclusionMap(vec2 uv, vec3 viewDir) {
                 vec3 v = normalize(viewDir);
                 float ndotv = abs(v.z);
                 float numLayers = mix(parallaxMaxLayers, parallaxMinLayers, ndotv);
                 float layerDepth = 1.0 / numLayers;
                 vec2 delta = (v.xy / max(v.z, 0.001)) * parallaxScale / numLayers;
                 float currentDepth = 0.0;
                 float mapDepth = texture2D(parallaxMap, uv).r;
                 vec2 uvOffset = uv;
                 while (currentDepth < mapDepth) {
                     uvOffset -= delta;
                     mapDepth = texture2D(parallaxMap, uvOffset).r;
                     currentDepth += layerDepth;
                 }
                 return uvOffset;
             }`
        );
        shader.fragmentShader = shader.fragmentShader.replace(
            '#include <uv_fragment>',
            `#include <uv_fragment>
             if (parallaxScale > 0.0) {
                 vec2 puv = parallaxOcclusionMap(vUv, vViewDir);
                 vUv = puv;
                 #ifdef USE_MAP
                     vMapUv = puv;
                 #endif
                 #ifdef USE_NORMALMAP
                     vNormalMapUv = puv;
                 #endif
                 #ifdef USE_EMISSIVEMAP
                     vEmissiveMapUv = puv;
                 #endif
                 #ifdef USE_ROUGHNESSMAP
                     vRoughnessMapUv = puv;
                 #endif
                 #ifdef USE_METALNESSMAP
                     vMetalnessMapUv = puv;
                 #endif
                 #ifdef USE_AOMAP
                     vAoMapUv = puv;
                 #endif
             }`
        );
    };
    (mat as unknown as { __parallaxApplied?: boolean }).__parallaxApplied = true;
    mat.needsUpdate = true;
};

export const Station: React.FC<StationProps> = ({ position, rotate = true, showLights = true, scale = 40, modelPath, rotationSpeed = 0.05, rotationAxis = 'y', collisions = true, rotation = [0, 0, 0], objectName, navRadius }) => {
    const stationRef = useRef<Group | null>(null);
    const colliderBodiesRef = useRef<RAPIERType.RigidBody[]>([]);
    const stationBodyRef = useRef<RAPIERType.RigidBody | null>(null);
    const isBod = !!modelPath && modelPath.toLowerCase().endsWith('.bod');
    const isObj = !!modelPath && modelPath.toLowerCase().endsWith('.obj');
    const gltf = useGLTF(DEFAULT_MODEL_PATH) as GLTF;
    const { gl } = useThree();
    const resolveTexUrl = async (id: number) => {
        const a = `/models/tex/${id}.jpg`;
        const b = `/models/tex/${id}.JPG`;
        const c = `/models/true/${id}.jpg`;
        const d = `/models/true/${id}.JPG`;
        let okA = false;
        let okB = false;
        let okC = false;
        let okD = false;
        try {
            const r = await fetch(a, { method: 'HEAD' });
            okA = r.ok;
        } catch {
            okA = false;
        }
        if (okA) return a;
        try {
            const r2 = await fetch(b, { method: 'HEAD' });
            okB = r2.ok;
        } catch {
            okB = false;
        }
        if (okB) return b;
        try {
            const r3 = await fetch(c, { method: 'HEAD' });
            okC = r3.ok;
        } catch {
            okC = false;
        }
        if (okC) return c;
        try {
            const r4 = await fetch(d, { method: 'HEAD' });
            okD = r4.ok;
        } catch {
            okD = false;
        }
        if (okD) return d;
        return null;
    };
    const loadTexById = (loader: TextureLoader, url: string | null, aniso: number): Texture | null => {
        if (!url) return null;
        const map = loader.load(url, (tex) => {
            tex.colorSpace = SRGBColorSpace;
            tex.anisotropy = aniso;
            tex.flipY = false;
            tex.wrapS = RepeatWrapping;
            tex.wrapT = RepeatWrapping;
            tex.generateMipmaps = true;
            tex.needsUpdate = true;
        });
        return map;
    };

    useFrame((_, delta) => {
        if (rotate && stationRef.current) {
            const d = delta * rotationSpeed;
            if (rotationAxis === 'x') stationRef.current.rotation.x += d;
            else if (rotationAxis === 'y') stationRef.current.rotation.y += d;
            else stationRef.current.rotation.z += d;
        }
        if (stationBodyRef.current && stationRef.current) {
            const pos = new Vector3();
            const quat = new Quaternion();
            stationRef.current.getWorldPosition(pos);
            stationRef.current.getWorldQuaternion(quat);
            stationBodyRef.current.setNextKinematicTranslation({ x: pos.x, y: pos.y, z: pos.z });
            stationBodyRef.current.setNextKinematicRotation({ x: quat.x, y: quat.y, z: quat.z, w: quat.w });
        }
    });

    useEffect(() => {
        let cancelled = false;
        const clearBodies = () => {
            const w = getWorldSync();
            if (w && colliderBodiesRef.current.length > 0) {
                colliderBodiesRef.current.forEach((b) => {
                    try {
                        if (w.bodies.contains(b.handle)) w.removeRigidBody(b);
                    } catch (e) {
                        console.warn('Station cleanup failed:', e);
                    }
                });
            }
            colliderBodiesRef.current = [];
            stationBodyRef.current = null;
        };
        const rebuildCollision = async (target: Group | null) => {
            if (!collisions) return;
            if (!target) return;
            clearBodies();
            const RAPIER = await ensureRapier();
            if (cancelled) return;
            const world = await getWorld();
            if (cancelled) return;
            target.updateWorldMatrix(true, true);
            const stationMatrix = target.matrixWorld.clone();
            const stationPos = new Vector3();
            const stationQuat = new Quaternion();
            stationMatrix.decompose(stationPos, stationQuat, new Vector3());
            const stationTR = new Matrix4().compose(stationPos, stationQuat, new Vector3(1, 1, 1));
            const invStationTR = stationTR.clone().invert();
            const bodyDesc = RAPIER.RigidBodyDesc.kinematicPositionBased()
                .setCcdEnabled(true)
                .setTranslation(stationPos.x, stationPos.y, stationPos.z)
                .setRotation({ x: stationQuat.x, y: stationQuat.y, z: stationQuat.z, w: stationQuat.w });
            const body = world.createRigidBody(bodyDesc);
            const verts: number[] = [];
            const indices: number[] = [];
            const v = new Vector3();
            target.traverse((o) => {
                const mesh = o as Mesh;
                const g = mesh.geometry as BufferGeometry | undefined;
                if (!g || !g.attributes?.position) return;
                const pos = g.getAttribute('position');
                const base = verts.length / 3;
                for (let i = 0; i < pos.count; i++) {
                    v.set(pos.getX(i), pos.getY(i), pos.getZ(i))
                        .applyMatrix4(mesh.matrixWorld)
                        .applyMatrix4(invStationTR);
                    verts.push(v.x, v.y, v.z);
                }
                if (g.index) {
                    const arr = g.index.array as unknown as number[];
                    for (let i = 0; i < arr.length; i++) {
                        indices.push(base + arr[i]);
                    }
                } else {
                    for (let i = 0; i < pos.count; i += 3) {
                        indices.push(base + i + 0, base + i + 1, base + i + 2);
                    }
                }
            });
            let collider: RAPIERType.Collider | null = null;
            let used = 'none';
            if (verts.length >= 9 && indices.length >= 3) {
                const tri = RAPIER.ColliderDesc.trimesh(new Float32Array(verts), new Uint32Array(indices));
                tri.setFriction(0.9).setRestitution(0.0);
                collider = world.createCollider(tri, body);
                used = 'trimesh';
            }
            if (!collider && verts.length >= 9) {
                const hull = RAPIER.ColliderDesc.convexHull(new Float32Array(verts));
                if (hull) {
                    hull.setFriction(0.9).setRestitution(0.0);
                    collider = world.createCollider(hull, body);
                    used = 'hull';
                }
            }
            if (!collider) {
                const box = new Box3().setFromObject(target);
                const size = box.getSize(new Vector3());
                const he = size.multiplyScalar(0.5);
                const collDesc = RAPIER.ColliderDesc.cuboid(he.x, he.y, he.z).setFriction(0.9).setRestitution(0.0);
                collider = world.createCollider(collDesc, body);
                used = 'box';
            }
            if (cancelled) {
                world.removeRigidBody(body);
                return;
            }
            stationBodyRef.current = body;
            colliderBodiesRef.current = [body];
            console.log('Station collider built:', used, 'verts:', verts.length / 3, 'tris:', indices.length / 3);
        };
        clearBodies();
        if (isBod && stationRef.current) {
            (async () => {
                const res = await fetch(modelPath as string);
                const text = await res.text();
                if (cancelled) return;
                const lines = text.split(/\r?\n/);
                const materials = new Map<number, number>();
                for (const line of lines) {
                    const m = line.match(/^\s*MATERIAL3:\s*(\d+)\s*;(\d+)/i);
                    if (m) materials.set(parseInt(m[1], 10), parseInt(m[2], 10));
                }
                let size = 1;
                for (const line of lines) {
                    const s = line.match(/^\s*(\d+)\s*;\s*\/\s*Automatic Object Size/i);
                    if (s) { size = parseInt(s[1], 10); break; }
                }
                const scaleCoord = size * 0.00000002;
                const vertices: number[][] = [];
                let i = 0;
                while (i < lines.length) {
                    const ln = lines[i++];
                    const v = ln && ln.match(/^\s*(-?\d+)\s*;\s*(-?\d+)\s*;\s*(-?\d+)\s*;/);
                    if (!v) continue;
                    const x = parseInt(v[1], 10);
                    const y = parseInt(v[2], 10);
                    const z = parseInt(v[3], 10);
                    if (x === -1 && y === -1 && z === -1) break;
                    vertices.push([x * scaleCoord, y * scaleCoord, z * scaleCoord]);
                }
                const group = new Group();
                const loader = new TextureLoader();
                const aniso = gl?.capabilities?.getMaxAnisotropy?.() ?? 4;
                const acc = new Map<number, { positions: number[]; uvs: number[] }>();
                let partName = '';
                const ctr = new Vector3();
                for (const v of vertices) { ctr.x += v[0]; ctr.y += v[1]; ctr.z += v[2]; }
                if (vertices.length > 0) { ctr.x /= vertices.length; ctr.y /= vertices.length; ctr.z /= vertices.length; }
                for (let j = i; j < lines.length; j++) {
                    const raw = lines[j];
                    if (!raw) continue;
                    if (/^\s*-99\s*;/.test(raw)) continue;
                    const ph = raw.match(/^\s*\/----- Part\s*\d+:.*"([^"]+)"/);
                    if (ph) { partName = ph[1] || ''; continue; }
                    const body = raw.split('/')[0];
                    const tokens = body.split(';').map((t) => t.trim()).filter((t) => t.length > 0);
                    if (tokens.length < 6) continue;
                    const mat = parseInt(tokens[0], 10);
                    const v1 = parseInt(tokens[1], 10);
                    const v2 = parseInt(tokens[2], 10);
                    const v3 = parseInt(tokens[3], 10);
                    if (isNaN(mat) || isNaN(v1) || isNaN(v2) || isNaN(v3)) continue;
                    if (v1 === v2 || v2 === v3 || v1 === v3) continue;
                    const skip = partName.toLowerCase().includes('boden');
                    if (skip) continue;
                    const a = vertices[v1];
                    const b = vertices[v2];
                    const c = vertices[v3];
                    if (!a || !b || !c) continue;
                    const entry = acc.get(mat) || { positions: [], uvs: [] };
                    const ax = a[0], ay = a[1], az = a[2];
                    const bx = b[0], by = b[1], bz = b[2];
                    const cx = c[0], cy = c[1], cz = c[2];
                    const abx = bx - ax, aby = by - ay, abz = bz - az;
                    const acx = cx - ax, acy = cy - ay, acz = cz - az;
                    const nx = aby * acz - abz * acy;
                    const ny = abz * acx - abx * acz;
                    const nz = abx * acy - aby * acx;
                    const area2 = Math.sqrt(nx * nx + ny * ny + nz * nz);
                    if (area2 < 1e-12) continue;
                    const mx = (ax + bx + cx) / 3 - ctr.x;
                    const my = (ay + by + cy) / 3 - ctr.y;
                    const mz = (az + bz + cz) / 3 - ctr.z;
                    const dot = nx * mx + ny * my + nz * mz;
                    if (dot < 0) {
                        entry.positions.push(ax, ay, az, cx, cy, cz, bx, by, bz);
                    } else {
                        entry.positions.push(ax, ay, az, bx, by, bz, cx, cy, cz);
                    }
                    const uv = tokens.length >= 12 ? [parseFloat(tokens[6]), parseFloat(tokens[7]), parseFloat(tokens[8]), parseFloat(tokens[9]), parseFloat(tokens[10]), parseFloat(tokens[11])] : [0, 0, 0, 0, 0, 0];
                    if (dot < 0) entry.uvs.push(uv[0], uv[1], uv[4], uv[5], uv[2], uv[3]); else entry.uvs.push(uv[0], uv[1], uv[2], uv[3], uv[4], uv[5]);
                    acc.set(mat, entry);
                }
                if (cancelled) return;
                for (const [matId, texId] of materials.entries()) {
                    const entry = acc.get(matId);
                    if (!entry || entry.positions.length === 0) continue;
                    const g = new BufferGeometry();
                    g.setAttribute('position', new Float32BufferAttribute(new Float32Array(entry.positions), 3));
                    g.setAttribute('uv', new Float32BufferAttribute(new Float32Array(entry.uvs), 2));
                    g.computeVertexNormals();
                    g.computeBoundingSphere();
                    const m = new MeshStandardMaterial({ color: '#ffffff', roughness: 0.8, metalness: 0.0, side: DoubleSide });
                    const url = await resolveTexUrl(texId);
                    const map = loadTexById(loader, url, aniso);
                    if (map) m.map = map;
                    const mesh = new Mesh(g, m);
                    mesh.name = `mat_${matId}`;
                    mesh.castShadow = true;
                    mesh.receiveShadow = true;
                    group.add(mesh);
                }
                if (cancelled) return;
                stationRef.current?.clear();
                stationRef.current?.add(group);
                void rebuildCollision(stationRef.current);
            })();
        }
        if (isObj && stationRef.current) {
            const mtlUrl = (modelPath as string).replace(/\.obj$/i, '.mtl');
            const mtlBase = mtlUrl.slice(0, mtlUrl.lastIndexOf('/') + 1);
            const mtlLoader = new MTLLoader();
            mtlLoader.setResourcePath(mtlBase);
            mtlLoader.load(mtlUrl, async (materials) => {
                if (cancelled) return;
                materials.preload();
                const loader = new OBJLoader();
                loader.setMaterials(materials);
                const mtlText = await fetch(mtlUrl).then((r) => r.text()).catch(() => '');
                const texMap: Record<string, { kd?: string; bump?: string }> = {};
                let cur = '';
                mtlText.split(/\r?\n/).forEach((ln) => {
                    const a = ln.match(/^\s*newmtl\s+(.+)$/i);
                    if (a) { cur = a[1].trim(); if (!texMap[cur]) texMap[cur] = {}; return; }
                    const kd = ln.match(/^\s*map_Kd\s+(.+)$/i);
                    if (kd && cur) {
                        const s = kd[1].trim();
                        const m = s.match(/([^\s]+\.(?:jpe?g|png|tga|bmp))/i);
                        texMap[cur].kd = (m ? m[1] : s);
                    }
                    const mb = ln.match(/^\s*map_bump\s+(.+)$/i) || ln.match(/^\s*bump\s+(.+)$/i);
                    if (mb && cur) {
                        const s = mb[1].trim();
                        const m2 = s.match(/([^\s]+\.(?:jpe?g|png|tga|bmp))/i);
                        texMap[cur].bump = (m2 ? m2[1] : s);
                    }
                });
                loader.load(modelPath as string, (obj) => {
                    if (cancelled) return;
                    const aniso = gl?.capabilities?.getMaxAnisotropy?.() ?? 4;
                    const tloader = new TextureLoader();
                    const applyTex = (tex: Texture | null, isColor: boolean) => {
                        if (!tex) return;
                        tex.colorSpace = isColor ? SRGBColorSpace : LinearSRGBColorSpace;
                        tex.anisotropy = aniso;
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
                        const make = (u: string) => (u.startsWith('/') ? u : mtlBase + u);
                        const urls: string[] = [];
                        const np = normalize(p);
                        urls.push(make(np));
                        const lower = np.replace(/\.(JPE?G|PNG|TGA|BMP)$/i, (m) => m.toLowerCase());
                        if (lower !== p) urls.push(make(lower));
                        const bn = np.split('/').pop() || np;
                        urls.push('/models/true/' + bn);
                        urls.push('/models/tex/' + bn);
                        for (const u of urls) {
                            console.log(`[Station] Attempting to load texture: ${u}`);
                            const tex = await tloader.loadAsync(u).catch((err) => {
                                console.warn(`[Station] Failed to load texture ${u}: ${err.message}`);
                                return null;
                            });
                            if (tex) {
                                console.log(`[Station] Successfully loaded texture: ${u}`);
                                return tex;
                            }
                        }
                        console.error(`[Station] No texture found for path: ${p}`);
                        return null;
                    };
                    obj.traverse((o) => {
                        const mesh = o as Mesh;
                        mesh.castShadow = true;
                        mesh.receiveShadow = true;
                        const apply = (m: MeshStandardMaterial, matIndex: number) => {
                            console.log(`[Station] Applying material for ${modelPath}:`, m.name, 'Has map:', !!m.map);
                            m.side = DoubleSide;
                            // Reduce specular on Phong materials (OBJLoader default)
                            if ((m as unknown as { isMeshPhongMaterial: boolean }).isMeshPhongMaterial) {
                                const phong = m as unknown as { specular: { setScalar: (v: number) => void }; shininess: number };
                                phong.specular.setScalar(0.1);
                                phong.shininess = 10;
                            }
                            // Ensure emissive materials glow properly (engines, windows, lights)
                            // Check if material has emissive color set from MTL Ke values
                            if (m.emissive) {
                                const e = m.emissive;
                                const brightness = e.r + e.g + e.b;
                                if (brightness > 0.01) {
                                    // Replace with MeshBasicMaterial - completely unlit, ignores all lighting
                                    const tex = m.map;
                                    const basicMat = new MeshBasicMaterial({
                                        map: tex,
                                        side: DoubleSide,
                                        toneMapped: false,
                                    });
                                    if (tex) {
                                        tex.colorSpace = SRGBColorSpace;
                                        tex.anisotropy = aniso;
                                        tex.flipY = false;
                                    }
                                    // Replace material on mesh
                                    if (Array.isArray(mesh.material)) {
                                        mesh.material[matIndex] = basicMat;
                                    } else {
                                        mesh.material = basicMat;
                                    }
                                    // Emissive surfaces shouldn't receive or cast shadows
                                    mesh.receiveShadow = false;
                                    mesh.castShadow = false;
                                    return; // Skip rest of processing
                                }
                            }
                            if (m.map) { m.map.colorSpace = SRGBColorSpace; m.map.anisotropy = aniso; m.map.flipY = false; }
                            if (m.emissiveMap) { m.emissiveMap.colorSpace = SRGBColorSpace; m.emissiveMap.anisotropy = aniso; m.emissiveMap.flipY = false; }
                            if ((m as unknown as { bumpMap?: Texture }).bumpMap && !m.normalMap) {
                                m.normalMap = (m as unknown as { bumpMap?: Texture }).bumpMap as Texture;
                                (m as unknown as { bumpMap?: Texture }).bumpMap = undefined;
                            }
                            if (m.normalMap) {
                                m.normalMap.colorSpace = LinearSRGBColorSpace;
                                m.normalMap.anisotropy = aniso;
                                m.normalMap.flipY = false;
                                if (m.normalScale) m.normalScale.set(0.7, 0.7);
                            }
                            if (m.roughnessMap) { m.roughnessMap.colorSpace = LinearSRGBColorSpace; m.roughnessMap.anisotropy = aniso; }
                            if (m.metalnessMap) { m.metalnessMap.colorSpace = LinearSRGBColorSpace; m.metalnessMap.anisotropy = aniso; }
                            const tloader = new TextureLoader();
                            const src = (m.map && (m.map as Texture).image && (m.map as Texture).image && (m.map as Texture).image.src ? (m.map as Texture).image.src : ((m.map as Texture | undefined) && (m.map as Texture).source && (m.map as Texture).source.data && (m.map as Texture).source.data.src ? (m.map as Texture).source.data.src : '')) as string;
                            const ext = src.toLowerCase().endsWith('.png') ? 'png' : 'jpg';
                            const base = src ? src.replace(/\.(png|jpg)$/i, '') : '';
                            const tryTex = (url: string | null, linear: boolean) => {
                                if (!url) return null;
                                const tx = tloader.load(url);
                                tx.colorSpace = linear ? LinearSRGBColorSpace : SRGBColorSpace;
                                tx.anisotropy = aniso;
                                tx.flipY = false;
                                return tx;
                            };
                            if (base) {
                                const lm = tryTex(`${base}-light.${ext}`, true);
                                if (lm) { m.lightMap = lm; m.lightMapIntensity = 1.0; }
                                const ao = tryTex(`${base}-ao.${ext}`, true);
                                if (ao) { m.aoMap = ao; m.aoMapIntensity = 0.8; }
                                const rr = tryTex(`${base}-roughness.${ext}`, true);
                                if (rr) m.roughnessMap = rr;
                                const mm = tryTex(`${base}-metallic.${ext}`, true);
                                if (mm) m.metalnessMap = mm;
                                const em = tryTex(`${base}-emissive.${ext}`, false);
                                if (em) { m.emissiveMap = em; m.emissiveIntensity = 1.0; }
                            }
                            const nm = (m.name || '').trim();
                            const srcs = texMap[nm] || {};
                            const fixMaps = async () => {
                                if (!m.map && srcs.kd) {
                                    const tx = await tryLoad(srcs.kd);
                                    if (tx) { m.map = tx; applyTex(tx, true); }
                                }
                                if (!m.normalMap && srcs.bump) {
                                    const tx = await tryLoad(srcs.bump);
                                    if (tx) { m.normalMap = tx; applyTex(tx, false); }
                                }
                            };
                            void fixMaps();
                            if (typeof m.metalness === 'number') m.metalness = Math.min(m.metalness ?? 0.0, 0.1);
                            if (typeof m.roughness === 'number') m.roughness = Math.max(m.roughness ?? 0.8, 0.9);
                            applyParallaxToMaterial(m, { heightMap: m.roughnessMap || m.normalMap, scale: 0.045, minLayers: 12, maxLayers: 28 });
                            m.needsUpdate = true;
                        };
                        const g = mesh.geometry as unknown as { attributes?: Record<string, unknown>; computeVertexNormals?: () => void } | undefined;
                        if (g && g.attributes && !('normal' in g.attributes) && typeof g.computeVertexNormals === 'function') {
                            g.computeVertexNormals();
                        }
                        const geo = mesh.geometry as BufferGeometry | undefined;
                        if (geo && typeof (geo as BufferGeometry).getAttribute === 'function') {
                            const uv = geo.getAttribute('uv');
                            const uv2 = geo.getAttribute('uv2');
                            if (uv && !uv2) {
                                geo.setAttribute('uv2', (uv as Float32BufferAttribute).clone());
                            }
                        }
                        const mat = mesh.material as MeshStandardMaterial | MeshStandardMaterial[] | null | undefined;
                        if (Array.isArray(mat)) mat.forEach((m, i) => apply(m, i)); else if (mat) apply(mat as MeshStandardMaterial, 0);
                    });
                    if (cancelled) return;
                    if (stationRef.current) {
                        stationRef.current.clear();
                        stationRef.current.add(obj);
                        void rebuildCollision(stationRef.current);
                    }
                });
            });
        }
        if (!isBod && !isObj) {
            const aniso = gl?.capabilities?.getMaxAnisotropy?.() ?? 4;
            const tloader = new TextureLoader();
            const configureTexture = (tex: Texture, linear: boolean) => {
                tex.colorSpace = linear ? LinearSRGBColorSpace : SRGBColorSpace;
                tex.anisotropy = aniso;
                tex.flipY = false;
                tex.generateMipmaps = true;
                tex.needsUpdate = true;
            };
            const texCache = new Map<string, Promise<Texture | null>>();
            const loadStationTexture = (url: string, linear: boolean) => {
                if (!texCache.has(url)) {
                    const p = tloader.loadAsync(url)
                        .then((tex) => {
                            configureTexture(tex, linear);
                            return tex;
                        })
                        .catch(() => null);
                    texCache.set(url, p);
                }
                return texCache.get(url)!;
            };
            gltf.scene.traverse((o) => {
                const mesh = o as Mesh;
                const mat = mesh.material as MeshStandardMaterial | MeshStandardMaterial[] | null | undefined;
                mesh.castShadow = true;
                mesh.receiveShadow = true;
                const bbox = new Box3().setFromObject(mesh);
                const size = bbox.getSize(new Vector3());
                const maxd = Math.max(size.x, size.y, size.z);
                const mind = Math.min(size.x, size.y, size.z);
                if (mind < maxd * 0.002) {
                    mesh.visible = false;
                    return;
                }
                const apply = (m: MeshStandardMaterial, matIndex: number) => {
                    m.side = DoubleSide;
                    // Ensure emissive materials glow properly (engines, windows, lights)
                    // Emissive surfaces should NOT receive shadows - they glow on their own
                    if (m.emissive) {
                        const e = m.emissive;
                        const brightness = e.r + e.g + e.b;
                        if (brightness > 0.01) {
                            // Replace with MeshBasicMaterial - completely unlit
                            const tex = m.map;
                            const basicMat = new MeshBasicMaterial({
                                map: tex,
                                side: DoubleSide,
                                toneMapped: false,
                            });
                            if (tex) {
                                tex.colorSpace = SRGBColorSpace;
                                tex.anisotropy = aniso;
                            }
                            if (Array.isArray(mesh.material)) {
                                mesh.material[matIndex] = basicMat;
                            } else {
                                mesh.material = basicMat;
                            }
                            mesh.receiveShadow = false;
                            mesh.castShadow = false;
                            return;
                        }
                    }
                    if (m.map) { m.map.colorSpace = SRGBColorSpace; m.map.anisotropy = aniso; }
                    if (m.emissiveMap) { m.emissiveMap.colorSpace = SRGBColorSpace; m.emissiveMap.anisotropy = aniso; }
                    if (m.normalMap) { m.normalMap.colorSpace = LinearSRGBColorSpace; m.normalMap.anisotropy = aniso; }
                    if (m.roughnessMap) { m.roughnessMap.colorSpace = LinearSRGBColorSpace; m.roughnessMap.anisotropy = aniso; }
                    if (m.metalnessMap) { m.metalnessMap.colorSpace = LinearSRGBColorSpace; m.metalnessMap.anisotropy = aniso; }
                    const nm = m.name?.toLowerCase?.() || '';
                    if (nm.includes('station_hull')) {
                        Promise.all([
                            loadStationTexture('/materials/station_hull/baseColor.png', false),
                            loadStationTexture('/materials/station_hull/roughness.png', true),
                            loadStationTexture('/materials/station_hull/metallic.png', true),
                        ]).then(([bc, rr, mm]) => {
                            if (cancelled) return;
                            if (bc) m.map = bc;
                            if (rr) m.roughnessMap = rr;
                            if (mm) m.metalnessMap = mm;
                            m.needsUpdate = true;
                        });
                    } else if (nm.includes('station_brushed')) {
                        Promise.all([
                            loadStationTexture('/materials/station_brushed/baseColor.png', false),
                            loadStationTexture('/materials/station_brushed/roughness.png', true),
                            loadStationTexture('/materials/station_brushed/metallic.png', true),
                        ]).then(([bc, rr, mm]) => {
                            if (cancelled) return;
                            if (bc) m.map = bc;
                            if (rr) m.roughnessMap = rr;
                            if (mm) m.metalnessMap = mm;
                            m.needsUpdate = true;
                        });
                    } else if (nm.includes('station_lights')) {
                        Promise.all([
                            loadStationTexture('/materials/station_lights/baseColor.png', false),
                            loadStationTexture('/materials/station_lights/emissive.png', false),
                        ]).then(([bc, em]) => {
                            if (cancelled) return;
                            if (bc) m.map = bc;
                            if (em) m.emissiveMap = em;
                            m.needsUpdate = true;
                        });
                    }
                    if (m.normalMap && m.normalScale) m.normalScale.set(0.35, 0.35);
                    if (typeof m.metalness === 'number') m.metalness = Math.min(m.metalness, 0.12);
                    if (typeof m.roughness === 'number') m.roughness = Math.max(m.roughness, 0.9);
                    if (m.aoMap) m.aoMapIntensity = 0.8;
                    applyParallaxToMaterial(m, { heightMap: m.roughnessMap || m.normalMap, scale: 0.035, minLayers: 10, maxLayers: 24 });
                    m.needsUpdate = true;
                };
                const g = mesh.geometry as unknown as { attributes?: Record<string, unknown>; computeVertexNormals?: () => void };
                if (g && g.attributes && !('normal' in g.attributes) && typeof g.computeVertexNormals === 'function') {
                    g.computeVertexNormals();
                }
                if (Array.isArray(mat)) mat.forEach((m, i) => apply(m, i)); else if (mat) apply(mat as MeshStandardMaterial, 0);
            });
            if (stationRef.current) {
                void rebuildCollision(stationRef.current);
            }
        }
        return () => {
            cancelled = true;
            clearBodies();
        };
    }, [collisions, gltf, gl, isBod, isObj, modelPath]);

    const shieldRef = useRef<ShieldWrapEffectHandle | null>(null);
    const [shieldThickness, setShieldThickness] = useState(0.25);
    const [shieldTarget, setShieldTarget] = useState<Object3D | null>(null);
    const lastImpactSeenRef = useRef(0);
    const boundsReadyRef = useRef(false);

    useEffect(() => {
        if (!stationRef.current) return;
        setShieldTarget(stationRef.current);
        boundsReadyRef.current = false;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [gltf, modelPath]);

    useFrame(() => {
        const impact = useGameStore.getState().lastImpact;
        const st = stationRef.current;
        if (!impact || !st || !shieldRef.current) return;
        if (impact.timestamp <= lastImpactSeenRef.current) return;
        if (Date.now() - impact.timestamp > 700) return;

        const impactPos = new Vector3(impact.position[0], impact.position[1], impact.position[2]);

        // Compute bounds on demand; stations are irregular so center distance is unreliable.
        const box = new Box3().setFromObject(st);
        const sphere = { center: new Vector3(), radius: 0 };
        box.getBoundingSphere(sphere as any);
        const dist = sphere.center.distanceTo(impactPos);
        const margin = Math.max(40, sphere.radius * 0.08);
        if (dist > sphere.radius + margin) return;

        // Once bounds exist, adjust thickness to fit scale.
        if (!boundsReadyRef.current && sphere.radius > 1) {
            boundsReadyRef.current = true;
            setShieldThickness(MathUtils.clamp(sphere.radius * 0.003, 0.18, 0.8));
        }

        lastImpactSeenRef.current = impact.timestamp;
        const hitDirWorld = new Vector3(impact.dir[0], impact.dir[1], impact.dir[2]).normalize();
        const invQ = st.quaternion.clone().invert();
        const hitDirLocal = hitDirWorld.applyQuaternion(invQ).normalize();
        shieldRef.current.trigger(hitDirLocal, impact.strength);
    });

    const navSize = typeof navRadius === 'number' ? navRadius : scale * 1.2;
    return (
        <group
            ref={stationRef}
            position={position}
            rotation={rotation as [number, number, number]}
            scale={[scale, scale, scale]}
            name={objectName ?? 'Station'}
            userData={{ navRadius: navSize }}
        >
            {!isBod && !isObj && <primitive object={gltf.scene} />}
            <ShieldWrapEffect ref={shieldRef} target={shieldTarget} thickness={shieldThickness} />
            {showLights && <pointLight position={[0, 10, 0]} intensity={2} color="cyan" distance={50} />}
            {showLights && <pointLight position={[0, -10, 0]} intensity={2} color="cyan" distance={50} />}
        </group>
    );
};

useGLTF.preload(DEFAULT_MODEL_PATH);
