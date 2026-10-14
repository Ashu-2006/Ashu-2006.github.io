import { bus } from "../core/bus";
import type { Early } from "./world";

/* Bus events can fire while three.js is still downloading; remember them so the stage can catch up */
const early: Early = { intro: false, kind: null };
bus.on("intro:done", () => (early.intro = true));
bus.on("route:enter", ({ kind }) => (early.kind = kind));

/**
 * The persistent 3D stage: the album sleeve with the record that slides out of it.
 * three.js loads in its own chunk. Any failure leaves the hero's fallback image in place.
 */
export function initStage(canvas: HTMLCanvasElement) {
  import("./world")
    .then(({ createWorld }) => createWorld(canvas, early))
    .catch((err) => {
      document.documentElement.classList.remove("has-stage");
      canvas.style.opacity = "0";
      console.warn("stage unavailable, showing the fallback image", err);
    });
}
