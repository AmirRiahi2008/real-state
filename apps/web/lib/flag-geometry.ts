import * as THREE from 'three';

/** Deform only away from the hoist. Clamp Float32 round-off before fractional powers. */
export function applyFlagWind(geometry: THREE.BufferGeometry, time: number, width: number) {
  const positions = geometry.getAttribute('position') as THREE.BufferAttribute;
  const rest = geometry.getAttribute('restPosition') as THREE.BufferAttribute;
  const gust = 0.86 + Math.sin(time * 0.43) * 0.14;
  for (let index = 0; index < positions.count; index++) {
    const x = rest.getX(index),
      y = rest.getY(index);
    const u = THREE.MathUtils.clamp(x / width, 0, 1);
    const influence = Math.pow(u, 0.85);
    const ripple =
      (Math.sin(x * 2.35 - time * 2.7 + y * 0.55) * 0.34 +
        Math.sin(x * 4.7 - time * 4.1 + y * 0.8) * 0.15 +
        Math.sin(x * 8.5 - time * 5.8) * 0.055) *
      gust;
    positions.setXYZ(
      index,
      x - influence * 0.045 * (1 + Math.sin(x * 2 - time * 2)),
      y - 0.1 * Math.pow(u, 1.2) + Math.sin(x * 1.8 - time * 2.3) * 0.035 * influence,
      influence === 0 ? 0 : ripple * influence,
    );
  }
  positions.needsUpdate = true;
  geometry.computeVertexNormals();
}
