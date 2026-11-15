import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export type Vector3Tuple = [number, number, number];
export type Finish =
  | 'concrete'
  | 'metal'
  | 'dark'
  | 'wood'
  | 'copper'
  | 'blue'
  | 'glass'
  | 'warm'
  | 'solar'
  | 'paving'
  | 'waterline';

export type DetailPart = {
  position: Vector3Tuple;
  size: Vector3Tuple;
  finish: Finish;
  rotation?: Vector3Tuple;
  shape?: 'box' | 'cylinder' | 'sphere' | 'torus';
};

export const finishes: Record<Finish, { color: string; roughness: number; metalness?: number }> = {
  concrete: { color: '#d8d2c5', roughness: 0.86 },
  metal: { color: '#9ca6a0', roughness: 0.38, metalness: 0.62 },
  dark: { color: '#475652', roughness: 0.58, metalness: 0.25 },
  wood: { color: '#b69a76', roughness: 0.81 },
  copper: { color: '#b58463', roughness: 0.47, metalness: 0.45 },
  blue: { color: '#709aaf', roughness: 0.62, metalness: 0.2 },
  glass: { color: '#a6c7c2', roughness: 0.14, metalness: 0.15 },
  warm: { color: '#f0dec0', roughness: 0.73 },
  solar: { color: '#365b73', roughness: 0.26, metalness: 0.42 },
  paving: { color: '#d4d1bf', roughness: 0.96 },
  waterline: { color: '#7caaa9', roughness: 0.28 },
};

export function box(
  parts: DetailPart[],
  position: Vector3Tuple,
  size: Vector3Tuple,
  finish: Finish,
  rotation?: Vector3Tuple,
) {
  parts.push({ position, size, finish, rotation });
}

export function rod(
  parts: DetailPart[],
  from: Vector3Tuple,
  to: Vector3Tuple,
  radius: number,
  finish: Finish,
) {
  const start = new THREE.Vector3(...from);
  const end = new THREE.Vector3(...to);
  const direction = end.clone().sub(start);
  const rotation = new THREE.Euler().setFromQuaternion(
    new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      direction.clone().normalize(),
    ),
  );
  parts.push({
    position: start.add(end).multiplyScalar(0.5).toArray() as Vector3Tuple,
    size: [radius, direction.length(), radius],
    finish,
    rotation: [rotation.x, rotation.y, rotation.z],
    shape: 'cylinder',
  });
}

export function ring(
  parts: DetailPart[],
  position: Vector3Tuple,
  radius: number,
  finish: Finish,
  rotation: Vector3Tuple = [-Math.PI / 2, 0, 0],
) {
  parts.push({ position, size: [radius, radius, radius], finish, rotation, shape: 'torus' });
}

export function buildAssemblies(parts: readonly DetailPart[]) {
  const byFinish = new Map<Finish, THREE.BufferGeometry[]>();
  const transform = new THREE.Object3D();
  for (const part of parts) {
    const geometry =
      part.shape === 'cylinder'
        ? new THREE.CylinderGeometry(1, 1, 1, 8)
        : part.shape === 'sphere'
          ? new THREE.SphereGeometry(1, 8, 6)
          : part.shape === 'torus'
            ? new THREE.TorusGeometry(1, 0.065, 5, 18)
            : new THREE.BoxGeometry(1, 1, 1);
    transform.position.set(...part.position);
    transform.rotation.set(...(part.rotation ?? [0, 0, 0]));
    transform.scale.set(...part.size);
    transform.updateMatrix();
    geometry.applyMatrix4(transform.matrix);
    const list = byFinish.get(part.finish) ?? [];
    list.push(geometry);
    byFinish.set(part.finish, list);
  }
  return [...byFinish].map(([finish, pieces]) => {
    const geometry = mergeGeometries(pieces, false)!;
    pieces.forEach((part) => part.dispose());
    return { finish, geometry };
  });
}

/** A supported access ramp, with a continuous sloping surface and closed side faces. */
export function accessRamp() {
  const half = 0.75;
  const near = 5.0;
  const far = 6.45;
  const bottom = -0.1;
  const points = [
    [-half, bottom, near],
    [half, bottom, near],
    [-half, bottom, far],
    [half, bottom, far],
    [-half, 0.155, near],
    [half, 0.155, near],
    [-half, 0.025, far],
    [half, 0.025, far],
  ];
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(points.flat(), 3));
  const faces = [
    0, 2, 1, 1, 2, 3, 4, 5, 6, 5, 7, 6, 0, 1, 4, 1, 5, 4, 2, 6, 3, 3, 6, 7, 0, 4, 2, 2, 4, 6, 1, 3,
    5, 3, 7, 5,
  ];
  // The surface faces upward; all six faces use outward winding.
  for (let index = 0; index < faces.length; index += 3)
    [faces[index + 1], faces[index + 2]] = [faces[index + 2], faces[index + 1]];
  geometry.setIndex(faces);
  geometry.computeVertexNormals();
  return geometry;
}

export function entryRamp() {
  const left = -4.05;
  const right = -0.6;
  const front = 2.275;
  const back = 2.925;
  const bottom = 0.085;
  const points = [
    [left, bottom, front],
    [right, bottom, front],
    [left, bottom, back],
    [right, bottom, back],
    [left, 0.155, front],
    [right, 0.44, front],
    [left, 0.155, back],
    [right, 0.44, back],
  ];
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(points.flat(), 3));
  geometry.setIndex([
    0, 1, 2, 1, 3, 2, 4, 6, 5, 5, 6, 7, 0, 4, 1, 1, 4, 5, 2, 3, 6, 3, 7, 6, 0, 2, 4, 2, 6, 4, 1, 5,
    3, 3, 5, 7,
  ]);
  geometry.computeVertexNormals();
  return geometry;
}
