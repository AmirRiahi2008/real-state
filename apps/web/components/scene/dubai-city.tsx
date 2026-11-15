'use client';

import { useEffect, useMemo, useRef, type RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { createCityTextures } from './dubai-city-geometry';

type Point = [number, number, number];
type PlanPoint = [number, number];
type Props = {
  night: boolean;
  progress?: RefObject<{ value: number }>;
  reducedMotion?: boolean;
};

/** Facades, street furniture and planting are merged by material, never by window. */
class GeometryBatch {
  private positions: number[] = [];
  private normals: number[] = [];
  private colors: number[] = [];
  private uvs: number[] = [];
  private color = new THREE.Color();

  quad(a: Point, b: Point, c: Point, d: Point, tint: string, uv = [0, 0, 1, 1]) {
    const ab = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    const ac = new THREE.Vector3(c[0] - a[0], c[1] - a[1], c[2] - a[2]);
    const normal = ab.cross(ac).normalize();
    this.color.set(tint);
    const corners = [a, b, c, d];
    const tex = [
      [uv[0], uv[1]],
      [uv[0], uv[3]],
      [uv[2], uv[3]],
      [uv[2], uv[1]],
    ];
    for (const index of [0, 1, 3, 1, 2, 3]) {
      this.positions.push(...corners[index]);
      this.normals.push(normal.x, normal.y, normal.z);
      this.colors.push(this.color.r, this.color.g, this.color.b);
      this.uvs.push(...tex[index]);
    }
  }

  box(x: number, y: number, z: number, w: number, h: number, d: number, tint: string, yaw = 0) {
    const transform = (px: number, py: number, pz: number): Point => [
      x + Math.cos(yaw) * px + Math.sin(yaw) * pz,
      y + py,
      z - Math.sin(yaw) * px + Math.cos(yaw) * pz,
    ];
    const points = [
      transform(-w / 2, -h / 2, -d / 2),
      transform(w / 2, -h / 2, -d / 2),
      transform(w / 2, -h / 2, d / 2),
      transform(-w / 2, -h / 2, d / 2),
      transform(-w / 2, h / 2, -d / 2),
      transform(w / 2, h / 2, -d / 2),
      transform(w / 2, h / 2, d / 2),
      transform(-w / 2, h / 2, d / 2),
    ];
    for (const face of [
      [0, 4, 5, 1],
      [1, 5, 6, 2],
      [2, 6, 7, 3],
      [3, 7, 4, 0],
      [4, 7, 6, 5],
      [3, 0, 1, 2],
    ])
      this.quad(points[face[0]], points[face[1]], points[face[2]], points[face[3]], tint);
  }

  floor(x: number, z: number, w: number, d: number, y: number, tint: string, uvScale = 1) {
    this.quad(
      [x - w / 2, y, z - d / 2],
      [x - w / 2, y, z + d / 2],
      [x + w / 2, y, z + d / 2],
      [x + w / 2, y, z - d / 2],
      tint,
      [0, 0, w * uvScale, d * uvScale],
    );
  }

  finish() {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(this.positions, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(this.normals, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(this.colors, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(this.uvs, 2));
    geometry.computeBoundingSphere();
    return geometry;
  }
}

function randomGenerator(seed: number) {
  let state = seed;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function chamfered(w: number, d: number, cut = 0.14): PlanPoint[] {
  const c = Math.min(w, d) * cut;
  return [
    [-w / 2 + c, -d / 2],
    [w / 2 - c, -d / 2],
    [w / 2, -d / 2 + c],
    [w / 2, d / 2 - c],
    [w / 2 - c, d / 2],
    [-w / 2 + c, d / 2],
    [-w / 2, d / 2 - c],
    [-w / 2, -d / 2 + c],
  ];
}

function buildCity() {
  const random = randomGenerator(71429);
  const batches = {
    glass: new GeometryBatch(),
    masonry: new GeometryBatch(),
    metal: new GeometryBatch(),
    light: new GeometryBatch(),
    roads: new GeometryBatch(),
    paving: new GeometryBatch(),
    markings: new GeometryBatch(),
    greenery: new GeometryBatch(),
    trunks: new GeometryBatch(),
    pools: new GeometryBatch(),
    water: new GeometryBatch(),
  };
  const { glass, masonry, metal, light, roads, paving, markings, greenery, trunks, pools, water } =
    batches;
  const stoneColors = ['#b9b8aa', '#adaeaa', '#d0c8b3', '#a6b1ad'];
  const glassColors = ['#a2bdc6', '#82a8b5', '#bcc9c7', '#7ca3af', '#b0b7ab', '#91b6ba'];
  let buildingCount = 0;

  const prism = (
    x: number,
    z: number,
    w: number,
    d: number,
    base: number,
    height: number,
    style: number,
    yaw: number,
    tint: string,
    seed: number,
    topScale = 1,
    shift = 0,
    slope = 0,
  ) => {
    const contour: PlanPoint[] =
      style === 4
        ? Array.from({ length: 12 }, (_, i) => [
            (Math.sin((i / 12) * Math.PI * 2) * w) / 2,
            (-Math.cos((i / 12) * Math.PI * 2) * d) / 2,
          ])
        : chamfered(w, d, style === 1 ? 0.24 : 0.1);
    const world = (point: PlanPoint, y: number, scale = 1, offset = 0): Point => [
      x + Math.cos(yaw) * (point[0] * scale + offset) + Math.sin(yaw) * point[1] * scale,
      y,
      z - Math.sin(yaw) * (point[0] * scale + offset) + Math.cos(yaw) * point[1] * scale,
    ];
    const roof = (point: PlanPoint) => base + height + (point[0] / w) * slope;
    let circumference = seed * 0.337;
    for (let i = 0; i < contour.length; i++) {
      const a = contour[i],
        b = contour[(i + 1) % contour.length];
      const edgeLength = Math.hypot(a[0] - b[0], a[1] - b[1]);
      glass.quad(
        world(a, base),
        world(a, roof(a), topScale, shift),
        world(b, roof(b), topScale, shift),
        world(b, base),
        tint,
        [
          circumference / 3,
          base / 10 + seed * 0.19,
          (circumference + edgeLength) / 3,
          (base + height) / 10 + seed * 0.19,
        ],
      );
      circumference += edgeLength;
      // A thin physical spandrel catches the light without modelling individual panes.
      for (let y = 0.62; y < height - 0.15; y += style === 5 ? 0.44 : 0.94) {
        const f = y / height;
        const scale = THREE.MathUtils.lerp(1, topScale, f) + 0.008;
        const pa = world(a, base + y, scale, shift * f);
        const pb = world(b, base + y, scale, shift * f);
        metal.quad(
          pa,
          [pa[0], pa[1] + (style === 5 ? 0.065 : 0.025), pa[2]],
          [pb[0], pb[1] + (style === 5 ? 0.065 : 0.025), pb[2]],
          pb,
          style === 5 ? '#b4c3c3' : '#6c828a',
        );
      }
      const ra = world(a, roof(a) + 0.02, topScale + 0.008, shift);
      const rb = world(b, roof(b) + 0.02, topScale + 0.008, shift);
      metal.quad(ra, [ra[0], ra[1] + 0.075, ra[2]], [rb[0], rb[1] + 0.075, rb[2]], rb, '#bdc5bf');
      if (seed % 3 === 0 || style === 3)
        light.quad(
          [ra[0], ra[1] + 0.015, ra[2]],
          [ra[0], ra[1] + 0.045, ra[2]],
          [rb[0], rb[1] + 0.045, rb[2]],
          [rb[0], rb[1] + 0.015, rb[2]],
          seed % 2 ? '#d4b77c' : '#72b5cb',
        );
    }
    // Roofs are opaque and have mechanical enclosures, parapets and service screens.
    const center: Point = world([0, 0], base + height + 0.015, topScale, shift);
    for (let i = 0; i < contour.length; i++) {
      const a = contour[i],
        b = contour[(i + 1) % contour.length];
      const pa = world(a, roof(a) + 0.015, topScale, shift);
      const pb = world(b, roof(b) + 0.015, topScale, shift);
      masonry.quad(center, pb, pa, center, '#929f9e');
    }
    const cap = world([0, 0], base + height + 0.16, topScale, shift);
    masonry.box(
      cap[0],
      cap[1],
      cap[2],
      w * topScale * 0.32,
      0.28,
      d * topScale * 0.3,
      '#84908e',
      yaw,
    );
    for (let kit = -1; kit <= 1; kit++) {
      const p = world([w * 0.22, kit * d * 0.18], base + height + 0.12, topScale, shift);
      metal.box(p[0], p[1], p[2], w * 0.13, 0.2, d * 0.12, '#6f7c7e', yaw);
    }
    if (style === 2 || style === 3) {
      for (const sign of [-1, 1]) {
        const a = world([sign * w * 0.46, 0], base + height / 2, 1, 0);
        metal.box(a[0], a[1] + 0.1, a[2], 0.07, height + 0.34, d * 0.42, '#aebdbf', yaw);
      }
    }
  };

  const palm = (x: number, z: number, scale = 1) => {
    const h = (0.65 + random() * 0.25) * scale;
    trunks.box(x, h / 2 + 0.1, z, 0.045 * scale, h, 0.045 * scale, '#7c6f53', random());
    greenery.box(x, 0.12, z, 0.32 * scale, 0.07, 0.32 * scale, '#4d6654');
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2 + x * 0.7;
      const spread = (0.35 + (i % 2) * 0.08) * scale;
      const sideX = Math.cos(a) * 0.055 * scale,
        sideZ = -Math.sin(a) * 0.055 * scale;
      const cx = x + Math.sin(a) * spread * 0.48;
      const cz = z + Math.cos(a) * spread * 0.48;
      const end: Point = [x + Math.sin(a) * spread, h + 0.04, z + Math.cos(a) * spread];
      greenery.quad(
        [x, h + 0.13, z],
        [cx - sideX, h + 0.19, cz - sideZ],
        end,
        [cx + sideX, h + 0.19, cz + sideZ],
        i % 2 ? '#4b725d' : '#66836b',
      );
    }
  };

  const building = (
    x: number,
    z: number,
    w: number,
    d: number,
    height: number,
    style: number,
    yaw = 0,
  ) => {
    // Keep a low-rise boulevard in the final camera's sightline so the landmark's
    // entrance and lake remain visible rather than disappearing behind a tower.
    if (z > 15 && Math.abs(Math.atan2(x, z) - 0.45) < 0.23) height = Math.min(height, 3.4);
    const id = buildingCount++;
    const tint = glassColors[id % glassColors.length];
    const podium = 0.45 + random() * 0.75;
    const pw = w * 1.2,
      pd = d * 1.22;
    masonry.box(x, 0.12 + podium / 2, z, pw, podium, pd, stoneColors[id % stoneColors.length], yaw);
    // Recessed storefront ribbons and lit canopy edges give each tower a street address.
    for (const side of [-1, 1]) {
      const dz = side * (pd / 2 + 0.012);
      const px = x + Math.sin(yaw) * dz,
        pz = z + Math.cos(yaw) * dz;
      glass.box(px, 0.39, pz, pw * 0.87, 0.38, 0.025, '#adc1c3', yaw);
      light.box(px, podium + 0.13, pz, pw * 0.94, 0.035, 0.035, '#e4c086', yaw);
      metal.box(px, 0.62, pz, pw * 0.9, 0.055, 0.18, '#748988', yaw);
    }
    masonry.box(x, podium + 0.15, z, pw * 1.025, 0.08, pd * 1.025, '#c0c5ba', yaw);
    const base = podium + 0.19;
    const h = height - base;
    if (style === 0) {
      prism(x, z, w, d, base, h * 0.56, style, yaw, tint, id);
      prism(
        x + Math.cos(yaw) * w * 0.06,
        z - Math.sin(yaw) * w * 0.06,
        w * 0.81,
        d * 0.84,
        base + h * 0.56,
        h * 0.28,
        style,
        yaw,
        tint,
        id,
      );
      prism(
        x + Math.cos(yaw) * w * 0.12,
        z - Math.sin(yaw) * w * 0.12,
        w * 0.59,
        d * 0.66,
        base + h * 0.84,
        h * 0.16,
        style,
        yaw,
        tint,
        id,
      );
    } else if (style === 3 && w > 2.8) {
      for (const sign of [-1, 1]) {
        const offset = sign * w * 0.29;
        prism(
          x + Math.cos(yaw) * offset,
          z - Math.sin(yaw) * offset,
          w * 0.38,
          d * 0.8,
          base,
          h * (sign === 1 ? 1 : 0.9),
          style,
          yaw,
          tint,
          id + (sign + 1),
        );
      }
      glass.box(x, base + h * 0.65, z, w * 0.6, 0.42, d * 0.58, tint, yaw);
      light.box(x, base + h * 0.65 - 0.23, z, w * 0.65, 0.025, d * 0.62, '#86bbcd', yaw);
    } else {
      prism(
        x,
        z,
        w,
        d,
        base,
        h,
        style,
        yaw,
        tint,
        id,
        style === 1 || style === 2 ? 0.76 : 1,
        style === 2 ? w * 0.15 : 0,
        style === 1 ? h * 0.075 : 0,
      );
    }
    if (height > 13 && id % 4 === 0) {
      metal.box(x, height + 0.65, z, 0.045, 1.2, 0.045, '#a6b2b1');
      light.box(x, height + 1.26, z, 0.055, 0.055, 0.055, '#e8a184');
    }
    if (id % 3 === 0) {
      greenery.box(
        x + pw * 0.35,
        podium + 0.22,
        z + pd * 0.27,
        pw * 0.2,
        0.09,
        pd * 0.32,
        '#4e6d59',
        yaw,
      );
    }
  };

  type Road = {
    horizontal: boolean;
    coordinate: number;
    start: number;
    end: number;
    width: number;
  };
  const cityRoads: Road[] = [];
  const xs = [-59, -44, -30.5, -18.2, 18.2, 30.5, 44, 59];
  const zs = [-56, -42, -29.5, -17.4, 17.4, 29.5, 43, 57];
  for (const x of xs)
    cityRoads.push({
      horizontal: false,
      coordinate: x,
      start: -62,
      end: 63,
      width: Math.abs(x) === 18.2 ? 2.8 : 2.2,
    });
  for (const z of zs)
    cityRoads.push({
      horizontal: true,
      coordinate: z,
      start: -64,
      end: 64,
      width: Math.abs(z) === 17.4 ? 2.8 : 2.2,
    });
  for (const z of [-5.8, 5.8])
    for (const sign of [-1, 1])
      cityRoads.push({
        horizontal: true,
        coordinate: z,
        start: sign < 0 ? -64 : 18.2,
        end: sign < 0 ? -18.2 : 64,
        width: 1.7,
      });

  const intersection = (road: Road, at: number, margin: number) =>
    cityRoads.some(
      (other) =>
        other.horizontal !== road.horizontal &&
        Math.abs(other.coordinate - at) < other.width / 2 + margin &&
        road.coordinate >= other.start - 0.01 &&
        road.coordinate <= other.end + 0.01,
    );
  for (const road of cityRoads) {
    const { horizontal, coordinate, start, end, width } = road;
    // A road is split at intersections, avoiding coincident asphalt surfaces.
    const breaks = [start, end];
    for (const other of cityRoads)
      if (
        other.horizontal !== horizontal &&
        coordinate >= other.start &&
        coordinate <= other.end &&
        other.coordinate > start &&
        other.coordinate < end
      )
        breaks.push(other.coordinate - other.width / 2, other.coordinate + other.width / 2);
    breaks.sort((a, b) => a - b);
    for (let i = 0; i < breaks.length - 1; i++) {
      const a = breaks[i],
        b = breaks[i + 1];
      const crossing = intersection(road, (a + b) / 2, -0.01);
      if (!horizontal && crossing) continue;
      if (horizontal) roads.floor((a + b) / 2, coordinate, b - a, width, 0.045, '#ffffff', 0.1);
      else roads.floor(coordinate, (a + b) / 2, width, b - a, 0.045, '#ffffff', 0.1);
    }
    for (let at = start + 0.6; at < end - 0.6; at += 1.3) {
      if (intersection(road, at, 0.9)) continue;
      if (horizontal) markings.floor(at, coordinate, 0.6, 0.045, 0.055, '#b9bdad');
      else markings.floor(coordinate, at, 0.045, 0.6, 0.055, '#b9bdad');
    }
    for (const side of [-1, 1]) {
      // Warm curbs and inset planting strips define each city block.
      for (let at = start + 0.8; at < end; at += 1.8) {
        if (intersection(road, at, 0.7)) continue;
        const x = horizontal ? at : coordinate + side * (width / 2 + 0.1);
        const z = horizontal ? coordinate + side * (width / 2 + 0.1) : at;
        masonry.box(
          x,
          0.083,
          z,
          horizontal ? 1.75 : 0.13,
          0.08,
          horizontal ? 0.13 : 1.75,
          '#a6aaa0',
        );
      }
      for (let at = start + 2.4; at < end - 1.2; at += 5.2) {
        if (intersection(road, at, 1.4)) continue;
        const x = horizontal ? at : coordinate + side * (width / 2 + 0.42);
        const z = horizontal ? coordinate + side * (width / 2 + 0.42) : at;
        metal.box(x, 0.45, z, 0.025, 0.76, 0.025, '#64777a');
        metal.box(
          x + (horizontal ? 0 : -side * 0.12),
          0.82,
          z + (horizontal ? -side * 0.12 : 0),
          horizontal ? 0.035 : 0.26,
          0.025,
          horizontal ? 0.26 : 0.035,
          '#8c9997',
        );
        const lx = x + (horizontal ? 0 : -side * 0.23),
          lz = z + (horizontal ? -side * 0.23 : 0);
        light.box(
          lx,
          0.795,
          lz,
          horizontal ? 0.075 : 0.15,
          0.022,
          horizontal ? 0.15 : 0.075,
          '#ffe0a2',
        );
        pools.floor(lx, lz, 2.6, 2.6, 0.063, '#ffffff');
        if (Math.abs(x) < 53 && Math.abs(z) < 52)
          palm(x + (horizontal ? 0.95 : side * 0.55), z + (horizontal ? side * 0.55 : 0.95), 0.9);
      }
    }
  }

  // Zebra crossings sit on the four Downtown junctions and selected side streets.
  for (const x of xs)
    for (const z of zs) {
      if (Math.hypot(x, z) > 66 || (Math.abs(x) > 20 && Math.abs(z) > 31 && random() > 0.5))
        continue;
      for (let i = -3; i <= 3; i++) {
        markings.floor(x + i * 0.22, z + 1.05, 0.11, 0.56, 0.058, '#d4d1bb');
        markings.floor(x + 1.05, z + i * 0.22, 0.56, 0.11, 0.058, '#d4d1bb');
      }
    }

  const block = (x0: number, x1: number, z0: number, z1: number, row: number, column: number) => {
    const cx = (x0 + x1) / 2,
      cz = (z0 + z1) / 2;
    const distance = Math.hypot(cx, cz);
    if (distance > 68) return;
    const w = x1 - x0 - 3.3,
      d = z1 - z0 - 3.3;
    if (w < 2.2 || d < 2.2) return;
    paving.floor(cx, cz, w + 0.8, d + 0.8, 0.078, (row + column) % 2 ? '#7e8b83' : '#8c948a');
    // A low waterfront district keeps a clear silhouette around the Burj.
    const waterfront = Math.abs(cx) < 17 && cz < -17 && cz > -30;
    if (waterfront) {
      const shape: PlanPoint[] = Array.from({ length: 24 }, (_, i) => {
        const a = (i / 24) * Math.PI * 2;
        return [cx + Math.cos(a) * 12.7, cz + Math.sin(a) * 2.75];
      });
      for (let i = 0; i < shape.length; i++) {
        const a = shape[i],
          b = shape[(i + 1) % shape.length];
        water.quad(
          [cx, 0.11, cz],
          [b[0], 0.11, b[1]],
          [a[0], 0.11, a[1]],
          [cx, 0.11, cz],
          '#5a9094',
        );
        light.box(a[0], 0.14, a[1], 0.12, 0.025, 0.12, '#a5cbc8');
        if (i % 2 === 0) palm(a[0] * 1.02, cz + (a[1] - cz) * 1.18, 1.05);
      }
      for (const x of [-12, -8, 8, 12]) building(x, cz - 3.55, 2.1, 1.4, 2.8 + random(), 5);
      return;
    }
    const centralStrip = w > 20;
    const count = centralStrip ? 4 : w > 9 && d > 9 ? 3 : 2;
    for (let j = 0; j < count; j++) {
      let x = cx,
        z = cz;
      if (centralStrip) {
        x = cx + (j - (count - 1) / 2) * (w / count);
        z += (j % 2 ? 1 : -1) * d * 0.15;
      } else if (count === 3) {
        x += (j === 2 ? 0 : j === 0 ? -1 : 1) * w * 0.24;
        z += (j === 2 ? 1 : -1) * d * 0.23;
      } else if (w > d) x += (j ? 1 : -1) * w * 0.245;
      else z += (j ? 1 : -1) * d * 0.245;
      const bw = centralStrip
        ? Math.min(4.6, w / count - 1.2)
        : count === 3
          ? w * 0.37
          : w > d
            ? w * 0.37
            : w * 0.6;
      const bd = count === 3 ? d * 0.34 : w > d ? d * 0.62 : d * 0.37;
      const near = distance < 34;
      const hero = row === 4 && (column === 1 || column === 5) && j === 0;
      const sampledHeight = (near ? 4.3 : 5.5) + random() ** 1.6 * (near ? 11 : 18);
      const height = hero ? (column === 1 ? 22.6 : 23.4) : sampledHeight;
      const style = hero ? (column === 1 ? 2 : 4) : (row * 5 + column * 3 + j * 2) % 6;
      building(
        x,
        z,
        Math.min(bw, 5.2),
        Math.min(bd, 5.4),
        height,
        style,
        (((column + row) % 5) - 2) * 0.025,
      );
      if (j === 0) {
        greenery.box(
          cx + w * 0.31,
          0.13,
          cz + d * 0.32,
          Math.min(1.1, w * 0.2),
          0.13,
          Math.min(1.6, d * 0.21),
          '#4d6a55',
        );
        palm(cx - w * 0.33, cz + d * 0.33, 1.1);
      }
    }
  };
  for (let zi = 0; zi < zs.length - 1; zi++)
    for (let xi = 0; xi < xs.length - 1; xi++) {
      if (xi === 3 && zi === 3) continue;
      if (zi === 3) {
        const localZ = [zs[zi], -5.8, 5.8, zs[zi + 1]];
        for (let local = 0; local < 3; local++)
          block(xs[xi], xs[xi + 1], localZ[local], localZ[local + 1], zi * 3 + local, xi);
      } else block(xs[xi], xs[xi + 1], zs[zi], zs[zi + 1], zi, xi);
    }
  // Three distinctive crowns anchor the more distant business district.
  building(-37.5, -61, 3.3, 3.2, 26.4, 2, -0.12);
  building(-44.6, -60, 4.4, 3.5, 22.4, 3, -0.08);
  building(38, -61, 3.1, 3.9, 25.1, 1, 0.16);

  const geometry = Object.fromEntries(
    Object.entries(batches).map(([name, batch]) => [name, batch.finish()]),
  ) as Record<keyof typeof batches, THREE.BufferGeometry>;
  return { ...geometry, buildingCount };
}

function createCarGeometry() {
  const body = new GeometryBatch(),
    windows = new GeometryBatch(),
    lamps = new GeometryBatch();
  body.box(0, 0.095, 0, 0.19, 0.09, 0.43, '#ffffff');
  body.box(0, 0.16, -0.025, 0.16, 0.065, 0.23, '#c1cbd0');
  body.box(0, 0.069, 0.15, 0.215, 0.075, 0.065, '#202a31');
  body.box(0, 0.069, -0.15, 0.215, 0.075, 0.065, '#202a31');
  windows.box(0, 0.166, -0.028, 0.163, 0.047, 0.19, '#263c4c');
  for (const side of [-1, 1]) {
    lamps.box(side * 0.059, 0.11, 0.22, 0.05, 0.027, 0.013, '#d6ebed');
    lamps.box(side * 0.065, 0.11, -0.22, 0.035, 0.025, 0.013, '#df6040');
  }
  return { body: body.finish(), windows: windows.finish(), lamps: lamps.finish() };
}

const CAR_COUNT = 26;

/** A compact, architectural interpretation of Downtown Dubai, at ten metres per unit. */
export function DubaiCity({ night, progress, reducedMotion = false }: Props) {
  const city = useMemo(buildCity, []);
  const textures = useMemo(createCityTextures, []);
  const cars = useMemo(createCarGeometry, []);
  const traffic = useRef<THREE.InstancedMesh>(null);
  const trafficGlass = useRef<THREE.InstancedMesh>(null);
  const trafficLights = useRef<THREE.InstancedMesh>(null);
  const headlights = useRef<THREE.InstancedMesh>(null);
  const transform = useMemo(() => new THREE.Object3D(), []);
  const windowLight = useMemo(
    () => ({ cityLightTime: { value: 0 }, cityLightMotion: { value: 0 } }),
    [],
  );
  const headlightsGeometry = useMemo(() => {
    const geometry = new THREE.PlaneGeometry(0.6, 1.15);
    geometry.rotateX(-Math.PI / 2);
    return geometry;
  }, []);

  useEffect(
    () => () => {
      Object.entries(city).forEach(([key, value]) => {
        if (key !== 'buildingCount' && value instanceof THREE.BufferGeometry) value.dispose();
      });
      Object.values(textures).forEach((texture) => texture.dispose());
      Object.values(cars).forEach((geometry) => geometry.dispose());
      headlightsGeometry.dispose();
    },
    [city, textures, cars, headlightsGeometry],
  );

  useEffect(() => {
    const palette = ['#d5d5cb', '#b2b7b6', '#304c60', '#826447', '#c0a474', '#d8dce0'];
    if (traffic.current) {
      for (let i = 0; i < CAR_COUNT; i++)
        traffic.current.setColorAt(i, new THREE.Color(palette[i % palette.length]));
      if (traffic.current.instanceColor) traffic.current.instanceColor.needsUpdate = true;
    }
  }, []);

  useFrame(({ clock }) => {
    windowLight.cityLightTime.value = clock.elapsedTime;
    windowLight.cityLightMotion.value = night && !reducedMotion ? 1 : 0;
    if (!traffic.current || !trafficGlass.current || !trafficLights.current || !headlights.current)
      return;
    const time = reducedMotion ? 0 : clock.elapsedTime;
    for (let i = 0; i < CAR_COUNT; i++) {
      const outer = i > 15;
      const rx = outer ? 30.5 : 18.2,
        rz = outer ? 29.5 : 17.4;
      const perimeter = 4 * (rx + rz);
      const reverse = i % 3 === 0;
      const at =
        ((((i * perimeter) / CAR_COUNT + (reverse ? -1 : 1) * time * (0.32 + (i % 4) * 0.08)) %
          perimeter) +
          perimeter) %
        perimeter;
      let x = 0,
        z = 0,
        angle = 0;
      if (at < rx * 2) {
        x = -rx + at;
        z = -rz;
        angle = Math.PI / 2;
      } else if (at < rx * 2 + rz * 2) {
        x = rx;
        z = -rz + at - rx * 2;
        angle = 0;
      } else if (at < rx * 4 + rz * 2) {
        x = rx - (at - rx * 2 - rz * 2);
        z = rz;
        angle = -Math.PI / 2;
      } else {
        x = -rx;
        z = rz - (at - rx * 4 - rz * 2);
        angle = Math.PI;
      }
      if (reverse) angle += Math.PI;
      const lane = 0.43;
      x += Math.cos(angle) * lane;
      z -= Math.sin(angle) * lane;
      transform.position.set(x, 0.05, z);
      transform.rotation.set(0, angle, 0);
      transform.scale.setScalar(1);
      transform.updateMatrix();
      for (const instance of [traffic.current, trafficGlass.current, trafficLights.current])
        instance.setMatrixAt(i, transform.matrix);
      transform.position.set(x + Math.sin(angle) * 0.63, 0.068, z + Math.cos(angle) * 0.63);
      transform.updateMatrix();
      headlights.current.setMatrixAt(i, transform.matrix);
    }
    for (const instance of [
      traffic.current,
      trafficGlass.current,
      trafficLights.current,
      headlights.current,
    ])
      instance.instanceMatrix.needsUpdate = true;
    // Keep traffic subdued during the construction close-ups without changing the city.
    trafficLights.current.visible = night || (progress?.current.value ?? 1) > 0.9;
  });

  return (
    <group name="downtown-dubai-city" userData={{ buildings: city.buildingCount }}>
      <mesh geometry={city.paving} receiveShadow>
        <meshStandardMaterial
          vertexColors
          color={night ? '#8e9b9c' : '#d3d0bd'}
          roughness={0.93}
          polygonOffset
          polygonOffsetFactor={-1}
          polygonOffsetUnits={-1}
        />
      </mesh>
      <mesh geometry={city.roads} receiveShadow>
        <meshStandardMaterial
          map={textures.asphalt}
          color={night ? '#8b9ba1' : '#bbc1bd'}
          roughness={0.95}
          polygonOffset
          polygonOffsetFactor={-1}
          polygonOffsetUnits={-2}
        />
      </mesh>
      <mesh geometry={city.markings}>
        <meshStandardMaterial
          vertexColors
          roughness={0.9}
          polygonOffset
          polygonOffsetFactor={-2}
          polygonOffsetUnits={-4}
        />
      </mesh>
      <mesh geometry={city.masonry} castShadow receiveShadow>
        <meshStandardMaterial
          vertexColors
          color={night ? '#a4b2b8' : '#e3dfd0'}
          roughness={0.68}
          metalness={0.12}
        />
      </mesh>
      <mesh geometry={city.glass} castShadow receiveShadow>
        <meshStandardMaterial
          vertexColors
          map={textures.glass}
          emissiveMap={textures.glow}
          emissive={night ? '#e9e2d2' : '#8ab2c4'}
          emissiveIntensity={night ? 0.56 : 0.02}
          metalness={0.72}
          roughness={night ? 0.3 : 0.23}
          envMapIntensity={1.05}
          customProgramCacheKey={() => 'city-natural-room-light-v1'}
          onBeforeCompile={(shader) => {
            Object.assign(shader.uniforms, windowLight);
            shader.vertexShader = `varying vec3 vCityRoomPosition;\n${shader.vertexShader}`.replace(
              '#include <begin_vertex>',
              '#include <begin_vertex>\nvCityRoomPosition = position;',
            );
            shader.fragmentShader =
              `uniform float cityLightTime;\nuniform float cityLightMotion;\nvarying vec3 vCityRoomPosition;\n${shader.fragmentShader}`.replace(
                '#include <emissivemap_fragment>',
                `#include <emissivemap_fragment>
              // Independent suites drift a few percent over a minute or more.
              // The window map keeps unoccupied rooms completely dark.
              vec3 roomZone = floor(vCityRoomPosition * vec3(0.7, 0.82, 0.7));
              float roomPhase = dot(roomZone, vec3(1.73, 2.31, 3.17));
              float roomDrift = sin(cityLightTime * 0.095 + roomPhase) * 0.045
                + sin(cityLightTime * 0.041 + roomPhase * 1.31) * 0.022;
              totalEmissiveRadiance *= 1.0 + roomDrift * cityLightMotion;`,
              );
          }}
        />
      </mesh>
      <mesh geometry={city.metal} castShadow>
        <meshStandardMaterial
          vertexColors
          color={night ? '#b7c6d0' : '#d2dcda'}
          metalness={0.72}
          roughness={0.34}
        />
      </mesh>
      <mesh geometry={city.light}>
        <meshBasicMaterial vertexColors color={night ? '#aaa99d' : '#7d8076'} />
      </mesh>
      <mesh geometry={city.trunks}>
        <meshStandardMaterial vertexColors roughness={0.94} />
      </mesh>
      <mesh geometry={city.greenery}>
        <meshStandardMaterial
          vertexColors
          roughness={0.85}
          side={THREE.DoubleSide}
          color={night ? '#809d8f' : '#b1bba0'}
        />
      </mesh>
      <mesh geometry={city.water} receiveShadow>
        <meshStandardMaterial
          vertexColors
          color={night ? '#325968' : '#6e9c9e'}
          emissive="#497d92"
          emissiveIntensity={night ? 0.07 : 0.02}
          metalness={0.65}
          roughness={0.21}
        />
      </mesh>
      <mesh geometry={city.pools} visible={night}>
        <meshBasicMaterial
          map={textures.pool}
          transparent
          opacity={0.3}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
          polygonOffset
          polygonOffsetFactor={-3}
          polygonOffsetUnits={-5}
        />
      </mesh>
      <instancedMesh ref={traffic} args={[cars.body, undefined, CAR_COUNT]} frustumCulled={false}>
        <meshStandardMaterial vertexColors roughness={0.35} metalness={0.55} />
      </instancedMesh>
      <instancedMesh
        ref={trafficGlass}
        args={[cars.windows, undefined, CAR_COUNT]}
        frustumCulled={false}
      >
        <meshStandardMaterial vertexColors metalness={0.7} roughness={0.15} />
      </instancedMesh>
      <instancedMesh
        ref={trafficLights}
        args={[cars.lamps, undefined, CAR_COUNT]}
        frustumCulled={false}
      >
        <meshBasicMaterial vertexColors color="#c4c5ba" />
      </instancedMesh>
      <instancedMesh
        ref={headlights}
        args={[headlightsGeometry, undefined, CAR_COUNT]}
        visible={night}
        frustumCulled={false}
      >
        <meshBasicMaterial
          map={textures.pool}
          transparent
          opacity={0.36}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
          color="#d4dbd8"
        />
      </instancedMesh>
    </group>
  );
}
