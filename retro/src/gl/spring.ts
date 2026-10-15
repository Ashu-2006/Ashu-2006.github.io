/** A damped spring stepped in small fixed slices, so it feels the same at 30 Hz and at 144 Hz. */
export class Spring {
  value: number;
  target: number;
  velocity = 0;
  private stiffness: number;
  private damping: number;

  /** ratio below 1 overshoots a little; 1 is critically damped */
  constructor(value = 0, stiffness = 120, ratio = 0.8) {
    this.value = value;
    this.target = value;
    this.stiffness = stiffness;
    this.damping = 2 * ratio * Math.sqrt(stiffness);
  }

  step(dt: number) {
    let left = Math.min(dt, 0.1);
    while (left > 0) {
      const h = Math.min(left, 1 / 240);
      const accel = this.stiffness * (this.target - this.value) - this.damping * this.velocity;
      this.velocity += accel * h;
      this.value += this.velocity * h;
      left -= h;
    }
    return this.value;
  }

  snap(value: number) {
    this.value = this.target = value;
    this.velocity = 0;
  }

  get settled() {
    return Math.abs(this.target - this.value) < 1e-3 && Math.abs(this.velocity) < 1e-3;
  }
}
