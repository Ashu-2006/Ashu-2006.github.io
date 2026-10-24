import { reducedMotion } from "../../core/motion";
import { mountKit } from "./kit";

/**
 * Shopstr behaviour. The rules are the redesign's own: weightedScore() and nextAction() from data/hooks.ts, the
 * ShippingType enum from data/types.ts, and the sats-first pricing decision. Static markup is the populated, idle
 * state; scripts add the interaction.
 */
export function mount(root: HTMLElement) {
  const stops = [mountKit(root), stickers(root), cart(root), price(root), checkout(root), reviews(root), orders(root), shipping(root), states(root)];
  return () => stops.forEach((s) => s());
}

const on = (el: Element, type: string, fn: (e: Event) => void) => {
  el.addEventListener(type, fn);
  return () => el.removeEventListener(type, fn);
};
const press = (group: Element, sel: string, active: Element) => group.querySelectorAll(sel).forEach((b) => b.setAttribute("aria-pressed", String(b === active)));
const fmt = (n: number) => Math.round(n).toLocaleString("en-US");
const pop = (el: Element) => {
  if (reducedMotion()) return;
  el.classList.remove("is-pop");
  void (el as HTMLElement).offsetWidth;
  el.classList.add("is-pop");
};

/** Tapping a sticker pops it, the same reward the app uses on add-to-cart */
function stickers(root: HTMLElement) {
  const el = root.querySelector("[data-stickers]");
  if (!el) return () => {};
  return on(el, "click", (e) => {
    const s = (e.target as HTMLElement).closest(".stk");
    if (s) pop(s);
  });
}

function cart(root: HTMLElement) {
  const el = root.querySelector<HTMLElement>("[data-ctl]");
  if (!el) return () => {};
  const badge = el.querySelector<HTMLElement>(".ctl__badge")!;
  const spark = el.querySelector<HTMLElement>(".ctl__spark")!;
  let n = 0;
  return on(el, "click", (e) => {
    if (!(e.target as HTMLElement).closest("[data-cart]")) return;
    n++;
    badge.textContent = String(n);
    el.classList.add("has-items");
    pop(badge);
    pop(spark);
  });
}

/**
 * Sats are the truth, a currency is a label. The label follows a drifting example rate until checkout starts; from
 * then on the quote is locked and the note says how far the live rate has moved without touching the price.
 */
const RATES: Record<string, { per: number; sym: string }> = { INR: { per: 0.084, sym: "₹" }, USD: { per: 0.00098, sym: "$" }, EUR: { per: 0.00091, sym: "€" } };
function price(root: HTMLElement) {
  const el = root.querySelector<HTMLElement>("[data-px]");
  if (!el) return () => {};
  const SATS = 12000;
  const fiat = el.querySelector<HTMLElement>("[data-px-fiat]")!;
  const note = el.querySelector<HTMLElement>("[data-px-note]")!;
  const go = el.querySelector<HTMLButtonElement>("[data-px-go]")!;
  let ccy = "sats";
  let drift = 1;
  let locked: number | null = null;
  const draw = () => {
    if (ccy === "sats") {
      fiat.textContent = "Shown in sats";
      return;
    }
    const r = RATES[ccy];
    const live = SATS * r.per * drift;
    const shown = locked ?? live;
    const digits = ccy === "INR" ? 0 : 2;
    fiat.textContent = `≈ ${r.sym}${shown.toFixed(digits)} ${ccy}${locked !== null ? " · quote locked" : ""}`;
    if (locked !== null) {
      const moved = ((live / locked - 1) * 100).toFixed(2);
      note.textContent = `Live rate moved ${Number(moved) >= 0 ? "+" : ""}${moved}% since checkout began. The quote held.`;
    }
  };
  const tick = window.setInterval(() => {
    drift *= 1 + (Math.random() - 0.5) * 0.004;
    draw();
  }, 700);
  const offs = [
    on(el, "click", (e) => {
      const t = e.target as HTMLElement;
      const b = t.closest<HTMLButtonElement>("[data-ccy]");
      if (b) {
        ccy = b.dataset.ccy!;
        press(el, "[data-ccy]", b);
        if (locked !== null) locked = ccy === "sats" ? null : SATS * RATES[ccy].per * drift;
        draw();
      }
      if (t.closest("[data-px-go]")) {
        if (locked === null) {
          if (ccy === "sats") {
            ccy = "INR";
            press(el, "[data-ccy]", el.querySelector('[data-ccy="INR"]')!);
          }
          locked = SATS * RATES[ccy].per * drift;
          go.textContent = "Leave checkout";
          el.classList.add("is-locked");
        } else {
          locked = null;
          go.textContent = "Start checkout";
          note.textContent = "Example rates, not live prices";
          el.classList.remove("is-locked");
        }
        draw();
      }
    }),
    () => window.clearInterval(tick),
  ];
  return () => offs.forEach((f) => f());
}

function checkout(root: HTMLElement) {
  const el = root.querySelector<HTMLElement>("[data-ck]");
  if (!el) return () => {};
  const shots = Array.from(el.querySelectorAll<HTMLElement>("[data-shot]"));
  let i = 0;
  const show = (n: number) => {
    i = (n + shots.length) % shots.length;
    shots.forEach((s, k) => s.classList.toggle("is-on", k === i));
    press(el, "[data-step]", el.querySelector(`[data-step="${i}"]`)!);
  };
  return on(el, "click", (e) => {
    const t = e.target as HTMLElement;
    const pill = t.closest<HTMLButtonElement>("[data-step]");
    if (pill) show(Number(pill.dataset.step));
    if (t.closest("[data-ck-next]")) show(i + 1);
    if (t.closest("[data-ck-back]")) show(i - 1);
  });
}

/** weightedScore(): the thumb is 50%, the other 50% splits equally across the dimensions the reviewer rated */
function reviews(root: HTMLElement) {
  const el = root.querySelector<HTMLElement>("[data-rv]");
  if (!el) return () => {};
  const score = el.querySelector<HTMLElement>("[data-rv-score]")!;
  const starsEl = el.querySelector<HTMLElement>("[data-rv-stars]")!;
  const math = el.querySelector<HTMLElement>("[data-rv-math]")!;
  const draw = () => {
    const thumb = el.querySelector('[data-thumb="yes"]')!.getAttribute("aria-pressed") === "true";
    const rated = Array.from(el.querySelectorAll<HTMLElement>("[data-dim]"))
      .map((d) => d.querySelector<HTMLElement>('[aria-pressed="true"]')?.dataset.v)
      .filter((v) => v === "yes" || v === "no");
    const each = rated.length ? 0.5 / rated.length : 0;
    const s = (thumb ? 0.5 : 0) + rated.reduce((t, v) => t + (v === "yes" ? each : 0), 0);
    const stars = s * 5;
    score.textContent = stars.toFixed(1);
    starsEl.style.setProperty("--fill", `${s * 100}%`);
    math.textContent = rated.length ? `Thumb 50% + ${rated.length} × ${(each * 100).toFixed(1)}%` : "Thumb 50% only: with nothing else rated, the other half stays empty";
  };
  draw();
  return on(el, "click", (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>("button");
    if (!b) return;
    const group = b.parentElement!;
    press(group, "button", b);
    draw();
  });
}

/** nextAction(): the seller owns confirmed, shipped, delivered; the buyer may only cancel, and only before shipping */
const FLOW = ["pending", "confirmed", "shipped", "delivered"] as const;
function orders(root: HTMLElement) {
  const el = root.querySelector<HTMLElement>("[data-od]");
  if (!el) return () => {};
  const btn = el.querySelector<HTMLButtonElement>("[data-od-act]")!;
  const note = el.querySelector<HTMLElement>("[data-od-note]")!;
  let role: "sold" | "bought" = "sold";
  let status: string = "pending";
  const action = () => {
    if (status === "delivered" || status === "cancelled") return null;
    if (role === "sold") {
      if (status === "pending") return { to: "confirmed", label: "Confirm order", tone: "ink" };
      if (status === "confirmed") return { to: "shipped", label: "Mark shipped", tone: "ink" };
      if (status === "shipped") return { to: "delivered", label: "Mark delivered", tone: "ink" };
      return null;
    }
    if (status === "pending" || status === "confirmed") return { to: "cancelled", label: "Cancel order", tone: "red" };
    return null;
  };
  const draw = () => {
    el.querySelectorAll<HTMLElement>("[data-status]").forEach((li) => {
      const k = li.dataset.status!;
      li.classList.toggle("is-now", k === status);
      li.classList.toggle("is-done", status !== "cancelled" && FLOW.indexOf(k as (typeof FLOW)[number]) > -1 && FLOW.indexOf(k as (typeof FLOW)[number]) < FLOW.indexOf(status as (typeof FLOW)[number]));
    });
    const a = action();
    btn.hidden = !a;
    if (a) {
      btn.textContent = a.label;
      btn.dataset.tone = a.tone;
    }
    note.textContent =
      status === "delivered" || status === "cancelled"
        ? "Terminal state. Nothing moves after this."
        : role === "sold"
          ? "As the seller, you move the order forward."
          : status === "shipped"
            ? "It has shipped, so the buyer can no longer cancel. Only the seller can mark it delivered."
            : "As the buyer, your only lever is cancelling, before it ships.";
  };
  draw();
  return on(el, "click", (e) => {
    const t = e.target as HTMLElement;
    const r = t.closest<HTMLButtonElement>("[data-role]");
    if (r) {
      role = r.dataset.role as "sold" | "bought";
      press(el, "[data-role]", r);
    }
    if (t.closest("[data-od-act]")) {
      const a = action();
      if (a) status = a.to;
    }
    if (t.closest("[data-od-reset]")) status = "pending";
    draw();
  });
}

/** The ShippingType enum is the fulfilment model, not a label: it decides which options checkout can offer */
const SHIP: Record<string, { desc: string; opts: [string, string][]; cost: number }> = {
  "N/A": { desc: "No shipping concept: a digital good or a service.", opts: [["Delivered digitally", "No address needed"]], cost: 0 },
  Free: { desc: "The seller ships, at no charge.", opts: [["Ship to me", "Free"]], cost: 0 },
  Pickup: { desc: "Pickup only. Shipping is impossible.", opts: [["Pick it up", "Arrange with the seller"]], cost: 0 },
  "Free/Pickup": { desc: "The buyer chooses: free shipping or pickup.", opts: [["Ship to me", "Free"], ["Pick it up", "Arrange with the seller"]], cost: 0 },
  "Added Cost": { desc: "The seller ships and charges for it.", opts: [["Ship to me", "+1,500 sats"]], cost: 1500 },
};
function shipping(root: HTMLElement) {
  const el = root.querySelector<HTMLElement>("[data-sp]");
  if (!el) return () => {};
  const desc = el.querySelector<HTMLElement>("[data-sp-desc]")!;
  const opts = el.querySelector<HTMLElement>("[data-sp-opts]")!;
  const total = el.querySelector<HTMLElement>("[data-sp-total]")!;
  const draw = (k: string) => {
    const s = SHIP[k];
    desc.textContent = s.desc;
    opts.innerHTML = s.opts.map(([a, b], i) => `<li class="${i === 0 ? "is-on" : ""}"><b>${a}</b><span>${b}</span></li>`).join("");
    total.textContent = fmt(12000 + s.cost);
  };
  draw("Added Cost");
  return on(el, "click", (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>("[data-ship]");
    if (!b) return;
    press(el, "[data-ship]", b);
    draw(b.dataset.ship!);
  });
}

function states(root: HTMLElement) {
  const el = root.querySelector<HTMLElement>("[data-st5]");
  if (!el) return () => {};
  return on(el, "click", (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>("[data-state]");
    if (!b || b === el) return;
    el.dataset.state = b.dataset.state!;
    press(el, "[data-state]", b);
  });
}
