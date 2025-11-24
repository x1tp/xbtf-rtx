import React, { useEffect, useRef, useState } from 'react';
import { Stars, Environment } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { Ship } from './components/Ship';
import { Planet } from './components/Planet';
import { Station } from './components/Station';
import { Sun } from './components/Sun';
import { InstancedMesh, TextureLoader, SRGBColorSpace, LinearSRGBColorSpace, RepeatWrapping } from 'three';
import * as THREE from 'three';
import { ensureRapier, getWorld, getWorldSync } from './physics/RapierWorld';
import type RAPIERType from '@dimforge/rapier3d-compat';

interface SceneProps { hdr?: boolean }
export const Scene: React.FC<SceneProps> = ({ hdr = false }) => {
    const sunPosition: [number, number, number] = [5000, 2000, 5000];
    return (
        <>
            <color attach="background" args={['#000005']} />

            {/* Environment */}
            <Stars radius={8000} depth={80} count={16000} factor={3.5} saturation={0} fade speed={0} />
            <Environment preset="night" />
            {!hdr && <ambientLight intensity={0.05} />}
            <Sun position={sunPosition} size={200} color="#ffddaa" intensity={5.0} hdr={hdr} />

            {/* Player */}
            <Ship enableLights={!hdr} position={[0, 10, 450]} />

            {/* Environment Objects */}
            <Planet position={[8000, 500, -10000]} size={10000} color="#4466aa" hdr={hdr} sunPosition={sunPosition} />
            <Station position={[50, 0, -120]} showLights={!hdr} scale={40} modelPath={'/models/00001.obj'} rotationSpeed={-0.05} rotationAxis={'z'} />
            <Asteroids count={500} range={400} />


        </>
    );
};

interface AsteroidsProps { count: number; range: number }
const Asteroids: React.FC<AsteroidsProps> = ({ count, range }) => {
    const meshRef = useRef<InstancedMesh>(null);
    const positionsRef = useRef<THREE.Vector3[]>([]);
    const velocitiesRef = useRef<THREE.Vector3[]>([]);
    const scalesRef = useRef<number[]>([]);
    const bodiesRef = useRef<RAPIERType.RigidBody[]>([]);
    type AsteroidUserData = { positions: THREE.Vector3[]; velocities: THREE.Vector3[]; scales: number[] };
    const mobileThreshold = 10.0;

    const [particles] = useState(() => {
        const temp: { position: [number, number, number]; scale: number }[] = [];
        for (let i = 0; i < count; i++) {
            const x = (Math.random() - 0.5) * range;
            const y = (Math.random() - 0.5) * range;
            const z = (Math.random() - 0.5) * range;
            const scale = 0.8 + Math.random() * 4.2;
            temp.push({ position: [x, y, z], scale });
        }
        return temp;
    });

    useEffect(() => {
        let cancelled = false;
        if (!meshRef.current) return;
        positionsRef.current = particles.map((p) => new THREE.Vector3(p.position[0], p.position[1], p.position[2]));
        velocitiesRef.current = new Array(particles.length).fill(0).map(() => new THREE.Vector3());
        scalesRef.current = particles.map((p) => p.scale);
        const dummy = new THREE.Object3D();
        for (let i = 0; i < particles.length; i++) {
            const pos = positionsRef.current[i];
            const s = scalesRef.current[i];
            dummy.position.copy(pos);
            dummy.scale.set(s, s, s);
            dummy.rotation.set(0, 0, 0);
            dummy.updateMatrix();
            meshRef.current!.setMatrixAt(i, dummy.matrix);
        }
        meshRef.current.instanceMatrix.needsUpdate = true;
        meshRef.current.frustumCulled = false;
        const ud = meshRef.current.userData as AsteroidUserData;
        ud.positions = positionsRef.current;
        ud.velocities = velocitiesRef.current;
        ud.scales = scalesRef.current;

        (async () => {
            const RAPIER = await ensureRapier();
            if (cancelled) return;
            const world = await getWorld();
            if (cancelled) return;
            const bodies: RAPIERType.RigidBody[] = [];
            const randVec = (scale: number) => ({
                x: (Math.random() - 0.5) * 3.2 * scale,
                y: (Math.random() - 0.5) * 1.2 * scale,
                z: (Math.random() - 0.5) * 3.2 * scale
            });
            for (let i = 0; i < positionsRef.current.length; i++) {
                if (cancelled) break;
                const pos = positionsRef.current[i];
                const s = scalesRef.current[i];
                const isMobile = s <= mobileThreshold;
                const rbDesc = isMobile
                    ? RAPIER.RigidBodyDesc.dynamic()
                        .setTranslation(pos.x, pos.y, pos.z)
                        .setLinearDamping(0.0)
                        .setAngularDamping(0.005)
                        .setCcdEnabled(true)
                        .setCanSleep(false)
                    : RAPIER.RigidBodyDesc.fixed()
                        .setTranslation(pos.x, pos.y, pos.z);
                const body = world.createRigidBody(rbDesc);
                const collDesc = RAPIER.ColliderDesc.ball(s)
                    .setRestitution(isMobile ? 0.4 : 0.0)
                    .setFriction(isMobile ? 0.35 : 0.8);
                if (isMobile && 'setDensity' in collDesc) {
                    (collDesc as unknown as { setDensity: (d: number) => unknown }).setDensity(0.1);
                }
                world.createCollider(collDesc, body);
                if (isMobile && 'setAngvel' in body) {
                    (body as unknown as { setAngvel: (v: { x: number; y: number; z: number }, wake: boolean) => void })
                        .setAngvel({ x: (Math.random() - 0.5) * 0.1, y: (Math.random() - 0.5) * 0.1, z: (Math.random() - 0.5) * 0.1 }, true);
                }
                if (isMobile && 'setLinvel' in body) {
                    (body as unknown as { setLinvel: (v: { x: number; y: number; z: number }, wake: boolean) => void })
                        .setLinvel(randVec(1.0), true);
                }
                bodies.push(body);
            }
            if (cancelled) {
                bodies.forEach(b => world.removeRigidBody(b));
                return;
            }
            bodiesRef.current = bodies;
            console.log('Asteroids created:', bodies.length, 'bodies in world:', world.bodies.len());
        })();

        return () => {
            cancelled = true;
            if (bodiesRef.current.length > 0) {
                const w = getWorldSync();
                if (w) {
                    bodiesRef.current.forEach(b => w.removeRigidBody(b));
                }
                bodiesRef.current = [];
            }
        };
    }, [particles]);

    useFrame(() => {
        const mesh = meshRef.current;
        if (!mesh) return;
        const dummy = new THREE.Object3D();
        const bodies = bodiesRef.current || [];
        for (let i = 0; i < bodies.length; i++) {
            const body = bodies[i];
            const t = body.translation();
            const r = body.rotation();
            positionsRef.current[i].set(t.x, t.y, t.z);
            const s = scalesRef.current[i];
            dummy.position.set(t.x, t.y, t.z);
            dummy.scale.set(s, s, s);
            dummy.quaternion.set(r.x, r.y, r.z, r.w);
            dummy.updateMatrix();
            mesh.setMatrixAt(i, dummy.matrix);
            if (s <= mobileThreshold) {
                const lv = body.linvel();
                const speed = Math.hypot(lv.x, lv.y, lv.z);
                if (speed < 0.6 && 'setLinvel' in body) {
                    (body as unknown as { setLinvel: (v: { x: number; y: number; z: number }, wake: boolean) => void })
                        .setLinvel({ x: (Math.random() - 0.5) * 2.5, y: (Math.random() - 0.5) * 0.8, z: (Math.random() - 0.5) * 2.5 }, true);
                }
            }
        }
        mesh.instanceMatrix.needsUpdate = true;
    });

    const matRef = useRef<THREE.MeshStandardMaterial | null>(null);
    useEffect(() => {
        const loader = new TextureLoader();
        const paths = [
            '/materials/asteroid/baseColor.png',
            '/materials/asteroid/roughness.png',
            '/materials/asteroid/metallic.png',
            '/materials/asteroid/normal.png'
        ];
        Promise.all(paths.map((p) => loader.loadAsync(p).catch(() => null))).then(([map, rough, metal, normal]) => {
            if (!matRef.current) return;
            const aniso = 4;
            if (map) { map.colorSpace = SRGBColorSpace; map.wrapS = RepeatWrapping; map.wrapT = RepeatWrapping; map.anisotropy = aniso; matRef.current.map = map as THREE.Texture; }
            if (rough) { rough.colorSpace = LinearSRGBColorSpace; rough.wrapS = RepeatWrapping; rough.wrapT = RepeatWrapping; rough.anisotropy = aniso; matRef.current.roughnessMap = rough as THREE.Texture; }
            if (metal) { metal.colorSpace = LinearSRGBColorSpace; metal.wrapS = RepeatWrapping; metal.wrapT = RepeatWrapping; metal.anisotropy = aniso; matRef.current.metalnessMap = metal as THREE.Texture; }
            if (normal) { normal.colorSpace = LinearSRGBColorSpace; normal.wrapS = RepeatWrapping; normal.wrapT = RepeatWrapping; normal.anisotropy = aniso; matRef.current.normalMap = normal as THREE.Texture; }
            matRef.current.roughness = 0.9;
            matRef.current.metalness = 0.02;
            matRef.current.needsUpdate = true;
        });
    }, []);

    return (
        <instancedMesh ref={meshRef} name="AsteroidField" args={[undefined, undefined, count]} castShadow receiveShadow>
            <dodecahedronGeometry args={[1, 0]} />
            <meshStandardMaterial ref={matRef} color="#554433" roughness={0.9} />
        </instancedMesh>
    );
};
