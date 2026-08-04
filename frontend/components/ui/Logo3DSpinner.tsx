"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

interface Logo3DSpinnerProps {
  size?: number;
  className?: string;
}

/**
 * The OmniDial mark: a ring whose cross-section is a rounded square that
 * rotates a full turn as it sweeps the loop. That twist is what produces the
 * diagonal seams in the logo — a plain TorusGeometry has a circular profile
 * and can't show them, so the geometry is built by hand.
 */
function buildTwistedRing({
  majorRadius = 0.78,
  profileRadius = 0.3,
  twistTurns = 1,
  loopSegments = 260,
  profileSegments = 56,
  squareness = 4.2,
}) {
  const positions: number[] = [];
  const indices: number[] = [];

  // Superellipse: squareness 2 is a circle, higher values approach a rounded
  // square. 4.2 matches the flat faces and soft corners in the reference.
  const profilePoint = (t: number) => {
    const c = Math.cos(t);
    const s = Math.sin(t);
    const e = 2 / squareness;
    return [
      Math.sign(c) * Math.pow(Math.abs(c), e) * profileRadius,
      Math.sign(s) * Math.pow(Math.abs(s), e) * profileRadius,
    ] as const;
  };

  for (let i = 0; i <= loopSegments; i++) {
    const u = i / loopSegments;
    const theta = u * Math.PI * 2;
    const twist = u * Math.PI * 2 * twistTurns;

    const cosT = Math.cos(theta);
    const sinT = Math.sin(theta);
    const cosW = Math.cos(twist);
    const sinW = Math.sin(twist);

    for (let j = 0; j <= profileSegments; j++) {
      const [px, py] = profilePoint((j / profileSegments) * Math.PI * 2);

      // Rotate the profile within the (radial, axial) plane, then place it.
      const radial = px * cosW - py * sinW;
      const axial = px * sinW + py * cosW;

      positions.push(
        (majorRadius + radial) * cosT,
        (majorRadius + radial) * sinT,
        axial,
      );
    }
  }

  const stride = profileSegments + 1;
  for (let i = 0; i < loopSegments; i++) {
    for (let j = 0; j < profileSegments; j++) {
      const a = i * stride + j;
      const b = a + stride;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3),
  );
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

export function Logo3DSpinner({ size = 200, className = "" }: Logo3DSpinnerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = Math.min(window.devicePixelRatio, 2);
    canvas.width = size * dpr;
    canvas.height = size * dpr;

    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    renderer.setSize(size, size);
    renderer.setPixelRatio(dpr);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 100);
    camera.position.set(0, 0, 6);

    const ringGeo = buildTwistedRing({});

    // Brushed graphite: metallic with a clearcoat, matching the reference's
    // soft specular roll-off rather than a mirror finish.
    const material = new THREE.MeshPhysicalMaterial({
      color: 0x8b8388,
      metalness: 0.92,
      roughness: 0.28,
      clearcoat: 0.6,
      clearcoatRoughness: 0.22,
      reflectivity: 0.9,
      envMapIntensity: 1.15,
    });

    const ring = new THREE.Mesh(ringGeo, material);
    const group = new THREE.Group();
    group.add(ring);
    scene.add(group);

    // Lighting
    const keyLight = new THREE.DirectionalLight(0xffffff, 3.0);
    keyLight.position.set(3, 4, 5);
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0xf5f0e8, 1.0);
    fillLight.position.set(-4, -2, 3);
    scene.add(fillLight);

    const rimLight = new THREE.DirectionalLight(0xffffff, 2.0);
    rimLight.position.set(0, 1, -4);
    scene.add(rimLight);

    const bounceLight = new THREE.DirectionalLight(0xe8e8f0, 0.5);
    bounceLight.position.set(0, -4, 2);
    scene.add(bounceLight);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
    scene.add(ambientLight);

    // Environment map for reflections
    const cubeRenderTarget = new THREE.WebGLCubeRenderTarget(256);
    const cubeCamera = new THREE.CubeCamera(0.1, 10, cubeRenderTarget);

    const envScene = new THREE.Scene();
    const envGeo = new THREE.SphereGeometry(5, 32, 32);
    const envMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      uniforms: {},
      vertexShader: `
        varying vec3 vWorldPosition;
        void main() {
          vec4 worldPos = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPos.xyz;
          gl_Position = projectionMatrix * viewMatrix * worldPos;
        }
      `,
      fragmentShader: `
        varying vec3 vWorldPosition;
        void main() {
          vec3 dir = normalize(vWorldPosition);
          float t = dir.y * 0.5 + 0.5;
          vec3 dark = vec3(0.03, 0.03, 0.04);
          vec3 mid = vec3(0.12, 0.12, 0.14);
          vec3 bright = vec3(0.55, 0.55, 0.58);
          vec3 color = mix(dark, mid, t);
          float spot = smoothstep(0.6, 1.0, t) * smoothstep(0.3, 0.7, dir.x * 0.5 + 0.5);
          color = mix(color, bright, spot * 0.7);
          gl_FragColor = vec4(color, 1.0);
        }
      `,
    });
    envScene.add(new THREE.Mesh(envGeo, envMat));
    cubeCamera.update(renderer, envScene);
    material.envMap = cubeRenderTarget.texture;

    // Animation — same cadence as the original mark so the loader reads the same
    let time = 0;

    function animate() {
      frameRef.current = requestAnimationFrame(animate);
      time += 0.012;

      group.rotation.y = time * 1.0;
      group.rotation.x = Math.sin(time * 0.5) * 0.12;
      group.position.y = Math.sin(time * 0.6) * 0.03;

      renderer.render(scene, camera);
    }

    animate();

    return () => {
      cancelAnimationFrame(frameRef.current);
      renderer.dispose();
      ringGeo.dispose();
      material.dispose();
      envGeo.dispose();
      envMat.dispose();
    };
  }, [size]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{ width: size, height: size, display: "block" }}
    />
  );
}
