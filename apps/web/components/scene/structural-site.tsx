'use client';

import { type RefObject, useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { mergedBoxes, rods, roundedPlate, type V3 } from './scene-geometry';
import { floorStructureStart, floorStructureEnd } from './construction-timeline';

type Props = { progress: RefObject<{ value: number }>; reducedMotion: boolean };
const ramp = (p: number, from: number, to: number) => {
  const t = THREE.MathUtils.clamp((p - from) / (to - from), 0, 1);
  return t * t * (3 - 2 * t);
};

/** Excavation is cut into the terrain; concrete and ground always have a supporting surface. */
export function Foundation({ progress, reducedMotion }: Props) {
  const soil = useRef<THREE.Mesh>(null);
  const footings = useRef<THREE.Group>(null);
  const reinforcement = useRef<THREE.Group>(null);
  const raft = useRef<THREE.Group>(null);
  const survey = useRef<THREE.Group>(null);
  const lining = useRef<THREE.Group>(null);
  const geometries = useMemo(() => {
    const bases = [-2.39, -0.4, 1.59].flatMap((x) =>
      [-1.635, 1.135].map((z) => ({
        position: [x, -0.545, z] as V3,
        size: [0.8, 0.19, 0.75] as V3,
      })),
    );
    for (const x of [2.15, 3.95])
      for (const z of [-1.76, 0.76])
        bases.push({ position: [x, -0.545, z], size: [0.65, 0.19, 0.7] });
    const lines: Array<[V3, V3]> = [];
    for (let x = -2.72; x <= 4.17; x += 0.2)
      for (const y of [-0.37, -0.24])
        lines.push([
          [x, y, -1.96],
          [x, y, 1.6],
        ]);
    for (let z = -1.96; z <= 1.6; z += 0.2)
      for (const y of [-0.36, -0.23])
        lines.push([
          [-2.72, y, z],
          [4.17, y, z],
        ]);
    for (const {
      position: [x, , z],
    } of bases)
      for (const dx of [-0.045, 0.045])
        for (const dz of [-0.045, 0.045])
          lines.push([
            [x + dx, -0.5, z + dz],
            [x + dx, 0.44, z + dz],
          ]);
    const shoring: Array<{ position: V3; size: V3 }> = [];
    for (let x = -3.18; x < 4.6; x += 0.24)
      for (const z of [-2.63, 2.23])
        shoring.push({ position: [x, -0.37, z], size: [0.2, 0.55, 0.035] });
    for (let z = -2.5; z < 2.2; z += 0.24)
      for (const x of [-3.18, 4.58])
        shoring.push({ position: [x, -0.37, z], size: [0.035, 0.55, 0.2] });
    const ties: Array<[V3, V3]> = [];
    for (const z of [-2.7, 2.3])
      ties.push([
        [-3.25, 0.045, z],
        [4.7, 0.045, z],
      ]);
    for (const x of [-3.25, 4.7])
      ties.push([
        [x, 0.045, -2.7],
        [x, 0.045, 2.3],
      ]);
    return {
      bases: mergedBoxes(bases),
      bars: rods(lines, 0.004),
      shoring: mergedBoxes(shoring),
      strings: rods(ties, 0.002),
    };
  }, []);
  useEffect(() => () => Object.values(geometries).forEach((g) => g.dispose()), [geometries]);
  useFrame(() => {
    const p = reducedMotion ? 1 : progress.current.value;
    const dig = ramp(p, 0.12, 0.18);
    const fill = ramp(p, 0.218, 0.255);
    const top = THREE.MathUtils.lerp(-0.1, -0.65, dig);
    if (soil.current) {
      const height = top + 0.72;
      soil.current.scale.y = height;
      soil.current.position.y = -0.72 + height / 2;
    }
    if (footings.current) footings.current.visible = p >= 0.18;
    if (reinforcement.current) reinforcement.current.visible = p > 0.195 && p < 0.26;
    if (raft.current) {
      raft.current.visible = fill > 0.001;
      raft.current.scale.y = fill;
    }
    if (survey.current) survey.current.visible = p > 0.045 && p < 0.2;
    if (lining.current) lining.current.visible = p > 0.13 && p < 0.85;
  });
  return (
    <>
      <mesh ref={soil} position={[0.7, -0.405, -0.2]} receiveShadow>
        <boxGeometry args={[7.8, 1, 4.9]} />
        <meshStandardMaterial color="#b8a58b" roughness={1} />
      </mesh>
      <mesh position={[0.7, -0.7, -0.2]} receiveShadow>
        <boxGeometry args={[7.8, 0.04, 4.9]} />
        <meshStandardMaterial color="#9e8064" roughness={1} />
      </mesh>
      <group ref={lining}>
        <mesh geometry={geometries.shoring} receiveShadow>
          <meshStandardMaterial color="#817d6d" roughness={0.85} metalness={0.12} />
        </mesh>
        <mesh position={[0.7, -0.12, -2.64]}>
          <boxGeometry args={[7.8, 0.06, 0.06]} />
          <meshStandardMaterial color="#a7a291" />
        </mesh>
        <mesh position={[0.7, -0.12, 2.24]}>
          <boxGeometry args={[7.8, 0.06, 0.06]} />
          <meshStandardMaterial color="#a7a291" />
        </mesh>
      </group>
      <group ref={footings}>
        <mesh geometry={geometries.bases} receiveShadow castShadow>
          <meshStandardMaterial color="#a9aaa0" roughness={0.95} />
        </mesh>
      </group>
      <group ref={reinforcement}>
        <mesh geometry={geometries.bars}>
          <meshStandardMaterial color="#545d59" metalness={0.3} roughness={0.7} />
        </mesh>
      </group>
      <group ref={raft} position={[0, -0.65, 0]}>
        <mesh position={[-0.4, 0.47, -0.25]} receiveShadow castShadow>
          <boxGeometry args={[5.05, 0.94, 3.8]} />
          <meshStandardMaterial color="#c1bfb0" roughness={0.95} />
        </mesh>
        <mesh position={[3.05, 0.47, -0.5]} receiveShadow castShadow>
          <boxGeometry args={[2.4, 0.94, 3.15]} />
          <meshStandardMaterial color="#b9b9ae" roughness={0.95} />
        </mesh>
      </group>
      <group ref={survey}>
        <mesh geometry={geometries.strings}>
          <meshBasicMaterial color="#cf8a66" />
        </mesh>
        {[-3.25, 4.7].flatMap((x) =>
          [-2.7, 2.3].map((z) => (
            <group key={`${x}-${z}`} position={[x, -0.1, z]}>
              <mesh position={[0, 0.1, 0]}>
                <boxGeometry args={[0.018, 0.2, 0.018]} />
                <meshStandardMaterial color="#b17c4e" />
              </mesh>
              <mesh position={[0, 0.19, 0]} rotation={[0, 0, 0.12]}>
                <boxGeometry args={[0.12, 0.055, 0.008]} />
                <meshStandardMaterial color="#d98762" />
              </mesh>
            </group>
          )),
        )}
      </group>
    </>
  );
}

type SupportSpec = {
  index: number;
  wing: boolean;
  x: number;
  z: number;
  y: number;
  width: number;
  depth: number;
};
/** Props, deck panels and edge protection cycle upwards beneath recently cast floors. */
export function TemporaryWorks({
  progress,
  reducedMotion,
  floors,
}: Props & { floors: readonly SupportSpec[] }) {
  const groups = useRef<Array<THREE.Group | null>>([]);
  const geometries = useMemo(() => {
    return floors.map((spec) => {
      const props: Array<{ position: V3; size: V3 }> = [];
      const braces: Array<[V3, V3]> = [];
      const base = spec.index === 0 ? 0.31 : spec.y - 0.54;
      const top = spec.y - 0.035;
      const step = spec.wing ? 2 : 3;
      for (let x = 0; x < step; x++)
        for (const z of [-1, 1]) {
          const px = spec.x - spec.width * 0.36 + (x * spec.width * 0.72) / (step - 1),
            pz = spec.z + z * spec.depth * 0.32;
          props.push({
            position: [px, (base + top) / 2, pz],
            size: [0.014, Math.max(top - base, 0.03), 0.014],
          });
          props.push({ position: [px, base + 0.009, pz], size: [0.08, 0.018, 0.08] });
          props.push({ position: [px, top - 0.008, pz], size: [0.1, 0.022, 0.09] });
        }
      for (const z of [-1, 1])
        braces.push([
          [spec.x - spec.width * 0.36, base + 0.04, spec.z + z * spec.depth * 0.32],
          [spec.x + spec.width * 0.36, top - 0.03, spec.z + z * spec.depth * 0.32],
        ]);
      const deck = roundedPlate(spec.width + 0.1, spec.depth + 0.14, 0.035, 0.04, [
        {
          x: (spec.wing ? 2.75 : -1.05) - spec.x,
          z: (spec.wing ? -0.55 : -0.3) - spec.z,
          width: 1.12,
          depth: 1,
        },
        {
          x: (spec.wing ? 3.63 : 0.2) - spec.x,
          z: (spec.wing ? -0.87 : -0.62) - spec.z,
          width: 0.54,
          depth: 0.64,
        },
      ]);
      deck.translate(spec.x, spec.y - 0.04, spec.z);
      const rails: Array<[V3, V3]> = [];
      for (const z of [-spec.depth / 2, spec.depth / 2]) {
        for (const dy of [0.24, 0.36])
          rails.push([
            [spec.x - spec.width / 2, spec.y + dy, spec.z + z],
            [spec.x + spec.width / 2, spec.y + dy, spec.z + z],
          ]);
        for (const x of [-spec.width / 2, 0, spec.width / 2])
          rails.push([
            [spec.x + x, spec.y + 0.12, spec.z + z],
            [spec.x + x, spec.y + 0.38, spec.z + z],
          ]);
      }
      for (const x of [-spec.width / 2, spec.width / 2]) {
        for (const dy of [0.24, 0.36])
          rails.push([
            [spec.x + x, spec.y + dy, spec.z - spec.depth / 2],
            [spec.x + x, spec.y + dy, spec.z + spec.depth / 2],
          ]);
        rails.push([
          [spec.x + x, spec.y + 0.12, spec.z],
          [spec.x + x, spec.y + 0.38, spec.z],
        ]);
      }
      return {
        props: mergedBoxes(props),
        braces: rods(braces, 0.006),
        deck,
        rails: rods(rails, 0.006),
      };
    });
  }, [floors]);
  useEffect(
    () => () => geometries.forEach((parts) => Object.values(parts).forEach((g) => g.dispose())),
    [geometries],
  );
  useFrame(() => {
    const p = reducedMotion ? 1 : progress.current.value;
    floors.forEach((spec, i) => {
      const g = groups.current[i];
      if (!g) return;
      const from = floorStructureStart(spec.index, spec.wing) - 0.012;
      const to = Math.min(0.635, floorStructureEnd(spec.index, spec.wing) + 0.06);
      g.visible = spec.index > 0 && p >= from && p < to;
    });
  });
  return (
    <group name="temporary-formwork-and-edge-protection">
      {geometries.map((geo, i) => (
        <group
          key={i}
          ref={(node) => {
            groups.current[i] = node;
          }}
          visible={false}
        >
          <mesh geometry={geo.props}>
            <meshStandardMaterial color="#89928b" metalness={0.3} roughness={0.7} />
          </mesh>
          <mesh geometry={geo.braces}>
            <meshStandardMaterial color="#597c72" metalness={0.15} />
          </mesh>
          <mesh geometry={geo.deck} receiveShadow>
            <meshStandardMaterial color="#cba15f" roughness={0.9} />
          </mesh>
          <mesh geometry={geo.rails}>
            <meshStandardMaterial color="#d4a955" roughness={0.6} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
