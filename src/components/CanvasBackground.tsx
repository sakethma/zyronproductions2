import React, { useEffect, useRef } from 'react';

import ShootingStars from './ShootingStars';

export default function CanvasBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = canvas.width = window.innerWidth;
    let height = canvas.height = window.innerHeight;

    const handleResize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    // Starfield
    const stars = Array.from({ length: 150 }).map(() => ({
      x: Math.random() * width,
      y: Math.random() * height,
      size: Math.random() * 2 + 0.5,
      speed: Math.random() * 0.2 + 0.05,
      opacity: Math.random(),
    }));

    // Sparkles
    const sparkles = Array.from({ length: 5 }).map(() => ({
      x: Math.random() * width,
      y: Math.random() * height,
      size: Math.random() * 5 + 3,
      pulseSpeed: Math.random() * 0.05 + 0.02,
      angle: Math.random() * Math.PI,
      opacity: Math.random(),
    }));

    // Shooting stars
    let shootingStars: any[] = [];
    const addShootingStar = () => {
      shootingStars.push({
        x: Math.random() * width,
        y: 0,
        len: Math.random() * 80 + 20,
        speed: Math.random() * 10 + 10,
        angle: Math.PI / 4 + (Math.random() * 0.2 - 0.1), // roughly diagonal
      });
      setTimeout(addShootingStar, Math.random() * 2000 + 1000);
    };
    setTimeout(addShootingStar, 1000);

    let animationFrameId: number;

    const drawStar = (cx: number, cy: number, spikes: number, outerRadius: number, innerRadius: number, fill: string) => {
      let rot = Math.PI / 2 * 3;
      let x = cx;
      let y = cy;
      let step = Math.PI / spikes;

      ctx.beginPath();
      ctx.moveTo(cx, cy - outerRadius);
      for (let i = 0; i < spikes; i++) {
        x = cx + Math.cos(rot) * outerRadius;
        y = cy + Math.sin(rot) * outerRadius;
        ctx.lineTo(x, y);
        rot += step;

        x = cx + Math.cos(rot) * innerRadius;
        y = cy + Math.sin(rot) * innerRadius;
        ctx.lineTo(x, y);
        rot += step;
      }
      ctx.lineTo(cx, cy - outerRadius);
      ctx.closePath();
      ctx.fillStyle = fill;
      ctx.fill();
    };

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      // Draw stars
      stars.forEach((star) => {
        star.y += star.speed;
        if (star.y > height) {
          star.y = 0;
          star.x = Math.random() * width;
        }
        ctx.fillStyle = `rgba(224, 170, 255, ${star.opacity})`;
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
        ctx.fill();
      });

      // Draw sparkles
      sparkles.forEach((sparkle) => {
        sparkle.angle += sparkle.pulseSpeed;
        const currentOpacity = (Math.sin(sparkle.angle) + 1) / 2;
        drawStar(sparkle.x, sparkle.y, 4, sparkle.size, sparkle.size / 4, `rgba(255, 255, 255, ${currentOpacity})`);
      });

      // Draw shooting stars
      shootingStars.forEach((ss, idx) => {
        ss.x += Math.cos(ss.angle) * ss.speed;
        ss.y += Math.sin(ss.angle) * ss.speed;
        
        const gradient = ctx.createLinearGradient(ss.x, ss.y, ss.x - Math.cos(ss.angle) * ss.len, ss.y - Math.sin(ss.angle) * ss.len);
        gradient.addColorStop(0, 'rgba(157, 78, 221, 1)'); // Magenta-violet
        gradient.addColorStop(1, 'rgba(157, 78, 221, 0)');

        ctx.strokeStyle = gradient;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(ss.x, ss.y);
        ctx.lineTo(ss.x - Math.cos(ss.angle) * ss.len, ss.y - Math.sin(ss.angle) * ss.len);
        ctx.stroke();

        if (ss.y > height || ss.x > width) {
          shootingStars.splice(idx, 1);
        }
      });

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <>
      <ShootingStars />
      <canvas ref={canvasRef} className="absolute inset-0 z-0 pointer-events-none opacity-60" />
      {/* Nebula Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90vw] h-[90vw] max-w-[800px] max-h-[800px] rounded-full blur-[120px] bg-gradient-radial from-[#8A2BE2] via-[#C724B1]/40 to-transparent opacity-30 animate-pulse-slow pointer-events-none z-0"></div>
    </>
  );
}
