// Constellation tracer cursor + nebula illumination
import { lerp, clamp } from './math.js';

const REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const IS_TOUCH = window.matchMedia('(hover: none) and (pointer: coarse)').matches;

// Trail constants
const TRAIL_MIN_DISTANCE = 40;
const TRAIL_MIN_INTERVAL = 120;
const TRAIL_MAX_POINTS = 8;
const TRAIL_POINT_LIFETIME = 3000;

// Constellation constants
const SEARCH_RADIUS = 120;
const MAX_CONNECTIONS = 3;
const LINE_OPACITY = 0.25;
const POINT_OPACITY = 0.35;
const LINE_WIDTH = 0.8;
const LINE_DELAY = 600;        // ms after drop before lines appear
const LINE_FADE_IN = 400;      // ms to fade lines in after delay
const LINE_CHANCE = 0.45;      // probability a trail point forms constellations

export class Cursor {
  constructor() {
    this.mouseX = -200;
    this.mouseY = -200;
    this.smoothX = -200;
    this.smoothY = -200;
    this.active = false;
    this.touchFading = false;
    this.touchFadeStart = 0;
    this.nebulaOpacity = 0;
    this.targetNebulaOpacity = 0.08;
    this.trailPoints = [];
    this.lastDropX = -999;
    this.lastDropY = -999;
    this.lastDropTime = 0;
    this.starField = null;
  }

  init(starField) {
    this.starField = starField || null;
    this._bindEvents();
  }

  _bindEvents() {
    if (!IS_TOUCH) {
      document.addEventListener('mousemove', (e) => {
        this.mouseX = e.clientX;
        this.mouseY = e.clientY;
        this.active = true;
        this.touchFading = false;
      });

      document.addEventListener('mouseleave', () => {
        this.active = false;
      });

      document.addEventListener('mouseenter', (e) => {
        this.mouseX = e.clientX;
        this.mouseY = e.clientY;
        this.smoothX = e.clientX;
        this.smoothY = e.clientY;
        this.active = true;
      });
    }

    // Touch events
    document.addEventListener('touchmove', (e) => {
      const touch = e.touches[0];
      this.mouseX = touch.clientX;
      this.mouseY = touch.clientY;
      this.active = true;
      this.touchFading = false;
    }, { passive: true });

    document.addEventListener('touchstart', (e) => {
      const touch = e.touches[0];
      this.mouseX = touch.clientX;
      this.mouseY = touch.clientY;
      this.smoothX = touch.clientX;
      this.smoothY = touch.clientY;
      this.active = true;
      this.touchFading = false;
    }, { passive: true });

    document.addEventListener('touchend', () => {
      this.touchFading = true;
      this.touchFadeStart = performance.now();
    }, { passive: true });
  }

  update(time) {
    const lerpFactor = 0.18;
    this.smoothX = lerp(this.smoothX, this.mouseX, lerpFactor);
    this.smoothY = lerp(this.smoothY, this.mouseY, lerpFactor);

    // Nebula opacity
    if (this.touchFading) {
      const fadeDuration = 1000;
      const elapsed = time - this.touchFadeStart;
      this.nebulaOpacity = Math.max(0, this.targetNebulaOpacity * (1 - elapsed / fadeDuration));
      if (elapsed >= fadeDuration) {
        this.touchFading = false;
        this.active = false;
        this.nebulaOpacity = 0;
      }
    } else if (this.active) {
      this.nebulaOpacity = lerp(this.nebulaOpacity, this.targetNebulaOpacity, 0.05);
    } else {
      this.nebulaOpacity = lerp(this.nebulaOpacity, 0, 0.05);
    }

    // Drop trail points
    if (this.active && !IS_TOUCH && !REDUCED_MOTION) {
      const dx = this.smoothX - this.lastDropX;
      const dy = this.smoothY - this.lastDropY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist >= TRAIL_MIN_DISTANCE && (time - this.lastDropTime) >= TRAIL_MIN_INTERVAL) {
        this.trailPoints.push({
          x: this.smoothX,
          y: this.smoothY,
          birthTime: time,
          opacity: 0,
          connectStars: Math.random() < LINE_CHANCE,
        });
        this.lastDropX = this.smoothX;
        this.lastDropY = this.smoothY;
        this.lastDropTime = time;

        while (this.trailPoints.length > TRAIL_MAX_POINTS) {
          this.trailPoints.shift();
        }
      }
    }

    // Age trail points
    for (let i = this.trailPoints.length - 1; i >= 0; i--) {
      const point = this.trailPoints[i];
      const age = time - point.birthTime;

      if (age >= TRAIL_POINT_LIFETIME) {
        this.trailPoints.splice(i, 1);
        continue;
      }

      const t = age / TRAIL_POINT_LIFETIME;
      if (t < 0.1) {
        point.opacity = t / 0.1;
      } else {
        const fadeT = (t - 0.1) / 0.9;
        point.opacity = 1 - fadeT * fadeT;
      }
    }
  }

  draw(ctx, width, height, time) {
    ctx.clearRect(0, 0, width, height);

    const hasNebula = this.nebulaOpacity >= 0.001;
    const hasTrail = this.trailPoints.length > 0;
    const isVisible = this.active || hasNebula || hasTrail;

    if (!isVisible) return;

    if (hasNebula) this._drawNebula(ctx, time);
    if (hasTrail) this._drawConstellations(ctx, width, height, time);
    if (this.active || hasNebula) this._drawCursorDot(ctx);
  }

  _drawNebula(ctx, time) {
    const x = this.smoothX;
    const y = this.smoothY;
    const radius = 150;

    const cycle = REDUCED_MOTION ? 0 : time * 0.0001;
    const r1 = Math.floor(80 + Math.sin(cycle) * 30);
    const g1 = Math.floor(20 + Math.sin(cycle * 0.7) * 15);
    const b1 = Math.floor(120 + Math.sin(cycle * 1.3) * 40);

    const r2 = Math.floor(40 + Math.sin(cycle * 0.8 + 1) * 20);
    const g2 = Math.floor(30 + Math.sin(cycle * 0.6 + 2) * 20);
    const b2 = Math.floor(100 + Math.sin(cycle * 1.1 + 1) * 30);

    const r3 = Math.floor(130 + Math.sin(cycle * 0.9 + 2) * 40);
    const g3 = Math.floor(50 + Math.sin(cycle * 0.5 + 3) * 20);
    const b3 = Math.floor(90 + Math.sin(cycle * 1.2 + 2) * 30);

    const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, `rgba(${r1}, ${g1}, ${b1}, ${this.nebulaOpacity})`);
    gradient.addColorStop(0.3, `rgba(${r2}, ${g2}, ${b2}, ${this.nebulaOpacity * 0.7})`);
    gradient.addColorStop(0.6, `rgba(${r3}, ${g3}, ${b3}, ${this.nebulaOpacity * 0.4})`);
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

    ctx.fillStyle = gradient;
    ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  }

  _drawConstellations(ctx, width, height, time) {
    if (!this.starField) return;

    ctx.lineWidth = LINE_WIDTH;
    ctx.strokeStyle = '#fff';
    ctx.fillStyle = '#fff';

    for (const point of this.trailPoints) {
      if (point.opacity < 0.01) continue;

      // Lines only appear after a delay, and only for chosen points
      if (point.connectStars) {
        const age = time - point.birthTime;
        const lineAge = age - LINE_DELAY;

        if (lineAge > 0) {
          const lineFadeIn = clamp(lineAge / LINE_FADE_IN, 0, 1);

          const nearby = this.starField.getNearbyStars(
            point.x, point.y, SEARCH_RADIUS, width, height
          );

          if (nearby.length > 0) {
            nearby.sort((a, b) => {
              const da = (a.x - point.x) ** 2 + (a.y - point.y) ** 2;
              const db = (b.x - point.x) ** 2 + (b.y - point.y) ** 2;
              return da - db;
            });

            const count = Math.min(nearby.length, MAX_CONNECTIONS);
            for (let i = 0; i < count; i++) {
              const star = nearby[i];
              const dist = Math.sqrt((star.x - point.x) ** 2 + (star.y - point.y) ** 2);
              const distanceFade = 1 - (dist / SEARCH_RADIUS);
              const starFactor = clamp(star.opacity, 0.3, 1.0);
              const alpha = point.opacity * lineFadeIn * distanceFade * starFactor * LINE_OPACITY;

              if (alpha < 0.002) continue;

              ctx.globalAlpha = alpha;
              ctx.beginPath();
              ctx.moveTo(point.x, point.y);
              ctx.lineTo(star.x, star.y);
              ctx.stroke();
            }
          }
        }
      }

      // Trail point dot (always drawn, no delay)
      ctx.globalAlpha = point.opacity * POINT_OPACITY;
      ctx.beginPath();
      ctx.arc(point.x, point.y, 1.2, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.globalAlpha = 1;
  }

  _drawCursorDot(ctx) {
    const x = this.smoothX;
    const y = this.smoothY;
    const dotOpacity = this.active
      ? 0.6
      : (this.nebulaOpacity / this.targetNebulaOpacity) * 0.6;

    // Outer glow
    ctx.globalAlpha = dotOpacity * 0.15;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fill();

    // Core dot
    ctx.globalAlpha = dotOpacity;
    ctx.beginPath();
    ctx.arc(x, y, 1.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalAlpha = 1;
  }
}
