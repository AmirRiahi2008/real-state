'use client';

import {
  Component,
  type ReactNode,
  type RefObject,
  memo,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { ConstructionCrew, ConstructionEquipment, SiteMaterials } from './construction-props';

type Progress = { value: number };
type Locale = 'en' | 'ar';
type V3 = [number, number, number];
type FloorSpec = {
  x: number;
  z: number;
  y: number;
  width: number;
  depth: number;
  index: number;
  wing: boolean;
};
type FloorParts = {
  slab: THREE.Group | null;
  frame: THREE.Group | null;
  facade: THREE.Group | null;
  balcony: THREE.Group | null;
};
const clamp = THREE.MathUtils.clamp;
const smooth = (n: number) => {
  const p = clamp(n, 0, 1);
  return p * p * (3 - 2 * p);
};
const interval = (p: number, start: number, end: number) => smooth((p - start) / (end - start));
const colors = {
  chalk: '#eee7d9',
  concrete: '#c9c5b9',
  glass: '#79a3a5',
  steel: '#526367',
  ochre: '#d6a751',
  coral: '#d88763',
  green: '#60836b',
  soil: '#ba9d7c',
};
const floors: FloorSpec[] = [
  ...Array.from({ length: 12 }, (_, index) => ({
    x: -0.4 - Math.max(0, index - 7) * 0.07,
    z: -0.25 - Math.max(0, index - 7) * 0.03,
    y: 0.32 + index * 0.66,
    width: 4.3 - Math.max(0, index - 7) * 0.18,
    depth: 3.05 - Math.max(0, index - 7) * 0.055,
    index,
    wing: false,
  })),
  ...Array.from({ length: 5 }, (_, index) => ({
    x: 3.05,
    z: -0.5,
    y: 0.32 + index * 0.66,
    width: 2.1,
    depth: 2.8,
    index,
    wing: true,
  })),
];

function roundedPlate(width: number, depth: number, thickness: number, radius = 0.2) {
  const x = -width / 2,
    y = -depth / 2,
    r = Math.min(radius, width / 3, depth / 3);
  const s = new THREE.Shape();
  s.moveTo(x + r, y);
  s.lineTo(x + width - r, y);
  s.quadraticCurveTo(x + width, y, x + width, y + r);
  s.lineTo(x + width, y + depth - r);
  s.quadraticCurveTo(x + width, y + depth, x + width - r, y + depth);
  s.lineTo(x + r, y + depth);
  s.quadraticCurveTo(x, y + depth, x, y + depth - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  const geometry = new THREE.ExtrudeGeometry(s, {
    depth: thickness,
    bevelEnabled: false,
    curveSegments: 5,
  });
  geometry.rotateX(-Math.PI / 2);
  return geometry;
}

function mergedBoxes(boxes: Array<{ position: V3; size: V3; rotation?: V3 }>) {
  const parts = boxes.map(({ position, size, rotation }) => {
    const geo = new THREE.BoxGeometry(...size);
    if (rotation)
      geo.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(...rotation)));
    geo.translate(...position);
    return geo;
  });
  const merged = mergeGeometries(parts);
  parts.forEach((geo) => geo.dispose());
  return merged;
}

function rods(lines: Array<[V3, V3]>, radius = 0.018) {
  const up = new THREE.Vector3(0, 1, 0);
  const parts = lines.map(([a, b]) => {
    const start = new THREE.Vector3(...a),
      end = new THREE.Vector3(...b),
      direction = end.clone().sub(start);
    const geo = new THREE.CylinderGeometry(radius, radius, direction.length(), 5);
    geo.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(up, direction.normalize()));
    geo.translate(...start.add(end).multiplyScalar(0.5).toArray());
    return geo;
  });
  const merged = mergeGeometries(parts);
  parts.forEach((geo) => geo.dispose());
  return merged;
}

function Plate({
  width,
  depth,
  thickness,
  position = [0, 0, 0],
  color = colors.chalk,
  radius = 0.2,
  castShadow = true,
}: {
  width: number;
  depth: number;
  thickness: number;
  position?: V3;
  color?: string;
  radius?: number;
  castShadow?: boolean;
}) {
  const geometry = useMemo(
    () => roundedPlate(width, depth, thickness, radius),
    [width, depth, thickness, radius],
  );
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh geometry={geometry} position={position} castShadow={castShadow} receiveShadow>
      <meshStandardMaterial color={color} roughness={0.82} />
    </mesh>
  );
}

function Floor({
  spec,
  bind,
  night,
}: {
  spec: FloorSpec;
  bind: (part: keyof FloorParts, node: THREE.Group | null) => void;
  night: boolean;
}) {
  const shapes = useMemo(() => {
    const w = spec.width,
      d = spec.depth;
    const posts = [-1, 0, 1].flatMap((x) =>
      [-1, 1].map((z) => ({
        position: [x * (w / 2 - 0.15), 0.34, z * (d / 2 - 0.14)] as V3,
        size: [0.13, 0.58, 0.13] as V3,
      })),
    );
    const beams = [
      { position: [0, 0.6, d / 2 - 0.14] as V3, size: [w, 0.1, 0.14] as V3 },
      { position: [0, 0.6, -d / 2 + 0.14] as V3, size: [w, 0.1, 0.14] as V3 },
      { position: [w / 2 - 0.15, 0.6, 0] as V3, size: [0.14, 0.1, d] as V3 },
      { position: [-w / 2 + 0.15, 0.6, 0] as V3, size: [0.14, 0.1, d] as V3 },
    ];
    const glass = mergedBoxes([
      { position: [0, 0.37, d / 2 - 0.03], size: [w - 0.2, 0.47, 0.045] },
      { position: [w / 2 - 0.025, 0.37, 0], size: [0.045, 0.47, d - 0.2] },
      { position: [-w / 2 + 0.025, 0.37, 0], size: [0.045, 0.47, d - 0.2] },
      { position: [0, 0.37, -d / 2 + 0.03], size: [w - 0.2, 0.47, 0.045] },
    ]);
    const mullions = Array.from({ length: spec.wing ? 5 : 8 }, (_, i) => ({
      position: [-w / 2 + 0.12 + i * ((w - 0.24) / (spec.wing ? 4 : 7)), 0.37, d / 2 + 0.005] as V3,
      size: [0.035, 0.51, 0.05] as V3,
    }));
    for (const side of [-1, 1])
      for (let i = 0; i < 5; i++)
        mullions.push({
          position: [side * (w / 2 - 0.01), 0.37, -d / 2 + 0.13 + (i * (d - 0.26)) / 4],
          size: [0.045, 0.51, 0.035],
        });
    const partitions = [
      { position: [0, 0.34, -0.3] as V3, size: [0.1, 0.53, d - 0.4] as V3 },
      { position: [0, 0.34, -d / 2 + 0.35] as V3, size: [w - 0.45, 0.53, 0.12] as V3 },
      ...Array.from({ length: 8 }, (_, i) => ({
        position: [-0.4, 0.11 + i * 0.055, -0.6 + i * 0.13] as V3,
        size: [0.52, 0.05, 0.15] as V3,
      })),
    ];
    return {
      frame: mergedBoxes([...posts, ...beams]),
      glass,
      mullions: mergedBoxes(mullions),
      partitions: mergedBoxes(partitions),
    };
  }, [spec]);
  useEffect(() => () => Object.values(shapes).forEach((shape) => shape.dispose()), [shapes]);
  return (
    <group position={[spec.x, spec.y, spec.z]}>
      <group ref={(node) => bind('slab', node)} visible={false}>
        <Plate
          width={spec.width + 0.22}
          depth={spec.depth + 0.2}
          thickness={0.12}
          radius={0.26}
          color={colors.concrete}
        />
      </group>
      <group ref={(node) => bind('frame', node)} visible={false}>
        <mesh geometry={shapes.frame} castShadow>
          <meshStandardMaterial color={colors.concrete} roughness={0.9} />
        </mesh>
        <mesh geometry={shapes.partitions} castShadow>
          <meshStandardMaterial
            color={spec.index % 4 === 2 ? '#c8c3d2' : '#e5ddd0'}
            roughness={0.9}
          />
        </mesh>
      </group>
      <group ref={(node) => bind('facade', node)} visible={false}>
        <mesh geometry={shapes.glass}>
          <meshStandardMaterial
            color={colors.glass}
            metalness={0.32}
            roughness={0.18}
            emissive={night ? '#c5a06a' : '#7fa6a3'}
            emissiveIntensity={night ? 0.23 : 0.025}
          />
        </mesh>
        <mesh geometry={shapes.mullions}>
          <meshStandardMaterial color={colors.chalk} roughness={0.6} />
        </mesh>
        <Plate
          width={spec.width + 0.23}
          depth={spec.depth + 0.22}
          thickness={0.06}
          position={[0, 0.11, 0]}
          radius={0.28}
          color={colors.chalk}
          castShadow={false}
        />
      </group>
      <group ref={(node) => bind('balcony', node)} visible={false}>
        <Plate
          width={spec.width + 0.32}
          depth={0.79}
          thickness={0.08}
          position={[0, 0.05, spec.depth / 2 + 0.3]}
          radius={0.3}
          color={spec.index === 3 || spec.index === 8 ? colors.coral : colors.chalk}
          castShadow={false}
        />
        <mesh position={[0, 0.31, spec.depth / 2 + 0.64]}>
          <boxGeometry args={[spec.width + 0.1, 0.35, 0.025]} />
          <meshStandardMaterial
            color="#91b5b2"
            metalness={0.2}
            roughness={0.16}
            transparent
            opacity={0.68}
            depthWrite={false}
          />
        </mesh>
        <mesh position={[0, 0.49, spec.depth / 2 + 0.65]}>
          <boxGeometry args={[spec.width + 0.16, 0.025, 0.04]} />
          <meshStandardMaterial color={colors.chalk} roughness={0.4} />
        </mesh>
        {spec.index % 3 === 1 && (
          <group position={[spec.width / 2 - 0.5, 0.17, spec.depth / 2 + 0.3]}>
            <mesh>
              <boxGeometry args={[0.42, 0.18, 0.34]} />
              <meshStandardMaterial color="#b9ab96" />
            </mesh>
            <mesh position={[0, 0.15, 0]}>
              <sphereGeometry args={[0.22, 7, 5]} />
              <meshStandardMaterial color={colors.green} />
            </mesh>
          </group>
        )}
      </group>
    </group>
  );
}

function Foundation({
  progress,
  reducedMotion,
}: {
  progress: RefObject<Progress>;
  reducedMotion: boolean;
}) {
  const footing = useRef<THREE.Group>(null),
    rebar = useRef<THREE.Group>(null),
    pour = useRef<THREE.Group>(null);
  const concrete = useMemo(
    () =>
      mergedBoxes(
        [-1, 0, 1].flatMap((x) =>
          [-1, 1].map((z) => ({
            position: [x * 1.65, 0.065, z * 1.1] as V3,
            size: [0.86, 0.17, 0.8] as V3,
          })),
        ),
      ),
    [],
  );
  const bars = useMemo(() => {
    const lines: Array<[V3, V3]> = [];
    for (const x of [-1.65, 0, 1.65])
      for (const z of [-1.1, 1.1])
        for (const dx of [-0.22, 0.22])
          for (const dz of [-0.22, 0.22])
            lines.push([
              [x + dx, 0.1, z + dz],
              [x + dx, 0.7, z + dz],
            ]);
    for (let i = 0; i < 12; i++)
      lines.push([
        [-2.5, 0.18, -1.7 + i * 0.31],
        [2.5, 0.18, -1.7 + i * 0.31],
      ]);
    for (let i = 0; i < 14; i++)
      lines.push([
        [-2.4 + i * 0.37, 0.19, -1.7],
        [-2.4 + i * 0.37, 0.19, 1.7],
      ]);
    return rods(lines, 0.014);
  }, []);
  useEffect(
    () => () => {
      concrete.dispose();
      bars.dispose();
    },
    [concrete, bars],
  );
  useFrame(() => {
    const p = reducedMotion ? 1 : progress.current.value;
    if (footing.current) {
      const value = interval(p, 0.09, 0.18);
      footing.current.visible = value > 0.001;
      footing.current.scale.y = Math.max(value, 0.001);
    }
    if (rebar.current) rebar.current.visible = p > 0.12 && p < 0.35;
    if (pour.current) {
      const value = interval(p, 0.18, 0.27);
      pour.current.visible = value > 0.001;
      pour.current.scale.y = Math.max(value, 0.001);
    }
  });
  return (
    <group position={[-0.3, 0.02, -0.2]}>
      <mesh position={[0.5, -0.035, 0]} receiveShadow>
        <boxGeometry args={[7.8, 0.1, 5.1]} />
        <meshStandardMaterial color={colors.soil} roughness={1} />
      </mesh>
      <group ref={footing}>
        <mesh geometry={concrete} castShadow receiveShadow>
          <meshStandardMaterial color="#b5b5a9" roughness={0.95} />
        </mesh>
      </group>
      <group ref={rebar}>
        <mesh geometry={bars}>
          <meshStandardMaterial color={colors.steel} roughness={0.7} metalness={0.25} />
        </mesh>
      </group>
      <group ref={pour}>
        <Plate width={5.05} depth={3.8} thickness={0.27} color={colors.concrete} radius={0.15} />
        <Plate
          width={2.4}
          depth={3.15}
          thickness={0.27}
          color={colors.concrete}
          position={[3.35, 0, -0.1]}
          radius={0.15}
        />
      </group>
    </group>
  );
}

function Crane({
  position,
  height,
  progress,
  reducedMotion,
  secondary = false,
}: {
  position: V3;
  height: number;
  progress: RefObject<Progress>;
  reducedMotion: boolean;
  secondary?: boolean;
}) {
  const root = useRef<THREE.Group>(null),
    head = useRef<THREE.Group>(null),
    trolley = useRef<THREE.Group>(null),
    cable = useRef<THREE.Mesh>(null),
    load = useRef<THREE.Group>(null);
  const geometries = useMemo(() => {
    const tower: Array<[V3, V3]> = [],
      jib: Array<[V3, V3]> = [];
    for (const x of [-0.19, 0.19])
      for (const z of [-0.19, 0.19])
        tower.push([
          [x, 0, z],
          [x, height, z],
        ]);
    const segments = Math.ceil(height / 0.55),
      step = height / segments;
    for (let i = 0; i <= segments; i++) {
      const y = i * step;
      tower.push(
        [
          [-0.19, y, -0.19],
          [0.19, y, -0.19],
        ],
        [
          [0.19, y, -0.19],
          [0.19, y, 0.19],
        ],
        [
          [0.19, y, 0.19],
          [-0.19, y, 0.19],
        ],
        [
          [-0.19, y, 0.19],
          [-0.19, y, -0.19],
        ],
      );
      if (i < segments)
        for (const z of [-0.19, 0.19])
          tower.push([
            [-0.19, y, z],
            [0.19, y + step, z],
          ]);
      if (i < segments)
        for (const x of [-0.19, 0.19])
          tower.push([
            [x, y, -0.19],
            [x, y + step, 0.19],
          ]);
    }
    const length = secondary ? 5.1 : 6.6;
    for (const z of [-0.16, 0.16])
      jib.push(
        [
          [-1.65, 0, z],
          [length, 0, z],
        ],
        [
          [-1.65, 0.28, 0],
          [length, 0.28, 0],
        ],
      );
    for (let x = -1.5; x < length; x += 0.5)
      jib.push(
        [
          [x, 0, -0.16],
          [x + 0.5, 0.28, 0],
        ],
        [
          [x, 0, 0.16],
          [x + 0.5, 0.28, 0],
        ],
        [
          [x, 0, -0.16],
          [x, 0, 0.16],
        ],
      );
    const suspension = rods(
      [
        [
          [0, 0.75, 0],
          [length - 0.2, 0.12, 0],
        ],
        [
          [0, 0.75, 0],
          [-1.65, 0.12, 0],
        ],
      ],
      0.009,
    );
    return { tower: rods(tower, 0.022), jib: rods(jib, 0.021), suspension };
  }, [height, secondary]);
  useEffect(
    () => () => Object.values(geometries).forEach((geometry) => geometry.dispose()),
    [geometries],
  );
  useFrame(({ clock }) => {
    const p = reducedMotion ? 1 : progress.current.value;
    const presence = 1 - interval(p, secondary ? 0.79 : 0.84, secondary ? 0.88 : 0.93);
    if (root.current) {
      root.current.visible = presence > 0.002;
      root.current.scale.setScalar(Math.max(presence, 0.001));
    }
    const wave = reducedMotion ? 0 : Math.sin(clock.elapsedTime * 0.23 + (secondary ? 2 : 0));
    if (head.current)
      head.current.rotation.y =
        (secondary ? -2.12 : -0.43) + wave * 0.075 + Math.sin(p * Math.PI * 5) * 0.14;
    const raised = interval(p, 0.26, 0.61) * (secondary ? 3.5 : 7.7);
    const tick = (clamp((p - 0.25) / 0.37, 0, 1) * 12) % 1;
    const cableLength = clamp(
      height - 0.7 - raised - 2.3 * (1 - interval(tick, 0.15, 0.7)),
      0.8,
      height - 1.1,
    );
    if (trolley.current)
      trolley.current.position.x = secondary ? 3.95 + wave * 0.25 : 4.8 + wave * 0.3;
    if (cable.current) {
      cable.current.scale.y = cableLength;
      cable.current.position.y = -cableLength / 2;
    }
    if (load.current) {
      load.current.position.y = -cableLength;
      load.current.rotation.y = wave * 0.07;
      load.current.visible = p > 0.18 && p < 0.77;
    }
  });
  return (
    <group position={position} ref={root}>
      <Plate width={1.2} depth={1.2} thickness={0.21} color="#b4b4a7" radius={0.08} />
      <mesh geometry={geometries.tower}>
        <meshStandardMaterial color={colors.ochre} roughness={0.7} metalness={0.15} />
      </mesh>
      <group position={[0, height, 0]} ref={head}>
        <mesh geometry={geometries.jib}>
          <meshStandardMaterial color={colors.ochre} roughness={0.65} metalness={0.15} />
        </mesh>
        <mesh geometry={geometries.suspension}>
          <meshStandardMaterial color="#60716e" metalness={0.5} roughness={0.5} />
        </mesh>
        <mesh position={[-1.28, -0.17, 0]} castShadow>
          <boxGeometry args={[0.7, 0.45, 0.65]} />
          <meshStandardMaterial color="#9d9e96" roughness={0.9} />
        </mesh>
        <mesh position={[0.22, -0.2, 0.33]} castShadow>
          <boxGeometry args={[0.57, 0.5, 0.5]} />
          <meshStandardMaterial color={colors.coral} roughness={0.65} />
        </mesh>
        <mesh position={[0.26, -0.15, 0.59]}>
          <boxGeometry args={[0.35, 0.25, 0.015]} />
          <meshStandardMaterial color="#4f777e" metalness={0.25} roughness={0.2} />
        </mesh>
        <mesh position={[0, 0.55, 0]}>
          <cylinderGeometry args={[0.035, 0.035, 1.1, 6]} />
          <meshStandardMaterial color={colors.ochre} />
        </mesh>
        <group ref={trolley} position={[4.8, -0.02, 0]}>
          <mesh>
            <boxGeometry args={[0.35, 0.2, 0.42]} />
            <meshStandardMaterial color="#495855" />
          </mesh>
          <mesh ref={cable}>
            <cylinderGeometry args={[0.011, 0.011, 1, 4]} />
            <meshStandardMaterial color="#475955" />
          </mesh>
          <group ref={load} position={[0, -2, 0]}>
            <mesh position={[0, -0.04, 0]}>
              <torusGeometry args={[0.08, 0.018, 5, 10, Math.PI * 1.7]} />
              <meshStandardMaterial color="#394e4a" metalness={0.4} />
            </mesh>
            <mesh position={[0, -0.78, 0]} castShadow>
              <boxGeometry args={[secondary ? 1.25 : 2.65, 0.13, secondary ? 0.85 : 1.8]} />
              <meshStandardMaterial
                color={secondary ? '#ac845b' : colors.concrete}
                roughness={0.9}
              />
            </mesh>
            {[-1, 1].flatMap((x) =>
              [-1, 1].map((z) => (
                <mesh
                  key={`${x}:${z}`}
                  position={[x * 0.44, -0.41, z * 0.28]}
                  rotation={[z * 0.34, 0, x * -0.65]}
                >
                  <cylinderGeometry args={[0.008, 0.008, 0.9, 4]} />
                  <meshStandardMaterial color="#62716c" />
                </mesh>
              )),
            )}
          </group>
        </group>
      </group>
    </group>
  );
}

function Palm({ position, scale = 1 }: { position: V3; scale?: number }) {
  const leaves = useMemo(() => {
    const parts = Array.from({ length: 7 }, (_, index) => {
      const geo = new THREE.SphereGeometry(1, 8, 5);
      geo.scale(0.77, 0.075, 0.19);
      geo.rotateZ(-0.25);
      geo.translate(0.55, 2.05, 0);
      geo.rotateY((index * Math.PI * 2) / 7);
      return geo;
    });
    const merged = mergeGeometries(parts);
    parts.forEach((geo) => geo.dispose());
    return merged;
  }, []);
  useEffect(() => () => leaves.dispose(), [leaves]);
  return (
    <group position={position} scale={scale}>
      <mesh position={[0, 1.02, 0]} castShadow>
        <cylinderGeometry args={[0.07, 0.12, 2.04, 8]} />
        <meshStandardMaterial color="#b29270" roughness={1} />
      </mesh>
      <mesh geometry={leaves} castShadow>
        <meshStandardMaterial color={colors.green} roughness={0.85} />
      </mesh>
    </group>
  );
}

function RoofAndGardens({
  progress,
  reducedMotion,
  night,
}: {
  progress: RefObject<Progress>;
  reducedMotion: boolean;
  night: boolean;
}) {
  const roof = useRef<THREE.Group>(null),
    gardens = useRef<THREE.Group>(null);
  const pergola = useMemo(
    () =>
      mergedBoxes([
        ...[-1, 1].flatMap((x) =>
          [-1, 1].map((z) => ({
            position: [-0.75 + x * 1.15, 8.85, -0.1 + z * 0.9] as V3,
            size: [0.08, 0.88, 0.08] as V3,
          })),
        ),
        ...Array.from({ length: 10 }, (_, i) => ({
          position: [-1.9 + i * 0.25, 9.31, -0.1] as V3,
          size: [0.09, 0.07, 2.1] as V3,
        })),
      ]),
    [],
  );
  useEffect(() => () => pergola.dispose(), [pergola]);
  useFrame(() => {
    const p = reducedMotion ? 1 : progress.current.value;
    if (roof.current) {
      const n = interval(p, 0.78, 0.87);
      roof.current.visible = n > 0.001;
      roof.current.scale.y = Math.max(n, 0.001);
    }
    if (gardens.current) {
      const n = interval(p, 0.81, 0.92);
      gardens.current.visible = n > 0.001;
      gardens.current.scale.setScalar(Math.max(n, 0.001));
    }
  });
  return (
    <>
      <group ref={roof}>
        <Plate
          width={3.95}
          depth={3}
          thickness={0.14}
          color={colors.chalk}
          position={[-0.68, 8.26, -0.35]}
          radius={0.26}
        />
        <mesh geometry={pergola} castShadow>
          <meshStandardMaterial color="#aa977e" roughness={0.85} />
        </mesh>
        <mesh position={[-1.3, 8.58, -1.1]} castShadow>
          <boxGeometry args={[1.4, 0.42, 0.6]} />
          <meshStandardMaterial color="#c9c6d3" roughness={0.7} />
        </mesh>
        <mesh position={[0.15, 8.51, -0.5]} rotation={[-0.12, 0, 0]}>
          <boxGeometry args={[0.72, 0.04, 1.2]} />
          <meshStandardMaterial color="#486476" metalness={0.4} roughness={0.3} />
        </mesh>
        <Plate
          width={2.32}
          depth={3.03}
          thickness={0.14}
          color={colors.chalk}
          position={[3.05, 3.62, -0.5]}
          radius={0.24}
        />
      </group>
      <group ref={gardens}>
        <Plate
          width={15.2}
          depth={11}
          thickness={0.07}
          color="#c6cbb6"
          radius={0.6}
          position={[0, 0.015, -0.3]}
          castShadow={false}
        />
        <Plate
          width={6.1}
          depth={4.7}
          thickness={0.08}
          color="#ded9ca"
          radius={0.35}
          position={[0.8, 0.08, -0.3]}
          castShadow={false}
        />
        <Plate
          width={2.1}
          depth={3.45}
          thickness={0.04}
          color="#aeced0"
          radius={0.2}
          position={[5.4, 0.11, -0.4]}
          castShadow={false}
        />
        <mesh position={[5.4, 0.175, -0.4]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[1.85, 3.15]} />
          <meshStandardMaterial
            color="#6db9bd"
            metalness={0.3}
            roughness={0.16}
            emissive="#5babad"
            emissiveIntensity={night ? 0.3 : 0.03}
          />
        </mesh>
        <Palm position={[-5.5, 0.12, 2.6]} scale={1.35} />
        <Palm position={[6.25, 0.12, 2.7]} scale={1.2} />
        <Palm position={[-4.7, 0.12, -3.9]} scale={1.05} />
        <Palm position={[3.4, 3.77, -0.65]} scale={0.54} />
        {[-4.2, -2.6, 0, 2.4, 4.4].map((x, i) => (
          <group key={x} position={[x, 0.12, 4.2]}>
            <mesh position={[0, 0.16, 0]} castShadow>
              <boxGeometry args={[0.9, 0.32, 0.55]} />
              <meshStandardMaterial color="#b2aa94" />
            </mesh>
            <mesh position={[0, 0.35, 0]} scale={[1.3, 0.8, 0.75]} castShadow>
              <sphereGeometry args={[0.37, 9, 6]} />
              <meshStandardMaterial color={i % 2 ? '#709472' : '#527a5d'} />
            </mesh>
          </group>
        ))}
        {[-4, 4].map((x) => (
          <group key={x} position={[x, 0, 5.15]}>
            <mesh position={[0, 0.65, 0]}>
              <cylinderGeometry args={[0.028, 0.038, 1.3, 6]} />
              <meshStandardMaterial color="#6c7870" metalness={0.2} />
            </mesh>
            <mesh position={[0, 1.31, 0]}>
              <sphereGeometry args={[0.09, 8, 6]} />
              <meshStandardMaterial
                color="#fff0ce"
                emissive="#ffd595"
                emissiveIntensity={night ? 1.5 : 0.15}
              />
            </mesh>
          </group>
        ))}
      </group>
    </>
  );
}

function Surroundings({ night }: { night: boolean }) {
  const skyline = useRef<THREE.InstancedMesh>(null),
    roadMarks = useRef<THREE.InstancedMesh>(null);
  useEffect(() => {
    const matrix = new THREE.Matrix4();
    for (let i = 0; i < 28; i++) {
      const height = 1.5 + ((i * 13) % 17) * 0.34;
      matrix.makeScale(0.9 + (i % 4) * 0.3, height, 1.4 + (i % 3) * 0.5);
      matrix.setPosition(-29 + i * 2.2, height / 2 - 0.1, -23 - (i % 3) * 3);
      skyline.current?.setMatrixAt(i, matrix);
      skyline.current?.setColorAt(
        i,
        new THREE.Color(
          night
            ? ['#24393e', '#293f42', '#31474a'][i % 3]
            : ['#c3d0cd', '#c5cecc', '#b9c9c9'][i % 3],
        ),
      );
    }
    if (skyline.current) {
      skyline.current.instanceMatrix.needsUpdate = true;
      if (skyline.current.instanceColor) skyline.current.instanceColor.needsUpdate = true;
    }
    for (let i = 0; i < 28; i++) {
      matrix.makeTranslation(-23 + i * 1.8, -0.017, 8.2);
      roadMarks.current?.setMatrixAt(i, matrix);
    }
    if (roadMarks.current) roadMarks.current.instanceMatrix.needsUpdate = true;
  }, [night]);
  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.1, 0]} receiveShadow>
        <planeGeometry args={[180, 180]} />
        <meshStandardMaterial color={night ? '#283b37' : '#d5d3c5'} roughness={1} />
      </mesh>
      <mesh position={[0, -0.055, 8.2]} receiveShadow>
        <boxGeometry args={[90, 0.06, 3.4]} />
        <meshStandardMaterial color={night ? '#233231' : '#929d99'} roughness={1} />
      </mesh>
      <mesh position={[0, -0.025, 6.48]}>
        <boxGeometry args={[80, 0.1, 0.13]} />
        <meshStandardMaterial color={night ? '#546158' : '#d9d8cb'} roughness={0.9} />
      </mesh>
      <instancedMesh ref={roadMarks} args={[undefined, undefined, 28]} frustumCulled={false}>
        <boxGeometry args={[0.85, 0.005, 0.055]} />
        <meshBasicMaterial color={night ? '#a4ab8c' : '#dfdfc8'} />
      </instancedMesh>
      <instancedMesh ref={skyline} args={[undefined, undefined, 28]} frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial roughness={1} />
      </instancedMesh>
      <mesh position={[-15, 14, -32]}>
        <sphereGeometry args={[2.1, 24, 16]} />
        <meshBasicMaterial
          color={night ? '#b7c5c3' : '#edc8a0'}
          transparent
          opacity={night ? 0.4 : 0.65}
          fog={false}
        />
      </mesh>
    </>
  );
}

function Blueprint({
  progress,
  reducedMotion,
}: {
  progress: RefObject<Progress>;
  reducedMotion: boolean;
}) {
  const line = useRef<THREE.LineSegments>(null);
  const geometry = useMemo(() => {
    const points: THREE.Vector3[] = [];
    const add = (a: V3, b: V3) => points.push(new THREE.Vector3(...a), new THREE.Vector3(...b));
    for (let level = 0; level <= 12; level++) {
      const y = 0.3 + level * 0.66;
      add([-2.6, y, -1.8], [1.8, y, -1.8]);
      add([1.8, y, -1.8], [1.8, y, 1.45]);
      add([1.8, y, 1.45], [-2.6, y, 1.45]);
      add([-2.6, y, 1.45], [-2.6, y, -1.8]);
    }
    for (const x of [-2.6, 1.8]) for (const z of [-1.8, 1.45]) add([x, 0.3, z], [x, 8.22, z]);
    return new THREE.BufferGeometry().setFromPoints(points);
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useFrame(() => {
    const p = reducedMotion ? 1 : progress.current.value;
    if (line.current) {
      const opacity = (1 - interval(p, 0.16, 0.31)) * 0.32;
      line.current.visible = opacity > 0.002;
      (line.current.material as THREE.LineBasicMaterial).opacity = opacity;
    }
  });
  return (
    <lineSegments ref={line} geometry={geometry}>
      <lineBasicMaterial color="#688f96" transparent opacity={0.32} depthWrite={false} />
    </lineSegments>
  );
}

function Architecture({
  progress,
  reducedMotion,
  night,
  host,
}: {
  progress: RefObject<Progress>;
  reducedMotion: boolean;
  night: boolean;
  host: RefObject<HTMLDivElement | null>;
}) {
  const parts = useRef<FloorParts[]>(
    floors.map(() => ({ slab: null, frame: null, facade: null, balcony: null })),
  );
  const { camera, size } = useThree();
  const target = useMemo(() => new THREE.Vector3(), []);
  const telemetry = useRef({ percent: -1, count: -1, stage: '' });
  useFrame(({ pointer }, delta) => {
    const p = reducedMotion ? 1 : clamp(progress.current.value, 0, 1);
    let built = 0;
    floors.forEach((spec, i) => {
      const group = parts.current[i];
      const start = 0.25 + spec.index * (spec.wing ? 0.039 : 0.026);
      const reveal = interval(p, start, start + 0.047);
      const frame = interval(p, start + 0.012, start + 0.061);
      const facade = interval(
        p,
        0.53 + spec.index * (spec.wing ? 0.034 : 0.018),
        0.585 + spec.index * (spec.wing ? 0.034 : 0.018),
      );
      const balcony = interval(
        p,
        0.555 + spec.index * (spec.wing ? 0.034 : 0.018),
        0.61 + spec.index * (spec.wing ? 0.034 : 0.018),
      );
      if (reveal > 0.01) built++;
      if (group.slab) {
        group.slab.visible = reveal > 0.003;
        group.slab.position.y = (1 - reveal) * 1.5;
        group.slab.scale.y = Math.max(reveal, 0.001);
      }
      if (group.frame) {
        group.frame.visible = frame > 0.003;
        group.frame.scale.y = Math.max(frame, 0.001);
      }
      if (group.facade) {
        group.facade.visible = facade > 0.003;
        group.facade.scale.y = Math.max(facade, 0.001);
      }
      if (group.balcony) {
        group.balcony.visible = balcony > 0.003;
        group.balcony.position.z = (1 - balcony) * 0.9;
        group.balcony.scale.y = Math.max(balcony, 0.001);
      }
    });
    const mobile = size.width < 700;
    const orbit = 0.61 + p * 0.82;
    const radius = mobile ? 22.5 - interval(p, 0.82, 1) * 3 : 18.6 - interval(p, 0.8, 1) * 3.0;
    // Match the caption changes at 28%, 47%, 79% and 92%. Each move
    // starts just before its text transition to keep the structure in clear space.
    const composition = mobile
      ? 0
      : -1.65 +
        3.25 * interval(p, 0.26, 0.3) -
        3.1 * interval(p, 0.45, 0.49) +
        2.85 * interval(p, 0.77, 0.81) -
        2.85 * interval(p, 0.9, 0.94);
    const focus = mobile ? 3.0 : 3.45 + interval(p, 0.38, 0.6) * 0.3;
    const x = Math.sin(orbit) * radius + (reducedMotion ? 0 : pointer.x * 0.25);
    const z = Math.cos(orbit) * radius;
    const y = mobile ? 10.1 : 8.6 + Math.sin(p * Math.PI) * 1.5;
    if (reducedMotion) {
      // Demand rendering must reach the final composition in its first frame.
      camera.position.set(x, y, z);
    } else {
      camera.position.x = THREE.MathUtils.damp(camera.position.x, x, 3.8, delta);
      camera.position.y = THREE.MathUtils.damp(camera.position.y, y, 3.8, delta);
      camera.position.z = THREE.MathUtils.damp(camera.position.z, z, 3.8, delta);
    }
    target.set(composition, focus, 0.1);
    camera.lookAt(target);
    if (camera instanceof THREE.PerspectiveCamera) {
      const fov = mobile ? 46 : 39;
      if (camera.fov !== fov) {
        camera.fov = fov;
        camera.updateProjectionMatrix();
      }
    }
    const percent = Math.round(p * 100);
    const stage = reducedMotion
      ? 'complete'
      : p < 0.08
        ? 'vision'
        : p < 0.15
          ? 'human'
          : p < 0.28
            ? 'foundation'
            : p < 0.78
              ? 'structure'
              : p < 0.9
                ? 'living'
                : 'investment';
    if (host.current) {
      if (telemetry.current.percent !== percent)
        host.current.dataset.buildProgress = String(percent);
      if (telemetry.current.count !== built) host.current.dataset.builtFloors = String(built);
      if (telemetry.current.stage !== stage) host.current.dataset.sceneStage = stage;
      telemetry.current = { percent, count: built, stage };
    }
  });
  return (
    <>
      <Surroundings night={night} />
      <Foundation progress={progress} reducedMotion={reducedMotion} />
      <Blueprint progress={progress} reducedMotion={reducedMotion} />
      {floors.map((spec, i) => (
        <Floor
          key={i}
          spec={spec}
          night={night}
          bind={(part, node) => {
            parts.current[i][part] = node;
          }}
        />
      ))}
      <RoofAndGardens progress={progress} reducedMotion={reducedMotion} night={night} />
      <Crane
        position={[-4.6, 0, -2]}
        height={10.7}
        progress={progress}
        reducedMotion={reducedMotion}
      />
      <Crane
        position={[5.2, 0, -4]}
        height={8.2}
        secondary
        progress={progress}
        reducedMotion={reducedMotion}
      />
      <ConstructionCrew progress={progress} reducedMotion={reducedMotion} />
      <ConstructionEquipment progress={progress} reducedMotion={reducedMotion} />
      <SiteMaterials progress={progress} reducedMotion={reducedMotion} />
    </>
  );
}

function ArchitecturalFallback({ markFailure = true }: { markFailure?: boolean }) {
  const drawing = useRef<SVGSVGElement>(null);
  useEffect(() => {
    // Canvas also mounts its native fallback as children of a working canvas.
    if (!markFailure) return;
    const host = drawing.current?.closest<HTMLElement>('.building-scene');
    if (host) {
      host.dataset.webglFallback = 'true';
      host.dataset.sceneStage = 'fallback';
    }
  }, [markFailure]);
  return (
    <svg
      ref={drawing}
      viewBox="0 0 1000 800"
      width="100%"
      height="100%"
      data-scene-fallback="true"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="oriva-cinematic-fallback" x1="0" x2="1">
          <stop stopColor="#b9ccbd" />
          <stop offset="1" stopColor="#f0e9db" />
        </linearGradient>
      </defs>
      <path fill="#d7ddce" d="M120 590 490 420 900 600 520 780Z" />
      <path fill="#eae2d2" d="M370 160 510 100 680 180 535 250Z" />
      <path fill="#d4ccbf" d="M370 160 535 250 535 660 370 570Z" />
      <path fill="url(#oriva-cinematic-fallback)" d="M535 250 680 180 680 590 535 660Z" />
      {Array.from({ length: 12 }, (_, i) => (
        <path
          key={i}
          d={`M366 ${160 + i * 34} 535 ${249 + i * 34} 686 ${179 + i * 34}`}
          stroke={i === 3 ? '#d89875' : '#eee8da'}
          strokeWidth="10"
          fill="none"
          strokeLinejoin="round"
        />
      ))}
      <path
        d="M210 580V140m-35 35h290m-255-35 240 35m-240 15 230 30M790 610V270m-90 20h180"
        stroke="#c9a25b"
        strokeWidth="9"
        fill="none"
      />
      <path d="M440 177v140m-10 0h20" stroke="#627c78" fill="none" strokeWidth="3" />
    </svg>
  );
}

class SceneBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? <ArchitecturalFallback /> : this.props.children;
  }
}

function BuildingScene({
  locale,
  progress: externalProgress,
}: {
  locale: Locale;
  progress?: RefObject<Progress>;
}) {
  const host = useRef<HTMLDivElement>(null),
    internal = useRef<Progress>({ value: 0 });
  const progress = externalProgress ?? internal;
  const [reducedMotion, setReducedMotion] = useState(false),
    [visible, setVisible] = useState(true),
    [night, setNight] = useState(false),
    [contextLost, setContextLost] = useState(false);
  const cleanupCanvas = useRef<(() => void) | null>(null);
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const change = () => setReducedMotion(query.matches);
    change();
    query.addEventListener('change', change);
    const updateTheme = () => setNight(document.documentElement.dataset.theme === 'dark');
    updateTheme();
    const theme = new MutationObserver(updateTheme);
    theme.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => {
      query.removeEventListener('change', change);
      theme.disconnect();
    };
  }, []);
  useEffect(() => {
    if (!host.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => setVisible(entry?.isIntersecting ?? false),
      { rootMargin: '180px' },
    );
    observer.observe(host.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (externalProgress || reducedMotion) return;
    gsap.registerPlugin(ScrollTrigger);
    const story = document.getElementById('story');
    if (!story) return;
    const context = gsap.context(() => {
      gsap.to(internal.current, {
        value: 1,
        ease: 'none',
        scrollTrigger: {
          trigger: story,
          start: 'top top',
          end: 'bottom bottom',
          scrub: 0.9,
          invalidateOnRefresh: true,
        },
      });
    }, story);
    return () => context.revert();
  }, [externalProgress, reducedMotion]);
  useEffect(() => () => cleanupCanvas.current?.(), []);
  const atmosphere = night ? '#192b30' : '#eaece4';
  return (
    <div
      ref={host}
      className="building-scene"
      data-scene-stage={reducedMotion ? 'complete' : 'vision'}
      data-build-progress={reducedMotion ? 100 : 0}
      data-built-floors={reducedMotion ? 17 : 0}
      data-webgl-fallback={contextLost ? 'true' : undefined}
      role="img"
      aria-label={
        locale === 'ar'
          ? 'مشهد إنشاء معماري ثلاثي الأبعاد: أرض فارغة، أساسات وعمال ورافعات، ثم الهيكل والطوابق والواجهة حتى اكتمال المبنى مع التمرير.'
          : 'A cinematic construction site. Scroll from empty ground through foundations, workers, cranes, structure and glass to a completed building.'
      }
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        touchAction: 'pan-y',
      }}
    >
      <SceneBoundary>
        {contextLost ? (
          <ArchitecturalFallback />
        ) : (
          <Canvas
            frameloop={reducedMotion || !visible ? 'demand' : 'always'}
            camera={{ position: [10.8, 8.6, 15.1], fov: 39, near: 0.1, far: 150 }}
            dpr={[1, 1.5]}
            shadows="soft"
            gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
            fallback={<ArchitecturalFallback markFailure={false} />}
            style={{ width: '100%', height: '100%', touchAction: 'pan-y' }}
            onCreated={({ gl }) => {
              gl.toneMapping = THREE.ACESFilmicToneMapping;
              gl.toneMappingExposure = night ? 1 : 1.06;
              const lost = (event: Event) => {
                event.preventDefault();
                setContextLost(true);
              };
              gl.domElement.addEventListener('webglcontextlost', lost);
              cleanupCanvas.current = () =>
                gl.domElement.removeEventListener('webglcontextlost', lost);
            }}
          >
            <color attach="background" args={[atmosphere]} />
            <fog attach="fog" args={[atmosphere, 31, 85]} />
            <ambientLight intensity={night ? 0.48 : 0.9} color={night ? '#a6c5d6' : '#fff2dc'} />
            <hemisphereLight
              args={[
                night ? '#7296ac' : '#d9e9e4',
                night ? '#27362f' : '#b9a68d',
                night ? 0.9 : 1.25,
              ]}
            />
            <directionalLight
              position={[-10, 17, 9]}
              intensity={night ? 1.15 : 3.1}
              color={night ? '#b6cde0' : '#ffe3bb'}
              castShadow
              shadow-mapSize={[1536, 1536]}
              shadow-camera-left={-13}
              shadow-camera-right={13}
              shadow-camera-top={16}
              shadow-camera-bottom={-10}
              shadow-camera-near={0.5}
              shadow-camera-far={65}
              shadow-bias={-0.0005}
              shadow-normalBias={0.035}
            />
            <directionalLight
              position={[8, 8, -10]}
              intensity={night ? 0.7 : 0.9}
              color="#c3d4eb"
            />
            <Architecture
              progress={progress}
              reducedMotion={reducedMotion}
              night={night}
              host={host}
            />
          </Canvas>
        )}
      </SceneBoundary>
    </div>
  );
}

// The scroll owner updates its visible counter and caption independently.
// Three.js reads the stable progress ref inside its own frame loop.
export default memo(BuildingScene);
