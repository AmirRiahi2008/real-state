/** Stylised Burj Khalifa massing. One scene unit represents ten metres. */
export const BASE_RADIUS = 6.2;
export const TOWER_XZ_SCALE = 1.22;
export const FOUNDATION_RADIUS = 8.1;
export const RAFT_RADIUS = 7.95;
export const TOWER_HEIGHT = 82.8;
export const FLOOR_COUNT = 163;
export const BODY_BASE = 0.35;
export const BODY_TOP = 61.4;
export const BODY_HEIGHT = BODY_TOP;
export const CROWN_TOP = 75;
export const SPIRE_BASE = 73.8;
export const FLOOR_HEIGHT = (BODY_TOP - BODY_BASE) / FLOOR_COUNT;

export type ContourPoint = { x: number; z: number };
export type BurjProfile = {
  tier: number;
  coreRadius: number;
  halfWidth: number;
  wingLengths: readonly [number, number, number];
};

// Successive reductions alternate around the three wings. Their visual rhythm
// describes the spiralling setbacks; these are not a measured floor survey.
export const SETBACK_FLOORS = [
  0, 7, 13, 20, 26, 33, 39, 46, 52, 59, 65, 72, 78, 85, 91, 98, 104, 111, 117, 124, 130, 137, 143,
  150, 156,
] as const;
export const WING_ANGLES = [-Math.PI / 2, Math.PI / 6, (5 * Math.PI) / 6] as const;

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

export function floorY(index: number) {
  return BODY_BASE + Math.max(0, Math.min(FLOOR_COUNT, index)) * FLOOR_HEIGHT;
}

export function floorProfile(index: number): BurjProfile {
  let tier = 0;
  for (let i = 1; i < SETBACK_FLOORS.length; i++) {
    if (index >= SETBACK_FLOORS[i]) tier = i;
  }
  const lengths: [number, number, number] = [BASE_RADIUS, 5.98, 5.76];
  for (let step = 1; step <= tier; step++) {
    const wing = (step - 1) % 3;
    lengths[wing] -= 0.535 + (step > 18 ? 0.035 : 0);
  }
  return {
    tier,
    coreRadius: 1.16 - tier * 0.024,
    halfWidth: 1.22 - tier * 0.027,
    wingLengths: lengths,
  };
}

/** Forty-eight consistently ordered points: three rounded petals and valleys. */
export function profileContour(profile: BurjProfile): ContourPoint[] {
  const points: ContourPoint[] = [];
  WING_ANGLES.forEach((angle, wing) => {
    const direction = { x: Math.cos(angle), z: Math.sin(angle) };
    const tangent = { x: -direction.z, z: direction.x };
    const length = profile.wingLengths[wing];
    const width = Math.min(profile.halfWidth, length * 0.55);
    const cap = length - width;
    const valleyAngle = angle - Math.PI / 3;
    const left = {
      x: Math.cos(valleyAngle) * profile.coreRadius,
      z: Math.sin(valleyAngle) * profile.coreRadius,
    };
    const right = {
      x: Math.cos(angle + Math.PI / 3) * profile.coreRadius,
      z: Math.sin(angle + Math.PI / 3) * profile.coreRadius,
    };
    const capLeft = {
      x: direction.x * cap - tangent.x * width,
      z: direction.z * cap - tangent.z * width,
    };
    const capRight = {
      x: direction.x * cap + tangent.x * width,
      z: direction.z * cap + tangent.z * width,
    };
    points.push(left);
    for (let i = 1; i <= 3; i++) {
      const t = i / 4;
      const bow = Math.sin(t * Math.PI) * width * 0.08;
      points.push({
        x: left.x + (capLeft.x - left.x) * t - tangent.x * bow,
        z: left.z + (capLeft.z - left.z) * t - tangent.z * bow,
      });
    }
    for (let i = 0; i <= 8; i++) {
      const a = -Math.PI / 2 + (i / 8) * Math.PI;
      points.push({
        x: direction.x * (cap + width * Math.cos(a)) + tangent.x * width * Math.sin(a),
        z: direction.z * (cap + width * Math.cos(a)) + tangent.z * width * Math.sin(a),
      });
    }
    for (let i = 1; i <= 3; i++) {
      const t = i / 4;
      const bow = Math.sin(t * Math.PI) * width * 0.08;
      points.push({
        x: capRight.x + (right.x - capRight.x) * t + tangent.x * bow,
        z: capRight.z + (right.z - capRight.z) * t + tangent.z * bow,
      });
    }
  });
  return points;
}

export function floorContour(index: number): ContourPoint[] {
  return profileContour(floorProfile(index));
}

export function builtFloorCount(progress: number) {
  return Math.min(FLOOR_COUNT, Math.floor(clamp01((progress - 0.26) / 0.46) * FLOOR_COUNT + 1e-8));
}

/** Highest installed structure, shared by the camera and climbing tower cranes. */
export function constructionHeight(progress: number) {
  if (progress < 0.26) return 0;
  if (progress < 0.72) return floorY(clamp01((progress - 0.26) / 0.46) * FLOOR_COUNT);
  if (progress < 0.73) return BODY_TOP;
  const crown = BODY_TOP + clamp01((progress - 0.73) / 0.12) * (CROWN_TOP - BODY_TOP);
  const spire =
    progress < 0.84
      ? 0
      : SPIRE_BASE + clamp01((progress - 0.84) / 0.07) * (TOWER_HEIGHT - SPIRE_BASE);
  return Math.max(crown, spire);
}
