export const DEFAULT_FLOW_COLOR_PARAMS = {
    palettes: [
        { colors: ["#717E3B", "#FF88A0", "#FFB800"], band: 0.05 },
        { colors: ["#870D73", "#FF7222", "#C3E734"], band: 0.04 },
        { colors: ["#1000C0", "#F24016", "#E1B1F8"], band: 0.0 },
    ],
    speed: 1,
    scale: 0.9,
    warp: 0.55,
    warpScale: 0.7,
    softness: 0.09,
    holdMs: 2200,
    transitionMs: 900,
    renderScale: 0.5,
    paused: false,
    grainPattern: "whiteNoise",
    grainAmount: 0,
    grainSize: 1.5,
    grainLuma: 0,
    grainFps: 0,
};
const GRAIN_PATTERNS = { whiteNoise: 0, blueNoise: 1, bayer8: 2 };
export function cloneFlowColorParams(params) {
    return {
        ...params,
        palettes: params.palettes.map((palette) => ({
            colors: [...palette.colors],
            band: palette.band,
        })),
    };
}
const VERTEX_SHADER = `
  attribute vec2 position;
  void main() {
    gl_Position = vec4(position, 0.0, 1.0);
  }
`;
const FRAGMENT_SHADER = `
  precision highp float;

  uniform vec2 uResolution;
  uniform float uTime;
  uniform float uScale;
  uniform float uWarp;
  uniform float uWarpScale;
  uniform float uSoftness;
  uniform vec3 uLow;
  uniform vec3 uMid;
  uniform vec3 uHigh;
  uniform float uBand;
  uniform float uGrainAmount;
  uniform float uGrainSize;
  uniform float uGrainPattern;
  uniform float uGrainLuma;
  uniform float uGrainSeed;

  float hash12(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
  }

  float bayer2(vec2 a) {
    a = floor(a);
    return fract(a.x / 2.0 + a.y * a.y * 0.75);
  }

  float bayer8(vec2 a) {
    return bayer2(0.25 * a) * 0.0625 + bayer2(0.5 * a) * 0.25 + bayer2(a);
  }

  float grainNoise(vec2 cell) {
    if (uGrainPattern < 0.5) return hash12(cell);
    if (uGrainPattern < 1.5) return fract(52.9829189 * fract(dot(cell + 0.5, vec2(0.06711056, 0.00583715))));
    return bayer8(cell);
  }

  vec3 permute(vec3 x) { return mod(((x * 34.0) + 1.0) * x, 289.0); }

  float snoise(vec2 v) {
    const vec4 C = vec4(0.211324865, 0.366025404, -0.577350269, 0.024390244);
    vec2 i = floor(v + dot(v, C.yy));
    vec2 x0 = v - i + dot(i, C.xx);
    vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec4 x12 = x0.xyxy + C.xxzz;
    x12.xy -= i1;
    i = mod(i, 289.0);
    vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
    vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
    m = m * m;
    m = m * m;
    vec3 x = 2.0 * fract(p * C.www) - 1.0;
    vec3 h = abs(x) - 0.5;
    vec3 ox = floor(x + 0.5);
    vec3 a0 = x - ox;
    m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
    vec3 g;
    g.x = a0.x * x0.x + h.x * x0.y;
    g.yz = a0.yz * x12.xz + h.yz * x12.yw;
    return 130.0 * dot(m, g);
  }

  float fbm(vec2 p) {
    float sum = 0.0;
    float amp = 0.5;
    for (int i = 0; i < 2; i++) {
      sum += amp * snoise(p);
      p = mat2(1.6, 1.2, -1.2, 1.6) * p;
      amp *= 0.5;
    }
    return sum;
  }

  void main() {
    vec2 uv = gl_FragCoord.xy / uResolution.y;
    vec2 p = uv * uScale;
    float t = uTime * 0.18;

    vec2 q = vec2(
      snoise(p * uWarpScale + vec2(0.0, t)),
      snoise(p * uWarpScale + vec2(5.2, 1.3) - vec2(t * 0.8, 0.0))
    );
    float f = fbm(p + uWarp * q + vec2(t * 0.3, -t * 0.2)) * 0.5 + 0.5;

    // Jittering the field value (not the final color) scatters pixels of neighbouring palette colors across each boundary.
    vec2 cell = floor(gl_FragCoord.xy / uGrainSize);
    vec2 grainCell = cell + uGrainSeed * vec2(37.0, 17.0);
    f += (grainNoise(grainCell) - 0.5) * uGrainAmount;

    vec3 color = mix(uLow, uMid, smoothstep(0.5 - uBand - uSoftness, 0.5 - uBand, f));
    color = mix(color, uHigh, smoothstep(0.5 + uBand, 0.5 + uBand + uSoftness * 1.25, f));
    color *= 1.0 + (hash12(grainCell + 91.7) - 0.5) * 2.0 * uGrainLuma;
    gl_FragColor = vec4(clamp(color, 0.0, 1.0), 1.0);
  }
`;
export function hexToRgb(hex) {
    const value = parseInt(hex.replace("#", ""), 16);
    return [(value >> 16) / 255, ((value >> 8) & 255) / 255, (value & 255) / 255];
}
function easeInOut(x) {
    return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}
function samplePalette(params, clockMs) {
    const { palettes, holdMs, transitionMs } = params;
    const cycle = Math.max(1, holdMs + transitionMs);
    const index = Math.floor(clockMs / cycle) % palettes.length;
    const from = palettes[index];
    const to = palettes[(index + 1) % palettes.length];
    const local = clockMs % cycle;
    const k = local < holdMs || transitionMs <= 0
        ? 0
        : easeInOut(Math.min(1, (local - holdMs) / transitionMs));
    const colors = from.colors.map((hex, i) => {
        const a = hexToRgb(hex);
        const b = hexToRgb(to.colors[i]);
        return a.map((channel, c) => channel + (b[c] - channel) * k);
    });
    return { index, colors, band: from.band + (to.band - from.band) * k };
}
function compile(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        throw new Error(gl.getShaderInfoLog(shader) ?? "Shader compile failed");
    }
    return shader;
}
export function createFlowColor(canvas, initialParams = {}) {
    const gl = canvas.getContext("webgl", { antialias: false });
    if (!gl)
        return null;
    let params = {
        ...cloneFlowColorParams(DEFAULT_FLOW_COLOR_PARAMS),
        ...initialParams,
    };
    const program = gl.createProgram();
    gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERTEX_SHADER));
    gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER));
    gl.linkProgram(program);
    gl.useProgram(program);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const position = gl.getAttribLocation(program, "position");
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
    const uniform = (name) => gl.getUniformLocation(program, name);
    const u = {
        resolution: uniform("uResolution"),
        time: uniform("uTime"),
        scale: uniform("uScale"),
        warp: uniform("uWarp"),
        warpScale: uniform("uWarpScale"),
        softness: uniform("uSoftness"),
        low: uniform("uLow"),
        mid: uniform("uMid"),
        high: uniform("uHigh"),
        band: uniform("uBand"),
        grainAmount: uniform("uGrainAmount"),
        grainSize: uniform("uGrainSize"),
        grainPattern: uniform("uGrainPattern"),
        grainLuma: uniform("uGrainLuma"),
        grainSeed: uniform("uGrainSeed"),
    };
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    // Noise time and palette clock advance separately so changing speed never jumps the field.
    let noiseTime = 0;
    let paletteClock = 0;
    let grainClock = 0;
    let paletteIndex = 0;
    let last = performance.now();
    let frame = 0;
    const draw = () => {
        const palette = samplePalette(params, paletteClock);
        paletteIndex = palette.index;
        gl.uniform2f(u.resolution, canvas.width, canvas.height);
        gl.uniform1f(u.time, noiseTime);
        gl.uniform1f(u.scale, params.scale);
        gl.uniform1f(u.warp, params.warp);
        gl.uniform1f(u.warpScale, params.warpScale);
        gl.uniform1f(u.softness, params.softness);
        gl.uniform3fv(u.low, palette.colors[0]);
        gl.uniform3fv(u.mid, palette.colors[1]);
        gl.uniform3fv(u.high, palette.colors[2]);
        gl.uniform1f(u.band, palette.band);
        const pixelRatio = canvas.width / Math.max(1, canvas.clientWidth);
        gl.uniform1f(u.grainAmount, params.grainAmount);
        gl.uniform1f(u.grainSize, Math.max(1, params.grainSize * pixelRatio));
        gl.uniform1f(u.grainPattern, GRAIN_PATTERNS[params.grainPattern] ?? 0);
        gl.uniform1f(u.grainLuma, params.grainLuma);
        gl.uniform1f(u.grainSeed, params.grainFps > 0 ? Math.floor((grainClock / 1000) * params.grainFps) % 997 : 0);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    };
    const tick = (now) => {
        const dt = Math.max(0, Math.min(now - last, 100));
        last = now;
        if (!params.paused && !reduceMotion) {
            noiseTime += (dt / 1000) * params.speed;
            paletteClock += dt;
            grainClock += dt;
        }
        draw();
        frame = requestAnimationFrame(tick);
    };
    const resize = () => {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const scale = dpr * params.renderScale;
        canvas.width = Math.max(1, Math.round(canvas.clientWidth * scale));
        canvas.height = Math.max(1, Math.round(canvas.clientHeight * scale));
        gl.viewport(0, 0, canvas.width, canvas.height);
        draw();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();
    frame = requestAnimationFrame(tick);
    return {
        setParams(next) {
            const renderScaleChanged = next.renderScale !== undefined && next.renderScale !== params.renderScale;
            params = { ...params, ...next };
            if (renderScaleChanged)
                resize();
        },
        getPaletteIndex: () => paletteIndex,
        destroy() {
            cancelAnimationFrame(frame);
            observer.disconnect();
            gl.deleteBuffer(buffer);
            gl.deleteProgram(program);
        },
    };
}
