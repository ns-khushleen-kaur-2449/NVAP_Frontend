import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

export default function HeroOrb({ className = '', style = {} }) {
  const mountRef = useRef(null);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    RectAreaLightUniformsLib.init();

    const W = container.clientWidth || 600;
    const H = container.clientHeight || 480;

    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        premultipliedAlpha: false,
        powerPreference: 'high-performance',
      });
    } catch (e) { console.error('WebGL unavailable:', e); return; }

    renderer.setSize(W, H);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    renderer.autoClear = true;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.NoToneMapping;
    renderer.toneMappingExposure = 1.0;

    renderer.domElement.style.filter = [
      'drop-shadow(0 0 8px rgba(253,141,60,1))',
      'drop-shadow(0 0 24px rgba(253,141,60,0.75))',
      'drop-shadow(0 0 50px rgba(253,141,60,0.45))',
    ].join(' ');
    renderer.domElement.style.background = 'transparent';
    container.appendChild(renderer.domElement);

    /* ── Scene / Camera ── */
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, W / H, 0.1, 300);
    camera.position.set(13, 9, 13);
    camera.lookAt(0, 1.5, 0);

    /* ── Environment ── */
    const pmremGen = new THREE.PMREMGenerator(renderer);
    pmremGen.compileEquirectangularShader();
    const envScene = new RoomEnvironment();
    const envMap = pmremGen.fromScene(envScene, 0.04).texture;
    scene.environment = envMap;
    envScene.dispose();
    pmremGen.dispose();

    /* ── Palette ── */
    const C_ORANGE   = 0xfd8d3c;
    const C_FACADE   = 0xfd8d3c;   // exact match
    const C_PODIUM   = 0x1a1f2e;
    const C_BAND     = 0x0d1117;
    const C_WIN_LIT  = 0xffe066;   // warm yellow
    const C_WIN_DIM  = 0xffa020;   // dim amber

    /* ── Lights ── */
    scene.add(new THREE.AmbientLight(0xffffff, 0.4));

    const sun = new THREE.DirectionalLight(0xffffff, 0.8);
    sun.position.set(10, 18, 8);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.near = 0.1;
    sun.shadow.camera.far = 100;
    sun.shadow.camera.left = sun.shadow.camera.bottom = -16;
    sun.shadow.camera.right = sun.shadow.camera.top = 16;
    scene.add(sun);

    const fill = new THREE.DirectionalLight(0xffffff, 0.3);
    fill.position.set(-6, 4, 8);
    scene.add(fill);

    // Warm point light from ground — simulates street glow
    const groundGlow = new THREE.PointLight(0xff9933, 1.2, 12);
    groundGlow.position.set(0, -1.2, 0);
    scene.add(groundGlow);

    /* ── Materials (shared, reused) ── */
    const facadeMat = new THREE.MeshBasicMaterial({
      color: C_FACADE,
    });

    const concreteMat = new THREE.MeshStandardMaterial({
      color: 0x8a7060,
      roughness: 0.9,
      metalness: 0.05,
    });

    const podiumMat = new THREE.MeshStandardMaterial({
      color: C_PODIUM,
      roughness: 0.4,
      metalness: 0.7,
      envMapIntensity: 1.0,
    });

    const bandMat = new THREE.MeshStandardMaterial({
      color: C_BAND,
      roughness: 0.6,
      metalness: 0.3,
    });

    const craneMat = new THREE.MeshStandardMaterial({
      color: 0x2a2a2a,
      roughness: 0.7,
      metalness: 0.4,
    });

    const spireMat = new THREE.MeshStandardMaterial({
      color: 0xd0d8e8,
      metalness: 0.95,
      roughness: 0.05,
    });

    /* ── Helper: Window material ── */
    function makeWinMat(lit, intensity = 1.0) {
      return new THREE.MeshStandardMaterial({
        color: lit ? 0x1a1200 : 0x050810,
        emissive: new THREE.Color(lit ? C_WIN_LIT : C_WIN_DIM),
        emissiveIntensity: lit ? 0.9 * intensity : 0.08 * intensity,
        roughness: 0.15,
        metalness: 0.05,
      });
    }

    /* ── Helper: add windows to a face of a box ── */
    function addWindowsToBox(group, tW, tH, tD, bY, cols, rows, side = 'front') {
      const FLOOR_H = tH / rows;
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const lit = Math.random() > 0.25;
          const wW = (tW - 0.1) / cols * 0.65;
          const wH = FLOOR_H * 0.52;
          const xOff = (col - (cols - 1) / 2) * ((tW - 0.1) / cols);
          const yOff = bY + row * FLOOR_H + FLOOR_H * 0.45;
          const mat = makeWinMat(lit);
          const geo = new THREE.PlaneGeometry(wW, wH);

          if (side === 'front' || side === 'both') {
            const m = new THREE.Mesh(geo, mat);
            m.position.set(xOff, yOff, tD / 2 + 0.012);
            group.add(m);
          }
          if (side === 'back' || side === 'both') {
            const m = new THREE.Mesh(geo, mat);
            m.rotation.y = Math.PI;
            m.position.set(xOff, yOff, -(tD / 2 + 0.012));
            group.add(m);
          }
          if (side === 'left' || side === 'sides') {
            const geo2 = new THREE.PlaneGeometry(wW, wH);
            const m = new THREE.Mesh(geo2, makeWinMat(Math.random() > 0.25));
            m.rotation.y = -Math.PI / 2;
            m.position.set(-(tW / 2 + 0.012), yOff, (col - (cols - 1) / 2) * ((tD - 0.1) / cols));
            group.add(m);
          }
          if (side === 'right' || side === 'sides') {
            const geo2 = new THREE.PlaneGeometry(wW, wH);
            const m = new THREE.Mesh(geo2, makeWinMat(Math.random() > 0.25));
            m.rotation.y = Math.PI / 2;
            m.position.set(tW / 2 + 0.012, yOff, (col - (cols - 1) / 2) * ((tD - 0.1) / cols));
            group.add(m);
          }
          if (side === 'all') {
            // front
            const mf = new THREE.Mesh(geo, makeWinMat(Math.random() > 0.25));
            mf.position.set(xOff, yOff, tD / 2 + 0.012);
            group.add(mf);
            // back
            const mb = new THREE.Mesh(geo.clone(), makeWinMat(Math.random() > 0.25));
            mb.rotation.y = Math.PI;
            mb.position.set(xOff, yOff, -(tD / 2 + 0.012));
            group.add(mb);
            // sides
            const geoS = new THREE.PlaneGeometry(wW, wH);
            const ml = new THREE.Mesh(geoS, makeWinMat(Math.random() > 0.25));
            ml.rotation.y = -Math.PI / 2;
            ml.position.set(-(tW / 2 + 0.012), yOff, xOff);
            group.add(ml);
            const mr = new THREE.Mesh(geoS.clone(), makeWinMat(Math.random() > 0.25));
            mr.rotation.y = Math.PI / 2;
            mr.position.set(tW / 2 + 0.012, yOff, xOff);
            group.add(mr);
          }
        }
      }
    }

    /* ── Helper: floor bands ── */
    function addFloorBands(group, tW, tH, tD, baseY, floors) {
      const FLOOR_H = tH / floors;
      for (let i = 1; i < floors; i++) {
        const band = new THREE.Mesh(
          new THREE.BoxGeometry(tW + 0.06, 0.055, tD + 0.06),
          bandMat
        );
        band.position.set(0, baseY + i * FLOOR_H, 0);
        group.add(band);
      }
    }

    /* ── Helper: simple cypress ── */
    function addCypress(parent, x, z, scale = 1) {
      const trunkMat = new THREE.MeshStandardMaterial({ color: 0x1a1008, roughness: 0.95 });
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.06 * scale, 0.1 * scale, 0.5 * scale, 7), trunkMat);
      trunk.position.set(x, -0.75, z);
      parent.add(trunk);
      const conesMat = new THREE.MeshStandardMaterial({ color: 0x0e2010, roughness: 0.75, metalness: 0.0 });
      [[0, 0.4, 0.8], [0, 1.0, 0.7], [0, 1.55, 0.6]].forEach(([dy, cy, rb]) => {
        const cone = new THREE.Mesh(new THREE.ConeGeometry(rb * scale, (cy - dy + 0.3) * scale, 7), conesMat);
        cone.position.set(x, -0.75 + 0.5 * scale + (dy + cy) / 2 * scale, z);
        parent.add(cone);
      });
    }

    /* ════════════════════════════════════════
       MAIN GROUP
    ════════════════════════════════════════ */
    const group = new THREE.Group();
    group.position.set(0, -1.2, 0);
    scene.add(group);

    /* ── Podium ── */
    const podium = new THREE.Mesh(new THREE.BoxGeometry(5.2, 1.2, 5.2), podiumMat);
    podium.position.set(0, -0.6, 0);
    podium.castShadow = true;
    podium.receiveShadow = true;
    group.add(podium);

    // Podium edge chamfer strips
    const chamferMat = new THREE.MeshBasicMaterial({ color: 0xfd8d3c });
    [-1, 1].forEach(sx => [-1, 1].forEach(sz => {
      const strip = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.22, 0.08), chamferMat);
      strip.position.set(sx * 2.56, -0.6, sz * 2.56);
      group.add(strip);
    }));

    /* ── MAIN TOWER ── */
    const TOWER_W = 2.2, TOWER_H = 9.5, TOWER_D = 2.2;
    const FLOORS = 12;
    const FLOOR_H = TOWER_H / FLOORS;
    const towerBaseY = 0.2;

    const tower = new THREE.Mesh(new THREE.BoxGeometry(TOWER_W, TOWER_H, TOWER_D), facadeMat);
    tower.position.set(0, towerBaseY + TOWER_H / 2, 0);
    tower.castShadow = true;
    tower.receiveShadow = true;
    group.add(tower);

    addFloorBands(group, TOWER_W, TOWER_H, TOWER_D, towerBaseY, FLOORS);
    addWindowsToBox(group, TOWER_W, TOWER_H, TOWER_D, towerBaseY + FLOOR_H * 0.1, 3, FLOORS, 'all');

    /* Setback floor */
    const SB_W = 1.7, SB_H = 4.5, SB_D = 1.7;
    const SB_FLOORS = 6;
    const sbBaseY = towerBaseY + TOWER_H + 0.15;

    const setback = new THREE.Mesh(new THREE.BoxGeometry(SB_W, SB_H, SB_D), facadeMat);
    setback.position.set(0, sbBaseY + SB_H / 2, 0);
    setback.castShadow = true;
    group.add(setback);

    addFloorBands(group, SB_W, SB_H, SB_D, sbBaseY, SB_FLOORS);
    addWindowsToBox(group, SB_W, SB_H, SB_D, sbBaseY + (SB_H / SB_FLOORS) * 0.1, 2, SB_FLOORS, 'all');

    /* Spire */
    const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.13, 2.6, 8), spireMat);
    spire.position.set(0, sbBaseY + SB_H + 1.3, 0);
    group.add(spire);

    /* ── CRANE ── */
    const mast = new THREE.Mesh(new THREE.BoxGeometry(0.16, 7.5, 0.16), craneMat);
    mast.position.set(3.3, 3.5, 0);
    group.add(mast);

    const jib = new THREE.Mesh(new THREE.BoxGeometry(5.0, 0.14, 0.14), craneMat);
    jib.position.set(1.3, 7.2, 0);
    group.add(jib);

    const counterJib = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.14, 0.14), craneMat);
    counterJib.position.set(4.2, 7.2, 0);
    group.add(counterJib);

    const trolley = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 0.22), craneMat);
    trolley.position.set(-0.2, 7.0, 0);
    group.add(trolley);

    const signMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.9, 0.45, 0.05),
      new THREE.MeshBasicMaterial({ color: C_ORANGE })
    );
    signMesh.position.set(-0.2, 7.0, 0.15);
    group.add(signMesh);

    // Cable (hanging hook line)
    const cableGeo = new THREE.CylinderGeometry(0.012, 0.012, 3.2, 5);
    const cable = new THREE.Mesh(cableGeo, new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.8 }));
    cable.position.set(-0.2, 5.35, 0);
    group.add(cable);

    /* ── SMALLER BUILDINGS ── */

    // Building helper
    function addBuilding(parent, x, z, w, h, d, floors, cols, yBase = 0.2, mat = null) {
      const m = mat || new THREE.MeshBasicMaterial({
        color: 0xfd8d3c,
      });
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
      mesh.position.set(x, yBase + h / 2, z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      parent.add(mesh);

      addFloorBands(parent, w, h, d, yBase, floors);

      // offset wins to sit at actual x,z
      const wg = parent; // same parent, just note we need offset for window helpers
      // Manual window addition at correct position
      const FHGT = h / floors;
      for (let row = 0; row < floors; row++) {
        for (let col = 0; col < cols; col++) {
          const lit = Math.random() > 0.3;
          const wW = (w - 0.08) / cols * 0.6;
          const wH = FHGT * 0.5;
          const xOff = (col - (cols - 1) / 2) * ((w - 0.08) / cols);
          const yPos = yBase + row * FHGT + FHGT * 0.45;

          const geo = new THREE.PlaneGeometry(wW, wH);
          const wMat = makeWinMat(lit, 0.85);

          const mf = new THREE.Mesh(geo, wMat);
          mf.position.set(x + xOff, yPos, z + d / 2 + 0.01);
          parent.add(mf);

          const mb = new THREE.Mesh(geo.clone(), makeWinMat(Math.random() > 0.3, 0.85));
          mb.rotation.y = Math.PI;
          mb.position.set(x + xOff, yPos, z - d / 2 - 0.01);
          parent.add(mb);
        }
      }
    }

    // Podium for smaller buildings
    const smPodMat = new THREE.MeshStandardMaterial({ color: 0x151a28, roughness: 0.5, metalness: 0.5 });

    function addBuildingWithPodium(parent, x, z, w, h, d, floors, cols, podH = 0.5) {
      const pod = new THREE.Mesh(new THREE.BoxGeometry(w + 0.3, podH, d + 0.3), smPodMat);
      pod.position.set(x, podH / 2, z);
      pod.castShadow = true;
      parent.add(pod);
      addBuilding(parent, x, z, w, h, d, floors, cols, podH);
    }

    // Left cluster
    addBuildingWithPodium(group, -3.8, -0.3, 1.1, 4.2, 1.1, 5, 2);
    addBuildingWithPodium(group, -3.6, 1.5, 0.9, 2.8, 0.9, 4, 2);

    // Right cluster
    addBuildingWithPodium(group, 3.5, -0.5, 1.0, 5.0, 1.0, 6, 2);
    addBuildingWithPodium(group, 3.4, 1.6, 0.85, 3.2, 0.85, 4, 2);

    // Back small cluster
    addBuildingWithPodium(group, -1.0, -3.4, 0.9, 3.6, 0.9, 5, 2);
    addBuildingWithPodium(group, 1.2, -3.5, 0.75, 2.4, 0.75, 3, 2);

    // Mid-ground accent building
    addBuildingWithPodium(group, -2.5, -2.5, 0.7, 1.8, 0.7, 3, 1);

    /* ── CYPRESS TREES ── */
    addCypress(group, -3.1, 0.6, 0.85);
    addCypress(group, -3.0, -1.2, 0.75);
    addCypress(group, 2.6, 1.6, 0.85);
    addCypress(group, 2.7, -2.0, 0.7);

    /* ── GROUND DISC ── */
    const groundDisc = new THREE.Mesh(
      new THREE.CylinderGeometry(5.0, 5.0, 0.07, 80),
      new THREE.MeshBasicMaterial({
        color: 0xfd8d3c,
        transparent: true,
        opacity: 0.82,
      })
    );
    groundDisc.position.set(0, -1.46, 0);
    groundDisc.receiveShadow = true;
    scene.add(groundDisc);

    // Inner accent ring on ground
    const innerRingMesh = new THREE.Mesh(
      new THREE.TorusGeometry(2.5, 0.04, 8, 80),
      new THREE.MeshStandardMaterial({ color: 0xffa040, emissive: new THREE.Color(0xff8020), emissiveIntensity: 0.6, transparent: true, opacity: 0.7 })
    );
    innerRingMesh.rotation.x = Math.PI / 2;
    innerRingMesh.position.set(0, -1.42, 0);
    scene.add(innerRingMesh);

    /* ── DATA PULSE RINGS ── */
    const rings = [];
    for (let i = 0; i < 4; i++) {
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0xfd8d3c,
        transparent: true,
        opacity: 0.4,
        side: THREE.DoubleSide,
      });
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.02, 8, 80), ringMat);
      ring.rotation.x = Math.PI / 2;
      ring.position.set(0, -1.4, 0);
      scene.add(ring);
      rings.push({ mesh: ring, mat: ringMat, phase: i / 4 });
    }

    /* ── PARTICLES ── */
    const partCount = 350;
    const partGeo = new THREE.BufferGeometry();
    const partPos = new Float32Array(partCount * 3);
    for (let i = 0; i < partCount; i++) {
      const r = 1.5 + Math.random() * 5.5;
      const angle = Math.random() * Math.PI * 2;
      partPos[i * 3]     = Math.cos(angle) * r;
      partPos[i * 3 + 1] = Math.random() * 14 - 1.5;
      partPos[i * 3 + 2] = Math.sin(angle) * r;
    }
    partGeo.setAttribute('position', new THREE.BufferAttribute(partPos, 3));
    const particles = new THREE.Points(
      partGeo,
      new THREE.PointsMaterial({
        color: C_WIN_LIT,
        size: 0.06,
        transparent: true,
        opacity: 0.8,
        sizeAttenuation: true,
      })
    );
    scene.add(particles);

    /* ── EXTRA GLOWING ELEMENTS ── */
    // Glowing floating orbs
    const glowingOrbs = [];
    const orbGeo = new THREE.SphereGeometry(0.12, 16, 16);
    const orbMat = new THREE.MeshBasicMaterial({ color: 0xffe066, transparent: true, opacity: 0.9 });
    const orbMat2 = new THREE.MeshBasicMaterial({ color: 0xfd8d3c, transparent: true, opacity: 0.9 });
    for (let i = 0; i < 8; i++) {
      const orb = new THREE.Mesh(orbGeo, i % 2 === 0 ? orbMat : orbMat2);
      scene.add(orb);
      glowingOrbs.push({ 
        mesh: orb, 
        angle: (i / 8) * Math.PI * 2, 
        speed: 0.3 + Math.random() * 0.4, 
        radius: 2.5 + Math.random() * 3, 
        yOffset: 1 + Math.random() * 6 
      });
    }

    // Vertical data streams
    const streams = [];
    for (let i = 0; i < 25; i++) {
       const h = 0.5 + Math.random() * 3;
       const stream = new THREE.Mesh(
         new THREE.CylinderGeometry(0.015, 0.015, h, 4), 
         new THREE.MeshBasicMaterial({ color: Math.random() > 0.5 ? 0xfd8d3c : 0xffe066, transparent: true, opacity: 0.65 })
       );
       stream.position.set((Math.random() - 0.5) * 10, Math.random() * 10 - 2, (Math.random() - 0.5) * 10);
       scene.add(stream);
       streams.push({ mesh: stream, speed: 0.03 + Math.random() * 0.05, resetY: -3, maxY: 12 });
    }

    /* ── ANIMATION ── */
    let t = 0, frameId;
    function animate() {
      frameId = requestAnimationFrame(animate);
      t += 0.008;

      group.rotation.y = t * 0.18;
      group.position.y = -1.2 + Math.sin(t * 1.3) * 0.08;

      // Ground glow pulse
      groundGlow.intensity = 0.9 + Math.sin(t * 2.1) * 0.3;

      rings.forEach((r) => {
        const life = (t * 0.5 + r.phase) % 1.0;
        r.mesh.scale.setScalar(1 + life * 10);
        r.mat.opacity = (1 - life) * 0.5;
      });

      particles.rotation.y = t * 0.035;
      particles.position.y = Math.sin(t * 0.3) * 0.12;

      glowingOrbs.forEach((o) => {
        o.angle += 0.01 * o.speed;
        o.mesh.position.set(Math.cos(o.angle) * o.radius, o.yOffset + Math.sin(t * 2 + o.angle) * 0.5, Math.sin(o.angle) * o.radius);
      });

      streams.forEach((s) => {
        s.mesh.position.y += s.speed;
        if (s.mesh.position.y > s.maxY) {
          s.mesh.position.y = s.resetY;
          s.mesh.position.x = (Math.random() - 0.5) * 10;
          s.mesh.position.z = (Math.random() - 0.5) * 10;
        }
      });

      renderer.render(scene, camera);
    }
    animate();

    /* ── RESIZE ── */
    const handleResize = () => {
      const nW = container.clientWidth, nH = container.clientHeight;
      camera.aspect = nW / nH;
      camera.updateProjectionMatrix();
      renderer.setSize(nW, nH);
    };
    const resizeObs = new ResizeObserver(handleResize);
    resizeObs.observe(container);

    /* ── CLEANUP ── */
    return () => {
      cancelAnimationFrame(frameId);
      resizeObs.disconnect();
      if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement);
      scene.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) {
          if (Array.isArray(obj.material)) obj.material.forEach(m => m.dispose());
          else obj.material.dispose();
        }
      });
      envMap.dispose();
      renderer.dispose();
    };
  }, []);

  const hudCardStyle = {
    background: 'rgba(255,255,255,0.92)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    border: '1px solid rgba(253,141,60,0.2)',
    borderRadius: '8px',
    padding: '8px 12px',
    fontFamily: "'JetBrains Mono','Fira Code','Courier New',monospace",
    fontSize: '9px',
    letterSpacing: '0.06em',
    color: '#1a1a2e',
    lineHeight: 1.85,
    pointerEvents: 'none',
  };

  return (
    <div className={`relative ${className}`} style={{ width: '100%', height: '100%', minHeight: '480px', ...style }}>
      <div ref={mountRef} style={{ width: '100%', height: '100%' }} />

      <div className="absolute inset-0 pointer-events-none" style={{ fontFamily: "'JetBrains Mono',monospace" }}>

        <div style={{
          position: 'absolute', top: '14px', left: '50%', transform: 'translateX(-50%)',
          color: 'rgba(253,141,60,0.6)', fontSize: '8px', letterSpacing: '0.22em',
          textTransform: 'uppercase', whiteSpace: 'nowrap',
        }}>
          Real Estate AI · Live Market Feed
        </div>

        <div style={{ position: 'absolute', top: '36px', left: '14px', ...hudCardStyle }}>
          <div style={{ color: '#fd8d3c', marginBottom: '3px', fontSize: '8px' }}>● LIVE</div>
          <div>₹18,400 / sqft</div>
          <div>2,841 listings</div>
          <div>142 deals active</div>
        </div>

        <div style={{
          position: 'absolute', top: '50%', right: '14px', transform: 'translateY(-50%)',
          ...hudCardStyle, display: 'flex', flexDirection: 'column', gap: '10px',
        }}>
          {[
            { val: '+4.2%', label: 'PRICE INDEX', color: '#fd8d3c' },
            { val: '94.2%', label: 'OCCUPANCY', color: '#1a1a2e' },
            { val: '↑6.8%', label: 'YOY GROWTH', color: '#fd8d3c' },
          ].map(({ val, label, color }) => (
            <div key={label} style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '17px', fontWeight: 300, color }}>{val}</div>
              <div style={{ fontSize: '7.5px', color: 'rgba(26,26,46,0.45)', letterSpacing: '0.12em', marginTop: '1px' }}>{label}</div>
            </div>
          ))}
        </div>

        <div style={{
          position: 'absolute', bottom: '48px', left: '50%', transform: 'translateX(-50%)',
          fontSize: '7.5px', color: 'rgba(26,26,46,0.25)', letterSpacing: '0.1em',
        }}>
          auto-rotating · 3D model
        </div>

        <div style={{
          position: 'absolute', bottom: '14px', left: '50%', transform: 'translateX(-50%)',
          display: 'flex', gap: '14px', whiteSpace: 'nowrap', ...hudCardStyle,
        }}>
          {[
            { color: '#fd8d3c', label: 'COMMERCIAL' },
            { color: '#ffe0c0', label: 'RESIDENTIAL', border: '1px solid rgba(253,141,60,0.4)' },
            { color: 'transparent', label: 'CONSTRUCTION', border: '1px solid rgba(253,141,60,0.8)' },
          ].map(({ color, label, border }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <div style={{ width: '7px', height: '7px', borderRadius: '2px', background: color, border }} />
              {label}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}