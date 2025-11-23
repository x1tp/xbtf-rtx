import type { FC, MutableRefObject } from 'react';
import { useEffect, useRef } from 'react';
import { Matrix4, WebGLRenderer, SRGBColorSpace, ACESFilmicToneMapping, Texture, Vector3, Color, MeshStandardMaterial, InstancedMesh, BufferGeometry, Float32BufferAttribute, Matrix3 } from 'three';
import type { Light } from 'three';
import type { PerspectiveCamera, Scene } from 'three';
import { WebGLPathTracer, BlurredEnvMapGenerator, GradientEquirectTexture } from 'three-gpu-pathtracer';
import { Mesh } from 'three';
import type { Material } from 'three';

type Status = 'ready' | 'unsupported' | 'error';

interface PathTracerOverlayProps {
    enabled: boolean;
    sceneRef: MutableRefObject<Scene | null>;
    cameraRef: MutableRefObject<PerspectiveCamera | null>;
    depsKey?: number;
    onStatus?: (status: Status, message?: string) => void;
}

// Creates its own renderer + path tracer on a separate canvas, using the live R3F scene/camera.
export const PathTracerOverlay: FC<PathTracerOverlayProps> = ({ enabled, sceneRef, cameraRef, depsKey, onStatus }) => {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const rendererRef = useRef<WebGLRenderer | null>(null);
    const tracerRef = useRef<WebGLPathTracer | null>(null);
    const rafRef = useRef<number>(0);
    const haloRef = useRef<HTMLDivElement | null>(null);
    const bloomRef = useRef<HTMLDivElement | null>(null);
    const debugRef = useRef<HTMLDivElement | null>(null);
    const framesRef = useRef<number>(0);
    const showDebug = useRef<boolean>(typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('ptdebug'));

    useEffect(() => {
        const disposePathTracer = async (
            payload: { tracer?: WebGLPathTracer | null; renderer?: WebGLRenderer | null } = {},
        ) => {
            const tracer = payload.tracer ?? tracerRef.current;
            const renderer = payload.renderer ?? rendererRef.current;

            if (tracerRef.current === tracer) {
                tracerRef.current = null;
            }
            if (rendererRef.current === renderer) {
                rendererRef.current = null;
            }

            if (!tracer && !renderer) return;

            const compilePromises: Promise<unknown>[] = [];
            const addCompilePromise = (target: unknown) => {
                const t = target as Record<string, unknown> | null | undefined;
                const promise = t && (t['_compilePromise'] as Promise<unknown> | undefined);
                if (promise) compilePromises.push(promise);
            };

            addCompilePromise(tracer as unknown);
            const internalPath = (tracer as unknown as Record<string, unknown>)['_pathTracer'] as unknown;
            const internalLow = (tracer as unknown as Record<string, unknown>)['_lowResPathTracer'] as unknown;
            addCompilePromise(internalPath);
            addCompilePromise(internalLow);

            if (compilePromises.length) {
                await Promise.allSettled(compilePromises);
            }

            // Dispose quietly; some internal targets can already be released depending on timing.
            try {
                tracer?.dispose?.();
            } catch {
                /* noop */
            }

            try {
                renderer?.dispose?.();
            } catch {
                /* noop */
            }
        };

        if (!enabled) {
            void disposePathTracer();
            return;
        }

        let scene = sceneRef.current?.clone();
        const cloneScene = () => {
            const cloned = sceneRef.current?.clone();
            if (!cloned) return null;
            // apply environment/background from current scene
            cloned.environment = gradientEnv;
            cloned.background = sceneRef.current?.background ?? gradientEnv;
            cloned.fog = sceneRef.current?.fog ?? null;
            // deep material conversion and instanced proxies as in initial setup
            const toAdd: { parent: Mesh['parent'] | null; mesh: Mesh }[] = [];
            cloned.traverse((object) => {
                const spriteLike = (object as unknown as { isSprite?: boolean }).isSprite;
                const instancedLike = (object as unknown as { isInstancedMesh?: boolean }).isInstancedMesh;
                const pointsLike = (object as unknown as { isPoints?: boolean }).isPoints;
                const lineLike = (object as unknown as { isLine?: boolean }).isLine;
                const name = (object as unknown as { name?: string }).name || '';
                if (name === 'AsteroidField') { (object as unknown as { visible?: boolean }).visible = false; return; }
                if (spriteLike || pointsLike || lineLike) { (object as unknown as { visible?: boolean }).visible = false; return; }
                if (instancedLike) {
                    const inst = object as unknown as InstancedMesh;
                    const g = inst.geometry as BufferGeometry;
                    const pos = g.getAttribute('position');
                    const nor = g.getAttribute('normal');
                    const uv = g.getAttribute('uv');
                    const count = Math.min(inst.count, 120);
                    const vertCount = pos ? pos.count : 0;
                    const positions = new Float32Array(vertCount * 3 * count);
                    const normals = nor ? new Float32Array(vertCount * 3 * count) : null;
                    const uvs = uv ? new Float32Array(vertCount * 2 * count) : null;
                    const m4 = new Matrix4();
                    const nm = new Matrix3();
                    const v = new Vector3();
                    const n = new Vector3();
                    for (let i = 0; i < count; i++) {
                        inst.getMatrixAt(i, m4);
                        nm.getNormalMatrix(m4);
                        for (let j = 0; j < vertCount; j++) {
                            const px = pos.getX(j);
                            const py = pos.getY(j);
                            const pz = pos.getZ(j);
                            v.set(px, py, pz).applyMatrix4(m4);
                            const oi = i * vertCount * 3 + j * 3;
                            positions[oi + 0] = v.x;
                            positions[oi + 1] = v.y;
                            positions[oi + 2] = v.z;
                            if (normals && nor) {
                                n.set(nor.getX(j), nor.getY(j), nor.getZ(j)).applyMatrix3(nm).normalize();
                                normals[oi + 0] = n.x;
                                normals[oi + 1] = n.y;
                                normals[oi + 2] = n.z;
                            }
                            if (uvs && uv) {
                                const ui = i * vertCount * 2 + j * 2;
                                uvs[ui + 0] = uv.getX(j);
                                uvs[ui + 1] = uv.getY(j);
                            }
                        }
                    }
                    const mg = new BufferGeometry();
                    mg.setAttribute('position', new Float32BufferAttribute(positions, 3));
                    if (normals) mg.setAttribute('normal', new Float32BufferAttribute(normals, 3));
                    if (uvs) mg.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
                    mg.computeBoundingSphere();
                    const mat = new MeshStandardMaterial({ color: new Color('#888888'), roughness: 0.85, metalness: 0.0 });
                    const m = new Mesh(mg, mat);
                    m.name = ((object as unknown as { name?: string }).name ? String((object as unknown as { name?: string }).name) + '_Proxy' : 'InstancedProxy');
                    (object as unknown as { visible?: boolean }).visible = false;
                    toAdd.push({ parent: (object as unknown as { parent?: Mesh['parent'] }).parent ?? null, mesh: m });
                    return;
                }
                const mm = object as Mesh;
                if ((mm as Mesh).isMesh) {
                    const convert = (mat: Material): Material => {
                        const info = mat as unknown as { isMeshStandardMaterial?: boolean; isMeshPhysicalMaterial?: boolean; color?: Color };
                        if (info.isMeshStandardMaterial || info.isMeshPhysicalMaterial) return mat;
                        const base = info.color instanceof Color ? info.color : new Color(0xffffff);
                        return new MeshStandardMaterial({ color: base, roughness: 0.9, metalness: 0.02 });
                    };
                    if (Array.isArray(mm.material)) {
                        mm.material = mm.material.map((mat) => (mat ? convert(mat as Material) : new MeshStandardMaterial({ color: new Color(0xffffff), roughness: 0.9, metalness: 0.02 })));
                    } else if (mm.material) {
                        mm.material = convert(mm.material as Material);
                    } else {
                        mm.material = new MeshStandardMaterial({ color: new Color(0xffffff), roughness: 0.9, metalness: 0.02 });
                    }
                }
            });
            for (const r of toAdd) { r.parent?.add(r.mesh); }
            return cloned;
        };
        const gradientEnv = (() => {
            const tex = new GradientEquirectTexture(32);
            tex.topColor.set('#22324d');
            tex.bottomColor.set('#05080f');
            tex.exponent = 1.4;
            tex.update();
            return tex;
        })();
        const resolveEnvironmentTexture = (env: Texture | (Texture & { isRenderTargetTexture?: boolean }) | { texture?: Texture; isWebGLRenderTarget?: boolean } | null | undefined): Texture => {
            if (!env) return gradientEnv;
            const rt = env as { isWebGLRenderTarget?: boolean; texture?: Texture };
            if (rt.isWebGLRenderTarget && rt.texture) {
                return rt.texture;
            }
            return env as Texture;
        };

        if (scene && sceneRef.current) {
            // Use a stable, always-valid environment for the path tracer. The R3F env is often a PMREM render target
            // which can't be shared across renderers; the procedural gradient keeps RTX from going black.
            scene.environment = gradientEnv;
            scene.background = sceneRef.current.background ?? gradientEnv;
            scene.fog = sceneRef.current.fog;
        }
        const disposeClonedScene = () => {
            if (!scene) { gradientEnv.dispose?.(); return; }

            scene.traverse((object) => {
                const mesh = object as Mesh;
                if (mesh.geometry) {
                    mesh.geometry.dispose?.();
                }

                if (mesh.material) {
                    if (Array.isArray(mesh.material)) {
                        mesh.material.forEach((mat) => (mat as Material)?.dispose?.());
                    } else {
                        (mesh.material as Material)?.dispose?.();
                    }
                }
            });

            const envTex = scene.environment as Texture | null;
            if (envTex?.dispose) envTex.dispose();

            const bgTex = scene.background as Texture | null;
            if (bgTex?.dispose) bgTex.dispose();
            if (gradientEnv && gradientEnv !== envTex && gradientEnv !== bgTex) {
                gradientEnv.dispose?.();
            }
        };

        // Deep clone materials to prevent shared state issues (disposal/modification)
        if (scene) {
            const toAdd: { parent: Mesh['parent'] | null; mesh: Mesh }[] = [];
            scene.traverse((object) => {
                const spriteLike = (object as unknown as { isSprite?: boolean }).isSprite;
                const instancedLike = (object as unknown as { isInstancedMesh?: boolean }).isInstancedMesh;
                const pointsLike = (object as unknown as { isPoints?: boolean }).isPoints;
                const lineLike = (object as unknown as { isLine?: boolean }).isLine;
                const name = (object as unknown as { name?: string }).name || '';
                if (name === 'AsteroidField') { (object as unknown as { visible?: boolean }).visible = false; return; }
                if (spriteLike || pointsLike || lineLike) { (object as unknown as { visible?: boolean }).visible = false; return; }
                if (instancedLike) {
                    const inst = object as unknown as InstancedMesh;
                    const g = inst.geometry as BufferGeometry;
                    const pos = g.getAttribute('position');
                    const nor = g.getAttribute('normal');
                    const uv = g.getAttribute('uv');
                    const count = Math.min(inst.count, 120);
                    const vertCount = pos ? pos.count : 0;
                    const positions = new Float32Array(vertCount * 3 * count);
                    const normals = nor ? new Float32Array(vertCount * 3 * count) : null;
                    const uvs = uv ? new Float32Array(vertCount * 2 * count) : null;
                    const m4 = new Matrix4();
                    const nm = new Matrix3();
                    const v = new Vector3();
                    const n = new Vector3();
                    for (let i = 0; i < count; i++) {
                        inst.getMatrixAt(i, m4);
                        nm.getNormalMatrix(m4);
                        for (let j = 0; j < vertCount; j++) {
                            const px = pos.getX(j);
                            const py = pos.getY(j);
                            const pz = pos.getZ(j);
                            v.set(px, py, pz).applyMatrix4(m4);
                            const oi = i * vertCount * 3 + j * 3;
                            positions[oi + 0] = v.x;
                            positions[oi + 1] = v.y;
                            positions[oi + 2] = v.z;
                            if (normals && nor) {
                                n.set(nor.getX(j), nor.getY(j), nor.getZ(j)).applyMatrix3(nm).normalize();
                                normals[oi + 0] = n.x;
                                normals[oi + 1] = n.y;
                                normals[oi + 2] = n.z;
                            }
                            if (uvs && uv) {
                                const ui = i * vertCount * 2 + j * 2;
                                uvs[ui + 0] = uv.getX(j);
                                uvs[ui + 1] = uv.getY(j);
                            }
                        }
                    }
                    const mg = new BufferGeometry();
                    mg.setAttribute('position', new Float32BufferAttribute(positions, 3));
                    if (normals) mg.setAttribute('normal', new Float32BufferAttribute(normals, 3));
                    if (uvs) mg.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
                    mg.computeBoundingSphere();
                    const mat = new MeshStandardMaterial({ color: new Color('#888888'), roughness: 0.85, metalness: 0.0 });
                    const m = new Mesh(mg, mat);
                    m.name = ((object as unknown as { name?: string }).name ? String((object as unknown as { name?: string }).name) + '_Proxy' : 'InstancedProxy');
                    (object as unknown as { visible?: boolean }).visible = false;
                    toAdd.push({ parent: (object as unknown as { parent?: Mesh['parent'] }).parent ?? null, mesh: m });
                    return;
                }
                const m = object as Mesh;
                if ((m as Mesh).isMesh) {
                    const convert = (mat: Material): Material => {
                        const mm = mat as unknown as { isMeshStandardMaterial?: boolean; isMeshPhysicalMaterial?: boolean; color?: Color };
                        if (mm.isMeshStandardMaterial || mm.isMeshPhysicalMaterial) return mat;
                        const base = mm.color instanceof Color ? mm.color : new Color(0xffffff);
                        const nm = new MeshStandardMaterial({ color: base, roughness: 0.9, metalness: 0.02 });
                        return nm;
                    };
                    if (Array.isArray(m.material)) {
                        const arr = m.material.map((mat) => {
                            if (!mat) return new MeshStandardMaterial({ color: new Color(0xffffff), roughness: 0.9, metalness: 0.02 });
                            return convert(mat as Material);
                        });
                        m.material = arr;
                    } else if (m.material) {
                        m.material = convert(m.material as Material);
                    } else {
                        m.material = new MeshStandardMaterial({ color: new Color(0xffffff), roughness: 0.9, metalness: 0.02 });
                    }
                }
            });
            for (const r of toAdd) { r.parent?.add(r.mesh); }
        }
        const camera = cameraRef.current;
        const canvas = canvasRef.current;

        if (!scene || !camera || !canvas) {
            disposeClonedScene();
            return;
        }

        const renderer = new WebGLRenderer({
            canvas,
            antialias: false,
            powerPreference: 'high-performance',
            preserveDrawingBuffer: false,
        });
        rendererRef.current = renderer;
        renderer.outputColorSpace = SRGBColorSpace;
        renderer.toneMapping = ACESFilmicToneMapping;
        renderer.toneMappingExposure = 0.9;

        const gl = renderer.getContext();
        const hasFloat = Boolean(gl.getExtension('EXT_color_buffer_float'));

        if (!renderer.capabilities.isWebGL2 || !hasFloat) {
            onStatus?.('unsupported', 'WebGL2 + EXT_color_buffer_float required');
            renderer.dispose();
            rendererRef.current = null;
            disposeClonedScene();
            return;
        }

        const tracer = new WebGLPathTracer(renderer);
        tracerRef.current = tracer;
        tracer.renderToCanvas = true;
        tracer.dynamicLowRes = true;
        tracer.lowResScale = 0.25;
        tracer.renderScale = 0.66;
        tracer.tiles.set(1, 1);
        tracer.bounces = 3;
        tracer.filterGlossyFactor = 0.85;
        tracer.rasterizeScene = false;
        tracer.minSamples = 1;
        tracer.fadeDuration = 0;
        tracer.renderDelay = 0;
        (tracer as unknown as { stableNoise: boolean }).stableNoise = true;

        const pixelRatio = Math.min(window.devicePixelRatio, 1.0);
        renderer.setPixelRatio(pixelRatio);
        renderer.setSize(window.innerWidth, window.innerHeight, false);

        let lastEnvSource: Texture | null = null;
        const applyBlurredEnvironment = (env: Texture | null) => {
            const safeEnv = resolveEnvironmentTexture(env);
            if (!safeEnv || safeEnv === lastEnvSource) return;
            const generator = new BlurredEnvMapGenerator(renderer);
            const blurred = generator.generate(safeEnv, 0.6);
            const copyToBackground = scene ? (scene.background === safeEnv || scene.background === null) : false;

            if (scene) {
                scene.environment = blurred;
                if (copyToBackground) {
                    scene.background = blurred;
                }
            }

            generator.dispose();
            lastEnvSource = safeEnv;
        };

        tracer.setScene(scene, camera);
        try { ((tracer as unknown as { _generator?: { bvhOptions?: Record<string, unknown> } })._generator!.bvhOptions = { maxLeafTris: 8 }); } catch (_e) { void (_e); }
        tracer.updateLights();
        tracer.updateEnvironment();

        const originalCompileAsync = (renderer as unknown as { compileAsync: (scene: unknown, camera?: unknown, targetScene?: unknown) => Promise<unknown> }).compileAsync.bind(renderer);
        (renderer as unknown as { compileAsync: (scene: unknown, camera?: unknown, targetScene?: unknown) => Promise<unknown> }).compileAsync = (s: unknown, c?: unknown, t?: unknown) => {
            const cam = c ?? camera;
            const target = t ?? scene;
            return originalCompileAsync(s, cam, target);
        };

        try {
            const anyTracer = tracer as unknown as { _pathTracer?: { _fsQuad?: { _mesh?: unknown } }, _lowResPathTracer?: { _fsQuad?: { _mesh?: unknown } } };
            const fsMesh1 = anyTracer._pathTracer?._fsQuad?._mesh;
            const fsMesh2 = anyTracer._lowResPathTracer?._fsQuad?._mesh;
            const compiler = renderer as unknown as { compile: (scene: unknown, camera: unknown, targetScene?: unknown) => unknown };
            if (fsMesh1) compiler.compile(fsMesh1, camera, scene);
            if (fsMesh2) compiler.compile(fsMesh2, camera, scene);
        } catch (_e) { void (_e); }

        const lastView = new Matrix4().copy(camera.matrixWorld);
        const lastProj = new Matrix4().copy(camera.projectionMatrix);
        let disposed = false;
        let movePauseUntil = 0;

        const matrixChanged = (a: Matrix4, b: Matrix4) => {
            const ae = a.elements;
            const be = b.elements;
            for (let i = 0; i < 16; i++) {
                if (Math.abs(ae[i] - be[i]) > 1e-5) return true;
            }
            return false;
        };

        
        let nextRebuildTime = 0;
        const excludeNames = new Set<string>(['AsteroidField']);
        const countMeshes = (s: Scene) => {
            let c = 0;
            s.traverse((o) => {
                const m = o as unknown as { isMesh?: boolean; name?: string };
                if (m.isMesh && !excludeNames.has(m.name || '')) c++;
            });
            return c;
        };
        let lastOrigCount = sceneRef.current ? countMeshes(sceneRef.current) : 0;
        let lastCloneCount = scene ? countMeshes(scene) : 0;
        const render = () => {
            if (disposed) return;

            // Reset accumulation if the camera moves.
            if (matrixChanged(camera.matrixWorld, lastView) || matrixChanged(camera.projectionMatrix, lastProj)) {
                tracer.reset();
                lastView.copy(camera.matrixWorld);
                lastProj.copy(camera.projectionMatrix);
                movePauseUntil = performance.now() + 150;
            }

            // Sync Dynamic Objects (Ship, Station, Planet)
            if (scene && sceneRef.current) {
                const syncObject = (name: string) => {
                    const original = sceneRef.current?.getObjectByName(name);
                    const cloned = scene ? scene.getObjectByName(name) : null;
                    if (original && cloned) {
                        cloned.position.copy(original.position);
                        cloned.quaternion.copy(original.quaternion);
                        cloned.updateMatrixWorld();
                    }
                };

                syncObject('PlayerShip');
                syncObject('Station');
                syncObject('Planet');

                
            }

            framesRef.current++;
            if (framesRef.current % 30 === 0) {
                if (sceneRef.current && scene) {
                    const origLights: Light[] = [];
                    sceneRef.current.traverse((o) => {
                        const l = o as unknown as Light;
                        if ((l as unknown as { isLight?: boolean }).isLight) origLights.push(l);
                    });
                    const clonedLights: Light[] = [];
                    scene.traverse((o) => {
                        const l = o as unknown as Light;
                        if ((l as unknown as { isLight?: boolean }).isLight) clonedLights.push(l);
                    });
                    const n = Math.min(origLights.length, clonedLights.length);
                    for (let i = 0; i < n; i++) {
                        clonedLights[i].intensity = origLights[i].intensity;
                        clonedLights[i].color.copy(origLights[i].color);
                    }
                    applyBlurredEnvironment(sceneRef.current.environment as Texture);
                    const now = performance.now();
                    const origCount = countMeshes(sceneRef.current);
                    const cloneCount = countMeshes(scene);
                    const origGrew = origCount > lastOrigCount;
                    const cloneGrew = cloneCount > lastCloneCount;
                    lastOrigCount = origCount;
                    if (cloneGrew) lastCloneCount = cloneCount;

                    if (origGrew && origCount > cloneCount && now >= nextRebuildTime) {
                        disposeClonedScene();
                        const newClone = cloneScene();
                        if (newClone) {
                            scene = newClone;
                            tracer.setScene(scene, camera);
                            lastCloneCount = countMeshes(scene);
                        }
                        nextRebuildTime = now + 1000;
                    }
                }
                
            }

            (tracer as unknown as { pausePathTracing: boolean }).pausePathTracing = performance.now() < movePauseUntil;
            tracer.updateCamera();
            tracer.renderSample();

            const sun = scene?.getObjectByName('SunMesh');
            if (sun && haloRef.current) {
                const p = new Vector3();
                sun.getWorldPosition(p);
                p.project(camera);
                const w = window.innerWidth;
                const h = window.innerHeight;
                const x = (p.x * 0.5 + 0.5) * w;
                const y = (-p.y * 0.5 + 0.5) * h;
                const d = camera.position.distanceTo(p);
                const s = Math.max(160, Math.min(560, 260000 / Math.max(d, 1)));
                const el = haloRef.current;
                el.style.transform = `translate(-50%, -50%) translate(${x}px, ${y}px)`;
                el.style.width = `${s}px`;
                el.style.height = `${s}px`;
                el.style.opacity = '0.9';
                if (bloomRef.current) {
                    bloomRef.current.style.transform = `translate(-50%, -50%) translate(${x}px, ${y}px)`;
                    bloomRef.current.style.width = `${s * 1.8}px`;
                    bloomRef.current.style.height = `${s * 1.8}px`;
                    bloomRef.current.style.opacity = '0.6';
                }
            }

            if (showDebug.current && debugRef.current && sceneRef.current) {
                const lines: string[] = [];
                let i = 0;
                sceneRef.current.traverse((o) => {
                    const l = o as unknown as { isLight?: boolean; intensity?: number; color?: { getHexString: () => string } };
                    if (l.isLight) {
                        const hex = l.color?.getHexString?.() ?? 'ffffff';
                        lines.push(`light[${i++}] intensity=${l.intensity} color=#${hex}`);
                    }
                });
                lines.push(`env=${sceneRef.current.environment ? 'on' : 'off'}`);
                debugRef.current.textContent = lines.join('\n');
            } else if (debugRef.current) {
                debugRef.current.textContent = '';
            }

            rafRef.current = requestAnimationFrame(render);
        };

        const handleResize = () => {
            renderer.setSize(window.innerWidth, window.innerHeight, false);
            tracer.reset();
        };

        window.addEventListener('resize', handleResize);
        rafRef.current = requestAnimationFrame(render);
        onStatus?.('ready');

        return () => {
            disposed = true;
            cancelAnimationFrame(rafRef.current);
            window.removeEventListener('resize', handleResize);
            const tracerSnapshot = tracer;
            const rendererSnapshot = renderer;

            void (async () => {
                await disposePathTracer({ tracer: tracerSnapshot, renderer: rendererSnapshot });
                disposeClonedScene();
            })();
        };
    }, [enabled, onStatus, sceneRef, cameraRef, depsKey]);

    return (
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
            <canvas
                ref={canvasRef}
                style={{
                    position: 'absolute',
                    inset: 0,
                    pointerEvents: 'none',
                    opacity: enabled ? 1 : 0,
                    transition: 'opacity 0.25s ease',
                    mixBlendMode: 'normal',
                }}
            />
            <div
                ref={bloomRef}
                style={{
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    borderRadius: '50%',
                    background: 'radial-gradient(circle, rgba(255,240,210,0.35) 0%, rgba(255,190,120,0.18) 45%, rgba(255,180,90,0) 75%)',
                    filter: 'blur(26px)',
                    mixBlendMode: 'screen',
                }}
            />
            <div
                ref={haloRef}
                style={{
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    borderRadius: '50%',
                    background: 'radial-gradient(circle, rgba(255,240,200,0.65) 0%, rgba(255,200,100,0.35) 45%, rgba(255,180,90,0.12) 65%, rgba(255,220,120,0) 80%)',
                    mixBlendMode: 'screen',
                    filter: 'blur(10px)',
                }}
            />
            <div
                ref={debugRef}
                style={{
                    position: 'absolute',
                    left: 12,
                    top: 12,
                    fontFamily: 'monospace',
                    fontSize: '11px',
                    color: '#9ad0ff',
                    whiteSpace: 'pre',
                    opacity: enabled && showDebug.current ? 1 : 0,
                    display: showDebug.current ? 'block' : 'none',
                }}
            />
        </div>
    );
};
