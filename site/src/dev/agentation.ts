import { Agentation, type AgentationProps } from "agentation";
import { createElement } from "react";
import { createRoot } from "react-dom/client";

/** Where `npm run agentation` serves the annotation sync; the agent reads it over MCP */
const ENDPOINT = "http://localhost:4747";

/**
 * Dev only: the Agentation toolbar for annotating the page for a coding agent. main.ts imports this behind
 * import.meta.env.DEV, so React and the toolbar never reach the production bundle. It lives in its own host
 * outside #main, so route swaps never unmount it.
 */
export function mountAgentation() {
  const host = document.createElement("div");
  host.id = "agentation";
  document.body.append(host);
  createRoot(host).render(createElement<AgentationProps>(Agentation, { endpoint: ENDPOINT, appName: "ash-portfolio" }));
}
