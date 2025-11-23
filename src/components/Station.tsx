import React, { useRef, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import type { GLTF } from 'three-stdlib';
import { OBJLoader } from 'three-stdlib';
import { MTLLoader } from 'three-stdlib';
import { Group, MeshStandardMaterial, Mesh, SRGBColorSpace, LinearSRGBColorSpace, DoubleSide, Box3, Vector3, TextureLoader, BufferGeometry, Float32BufferAttribute, Texture, RepeatWrapping } from 'three';
import { ensureRapier, getWorld } from '../physics/RapierWorld';

interface StationProps {
    position: [number, number, number];
    rotate?: boolean;
    showLights?: boolean;
    scale?: number;
    modelPath?: string;
    rotationSpeed?: number;
    rotationAxis?: 'x' | 'y' | 'z';
}

const DEFAULT_MODEL_PATH = '/models/X_beyond_the_frontier_1121121213_texture.glb';

export const Station: React.FC<StationProps> = ({ position, rotate = true, showLights = true, scale = 40, modelPath, rotationSpeed = 0.05, rotationAxis = 'y' }) => {
    const stationRef = useRef<Group | null>(null);
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
        const map = loader.load(url);
        map.colorSpace = SRGBColorSpace;
        map.anisotropy = aniso;
        map.flipY = false;
        map.wrapS = RepeatWrapping;
        map.wrapT = RepeatWrapping;
        map.needsUpdate = true;
        return map;
    };

    useFrame((_, delta) => {
        if (rotate && stationRef.current) {
            const d = delta * rotationSpeed;
            if (rotationAxis === 'x') stationRef.current.rotation.x += d;
            else if (rotationAxis === 'y') stationRef.current.rotation.y += d;
            else stationRef.current.rotation.z += d;
        }
    });

    useEffect(() => {
        if (isBod && stationRef.current) {
            (async () => {
                const res = await fetch(modelPath as string);
                const text = await res.text();
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
                for (const [matId, texId] of materials.entries()) {
                    const entry = acc.get(matId);
                    if (!entry || entry.positions.length === 0) continue;
                    const g = new BufferGeometry();
                    g.setAttribute('position', new Float32BufferAttribute(new Float32Array(entry.positions), 3));
                    g.setAttribute('uv', new Float32BufferAttribute(new Float32Array(entry.uvs), 2));
                    g.computeVertexNormals();
                    g.computeBoundingSphere();
                    const m = new MeshStandardMaterial({ color: '#ffffff', roughness: 0.8, metalness: 0.0, side: DoubleSide });
                    if (matId === 3) { m.transparent = true; m.opacity = 0.35; }
                    const url = await resolveTexUrl(texId);
                    const map = loadTexById(loader, url, aniso);
                    if (map) m.map = map;
                    const mesh = new Mesh(g, m);
                    mesh.name = `mat_${matId}`;
                    mesh.castShadow = true;
                    mesh.receiveShadow = true;
                    group.add(mesh);
                }
                stationRef.current?.clear();
                stationRef.current?.add(group);
            })();
        }
        if (isObj && stationRef.current) {
            const mtlUrl = (modelPath as string).replace(/\.obj$/i, '.mtl');
            const mtlLoader = new MTLLoader();
            mtlLoader.load(mtlUrl, (materials) => {
                materials.preload();
                const loader = new OBJLoader();
                loader.setMaterials(materials);
                loader.load(modelPath as string, (obj) => {
                    const aniso = gl?.capabilities?.getMaxAnisotropy?.() ?? 4;
                    obj.traverse((o) => {
                        const mesh = o as Mesh;
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
                        const apply = (m: MeshStandardMaterial) => {
                            m.side = DoubleSide;
                            if (m.map) { m.map.colorSpace = SRGBColorSpace; m.map.anisotropy = aniso; }
                            if (m.emissiveMap) { m.emissiveMap.colorSpace = SRGBColorSpace; m.emissiveMap.anisotropy = aniso; }
                            if (m.normalMap) { m.normalMap.colorSpace = LinearSRGBColorSpace; m.normalMap.anisotropy = aniso; }
                            if (m.roughnessMap) { m.roughnessMap.colorSpace = LinearSRGBColorSpace; m.roughnessMap.anisotropy = aniso; }
                            if (m.metalnessMap) { m.metalnessMap.colorSpace = LinearSRGBColorSpace; m.metalnessMap.anisotropy = aniso; }
                            const n = m.name?.toLowerCase?.() || '';
                            if (n === 'mat_3') { m.transparent = true; m.opacity = 0.35; }
                            m.needsUpdate = true;
                        };
                        const g = mesh.geometry as unknown as { attributes?: Record<string, unknown>; computeVertexNormals?: () => void };
                        if (g && g.attributes && !('normal' in g.attributes) && typeof g.computeVertexNormals === 'function') {
                            g.computeVertexNormals();
                        }
                        const mat = mesh.material as MeshStandardMaterial | MeshStandardMaterial[] | null | undefined;
                        if (Array.isArray(mat)) mat.forEach(apply); else if (mat) apply(mat as MeshStandardMaterial);
                    });
                    if (stationRef.current) {
                        stationRef.current.clear();
                        stationRef.current.add(obj);
                        (async () => {
                            const RAPIER = await ensureRapier();
                            const world = await getWorld();
                            obj.updateWorldMatrix(true, true);
                            obj.traverse((o) => {
                                const mesh = o as Mesh;
                                const g = mesh.geometry as BufferGeometry;
                                if (!g || !g.attributes?.position) return;
                                const pos = g.getAttribute('position');
                                const count = pos.count;
                                const verts = new Float32Array(count * 3);
                                const v = new Vector3();
                                for (let i = 0; i < count; i++) {
                                    const x = pos.getX(i);
                                    const y = pos.getY(i);
                                    const z = pos.getZ(i);
                                    v.set(x, y, z).applyMatrix4(mesh.matrixWorld);
                                    verts[i * 3 + 0] = v.x;
                                    verts[i * 3 + 1] = v.y;
                                    verts[i * 3 + 2] = v.z;
                                }
                                let idx: Uint32Array | null = null;
                                if (g.index) {
                                    idx = Uint32Array.from((g.index.array as unknown as number[]));
                                } else {
                                    const triCount = Math.floor(verts.length / 3);
                                    idx = new Uint32Array(triCount);
                                    for (let i = 0; i < triCount; i++) idx[i] = i;
                                }
                                const bodyDesc = RAPIER.RigidBodyDesc.fixed();
                                const body = world.createRigidBody(bodyDesc);
                                const collDesc = RAPIER.ColliderDesc.trimesh(verts, idx!);
                                world.createCollider(collDesc, body);
                            });
                        })();
                    }
                });
            });
        }
        const aniso = gl?.capabilities?.getMaxAnisotropy?.() ?? 4;
        if (!isBod) gltf.scene.traverse((o) => {
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
            const apply = (m: MeshStandardMaterial) => {
                m.side = DoubleSide;
                if (m.map) { m.map.colorSpace = SRGBColorSpace; m.map.anisotropy = aniso; }
                if (m.emissiveMap) { m.emissiveMap.colorSpace = SRGBColorSpace; m.emissiveMap.anisotropy = aniso; }
                if (m.normalMap) { m.normalMap.colorSpace = LinearSRGBColorSpace; m.normalMap.anisotropy = aniso; }
                if (m.roughnessMap) { m.roughnessMap.colorSpace = LinearSRGBColorSpace; m.roughnessMap.anisotropy = aniso; }
                if (m.metalnessMap) { m.metalnessMap.colorSpace = LinearSRGBColorSpace; m.metalnessMap.anisotropy = aniso; }
                m.needsUpdate = true;
            };
            const g = mesh.geometry as unknown as { attributes?: Record<string, unknown>; computeVertexNormals?: () => void };
            if (g && g.attributes && !('normal' in g.attributes) && typeof g.computeVertexNormals === 'function') {
                g.computeVertexNormals();
            }
            if (Array.isArray(mat)) mat.forEach(apply); else if (mat) apply(mat as MeshStandardMaterial);
        });
        if (!isBod && stationRef.current) {
            (async () => {
                const RAPIER = await ensureRapier();
                const world = await getWorld();
                gltf.scene.updateWorldMatrix(true, true);
                gltf.scene.traverse((o) => {
                    const mesh = o as Mesh;
                    const g = mesh.geometry as BufferGeometry;
                    if (!g || !g.attributes?.position) return;
                    const pos = g.getAttribute('position');
                    const count = pos.count;
                    const verts = new Float32Array(count * 3);
                    const v = new Vector3();
                    for (let i = 0; i < count; i++) {
                        const x = pos.getX(i);
                        const y = pos.getY(i);
                        const z = pos.getZ(i);
                        v.set(x, y, z).applyMatrix4(mesh.matrixWorld);
                        verts[i * 3 + 0] = v.x;
                        verts[i * 3 + 1] = v.y;
                        verts[i * 3 + 2] = v.z;
                    }
                    let idx: Uint32Array | null = null;
                    if (g.index) {
                        idx = Uint32Array.from((g.index.array as unknown as number[]));
                    } else {
                        const triCount = Math.floor(verts.length / 3);
                        idx = new Uint32Array(triCount);
                        for (let i = 0; i < triCount; i++) idx[i] = i;
                    }
                    const bodyDesc = RAPIER.RigidBodyDesc.fixed();
                    const body = world.createRigidBody(bodyDesc);
                    const collDesc = RAPIER.ColliderDesc.trimesh(verts, idx!);
                    world.createCollider(collDesc, body);
                });
            })();
        }
    }, [gltf, gl, isBod, isObj, modelPath]);

    return (
        <group ref={stationRef} position={position} scale={[scale, scale, scale]} name="Station">
            {!isBod && !isObj && <primitive object={gltf.scene} />}
            {showLights && <pointLight position={[0, 10, 0]} intensity={2} color="cyan" distance={50} />}
            {showLights && <pointLight position={[0, -10, 0]} intensity={2} color="cyan" distance={50} />}
        </group>
    );
};

useGLTF.preload(DEFAULT_MODEL_PATH);
