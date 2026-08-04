"use client";

import { useEffect, useRef, useState } from "react";

// Hook to detect mobile/tablet
function useIsMobileOrTablet() {
  const [isMobileOrTablet, setIsMobileOrTablet] = useState(false);

  useEffect(() => {
    const checkDevice = () => {
      const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
      const isSmallScreen = window.innerWidth < 1024;
      setIsMobileOrTablet(isTouchDevice || isSmallScreen);
    };

    checkDevice();
  }, []);

  return isMobileOrTablet;
}

export default function HeroBackgroundAnimation() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isMobileOrTablet = useIsMobileOrTablet();

  useEffect(() => {
    // Skip canvas animation entirely on mobile/tablet
    if (isMobileOrTablet) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    let particles: Particle[] = [];
    let time = 0;
    let isVisible = true;

    // Visibility detection to pause animation when off-screen
    const observer = new IntersectionObserver(
      (entries) => {
        isVisible = entries[0]?.isIntersecting ?? false;
      },
      { threshold: 0.01 }
    );
    observer.observe(canvas);

    // Set canvas size
    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      initParticles(rect.width, rect.height);
    };

    interface Particle {
      x: number;
      y: number;
      baseX: number;
      baseY: number;
      size: number;
      opacity: number;
      speed: number;
      angle: number;
      type: "dot" | "ring" | "line";
      phase: number;
    }

    const initParticles = (width: number, height: number) => {
      particles = [];
      const numParticles = Math.min(50, Math.floor((width * height) / 25000));

      for (let i = 0; i < numParticles; i++) {
        const types: Array<"dot" | "ring" | "line"> = ["dot", "ring", "line"];
        particles.push({
          x: Math.random() * width,
          y: Math.random() * height,
          baseX: Math.random() * width,
          baseY: Math.random() * height,
          size: Math.random() * 3 + 1,
          opacity: Math.random() * 0.15 + 0.02,
          speed: Math.random() * 0.0005 + 0.0002,
          angle: Math.random() * Math.PI * 2,
          type: types[Math.floor(Math.random() * types.length)],
          phase: Math.random() * Math.PI * 2,
        });
      }
    };

    const drawGrid = (width: number, height: number) => {
      const gridSize = 60;
      ctx.strokeStyle = "rgba(255, 255, 255, 0.02)";
      ctx.lineWidth = 0.5;

      // Vertical lines
      for (let x = 0; x <= width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }

      // Horizontal lines
      for (let y = 0; y <= height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // Grid intersection dots
      ctx.fillStyle = "rgba(255, 255, 255, 0.04)";
      for (let x = 0; x <= width; x += gridSize) {
        for (let y = 0; y <= height; y += gridSize) {
          const pulse = Math.sin(time * 0.001 + x * 0.01 + y * 0.01) * 0.5 + 0.5;
          ctx.globalAlpha = 0.02 + pulse * 0.03;
          ctx.beginPath();
          ctx.arc(x, y, 1.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
    };

    const drawParticle = (p: Particle) => {
      const pulse = Math.sin(time * 0.002 + p.phase) * 0.5 + 0.5;
      const currentOpacity = p.opacity * (0.5 + pulse * 0.5);

      if (p.type === "dot") {
        ctx.fillStyle = `rgba(255, 255, 255, ${currentOpacity})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.type === "ring") {
        ctx.strokeStyle = `rgba(255, 255, 255, ${currentOpacity * 0.7})`;
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * 4 + pulse * 2, 0, Math.PI * 2);
        ctx.stroke();
      } else if (p.type === "line") {
        ctx.strokeStyle = `rgba(255, 255, 255, ${currentOpacity * 0.5})`;
        ctx.lineWidth = 0.5;
        const length = p.size * 8;
        ctx.beginPath();
        ctx.moveTo(
          p.x - Math.cos(p.angle + time * 0.0001) * length,
          p.y - Math.sin(p.angle + time * 0.0001) * length
        );
        ctx.lineTo(
          p.x + Math.cos(p.angle + time * 0.0001) * length,
          p.y + Math.sin(p.angle + time * 0.0001) * length
        );
        ctx.stroke();
      }
    };

    const drawConnections = () => {
      const connectionDistance = 150;
      ctx.lineWidth = 0.3;

      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance < connectionDistance) {
            const opacity = (1 - distance / connectionDistance) * 0.03;
            ctx.strokeStyle = `rgba(255, 255, 255, ${opacity})`;
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.stroke();
          }
        }
      }
    };

    const drawCentralGlow = (width: number, height: number) => {
      const centerX = width / 2;
      const centerY = height * 0.35;
      const pulse = Math.sin(time * 0.001) * 0.3 + 0.7;

      const gradient = ctx.createRadialGradient(
        centerX, centerY, 0,
        centerX, centerY, 200
      );
      gradient.addColorStop(0, `rgba(59, 130, 246, ${0.08 * pulse})`);
      gradient.addColorStop(0.5, `rgba(59, 130, 246, ${0.03 * pulse})`);
      gradient.addColorStop(1, "rgba(59, 130, 246, 0)");

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(centerX, centerY, 200, 0, Math.PI * 2);
      ctx.fill();
    };

    const drawOrbitRings = (width: number, height: number) => {
      const centerX = width / 2;
      const centerY = height * 0.35;

      // Outer orbit ring
      ctx.strokeStyle = "rgba(255, 255, 255, 0.03)";
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 8]);
      ctx.beginPath();
      ctx.ellipse(centerX, centerY, 180, 120, 0, 0, Math.PI * 2);
      ctx.stroke();

      // Middle orbit ring
      ctx.strokeStyle = "rgba(255, 255, 255, 0.02)";
      ctx.beginPath();
      ctx.ellipse(centerX, centerY, 250, 160, 0, 0, Math.PI * 2);
      ctx.stroke();

      ctx.setLineDash([]);

      // Orbiting dots
      const orbitAngle1 = time * 0.0003;
      const orbitAngle2 = time * 0.0002 + Math.PI;
      const orbitAngle3 = time * 0.00025 + Math.PI / 2;

      const drawOrbitDot = (angle: number, radiusX: number, radiusY: number, size: number, opacity: number) => {
        const x = centerX + Math.cos(angle) * radiusX;
        const y = centerY + Math.sin(angle) * radiusY;
        ctx.fillStyle = `rgba(255, 255, 255, ${opacity})`;
        ctx.beginPath();
        ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fill();
      };

      drawOrbitDot(orbitAngle1, 180, 120, 2, 0.15);
      drawOrbitDot(orbitAngle2, 180, 120, 1.5, 0.1);
      drawOrbitDot(orbitAngle3, 250, 160, 1.5, 0.08);
    };

    const animate = () => {
      // Skip animation if not visible
      if (!isVisible) {
        animationFrameId = requestAnimationFrame(animate);
        return;
      }

      const rect = canvas.getBoundingClientRect();
      ctx.clearRect(0, 0, rect.width, rect.height);
      time += 16;

      // Draw subtle grid
      drawGrid(rect.width, rect.height);

      // Draw central glow
      drawCentralGlow(rect.width, rect.height);

      // Draw orbit rings
      drawOrbitRings(rect.width, rect.height);

      // Update and draw particles
      particles.forEach((p) => {
        // Gentle floating motion
        p.x = p.baseX + Math.sin(time * p.speed + p.phase) * 30;
        p.y = p.baseY + Math.cos(time * p.speed * 0.7 + p.phase) * 20;
        drawParticle(p);
      });

      // Draw connections between nearby particles
      drawConnections();

      animationFrameId = requestAnimationFrame(animate);
    };

    resize();
    animate();

    window.addEventListener("resize", resize);

    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(animationFrameId);
      observer.disconnect();
    };
  }, [isMobileOrTablet]);

  // On mobile/tablet, render a simple static gradient instead of canvas animation
  if (isMobileOrTablet) {
    return (
      <div
        className="absolute inset-0 w-full h-full pointer-events-none"
        style={{
          opacity: 0.6,
          background: 'radial-gradient(ellipse at 50% 35%, rgba(59, 130, 246, 0.08) 0%, transparent 50%)',
        }}
      />
    );
  }

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
      style={{ opacity: 0.8 }}
    />
  );
}
