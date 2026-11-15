'use client';

import { type RefObject, useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

type Point = [number, number, number];
type Segment = [Point, Point];
interface TowerCraneProps {
  position: Point;
  height: number;
  progress: RefObject<{ value: number }>;
  reducedMotion: boolean;
  secondary?: boolean;
}
const clamp = THREE.MathUtils.clamp;
const ease = (value: number) => {
  const t = clamp(value, 0, 1);
  return t * t * (3 - 2 * t);
};
const between = (p: number, start: number, end: number) => ease((p - start) / (end - start));

function lattice(segments: Segment[], radius: number) {
  const up = new THREE.Vector3(0, 1, 0);
  const parts = segments.map(([a, b]) => {
    const from = new THREE.Vector3(...a),
      to = new THREE.Vector3(...b);
    const direction = to.clone().sub(from);
    const geometry = new THREE.CylinderGeometry(radius, radius, direction.length(), 5);
    geometry.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(up, direction.normalize()));
    geometry.translate(...from.add(to).multiplyScalar(0.5).toArray());
    return geometry;
  });
  const merged = mergeGeometries(parts)!;
  parts.forEach((part) => part.dispose());
  return merged;
}

/** A coherent rig: every line and lifted object shares the hook's transform. */
export function TowerCrane({
  position,
  height,
  progress,
  reducedMotion,
  secondary = false,
}: TowerCraneProps) {
  const head = useRef<THREE.Group>(null);
  const trolley = useRef<THREE.Group>(null);
  const hook = useRef<THREE.Group>(null);
  const cable = useRef<THREE.Group>(null);
  const payload = useRef<THREE.Group>(null);
  const beacon = useRef<THREE.Mesh>(null);

  const length = secondary ? 5.15 : 6.6;
  const loadScale = secondary ? 0.45 : 1;
  const deliveryReach = secondary
    ? Math.hypot(2.7 - position[0], 0.29 - position[2])
    : Math.hypot(0.3 - position[0], 0.45 - position[2]);
  const deliveryAngle = secondary
    ? -Math.atan2(0.29 - position[2], 2.7 - position[0])
    : -Math.atan2(0.45 - position[2], 0.3 - position[0]);
  const geometry = useMemo(() => {
    const tower: Segment[] = [],
      jib: Segment[] = [],
      ladder: Segment[] = [],
      rails: Segment[] = [];
    const half = 0.19,
      segments = Math.ceil(height / 0.55),
      step = height / segments;
    for (const x of [-half, half])
      for (const z of [-half, half])
        tower.push([
          [x, 0.16, z],
          [x, height, z],
        ]);
    for (let i = 0; i <= segments; i++) {
      const y = 0.16 + (i * (height - 0.16)) / segments;
      for (const z of [-half, half])
        tower.push([
          [-half, y, z],
          [half, y, z],
        ]);
      for (const x of [-half, half])
        tower.push([
          [x, y, -half],
          [x, y, half],
        ]);
      if (i < segments) {
        for (const z of [-half, half])
          tower.push([
            [-half, y, z],
            [half, Math.min(y + step, height), z],
          ]);
        for (const x of [-half, half])
          tower.push([
            [x, y, -half],
            [x, Math.min(y + step, height), half],
          ]);
      }
    }
    for (const x of [-0.08, 0.08])
      ladder.push([
        [x, 0.2, -0.07],
        [x, height, -0.07],
      ]);
    for (let y = 0.25; y < height; y += 0.11)
      ladder.push([
        [-0.08, y, -0.07],
        [0.08, y, -0.07],
      ]);
    for (const z of [-0.18, 0.18]) {
      jib.push([
        [-1.85, 0, z],
        [length, 0, z],
      ]);
      jib.push([
        [-1.85, 0.34, 0],
        [length, 0.34, 0],
      ]);
      rails.push([
        [-1.6, 0.03, z * 1.6],
        [length - 0.1, 0.03, z * 1.6],
      ]);
      rails.push([
        [-1.6, 0.24, z * 1.6],
        [length - 0.1, 0.24, z * 1.6],
      ]);
    }
    for (let x = -1.8; x < length - 0.35; x += 0.42) {
      for (const z of [-0.18, 0.18]) {
        jib.push([
          [x, 0, z],
          [Math.min(x + 0.42, length), 0.34, 0],
        ]);
        jib.push([
          [x, 0.34, 0],
          [Math.min(x + 0.42, length), 0, z],
        ]);
        rails.push([
          [x, 0.03, z * 1.6],
          [x, 0.24, z * 1.6],
        ]);
      }
      jib.push([
        [x, 0, -0.18],
        [x, 0, 0.18],
      ]);
    }
    const rig: Segment[] = [
      [
        [0, 1.12, 0],
        [length - 0.25, 0.34, 0],
      ],
      [
        [0, 1.12, 0],
        [-1.8, 0.34, 0],
      ],
      [
        [0, 0.1, 0],
        [0, 1.12, 0],
      ],
    ];
    const lifting: Segment[] = [];
    for (const x of [-0.61, 0.61])
      for (const z of [-0.35, 0.35])
        lifting.push([
          [0, -0.15, 0],
          [x, -0.86, z],
        ]);
    const tie: Segment[] = [];
    // Fixed ties connect the mast to the already-built structure at safe intervals.
    for (const y of [2.65, 5.3])
      tie.push(
        [
          [0.19, y, 0.15],
          [2.2, y, 3.135],
        ],
        [
          [0.19, y, -0.15],
          [2.2, y, 0.365],
        ],
      );
    const hookCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, -0.05, 0),
      new THREE.Vector3(-0.025, -0.1, 0),
      new THREE.Vector3(-0.015, -0.17, 0),
      new THREE.Vector3(0.05, -0.18, 0),
      new THREE.Vector3(0.075, -0.13, 0),
    ]);
    return {
      tower: lattice(tower, 0.019),
      ladder: lattice(ladder, 0.007),
      jib: lattice(jib, 0.018),
      rail: lattice(rails, 0.006),
      rig: lattice(rig, 0.008),
      slings: lattice(lifting, 0.006),
      ties: lattice(tie, 0.022),
      hook: new THREE.TubeGeometry(hookCurve, 10, 0.014, 5, false),
    };
  }, [height, length]);
  useEffect(() => () => Object.values(geometry).forEach((part) => part.dispose()), [geometry]);
  const ties = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    const p = reducedMotion ? 1 : clamp(progress.current.value, 0, 1);
    const t = reducedMotion ? 0 : clock.elapsedTime;
    const floorCount = secondary ? 5 : 12;
    const structuralStart = secondary ? 0.269 : 0.26;
    const structuralActive = p >= structuralStart && p < structuralStart + floorCount * 0.027;
    const active = structuralActive || (p >= 0.64 && p < 0.82);
    const structural = clamp((p - structuralStart) / 0.027, 0, floorCount - 0.0001);
    const level = Math.floor(structural);
    const cycle = structural - level;
    const facade = p >= 0.64;
    const facadeCycle = (clamp((p - 0.64) / 0.18, 0, 0.9999) * floorCount) % 1;
    const phase = facade ? facadeCycle : cycle;
    const depart = between(p, 0.83, 0.86);
    const swing = between(phase, 0.2, 0.53) - between(phase, 0.84, 1);
    const angle = secondary
      ? THREE.MathUtils.lerp(-2.48, deliveryAngle, swing)
      : THREE.MathUtils.lerp(0.66, deliveryAngle, swing);
    const reach = secondary
      ? THREE.MathUtils.lerp(1.55, deliveryReach, swing)
      : THREE.MathUtils.lerp(2.0, deliveryReach, swing);
    const floor = facade ? Math.floor(clamp((p - 0.64) / 0.18, 0, 0.999) * floorCount) : level;
    const deliveryHookY = 0.32 + floor * 0.66 + 0.13 + 0.15 + 0.91 * loadScale;
    const clear = Math.min(height - 0.8, Math.max(2.9, deliveryHookY + 1.05));
    const lift = between(phase, 0, 0.18),
      lower = between(phase, 0.55, 0.76),
      returnLift = between(phase, 0.82, 0.9);
    let hookY = THREE.MathUtils.lerp(1.23, clear, lift);
    hookY = THREE.MathUtils.lerp(hookY, deliveryHookY, lower);
    hookY = THREE.MathUtils.lerp(hookY, clear, returnLift);
    if (!active) hookY = height - 1.2;
    const parkedAngle = secondary ? -2.8 : 0.48;
    if (head.current)
      head.current.rotation.y = active
        ? THREE.MathUtils.lerp(angle, parkedAngle, depart)
        : parkedAngle;
    if (trolley.current) trolley.current.position.x = active ? reach : 1.35;
    const cableLength = Math.max(0.7, height - 0.02 - hookY);
    if (cable.current) {
      cable.current.scale.y = cableLength;
      cable.current.position.y = -cableLength / 2;
    }
    if (hook.current) {
      hook.current.position.y = -cableLength;
      hook.current.rotation.z = active ? Math.sin(t * 0.6) * 0.008 : 0;
    }
    if (payload.current) payload.current.visible = active && phase < 0.79 && p < 0.825;
    if (beacon.current)
      (beacon.current.material as THREE.MeshStandardMaterial).emissiveIntensity =
        0.6 + Math.sin(t * 2) * 0.2;
    if (ties.current) ties.current.visible = p > 0.59;
  });
  return (
    <group position={position} name={secondary ? 'secondary-tower-crane' : 'main-tower-crane'}>
      <mesh position={[0, 0, 0]} receiveShadow castShadow>
        <boxGeometry args={[1.15, 0.2, 1.15]} />
        <meshStandardMaterial color="#b8b4a7" roughness={0.96} />
      </mesh>
      {/* Steel grillage bears on the pad and joins all four mast feet. */}
      {[-0.19, 0.19].map((z) => (
        <mesh key={`grillage-${z}`} position={[0, 0.13, z]} castShadow>
          <boxGeometry args={[0.76, 0.06, 0.12]} />
          <meshStandardMaterial color="#6d7a70" metalness={0.4} roughness={0.6} />
        </mesh>
      ))}
      {[-0.19, 0.19].flatMap((x) =>
        [-0.19, 0.19].map((z) => (
          <mesh key={`foot-${x}-${z}`} position={[x, 0.165, z]}>
            <boxGeometry args={[0.12, 0.05, 0.12]} />
            <meshStandardMaterial color="#b09c62" metalness={0.4} />
          </mesh>
        )),
      )}
      {[-1, 1].flatMap((x) =>
        [-1, 1].map((z) => (
          <mesh key={`${x}:${z}`} position={[x * 0.3, 0.125, z * 0.19]}>
            <cylinderGeometry args={[0.025, 0.025, 0.16, 8]} />
            <meshStandardMaterial color="#56645c" metalness={0.6} />
          </mesh>
        )),
      )}
      <mesh geometry={geometry.tower} castShadow>
        <meshStandardMaterial color="#dcad50" roughness={0.7} metalness={0.25} />
      </mesh>
      <mesh geometry={geometry.ladder}>
        <meshStandardMaterial color="#dfc783" roughness={0.7} />
      </mesh>
      {!secondary ? (
        <mesh ref={ties} geometry={geometry.ties}>
          <meshStandardMaterial color="#7a8c83" metalness={0.5} />
        </mesh>
      ) : null}
      <group ref={head} position={[0, height, 0]}>
        <mesh>
          <cylinderGeometry args={[0.31, 0.31, 0.16, 16]} />
          <meshStandardMaterial color="#526762" roughness={0.6} metalness={0.45} />
        </mesh>
        <mesh geometry={geometry.jib} castShadow>
          <meshStandardMaterial color="#dfb35c" roughness={0.6} metalness={0.25} />
        </mesh>
        <mesh geometry={geometry.rail}>
          <meshStandardMaterial color="#ead3a0" roughness={0.65} />
        </mesh>
        <mesh geometry={geometry.rig}>
          <meshStandardMaterial color="#65776d" roughness={0.55} metalness={0.55} />
        </mesh>
        <mesh position={[-1.4, -0.2, 0]} castShadow>
          <boxGeometry args={[0.8, 0.46, 0.65]} />
          <meshStandardMaterial color="#8c968e" roughness={0.95} />
        </mesh>
        {[-1.65, -1.4, -1.15].map((x) => (
          <mesh key={x} position={[x, -0.2, 0]}>
            <boxGeometry args={[0.025, 0.47, 0.67]} />
            <meshStandardMaterial color="#b2b4a4" />
          </mesh>
        ))}
        <mesh position={[-0.83, 0.13, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.15, 0.15, 0.48, 10]} />
          <meshStandardMaterial color="#4e625d" metalness={0.55} roughness={0.5} />
        </mesh>
        <mesh position={[0.22, -0.22, 0.34]} castShadow>
          <boxGeometry args={[0.48, 0.47, 0.49]} />
          <meshStandardMaterial color="#c97a52" roughness={0.7} />
        </mesh>
        <mesh position={[0.22, -0.19, 0.59]}>
          <boxGeometry args={[0.32, 0.26, 0.013]} />
          <meshStandardMaterial color="#6b9ca1" metalness={0.25} roughness={0.2} />
        </mesh>
        <mesh position={[0.47, -0.19, 0.34]}>
          <boxGeometry args={[0.012, 0.26, 0.34]} />
          <meshStandardMaterial color="#6b9ca1" metalness={0.25} roughness={0.2} />
        </mesh>
        <mesh position={[0.22, -0.49, 0.34]}>
          <boxGeometry args={[0.61, 0.045, 0.6]} />
          <meshStandardMaterial color="#56685f" />
        </mesh>
        <mesh position={[length - 0.02, 0.4, 0]} ref={beacon}>
          <sphereGeometry args={[0.042, 8, 6]} />
          <meshStandardMaterial color="#e85c41" emissive="#ed5b35" emissiveIntensity={0.8} />
        </mesh>
        <group ref={trolley} position={[1.35, -0.02, 0]}>
          <mesh>
            <boxGeometry args={[0.31, 0.14, 0.43]} />
            <meshStandardMaterial color="#4c625a" roughness={0.6} />
          </mesh>
          {[-0.13, 0.13].flatMap((x) =>
            [-0.22, 0.22].map((z) => (
              <mesh key={`${x}:${z}`} position={[x, 0.06, z]} rotation={[Math.PI / 2, 0, 0]}>
                <cylinderGeometry args={[0.055, 0.055, 0.04, 8]} />
                <meshStandardMaterial color="#263f37" metalness={0.55} />
              </mesh>
            )),
          )}
          <group ref={cable}>
            {[-0.033, 0.033].map((x) => (
              <mesh key={x} position={[x, 0, 0]}>
                <cylinderGeometry args={[0.006, 0.006, 1, 5]} />
                <meshStandardMaterial color="#3d5449" metalness={0.55} roughness={0.45} />
              </mesh>
            ))}
          </group>
          <group ref={hook} position={[0, -1.2, 0]}>
            <group>
              <mesh rotation={[Math.PI / 2, 0, 0]}>
                <cylinderGeometry args={[0.072, 0.072, 0.065, 12]} />
                <meshStandardMaterial color="#b9a34f" metalness={0.45} />
              </mesh>
              {[-0.04, 0.04].map((z) => (
                <mesh key={z} position={[0, 0, z]}>
                  <boxGeometry args={[0.12, 0.16, 0.016]} />
                  <meshStandardMaterial color="#ddab4b" />
                </mesh>
              ))}
            </group>
            <mesh geometry={geometry.hook}>
              <meshStandardMaterial color="#314a40" metalness={0.7} roughness={0.4} />
            </mesh>
            <group ref={payload} scale={loadScale} position={[0, -0.15 * (1 - loadScale), 0]}>
              <mesh geometry={geometry.slings}>
                <meshStandardMaterial color="#4b6054" roughness={0.65} />
              </mesh>
              <mesh position={[0, -0.96, 0]} castShadow>
                <boxGeometry args={[1.22, 0.2, 0.7]} />
                <meshStandardMaterial color={secondary ? '#83948a' : '#b28b62'} roughness={0.9} />
              </mesh>
              {[-0.055, 0, 0.055].map((y) => (
                <mesh key={y} position={[0, -0.95 + y, 0]}>
                  <boxGeometry args={[1.25, 0.015, 0.73]} />
                  <meshStandardMaterial color={secondary ? '#4d6757' : '#d3b18a'} roughness={0.8} />
                </mesh>
              ))}
              {[-0.41, 0.41].map((x) => (
                <mesh key={x} position={[x, -0.955, 0]}>
                  <boxGeometry args={[0.04, 0.215, 0.735]} />
                  <meshStandardMaterial color="#4c6558" roughness={0.8} />
                </mesh>
              ))}
              {[-0.61, 0.61].flatMap((x) =>
                [-0.35, 0.35].map((z) => (
                  <mesh key={`${x}:${z}`} position={[x, -0.855, z]} rotation={[Math.PI / 2, 0, 0]}>
                    <torusGeometry args={[0.025, 0.007, 4, 7]} />
                    <meshStandardMaterial color="#526a5b" metalness={0.6} />
                  </mesh>
                )),
              )}
            </group>
          </group>
        </group>
      </group>
    </group>
  );
}
