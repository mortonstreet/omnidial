"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

interface Logo3DSpinnerProps {
  size?: number;
  className?: string;
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
    renderer.toneMappingExposure = 1.4;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 100);
    camera.position.set(0, 0, 6);

    // Build the Omnidial mark: torus ring + indicator sphere
    const torusGeo = new THREE.TorusGeometry(0.7, 0.1, 32, 100);
    const sphereGeo = new THREE.SphereGeometry(0.12, 32, 32);

    // Clean white ceramic material
    const material = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      metalness: 0.0,
      roughness: 0.15,
      clearcoat: 0.8,
      clearcoatRoughness: 0.1,
      reflectivity: 0.6,
      envMapIntensity: 0.8,
    });

    const ring = new THREE.Mesh(torusGeo, material);
    const dot = new THREE.Mesh(sphereGeo, material);
    // Position dot at 45° on the ring (upper-right)
    dot.position.set(
      0.7 * Math.cos(Math.PI / 4),
      0.7 * Math.sin(Math.PI / 4),
      0
    );

    const group = new THREE.Group();
    group.add(ring);
    group.add(dot);
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
          vec3 mid = vec3(0.08, 0.08, 0.1);
          vec3 bright = vec3(0.2, 0.2, 0.22);
          vec3 color = mix(dark, mid, t);
          float spot = smoothstep(0.6, 1.0, t) * smoothstep(0.3, 0.7, dir.x * 0.5 + 0.5);
          color = mix(color, bright, spot * 0.5);
          gl_FragColor = vec4(color, 1.0);
        }
      `,
    });
    envScene.add(new THREE.Mesh(envGeo, envMat));
    cubeCamera.update(renderer, envScene);
    material.envMap = cubeRenderTarget.texture;

    // Animation
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
      torusGeo.dispose();
      sphereGeo.dispose();
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
