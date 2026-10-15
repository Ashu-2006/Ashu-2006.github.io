/**
 * The tube, ported from retro/: a raw WebGL2 pass that upscales the game frame with sharp bilinear
 * filtering (whole texels stay flat, only the seams blend), then adds gentle barrel glass, scanlines, a
 * light aperture grille, chromatic fringing, bloom, a vignette and, unless motion is reduced, a little
 * noise and a slow rolling band. Without WebGL2 it falls back to a plain nearest-neighbour blit.
 */

export type Look = { curve: number; scan: number; mask: number; aberr: number; vig: number; bloom: number; noise: number; band: number; bright: number };

export const LOOK: Look = { curve: 0.045, scan: 0.24, mask: 0.12, aberr: 0.45, vig: 0.3, bloom: 0.18, noise: 0.026, band: 0.03, bright: 1.08 };
/** Reduced motion keeps the glass and drops everything that moves on its own */
export const STILL: Look = { ...LOOK, noise: 0, band: 0 };

/** Per frame: `flash` brightens the tube for a crash */
export type Fx = { time: number; flash: number };

export interface Crt {
  readonly webgl: boolean;
  /** Sizes the backing store to css size x device pixel ratio (capped at 2) */
  resize(cssW: number, cssH: number): void;
  /** Uploads the current game frame */
  upload(src: HTMLCanvasElement): void;
  render(look: Look, fx: Fx): void;
  destroy(): void;
}

const VS = `#version 300 es
out vec2 vUv;
void main() {
  vec2 p = vec2((gl_VertexID << 1) & 2, gl_VertexID & 2);
  vUv = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}`;

const FS = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 outColor;
uniform sampler2D uPic;
uniform vec2 uRes;
uniform vec2 uPicRes;
uniform vec4 uFit;
uniform vec3 uBezel;
uniform float uTime, uCurve, uScan, uLines, uMask, uAberr, uVig, uBloom, uNoise, uBand, uBright, uFlash, uDpr;

float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }

vec2 barrel(vec2 uv) {
  vec2 c = uv * 2.0 - 1.0;
  c *= (1.0 + uCurve * dot(c, c)) / (1.0 + uCurve);
  return c * 0.5 + 0.5;
}

vec2 sharpen(vec2 uv, vec2 res, float px) {
  vec2 t = uv * res;
  vec2 f = fract(t) - 0.5;
  float k = max(px, 1.0);
  float range = 0.5 - 0.5 / k;
  vec2 g = (f - clamp(f, -range, range)) * k + 0.5;
  return (floor(t) + g) / res;
}

vec3 pic(vec2 suv) {
  vec2 p = (suv - uFit.xy) / uFit.zw;
  if (p.x < 0.0 || p.y < 0.0 || p.x > 1.0 || p.y > 1.0) return uBezel;
  p = sharpen(p, uPicRes, uRes.y * uFit.w / uPicRes.y);
  return texture(uPic, p).rgb;
}

void main() {
  vec2 uv = barrel(vUv);
  if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) { outColor = vec4(uBezel * 0.6, 1.0); return; }

  vec2 dir = uv - 0.5;
  vec2 off = dir * (uAberr * uDpr / uRes) * (1.0 + 1.5 * dot(dir, dir));
  vec3 col = vec3(pic(uv + off).r, pic(uv).g, pic(uv - off).b);
  if (uBloom > 0.0) {
    vec3 glow = vec3(0.0);
    vec2 r = vec2(3.0 * uDpr) / uRes;
    for (int i = 0; i < 6; i++) {
      float a = 6.2831853 * float(i) / 6.0;
      glow += pic(uv + vec2(cos(a), sin(a)) * r);
    }
    glow = max(glow / 6.0 - 0.4, 0.0);
    col += glow * uBloom * 2.5;
  }

  float s = 0.5 + 0.5 * cos(6.2831853 * (uv.y * uLines - 0.5));
  col *= mix(1.0 - uScan, 1.0, s);

  float m = mod(floor(gl_FragCoord.x), 3.0);
  vec3 tri = vec3(m == 0.0 ? 1.0 : 0.62, m == 1.0 ? 1.0 : 0.62, m == 2.0 ? 1.0 : 0.62);
  col *= mix(vec3(1.0), tri * 1.24, uMask);

  float b = fract(uv.y * 0.8 - uTime * 0.06);
  col *= 1.0 + uBand * (smoothstep(0.0, 0.5, b) * smoothstep(1.0, 0.5, b) - 0.3);

  col += (hash(gl_FragCoord.xy + fract(uTime) * 91.0) - 0.5) * uNoise;

  vec2 q = uv * (1.0 - uv);
  col *= mix(1.0, pow(clamp(q.x * q.y * 16.0, 0.0, 1.0), 0.3), uVig);

  col *= uBright * (1.0 + uFlash * 0.9);
  outColor = vec4(col, 1.0);
}`;

/** Where a w x h picture sits inside a W x H screen, in screen uv (y up): [x, y, w, h] */
export function fit(w: number, h: number, W: number, H: number): [number, number, number, number] {
  const a = w / h / (W / H);
  return a > 1 ? [0, (1 - 1 / a) / 2, 1, 1 / a] : [(1 - a) / 2, 0, a, 1];
}

const dpr = () => Math.min(window.devicePixelRatio || 1, 2);
const BEZEL: [number, number, number] = [0.059, 0.059, 0.055];

export function createCrt(canvas: HTMLCanvasElement): Crt {
  const gl = canvas.getContext("webgl2", { alpha: false, antialias: false, premultipliedAlpha: false, powerPreference: "default" });
  if (!gl) return createFlat(canvas);
  try {
    return createGl(canvas, gl);
  } catch (err) {
    console.warn("Night Drive: CRT shader unavailable, showing the plain picture", err);
    return createFlat(canvas);
  }
}

function createGl(canvas: HTMLCanvasElement, gl: WebGL2RenderingContext): Crt {
  const compile = (type: number, src: string) => {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? "shader");
    return s;
  };
  const vs = compile(gl.VERTEX_SHADER, VS);
  const fs = compile(gl.FRAGMENT_SHADER, FS);
  const prog = gl.createProgram()!;
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog) ?? "link");
  gl.useProgram(prog);
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);

  const names = ["uPic", "uRes", "uPicRes", "uFit", "uBezel", "uTime", "uCurve", "uScan", "uLines", "uMask", "uAberr", "uVig", "uBloom", "uNoise", "uBand", "uBright", "uFlash", "uDpr"] as const;
  const U = Object.fromEntries(names.map((n) => [n, gl.getUniformLocation(prog, n)])) as Record<(typeof names)[number], WebGLUniformLocation | null>;
  gl.uniform1i(U.uPic, 0);
  gl.uniform3f(U.uBezel, BEZEL[0], BEZEL[1], BEZEL[2]);

  const tex = gl.createTexture()!;
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);

  let size: [number, number] = [0, 0];

  return {
    webgl: true,
    resize(w, h) {
      const r = dpr();
      canvas.width = Math.max(1, Math.round(w * r));
      canvas.height = Math.max(1, Math.round(h * r));
    },
    upload(src) {
      gl.bindTexture(gl.TEXTURE_2D, tex);
      if (size[0] === src.width && size[1] === src.height) gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, src);
      else {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
        size = [src.width, src.height];
      }
    },
    render(look, fx) {
      const W = canvas.width;
      const H = canvas.height;
      const r = dpr();
      gl.viewport(0, 0, W, H);
      const f = size[0] ? fit(size[0], size[1], W, H) : ([0, 0, 1, 1] as const);
      /* one scanline per game row when the picture is tall enough, else one per two or three */
      const rows = size[1] || 240;
      const per = Math.max(1, Math.ceil((3 * rows) / (H * f[3])));
      gl.uniform2f(U.uRes, W, H);
      gl.uniform2f(U.uPicRes, size[0] || 1, size[1] || 1);
      gl.uniform4f(U.uFit, f[0], f[1], f[2], f[3]);
      gl.uniform1f(U.uLines, rows / per / f[3]);
      gl.uniform1f(U.uTime, fx.time);
      gl.uniform1f(U.uCurve, look.curve);
      gl.uniform1f(U.uScan, look.scan);
      gl.uniform1f(U.uMask, look.mask);
      gl.uniform1f(U.uAberr, look.aberr);
      gl.uniform1f(U.uVig, look.vig);
      gl.uniform1f(U.uBloom, look.bloom);
      gl.uniform1f(U.uNoise, look.noise);
      gl.uniform1f(U.uBand, look.band);
      gl.uniform1f(U.uBright, look.bright);
      gl.uniform1f(U.uFlash, fx.flash);
      gl.uniform1f(U.uDpr, r);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    },
    destroy() {
      gl.deleteTexture(tex);
      gl.deleteVertexArray(vao);
      gl.deleteProgram(prog);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    },
  };
}

/** Without WebGL2 the game still plays: the frame, letterboxed, scaled with nearest-neighbour */
function createFlat(canvas: HTMLCanvasElement): Crt {
  const ctx = canvas.getContext("2d")!;
  let source: HTMLCanvasElement | null = null;
  return {
    webgl: false,
    resize(w, h) {
      const r = dpr();
      canvas.width = Math.max(1, Math.round(w * r));
      canvas.height = Math.max(1, Math.round(h * r));
    },
    upload(src) {
      source = src;
    },
    render(_look, fx) {
      const W = canvas.width;
      const H = canvas.height;
      ctx.fillStyle = `rgb(${BEZEL.map((v) => Math.round(v * 255)).join(",")})`;
      ctx.fillRect(0, 0, W, H);
      if (!source) return;
      const [x, y, w, h] = fit(source.width, source.height, W, H);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(source, x * W, (1 - y - h) * H, w * W, h * H);
      if (fx.flash > 0) {
        ctx.globalAlpha = Math.min(0.5, fx.flash * 0.5);
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, W, H);
        ctx.globalAlpha = 1;
      }
    },
    destroy() {},
  };
}
