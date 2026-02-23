// Shared math utilities for Proxima

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export function randomRange(min, max) {
  return Math.random() * (max - min) + min;
}

// 4D rotation matrix applied to a 4D point
// plane: one of 'xy','xz','xw','yz','yw','zw'
export function rotate4D(point, plane, angle) {
  const [x, y, z, w] = point;
  const c = Math.cos(angle);
  const s = Math.sin(angle);

  switch (plane) {
    case 'xy': return [c * x - s * y, s * x + c * y, z, w];
    case 'xz': return [c * x - s * z, y, s * x + c * z, w];
    case 'xw': return [c * x - s * w, y, z, s * x + c * w];
    case 'yz': return [x, c * y - s * z, s * y + c * z, w];
    case 'yw': return [x, c * y - s * w, z, s * y + c * w];
    case 'zw': return [x, y, c * z - s * w, s * z + c * w];
    default: return point;
  }
}

// Project 4D → 3D with perspective
export function project4Dto3D(point, distance = 2.5) {
  const [x, y, z, w] = point;
  const scale = distance / (distance - w);
  return [x * scale, y * scale, z * scale];
}

// Project 3D → 2D with perspective
export function project3Dto2D(point, distance = 4, cx = 0, cy = 0) {
  const [x, y, z] = point;
  const scale = distance / (distance - z);
  return [x * scale + cx, y * scale + cy];
}

// 3D rotation around Y axis
export function rotateY(point, angle) {
  const [x, y, z] = point;
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return [c * x + s * z, y, -s * x + c * z];
}

// 3D rotation around X axis
export function rotateX(point, angle) {
  const [x, y, z] = point;
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return [x, c * y - s * z, s * y + c * z];
}

// 3D rotation around Z axis
export function rotateZ(point, angle) {
  const [x, y, z] = point;
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return [c * x - s * y, s * x + c * y, z];
}
