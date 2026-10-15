/** Size of the footer morph viewBox. Every shape is centred in it with the same circumradius. */
export const SHAPE_BOX = 220;
const C = SHAPE_BOX / 2;
const R = 100;

/** A regular polygon path with `n` sides, first vertex straight up (a diamond for n = 4) */
export function polygonPath(n: number, r = R) {
  const pts = Array.from({ length: n }, (_, i) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    return `${(C + r * Math.cos(a)).toFixed(2)},${(C + r * Math.sin(a)).toFixed(2)}`;
  });
  return `M${pts.join("L")}Z`;
}

export const circlePath = (r = R) => `M${C},${C - r}A${r},${r} 0 1 1 ${C},${C + r}A${r},${r} 0 1 1 ${C},${C - r}Z`;

/** Diamond, hexagon, octagon, 12-gon, 16-gon, circle: the CTA's six checkpoints */
export const MORPH_SHAPES = [polygonPath(4), polygonPath(6), polygonPath(8), polygonPath(12), polygonPath(16), circlePath()];
