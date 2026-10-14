import { mountFilter } from "./filter";

type Item = { title: string; note: string; kind: string; year: string; tools: string[]; why: string; src: string; video: string; w: number; h: number };

const BOARD_COLS = 5;
const BOARD_WIDTH = { s: 220, m: 300, l: 400 } as const;
const BOARD_GAP = 90;
const ZOOM_MIN = 0.2;
const ZOOM_MAX = 2.5;
const ZOOM_STEP = 1.2;
const DRAG_PX = 4;

const pad2 = (n: number) => String(n).padStart(2, "0");

export function mountPlayground() {
  const data: Item[] = JSON.parse(document.querySelector("[data-play]")!.textContent!);
  const views = document.querySelector<HTMLElement>("[data-play-views]")!;
  const board = views.querySelector<HTMLElement>("[data-board]")!;
  const canvas = views.querySelector<HTMLElement>("[data-masonry]")!;
  const tiles = [...canvas.querySelectorAll<HTMLElement>(".tile")];
  const zoomLabel = views.querySelector<HTMLElement>("[data-zoom-level]")!;
  const motionBtn = document.querySelector<HTMLButtonElement>("[data-motion]")!;

  /* ---------- Size, motion, view ---------- */

  const pressed = (group: Element[], on: Element) => group.forEach((b) => b.setAttribute("aria-pressed", String(b === on)));
  const sizeBtns = [...document.querySelectorAll<HTMLButtonElement>("[data-size]")];
  sizeBtns.forEach((b) =>
    b.addEventListener("click", () => {
      views.dataset.size = b.dataset.size!;
      pressed(sizeBtns, b);
      if (views.dataset.pview === "board") layoutBoard(true);
    }),
  );

  const videos = () => [...canvas.querySelectorAll<HTMLVideoElement>("video")];
  motionBtn.addEventListener("click", () => {
    const off = motionBtn.getAttribute("aria-pressed") === "true";
    motionBtn.setAttribute("aria-pressed", String(!off));
    motionBtn.textContent = off ? "Motion off" : "Motion on";
    document.documentElement.toggleAttribute("data-motion-off", off);
    videos().forEach((v) => (off ? v.pause() : v.getBoundingClientRect().bottom > 0 && v.play().catch(() => {})));
  });

  const viewBtns = [...document.querySelectorAll<HTMLButtonElement>("[data-pview]")];
  viewBtns.forEach((b) =>
    b.addEventListener("click", () => {
      views.dataset.pview = b.dataset.pview!;
      pressed(viewBtns, b);
      if (b.dataset.pview === "board") layoutBoard(true);
      else tiles.forEach((t) => ["left", "top", "width", "z-index"].forEach((prop) => t.style.removeProperty(prop)));
    }),
  );

  mountFilter({
    chips: [...document.querySelectorAll<HTMLButtonElement>(".toolbar [data-filter]")],
    items: tiles,
    after: () => views.dataset.pview === "board" && layoutBoard(true),
  });

  /* ---------- Board: a pannable, zoomable canvas of loose frames ---------- */

  let px = 0;
  let py = 0;
  let z = 1;

  const apply = () => {
    canvas.style.transform = `translate(${px}px, ${py}px) scale(${z})`;
    zoomLabel.textContent = `${Math.round(z * 100)}%`;
  };

  const zoomAt = (next: number, cx: number, cy: number) => {
    next = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, next));
    px = cx - ((cx - px) * next) / z;
    py = cy - ((cy - py) * next) / z;
    z = next;
    apply();
  };

  const fit = () => {
    const shown = tiles.filter((t) => !t.hidden);
    if (!shown.length) return;
    const right = Math.max(...shown.map((t) => t.offsetLeft + t.offsetWidth));
    const bottom = Math.max(...shown.map((t) => t.offsetTop + t.offsetHeight));
    const vw = board.clientWidth;
    const vh = board.clientHeight;
    z = Math.min(1, Math.max(ZOOM_MIN, Math.min((vw - 80) / right, (vh - 80) / bottom)));
    px = (vw - right * z) / 2;
    py = (vh - bottom * z) / 2;
    apply();
  };

  /** Place visible tiles on a staggered grid. Each column keeps its own running height, like a pinboard. */
  function layoutBoard(refit: boolean) {
    const w = BOARD_WIDTH[(views.dataset.size as keyof typeof BOARD_WIDTH) ?? "m"];
    const heights: number[] = Array.from({ length: BOARD_COLS }, (_, c) => (c % 2 ? 70 : 0));
    tiles
      .filter((t) => !t.hidden)
      .forEach((t, i) => {
        const item = data[Number(t.dataset.i)];
        const c = heights.indexOf(Math.min(...heights));
        const jitter = ((i * 37) % 50) - 25;
        t.style.left = `${c * (w + BOARD_GAP) + jitter}px`;
        t.style.top = `${heights[c] + 40}px`;
        t.style.width = `${w}px`;
        heights[c] += (w * item.h) / item.w + BOARD_GAP + 40;
      });
    if (refit) requestAnimationFrame(fit);
  }

  views.querySelectorAll<HTMLButtonElement>("[data-zoom]").forEach((b) =>
    b.addEventListener("click", () => {
      if (b.dataset.zoom === "fit") return fit();
      zoomAt(z * (b.dataset.zoom === "1" ? ZOOM_STEP : 1 / ZOOM_STEP), board.clientWidth / 2, board.clientHeight / 2);
    }),
  );

  board.addEventListener(
    "wheel",
    (e) => {
      if (views.dataset.pview !== "board" || !(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      const r = board.getBoundingClientRect();
      zoomAt(z * Math.exp(-e.deltaY * 0.0025), e.clientX - r.left, e.clientY - r.top);
    },
    { passive: false },
  );

  /* One gesture handler: on a tile it moves the tile, on empty canvas it pans */
  let gesture: { id: number; x: number; y: number; tile: HTMLElement | null; ox: number; oy: number; moved: boolean } | null = null;
  let selected: HTMLElement | null = null;

  board.addEventListener("pointerdown", (e) => {
    if (views.dataset.pview !== "board" || e.button !== 0) return;
    const tile = (e.target as Element).closest<HTMLElement>(".tile");
    gesture = { id: e.pointerId, x: e.clientX, y: e.clientY, tile, ox: tile ? tile.offsetLeft : px, oy: tile ? tile.offsetTop : py, moved: false };
  });
  board.addEventListener("pointermove", (e) => {
    if (!gesture || e.pointerId !== gesture.id) return;
    const dx = e.clientX - gesture.x;
    const dy = e.clientY - gesture.y;
    if (!gesture.moved && Math.hypot(dx, dy) < DRAG_PX) return;
    if (!gesture.moved) {
      gesture.moved = true;
      board.setPointerCapture(e.pointerId);
      board.dataset.grabbing = "";
    }
    if (gesture.tile) {
      gesture.tile.style.left = `${gesture.ox + dx / z}px`;
      gesture.tile.style.top = `${gesture.oy + dy / z}px`;
      gesture.tile.style.zIndex = "2";
    } else {
      px = gesture.ox + dx;
      py = gesture.oy + dy;
      apply();
    }
  });
  const release = (e: PointerEvent) => {
    if (!gesture || e.pointerId !== gesture.id) return;
    delete board.dataset.grabbing;
    if (!gesture.moved && gesture.tile) {
      selected?.removeAttribute("data-selected");
      selected = gesture.tile;
      selected.setAttribute("data-selected", "");
    }
    if (!gesture.moved && !gesture.tile && selected) {
      selected.removeAttribute("data-selected");
      selected = null;
    }
    gesture = null;
  };
  board.addEventListener("pointerup", release);
  board.addEventListener("pointercancel", release);
  board.addEventListener("dragstart", (e) => e.preventDefault());

  /* ---------- Lightbox with context and playback controls ---------- */

  const dialog = document.querySelector<HTMLDialogElement>("[data-lightbox]")!;
  const $ = <T extends HTMLElement>(sel: string) => dialog.querySelector<T>(sel)!;
  const stage = $("[data-lb-stage]");
  const controls = $("[data-lb-video]");
  const playBtn = $<HTMLButtonElement>('[data-lb="play"]');
  const scrub = $<HTMLInputElement>("[data-lb-scrub]");
  const speedBtns = [...dialog.querySelectorAll<HTMLButtonElement>("[data-speed]")];
  let current = 0;
  let video: HTMLVideoElement | null = null;
  let opener: HTMLElement | null = null;
  let scrubRaf = 0;

  const visible = () => tiles.map((t, i) => (t.hidden ? -1 : i)).filter((i) => i >= 0);

  const syncScrub = () => {
    if (video && video.duration) scrub.value = String(Math.round((video.currentTime / video.duration) * 1000));
    scrubRaf = dialog.open ? requestAnimationFrame(syncScrub) : 0;
  };

  const render = (i: number) => {
    current = i;
    const item = data[i];
    const order = visible();
    stage.replaceChildren();
    video = null;
    if (item.video) {
      video = document.createElement("video");
      Object.assign(video, { src: item.video, poster: item.src, muted: true, loop: true, playsInline: true, autoplay: true });
      video.width = item.w;
      video.height = item.h;
      video.playbackRate = Number(speedBtns.find((b) => b.getAttribute("aria-pressed") === "true")?.dataset.speed ?? 1);
      video.addEventListener("play", () => (playBtn.textContent = "Pause"));
      video.addEventListener("pause", () => (playBtn.textContent = "Play"));
      stage.append(video);
      scrubRaf ||= requestAnimationFrame(syncScrub);
    } else {
      const img = new Image(item.w, item.h);
      img.src = item.src;
      img.alt = item.title;
      stage.append(img);
    }
    controls.hidden = !item.video;
    $("[data-lb-count]").textContent = `${pad2(order.indexOf(i) + 1)} / ${pad2(order.length)}`;
    $("[data-lb-title]").textContent = item.title;
    $("[data-lb-note]").textContent = item.note;
    $("[data-lb-kind]").textContent = item.kind;
    $("[data-lb-year]").textContent = item.year;
    $("[data-lb-tools]").textContent = item.tools.join(", ");
    $("[data-lb-why]").textContent = item.why;
  };

  const step = (dir: 1 | -1) => {
    const order = visible();
    render(order[(order.indexOf(current) + dir + order.length) % order.length]);
  };

  const open = (btn: HTMLElement) => {
    opener = btn;
    render(Number(btn.dataset.open));
    dialog.showModal();
  };

  /* Grid: a click opens. Board: a click selects and a double-click opens, so dragging stays possible. Keyboard always opens */
  tiles.forEach((t) => {
    const btn = t.querySelector<HTMLElement>("[data-open]")!;
    btn.addEventListener("click", (e) => {
      if (views.dataset.pview === "board" && e.detail !== 0) return;
      open(btn);
    });
    btn.addEventListener("dblclick", () => views.dataset.pview === "board" && open(btn));
  });

  playBtn.addEventListener("click", () => video && (video.paused ? video.play() : video.pause()));
  scrub.addEventListener("input", () => {
    if (video && video.duration) video.currentTime = (Number(scrub.value) / 1000) * video.duration;
  });
  speedBtns.forEach((b) =>
    b.addEventListener("click", () => {
      pressed(speedBtns, b);
      if (video) video.playbackRate = Number(b.dataset.speed);
    }),
  );

  dialog.addEventListener("click", (e) => {
    const action = (e.target as Element).closest<HTMLElement>("[data-lb]")?.dataset.lb;
    if (action === "prev") step(-1);
    else if (action === "next") step(1);
    else if (action === "close" || e.target === dialog) dialog.close();
  });
  dialog.addEventListener("keydown", (e) => {
    if ((e.target as Element).matches("input")) return;
    if (e.key === "ArrowLeft") step(-1);
    else if (e.key === "ArrowRight") step(1);
    else if (e.key === " " && video) {
      e.preventDefault();
      video.paused ? video.play() : video.pause();
    }
  });
  dialog.addEventListener("close", () => {
    stage.replaceChildren();
    video = null;
    cancelAnimationFrame(scrubRaf);
    scrubRaf = 0;
    opener?.focus();
  });
}
