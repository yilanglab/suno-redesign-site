export const INITIAL_ALBUM = 7;
export const ALBUM_COUNT = 13;
export const COVER_SIZE = 2.72;
export const DEFAULTS = Object.freeze({ showTimeline: false, scaleFalloff: 0.35, positionX: -5, positionY: -1, blur: 16, clockwiseAngle: 31, rotation: 1.3, speed: 1.4, autoSpeed: 1, frontalSeconds: 12, spacingZ: 2, spacingX: 1.3, spacingY: 0.9, thickness: 0.06, lightAngle: 60 });

export const wrap = (value, length) => ((value % length) + length) % length;
const smoothstep = (a, b, value) => {
  const t = Math.min(1, Math.max(0, (value - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// The centre has a genuinely frontal interval, rather than a camera-facing tilt.
export function albumPose(distance, spacingX = 1, spacingY = spacingX, spacingZ = 1, curves = {}, rotation = 1, clockwiseAngle = 0) {
  const away = Math.abs(distance);
  const turn = smoothstep(0.23, 0.95, away);
  const rotationDistance = away <= 0.23 ? distance : Math.sign(distance) * (0.23 + Math.abs(curveDistance(distance, curves.rotation) - curveDistance(Math.sign(distance) * 0.23, curves.rotation)));
  return {
    x: curveDistance(distance, curves.x) * 1.35 * spacingX,
    y: curveDistance(distance, curves.y) * 2.85 * spacingY,
    z: -Math.pow(Math.abs(curveDistance(distance, curves.z)), 1.15) * 0.8 * spacingZ,
    rx: Math.atan(rotationDistance * 0.45) * 0.12 * turn * rotation,
    ry: -Math.atan(rotationDistance * 0.9) * 1.28 * turn * rotation,
    rz: clockwiseRotation(distance, clockwiseAngle, curves.clockwise),
    opacity: 1 - smoothstep(3.8, 6, away),
  };
}

export function albumSlot(slot, phase, songCount) {
  const index = Math.floor(phase) + slot - Math.floor(ALBUM_COUNT / 2);
  return { distance: index - phase, songIndex: wrap(index + INITIAL_ALBUM, songCount) };
}

export const EDGE_PALETTE = Object.freeze(["#CCA1E2", "#A76CBE", "#FF7222", "#59114E"]);
export const transitionEase = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

export const FRONTAL_SECONDS = 10;
export const AUTO_PHASE_SPEED = 0.46 / FRONTAL_SECONDS;
export const SWITCH_DURATION_MS = 1200;

// Curve height controls local spacing from 0.4x to 1.6x; integrate it
// to keep the album sequence ordered and the centre anchored at zero.
export function curveDistance(distance, points = [0.5, 0.5, 0.5, 0.5]) {
  const [a,b,c,d] = points;
  const integral = t => a*t + 1.5*(b-a)*t*t + (a-2*b+c)*t*t*t + (-a+3*b-3*c+d)*t*t*t*t/4;
  return 0.4*distance + 14.4*(integral((distance+6)/12)-integral(0.5));
}
export function advanceAutoPhase(phase, seconds, autoSpeed, frontalSeconds) {
  let remaining = seconds;
  while (remaining > 1e-9) {
    const cycle = Math.floor(phase + 0.23 + 1e-9);
    const frontal = phase < cycle + 0.23 - 1e-9;
    const end = cycle + (frontal ? 0.23 : 0.77);
    const rate = frontal ? 0.46/frontalSeconds : AUTO_PHASE_SPEED*autoSpeed;
    const step = Math.min(remaining, Math.max(0, end-phase)/rate);
    phase += step*rate;
    remaining -= step;
    if (step < 1e-9) phase = end + 1e-9;
  }
  return phase;
}

export function transitionProgress(phase, cycle = Math.floor(phase + 0.23 + 1e-9)) {
  const start = cycle + 0.23;
  const end = cycle + 0.77;
  return { cycle, start, end, progress: Math.max(0, Math.min(1, (phase-start)/(end-start))) };
}

export const DEFAULT_ALBUM_INDEX = 155;
export const DEFAULT_CURVES = Object.freeze({
  scale: Object.freeze([0.5, 0.5, 0.5, 0.5]),
  blur: Object.freeze([0.5, 0.5, 0.5, 0.5]),
  clockwise: Object.freeze([0.5, 0.5, 0.5, 0.5]),
  x: Object.freeze([0.8380346100183216, 1.5, 0.41009609362939126, 0.7443236598885559]),
  y: Object.freeze([-0.2658624395955853, 0.30716901002298214, 0.49858728674583674, -0.03594845489949361]),
  z: Object.freeze([0.7650934575355872, 0.5, 0.5, 1]),
  rotation: Object.freeze([0.06192198910026181, 0, 0, 0]),
});

export const AUTO_DOWN_SECONDS = 8;
export function shouldAutoDown(before, after, frontalSeconds) {
  if (frontalSeconds < AUTO_DOWN_SECONDS) return false;
  const cycle = Math.floor(before + 0.23 + 1e-9);
  const trigger = cycle - 0.23 + 0.46 * AUTO_DOWN_SECONDS / frontalSeconds;
  return before < trigger && after >= trigger;
}

export function clockwiseRotation(distance, angle, points) {
  const away = Math.abs(distance);
  if (away <= 0.23) return 0;
  const sign = Math.sign(distance);
  const anchor = curveDistance(sign * 0.23, points);
  const span = Math.abs(curveDistance(sign * 6, points) - anchor);
  const progress = Math.min(1, Math.abs(curveDistance(distance, points) - anchor) / Math.max(span, 1e-8));
  return -sign * angle * Math.PI / 180 * progress * smoothstep(0.23, 0.95, away);
}

export function albumBlur(distance, strength, points) {
  const away = Math.abs(distance);
  if (away <= 0.23 || strength === 0) return 0;
  const sign = Math.sign(distance);
  const anchor = curveDistance(sign * 0.23, points);
  return Math.min(strength, strength * Math.abs(curveDistance(distance, points)-anchor)/2) * smoothstep(0.23,0.95,away);
}

export function albumScale(distance, falloff, points) {
  if (Math.abs(distance) <= 0.23) return 1;
  const sign = Math.sign(distance);
  const amount = Math.min(1, Math.abs(curveDistance(distance, points)-curveDistance(sign*0.23,points))/3);
  return Math.max(0.1, 1 - falloff * amount * smoothstep(0.23,0.95,Math.abs(distance)));
}
