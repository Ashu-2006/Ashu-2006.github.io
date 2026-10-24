import { SITE } from "../content";
import { mountClock } from "./clock";
import { fitText, mountCopy, mountScrambleHover } from "./kit";
import { mountSwaps } from "./swap";

/** How each topic reads inside "I'd like to talk about ..." */
const TOPIC_PHRASE: Record<string, string> = {
  "Product design": "product design",
  "Design system": "a design system",
  "Frontend build": "a frontend build",
  "Full-time role": "a full-time role",
  "Something else": "something else",
};

/** The inquiry's email, from whatever has been filled in. Every field is optional, so a blank form still reads. */
export function composeInquiry(name: string, company: string, topic: string, message: string) {
  const who = [name.trim(), company.trim()].filter(Boolean).join(", ");
  const subject = `${topic || "Hello"}${company.trim() ? `, ${company.trim()}` : ""}`;
  const lines = [`Hi Ashutosh,`, ``, message.trim() || `I'd like to talk about ${TOPIC_PHRASE[topic] ?? "a project"}.`, ``, who ? `Thanks,\n${who}` : `Thanks`];
  return { subject, body: lines.join("\n") };
}

/**
 * Contact: the form never posts anywhere. Sending opens the visitor's mail app with the subject and body filled in,
 * so nothing is stored and there is no backend to fail.
 */
export function mountInquiry(form: HTMLFormElement): () => void {
  const send = (e: Event) => {
    e.preventDefault();
    const d = new FormData(form);
    const { subject, body } = composeInquiry(String(d.get("name") ?? ""), String(d.get("company") ?? ""), String(d.get("topic") ?? ""), String(d.get("message") ?? ""));
    window.location.href = `mailto:${SITE.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };
  form.addEventListener("submit", send);
  return () => form.removeEventListener("submit", send);
}

/** Footer: the wordmark fitted to the full width, every letter a face-swap target */
export function mountSignature(link: HTMLElement): () => void {
  const inner = link.querySelector<HTMLElement>(".foot__mark-in");
  if (!inner) return () => {};
  const { stop } = mountSwaps(link);
  const unfit = fitText(link, inner, "--mark-fs");
  return () => {
    unfit();
    stop();
  };
}

/** Wires every closer behaviour found in scope: copy, scramble links, clocks, the inquiry form and the wordmark */
export function mountClosing(scope: HTMLElement): () => void {
  const all = <T extends HTMLElement>(sel: string) => Array.from(scope.querySelectorAll<T>(sel));
  const cleanups = [
    mountCopy(scope),
    mountScrambleHover(scope),
    mountClock(scope),
    ...all<HTMLFormElement>("form[data-inquiry]").map(mountInquiry),
    ...all("[data-sig]").map(mountSignature),
  ];
  return () => cleanups.forEach((fn) => fn());
}
