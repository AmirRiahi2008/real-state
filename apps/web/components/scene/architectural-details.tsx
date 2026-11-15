'use client';

import { type RefObject, useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import {
  floorStructureEnd,
  floorSlabEnd,
  floorFacadeEnd,
  floorBalconyEnd,
} from './construction-timeline';
import {
  type DetailPart,
  type Vector3Tuple,
  box,
  rod,
  ring,
  finishes,
  buildAssemblies,
  accessRamp,
  entryRamp,
} from './architectural-geometries';

type Progress = RefObject<{ value: number }>;
type Props = { progress: Progress; reducedMotion: boolean; night: boolean };
type FloorSpec = {
  x: number;
  y: number;
  z: number;
  width: number;
  depth: number;
  index: number;
  wing: boolean;
};

const floors: FloorSpec[] = [
  ...Array.from({ length: 12 }, (_, index) => ({
    x: -0.4 - Math.max(0, index - 7) * 0.07,
    y: 0.32 + index * 0.66,
    z: -0.25 - Math.max(0, index - 7) * 0.03,
    width: 4.3 - Math.max(0, index - 7) * 0.18,
    depth: 3.05 - Math.max(0, index - 7) * 0.055,
    index,
    wing: false,
  })),
  ...Array.from({ length: 5 }, (_, index) => ({
    x: 3.05,
    y: 0.32 + index * 0.66,
    z: -0.5,
    width: 2.1,
    depth: 2.8,
    index,
    wing: true,
  })),
];

function smooth(value: number) {
  const t = THREE.MathUtils.clamp(value, 0, 1);
  return t * t * (3 - 2 * t);
}

function Assembly({ parts, night = false }: { parts: readonly DetailPart[]; night?: boolean }) {
  const meshes = useMemo(() => buildAssemblies(parts), [parts]);
  useEffect(() => () => meshes.forEach(({ geometry }) => geometry.dispose()), [meshes]);
  return meshes.map(({ finish, geometry }) => (
    <mesh key={finish} geometry={geometry} castShadow={finish !== 'glass'} receiveShadow>
      <meshStandardMaterial
        {...finishes[finish]}
        transparent={finish === 'glass'}
        opacity={finish === 'glass' ? 0.55 : 1}
        depthWrite={finish !== 'glass'}
        emissive={finish === 'warm' ? '#efc787' : '#000000'}
        emissiveIntensity={finish === 'warm' && night ? 0.55 : 0}
      />
    </mesh>
  ));
}

function StageAssembly({
  parts,
  start,
  end,
  progress,
  reducedMotion,
  night = false,
  hideAfter = Infinity,
}: {
  parts: readonly DetailPart[];
  start: number;
  end: number;
  progress: Progress;
  reducedMotion: boolean;
  night?: boolean;
  hideAfter?: number;
}) {
  const group = useRef<THREE.Group>(null);
  const previous = useRef(-1);
  useFrame(() => {
    if (!group.current) return;
    const p = reducedMotion ? 1 : progress.current.value;
    const value = reducedMotion ? 1 : smooth((p - start) / (end - start));
    // Opaque glazing encloses these interiors. Restore them immediately on rewind.
    group.current.visible = value > 0.005 && p < hideAfter;
    if (value === previous.current) return;
    previous.current = value;
    group.current.scale.y = Math.max(0.001, value);
  });
  return (
    <group ref={group} visible={false}>
      <Assembly parts={parts} night={night} />
    </group>
  );
}

function floorDetails(spec: FloorSpec) {
  const stairs: DetailPart[] = [],
    core: DetailPart[] = [],
    services: DetailPart[] = [],
    facade: DetailPart[] = [],
    balcony: DetailPart[] = [];
  // World-aligned cores stay continuous even when the upper facade steps back.
  const cx = (spec.wing ? 2.75 : -1.05) - spec.x;
  const cz = (spec.wing ? -0.55 : -0.3) - spec.z;
  const last = spec.index === (spec.wing ? 4 : 11);
  const rise = last ? (spec.wing ? 3.76 : 8.4) - spec.y - 0.12 : 0.66;
  const riser = rise / 18;
  for (let flight = 0; flight < 2; flight++) {
    const x = cx + (flight ? 0.28 : -0.28);
    for (let step = 0; step < 9; step++) {
      const top = (flight * 9 + step + 1) * riser;
      const z = cz + (flight ? -0.1 + step * 0.065 : 0.42 - step * 0.065);
      box(stairs, [x, top - 0.018, z], [0.42, 0.036, 0.079], 'concrete');
      // A small contrasting nosing makes the individual treads readable.
      box(stairs, [x, top + 0.001, z + (flight ? -0.037 : 0.037)], [0.42, 0.005, 0.009], 'metal');
      if (step % 4 === 0)
        rod(
          stairs,
          [x + (flight ? 0.21 : -0.21), top, z],
          [x + (flight ? 0.21 : -0.21), top + 0.22, z],
          0.008,
          'metal',
        );
    }
    rod(
      stairs,
      [x + (flight ? 0.21 : -0.21), (flight * 9 + 1) * riser + 0.22, cz + (flight ? -0.1 : 0.42)],
      [x + (flight ? 0.21 : -0.21), (flight * 9 + 9) * riser + 0.22, cz + (flight ? 0.42 : -0.1)],
      0.009,
      'metal',
    );
  }
  box(stairs, [cx, rise / 2 - 0.022, cz - 0.255], [1.1, 0.044, 0.235], 'concrete');
  box(stairs, [cx + 0.28, rise - 0.022, cz + 0.52], [0.42, 0.044, 0.18], 'concrete');
  // Side/back core walls stop at the underside of the next slab, leaving the stair opening clear.
  box(core, [cx - 0.565, 0.27, cz - 0.02], [0.06, 0.54, 1.02], 'concrete');
  box(core, [cx + 0.565, 0.27, cz - 0.16], [0.06, 0.54, 0.74], 'concrete');
  box(core, [cx, 0.27, cz - 0.51], [1.17, 0.54, 0.06], 'concrete');
  const lx = (spec.wing ? 3.63 : 0.2) - spec.x;
  const lz = (spec.wing ? -0.87 : -0.62) - spec.z;
  box(core, [lx, 0.27, lz - 0.3], [0.48, 0.54, 0.05], 'concrete');
  for (const side of [-1, 1])
    box(core, [lx + side * 0.245, 0.27, lz], [0.05, 0.54, 0.57], 'concrete');
  box(core, [lx, 0.215, lz + 0.31], [0.4, 0.43, 0.025], 'metal');
  box(core, [lx, 0.215, lz + 0.328], [0.007, 0.42, 0.006], 'dark');
  box(core, [lx + 0.29, 0.25, lz + 0.345], [0.028, 0.064, 0.018], 'dark');
  box(core, [lx + 0.29, 0.263, lz + 0.357], [0.013, 0.013, 0.004], 'warm');
  for (let i = 0; i < 3; i++)
    box(core, [lx - 0.08 + i * 0.08, 0.468, lz + 0.345], [0.038, 0.015, 0.012], 'dark');

  // Services run under the concrete ceiling, never outside the facade.
  const usable = spec.width / 2 - 0.25;
  box(services, [0, 0.43, 0.63], [spec.width - 0.5, 0.075, 0.12], 'metal');
  box(services, [usable - 0.16, 0.43, 0.1], [0.12, 0.075, 1.05], 'metal');
  for (let i = 0; i < 3; i++) {
    const y = 0.453 - i * 0.035;
    rod(
      services,
      [-usable, y, 0.83 + i * 0.045],
      [usable, y, 0.83 + i * 0.045],
      0.009,
      i === 1 ? 'blue' : 'copper',
    );
  }
  for (const x of [-usable + 0.2, usable - 0.2]) {
    rod(services, [x, 0.53, 0.57], [x, 0.37, 0.57], 0.006, 'metal');
    rod(services, [x, 0.37, 0.57], [x, 0.37, 0.73], 0.006, 'metal');
    for (let i = 0; i < 4; i++)
      box(services, [x - 0.09 + i * 0.06, 0.385, 0.7], [0.008, 0.006, 0.15], 'dark');
  }
  for (const x of [-0.08, 0.02, 0.12])
    rod(
      services,
      [x, 0, -spec.depth / 2 + 0.2],
      [x, 0.66, -spec.depth / 2 + 0.2],
      0.012,
      x < 0 ? 'blue' : 'copper',
    );
  // Recessed apartment doors face the internal corridor and sit on the finished slab.
  for (const side of [-1, 1]) {
    const doorX = side * (spec.wing ? 0.78 : 1.37);
    box(services, [doorX, 0.205, 0.28], [0.28, 0.41, 0.035], 'wood');
    for (const edge of [-1, 1])
      box(services, [doorX + edge * 0.153, 0.218, 0.3], [0.02, 0.436, 0.055], 'concrete');
    box(services, [doorX, 0.437, 0.3], [0.326, 0.02, 0.055], 'concrete');
    rod(services, [doorX + 0.1, 0.23, 0.307], [doorX + 0.1, 0.19, 0.307], 0.006, 'metal');
  }
  for (let i = 0; i < (spec.wing ? 2 : 3); i++) {
    const x = -usable + 0.4 + i * ((spec.width - 1.3) / (spec.wing ? 1 : 2));
    box(services, [x, 0.484, 0.38], [0.27, 0.012, 0.09], 'warm');
  }

  const count = spec.wing ? 4 : 7;
  const gap = (spec.width - 0.24) / count;
  const front = spec.depth / 2 + 0.021;
  box(facade, [0, 0.325, front], [spec.width - 0.18, 0.014, 0.035], 'metal');
  box(facade, [0, 0.025, front - 0.01], [spec.width - 0.18, 0.02, 0.045], 'dark');
  box(facade, [0, 0.482, front - 0.01], [spec.width - 0.18, 0.018, 0.045], 'dark');
  for (let i = 0; i < count; i++) {
    const x = -spec.width / 2 + 0.12 + (i + 0.5) * gap;
    if (!(spec.index === 0 && !spec.wing && x > 0.5 && x < 1.2)) {
      box(facade, [x, 0.412, front + 0.005], [gap - 0.075, 0.008, 0.013], 'metal');
      box(facade, [x + gap / 2 - 0.053, 0.273, front + 0.032], [0.008, 0.055, 0.012], 'dark');
    }
    // Fascia seams and projecting upper shades add depth without another glass shell.
    box(facade, [x, 0.493, front + 0.055], [gap - 0.035, 0.027, 0.13], 'concrete');
  }
  for (const side of [-1, 1]) {
    box(
      facade,
      [side * (spec.width / 2 + 0.01), 0.325, 0],
      [0.035, 0.014, spec.depth - 0.2],
      'metal',
    );
    for (let i = 0; i < 4; i++)
      box(
        facade,
        [
          side * (spec.width / 2 + 0.036),
          0.29,
          -spec.depth / 2 + 0.25 + (i * (spec.depth - 0.5)) / 3,
        ],
        [0.06, 0.39, 0.018],
        'concrete',
      );
    rod(
      facade,
      [side * (spec.width / 2 + 0.045), 0.015, -spec.depth / 2 + 0.15],
      [side * (spec.width / 2 + 0.045), 0.65, -spec.depth / 2 + 0.15],
      0.012,
      'metal',
    );
  }
  // Return glazing closes both balcony ends, at the same height as the front guard.
  for (const side of [-1, 1]) {
    const x = side * (spec.width / 2 + 0.1);
    box(balcony, [x, 0.13, spec.depth / 2 + 0.33], [0.022, 0.22, 0.61], 'glass');
    box(balcony, [x, 0.252, spec.depth / 2 + 0.33], [0.032, 0.025, 0.66], 'concrete');
    for (const z of [spec.depth / 2 + 0.03, spec.depth / 2 + 0.64])
      rod(balcony, [x, 0.015, z], [x, 0.252, z], 0.009, 'metal');
  }
  for (let i = 0; i <= count; i++) {
    const x = -spec.width / 2 + 0.1 + (i * (spec.width - 0.2)) / count;
    const worldX = x + spec.x;
    if (spec.index === 0 && !spec.wing && worldX > -0.11 && worldX < 1.01) continue;
    box(balcony, [x, 0.024, spec.depth / 2 + 0.635], [0.05, 0.018, 0.04], 'metal');
    rod(
      balcony,
      [x, 0.025, spec.depth / 2 + 0.635],
      [x, 0.245, spec.depth / 2 + 0.635],
      0.007,
      'metal',
    );
  }
  if (spec.index > 0) {
    box(
      balcony,
      [-spec.width / 2 + 0.25, 0.021, spec.depth / 2 + 0.48],
      [0.075, 0.006, 0.075],
      'dark',
    );
    for (let i = 0; i < 4; i++)
      box(
        balcony,
        [-spec.width / 2 + 0.225 + i * 0.017, 0.026, spec.depth / 2 + 0.48],
        [0.005, 0.004, 0.066],
        'metal',
      );
  }
  return { stairs, core, services, facade, balcony, last };
}

function DetailedFloor({ spec, progress, reducedMotion, night }: Props & { spec: FloorSpec }) {
  const parts = useMemo(() => floorDetails(spec), [spec]);
  const structureEnd = floorStructureEnd(spec.index, spec.wing);
  const stairsStart = parts.last ? 0.81 : floorSlabEnd(spec.index + 1, spec.wing) + 0.003;
  const serviceStart = Math.max(structureEnd + 0.01, 0.54 + spec.index * 0.006);
  const enclosed =
    spec.index === 0 && !spec.wing
      ? Infinity
      : parts.last
        ? 0.84
        : floorFacadeEnd(spec.index, spec.wing) + 0.02;
  return (
    <group position={[spec.x, spec.y + 0.12, spec.z]}>
      <StageAssembly
        parts={parts.core}
        hideAfter={enclosed}
        start={structureEnd - 0.01}
        end={structureEnd + 0.004}
        progress={progress}
        reducedMotion={reducedMotion}
      />
      <StageAssembly
        parts={parts.stairs}
        hideAfter={enclosed}
        start={stairsStart}
        end={stairsStart + 0.015}
        progress={progress}
        reducedMotion={reducedMotion}
      />
      <StageAssembly
        parts={parts.services}
        hideAfter={enclosed}
        start={serviceStart}
        end={serviceStart + 0.022}
        progress={progress}
        reducedMotion={reducedMotion}
        night={night}
      />
      <StageAssembly
        parts={parts.facade}
        start={floorFacadeEnd(spec.index, spec.wing)}
        end={floorFacadeEnd(spec.index, spec.wing) + 0.012}
        progress={progress}
        reducedMotion={reducedMotion}
      />
      <StageAssembly
        parts={parts.balcony}
        start={floorBalconyEnd(spec.index, spec.wing)}
        end={floorBalconyEnd(spec.index, spec.wing) + 0.013}
        progress={progress}
        reducedMotion={reducedMotion}
      />
    </group>
  );
}

function roofParts() {
  const parts: DetailPart[] = [];
  // Parapet guards are supported by the perimeter of the roof plate.
  const xMin = -2.55,
    xMax = 1.19,
    zMin = -1.75,
    zMax = 1.05;
  for (const z of [zMin, zMax]) {
    rod(parts, [xMin, 8.65, z], [xMax, 8.65, z], 0.012, 'metal');
    rod(parts, [xMin, 8.53, z], [xMax, 8.53, z], 0.007, 'metal');
    for (let i = 0; i <= 8; i++)
      rod(
        parts,
        [xMin + (i * (xMax - xMin)) / 8, 8.4, z],
        [xMin + (i * (xMax - xMin)) / 8, 8.65, z],
        0.009,
        'metal',
      );
  }
  for (const x of [xMin, xMax]) {
    rod(parts, [x, 8.65, zMin], [x, 8.65, zMax], 0.012, 'metal');
    for (let i = 0; i <= 6; i++)
      rod(
        parts,
        [x, 8.4, zMin + (i * (zMax - zMin)) / 6],
        [x, 8.65, zMin + (i * (zMax - zMin)) / 6],
        0.009,
        'metal',
      );
  }
  // A headhouse closes the stair opening with an actual access door, rather than a floating roof box.
  box(parts, [-1.05, 8.69, -0.79], [1.25, 0.58, 0.08], 'concrete');
  for (const side of [-1, 1])
    box(parts, [-1.05 + side * 0.625, 8.69, -0.3], [0.08, 0.58, 1.06], 'concrete');
  box(parts, [-1.05, 9.0, -0.3], [1.4, 0.07, 1.16], 'concrete');
  for (const x of [-1.49, -0.61]) box(parts, [x, 8.69, 0.23], [0.38, 0.58, 0.07], 'concrete');
  box(parts, [-1.05, 8.65, 0.255], [0.48, 0.5, 0.028], 'metal');
  box(parts, [-1.05, 8.94, 0.23], [0.5, 0.09, 0.07], 'concrete');
  rod(parts, [-0.87, 8.64, 0.279], [-0.87, 8.7, 0.279], 0.008, 'dark');
  box(parts, [-1.05, 8.97, 0.29], [0.13, 0.025, 0.02], 'warm');
  // The lift overrun is closed and roofed; its shaft is not left open on the terrace.
  box(parts, [0.2, 8.7, -0.98], [0.68, 0.6, 0.07], 'concrete');
  for (const x of [-0.145, 0.545]) box(parts, [x, 8.7, -0.62], [0.07, 0.6, 0.79], 'concrete');
  box(parts, [0.2, 8.65, -0.235], [0.54, 0.5, 0.045], 'metal');
  box(parts, [0.2, 8.98, -0.235], [0.68, 0.14, 0.07], 'concrete');
  box(parts, [0.2, 9.03, -0.62], [0.82, 0.08, 0.89], 'concrete');
  box(parts, [0.2, 8.65, -0.207], [0.008, 0.48, 0.01], 'dark');
  // Condensers sit on pads in the clear right-hand service strip, outside the pergola posts.
  for (const z of [-0.7, 0.16]) {
    box(parts, [0.89, 8.42, z], [0.55, 0.04, 0.62], 'concrete');
    box(parts, [0.89, 8.58, z], [0.49, 0.28, 0.54], 'metal');
    ring(parts, [0.89, 8.738, z], 0.118, 'dark');
    ring(parts, [0.89, 8.744, z], 0.077, 'metal');
    for (let i = 0; i < 7; i++) {
      box(parts, [0.89, 8.475 + i * 0.031, z + 0.276], [0.4, 0.01, 0.012], 'dark');
      box(parts, [0.634, 8.475 + i * 0.031, z], [0.01, 0.01, 0.43], 'dark');
    }
    for (const dx of [-0.075, 0, 0.075])
      rod(parts, [0.89 + dx, 8.748, z - 0.09], [0.89 + dx, 8.748, z + 0.09], 0.003, 'metal');
    rod(parts, [0.65, 8.47, z - 0.19], [0.52, 8.47, z - 0.19], 0.011, 'copper');
    rod(parts, [0.52, 8.47, z - 0.19], [0.52, 8.43, -1.35], 0.011, 'copper');
  }
  // Open louvres shield plant without making a solid wall around the service access.
  for (let i = 0; i < 8; i++)
    box(parts, [1.16, 8.47 + i * 0.045, -0.3], [0.035, 0.014, 1.72], 'wood');
  for (const z of [-1.17, 0.57]) box(parts, [1.16, 8.61, z], [0.045, 0.42, 0.045], 'metal');
  rod(parts, [0.38, 8.4, -1.47], [0.38, 8.78, -1.47], 0.032, 'metal');
  ring(parts, [0.38, 8.78, -1.47], 0.04, 'dark');
  box(parts, [0.38, 8.8, -1.47], [0.115, 0.025, 0.115], 'metal');
  // PV is attached above the pergola: tilted rails and feet touch the retained rafters at y=9.345.
  for (const z of [-0.52, 0.52]) {
    const railHeight = 9.47 + Math.sin(0.12) * z - 0.025;
    for (const x of [-1.9, 0.35])
      box(parts, [x, (9.345 + railHeight) / 2, z - 0.1], [0.04, railHeight - 9.345, 0.07], 'metal');
    box(parts, [-0.775, railHeight, z - 0.1], [2.4, 0.027, 0.045], 'metal');
  }
  for (const x of [-1.525, -0.775, -0.025]) {
    box(parts, [x, 9.47, -0.1], [0.68, 0.035, 1.4], 'metal', [-0.12, 0, 0]);
    box(parts, [x, 9.491, -0.1], [0.63, 0.012, 1.34], 'solar', [-0.12, 0, 0]);
    for (let cell = 1; cell < 7; cell++) {
      const z = -0.77 + cell * (1.34 / 7);
      box(
        parts,
        [x, 9.5 + Math.sin(0.12) * (z + 0.1), z],
        [0.62, 0.003, 0.007],
        'blue',
        [-0.12, 0, 0],
      );
    }
    box(parts, [x, 9.5, -0.1], [0.008, 0.004, 1.32], 'blue', [-0.12, 0, 0]);
    rod(parts, [x, 9.35, 0.68], [x, 9.35, 0.79], 0.008, 'dark');
  }
  // Wing terrace rails keep the planted roof edge enclosed, with a gap at the stair access.
  for (const z of [-1.91, 0.91]) {
    rod(parts, [2.01, 4.0, z], [4.1, 4.0, z], 0.012, 'metal');
    for (let i = 0; i <= 5; i++)
      rod(parts, [2.01 + (i * 2.09) / 5, 3.76, z], [2.01 + (i * 2.09) / 5, 4.0, z], 0.009, 'metal');
  }
  for (const x of [2.01, 4.1]) {
    rod(parts, [x, 4.0, -1.91], [x, 4.0, 0.91], 0.012, 'metal');
    for (let i = 0; i <= 6; i++)
      rod(
        parts,
        [x, 3.76, -1.91 + (i * 2.82) / 6],
        [x, 4.0, -1.91 + (i * 2.82) / 6],
        0.009,
        'metal',
      );
  }
  // One compact wing headhouse encloses the stair and lift, leaving the front terrace free.
  box(parts, [3.04, 4.055, -1.24], [1.95, 0.59, 0.07], 'concrete');
  for (const x of [2.065, 4.015]) box(parts, [x, 4.055, -0.6], [0.07, 0.59, 1.35], 'concrete');
  box(parts, [2.31, 4.055, 0.075], [0.49, 0.59, 0.07], 'concrete');
  box(parts, [3.49, 4.055, 0.075], [1.02, 0.59, 0.07], 'concrete');
  box(parts, [2.765, 3.995, 0.09], [0.4, 0.47, 0.03], 'metal');
  box(parts, [2.765, 4.29, 0.075], [0.42, 0.12, 0.07], 'concrete');
  box(parts, [3.04, 4.38, -0.6], [2.1, 0.08, 1.49], 'concrete');
  rod(parts, [2.91, 3.97, 0.115], [2.91, 4.035, 0.115], 0.007, 'dark');
  return parts;
}

function RoofSystems({ progress, reducedMotion, night }: Props) {
  const roof = useRef<THREE.Group>(null);
  const fans = useRef<THREE.InstancedMesh>(null);
  const transform = useMemo(() => new THREE.Object3D(), []);
  const parts = useMemo(() => roofParts(), []);
  useFrame(({ clock }) => {
    const p = reducedMotion ? 1 : progress.current.value;
    if (roof.current) roof.current.visible = p > 0.835;
    if (!fans.current) return;
    for (let fan = 0; fan < 2; fan++) {
      for (let blade = 0; blade < 4; blade++) {
        const angle = (reducedMotion ? 0 : clock.elapsedTime * 1.6) + (blade * Math.PI) / 2;
        transform.position.set(
          0.89 + Math.sin(angle) * 0.052,
          8.734,
          (fan ? 0.16 : -0.7) + Math.cos(angle) * 0.052,
        );
        transform.rotation.set(0, angle, 0);
        transform.scale.set(0.028, 0.006, 0.085);
        transform.updateMatrix();
        fans.current.setMatrixAt(fan * 4 + blade, transform.matrix);
      }
    }
    fans.current.instanceMatrix.needsUpdate = true;
  });
  return (
    <group ref={roof} visible={false}>
      <Assembly parts={parts} night={night} />
      <instancedMesh ref={fans} args={[undefined, undefined, 8]} frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#52635f" metalness={0.5} roughness={0.4} />
      </instancedMesh>
    </group>
  );
}

function courtyardParts() {
  const parts: DetailPart[] = [];
  // Connected paving starts at the main plinth and finishes at the street approach ramp.
  box(parts, [0.65, 0.12, 3.5], [1.5, 0.07, 3.0], 'paving');
  box(parts, [-1.85, 0.12, 3.55], [5.0, 0.07, 0.7], 'paving');
  box(parts, [-4.25, 0.12, 2.8], [0.8, 0.07, 1.5], 'paving');
  for (let row = 0; row < 11; row++)
    box(parts, [0.65, 0.156, 2.14 + row * 0.27], [1.48, 0.002, 0.007], 'dark');
  for (const x of [0.15, 0.65, 1.15]) box(parts, [x, 0.156, 3.5], [0.005, 0.002, 2.98], 'dark');
  for (let row = 0; row < 14; row++)
    box(parts, [-4.15 + row * 0.35, 0.156, 3.55], [0.006, 0.002, 0.68], 'dark');
  // Coping is higher than the water surface, and the overflow grille sits in its outer strip.
  for (const x of [4.405, 6.395]) box(parts, [x, 0.185, -0.4], [0.14, 0.04, 3.43], 'paving');
  for (const z of [-2.045, 1.245]) box(parts, [5.4, 0.185, z], [2.13, 0.04, 0.14], 'paving');
  for (let i = 0; i < 29; i++)
    box(parts, [6.403, 0.208, -1.96 + i * 0.11], [0.1, 0.006, 0.025], 'metal');
  for (const z of [-1.94, 1.14]) box(parts, [5.4, 0.157, z], [1.84, 0.03, 0.035], 'waterline');
  // Ladder rails are attached to the deck and extend down into the basin.
  for (const x of [5.12, 5.46]) {
    rod(parts, [x, 0.205, 1.41], [x, 0.49, 1.41], 0.016, 'metal');
    rod(parts, [x, 0.49, 1.41], [x, 0.49, 0.99], 0.016, 'metal');
    rod(parts, [x, 0.49, 0.99], [x, -0.05, 0.99], 0.016, 'metal');
    ring(parts, [x, 0.21, 1.41], 0.045, 'metal');
  }
  for (const y of [0.08, -0.035]) rod(parts, [5.12, y, 0.99], [5.46, y, 0.99], 0.014, 'metal');
  // Benches have separate slats, legs and back supports; their bases touch finished ground.
  for (const [x, z] of [
    [4.15, 3.35],
    [-5.65, 0.6],
  ] as const) {
    for (let slat = 0; slat < 5; slat++)
      box(parts, [x, 0.315, z - 0.16 + slat * 0.075], [1.12, 0.035, 0.055], 'wood');
    for (const dx of [-0.42, 0.42]) {
      box(parts, [x + dx, 0.195, z], [0.045, 0.22, 0.3], 'metal');
      box(parts, [x + dx, 0.42, z - 0.19], [0.035, 0.38, 0.035], 'metal');
    }
    for (let slat = 0; slat < 3; slat++)
      box(parts, [x, 0.4 + slat * 0.08, z - 0.19], [1.12, 0.055, 0.035], 'wood');
  }
  for (let stand = 0; stand < 4; stand++) {
    const z = -1.6 + stand * 0.37;
    rod(parts, [-5.9, 0.085, z], [-5.9, 0.4, z], 0.013, 'metal');
    rod(parts, [-5.9, 0.4, z], [-5.5, 0.4, z], 0.013, 'metal');
    rod(parts, [-5.5, 0.4, z], [-5.5, 0.085, z], 0.013, 'metal');
    for (const x of [-5.9, -5.5]) box(parts, [x, 0.094, z], [0.08, 0.018, 0.08], 'dark');
  }
  for (const [x, z] of [
    [-0.45, 4.7],
    [1.75, 4.7],
    [4.5, 2.8],
    [-4.75, 2.0],
  ] as const) {
    box(parts, [x, 0.235, z], [0.055, 0.3, 0.055], 'dark');
    box(parts, [x, 0.395, z], [0.065, 0.035, 0.065], 'warm');
    box(parts, [x, 0.42, z], [0.09, 0.016, 0.09], 'metal');
  }
  return parts;
}

function entranceParts() {
  const parts: DetailPart[] = [];
  // Eight equal supported risers connect courtyard paving to the raised ground-floor slab.
  for (let step = 0; step < 8; step++) {
    const top = 0.155 + (step + 1) * (0.285 / 8);
    const depth = step === 7 ? 0.26 : 0.13;
    box(parts, [0.45, (0.155 + top) / 2, 2.8 - step * 0.11], [1.12, top - 0.155, depth], 'paving');
    box(parts, [0.45, top + 0.002, 2.84 - step * 0.11], [1.1, 0.004, 0.012], 'metal');
  }
  // The step-free route is separate from the stair and has level turning landings.
  box(parts, [-0.6, (0.085 + 0.44) / 2, 2.3625], [0.8, 0.355, 1.125], 'paving');
  for (const z of [2.275, 2.925]) {
    rod(parts, [-4.05, 0.375, z], [-0.6, 0.66, z], 0.012, 'metal');
    for (let post = 0; post <= 7; post++) {
      const x = -4.05 + (post * 3.45) / 7;
      const top = 0.155 + (post * 0.285) / 7;
      rod(parts, [x, top, z], [x, top + 0.22, z], 0.009, 'metal');
      box(parts, [x, top + 0.018, z], [0.09, 0.035, 0.04], 'concrete');
    }
  }
  // Outer landing guards leave the connection to the balcony and door clear.
  rod(parts, [-1, 0.66, 1.98], [-1, 0.66, 2.925], 0.012, 'metal');
  for (const z of [2.0, 2.45, 2.925]) rod(parts, [-1, 0.44, z], [-1, 0.66, z], 0.009, 'metal');
  for (const side of [-1, 1]) {
    const x = side < 0 ? -0.14 : 1.04;
    rod(parts, [x, 0.43, 2.81], [x, 0.675, 1.94], 0.012, 'metal');
    for (const [y, z] of [
      [0.21, 2.76],
      [0.33, 2.4],
      [0.44, 2.0],
    ])
      rod(parts, [x, y, z], [x, y + 0.22, z], 0.009, 'metal');
  }
  // A supported entrance canopy attaches to the ground-floor beam below the first upper slab.
  box(parts, [-0.125, 0.91, 1.8], [2.8, 0.08, 1.45], 'concrete');
  for (const x of [-1.35, 1.1]) {
    box(parts, [x, 0.5125, 2.35], [0.055, 0.715, 0.055], 'metal');
    box(parts, [x, 0.165, 2.35], [0.14, 0.02, 0.14], 'metal');
  }
  for (let slat = 0; slat < 23; slat++)
    box(parts, [-1.42 + slat * 0.116, 0.879, 1.8], [0.047, 0.018, 1.3], 'wood');
  for (const x of [-1.0, 0, 0.9]) box(parts, [x, 0.868, 1.88], [0.075, 0.009, 0.075], 'warm');
  // Double entrance doors sit in the opening cut into the main facade by the scene shell.
  for (const x of [0.29, 0.61]) {
    box(parts, [x, 0.645, 1.289], [0.29, 0.39, 0.016], 'glass');
    for (const dx of [-0.153, 0.153])
      box(parts, [x + dx, 0.645, 1.307], [0.018, 0.414, 0.03], 'dark');
    for (const y of [0.44, 0.85]) box(parts, [x, y, 1.307], [0.318, 0.02, 0.03], 'dark');
    rod(
      parts,
      [x + (x < 0.45 ? 0.11 : -0.11), 0.59, 1.33],
      [x + (x < 0.45 ? 0.11 : -0.11), 0.7, 1.33],
      0.009,
      'metal',
    );
  }
  box(parts, [0.45, 0.445, 1.39], [0.7, 0.01, 0.16], 'dark');
  return parts;
}

function Courtyard({ progress, reducedMotion, night }: Props) {
  const root = useRef<THREE.Group>(null),
    entry = useRef<THREE.Group>(null),
    ripples = useRef<THREE.InstancedMesh>(null);
  const courtyard = useMemo(() => courtyardParts(), []);
  const entrance = useMemo(() => entranceParts(), []);
  const streetRamp = useMemo(() => accessRamp(), []);
  const lobbyRamp = useMemo(() => entryRamp(), []);
  const transform = useMemo(() => new THREE.Object3D(), []);
  useEffect(
    () => () => {
      streetRamp.dispose();
      lobbyRamp.dispose();
    },
    [streetRamp, lobbyRamp],
  );
  useFrame(({ clock }) => {
    const p = reducedMotion ? 1 : progress.current.value;
    if (root.current) root.current.visible = p >= 0.875;
    if (entry.current) entry.current.visible = p >= 0.895;
    if (!ripples.current) return;
    for (let i = 0; i < 6; i++) {
      const t = reducedMotion ? 0.6 : (clock.elapsedTime * 0.15 + i * 0.17) % 1;
      const scale = 0.07 + t * 0.25;
      transform.position.set(5.05 + (i % 2) * 0.67, 0.177, -1.25 + Math.floor(i / 2) * 0.88);
      transform.rotation.set(-Math.PI / 2, 0, 0);
      transform.scale.setScalar(scale);
      transform.updateMatrix();
      ripples.current.setMatrixAt(i, transform.matrix);
    }
    ripples.current.instanceMatrix.needsUpdate = true;
  });
  return (
    <group ref={root} visible={false}>
      <Assembly parts={courtyard} night={night} />
      <mesh geometry={streetRamp} position={[0.65, 0, 0]} receiveShadow castShadow>
        <meshStandardMaterial {...finishes.paving} />
      </mesh>
      <group ref={entry} visible={false}>
        <Assembly parts={entrance} night={night} />
        <mesh geometry={lobbyRamp} receiveShadow castShadow>
          <meshStandardMaterial {...finishes.paving} />
        </mesh>
      </group>
      <instancedMesh ref={ripples} args={[undefined, undefined, 6]} frustumCulled={false}>
        <ringGeometry args={[0.97, 1, 26]} />
        <meshBasicMaterial color="#cce6df" transparent opacity={0.22} depthWrite={false} />
      </instancedMesh>
    </group>
  );
}

/** Fine architecture is grouped by floor, reveal phase and finish to limit draw calls. */
export function ArchitecturalDetails({ progress, reducedMotion, night }: Props) {
  return (
    <>
      {floors.map((spec) => (
        <DetailedFloor
          key={`${spec.wing ? 'wing' : 'tower'}-${spec.index}`}
          spec={spec}
          progress={progress}
          reducedMotion={reducedMotion}
          night={night}
        />
      ))}
      <RoofSystems progress={progress} reducedMotion={reducedMotion} night={night} />
      <Courtyard progress={progress} reducedMotion={reducedMotion} night={night} />
    </>
  );
}
