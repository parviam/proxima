// Scroll of Light — bright star click reveal
import { clamp, lerp } from './math.js';

const REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Animation timing
const BEAM_DURATION = 800;      // ms for the vertical beam to draw down
const OVERLAY_FADE = 500;       // ms for text overlay to fade in
const STAGGER_DELAY = 40;       // ms between each paragraph fade-in
const CLOSE_FADE = 400;         // ms for text to fade out
const BEAM_RETRACT = 500;       // ms for beam to retract on close
const HIT_RADIUS = 25;          // px click distance to trigger

// States
const CLOSED = 0;
const OPENING_BEAM = 1;
const OPENING_TEXT = 2;
const OPEN = 3;
const CLOSING_TEXT = 4;
const CLOSING_BEAM = 5;

export class Reveal {
  constructor() {
    this.state = CLOSED;
    this.starField = null;
    this.transitionStart = 0;
    this.beamProgress = 0;       // 0-1, how far the beam has drawn
    this.overlayOpacity = 0;     // 0-1
    this.overlay = null;
    this.paragraphs = [];
  }

  init(starField) {
    this.starField = starField;
    this.overlay = document.getElementById('reveal');
    if (this.overlay) {
      this.paragraphs = this.overlay.querySelectorAll('.reveal-scroll > *');
    }

    // Escape key to close
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen()) {
        this.close();
      }
    });
  }

  isOpen() {
    return this.state === OPEN || this.state === OPENING_BEAM || this.state === OPENING_TEXT;
  }

  isClosed() {
    return this.state === CLOSED;
  }

  isAnimating() {
    return this.state !== CLOSED && this.state !== OPEN;
  }

  toggle() {
    if (this.state === CLOSED) {
      this.open();
    } else if (this.state === OPEN) {
      this.close();
    }
    // Ignore if mid-animation
  }

  open() {
    if (this.state !== CLOSED) return;
    this.state = OPENING_BEAM;
    this.transitionStart = -1; // Will be set on first update frame
    this.beamProgress = 0;
    this.overlayOpacity = 0;

    // Reset paragraph visibility
    for (const el of this.paragraphs) {
      el.classList.remove('fade-in');
      el.style.opacity = '0';
    }

    // Dim the title
    const title = document.querySelector('.title');
    if (title) title.classList.add('dimmed');
  }

  close() {
    if (this.state !== OPEN) return;
    this.state = CLOSING_TEXT;
    this.transitionStart = -1; // Will be set on first update frame

    // Scroll back to top for next open
    const scroll = this.overlay?.querySelector('.reveal-scroll');
    if (scroll) scroll.scrollTop = 0;

    // Restore title
    const title = document.querySelector('.title');
    if (title) title.classList.remove('dimmed');
  }

  // Check if a click/tap hit the bright star
  hitTest(clickX, clickY, viewportWidth, viewportHeight) {
    if (!this.starField) return false;
    const pos = this.starField.getBrightStarScreenPos(viewportWidth, viewportHeight);
    const dx = clickX - pos.x;
    const dy = clickY - pos.y;
    return (dx * dx + dy * dy) <= HIT_RADIUS * HIT_RADIUS;
  }

  // Check if click is outside the text column
  isOutsideColumn(clickX, viewportWidth) {
    const columnWidth = Math.min(640, viewportWidth - 48);
    const left = (viewportWidth - columnWidth) / 2;
    return clickX < left || clickX > left + columnWidth;
  }

  update(time) {
    if (this.state === CLOSED) return;

    // Sync transition start to animation frame time
    if (this.transitionStart < 0) this.transitionStart = time;
    const elapsed = time - this.transitionStart;

    if (REDUCED_MOTION) {
      // Skip animations for reduced motion
      if (this.state === OPENING_BEAM || this.state === OPENING_TEXT) {
        this.beamProgress = 1;
        this.overlayOpacity = 1;
        this._showAllParagraphs();
        this._showOverlay();
        this.state = OPEN;
      } else if (this.state === CLOSING_TEXT || this.state === CLOSING_BEAM) {
        this.beamProgress = 0;
        this.overlayOpacity = 0;
        this._hideOverlay();
        this.state = CLOSED;
      }
      return;
    }

    switch (this.state) {
      case OPENING_BEAM: {
        // Ease out cubic
        const t = clamp(elapsed / BEAM_DURATION, 0, 1);
        this.beamProgress = 1 - Math.pow(1 - t, 3);
        if (t >= 1) {
          this.state = OPENING_TEXT;
          this.transitionStart = time;
          this._showOverlay();
          this._staggerParagraphs();
        }
        break;
      }

      case OPENING_TEXT: {
        const t = clamp(elapsed / OVERLAY_FADE, 0, 1);
        this.overlayOpacity = t;
        this.overlay.style.opacity = t;
        if (t >= 1) {
          this.state = OPEN;
        }
        break;
      }

      case OPEN:
        this.overlayOpacity = 1;
        break;

      case CLOSING_TEXT: {
        const t = clamp(elapsed / CLOSE_FADE, 0, 1);
        this.overlayOpacity = 1 - t;
        this.overlay.style.opacity = 1 - t;
        if (t >= 1) {
          this._hideOverlay();
          this.state = CLOSING_BEAM;
          this.transitionStart = time; // Reset for beam retract phase
        }
        break;
      }

      case CLOSING_BEAM: {
        // Ease in cubic (retract)
        const t = clamp(elapsed / BEAM_RETRACT, 0, 1);
        this.beamProgress = 1 - t * t * t;
        if (t >= 1) {
          this.beamProgress = 0;
          this.state = CLOSED;
        }
        break;
      }
    }
  }

  draw(ctx, width, height, time) {
    if (this.state === CLOSED || this.beamProgress <= 0) return;

    const pos = this.starField.getBrightStarScreenPos(width, height);
    const startY = pos.y;
    const endY = startY + (height - startY) * this.beamProgress;

    // Draw the vertical beam of light
    const beamOpacity = this.state >= CLOSING_TEXT
      ? 0.25 * this.beamProgress  // Fading during retract
      : 0.25;

    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 0.5;
    ctx.globalAlpha = beamOpacity;
    ctx.beginPath();
    ctx.moveTo(pos.x, startY);
    ctx.lineTo(pos.x, endY);
    ctx.stroke();

    // Softer glow line alongside
    ctx.lineWidth = 3;
    ctx.globalAlpha = beamOpacity * 0.15;
    ctx.beginPath();
    ctx.moveTo(pos.x, startY);
    ctx.lineTo(pos.x, endY);
    ctx.stroke();

    ctx.globalAlpha = 1;
  }

  _showOverlay() {
    if (!this.overlay) return;
    this.overlay.style.display = 'flex';
    this.overlay.style.pointerEvents = 'auto';
    // Force reflow before setting opacity for transition
    this.overlay.offsetHeight;
    this.overlay.style.opacity = '0';
  }

  _hideOverlay() {
    if (!this.overlay) return;
    this.overlay.style.display = 'none';
    this.overlay.style.pointerEvents = 'none';
    this.overlay.style.opacity = '0';
  }

  _staggerParagraphs() {
    for (let i = 0; i < this.paragraphs.length; i++) {
      const el = this.paragraphs[i];
      const delay = i * STAGGER_DELAY;
      setTimeout(() => {
        el.style.opacity = '';
        el.classList.add('fade-in');
      }, delay);
    }
  }

  _showAllParagraphs() {
    for (const el of this.paragraphs) {
      el.style.opacity = '';
      el.classList.add('fade-in');
    }
  }
}
