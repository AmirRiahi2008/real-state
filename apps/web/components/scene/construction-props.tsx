'use client';

import { type RefObject, useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export interface ConstructionProps {
  progress: RefObject<{ value: number }>;
  groundY?: number;
  reducedMotion?: boolean;
}

type Vector = [number, number, number];
type Part = {
  position: Vector;
  scale: Vector;
  color: string;
  rotation?: Vector;
  shape?: 'box' | 'cylinder';
};

const colors = {
  orange: '#dc8154',
  yellow: '#e6b65e',
  reflective: '#f4e9b3',
  navy: '#455a65',
  skin: '#c59674',
  rubber: '#344644',
  steel: '#82928e',
  glass: '#84b4b8',
  timber: '#b69570',
  chalk: '#eee7d8',
};

function smooth(value: number) {
  const t = THREE.MathUtils.clamp(value, 0, 1);
  return t * t * (3 - 2 * t);
}

function constructionVisibility(progress: number) {
  return 1 - smooth((progress - 0.78) / 0.12);
}

/** Static equipment parts share one merged geometry per material color. */
function MergedParts({ parts }: { parts: readonly Part[] }) {
  const merged = useMemo(() => {
    const byColor = new Map<string, THREE.BufferGeometry[]>();
    const transform = new THREE.Object3D();
    for (const part of parts) {
      const geometry =
        part.shape === 'cylinder'
          ? new THREE.CylinderGeometry(1, 1, 1, 10)
          : new THREE.BoxGeometry(1, 1, 1);
      transform.position.set(...part.position);
      transform.rotation.set(...(part.rotation ?? [0, 0, 0]));
      transform.scale.set(...part.scale);
      transform.updateMatrix();
      geometry.applyMatrix4(transform.matrix);
      const group = byColor.get(part.color) ?? [];
      group.push(geometry);
      byColor.set(part.color, group);
    }
    return Array.from(byColor, ([color, geometries]) => {
      const geometry = mergeGeometries(geometries, false)!;
      geometries.forEach((item) => item.dispose());
      return { color, geometry };
    });
  }, [parts]);
  useEffect(() => () => merged.forEach(({ geometry }) => geometry.dispose()), [merged]);
  return merged.map(({ color, geometry }) => (
    <mesh key={color} geometry={geometry} castShadow receiveShadow>
      <meshStandardMaterial
        color={color}
        roughness={color === colors.glass ? 0.24 : 0.78}
        metalness={color === colors.steel || color === colors.glass ? 0.2 : 0.02}
      />
    </mesh>
  ));
}

const routes = [
  { x: -3.55, z: 2.1, heading: 0.9, distance: 0.45 },
  { x: -4.9, z: 0.1, heading: 0.1, distance: 0.85 },
  { x: 5.05, z: 2.15, heading: -0.9, distance: 0.4 },
  { x: -2.05, z: 4.35, heading: 1.55, distance: 0.9 },
  { x: 3.7, z: 2.5, heading: -1.3, distance: 0.6 },
  { x: -0.4, z: -3.3, heading: 1.7, distance: 0.7 },
] as const;

/** Six small articulated people are rendered with eight instanced body-part meshes. */
export function ConstructionCrew({
  progress,
  groundY = 0,
  reducedMotion = false,
}: ConstructionProps) {
  const group = useRef<THREE.Group>(null);
  const torsos = useRef<THREE.InstancedMesh>(null);
  const heads = useRef<THREE.InstancedMesh>(null);
  const caps = useRef<THREE.InstancedMesh>(null);
  const brims = useRef<THREE.InstancedMesh>(null);
  const legs = useRef<THREE.InstancedMesh>(null);
  const arms = useRef<THREE.InstancedMesh>(null);
  const strips = useRef<THREE.InstancedMesh>(null);
  const boots = useRef<THREE.InstancedMesh>(null);
  const transform = useMemo(() => new THREE.Object3D(), []);
  const worker = useMemo(() => new THREE.Object3D(), []);
  const matrix = useMemo(() => new THREE.Matrix4(), []);

  useEffect(() => {
    [torsos, heads, caps, brims, legs, arms, strips, boots].forEach((ref) =>
      ref.current?.instanceMatrix.setUsage(THREE.DynamicDrawUsage),
    );
    routes.forEach((_, index) => {
      torsos.current?.setColorAt(
        index,
        new THREE.Color(index % 2 === 0 ? colors.orange : colors.yellow),
      );
      heads.current?.setColorAt(
        index,
        new THREE.Color(['#c59674', '#aa7759', '#d7af8b'][index % 3]),
      );
    });
    if (torsos.current?.instanceColor) torsos.current.instanceColor.needsUpdate = true;
    if (heads.current?.instanceColor) heads.current.instanceColor.needsUpdate = true;
  }, []);

  useFrame(({ clock }) => {
    if (!group.current) return;
    const p = reducedMotion ? 1 : progress.current.value;
    const visibility = constructionVisibility(p);
    group.current.visible = visibility > 0.003;
    if (!group.current.visible) return;
    group.current.scale.setScalar(Math.max(visibility, 0.001));
    const time = reducedMotion ? 0 : clock.elapsedTime;

    const place = (
      ref: RefObject<THREE.InstancedMesh | null>,
      index: number,
      position: Vector,
      scale: Vector,
      rotation: Vector = [0, 0, 0],
    ) => {
      transform.position.set(...position);
      transform.scale.set(...scale);
      transform.rotation.set(...rotation);
      transform.updateMatrix();
      matrix.multiplyMatrices(worker.matrix, transform.matrix);
      ref.current?.setMatrixAt(index, matrix);
    };

    routes.forEach((route, index) => {
      const working = index % 3 === 0;
      const cycle = time * (working ? 1.15 : 1.7) + index * 1.7;
      const walk = working ? 0 : Math.sin(cycle * 0.28) * route.distance;
      worker.position.set(
        route.x + Math.sin(route.heading) * walk,
        0,
        route.z + Math.cos(route.heading) * walk,
      );
      worker.rotation.set(
        0,
        route.heading + (Math.cos(cycle * 0.28) < 0 && !working ? Math.PI : 0),
        0,
      );
      worker.scale.setScalar(0.86 + (index % 2) * 0.04);
      worker.updateMatrix();

      place(torsos, index, [0, 0.4, 0], [0.17, 0.25, 0.12]);
      place(heads, index, [0, 0.615, 0], [0.083, 0.09, 0.083]);
      place(caps, index, [0, 0.648, 0], [0.11, 0.075, 0.11]);
      place(brims, index, [0, 0.647, 0.005], [0.123, 0.018, 0.123]);
      for (let side = 0; side < 2; side++) {
        const sign = side === 0 ? -1 : 1;
        const stride = working ? Math.sin(cycle) * 0.07 : Math.sin(cycle) * 0.4 * sign;
        place(
          legs,
          index * 2 + side,
          [sign * 0.048, 0.16, 0],
          [0.062, 0.25, 0.066],
          [stride, 0, sign * 0.025],
        );
        place(
          boots,
          index * 2 + side,
          [sign * 0.048, 0.037, 0.025 + Math.sin(stride) * 0.045],
          [0.075, 0.073, 0.12],
        );
        const armAngle = working ? -0.7 + Math.sin(cycle) * 0.23 : -stride * 0.8;
        place(
          arms,
          index * 2 + side,
          [sign * 0.12, 0.41, working ? 0.06 : 0],
          [0.055, 0.22, 0.06],
          [armAngle, 0, sign * 0.1],
        );
        place(strips, index * 3 + side, [sign * 0.052, 0.44, 0.063], [0.018, 0.18, 0.007]);
      }
      place(strips, index * 3 + 2, [0, 0.36, 0.063], [0.176, 0.022, 0.008]);
    });
    [torsos, heads, caps, brims, legs, arms, strips, boots].forEach((ref) => {
      if (ref.current) ref.current.instanceMatrix.needsUpdate = true;
    });
  });

  return (
    <group ref={group} position={[0, groundY, 0]}>
      <instancedMesh
        ref={torsos}
        args={[undefined, undefined, routes.length]}
        frustumCulled={false}
        castShadow
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="white" roughness={0.85} />
      </instancedMesh>
      <instancedMesh ref={heads} args={[undefined, undefined, routes.length]} frustumCulled={false}>
        <sphereGeometry args={[1, 10, 7]} />
        <meshStandardMaterial color="white" roughness={0.85} />
      </instancedMesh>
      <instancedMesh ref={caps} args={[undefined, undefined, routes.length]} frustumCulled={false}>
        <sphereGeometry args={[1, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color={colors.yellow} roughness={0.6} />
      </instancedMesh>
      <instancedMesh ref={brims} args={[undefined, undefined, routes.length]} frustumCulled={false}>
        <cylinderGeometry args={[1, 1, 1, 10]} />
        <meshStandardMaterial color={colors.yellow} roughness={0.6} />
      </instancedMesh>
      <instancedMesh
        ref={legs}
        args={[undefined, undefined, routes.length * 2]}
        frustumCulled={false}
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color={colors.navy} roughness={0.9} />
      </instancedMesh>
      <instancedMesh
        ref={arms}
        args={[undefined, undefined, routes.length * 2]}
        frustumCulled={false}
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color={colors.orange} roughness={0.85} />
      </instancedMesh>
      <instancedMesh
        ref={strips}
        args={[undefined, undefined, routes.length * 3]}
        frustumCulled={false}
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color={colors.reflective} roughness={0.7} />
      </instancedMesh>
      <instancedMesh
        ref={boots}
        args={[undefined, undefined, routes.length * 2]}
        frustumCulled={false}
      >
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color={colors.rubber} roughness={0.95} />
      </instancedMesh>
    </group>
  );
}

const truckParts: Part[] = [
  { position: [-0.2, 0.42, 0], scale: [2.6, 0.16, 0.87], color: colors.steel },
  { position: [-0.6, 0.69, 0], scale: [1.76, 0.18, 0.96], color: colors.orange },
  { position: [-0.6, 0.88, -0.49], scale: [1.8, 0.26, 0.06], color: colors.orange },
  { position: [-0.6, 0.88, 0.49], scale: [1.8, 0.26, 0.06], color: colors.orange },
  { position: [-1.46, 0.87, 0], scale: [0.07, 0.28, 1.03], color: colors.orange },
  { position: [0.78, 0.75, 0], scale: [0.88, 0.72, 0.96], color: colors.yellow },
  { position: [0.8, 1.13, 0], scale: [0.94, 0.07, 1.02], color: colors.chalk },
  { position: [1.23, 0.91, 0], scale: [0.022, 0.32, 0.79], color: colors.glass },
  { position: [0.81, 0.96, 0.488], scale: [0.55, 0.3, 0.018], color: colors.glass },
  { position: [0.81, 0.96, -0.488], scale: [0.55, 0.3, 0.018], color: colors.glass },
  { position: [1.36, 0.62, 0], scale: [0.26, 0.27, 0.92], color: colors.yellow },
  { position: [1.52, 0.47, 0], scale: [0.07, 0.12, 1.02], color: colors.steel },
  { position: [1.5, 0.63, -0.32], scale: [0.035, 0.08, 0.13], color: colors.reflective },
  { position: [1.5, 0.63, 0.32], scale: [0.035, 0.08, 0.13], color: colors.reflective },
  { position: [-0.7, 0.85, 0], scale: [1.35, 0.14, 0.73], color: colors.timber },
  { position: [-0.7, 1.01, 0], scale: [1.25, 0.16, 0.62], color: colors.chalk },
  { position: [-0.7, 1.12, 0], scale: [1.25, 0.07, 0.62], color: colors.chalk },
  ...[-1.05, -0.44, 0.89].flatMap((x) =>
    [-0.54, 0.54].flatMap((z): Part[] => [
      {
        position: [x, 0.26, z],
        scale: [0.245, 0.17, 0.245],
        color: colors.rubber,
        shape: 'cylinder',
        rotation: [Math.PI / 2, 0, 0],
      },
      {
        position: [x, 0.26, z + Math.sign(z) * 0.09],
        scale: [0.11, 0.015, 0.11],
        color: colors.steel,
        shape: 'cylinder',
        rotation: [Math.PI / 2, 0, 0],
      },
    ]),
  ),
];

const excavatorBase: Part[] = [
  { position: [0, 0.17, -0.43], scale: [1.33, 0.28, 0.24], color: colors.rubber },
  { position: [0, 0.17, 0.43], scale: [1.33, 0.28, 0.24], color: colors.rubber },
  { position: [0, 0.36, 0], scale: [0.55, 0.17, 0.55], color: colors.steel, shape: 'cylinder' },
  ...[-0.48, -0.16, 0.16, 0.48].flatMap((x) =>
    [-0.559, 0.559].map((z): Part => ({
      position: [x, 0.18, z],
      scale: [0.095, 0.018, 0.095],
      color: colors.steel,
      shape: 'cylinder',
      rotation: [Math.PI / 2, 0, 0],
    })),
  ),
];
const excavatorUpper: Part[] = [
  { position: [-0.23, 0.56, 0], scale: [0.96, 0.41, 0.9], color: colors.yellow },
  { position: [-0.7, 0.55, 0], scale: [0.15, 0.34, 0.84], color: colors.orange },
  { position: [0.23, 0.9, -0.06], scale: [0.64, 0.64, 0.71], color: colors.glass },
  { position: [0.23, 1.25, -0.06], scale: [0.71, 0.08, 0.8], color: colors.yellow },
  { position: [0.23, 0.58, -0.06], scale: [0.72, 0.1, 0.8], color: colors.yellow },
  ...[-0.11, 0.55].flatMap((x) =>
    [-0.43, 0.31].map((z): Part => ({
      position: [x, 0.91, z],
      scale: [0.045, 0.64, 0.045],
      color: colors.yellow,
    })),
  ),
  {
    position: [-0.38, 0.82, 0.27],
    scale: [0.065, 0.32, 0.065],
    color: colors.rubber,
    shape: 'cylinder',
  },
];
const boomParts: Part[] = [
  { position: [0, 0.61, 0], scale: [0.18, 1.3, 0.18], color: colors.yellow },
  {
    position: [-0.13, 0.48, 0.12],
    scale: [0.035, 0.82, 0.035],
    color: colors.steel,
    shape: 'cylinder',
    rotation: [0, 0, -0.17],
  },
  {
    position: [0, 0.04, 0.12],
    scale: [0.13, 0.06, 0.13],
    color: colors.steel,
    shape: 'cylinder',
    rotation: [Math.PI / 2, 0, 0],
  },
];
const stickParts: Part[] = [
  { position: [0, 0.58, 0], scale: [0.13, 1.19, 0.15], color: colors.yellow },
  {
    position: [0.12, 0.54, 0.09],
    scale: [0.025, 0.75, 0.025],
    color: colors.steel,
    shape: 'cylinder',
    rotation: [0, 0, 0.12],
  },
];
const bucketParts: Part[] = [
  { position: [0.14, 0.07, 0], scale: [0.52, 0.12, 0.56], color: colors.steel },
  { position: [-0.06, 0.21, 0], scale: [0.11, 0.38, 0.56], color: colors.steel },
  { position: [0.14, 0.19, -0.27], scale: [0.52, 0.27, 0.035], color: colors.steel },
  { position: [0.14, 0.19, 0.27], scale: [0.52, 0.27, 0.035], color: colors.steel },
  ...[-0.22, -0.11, 0, 0.11, 0.22].map((z): Part => ({
    position: [0.46, 0.07, z],
    scale: [0.18, 0.08, 0.052],
    color: colors.steel,
    rotation: [0, 0, -0.15],
  })),
];

export function ConstructionEquipment({
  progress,
  groundY = 0,
  reducedMotion = false,
}: ConstructionProps) {
  const group = useRef<THREE.Group>(null);
  const truck = useRef<THREE.Group>(null);
  const upper = useRef<THREE.Group>(null);
  const boom = useRef<THREE.Group>(null);
  const stick = useRef<THREE.Group>(null);
  const bucket = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!group.current) return;
    const p = reducedMotion ? 1 : progress.current.value;
    const visibility = constructionVisibility(p);
    group.current.visible = visibility > 0.003;
    if (!group.current.visible) return;
    group.current.scale.setScalar(Math.max(visibility, 0.001));
    const digging = 1 - smooth((p - 0.36) / 0.16);
    const time = reducedMotion ? 0 : clock.elapsedTime;
    if (truck.current) truck.current.position.x = -7.25 + smooth(p / 0.18) * 1.45;
    if (upper.current) upper.current.rotation.y = -0.6 + Math.sin(time * 0.35) * 0.22 * digging;
    if (boom.current) boom.current.rotation.z = -0.83 + Math.sin(time * 0.8) * 0.18 * digging;
    if (stick.current)
      stick.current.rotation.z = 1.75 + Math.sin(time * 0.8 + 1.2) * 0.27 * digging;
    if (bucket.current)
      bucket.current.rotation.z = -0.8 + Math.sin(time * 0.8 + 2) * 0.22 * digging;
  });
  return (
    <group ref={group} position={[0, groundY, 0]}>
      <group ref={truck} position={[-5.8, 0, 4.35]} rotation={[0, -0.12, 0]}>
        <MergedParts parts={truckParts} />
      </group>
      <group position={[5.2, 0, 3.7]} rotation={[0, -0.55, 0]}>
        <MergedParts parts={excavatorBase} />
        <group ref={upper}>
          <MergedParts parts={excavatorUpper} />
          <group ref={boom} position={[0.56, 0.76, 0.03]} rotation={[0, 0, -0.83]}>
            <MergedParts parts={boomParts} />
            <group ref={stick} position={[0, 1.24, 0]} rotation={[0, 0, 1.75]}>
              <MergedParts parts={stickParts} />
              <group ref={bucket} position={[0, 1.16, 0]} rotation={[0, 0, -0.8]}>
                <MergedParts parts={bucketParts} />
              </group>
            </group>
          </group>
        </group>
      </group>
    </group>
  );
}

const materials: Part[] = [
  ...Array.from({ length: 4 }, (_, i): Part => ({
    position: [-5.5, 0.08 + i * 0.14, 1.15],
    scale: [1.15, 0.13, 0.9],
    color: i % 2 ? colors.timber : colors.chalk,
  })),
  ...Array.from({ length: 7 }, (_, i): Part => ({
    position: [-5.55 + (i % 4) * 0.16, 0.72 + Math.floor(i / 4) * 0.12, 1.15],
    scale: [0.045, 1.32, 0.045],
    color: colors.steel,
    shape: 'cylinder',
    rotation: [Math.PI / 2, 0, 0],
  })),
  ...Array.from({ length: 3 }, (_, i): Part => ({
    position: [5.55, 0.17 + i * 0.24, 0.55],
    scale: [0.14, 1.35, 0.14],
    color: colors.chalk,
    shape: 'cylinder',
    rotation: [0, 0, Math.PI / 2],
  })),
  ...Array.from({ length: 3 }, (_, i): Part => ({
    position: [-3.25 + i * 0.44, 0.12, -3.25],
    scale: [0.37, 0.24, 0.66],
    color: colors.chalk,
  })),
  ...[-6.5, -3.1, 0.3, 3.7, 7.1].flatMap((x): Part[] => [
    { position: [x, 0.38, 5.8], scale: [1.65, 0.34, 0.12], color: colors.orange },
    { position: [x, 0.43, 5.87], scale: [1.65, 0.1, 0.014], color: colors.reflective },
    { position: [x - 0.52, 0.14, 5.8], scale: [0.12, 0.28, 0.49], color: colors.steel },
    { position: [x + 0.52, 0.14, 5.8], scale: [0.12, 0.28, 0.49], color: colors.steel },
  ]),
  ...[-1, 1].map((side): Part => ({
    position: [-4.0 + side * 0.18, 0.33, 2.7],
    scale: [0.025, 0.68, 0.025],
    color: colors.yellow,
    shape: 'cylinder',
    rotation: [0, 0, side * -0.3],
  })),
  {
    position: [-4.0, 0.33, 2.87],
    scale: [0.025, 0.68, 0.025],
    color: colors.yellow,
    shape: 'cylinder',
    rotation: [-0.3, 0, 0],
  },
  { position: [-4.0, 0.72, 2.7], scale: [0.25, 0.13, 0.17], color: colors.navy },
  { position: [-4.0, 0.72, 2.8], scale: [0.06, 0.08, 0.025], color: colors.glass },
  ...[-1, 1].flatMap((side): Part[] => [
    { position: [side * 7.1, 0.17, 2.9], scale: [0.23, 0.04, 0.23], color: colors.rubber },
    {
      position: [side * 7.1, 0.35, 2.9],
      scale: [0.105, 0.34, 0.105],
      color: colors.orange,
      shape: 'cylinder',
    },
    {
      position: [side * 7.1, 0.39, 2.9],
      scale: [0.108, 0.07, 0.108],
      color: colors.reflective,
      shape: 'cylinder',
    },
  ]),
];

export function SiteMaterials({ progress, groundY = 0, reducedMotion = false }: ConstructionProps) {
  const group = useRef<THREE.Group>(null);
  useFrame(() => {
    if (!group.current) return;
    const visibility = constructionVisibility(reducedMotion ? 1 : progress.current.value);
    group.current.visible = visibility > 0.003;
    group.current.scale.setScalar(Math.max(visibility, 0.001));
  });
  return (
    <group ref={group} position={[0, groundY, 0]}>
      <MergedParts parts={materials} />
    </group>
  );
}
