// The screenshot scenes behind ?shot=title|play|combo|over. Each one plays the real rules
// forward from a fresh world, steered by a simple autopilot, until the moment that scene is
// meant to show, so the frame is what a real run looks like and the same seed always gives the
// same frame. Nothing here is drawn by hand: every pixel comes from the game's own renderer.

import { FIELD, PLAYER, STEP } from './config.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { EVENT_OVER } from './world.js';

const TITLE_SECONDS = 4.5;

/**
 * How well each scene's pilot plays. A wide look-ahead and a steady ring keep it alive through a
 * busy wave (play, combo); the over scene's pilot is deliberately passive, so the run really does
 * end and the frame is a real game-over screen.
 */
const PILOT = {
  play: { look: 150, greed: 1.0, shield: true },
  combo: { look: 165, greed: 1.2, shield: true },
  over: { look: 0, greed: 0, shield: false },
};

/** A crude but honest autopilot: it reads the world the way a player would. */
function pilot(state, cfg) {
  const p = state.player;
  if (cfg.look === 0) return { move: { x: 0, y: 0 }, shield: false };

  // Is hostile fire about to arrive? Raise the ring.
  let danger = false;
  let incoming = 0;
  for (let i = 0; i < state.projectiles.length; i += 1) {
    const s = state.projectiles[i];
    if (!s.hostile) continue;
    const d = Math.hypot(s.x - p.x, s.y - p.y);
    if (d < PLAYER.shieldRadius + 30) {
      incoming += 1;
      if (d < cfg.look) danger = true;
    }
  }
  const shield = cfg.shield ? danger || incoming >= 2 : false;

  // Steer toward the nearest foe to bait its fire and turn it back, backing off when close.
  let target = null;
  let targetDist = Infinity;
  for (let i = 0; i < state.enemies.length; i += 1) {
    const e = state.enemies[i];
    if (!e.alive || e.spawn > 0) continue;
    const d = Math.hypot(e.x - p.x, e.y - p.y);
    if (d < targetDist) {
      targetDist = d;
      target = e;
    }
  }

  let wantX = 0;
  let wantY = 0;
  if (target) {
    const ux = (target.x - p.x) / (targetDist || 1);
    const uy = (target.y - p.y) / (targetDist || 1);
    if (targetDist > 190) {
      wantX = ux * cfg.greed;
      wantY = uy * cfg.greed;
    } else {
      wantX = -ux;
      wantY = -uy;
    }
  }

  // Stay off the arena wall.
  const dx = p.x - FIELD.width / 2;
  const dy = p.y - FIELD.height / 2;
  const dist = Math.hypot(dx, dy);
  if (dist > 240) {
    wantX += (-dx / (dist || 1)) * 1.7;
    wantY += (-dy / (dist || 1)) * 1.7;
  }

  const mag = Math.hypot(wantX, wantY) || 1;
  return { move: { x: wantX / mag, y: wantY / mag }, shield };
}

function countHostile(state) {
  let n = 0;
  for (let i = 0; i < state.projectiles.length; i += 1) if (state.projectiles[i].hostile) n += 1;
  return n;
}

/**
 * Set `world` to the named scene and return the screen to draw over it and the best score to
 * show. Any other name is the title scene.
 */
export function stageShot(name, world) {
  world.reset();
  const s = world.state;

  if (name !== 'play' && name !== 'combo' && name !== 'over') {
    for (let i = 0; i < TITLE_SECONDS / STEP; i += 1) world.step(STEP, { x: 0, y: 0 }, false);
    return { screen: SCREEN_TITLE, best: 4820 };
  }

  if (name === 'over') {
    // A real run first, so the results screen carries real numbers, then a passive pilot that
    // lets the shard be caught: the frame is the game's own game-over screen, not a mock-up.
    for (let i = 0; i < 70 / STEP; i += 1) {
      const order = pilot(s, PILOT.play);
      if (world.step(STEP, order.move, order.shield) & EVENT_OVER) break;
    }
    for (let i = 0; i < 60 / STEP && !s.over; i += 1) {
      if (world.step(STEP, { x: 0, y: 0 }, false) & EVENT_OVER) break;
    }
    return { screen: s.over ? SCREEN_OVER : SCREEN_PLAY, best: Math.max(4820, s.score) };
  }

  const cfg = name === 'combo' ? PILOT.combo : PILOT.play;
  const limit = (name === 'combo' ? 100 : 80) / STEP;

  for (let i = 0; i < limit; i += 1) {
    const order = pilot(s, cfg);
    const events = world.step(STEP, order.move, order.shield);
    if (events & EVENT_OVER) break;

    if (name === 'combo') {
      // Stop on a frame where the combo is genuinely running and the arena is busy.
      if (s.combo >= 5 && s.comboTimer > 1.2 && countHostile(s) >= 6 && s.enemies.length >= 3) break;
    } else if (s.wave >= 4 && s.enemies.length >= 5 && countHostile(s) >= 7) {
      // A busy, mid-wave frame: foes, fire and a full HUD.
      break;
    }
  }

  return { screen: s.over ? SCREEN_OVER : SCREEN_PLAY, best: Math.max(4820, s.score) };
}
