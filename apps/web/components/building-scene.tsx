'use client';

import {
  Component,
  type ReactNode,
  type RefObject,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

type Locale = 'en' | 'ar';
type Progress = { value: number };
type FloorSpec = { x: number; y: number; z: number; width: number; depth: number; index: number };

const palette = {
  chalk: '#f5eedf',
  stone: '#e6d8c7',
  lavender: '#c9c4de',
  glass: '#91bfba',
  peach: '#efaa8b',
  coral: '#dc795a',
  mint: '#b4d1ba',
  green: '#477862',
  gold: '#e6b860',
};
const clamp = THREE.MathUtils.clamp;
const smooth = (value: number) => {
  const n = clamp(value, 0, 1);
  return n * n * (3 - 2 * n);
};
const floorSpecs: FloorSpec[] = [
  ...Array.from({ length: 9 }, (_, index) => ({
    x: -0.67 - Math.max(0, index - 5) * 0.065,
    y: 0.45 + index * 0.57,
    z: -0.2 - Math.max(0, index - 5) * 0.055,
    width: 3.03 - Math.max(0, index - 5) * 0.17,
    depth: 2.08 - Math.max(0, index - 5) * 0.055,
    index,
  })),
  ...Array.from({ length: 4 }, (_, index) => ({
    x: 1.45,
    y: 0.45 + index * 0.57,
    z: -0.75,
    width: 1.35,
    depth: 1.95,
    index: index + 2,
  })),
];

/** Rounded floor plates are true extruded geometry, including their curved corners. */
function roundedPlate(width: number, depth: number, thickness: number, radius = 0.16) {
  const x = -width / 2;
  const y = -depth / 2;
  const r = Math.min(radius, width / 3, depth / 3);
  const shape = new THREE.Shape();
  shape.moveTo(x + r, y);
  shape.lineTo(x + width - r, y);
  shape.quadraticCurveTo(x + width, y, x + width, y + r);
  shape.lineTo(x + width, y + depth - r);
  shape.quadraticCurveTo(x + width, y + depth, x + width - r, y + depth);
  shape.lineTo(x + r, y + depth);
  shape.quadraticCurveTo(x, y + depth, x, y + depth - r);
  shape.lineTo(x, y + r);
  shape.quadraticCurveTo(x, y, x + r, y);
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: thickness,
    bevelEnabled: false,
    curveSegments: 6,
  });
  geometry.rotateX(-Math.PI / 2);
  return geometry;
}

function Plate({
  width,
  depth,
  thickness,
  color,
  position = [0, 0, 0],
  radius,
  castShadow = true,
}: {
  width: number;
  depth: number;
  thickness: number;
  color: string;
  position?: [number, number, number];
  radius?: number;
  castShadow?: boolean;
}) {
  const geometry = useMemo(
    () => roundedPlate(width, depth, thickness, radius),
    [width, depth, thickness, radius],
  );
  return (
    <mesh geometry={geometry} position={position} castShadow={castShadow} receiveShadow>
      <meshStandardMaterial color={color} roughness={0.78} />
    </mesh>
  );
}

function Floor({
  spec,
  layerRef,
}: {
  spec: FloorSpec;
  layerRef: (group: THREE.Group | null) => void;
}) {
  const posts = useRef<THREE.InstancedMesh>(null);
  const glass = useMemo(() => {
    const front = new THREE.BoxGeometry(spec.width - 0.16, 0.4, 0.035);
    front.translate(0, 0.31, spec.depth / 2 + 0.005);
    const side = new THREE.BoxGeometry(0.035, 0.4, spec.depth - 0.2);
    side.translate(spec.width / 2 + 0.005, 0.31, 0);
    const merged = mergeGeometries([front, side]);
    front.dispose();
    side.dispose();
    return merged;
  }, [spec.width, spec.depth]);
  useEffect(() => {
    const matrix = new THREE.Matrix4();
    const positions = Array.from({ length: 5 }, (_, i) => [
      -spec.width / 2 + 0.12 + (i * (spec.width - 0.24)) / 4,
      0.31,
      spec.depth / 2 + 0.015,
    ]);
    positions.push([spec.width / 2 + 0.015, 0.31, -spec.depth / 2 + 0.18]);
    positions.push([spec.width / 2 + 0.015, 0.31, 0]);
    positions.forEach(([x, y, z], i) => {
      matrix.makeTranslation(x, y, z);
      posts.current?.setMatrixAt(i, matrix);
    });
    if (posts.current) posts.current.instanceMatrix.needsUpdate = true;
  }, [spec.width, spec.depth]);

  return (
    <group ref={layerRef} position={[spec.x, spec.y, spec.z]}>
      <Plate
        width={spec.width + 0.14}
        depth={spec.depth + 0.15}
        thickness={0.11}
        color={palette.chalk}
      />
      <mesh position={[0, 0.31, -0.17]}>
        <boxGeometry args={[spec.width - 0.13, 0.41, spec.depth - 0.28]} />
        <meshStandardMaterial
          color={spec.index % 3 === 1 ? palette.lavender : palette.stone}
          roughness={0.86}
        />
      </mesh>
      <mesh geometry={glass}>
        <meshStandardMaterial color={palette.glass} metalness={0.28} roughness={0.16} />
      </mesh>
      <instancedMesh ref={posts} args={[undefined, undefined, 7]}>
        <boxGeometry args={[0.035, 0.44, 0.035]} />
        <meshStandardMaterial color={palette.chalk} roughness={0.66} />
      </instancedMesh>
      <Plate
        width={spec.width + 0.2}
        depth={0.65}
        thickness={0.08}
        color={spec.index === 3 || spec.index === 7 ? palette.peach : palette.chalk}
        position={[0, 0.03, spec.depth / 2 + 0.19]}
        radius={0.24}
        castShadow={false}
      />
      <mesh position={[0, 0.23, spec.depth / 2 + 0.48]}>
        <boxGeometry args={[spec.width - 0.02, 0.26, 0.025]} />
        <meshStandardMaterial
          color={palette.glass}
          transparent
          opacity={0.52}
          roughness={0.25}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

function Palm({ position, scale = 1 }: { position: [number, number, number]; scale?: number }) {
  return (
    <group position={position} scale={scale}>
      <mesh position={[0, 0.6, 0]} rotation={[0, 0, -0.075]} castShadow>
        <cylinderGeometry args={[0.055, 0.085, 1.2, 7]} />
        <meshStandardMaterial color="#bc9471" roughness={0.9} />
      </mesh>
      {Array.from({ length: 5 }, (_, index) => (
        <group
          key={index}
          position={[-0.045, 1.18, 0]}
          rotation={[0, (index * Math.PI * 2) / 5, 0]}
        >
          <mesh position={[0.3, 0.02, 0]} rotation={[0, 0, -0.22]} scale={[0.45, 0.055, 0.14]}>
            <sphereGeometry args={[1, 8, 5]} />
            <meshStandardMaterial color={index % 2 ? '#65966b' : palette.green} roughness={0.85} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function Person({
  position,
  shirt,
  personRef,
}: {
  position: [number, number, number];
  shirt: string;
  personRef?: (group: THREE.Group | null) => void;
}) {
  return (
    <group position={position} ref={personRef}>
      <mesh position={[0, 0.57, 0]} castShadow>
        <sphereGeometry args={[0.09, 10, 8]} />
        <meshStandardMaterial color="#ca9b75" roughness={0.8} />
      </mesh>
      <mesh position={[0, 0.35, 0]} castShadow>
        <capsuleGeometry args={[0.085, 0.2, 4, 8]} />
        <meshStandardMaterial color={shirt} roughness={0.8} />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh
          key={side}
          position={[side * 0.047, 0.13, 0]}
          rotation={[0, 0, side * -0.07]}
          castShadow
        >
          <capsuleGeometry args={[0.027, 0.2, 3, 6]} />
          <meshStandardMaterial color="#525c5c" roughness={0.8} />
        </mesh>
      ))}
    </group>
  );
}

function Crane({ craneRef }: { craneRef: RefObject<THREE.Group | null> }) {
  return (
    <group ref={craneRef} position={[-2.6, 0.4, -1.65]}>
      <mesh position={[0, 2.7, 0]}>
        <boxGeometry args={[0.23, 5.4, 0.23]} />
        <meshStandardMaterial color={palette.gold} wireframe />
      </mesh>
      <mesh position={[1.18, 5.15, 0]}>
        <boxGeometry args={[3.6, 0.2, 0.18]} />
        <meshStandardMaterial color={palette.gold} wireframe />
      </mesh>
      <mesh position={[2.6, 4.3, 0]}>
        <cylinderGeometry args={[0.008, 0.008, 1.7, 4]} />
        <meshBasicMaterial color="#968577" />
      </mesh>
      <mesh position={[-0.4, 5.08, 0]} castShadow>
        <boxGeometry args={[0.5, 0.38, 0.38]} />
        <meshStandardMaterial color={palette.coral} />
      </mesh>
    </group>
  );
}

function Orbit({ orbitRef }: { orbitRef: RefObject<THREE.Group | null> }) {
  const geometry = useMemo(() => {
    const points = Array.from({ length: 81 }, (_, index) => {
      const theta = (index / 80) * Math.PI * 2;
      return new THREE.Vector3(Math.cos(theta) * 3.5, 0, Math.sin(theta) * 2.7);
    });
    return new THREE.BufferGeometry().setFromPoints(points);
  }, []);
  return (
    <group ref={orbitRef} position={[0, 2.7, 0]}>
      <lineLoop geometry={geometry}>
        <lineBasicMaterial color={palette.gold} transparent opacity={0.62} />
      </lineLoop>
      {[0, 2.1, 4.2].map((angle, index) => (
        <mesh key={index} position={[Math.cos(angle) * 3.5, 0, Math.sin(angle) * 2.7]}>
          <sphereGeometry args={[0.095, 12, 8]} />
          <meshStandardMaterial
            color={[palette.coral, palette.gold, palette.green][index]}
            roughness={0.4}
            metalness={0.25}
          />
        </mesh>
      ))}
    </group>
  );
}

function Architecture({
  progress,
  reducedMotion,
}: {
  progress: RefObject<Progress>;
  reducedMotion: boolean;
}) {
  const model = useRef<THREE.Group>(null);
  const layers = useRef<Array<THREE.Group | null>>([]);
  const landscaping = useRef<THREE.Group>(null);
  const person = useRef<THREE.Group>(null);
  const crane = useRef<THREE.Group>(null);
  const orbit = useRef<THREE.Group>(null);
  const rooftop = useRef<THREE.Group>(null);
  const blueprint = useRef<THREE.Group>(null);
  const { camera, size } = useThree();
  const target = useMemo(() => new THREE.Vector3(0, 2.65, 0), []);

  useEffect(() => {
    if (camera instanceof THREE.OrthographicCamera) {
      camera.zoom = Math.min(size.width / 9.6, size.height / 9.2);
      camera.updateProjectionMatrix();
    }
  }, [camera, size.width, size.height]);

  useFrame(({ clock, pointer }, delta) => {
    const p = reducedMotion ? 0 : progress.current.value;
    const hero = 1 - smooth((p - 0.035) / 0.065);
    const construction = clamp((p - 0.23) / 0.45, 0, 1);
    const finished = Math.max(hero, smooth((p - 0.67) / 0.15));
    for (let i = 0; i < floorSpecs.length; i++) {
      const layer = layers.current[i];
      const floor = floorSpecs[i];
      if (!layer || !floor) continue;
      const reveal = Math.max(hero, smooth((construction * 11 - floor.index) / 1.65));
      layer.visible = reveal > 0.005;
      layer.scale.set(0.88 + reveal * 0.12, Math.max(0.001, reveal), 0.88 + reveal * 0.12);
      layer.position.y = floor.y + (1 - reveal) * (3.3 + floor.index * 0.18);
      layer.rotation.y = (1 - reveal) * 0.28;
    }
    if (rooftop.current) {
      rooftop.current.visible = finished > 0.005;
      rooftop.current.scale.setScalar(Math.max(finished, 0.001));
    }
    if (landscaping.current) landscaping.current.scale.setScalar(0.001 + finished * 0.999);
    if (person.current) {
      const grown = hero > 0 ? 1 : 0.55 + smooth((p - 0.1) / 0.15) * 0.55;
      person.current.scale.setScalar(grown);
      person.current.position.x = -2.75 + smooth((p - 0.15) / 0.24) * 0.45;
    }
    if (crane.current) {
      const present = smooth((p - 0.23) / 0.1) * (1 - smooth((p - 0.68) / 0.09));
      crane.current.visible = present > 0.01;
      crane.current.scale.setScalar(Math.max(present, 0.001));
    }
    if (blueprint.current) blueprint.current.visible = p > 0.12 && p < 0.46;
    if (orbit.current) {
      const investment = smooth((p - 0.83) / 0.1);
      orbit.current.visible = investment > 0.01;
      orbit.current.scale.setScalar(0.75 + investment * 0.25);
      orbit.current.rotation.y = reducedMotion ? 0 : clock.elapsedTime * 0.12;
      orbit.current.rotation.z = 0.1;
    }
    if (model.current) {
      const desired = -0.12 + smooth(p) * 0.45 + (reducedMotion ? 0 : pointer.x * 0.055);
      model.current.rotation.y = THREE.MathUtils.damp(
        model.current.rotation.y,
        desired,
        3.2,
        delta,
      );
    }
    camera.position.x = THREE.MathUtils.damp(
      camera.position.x,
      9.5 + (reducedMotion ? 0 : pointer.x * 0.3),
      3,
      delta,
    );
    camera.lookAt(target);
  });

  return (
    <group ref={model} position={[0, -0.25, 0]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.055, 0]} receiveShadow>
        <circleGeometry args={[5.1, 64]} />
        <meshBasicMaterial color="#637e6e" transparent opacity={0.08} depthWrite={false} />
      </mesh>
      <Plate width={7.15} depth={5.45} thickness={0.25} color={palette.mint} radius={1.1} />
      <Plate
        width={4.9}
        depth={3.65}
        thickness={0.12}
        color="#e8e3d5"
        position={[0, 0.25, -0.24]}
        radius={0.22}
      />
      <Plate
        width={1.45}
        depth={1.65}
        thickness={0.045}
        color="#e2cfac"
        position={[-0.2, 0.26, 1.75]}
        radius={0.12}
      />
      <group ref={blueprint} position={[-0.7, 0.42, -0.2]}>
        <mesh position={[0, 1.5, 0]}>
          <boxGeometry args={[3.2, 3, 2.2]} />
          <meshBasicMaterial color="#618e9e" wireframe transparent opacity={0.45} />
        </mesh>
        <gridHelper args={[4.6, 12, '#71999d', '#9eb8ad']} position={[0, 0, 0]} />
      </group>
      {floorSpecs.map((spec, index) => (
        <Floor
          key={index}
          spec={spec}
          layerRef={(group) => {
            layers.current[index] = group;
          }}
        />
      ))}
      <group ref={rooftop}>
        <Plate
          width={2.7}
          depth={2.0}
          thickness={0.15}
          color={palette.chalk}
          position={[-0.9, 5.59, -0.4]}
          radius={0.22}
        />
        <mesh position={[-1.28, 5.9, -0.7]} castShadow>
          <boxGeometry args={[1.1, 0.48, 0.55]} />
          <meshStandardMaterial color={palette.lavender} roughness={0.72} />
        </mesh>
        <mesh position={[-0.19, 5.91, -0.31]} castShadow>
          <sphereGeometry args={[0.23, 20, 16]} />
          <meshStandardMaterial color={palette.coral} roughness={0.5} />
        </mesh>
        <Plate
          width={1.65}
          depth={2.2}
          thickness={0.12}
          color={palette.chalk}
          position={[1.45, 2.73, -0.75]}
          radius={0.18}
        />
        <Plate
          width={1.15}
          depth={0.8}
          thickness={0.09}
          color={palette.peach}
          position={[-0.45, 0.98, 1.25]}
          radius={0.36}
        />
      </group>
      <group ref={landscaping}>
        <Palm position={[-2.65, 0.25, -0.3]} scale={1.1} />
        <Palm position={[2.65, 0.25, 0.65]} scale={1.05} />
        <Palm position={[1.48, 2.83, -0.8]} scale={0.56} />
        <mesh position={[-2.57, 0.4, 1.56]} castShadow>
          <sphereGeometry args={[0.26, 12, 8]} />
          <meshStandardMaterial color="#749272" roughness={0.9} />
        </mesh>
        <mesh position={[2.18, 0.37, 1.57]} castShadow>
          <sphereGeometry args={[0.2, 12, 8]} />
          <meshStandardMaterial color={palette.green} roughness={0.9} />
        </mesh>
        <Person position={[1.4, 0.29, 1.65]} shirt={palette.peach} />
      </group>
      <Person
        position={[-2.75, 0.29, 1.23]}
        shirt="#777d9c"
        personRef={(group) => {
          person.current = group;
        }}
      />
      <Crane craneRef={crane} />
      <Orbit orbitRef={orbit} />
    </group>
  );
}

function ArchitecturalFallback() {
  return (
    <svg
      viewBox="0 0 600 650"
      width="100%"
      height="100%"
      aria-hidden="true"
      data-scene-fallback="true"
    >
      <defs>
        <linearGradient id="oriva-fallback-glass" x1="0" x2="1">
          <stop stopColor="#98c4bd" />
          <stop offset="1" stopColor="#6c9998" />
        </linearGradient>
      </defs>
      <ellipse cx="310" cy="535" rx="235" ry="75" fill="#99b8a5" opacity=".12" />
      <path d="M64 461 315 346 555 466 311 596Z" fill="#b9d1b9" />
      <path d="M181 211 317 151 431 207 295 270Z" fill="#f5eedf" />
      <path d="M181 211 295 270 295 510 181 450Z" fill="#e1d9ce" />
      <path d="M295 270 431 207 431 448 295 510Z" fill="url(#oriva-fallback-glass)" />
      {Array.from({ length: 9 }, (_, i) => (
        <path
          key={i}
          d={`M173 ${209 + i * 28} 295 ${270 + i * 28} 440 ${204 + i * 28}`}
          fill="none"
          stroke={i === 3 ? '#ecac8c' : '#f5eedf'}
          strokeWidth="12"
          strokeLinejoin="round"
        />
      ))}
      <path
        d="M459 487V379m-30 16q25-42 56-5m-57 6q32-17 62 4"
        fill="none"
        stroke="#628568"
        strokeWidth="11"
        strokeLinecap="round"
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

export default function BuildingScene({ locale }: { locale: Locale }) {
  const host = useRef<HTMLDivElement>(null);
  const progress = useRef<Progress>({ value: 0 });
  const cleanupCanvas = useRef<(() => void) | null>(null);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [contextLost, setContextLost] = useState(false);
  const [visible, setVisible] = useState(true);
  const [stage, setStage] = useState('vision');
  const stageRef = useRef('vision');

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
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);
    const story = document.querySelector('#story');
    if (!story || reducedMotion) {
      progress.current.value = 0;
      return;
    }
    const stages = ['vision', 'human', 'foundation', 'structure', 'living', 'investment'];
    const context = gsap.context(() => {
      gsap.to(progress.current, {
        value: 1,
        ease: 'none',
        scrollTrigger: {
          trigger: story,
          start: 'top top',
          end: 'bottom bottom',
          scrub: 0.7,
          invalidateOnRefresh: true,
          onUpdate: (trigger) => {
            const p = trigger.progress;
            const index =
              p < 0.08 ? 0 : p < 0.23 ? 1 : p < 0.36 ? 2 : p < 0.68 ? 3 : p < 0.85 ? 4 : 5;
            const next = stages[index] ?? 'vision';
            if (stageRef.current !== next) {
              stageRef.current = next;
              setStage(next);
            }
          },
        },
      });
    }, story);
    return () => {
      context.revert();
      progress.current.value = 0;
    };
  }, [reducedMotion]);

  useEffect(
    () => () => {
      cleanupCanvas.current?.();
    },
    [contextLost],
  );

  return (
    <div
      ref={host}
      className="building-scene"
      data-scene-stage={reducedMotion ? 'complete' : stage}
      data-webgl-fallback={contextLost ? 'true' : undefined}
      role="img"
      aria-label={
        locale === 'ar'
          ? 'مجسم معماري ثلاثي الأبعاد: تتحول الرؤية الإنسانية إلى أساسات وطوابق ومنزل واستثمار مع التمرير.'
          : 'An interactive architectural model. Scroll to follow a human vision becoming foundations, floors, a home and an investment.'
      }
      style={{
        width: '100%',
        height: '100%',
        minHeight: 380,
        position: 'relative',
        touchAction: 'pan-y',
      }}
    >
      <SceneBoundary>
        {contextLost ? (
          <ArchitecturalFallback />
        ) : (
          <Canvas
            orthographic
            frameloop={reducedMotion || !visible ? 'demand' : 'always'}
            camera={{ position: [9.5, 7.4, 11], zoom: 48, near: 0.1, far: 70 }}
            dpr={[1, 1.5]}
            shadows="soft"
            gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
            fallback={<ArchitecturalFallback />}
            style={{ width: '100%', height: '100%', touchAction: 'pan-y' }}
            onCreated={({ gl }) => {
              const onLost = (event: Event) => {
                event.preventDefault();
                setContextLost(true);
              };
              gl.domElement.addEventListener('webglcontextlost', onLost);
              cleanupCanvas.current = () =>
                gl.domElement.removeEventListener('webglcontextlost', onLost);
            }}
          >
            <ambientLight intensity={1.1} color="#fff8ed" />
            <hemisphereLight args={['#e6f3ee', '#cbb496', 1.3]} />
            <directionalLight
              position={[-5, 9, 5]}
              intensity={2.1}
              color="#fff2dc"
              castShadow
              shadow-mapSize={[1024, 1024]}
              shadow-camera-left={-7}
              shadow-camera-right={7}
              shadow-camera-top={9}
              shadow-camera-bottom={-5}
              shadow-bias={-0.001}
            />
            <directionalLight position={[5, 5, -6]} intensity={0.8} color="#d5daf4" />
            <Architecture progress={progress} reducedMotion={reducedMotion} />
          </Canvas>
        )}
      </SceneBoundary>
    </div>
  );
}
