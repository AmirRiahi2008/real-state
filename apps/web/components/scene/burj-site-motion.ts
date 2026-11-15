import { builtFloorCount, floorProfile, floorY, TOWER_XZ_SCALE, RAFT_RADIUS } from './burj-profile';

export const MIXER_STOP = [3.78, 0, 8.4] as const;
export const PUMP_POSITION = [2.8, 0, 8.4] as const;
export const CRANE_POSITION = [0.15, 0, -0.1] as const;
export const PUMP_BOOM_LENGTHS = [0.9, 0.84, 0.78] as const;

const mix = (a: number, b: number, t: number) => a + (b - a) * t;
export function siteStage(value: number, from: number, to: number) {
  const t = Math.max(0, Math.min(1, (value - from) / (to - from)));
  return t * t * (3 - 2 * t);
}

export const raftTop = (progress: number) => -0.4 + 0.4 * siteStage(progress, 0.207, 0.257);

/** Back into the receiving hopper; the parked pump is never on the approach path. */
export function mixerPosition(progress: number) {
  const travel = 12 - MIXER_STOP[0];
  return 12 - siteStage(progress, 0.165, 0.19) * travel + siteStage(progress, 0.7, 0.745) * travel;
}

export function pumpPose(progress: number, time = 0) {
  const deployed = siteStage(progress, 0.18, 0.205) * (1 - siteStage(progress, 0.65, 0.69));
  // Raise the folded boom before unfolding its second section. Interpolating
  // every joint together would swing the tip through the ground.
  const first = 0.08 + 1.17 * siteStage(deployed, 0, 0.28) - 0.95 * siteStage(deployed, 0.7, 1);
  const second = mix(-Math.PI - 0.08, -0.5, siteStage(deployed, 0.26, 0.7));
  const third = mix(0.04, 0, deployed) - first - second;
  const total = first + second + third;
  const tipY =
    0.25 +
    PUMP_BOOM_LENGTHS[0] * Math.sin(first) +
    PUMP_BOOM_LENGTHS[1] * Math.sin(first + second) +
    PUMP_BOOM_LENGTHS[2] * Math.sin(total);
  const yaw = (1.912 - Math.PI) * deployed + Math.sin(time * 0.1) * deployed * 0.006;
  const reach =
    PUMP_BOOM_LENGTHS[0] * Math.cos(first) +
    PUMP_BOOM_LENGTHS[1] * Math.cos(first + second) +
    PUMP_BOOM_LENGTHS[2] * Math.cos(total);
  const tipX =
    PUMP_POSITION[0] + 0.18 + Math.cos(yaw + Math.PI) * reach + Math.sin(yaw + Math.PI) * 0.025;
  const tipZ = PUMP_POSITION[2] - Math.sin(yaw + Math.PI) * reach + Math.cos(yaw + Math.PI) * 0.025;
  const overRaft = 1 - siteStage(Math.hypot(tipX, tipZ), RAFT_RADIUS - 0.05, RAFT_RADIUS + 0.1);
  // Lower the hose only after it has cleared the excavation rim.
  const targetSurface = mix(0.08, raftTop(progress) + 0.02, overRaft);
  const hoseLength = mix(0.08, Math.max(0.03, tipY - targetSurface), deployed);
  return {
    first,
    second,
    third,
    yaw,
    hoseAngle: -total,
    hoseLength,
  };
}

/** An internally supported climbing crane, with a load delivered to an installed slab. */
export function cranePose(progress: number) {
  const count = builtFloorCount(progress);
  const index = Math.max(0, count - 1);
  const profile = floorProfile(index);
  const structureTop = floorY(count);
  const height = Math.min(65, Math.max(4.4, structureTop + 3.8));
  // The longest wing has deck outside the core shutter and the central concrete wall.
  const deliveryX = profile.halfWidth * 0.45 * TOWER_XZ_SCALE;
  const deliveryZ = -(profile.coreRadius * 1.65 + 0.2) * TOWER_XZ_SCALE;
  const dx = deliveryX - CRANE_POSITION[0];
  const dz = deliveryZ - CRANE_POSITION[2];
  const deliveryYaw = Math.atan2(-dz, dx);
  const deliveryRadius = Math.hypot(dx, dz);
  // Eight legible lifting sequences replace a mechanically frantic lift every floor.
  const cycle = (Math.max(0, Math.min(0.999999, (progress - 0.26) / 0.46)) * 8) % 1;
  const swing = siteStage(cycle, 0.22, 0.48) * (1 - siteStage(cycle, 0.84, 0.94));
  const lift = siteStage(cycle, 0, 0.2);
  const lower = siteStage(cycle, 0.52, 0.72);
  const raise = siteStage(cycle, 0.8, 0.84);
  const returnEmpty = siteStage(cycle, 0.94, 1);
  const clearance = structureTop + 2.2;
  // The bottom of the slung pallet is 0.35 below its hook.
  const deliveryHook = floorY(index) + 0.055 + 0.35 + 0.035;
  let hookY = mix(0.36, clearance, lift);
  hookY = mix(hookY, deliveryHook, lower);
  hookY = mix(hookY, clearance, raise);
  hookY = mix(hookY, 0.36, returnEmpty);
  const parked = siteStage(progress, 0.715, 0.725);
  const active = progress >= 0.26 && progress < 0.725 && count > 0;
  return {
    visible: count > 0 && progress < 0.73,
    height,
    yaw: active ? mix(deliveryYaw * swing, 0, parked) : 0,
    trolley: active ? mix(mix(6.88, deliveryRadius, swing), 6.88, parked) : 6.88,
    drop: active ? mix(Math.max(0.45, height - hookY), 0.8, parked) : 0.8,
    loadVisible: active && cycle < 0.78 && parked < 0.01,
    active,
  };
}
