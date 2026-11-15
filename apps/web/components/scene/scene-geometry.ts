import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
export type V3 = [number, number, number];
export type SlabOpening = { x: number; z: number; width: number; depth: number };

export function roundedPlate(
  width: number,
  depth: number,
  thickness: number,
  radius = 0.2,
  cutout?: SlabOpening | SlabOpening[],
) {
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
  if (cutout)
    for (const opening of Array.isArray(cutout) ? cutout : [cutout]) {
      const hole = new THREE.Path();
      const left = opening.x - opening.width / 2;
      const right = opening.x + opening.width / 2;
      const bottom = -opening.z - opening.depth / 2;
      const top = -opening.z + opening.depth / 2;
      hole.moveTo(left, bottom);
      hole.lineTo(left, top);
      hole.lineTo(right, top);
      hole.lineTo(right, bottom);
      hole.closePath();
      s.holes.push(hole);
    }
  const geometry = new THREE.ExtrudeGeometry(s, {
    depth: thickness,
    bevelEnabled: false,
    curveSegments: 5,
  });
  geometry.rotateX(-Math.PI / 2);
  return geometry;
}

export function mergedBoxes(boxes: Array<{ position: V3; size: V3; rotation?: V3 }>) {
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

export function rods(lines: Array<[V3, V3]>, radius = 0.018) {
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
