import React, { useEffect, useRef, useState } from 'react';
import { InstancedMesh } from 'three';
import * as THREE from 'three';
import { TextureLoader, SRGBColorSpace, LinearSRGBColorSpace, RepeatWrapping } from 'three';

interface AsteroidFieldProps {
    count: number;
    range: number;
}

export const AsteroidField: React.FC<AsteroidFieldProps> = ({ count, range }) => {
    const meshRef = useRef<InstancedMesh>(null);

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
        const dummy = new THREE.Object3D();
        particles.forEach((p, i) => {
            dummy.position.set(p.position[0], p.position[1], p.position[2]);
            dummy.scale.set(p.scale, p.scale, p.scale);
            dummy.rotation.set(0, 0, 0);
            dummy.updateMatrix();
            meshRef.current!.setMatrixAt(i, dummy.matrix);
        });
        meshRef.current.instanceMatrix.needsUpdate = true;
        meshRef.current.frustumCulled = false;
    }, [particles]);

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
        <instancedMesh ref={meshRef} args={[undefined, undefined, count]}>
            <dodecahedronGeometry args={[1, 0]} />
            <meshStandardMaterial ref={matRef} color="#554433" roughness={0.9} />
        </instancedMesh>
    );
};
