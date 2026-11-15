'use client';

import { type RefObject, useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { BurjFacadeLights } from './burj-facade-lights';
import {
  BODY_BASE,
  TOWER_XZ_SCALE,
  BODY_TOP,
  CROWN_TOP,
  FLOOR_COUNT,
  FLOOR_HEIGHT,
  SPIRE_BASE,
  TOWER_HEIGHT,
  WING_ANGLES,
  builtFloorCount,
  constructionHeight,
  floorContour,
  floorProfile,
  floorY,
  profileContour,
  type ContourPoint,
} from './burj-profile';

type V3 = [number, number, number];
type RGB = [number, number, number];
type Batch = { geometry: THREE.BufferGeometry; ends: number[]; heights: number[] };
const WHITE: RGB = [1, 1, 1];
const clamp01 = (value: number) => THREE.MathUtils.clamp(value, 0, 1);
const mechanicalFloors = new Set([40, 41, 72, 73, 109, 110, 136, 137, 154, 155]);
const roomNoise = (floor: number, suite: number) => {
  const value = Math.sin(floor * 127.1 + suite * 311.7) * 43758.5453;
  return value - Math.floor(value);
};

/** Flat arrays avoid creating thousands of Three geometry objects at startup. */
class GeometryWriter {
  positions: number[] = [];
  normals: number[] = [];
  colors: number[] = [];
  indices: number[] = [];
  ends: number[] = [];
  heights: number[] = [];

  quad(a: V3, b: V3, c: V3, d: V3, color: RGB = WHITE) {
    const offset = this.positions.length / 3;
    const normal = new THREE.Vector3()
      .crossVectors(
        new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]),
        new THREE.Vector3(c[0] - a[0], c[1] - a[1], c[2] - a[2]),
      )
      .normalize();
    for (const point of [a, b, c, d]) {
      this.positions.push(...point);
      this.normals.push(normal.x, normal.y, normal.z);
      this.colors.push(...color);
    }
    this.indices.push(offset, offset + 1, offset + 2, offset, offset + 2, offset + 3);
  }

  triangle(a: V3, b: V3, c: V3) {
    const offset = this.positions.length / 3;
    const normal = new THREE.Vector3()
      .crossVectors(
        new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]),
        new THREE.Vector3(c[0] - a[0], c[1] - a[1], c[2] - a[2]),
      )
      .normalize();
    for (const point of [a, b, c]) {
      this.positions.push(...point);
      this.normals.push(normal.x, normal.y, normal.z);
      this.colors.push(...WHITE);
    }
    this.indices.push(offset, offset + 1, offset + 2);
  }

  box(x: number, y: number, z: number, width: number, height: number, depth: number, angle = 0) {
    const point = (sx: number, sy: number, sz: number): V3 => {
      const px = (sx * width) / 2;
      const pz = (sz * depth) / 2;
      return [
        x + px * Math.cos(angle) + pz * Math.sin(angle),
        y + (sy * height) / 2,
        z - px * Math.sin(angle) + pz * Math.cos(angle),
      ];
    };
    this.quad(point(1, -1, 1), point(1, -1, -1), point(1, 1, -1), point(1, 1, 1));
    this.quad(point(-1, -1, -1), point(-1, -1, 1), point(-1, 1, 1), point(-1, 1, -1));
    this.quad(point(-1, 1, 1), point(1, 1, 1), point(1, 1, -1), point(-1, 1, -1));
    this.quad(point(-1, -1, -1), point(1, -1, -1), point(1, -1, 1), point(-1, -1, 1));
    this.quad(point(-1, -1, 1), point(1, -1, 1), point(1, 1, 1), point(-1, 1, 1));
    this.quad(point(1, -1, -1), point(-1, -1, -1), point(-1, 1, -1), point(1, 1, -1));
  }

  prism(contour: readonly ContourPoint[], y: number, height: number, caps = true) {
    contour.forEach((a, i) => {
      const b = contour[(i + 1) % contour.length];
      this.quad([a.x, y, a.z], [a.x, y + height, a.z], [b.x, y + height, b.z], [b.x, y, b.z]);
    });
    if (!caps) return;
    const triangles = THREE.ShapeUtils.triangulateShape(
      contour.map((p) => new THREE.Vector2(p.x, p.z)),
      [],
    );
    for (const triangle of triangles) {
      const [a, b, c] = triangle.map((i) => contour[i]);
      const cross = (b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x);
      const upward = cross < 0 ? [a, b, c] : [c, b, a];
      this.triangle(
        [upward[0].x, y + height, upward[0].z],
        [upward[1].x, y + height, upward[1].z],
        [upward[2].x, y + height, upward[2].z],
      );
      this.triangle(
        [upward[2].x, y, upward[2].z],
        [upward[1].x, y, upward[1].z],
        [upward[0].x, y, upward[0].z],
      );
    }
  }

  finishLevel(height: number) {
    this.ends.push(this.indices.length);
    this.heights.push(height);
  }

  build(): Batch {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(this.positions, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(this.normals, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(this.colors, 3));
    geometry.setIndex(this.indices);
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    geometry.setDrawRange(0, 0);
    return { geometry, ends: this.ends, heights: this.heights };
  }
}

function hexagon(radius: number): ContourPoint[] {
  return Array.from({ length: 6 }, (_, i) => ({
    x: Math.cos(Math.PI / 6 + (i * Math.PI) / 3) * radius,
    z: Math.sin(Math.PI / 6 + (i * Math.PI) / 3) * radius,
  }));
}

function edge(a: ContourPoint, b: ContourPoint) {
  const length = Math.hypot(b.x - a.x, b.z - a.z);
  return {
    length,
    tx: (b.x - a.x) / length,
    tz: (b.z - a.z) / length,
    nx: (b.z - a.z) / length,
    nz: -(b.x - a.x) / length,
  };
}

function perimeterStrip(
  writer: GeometryWriter,
  contour: readonly ContourPoint[],
  bottom: number,
  top: number,
  offset = 0,
  color: RGB = WHITE,
) {
  contour.forEach((a, index) => {
    const b = contour[(index + 1) % contour.length];
    const { nx, nz } = edge(a, b);
    writer.quad(
      [a.x + nx * offset, bottom, a.z + nz * offset],
      [a.x + nx * offset, top, a.z + nz * offset],
      [b.x + nx * offset, top, b.z + nz * offset],
      [b.x + nx * offset, bottom, b.z + nz * offset],
      color,
    );
  });
}

function fins(
  writer: GeometryWriter,
  contour: readonly ContourPoint[],
  bottom: number,
  top: number,
  spacing = 0.18,
) {
  contour.forEach((a, index) => {
    const b = contour[(index + 1) % contour.length];
    const { length, tx, tz, nx, nz } = edge(a, b);
    const divisions = Math.max(1, Math.ceil(length / spacing));
    for (let i = 0; i < divisions; i++) {
      const t = i / divisions;
      const x = a.x + (b.x - a.x) * t + nx * 0.025;
      const z = a.z + (b.z - a.z) * t + nz * 0.025;
      const depth = 0.055;
      const width = 0.008;
      // A projecting aluminium blade and its bright, narrow outer edge.
      writer.quad(
        [x, bottom, z],
        [x, top, z],
        [x + nx * depth, top, z + nz * depth],
        [x + nx * depth, bottom, z + nz * depth],
      );
      writer.quad(
        [x + nx * depth - tx * width, bottom, z + nz * depth - tz * width],
        [x + nx * depth - tx * width, top, z + nz * depth - tz * width],
        [x + nx * depth + tx * width, top, z + nz * depth + tz * width],
        [x + nx * depth + tx * width, bottom, z + nz * depth + tz * width],
      );
    }
  });
}

function railing(
  writer: GeometryWriter,
  points: readonly ContourPoint[],
  y: number,
  closed = false,
) {
  points.forEach((a, i) => {
    const b = points[(i + 1) % points.length];
    writer.box(a.x, y + 0.075, a.z, 0.018, 0.15, 0.018);
    if (!closed && i === points.length - 1) return;
    const { length } = edge(a, b);
    const angle = Math.atan2(-(b.z - a.z), b.x - a.x);
    for (const height of [0.055, 0.15]) {
      writer.box((a.x + b.x) / 2, y + height, (a.z + b.z) / 2, length, 0.014, 0.014, angle);
    }
  });
}

function buildTower() {
  const slabs = new GeometryWriter();
  const frame = new GeometryWriter();
  const glass = new GeometryWriter();
  const aluminium = new GeometryWriter();
  const accents = new GeometryWriter();
  const windows = new GeometryWriter();
  const roomPhases: number[] = [];
  const roomUvs: number[] = [];
  const crown = new GeometryWriter();
  const crownMetal = new GeometryWriter();
  const spire = new GeometryWriter();
  const beacons = new GeometryWriter();

  for (let index = 0; index < FLOOR_COUNT; index++) {
    const profile = floorProfile(index);
    const contour = floorContour(index);
    const y = floorY(index);
    const top = floorY(index + 1);
    const mechanical = mechanicalFloors.has(index);
    slabs.prism(contour, y, 0.055);
    frame.prism(hexagon(profile.coreRadius * 0.8), y + 0.055, FLOOR_HEIGHT - 0.055);

    WING_ANGLES.forEach((angle, wing) => {
      const length = profile.wingLengths[wing] * 0.77;
      const center = length * 0.5;
      frame.box(
        Math.cos(angle) * center,
        (y + top) / 2,
        Math.sin(angle) * center,
        length,
        FLOOR_HEIGHT - 0.035,
        0.115,
        -angle,
      );
      for (const side of [-1, 1]) {
        const x =
          Math.cos(angle) * (length + 0.12) - Math.sin(angle) * profile.halfWidth * 0.56 * side;
        const z =
          Math.sin(angle) * (length + 0.12) + Math.cos(angle) * profile.halfWidth * 0.56 * side;
        frame.box(x, (y + top) / 2, z, 0.105, FLOOR_HEIGHT, 0.105, -angle);
      }
      frame.box(
        Math.cos(angle) * profile.wingLengths[wing] * 0.95,
        (y + top) / 2,
        Math.sin(angle) * profile.wingLengths[wing] * 0.95,
        0.1,
        FLOOR_HEIGHT,
        0.1,
        -angle,
      );
    });

    contour.forEach((a, segment) => {
      const b = contour[(segment + 1) % contour.length];
      const { nx, nz, length, tx, tz } = edge(a, b);
      // Slight panel-to-panel differences retain a silver-blue curtain wall
      // even without an expensive environment-map render pass.
      const variation = 0.93 + ((segment * 17 + index * 3) % 9) * 0.011;
      const tint: RGB = mechanical
        ? [0.29, 0.39, 0.43]
        : [0.68 * variation, 0.84 * variation, 0.94 * variation];
      glass.quad(
        [a.x + nx * 0.022, y + 0.055, a.z + nz * 0.022],
        [a.x + nx * 0.022, top - 0.012, a.z + nz * 0.022],
        [b.x + nx * 0.022, top - 0.012, b.z + nz * 0.022],
        [b.x + nx * 0.022, y + 0.055, b.z + nz * 0.022],
        tint,
      );
      // Occupied suites share a little spill between neighbouring panes rather
      // than lighting every other panel like an LED display.
      const suite = Math.floor(segment / 2);
      const occupied = roomNoise(Math.floor(index / 2), suite) > 0.81;
      if (!mechanical && occupied && length > 0.14) {
        const cx = (a.x + b.x) / 2 + nx * 0.026;
        const cz = (a.z + b.z) / 2 + nz * 0.026;
        const half = Math.min(length * 0.41, 0.14);
        const bottom = y + 0.1;
        const brightness = 0.38 + roomNoise(index, suite + 71) * 0.5;
        windows.quad(
          [cx - tx * half, bottom, cz - tz * half],
          [cx - tx * half, bottom + 0.22, cz - tz * half],
          [cx + tx * half, bottom + 0.22, cz + tz * half],
          [cx + tx * half, bottom, cz + tz * half],
          [brightness, brightness * 0.88, brightness * 0.72],
        );
        const phase = roomNoise(Math.floor(index / 2), suite + 149);
        roomPhases.push(phase, phase, phase, phase);
        roomUvs.push(0, 0, 0, 1, 1, 1, 1, 0);
      }
    });
    fins(aluminium, contour, y + 0.045, top + 0.006);
    perimeterStrip(aluminium, contour, y + 0.016, y + 0.049, 0.044);
    if (mechanical) {
      for (const offset of [0.12, 0.22, 0.31])
        perimeterStrip(aluminium, contour, y + offset, y + offset + 0.012, 0.048);
    }
    if (
      index === 0 ||
      index === FLOOR_COUNT - 1 ||
      (mechanical && !mechanicalFloors.has(index - 1))
    ) {
      perimeterStrip(accents, contour, top - 0.033, top - 0.008, 0.064);
    }

    // The retired wing tip becomes a real terrace at every alternating setback.
    if (index > 0 && profile.tier !== floorProfile(index - 1).tier) {
      const wing = (profile.tier - 1) % 3;
      const previous = floorContour(index - 1);
      perimeterStrip(accents, previous, y + 0.015, y + 0.043, 0.064);
      const terrace = previous.slice(wing * 16 + 3, wing * 16 + 14);
      slabs.prism(previous, y - 0.035, 0.045);
      railing(aluminium, terrace, y + 0.015);
    }
    if (index === FLOOR_COUNT - 1) {
      slabs.prism(contour, BODY_TOP - 0.03, 0.05);
      railing(aluminium, contour, BODY_TOP + 0.02, true);
    }
    for (const writer of [slabs, frame, glass, aluminium, windows, accents])
      writer.finishLevel(top);
  }

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
    const profile = {
      ...topProfile,
      coreRadius: topProfile.coreRadius * scale,
      halfWidth: topProfile.halfWidth * scale,
      wingLengths: topProfile.wingLengths.map(
        (length, wing) => length * scale * (1 - ((tier + wing) % 3) * 0.035),
      ) as [number, number, number],
    };
    const contour = profileContour(profile);
    const slices = Math.ceil((top - bottom) / 0.3);
    for (let slice = 0; slice < slices; slice++) {
      const y = bottom + ((top - bottom) * slice) / slices;
      const end = bottom + ((top - bottom) * (slice + 1)) / slices;
      perimeterStrip(crown, contour, y, end, 0, [0.75, 0.86, 0.93]);
      fins(crownMetal, contour, y, end, 0.13);
      if (slice === 0) {
        crownMetal.prism(contour, y, 0.035);
        perimeterStrip(crownMetal, contour, y + 0.05, y + 0.08, 0.025);
      }
      if (slice === slices - 1) {
        crownMetal.prism(contour, end - 0.015, 0.025);
        perimeterStrip(accents, contour, end - 0.032, end - 0.006, 0.04);
        accents.finishLevel(end);
      }
      crown.finishLevel(end);
      crownMetal.finishLevel(end);
    }
  });

  const spireSections = [
    [SPIRE_BASE, 76.5, 0.24, 0.19],
    [76.5, 78.5, 0.175, 0.13],
    [78.5, 80.3, 0.12, 0.075],
    [80.3, 81.6, 0.065, 0.038],
    [81.6, TOWER_HEIGHT, 0.033, 0.007],
  ];
  spireSections.forEach(([bottom, top, radiusBottom, radiusTop]) => {
    for (let side = 0; side < 12; side++) {
      const a = (side * Math.PI * 2) / 12;
      const b = ((side + 1) * Math.PI * 2) / 12;
      spire.quad(
        [Math.cos(a) * radiusBottom, bottom - SPIRE_BASE, Math.sin(a) * radiusBottom],
        [Math.cos(a) * radiusTop, top - SPIRE_BASE, Math.sin(a) * radiusTop],
        [Math.cos(b) * radiusTop, top - SPIRE_BASE, Math.sin(b) * radiusTop],
        [Math.cos(b) * radiusBottom, bottom - SPIRE_BASE, Math.sin(b) * radiusBottom],
      );
    }
  });
  spire.finishLevel(TOWER_HEIGHT);
  for (const y of [63.3, 70.4, 75.5, 81.6]) {
    const radius = y > 75 ? 0.045 : 0.25;
    beacons.box(radius, y, radius, 0.045, 0.045, 0.045);
    beacons.box(-radius, y, -radius, 0.045, 0.045, 0.045);
    beacons.finishLevel(y);
  }
  const interiors = windows.build();
  interiors.geometry.setAttribute('roomPhase', new THREE.Float32BufferAttribute(roomPhases, 1));
  interiors.geometry.setAttribute('roomUv', new THREE.Float32BufferAttribute(roomUvs, 2));
  return {
    slabs: slabs.build(),
    frame: frame.build(),
    glass: glass.build(),
    aluminium: aluminium.build(),
    accents: accents.build(),
    windows: interiors,
    crown: crown.build(),
    crownMetal: crownMetal.build(),
    spire: spire.build(),
    beacons: beacons.build(),
  };
}

function buildTemporaryWorks() {
  const core = new GeometryWriter();
  const shutters = new GeometryWriter();
  const platforms = new GeometryWriter();
  const rebar = new GeometryWriter();
  core.prism(hexagon(0.8), 0, 0.92);
  perimeterStrip(shutters, hexagon(0.83), 0.28, 0.87);
  for (const y of [0.1, 0.9]) {
    platforms.prism(hexagon(1.34), y - 0.035, 0.035);
    railing(platforms, hexagon(1.3), y, true);
    for (let i = 0; i < 6; i++) {
      const angle = (i * Math.PI) / 3;
      platforms.box(Math.cos(angle) * 0.99, y + 0.2, Math.sin(angle) * 0.99, 0.025, 0.4, 0.025);
    }
  }
  for (let i = 0; i < 24; i++) {
    const angle = (i * Math.PI * 2) / 24;
    rebar.box(
      Math.cos(angle) * 0.67,
      1.05,
      Math.sin(angle) * 0.67,
      0.012,
      0.55 + (i % 3) * 0.035,
      0.012,
    );
  }
  const result = {
    core: core.build(),
    shutters: shutters.build(),
    platforms: platforms.build(),
    rebar: rebar.build(),
  };
  for (const batch of Object.values(result)) batch.geometry.setDrawRange(0, Infinity);
  return result;
}

function showLevels(mesh: THREE.Mesh | null, batch: Batch, count: number) {
  const end = count > 0 ? (batch.ends[Math.min(batch.ends.length, count) - 1] ?? 0) : 0;
  batch.geometry.setDrawRange(0, end);
  if (mesh) mesh.visible = end > 0;
}

function countBelow(batch: Batch, height: number) {
  let low = 0;
  let high = batch.heights.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if (batch.heights[middle] <= height + 1e-6) low = middle + 1;
    else high = middle;
  }
  return low;
}

/**
 * A reversible architectural construction model, driven only by the scroll clock.
 * All 163 floors share five merged meshes; no React updates happen while scrubbing.
 */
export function BurjTower({
  progress,
  reducedMotion,
  night,
}: {
  progress: RefObject<{ value: number }>;
  reducedMotion: boolean;
  night: boolean;
}) {
  const geometry = useMemo(buildTower, []);
  const temporary = useMemo(buildTemporaryWorks, []);
  const slabRef = useRef<THREE.Mesh>(null);
  const frameRef = useRef<THREE.Mesh>(null);
  const glassRef = useRef<THREE.Mesh>(null);
  const metalRef = useRef<THREE.Mesh>(null);
  const accentsRef = useRef<THREE.Mesh>(null);
  const windowsRef = useRef<THREE.Mesh>(null);
  const crownRef = useRef<THREE.Mesh>(null);
  const crownMetalRef = useRef<THREE.Mesh>(null);
  const spireRef = useRef<THREE.Mesh>(null);
  const beaconRef = useRef<THREE.Mesh>(null);
  const frontierRef = useRef<THREE.Group>(null);
  const coreWorkRef = useRef<THREE.Group>(null);
  const interiorLight = useMemo(() => ({ time: { value: 0 } }), []);
  const interiorShader = useMemo(
    () => (shader: THREE.WebGLProgramParametersWithUniforms) => {
      shader.uniforms.interiorTime = interiorLight.time;
      shader.vertexShader = shader.vertexShader
        .replace(
          '#include <common>',
          `#include <common>
          attribute float roomPhase;
          attribute vec2 roomUv;
          varying float vRoomPhase;
          varying vec2 vRoomUv;`,
        )
        .replace(
          '#include <begin_vertex>',
          `#include <begin_vertex>
          vRoomPhase = roomPhase;
          vRoomUv = roomUv;`,
        );
      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
          uniform float interiorTime;
          varying float vRoomPhase;
          varying vec2 vRoomUv;`,
        )
        .replace(
          '#include <emissivemap_fragment>',
          `#include <emissivemap_fragment>
          float activity = sin(interiorTime * (0.045 + vRoomPhase * 0.025) + vRoomPhase * 6.283185);
          float occupied = 0.28 + 0.72 * smoothstep(-0.55, 0.25, activity);
          vec2 edgeLight = smoothstep(vec2(0.0), vec2(0.18), vRoomUv)
            * smoothstep(vec2(0.0), vec2(0.18), 1.0 - vRoomUv);
          totalEmissiveRadiance *= vColor.rgb * occupied * edgeLight.x * edgeLight.y;`,
        );
    },
    [interiorLight],
  );

  useEffect(
    () => () => {
      for (const batch of [...Object.values(geometry), ...Object.values(temporary)])
        batch.geometry.dispose();
    },
    [geometry, temporary],
  );

  useFrame(({ clock }) => {
    interiorLight.time.value = reducedMotion ? 0 : clock.elapsedTime;
    const p = reducedMotion ? 1 : clamp01(progress.current.value);
    const floors = builtFloorCount(p);
    const facadeFloors = Math.min(
      floors,
      Math.floor(clamp01((p - 0.38) / 0.48) * FLOOR_COUNT + 1e-8),
    );
    showLevels(slabRef.current, geometry.slabs, floors);
    showLevels(frameRef.current, geometry.frame, floors);
    showLevels(glassRef.current, geometry.glass, facadeFloors);
    showLevels(metalRef.current, geometry.aluminium, facadeFloors);
    showLevels(windowsRef.current, geometry.windows, night ? facadeFloors : 0);
    const crownHeight = BODY_TOP + clamp01((p - 0.73) / 0.12) * (CROWN_TOP - BODY_TOP);
    const illuminatedHeight = p < 0.86 ? floorY(facadeFloors) : crownHeight;
    showLevels(
      accentsRef.current,
      geometry.accents,
      night ? countBelow(geometry.accents, illuminatedHeight) : 0,
    );
    showLevels(crownRef.current, geometry.crown, countBelow(geometry.crown, crownHeight));
    showLevels(
      crownMetalRef.current,
      geometry.crownMetal,
      countBelow(geometry.crownMetal, crownHeight),
    );
    const spireProgress = clamp01((p - 0.84) / 0.07);
    if (spireRef.current) {
      spireRef.current.visible = spireProgress > 0;
      spireRef.current.scale.y = Math.max(0.0001, spireProgress);
      geometry.spire.geometry.setDrawRange(0, Infinity);
    }
    showLevels(
      beaconRef.current,
      geometry.beacons,
      night && p > 0.84 ? countBelow(geometry.beacons, constructionHeight(p)) : 0,
    );
    if (frontierRef.current) {
      frontierRef.current.visible = p > 0.262 && p < 0.725;
      frontierRef.current.position.y = floorY(Math.max(0, floors - 1)) + 0.005;
      const profile = floorProfile(Math.min(FLOOR_COUNT - 1, floors));
      const size =
        p < 0.72 ? profile.coreRadius : Math.max(0.15, 0.52 * (1 - clamp01((p - 0.73) / 0.13)));
      frontierRef.current.scale.set(size, 1, size);
    }
    if (coreWorkRef.current) coreWorkRef.current.visible = p < 0.725;
  });

  return (
    <group
      name="Burj Khalifa · 828 m · procedural Y-plan"
      scale={[TOWER_XZ_SCALE, 1, TOWER_XZ_SCALE]}
    >
      <mesh ref={slabRef} geometry={geometry.slabs.geometry} castShadow receiveShadow>
        <meshStandardMaterial color="#d2d0c6" roughness={0.82} />
      </mesh>
      <mesh ref={frameRef} geometry={geometry.frame.geometry} castShadow receiveShadow>
        <meshStandardMaterial color="#b9b7ab" roughness={0.9} />
      </mesh>
      <mesh ref={glassRef} geometry={geometry.glass.geometry} castShadow receiveShadow>
        <meshStandardMaterial
          color={night ? '#829ba8' : '#b3ccd8'}
          vertexColors
          metalness={0.46}
          roughness={0.23}
          emissive="#547b94"
          emissiveIntensity={night ? 0.02 : 0.035}
        />
      </mesh>
      <mesh ref={metalRef} geometry={geometry.aluminium.geometry}>
        <meshStandardMaterial
          color="#c5d4db"
          metalness={0.62}
          roughness={0.25}
          side={THREE.DoubleSide}
        />
      </mesh>
      <mesh ref={windowsRef} geometry={geometry.windows.geometry}>
        <meshStandardMaterial
          color="#655f52"
          vertexColors
          emissive="#edcca3"
          emissiveIntensity={0.42}
          roughness={0.5}
          onBeforeCompile={interiorShader}
          customProgramCacheKey={() => 'burj-interior-light-v1'}
        />
      </mesh>
      <mesh ref={accentsRef} geometry={geometry.accents.geometry}>
        <meshStandardMaterial
          color="#b6c4d0"
          emissive="#d4e5f2"
          emissiveIntensity={1.15}
          roughness={0.4}
        />
      </mesh>
      <BurjFacadeLights progress={progress} night={night} reducedMotion={reducedMotion} />
      <mesh ref={crownRef} geometry={geometry.crown.geometry} castShadow receiveShadow>
        <meshStandardMaterial color="#aec5d3" vertexColors metalness={0.55} roughness={0.24} />
      </mesh>
      <mesh ref={crownMetalRef} geometry={geometry.crownMetal.geometry}>
        <meshStandardMaterial
          color="#d0dce0"
          metalness={0.65}
          roughness={0.23}
          side={THREE.DoubleSide}
        />
      </mesh>
      <mesh
        ref={spireRef}
        geometry={geometry.spire.geometry}
        position={[0, SPIRE_BASE, 0]}
        castShadow
      >
        <meshStandardMaterial
          color="#d9e1e5"
          metalness={0.67}
          roughness={0.22}
          emissive="#b7d2e8"
          emissiveIntensity={night ? 0.16 : 0}
        />
      </mesh>
      <mesh ref={beaconRef} geometry={geometry.beacons.geometry}>
        <meshBasicMaterial color="#ff5b45" toneMapped={false} />
      </mesh>
      <group ref={frontierRef} name="Climbing core formwork and safety decks">
        <group ref={coreWorkRef}>
          <mesh geometry={temporary.core.geometry} castShadow>
            <meshStandardMaterial color="#c6c1ae" roughness={0.95} />
          </mesh>
          <mesh geometry={temporary.shutters.geometry} castShadow>
            <meshStandardMaterial
              color="#c58d41"
              roughness={0.7}
              metalness={0.18}
              side={THREE.DoubleSide}
            />
          </mesh>
          <mesh geometry={temporary.rebar.geometry} castShadow>
            <meshStandardMaterial color="#605c53" roughness={0.7} metalness={0.5} />
          </mesh>
        </group>
        <mesh geometry={temporary.platforms.geometry} castShadow>
          <meshStandardMaterial color="#588794" roughness={0.62} metalness={0.25} />
        </mesh>
      </group>
    </group>
  );
}
