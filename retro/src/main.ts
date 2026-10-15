import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/loader.css";
import "./styles/hero.css";
import "./styles/tracks.css";
import "./styles/crate.css";
import "./styles/den.css";
import "./styles/notes.css";
import "./styles/encore.css";
import "./styles/case.css";

import { initClock, initGrain, observeVideos } from "./core/ambient";
import { initCursor } from "./core/cursor";
import { initHeader } from "./core/header";
import { afterMount, initRouter } from "./core/router";
import { initScroll, lenis } from "./core/scroll";
import { sound } from "./core/sound";
import * as loader from "./sections/loader";

async function boot() {
  initGrain();
  initScroll();
  initCursor();
  const header = initHeader();
  const tickClock = initClock();

  let stopVideos = () => {};
  afterMount(() => {
    header.refresh();
    tickClock();
    sound.bind(document);
    stopVideos();
    stopVideos = observeVideos(document.getElementById("main")!);
  });

  const canvas = document.querySelector<HTMLCanvasElement>("[data-stage]");
  const stage = canvas
    ? import("./gl/stage").then((m) => m.initStage(canvas)).catch((err) => console.error("stage failed", err))
    : Promise.resolve();

  await initRouter();
  loader.mount(document.body);
  await stage;

  if (import.meta.env.DEV) (window as unknown as { __app: object }).__app = { lenis };
}

boot();
