'use client';

import { useEffect, useMemo, useRef, type RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { mergedBoxes, rods, type V3 } from './scene-geometry';
import {
  floorContour,
  BODY_BASE,
  TOWER_XZ_SCALE,
  FOUNDATION_RADIUS,
  RAFT_RADIUS,
} from './burj-profile';
import { MIXER_STOP } from './burj-site-motion';

type Props = { progress: RefObject<{ value: number }>; reducedMotion: boolean; night: boolean };
const ramp = (p: number, a: number, b: number) => THREE.MathUtils.smoothstep(p, a, b);

/** All lengths use the same scale as the tower: one scene unit is ten metres. */
export function BurjEnvironment({ progress, reducedMotion, night }: Props) {
  const excavation = useRef<THREE.Mesh>(null);
  const piles = useRef<THREE.InstancedMesh>(null);
  const raft = useRef<THREE.Mesh>(null);
  const lobby = useRef<THREE.Mesh>(null);
  const rebar = useRef<THREE.Mesh>(null);
  const survey = useRef<THREE.Group>(null);
  const siteWorks = useRef<THREE.Group>(null);
  const landscaping = useRef<THREE.Group>(null);
  const palms = useRef<THREE.Group>(null);
  const drill = useRef<THREE.Group>(null);
  const drillRod = useRef<THREE.Group>(null);
  const fountain = useRef<THREE.InstancedMesh>(null);
  const fountainTransform = useMemo(() => new THREE.Object3D(), []);
  const plans = useMemo(() => {
    const terrain = new THREE.Shape();
    terrain.moveTo(-500, -500);
    terrain.lineTo(500, -500);
    terrain.lineTo(500, 500);
    terrain.lineTo(-500, 500);
    terrain.closePath();
    const cut = new THREE.Path();
    cut.absarc(0, 0, FOUNDATION_RADIUS, 0, Math.PI * 2, true);
    terrain.holes.push(cut);
    const land = new THREE.ShapeGeometry(terrain, 64);
    land.rotateX(-Math.PI / 2);
    const footprint = new THREE.Shape();
    floorContour(0).forEach((point, index) => {
      if (index === 0) footprint.moveTo(point.x * TOWER_XZ_SCALE, -point.z * TOWER_XZ_SCALE);
      else footprint.lineTo(point.x * TOWER_XZ_SCALE, -point.z * TOWER_XZ_SCALE);
    });
    footprint.closePath();
    const lobbyGeometry = new THREE.ExtrudeGeometry(footprint, {
      depth: BODY_BASE,
      bevelEnabled: false,
    });
    lobbyGeometry.rotateX(-Math.PI / 2);
    const cage: [V3, V3][] = [];
    for (let n = -7.5; n <= 7.5; n += 0.24) {
      const span = Math.sqrt(Math.max(0, (RAFT_RADIUS - 0.2) ** 2 - n ** 2));
      for (const y of [-0.19, -0.08]) {
        cage.push([
          [n, y, -span],
          [n, y, span],
        ]);
        cage.push([
          [-span, y + 0.025, n],
          [span, y + 0.025, n],
        ]);
      }
    }
    const outlines: [V3, V3][] = [];
    for (const x of [-8.65, 8.65])
      outlines.push([
        [x, 0.025, -8.65],
        [x, 0.025, 8.65],
      ]);
    for (const z of [-8.65, 8.65])
      outlines.push([
        [-8.65, 0.025, z],
        [8.65, 0.025, z],
      ]);
    const barriers: { position: V3; size: V3 }[] = [];
    for (let x = -14; x <= 14; x += 0.75)
      for (const z of [-13, 13.5]) {
        barriers.push({ position: [x, 0.24, z], size: [0.032, 0.48, 0.032] });
        barriers.push({ position: [x, 0.18, z], size: [0.7, 0.22, 0.025] });
      }
    for (let z = -12.5; z <= 13; z += 0.75)
      for (const x of [-14.5, 14.5]) {
        barriers.push({ position: [x, 0.24, z], size: [0.032, 0.48, 0.032] });
        barriers.push({ position: [x, 0.18, z], size: [0.025, 0.22, 0.7] });
      }
    const marks: { position: V3; size: V3 }[] = [];
    for (let x = -18; x <= 18; x += 1.6)
      marks.push({ position: [x, 0.004, MIXER_STOP[2] + 0.4], size: [0.75, 0.008, 0.025] });
    const palms: { position: V3; size: V3 }[] = [];
    const leaves: THREE.BufferGeometry[] = [];
    const leafTransform = new THREE.Object3D();
    for (let i = 0; i < 32; i++) {
      const angle = (i / 32) * Math.PI * 2;
      const x = Math.cos(angle) * 8.6,
        z = Math.sin(angle) * 8.6;
      palms.push({ position: [x, 0.43, z], size: [0.065, 0.86, 0.065] });
      for (let j = 0; j < 6; j++) {
        const a = (j * Math.PI) / 3;
        const leaf = new THREE.SphereGeometry(1, 6, 3);
        leafTransform.position.set(x + Math.sin(a) * 0.17, 0.86, z + Math.cos(a) * 0.17);
        leafTransform.rotation.set(0, a, 0.14);
        leafTransform.scale.set(0.08, 0.025, 0.4);
        leafTransform.updateMatrix();
        leaf.applyMatrix4(leafTransform.matrix);
        leaves.push(leaf);
      }
    }
    const canopy = mergeGeometries(leaves)!;
    leaves.forEach((leaf) => leaf.dispose());
    return {
      land,
      lobby: lobbyGeometry,
      canopy,
      rebar: rods(cage, 0.008),
      strings: rods(outlines, 0.005),
      barriers: mergedBoxes(barriers),
      marks: mergedBoxes(marks),
      palms: mergedBoxes(palms),
    };
  }, []);
  useEffect(() => () => Object.values(plans).forEach((g) => g?.dispose()), [plans]);
  useEffect(() => {
    if (!piles.current) return;
    const dummy = new THREE.Object3D();
    let count = 0;
    for (let x = -6.9; x <= 6.9; x += 1.1)
      for (let z = -6.9; z <= 6.9; z += 1.1) {
        if (Math.hypot(x, z) > RAFT_RADIUS - 0.4) continue;
        dummy.position.set(x, -2.65, z);
        dummy.updateMatrix();
        piles.current.setMatrixAt(count++, dummy.matrix);
      }
    piles.current.count = count;
    piles.current.instanceMatrix.needsUpdate = true;
  }, []);
  useFrame(({ clock }) => {
    const p = reducedMotion ? 1 : progress.current.value;
    const dig = ramp(p, 0.115, 0.18),
      finish = ramp(p, 0.85, 0.94);
    if (excavation.current) excavation.current.position.y = -0.012 - dig * 1.15;
    if (piles.current) piles.current.visible = p > 0.155;
    if (rebar.current) rebar.current.visible = p > 0.18 && p < 0.258;
    if (lobby.current) {
      const base = ramp(p, 0.243, 0.258);
      lobby.current.position.y = -0.4 + 0.4 * ramp(p, 0.207, 0.257);
      lobby.current.visible = base > 0.001;
      lobby.current.scale.y = Math.max(0.001, base);
    }
    if (raft.current) {
      const cast = ramp(p, 0.207, 0.257);
      raft.current.visible = cast > 0.001;
      raft.current.scale.y = Math.max(0.001, cast);
      raft.current.position.y = -0.4 + 0.2 * cast;
    }
    if (siteWorks.current) siteWorks.current.visible = p < 0.88;
    if (survey.current) survey.current.visible = p > 0.04 && p < 0.2;
    if (landscaping.current) {
      landscaping.current.visible = finish > 0.01;
    }
    if (palms.current) palms.current.scale.y = Math.max(0.001, finish);
    if (drill.current) drill.current.visible = p > 0.12 && p < 0.213;
    if (drillRod.current && !reducedMotion) drillRod.current.rotation.y = clock.elapsedTime * 2;
    if (fountain.current && finish > 0.01) {
      const dummy = fountainTransform;
      for (let i = 0; i < 32; i++) {
        const a = (i / 31) * Math.PI * 1.15;
        const height =
          0.06 +
          (Math.sin(i * 0.5 + (reducedMotion ? 0 : clock.elapsedTime * 1.8)) * 0.5 + 0.5) * 0.2;
        dummy.position.set(Math.cos(a) * 6.7, -0.005 + height / 2, Math.sin(a) * 2.7 + 12.0);
        dummy.scale.set(0.014, height, 0.014);
        dummy.updateMatrix();
        fountain.current.setMatrixAt(i, dummy.matrix);
      }
      fountain.current.instanceMatrix.needsUpdate = true;
    }
  });
  return (
    <>
      <mesh geometry={plans.land} receiveShadow>
        <meshStandardMaterial color={night ? '#34433e' : '#c8bba2'} roughness={0.95} />
      </mesh>
      <mesh ref={excavation} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[FOUNDATION_RADIUS - 0.01, 64]} />
        <meshStandardMaterial color="#ac9578" roughness={1} />
      </mesh>
      <mesh position={[0, -0.59, 0]}>
        <cylinderGeometry
          args={[FOUNDATION_RADIUS + 0.02, FOUNDATION_RADIUS + 0.02, 1.18, 64, 1, true]}
        />
        <meshStandardMaterial color="#8d8272" roughness={0.95} side={THREE.DoubleSide} />
      </mesh>
      <instancedMesh ref={piles} args={[undefined, undefined, 180]} castShadow>
        <cylinderGeometry args={[0.09, 0.09, 5.05, 8]} />
        <meshStandardMaterial color="#a9a79b" roughness={0.9} />
      </instancedMesh>
      <mesh ref={rebar} geometry={plans.rebar}>
        <meshStandardMaterial color="#5a5d59" metalness={0.5} roughness={0.7} />
      </mesh>
      <mesh ref={raft} position={[0, -0.2, 0]} receiveShadow>
        <cylinderGeometry args={[RAFT_RADIUS, RAFT_RADIUS, 0.4, 64]} />
        <meshStandardMaterial color="#c0beb1" roughness={0.88} />
      </mesh>
      <mesh ref={lobby} geometry={plans.lobby} castShadow receiveShadow>
        <meshStandardMaterial color="#687f87" metalness={0.3} roughness={0.3} />
      </mesh>
      <group ref={survey}>
        <mesh geometry={plans.strings}>
          <meshBasicMaterial color="#e7b364" />
        </mesh>
        {[-8.65, 8.65].flatMap((x) =>
          [-8.65, 8.65].map((z) => (
            <group key={`${x}-${z}`} position={[x, 0, z]}>
              <mesh position={[0, 0.16, 0]}>
                <cylinderGeometry args={[0.012, 0.012, 0.32, 6]} />
                <meshStandardMaterial color="#c8aa78" />
              </mesh>
              <mesh position={[0, 0.27, 0]}>
                <boxGeometry args={[0.12, 0.07, 0.007]} />
                <meshStandardMaterial color="#e28c43" />
              </mesh>
            </group>
          )),
        )}
      </group>
      <group ref={siteWorks}>
        <mesh geometry={plans.barriers}>
          <meshStandardMaterial color={night ? '#586b66' : '#ddd8c9'} roughness={0.9} />
        </mesh>
        <mesh position={[0, 0.002, MIXER_STOP[2]]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[38, 1.1]} />
          <meshStandardMaterial
            color="#6e7370"
            roughness={1}
            polygonOffset
            polygonOffsetFactor={-1}
            polygonOffsetUnits={-3}
          />
        </mesh>
        <mesh geometry={plans.marks}>
          <meshStandardMaterial color="#d4cbb7" roughness={1} />
        </mesh>
      </group>
      <group ref={drill} position={[8.6, 0, 2.7]}>
        <mesh position={[0, 0.18, 0]} castShadow>
          <boxGeometry args={[0.5, 0.24, 0.8]} />
          <meshStandardMaterial color="#be913b" />
        </mesh>
        {[-0.28, 0.28].map((x) => (
          <mesh key={x} position={[x, 0.09, 0]}>
            <boxGeometry args={[0.14, 0.17, 0.9]} />
            <meshStandardMaterial color="#37413e" />
          </mesh>
        ))}
        <mesh position={[0, 0.9, -0.23]}>
          <boxGeometry args={[0.14, 1.65, 0.13]} />
          <meshStandardMaterial color="#ceab52" metalness={0.3} />
        </mesh>
        <group ref={drillRod} position={[0, 0.76, -0.1]}>
          <mesh>
            <cylinderGeometry args={[0.024, 0.024, 1.8, 8]} />
            <meshStandardMaterial color="#59605d" metalness={0.6} />
          </mesh>
          {Array.from({ length: 14 }, (_, i) => (
            <mesh key={i} position={[0, -0.85 + i * 0.12, 0]} rotation={[0, 0, 0.26]}>
              <torusGeometry args={[0.058, 0.012, 4, 9]} />
              <meshStandardMaterial color="#7c8179" metalness={0.5} />
            </mesh>
          ))}
        </group>
      </group>
      <group ref={landscaping}>
        <mesh position={[0, 0.015, 0]} receiveShadow>
          <cylinderGeometry args={[8.2, 8.4, 0.06, 64]} />
          <meshStandardMaterial color={night ? '#3b4b43' : '#ded8c7'} roughness={0.8} />
        </mesh>
        <mesh position={[0, 0.025, 12.0]} rotation={[-Math.PI / 2, 0, 0]} scale={[9.0, 3.2, 1]}>
          <circleGeometry args={[1, 64]} />
          <meshPhysicalMaterial
            color={night ? '#21535c' : '#6eafb1'}
            roughness={0.21}
            metalness={0.35}
            clearcoat={1}
          />
        </mesh>
        <group ref={palms}>
          <mesh geometry={plans.palms} castShadow>
            <meshStandardMaterial color="#8f8064" />
          </mesh>
          <mesh geometry={plans.canopy} castShadow>
            <meshStandardMaterial color={night ? '#325c4b' : '#618468'} roughness={0.9} />
          </mesh>
        </group>
        <instancedMesh ref={fountain} args={[undefined, undefined, 32]}>
          <cylinderGeometry args={[1, 1, 1, 5]} />
          <meshBasicMaterial color={night ? '#abd7e0' : '#c5e4e2'} transparent opacity={0.5} />
        </instancedMesh>
      </group>
    </>
  );
}
