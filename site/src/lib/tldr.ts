/**
 * TL;DR mode: one flag on <html>, remembered across pages, flipped by any [data-tldr-toggle] button. Dim runs
 * are staggered by their order in the page, so the strike reads like a pen moving down the copy.
 */
const KEY = "tldr";

const read = () => {
  try {
    return localStorage.getItem(KEY) === "on";
  } catch {
    return false;
  }
};

function apply(on: boolean, root: ParentNode) {
  document.documentElement.dataset.tldr = on ? "on" : "off";
  root.querySelectorAll<HTMLButtonElement>("[data-tldr-toggle]").forEach((b) => {
    b.setAttribute("aria-pressed", String(on));
    b.setAttribute("aria-label", on ? "Turn off TL;DR mode" : "Turn on TL;DR mode");
  });
}

export function mountTldr(root: HTMLElement) {
  const buttons = root.querySelectorAll<HTMLButtonElement>("[data-tldr-toggle]");
  if (!buttons.length) return () => {};
  root.querySelectorAll<HTMLElement>("[data-skim='dim']").forEach((el, i) => el.style.setProperty("--skim-i", String(i % 12)));
  apply(read(), root);

  const onClick = () => {
    const on = document.documentElement.dataset.tldr !== "on";
    try {
      localStorage.setItem(KEY, on ? "on" : "off");
    } catch {
      /* Private mode: the toggle still works for this page */
    }
    apply(on, root);
  };
  buttons.forEach((b) => b.addEventListener("click", onClick));

  /* The floating pill shows only while the story is on screen and its in-flow twin is not */
  const pill = root.querySelector<HTMLElement>(".tldr--float");
  const inline = root.querySelector<HTMLElement>(".tldr--inline");
  const scope = root.matches("[data-tldr-scope]") ? root : root.querySelector<HTMLElement>("[data-tldr-scope]");
  let io: IntersectionObserver | null = null;
  if (pill && scope) {
    const seen = { scope: false, inline: false };
    const sync = () => pill.classList.toggle("is-on", seen.scope && !seen.inline);
    io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.target === scope) seen.scope = e.isIntersecting;
        if (e.target === inline) seen.inline = e.isIntersecting;
      }
      sync();
    });
    io.observe(scope);
    if (inline) io.observe(inline);
  }

  return () => {
    buttons.forEach((b) => b.removeEventListener("click", onClick));
    io?.disconnect();
  };
}
