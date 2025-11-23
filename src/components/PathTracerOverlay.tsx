import type { FC, MutableRefObject } from 'react';
import { useEffect, useRef } from 'react';
import { Matrix4, WebGLRenderer, SRGBColorSpace, ACESFilmicToneMapping, Texture, Vector3 } from 'three';
import type { Light } from 'three';
import type { PerspectiveCamera, Scene } from 'three';
import { WebGLPathTracer, BlurredEnvMapGenerator } from 'three-gpu-pathtracer';
import type { Mesh, Material } from 'three';

type Status = 'ready' | 'unsupported' | 'error';

interface PathTracerOverlayProps {
    enabled: boolean;
    sceneRef: MutableRefObject<Scene | null>;
    cameraRef: MutableRefObject<PerspectiveCamera | null>;
    onStatus?: (status: Status, message?: string) => void;
}

// Creates its own renderer + path tracer on a separate canvas, using the live R3F scene/camera.
export const PathTracerOverlay: FC<PathTracerOverlayProps> = ({ enabled, sceneRef, cameraRef, onStatus }) => {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const rendererRef = useRef<WebGLRenderer | null>(null);
    const tracerRef = useRef<WebGLPathTracer | null>(null);
    const rafRef = useRef<number>(0);
    const haloRef = useRef<HTMLDivElement | null>(null);
    const bloomRef = useRef<HTMLDivElement | null>(null);
    const debugRef = useRef<HTMLDivElement | null>(null);
    const framesRef = useRef<number>(0);

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

        const scene = sceneRef.current?.clone();
        if (scene && sceneRef.current) {
            scene.environment = sceneRef.current.environment;
            scene.background = sceneRef.current.background;
            scene.fog = sceneRef.current.fog;
        }
        const disposeClonedScene = () => {
            if (!scene) return;

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
        };

        // Deep clone materials to prevent shared state issues (disposal/modification)
        if (scene) {
            scene.traverse((object) => {
                const m = object as Mesh;
                if ((m as Mesh).isMesh && m.material) {
                    if (Array.isArray(m.material)) {
                        m.material = m.material.map((mat) => (mat as Material).clone());
                    } else {
                        m.material = (m.material as Material).clone();
                    }
                }
            });
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
        tracer.renderScale = 1.0;
        tracer.tiles.set(1, 1);
        tracer.bounces = 5;
        tracer.filterGlossyFactor = 0.5;

        const pixelRatio = Math.min(window.devicePixelRatio, 1.5);
        renderer.setPixelRatio(pixelRatio);
        renderer.setSize(window.innerWidth, window.innerHeight, false);

        let lastEnvSource: Texture | null = null;
        const applyBlurredEnvironment = (env: Texture | null) => {
            if (!env || env === lastEnvSource) return;
            const generator = new BlurredEnvMapGenerator(renderer);
            const blurred = generator.generate(env, 0.35);
            const copyToBackground = scene.background === env;

            scene.environment = blurred;
            if (copyToBackground) {
                scene.background = blurred;
            }

            generator.dispose();
            lastEnvSource = env;
        };

        applyBlurredEnvironment(scene.environment as Texture);
        tracer.setScene(scene, camera);
        tracer.updateMaterials();
        tracer.updateLights();
        tracer.updateEnvironment();
        tracer.reset();

        const lastView = new Matrix4().copy(camera.matrixWorld);
        const lastProj = new Matrix4().copy(camera.projectionMatrix);
        let disposed = false;

        const matrixChanged = (a: Matrix4, b: Matrix4) => {
            const ae = a.elements;
            const be = b.elements;
            for (let i = 0; i < 16; i++) {
                if (Math.abs(ae[i] - be[i]) > 1e-5) return true;
            }
            return false;
        };

        const render = () => {
            if (disposed) return;

            // Reset accumulation if the camera moves.
            if (matrixChanged(camera.matrixWorld, lastView) || matrixChanged(camera.projectionMatrix, lastProj)) {
                tracer.reset();
                lastView.copy(camera.matrixWorld);
                lastProj.copy(camera.projectionMatrix);
            }

            // Sync Dynamic Objects (Ship, Station, Planet)
            if (scene && sceneRef.current) {
                const syncObject = (name: string) => {
                    const original = sceneRef.current?.getObjectByName(name);
                    const cloned = scene.getObjectByName(name);
                    if (original && cloned) {
                        cloned.position.copy(original.position);
                        cloned.quaternion.copy(original.quaternion);
                        cloned.updateMatrixWorld();
                    }
                };

                syncObject('PlayerShip');
                syncObject('Station');
                syncObject('Planet');

                // Note: If the path tracer BVH is static, moving objects might not update their collision/shadows correctly 
                // without a full scene update or refit, but for visual rotation it often works if the mesh itself moves.
                // If shadows don't update, we might need `tracer.updateObjects()` if supported.
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
                }
                tracer.updateLights();
                tracer.updateEnvironment();
            }

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

            if (debugRef.current && sceneRef.current) {
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
    }, [enabled, onStatus, sceneRef, cameraRef]);

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
                    opacity: enabled ? 1 : 0,
                }}
            />
        </div>
    );
};
