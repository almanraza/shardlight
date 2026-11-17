// Keyboard and pointer input. Held keys give a movement vector and the shield; one-shot presses
// (start or restart, pause) are queued as bit flags and taken once by the loop, so a press
// between two frames is never lost and never counted twice.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;

const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const SHIELD = new Set(['Space', 'ShiftLeft', 'ShiftRight']);
const CONFIRM = new Set(['Space', 'Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);

export function createInput(target) {
  const held = { up: false, down: false, left: false, right: false, shield: false };
  let actions = 0;

  function release() {
    held.up = false;
    held.down = false;
    held.left = false;
    held.right = false;
    held.shield = false;
  }

  window.addEventListener('keydown', (event) => {
    if (UP.has(event.code)) held.up = true;
    else if (DOWN.has(event.code)) held.down = true;
    else if (LEFT.has(event.code)) held.left = true;
    else if (RIGHT.has(event.code)) held.right = true;
    else if (SHIELD.has(event.code)) {
      held.shield = true;
      if (!event.repeat) actions |= ACTION_CONFIRM;
    } else if (CONFIRM.has(event.code)) {
      if (!event.repeat) actions |= ACTION_CONFIRM;
    } else if (PAUSE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_PAUSE;
    } else return;
    event.preventDefault();
  });

  window.addEventListener('keyup', (event) => {
    if (UP.has(event.code)) held.up = false;
    else if (DOWN.has(event.code)) held.down = false;
    else if (LEFT.has(event.code)) held.left = false;
    else if (RIGHT.has(event.code)) held.right = false;
    else if (SHIELD.has(event.code)) held.shield = false;
  });

  // A key released while the tab is hidden never sends keyup: let go of everything on blur.
  window.addEventListener('blur', release);

  target.addEventListener('pointerdown', (event) => {
    actions |= ACTION_CONFIRM;
    if (event.button === 2) held.shield = true;
  });
  target.addEventListener('pointerup', (event) => {
    if (event.button === 2) held.shield = false;
  });
  target.addEventListener('contextmenu', (event) => event.preventDefault());

  return {
    /** The movement the held keys ask for, as a unit-ish vector. */
    move() {
      const x = (held.right ? 1 : 0) - (held.left ? 1 : 0);
      const y = (held.down ? 1 : 0) - (held.up ? 1 : 0);
      if (x !== 0 && y !== 0) {
        const k = Math.SQRT1_2;
        return { x: x * k, y: y * k };
      }
      return { x, y };
    },
    /** Whether the shield is held up this frame. */
    shielding() {
      return held.shield;
    },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
