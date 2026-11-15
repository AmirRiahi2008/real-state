'use client';

import {
  Component,
  memo,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { BurjTower } from './burj-tower';
import { BurjSiteLife } from './burj-site-life';
import { BurjEnvironment } from './burj-environment';
import { DubaiCity } from './dubai-city';
import { MIXER_STOP } from './burj-site-motion';
import { constructionPhase } from './construction-timeline';
import {
  builtFloorCount,
  constructionHeight,
  floorContour,
  floorY,
  FLOOR_COUNT,
  TOWER_HEIGHT,
  TOWER_XZ_SCALE,
} from './burj-profile';

type Progress = { value: number };
type Props = { progress: RefObject<Progress>; reducedMotion: boolean; night: boolean };
const ease = (p: number, from: number, to: number) => THREE.MathUtils.smoothstep(p, from, to);

/** Native scroll is the construction clock. Camera cuts are continuous and reversible. */
const SHOTS = [
  // progress, orbit, radius, camera y, look-at y, focus x, focus z
  [0, 0.53, 140, 47, 41, 0, 0],
  [0.055, 1.4, 2.8, 0.65, 0.12, 2.1, 9.65],
  [0.115, -0.08, 9.2, 4.7, -0.25, 0.6, 5],
  [0.185, 0.62, 15.8, 10.6, -1.1, 0, 0],
  [0.218, 0.65, 2.5, 0.8, 0.18, MIXER_STOP[0], MIXER_STOP[2]],
  [0.25, 1.1, 3.8, 0.9, 0.2, 2.1, 9.65],
  [0.31, 0.82, 21, 11, 4.4, 0, 0],
  [0.4, 0.46, 30, 24, 15, 0, 0],
  [0.53, -0.38, 47, 47, 33, 0, 0],
  [0.62, 0.48, 39, 58, 45, 0, 0],
  [0.71, 0.86, 77, 61, 37, 0, 0],
  [0.795, 1.13, 43, 75, 66, 0, 0],
  [0.865, 0.78, 38, 84, 75, 0, 0],
  [0.925, 0.57, 132, 50, 40, 0, 0],
  [1, 0.35, 140, 48, 40.2, 0, 0],
] as const;

function Blueprint({ progress, reducedMotion }: Omit<Props, 'night'>) {
  const material = useRef<THREE.LineBasicMaterial>(null);
  const geometry = useMemo(() => {
    const points: number[] = [];
    const segment = (a: number[], b: number[]) => points.push(...a, ...b);
    for (let index = 0; index <= FLOOR_COUNT; index++) {
      const contour = floorContour(Math.min(index, FLOOR_COUNT - 1));
      if (index % 7 === 0)
        for (let i = 0; i < contour.length; i++) {
          const a = contour[i],
            b = contour[(i + 1) % contour.length];
          segment([a.x, floorY(index), a.z], [b.x, floorY(index), b.z]);
        }
      if (index < FLOOR_COUNT) {
        const next = floorContour(Math.min(index + 1, FLOOR_COUNT - 1));
        for (let i = 0; i < contour.length; i += 4)
          segment(
            [contour[i].x, floorY(index), contour[i].z],
            [next[i].x, floorY(index + 1), next[i].z],
          );
      }
    }
    const topContour = floorContour(FLOOR_COUNT - 1);
    const crownSteps = [
      [61.4, 1],
      [63.7, 0.88],
      [66.2, 0.72],
      [68.8, 0.56],
      [70.4, 0.44],
      [71.8, 0.33],
      [73.3, 0.24],
      [75, 0.16],
    ];
    crownSteps.forEach(([height, scale], index) => {
      for (let i = 0; i < topContour.length; i += 4) {
        const point = topContour[i];
        if (index > 0) {
          const [previousHeight, previousScale] = crownSteps[index - 1];
          segment(
            [point.x * previousScale, previousHeight, point.z * previousScale],
            [point.x * scale, height, point.z * scale],
          );
        }
      }
    });
    for (const side of [-1, 1]) segment([side * 0.19, 75, 0], [side * 0.007, TOWER_HEIGHT, 0]);
    const result = new THREE.BufferGeometry();
    result.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
    return result;
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useFrame(() => {
    if (material.current)
      material.current.opacity = reducedMotion
        ? 0
        : (1 - ease(progress.current.value, 0.015, 0.095)) * 0.68;
  });
  return (
    <lineSegments geometry={geometry} scale={[TOWER_XZ_SCALE, 1, TOWER_XZ_SCALE]}>
      <lineBasicMaterial
        ref={material}
        color="#587e84"
        transparent
        opacity={0.68}
        depthWrite={false}
      />
    </lineSegments>
  );
}

function CameraAndTelemetry({
  progress,
  reducedMotion,
  host,
}: {
  progress: RefObject<Progress>;
  reducedMotion: boolean;
  host: RefObject<HTMLDivElement | null>;
}) {
  const { camera, size, gl } = useThree();
  const target = useMemo(() => new THREE.Vector3(), []);
  const nextPosition = useMemo(() => new THREE.Vector3(), []);
  const nextTarget = useMemo(() => new THREE.Vector3(), []);
  const state = useRef({ percent: -1, count: -1, stage: '', last: 0 });
  const initialized = useRef(false);
  useFrame(({ pointer, clock }, delta) => {
    const p = reducedMotion ? 1 : THREE.MathUtils.clamp(progress.current.value, 0, 1);
    let shot = 0;
    for (let i = 1; i < SHOTS.length - 1; i++) if (p >= SHOTS[i][0]) shot = i;
    const a = SHOTS[shot],
      b = SHOTS[shot + 1],
      mix = ease(p, a[0], b[0]);
    const sample = (n: number) => THREE.MathUtils.lerp(a[n], b[n], mix);
    const mobile = size.width < 700;
    const phase = constructionPhase(p);
    const radius = sample(2) * (mobile ? 1.25 : 1);
    const wide = radius > 65;
    const composition = mobile
      ? 0
      : (phase.align === 'right' ? 1 : -1) * (wide ? 18 : radius * 0.11);
    const fx = sample(5),
      fz = sample(6);
    const x =
      fx +
      Math.sin(sample(1)) * radius +
      (reducedMotion ? 0 : pointer.x * Math.min(0.15, radius * 0.003));
    const z = fz + Math.cos(sample(1)) * radius;
    const y = sample(3) + (mobile && wide ? 3 : 0);
    const damping =
      initialized.current && !reducedMotion ? 1 - Math.exp(-Math.min(delta, 0.05) * 5) : 1;
    camera.position.lerp(nextPosition.set(x, y, z), damping);
    target.lerp(
      nextTarget.set(
        fx + composition * Math.cos(sample(1)),
        sample(4),
        fz - composition * Math.sin(sample(1)),
      ),
      damping,
    );
    camera.lookAt(target);
    initialized.current = true;
    if (camera instanceof THREE.PerspectiveCamera) {
      // Let the completed landmark breathe: both the spire and the waterfront
      // stay inside the frame while construction retains its tighter closeups.
      const fov = mobile ? 43 : 34 + ease(p, 0.865, 0.925) * 4;
      const near = Math.max(0.04, Math.min(3, camera.position.distanceTo(target) * 0.015));
      if (camera.fov !== fov || Math.abs(camera.near - near) > 0.005) {
        camera.near = near;
        camera.fov = fov;
        camera.updateProjectionMatrix();
      }
    }
    const percent = Math.round(p * 100),
      count = builtFloorCount(p),
      stage = reducedMotion ? 'complete' : phase.id;
    const el = host.current;
    if (!el) return;
    const settled =
      camera.position.distanceTo(nextPosition) < 0.025 && target.distanceTo(nextTarget) < 0.025;
    if (el.dataset.cameraSettled !== String(settled)) el.dataset.cameraSettled = String(settled);
    if (state.current.percent !== percent) el.dataset.buildProgress = String(percent);
    if (state.current.count !== count) el.dataset.builtFloors = String(count);
    if (state.current.stage !== stage) el.dataset.sceneStage = stage;
    if (clock.elapsedTime - state.current.last > 1) {
      el.dataset.drawCalls = String(gl.info.render.calls);
      el.dataset.triangles = String(gl.info.render.triangles);
      el.dataset.depthNear = String(camera.near);
      el.dataset.craneVisible = String(p > 0.263 && p < 0.73);
      el.dataset.constructionHeight = String(Math.round(constructionHeight(p) * 10));
      el.dataset.cameraShot = wide
        ? 'skyline'
        : radius < 12
          ? 'site-closeup'
          : 'construction-detail';
      state.current.last = clock.elapsedTime;
    }
    el.dataset.sceneReady = 'true';
    state.current.percent = percent;
    state.current.count = count;
    state.current.stage = stage;
  });
  return null;
}

function Lighting({ progress, reducedMotion, night }: Props) {
  const { scene, gl } = useThree();
  const sun = useRef<THREE.DirectionalLight>(null);
  const palette = useMemo(
    () => ({
      day: new THREE.Color('#e9e9e2'),
      dusk: new THREE.Color('#ead8c3'),
      night: new THREE.Color('#14252e'),
    }),
    [],
  );
  useEffect(() => {
    const room = new RoomEnvironment();
    const generator = new THREE.PMREMGenerator(gl);
    const environment = generator.fromScene(room, 0.04);
    const previous = scene.environment;
    scene.environment = environment.texture;
    room.dispose();
    generator.dispose();
    return () => {
      scene.environment = previous;
      environment.dispose();
    };
  }, [scene, gl]);
  useFrame(() => {
    const p = reducedMotion ? 1 : progress.current.value;
    if (scene.background instanceof THREE.Color) {
      scene.background.copy(night ? palette.night : palette.day);
      if (!night) scene.background.lerp(palette.dusk, ease(p, 0.89, 1) * 0.45);
    }
    if (scene.fog instanceof THREE.Fog && scene.background instanceof THREE.Color)
      scene.fog.color.copy(scene.background);
    scene.environmentIntensity = night ? 0.22 : 0.45;
    if (sun.current) sun.current.position.set(-45 + p * 10, 105, 48);
  });
  return (
    <>
      <ambientLight intensity={night ? 0.32 : 0.5} color={night ? '#aac5d6' : '#fff5e6'} />
      <hemisphereLight
        args={[night ? '#7fa8c2' : '#dcecf1', night ? '#38433d' : '#b2a28d', night ? 0.5 : 1.05]}
      />
      <directionalLight
        ref={sun}
        position={[-45, 105, 48]}
        intensity={night ? 0.85 : 2.6}
        color={night ? '#b0cfe6' : '#ffe7c7'}
        castShadow
        shadow-mapSize={[1536, 1536]}
        shadow-camera-left={-24}
        shadow-camera-right={24}
        shadow-camera-top={27}
        shadow-camera-bottom={-22}
        shadow-camera-near={0.5}
        shadow-camera-far={180}
        shadow-normalBias={0.025}
        shadow-bias={-0.00015}
      />
      <directionalLight position={[55, 45, -35]} intensity={night ? 0.45 : 1.4} color="#c4e4ef" />
      {night ? (
        <>
          <pointLight
            position={[5, 0.8, 4]}
            color="#efd1a0"
            intensity={10}
            distance={19}
            decay={2}
          />
          <pointLight
            position={[-5, 1, -3]}
            color="#8abfd7"
            intensity={7}
            distance={16}
            decay={2}
          />
        </>
      ) : null}
    </>
  );
}

function ArchitecturalFallback({ markFailure = true }: { markFailure?: boolean }) {
  const drawing = useRef<SVGSVGElement>(null);
  useEffect(() => {
    if (!markFailure) return;
    const el = drawing.current?.closest<HTMLElement>('.building-scene');
    if (el) {
      el.dataset.webglFallback = 'true';
      el.dataset.sceneStage = 'fallback';
    }
  }, [markFailure]);
  return (
    <svg
      ref={drawing}
      viewBox="0 0 1000 850"
      width="100%"
      height="100%"
      data-scene-fallback="true"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="burj-fallback">
          <stop stopColor="#709ba8" />
          <stop offset=".5" stopColor="#d9e0df" />
          <stop offset="1" stopColor="#688c99" />
        </linearGradient>
      </defs>
      <ellipse cx="640" cy="757" rx="168" ry="40" fill="#c6c9b7" />
      <path
        d="M530 747V590h20V488h22V390h22V294h20V216h13V165h9V98h5V33h3v65h6v68h9v56h14v77h19v93h20v100h22v111h22v144Z"
        fill="url(#burj-fallback)"
        stroke="#b4c5c8"
      />
      {Array.from({ length: 64 }, (_, i) => (
        <path
          key={i}
          d={`M${530 + Math.floor((63 - i) / 9) * 15} ${735 - i * 8} H${756 - Math.floor((63 - i) / 9) * 15}`}
          stroke="#e2e7e3"
          opacity=".7"
          strokeWidth="1"
        />
      ))}
      <path
        d="M505 746V400m-45 0h130m-85 0 70-25m-70 25-40-25m112 25v90"
        stroke="#b89555"
        strokeWidth="3"
        fill="none"
      />
    </svg>
  );
}
class SceneBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? <ArchitecturalFallback /> : this.props.children;
  }
}
function BuildingScene({
  locale,
  progress: externalProgress,
}: {
  locale: 'en' | 'ar';
  progress?: RefObject<Progress>;
}) {
  const host = useRef<HTMLDivElement>(null),
    internal = useRef<Progress>({ value: 0 });
  const progress = externalProgress ?? internal;
  const [reducedMotion, setReducedMotion] = useState(false),
    [visible, setVisible] = useState(true),
    [night, setNight] = useState(false),
    [contextLost, setContextLost] = useState(false);
  const cleanup = useRef<(() => void) | null>(null);
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const change = () => setReducedMotion(query.matches);
    change();
    query.addEventListener('change', change);
    const update = () => setNight(document.documentElement.dataset.theme === 'dark');
    update();
    const theme = new MutationObserver(update);
    theme.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => {
      query.removeEventListener('change', change);
      theme.disconnect();
    };
  }, []);
  useEffect(() => {
    if (!host.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => setVisible(entry?.isIntersecting ?? false),
      { rootMargin: '180px' },
    );
    observer.observe(host.current);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (externalProgress || reducedMotion) return;
    gsap.registerPlugin(ScrollTrigger);
    const story = document.getElementById('story');
    if (!story) return;
    const context = gsap.context(() => {
      gsap.to(internal.current, {
        value: 1,
        ease: 'none',
        scrollTrigger: {
          trigger: story,
          start: 'top top',
          end: 'bottom bottom',
          scrub: 0.9,
          invalidateOnRefresh: true,
        },
      });
    }, story);
    return () => context.revert();
  }, [externalProgress, reducedMotion]);
  useEffect(() => () => cleanup.current?.(), []);
  const atmosphere = night ? '#14252e' : '#e9e9e2';
  return (
    <div
      ref={host}
      className="building-scene"
      data-scene-stage={reducedMotion ? 'complete' : 'vision'}
      data-landmark="burj-khalifa"
      data-build-progress={reducedMotion ? 100 : 0}
      data-built-floors={reducedMotion ? FLOOR_COUNT : 0}
      data-detail-level="landmark"
      data-world-metres-per-unit="10"
      data-webgl-fallback={contextLost ? 'true' : undefined}
      role="img"
      aria-label={
        locale === 'ar'
          ? 'بناء برج خليفة ثلاثي الأبعاد مع التمرير: الأساسات والعمال والشاحنات والرافعات و١٦٣ طابقاً والواجهات ثم القمة.'
          : 'Burj Khalifa, built with your scroll: foundations, life-size site crews and vehicles, climbing cranes, 163 levels, stepped glass wings and the spire.'
      }
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        touchAction: 'pan-y',
      }}
    >
      <SceneBoundary>
        {contextLost ? (
          <ArchitecturalFallback />
        ) : (
          <Canvas
            frameloop={reducedMotion || !visible ? 'demand' : 'always'}
            camera={{ position: [71, 47, 121], fov: 36, near: 0.03, far: 650 }}
            dpr={[1, 1.5]}
            shadows="soft"
            gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
            fallback={<ArchitecturalFallback markFailure={false} />}
            style={{ width: '100%', height: '100%', touchAction: 'pan-y' }}
            onCreated={({ gl }) => {
              gl.toneMapping = THREE.ACESFilmicToneMapping;
              gl.toneMappingExposure = 1.12;
              const lost = (event: Event) => {
                event.preventDefault();
                setContextLost(true);
              };
              gl.domElement.addEventListener('webglcontextlost', lost);
              cleanup.current = () => gl.domElement.removeEventListener('webglcontextlost', lost);
            }}
          >
            <color attach="background" args={[atmosphere]} />
            <fog attach="fog" args={[atmosphere, 210, 540]} />
            <Lighting progress={progress} reducedMotion={reducedMotion} night={night} />
            <DubaiCity progress={progress} reducedMotion={reducedMotion} night={night} />
            <BurjEnvironment progress={progress} reducedMotion={reducedMotion} night={night} />
            <Blueprint progress={progress} reducedMotion={reducedMotion} />
            <BurjTower progress={progress} reducedMotion={reducedMotion} night={night} />
            <BurjSiteLife progress={progress} reducedMotion={reducedMotion} night={night} />
            <CameraAndTelemetry progress={progress} reducedMotion={reducedMotion} host={host} />
          </Canvas>
        )}
      </SceneBoundary>
    </div>
  );
}
export default memo(BuildingScene);
