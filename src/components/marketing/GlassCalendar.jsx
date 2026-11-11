import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { cn } from '@/lib/utils';

/**
 * Voice Agent hero visual: a floating glass calendar with a neon orange check mark
 * and the word BOOKED — "SmartSDR doesn't just make calls, it books meetings."
 *
 * A single three.js scene: a translucent rounded body with additive Fresnel edges
 * (the blue-white glass rim), a frosted header and binder rings, printed text on a
 * canvas texture, a layered neon tube for the check mark, and a handful of drifting
 * light particles. It floats, the check pulses, and the lights sweep across the
 * glass. Rendering pauses off-screen and on hidden tabs; prefers-reduced-motion
 * gets one still frame.
 */

const W = 2.6;       // body width
const H = 2.4;       // body height
const D = 0.5;       // body depth
const BODY_Y = -0.12;

// Additive rim light: bright where the surface turns away from the camera.
const fresnel = (color, power, strength) => new THREE.ShaderMaterial({
  uniforms: { uColor: { value: new THREE.Color(color) }, uPower: { value: power }, uStrength: { value: strength } },
  vertexShader: `
    varying vec3 vN; varying vec3 vV;
    void main() {
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      vN = normalize(normalMatrix * normal);
      vV = normalize(-mv.xyz);
      gl_Position = projectionMatrix * mv;
    }`,
  fragmentShader: `
    uniform vec3 uColor; uniform float uPower; uniform float uStrength;
    varying vec3 vN; varying vec3 vV;
    void main() {
      float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), uPower);
      gl_FragColor = vec4(uColor, clamp(f * uStrength, 0.0, 1.0));
    }`,
  transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
});

const soft = (stops) => {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  stops.forEach(([at, color]) => grad.addColorStop(at, color));
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
};

// The printed text, drawn at 400 px per world unit onto a W×H plane.
function drawFace(canvas) {
  const g = canvas.getContext('2d');
  g.clearRect(0, 0, canvas.width, canvas.height);
  const font = (weight, size) => `${weight} ${size}px Outfit, "Segoe UI", system-ui, sans-serif`;
  const spaced = (px) => { if ('letterSpacing' in g) g.letterSpacing = `${px}px`; };
  g.textBaseline = 'alphabetic';

  // OCTOBER pill on the header band.
  g.fillStyle = 'rgba(255,255,255,0.14)';
  g.strokeStyle = 'rgba(255,255,255,0.6)';
  g.lineWidth = 3;
  g.beginPath(); g.roundRect(380, 92, 280, 68, 34); g.fill(); g.stroke();
  g.fillStyle = 'rgba(255,255,255,0.92)';
  g.font = font(500, 32); spaced(5); g.textAlign = 'center';
  g.fillText('OCTOBER', 524, 138);

  // Date.
  g.textAlign = 'left';
  g.fillStyle = 'rgba(255,255,255,0.78)';
  g.font = font(500, 58); spaced(3);
  g.fillText('MON', 150, 400);
  g.fillStyle = 'rgba(255,255,255,0.96)';
  g.font = font(600, 262); spaced(0);
  g.fillText('24', 138, 640);

  // BOOKED.
  g.fillStyle = 'rgba(255,255,255,0.95)';
  g.font = font(600, 62); spaced(5); g.textAlign = 'center';
  g.fillText('BOOKED', 520, 842);
}

// A smooth rounded "V" check mark as a curve through the face.
function checkPath() {
  const A = new THREE.Vector3(-0.55, -0.02, 0);
  const V = new THREE.Vector3(-0.15, -0.5, 0);
  const B = new THREE.Vector3(0.62, 0.5, 0);
  const near = (from, to, d) => from.clone().add(to.clone().sub(from).normalize().multiplyScalar(d));
  const c0 = near(V, A, 0.14), c1 = near(V, B, 0.14);
  const path = new THREE.CurvePath();
  path.add(new THREE.LineCurve3(A, c0));
  path.add(new THREE.QuadraticBezierCurve3(c0, V, c1));
  path.add(new THREE.LineCurve3(c1, B));
  return { path, A, B };
}

function buildScene() {
  const group = new THREE.Group();
  const disposables = [];
  const track = (o) => { disposables.push(o); return o; };

  // ── Glass body ──────────────────────────────────────────────
  const bodyGeo = track(new RoundedBoxGeometry(W, H, D, 8, 0.3));
  const glass = track(new THREE.MeshPhysicalMaterial({
    color: 0xbcd6ff, transparent: true, opacity: 0.2, roughness: 0.06, metalness: 0, clearcoat: 1,
    clearcoatRoughness: 0.04, envMapIntensity: 2.6, depthWrite: false,
  }));
  const body = new THREE.Mesh(bodyGeo, glass);
  body.position.y = BODY_Y; body.renderOrder = 2;
  const inner = new THREE.Mesh(
    track(new RoundedBoxGeometry(W - 0.2, H - 0.2, D * 0.55, 6, 0.22)),
    track(new THREE.MeshBasicMaterial({ color: 0x1b2c4a, transparent: true, opacity: 0.38, depthWrite: false })),
  );
  inner.position.y = BODY_Y; inner.renderOrder = 1;
  const rim = new THREE.Mesh(bodyGeo, track(fresnel(0xa9d3ff, 2.2, 1.05)));
  rim.position.y = BODY_Y; rim.scale.setScalar(1.012); rim.renderOrder = 3;
  group.add(inner, body, rim);

  // Frosted header band and binder rings.
  const headerGeo = track(new RoundedBoxGeometry(W, 0.62, D + 0.06, 6, 0.26));
  const header = new THREE.Mesh(headerGeo, track(new THREE.MeshPhysicalMaterial({
    color: 0xd6e6ff, transparent: true, opacity: 0.26, roughness: 0.22, clearcoat: 1, envMapIntensity: 2.2, depthWrite: false,
  })));
  header.position.y = 0.77; header.renderOrder = 4;
  const headerRim = new THREE.Mesh(headerGeo, track(fresnel(0xc9e2ff, 2.0, 0.9)));
  headerRim.position.y = 0.77; headerRim.scale.setScalar(1.015); headerRim.renderOrder = 4;
  group.add(header, headerRim);
  const ringGeo = track(new THREE.CylinderGeometry(0.075, 0.075, 0.5, 24));
  const ringMat = track(new THREE.MeshPhysicalMaterial({
    color: 0xe4efff, transparent: true, opacity: 0.55, roughness: 0.12, clearcoat: 1, envMapIntensity: 2.4, depthWrite: false,
  }));
  for (const x of [-0.7, 0.7]) {
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.set(x, 1.26, 0); ring.renderOrder = 4;
    group.add(ring);
  }

  // ── Printed text ────────────────────────────────────────────
  const face = document.createElement('canvas');
  face.width = W * 400; face.height = H * 400;
  const faceTex = track(new THREE.CanvasTexture(face));
  faceTex.colorSpace = THREE.SRGBColorSpace;
  faceTex.anisotropy = 4;
  const text = new THREE.Mesh(
    track(new THREE.PlaneGeometry(W, H)),
    track(new THREE.MeshBasicMaterial({ map: faceTex, transparent: true, depthWrite: false, toneMapped: false })),
  );
  text.position.set(0, BODY_Y, D / 2 + 0.012); text.renderOrder = 5;
  group.add(text);
  const redraw = () => { drawFace(face); faceTex.needsUpdate = true; };
  redraw();

  // ── Neon check mark ─────────────────────────────────────────
  const { path, A, B } = checkPath();
  const check = new THREE.Group();
  check.position.set(0.55, -0.15, D / 2 + 0.08);
  const tube = (radius, material, z = 0) => {
    const mesh = new THREE.Mesh(track(new THREE.TubeGeometry(path, 96, radius, 24, false)), material);
    mesh.position.z = z;
    return mesh;
  };
  const cap = (point, radius, material, z = 0) => {
    const mesh = new THREE.Mesh(track(new THREE.SphereGeometry(radius, 24, 16)), material);
    mesh.position.set(point.x, point.y, z);
    return mesh;
  };
  const glowMat = track(new THREE.MeshBasicMaterial({
    color: 0xff2a00, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
  }));
  const bodyMat = track(new THREE.MeshBasicMaterial({ color: 0xff5a1f, toneMapped: false }));
  const coreMat = track(new THREE.MeshBasicMaterial({ color: 0xffe6cf, toneMapped: false }));
  const glowTube = tube(0.22, glowMat); glowTube.renderOrder = 6;
  check.add(glowTube, cap(A, 0.22, glowMat), cap(B, 0.22, glowMat));
  check.add(tube(0.125, bodyMat), cap(A, 0.125, bodyMat), cap(B, 0.125, bodyMat));
  check.add(tube(0.062, coreMat, 0.075), cap(A, 0.062, coreMat, 0.075), cap(B, 0.062, coreMat, 0.075));
  group.add(check);

  // Halo behind the check mark.
  const haloTex = track(soft([[0, 'rgba(255,90,30,0.85)'], [0.45, 'rgba(255,70,20,0.28)'], [1, 'rgba(255,60,0,0)']]));
  const haloMat = track(new THREE.MeshBasicMaterial({
    map: haloTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
  }));
  const halo = new THREE.Mesh(track(new THREE.PlaneGeometry(3.4, 3.4)), haloMat);
  halo.position.set(0.55, -0.12, D / 2 + 0.03); halo.renderOrder = 6;
  group.add(halo);

  // ── Floating light particles ────────────────────────────────
  const COUNT = 26;
  const pos = new Float32Array(COUNT * 3), col = new Float32Array(COUNT * 3), speed = new Float32Array(COUNT);
  const warm = new THREE.Color(0xff8a3d), cool = new THREE.Color(0xbfe0ff);
  for (let i = 0; i < COUNT; i++) {
    pos[i * 3] = (Math.random() - 0.5) * 4.2;
    pos[i * 3 + 1] = (Math.random() - 0.5) * 4;
    pos[i * 3 + 2] = (Math.random() - 0.2) * 1.8;
    speed[i] = 0.08 + Math.random() * 0.16;
    (i % 3 ? warm : cool).toArray(col, i * 3);
  }
  const pGeo = track(new THREE.BufferGeometry());
  pGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  pGeo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const dotTex = track(soft([[0, 'rgba(255,255,255,1)'], [0.3, 'rgba(255,255,255,0.55)'], [1, 'rgba(255,255,255,0)']]));
  const particles = new THREE.Points(pGeo, track(new THREE.PointsMaterial({
    size: 0.12, map: dotTex, vertexColors: true, transparent: true, opacity: 0.85,
    blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
  })));
  particles.renderOrder = 7;

  return {
    group, particles, redraw,
    update(t, dt, still) {
      group.position.y = still ? 0 : Math.sin(t * 0.9) * 0.14;
      group.rotation.y = still ? 0.34 : 0.34 + Math.sin(t * 0.5) * 0.1;
      group.rotation.x = still ? -0.05 : -0.05 + Math.sin(t * 0.7 + 1) * 0.03;
      const pulse = still ? 1 : 0.5 + 0.5 * Math.sin(t * 2);
      haloMat.opacity = 0.55 + 0.4 * pulse;
      glowMat.opacity = 0.22 + 0.2 * pulse;
      if (!still) {
        const p = pGeo.attributes.position;
        for (let i = 0; i < COUNT; i++) {
          let y = p.getY(i) + speed[i] * dt;
          if (y > 2.2) y = -2.2;
          p.setY(i, y);
          p.setX(i, p.getX(i) + Math.sin(t * 0.6 + i) * 0.0015);
        }
        p.needsUpdate = true;
      }
    },
    dispose() { disposables.forEach((d) => d.dispose?.()); },
  };
}

export default function GlassCalendar({ className }) {
  const wrapRef = useRef(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    const still = Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
    } catch {
      return undefined;                 // no WebGL: the glow behind stays
    }
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    Object.assign(renderer.domElement.style, { position: 'absolute', inset: '0', width: '100%', height: '100%' });
    renderer.domElement.setAttribute('aria-hidden', 'true');
    wrap.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envTarget = pmrem.fromScene(new RoomEnvironment(), 0.04);
    scene.environment = envTarget.texture;
    const key = new THREE.DirectionalLight(0xaed0ff, 2.4);          // cool glass highlights
    key.position.set(-4, 3, 6);
    const rimWarm = new THREE.DirectionalLight(0xff7a3a, 2.2);
    rimWarm.position.set(5, -1, 3);
    scene.add(key, rimWarm, new THREE.AmbientLight(0xffffff, 0.2));

    const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 50);
    camera.position.set(0.1, 0.1, 8.2);
    const built = buildScene();
    scene.add(built.group, built.particles);

    let raf = 0, visible = true, last = performance.now();
    const start = last;
    const render = (now) => {
      const t = (now - start) / 1000, dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      key.position.x = still ? -4 : -4 + Math.sin(t * 0.55) * 5;    // light sweeps across the glass
      built.update(t, dt, still);
      renderer.render(scene, camera);
    };
    const resize = () => {
      const w = wrap.clientWidth, h = wrap.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      render(performance.now());
    };
    const loop = (now) => {
      render(now);
      if (visible && !document.hidden) raf = requestAnimationFrame(loop);
    };
    const play = () => {
      cancelAnimationFrame(raf);
      if (!still && visible && !document.hidden) { last = performance.now(); raf = requestAnimationFrame(loop); }
    };

    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    resize();
    const io = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; play(); });
    io.observe(wrap);
    document.addEventListener('visibilitychange', play);
    play();
    // The text uses the site font; redraw once it has loaded.
    document.fonts?.load('600 100px Outfit').then(() => { built.redraw(); render(performance.now()); }).catch(() => {});

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      document.removeEventListener('visibilitychange', play);
      built.dispose();
      scene.traverse((o) => { if (o.material && !Array.isArray(o.material)) o.material.dispose(); });
      envTarget.dispose();
      pmrem.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, []);

  // Colour classes avoid the word "white": the light-mode .mk-band rules in index.css
  // match it by substring. The stage stays dark in both themes, like the card it replaces.
  return (
    <div role="img" aria-label="A floating glass calendar with a glowing check mark and the word BOOKED: SmartSDR books meetings"
      className={cn('relative mx-auto aspect-square w-full max-w-[22rem] overflow-hidden rounded-[2rem] border border-[rgba(255,255,255,0.07)] bg-[#0A0807] sm:max-w-[26rem] md:max-w-[28rem]', className)}>
      <div aria-hidden="true" className="absolute -right-10 top-1/4 h-[70%] w-[70%] rounded-full bg-[radial-gradient(circle,rgba(255,80,20,0.28),transparent_65%)]" />
      <div aria-hidden="true" className="absolute -left-12 -top-12 h-[60%] w-[60%] rounded-full bg-[radial-gradient(circle,rgba(110,160,255,0.16),transparent_65%)]" />
      <div ref={wrapRef} className="absolute inset-0" />
    </div>
  );
}
