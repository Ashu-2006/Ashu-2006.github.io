/**
 * The TV tube: a raw WebGL2 pass over whatever the channel shows (the game canvas, a video or an image).
 * Barrel glass, scanlines, a light aperture grille, chromatic fringing, bloom, vignette and noise, plus
 * the set's own effects: snow between channels, a vertical roll, the beam opening at power-on, and an
 * on-screen display layer. Playground pieces are real work, so their look is gentler than the game's.
 */

export type Look = { curve: number; scan: number; mask: number; aberr: number; vig: number; bloom: number; noise: number; band: number; sharp: number; bright: number };

export const LOOK: Record<"play" | "game", Look> = {
  play: { curve: 0.045, scan: 0.1, mask: 0.05, aberr: 0.45, vig: 0.24, bloom: 0.05, noise: 0.016, band: 0.02, sharp: 0, bright: 1.04 },
  game: { curve: 0.075, scan: 0.28, mask: 0.14, aberr: 1, vig: 0.32, bloom: 0.2, noise: 0.028, band: 0.035, sharp: 1, bright: 1.1 },
};

/** Per-frame state of the set. beamW/beamH open the picture at power-on; roll is the vertical hold slipping. */
export type Fx = { time: number; snow: number; roll: number; beamW: number; beamH: number; flash: number; osd: number };

export type Kind = "game" | "image" | "video";
export type Source = HTMLCanvasElement | HTMLImageElement | HTMLVideoElement;

export interface Crt {
  readonly webgl: boolean;
  resize(cssW: number, cssH: number): void;
  /** Sets a new source and uploads it; null shows the empty raster */
  picture(src: Source | null, w: number, h: number, kind: Kind): void;
  /** Uploads a new frame of the current source */
  refresh(): void;
  osd(layer: HTMLCanvasElement): void;
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
uniform sampler2D uOsd;
uniform vec2 uRes;
uniform vec2 uPicRes;
uniform vec4 uFit;
uniform float uHasPic, uTime, uCurve, uScan, uLines, uMask, uAberr, uVig, uBloom, uNoise, uBand, uSharp, uBright;
uniform float uSnow, uRoll, uBeamW, uBeamH, uFlash, uOsdA, uDpr;

const vec3 LETTER = vec3(0.165, 0.102, 0.071);
const vec3 VOID = vec3(0.03, 0.02, 0.014);

float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }

vec2 barrel(vec2 uv) {
  vec2 c = uv * 2.0 - 1.0;
  c *= (1.0 + uCurve * dot(c, c)) / (1.0 + uCurve);
  return c * 0.5 + 0.5;
}

/* sharp bilinear: whole texels stay flat, only the seams between them blend */
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
  if (p.x < 0.0 || p.y < 0.0 || p.x > 1.0 || p.y > 1.0) return LETTER;
  if (uSharp > 0.5) p = sharpen(p, uPicRes, uRes.y * uFit.w / uPicRes.y);
  return texture(uPic, p).rgb;
}

void main() {
  vec2 uv = barrel(vUv);
  if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) { outColor = vec4(VOID, 1.0); return; }

  vec2 suv = vec2(0.5 + (uv.x - 0.5) / max(uBeamW, 0.001), 0.5 + (uv.y - 0.5) / max(uBeamH, 0.001));
  bool lit = uBeamW > 0.0 && suv.x >= 0.0 && suv.x <= 1.0 && suv.y >= 0.0 && suv.y <= 1.0;
  if (!lit) {
    float line = 0.0;
    if (uBeamW > 0.0 && uBeamH < 1.0) {
      float dy = (uv.y - 0.5) * uRes.y / (1.5 * uDpr);
      line = exp(-dy * dy) * step(abs(uv.x - 0.5), uBeamW * 0.5);
    }
    outColor = vec4(VOID + vec3(0.95, 0.9, 0.8) * line * 0.7, 1.0);
    return;
  }
  vec2 ouv = suv;

  float seam = 0.0;
  if (uRoll != 0.0) {
    suv.y = fract(suv.y + uRoll);
    seam = 1.0 - smoothstep(0.0, 0.035, min(suv.y, 1.0 - suv.y));
  }

  vec3 col = LETTER;
  if (uHasPic > 0.5) {
    vec2 dir = suv - 0.5;
    vec2 off = dir * (uAberr * uDpr / uRes) * (1.0 + 3.0 * dot(dir, dir));
    col = vec3(pic(suv + off).r, pic(suv).g, pic(suv - off).b);
    if (uBloom > 0.0) {
      vec3 glow = vec3(0.0);
      vec2 r = vec2(3.0 * uDpr) / uRes;
      for (int i = 0; i < 8; i++) {
        float a = 6.2831853 * float(i) / 8.0;
        glow += pic(suv + vec2(cos(a), sin(a)) * r);
      }
      glow = max(glow / 8.0 - 0.4, 0.0);
      col += glow * uBloom * 2.5;
    }
  }
  col *= 1.0 - seam * 0.92;

  /* the on-screen display comes from the set, not the signal, so it does not roll */
  if (uOsdA > 0.0) {
    vec4 o = texture(uOsd, sharpen(ouv, vec2(320.0, 240.0), uRes.y / 240.0));
    col = mix(col, o.rgb, o.a * uOsdA);
  }

  if (uSnow > 0.0) {
    float t = floor(uTime * 50.0);
    float n = hash(floor(gl_FragCoord.xy / (1.5 * uDpr)) + t * 17.0);
    float streak = hash(vec2(floor(gl_FragCoord.y / (3.0 * uDpr)), t));
    col = mix(col, vec3(0.94, 0.88, 0.76) * (n * 0.85 + streak * 0.22), uSnow);
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

  col *= uBright * (1.0 + uFlash * 1.4);
  outColor = vec4(col, 1.0);
}`;

/** Where a w x h picture sits inside the 4:3 screen, in screen uv: [x, y, w, h] */
function fit(w: number, h: number): [number, number, number, number] {
  const a = w / h / (4 / 3);
  return a > 1 ? [0, (1 - 1 / a) / 2, 1, 1 / a] : [(1 - a) / 2, 0, a, 1];
}

const dpr = () => Math.min(window.devicePixelRatio || 1, 2);

export function createCrt(canvas: HTMLCanvasElement): Crt {
  const gl = canvas.getContext("webgl2", { alpha: false, antialias: false, premultipliedAlpha: false, powerPreference: "low-power" });
  if (!gl) return createFlat(canvas);
  try {
    return createGl(canvas, gl);
  } catch (err) {
    console.warn("CRT shader unavailable, showing the plain picture", err);
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

  const names = ["uPic", "uOsd", "uRes", "uPicRes", "uFit", "uHasPic", "uTime", "uCurve", "uScan", "uLines", "uMask", "uAberr", "uVig", "uBloom", "uNoise", "uBand", "uSharp", "uBright", "uSnow", "uRoll", "uBeamW", "uBeamH", "uFlash", "uOsdA", "uDpr"] as const;
  const U = Object.fromEntries(names.map((n) => [n, gl.getUniformLocation(prog, n)])) as Record<(typeof names)[number], WebGLUniformLocation | null>;
  gl.uniform1i(U.uPic, 0);
  gl.uniform1i(U.uOsd, 1);

  const makeTex = () => {
    const t = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([42, 26, 18, 255]));
    return t;
  };
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  const picTex = makeTex();
  const osdTex = makeTex();

  let source: { src: Source; w: number; h: number; kind: Kind } | null = null;
  let size = [0, 0];

  const upload = () => {
    if (!source) return;
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, picTex);
    const mips = source.kind !== "game";
    if (size[0] === source.w && size[1] === source.h) {
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, source.src);
    } else {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source.src);
      size = [source.w, source.h];
    }
    if (mips) gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, mips ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR);
  };

  return {
    webgl: true,
    resize(w, h) {
      const r = dpr();
      canvas.width = Math.max(1, Math.round(w * r));
      canvas.height = Math.max(1, Math.round(h * r));
    },
    picture(src, w, h, kind) {
      source = src ? { src, w, h, kind } : null;
      size = [0, 0];
      upload();
    },
    refresh: upload,
    osd(layer) {
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, osdTex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, layer);
      gl.activeTexture(gl.TEXTURE0);
    },
    render(look, fx) {
      const W = canvas.width;
      const H = canvas.height;
      const r = dpr();
      gl.viewport(0, 0, W, H);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, picTex);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, osdTex);
      gl.uniform2f(U.uRes, W, H);
      const f = source ? fit(source.w, source.h) : ([0, 0, 1, 1] as const);
      gl.uniform2f(U.uPicRes, source?.w ?? 1, source?.h ?? 1);
      gl.uniform4f(U.uFit, f[0], f[1], f[2], f[3]);
      gl.uniform1f(U.uHasPic, source ? 1 : 0);
      /* one scanline per game row where the screen is tall enough, else one per two; ~3 css px for pictures */
      const lines = look.sharp ? 240 / Math.max(1, Math.ceil((3 * 240) / H)) : Math.max(120, Math.round(H / r / 2.6));
      gl.uniform1f(U.uLines, lines);
      gl.uniform1f(U.uTime, fx.time);
      gl.uniform1f(U.uCurve, look.curve);
      gl.uniform1f(U.uScan, look.scan);
      gl.uniform1f(U.uMask, look.mask);
      gl.uniform1f(U.uAberr, look.aberr);
      gl.uniform1f(U.uVig, look.vig);
      gl.uniform1f(U.uBloom, look.bloom);
      gl.uniform1f(U.uNoise, look.noise);
      gl.uniform1f(U.uBand, look.band);
      gl.uniform1f(U.uSharp, look.sharp);
      gl.uniform1f(U.uBright, look.bright);
      gl.uniform1f(U.uSnow, fx.snow);
      gl.uniform1f(U.uRoll, fx.roll);
      gl.uniform1f(U.uBeamW, fx.beamW);
      gl.uniform1f(U.uBeamH, fx.beamH);
      gl.uniform1f(U.uFlash, fx.flash);
      gl.uniform1f(U.uOsdA, fx.osd);
      gl.uniform1f(U.uDpr, r);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    },
    destroy() {
      gl.deleteTexture(picTex);
      gl.deleteTexture(osdTex);
      gl.deleteVertexArray(vao);
      gl.deleteProgram(prog);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    },
  };
}

/** Without WebGL2 the set still works: the picture, letterboxed, with the display and snow drawn flat */
function createFlat(canvas: HTMLCanvasElement): Crt {
  const ctx = canvas.getContext("2d")!;
  let source: { src: Source; w: number; h: number; kind: Kind } | null = null;
  let layer: HTMLCanvasElement | null = null;
  return {
    webgl: false,
    resize(w, h) {
      const r = dpr();
      canvas.width = Math.max(1, Math.round(w * r));
      canvas.height = Math.max(1, Math.round(h * r));
    },
    picture(src, w, h, kind) {
      source = src ? { src, w, h, kind } : null;
    },
    refresh() {},
    osd(l) {
      layer = l;
    },
    render(_look, fx) {
      const W = canvas.width;
      const H = canvas.height;
      ctx.fillStyle = "#2a1a12";
      ctx.fillRect(0, 0, W, H);
      if (fx.beamW <= 0) return;
      if (source) {
        const [x, y, w, h] = fit(source.w, source.h);
        ctx.imageSmoothingEnabled = source.kind !== "game";
        ctx.drawImage(source.src, x * W, (1 - y - h) * H, w * W, h * H);
      }
      if (fx.snow > 0) {
        ctx.globalAlpha = fx.snow;
        for (let i = 0; i < 400; i++) {
          ctx.fillStyle = Math.random() < 0.5 ? "#f1e2c0" : "#4d3426";
          ctx.fillRect(Math.random() * W, Math.random() * H, 3, 2);
        }
        ctx.globalAlpha = 1;
      }
      if (layer && fx.osd > 0) {
        ctx.imageSmoothingEnabled = false;
        ctx.globalAlpha = fx.osd;
        ctx.drawImage(layer, 0, 0, W, H);
        ctx.globalAlpha = 1;
      }
    },
    destroy() {},
  };
}
