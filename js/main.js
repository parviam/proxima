// Proxima — orchestrator: canvas creation, animation loop, resize
import { StarField } from './stars.js';
import { GeometryField } from './geometry.js';
import { Cursor } from './cursor.js';

// Create and configure a canvas with proper HiDPI scaling
function createCanvas(id) {
  const canvas = document.createElement('canvas');
  canvas.id = id;
  document.body.insertBefore(canvas, document.getElementById('content'));
  return canvas;
}

function sizeCanvas(canvas, ctx, width, height, dpr) {
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

// Initialize
const dpr = Math.min(window.devicePixelRatio || 1, 2);
let width = window.innerWidth;
let height = window.innerHeight;

const starsCanvas = createCanvas('stars');
const geometryCanvas = createCanvas('geometry');
const cursorCanvas = createCanvas('cursor');

const starsCtx = starsCanvas.getContext('2d');
const geometryCtx = geometryCanvas.getContext('2d');
const cursorCtx = cursorCanvas.getContext('2d');

// Size all canvases
function resizeAll() {
  width = window.innerWidth;
  height = window.innerHeight;
  sizeCanvas(starsCanvas, starsCtx, width, height, dpr);
  sizeCanvas(geometryCanvas, geometryCtx, width, height, dpr);
  sizeCanvas(cursorCanvas, cursorCtx, width, height, dpr);
  geometry.resize(width, height);
}

sizeCanvas(starsCanvas, starsCtx, width, height, dpr);
sizeCanvas(geometryCanvas, geometryCtx, width, height, dpr);
sizeCanvas(cursorCanvas, cursorCtx, width, height, dpr);

// Modules
const stars = new StarField();
const geometry = new GeometryField();
const cursor = new Cursor();

stars.init(width, height);
geometry.init(width, height);
cursor.init(stars);

// Resize handler with debounce
let resizeTimeout;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimeout);
  resizeTimeout = setTimeout(() => {
    resizeAll();
    // Re-init stars for new count at new viewport size
    stars.init(width, height);
  }, 150);
});

// Animation loop
function animate(time) {
  requestAnimationFrame(animate);

  // Update all systems
  stars.update(time);
  geometry.update(time);
  cursor.update(time);

  // Draw all layers
  stars.draw(starsCtx, width, height, time);
  geometry.draw(geometryCtx, width, height, time);
  cursor.draw(cursorCtx, width, height, time);
}

requestAnimationFrame(animate);
