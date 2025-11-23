import React, { useEffect, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { ensureRapier, getWorld } from '../physics/RapierWorld';
import type RAPIERType from '@dimforge/rapier3d-compat';
import { InstancedMesh } from 'three';
import * as THREE from 'three';
import { TextureLoader, SRGBColorSpace, LinearSRGBColorSpace, RepeatWrapping } from 'three';

interface AsteroidFieldProps {
    count: number;
    range: number;
}

export const AsteroidField: React.FC<AsteroidFieldProps> = ({ count, range }) => {
    const meshRef = useRef<InstancedMesh>(null);
    const positionsRef = useRef<THREE.Vector3[]>([]);
    const velocitiesRef = useRef<THREE.Vector3[]>([]);
    const scalesRef = useRef<number[]>([]);
    const bodiesRef = useRef<RAPIERType.RigidBody[]>([]);
    type AsteroidUserData = { positions: THREE.Vector3[]; velocities: THREE.Vector3[]; scales: number[] };

    const [particles] = useState(() => {
        const temp: { position: [number, number, number]; scale: number }[] = [];
        for (let i = 0; i < count; i++) {
            const x = (Math.random() - 0.5) * range;
            const y = (Math.random() - 0.5) * range;
            const z = (Math.random() - 0.5) * range;
            const scale = 1 + Math.random() * 3;
            temp.push({ position: [x, y, z], scale });
        }
        return temp;
    });

    useEffect(() => {
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
            const world = await getWorld();
            const bodies: RAPIERType.RigidBody[] = [];
            for (let i = 0; i < positionsRef.current.length; i++) {
                const pos = positionsRef.current[i];
                const s = scalesRef.current[i];
                const rbDesc = RAPIER.RigidBodyDesc.dynamic()
                    .setTranslation(pos.x, pos.y, pos.z)
                    .setLinearDamping(0.02)
                    .setAngularDamping(0.02)
                    .setCanSleep(false);
                const body = world.createRigidBody(rbDesc);
                const collDesc = RAPIER.ColliderDesc.ball(s)
                    .setRestitution(0.2)
                    .setFriction(0.6);
                world.createCollider(collDesc, body);
                bodies.push(body);
            }
            bodiesRef.current = bodies;
        })();
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
            // apply rotation quaternion
            dummy.quaternion.set(r.x, r.y, r.z, r.w);
            dummy.updateMatrix();
            mesh.setMatrixAt(i, dummy.matrix);
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
