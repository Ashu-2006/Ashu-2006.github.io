import { reducedMotion } from "../../core/motion";
import { LENS_RAIL, PERSONAS, TOOLS } from "../../templates/stories/armoriq-platform";
import { mountKit } from "./kit";

/**
 * ArmorIQ platform behaviour. Ports of the shipped rules: the policy lenses project one draft (editor-state.ts), the
 * persona lens reorders the rail without removing anything (roleviews/state.tsx), and the kill switch commits on a
 * held press that cancels on release, window blur or a hidden tab (shared/ui/AgentKillSwitch).
 */
export function mount(root: HTMLElement) {
  const stops = [mountKit(root), doors(root), lens(root), persona(root), killSwitch(root)];
  return () => stops.forEach((s) => s());
}

const on = <K extends keyof HTMLElementEventMap>(el: EventTarget, type: K | string, fn: (e: Event) => void, opts?: AddEventListenerOptions) => {
  el.addEventListener(type, fn, opts);
  return () => el.removeEventListener(type, fn, opts);
};
const all = (fns: (() => void)[]) => () => fns.forEach((f) => f());

/* v1 doors light up the v2 input they became */
function doors(root: HTMLElement) {
  const el = root.querySelector<HTMLElement>("[data-doors]");
  if (!el) return () => {};
  const note = el.querySelector<HTMLElement>("[data-doors-note]")!;
  const idle = note.textContent ?? "";
  const show = (b: HTMLElement | null) => {
    const to = b?.dataset.door ?? "";
    el.querySelectorAll<HTMLElement>("[data-door]").forEach((d) => d.classList.toggle("is-on", d === b));
    el.querySelectorAll<HTMLElement>("[data-in]").forEach((i) => {
      i.classList.toggle("is-on", i.dataset.in === to);
      i.classList.toggle("is-next", to === "next" && i.dataset.in === "template");
    });
    note.textContent = b ? (b.dataset.note ?? "") : idle;
  };
  const pick = (e: Event) => show((e.target as HTMLElement).closest<HTMLElement>("[data-door]"));
  return all([on(el, "pointerover", pick), on(el, "focusin", pick), on(el, "click", pick), on(el.querySelector(".doors__list")!, "pointerleave", (e) => (e as PointerEvent).pointerType === "mouse" && show(null))]);
}

/* One draft, three projections. The YAML lens parses as you type and only rewrites its text when the draft changed elsewhere. */
type Act = "allow" | "hold" | "block";
const ACTS: Act[] = ["allow", "hold", "block"];
function buildYaml(tools: Map<string, Act>) {
  const rules = [...tools].map(([t, a]) => `        ${t}: ${a}`).join("\n");
  return `apiVersion: armor.io/v1
kind: Policy
metadata:
  name: claims-triage-guardrails
  targetType: agent
  targetId: claims-triage-bot
spec:
  priority: 10
  defaultEnforcementAction: block
  clientRules:
    "*":
      toolEnforcement:
${rules}
`;
}

function lens(root: HTMLElement) {
  const el = root.querySelector<HTMLElement>("[data-lens]");
  if (!el) return () => {};
  const tools = new Map<string, Act>(TOOLS);
  const yaml = el.querySelector<HTMLTextAreaElement>("[data-yaml]")!;
  const hint = el.querySelector<HTMLElement>("[data-yaml-hint]")!;
  const idleHint = hint.textContent ?? "";
  const svg = el.querySelector<SVGSVGElement>("[data-canvas]")!;
  const chip = el.querySelector<HTMLElement>("[data-lens-status]")!;
  const ack = el.querySelector<HTMLInputElement>("[data-ack]")!;
  const activate = el.querySelector<HTMLButtonElement>("[data-activate]")!;
  let projected = "";
  let changed = "";

  const status = (s: "draft" | "saved" | "active") => {
    chip.textContent = s === "draft" ? "Draft" : s === "saved" ? "Saved · not enforcing" : "Active · enforcing";
    chip.className = `aq-chip${s === "active" ? " aq-chip--good" : ""}`;
  };
  const drawForm = () =>
    el.querySelectorAll<HTMLElement>("[data-tool]").forEach((row) => {
      const a = tools.get(row.dataset.tool!);
      row.querySelectorAll<HTMLButtonElement>("[data-act]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.act === a)));
      row.classList.toggle("is-changed", row.dataset.tool === changed);
    });
  const drawYaml = () => {
    const next = buildYaml(tools);
    if (next !== projected) {
      projected = next;
      yaml.value = next;
    }
  };
  const drawCanvas = () => {
    const list = [...tools];
    const step = 300 / list.length;
    const ax = 120;
    const ay = 150;
    svg.innerHTML =
      list
        .map(([, a], i) => {
          const y = step * i + step / 2;
          return `<path class="cv__edge cv__edge--${a}" d="M${ax + 62} ${ay} C ${ax + 180} ${ay}, ${380} ${y}, ${430} ${y}"/>`;
        })
        .join("") +
      `<g class="cv__agent"><rect x="${ax - 62}" y="${ay - 24}" width="124" height="48" rx="12"/><text x="${ax}" y="${ay + 5}" text-anchor="middle">claims-triage-bot</text></g>` +
      list
        .map(([t, a], i) => {
          const y = step * i + step / 2;
          return `<g class="cv__tool cv__tool--${a}${t === changed ? " is-changed" : ""}" data-cv="${t}" tabindex="0" role="button" aria-label="${t}: ${a}. Activate to change"><rect x="430" y="${y - 19}" width="190" height="38" rx="10"/><circle cx="450" cy="${y}" r="5"/><text x="464" y="${y + 4}">${t}</text><text class="cv__act" x="606" y="${y + 4}" text-anchor="end">${a}</text></g>`;
        })
        .join("");
  };
  const set = (t: string, a: Act, from: "form" | "yaml" | "canvas") => {
    if (tools.get(t) === a) return;
    tools.set(t, a);
    changed = t;
    status("draft");
    drawForm();
    drawCanvas();
    if (from !== "yaml") drawYaml();
    else projected = buildYaml(tools);
  };
  const parse = () => {
    const bad: string[] = [];
    yaml.value.split("\n").forEach((line, i) => {
      const m = line.match(/^\s+([a-z_]+):\s*(\S*)\s*$/);
      if (!m || !tools.has(m[1])) return;
      const v = m[2] as Act;
      if (ACTS.includes(v)) set(m[1], v, "yaml");
      else bad.push(`Line ${i + 1}: "${m[2]}" is not allow, hold or block. The draft keeps ${tools.get(m[1])}.`);
    });
    hint.textContent = bad[0] ?? idleHint;
    hint.classList.toggle("is-bad", bad.length > 0);
  };
  const show = (to: string) => {
    el.querySelectorAll<HTMLElement>("[data-view]").forEach((v) => v.classList.toggle("is-on", v.dataset.view === to));
    el.querySelectorAll<HTMLElement>("[data-lens-to]").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.lensTo === to)));
  };
  const cycle = (t: string) => set(t, ACTS[(ACTS.indexOf(tools.get(t)!) + 1) % 3], "canvas");

  drawForm();
  drawYaml();
  drawCanvas();
  return all([
    on(el, "click", (e) => {
      const t = e.target as HTMLElement;
      const tab = t.closest<HTMLElement>("[data-lens-to]");
      if (tab) show(tab.dataset.lensTo!);
      const act = t.closest<HTMLElement>("[data-act]");
      if (act) set(act.closest<HTMLElement>("[data-tool]")!.dataset.tool!, act.dataset.act as Act, "form");
      const node = t.closest<SVGGElement>("[data-cv]");
      if (node) cycle(node.dataset.cv!);
      if (t.closest("[data-save]")) status("saved");
      if (t.closest("[data-activate]") && ack.checked) {
        status("active");
        ack.checked = false;
        activate.disabled = true;
      }
    }),
    on(el, "keydown", (e) => {
      const k = e as KeyboardEvent;
      const node = (k.target as HTMLElement).closest<SVGGElement>("[data-cv]");
      if (node && (k.key === "Enter" || k.key === " ")) {
        k.preventDefault();
        cycle(node.dataset.cv!);
        svg.querySelector<SVGGElement>(`[data-cv="${node.dataset.cv}"]`)?.focus();
      }
    }),
    on(yaml, "input", parse),
    on(ack, "change", () => (activate.disabled = !ack.checked)),
  ]);
}

/* The persona lens: question, scope and density change; the rail reorders with a FLIP so each item visibly travels */
function persona(root: HTMLElement) {
  const el = root.querySelector<HTMLElement>("[data-pl]");
  if (!el) return () => {};
  const rail = el.querySelector<HTMLElement>("[data-pl-rail]")!;
  const items = new Map([...rail.querySelectorAll<HTMLElement>("[data-rail]")].map((li) => [li.dataset.rail!, li]));
  const line = document.createElement("li");
  line.className = "plens__line";
  line.setAttribute("role", "separator");
  const field = (k: string) => el.querySelector<HTMLElement>(`[data-pl-${k}]`)!;
  const LENS = { security: "Security", ai: "AI", grc: "GRC" } as const;

  const apply = (key: string, animate: boolean) => {
    const p = PERSONAS.find((x) => x.key === key)!;
    const order = LENS_RAIL[p.lens];
    const before = new Map([...items].map(([k, li]) => [k, li.getBoundingClientRect().top]));
    rail.replaceChildren(...order.primary.map((k) => items.get(k)!), line, ...order.secondary.map((k) => items.get(k)!));
    items.forEach((li, k) => li.classList.toggle("is-primary", (order.primary as readonly string[]).includes(k)));
    field("q").textContent = p.q;
    field("lens").textContent = LENS[p.lens];
    field("scope").textContent = p.scope;
    field("density").textContent = p.density;
    field("land").textContent = items.get(order.primary[0])!.textContent!.replace(/\d+$/, "");
    el.querySelectorAll<HTMLElement>("[data-persona]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.persona === key)));
    if (!animate || reducedMotion()) return;
    items.forEach((li, k) => {
      const dy = before.get(k)! - li.getBoundingClientRect().top;
      if (!dy) return;
      li.animate([{ transform: `translateY(${dy}px)` }, { transform: "none" }], { duration: 420, easing: "cubic-bezier(0.16, 1, 0.3, 1)" });
    });
  };
  apply("analyst", false);
  return on(el, "click", (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>("[data-persona]");
    if (b) apply(b.dataset.persona!, true);
  });
}

/* Hold to kill: 1.5 s, or 1.75x for until lifted. Release, blur or a hidden tab cancels an in-flight hold. */
const HOLD_MS = 1500;
const INDEFINITE_HOLD_MS = Math.round(HOLD_MS * 1.75);
function killSwitch(root: HTMLElement) {
  const el = root.querySelector<HTMLElement>("[data-ks]");
  if (!el) return () => {};
  const q = <T extends HTMLElement>(s: string) => el.querySelector<T>(s)!;
  const pop = q("[data-ks-pop]");
  const open = q<HTMLButtonElement>("[data-ks-open]");
  const hold = q<HTMLButtonElement>("[data-ks-hold]");
  const fill = q("[data-ks-fill]");
  const label = q("[data-ks-label]");
  const banner = q("[data-ks-banner]");
  const left = q("[data-ks-left]");
  const chip = q("[data-ks-chip]");
  let dur = "300";
  let raf = 0;
  let t0 = 0;
  let tick = 0;
  let until = 0;

  const verb = () => (dur === "inf" ? "Hold to kill until lifted" : `Hold to kill for ${el.querySelector(`[data-dur="${dur}"]`)!.textContent}`);
  const setOpen = (v: boolean) => {
    pop.hidden = !v;
    open.setAttribute("aria-expanded", String(v));
  };
  const reset = () => {
    cancelAnimationFrame(raf);
    raf = 0;
    fill.style.transition = reducedMotion() ? "none" : "";
    fill.style.transform = "scaleX(0)";
    label.textContent = verb();
  };
  const fmt = (ms: number) => {
    const s = Math.max(0, Math.ceil(ms / 1000));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  };
  const killed = () => {
    setOpen(false);
    reset();
    banner.hidden = false;
    chip.textContent = "Killed";
    chip.className = "aq-chip aq-chip--bad";
    open.disabled = true;
    if (dur === "inf") left.textContent = " · until lifted";
    else {
      until = Date.now() + Number(dur) * 1000;
      const draw = () => {
        left.textContent = ` · lifts in ${fmt(until - Date.now())}`;
        if (until - Date.now() <= 0) lift();
      };
      draw();
      tick = window.setInterval(draw, 1000);
    }
  };
  const lift = () => {
    window.clearInterval(tick);
    banner.hidden = true;
    chip.textContent = "Verified";
    chip.className = "aq-chip aq-chip--good";
    open.disabled = false;
  };
  const start = () => {
    if (raf || pop.hidden) return;
    const need = dur === "inf" ? INDEFINITE_HOLD_MS : HOLD_MS;
    t0 = performance.now();
    fill.style.transition = "none";
    label.textContent = "Keep holding…";
    const step = (now: number) => {
      const p = Math.min(1, (now - t0) / need);
      fill.style.transform = `scaleX(${p})`;
      if (p >= 1) {
        raf = 0;
        label.textContent = "Killing…";
        window.setTimeout(killed, 260);
        return;
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
  };
  const cancel = () => {
    if (raf) reset();
  };
  const vis = () => document.visibilityState === "hidden" && cancel();

  reset();
  return all([
    on(open, "click", () => setOpen(pop.hidden)),
    on(pop, "click", (e) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>("[data-dur]");
      if (!b) return;
      dur = b.dataset.dur!;
      pop.querySelectorAll("[data-dur]").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
      reset();
    }),
    on(hold, "pointerdown", (e) => {
      (e as PointerEvent).preventDefault();
      hold.setPointerCapture((e as PointerEvent).pointerId);
      start();
    }),
    on(hold, "pointerup", cancel),
    on(hold, "pointercancel", cancel),
    on(hold, "lostpointercapture", cancel),
    on(hold, "keydown", (e) => {
      const k = e as KeyboardEvent;
      if ((k.key === " " || k.key === "Enter") && !k.repeat) {
        k.preventDefault();
        start();
      }
    }),
    on(hold, "keyup", (e) => {
      const k = e as KeyboardEvent;
      if (k.key === " " || k.key === "Enter") cancel();
    }),
    on(hold, "blur", cancel),
    on(el, "keydown", (e) => {
      if ((e as KeyboardEvent).key === "Escape" && !pop.hidden) {
        cancel();
        setOpen(false);
        open.focus();
      }
    }),
    on(q("[data-ks-lift]"), "click", lift),
    on(window, "blur", cancel),
    on(document, "visibilitychange", vis),
    () => {
      window.clearInterval(tick);
      cancelAnimationFrame(raf);
    },
  ]);
}
