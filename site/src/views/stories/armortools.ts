import { reducedMotion } from "../../core/motion";
import { SESSION, SHADOW, type Step } from "../../templates/stories/armortools";
import { mountKit } from "./kit";

/**
 * ArmorTools behaviour. The session port follows pages/sessions/story: one run read as chat, tree or timeline, with
 * step filters (all, problems, armor, model, tools, mcp) and jumps to the first problem or the costliest turn. The
 * policy port follows the shadow comparison: a policy in shadow is promoted only when it agrees with what is live,
 * or after its differences are reviewed.
 */
export function mount(root: HTMLElement) {
  const stops = [mountKit(root), session(root), shadow(root), themeWipe(root)];
  return () => stops.forEach((s) => s());
}

const on = (el: EventTarget, type: string, fn: (e: Event) => void) => {
  el.addEventListener(type, fn);
  return () => el.removeEventListener(type, fn);
};
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const money = (n: number) => `$${n.toFixed(4)}`;
const dur = (ms: number) => (ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`);

const ICON: Record<Step["kind"], string> = {
  model: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/></svg>`,
  tool: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14.5 5.5a4 4 0 0 0 4.9 4.9L12 17.8 6.2 12z"/><path d="M6 18l-2 2"/></svg>`,
  mcp: `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="5" width="16" height="5" rx="1.5"/><rect x="4" y="14" width="16" height="5" rx="1.5"/></svg>`,
};
const SHIELD = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z"/></svg>`;

type Filter = "all" | "problems" | "armor" | "model" | "tools" | "mcp";
const matches = (s: Step, f: Filter) =>
  f === "all" ||
  (f === "problems" && (s.fail || s.armor === "blocked")) ||
  (f === "armor" && !!s.armor) ||
  (f === "model" && s.kind === "model") ||
  (f === "tools" && s.kind === "tool") ||
  (f === "mcp" && s.kind === "mcp");
const isProblem = (s: Step) => !!s.fail || s.armor === "blocked";

function session(root: HTMLElement) {
  const el = root.querySelector<HTMLElement>("[data-sx]");
  if (!el) return () => {};
  const body = el.querySelector<HTMLElement>("[data-sx-body]")!;
  const steps = SESSION.flatMap((t, ti) => t.steps.map((s, si) => ({ s, ti, si })));
  const cost = SESSION.map((t) => t.steps.reduce((a, s) => a + (s.cost ?? 0), 0));
  const end = Math.max(...steps.map(({ s }) => s.at + s.ms / 1000));
  const st = { view: "chat", filter: "all" as Filter, open: new Set<number>(), mark: "" };

  el.querySelector<HTMLElement>("[data-sx-sum]")!.textContent =
    `${SESSION.length} turns · ${Math.round(end)}s · $${cost.reduce((a, b) => a + b, 0).toFixed(2)} est. · ${steps.filter(({ s }) => s.fail).length} failed · ${steps.filter(({ s }) => s.armor === "blocked").length} blocked`;
  (["all", "problems", "armor", "model", "tools", "mcp"] as Filter[]).forEach((f) => {
    const n = steps.filter(({ s }) => matches(s, f)).length;
    const c = el.querySelector(`[data-sx-count="${f}"]`);
    if (c && f !== "all") c.textContent = String(n);
  });

  const stepRow = (s: Step, ti: number, si: number) => {
    const cls = ["sx__step", `sx__step--${s.kind}`, isProblem(s) ? "is-problem" : "", st.mark === `${ti}-${si}` ? "is-mark" : ""].join(" ");
    const armor = s.armor ? `<span class="sx__armor sx__armor--${s.armor}">${SHIELD}${s.armor}</span>` : "";
    return `<li class="${cls}" data-step="${ti}-${si}"><span class="sx__ico">${ICON[s.kind]}</span><b>${esc(s.label)}</b><span class="sx__m">${esc(s.meta)}</span>${armor}<span class="sx__c">${s.cost ? money(s.cost) : ""}</span><span class="sx__d">${dur(s.ms)}</span></li>`;
  };

  const chat = () =>
    SESSION.map((t, ti) => {
      const list = t.steps.map((s, si) => ({ s, si })).filter(({ s }) => matches(s, st.filter));
      const limit = st.filter === "all" && !st.open.has(ti) ? 4 : list.length;
      const more = list.length - limit;
      return `<div class="sx__turn${st.mark === `t${ti}` ? " is-mark" : ""}" data-turn="${ti}">
        <p class="sx__prompt">${esc(t.prompt)}</p>
        <p class="sx__agent"><b>Codex CLI</b> · Turn ${ti + 1} · ${money(cost[ti])}</p>
        <ol class="sx__steps">${list.slice(0, limit).map(({ s, si }) => stepRow(s, ti, si)).join("") || `<li class="sx__none">No ${st.filter} steps in this turn.</li>`}</ol>
        ${more > 0 ? `<button type="button" class="sx__more" data-sx-more="${ti}" data-cursor="hide">Show ${more} more steps</button>` : ""}
        <p class="sx__reply">${esc(t.reply)}</p>
      </div>`;
    }).join("");

  const tree = () =>
    `<ol class="sx__tree">${SESSION.map((t, ti) => {
      const list = t.steps.map((s, si) => ({ s, si })).filter(({ s }) => matches(s, st.filter));
      return `<li class="${st.mark === `t${ti}` ? "is-mark" : ""}" data-turn="${ti}"><p class="sx__node"><b>Turn ${ti + 1}</b><span>${esc(t.prompt)}</span><em>${money(cost[ti])}</em></p>
        <ol>${list.map(({ s, si }) => stepRow(s, ti, si)).join("")}</ol></li>`;
    }).join("")}</ol>`;

  const timeline = () => {
    const ticks = [0, 10, 20, 30, 40, 50].map((x) => `<span style="left:${(x / end) * 100}%">${x}s</span>`).join("");
    const rows = steps
      .filter(({ s }) => matches(s, st.filter))
      .map(({ s, ti, si }) => {
        const left = (s.at / end) * 100;
        const width = Math.max(0.6, (s.ms / 1000 / end) * 100);
        return `<li class="sx__tl${isProblem(s) ? " is-problem" : ""}${st.mark === `${ti}-${si}` ? " is-mark" : ""}" data-step="${ti}-${si}"><span class="sx__tl-l">${esc(s.label)}<i>T${ti + 1}</i></span><span class="sx__tl-t"><i class="sx__bar sx__bar--${s.kind}" style="left:${left}%;width:${width}%"></i></span><span class="sx__d">${dur(s.ms)}</span></li>`;
      })
      .join("");
    return `<div class="sx__axis"><span></span><span class="sx__ticks">${ticks}</span><span></span></div><ol class="sx__tls">${rows}</ol>`;
  };

  const draw = () => {
    body.innerHTML = st.view === "chat" ? chat() : st.view === "tree" ? tree() : timeline();
    body.dataset.view = st.view;
  };
  const focus = (sel: string) => {
    const target = body.querySelector<HTMLElement>(sel);
    if (!target) return;
    body.scrollTo({ top: target.offsetTop - body.offsetTop - 12, behavior: reducedMotion() ? "auto" : "smooth" });
  };

  draw();
  return on(el, "click", (e) => {
    const t = e.target as HTMLElement;
    const v = t.closest<HTMLElement>("[data-sx-view]");
    if (v) {
      st.view = v.dataset.sxView!;
      el.querySelectorAll("[data-sx-view]").forEach((b) => b.setAttribute("aria-selected", String(b === v)));
      draw();
    }
    const f = t.closest<HTMLElement>("[data-sx-filter]");
    if (f) {
      st.filter = f.dataset.sxFilter as Filter;
      el.querySelectorAll("[data-sx-filter]").forEach((b) => b.setAttribute("aria-pressed", String(b === f)));
      draw();
    }
    const m = t.closest<HTMLElement>("[data-sx-more]");
    if (m) {
      st.open.add(Number(m.dataset.sxMore));
      draw();
    }
    const j = t.closest<HTMLElement>("[data-sx-jump]")?.dataset.sxJump;
    if (j === "problem") {
      const first = steps.find(({ s }) => isProblem(s))!;
      st.mark = `${first.ti}-${first.si}`;
      st.open.add(first.ti);
      draw();
      focus(`[data-step="${st.mark}"]`);
    } else if (j === "cost") {
      const ti = cost.indexOf(Math.max(...cost));
      st.mark = `t${ti}`;
      if (st.view === "timeline") {
        st.view = "chat";
        el.querySelectorAll("[data-sx-view]").forEach((b) => b.setAttribute("aria-selected", String((b as HTMLElement).dataset.sxView === "chat")));
      }
      draw();
      focus(`[data-turn="${ti}"]`);
    }
  });
}

/* Shadow comparison: promote only a policy that agrees with what is live, or after its differences are reviewed */
function shadow(root: HTMLElement) {
  const el = root.querySelector<HTMLElement>("[data-pol-root]");
  if (!el) return () => {};
  const card = el.querySelector<HTMLElement>("[data-pol-card]")!;
  type Key = keyof typeof SHADOW;
  const state: Record<string, { status: "shadow" | "active"; reviewed: boolean }> = Object.fromEntries(Object.keys(SHADOW).map((k) => [k, { status: "shadow", reviewed: false }]));
  let key: Key = "claims-strict";
  const verb = (a: string) => (a === "allow" ? "allowed" : a === "hold" ? "held" : "blocked");
  const draw = () => {
    const d = SHADOW[key];
    const s = state[key];
    const pct = (n: number) => `${(n / d.total) * 100}%`;
    const canPromote = s.status === "shadow" && (!d.diverges || s.reviewed);
    card.innerHTML = `<p class="pol__top"><b>${key}</b><span class="at-chip ${s.status === "active" ? "at-chip--ok" : "at-chip--warn"}">${s.status === "active" ? "Active" : "Shadow"}</span></p>
      <p class="pol__sub">Last 7 days · ${d.total} calls observed</p>
      <div class="pol__bar" role="img" aria-label="Would allow ${d.allow}, hold ${d.hold}, block ${d.block}"><i class="pol__a" style="width:${pct(d.allow)}"></i><i class="pol__h" style="width:${pct(d.hold)}"></i><i class="pol__b" style="width:${pct(d.block)}"></i></div>
      <p class="pol__legend"><span><i class="pol__a"></i>Would allow ${d.allow}</span><span><i class="pol__h"></i>Hold ${d.hold}</span><span><i class="pol__b"></i>Block ${d.block}</span></p>
      <p class="pol__match${d.diverges ? " is-warn" : ""}">Agrees with the live decision on ${d.match}% of calls.</p>
      <ul class="pol__diffs">${d.diffs.map(([tool, now, would, n]) => `<li><code>${tool}</code><span>${verb(now)} today → would be ${verb(would)}</span><b>${n} calls</b></li>`).join("")}</ul>
      <div class="pol__acts">${
        s.status === "active"
          ? `<p class="pol__done">Enforcing since just now.</p><button type="button" class="at-btn at-btn--ghost" data-pol-act="demote" data-cursor="hide">Back to shadow</button>`
          : `${d.diverges && !s.reviewed ? `<button type="button" class="at-btn at-btn--ghost" data-pol-act="review" data-cursor="hide">Review ${d.diffs.reduce((a, x) => a + (x[3] as number), 0)} differences</button>` : ""}<button type="button" class="at-btn at-btn--accent" data-pol-act="promote" ${canPromote ? "" : "disabled"} data-cursor="hide">Promote to active</button>`
      }</div>
      ${d.diverges && !s.reviewed && s.status === "shadow" ? `<p class="pol__why">It disagrees with what is live on ${100 - d.match}% of calls. Review those before it can block anything.</p>` : ""}`;
  };
  draw();
  return on(el, "click", (e) => {
    const t = e.target as HTMLElement;
    const tab = t.closest<HTMLElement>("[data-pol]");
    if (tab) {
      key = tab.dataset.pol as Key;
      el.querySelectorAll("[data-pol]").forEach((b) => b.setAttribute("aria-selected", String(b === tab)));
    }
    const act = t.closest<HTMLButtonElement>("[data-pol-act]")?.dataset.polAct;
    if (act === "review") state[key].reviewed = true;
    if (act === "promote") state[key].status = "active";
    if (act === "demote") state[key].status = "shadow";
    draw();
  });
}

/* Dark and light of one screen, revealed by a range input */
function themeWipe(root: HTMLElement) {
  const el = root.querySelector<HTMLElement>("[data-tw]");
  if (!el) return () => {};
  const range = el.querySelector<HTMLInputElement>("[data-tw-range]")!;
  return on(range, "input", () => el.style.setProperty("--x", `${range.value}%`));
}
