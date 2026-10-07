import { useEffect, useRef } from 'react';
import * as THREE from 'three';

/**
 * Impactful 3D hero — an undulating field of points that ripples like sound
 * across the surface. On-theme for a voice / call-intelligence product.
 * Raw three.js (no extra deps). Pointer parallax; respects reduced-motion.
 */
export default function HeroWave3D({ className = '' }) {
  const mountRef = useRef(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
    camera.position.set(0, 4.2, 9);
    camera.lookAt(0, -0.5, 0);

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    mount.appendChild(renderer.domElement);
    Object.assign(renderer.domElement.style, { width: '100%', height: '100%', display: 'block' });

    // Grid of points
    const COLS = 90;
    const ROWS = 60;
    const GAP = 0.42;
    const count = COLS * ROWS;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);

    const cBrand = new THREE.Color('#F87217');
    const cAccent = new THREE.Color('#FFB56B');
    let i = 0;
    for (let x = 0; x < COLS; x++) {
      for (let z = 0; z < ROWS; z++) {
        positions[i * 3] = (x - COLS / 2) * GAP;
        positions[i * 3 + 1] = 0;
        positions[i * 3 + 2] = (z - ROWS / 2) * GAP;
        const mix = cBrand.clone().lerp(cAccent, x / COLS);
        colors[i * 3] = mix.r;
        colors[i * 3 + 1] = mix.g;
        colors[i * 3 + 2] = mix.b;
        i++;
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    // Soft round sprite so points read as glowing dots, not squares
    const sprite = (() => {
      const c = document.createElement('canvas');
      c.width = c.height = 64;
      const g = c.getContext('2d');
      const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      grd.addColorStop(0, 'rgba(255,255,255,1)');
      grd.addColorStop(0.35, 'rgba(255,255,255,0.85)');
      grd.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grd;
      g.fillRect(0, 0, 64, 64);
      const t = new THREE.CanvasTexture(c);
      return t;
    })();

    const mat = new THREE.PointsMaterial({
      size: 0.13,
      map: sprite,
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      opacity: 0.95,
    });

    const points = new THREE.Points(geo, mat);
    scene.add(points);

    // Pointer parallax
    const target = { x: 0, y: 0 };
    const cur = { x: 0, y: 0 };
    const onMove = (e) => {
      const r = mount.getBoundingClientRect();
      target.x = ((e.clientX - r.left) / r.width - 0.5) * 2;
      target.y = ((e.clientY - r.top) / r.height - 0.5) * 2;
    };
    window.addEventListener('pointermove', onMove);

    const resize = () => {
      const w = mount.clientWidth;
      const h = mount.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(mount);

    const pos = geo.attributes.position.array;
    const clock = new THREE.Clock();
    let raf;

    const render = () => {
      const t = clock.getElapsedTime();
      let k = 0;
      for (let x = 0; x < COLS; x++) {
        for (let z = 0; z < ROWS; z++) {
          const wx = (x - COLS / 2) * GAP;
          const wz = (z - ROWS / 2) * GAP;
          const d = Math.sqrt(wx * wx + wz * wz);
          pos[k * 3 + 1] =
            Math.sin(d * 0.7 - t * 1.6) * 0.9 * Math.exp(-d * 0.05) +
            Math.sin(wx * 0.35 + t * 0.9) * 0.35;
          k++;
        }
      }
      geo.attributes.position.needsUpdate = true;

      cur.x += (target.x - cur.x) * 0.04;
      cur.y += (target.y - cur.y) * 0.04;
      points.rotation.y = cur.x * 0.18;
      camera.position.x = cur.x * 0.8;
      camera.position.y = 4.2 - cur.y * 0.5;
      camera.lookAt(0, -0.5, 0);

      renderer.render(scene, camera);
      raf = requestAnimationFrame(render);
    };

    if (reduced) {
      renderer.render(scene, camera);
    } else {
      raf = requestAnimationFrame(render);
    }

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('pointermove', onMove);
      ro.disconnect();
      geo.dispose();
      mat.dispose();
      sprite.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
    };
  }, []);

  return <div ref={mountRef} className={className} aria-hidden="true" />;
}
