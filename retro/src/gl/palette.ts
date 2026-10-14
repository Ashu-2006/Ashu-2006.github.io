import * as THREE from "three";

const FALLBACK: Record<string, string> = {
  chocolate: "#2a1a12",
  bone: "#f1e2c0",
  "bone-2": "#e6d3ab",
  "bone-3": "#d6bf92",
  harvest: "#e4a62c",
  rust: "#d25f27",
  poppy: "#bf3426",
  walnut: "#6b3f22",
};

/** Colours come from tokens.css at runtime, so the 3D print and the page can never drift apart. */
export function token(name: keyof typeof FALLBACK | string) {
  const value = getComputedStyle(document.documentElement).getPropertyValue(`--${name}`).trim();
  return value || FALLBACK[name] || "#000000";
}

export const color = (name: string) => new THREE.Color(token(name));
