import { expect, test } from '@playwright/test';
import * as THREE from 'three';
import {
  builtFloorCount,
  floorContour,
  floorProfile,
  floorY,
  TOWER_XZ_SCALE,
  RAFT_RADIUS,
  FOUNDATION_RADIUS,
} from '../components/scene/burj-profile';
import {
  CRANE_POSITION,
  MIXER_STOP,
  PUMP_POSITION,
  PUMP_BOOM_LENGTHS,
  cranePose,
  mixerPosition,
  pumpPose,
  raftTop,
} from '../components/scene/burj-site-motion';

function pumpEndpoint(progress: number, time = 0) {
  const pose = pumpPose(progress, time);
  const base = new THREE.Object3D();
  base.position.set(...PUMP_POSITION);
  base.rotation.y = Math.PI;
  const turret = new THREE.Object3D();
  turret.position.set(-0.18, 0.25, 0);
  turret.rotation.y = pose.yaw;
  base.add(turret);
  let joint = turret;
  [pose.first, pose.second, pose.third].forEach((angle, index) => {
    const next = new THREE.Object3D();
    if (index > 0) next.position.x = PUMP_BOOM_LENGTHS[index - 1];
    next.rotation.z = angle;
    joint.add(next);
    joint = next;
  });
  const hose = new THREE.Object3D();
  hose.rotation.z = pose.hoseAngle;
  hose.scale.y = pose.hoseLength / 0.38;
  hose.position.set(
    PUMP_BOOM_LENGTHS[2] + (Math.sin(pose.hoseAngle) * pose.hoseLength) / 2,
    (-Math.cos(pose.hoseAngle) * pose.hoseLength) / 2,
    0.025,
  );
  joint.add(hose);
  base.updateMatrixWorld(true);
  return {
    bottom: new THREE.Vector3(0, -0.19, 0).applyMatrix4(hose.matrixWorld),
    top: new THREE.Vector3(0, 0.19, 0).applyMatrix4(hose.matrixWorld),
  };
}

function inside(point: THREE.Vector3, contour: { x: number; z: number }[]) {
  let result = false;
  for (let i = 0, j = contour.length - 1; i < contour.length; j = i++) {
    const a = contour[i],
      b = contour[j];
    if (
      a.z > point.z !== b.z > point.z &&
      point.x < ((b.x - a.x) * (point.z - a.z)) / (b.z - a.z) + a.x
    )
      result = !result;
  }
  return result;
}

test('mixer reverses clear of the parked pump and its chute reaches the receiving hopper', () => {
  for (let i = 0; i <= 800; i++) {
    const x = mixerPosition(i / 1000);
    expect(x - 0.48).toBeGreaterThan(PUMP_POSITION[0] + 0.48);
    expect(Math.hypot(x - 0.48, MIXER_STOP[2] - 0.15)).toBeGreaterThan(FOUNDATION_RADIUS);
  }
  expect(mixerPosition(0.22)).toBeCloseTo(MIXER_STOP[0], 10);
  const chuteLip = MIXER_STOP[0] - 0.497 - (Math.cos(0.536) * 0.167) / 2;
  const hopperCenter = PUMP_POSITION[0] + 0.455;
  expect(chuteLip).toBeGreaterThan(hopperCenter - 0.07);
  expect(chuteLip).toBeLessThan(hopperCenter + 0.07);
});

test('deployed pump hose stays vertical inside the raft and follows its rising concrete surface', () => {
  for (const time of [0, 35, 91])
    for (let i = 0; i <= 100; i++) {
      const progress = 0.205 + (i / 100) * (0.65 - 0.205);
      const { bottom, top } = pumpEndpoint(progress, time);
      expect(Math.hypot(bottom.x, bottom.z)).toBeLessThan(RAFT_RADIUS);
      expect(bottom.y).toBeCloseTo(raftTop(progress) + 0.02, 8);
      expect(Math.hypot(top.x - bottom.x, top.z - bottom.z)).toBeLessThan(1e-8);
    }
  for (let i = 0; i <= 100; i++) {
    const p = 0.18 + (i / 100) * 0.025;
    const { bottom, top } = pumpEndpoint(p);
    expect(Math.hypot(bottom.x, bottom.z) < FOUNDATION_RADIUS || bottom.y >= -0.005).toBe(true);
    expect(Math.hypot(top.x, top.z) < FOUNDATION_RADIUS || top.y >= 0).toBe(true);
  }
});

test('crane lands the slung pallet on an installed Y-wing slab outside the core formwork', () => {
  for (let cycle = 0; cycle < 8; cycle++) {
    const p = 0.26 + ((cycle + 0.735) / 8) * 0.46;
    const pose = cranePose(p);
    expect(pose.visible && pose.loadVisible).toBe(true);
    const index = builtFloorCount(p) - 1;
    const head = new THREE.Object3D();
    head.position.set(CRANE_POSITION[0], pose.height - 0.02 - pose.drop, CRANE_POSITION[2]);
    head.rotation.y = pose.yaw;
    head.updateMatrixWorld(true);
    for (const x of [-0.23, 0.23])
      for (const z of [-0.12, 0.12]) {
        const corner = new THREE.Vector3(pose.trolley + x, -0.35, z).applyMatrix4(head.matrixWorld);
        expect(
          inside(
            corner,
            floorContour(index).map((point) => ({
              x: point.x * TOWER_XZ_SCALE,
              z: point.z * TOWER_XZ_SCALE,
            })),
          ),
        ).toBe(true);
        expect(corner.y).toBeGreaterThanOrEqual(floorY(index) + 0.055 - 1e-8);
        expect(Math.hypot(corner.x, corner.z)).toBeGreaterThan(
          floorProfile(index).coreRadius * 1.34 * TOWER_XZ_SCALE,
        );
      }
  }
  expect(cranePose(0.75).visible).toBe(false);
});
