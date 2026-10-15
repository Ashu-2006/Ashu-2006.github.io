/**
 * The retro switch: a physical slide toggle that flips the site between NOW (modern) and 1998 (ASH/OS 98).
 * Pure markup so it can be pre-rendered inside the header. initOS() wires every [data-switch] on the page
 * and keeps aria-checked in sync, so the control can appear more than once (header, mobile menu).
 * The knob and track draw in currentColor, so the control inverts cleanly under mix-blend-mode: difference.
 */
export const switchControl = () => `<button class="switch" type="button" role="switch" aria-checked="false" aria-label="1998 mode" data-switch data-cursor="link">
  <span class="switch__track" aria-hidden="true">
    <span class="switch__label switch__label--now"><span class="switch__word">NOW</span></span>
    <span class="switch__label switch__label--then"><span class="switch__word">1998</span></span>
    <span class="switch__knob"></span>
  </span>
</button>`;
