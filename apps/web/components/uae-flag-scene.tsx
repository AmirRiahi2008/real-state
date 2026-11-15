'use client';

import {
  Component,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { Locale } from '@/lib/api';
import { applyFlagWind } from '@/lib/flag-geometry';

const FLAG_WIDTH = 6.4;
const FLAG_HEIGHT = 3.2;
// UAE Government Media Office: https://vig.gmo.gov.ae/en/guideline/the-uae-flag
const flagColors = {
  red: [200, 16, 46],
  green: [0, 132, 61],
  white: [225, 225, 225],
  black: [0, 0, 0],
} as const;

function flagTexture() {
  const width = 384,
    height = 192;
  const pixels = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const color =
        x < width / 4
          ? flagColors.red
          : y >= (height * 2) / 3
            ? flagColors.green
            : y >= height / 3
              ? flagColors.white
              : flagColors.black;
      const offset = (y * width + x) * 4;
      pixels[offset] = color[0];
      pixels[offset + 1] = color[1];
      pixels[offset + 2] = color[2];
      pixels[offset + 3] = 255;
    }
  const texture = new THREE.DataTexture(pixels, width, height, THREE.RGBAFormat);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

function StaticFlag() {
  return (
    <svg viewBox="0 0 1000 650" className="uae-static-flag" aria-hidden="true">
      <path d="M166 40V650" stroke="#a6ada1" strokeWidth="9" />
      <circle cx="166" cy="38" r="9" fill="#e5e7df" />
      <path fill="#c8102e" d="M173 58h180v360H173Z" />
      <path fill="#00843d" d="M353 58h540v120H353Z" />
      <path fill="#e1e1e1" d="M353 178h540v120H353Z" />
      <path fill="#000" d="M353 298h540v120H353Z" />
    </svg>
  );
}

class FlagBoundary extends Component<
  { children: ReactNode; onFailure: () => void },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onFailure();
  }
  render() {
    return this.state.failed ? <StaticFlag /> : this.props.children;
  }
}

function FlyingFabric({
  reduced,
  host,
}: {
  reduced: boolean;
  host: RefObject<HTMLDivElement | null>;
}) {
  const geometry = useMemo(() => {
    const value = new THREE.PlaneGeometry(FLAG_WIDTH, FLAG_HEIGHT, 96, 48);
    value.translate(FLAG_WIDTH / 2, 0, 0);
    value.setAttribute('restPosition', value.getAttribute('position').clone());
    return value;
  }, []);
  const texture = useMemo(flagTexture, []);
  const lastTelemetry = useRef(0);
  const invalidate = useThree((state) => state.invalidate);
  useEffect(() => {
    const frame = requestAnimationFrame(() => invalidate());
    return () => cancelAnimationFrame(frame);
  }, [invalidate, reduced]);
  useEffect(
    () => () => {
      geometry.dispose();
      texture.dispose();
    },
    [geometry, texture],
  );
  useFrame(({ clock, gl }) => {
    const positions = geometry.getAttribute('position') as THREE.BufferAttribute;
    const rest = geometry.getAttribute('restPosition') as THREE.BufferAttribute;
    const time = reduced ? 1.65 : clock.elapsedTime;
    applyFlagWind(geometry, time, FLAG_WIDTH);
    if (host.current && (time - lastTelemetry.current > 0.4 || reduced)) {
      host.current.dataset.flagReady = gl.info.render.calls > 0 ? 'true' : 'preparing';
      host.current.dataset.wavePhase = time.toFixed(2);
      host.current.dataset.freeEdge = positions.getZ(positions.count - 1).toFixed(4);
      host.current.dataset.hoistPinned = String(
        positions.getX(0) === rest.getX(0) && positions.getZ(0) === 0,
      );
      lastTelemetry.current = time;
    }
  });
  return (
    <mesh geometry={geometry} position={[0.14, 7.9, 0]} castShadow>
      <meshPhysicalMaterial
        map={texture}
        side={THREE.DoubleSide}
        roughness={0.82}
        metalness={0}
        toneMapped={false}
        specularIntensity={0.15}
        sheen={0.12}
        sheenRoughness={0.85}
        sheenColor="#ffffff"
        clearcoat={0.02}
      />
    </mesh>
  );
}

function FlagWorld({
  reduced,
  night,
  host,
}: {
  reduced: boolean;
  night: boolean;
  host: RefObject<HTMLDivElement | null>;
}) {
  const { camera, size } = useThree();
  const target = useMemo(() => new THREE.Vector3(), []);
  useFrame(() => {
    const mobile = size.width < 650;
    if (camera instanceof THREE.OrthographicCamera) {
      const zoom = Math.min(
        (size.width - (mobile ? 30 : 80)) / (mobile ? 6.9 : 7.7),
        (size.height - 65) / 4.3,
      );
      if (camera.zoom !== zoom) {
        camera.zoom = zoom;
        camera.updateProjectionMatrix();
      }
    }
    target.set(mobile ? 3.3 : 2.8, 7.7, 0);
    camera.position.set(mobile ? 3.8 : 4.6, 8.5, 17);
    camera.lookAt(target);
  });
  return (
    <>
      <ambientLight intensity={night ? 1.1 : 1.3} color="#f6f5ef" />
      <hemisphereLight args={['#e8eeed', night ? '#2d4136' : '#d7d5c8', night ? 0.7 : 0.9]} />
      <directionalLight position={[-3, 12, 8]} intensity={night ? 2.7 : 2.5} color="#ffffff" />
      <directionalLight position={[9, 9, -5]} intensity={night ? 0.8 : 0.9} color="#d8e3dc" />
      <mesh position={[0, 4.825, 0]}>
        <cylinderGeometry args={[0.047, 0.085, 9.65, 24]} />
        <meshStandardMaterial color="#d3d9d4" metalness={0.68} roughness={0.32} />
      </mesh>
      <mesh position={[0, 9.73, 0]}>
        <sphereGeometry args={[0.09, 20, 14]} />
        <meshStandardMaterial color="#e3e6df" metalness={0.3} roughness={0.35} />
      </mesh>
      <mesh position={[0.052, 7.9, -0.015]}>
        <cylinderGeometry args={[0.006, 0.006, 3.35, 6]} />
        <meshStandardMaterial color="#dddccf" roughness={0.9} />
      </mesh>
      {[6.31, 9.49].map((y) => (
        <group key={y} position={[0.09, y, 0]}>
          <mesh rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.01, 0.01, 0.1, 8]} />
            <meshStandardMaterial color="#cbd3ca" metalness={0.65} roughness={0.4} />
          </mesh>
          <mesh rotation={[0, Math.PI / 2, 0]}>
            <torusGeometry args={[0.025, 0.007, 5, 12]} />
            <meshStandardMaterial color="#cad1c9" metalness={0.65} roughness={0.4} />
          </mesh>
        </group>
      ))}
      <FlyingFabric reduced={reduced} host={host} />
    </>
  );
}

export default function UaeFlagScene({ locale }: { locale: Locale }) {
  const host = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(true);
  const [reduced, setReduced] = useState(false);
  const [night, setNight] = useState(false);
  const [fallback, setFallback] = useState(false);
  const cleanup = useRef<(() => void) | null>(null);
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const preference = () => setReduced(query.matches);
    preference();
    query.addEventListener('change', preference);
    const theme = () => setNight(document.documentElement.dataset.theme === 'dark');
    theme();
    const watcher = new MutationObserver(theme);
    watcher.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), {
      rootMargin: '80px',
    });
    if (host.current) observer.observe(host.current);
    return () => {
      query.removeEventListener('change', preference);
      watcher.disconnect();
      observer.disconnect();
      cleanup.current?.();
    };
  }, []);
  return (
    <div
      ref={host}
      className="uae-flag-scene"
      role="img"
      aria-label={
        locale === 'ar'
          ? 'علم الإمارات ثلاثي الأبعاد، بألوانه الأربعة، يرفرف في الريح'
          : 'The three-dimensional UAE flag, in its four national colours, waving in the wind'
      }
      data-flag-ready={fallback ? 'fallback' : 'preparing'}
      data-flag-ratio="2:1"
      data-flag-red-width="1/4"
      data-flag-fallback={fallback ? 'true' : undefined}
    >
      <FlagBoundary onFailure={() => setFallback(true)}>
        {fallback ? (
          <StaticFlag />
        ) : (
          <Canvas
            orthographic
            camera={{ position: [4.6, 8.5, 17], zoom: 100, near: 0.1, far: 60 }}
            frameloop={reduced || !visible ? 'demand' : 'always'}
            dpr={[1, 1.5]}
            gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
            fallback={<StaticFlag />}
            onCreated={({ gl }) => {
              gl.toneMapping = THREE.ACESFilmicToneMapping;
              gl.toneMappingExposure = 1.03;
              const lost = (event: Event) => {
                event.preventDefault();
                setFallback(true);
              };
              gl.domElement.addEventListener('webglcontextlost', lost);
              cleanup.current = () => gl.domElement.removeEventListener('webglcontextlost', lost);
            }}
          >
            <FlagWorld reduced={reduced} night={night} host={host} />
          </Canvas>
        )}
      </FlagBoundary>
    </div>
  );
}
