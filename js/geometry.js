// Sacred geometry wireframes — tesseract, icosahedron, stellated octahedron, metatron's cube
import { rotate4D, project4Dto3D, project3Dto2D, rotateX, rotateY, rotateZ, randomRange, clamp, lerp } from './math.js';

const REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const PHI = (1 + Math.sqrt(5)) / 2; // golden ratio

// Shape definitions — vertices and edges
const SHAPES = {
  tesseract: {
    is4D: true,
    vertices() {
      const v = [];
      for (let i = 0; i < 16; i++) {
        v.push([
          (i & 1 ? 1 : -1),
          (i & 2 ? 1 : -1),
          (i & 4 ? 1 : -1),
          (i & 8 ? 1 : -1),
        ]);
      }
      return v;
    },
    edges() {
      const edges = [];
      for (let i = 0; i < 16; i++) {
        for (let j = i + 1; j < 16; j++) {
          // Connect vertices that differ in exactly one bit
          const xor = i ^ j;
          if (xor && (xor & (xor - 1)) === 0) {
            edges.push([i, j]);
          }
        }
      }
      return edges;
    },
  },

  icosahedron: {
    is4D: false,
    vertices() {
      const t = PHI;
      return [
        [-1,  t,  0], [ 1,  t,  0], [-1, -t,  0], [ 1, -t,  0],
        [ 0, -1,  t], [ 0,  1,  t], [ 0, -1, -t], [ 0,  1, -t],
        [ t,  0, -1], [ t,  0,  1], [-t,  0, -1], [-t,  0,  1],
      ];
    },
    edges() {
      return [
        [0,11],[0,5],[0,1],[0,7],[0,10],
        [1,5],[1,9],[1,8],[1,7],
        [2,4],[2,11],[2,10],[2,6],[2,3],
        [3,4],[3,9],[3,8],[3,6],
        [4,5],[4,9],[4,11],
        [5,9],[5,11],
        [6,7],[6,8],[6,10],
        [7,8],[7,10],
        [8,9],
        [10,11],
      ];
    },
  },

  stellatedOctahedron: {
    is4D: false,
    vertices() {
      // Two interpenetrating tetrahedra
      const s = 1.2;
      return [
        // Tetrahedron 1
        [ s,  s,  s], [ s, -s, -s], [-s,  s, -s], [-s, -s,  s],
        // Tetrahedron 2
        [-s, -s, -s], [-s,  s,  s], [ s, -s,  s], [ s,  s, -s],
      ];
    },
    edges() {
      return [
        // Tetrahedron 1
        [0,1],[0,2],[0,3],[1,2],[1,3],[2,3],
        // Tetrahedron 2
        [4,5],[4,6],[4,7],[5,6],[5,7],[6,7],
      ];
    },
  },

  metatronsCube: {
    is4D: false,
    is2D: true,
    vertices() {
      // 13 vertices: center + inner hexagon + outer hexagon
      const pts = [[0, 0, 0]]; // center
      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i - Math.PI / 6;
        pts.push([Math.cos(angle) * 0.6, Math.sin(angle) * 0.6, 0]);
      }
      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i;
        pts.push([Math.cos(angle) * 1.2, Math.sin(angle) * 1.2, 0]);
      }
      return pts;
    },
    edges() {
      // All-to-all connections
      const edges = [];
      for (let i = 0; i < 13; i++) {
        for (let j = i + 1; j < 13; j++) {
          edges.push([i, j]);
        }
      }
      return edges;
    },
  },
};

const SHAPE_NAMES = ['tesseract', 'icosahedron', 'stellatedOctahedron', 'metatronsCube'];

class ActiveShape {
  constructor(shapeType, cx, cy, scale) {
    const def = SHAPES[shapeType];
    this.type = shapeType;
    this.vertices = def.vertices();
    this.edges = def.edges();
    this.is4D = !!def.is4D;
    this.is2D = !!def.is2D;
    this.cx = cx;
    this.cy = cy;
    this.scale = scale;

    // Rotation angles
    this.angleX = randomRange(0, Math.PI * 2);
    this.angleY = randomRange(0, Math.PI * 2);
    this.angleZ = randomRange(0, Math.PI * 2);
    this.angleXW = randomRange(0, Math.PI * 2);
    this.angleYZ = randomRange(0, Math.PI * 2);
    this.angleZW = randomRange(0, Math.PI * 2);

    // Rotation speeds (very slow)
    this.speedX = randomRange(0.001, 0.004) * (Math.random() > 0.5 ? 1 : -1);
    this.speedY = randomRange(0.001, 0.005) * (Math.random() > 0.5 ? 1 : -1);
    this.speedZ = randomRange(0.0005, 0.002) * (Math.random() > 0.5 ? 1 : -1);
    this.speedXW = randomRange(0.001, 0.003) * (Math.random() > 0.5 ? 1 : -1);
    this.speedYZ = randomRange(0.001, 0.003) * (Math.random() > 0.5 ? 1 : -1);
    this.speedZW = randomRange(0.001, 0.003) * (Math.random() > 0.5 ? 1 : -1);

    // Lifecycle
    this.opacity = 0;
    this.maxOpacity = randomRange(0.03, 0.07);
    this.fadeInDuration = randomRange(3000, 5000);
    this.lifeDuration = randomRange(20000, 40000);
    this.fadeOutDuration = randomRange(3000, 5000);
    this.birthTime = performance.now();
    this.state = 'fadein'; // fadein, alive, fadeout, dead
  }

  get totalDuration() {
    return this.fadeInDuration + this.lifeDuration + this.fadeOutDuration;
  }

  update(time) {
    const age = time - this.birthTime;

    // Lifecycle state machine
    if (age < this.fadeInDuration) {
      this.state = 'fadein';
      this.opacity = (age / this.fadeInDuration) * this.maxOpacity;
    } else if (age < this.fadeInDuration + this.lifeDuration) {
      this.state = 'alive';
      this.opacity = this.maxOpacity;
    } else if (age < this.totalDuration) {
      this.state = 'fadeout';
      const fadeAge = age - this.fadeInDuration - this.lifeDuration;
      this.opacity = this.maxOpacity * (1 - fadeAge / this.fadeOutDuration);
    } else {
      this.state = 'dead';
      this.opacity = 0;
      return;
    }

    // Rotate
    if (!REDUCED_MOTION) {
      this.angleX += this.speedX;
      this.angleY += this.speedY;
      this.angleZ += this.speedZ;
      if (this.is4D) {
        this.angleXW += this.speedXW;
        this.angleYZ += this.speedYZ;
        this.angleZW += this.speedZW;
      }
    }
  }

  getProjectedVertices() {
    return this.vertices.map(v => {
      let p = [...v];

      if (this.is4D) {
        p = rotate4D(p, 'xw', this.angleXW);
        p = rotate4D(p, 'yz', this.angleYZ);
        p = rotate4D(p, 'zw', this.angleZW);
        const p3 = project4Dto3D(p);
        p = rotateX(p3, this.angleX);
        p = rotateY(p, this.angleY);
        return project3Dto2D(p, 4, this.cx, this.cy).map((c, i) =>
          i === 0 ? this.cx + (c - this.cx) * this.scale : this.cy + (c - this.cy) * this.scale
        );
      }

      if (this.is2D) {
        // Metatron's cube: just subtle 2D rotation via Z
        p = rotateZ(p, this.angleZ);
        return [this.cx + p[0] * this.scale, this.cy + p[1] * this.scale];
      }

      // 3D shapes
      p = rotateX(p, this.angleX);
      p = rotateY(p, this.angleY);
      p = rotateZ(p, this.angleZ);
      const projected = project3Dto2D(p, 5, this.cx, this.cy);
      return [
        this.cx + (projected[0] - this.cx) * this.scale,
        this.cy + (projected[1] - this.cy) * this.scale,
      ];
    });
  }

  draw(ctx) {
    if (this.opacity <= 0) return;

    const projected = this.getProjectedVertices();

    // Draw edges
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 0.5;
    ctx.globalAlpha = this.opacity;

    for (const [a, b] of this.edges) {
      const pa = projected[a];
      const pb = projected[b];
      ctx.beginPath();
      ctx.moveTo(pa[0], pa[1]);
      ctx.lineTo(pb[0], pb[1]);
      ctx.stroke();
    }

    // Draw vertices as tiny dots, slightly brighter
    ctx.globalAlpha = this.opacity * 1.5;
    ctx.fillStyle = '#fff';
    for (const p of projected) {
      ctx.beginPath();
      ctx.arc(p[0], p[1], 0.8, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.globalAlpha = 1;
  }
}

export class GeometryField {
  constructor() {
    this.shapes = [];
    this.nextSpawnTime = 0;
    this.spawnDelay = 8000; // initial delay before first shape
    this.width = 0;
    this.height = 0;
    this.shapeIndex = 0;
  }

  init(width, height) {
    this.width = width;
    this.height = height;
    this.nextSpawnTime = performance.now() + this.spawnDelay;
  }

  resize(width, height) {
    this.width = width;
    this.height = height;
  }

  _spawnShape() {
    const name = SHAPE_NAMES[this.shapeIndex % SHAPE_NAMES.length];
    this.shapeIndex++;

    // Place shapes somewhat randomly but within the visible area
    const cx = this.width * randomRange(0.2, 0.8);
    const cy = this.height * randomRange(0.2, 0.8);
    const baseScale = Math.min(this.width, this.height) * randomRange(0.08, 0.15);

    return new ActiveShape(name, cx, cy, baseScale);
  }

  update(time) {
    // Spawn new shapes
    if (time >= this.nextSpawnTime && this.shapes.length < 3) {
      this.shapes.push(this._spawnShape());
      this.nextSpawnTime = time + randomRange(5000, 12000);
    }

    // Update existing shapes
    for (let i = this.shapes.length - 1; i >= 0; i--) {
      this.shapes[i].update(time);
      if (this.shapes[i].state === 'dead') {
        this.shapes.splice(i, 1);
      }
    }
  }

  draw(ctx, width, height, time) {
    ctx.clearRect(0, 0, width, height);
    for (const shape of this.shapes) {
      shape.draw(ctx);
    }
  }
}
