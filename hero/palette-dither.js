import { defineShader, wgsl, transformColor } from 'shaders/std';

// Stochastic palette quantisation: neighbouring brand inks mix through dots,
// instead of applying a monochrome bright/dark grain overlay.
export default defineShader({
  name: 'PaletteDither',
  props: {
    colorA: { default: '#CCA1E2', transform: transformColor },
    colorB: { default: '#A76CBE', transform: transformColor },
    colorC: { default: '#FF7222', transform: transformColor },
    colorD: { default: '#59114E', transform: transformColor },
    pixelSize: { default: 2 }, spread: { default: 1.2 }, amount: { default: 0.85 }, seed: { default: 7 },
  },
  effect: wgsl`
    let grid = floor(uv * viewport / max(pixelSize, 1.0));
    let random = fract(sin(dot(grid + vec2f(seed), vec2f(127.1, 311.7))) * 43758.5453);
    let colors = array<vec3f, 4>(colorA.rgb, colorB.rgb, colorC.rgb, colorD.rgb);
    let source = sqrt(max(child.rgb, vec3f(0.0)));
    var first = colors[0]; var second = colors[1];
    var distance1 = 100.0; var distance2 = 100.0;
    for (var i = 0; i < 4; i++) {
      let delta = source - sqrt(max(colors[i], vec3f(0.0)));
      let distance = dot(delta, delta);
      if (distance < distance1) {
        second = first; distance2 = distance1;
        first = colors[i]; distance1 = distance;
      } else if (distance < distance2) {
        second = colors[i]; distance2 = distance;
      }
    }
    let probability = clamp(pow(distance1 / max(distance1 + distance2, 0.00001), 1.0 / max(spread, 0.1)), 0.0, 0.5);
    let ink = select(first, second, random < probability);
    return vec4f(mix(child.rgb, ink, amount), child.a);
  `,
});
