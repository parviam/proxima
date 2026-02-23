// Star field — the foundation of the experience
import { randomRange, clamp, lerp } from './math.js';

const REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export class StarField {
  constructor() {
    this.stars = [];
    this.startTime = performance.now();
    this.frameCount = 0;
    this.brightStar = null;
    this.cursorX = -1;
    this.cursorY = -1;
  }

  init(width, height) {
    const isMobile = Math.min(width, height) < 768;
    const area = width * height;
    const count = isMobile
      ? clamp(Math.floor(area / 8000), 150, 300)
      : clamp(Math.floor(area / 3000), 400, 1200);

    this.stars = new Array(count);
    for (let i = 0; i < count; i++) {
      this.stars[i] = this._createStar();
    }

    // The bright star — persistent, special, never dies
    if (!this.brightStar) {
      this.brightStar = {
        x: 0.5,
        y: 0.12,
        baseRadius: 3.0,
        radius: 3.0,
        opacity: 0.95,
        phase: 0,
        hoverIntensity: 0,
      };
    }
  }

  getBrightStarScreenPos(w, h) {
    return { x: this.brightStar.x * w, y: this.brightStar.y * h };
  }

  setCursorPos(x, y) {
    this.cursorX = x;
    this.cursorY = y;
  }

  _createStar() {
    return {
      x: Math.random(),
      y: Math.random(),
      vx: randomRange(-0.000015, 0.000015),
      vy: randomRange(-0.000015, 0.000015),
      radius: randomRange(0.8, 1.8),
      opacity: 0,
      targetOpacity: randomRange(0.05, 0.9),
      fadeSpeed: randomRange(0.002, 0.005),
      phase: randomRange(0, Math.PI * 2),
      // For the initial fade-in, each star has a random delay
      fadeInDelay: randomRange(0, 3000),
      fadedIn: false,
      // Lifecycle
      lifespan: randomRange(40000, 120000),
      birthTime: 0,
      dying: false,
    };
  }

  update(time) {
    this.frameCount++;
    // Throttle to every 2nd frame
    if (this.frameCount % 2 !== 0) return;

    const elapsed = time - this.startTime;

    for (let i = 0; i < this.stars.length; i++) {
      const star = this.stars[i];

      // Initial fade-in: eyes adjusting to darkness
      if (!star.fadedIn) {
        if (elapsed < star.fadeInDelay) continue;
        const fadeInProgress = clamp((elapsed - star.fadeInDelay) / 2000, 0, 1);
        star.opacity = fadeInProgress * star.targetOpacity;
        if (fadeInProgress >= 1) {
          star.fadedIn = true;
          star.birthTime = time;
        }
        continue;
      }

      if (REDUCED_MOTION) continue;

      // Twinkle: drift toward target opacity
      const diff = star.targetOpacity - star.opacity;
      if (Math.abs(diff) < 0.01) {
        // Pick new target close to current opacity (unless dying)
        if (!star.dying) {
          const lo = clamp(star.opacity - 0.15, 0.3, 0.9);
          const hi = clamp(star.opacity + 0.15, 0.3, 0.9);
          star.targetOpacity = randomRange(lo, hi);
          star.fadeSpeed = randomRange(0.001, 0.003);
        }
      } else {
        star.opacity += Math.sign(diff) * star.fadeSpeed;
        star.opacity = clamp(star.opacity, 0, 1);
      }

      // Drift
      star.x += star.vx;
      star.y += star.vy;
      if (star.x < 0) star.x += 1;
      if (star.x > 1) star.x -= 1;
      if (star.y < 0) star.y += 1;
      if (star.y > 1) star.y -= 1;

      // Lifecycle — fade out and respawn
      const age = time - star.birthTime;
      if (star.birthTime > 0 && age > star.lifespan && !star.dying) {
        star.dying = true;
        star.targetOpacity = 0;
        star.fadeSpeed = 0.002;
      }
      if (star.dying && star.opacity <= 0.01) {
        star.x = Math.random();
        star.y = Math.random();
        star.vx = randomRange(-0.000015, 0.000015);
        star.vy = randomRange(-0.000015, 0.000015);
        star.radius = randomRange(0.8, 1.8);
        star.phase = randomRange(0, Math.PI * 2);
        star.lifespan = randomRange(40000, 120000);
        star.birthTime = time;
        star.opacity = 0;
        star.targetOpacity = randomRange(0.3, 0.9);
        star.fadeSpeed = randomRange(0.001, 0.003);
        star.dying = false;
      }
    }

    // Bright star breathing pulse
    if (this.brightStar) {
      const breath = REDUCED_MOTION ? 0 : Math.sin(time * 0.0015) * 0.5;
      this.brightStar.radius = this.brightStar.baseRadius + breath;

      // Hover intensity based on cursor proximity
      if (this.cursorX >= 0) {
        // Use approximate screen distance (assuming ~1000px viewport)
        const dx = this.brightStar.x - this.cursorX;
        const dy = this.brightStar.y - this.cursorY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const proximity = 1 - clamp(dist / 0.1, 0, 1); // normalized coords, ~100px range
        const target = proximity > 0 ? proximity : 0;
        this.brightStar.hoverIntensity = lerp(this.brightStar.hoverIntensity, target, 0.08);
      }
    }
  }

  getNearbyStars(px, py, radius, w, h) {
    const results = [];
    const r2 = radius * radius;
    for (let i = 0; i < this.stars.length; i++) {
      const star = this.stars[i];
      if (star.opacity < 0.15) continue;
      const sx = star.x * w;
      const sy = star.y * h;
      const dx = sx - px;
      const dy = sy - py;
      if (dx * dx + dy * dy <= r2) {
        results.push({ x: sx, y: sy, opacity: star.opacity, radius: star.radius });
      }
    }
    return results;
  }

  draw(ctx, width, height, time) {
    ctx.clearRect(0, 0, width, height);

    for (let i = 0; i < this.stars.length; i++) {
      const star = this.stars[i];
      if (star.opacity <= 0) continue;

      const sx = star.x * width;
      const sy = star.y * height;

      // Shimmer: subtle sine wave overlay
      let shimmer = REDUCED_MOTION ? 0 : Math.sin(time * 0.001 + star.phase) * 0.05;
      let finalOpacity = clamp(star.opacity + shimmer, 0, 1);

      // Draw star
      ctx.globalAlpha = finalOpacity;
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(sx, sy, star.radius, 0, Math.PI * 2);
      ctx.fill();

      // Bright star cross glow
      if (star.opacity > 0.7) {
        const crossLen = star.radius * 3 + 2;
        ctx.globalAlpha = finalOpacity * 0.3;
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 0.5;

        ctx.beginPath();
        ctx.moveTo(sx - crossLen, sy);
        ctx.lineTo(sx + crossLen, sy);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(sx, sy - crossLen);
        ctx.lineTo(sx, sy + crossLen);
        ctx.stroke();
      }
    }

    // Draw the bright star
    if (this.brightStar) {
      const bs = this.brightStar;
      const bx = bs.x * width;
      const by = bs.y * height;
      const hover = bs.hoverIntensity;

      // Radial halo
      const haloRadius = 12 + hover * 6;
      const haloOpacity = 0.08 + hover * 0.06;
      const gradient = ctx.createRadialGradient(bx, by, 0, bx, by, haloRadius);
      gradient.addColorStop(0, `rgba(255, 255, 255, ${haloOpacity})`);
      gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.globalAlpha = 1;
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(bx, by, haloRadius, 0, Math.PI * 2);
      ctx.fill();

      // Core
      ctx.globalAlpha = bs.opacity;
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(bx, by, bs.radius, 0, Math.PI * 2);
      ctx.fill();

      // Extended cross-flare
      const crossLen = bs.radius * 5 + 4 + hover * 8;
      ctx.globalAlpha = bs.opacity * (0.3 + hover * 0.15);
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 0.5;

      ctx.beginPath();
      ctx.moveTo(bx - crossLen, by);
      ctx.lineTo(bx + crossLen, by);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(bx, by - crossLen);
      ctx.lineTo(bx, by + crossLen);
      ctx.stroke();

      // Diagonal flares (shorter)
      const diagLen = crossLen * 0.5;
      ctx.globalAlpha = bs.opacity * (0.12 + hover * 0.08);
      ctx.beginPath();
      ctx.moveTo(bx - diagLen, by - diagLen);
      ctx.lineTo(bx + diagLen, by + diagLen);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(bx + diagLen, by - diagLen);
      ctx.lineTo(bx - diagLen, by + diagLen);
      ctx.stroke();
    }

    ctx.globalAlpha = 1;
  }
}
