import "./styles/fonts.css";
import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/chrome.css";
import "./styles/cursor.css";
import "./styles/transition.css";
import "./styles/loader.css";
import "./styles/home.css";
import "./styles/footer.css";
import "./styles/case.css";
import "./styles/story.css";
/* One stylesheet per case story, picked up by filename */
import.meta.glob("./styles/stories/*.css", { eager: true });
import "./styles/tldr.css";
import "./styles/about.css";
import "./styles/work.css";
import "./styles/playground.css";
import "./styles/contact.css";
import "./styles/switch.css";

import { observeVideos } from "./core/ambient";
import { initChrome } from "./core/chrome";
import { initCursor } from "./core/cursor";
import { runLoader } from "./core/loader";
import { bus } from "./core/bus";
import { getPhase, setPhase } from "./core/motion";
import { afterMount, initRouter } from "./core/router";
import { initScroll, lenis } from "./core/scroll";
import { initTransition } from "./core/transition";
import { initOSLoader } from "./os/boot";
import { mountFooter } from "./sections/footer";
import { chrome } from "./templates/routes";

const BASE = import.meta.env.BASE_URL;

async function boot() {
  const chromeEl = document.getElementById("chrome")!;
  if (!chromeEl.firstElementChild) chromeEl.innerHTML = chrome(BASE);

  initScroll();
  initCursor();
  initTransition();
  const header = initChrome(chromeEl);

  /* The compact footer is on every page except contact; mountFooter is a no-op where a view already mounted it */
  let stopVideos = () => {};
  let stopFooter = () => {};
  bus.on("route:leave", () => {
    stopFooter();
    stopFooter = () => {};
  });
  afterMount(() => {
    header.refresh();
    stopVideos();
    stopVideos = observeVideos(document.getElementById("main")!);
    stopFooter = mountFooter(document.getElementById("main")!);
  });

  /* The loader covers the first page like a curtain, so reveals and intros wait for it via whenIdle() */
  setPhase("covering");
  /* intro:done fires as the loader starts lifting, so entrances play under the lift, not after it */
  const offIntro = bus.on("intro:done", () => {
    offIntro();
    setPhase("idle");
  });
  try {
    await initRouter();
    initOSLoader();
    await runLoader();
  } finally {
    offIntro();
    if (getPhase() !== "idle") setPhase("idle");
  }

  if (import.meta.env.DEV) {
    (window as unknown as { __app: object }).__app = { lenis };
    void import("./dev/agentation").then((m) => m.mountAgentation());
  }
}

boot();
