/**
 * Pointer input for the stage. The canvas has pointer-events: none, so everything is read from window listeners:
 * the cursor position for the sleeve tilt, hover over the record, and the scratch, where the record angle follows
 * the pointer around the record centre. Touch scratches too, and only a touch that starts on the record blocks scroll.
 */
export type InputApi = {
  /** Is the record under this viewport point, and can it be played with right now */
  hit(x: number, y: number): boolean;
  /** The record centre in viewport pixels */
  centre(): { x: number; y: number };
};

export function createInput(api: InputApi) {
  const state = { x: innerWidth / 2, y: innerHeight / 2, mouse: false, hover: false, scratching: false };
  let delta = 0;
  let pointerId = -1;
  let lastAngle = 0;
  let swallowClick = false;
  let touchHost: HTMLElement | null = null;

  const angleAt = (x: number, y: number) => {
    const c = api.centre();
    return Math.atan2(y - c.y, x - c.x);
  };

  /** Re-sent on every move while over the record: the cursor resets itself from the DOM under the pointer each move */
  const setHover = (on: boolean) => {
    if (on === state.hover && !on) return;
    state.hover = on;
    window.dispatchEvent(new CustomEvent("cursor:state", { detail: on ? "drag" : "" }));
  };

  function onMove(e: PointerEvent) {
    if (e.pointerType === "mouse") {
      state.x = e.clientX;
      state.y = e.clientY;
      state.mouse = true;
    }
    if (state.scratching) {
      if (e.pointerId !== pointerId) return;
      const a = angleAt(e.clientX, e.clientY);
      let d = a - lastAngle;
      if (d > Math.PI) d -= Math.PI * 2;
      if (d < -Math.PI) d += Math.PI * 2;
      delta += d;
      lastAngle = a;
      return;
    }
    if (e.pointerType === "mouse") setHover(api.hit(e.clientX, e.clientY));
  }

  function onDown(e: PointerEvent) {
    if (state.scratching || (e.pointerType === "mouse" && e.button !== 0)) return;
    if (!api.hit(e.clientX, e.clientY)) return;
    e.preventDefault();
    state.scratching = true;
    pointerId = e.pointerId;
    lastAngle = angleAt(e.clientX, e.clientY);
    delta = 0;
    document.documentElement.style.userSelect = "none";
    if (e.pointerType === "mouse") setHover(true);
  }

  function onUp(e: PointerEvent) {
    if (!state.scratching || e.pointerId !== pointerId) return;
    state.scratching = false;
    pointerId = -1;
    document.documentElement.style.userSelect = "";
    swallowClick = e.type === "pointerup";
    setTimeout(() => (swallowClick = false), 0);
    if (e.pointerType === "mouse") setHover(api.hit(e.clientX, e.clientY));
    else setHover(false);
  }

  /* A scratch that ends over a link must not follow it */
  const onClick = (e: MouseEvent) => {
    if (!swallowClick) return;
    swallowClick = false;
    e.preventDefault();
    e.stopPropagation();
  };
  const block = (e: Event) => {
    if (state.scratching) e.preventDefault();
  };
  const onLeave = () => {
    state.mouse = false;
    if (!state.scratching) setHover(false);
  };

  window.addEventListener("pointermove", onMove, { passive: true });
  window.addEventListener("pointerdown", onDown);
  window.addEventListener("pointerup", onUp);
  window.addEventListener("pointercancel", onUp);
  window.addEventListener("click", onClick, true);
  window.addEventListener("selectstart", block);
  window.addEventListener("dragstart", block);
  document.documentElement.addEventListener("pointerleave", onLeave);

  return {
    state,
    /** Radians the pointer turned the record since the last frame, clockwise positive */
    take() {
      const d = delta;
      delta = 0;
      return d;
    },
    /**
     * Touch listeners that can cancel scrolling are kept to the section the record lives in,
     * so the rest of the page scrolls without waiting on the main thread.
     */
    watchTouch(host: HTMLElement | null) {
      if (touchHost === host) return;
      touchHost?.removeEventListener("touchstart", block);
      touchHost?.removeEventListener("touchmove", block);
      touchHost = host;
      host?.addEventListener("touchstart", block, { passive: false });
      host?.addEventListener("touchmove", block, { passive: false });
    },
    release() {
      if (state.scratching) {
        state.scratching = false;
        pointerId = -1;
        document.documentElement.style.userSelect = "";
      }
      setHover(false);
    },
  };
}

export type Input = ReturnType<typeof createInput>;
