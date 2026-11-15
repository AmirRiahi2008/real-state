import { expect, test } from '@playwright/test';
import * as THREE from 'three';
import { applyFlagWind } from '../lib/flag-geometry';

test('waving fabric remains finite and keeps the entire hoist fixed with Float32 coordinates', () => {
  const geometry = new THREE.PlaneGeometry(6.4, 3.2, 96, 48);
  geometry.translate(3.2, 0, 0);
  geometry.setAttribute('restPosition', geometry.getAttribute('position').clone());
  const rest = geometry.getAttribute('restPosition');
  for (const time of [0, 0.01, 1.65, 12.7, 10000]) {
    applyFlagWind(geometry, time, 6.4);
    const position = geometry.getAttribute('position'),
      normal = geometry.getAttribute('normal');
    expect(Array.from(position.array).every(Number.isFinite)).toBe(true);
    expect(Array.from(normal.array).every(Number.isFinite)).toBe(true);
    let pinned = 0,
      freeMovement = 0;
    for (let i = 0; i < position.count; i++) {
      if (Math.abs(rest.getX(i)) < 1e-6) {
        expect(position.getX(i)).toBe(rest.getX(i));
        expect(position.getY(i)).toBe(rest.getY(i));
        expect(position.getZ(i)).toBe(0);
        pinned++;
      }
      if (rest.getX(i) > 6.3) freeMovement = Math.max(freeMovement, Math.abs(position.getZ(i)));
    }
    expect(pinned).toBe(49);
    expect(freeMovement).toBeGreaterThan(0.01);
  }
  geometry.dispose();
});
