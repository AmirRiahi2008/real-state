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
  return 1 - smooth((progress - 0.82) / 0.03);
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
  { x: 5.25, z: 1.7, heading: -0.9, distance: 0.25 },
  { x: -2.05, z: 4.35, heading: 1.55, distance: 0.9 },
  { x: 3.7, z: 3.0, heading: -1.3, distance: 0.3 },
  { x: -0.4, z: -3.3, heading: 1.7, distance: 0.3 },
  { x: 5.45, z: 1.5, heading: -0.2, distance: 0.35 },
  { x: -4.25, z: 3.75, heading: 1.1, distance: 0.35 },
  { x: 1.9, z: 4.1, heading: -1.25, distance: 0.3 },
  { x: 4.9, z: -2.3, heading: -0.3, distance: 0.2 },
  { x: -5.2, z: -1.0, heading: 0.3, distance: 0.2 },
  { x: 0.15, z: 3.4, heading: 0.8, distance: 0.4 },
] as const;

/** Twelve correctly scaled people share eight instanced body-part meshes. */
export function ConstructionCrew({
  progress,
  groundY = -0.1,
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
      const cycle = time * (working ? 1.15 : 1.7) + index * 1.7 + p * 10;
      const walk = working ? 0 : Math.sin(cycle * 0.28) * route.distance;
      worker.position.set(
        route.x + Math.sin(route.heading) * walk + smooth((p - 0.84) / 0.08) * (index % 2 ? -2 : 2),
        0,
        route.z + Math.cos(route.heading) * walk + smooth((p - 0.84) / 0.08) * 3,
      );
      worker.rotation.set(
        0,
        route.heading + (Math.cos(cycle * 0.28) < 0 && !working ? Math.PI : 0),
        0,
      );
      worker.scale.setScalar(0.575 + (index % 3) * 0.012);
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
        const armAngle = working
          ? (index % 2 ? -1.1 : -0.65) + Math.sin(cycle) * 0.16 * (side ? 1 : 0.4)
          : -stride * 0.8;
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
    position: [0, 0.61, 0.1],
    scale: [0.024, 1.05, 0.024],
    color: colors.rubber,
    shape: 'cylinder',
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
    position: [0.04, 0.54, 0.09],
    scale: [0.018, 0.9, 0.018],
    color: colors.rubber,
    shape: 'cylinder',
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

const chassisParts = truckParts.filter((_, index) => index === 0 || (index >= 5 && index <= 13));
const tipperParts: Part[] = [
  { position: [0.85, 0.04, 0], scale: [1.8, 0.12, 0.96], color: colors.orange },
  { position: [0.85, 0.24, -0.49], scale: [1.8, 0.34, 0.055], color: colors.orange },
  { position: [0.85, 0.24, 0.49], scale: [1.8, 0.34, 0.055], color: colors.orange },
  { position: [1.72, 0.24, 0], scale: [0.055, 0.34, 1], color: colors.orange },
  ...Array.from({ length: 8 }, (_, i): Part => ({
    position: [0.08 + i * 0.22, 0.22, -0.53],
    scale: [0.024, 0.35, 0.024],
    color: colors.yellow,
  })),
  ...Array.from({ length: 8 }, (_, i): Part => ({
    position: [0.08 + i * 0.22, 0.22, 0.53],
    scale: [0.024, 0.35, 0.024],
    color: colors.yellow,
  })),
];
const loadSoil: Part[] = Array.from({ length: 32 }, (_, i): Part => ({
  position: [
    0.2 + (i % 8) * 0.18,
    0.13 + Math.floor(i / 8) * 0.035,
    -0.34 + Math.floor(i / 8) * 0.22,
  ],
  scale: [0.2, 0.15, 0.24],
  rotation: [0, i * 0.7, 0.1],
  color: i % 2 ? '#b89c77' : '#a58b66',
}));

function TruckWheels({ bind }: { bind: (node: THREE.Group | null) => void }) {
  return (
    <group ref={bind}>
      {[-1.05, -0.44, 0.89].flatMap((x) =>
        [-0.54, 0.54].map((z) => (
          <group key={`${x}:${z}`} position={[x, 0.26, z]}>
            <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
              <cylinderGeometry args={[0.245, 0.245, 0.18, 14]} />
              <meshStandardMaterial color={colors.rubber} roughness={0.96} />
            </mesh>
            <mesh position={[0, 0, Math.sign(z) * 0.095]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.13, 0.13, 0.018, 12]} />
              <meshStandardMaterial color={colors.steel} metalness={0.45} roughness={0.55} />
            </mesh>
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <mesh
                key={i}
                position={[
                  Math.sin((i * Math.PI) / 3) * 0.085,
                  Math.cos((i * Math.PI) / 3) * 0.085,
                  Math.sign(z) * 0.108,
                ]}
              >
                <sphereGeometry args={[0.014, 5, 4]} />
                <meshStandardMaterial color={colors.chalk} metalness={0.5} />
              </mesh>
            ))}
          </group>
        )),
      )}
    </group>
  );
}

/** The barrel is fixed-length; only the exposed piston changes as real joint anchors move. */
function HydraulicRam({
  parent,
  attachment,
  start,
  end,
  barrelLength = 0.45,
}: {
  parent: RefObject<THREE.Group | null>;
  attachment: RefObject<THREE.Group | null>;
  start: Vector;
  end: Vector;
  barrelLength?: number;
}) {
  const body = useRef<THREE.Mesh>(null),
    rod = useRef<THREE.Mesh>(null);
  const points = useMemo(
    () => ({
      start: new THREE.Vector3(),
      end: new THREE.Vector3(),
      direction: new THREE.Vector3(),
      center: new THREE.Vector3(),
      up: new THREE.Vector3(0, 1, 0),
      rotation: new THREE.Quaternion(),
    }),
    [],
  );
  useFrame(() => {
    if (!parent.current || !attachment.current || !body.current || !rod.current) return;
    parent.current.updateWorldMatrix(true, false);
    attachment.current.updateWorldMatrix(true, false);
    points.start.set(...start);
    points.end.set(...end);
    attachment.current.localToWorld(points.end);
    parent.current.worldToLocal(points.end);
    points.direction.copy(points.end).sub(points.start);
    const distance = points.direction.length();
    points.direction.normalize();
    points.rotation.setFromUnitVectors(points.up, points.direction);
    const barrel = Math.min(barrelLength, distance * 0.8),
      extension = Math.max(0.02, distance - barrel);
    body.current.quaternion.copy(points.rotation);
    body.current.position.copy(points.start).addScaledVector(points.direction, barrel / 2);
    body.current.scale.y = barrel;
    rod.current.quaternion.copy(points.rotation);
    rod.current.position
      .copy(points.start)
      .addScaledVector(points.direction, barrel + extension / 2);
    rod.current.scale.y = extension;
  });
  return (
    <>
      <mesh ref={body} castShadow>
        <cylinderGeometry args={[0.035, 0.035, 1, 8]} />
        <meshStandardMaterial color={colors.yellow} metalness={0.3} roughness={0.6} />
      </mesh>
      <mesh ref={rod}>
        <cylinderGeometry args={[0.018, 0.018, 1, 8]} />
        <meshStandardMaterial color="#c2ccc4" metalness={0.8} roughness={0.22} />
      </mesh>
    </>
  );
}

function PumpTruck({ progress, reducedMotion = false }: ConstructionProps) {
  const root = useRef<THREE.Group>(null),
    arm = useRef<THREE.Group>(null),
    forearm = useRef<THREE.Group>(null),
    hose = useRef<THREE.Mesh>(null);
  const tip = useMemo(() => new THREE.Vector3(), []);
  const parts = useMemo<Part[]>(
    () => [
      { position: [0, 0.22, 0], scale: [1.8, 0.15, 0.6], color: colors.steel },
      { position: [0.64, 0.43, 0], scale: [0.5, 0.39, 0.58], color: colors.chalk },
      { position: [0.88, 0.5, 0], scale: [0.014, 0.2, 0.46], color: colors.glass },
      { position: [0.64, 0.51, 0.296], scale: [0.33, 0.18, 0.012], color: colors.glass },
      { position: [0.64, 0.51, -0.296], scale: [0.33, 0.18, 0.012], color: colors.glass },
      { position: [-0.22, 0.4, 0], scale: [1.18, 0.22, 0.6], color: colors.orange },
      ...[-0.63, 0.61].flatMap((x) =>
        [-0.34, 0.34].map((z): Part => ({
          position: [x, 0.14, z],
          scale: [0.14, 0.12, 0.14],
          shape: 'cylinder',
          rotation: [Math.PI / 2, 0, 0],
          color: colors.rubber,
        })),
      ),
      ...[-0.6, 0.35].flatMap((x) =>
        [-1, 1].flatMap((side): Part[] => [
          { position: [x, 0.18, side * 0.59], scale: [0.09, 0.08, 0.72], color: colors.steel },
          { position: [x, 0.07, side * 0.88], scale: [0.07, 0.21, 0.07], color: colors.yellow },
          { position: [x, 0.018, side * 0.88], scale: [0.25, 0.035, 0.25], color: colors.rubber },
        ]),
      ),
    ],
    [],
  );
  const tube = useMemo(
    () =>
      new THREE.TubeGeometry(
        new THREE.CatmullRomCurve3([
          new THREE.Vector3(0, 0, 0),
          new THREE.Vector3(0.1, -0.35, 0),
          new THREE.Vector3(0.11, -0.75, 0.1),
          new THREE.Vector3(0.08, -0.98, 0.12),
        ]),
        12,
        0.025,
        6,
        false,
      ),
    [],
  );
  useEffect(() => () => tube.dispose(), [tube]);
  useFrame(({ clock }) => {
    if (!root.current) return;
    const p = reducedMotion ? 1 : progress.current.value;
    root.current.visible = p > 0.2 && p < 0.255;
    if (!root.current.visible) return;
    const breathe = Math.sin(clock.elapsedTime * 0.4) * 0.025;
    if (arm.current) arm.current.rotation.z = -0.7 + breathe;
    if (forearm.current) forearm.current.rotation.z = -1.35 - breathe;
    if (forearm.current && hose.current) {
      root.current.updateWorldMatrix(true, true);
      tip.set(0.07, 2.1, 0);
      forearm.current.localToWorld(tip);
      root.current.worldToLocal(tip);
      hose.current.position.copy(tip);
      const concreteTop = -0.65 + 0.94 * smooth((p - 0.218) / 0.037);
      const worldRootY = root.current.matrixWorld.elements[13];
      hose.current.scale.y = Math.max(0.2, (tip.y - (concreteTop + 0.08 - worldRootY)) / 0.98);
    }
  });
  return (
    <group
      ref={root}
      position={[-5.0, 0, -3.95]}
      rotation={[0, -0.72, 0]}
      name="concrete-pump-outriggers"
    >
      <MergedParts parts={parts} />
      <mesh position={[-0.3, 0.58, 0]}>
        <cylinderGeometry args={[0.13, 0.13, 0.35, 10]} />
        <meshStandardMaterial color={colors.steel} />
      </mesh>
      <group ref={arm} position={[-0.3, 0.74, 0]} rotation={[0, 0, -0.7]}>
        <mesh position={[0, 1.1, 0]} castShadow>
          <boxGeometry args={[0.14, 2.2, 0.16]} />
          <meshStandardMaterial color={colors.orange} />
        </mesh>
        <mesh position={[0.09, 1.1, 0]}>
          <cylinderGeometry args={[0.022, 0.022, 2.2, 6]} />
          <meshStandardMaterial color={colors.rubber} />
        </mesh>
        <group ref={forearm} position={[0, 2.2, 0]} rotation={[0, 0, -1.35]}>
          <mesh position={[0, 1.05, 0]} castShadow>
            <boxGeometry args={[0.11, 2.1, 0.12]} />
            <meshStandardMaterial color={colors.orange} />
          </mesh>
          <mesh position={[0.07, 1.05, 0]}>
            <cylinderGeometry args={[0.021, 0.021, 2.1, 6]} />
            <meshStandardMaterial color={colors.rubber} />
          </mesh>
        </group>
      </group>
      <mesh ref={hose} geometry={tube}>
        <meshStandardMaterial color={colors.rubber} roughness={0.95} />
      </mesh>
    </group>
  );
}

export function ConstructionEquipment({
  progress,
  groundY = -0.1,
  reducedMotion = false,
}: ConstructionProps) {
  const group = useRef<THREE.Group>(null),
    truck = useRef<THREE.Group>(null),
    tipper = useRef<THREE.Group>(null),
    tailgate = useRef<THREE.Group>(null),
    cargo = useRef<THREE.Group>(null),
    wheels = useRef<THREE.Group>(null);
  const excavator = useRef<THREE.Group>(null),
    upper = useRef<THREE.Group>(null),
    boom = useRef<THREE.Group>(null),
    stick = useRef<THREE.Group>(null),
    bucket = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!group.current) return;
    const p = reducedMotion ? 1 : progress.current.value;
    group.current.visible = p < 0.92;
    const time = reducedMotion ? 0 : clock.elapsedTime;
    const enter = smooth((p - 0.06) / 0.055),
      leave = smooth((p - 0.245) / 0.065);
    const travel = enter * 2.1 - leave * 4.2;
    if (truck.current) {
      truck.current.position.x = -8.2 + travel;
      truck.current.visible = p < 0.32;
    }
    if (wheels.current)
      wheels.current.children.forEach((wheel) => (wheel.rotation.z = -travel / (0.245 * 0.65)));
    const dump = smooth((p - 0.145) / 0.035) * (1 - smooth((p - 0.205) / 0.035));
    if (tipper.current) tipper.current.rotation.z = dump * 0.5;
    if (tailgate.current) tailgate.current.rotation.z = -dump * 0.8;
    if (cargo.current) cargo.current.visible = p < 0.195;
    const digging = 1 - smooth((p - 0.19) / 0.055);
    const depth = smooth((p - 0.12) / 0.065);
    if (excavator.current) {
      excavator.current.visible = p < 0.28;
      excavator.current.position.x = 5.4 + smooth((p - 0.245) / 0.035) * 3.2;
    }
    if (upper.current) upper.current.rotation.y = -0.2 + Math.sin(time * 0.31) * 0.08 * digging;
    if (boom.current)
      boom.current.rotation.z = -1.04 - depth * 0.53 + Math.sin(time * 0.74) * 0.09 * digging;
    if (stick.current)
      stick.current.rotation.z = -1.48 + Math.sin(time * 0.74 + 1.1) * 0.12 * digging;
    if (bucket.current)
      bucket.current.rotation.z = 2.65 + Math.sin(time * 0.74 + 2) * 0.22 * digging;
  });
  return (
    <group ref={group} position={[0, groundY, 0]}>
      <group
        ref={truck}
        position={[-8.2, -0.00975, 4.35]}
        scale={0.65}
        name="articulated-tipper-truck"
      >
        <MergedParts parts={chassisParts} />
        <TruckWheels
          bind={(node) => {
            wheels.current = node;
          }}
        />
        <group ref={tipper} position={[-1.46, 0.64, 0]}>
          <MergedParts parts={tipperParts} />
          <group ref={cargo}>
            <MergedParts parts={loadSoil} />
          </group>
          <group ref={tailgate} position={[0, 0.42, 0]}>
            <mesh position={[0, -0.17, 0]} castShadow>
              <boxGeometry args={[0.065, 0.34, 1.02]} />
              <meshStandardMaterial color={colors.orange} />
            </mesh>
          </group>
        </group>
        <mesh position={[0.77, 0.84, 0]}>
          <sphereGeometry args={[0.09, 8, 6]} />
          <meshStandardMaterial color={colors.skin} />
        </mesh>
        <mesh position={[0.62, 0.69, 0]}>
          <boxGeometry args={[0.16, 0.22, 0.16]} />
          <meshStandardMaterial color={colors.navy} />
        </mesh>
        <mesh position={[0.82, 0.76, 0]} rotation={[0, 0, Math.PI / 2]}>
          <torusGeometry args={[0.085, 0.012, 5, 10]} />
          <meshStandardMaterial color={colors.rubber} />
        </mesh>
      </group>
      <group
        ref={excavator}
        position={[5.4, -0.0195, 3.0]}
        rotation={[0, 2.55, 0]}
        scale={0.65}
        name="excavator-hydraulic-joints"
      >
        <MergedParts parts={excavatorBase} />
        <group ref={upper}>
          <MergedParts parts={excavatorUpper} />
          <mesh position={[0.23, 0.95, -0.06]}>
            <sphereGeometry args={[0.095, 8, 6]} />
            <meshStandardMaterial color={colors.skin} />
          </mesh>
          <mesh position={[0.22, 0.77, -0.06]}>
            <boxGeometry args={[0.18, 0.25, 0.18]} />
            <meshStandardMaterial color={colors.navy} />
          </mesh>
          <group ref={boom} position={[0.56, 0.76, 0.03]} rotation={[0, 0, -0.75]}>
            <MergedParts parts={boomParts} />
            <group ref={stick} position={[0, 1.24, 0]} rotation={[0, 0, 1.82]}>
              <MergedParts parts={stickParts} />
              <group ref={bucket} position={[0, 1.16, 0]} rotation={[0, 0, -1.02]}>
                <MergedParts parts={bucketParts} />
              </group>
              <HydraulicRam
                parent={stick}
                attachment={bucket}
                start={[0.12, 0.65, 0.13]}
                end={[0.25, 0.19, 0.13]}
                barrelLength={0.32}
              />
            </group>
            <HydraulicRam
              parent={boom}
              attachment={stick}
              start={[-0.1, 0.58, 0.17]}
              end={[0, 0.38, 0.17]}
              barrelLength={0.43}
            />
          </group>
          <HydraulicRam
            parent={upper}
            attachment={boom}
            start={[0.18, 0.55, 0.2]}
            end={[0, 0.8, 0.2]}
            barrelLength={0.5}
          />
        </group>
      </group>
      <PumpTruck progress={progress} reducedMotion={reducedMotion} />
    </group>
  );
}

const siteInfrastructure: Part[] = [
  // A six-metre site office: raised skids, cladding seams, glazing and a real doorway.
  { position: [-7.1, 0.035, -1.9], scale: [1.45, 0.07, 0.76], color: colors.steel },
  { position: [-7.1, 0.34, -1.9], scale: [1.4, 0.56, 0.71], color: '#c5d2c1' },
  { position: [-7.1, 0.64, -1.9], scale: [1.49, 0.055, 0.8], color: colors.chalk },
  ...Array.from({ length: 17 }, (_, i): Part => ({
    position: [-7.75 + i * 0.08, 0.34, -1.537],
    scale: [0.008, 0.54, 0.008],
    color: '#91a48f',
  })),
  { position: [-6.7, 0.31, -1.528], scale: [0.23, 0.48, 0.014], color: colors.navy },
  { position: [-6.7, 0.39, -1.515], scale: [0.17, 0.19, 0.012], color: colors.glass },
  { position: [-6.79, 0.28, -1.51], scale: [0.016, 0.024, 0.02], color: colors.chalk },
  { position: [-7.3, 0.4, -1.524], scale: [0.52, 0.22, 0.02], color: colors.glass },
  { position: [-7.3, 0.4, -1.51], scale: [0.015, 0.24, 0.015], color: colors.chalk },
  { position: [-7.3, 0.4, -1.51], scale: [0.54, 0.018, 0.015], color: colors.chalk },
  { position: [-6.7, 0.035, -1.35], scale: [0.39, 0.07, 0.27], color: colors.steel },
  { position: [-7.5, 0.3, -2.28], scale: [0.28, 0.22, 0.12], color: colors.chalk },
  ...Array.from({ length: 6 }, (_, i): Part => ({
    position: [-7.62 + i * 0.048, 0.3, -2.345],
    scale: [0.012, 0.18, 0.018],
    color: colors.steel,
  })),
  // Portable welfare units have roof vents and separate doors.
  ...[-7.5, -7.05].flatMap((x): Part[] => [
    { position: [x, 0.27, -3.3], scale: [0.32, 0.52, 0.35], color: '#87a8a2' },
    { position: [x, 0.54, -3.3], scale: [0.35, 0.04, 0.38], color: colors.chalk },
    { position: [x, 0.27, -3.116], scale: [0.25, 0.43, 0.012], color: '#76978e' },
    { position: [x + 0.09, 0.27, -3.102], scale: [0.016, 0.018, 0.018], color: colors.chalk },
    { position: [x, 0.47, -3.1], scale: [0.16, 0.035, 0.014], color: colors.navy },
    {
      position: [x, 0.59, -3.34],
      scale: [0.025, 0.1, 0.025],
      shape: 'cylinder',
      color: colors.steel,
    },
  ]),
  // Quiet generator: feet, louvres, acoustic enclosure and exhaust.
  { position: [6.35, 0.18, -1.15], scale: [0.72, 0.3, 0.43], color: colors.navy },
  ...[-0.26, 0.26].map((dx): Part => ({
    position: [6.35 + dx, 0.03, -1.15],
    scale: [0.09, 0.06, 0.5],
    color: colors.rubber,
  })),
  ...Array.from({ length: 10 }, (_, i): Part => ({
    position: [6.06 + i * 0.06, 0.18, -0.925],
    scale: [0.018, 0.19, 0.014],
    color: colors.steel,
  })),
  {
    position: [6.55, 0.41, -1.2],
    scale: [0.025, 0.19, 0.025],
    shape: 'cylinder',
    color: colors.rubber,
  },
  { position: [6.08, 0.23, -0.915], scale: [0.11, 0.08, 0.018], color: colors.glass },
  // Fire point and cabinets are clear of vehicle access.
  { position: [-6.05, 0.21, -1.23], scale: [0.3, 0.38, 0.13], color: '#bc6b4c' },
  { position: [-6.05, 0.45, -1.23], scale: [0.33, 0.08, 0.16], color: colors.chalk },
  ...[-0.075, 0.075].map((dx): Part => ({
    position: [-6.05 + dx, 0.19, -1.14],
    scale: [0.036, 0.23, 0.036],
    shape: 'cylinder',
    color: '#d88d66',
  })),
  // Scaled road barriers: about one metre tall, in short reusable modules.
  ...Array.from({ length: 13 }, (_, i) => -7.4 + i * 1.15).flatMap((x): Part[] => [
    { position: [x, 0.16, 5.8], scale: [0.88, 0.21, 0.065], color: colors.orange },
    { position: [x, 0.18, 5.838], scale: [0.86, 0.055, 0.009], color: colors.reflective },
    { position: [x - 0.28, 0.05, 5.8], scale: [0.065, 0.1, 0.23], color: colors.steel },
    { position: [x + 0.28, 0.05, 5.8], scale: [0.065, 0.1, 0.23], color: colors.steel },
  ]),
  // A survey tripod places the instrument at an adult's eye level.
  ...[-1, 1].map((side): Part => ({
    position: [-4.1 + side * 0.075, 0.15, 2.8],
    scale: [0.012, 0.31, 0.012],
    shape: 'cylinder',
    rotation: [0, 0, side * -0.3],
    color: colors.yellow,
  })),
  {
    position: [-4.1, 0.15, 2.88],
    scale: [0.012, 0.31, 0.012],
    shape: 'cylinder',
    rotation: [-0.3, 0, 0],
    color: colors.yellow,
  },
  { position: [-4.1, 0.35, 2.8], scale: [0.12, 0.06, 0.08], color: colors.navy },
  { position: [-4.1, 0.35, 2.85], scale: [0.025, 0.035, 0.018], color: colors.glass },
  // Cones are below knee-height relative to the crew, with stable rubber bases.
  ...[-7.1, -5.05, 4.8, 6.8].flatMap((x): Part[] => [
    { position: [x, 0.009, 4.75], scale: [0.13, 0.018, 0.13], color: colors.rubber },
    {
      position: [x, 0.085, 4.75],
      scale: [0.046, 0.15, 0.046],
      shape: 'cylinder',
      color: colors.orange,
    },
    {
      position: [x, 0.11, 4.75],
      scale: [0.048, 0.032, 0.048],
      shape: 'cylinder',
      color: colors.reflective,
    },
  ]),
];
const stockParts: Part[] = [
  // Timber bundles rest on dunnage; boards sit directly on one another.
  ...[-0.3, 0.3].map((dx): Part => ({
    position: [-5.65 + dx, 0.035, 1.15],
    scale: [0.08, 0.07, 0.59],
    color: colors.timber,
  })),
  ...Array.from({ length: 7 }, (_, i): Part => ({
    position: [-5.65, 0.089 + i * 0.032, 1.15],
    scale: [0.88, 0.028, 0.51],
    color: i % 2 ? colors.timber : '#d0af87',
  })),
  ...[-0.3, 0.3].map((dx): Part => ({
    position: [-5.65 + dx, 0.18, 1.15],
    scale: [0.025, 0.22, 0.54],
    color: colors.steel,
  })),
  // Parallel steel bars and two ties share the stack's actual top surface.
  ...Array.from({ length: 9 }, (_, i): Part => ({
    position: [-5.87 + (i % 5) * 0.11, 0.305 + Math.floor(i / 5) * 0.035, 1.15],
    scale: [0.017, 1.16, 0.017],
    shape: 'cylinder',
    rotation: [Math.PI / 2, 0, 0],
    color: colors.steel,
  })),
  // Utility pipes use a supported triangular bundle, rather than floating rows.
  ...[-0.085, 0.085].map((dz): Part => ({
    position: [5.85, 0.119, 0.7 + dz],
    scale: [0.075, 1.35, 0.075],
    shape: 'cylinder',
    rotation: [0, 0, Math.PI / 2],
    color: colors.chalk,
  })),
  {
    position: [5.85, 0.249, 0.7],
    scale: [0.075, 1.35, 0.075],
    shape: 'cylinder',
    rotation: [0, 0, Math.PI / 2],
    color: colors.chalk,
  },
  ...[-0.48, 0.48].map((dx): Part => ({
    position: [5.85 + dx, 0.022, 0.7],
    scale: [0.06, 0.044, 0.39],
    color: colors.timber,
  })),
  // Palletised blocks: pallet runners support three stacked courses with offset joints.
  ...Array.from({ length: 3 }, (_, pallet) =>
    [-0.1, 0.1].map((dx): Part => ({
      position: [-2.9 + pallet * 0.73 + dx, 0.025, -3.7],
      scale: [0.055, 0.05, 0.42],
      color: colors.timber,
    })),
  ).flat(),
  ...Array.from({ length: 3 }, (_, pallet) =>
    Array.from({ length: 3 }, (_, row) =>
      Array.from({ length: 6 }, (_, i): Part => ({
        position: [
          -3.1 + pallet * 0.73 + (i % 3) * 0.145 + (row % 2) * 0.015,
          0.095 + row * 0.075,
          -3.83 + Math.floor(i / 3) * 0.25,
        ],
        scale: [0.137, 0.071, 0.23],
        color: row % 2 ? '#d5cebd' : colors.chalk,
      })),
    ).flat(),
  ).flat(),
];
const meshFence: Part[] = [];
for (let x = -7.8; x <= 7.8; x += 0.75) {
  meshFence.push({ position: [x, 0.25, -5.1], scale: [0.025, 0.5, 0.025], color: colors.steel });
  for (let y = 0.08; y < 0.5; y += 0.085)
    meshFence.push({
      position: [x + 0.375, y, -5.1],
      scale: [0.75, 0.005, 0.005],
      color: '#8eab9b',
    });
  for (let dx = 0.1; dx < 0.75; dx += 0.1)
    meshFence.push({
      position: [x + dx, 0.26, -5.1],
      scale: [0.005, 0.46, 0.005],
      color: '#8eab9b',
    });
}
const gateParts: Part[] = [
  { position: [0, 0.25, 0.75], scale: [0.022, 0.49, 1.5], color: '#8ca795' },
  { position: [0.015, 0.47, 0.75], scale: [0.018, 0.025, 1.53], color: colors.steel },
  { position: [0.015, 0.05, 0.75], scale: [0.018, 0.025, 1.53], color: colors.steel },
  ...Array.from({ length: 12 }, (_, i): Part => ({
    position: [0.018, 0.26, 0.07 + i * 0.125],
    scale: [0.018, 0.45, 0.009],
    color: colors.steel,
  })),
];

function WorkLights() {
  const parts = useMemo<Part[]>(
    () =>
      [-6.2, 6.5].flatMap(
        (x) =>
          [
            {
              position: [x, 0.7, 2.35],
              scale: [0.022, 1.4, 0.022],
              shape: 'cylinder',
              color: colors.steel,
            },
            { position: [x, 1.43, 2.35], scale: [0.42, 0.025, 0.025], color: colors.steel },
            ...[-0.15, 0.15].flatMap((dx): Part[] => [
              { position: [x + dx, 1.44, 2.35], scale: [0.13, 0.09, 0.055], color: colors.navy },
              {
                position: [x + dx, 1.44, 2.385],
                scale: [0.11, 0.07, 0.012],
                color: colors.reflective,
              },
            ]),
            ...[-1, 1].map((side): Part => ({
              position: [x + side * 0.13, 0.0175, 2.35],
              scale: [0.3, 0.035, 0.035],
              rotation: [0, side * 0.5, 0],
              color: colors.steel,
            })),
          ] as Part[],
      ),
    [],
  );
  return <MergedParts parts={parts} />;
}

export function SiteMaterials({
  progress,
  groundY = -0.1,
  reducedMotion = false,
}: ConstructionProps) {
  const root = useRef<THREE.Group>(null),
    stock = useRef<THREE.Group>(null),
    fence = useRef<THREE.Group>(null),
    gate = useRef<THREE.Group>(null),
    glass = useRef<THREE.Group>(null);
  const facadeStock = useMemo<Part[]>(
    () => [
      { position: [6.4, 0.025, -3.15], scale: [0.65, 0.05, 0.43], color: colors.timber },
      ...[-0.2, 0.2].map((dx): Part => ({
        position: [6.4 + dx, 0.24, -3.15],
        scale: [0.025, 0.43, 0.025],
        color: colors.steel,
      })),
      ...Array.from({ length: 6 }, (_, i): Part => ({
        position: [6.4, 0.26, -3.32 + i * 0.061],
        scale: [0.56, 0.42, 0.015],
        rotation: [0.07, 0, 0],
        color: colors.glass,
      })),
    ],
    [],
  );
  useFrame(() => {
    const p = reducedMotion ? 1 : progress.current.value;
    if (root.current) root.current.visible = p < 0.94;
    if (stock.current) stock.current.visible = p < 0.74;
    if (glass.current) glass.current.visible = p > 0.6 && p < 0.82;
    if (fence.current) fence.current.visible = p > 0.04 && p < 0.925;
    if (gate.current)
      gate.current.rotation.y =
        -smooth((p - 0.06) / 0.025) * 1.25 +
        smooth((p - 0.22) / 0.04) * 1.25 -
        smooth((p - 0.84) / 0.04) * 1.25;
  });
  return (
    <group ref={root} position={[0, groundY, 0]} name="detailed-site-logistics">
      <MergedParts parts={siteInfrastructure} />
      <group ref={stock}>
        <MergedParts parts={stockParts} />
      </group>
      <group ref={glass}>
        <MergedParts parts={facadeStock} />
      </group>
      <group ref={fence}>
        <MergedParts parts={meshFence} />
        <group ref={gate} position={[-8, 0.005, 3.5]}>
          <MergedParts parts={gateParts} />
        </group>
        {[3.48, 5.02].map((z) => (
          <mesh key={z} position={[-8, 0.26, z]}>
            <boxGeometry args={[0.055, 0.52, 0.055]} />
            <meshStandardMaterial color={colors.steel} />
          </mesh>
        ))}
      </group>
      <WorkLights />
    </group>
  );
}
