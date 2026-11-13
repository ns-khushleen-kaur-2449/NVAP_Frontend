import { Fragment, useEffect, useId, useRef } from 'react';
import * as THREE from 'three';
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { cn } from '@/lib/utils';

/**
 * Hero visual: the SmartSDR workflow as three solid 3D icons —
 * AI calls (phone) → understands conversations (waveform) → books meetings (calendar).
 *
 * Each icon is a small three.js scene: real geometry (an extruded, bevelled
 * handset; capsule bars; a rounded-box calendar) with metallic physical
 * materials lit by a studio environment map. Rendering pauses off-screen and on
 * hidden tabs, and draws one still frame for prefers-reduced-motion.
 */

const STEPS = [
  { type: 'phone', title: 'AI Calls', sub: 'Your Leads' },
  { type: 'wave', title: 'Understands', sub: 'Conversations' },
  { type: 'calendar', title: 'Books', sub: 'Meetings' },
];

// lucide "phone" handset outline, 24×24 units; filled, it is the handset silhouette.
const PHONE_PATH = 'M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z';

const ORANGE = 0xf87217;
const AMBER = 0xffb24a;

const orangeMetal = (color = ORANGE) => new THREE.MeshPhysicalMaterial({
  color, metalness: 0.85, roughness: 0.26, clearcoat: 1, clearcoatRoughness: 0.12,
  emissive: color, emissiveIntensity: 0.12, envMapIntensity: 1.25,
});
const darkMetal = () => new THREE.MeshPhysicalMaterial({
  color: 0x1f1915, metalness: 0.7, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.18, envMapIntensity: 1.1,
});
// Neon outline: the same mesh drawn slightly larger from behind (inverted hull).
const neonHull = (geometry, scale, opacity = 0.5) => {
  const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({
    color: 0xff8a3d, side: THREE.BackSide, transparent: true, opacity, depthWrite: false,
  }));
  mesh.scale.setScalar(scale);
  return mesh;
};

function buildPhone() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="${PHONE_PATH}"/></svg>`;
  const shapes = new SVGLoader().parse(svg).paths.flatMap((p) => SVGLoader.createShapes(p));
  const geometry = new THREE.ExtrudeGeometry(shapes, {
    depth: 2.6, bevelEnabled: true, bevelThickness: 0.9, bevelSize: 0.65, bevelSegments: 10, curveSegments: 40,
  });
  geometry.center();
  geometry.rotateX(Math.PI);          // SVG y points down
  geometry.scale(0.118, 0.118, 0.118);
  const group = new THREE.Group();
  group.add(neonHull(geometry, 1.035, 0.3));
  group.add(new THREE.Mesh(geometry, orangeMetal()));
  return {
    group,
    update(t, still) {
      group.rotation.y = still ? -0.35 : -0.3 + Math.sin(t * 0.6) * 0.35;
      group.rotation.x = 0.15;
      // A short "ring" every 3.2 s.
      const ring = still ? 0 : Math.max(0, 1 - ((t % 3.2) / 0.45));
      group.rotation.z = ring * Math.sin(t * 38) * 0.09;
      group.position.y = still ? 0 : Math.sin(t * 1.1) * 0.06;
    },
  };
}

function buildWave() {
  const BARS = 9, GAP = 0.36, R = 0.12, MAX = 2.7;
  const cylinder = new THREE.CylinderGeometry(R, R, 1, 32, 1, true);
  const cap = new THREE.SphereGeometry(R, 32, 16);
  const group = new THREE.Group();
  const bars = [];
  for (let i = 0; i < BARS; i++) {
    const c = (i - (BARS - 1) / 2) / ((BARS - 1) / 2);            // -1..1
    const color = new THREE.Color(AMBER).lerp(new THREE.Color(ORANGE), Math.abs(c));
    const material = orangeMetal(color);
    const bar = new THREE.Group();
    const body = new THREE.Mesh(cylinder, material);
    const top = new THREE.Mesh(cap, material);
    const bottom = new THREE.Mesh(cap, material);
    bar.add(body, top, bottom);
    bar.position.x = (i - (BARS - 1) / 2) * GAP;
    group.add(bar);
    bars.push({ body, top, bottom, env: 1 - c * c * 0.62, i });
  }
  return {
    group,
    update(t, still) {
      for (const b of bars) {
        const live = still ? 0.62 + 0.38 * Math.cos(b.i * 1.4)
          : 0.5 + 0.5 * (Math.sin(t * 2.4 + b.i * 0.8) * 0.6 + Math.sin(t * 3.9 + b.i * 1.45) * 0.4);
        const len = Math.max(0.05, MAX * b.env * (0.22 + 0.78 * live) - 2 * R);
        b.body.scale.y = len;
        b.top.position.y = len / 2;
        b.bottom.position.y = -len / 2;
      }
      group.rotation.y = still ? 0.3 : Math.sin(t * 0.5 + 1.2) * 0.32;
      group.rotation.x = 0.12;
    },
  };
}

function buildCalendar() {
  const group = new THREE.Group();
  const bodyGeometry = new RoundedBoxGeometry(2.7, 2.5, 0.55, 6, 0.3);
  const body = new THREE.Mesh(bodyGeometry, darkMetal());
  body.position.y = -0.12;
  const hull = neonHull(bodyGeometry, 1.045, 0.55);
  hull.position.copy(body.position);
  const header = new THREE.Mesh(new RoundedBoxGeometry(2.7, 0.7, 0.62, 6, 0.28), orangeMetal());
  header.position.y = 0.8;
  group.add(hull, body, header);
  const ringGeometry = new THREE.CylinderGeometry(0.1, 0.1, 0.62, 24);
  for (const x of [-0.72, 0.72]) {
    const ring = new THREE.Mesh(ringGeometry, orangeMetal(AMBER));
    ring.position.set(x, 1.22, 0);
    group.add(ring);
  }
  // Checkmark: two rounded bars meeting at a rounded joint, standing proud of the face.
  const checkMaterial = new THREE.MeshPhysicalMaterial({
    color: AMBER, emissive: ORANGE, emissiveIntensity: 0.9, metalness: 0.4, roughness: 0.25, clearcoat: 1,
  });
  const check = new THREE.Group();
  const vertex = new THREE.Vector2(-0.18, -0.62);
  const arm = (length, angle) => {
    const mesh = new THREE.Mesh(new RoundedBoxGeometry(length, 0.3, 0.26, 4, 0.12), checkMaterial);
    mesh.rotation.z = angle;
    mesh.position.set(vertex.x + Math.cos(angle) * length / 2, vertex.y + Math.sin(angle) * length / 2, 0);
    return mesh;
  };
  check.add(arm(0.9, (135 * Math.PI) / 180), arm(1.75, (50 * Math.PI) / 180));
  const joint = new THREE.Mesh(new THREE.SphereGeometry(0.15, 24, 16), checkMaterial);
  joint.position.set(vertex.x, vertex.y, 0);
  check.add(joint);
  check.position.z = 0.34;
  group.add(check);
  group.scale.setScalar(0.88);           // match the phone's and waveform's visual weight
  return {
    group,
    update(t, still) {
      checkMaterial.emissiveIntensity = still ? 0.9 : 0.75 + 0.45 * (0.5 + 0.5 * Math.sin(t * 2));
      group.rotation.y = still ? 0.35 : 0.25 + Math.sin(t * 0.55 + 2.4) * 0.32;
      group.rotation.x = 0.14;
      group.position.y = still ? 0 : Math.sin(t * 1.05 + 1) * 0.06;
    },
  };
}

const BUILDERS = { phone: buildPhone, wave: buildWave, calendar: buildCalendar };

function Icon3D({ type }) {
  const wrapRef = useRef(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    const still = Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
    } catch {
      return undefined;                // no WebGL: the glow and ring behind stay
    }
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    Object.assign(renderer.domElement.style, { position: 'absolute', inset: '0', width: '100%', height: '100%' });
    renderer.domElement.setAttribute('aria-hidden', 'true');
    wrap.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envTarget = pmrem.fromScene(new RoomEnvironment(), 0.04);
    scene.environment = envTarget.texture;
    const key = new THREE.DirectionalLight(0xffffff, 2.2);
    key.position.set(3, 4, 6);
    const rim = new THREE.DirectionalLight(0xff8a3d, 3);
    rim.position.set(-4, 2, -3);
    scene.add(key, rim, new THREE.AmbientLight(0xffffff, 0.25));

    const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
    camera.position.set(0, 0, 9);
    const icon = BUILDERS[type]();
    scene.add(icon.group);

    let raf = 0, visible = true;
    const start = performance.now();
    const render = (now) => {
      icon.update((now - start) / 1000, still);
      renderer.render(scene, camera);
    };
    const resize = () => {
      const w = wrap.clientWidth;
      if (!w) return;
      renderer.setSize(w, w, false);
      render(performance.now());
    };
    const loop = (now) => {
      render(now);
      if (visible && !document.hidden) raf = requestAnimationFrame(loop);
    };
    const play = () => {
      cancelAnimationFrame(raf);
      if (!still && visible && !document.hidden) raf = requestAnimationFrame(loop);
    };

    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    resize();
    const io = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; play(); });
    io.observe(wrap);
    document.addEventListener('visibilitychange', play);
    play();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      document.removeEventListener('visibilitychange', play);
      scene.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) o.material.dispose();
      });
      envTarget.dispose();
      pmrem.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [type]);

  return (
    <div className="relative aspect-square w-full">
      {/* Soft glow and a fine ring behind the icon. */}
      <div aria-hidden="true" className="absolute inset-[6%] rounded-full bg-[radial-gradient(circle,rgba(248,114,23,0.32)_0%,rgba(248,114,23,0.1)_45%,transparent_70%)]" />
      <div aria-hidden="true" className="absolute inset-[8%] rounded-full border border-[rgba(248,114,23,0.22)]" />
      <div ref={wrapRef} className="absolute inset-0" />
    </div>
  );
}

// A glowing arrow with a light pulse travelling along it.
function FlowArrow({ animate }) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  return (
    <svg viewBox="0 0 48 16" fill="none" aria-hidden="true"
      className="h-auto w-5 overflow-visible sm:w-8 lg:w-9 [filter:drop-shadow(0_0_4px_rgba(248,114,23,0.8))]">
      <defs>
        <linearGradient id={`arrow-${id}`} gradientUnits="userSpaceOnUse" x1="3" x2="40" y1="8" y2="8">
          <stop offset="0" stopColor="#F87217" stopOpacity="0.25" />
          <stop offset="1" stopColor="#FFB24A" />
        </linearGradient>
      </defs>
      <path d="M3 8H40" stroke={`url(#arrow-${id})`} strokeWidth="2" strokeLinecap="round" />
      <circle cy="8" r="1.8" fill="#FFE1B8">
        {animate && <animate attributeName="cx" values="3;38" dur="1.6s" repeatCount="indefinite" />}
        {animate && <animate attributeName="opacity" values="0;1;0" dur="1.6s" repeatCount="indefinite" />}
      </circle>
      <path d="M36 3.5l7 4.5-7 4.5" stroke="#FFB24A" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function WorkflowVisual({ className }) {
  const animate = !(typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
  // Colour classes avoid "text-white"/"bg-white"/"border-white": the light-mode
  // .mk-band rules in index.css match those by substring.
  return (
    <div role="img" aria-label="SmartSDR workflow: AI calls your leads, understands conversations, books meetings"
      className={cn('grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-x-0.5 gap-y-3 sm:gap-x-1.5', className)}>
      {STEPS.map((step, i) => (
        <Fragment key={step.type}>
          <Icon3D type={step.type} />
          {i < STEPS.length - 1 && <FlowArrow animate={animate} />}
        </Fragment>
      ))}
      {STEPS.map((step, i) => (
        <div key={step.title} className={cn('justify-self-center', ['col-start-1', 'col-start-3', 'col-start-5'][i])}>
          <div className="rounded-xl border border-[rgba(23,19,15,0.08)] bg-[rgba(255,255,255,0.6)] px-3 py-2 text-center shadow-[0_10px_24px_-14px_rgba(0,0,0,0.5)] backdrop-blur-md dark:border-[rgba(255,255,255,0.1)] dark:bg-[rgba(16,13,11,0.6)] sm:px-4">
            <p className="text-[0.78rem] font-semibold leading-tight text-[var(--ink)] sm:text-sm">{step.title}</p>
            <p className="mt-0.5 text-[0.68rem] leading-tight text-[var(--mist)] sm:text-xs">{step.sub}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
