import * as THREE from "three";
import { gsap } from "gsap";
import { color } from "./palette";

/** Sleeve thickness in sleeve widths: a 31 cm card with a record inside is about 4 mm */
export const SLEEVE_DEPTH = 0.012;

/** Each corner is worn by a different amount, the way a sleeve pulled from a crate for years is */
function wornSquare() {
  const [a, b, c, d] = [0.0105, 0.0065, 0.0125, 0.008];
  const s = new THREE.Shape();
  s.moveTo(a, 0);
  s.lineTo(1 - b, 0);
  s.quadraticCurveTo(1, 0, 1, b);
  s.lineTo(1, 1 - c);
  s.quadraticCurveTo(1, 1, 1 - c, 1);
  s.lineTo(d, 1);
  s.quadraticCurveTo(0, 1, 0, 1 - d);
  s.lineTo(0, a);
  s.quadraticCurveTo(0, 0, a, 0);
  return s;
}

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vNormalW;
  varying vec3 vTangentW;
  varying vec3 vBitangentW;
  varying vec3 vPosW;
  void main() {
    vUv = uv;
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vPosW = wp.xyz;
    vNormalW = normalize(mat3(modelMatrix) * normal);
    vTangentW = normalize(mat3(modelMatrix) * vec3(1.0, 0.0, 0.0));
    vBitangentW = normalize(mat3(modelMatrix) * vec3(0.0, 1.0, 0.0));
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

/**
 * The cover as a two-colour 1970s print: a spot plate for the midtones, a key plate for the shadows,
 * both as rotated halftone screens on bone stock, the spot plate slightly out of register.
 * Ring wear (strongest toward the opening) and scuffed edges lift the ink where a record and a crate rubbed it.
 * Project covers use a light version of the same print so the work stays readable.
 * Swapping art is a halftone-dot dissolve. The card is lit by hand so the token colours stay exact.
 */
const fragmentShader = /* glsl */ `
  uniform sampler2D uA;
  uniform sampler2D uB;
  uniform sampler2D uNoise;
  uniform float uPrintA;
  uniform float uPrintB;
  uniform float uMix;
  uniform float uCells;
  uniform float uSheen;
  uniform float uGamma;
  uniform vec3 uPaper;
  uniform vec3 uKey;
  uniform vec3 uSpot;
  uniform vec3 uLight;
  varying vec2 vUv;
  varying vec3 vNormalW;
  varying vec3 vTangentW;
  varying vec3 vBitangentW;
  varying vec3 vPosW;

  #define TAU 6.28318530718
  const vec2 MISREG = vec2(0.0026, -0.0017);

  float luma(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

  float screen(vec2 uv, float angle, float cov) {
    float s = sin(angle);
    float c = cos(angle);
    vec2 p = mat2(c, s, -s, c) * uv * uCells;
    float t = 0.5 + 0.25 * (cos(TAU * p.x) + cos(TAU * p.y));
    float w = fwidth(t) * 0.75 + 1e-4;
    float dots = smoothstep(1.0 - cov - w, 1.0 - cov + w, t);
    float density = max(fwidth(p.x), fwidth(p.y));
    return mix(dots, cov, smoothstep(0.36, 0.6, density));
  }

  float tone(vec3 linear) {
    return pow(smoothstep(0.04, 0.9, pow(luma(linear), 1.0 / 2.2)), uGamma);
  }

  vec3 printed(sampler2D tex, float strength, vec4 n) {
    vec3 base = texture(tex, vUv).rgb;
    float L = tone(base);
    float Ls = tone(texture(tex, vUv + MISREG).rgb);
    float mottle = 0.86 + 0.28 * n.g;
    vec3 paper = uPaper * (0.955 + 0.07 * n.r);

    float ds = 1.0 - Ls;
    float spotCov = clamp(exp(-pow((ds - 0.44) / 0.26, 2.0)) * 0.64 * mottle + ds * 0.1, 0.0, 0.8);
    float keyCov = clamp(pow(1.0 - L, 1.5) * 1.28 * mottle - 0.08, 0.0, 1.0);
    float spot = screen(vUv + MISREG, 0.2618, spotCov);
    float key = screen(vUv, 0.7854, keyCov);
    vec3 duo = mix(paper, paper * uSpot / uPaper, spot);
    duo = mix(duo, uKey, key * 0.97);

    vec3 stock = mix(uKey, paper, base);
    float lk = 1.0 - L;
    stock *= 1.0 - 0.18 * (screen(vUv, 0.7854, lk) - lk);
    return mix(stock, duo, strength);
  }

  void main() {
    vec4 n = texture(uNoise, vUv * 3.0);
    vec4 nf = texture(uNoise, vUv * 7.0 + 0.37);
    vec3 col = printed(uA, uPrintA, n);

    if (uMix > 0.0) {
      vec3 b = printed(uB, uPrintB, n);
      float g = 22.0;
      vec2 cell = vUv * g;
      vec2 id = floor(cell);
      float d = length(fract(cell) - 0.5);
      float delay = (id.x + 0.5) / g * 0.6 + hash(id) * 0.4;
      float p = clamp(uMix * 1.7 - delay * 0.7, 0.0, 1.0);
      float r = p * 0.74;
      float aa = fwidth(d) + 1e-4;
      col = mix(col, b, 1.0 - smoothstep(r - aa, r + aa, d));
    }

    vec2 c = vUv - 0.5;
    float r = length(c);
    float wearN = texture(uNoise, vUv * 1.3 + 0.11).b;
    float patchy = smoothstep(0.45, 0.8, wearN) * (0.6 + 0.4 * nf.r);
    float opening = smoothstep(-0.25, 0.85, c.x / max(r, 1e-3));
    float ring = (1.0 - smoothstep(0.0, 0.007, abs(r - 0.469))) * opening;
    float e = min(min(vUv.x, 1.0 - vUv.x), min(vUv.y, 1.0 - vUv.y));
    float edge = (1.0 - smoothstep(0.0, 0.007, e)) * smoothstep(0.35, 0.75, nf.r);
    vec2 q = abs(c);
    float corner = smoothstep(0.455, 0.5, min(q.x, q.y)) * (0.5 + 0.5 * nf.g);
    float ink = 1.0 - luma(col) / luma(uPaper);
    float wear = clamp(ring * patchy * 0.1 + edge * 0.5 + corner * 0.6, 0.0, 0.8) * (0.35 + 0.65 * ink);
    col = mix(col, uPaper * 1.02, wear);

    // The record inside bows the card a little: a soft dome that catches the light as the sleeve tilts
    float dome = r < 0.47 ? -0.012 * 0.5 * 3.14159 / 0.47 * sin(3.14159 * r / 0.47) : 0.0;
    vec2 slope = dome * c / max(r, 1e-4);
    vec3 N = normalize(vNormalW - vTangentW * slope.x - vBitangentW * slope.y);
    vec3 V = normalize(cameraPosition - vPosW);
    float shade = 1.0 + (dot(N, uLight) - uLight.z) * 1.3;
    vec3 R = reflect(-V, N);
    float spec = pow(max(dot(R, uLight), 0.0), 10.0) * uSheen;
    col = col * shade + vec3(1.0, 0.95, 0.86) * spec;

    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }
`;

export type Sleeve = ReturnType<typeof createSleeve>;

export function createSleeve(noise: THREE.Texture) {
  const shape = wornSquare();

  const uniforms = {
    uA: { value: null as THREE.Texture | null },
    uB: { value: null as THREE.Texture | null },
    uNoise: { value: noise },
    uPrintA: { value: 1 },
    uPrintB: { value: 1 },
    uMix: { value: 0 },
    uCells: { value: 112 },
    uSheen: { value: 0.12 },
    uGamma: { value: 1.08 },
    uPaper: { value: color("bone") },
    uKey: { value: color("chocolate") },
    uSpot: { value: color("poppy") },
    uLight: { value: new THREE.Vector3(-0.32, 0.42, 0.85).normalize() },
  };

  const art = new THREE.ShaderMaterial({ uniforms, vertexShader, fragmentShader, toneMapped: false });
  art.polygonOffset = true;
  art.polygonOffsetFactor = -2;
  art.polygonOffsetUnits = -2;

  const frontGeo = new THREE.ShapeGeometry(shape, 10).translate(-0.5, -0.5, SLEEVE_DEPTH / 2 + 0.0004);
  const front = new THREE.Mesh(frontGeo, art);

  const bodyGeo = new THREE.ExtrudeGeometry(shape, { depth: SLEEVE_DEPTH, bevelEnabled: false, curveSegments: 10 }).translate(
    -0.5,
    -0.5,
    -SLEEVE_DEPTH / 2,
  );
  const card = new THREE.MeshStandardMaterial({ color: color("bone"), roughness: 0.92 });
  const edge = new THREE.MeshStandardMaterial({ color: color("bone-2"), roughness: 0.95 });
  const body = new THREE.Mesh(bodyGeo, [card, edge]);

  const group = new THREE.Group();
  group.add(body, front);

  let shown = "";
  let tween: gsap.core.Tween | null = null;

  /** Puts new art on the cover with the dot dissolve; interrupted swaps collapse to whichever image covers more */
  function show(key: string, tex: THREE.Texture, print: number, quick = false) {
    if (key === shown) return;
    shown = key;
    if (!uniforms.uA.value) {
      uniforms.uA.value = tex;
      uniforms.uPrintA.value = print;
      return;
    }
    if (tween) {
      tween.kill();
      if (uniforms.uMix.value >= 0.5) {
        uniforms.uA.value = uniforms.uB.value;
        uniforms.uPrintA.value = uniforms.uPrintB.value;
        uniforms.uMix.value = 0;
      }
    } else {
      uniforms.uMix.value = 0;
    }
    uniforms.uB.value = tex;
    uniforms.uPrintB.value = print;
    tween = gsap.to(uniforms.uMix, {
      value: 1,
      duration: quick ? 0.15 : 0.45,
      ease: quick ? "none" : "power2.inOut",
      onComplete: () => {
        uniforms.uA.value = uniforms.uB.value;
        uniforms.uPrintA.value = uniforms.uPrintB.value;
        uniforms.uMix.value = 0;
        tween = null;
      },
    });
  }

  return { group, front, uniforms, show, ready: () => Boolean(uniforms.uA.value) };
}
