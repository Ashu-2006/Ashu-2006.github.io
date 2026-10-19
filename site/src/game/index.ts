import "../styles/game.css";
import { bus } from "../core/bus";
import { reducedMotion } from "../core/motion";
import { setSound, soundOn } from "../os/sound";
import { PAL } from "./art";
import { createGameAudio } from "./audio";
import { CLEAN, LOOK, STILL, createCrt } from "./crt";
import { NightDrive, type GameState, type Input } from "./engine";
import { RemoteLeaderboard, cleanName, createLeaderboard, saveName, savedName, validName } from "./leaderboard";
import { fillRows, gameMarkup, messageRow, pad6 } from "./ui";

/**
 * Night Drive, ported from retro/ and owned by the game agent (see BRIEF.md).
 * Contract used by the OS layer: mount into a container, return a cleanup.
 */
export type GameOptions = {
  /** Called when the player closes the game from inside (e.g. an Exit button) */
  onExit?: () => void;
  /** "crt" (default) runs the picture through the tube; "clean" shows flat, square pixels */
  look?: "crt" | "clean";
};

type Panel = "title" | "paused" | "over" | "board" | null;

const KEYS: Record<string, keyof Input> = {
  ArrowLeft: "left",
  ArrowRight: "right",
  ArrowUp: "up",
  ArrowDown: "down",
  a: "left",
  A: "left",
  d: "right",
  D: "right",
  w: "up",
  W: "up",
  s: "down",
  S: "down",
};

declare global {
  interface Window {
    /** DEV only: the most recently mounted game, for test scripts */
    __nd?: { engine: NightDrive; state: () => GameState; panel: () => Panel };
    /** DEV only: mounts the game into a fixed box on any page, returns its cleanup */
    __game?: (w?: number, h?: number) => () => void;
  }
}

/**
 * Mounts Night Drive into `container` (which must have a definite size; the game fills it) and returns
 * the cleanup. The frame loop only runs while the game is on screen, the tab is visible and something
 * moves; play pauses when focus leaves the game, the window hides or the tab is hidden.
 */
export function mountGame(container: HTMLElement, opts: GameOptions = {}): () => void {
  const rm = reducedMotion();
  const coarse = matchMedia("(pointer: coarse)").matches;
  const root = document.createElement("div");
  root.className = "nd";
  root.tabIndex = 0;
  root.setAttribute("role", "application");
  root.setAttribute("aria-roledescription", "game");
  root.setAttribute("aria-label", "Night Drive");
  /* the game's 70s palette lives in art.ts; the stylesheet reads it through these */
  root.style.setProperty("--nd-bone", PAL.bone);
  root.style.setProperty("--nd-sun", PAL.harvest);
  root.style.setProperty("--nd-rust", PAL.rust);
  root.style.setProperty("--nd-poppy", PAL.poppy);
  root.style.setProperty("--nd-night", PAL.chocolate);
  root.innerHTML = gameMarkup(coarse, !!opts.onExit);
  if (coarse) root.classList.add("is-touch");
  container.append(root);

  const $ = <T extends Element = HTMLElement>(sel: string) => root.querySelector<T>(sel)!;
  const screen = $("[data-screen]");
  const out = $<HTMLCanvasElement>(".nd__crt");
  const panels = {
    title: $("[data-panel=title]"),
    paused: $("[data-panel=paused]"),
    over: $("[data-panel=over]"),
    board: $("[data-panel=board]"),
  };
  const form = $<HTMLFormElement>("[data-form]");
  const nameInput = $<HTMLInputElement>("[data-name]");
  const nameMsg = $("[data-name-msg]");
  const live = $("[data-live]");
  const rows = $("[data-rows]");
  const pad = $("[data-pad]");
  const v = (k: string) => $(`[data-v=${k}]`);

  const offs: (() => void)[] = [];
  const listen = <E extends Event>(el: EventTarget, type: string, fn: (e: E) => void, o?: AddEventListenerOptions) => {
    const h = fn as EventListener;
    el.addEventListener(type, h, o);
    offs.push(() => el.removeEventListener(type, h, o));
  };

  const audio = createGameAudio();
  const board = createLeaderboard();
  const crt = createCrt(out);
  let panel: Panel = null;
  let boardFrom: Panel = "title";
  let lastRun: { name: string; score: number; stage: number } | null = null;
  let submitNote: string | null = null;
  let boardToken = 0;
  let overShown = false;

  const engine = new NightDrive({
    reduced: rm,
    audio,
    onState: (s) => {
      syncCursor(s);
      if (s === "over") onOver();
      invalidate();
    },
    onNews: (text) => (live.textContent = text),
  });
  engine.touch = coarse;

  /* ---------- panels ---------- */

  const syncSound = () => root.querySelectorAll<HTMLInputElement>("[data-sound]").forEach((c) => (c.checked = soundOn()));

  function show(next: Panel, focus?: HTMLElement | null) {
    /* move focus first, so a hidden focused button never drops focus to the body (which would pause play) */
    if (focus) focus.focus({ preventScroll: true });
    else if (next === null) root.focus({ preventScroll: true });
    (Object.keys(panels) as (keyof typeof panels)[]).forEach((k) => (panels[k].hidden = k !== next));
    panel = next;
    root.dataset.view = next ?? "";
    syncSound();
    bus.emit("cursor:refresh", {});
  }

  const primary = (p: keyof typeof panels) => panels[p].querySelector<HTMLElement>(".nd-btn--default");

  function showTitle(focusName = false) {
    engine.toTitle();
    nameInput.value = savedName();
    nameMsg.textContent = "3 to 12 letters, numbers, spaces or _";
    nameMsg.classList.remove("is-error");
    const wantInput = focusName || (!nameInput.value && !coarse);
    show("title", wantInput ? nameInput : primary("title"));
    if (wantInput) nameInput.select();
    overShown = false;
  }

  function startRun() {
    const name = nameInput.value.trim();
    if (!validName(name)) {
      nameMsg.textContent = name.length < 3 ? "Name needs at least 3 characters" : "Use letters, numbers, spaces or _ only";
      nameMsg.classList.add("is-error");
      nameInput.focus({ preventScroll: true });
      return;
    }
    saveName(name);
    audio.unlock();
    root.focus({ preventScroll: true });
    engine.start();
    overShown = false;
    show(null);
  }

  function playAgain() {
    if (!validName(savedName())) return showTitle(true);
    nameInput.value = savedName();
    startRun();
  }

  function pause() {
    if (engine.state !== "playing") return;
    engine.pause();
    show("paused", primary("paused"));
  }

  function resume() {
    if (engine.state !== "paused") return;
    audio.unlock();
    show(null);
    engine.resume();
    invalidate();
  }

  function onOver() {
    const name = savedName();
    const run = engine.run;
    lastRun = { name, score: run.score, stage: run.stage };
    submitNote = null;
    v("score").textContent = pad6(run.score);
    v("stage").textContent = String(run.stage);
    v("name").textContent = name;
    v("rank").textContent = "Saving your score...";
    v("note").hidden = true;
    const mine = lastRun;
    board
      .submit(name, run.score)
      .then(({ rank }) => {
        if (lastRun !== mine) return;
        const note = board instanceof RemoteLeaderboard ? board.note : null;
        submitNote = note;
        if (note) v("rank").textContent = "Saved on this computer";
        else if (rank === null) v("rank").textContent = board.shared ? "Saved. Not ranked this time." : "Not in this computer's top 10";
        else v("rank").textContent = board.shared ? `Rank ${rank} worldwide` : `Rank ${rank} on this computer`;
        v("note").hidden = !note;
        v("note").textContent = note ?? "";
      })
      .catch((err: unknown) => {
        console.warn("Night Drive: score could not be saved", err);
        v("rank").textContent = "Score not saved";
      });
  }

  async function openBoard(from: Panel) {
    boardFrom = from;
    const token = ++boardToken;
    $("[data-scope]").textContent = board.shared ? "Global leaderboard" : "Scores on this computer";
    const note = $("[data-board-note]");
    note.hidden = true;
    messageRow(rows, "Loading scores...");
    show("board", primary("board"));
    const list = await board.top(10);
    if (token !== boardToken) return;
    const why = submitNote ?? (board instanceof RemoteLeaderboard ? board.note : null);
    if (why) {
      note.textContent = why;
      note.hidden = false;
      $("[data-scope]").textContent = "Scores on this computer";
    }
    if (!list.length) messageRow(rows, "No scores yet. Finish a run to be first.");
    else fillRows(rows, list, from === "over" && lastRun ? lastRun : null);
    rows.querySelector("tr.is-me")?.scrollIntoView({ block: "nearest" });
  }

  /* ---------- input ---------- */

  const keys: Input = { left: false, right: false, up: false, down: false };
  const padKeys: Input = { left: false, right: false, up: false, down: false };
  const syncInput = () => {
    if (engine.state !== "playing") return;
    (Object.keys(keys) as (keyof Input)[]).forEach((k) => (engine.input[k] = keys[k] || padKeys[k]));
  };
  const clearKeys = () => {
    (Object.keys(keys) as (keyof Input)[]).forEach((k) => (keys[k] = padKeys[k] = false));
    pad.querySelectorAll(".is-down").forEach((b) => b.classList.remove("is-down"));
  };

  listen(root, "keydown", (e: KeyboardEvent) => {
    const onRoot = e.target === root;
    if (engine.state === "playing") {
      const dir = KEYS[e.key];
      if (dir) {
        keys[dir] = true;
        syncInput();
        e.preventDefault();
      } else if (e.key === " " || e.key === "p" || e.key === "P" || e.key === "Escape") {
        e.preventDefault();
        /* Escape pauses here rather than closing the window */
        if (e.key === "Escape") e.stopPropagation();
        if (!e.repeat) pause();
      }
      return;
    }
    if (engine.state === "paused") {
      if ((e.key === "p" || e.key === "P") || (onRoot && (e.key === " " || e.key === "Enter"))) {
        e.preventDefault();
        if (!e.repeat) resume();
      }
      return;
    }
    if (e.key === "Enter" && onRoot && !e.repeat) {
      e.preventDefault();
      if (panel === "title") form.requestSubmit();
      else if (panel === "over" || panel === "board") playAgain();
    }
  });
  listen(root, "keyup", (e: KeyboardEvent) => {
    const dir = KEYS[e.key];
    if (!dir) return;
    keys[dir] = false;
    syncInput();
  });

  listen(form, "submit", (e: SubmitEvent) => {
    e.preventDefault();
    startRun();
  });
  listen(nameInput, "input", () => {
    const clean = cleanName(nameInput.value).replace(/^\s+/, "");
    if (clean !== nameInput.value) {
      nameInput.value = clean;
      nameMsg.textContent = "Letters, numbers, spaces or _ only";
      nameMsg.classList.add("is-error");
    } else {
      nameMsg.textContent = "3 to 12 letters, numbers, spaces or _";
      nameMsg.classList.remove("is-error");
    }
  });

  listen(root, "click", (e: MouseEvent) => {
    const act = (e.target as Element).closest<HTMLElement>("[data-act]")?.dataset.act;
    if (!act) return;
    if (act === "board") void openBoard(panel);
    else if (act === "again") playAgain();
    else if (act === "rename") showTitle(true);
    else if (act === "resume") resume();
    else if (act === "quit") showTitle();
    else if (act === "pause") pause();
    else if (act === "exit") opts.onExit?.();
    else if (act === "back") {
      if (boardFrom === "over" && engine.state === "over") show("over", primary("over"));
      else showTitle();
    }
  });
  listen(root, "change", (e: Event) => {
    const box = (e.target as Element).closest<HTMLInputElement>("[data-sound]");
    if (!box) return;
    setSound(box.checked);
    if (box.checked) audio.unlock();
    syncSound();
  });

  /* touch pad: releasing the implicit capture lets a thumb slide from left to right */
  const press = (b: HTMLElement, on: boolean) => {
    const k = b.dataset.key as keyof Input | undefined;
    if (!k) return;
    padKeys[k] = on;
    b.classList.toggle("is-down", on);
    syncInput();
  };
  listen(pad, "pointerdown", (e: PointerEvent) => {
    const b = (e.target as Element).closest<HTMLElement>("[data-key]");
    if (!b) return;
    e.preventDefault();
    root.classList.add("is-touch");
    engine.touch = true;
    if (b.hasPointerCapture(e.pointerId)) b.releasePointerCapture(e.pointerId);
    press(b, true);
  });
  pad.querySelectorAll<HTMLElement>("[data-key]").forEach((b) => {
    listen(b, "pointerenter", (e: PointerEvent) => e.buttons && press(b, true));
    listen(b, "pointerleave", () => press(b, false));
    listen(b, "pointerup", () => press(b, false));
    listen(b, "pointercancel", () => press(b, false));
    listen(b, "contextmenu", (e: Event) => e.preventDefault());
  });
  listen(root, "pointerdown", (e: PointerEvent) => {
    if (e.pointerType !== "touch" || root.classList.contains("is-touch")) return;
    root.classList.add("is-touch");
    pad.hidden = false;
    engine.touch = true;
  });

  /* focus leaving the game, the browser window losing focus, or the tab hiding: pause */
  listen(root, "focusout", (e: FocusEvent) => {
    const to = e.relatedTarget as Node | null;
    if (!to || !root.contains(to)) {
      clearKeys();
      pause();
    }
  });
  listen(window, "blur", () => {
    clearKeys();
    pause();
  });
  listen(document, "visibilitychange", () => {
    if (document.hidden) pause();
    else invalidate();
  });

  /* ---------- frame loop ---------- */

  let raf = 0;
  let last = 0;
  let time = 0;
  let inView = true;
  let poll = 0;
  const look = opts.look === "clean" ? CLEAN : rm ? STILL : LOOK;

  const shown = () => inView && !document.hidden && root.isConnected && (typeof root.checkVisibility !== "function" || root.checkVisibility({ visibilityProperty: true }));

  function frame(now: number) {
    raf = 0;
    if (!shown()) {
      pause();
      last = 0;
      /* hidden by a parent's visibility, which no observer reports: look again shortly */
      if (inView && !document.hidden && root.isConnected) poll = window.setTimeout(invalidate, 500);
      return;
    }
    const dt = last ? Math.min(0.1, (now - last) / 1000) : 1 / 60;
    last = now;
    if (!rm) time += dt;
    if (engine.state === "playing") {
      if (soundOn() && !audio.running) audio.start();
      else if (!soundOn() && audio.running) audio.stop();
    }
    engine.frame(dt);
    crt.upload(engine.canvas);
    crt.render(look, { time, flash: engine.flash });
    if (engine.state === "over" && !overShown && engine.run.overFor > (rm ? 0.3 : 1.1)) {
      overShown = true;
      show("over", primary("over"));
    }
    if (engine.animating || (engine.state === "over" && !overShown)) raf = requestAnimationFrame(frame);
    else last = 0;
  }

  function invalidate() {
    window.clearTimeout(poll);
    if (!raf && shown()) raf = requestAnimationFrame(frame);
  }

  function syncCursor(s: GameState) {
    if (s === "playing") screen.dataset.cursor = "hide";
    else delete screen.dataset.cursor;
    root.dataset.state = s;
    bus.emit("cursor:refresh", {});
  }

  const io = new IntersectionObserver((entries) => {
    inView = entries[entries.length - 1].isIntersecting;
    if (inView) invalidate();
    else pause();
  });
  io.observe(root);

  const ro = new ResizeObserver(() => {
    const box = screen.getBoundingClientRect();
    if (box.width < 1 || box.height < 1) return;
    crt.resize(box.width, box.height);
    engine.resize(box.width / box.height);
    if (!raf) {
      /* a paused or still frame has to be redrawn at the new size */
      last = 0;
      invalidate();
    }
  });
  ro.observe(screen);

  showTitle();
  syncCursor(engine.state);
  invalidate();

  if (import.meta.env.DEV) window.__nd = { engine, state: () => engine.state, panel: () => panel };

  return () => {
    cancelAnimationFrame(raf);
    window.clearTimeout(poll);
    io.disconnect();
    ro.disconnect();
    offs.forEach((fn) => fn());
    boardToken++;
    lastRun = null;
    audio.destroy();
    crt.destroy();
    root.remove();
    if (import.meta.env.DEV && window.__nd?.engine === engine) delete window.__nd;
  };
}

/* DEV only: a harness to mount the game on any page before the OS window exists */
if (import.meta.env.DEV) {
  window.__game = (w = 800, h = 560) => {
    const host = document.createElement("div");
    host.style.cssText = `position:fixed;left:50%;top:50%;width:${w}px;height:${h}px;transform:translate(-50%,-50%);z-index:9999;display:flex`;
    document.body.append(host);
    const stop = mountGame(host);
    return () => {
      stop();
      host.remove();
    };
  };
}
