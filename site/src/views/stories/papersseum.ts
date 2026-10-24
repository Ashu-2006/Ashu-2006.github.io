import { reducedMotion } from "../../core/motion";
import { PARTS, PART_COUNTS, PART_NAMES, PLAYER_COLORS, characterSvg, genomeFromSeed, type BotGenome, type CharacterState } from "../../lib/papersseum/character";
import { animateBot } from "../../lib/papersseum/motion";
import { applyFrame, clock, colorTable, coverage, decodeReplay, headsAt, keyMoments, paint, type Replay } from "../../lib/papersseum/replay";
import { mountKit } from "./kit";

/**
 * Papersseum behaviour: the Bot Forge, the 60-seed grid, the arena replay with riders and key moments, and the cell
 * wipe. Everything renders as correct static markup first; scripts add motion, picking and playback.
 */
export function mount(root: HTMLElement) {
  const stops = [mountKit(root), forge(root), grid(root), arena(root), wipe(root)];
  return () => stops.forEach((s) => s());
}

/** Swaps an svg's markup for a new character and restarts its motion. Returns the new cleanup. */
function draw(host: HTMLElement, g: BotGenome, o: { state: CharacterState; seed: string; lookAt?: boolean; label?: string; cls?: string }) {
  host.innerHTML = characterSvg(g, { state: o.state, seed: o.seed, label: o.label, cls: o.cls });
  const svg = host.querySelector("svg")!;
  return animateBot(svg, o);
}

/* ------------------------------------------------------------------ forge */

let forgeLoad: ((seed: string) => void) | null = null;

function forge(root: HTMLElement) {
  const el = root.querySelector<HTMLElement>("[data-forge]");
  if (!el) return () => {};
  const stage = el.querySelector<HTMLElement>(".forge__stage")!;
  const name = el.querySelector<HTMLInputElement>("[data-forge-name]")!;
  let g = genomeFromSeed(name.value);
  let state: CharacterState = "idle";
  let stop = () => {};
  const render = () => {
    stop();
    stop = draw(stage, g, { state, seed: name.value || "bot", lookAt: true, label: `${name.value || "Your bot"}'s character`, cls: "forge__bot" });
    PARTS.forEach((p) => {
      const out = el.querySelector<HTMLOutputElement>(`[data-part="${p}"] output`);
      if (out) out.textContent = PART_NAMES[p][g[p]];
    });
  };
  const onInput = () => {
    g = genomeFromSeed(name.value || "bot");
    render();
  };
  const onClick = (e: Event) => {
    const t = e.target as HTMLElement;
    const step = t.closest<HTMLButtonElement>("[data-step]");
    if (step) {
      const p = step.closest<HTMLElement>("[data-part]")!.dataset.part as keyof BotGenome;
      g = { ...g, [p]: (g[p] + Number(step.dataset.step) + PART_COUNTS[p]) % PART_COUNTS[p] };
      render();
    }
    const st = t.closest<HTMLButtonElement>("[data-state]");
    if (st) {
      state = st.dataset.state as CharacterState;
      el.querySelectorAll("[data-state]").forEach((b) => b.setAttribute("aria-pressed", String(b === st)));
      render();
    }
  };
  name.addEventListener("input", onInput);
  el.addEventListener("click", onClick);
  forgeLoad = (seed) => {
    name.value = seed;
    onInput();
  };
  render();
  return () => {
    stop();
    forgeLoad = null;
    name.removeEventListener("input", onInput);
    el.removeEventListener("click", onClick);
  };
}

/* ------------------------------------------------------------------- grid */

/** Sixty idle characters, each on its own seeded clock. Hovering one makes it win; clicking loads it into the forge. */
function grid(root: HTMLElement) {
  const el = root.querySelector<HTMLElement>("[data-grid60]");
  if (!el) return () => {};
  const stops = new Map<HTMLElement, () => void>();
  const start = (cell: HTMLElement, state: CharacterState) => {
    stops.get(cell)?.();
    const seed = cell.dataset.seed!;
    stops.set(cell, draw(cell, genomeFromSeed(seed), { state, seed }));
  };
  const cells = Array.from(el.querySelectorAll<HTMLElement>(".g60__cell"));
  /* Idle motion only while the grid is on screen: sixty loops cost nothing when nobody can see them */
  const io = new IntersectionObserver(([e]) => {
    if (e.isIntersecting) cells.forEach((c) => start(c, "idle"));
    else stops.forEach((s) => s());
  });
  io.observe(el);
  /* Win once per entry: pointerover bubbles from every pixel rect, so re-rendering on each would restart the hop */
  let hovered: HTMLElement | null = null;
  const onOver = (e: PointerEvent) => {
    const cell = (e.target as HTMLElement).closest<HTMLElement>(".g60__cell");
    if (cell === hovered) return;
    hovered = cell;
    if (cell && !reducedMotion()) start(cell, "win");
  };
  const onClick = (e: Event) => {
    const cell = (e.target as HTMLElement).closest<HTMLElement>(".g60__cell");
    if (cell) forgeLoad?.(cell.dataset.seed!);
  };
  el.addEventListener("pointerover", onOver);
  el.addEventListener("click", onClick);
  return () => {
    io.disconnect();
    stops.forEach((s) => s());
    el.removeEventListener("pointerover", onOver);
    el.removeEventListener("click", onClick);
  };
}

/* ------------------------------------------------------------------ arena */

const STEP_MS = 100; /* 10 decisions a second: real match speed */
const HOLD_MS = 3000;
const SEEK_LEAD = 20; /* a key-moment click lands two seconds before it */
const MARK = { death: "✕", capture: "■", lead: "▲" } as const;

/**
 * Replays one real match: the canvas paints cells from a colour table, characters ride the snake heads, a ring marks
 * a knockout, the HUD shows the leader and a stacked coverage bar, and the timeline carries the key moments.
 * Shows the static board without JavaScript, without DecompressionStream, or under reduced motion until played.
 */
function arena(root: HTMLElement) {
  const el = root.querySelector<HTMLElement>("[data-arena]");
  if (!el || typeof DecompressionStream === "undefined") return () => {};
  const canvas = el.querySelector<HTMLCanvasElement>(".arena__canvas")!;
  const still = el.querySelector<HTMLImageElement>(".arena__still")!;
  const ridersEl = el.querySelector<HTMLElement>(".arena__riders")!;
  const scrub = el.querySelector<HTMLInputElement>(".arena__scrub")!;
  const marksEl = el.querySelector<HTMLElement>(".arena__marks")!;
  const clockEl = el.querySelector<HTMLElement>(".arena__clock")!;
  const leadEl = el.querySelector<HTMLElement>(".arena__lead")!;
  const faceEl = el.querySelector<HTMLElement>(".arena__face")!;
  const stackEl = el.querySelector<HTMLElement>(".arena__stack")!;
  const playBtn = el.querySelector<HTMLButtonElement>("[data-play]")!;
  const seats: string[] = JSON.parse(el.dataset.seats ?? "[]");
  const ctrl = new AbortController();
  let raf = 0;
  let dead = false;
  const offs: (() => void)[] = [];

  fetch(el.dataset.src!, { signal: ctrl.signal })
    .then((res) => new Response(res.body!.pipeThrough(new DecompressionStream("gzip"))).arrayBuffer())
    .then((buf) => {
      if (dead) return;
      const r: Replay = decodeReplay(new Uint8Array(buf));
      const ctx = canvas.getContext("2d")!;
      canvas.width = r.width;
      canvas.height = r.height;
      const image = ctx.createImageData(r.width, r.height);
      const table = colorTable(getComputedStyle(el).getPropertyValue("--pp-ground").trim() || "#efefec");
      const cells = r.initial.slice();
      let frame = 0;
      let speed = 1;
      let playing = !reducedMotion();
      let last = performance.now();
      let holdUntil = 0;
      scrub.max = String(r.frames - 1);

      /* Riders: one character per seat, kept as elements and moved, never rebuilt per frame */
      const riders = seats.map((seed, slot) => {
        const d = document.createElement("div");
        d.className = "arena__rider";
        d.innerHTML = characterSvg(genomeFromSeed(seed), { accent: PLAYER_COLORS[slot], seed });
        ridersEl.append(d);
        offs.push(animateBot(d.querySelector("svg")!, { state: "idle", seed }));
        return d;
      });
      let prevHeads = headsAt(r, 0);
      const ring = (slot: number, h: [number, number]) => {
        if (reducedMotion()) return;
        const d = document.createElement("span");
        d.className = "arena__ring";
        d.style.cssText = `left: ${((h[1] + 0.5) / r.width) * 100}%; top: ${((h[0] + 0.5) / r.height) * 100}%; --c: ${PLAYER_COLORS[slot]}`;
        ridersEl.append(d);
        d.addEventListener("animationend", () => d.remove());
      };

      /* Key moments as marks on the timeline; a click seeks to two seconds before */
      const moments = keyMoments(r);
      marksEl.innerHTML = moments
        .map((m) => `<button type="button" class="arena__mark arena__mark--${m.kind}" style="left: ${(m.frame / (r.frames - 1)) * 100}%; --c: ${PLAYER_COLORS[m.slot]}" data-frame="${m.frame}" data-cursor="hide" aria-label="${m.kind === "death" ? "Knockout" : m.kind === "capture" ? "Big capture" : "Lead change"} at ${clock(m.frame)}, ${seats[m.slot]?.replace(/^house_/, "")}">${MARK[m.kind]}</button>`)
        .join("");

      const render = (fresh = false) => {
        paint(image.data, cells, table);
        ctx.putImageData(image, 0, 0);
        const heads = headsAt(r, frame);
        heads.forEach((h, slot) => {
          const d = riders[slot];
          if (!d) return;
          d.hidden = !h;
          if (h) d.style.transform = `translate(${((h[1] + 0.5) / r.width) * 100}cqw, ${((h[0] + 0.5) / r.height) * 100}cqh) translate(-50%, -85%)`;
          if (!fresh && prevHeads[slot] && !h) ring(slot, prevHeads[slot]!);
        });
        prevHeads = heads;
        const cov = coverage(cells, r.players);
        const lead = cov.reduce((b, c, i) => (c > cov[b] ? i : b), 0);
        leadEl.textContent = `${seats[lead]?.replace(/^house_/, "") ?? ""} ${(cov[lead] * 100).toFixed(1)}%`;
        if (faceEl.dataset.slot !== String(lead)) {
          faceEl.dataset.slot = String(lead);
          faceEl.innerHTML = characterSvg(genomeFromSeed(seats[lead] ?? ""), { accent: PLAYER_COLORS[lead], state: "still" });
        }
        stackEl.innerHTML = cov.map((c, i) => `<span style="width: ${c * 100}%; background: ${PLAYER_COLORS[i]}"></span>`).join("");
        scrub.value = String(frame);
        clockEl.textContent = `${clock(frame)} / ${clock(r.frames - 1)}`;
      };
      const seek = (to: number) => {
        to = Math.max(0, Math.min(r.frames - 1, to));
        if (to < frame) {
          cells.set(r.initial);
          frame = 0;
        }
        while (frame < to) applyFrame(cells, r, ++frame);
        holdUntil = 0;
        last = performance.now();
        render(true);
      };
      const setPlaying = (on: boolean) => {
        playing = on;
        playBtn.setAttribute("aria-pressed", String(on));
        playBtn.querySelectorAll(".ppbtn__row").forEach((row) => (row.innerHTML = Array.from(on ? "Pause" : "Play").map((c, i) => `<span class="ppbtn__char" style="--i: ${i}">${c}</span>`).join("")));
        playBtn.querySelector(".sr-only")!.textContent = on ? "Pause" : "Play";
        last = performance.now();
      };
      const tick = (now: number) => {
        raf = requestAnimationFrame(tick);
        if (!playing) return;
        if (holdUntil) {
          if (now >= holdUntil) seek(0);
          return;
        }
        let steps = 0;
        while (now - last >= STEP_MS / speed && frame < r.frames - 1 && steps < 8) {
          applyFrame(cells, r, ++frame);
          last += STEP_MS / speed;
          steps++;
        }
        if (steps === 8) last = now;
        if (steps) render();
        if (frame === r.frames - 1) holdUntil = now + HOLD_MS;
      };

      const onScrub = () => seek(Number(scrub.value));
      const onMark = (e: Event) => {
        const m = (e.target as HTMLElement).closest<HTMLButtonElement>(".arena__mark");
        if (m) seek(Number(m.dataset.frame) - SEEK_LEAD);
      };
      const onSpeed = (e: Event) => {
        const b = (e.target as HTMLElement).closest<HTMLButtonElement>("[data-speed]");
        if (!b) return;
        speed = Number(b.dataset.speed);
        el.querySelectorAll("[data-speed]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
      };
      const onPlay = () => setPlaying(!playing);
      scrub.addEventListener("input", onScrub);
      marksEl.addEventListener("click", onMark);
      el.addEventListener("click", onSpeed);
      playBtn.addEventListener("click", onPlay);
      offs.push(() => {
        scrub.removeEventListener("input", onScrub);
        marksEl.removeEventListener("click", onMark);
        el.removeEventListener("click", onSpeed);
        playBtn.removeEventListener("click", onPlay);
      });

      /* Plays only while on screen and the tab is visible */
      const io = new IntersectionObserver(([e]) => {
        cancelAnimationFrame(raf);
        if (e.isIntersecting) {
          last = performance.now();
          raf = requestAnimationFrame(tick);
        }
      });
      io.observe(el);
      offs.push(() => io.disconnect());

      still.hidden = true;
      canvas.hidden = false;
      el.classList.add("is-ready");
      setPlaying(playing);
      render(true);
    })
    .catch(() => {
      /* Keep the static board */
    });

  return () => {
    dead = true;
    ctrl.abort();
    cancelAnimationFrame(raf);
    offs.forEach((f) => f());
  };
}

/* ------------------------------------------------------------------- wipe */

/** The route transition: the next page opens from the centre of each of nine cells while the old one recedes */
function wipe(root: HTMLElement) {
  const el = root.querySelector<HTMLElement>("[data-wipe]");
  if (!el) return () => {};
  const btn = el.querySelector<HTMLButtonElement>("[data-wipe-go]")!;
  const label = (t: string) => {
    btn.querySelectorAll(".ppbtn__row").forEach((row) => (row.innerHTML = Array.from(t).map((c, i) => `<span class="ppbtn__char" style="--i: ${i}">${c === " " ? "&nbsp;" : c}</span>`).join("")));
    btn.querySelector(".sr-only")!.textContent = t;
  };
  const onClick = () => {
    const toB = !el.classList.contains("is-b");
    el.classList.remove("is-run");
    void el.offsetWidth;
    el.classList.toggle("is-b", toB);
    el.classList.add("is-run");
    label(toB ? "Back to Leaderboard" : "Go to Matches");
  };
  btn.addEventListener("click", onClick);
  return () => btn.removeEventListener("click", onClick);
}
