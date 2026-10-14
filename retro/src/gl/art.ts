import * as THREE from "three";

/** Source square in image pixels: left, top, side */
export type Crop = (w: number, h: number) => [number, number, number];

export const centreCrop: Crop = (w, h) => {
  const s = Math.min(w, h);
  return [(w - s) / 2, (h - s) / 2, s];
};

/** decode() can reject under memory pressure or a dropped connection; a loaded image is still usable, else retry */
async function decoded(url: string) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    try {
      await img.decode();
      return img;
    } catch (err) {
      if (img.complete && img.naturalWidth > 0) return img;
      if (attempt === 3) throw err;
      await new Promise((r) => setTimeout(r, 500 * attempt));
    }
  }
  throw new Error(`could not decode ${url}`);
}

/** Loads an image and cuts the square the sleeve prints, so the shader never has to know the source aspect. */
export async function loadSquare(url: string, maxPx: number, crop: Crop, anisotropy: number) {
  const img = await decoded(url);
  const [sx, sy, s] = crop(img.naturalWidth, img.naturalHeight);
  const size = Math.min(maxPx, Math.round(s));
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const g = canvas.getContext("2d")!;
  g.imageSmoothingQuality = "high";
  g.drawImage(img, sx, sy, s, s, 0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = anisotropy;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  return tex;
}

/** Deterministic random so the print wear is the same on every visit */
export function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/**
 * A tiling noise tile for paper and ink: R is fibre (fine), G is ink mottle (medium), B is wear (coarse).
 * Sampled as a mipmapped texture so it never shimmers while the sleeve moves.
 */
export function noiseTexture() {
  const N = 256;
  const rand = seeded(7);
  const lattice = (n: number) => Float32Array.from({ length: n * n }, () => rand());
  const sample = (lat: Float32Array, n: number, x: number, y: number) => {
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const fx = x - x0;
    const fy = y - y0;
    const ux = fx * fx * (3 - 2 * fx);
    const uy = fy * fy * (3 - 2 * fy);
    const at = (i: number, j: number) => lat[(((j % n) + n) % n) * n + (((i % n) + n) % n)];
    const a = at(x0, y0) + (at(x0 + 1, y0) - at(x0, y0)) * ux;
    const b = at(x0, y0 + 1) + (at(x0 + 1, y0 + 1) - at(x0, y0 + 1)) * ux;
    return a + (b - a) * uy;
  };
  const fib = lattice(128);
  const m1 = lattice(16);
  const m2 = lattice(32);
  const w1 = lattice(4);
  const w2 = lattice(8);
  const data = new Uint8Array(N * N * 4);
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const u = x / N;
      const v = y / N;
      const fibre = 0.55 * sample(fib, 128, u * 128, v * 128) + 0.45 * rand();
      const mottle = 0.65 * sample(m1, 16, u * 16, v * 16) + 0.35 * sample(m2, 32, u * 32, v * 32);
      const wear = 0.7 * sample(w1, 4, u * 4, v * 4) + 0.3 * sample(w2, 8, u * 8, v * 8);
      const i = (y * N + x) * 4;
      data[i] = fibre * 255;
      data[i + 1] = mottle * 255;
      data[i + 2] = wear * 255;
      data[i + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, N, N, THREE.RGBAFormat);
  tex.colorSpace = THREE.NoColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}
