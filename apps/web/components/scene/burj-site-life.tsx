'use client';

import { type RefObject, useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import {
  CRANE_POSITION,
  MIXER_STOP,
  PUMP_POSITION,
  PUMP_BOOM_LENGTHS,
  cranePose,
  mixerPosition,
  pumpPose,
  siteStage as stage,
} from './burj-site-motion';

export interface BurjSiteLifeProps {
  progress: RefObject<{ value: number }>;
  reducedMotion: boolean;
  night: boolean;
}

// Everything, including the people, uses the tower's 1 unit = 10 metres scale.
type V3 = [number, number, number];
type Part = { at: V3; size: V3; color: string; turn?: V3; shape?: 'box' | 'cylinder' | 'sphere' };
type Segment = [V3, V3];
const C = {
  orange: '#d67b35',
  yellow: '#e5b740',
  vest: '#e9bc48',
  white: '#e0e1d8',
  dark: '#25343a',
  steel: '#76858a',
  chrome: '#bac4bf',
  glass: '#608b99',
  skin: '#c89470',
  navy: '#3e5261',
  red: '#b44536',
  lamp: '#fff2c3',
  concrete: '#a9aaa1',
};
const clamp = THREE.MathUtils.clamp;
const box = (at: V3, size: V3, color: string, turn?: V3): Part => ({ at, size, color, turn });
const cylinder = (at: V3, size: V3, color: string, turn?: V3): Part => ({
  at,
  size,
  color,
  turn,
  shape: 'cylinder',
});

function beam(a: V3, b: V3, radius: number, color: string): Part {
  const from = new THREE.Vector3(...a),
    direction = new THREE.Vector3(...b).sub(from);
  const rotation = new THREE.Euler().setFromQuaternion(
    new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      direction.clone().normalize(),
    ),
  );
  return cylinder(
    from.addScaledVector(direction, 0.5).toArray() as V3,
    [radius, direction.length(), radius],
    color,
    [rotation.x, rotation.y, rotation.z],
  );
}

function mergedParts(parts: readonly Part[]) {
  const groups = new Map<string, THREE.BufferGeometry[]>();
  const transform = new THREE.Object3D();
  for (const part of parts) {
    const geometry =
      part.shape === 'cylinder'
        ? new THREE.CylinderGeometry(1, 1, 1, 8)
        : part.shape === 'sphere'
          ? new THREE.SphereGeometry(1, 9, 6)
          : new THREE.BoxGeometry(1, 1, 1);
    transform.position.set(...part.at);
    transform.scale.set(...part.size);
    transform.rotation.set(...(part.turn ?? [0, 0, 0]));
    transform.updateMatrix();
    geometry.applyMatrix4(transform.matrix);
    const group = groups.get(part.color) ?? [];
    group.push(geometry);
    groups.set(part.color, group);
  }
  return Array.from(groups, ([color, pieces]) => {
    const geometry = mergeGeometries(pieces, false)!;
    pieces.forEach((piece) => piece.dispose());
    return { color, geometry };
  });
}

/** Hardware is baked by material; bolts, rails and grilles do not add draw calls. */
function Model({ parts, night = false }: { parts: readonly Part[]; night?: boolean }) {
  const batches = useMemo(() => mergedParts(parts), [parts]);
  useEffect(() => () => batches.forEach(({ geometry }) => geometry.dispose()), [batches]);
  return batches.map(({ color, geometry }) => (
    <mesh key={color} geometry={geometry} castShadow receiveShadow>
      <meshStandardMaterial
        color={color}
        roughness={color === C.glass ? 0.23 : color === C.chrome ? 0.4 : 0.78}
        metalness={color === C.steel || color === C.chrome ? 0.5 : color === C.glass ? 0.25 : 0.06}
        emissive={color === C.lamp ? C.lamp : '#000000'}
        emissiveIntensity={color === C.lamp && night ? 1.8 : 0}
      />
    </mesh>
  ));
}

const WORKERS = [
  { x: 0.1, z: 9.2, heading: -0.2, task: 'surveyor', walk: 0 },
  { x: 2.1, z: 9.65, heading: -1.4, task: 'signaller', walk: 0 },
  { x: 3.5, z: 9.2, heading: 1.55, task: 'walking', walk: 1.0 },
  { x: 4.4, z: 10.0, heading: -1.55, task: 'walking', walk: 0.75 },
  { x: -0.6, z: 9.7, heading: -0.2, task: 'rebar-worker', walk: 0 },
  { x: -2.5, z: 9.15, heading: 1.2, task: 'rebar-worker', walk: 0 },
  { x: 6.7, z: 7.6, heading: 2.4, task: 'walking', walk: 0.8 },
  { x: -7.7, z: 6.7, heading: -0.8, task: 'walking', walk: 0.7 },
  { x: -9.7, z: 3.1, heading: -0.2, task: 'signaller', walk: 0 },
  { x: -10.0, z: 2.8, heading: 2.8, task: 'rebar-worker', walk: 0 },
  { x: -8.8, z: -7.2, heading: 1.4, task: 'walking', walk: 0.8 },
  { x: 8.4, z: -7.4, heading: -1.0, task: 'surveyor', walk: 0 },
  { x: 10.1, z: -4.2, heading: 0.4, task: 'walking', walk: 0.65 },
  { x: 9.8, z: 2.6, heading: -2.3, task: 'rebar-worker', walk: 0 },
  { x: -4.6, z: -9.6, heading: 0.3, task: 'rebar-worker', walk: 0 },
  { x: 1.4, z: -10.2, heading: 1.55, task: 'walking', walk: 0.9 },
] as const;
type BodyKind =
  | 'vest'
  | 'pelvis'
  | 'shirt'
  | 'elbows'
  | 'skin'
  | 'helmet'
  | 'brim'
  | 'trousers'
  | 'joints'
  | 'boots'
  | 'reflector'
  | 'tool';
const BODY_PARTS: {
  id: BodyKind;
  count: number;
  shape: 'box' | 'sphere' | 'cylinder';
  color: string;
}[] = [
  { id: 'vest', count: 16, shape: 'box', color: 'white' },
  { id: 'pelvis', count: 16, shape: 'box', color: C.navy },
  { id: 'shirt', count: 64, shape: 'cylinder', color: C.navy },
  { id: 'elbows', count: 32, shape: 'sphere', color: C.navy },
  { id: 'skin', count: 64, shape: 'sphere', color: 'white' },
  { id: 'helmet', count: 16, shape: 'sphere', color: C.yellow },
  { id: 'brim', count: 16, shape: 'cylinder', color: C.yellow },
  { id: 'trousers', count: 64, shape: 'cylinder', color: C.navy },
  { id: 'joints', count: 64, shape: 'sphere', color: C.navy },
  { id: 'boots', count: 32, shape: 'box', color: C.dark },
  { id: 'reflector', count: 112, shape: 'box', color: C.lamp },
  { id: 'tool', count: 32, shape: 'box', color: C.steel },
];

function ArticulatedCrew({ progress, reducedMotion }: BurjSiteLifeProps) {
  const root = useRef<THREE.Group>(null);
  const instances = useRef<Partial<Record<BodyKind, THREE.InstancedMesh>>>({});
  const pose = useMemo(
    () => ({
      worker: new THREE.Object3D(),
      part: new THREE.Object3D(),
      matrix: new THREE.Matrix4(),
      direction: new THREE.Vector3(),
      up: new THREE.Vector3(0, 1, 0),
    }),
    [],
  );
  useEffect(() => {
    Object.values(instances.current).forEach((mesh) =>
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage),
    );
    WORKERS.forEach((_, i) => {
      instances.current.vest?.setColorAt(i, new THREE.Color(i % 3 ? C.orange : C.vest));
      for (let j = 0; j < 4; j++)
        instances.current.skin?.setColorAt(
          i * 4 + j,
          new THREE.Color(['#c99676', '#aa775a', '#d3aa86', '#805a43'][i % 4]),
        );
    });
    for (const key of ['vest', 'skin'] as const) {
      const colors = instances.current[key]?.instanceColor;
      if (colors) colors.needsUpdate = true;
    }
  }, []);
  useFrame(({ clock }) => {
    if (!root.current) return;
    const p = clamp(progress.current.value, 0, 1);
    root.current.visible = p >= 0.045 && p < 0.89;
    if (!root.current.visible) return;
    const t = reducedMotion ? 0 : clock.elapsedTime;
    const put = (id: BodyKind, index: number, at: V3, size: V3, turn: V3 = [0, 0, 0]) => {
      pose.part.position.set(...at);
      pose.part.scale.set(...size);
      pose.part.rotation.set(...turn);
      pose.part.updateMatrix();
      pose.matrix.multiplyMatrices(pose.worker.matrix, pose.part.matrix);
      instances.current[id]?.setMatrixAt(index, pose.matrix);
    };
    const limb = (id: BodyKind, index: number, a: V3, b: V3, radius: number) => {
      pose.direction.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
      const length = pose.direction.length();
      pose.part.position.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
      pose.part.scale.set(radius, length, radius);
      pose.part.quaternion.setFromUnitVectors(pose.up, pose.direction.normalize());
      pose.part.updateMatrix();
      pose.matrix.multiplyMatrices(pose.worker.matrix, pose.part.matrix);
      instances.current[id]?.setMatrixAt(index, pose.matrix);
    };
    WORKERS.forEach((route, i) => {
      const gait = t * 1.1 + p * 31 + i * 0.37;
      // Long, straight pedestrian corridors; a small pause at each end precedes the turn.
      const routeCycle = (t * 0.085 + p * 3.5 + i * 0.19) % (route.walk * 2 + 0.22 || 1);
      const movingForward = routeCycle <= route.walk + 0.11;
      const travel = route.walk
        ? (movingForward
            ? Math.min(routeCycle, route.walk)
            : route.walk - Math.min(routeCycle - route.walk - 0.11, route.walk)) -
          route.walk / 2
        : 0;
      const walking =
        route.walk > 0 &&
        (movingForward ? routeCycle < route.walk : routeCycle < route.walk * 2 + 0.11);
      pose.worker.position.set(
        route.x + Math.sin(route.heading) * travel,
        0,
        route.z + Math.cos(route.heading) * travel,
      );
      pose.worker.rotation.set(0, route.heading + (movingForward || !route.walk ? 0 : Math.PI), 0);
      pose.worker.scale.setScalar(0.97 + (i % 3) * 0.015);
      pose.worker.updateMatrix();
      const working = route.task === 'rebar-worker';
      const lean = working ? -0.21 - Math.sin(t * 0.6 + i) * 0.035 : 0;
      put('vest', i, [0, 0.12, working ? 0.007 : 0], [0.035, 0.049, 0.022], [lean, 0, 0]);
      put('pelvis', i, [0, 0.092, 0], [0.029, 0.014, 0.02]);
      put('skin', i * 4, [0, 0.155, working ? 0.016 : 0], [0.0102, 0.0121, 0.0093], [lean, 0, 0]);
      put('skin', i * 4 + 1, [0, 0.143, working ? 0.012 : 0], [0.005, 0.008, 0.005]);
      put('helmet', i, [0, 0.171, working ? 0.018 : 0], [0.0125, 0.007, 0.0117], [lean, 0, 0]);
      put('brim', i, [0, 0.167, working ? 0.018 : 0.001], [0.0144, 0.002, 0.014], [lean, 0, 0]);
      for (let side = 0; side < 2; side++) {
        const s = side ? 1 : -1;
        const phase = (((gait + side * 0.5) % 1) + 1) % 1;
        const swing = phase > 0.62 ? (phase - 0.62) / 0.38 : 0;
        const footZ = walking
          ? phase <= 0.62
            ? 0.024 - (phase / 0.62) * 0.048
            : -0.024 + stage(swing, 0, 1) * 0.048
          : s * 0.004;
        const lift = walking ? Math.sin(swing * Math.PI) * 0.019 : 0;
        const hip: V3 = [s * 0.009, 0.091, 0];
        const ankle: V3 = [s * 0.01, 0.01 + lift, footZ];
        // Two-bone IK keeps both ankles attached to their boots and the stance sole on the ground.
        const dy = ankle[1] - hip[1],
          dz = ankle[2] - hip[2],
          distance = Math.hypot(dy, dz);
        const bend = Math.sqrt(Math.max(0, 0.0445 ** 2 - (distance / 2) ** 2));
        const knee: V3 = [
          s * 0.01,
          (hip[1] + ankle[1]) / 2 + (dz / distance) * bend,
          (hip[2] + ankle[2]) / 2 - (dy / distance) * bend,
        ];
        limb('trousers', i * 4 + side * 2, hip, knee, 0.0066);
        limb('trousers', i * 4 + side * 2 + 1, knee, ankle, 0.0054);
        put('joints', i * 4 + side * 2, knee, [0.0067, 0.0067, 0.0067]);
        put('joints', i * 4 + side * 2 + 1, hip, [0.007, 0.007, 0.007]);
        // Toe-off and heel strike rotate around the sole, without bobbing the whole person.
        const toe =
          walking && phase > 0.49 && phase < 0.62
            ? ((phase - 0.49) / 0.13) * 0.18
            : walking && phase < 0.09
              ? -(1 - phase / 0.09) * 0.12
              : 0;
        put(
          'boots',
          i * 2 + side,
          [s * 0.01, 0.006 + lift + Math.abs(toe) * 0.008, footZ + 0.006],
          [0.011, 0.012, 0.025],
          [toe, 0, 0],
        );
        const shoulder: V3 = [s * 0.022, 0.139, working ? 0.01 : 0];
        let elbow: V3 = [s * 0.027, 0.112, walking ? -footZ * 0.65 : 0.004];
        let hand: V3 = [s * 0.028, 0.086, walking ? -footZ * 0.95 + 0.006 : 0.012];
        if (working) {
          elbow = [s * 0.024, 0.113, 0.035];
          hand = [s * 0.013, 0.093, 0.047 + Math.sin(t * 1.7 + i) * 0.002];
        }
        if (route.task === 'surveyor') {
          elbow = [s * 0.028, 0.119, 0.024];
          hand = [s * 0.013, 0.132, 0.037];
        }
        if (route.task === 'signaller') {
          elbow = [s * 0.047, 0.145 + (side ? 0.007 : -0.011), 0.003];
          hand = [s * 0.063, 0.169 + Math.sin(t * 1.5 + i) * 0.008, 0.009];
        }
        limb('shirt', i * 4 + side * 2, shoulder, elbow, 0.0053);
        limb('shirt', i * 4 + side * 2 + 1, elbow, hand, 0.0043);
        put('elbows', i * 2 + side, elbow, [0.0051, 0.0051, 0.0051]);
        put('skin', i * 4 + 2 + side, hand, [0.0045, 0.0055, 0.004]);
        put(
          'reflector',
          i * 7 + side,
          [s * 0.01, 0.125, 0.0125 + (working ? 0.008 : 0)],
          [0.004, 0.036, 0.0015],
          [lean, 0, 0],
        );
        put(
          'reflector',
          i * 7 + 2 + side,
          [s * 0.01, 0.125, -0.0125],
          [0.004, 0.036, 0.0015],
          [lean, 0, 0],
        );
      }
      put(
        'reflector',
        i * 7 + 4,
        [0, 0.109, 0.0125 + (working ? 0.01 : 0)],
        [0.036, 0.004, 0.0016],
      );
      put('reflector', i * 7 + 5, [0, 0.109, -0.0125], [0.036, 0.004, 0.0016]);
      put('reflector', i * 7 + 6, [0, 0.167, 0.013], [0.012, 0.002, 0.001]);
      put('tool', i * 2, [0.024, 0.093, 0], [0.009, 0.017, 0.009]);
      put(
        'tool',
        i * 2 + 1,
        [0, route.task === 'surveyor' ? 0.129 : 0.093, route.task === 'surveyor' ? 0.04 : 0.048],
        route.task === 'surveyor'
          ? [0.037, 0.003, 0.027]
          : working
            ? [0.03, 0.003, 0.003]
            : [0, 0, 0],
      );
    });
    Object.values(instances.current).forEach((mesh) => {
      mesh.instanceMatrix.needsUpdate = true;
    });
  });
  return (
    <group ref={root} name="sixteen-articulated-construction-workers">
      {BODY_PARTS.map(({ id, count, shape, color }) => (
        <instancedMesh
          key={id}
          ref={(mesh) => {
            if (mesh) instances.current[id] = mesh;
          }}
          args={[undefined, undefined, count]}
          castShadow
          frustumCulled={false}
        >
          {shape === 'box' ? (
            <boxGeometry />
          ) : shape === 'sphere' ? (
            <sphereGeometry args={[1, 10, 7]} />
          ) : (
            <cylinderGeometry args={[1, 1, 1, 8]} />
          )}
          <meshStandardMaterial color={color} roughness={id === 'reflector' ? 0.45 : 0.85} />
        </instancedMesh>
      ))}
    </group>
  );
}

function truckBody(color: string): Part[] {
  return [
    box([0, 0.102, 0], [0.91, 0.033, 0.175], C.dark),
    box([0.32, 0.208, 0], [0.24, 0.226, 0.242], color),
    box([0.318, 0.326, 0], [0.25, 0.019, 0.25], C.white),
    box([0.444, 0.258, 0], [0.005, 0.101, 0.207], C.dark),
    box([0.448, 0.259, 0], [0.006, 0.088, 0.19], C.glass),
    ...[-1, 1].flatMap((s) => [
      box([0.323, 0.259, s * 0.123], [0.17, 0.097, 0.005], C.dark),
      box([0.323, 0.26, s * 0.127], [0.156, 0.082, 0.003], C.glass),
      box([0.3, 0.203, s * 0.126], [0.029, 0.006, 0.004], C.chrome),
      box([0.3, 0.117, s * 0.123], [0.151, 0.012, 0.045], C.steel),
      box([0.3, 0.143, s * 0.123], [0.151, 0.009, 0.035], C.steel),
      beam([0.412, 0.273, s * 0.12], [0.432, 0.269, s * 0.158], 0.003, C.dark),
      box([0.435, 0.267, s * 0.158], [0.009, 0.038, 0.02], C.dark),
      box([0.441, 0.267, s * 0.159], [0.003, 0.031, 0.016], C.chrome),
      box([0.456, 0.152, s * 0.083], [0.009, 0.026, 0.039], C.lamp),
      box([-0.456, 0.108, s * 0.089], [0.007, 0.018, 0.031], C.red),
      box([0.18, 0.089, s * 0.105], [0.046, 0.029, 0.014], C.dark),
      box([-0.276, 0.111, s * 0.114], [0.307, 0.014, 0.031], color),
    ]),
    box([0.463, 0.1, 0], [0.027, 0.036, 0.258], C.chrome),
    box([-0.465, 0.09, 0], [0.021, 0.031, 0.253], C.steel),
    box([0.45, 0.196, 0], [0.008, 0.052, 0.106], C.dark),
    ...[0, 1, 2, 3].map((i) => box([0.455, 0.177 + i * 0.012, 0], [0.007, 0.003, 0.1], C.chrome)),
    beam([0.45, 0.222, -0.068], [0.454, 0.25, -0.045], 0.0018, C.dark),
    beam([0.45, 0.222, 0.026], [0.454, 0.25, 0.051], 0.0018, C.dark),
    box([0.14, 0.175, -0.072], [0.062, 0.088, 0.075], C.chrome),
    cylinder([0.14, 0.289, -0.089], [0.012, 0.15, 0.012], C.dark),
    ...[-0.32, -0.17, 0.31].map((x) =>
      cylinder([x, 0.052, 0], [0.01, 0.24, 0.01], C.steel, [Math.PI / 2, 0, 0]),
    ),
  ];
}

const WHEEL_LOCATIONS: V3[] = [-0.32, -0.17, 0.31].flatMap((x) =>
  [-0.118, 0.118].map((z): V3 => [x, 0.052, z]),
);
function RoadWheels({
  distance,
  steer,
}: {
  distance: RefObject<{ value: number }>;
  steer: RefObject<{ value: number }>;
}) {
  const rubber = useRef<THREE.InstancedMesh>(null),
    metal = useRef<THREE.InstancedMesh>(null);
  const object = useMemo(() => new THREE.Object3D(), []);
  const geometries = useMemo(() => {
    const tire = mergedParts([
      cylinder([0, 0, 0], [0.052, 0.033, 0.052], C.dark, [Math.PI / 2, 0, 0]),
      ...Array.from({ length: 22 }, (_, i) => {
        const a = (i / 22) * Math.PI * 2;
        return box([Math.sin(a) * 0.051, Math.cos(a) * 0.051, 0], [0.011, 0.003, 0.034], C.dark, [
          0,
          0,
          -a,
        ]);
      }),
    ])[0].geometry;
    const rim = mergedParts([
      cylinder([0, 0, 0.018], [0.029, 0.003, 0.029], C.steel, [Math.PI / 2, 0, 0]),
      cylinder([0, 0, -0.018], [0.029, 0.003, 0.029], C.steel, [Math.PI / 2, 0, 0]),
      ...Array.from({ length: 8 }, (_, i) => {
        const a = (i / 8) * Math.PI * 2;
        return box(
          [Math.sin(a) * 0.022, Math.cos(a) * 0.022, 0.021],
          [0.003, 0.003, 0.003],
          C.steel,
        );
      }),
    ])[0].geometry;
    return { tire, rim };
  }, []);
  useEffect(
    () => () => Object.values(geometries).forEach((geometry) => geometry.dispose()),
    [geometries],
  );
  useFrame(() => {
    WHEEL_LOCATIONS.forEach((at, i) => {
      object.position.set(...at);
      object.rotation.set(0, i > 3 ? steer.current.value : 0, -distance.current.value / 0.052);
      object.updateMatrix();
      rubber.current?.setMatrixAt(i, object.matrix);
      metal.current?.setMatrixAt(i, object.matrix);
    });
    if (rubber.current) rubber.current.instanceMatrix.needsUpdate = true;
    if (metal.current) metal.current.instanceMatrix.needsUpdate = true;
  });
  return (
    <>
      <instancedMesh
        ref={rubber}
        args={[geometries.tire, undefined, 6]}
        castShadow
        frustumCulled={false}
      >
        <meshStandardMaterial color={C.dark} roughness={0.98} />
      </instancedMesh>
      <instancedMesh ref={metal} args={[geometries.rim, undefined, 6]} frustumCulled={false}>
        <meshStandardMaterial color={C.chrome} roughness={0.5} metalness={0.65} />
      </instancedMesh>
    </>
  );
}

const MIXER = [
  ...truckBody(C.white),
  ...[-0.3, 0.03].map((x) => box([x, 0.152, 0], [0.04, 0.1, 0.204], C.orange)),
  cylinder([-0.427, 0.285, 0], [0.061, 0.058, 0.061], C.steel),
  box([-0.497, 0.2025, 0], [0.167, 0.008, 0.078], C.steel, [0, 0, 0.536]),
  box([-0.497, 0.2145, -0.039], [0.167, 0.03, 0.008], C.steel, [0, 0, 0.536]),
  box([-0.497, 0.2145, 0.039], [0.167, 0.03, 0.008], C.steel, [0, 0, 0.536]),
  ...[-0.107, 0.107].flatMap((z) => [
    beam([-0.41, 0.14, z], [-0.41, 0.3, z], 0.004, C.chrome),
    beam([-0.35, 0.14, z], [-0.35, 0.3, z], 0.004, C.chrome),
    ...[0.17, 0.21, 0.25, 0.29].map((y) => beam([-0.41, y, z], [-0.35, y, z], 0.003, C.chrome)),
  ]),
];

function ConcreteMixer(props: BurjSiteLifeProps) {
  const root = useRef<THREE.Group>(null),
    drum = useRef<THREE.Group>(null);
  const distance = useRef({ value: 0 }),
    steer = useRef({ value: 0 });
  const geometry = useMemo(() => {
    const barrel = new THREE.LatheGeometry(
      [
        new THREE.Vector2(0.033, -0.26),
        new THREE.Vector2(0.082, -0.22),
        new THREE.Vector2(0.122, -0.1),
        new THREE.Vector2(0.124, 0.09),
        new THREE.Vector2(0.1, 0.19),
        new THREE.Vector2(0.061, 0.26),
      ],
      24,
    );
    barrel.rotateZ(-Math.PI / 2);
    const stripePoints: THREE.Vector3[] = [];
    for (let i = 0; i <= 100; i++) {
      const x = -0.2 + i * 0.004,
        a = (i / 100) * Math.PI * 5;
      const radius =
        x < -0.1 ? 0.083 + (x + 0.22) * 0.33 : x > 0.09 ? 0.124 - (x - 0.09) * 0.24 : 0.125;
      stripePoints.push(
        new THREE.Vector3(x, Math.cos(a) * (radius + 0.001), Math.sin(a) * (radius + 0.001)),
      );
    }
    return {
      barrel,
      stripe: new THREE.TubeGeometry(
        new THREE.CatmullRomCurve3(stripePoints),
        100,
        0.006,
        5,
        false,
      ),
    };
  }, []);
  useEffect(() => () => Object.values(geometry).forEach((piece) => piece.dispose()), [geometry]);
  useFrame(({ clock }) => {
    const p = clamp(props.progress.current.value, 0, 1),
      t = props.reducedMotion ? 0 : clock.elapsedTime;
    if (!root.current) return;
    root.current.visible = p > 0.165 && p < 0.745;
    const x = mixerPosition(p);
    root.current.position.set(x, 0, MIXER_STOP[2]);
    distance.current.value = x - 12;
    steer.current.value = 0;
    if (drum.current) drum.current.rotation.x = t * 0.46 + p * Math.PI * 32;
  });
  return (
    <group ref={root} name="nine-metre-six-wheel-concrete-mixer">
      <Model parts={MIXER} night={props.night} />
      <RoadWheels distance={distance} steer={steer} />
      <group position={[-0.135, 0.245, 0]} rotation={[0, 0, 0.08]}>
        <group ref={drum}>
          <mesh geometry={geometry.barrel} castShadow>
            <meshStandardMaterial color={C.white} roughness={0.66} metalness={0.12} />
          </mesh>
          <mesh geometry={geometry.stripe}>
            <meshStandardMaterial color={C.orange} roughness={0.72} />
          </mesh>
        </group>
      </group>
    </group>
  );
}

const TIPPER = truckBody(C.orange);
const TIPPER_BED: Part[] = [
  box([-0.175, 0.0, 0], [0.53, 0.025, 0.242], C.steel),
  box([-0.175, 0.08, -0.122], [0.55, 0.165, 0.014], C.orange),
  box([-0.175, 0.08, 0.122], [0.55, 0.165, 0.014], C.orange),
  box([0.105, 0.08, 0], [0.014, 0.165, 0.25], C.orange),
  box([-0.45, 0.08, 0], [0.014, 0.165, 0.25], C.orange),
  ...[-0.122, 0.122].flatMap((z) =>
    [-0.39, -0.28, -0.17, -0.06, 0.05].map((x) =>
      box([x, 0.08, z * 1.08], [0.009, 0.16, 0.012], C.steel),
    ),
  ),
  box([-0.18, 0.083, 0], [0.51, 0.12, 0.21], '#aa9479'),
];

function Tipper(props: BurjSiteLifeProps) {
  const root = useRef<THREE.Group>(null),
    bed = useRef<THREE.Group>(null),
    ram = useRef<THREE.Mesh>(null);
  const distance = useRef({ value: 0 }),
    steer = useRef({ value: 0 });
  const temp = useMemo(
    () => ({
      direction: new THREE.Vector3(),
      up: new THREE.Vector3(0, 1, 0),
      start: new THREE.Vector3(-0.1, 0.11, 0),
      end: new THREE.Vector3(),
      axis: new THREE.Vector3(0, 0, 1),
      pivot: new THREE.Vector3(-0.45, 0.145, 0),
    }),
    [],
  );
  useFrame(() => {
    if (!root.current) return;
    const p = clamp(props.progress.current.value, 0, 1);
    root.current.visible = p >= 0.1 && p < 0.3;
    const x = -10.6 + stage(p, 0.1, 0.135) * 5.4 - stage(p, 0.265, 0.3) * 5.4;
    root.current.position.set(x, 0, 10.8);
    distance.current.value = x + 10.6;
    const tilt = (stage(p, 0.15, 0.18) - stage(p, 0.225, 0.25)) * -0.48;
    if (bed.current) bed.current.rotation.z = tilt;
    if (ram.current) {
      temp.end.set(0.28, 0.035, 0).applyAxisAngle(temp.axis, tilt).add(temp.pivot);
      temp.direction.copy(temp.end).sub(temp.start);
      ram.current.position.copy(temp.start).addScaledVector(temp.direction, 0.5);
      ram.current.scale.set(1, temp.direction.length(), 1);
      ram.current.quaternion.setFromUnitVectors(temp.up, temp.direction.normalize());
    }
  });
  return (
    <group ref={root} name="articulated-three-axle-tipper">
      <Model parts={TIPPER} night={props.night} />
      <RoadWheels distance={distance} steer={steer} />
      <group ref={bed} position={[-0.45, 0.145, 0]}>
        <group position={[0.45, 0, 0]}>
          <Model parts={TIPPER_BED} />
        </group>
      </group>
      <mesh ref={ram}>
        <cylinderGeometry args={[0.012, 0.016, 1, 10]} />
        <meshStandardMaterial color={C.chrome} metalness={0.65} roughness={0.35} />
      </mesh>
    </group>
  );
}

const PUMP = [
  ...truckBody(C.red),
  // The reversing mixer discharges into this open receiving hopper.
  box([-0.455, 0.115, 0], [0.14, 0.012, 0.208], C.steel),
  box([-0.525, 0.144, 0], [0.008, 0.05, 0.216], C.red),
  box([-0.385, 0.144, 0], [0.008, 0.05, 0.216], C.red),
  box([-0.455, 0.144, -0.108], [0.14, 0.05, 0.008], C.red),
  box([-0.455, 0.144, 0.108], [0.14, 0.05, 0.008], C.red),
  box([-0.14, 0.15, 0], [0.49, 0.076, 0.22], C.red),
  cylinder([-0.18, 0.21, 0], [0.09, 0.062, 0.09], C.dark),
  ...[-0.3, 0.12].flatMap((x) =>
    [-1, 1].flatMap((s) => [
      box([x, 0.084, s * 0.29], [0.038, 0.036, 0.44], C.white),
      cylinder([x, 0.048, s * 0.49], [0.02, 0.09, 0.02], C.chrome),
      box([x, 0.009, s * 0.49], [0.105, 0.018, 0.105], C.dark),
    ]),
  ),
];
const PUMP_LENGTHS = PUMP_BOOM_LENGTHS;
const PUMP_SEGMENTS = PUMP_LENGTHS.map((length): Part[] => [
  box([length / 2, 0, 0], [length, 0.035, 0.048], C.red),
  beam([0, -0.03, 0.025], [length, -0.03, 0.025], 0.009, C.dark),
  beam([0.06, 0.032, -0.027], [length * 0.62, 0.032, -0.027], 0.012, C.dark),
  beam([length * 0.62, 0.032, -0.027], [length * 0.9, 0.032, -0.027], 0.006, C.chrome),
  cylinder([0, 0, 0], [0.036, 0.071, 0.036], C.chrome, [Math.PI / 2, 0, 0]),
]);

function ConcretePump(props: BurjSiteLifeProps) {
  const root = useRef<THREE.Group>(null),
    turret = useRef<THREE.Group>(null);
  const first = useRef<THREE.Group>(null),
    second = useRef<THREE.Group>(null),
    third = useRef<THREE.Group>(null);
  const hose = useRef<THREE.Mesh>(null);
  const distance = useRef({ value: 0 }),
    steer = useRef({ value: 0 });
  useFrame(({ clock }) => {
    const p = clamp(props.progress.current.value, 0, 1),
      t = props.reducedMotion ? 0 : clock.elapsedTime;
    if (!root.current) return;
    root.current.visible = p >= 0.175 && p < 0.7;
    const pose = pumpPose(p, t);
    if (turret.current) turret.current.rotation.y = pose.yaw;
    if (first.current) first.current.rotation.z = pose.first;
    if (second.current) second.current.rotation.z = pose.second;
    if (third.current) third.current.rotation.z = pose.third;
    if (hose.current) {
      hose.current.rotation.z = pose.hoseAngle;
      hose.current.scale.y = pose.hoseLength / 0.38;
      hose.current.position.set(
        PUMP_LENGTHS[2] + (Math.sin(pose.hoseAngle) * pose.hoseLength) / 2,
        (-Math.cos(pose.hoseAngle) * pose.hoseLength) / 2,
        0.025,
      );
    }
  });
  return (
    <group
      ref={root}
      position={[...PUMP_POSITION]}
      rotation={[0, Math.PI, 0]}
      name="outrigger-stabilized-articulated-concrete-pump"
    >
      <Model parts={PUMP} night={props.night} />
      <RoadWheels distance={distance} steer={steer} />
      <group ref={turret} position={[-0.18, 0.25, 0]}>
        <group ref={first}>
          <Model parts={PUMP_SEGMENTS[0]} />
          <HydraulicRam
            parent={first}
            attachment={second}
            from={[0.48, 0.05, -0.03]}
            to={[0.17, 0.045, -0.03]}
            barrelLength={0.22}
          />
          <group ref={second} position={[PUMP_LENGTHS[0], 0, 0]}>
            <Model parts={PUMP_SEGMENTS[1]} />
            <HydraulicRam
              parent={second}
              attachment={third}
              from={[0.4, 0.05, -0.03]}
              to={[0.15, 0.045, -0.03]}
              barrelLength={0.2}
            />
            <group ref={third} position={[PUMP_LENGTHS[1], 0, 0]}>
              <Model parts={PUMP_SEGMENTS[2]} />
              <mesh ref={hose} position={[PUMP_LENGTHS[2], -0.19, 0.025]}>
                <cylinderGeometry args={[0.009, 0.009, 0.38, 8]} />
                <meshStandardMaterial color={C.dark} roughness={0.95} />
              </mesh>
            </group>
          </group>
        </group>
      </group>
    </group>
  );
}

const EXCAVATOR_BASE: Part[] = [
  ...[-0.126, 0.126].flatMap((z) => [
    box([0, 0.038, z], [0.53, 0.075, 0.065], C.dark),
    ...[-0.2, -0.1, 0, 0.1, 0.2].map((x) =>
      cylinder([x, 0.038, z + Math.sign(z) * 0.036], [0.029, 0.006, 0.029], C.steel, [
        Math.PI / 2,
        0,
        0,
      ]),
    ),
    ...Array.from({ length: 22 }, (_, i) =>
      box([-0.25 + i * 0.024, 0.077, z], [0.016, 0.008, 0.072], C.steel),
    ),
  ]),
  cylinder([0, 0.093, 0], [0.1, 0.035, 0.1], C.steel),
];
const EXCAVATOR_UPPER: Part[] = [
  box([-0.06, 0.051, 0], [0.36, 0.093, 0.257], C.yellow),
  box([-0.25, 0.062, 0], [0.056, 0.106, 0.245], C.orange),
  box([0.045, 0.145, 0.056], [0.188, 0.171, 0.151], C.dark),
  box([0.045, 0.236, 0.056], [0.21, 0.016, 0.174], C.yellow),
  box([0.045, 0.148, 0.135], [0.153, 0.136, 0.005], C.glass),
  box([0.143, 0.15, 0.056], [0.005, 0.133, 0.122], C.glass),
  box([-0.055, 0.15, 0.056], [0.005, 0.133, 0.122], C.glass),
  box([0.08, 0.025, 0.163], [0.15, 0.013, 0.044], C.steel),
  box([0.08, 0.051, 0.152], [0.15, 0.012, 0.027], C.steel),
  ...[-0.2, -0.17, -0.14, -0.11, -0.08].map((x) =>
    box([x, 0.08, -0.132], [0.014, 0.056, 0.006], C.dark),
  ),
  cylinder([-0.17, 0.157, -0.079], [0.008, 0.12, 0.008], C.dark),
  beam([-0.22, 0.116, 0.13], [-0.22, 0.2, 0.13], 0.003, C.steel),
  beam([-0.22, 0.2, 0.13], [-0.07, 0.2, 0.13], 0.003, C.steel),
  box([0.15, 0.21, 0.13], [0.019, 0.022, 0.019], C.lamp),
];
const EXCAVATOR_BOOM = [
  box([0.24, 0, 0], [0.48, 0.041, 0.05], C.yellow),
  cylinder([0, 0, 0], [0.031, 0.075, 0.031], C.steel, [Math.PI / 2, 0, 0]),
];
const EXCAVATOR_STICK = [
  box([0.175, 0, 0], [0.35, 0.032, 0.043], C.yellow),
  cylinder([0, 0, 0], [0.026, 0.062, 0.026], C.steel, [Math.PI / 2, 0, 0]),
];
const EXCAVATOR_BUCKET = [
  box([0.04, -0.032, 0], [0.12, 0.018, 0.15], C.steel),
  box([-0.015, 0.009, 0], [0.019, 0.088, 0.15], C.steel),
  ...[-0.07, 0.07].map((z) => box([0.04, 0.008, z], [0.12, 0.07, 0.012], C.steel)),
  ...[-0.055, -0.027, 0, 0.027, 0.055].map((z) =>
    box([0.119, -0.029, z], [0.045, 0.014, 0.012], C.steel),
  ),
];

/** Ram ends follow their real attachment points as the excavator folds. */
function HydraulicRam({
  parent,
  attachment,
  from,
  to,
  barrelLength = 0.16,
}: {
  parent: RefObject<THREE.Group | null>;
  attachment: RefObject<THREE.Group | null>;
  from: V3;
  to: V3;
  barrelLength?: number;
}) {
  const body = useRef<THREE.Mesh>(null),
    rod = useRef<THREE.Mesh>(null);
  const state = useMemo(
    () => ({
      a: new THREE.Vector3(),
      b: new THREE.Vector3(),
      direction: new THREE.Vector3(),
      up: new THREE.Vector3(0, 1, 0),
      quaternion: new THREE.Quaternion(),
    }),
    [],
  );
  useFrame(() => {
    if (!parent.current || !attachment.current || !body.current || !rod.current) return;
    parent.current.updateWorldMatrix(true, false);
    attachment.current.updateWorldMatrix(true, false);
    state.a.set(...from);
    state.b.set(...to);
    attachment.current.localToWorld(state.b);
    parent.current.worldToLocal(state.b);
    state.direction.copy(state.b).sub(state.a);
    const distance = state.direction.length(),
      barrel = Math.min(barrelLength, distance * 0.88),
      extension = distance - barrel;
    state.direction.normalize();
    state.quaternion.setFromUnitVectors(state.up, state.direction);
    body.current.position.copy(state.a).addScaledVector(state.direction, barrel / 2);
    rod.current.position.copy(state.a).addScaledVector(state.direction, barrel + extension / 2);
    body.current.quaternion.copy(state.quaternion);
    rod.current.quaternion.copy(state.quaternion);
    body.current.scale.y = barrel;
    rod.current.scale.y = extension;
  });
  return (
    <>
      <mesh ref={body}>
        <cylinderGeometry args={[0.01, 0.01, 1, 8]} />
        <meshStandardMaterial color={C.dark} roughness={0.65} />
      </mesh>
      <mesh ref={rod}>
        <cylinderGeometry args={[0.0055, 0.0055, 1, 8]} />
        <meshStandardMaterial color={C.chrome} metalness={0.75} roughness={0.3} />
      </mesh>
    </>
  );
}

function Excavator(props: BurjSiteLifeProps) {
  const root = useRef<THREE.Group>(null),
    upper = useRef<THREE.Group>(null);
  const boom = useRef<THREE.Group>(null),
    stick = useRef<THREE.Group>(null),
    bucket = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!root.current) return;
    const p = clamp(props.progress.current.value, 0, 1),
      t = props.reducedMotion ? 0 : clock.elapsedTime;
    root.current.visible = p >= 0.105 && p < 0.27;
    const cycle = t * 0.38 + p * 26;
    if (upper.current) upper.current.rotation.y = Math.sin(cycle * 0.48) * 0.15;
    if (boom.current) boom.current.rotation.z = 0.67 + Math.sin(cycle) * 0.08;
    if (stick.current) stick.current.rotation.z = -1.91 - Math.sin(cycle + 0.45) * 0.08;
    if (bucket.current) bucket.current.rotation.z = 0.3 + Math.sin(cycle + 1.1) * 0.33;
  });
  return (
    <group
      ref={root}
      position={[-7.1, 0, 3.7]}
      rotation={[0, 0.47, 0]}
      name="tracked-excavator-with-working-hydraulics"
    >
      <Model parts={EXCAVATOR_BASE} />
      <group ref={upper} position={[0, 0.11, 0]}>
        <Model parts={EXCAVATOR_UPPER} night={props.night} />
        <HydraulicRam
          parent={upper}
          attachment={boom}
          from={[0.015, 0.045, -0.082]}
          to={[0.31, -0.025, -0.025]}
        />
        <group ref={boom} position={[0.105, 0.095, -0.055]}>
          <Model parts={EXCAVATOR_BOOM} />
          <HydraulicRam
            parent={boom}
            attachment={stick}
            from={[0.16, 0.035, 0]}
            to={[0.1, 0.025, 0]}
          />
          <group ref={stick} position={[0.48, 0, 0]}>
            <Model parts={EXCAVATOR_STICK} />
            <group ref={bucket} position={[0.35, 0, 0]}>
              <Model parts={EXCAVATOR_BUCKET} />
            </group>
          </group>
        </group>
      </group>
    </group>
  );
}

function lattice(segments: Segment[], radius: number) {
  const batches = mergedParts(segments.map(([a, b]) => beam(a, b, radius, C.orange)));
  return batches[0].geometry;
}
const CRANE_HEAD: Part[] = [
  cylinder([0, 0.04, 0], [0.22, 0.13, 0.22], C.steel),
  box([-1.32, -0.15, 0], [0.72, 0.34, 0.36], C.concrete),
  ...[-1.57, -1.32, -1.07].map((x) => box([x, -0.15, 0], [0.012, 0.35, 0.37], C.steel)),
  box([0.18, -0.18, 0.24], [0.26, 0.27, 0.24], C.orange),
  box([0.18, -0.16, 0.365], [0.21, 0.18, 0.007], C.glass),
  box([0.315, -0.16, 0.24], [0.007, 0.18, 0.19], C.glass),
  box([0.18, -0.33, 0.24], [0.36, 0.023, 0.33], C.steel),
  cylinder([-0.65, 0.13, 0], [0.1, 0.27, 0.1], C.steel, [Math.PI / 2, 0, 0]),
  box([6.98, 0.2, 0], [0.045, 0.045, 0.045], C.lamp),
];
const CRANE_BASE = [
  box([0, 0.09, 0], [0.82, 0.18, 0.82], C.concrete),
  ...[-0.12, 0.12].flatMap((z) => [
    box([0, 0.205, z], [0.58, 0.06, 0.09], C.steel),
    ...[-0.12, 0.12].map((x) => box([x, 0.242, z], [0.09, 0.025, 0.09], C.chrome)),
  ]),
];
const TROLLEY = [
  box([0, 0, 0], [0.2, 0.09, 0.24], C.steel),
  ...[-0.08, 0.08].flatMap((x) =>
    [-0.13, 0.13].map((z) =>
      cylinder([x, 0.04, z], [0.035, 0.022, 0.035], C.dark, [Math.PI / 2, 0, 0]),
    ),
  ),
];
const CRANE_LOAD: Part[] = [
  box([0, -0.31, 0], [0.46, 0.08, 0.24], '#9e8669'),
  ...[-0.15, 0.15].flatMap((x) => [
    box([x, -0.31, 0], [0.014, 0.086, 0.245], C.dark),
    beam([0, -0.07, 0], [x, -0.27, -0.11], 0.004, C.dark),
    beam([0, -0.07, 0], [x, -0.27, 0.11], 0.004, C.dark),
  ]),
];

function ClimbingTowerCrane(props: BurjSiteLifeProps) {
  const root = useRef<THREE.Group>(null),
    mast = useRef<THREE.InstancedMesh>(null),
    ladder = useRef<THREE.InstancedMesh>(null);
  const head = useRef<THREE.Group>(null),
    trolley = useRef<THREE.Group>(null),
    cable = useRef<THREE.Group>(null);
  const hook = useRef<THREE.Group>(null),
    load = useRef<THREE.Group>(null);
  const object = useMemo(() => new THREE.Object3D(), []);
  const geometry = useMemo(() => {
    const mastSegments: Segment[] = [],
      jibSegments: Segment[] = [],
      ladderSegments: Segment[] = [],
      rigging: Segment[] = [];
    for (const x of [-0.12, 0.12])
      for (const z of [-0.12, 0.12])
        mastSegments.push([
          [x, 0, z],
          [x, 1.2, z],
        ]);
    for (let y = 0; y <= 1.2; y += 0.3) {
      for (const s of [-0.12, 0.12]) {
        mastSegments.push(
          [
            [-0.12, y, s],
            [0.12, y, s],
          ],
          [
            [s, y, -0.12],
            [s, y, 0.12],
          ],
        );
        if (y < 1.19)
          mastSegments.push(
            [
              [-0.12, y, s],
              [0.12, y + 0.3, s],
            ],
            [
              [s, y, -0.12],
              [s, y + 0.3, 0.12],
            ],
          );
      }
    }
    for (const x of [-0.043, 0.043])
      ladderSegments.push([
        [x, 0, -0.055],
        [x, 1.2, -0.055],
      ]);
    for (let y = 0.035; y < 1.2; y += 0.035)
      ladderSegments.push([
        [-0.043, y, -0.055],
        [0.043, y, -0.055],
      ]);
    for (const z of [-0.12, 0.12])
      jibSegments.push([
        [-1.8, 0, z],
        [7, 0, z],
      ]);
    jibSegments.push([
      [-1.8, 0.25, 0],
      [7, 0.25, 0],
    ]);
    for (let x = -1.8; x < 6.99; x += 0.32)
      for (const z of [-0.12, 0.12]) {
        jibSegments.push(
          [
            [x, 0, z],
            [Math.min(x + 0.32, 7), 0.25, 0],
          ],
          [
            [x, 0.25, 0],
            [Math.min(x + 0.32, 7), 0, z],
          ],
        );
        jibSegments.push([
          [x, 0, -0.12],
          [x, 0, 0.12],
        ]);
      }
    rigging.push(
      [
        [0, 0.08, 0],
        [0, 0.9, 0],
      ],
      [
        [0, 0.9, 0],
        [6.8, 0.25, 0],
      ],
      [
        [0, 0.9, 0],
        [-1.7, 0.25, 0],
      ],
    );
    const hookPath = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, -0.035, 0),
      new THREE.Vector3(-0.018, -0.066, 0),
      new THREE.Vector3(-0.01, -0.095, 0),
      new THREE.Vector3(0.021, -0.1, 0),
      new THREE.Vector3(0.032, -0.076, 0),
    ]);
    return {
      mast: lattice(mastSegments, 0.008),
      ladder: lattice(ladderSegments, 0.002),
      jib: lattice(jibSegments, 0.009),
      rig: lattice(rigging, 0.003),
      hook: new THREE.TubeGeometry(hookPath, 12, 0.005, 6, false),
    };
  }, []);
  useEffect(() => () => Object.values(geometry).forEach((piece) => piece.dispose()), [geometry]);
  useFrame(({ clock }) => {
    if (!root.current || !head.current) return;
    const p = clamp(props.progress.current.value, 0, 1),
      t = props.reducedMotion ? 0 : clock.elapsedTime;
    const pose = cranePose(p);
    root.current.visible = pose.visible;
    if (!root.current.visible) return;
    const height = pose.height;
    const modules = Math.ceil((height - 0.25) / 1.2);
    for (let i = 0; i < modules; i++) {
      object.position.set(0, 0.25 + i * 1.2, 0);
      object.rotation.set(0, 0, 0);
      object.scale.set(1, Math.min(1, (height - 0.25 - i * 1.2) / 1.2), 1);
      object.updateMatrix();
      mast.current?.setMatrixAt(i, object.matrix);
      ladder.current?.setMatrixAt(i, object.matrix);
    }
    if (mast.current) {
      mast.current.count = modules;
      mast.current.instanceMatrix.needsUpdate = true;
    }
    if (ladder.current) {
      ladder.current.count = modules;
      ladder.current.instanceMatrix.needsUpdate = true;
    }
    head.current.position.y = height;
    // Loads clear the shutters before slewing, then land on the installed wing slab.
    head.current.rotation.y = pose.yaw;
    if (trolley.current) trolley.current.position.x = pose.trolley;
    const drop = pose.drop;
    if (cable.current) {
      cable.current.position.y = -drop / 2;
      cable.current.scale.y = drop;
    }
    if (hook.current) {
      hook.current.position.y = -drop;
      hook.current.rotation.z = pose.active ? Math.sin(t * 0.7) * 0.009 : 0;
    }
    if (load.current) load.current.visible = pose.loadVisible;
  });
  return (
    <group ref={root} position={[...CRANE_POSITION]} name="core-supported-climbing-tower-crane">
      <Model parts={CRANE_BASE} />
      <instancedMesh
        ref={mast}
        args={[geometry.mast, undefined, 55]}
        castShadow
        frustumCulled={false}
      >
        <meshStandardMaterial color={C.orange} roughness={0.7} metalness={0.32} />
      </instancedMesh>
      <instancedMesh ref={ladder} args={[geometry.ladder, undefined, 55]} frustumCulled={false}>
        <meshStandardMaterial color={C.steel} roughness={0.55} metalness={0.5} />
      </instancedMesh>
      <group ref={head}>
        <Model parts={CRANE_HEAD} night={props.night} />
        <mesh geometry={geometry.jib} castShadow>
          <meshStandardMaterial color={C.orange} metalness={0.3} roughness={0.68} />
        </mesh>
        <mesh geometry={geometry.rig}>
          <meshStandardMaterial color={C.dark} metalness={0.5} roughness={0.6} />
        </mesh>
        <group ref={trolley} position={[1.8, -0.02, 0]}>
          <Model parts={TROLLEY} />
          <group ref={cable}>
            {[-0.018, 0.018].map((x) => (
              <mesh key={x} position={[x, 0, 0]}>
                <cylinderGeometry args={[0.002, 0.002, 1, 5]} />
                <meshStandardMaterial color={C.dark} metalness={0.5} />
              </mesh>
            ))}
          </group>
          <group ref={hook}>
            <mesh rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.041, 0.041, 0.046, 10]} />
              <meshStandardMaterial color={C.yellow} roughness={0.65} />
            </mesh>
            <mesh geometry={geometry.hook}>
              <meshStandardMaterial color={C.dark} metalness={0.65} />
            </mesh>
            <group ref={load}>
              <Model parts={CRANE_LOAD} />
            </group>
          </group>
        </group>
      </group>
    </group>
  );
}

const SURVEY_TOOLS: Part[] = [
  ...[-0.12, 2.05].flatMap((x) => [
    ...[0, 1, 2].map((i) => {
      const a = (i * Math.PI * 2) / 3;
      return beam(
        [x + Math.cos(a) * 0.055, 0.006, 9.42 + Math.sin(a) * 0.055],
        [x, 0.13, 9.42],
        0.003,
        C.yellow,
      );
    }),
    box([x, 0.145, 9.42], [0.04, 0.026, 0.029], C.white),
    cylinder([x, 0.146, 9.441], [0.011, 0.016, 0.011], C.dark, [Math.PI / 2, 0, 0]),
  ]),
  ...[0, 1, 2, 3, 4, 5].map((i) =>
    beam([-2.7, 0.021 + i * 0.004, 9.08], [-2.2, 0.021 + i * 0.004, 9.08], 0.002, C.steel),
  ),
];

function SurveyEquipment({ progress }: BurjSiteLifeProps) {
  const root = useRef<THREE.Group>(null);
  useFrame(() => {
    if (root.current)
      root.current.visible = progress.current.value > 0.045 && progress.current.value < 0.84;
  });
  return (
    <group ref={root} name="survey-tripods-and-rebar-bundle">
      <Model parts={SURVEY_TOOLS} />
    </group>
  );
}

/** Reversible site choreography: no accumulated simulation state or scroll-triggered spawning. */
export function BurjSiteLife(props: BurjSiteLifeProps) {
  return (
    <group name="burj-construction-site-life">
      <ArticulatedCrew {...props} />
      <SurveyEquipment {...props} />
      <ConcreteMixer {...props} />
      <Tipper {...props} />
      <ConcretePump {...props} />
      <Excavator {...props} />
      <ClimbingTowerCrane {...props} />
    </group>
  );
}
