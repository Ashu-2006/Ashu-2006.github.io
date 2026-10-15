/** Split plain text into masked lines of char spans. A <br> starts a new line. */
export function splitText(el: HTMLElement) {
  const lines: string[] = [""];
  el.childNodes.forEach((n) => {
    if (n.nodeName === "BR") lines.push("");
    else lines[lines.length - 1] += n.textContent ?? "";
  });
  const texts = lines.map((l) => l.replace(/\s+/g, " ").trim()).filter(Boolean);

  const sr = document.createElement("span");
  sr.className = "sr-only";
  sr.textContent = texts.join(" ");
  const live = document.createElement("span");
  live.setAttribute("aria-hidden", "true");

  for (const text of texts) {
    const line = document.createElement("span");
    line.className = "line";
    text.split(" ").forEach((word, i) => {
      if (i) line.append(" ");
      const w = document.createElement("span");
      w.className = "word";
      for (const ch of word) {
        const c = document.createElement("span");
        c.dataset.char = ch;
        c.textContent = ch;
        w.append(c);
      }
      line.append(w);
    });
    live.append(line);
  }
  el.replaceChildren(sr, live);
}

/** Stamp each char with its line index, order in the line and signed distance from the line centre. */
export function indexReveal(root: HTMLElement) {
  const lines = [...root.querySelectorAll<HTMLElement>(".line, .row")];
  (lines.length ? lines : [root]).forEach((line, ri) => {
    line.style.setProperty("--ri", String(ri));
    const chars = [...line.querySelectorAll<HTMLElement>("[data-char]")];
    const mid = (chars.length - 1) / 2;
    chars.forEach((c, ci) => {
      c.style.setProperty("--ci", String(ci));
      c.style.setProperty("--cs", (ci - mid).toFixed(1));
    });
  });
}

/** Run once when the element first crosses into the viewport, offset up from the bottom edge. */
export function onEnter(el: Element, run: () => void, rootMargin = "0px 0px -15% 0px") {
  const io = new IntersectionObserver(
    (entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      io.disconnect();
      run();
    },
    { rootMargin },
  );
  io.observe(el);
}
