import STRINGS from "../../lib/navu/strings.json";
import { reducedMotion } from "../../core/motion";
import { CHAIN } from "../../templates/stories/navu-kavacha";
import { mountKit } from "./kit";

/**
 * Navu Kavacha behaviour. Rules from shared/domain/policy.ts: pay by bin size (45, 60, 90), estimated kilos
 * (7, 14, 25), a 20 rupee wait fee once the wait reaches 10 minutes, and full pay for a flagged or left-behind bin.
 * Strings are the app's own, in English, Kannada and Tamil.
 */
export function mount(root: HTMLElement) {
  const stops = [mountKit(root), chain(root), handover(root), wait(root)];
  return () => stops.forEach((s) => s());
}

type Lang = "en" | "kn" | "ta";
type Bin = "small" | "medium" | "large";
type Cond = "clean" | "mixed" | "unsafe";
const S = STRINGS as Record<Lang, Record<string, string>>;
const t = (lang: Lang, key: string, vars: Record<string, string | number> = {}) =>
  (S[lang][key] ?? S.en[key] ?? key).replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? `{${k}}`));
const PAY: Record<Bin, number> = { small: 45, medium: 60, large: 90 };
const KG: Record<Bin, number> = { small: 7, medium: 14, large: 25 };
const WAIT_FEE = 20;
const WAIT_THRESHOLD_MIN = 10;
const rs = (n: number) => `₹${n}`;
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const on = (el: EventTarget, type: string, fn: (e: Event) => void) => {
  el.addEventListener(type, fn);
  return () => el.removeEventListener(type, fn);
};

const SVG = {
  leaf: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 19c0-8 5-13 14-14-1 9-6 14-14 14Z"/><path d="M5 19 13 11"/></svg>`,
  box: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8l8-4 8 4v8l-8 4-8-4z"/><path d="M4 8l8 4 8-4M12 12v8"/></svg>`,
  check: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>`,
  mixed: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h4l8 10h4M4 17h4l2.5-3M14 10l2-3h4M17 4l3 3-3 3M17 14l3 3-3 3"/></svg>`,
  warn: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4l9 16H3z"/><path d="M12 10v4M12 17h.01"/></svg>`,
  cam: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>`,
  sound: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10v4h4l5 4V6L8 10z"/><path d="M16.5 9a4 4 0 0 1 0 6"/></svg>`,
};

/* The chain of custody: every party lacks the same thing, a shared record */
function chain(root: HTMLElement) {
  const el = root.querySelector<HTMLElement>("[data-chain]");
  if (!el) return () => {};
  const rows = [...el.querySelectorAll<HTMLButtonElement>("[data-party]")];
  return on(el, "click", (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>("[data-party]");
    if (!b) return;
    const [, carries, wants, lacks] = CHAIN[Number(b.dataset.party)];
    rows.forEach((r) => r.setAttribute("aria-pressed", String(r === b)));
    el.querySelector("[data-chain-carries]")!.textContent = carries;
    el.querySelector("[data-chain-wants]")!.textContent = wants;
    el.querySelector("[data-chain-lacks]")!.textContent = lacks;
  });
}

/* One handover across three phones. A clean bin is two touches: scan, then done. */
function handover(root: HTMLElement) {
  const el = root.querySelector<HTMLElement>("[data-ho]");
  if (!el) return () => {};
  const screen = el.querySelector<HTMLElement>("[data-ho-screen]")!;
  const receipt = el.querySelector<HTMLElement>("[data-ho-receipt]")!;
  const wa = el.querySelector<HTMLElement>("[data-ho-wa]")!;
  const touchesEl = el.querySelector<HTMLElement>("[data-ho-touches]")!;
  const st = { lang: "kn" as Lang, step: "scan" as "scan" | "check" | "photo" | "choose" | "done", cond: "clean" as Cond, bin: "medium" as Bin, touches: 0, left: false };

  const L = (k: string, v: Record<string, string | number> = {}) => t(st.lang, k, v);
  const binLabel = (lang: Lang) => t(lang, `bin.${st.bin}`);
  const draw = () => {
    screen.lang = st.lang;
    touchesEl.textContent = String(st.touches);
    const stopHead = `<p class="hs__kick">${esc(L("scan.expected"))}</p><p class="hs__stop"><b>Dosa Corner</b><span>9:00 AM</span></p>`;
    if (st.step === "scan") {
      screen.innerHTML = `${stopHead}
        <p class="hs__streams"><span class="nk-chip nk-chip--wet">${SVG.leaf}${esc(L("stream.wet"))}</span><span class="nk-chip nk-chip--dry">${SVG.box}${esc(L("stream.dry"))}</span></p>
        <div class="hs__finder" aria-hidden="true"><i></i></div>
        <button type="button" class="nk-btn nk-btn--c nk-btn--block" data-ho-act="scan" data-cursor="hide">${SVG.cam}${esc(L("scan.cta"))}</button>`;
    } else if (st.step === "check") {
      const opt = (c: Cond, icon: string) =>
        `<button type="button" class="hs__opt hs__opt--${c}" data-ho-cond="${c}" aria-pressed="${st.cond === c}" data-cursor="hide"><span class="hs__ico">${icon}</span><span>${esc(L(`check.${c}`))}</span><i class="hs__say" aria-hidden="true">${SVG.sound}</i></button>`;
      const size = (b: Bin) =>
        `<button type="button" data-ho-bin="${b}" aria-pressed="${st.bin === b}" data-cursor="hide"><b>${rs(PAY[b])}</b><span>${esc(L(`bin.${b}`))}</span></button>`;
      const cta = st.cond === "clean" ? L("check.done", { amount: rs(PAY[st.bin]) }) : L("check.next");
      screen.innerHTML = `<p class="hs__q">${esc(L("check.question"))}</p>
        <div class="hs__opts">${opt("clean", SVG.check)}${opt("mixed", SVG.mixed)}${opt("unsafe", SVG.warn)}</div>
        <p class="hs__label">${esc(L("check.bin"))}</p>
        <div class="hs__bins" role="group">${size("small")}${size("medium")}${size("large")}</div>
        <p class="hs__est">~${KG[st.bin]} kg</p>
        <button type="button" class="nk-btn nk-btn--c nk-btn--block" data-ho-act="next" data-cursor="hide">${st.cond === "clean" ? SVG.check : SVG.cam}${esc(cta)}</button>`;
    } else if (st.step === "photo") {
      screen.innerHTML = `<p class="hs__q">${esc(L("photo.instruction"))}</p>
        <div class="hs__finder hs__finder--photo" aria-hidden="true">${SVG.cam}</div>
        <button type="button" class="nk-btn nk-btn--c nk-btn--block" data-ho-act="photo" data-cursor="hide">${SVG.cam}${esc(L("photo.take"))}</button>`;
    } else if (st.step === "choose") {
      screen.innerHTML = `<div class="hs__snap" aria-hidden="true"></div>
        <p class="hs__q">${esc(L("photo.question"))}</p>
        <button type="button" class="hs__opt" data-ho-act="keep" data-cursor="hide"><span class="hs__ico">${SVG.check}</span><span>${esc(L("photo.keep.title"))}</span></button>
        <button type="button" class="hs__opt" data-ho-act="leave" data-cursor="hide"><span class="hs__ico">${SVG.warn}</span><span>${esc(L("photo.leave.title"))}</span></button>
        <p class="hs__paid">${esc(L("photo.paid"))}</p>`;
    } else {
      const told = st.cond === "clean" ? L("done.toldClean", { helper: "Manjunath" }) : L("done.toldFlagged", { name: "Dosa Corner" });
      screen.innerHTML = `<div class="hs__done">${SVG.check}</div>
        <p class="hs__amt">${rs(PAY[st.bin])}</p>
        <p class="hs__added">${esc(L("done.added"))}</p>
        <p class="hs__told">${esc(told)}</p>`;
    }
    drawReceipt();
  };
  const drawReceipt = () => {
    if (st.step !== "done") {
      receipt.innerHTML = `<p class="rc__kick">Today</p><div class="rc__card rc__card--wait"><b>Pickup at 9:00 AM with Lakshmi</b><span>The receipt shows here once the bin is picked up.</span></div>`;
      wa.innerHTML = `<p class="wa__empty">Messages from Navu Kavacha land here.</p>`;
      return;
    }
    const flagged = st.cond !== "clean";
    const status = st.left ? "Left behind" : flagged ? "Collected, marked" : "Collected";
    const reason = st.cond === "mixed" ? "Mixed waste in the wet bin" : "Unsafe items in the bin";
    receipt.innerHTML = `<p class="rc__kick">Pickup receipt</p>
      <div class="rc__card rc__card--in"><p class="rc__time"><b>Today, 9:03 AM</b><span class="nk-chip nk-chip--wet">${SVG.leaf}Wet</span></p>
      <p class="rc__meta">${esc(binLabel("en"))}, ~${KG[st.bin]} kg est.</p>
      <p class="rc__tags"><span class="${flagged ? "rc__tag rc__tag--warn" : "rc__tag"}">${status}</span>${flagged ? "" : `<span class="rc__tag">Clean</span>`}</p></div>
      ${flagged ? `<div class="rc__flag"><b>${reason}</b><span>Lakshmi's photo is attached. Reply within 24 hours.</span><p><span class="nk-btn nk-btn--r nk-btn--sm">Accept</span><span class="nk-btn nk-btn--ghost nk-btn--sm">This is wrong</span></p></div>` : ""}`;
    const key = st.left ? "wa.leftBehind" : st.cond === "clean" ? "wa.pickupDone" : st.cond === "mixed" ? "wa.flaggedMixed" : "wa.flaggedUnsafe";
    const vars = (lang: Lang) => ({ name: "Lakshmi", time: "9:03 AM", stream: t(lang, "stream.wet"), bin: t(lang, `bin.${st.bin}`) });
    wa.innerHTML = `<div class="wa__bubble" lang="kn">${esc(t("kn", key, vars("kn"))).replace(/\n/g, "<br>")}<span class="wa__time">9:03 AM</span></div>
      <p class="wa__gloss"><b>In English:</b> ${esc(t("en", key, vars("en"))).replace(/\n/g, " ")}</p>`;
    if (!reducedMotion()) [receipt, wa].forEach((n) => n.animate([{ opacity: 0, transform: "translateY(8px)" }, { opacity: 1, transform: "none" }], { duration: 360, easing: "cubic-bezier(0.16, 1, 0.3, 1)" }));
  };
  const touch = () => (st.touches += 1);

  draw();
  return on(el, "click", (e) => {
    const tg = e.target as HTMLElement;
    const lang = tg.closest<HTMLElement>("[data-lang]");
    if (lang) {
      st.lang = lang.dataset.lang as Lang;
      el.querySelectorAll("[data-lang]").forEach((b) => b.setAttribute("aria-pressed", String(b === lang)));
      draw();
      return;
    }
    if (tg.closest("[data-ho-reset]")) {
      Object.assign(st, { step: "scan", cond: "clean", bin: "medium", touches: 0, left: false });
      draw();
      return;
    }
    const cond = tg.closest<HTMLElement>("[data-ho-cond]");
    if (cond && cond.dataset.hoCond !== st.cond) {
      st.cond = cond.dataset.hoCond as Cond;
      touch();
      draw();
      return;
    }
    const bin = tg.closest<HTMLElement>("[data-ho-bin]");
    if (bin && bin.dataset.hoBin !== st.bin) {
      st.bin = bin.dataset.hoBin as Bin;
      touch();
      draw();
      return;
    }
    const act = tg.closest<HTMLElement>("[data-ho-act]")?.dataset.hoAct;
    if (!act) return;
    touch();
    if (act === "scan") st.step = "check";
    else if (act === "next") st.step = st.cond === "clean" ? "done" : "photo";
    else if (act === "photo") st.step = "choose";
    else if (act === "keep" || act === "leave") {
      st.left = act === "leave";
      st.step = "done";
    }
    draw();
  });
}

/* Bin not ready: after 10 minutes the wait fee is hers, whether or not the bin ever comes out */
function wait(root: HTMLElement) {
  const el = root.querySelector<HTMLElement>("[data-wait]");
  if (!el) return () => {};
  const ring = el.querySelector<HTMLElement>(".wt__ring")!;
  const minEl = el.querySelector<HTMLElement>("[data-wait-min]")!;
  const fee = el.querySelector<HTMLElement>("[data-wait-fee]")!;
  const go = el.querySelector<HTMLButtonElement>("[data-wait-go]")!;
  const miss = el.querySelector<HTMLButtonElement>("[data-wait-miss]")!;
  const out = el.querySelector<HTMLElement>("[data-wait-out]")!;
  let min = 0;
  let timer = 0;
  let running = false;
  const draw = () => {
    minEl.textContent = String(min);
    ring.style.setProperty("--p", String(Math.min(1, min / WAIT_THRESHOLD_MIN)));
    const due = min >= WAIT_THRESHOLD_MIN;
    el.classList.toggle("is-due", due);
    fee.textContent = due ? `${rs(WAIT_FEE)} wait fee earned. It is in her pay even if the bin stays shut.` : `The ${rs(WAIT_FEE)} wait fee is due after ${WAIT_THRESHOLD_MIN} minutes.`;
  };
  const stop = () => {
    window.clearInterval(timer);
    running = false;
  };
  const end = (text: string) => {
    stop();
    out.innerHTML = `<p>${text}</p><button type="button" class="nk-btn nk-btn--ghost nk-btn--sm" data-wait-reset data-cursor="hide">Start over</button>`;
    go.disabled = true;
    miss.disabled = true;
  };
  const off = on(el, "click", (e) => {
    const tg = e.target as HTMLElement;
    if (tg.closest("[data-wait-reset]")) {
      min = 0;
      out.innerHTML = "";
      go.textContent = "Start waiting";
      go.disabled = false;
      miss.disabled = true;
      draw();
      return;
    }
    if (tg.closest("[data-wait-go]")) {
      if (!running && min === 0) {
        running = true;
        go.textContent = "The bin is ready";
        miss.disabled = false;
        timer = window.setInterval(() => {
          min += 1;
          draw();
          if (min >= 15) stop();
        }, 500);
        return;
      }
      const due = min >= WAIT_THRESHOLD_MIN;
      end(due ? `Scan it and carry on. She keeps the ${rs(WAIT_FEE)} wait fee on top of the pickup pay.` : `Scan it and carry on. Under ${WAIT_THRESHOLD_MIN} minutes there is no wait fee.`);
      return;
    }
    if (tg.closest("[data-wait-miss]")) {
      const due = min >= WAIT_THRESHOLD_MIN;
      end(due ? t("en", "stop.missedFee", { minutes: min, fee: rs(WAIT_FEE) }) : `The bin was not ready. The wait was under ${WAIT_THRESHOLD_MIN} min, so there is no wait fee.`);
    }
  });
  return () => {
    off();
    stop();
  };
}
