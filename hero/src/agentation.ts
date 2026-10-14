import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { Agentation } from "agentation";

export function mountAgentation() {
  const host = document.createElement("div");
  host.id = "agentation-root";
  document.body.append(host);
  createRoot(host).render(createElement(Agentation));
}
