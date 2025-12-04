import fs from 'node:fs';
import path from 'node:path';
import {
  Scene,
  Group,
  Mesh,
  BoxGeometry,
  SphereGeometry,
  CylinderGeometry,
  TorusGeometry,
  DodecahedronGeometry,
  PlaneGeometry,
  MeshStandardMaterial,
  Color,
  Box3,
  Vector3,
  DataTexture,
  SRGBColorSpace,
  NoColorSpace,
  DoubleSide,
  BufferGeometry,
  Float32BufferAttribute
} from 'three';
import { GLTFExporter, RoundedBoxGeometry, OBJLoader } from 'three-stdlib';
import sharp from 'sharp';
import { Brush, Evaluator, SUBTRACTION } from 'three-bvh-csg';

const sessions = new Map();

async function createMaterial(spec = {}) {
  const color = spec.color ? new Color(spec.color) : new Color('#777777');
  const material = new MeshStandardMaterial({
    color,
    roughness: spec.roughness ?? 0.5,
    metalness: spec.metalness ?? 0.2,
    emissive: spec.emissive ? new Color(spec.emissive) : new Color('#000000'),
    emissiveIntensity: spec.emissiveIntensity ?? 0,
    transparent: spec.transparent ?? false,
    opacity: spec.opacity ?? 1
  });
  if (spec.texturePath) {
    const base = path.join(spec.texturePath, 'baseColor.png');
    const normal = path.join(spec.texturePath, 'normal.png');
    const rough = path.join(spec.texturePath, 'roughness.png');
    const metal = path.join(spec.texturePath, 'metallic.png');
    const emiss = path.join(spec.texturePath, 'emissive.png');
    try {
      if (fs.existsSync(base)) {
        const t = await loadDataTexture(base, SRGBColorSpace);
        material.map = t;
      }
    } catch { }
    try {
      if (fs.existsSync(normal)) {
        const t = await loadDataTexture(normal, NoColorSpace);
        material.normalMap = t;
      }
    } catch { }
    try {
      if (fs.existsSync(rough)) {
        await loadDataTexture(rough, NoColorSpace);
      }
    } catch { }
    try {
      if (fs.existsSync(metal)) {
        await loadDataTexture(metal, NoColorSpace);
      }
    } catch { }
    try {
      if (fs.existsSync(emiss)) {
        const t = await loadDataTexture(emiss, SRGBColorSpace);
        material.emissiveMap = t;
      }
    } catch { }
  }
  return material;
}

function createGeometry(kind, size = []) {
  if (kind === 'box' || kind === 'cube') {
    const w = size[0] ?? 1; const h = size[1] ?? 1; const d = size[2] ?? 1;
    const segments = size[4] ?? 2; const radius = size[3] ?? 0.1;
    return new RoundedBoxGeometry(w, h, d, segments, radius);
  }
  if (kind === 'sphere') return new SphereGeometry(size[0] ?? 1, size[1] ?? 64, size[2] ?? 64);
  if (kind === 'cylinder') return new CylinderGeometry(size[0] ?? 1, size[1] ?? 1, size[2] ?? 1, size[3] ?? 32);
  if (kind === 'torus') return new TorusGeometry(size[0] ?? 1, size[1] ?? 0.25, size[2] ?? 16, size[3] ?? 100);
  if (kind === 'dodecahedron') return new DodecahedronGeometry(size[0] ?? 1, size[1] ?? 0);
  if (kind === 'plane') return new PlaneGeometry(size[0] ?? 1, size[1] ?? 1, size[2] ?? 1, size[3] ?? 1);
  return new BoxGeometry(1, 1, 1);
}

function setTransform(obj, op) {
  if (op.position) obj.position.set(op.position[0] ?? 0, op.position[1] ?? 0, op.position[2] ?? 0);
  if (op.rotation) obj.rotation.set(op.rotation[0] ?? 0, op.rotation[1] ?? 0, op.rotation[2] ?? 0);
  if (op.scale) obj.scale.set(op.scale[0] ?? 1, op.scale[1] ?? 1, op.scale[2] ?? 1);
}

export function startModelingSession(spec = {}) {
  const id = Math.random().toString(36).slice(2);
  const scene = new Scene();
  const meta = {
    name: spec.name ?? `model_${id}`,
    createdAt: Date.now(),
  };
  sessions.set(id, { scene, meta });
  return id;
}

export async function applyOperation(sessionId, operation) {
  const session = sessions.get(sessionId);
  if (!session) return { ok: false, error: 'invalid_session' };
  const { scene } = session;

  if (operation.type === 'add_primitive') {
    const geometry = createGeometry(operation.kind, operation.size);
    const material = await createMaterial(operation.material);
    const mesh = new Mesh(geometry, material);
    if (operation.name) mesh.name = operation.name;
    setTransform(mesh, operation);
    const parent = operation.parent ? scene.getObjectByName(operation.parent) : null;
    if (parent) parent.add(mesh); else scene.add(mesh);
    return { ok: true };
  }

  if (operation.type === 'group') {
    const group = new Group();
    if (operation.name) group.name = operation.name;
    setTransform(group, operation);
    const parent = operation.parent ? scene.getObjectByName(operation.parent) : null;
    if (parent) parent.add(group); else scene.add(group);
    return { ok: true };
  }

  if (operation.type === 'transform') {
    const target = operation.object ? scene.getObjectByName(operation.object) : null;
    if (!target) return { ok: false, error: 'object_not_found' };
    setTransform(target, operation);
    return { ok: true };
  }

  if (operation.type === 'assign_material') {
    const target = operation.object ? scene.getObjectByName(operation.object) : null;
    if (!target || !(target instanceof Mesh)) return { ok: false, error: 'object_not_found' };
    const material = await createMaterial(operation.material);
    target.material = material;
    return { ok: true };
  }

  if (operation.type === 'snap') {
    const source = operation.source ? scene.getObjectByName(operation.source) : null;
    const target = operation.target ? scene.getObjectByName(operation.target) : null;
    if (!source || !target) return { ok: false, error: 'object_not_found' };
    scene.updateMatrixWorld(true);
    source.updateMatrixWorld();
    target.updateMatrixWorld();
    const sourceBox = new Box3().setFromObject(source);
    const targetBox = new Box3().setFromObject(target);
    const sourceSize = sourceBox.getSize(new Vector3());
    const targetSize = targetBox.getSize(new Vector3());
    const targetCenter = targetBox.getCenter(new Vector3());
    const faceInput = operation.face ?? 'top';
    const faces = Array.isArray(faceInput) ? faceInput.map((f) => String(f).toLowerCase()) : String(faceInput).toLowerCase().split(/[ ,|+]+/).filter(Boolean);
    const margin = operation.margin || 0;
    const posWorld = targetCenter.clone();
    for (const f of faces) {
      if (f === 'top') posWorld.y += (targetSize.y / 2) + (sourceSize.y / 2) + margin;
      else if (f === 'bottom') posWorld.y -= (targetSize.y / 2) + (sourceSize.y / 2) + margin;
      else if (f === 'right') posWorld.x += (targetSize.x / 2) + (sourceSize.x / 2) + margin;
      else if (f === 'left') posWorld.x -= (targetSize.x / 2) + (sourceSize.x / 2) + margin;
      else if (f === 'front') posWorld.z += (targetSize.z / 2) + (sourceSize.z / 2) + margin;
      else if (f === 'back') posWorld.z -= (targetSize.z / 2) + (sourceSize.z / 2) + margin;
    }
    const parent = source.parent;
    const localPos = parent ? parent.worldToLocal(posWorld.clone()) : posWorld;
    source.position.copy(localPos);
    return { ok: true };
  }

  if (operation.type === 'subtract') {
    const target = operation.target ? scene.getObjectByName(operation.target) : null;
    const brush = operation.brush ? scene.getObjectByName(operation.brush) : null;
    if (!target || !brush || !(target instanceof Mesh) || !(brush instanceof Mesh)) return { ok: false, error: 'object_not_found' };
    target.updateMatrixWorld();
    brush.updateMatrixWorld();
    const a = new Brush(target.geometry.clone(), target.material);
    a.matrix.copy(target.matrixWorld);
    a.matrixWorld.copy(target.matrixWorld);
    const b = new Brush(brush.geometry.clone(), brush.material);
    b.matrix.copy(brush.matrixWorld);
    b.matrixWorld.copy(brush.matrixWorld);
    const evaluator = new Evaluator();
    const result = evaluator.evaluate(a, b, SUBTRACTION);
    const newMesh = new Mesh(result.geometry, target.material);
    newMesh.name = target.name;
    const parent = target.parent;
    if (parent) parent.add(newMesh); else scene.add(newMesh);
    target.parent.remove(target);
    brush.parent.remove(brush);
    return { ok: true };
  }

  if (operation.type === 'greeble_surface') {
    const target = operation.object ? scene.getObjectByName(operation.object) : null;
    if (!target || !(target instanceof Mesh)) return { ok: false, error: 'object_not_found' };
    const bbox = new Box3().setFromObject(target);
    const s = bbox.getSize(new Vector3());
    const area = 2 * (s.x * s.y + s.y * s.z + s.x * s.z);
    const density = operation.density ?? 0.02;
    const count = Math.max(1, Math.floor(area * density));
    const minSize = operation.minSize ?? 0.1;
    const maxSize = operation.maxSize ?? 0.4;
    const mat = await createMaterial(operation.material ?? { color: '#707070', roughness: 0.6, metalness: 0.2 });
    for (let i = 0; i < count; i++) {
      const face = Math.floor(Math.random() * 6);
      const w = s.x; const h = s.y; const d = s.z;
      let px = 0, py = 0, pz = 0;
      if (face === 0) { px = -w / 2; py = (Math.random() - 0.5) * h; pz = (Math.random() - 0.5) * d; }
      else if (face === 1) { px = w / 2; py = (Math.random() - 0.5) * h; pz = (Math.random() - 0.5) * d; }
      else if (face === 2) { py = -h / 2; px = (Math.random() - 0.5) * w; pz = (Math.random() - 0.5) * d; }
      else if (face === 3) { py = h / 2; px = (Math.random() - 0.5) * w; pz = (Math.random() - 0.5) * d; }
      else if (face === 4) { pz = -d / 2; px = (Math.random() - 0.5) * w; py = (Math.random() - 0.5) * h; }
      else { pz = d / 2; px = (Math.random() - 0.5) * w; py = (Math.random() - 0.5) * h; }
      const sz = minSize + Math.random() * (maxSize - minSize);
      const kind = Math.random() < 0.5 ? 'box' : 'cylinder';
      const geom = kind === 'box' ? new BoxGeometry(sz, sz * (0.3 + Math.random() * 0.7), sz) : new CylinderGeometry(sz * 0.25, sz * 0.25, sz * (0.5 + Math.random() * 1.5), 12);
      const m = new Mesh(geom, mat);
      m.position.set(px, py, pz);
      if (face === 0) m.rotation.y = Math.PI / 2;
      else if (face === 1) m.rotation.y = -Math.PI / 2;
      else if (face === 2) m.rotation.x = Math.PI / 2;
      else if (face === 3) m.rotation.x = -Math.PI / 2;
      else if (face === 4) m.rotation.y = 0;
      else m.rotation.y = Math.PI;
      target.add(m);
    }
    return { ok: true };
  }

  return { ok: false, error: 'unsupported_operation' };
}

export function getModelState(sessionId) {
  const session = sessions.get(sessionId);
  if (!session) return null;
  const { scene, meta } = session;
  const objects = [];
  scene.traverse((o) => {
    if (o instanceof Mesh) {
      const g = o.geometry;
      const tri = g.index ? g.index.count / 3 : (g.attributes.position?.count ?? 0) / 3;
      const bbox = new Box3().setFromObject(o);
      const s = bbox.getSize(new Vector3());
      objects.push({
        name: o.name || '',
        type: 'mesh',
        triangles: Math.floor(tri),
        size: [s.x, s.y, s.z]
      });
    } else if (o instanceof Group) {
      const bbox = new Box3().setFromObject(o);
      const s = bbox.getSize(new Vector3());
      objects.push({
        name: o.name || '',
        type: 'group',
        triangles: 0,
        size: [s.x, s.y, s.z]
      });
    }
  });
  const totalTriangles = objects.reduce((a, b) => a + b.triangles, 0);
  const bbox = new Box3().setFromObject(scene);
  const size = bbox.getSize(new Vector3());
  return { meta, totalTriangles, size: [size.x, size.y, size.z], objects };
}

export function checkConstraints(sessionId, constraints = {}) {
  const state = getModelState(sessionId);
  if (!state) return { ok: false, error: 'invalid_session' };
  const issues = [];
  if (constraints.maxFaces != null) {
    if (state.totalTriangles > constraints.maxFaces) issues.push('max_faces_exceeded');
  }
  if (constraints.heightRange && constraints.heightRange.length === 2) {
    const h = state.size[1];
    const [min, max] = constraints.heightRange;
    if (h < min || h > max) issues.push('height_out_of_range');
  }
  return { ok: issues.length === 0, issues };
}

export async function exportModel(sessionId, format = 'glb', outDir = 'public/models') {
  const session = sessions.get(sessionId);
  if (!session) return { ok: false, error: 'invalid_session' };
  const { scene, meta } = session;
  const sceneForExport = scene.clone(true);
  sceneForExport.traverse((o) => {
    if (o instanceof Mesh) {
      const m = o.material;
      if (m && m.isMeshStandardMaterial) {
        m.map = null;
        m.normalMap = null;
        m.roughnessMap = null;
        m.metalnessMap = null;
        m.emissiveMap = null;
      }
    }
  });
  const exporter = new GLTFExporter();
  await fs.promises.mkdir(outDir, { recursive: true });
  const name = meta.name ?? 'model';
  const file = path.join(outDir, `${name}.${format}`);
  return new Promise((resolve) => {
    exporter.parse(sceneForExport, (result) => {
      if (format === 'glb') {
        let buffer = null;
        if (result instanceof ArrayBuffer) {
          buffer = Buffer.from(result);
        } else if (ArrayBuffer.isView(result)) {
          buffer = Buffer.from(result.buffer);
        } else if (typeof result === 'string') {
          buffer = Buffer.from(result);
        } else if (result && result.buffer) {
          buffer = Buffer.from(result.buffer);
        }
        if (!buffer) {
          resolve({ ok: false, error: 'invalid_export_buffer' });
          return;
        }
        fs.promises.writeFile(file, buffer).then(() => resolve({ ok: true, file })).catch((e) => resolve({ ok: false, error: String(e) }));
      } else {
        const json = typeof result === 'string' ? result : JSON.stringify(result);
        fs.promises.writeFile(path.join(outDir, `${name}.gltf`), json).then(() => resolve({ ok: true, file: path.join(outDir, `${name}.gltf`) })).catch((e) => resolve({ ok: false, error: String(e) }));
      }
    }, (e) => {
      resolve({ ok: false, error: String(e) });
    }, { binary: format === 'glb' });
  });
}

export default {
  startModelingSession,
  applyOperation,
  getModelState,
  checkConstraints,
  exportModel
};

async function loadDataTexture(file, colorSpace) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const tex = new DataTexture(new Uint8Array(data), info.width, info.height);
  tex.colorSpace = colorSpace;
  tex.flipY = false;
  tex.needsUpdate = true;
  return tex;
}

export async function convertObjToGlb(objFile, outName = 'model', outDir = 'public/models') {
  const text = await fs.promises.readFile(objFile, 'utf8');
  const loader = new OBJLoader();
  const root = loader.parse(text);
  const scene = new Scene();
  scene.add(root);
  root.traverse((o) => {
    if (o instanceof Mesh) {
      if (!o.material || !o.material.isMeshStandardMaterial) {
        o.material = new MeshStandardMaterial({ color: new Color('#888888'), roughness: 0.7, metalness: 0.1 });
      }
      o.material.side = DoubleSide;
      const g = o.geometry;
      if (g && g.attributes && !g.attributes.normal && typeof g.computeVertexNormals === 'function') {
        g.computeVertexNormals();
      }
      if (typeof g?.computeBoundingSphere === 'function') {
        g.computeBoundingSphere();
      }
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  const exporter = new GLTFExporter();
  await fs.promises.mkdir(outDir, { recursive: true });
  const file = path.join(outDir, `${outName}.glb`);
  return new Promise((resolve) => {
    exporter.parse(scene, (result) => {
      let buffer = null;
      if (result instanceof ArrayBuffer) buffer = Buffer.from(result);
      else if (ArrayBuffer.isView(result)) buffer = Buffer.from(result.buffer);
      else if (typeof result === 'string') buffer = Buffer.from(result);
      else if (result && result.buffer) buffer = Buffer.from(result.buffer);
      if (!buffer) {
        resolve({ ok: false, error: 'invalid_export_buffer' });
        return;
      }
      fs.promises.writeFile(file, buffer).then(() => resolve({ ok: true, file })).catch((e) => resolve({ ok: false, error: String(e) }));
    }, (e) => resolve({ ok: false, error: String(e) }), { binary: true });
  });
}

if (process.argv[2] === '--convert-obj') {
  const objPath = process.argv[3];
  const name = process.argv[4] || path.parse(objPath).name;
  convertObjToGlb(objPath, name).then((r) => {
    if (!r.ok) {
      console.error(r.error);
      process.exit(1);
    } else {
      console.log(`Wrote ${r.file}`);
      process.exit(0);
    }
  });
}
if (process.argv[2] === '--convert-bod') {
  const bodPath = process.argv[3];
  const texDir = process.argv[4];
  const name = process.argv[5] || path.parse(bodPath).name;
  convertBodToGlbTextured(bodPath, texDir, name).then((r) => {
    if (!r.ok) {
      console.error(r.error);
      process.exit(1);
    } else {
      console.log(`Wrote ${r.file}`);
      process.exit(0);
    }
  });
}
function parseBOD(text) {
  const lines = text.split(/\r?\n/);
  const materials = new Map();
  let size = 1;
  for (const line of lines) {
    const m = line.match(/^\s*(?:MATERIAL|MATERIAL2|MATERIAL3):\s*(\d+)\s*;(\d+)(.*)/i);
    if (m) {
      const matId = parseInt(m[1], 10);
      const texId = parseInt(m[2], 10);
      const rest = m[3];
      const vals = rest.split(';').map(s => s.trim()).filter(s => s !== '').map(s => parseInt(s, 10));
      materials.set(matId, { texId, vals });
      continue;
    }
    // Legacy MATERIAL lines may omit texture id; capture colors for MTL
    const mLegacy = line.match(/^\s*MATERIAL:\s*(\d+)\s*;\s*([\d\-]+)?\s*;(.*)$/i);
    if (mLegacy) {
      const matId = parseInt(mLegacy[1], 10);
      const texMaybe = mLegacy[2];
      const texId = texMaybe != null && texMaybe !== '' ? parseInt(texMaybe, 10) : null;
      const rest = mLegacy[3];
      const vals = rest.split(';').map(s => s.trim()).filter(s => s !== '').map(s => parseInt(s, 10));
      let color = null;
      if (vals.length >= 6) {
        const r = vals[3] ?? vals[0] ?? 128;
        const g = vals[4] ?? vals[1] ?? 128;
        const b = vals[5] ?? vals[2] ?? 128;
        color = [r / 255, g / 255, b / 255];
      }
      materials.set(matId, { texId: isNaN(texId) ? null : texId, vals, color });
      continue;
    }
    const s = line.match(/^\s*(\d+)\s*;\s*\/\s*Automatic Object Size/i);
    if (s) size = parseInt(s[1], 10);
  }
  const scale = 1 / 500;
  const vertices = [];
  const exToIndex = new Map();
  let currentPart = 'part_0';
  const endedParts = new Set();
  let i = 0;
  while (i < lines.length) {
    const ln = lines[i++];
    const v = ln && ln.match(/^\s*(-?\d+)\s*;\s*(-?\d+)\s*;\s*(-?\d+)\s*;/);
    if (!v) continue;
    const x = parseInt(v[1], 10);
    const y = parseInt(v[2], 10);
    const z = parseInt(v[3], 10);
    if (x === -1 && y === -1 && z === -1) break;
    const idxInfo = ln.match(/\/\s*(\d+)\s*\(\s*ex\s*(\d+)\s*\)/i);
    if (idxInfo) {
      const seq = parseInt(idxInfo[1], 10);
      const ex = parseInt(idxInfo[2], 10);
      exToIndex.set(ex, seq);
    }
    vertices.push([x * scale, y * scale, z * scale]);
  }
  const tris = [];
  while (i < lines.length) {
    const ln = lines[i++];
    if (!ln) continue;
    const ph = ln.match(/\/\-\-\-\-\-\s*Part\s*(\d+):.*?"([^"]+)"/);
    if (ph) { currentPart = ph[2] || `part_${ph[1]}`; continue; }
    if (/^\s*-99\s*;/.test(ln)) {
      const parts = ln.split(';');
      const flag = parts[1] ? parts[1].trim() : '';
      // Zero flag marks end of body; stop to avoid lower LODs using wrong indices
      if (/^0+$/.test(flag)) break;
      endedParts.add(currentPart);
      continue;
    }
    // Face format: MatID; V1; V2; V3; Flags; Smooth; [UVs...]
    const cleanLn = ln.split('/')[0].trim();
    if (!cleanLn) continue;

    const parts = cleanLn.split(';').map(s => s.trim()).filter(s => s.length > 0);
    if (parts.length < 6) continue;

    if (isNaN(parseInt(parts[0], 10))) continue;

    if (endedParts.has(currentPart)) continue;

    const mat = parseInt(parts[0], 10);
    const v1 = parseInt(parts[1], 10);
    const v2 = parseInt(parts[2], 10);
    const v3 = parseInt(parts[3], 10);

    let uvs = [0, 0, 0, 0, 0, 0];
    if (parts.length >= 12) {
      uvs = [
        parseFloat(parts[6]), parseFloat(parts[7]),
        parseFloat(parts[8]), parseFloat(parts[9]),
        parseFloat(parts[10]), parseFloat(parts[11])
      ];
    }
    tris.push({ mat, v1, v2, v3, uvs, part: currentPart });
  }
  return { materials, vertices, tris, exToIndex };
}
async function loadTextureById(texDir, id) {
  const files = await fs.promises.readdir(texDir);
  const s = String(id);
  const name = files.find((f) => path.parse(f).name === s);
  if (!name) return null;
  const file = path.join(texDir, name);
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const tex = new DataTexture(new Uint8Array(data), info.width, info.height);
  tex.colorSpace = SRGBColorSpace;
  tex.flipY = false;
  tex.needsUpdate = true;
  return tex;
}

function subdivideMesh(vertices, uvs, tris, level) {
  if (level <= 0) return { vertices, uvs, tris };

  let currentVertices = [...vertices];
  let currentTris = [...tris];

  for (let l = 0; l < level; l++) {
    const newTris = [];
    const midPointCache = new Map();

    function getMidPoint(v1Idx, v2Idx, uv1, uv2) {
      const key = v1Idx < v2Idx ? `${v1Idx}_${v2Idx}` : `${v2Idx}_${v1Idx}`;
      if (midPointCache.has(key)) return midPointCache.get(key);

      const v1 = currentVertices[v1Idx];
      const v2 = currentVertices[v2Idx];
      const midV = [
        (v1[0] + v2[0]) * 0.5,
        (v1[1] + v2[1]) * 0.5,
        (v1[2] + v2[2]) * 0.5
      ];
      const newVIdx = currentVertices.length;
      currentVertices.push(midV);
      midPointCache.set(key, newVIdx);
      return newVIdx;
    }

    for (const t of currentTris) {
      const uvA = [t.uvs[0], t.uvs[1]];
      const uvB = [t.uvs[2], t.uvs[3]];
      const uvC = [t.uvs[4], t.uvs[5]];
      const a = t.v1;
      const b = t.v2;
      const c = t.v3;
      const ab = getMidPoint(a, b);
      const bc = getMidPoint(b, c);
      const ca = getMidPoint(c, a);
      const uvAB = [(uvA[0] + uvB[0]) * 0.5, (uvA[1] + uvB[1]) * 0.5];
      const uvBC = [(uvB[0] + uvC[0]) * 0.5, (uvB[1] + uvC[1]) * 0.5];
      const uvCA = [(uvC[0] + uvA[0]) * 0.5, (uvC[1] + uvA[1]) * 0.5];
      newTris.push({
        mat: t.mat,
        v1: a, v2: ab, v3: ca,
        uvs: [...uvA, ...uvAB, ...uvCA],
        part: t.part
      });
      newTris.push({
        mat: t.mat,
        v1: ab, v2: b, v3: bc,
        uvs: [...uvAB, ...uvB, ...uvBC],
        part: t.part
      });
      newTris.push({
        mat: t.mat,
        v1: bc, v2: c, v3: ca,
        uvs: [...uvBC, ...uvC, ...uvCA],
        part: t.part
      });
      newTris.push({
        mat: t.mat,
        v1: ab, v2: bc, v3: ca,
        uvs: [...uvAB, ...uvBC, ...uvCA],
        part: t.part
      });
    }

    currentTris = newTris;
  }

  return { vertices: currentVertices, uvs: [], tris: currentTris };
}

export async function convertBodToObj(bodFile, texDir, outName = 'model', outDir = 'public/models', useEx = false, areaLimit = null, includePattern = null, flipWinding = true, tessellationLevel = 0) {
  const text = await fs.promises.readFile(bodFile, 'utf8');
  const bod = parseBOD(text);
  await fs.promises.mkdir(outDir, { recursive: true });
  const texFiles = new Map();
  if (texDir && fs.existsSync(texDir)) {
    const files = await fs.promises.readdir(texDir);
    for (const [matId, matData] of bod.materials.entries()) {
      const s = String(matData.texId);
      const name = files.find((f) => path.parse(f).name === s) || null;
      texFiles.set(matId, name);
    }
  }
  let mtl = '';
  const relTexPath = path.relative(outDir, texDir).replace(/\\/g, '/');
  for (const [matId, matData] of bod.materials.entries()) {
    mtl += `newmtl mat_${matId}\n`;
    const v = matData.vals;
    const hasTexture = texFiles.has(matId) && texFiles.get(matId);
    if (v && v.length >= 9) {
      mtl += `Ka ${v[0] / 255} ${v[1] / 255} ${v[2] / 255}\n`;
      // When a texture is present, use white Kd so texture shows at full brightness
      // (Three.js multiplies Kd with texture, dark Kd = dark/invisible texture)
      if (hasTexture) {
        mtl += `Kd 1 1 1\n`;
      } else {
        mtl += `Kd ${v[3] / 255} ${v[4] / 255} ${v[5] / 255}\n`;
      }
      mtl += `Ks ${v[6] / 255} ${v[7] / 255} ${v[8] / 255}\n`;

      // Extended properties for MATERIAL3
      if (v.length >= 12) {
        mtl += `Ke ${v[9] / 255} ${v[10] / 255} ${v[11] / 255}\n`;
      }
      if (v.length >= 13) {
        mtl += `Ns ${v[12]}\n`;
      }
      if (v.length >= 17) {
        // Opacity is at index 16 (0-100)
        mtl += `d ${v[16] / 100}\n`;
      }
    } else if (matData.color) {
      if (hasTexture) {
        mtl += `Kd 1 1 1\n`;
      } else {
        mtl += `Kd ${matData.color[0]} ${matData.color[1]} ${matData.color[2]}\n`;
      }
      mtl += `Ka 0.02 0.02 0.02\nKs 0.02 0.02 0.02\n`;
    } else {
      mtl += `Kd 1 1 1\n`;
    }
    const f = texFiles.get(matId);
    if (f) {
      const mapPath = relTexPath ? `${relTexPath}/${f}` : f;
      mtl += `map_Kd ${mapPath}\n`;
    }
    mtl += `\n`;
  }
  const mtlPath = path.join(outDir, `${outName}.mtl`);
  await fs.promises.writeFile(mtlPath, mtl, 'utf8');
  let objHeader = `mtllib ${outName}.mtl\n`;

  let finalVertices = bod.vertices;
  let finalTris = bod.tris;

  if (tessellationLevel > 0) {
    // Resolve 'useEx' indices before subdivision
    const resolvedTris = bod.tris.map(t => ({
      ...t,
      v1: useEx && bod.exToIndex.has(t.v1) ? bod.exToIndex.get(t.v1) : t.v1,
      v2: useEx && bod.exToIndex.has(t.v2) ? bod.exToIndex.get(t.v2) : t.v2,
      v3: useEx && bod.exToIndex.has(t.v3) ? bod.exToIndex.get(t.v3) : t.v3
    }));

    const result = subdivideMesh(bod.vertices, [], resolvedTris, tessellationLevel);
    finalVertices = result.vertices;
    finalTris = result.tris;
    // Disable useEx for the final loop; already resolved
    useEx = false;
  }

  let objVerts = '';
  for (const v of finalVertices) {
    objVerts += `v ${v[0]} ${v[1]} ${-v[2]}\n`;
  }
  const vt = [];
  const groups = new Map();
  let areas = null;


  if (areaLimit === 'auto') {
    areas = [];
    for (const t of finalTris) {
      const ia0 = useEx && bod.exToIndex.has(t.v1) ? bod.exToIndex.get(t.v1) : t.v1;
      const ib0 = useEx && bod.exToIndex.has(t.v3) ? bod.exToIndex.get(t.v3) : t.v3;
      const ic0 = useEx && bod.exToIndex.has(t.v2) ? bod.exToIndex.get(t.v2) : t.v2;
      const A0 = finalVertices[ia0];
      const B0 = finalVertices[ib0];
      const C0 = finalVertices[ic0];
      if (!A0 || !B0 || !C0) { areas.push(0); continue; }
      const ux0 = B0[0] - A0[0];
      const uy0 = B0[1] - A0[1];
      const uz0 = B0[2] - A0[2];
      const vx0 = C0[0] - A0[0];
      const vy0 = C0[1] - A0[1];
      const vz0 = C0[2] - A0[2];
      const cx0 = uy0 * vz0 - uz0 * vy0;
      const cy0 = uz0 * vx0 - ux0 * vz0;
      const cz0 = ux0 * vy0 - uy0 * vx0;
      areas.push(0.5 * Math.sqrt(cx0 * cx0 + cy0 * cy0 + cz0 * cz0));
    }
    const sorted = areas.slice().sort((a, b) => a - b);
    const mid = sorted[Math.floor(sorted.length * 0.5)] || 0;
    areaLimit = mid * 8;
  }

  for (const t of finalTris) {
    if (includePattern && !new RegExp(includePattern, 'i').test(t.part)) continue;
    const base = vt.length / 2;
    vt.push(t.uvs[0], t.uvs[1], t.uvs[2], t.uvs[3], t.uvs[4], t.uvs[5]);

    const ia = useEx && bod.exToIndex.has(t.v1) ? bod.exToIndex.get(t.v1) : t.v1;
    const ib = useEx && bod.exToIndex.has(t.v3) ? bod.exToIndex.get(t.v3) : t.v3;
    const ic = useEx && bod.exToIndex.has(t.v2) ? bod.exToIndex.get(t.v2) : t.v2;

    if (areaLimit != null) {
      const A = finalVertices[ia];
      const B = finalVertices[ib];
      const C = finalVertices[ic];
      if (A && B && C) {
        const ux = B[0] - A[0];
        const uy = B[1] - A[1];
        const uz = B[2] - A[2];
        const vx = C[0] - A[0];
        const vy = C[1] - A[1];
        const vz = C[2] - A[2];
        const cx = uy * vz - uz * vy;
        const cy = uz * vx - ux * vz;
        const cz = ux * vy - uy * vx;
        const area = 0.5 * Math.sqrt(cx * cx + cy * cy + cz * cz);
        if (area > areaLimit) continue;
      }
    }
    const flip = flipWinding;
    const a = `${ia + 1}/${base + 1}`;
    const b = flip ? `${ib + 1}/${base + 3}` : `${ic + 1}/${base + 2}`;
    const c = flip ? `${ic + 1}/${base + 2}` : `${ib + 1}/${base + 3}`;
    if (!groups.has(t.part)) groups.set(t.part, new Map());
    const byMat = groups.get(t.part);
    if (!byMat.has(t.mat)) byMat.set(t.mat, []);
    byMat.get(t.mat).push(`f ${a} ${b} ${c}`);
  }
  let objVt = '';
  for (let i = 0; i < vt.length; i += 2) {
    objVt += `vt ${vt[i]} ${vt[i + 1]}\n`;
  }
  let objFaces = '';
  for (const [partName, byMat] of groups.entries()) {
    objFaces += `g ${partName}\n`;
    for (const [matId, lines] of byMat.entries()) {
      if (lines.length === 0) continue;
      objFaces += `usemtl mat_${matId}\n`;
      objFaces += lines.join('\n');
      objFaces += `\n`;
    }
  }
  const objPath = path.join(outDir, `${outName}.obj`);
  const objText = objHeader + objVerts + objVt + objFaces;
  await fs.promises.writeFile(objPath, objText, 'utf8');
  return { ok: true, file: objPath, mtl: mtlPath };
}

if (process.argv[2] === '--bod-to-obj') {
  const bodPath = process.argv[3];
  const texDir = process.argv[4];
  const name = process.argv[5] || path.parse(bodPath).name;
  let areaArg = process.argv[6];
  if (areaArg === 'null') areaArg = null;
  const area = areaArg ? parseFloat(areaArg) : null;
  const part = process.argv[7] === 'null' ? null : (process.argv[7] || null);
  const flip = process.argv[8] ? process.argv[8] !== 'noflip' : true;
  const tess = process.argv[9] ? parseInt(process.argv[9], 10) : 0;
  console.log(`Converting ${name} with areaLimit=${area}, part=${part}, flip=${flip}, tess=${tess}`);
  convertBodToObj(bodPath, texDir, name, 'public/models', false, area, part, flip, tess).then((r) => {
    if (!r.ok) {
      console.error(r.error);
      process.exit(1);
    } else {
      console.log(`Wrote ${r.file}`);
      if (r.mtl) console.log(`Wrote ${r.mtl}`);
      process.exit(0);
    }
  });
}
if (process.argv[2] === '--bod-to-obj-ex') {
  const bodPath = process.argv[3];
  const texDir = process.argv[4];
  const name = process.argv[5] || path.parse(bodPath).name;
  const area = process.argv[6] ? parseFloat(process.argv[6]) : null;
  const part = process.argv[7] || null;
  const flip = process.argv[8] ? process.argv[8] !== 'noflip' : true;
  const tess = process.argv[9] ? parseInt(process.argv[9], 10) : 0;
  convertBodToObj(bodPath, texDir, name, 'public/models', true, area, part, flip, tess).then((r) => {
    if (!r.ok) {
      console.error(r.error);
      process.exit(1);
    } else {
      console.log(`Wrote ${r.file}`);
      if (r.mtl) console.log(`Wrote ${r.mtl}`);
      process.exit(0);
    }
  });
}
