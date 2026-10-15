import * as THREE from "three";
import { RECORD_R } from "./record";
import { color } from "./palette";

/** A blurred silhouette drawn once with canvas shadowBlur. The plane leaves 3.4 sigma of room so no edge ever shows. */
function blurred(kind: "square" | "disc", blur: number) {
  const S = 256;
  const pad = blur * 3.4;
  const shape = S / (1 + pad * 2);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = S;
  const g = canvas.getContext("2d")!;
  const away = S * 4;
  g.shadowColor = "#fff";
  g.shadowBlur = blur * shape * 2;
  g.shadowOffsetX = away;
  g.fillStyle = "#fff";
  g.beginPath();
  if (kind === "disc") g.arc(S / 2 - away, S / 2, shape / 2, 0, Math.PI * 2);
  else g.roundRect(S / 2 - away - shape / 2, S / 2 - shape / 2, shape, shape, shape * 0.01);
  g.fill();
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.NoColorSpace;
  return { tex, size: 1 + pad * 2 };
}

function layer(kind: "square" | "disc", blur: number, scale: number, opacity: number) {
  const { tex, size } = blurred(kind, blur);
  const material = new THREE.MeshBasicMaterial({
    color: color("chocolate").multiplyScalar(0.55),
    map: tex,
    transparent: true,
    opacity,
    depthWrite: false,
    toneMapped: false,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(size * scale, size * scale), material);
  mesh.renderOrder = -1;
  return { mesh, material, base: opacity };
}

/**
 * Soft shadows on the page behind the sleeve and the record. The canvas is transparent over the bone paper,
 * so a dark blurred plane reads as a cast shadow. A tight contact layer and a wide ambient one,
 * both drifting and softening as the sleeve lifts toward the camera.
 */
export function createShadows() {
  const contact = layer("square", 0.03, 1, 0.26);
  const ambient = layer("square", 0.15, 1, 0.24);
  const discContact = layer("disc", 0.03, RECORD_R * 2, 0.42);
  const discAmbient = layer("disc", 0.14, RECORD_R * 2, 0.26);
  const group = new THREE.Group();
  group.add(ambient.mesh, discAmbient.mesh, contact.mesh, discContact.mesh);

  /** lift is the sleeve's height off the page in sleeve widths, recordX where the record centre sits */
  function update(lift: number, recordX: number, fade: number) {
    const l = Math.max(0, lift);
    const near = { x: 0.008 + l * 0.1, y: -0.014 - l * 0.16 };
    const far = { x: 0.02 + l * 0.14, y: -0.04 - l * 0.22 };
    contact.mesh.position.set(near.x, near.y, 0);
    ambient.mesh.position.set(far.x, far.y, 0);
    discContact.mesh.position.set(recordX + near.x, near.y, 0);
    discAmbient.mesh.position.set(recordX + far.x, far.y, 0);
    const spread = 1 + l * 0.35;
    contact.mesh.scale.setScalar(1 + l * 0.08);
    discContact.mesh.scale.setScalar(1 + l * 0.08);
    ambient.mesh.scale.setScalar(spread);
    discAmbient.mesh.scale.setScalar(spread);
    const sharp = Math.max(0, 1 - l * 4) * fade;
    const soft = Math.max(0.35, 1 - l * 1.2) * fade;
    contact.material.opacity = contact.base * sharp;
    discContact.material.opacity = discContact.base * sharp;
    ambient.material.opacity = ambient.base * soft;
    discAmbient.material.opacity = discAmbient.base * soft;
  }

  return { group, update };
}
