import * as THREE from "three";
import { SIDE_A } from "../templates/tracks";
import { seeded } from "./art";
import { token } from "./palette";

/** All sizes are in sleeve widths: a 301 mm record in a 314 mm sleeve */
export const RECORD_R = 0.479;
const LABEL_R = RECORD_R * 0.332;
const HOLE_R = 0.0118;
const THICK = 0.0035;

const NAME = "Ashutosh Rana";

type Zone = { from: number; to: number; kind: "wax" | "groove" | "gap" | "lead" | "rim" };

/** Radii as fractions of the record radius. One band per Side A track, outermost is track 1. */
function layout(tracks: number): Zone[] {
  const rand = seeded(33);
  const inner = 0.395;
  const outer = 0.962;
  const gap = 0.0085;
  const weights = Array.from({ length: tracks }, () => 0.7 + rand() * 0.6);
  const total = weights.reduce((a, b) => a + b, 0);
  const span = outer - inner - gap * (tracks - 1);
  const zones: Zone[] = [{ from: 0.332, to: inner, kind: "wax" }];
  let r = inner;
  weights.forEach((w, i) => {
    const width = (w / total) * span;
    zones.push({ from: r, to: r + width, kind: "groove" });
    r += width;
    if (i < tracks - 1) {
      zones.push({ from: r, to: r + gap, kind: "gap" });
      r += gap;
    }
  });
  zones.push({ from: outer, to: 0.985, kind: "lead" }, { from: 0.985, to: 1, kind: "rim" });
  return zones;
}

function annulus(g: CanvasRenderingContext2D, c: number, r0: number, r1: number) {
  g.beginPath();
  g.arc(c, c, r1, 0, Math.PI * 2);
  g.arc(c, c, r0, 0, Math.PI * 2, true);
  g.fill();
}

/** The pressed surface: hundreds of fine grooves, smooth glossy gaps between tracks, dead wax and a rim */
async function albedoCanvas(zones: Zone[], pause: () => Promise<void>) {
  const S = 2048;
  const C = S / 2;
  const rand = seeded(91);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = S;
  const g = canvas.getContext("2d")!;
  g.fillStyle = "#0d0b0a";
  g.fillRect(0, 0, S, S);

  let strokes = 0;
  for (const z of zones) {
    if (z.kind === "groove" || z.kind === "lead") {
      const step = z.kind === "lead" ? 9 : 1.15;
      for (let r = z.from * C; r < z.to * C; r += step) {
        if (++strokes % 160 === 0) await pause();
        g.strokeStyle = `rgba(255, 236, 214, ${(0.016 + rand() * 0.05).toFixed(3)})`;
        g.lineWidth = 0.55;
        g.beginPath();
        g.arc(C, C, r, 0, Math.PI * 2);
        g.stroke();
      }
    } else if (z.kind === "gap") {
      g.fillStyle = "#060505";
      annulus(g, C, z.from * C, z.to * C);
    } else if (z.kind === "wax") {
      g.fillStyle = "#100e0c";
      annulus(g, C, z.from * C, z.to * C);
      g.strokeStyle = "rgba(255, 236, 214, 0.05)";
      g.lineWidth = 0.8;
      for (const f of [0.352, 0.358, 0.3635]) {
        g.beginPath();
        g.arc(C, C, f * C, 0, Math.PI * 2);
        g.stroke();
      }
    } else {
      g.fillStyle = "#121010";
      annulus(g, C, z.from * C, z.to * C);
    }
  }

  /* A faint uneven sheen that turns with the disc, so the spin reads even under a fixed highlight */
  const sheen = g.createConicGradient(0.7, C, C);
  const stops = [0, 0.11, 0.23, 0.37, 0.5, 0.61, 0.76, 0.88, 1];
  stops.forEach((s, i) => sheen.addColorStop(s, `rgba(255, 236, 214, ${i % 2 ? 0.035 : 0})`));
  g.fillStyle = sheen;
  annulus(g, C, 0.395 * C, 0.962 * C);
  return canvas;
}

/** Roughness lives in the green channel: matte grooves, glassy gaps and dead wax */
function roughnessCanvas(zones: Zone[]) {
  const S = 1024;
  const C = S / 2;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = S;
  const g = canvas.getContext("2d")!;
  g.fillStyle = "rgb(128,128,128)";
  g.fillRect(0, 0, S, S);
  const level: Record<Zone["kind"], number> = { groove: 0.3, lead: 0.24, gap: 0.12, wax: 0.1, rim: 0.26 };
  for (const z of zones) {
    const v = Math.round(level[z.kind] * 255);
    g.fillStyle = `rgb(${v},${v},${v})`;
    annulus(g, C, z.from * C, z.to * C);
  }
  return canvas;
}

/**
 * Anisotropy along each groove (the circle's tangent), strength in blue. three stretches the lobe across that
 * direction, which draws the classic bright spoke through the centre toward the light, fixed while the disc turns.
 */
function anisotropyTexture(zones: Zone[]) {
  const S = 512;
  const data = new Uint8Array(S * S * 4);
  const strength: Record<Zone["kind"], number> = { groove: 1, lead: 0.7, gap: 0.2, wax: 0.05, rim: 0 };
  const lut = Float32Array.from({ length: S + 1 }, (_, i) => {
    const zone = zones.find((z) => i / S >= z.from && i / S < z.to);
    return zone ? strength[zone.kind] : 0;
  });
  for (let py = 0; py < S; py++) {
    for (let px = 0; px < S; px++) {
      const u = (px + 0.5) / S - 0.5;
      const v = (py + 0.5) / S - 0.5;
      const len = Math.sqrt(u * u + v * v) || 1e-6;
      const i = (py * S + px) * 4;
      data[i] = Math.round(((-v / len) * 0.5 + 0.5) * 255);
      data[i + 1] = Math.round(((u / len) * 0.5 + 0.5) * 255);
      data[i + 2] = Math.round(lut[Math.min(S, Math.round(len * 2 * S))] * 255);
      data[i + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, S, S, THREE.RGBAFormat);
  tex.colorSpace = THREE.NoColorSpace;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}

/** The poppy paper label: a thin pressed ring, the name set around the top, and the spindle hole cut through */
function drawLabel(canvas: HTMLCanvasElement, family: string | null) {
  const S = canvas.width;
  const C = S / 2;
  const g = canvas.getContext("2d")!;
  const rand = seeded(5);
  g.clearRect(0, 0, S, S);
  g.fillStyle = token("poppy");
  g.beginPath();
  g.arc(C, C, C, 0, Math.PI * 2);
  g.fill();

  for (let i = 0; i < 9000; i++) {
    const a = rand() * Math.PI * 2;
    const r = Math.sqrt(rand()) * C;
    g.fillStyle = rand() > 0.5 ? "rgba(42, 26, 18, 0.06)" : "rgba(241, 226, 192, 0.05)";
    g.fillRect(C + Math.cos(a) * r, C + Math.sin(a) * r, 1.5, 1.5);
  }

  const bone = token("bone");
  g.strokeStyle = bone;
  g.globalAlpha = 0.6;
  g.lineWidth = S * 0.0035;
  g.beginPath();
  g.arc(C, C, C * 0.905, 0, Math.PI * 2);
  g.stroke();
  g.globalAlpha = 0.18;
  g.strokeStyle = token("chocolate");
  g.lineWidth = S * 0.004;
  g.beginPath();
  g.arc(C, C, (HOLE_R / LABEL_R) * C * 2.1, 0, Math.PI * 2);
  g.stroke();
  g.globalAlpha = 1;

  if (family) {
    const size = S * 0.105;
    const radius = C * 0.62;
    const tracking = size * 0.035;
    g.font = `800 ${size}px ${family}`;
    g.fillStyle = bone;
    g.textBaseline = "alphabetic";
    const widths = [...NAME].map((ch) => g.measureText(ch).width + tracking);
    const total = widths.reduce((a, b) => a + b, 0) - tracking;
    let angle = -Math.PI / 2 - total / radius / 2;
    [...NAME].forEach((ch, i) => {
      const w = widths[i] - tracking;
      const mid = angle + w / 2 / radius;
      g.save();
      g.translate(C + Math.cos(mid) * radius, C + Math.sin(mid) * radius);
      g.rotate(mid + Math.PI / 2);
      g.fillText(ch, -w / 2, 0);
      g.restore();
      angle += widths[i] / radius;
    });
  }
}

/**
 * Fraunces at SOFT 100, WONK 1 is the site's display voice, but canvas text cannot set variation axes.
 * Google Fonts can serve a pinned instance subset to just the label's letters (about 2 KB), which canvas can use.
 * If that fails the label uses the page's Fraunces at its default axes.
 */
async function labelFamily() {
  try {
    await document.fonts.load(`800 64px Fraunces`, NAME);
  } catch {
    /* the page font failed; the pinned instance below or the serif fallback still sets the name */
  }
  try {
    const chars = encodeURIComponent([...new Set(NAME)].join(""));
    const css = await fetch(`https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght,SOFT,WONK@144,800,100,1&text=${chars}`).then((r) =>
      r.ok ? r.text() : "",
    );
    const src = css.match(/url\((https:[^)]+)\)/)?.[1];
    if (src) {
      const face = new FontFace("Fraunces Label", `url(${src})`, { weight: "800" });
      await face.load();
      document.fonts.add(face);
      return `"Fraunces Label", Fraunces, serif`;
    }
  } catch {
    /* offline or blocked: the variable Fraunces already on the page is close enough */
  }
  return `Fraunces, serif`;
}

export type Vinyl = Awaited<ReturnType<typeof createRecord>>;

/** Built in slices with pause() between them, so the loader keeps its frames while the textures are drawn */
export async function createRecord(anisotropy: number, pause: () => Promise<void>) {
  const zones = layout(Math.max(1, SIDE_A.length));

  const albedo = new THREE.CanvasTexture(await albedoCanvas(zones, pause));
  albedo.colorSpace = THREE.SRGBColorSpace;
  albedo.anisotropy = anisotropy;
  const rough = new THREE.CanvasTexture(roughnessCanvas(zones));
  rough.colorSpace = THREE.NoColorSpace;
  await pause();
  const aniso = anisotropyTexture(zones);
  await pause();

  const vinyl = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    map: albedo,
    roughness: 1,
    roughnessMap: rough,
    metalness: 0,
    clearcoat: 0.35,
    clearcoatRoughness: 0.1,
    anisotropy: 0.95,
    anisotropyMap: aniso,
  });

  const labelCanvas = document.createElement("canvas");
  labelCanvas.width = labelCanvas.height = 1024;
  drawLabel(labelCanvas, null);
  const labelTex = new THREE.CanvasTexture(labelCanvas);
  labelTex.colorSpace = THREE.SRGBColorSpace;
  labelTex.anisotropy = anisotropy;
  labelFamily().then((family) => {
    drawLabel(labelCanvas, family);
    labelTex.needsUpdate = true;
  });

  const top = new THREE.Mesh(new THREE.RingGeometry(HOLE_R, RECORD_R, 192, 1).translate(0, 0, THICK / 2), vinyl);
  const label = new THREE.Mesh(
    new THREE.RingGeometry(HOLE_R, LABEL_R, 128, 1).translate(0, 0, THICK / 2 + 0.0003),
    new THREE.MeshBasicMaterial({ map: labelTex, toneMapped: false }),
  );
  const rim = new THREE.Mesh(
    new THREE.CylinderGeometry(RECORD_R, RECORD_R, THICK, 192, 1, true).rotateX(Math.PI / 2),
    new THREE.MeshStandardMaterial({ color: 0x0b0a09, roughness: 0.3 }),
  );

  /** spin turns about the record's own axis; slide carries it in and out of the sleeve */
  const spin = new THREE.Group();
  spin.add(top, label, rim);
  const slide = new THREE.Group();
  slide.add(spin);

  return { slide, spin, vinyl, hit: [top, label] as THREE.Object3D[], textures: [albedo, rough, aniso, labelTex] };
}
