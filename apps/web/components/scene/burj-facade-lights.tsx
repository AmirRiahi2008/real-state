'use client';

import { useEffect, useMemo, useRef, type RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import {
  BODY_TOP,
  CROWN_TOP,
  FLOOR_COUNT,
  SETBACK_FLOORS,
  floorContour,
  floorProfile,
  floorY,
  profileContour,
  type ContourPoint,
} from './burj-profile';

type Props = {
  progress: RefObject<{ value: number }>;
  night: boolean;
  reducedMotion: boolean;
};
type Fixture = {
  position: [number, number, number];
  normal: [number, number, number];
  installedAt: number;
  phase: number;
  size: number;
  strength: number;
};

const noise = (value: number) => {
  const n = Math.sin(value * 127.1 + 311.7) * 43758.5453;
  return n - Math.floor(n);
};

/** Fixture coordinates use the tower's unscaled local contours. */
function buildFixtures() {
  const fixtures: Fixture[] = [];
  const edgeFixture = (
    contour: readonly ContourPoint[],
    segment: number,
    y: number,
    installedAt: number,
    strength = 1,
  ) => {
    const a = contour[segment];
    const b = contour[(segment + 1) % contour.length];
    const length = Math.hypot(b.x - a.x, b.z - a.z);
    if (length < 0.001) return;
    const nx = (b.z - a.z) / length;
    const nz = -(b.x - a.x) / length;
    const seed = fixtures.length + 1;
    fixtures.push({
      // The outer aluminium fin is about 0.08 units beyond the curtain wall.
      position: [(a.x + b.x) / 2 + nx * 0.087, y, (a.z + b.z) / 2 + nz * 0.087],
      normal: [nx, 0, nz],
      installedAt,
      phase: noise(seed),
      size: 0.17 + noise(seed + 43) * 0.075,
      strength: strength * (0.64 + noise(seed + 97) * 0.28),
    });
  };

  // Sparse fixtures follow the curtain wall, staggered between the three wings.
  // Their spacing leaves the existing warm interiors legible between the LEDs.
  const segments = [2, 6, 10, 14];
  for (let floor = 2; floor < FLOOR_COUNT; floor += 3) {
    const contour = floorContour(floor);
    const row = Math.floor(floor / 3);
    const installedAt = 0.38 + ((floor + 1) / FLOOR_COUNT) * 0.48;
    for (let wing = 0; wing < 3; wing++) {
      for (const slot of [0, 2]) {
        const segment = wing * 16 + segments[(row + wing + slot) % segments.length];
        edgeFixture(contour, segment, floorY(floor) + 0.14, installedAt);
      }
    }
  }

  // A pair of fixtures marks each retired wing's actual terrace edge.
  for (let tier = 1; tier < SETBACK_FLOORS.length; tier++) {
    const floor = SETBACK_FLOORS[tier];
    const contour = floorContour(floor - 1);
    const wing = (tier - 1) % 3;
    const installedAt = 0.38 + (floor / FLOOR_COUNT) * 0.48;
    for (const segment of [6, 10])
      edgeFixture(contour, wing * 16 + segment, floorY(floor) + 0.075, installedAt, 1.1);
  }

  // Match the crown's exact tier profiles and slice installation boundaries.
  const crownTiers = [
    [BODY_TOP, 63.3, 1],
    [63.3, 65.1, 0.84],
    [65.1, 67, 0.7],
    [67, 68.8, 0.56],
    [68.8, 70.4, 0.44],
    [70.4, 71.8, 0.33],
    [71.8, 73.3, 0.24],
    [73.3, CROWN_TOP, 0.16],
  ];
  const topProfile = floorProfile(FLOOR_COUNT - 1);
  crownTiers.forEach(([bottom, top, scale], tier) => {
    const contour = profileContour({
      ...topProfile,
      coreRadius: topProfile.coreRadius * scale,
      halfWidth: topProfile.halfWidth * scale,
      wingLengths: topProfile.wingLengths.map(
        (length, wing) => length * scale * (1 - ((tier + wing) % 3) * 0.035),
      ) as [number, number, number],
    });
    const sliceHeight = (top - bottom) / Math.ceil((top - bottom) / 0.3);
    const installedAt = 0.73 + ((bottom + sliceHeight - BODY_TOP) / (CROWN_TOP - BODY_TOP)) * 0.12;
    for (let wing = 0; wing < 3; wing++)
      for (const segment of [6, 10])
        edgeFixture(contour, wing * 16 + segment, bottom + 0.15, installedAt, 0.9);
  });

  // The spire is vertically scaled while being erected. Its fixtures appear
  // after erection, so none can float ahead of the installed steel taper.
  const spireSections = [
    [73.8, 76.5, 0.24, 0.19],
    [76.5, 78.5, 0.175, 0.13],
    [78.5, 80.3, 0.12, 0.075],
    [80.3, 81.6, 0.065, 0.038],
    [81.6, 82.8, 0.033, 0.007],
  ];
  for (const y of [75.6, 77.1, 78.5, 79.9, 81, 82.25]) {
    const section = spireSections.find(([bottom, top]) => y >= bottom && y <= top)!;
    const [bottom, top, radiusBottom, radiusTop] = section;
    const radius = THREE.MathUtils.lerp(radiusBottom, radiusTop, (y - bottom) / (top - bottom));
    for (let side = 0; side < 3; side++) {
      const angle = (side * Math.PI * 2) / 3 + Math.PI / 12;
      const nx = Math.cos(angle),
        nz = Math.sin(angle);
      const seed = fixtures.length + 1;
      fixtures.push({
        position: [
          nx * (radius * Math.cos(Math.PI / 12) + 0.008),
          y,
          nz * (radius * Math.cos(Math.PI / 12) + 0.008),
        ],
        normal: [nx, 0, nz],
        installedAt: 0.91,
        phase: noise(seed),
        size: 0.17 + noise(seed + 43) * 0.045,
        strength: 0.72,
      });
    }
  }

  fixtures.sort((a, b) => a.installedAt - b.installedAt);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(
      fixtures.flatMap((fixture) => fixture.position),
      3,
    ),
  );
  geometry.setAttribute(
    'normal',
    new THREE.Float32BufferAttribute(
      fixtures.flatMap((fixture) => fixture.normal),
      3,
    ),
  );
  geometry.setAttribute(
    'fixturePhase',
    new THREE.Float32BufferAttribute(
      fixtures.map((fixture) => fixture.phase),
      1,
    ),
  );
  geometry.setAttribute(
    'fixtureSize',
    new THREE.Float32BufferAttribute(
      fixtures.map((fixture) => fixture.size),
      1,
    ),
  );
  geometry.setAttribute(
    'fixtureStrength',
    new THREE.Float32BufferAttribute(
      fixtures.map((fixture) => fixture.strength),
      1,
    ),
  );
  geometry.computeBoundingSphere();
  geometry.setDrawRange(0, 0);
  return { geometry, fixtures };
}

const vertexShader = /* glsl */ `
  uniform float time;
  uniform float motion;
  uniform float pixelHeight;
  attribute float fixturePhase;
  attribute float fixtureSize;
  attribute float fixtureStrength;
  varying float vFacing;
  varying float vStrength;
  varying float vGlint;
  void main() {
    vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
    vec3 viewNormal = normalize(normalMatrix * normal);
    vFacing = smoothstep(0.025, 0.48, dot(viewNormal, normalize(-viewPosition.xyz)));
    float phase = fixturePhase * 6.283185;
    float hero = step(0.9, fract(sin(fixturePhase * 91.73) * 43758.5453));
    float wave = sin(time * (0.18 + fixturePhase * 0.09) + phase);
    float twinkle = 0.87 + 0.13 * wave * motion;
    // Only a few fixtures carry a diffraction glint at any instant.
    vGlint = mix(0.16 + hero * 0.45, 0.16 + 0.84 * pow(max(0.0, wave), 5.0), motion);
    vStrength = fixtureStrength * twinkle;
    // Diffraction is a lens effect: let a few bright lamps grow a small halo
    // while keeping the lamp itself fixed to its architectural mounting.
    float worldSize = fixtureSize * (1.8 + vGlint * 2.6) * (1.0 + hero * vGlint * 1.6);
    gl_PointSize = clamp(worldSize * projectionMatrix[1][1] * pixelHeight / (2.0 * max(0.1, -viewPosition.z)), 5.5, 24.0);
    gl_Position = projectionMatrix * viewPosition;
  }
`;

const fragmentShader = /* glsl */ `
  uniform vec3 silver;
  varying float vFacing;
  varying float vStrength;
  varying float vGlint;
  void main() {
    vec2 p = (gl_PointCoord - 0.5) * 2.0;
    float radius = length(p);
    float core = exp(-dot(p, p) * 20.0) * 0.95;
    float halo = exp(-dot(p, p) * 7.0) * 0.14;
    float rayWidth = max(fwidth(p.x) * 0.85, 0.055);
    float vertical = exp(-abs(p.x) / rayWidth - abs(p.y) * 3.2);
    float horizontal = exp(-abs(p.y) / rayWidth - abs(p.x) * 3.2);
    float star = (vertical + horizontal) * 0.52 * vGlint;
    float alpha = (core + halo + star) * (1.0 - smoothstep(0.72, 1.0, radius));
    alpha *= vFacing * vStrength;
    if (alpha < 0.008) discard;
    gl_FragColor = vec4(silver, min(0.84, alpha));
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

/** White facade fixtures. Mount once inside the tower's existing XZ scale group. */
export function BurjFacadeLights({ progress, night, reducedMotion }: Props) {
  const lights = useMemo(buildFixtures, []);
  const pixels = useMemo(() => new THREE.Vector2(), []);
  const points = useRef<THREE.Points>(null);
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader,
        uniforms: {
          time: { value: 0 },
          motion: { value: 0 },
          pixelHeight: { value: 1000 },
          silver: { value: new THREE.Color('#e4edf2').multiplyScalar(1.5) },
        },
        transparent: true,
        depthTest: true,
        depthWrite: false,
        blending: THREE.NormalBlending,
        toneMapped: true,
      }),
    [],
  );

  useEffect(
    () => () => {
      lights.geometry.dispose();
      material.dispose();
    },
    [lights, material],
  );

  useFrame(({ clock, gl }) => {
    const p = reducedMotion ? 1 : THREE.MathUtils.clamp(progress.current.value, 0, 1);
    let low = 0,
      high = lights.fixtures.length;
    while (low < high) {
      const middle = (low + high) >>> 1;
      if (lights.fixtures[middle].installedAt <= p + 1e-8) low = middle + 1;
      else high = middle;
    }
    lights.geometry.setDrawRange(0, night ? low : 0);
    if (points.current) points.current.visible = night && low > 0;
    gl.getDrawingBufferSize(pixels);
    material.uniforms.pixelHeight.value = pixels.y;
    material.uniforms.time.value = reducedMotion ? 0 : clock.elapsedTime;
    material.uniforms.motion.value = reducedMotion ? 0 : 1;
  });

  return <points ref={points} geometry={lights.geometry} material={material} renderOrder={2} />;
}
