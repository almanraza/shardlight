// Everything the player sees: the arena, the shard and its shield, the foes, the fire, the HUD,
// and the four screens the game moves between (title, playing, paused, over). It reads the world
// state and paints it; it never changes it.

import { FIELD, FONT, PALETTE, PLAYER, COMBO } from './config.js';
import { ARENA } from './world.js';
import { drawBackdrop, drawEffects } from './effects.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';

const TAU = Math.PI * 2;

function poly(ctx, x, y, radius, sides, angle) {
  ctx.beginPath();
  for (let i = 0; i < sides; i += 1) {
    const a = angle + (i / sides) * TAU;
    const px = x + Math.cos(a) * radius;
    const py = y + Math.sin(a) * radius;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

function panel(ctx, x, y, w, h, radius = 14) {
  ctx.fillStyle = PALETTE.panel;
  ctx.strokeStyle = 'rgba(126,240,255,0.28)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

/** Draw a hexagon of health/lives icons, filled up to `value` of `max`. */
function pips(ctx, x, y, value, max, size, color, gap = 16) {
  for (let i = 0; i < max; i += 1) {
    ctx.globalAlpha = i < value ? 1 : 0.22;
    ctx.fillStyle = color;
    poly(ctx, x + i * gap, y, size, 6, -Math.PI / 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  let scale = 1;
  let offsetX = 0;
  let offsetY = 0;

  function resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const width = canvas.clientWidth || FIELD.width;
    const height = canvas.clientHeight || FIELD.height;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    const fit = Math.min(width / FIELD.width, height / FIELD.height);
    scale = fit * dpr;
    offsetX = (width * dpr - FIELD.width * scale) / 2;
    offsetY = (height * dpr - FIELD.height * scale) / 2;
  }

  resize();
  window.addEventListener('resize', resize);

  function drawShard(ctx, p, time) {
    // Trail
    for (let i = p.trail.length - 1; i >= 0; i -= 1) {
      const t = p.trail[i];
      const k = 1 - i / p.trail.length;
      ctx.globalAlpha = k * 0.35;
      ctx.fillStyle = PALETTE.shard;
      ctx.beginPath();
      ctx.arc(t.x, t.y, PLAYER.radius * 0.55 * k, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    const blink = p.invulnerable > 0 && Math.floor(time * 18) % 2 === 0;
    if (blink) return;

    ctx.save();
    ctx.shadowColor = PALETTE.shard;
    ctx.shadowBlur = 22;
    ctx.fillStyle = PALETTE.shardCore;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y - PLAYER.radius);
    ctx.lineTo(p.x + PLAYER.radius * 0.72, p.y);
    ctx.lineTo(p.x, p.y + PLAYER.radius);
    ctx.lineTo(p.x - PLAYER.radius * 0.72, p.y);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = PALETTE.shard;
    ctx.beginPath();
    ctx.arc(p.x, p.y, PLAYER.radius * 0.42, 0, TAU);
    ctx.fill();
    ctx.restore();

    // The aiming facet: a short spike pointing where the shard is drifting.
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.aim);
    ctx.fillStyle = 'rgba(126,240,255,0.85)';
    ctx.beginPath();
    ctx.moveTo(PLAYER.radius + 10, 0);
    ctx.lineTo(PLAYER.radius + 1, -5);
    ctx.lineTo(PLAYER.radius + 1, 5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawShield(ctx, p, time) {
    if (!p.shielding && p.shield <= 0.001) return;
    const strength = Math.max(0, p.shield);
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(time * 0.9);
    ctx.globalAlpha = p.shielding ? 0.28 + strength * 0.32 : 0.14 + strength * 0.2;
    ctx.strokeStyle = PALETTE.shield;
    ctx.lineWidth = 3 + strength * 4;
    ctx.shadowColor = PALETTE.shield;
    ctx.shadowBlur = 18;
    poly(ctx, 0, 0, PLAYER.shieldRadius, 6, 0);
    ctx.stroke();
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  function drawEnemy(ctx, e, time) {
    const flash = e.hitFlash;
    ctx.save();
    ctx.translate(e.x, e.y);
    if (e.spawn > 0) {
      ctx.globalAlpha = 1 - e.spawn / 0.45;
      ctx.scale(0.6 + (e.spawn / 0.45) * 0.4, 0.6 + (e.spawn / 0.45) * 0.4);
    }
    ctx.shadowColor = e.color;
    ctx.shadowBlur = e.boss ? 30 : 16;
    ctx.fillStyle = flash > 0 ? '#ffffff' : e.color;
    ctx.globalAlpha = (e.spawn > 0 ? 1 - e.spawn / 0.45 : 1) * (flash > 0 ? 1 : 0.92);
    poly(ctx, 0, 0, e.radius, e.sides, e.spin);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 1.5;
    poly(ctx, 0, 0, e.radius, e.sides, e.spin);
    ctx.stroke();
    ctx.fillStyle = '#0b1020';
    poly(ctx, 0, 0, e.radius * 0.42, e.sides, -e.spin * 1.4);
    ctx.fill();
    ctx.restore();

    if (e.boss) {
      const w = 420;
      const x = e.x - w / 2;
      const y = e.y - e.radius - 30;
      ctx.fillStyle = 'rgba(9,16,30,0.8)';
      ctx.fillRect(x, y, w, 12);
      ctx.fillStyle = PALETTE.boss;
      ctx.fillRect(x, y, w * Math.max(0, e.hp / e.maxHp), 12);
      ctx.strokeStyle = 'rgba(192,123,255,0.8)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x, y, w, 12);
    }
  }

  function drawProjectiles(ctx, list) {
    for (let i = 0; i < list.length; i += 1) {
      const s = list[i];
      const color = s.hostile ? PALETTE.enemy : PALETTE.shard;
      ctx.save();
      ctx.shadowColor = color;
      ctx.shadowBlur = s.hostile ? 14 : 22;
      ctx.fillStyle = color;
      poly(ctx, s.x, s.y, s.radius + (s.hostile ? 0 : 2), s.hostile ? 4 : 3, s.spin);
      ctx.fill();
      if (!s.hostile) {
        ctx.fillStyle = PALETTE.shardCore;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.radius * 0.45, 0, TAU);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  function drawHud(ctx, s, best) {
    // Top-left: score, wave.
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `600 15px ${FONT}`;
    ctx.fillText('SCORE', 34, 44);
    ctx.fillStyle = PALETTE.text;
    ctx.font = `700 40px ${FONT}`;
    ctx.fillText(String(s.score), 34, 82);

    ctx.fillStyle = PALETTE.muted;
    ctx.font = `600 15px ${FONT}`;
    ctx.fillText('WAVE', 34, 122);
    ctx.fillStyle = PALETTE.shard;
    ctx.font = `700 26px ${FONT}`;
    ctx.fillText(String(s.wave), 34, 150);

    // Top-right: best, lives, shield.
    ctx.textAlign = 'right';
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `600 15px ${FONT}`;
    ctx.fillText('BEST', FIELD.width - 34, 44);
    ctx.fillStyle = PALETTE.gold;
    ctx.font = `700 30px ${FONT}`;
    ctx.fillText(String(Math.max(best, s.score)), FIELD.width - 34, 76);

    ctx.fillStyle = PALETTE.muted;
    ctx.font = `600 14px ${FONT}`;
    ctx.fillText('LIVES', FIELD.width - 34, 116);
    pips(ctx, FIELD.width - 34 - 16, 138, s.player.lives, PLAYER.lives, 8, PALETTE.enemy, 22);

    // Bottom-centre: the shield bar.
    const bw = 300;
    const bx = FIELD.width / 2 - bw / 2;
    const by = FIELD.height - 46;
    ctx.fillStyle = 'rgba(9,16,30,0.8)';
    ctx.fillRect(bx, by, bw, 16);
    const full = s.player.shield;
    ctx.fillStyle = s.player.shieldDown ? '#4a5875' : PALETTE.shield;
    ctx.fillRect(bx, by, bw * Math.max(0, full), 16);
    ctx.strokeStyle = 'rgba(126,240,255,0.5)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(bx, by, bw, 16);
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `600 13px ${FONT}`;
    ctx.fillText(s.player.shieldDown ? 'SHIELD RECHARGING' : 'SHIELD  ·  hold SPACE', FIELD.width / 2, by + 34);

    // The combo, when it is running.
    if (s.combo > 1 && s.comboTimer > 0) {
      const t = s.comboTimer / COMBO.window;
      ctx.save();
      ctx.globalAlpha = 0.5 + t * 0.5;
      ctx.textAlign = 'center';
      ctx.fillStyle = PALETTE.gold;
      ctx.font = `800 ${26 + Math.min(16, s.combo * 2)}px ${FONT}`;
      ctx.fillText(`x${s.combo}  COMBO`, FIELD.width / 2, 92);
      ctx.globalAlpha = 1;
      ctx.fillStyle = 'rgba(255,209,102,0.35)';
      ctx.fillRect(FIELD.width / 2 - 90, 100, 180 * t, 4);
      ctx.restore();
    }

    if (s.waveBanner > 0) {
      const t = Math.min(1, s.waveBanner / 0.5);
      ctx.save();
      ctx.globalAlpha = t;
      ctx.textAlign = 'center';
      ctx.fillStyle = PALETTE.text;
      ctx.font = `800 46px ${FONT}`;
      ctx.shadowColor = PALETTE.shard;
      ctx.shadowBlur = 24;
      ctx.fillText(s.waveName, FIELD.width / 2, 168);
      ctx.restore();
    }
  }

  function drawTitle(ctx, s, best, time) {
    ctx.fillStyle = 'rgba(5,7,15,0.62)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    ctx.textAlign = 'center';

    ctx.save();
    ctx.shadowColor = PALETTE.shard;
    ctx.shadowBlur = 30;
    ctx.fillStyle = PALETTE.shardCore;
    ctx.font = `800 92px ${FONT}`;
    ctx.fillText('SHARDLIGHT', FIELD.width / 2, 250);
    ctx.restore();

    ctx.fillStyle = PALETTE.shard;
    ctx.font = `600 22px ${FONT}`;
    ctx.fillText('Turn their fire against them', FIELD.width / 2, 292);

    panel(ctx, FIELD.width / 2 - 330, 330, 660, 168, 16);
    ctx.textAlign = 'left';
    ctx.fillStyle = PALETTE.text;
    ctx.font = `600 18px ${FONT}`;
    const lines = [
      ['MOVE', 'WASD  /  Arrow keys  —  drift your shard'],
      ['SHIELD', 'Hold SPACE  —  the ring turns hostile fire back'],
      ['DEFLECT', 'Chain turns fast for a combo multiplier'],
      ['SURVIVE', 'Clear every wave. A Sentinel every 5th.'],
    ];
    lines.forEach(([key, text], i) => {
      const y = 372 + i * 34;
      ctx.fillStyle = PALETTE.shard;
      ctx.font = `700 16px ${FONT}`;
      ctx.fillText(key, FIELD.width / 2 - 300, y);
      ctx.fillStyle = PALETTE.text;
      ctx.font = `500 16px ${FONT}`;
      ctx.fillText(text, FIELD.width / 2 - 180, y);
    });

    ctx.textAlign = 'center';
    const pulse = 0.6 + 0.4 * Math.sin(time * 4);
    ctx.globalAlpha = pulse;
    ctx.fillStyle = PALETTE.gold;
    ctx.font = `800 28px ${FONT}`;
    ctx.fillText('PRESS SPACE OR CLICK TO START', FIELD.width / 2, 548);
    ctx.globalAlpha = 1;

    ctx.fillStyle = PALETTE.muted;
    ctx.font = `600 16px ${FONT}`;
    ctx.fillText(`BEST  ${best}`, FIELD.width / 2, 606);
    ctx.font = `500 14px ${FONT}`;
    ctx.fillText('P pause  ·  M mute', FIELD.width / 2, 640);
  }

  function drawPaused(ctx) {
    ctx.fillStyle = 'rgba(5,7,15,0.66)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    ctx.textAlign = 'center';
    ctx.fillStyle = PALETTE.text;
    ctx.font = `800 64px ${FONT}`;
    ctx.fillText('PAUSED', FIELD.width / 2, FIELD.height / 2 - 10);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `500 20px ${FONT}`;
    ctx.fillText('Press P or Escape to resume', FIELD.width / 2, FIELD.height / 2 + 42);
  }

  function drawOver(ctx, s, best, time) {
    ctx.fillStyle = 'rgba(5,7,15,0.74)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    ctx.textAlign = 'center';

    ctx.save();
    ctx.shadowColor = PALETTE.enemy;
    ctx.shadowBlur = 26;
    ctx.fillStyle = PALETTE.enemy;
    ctx.font = `800 78px ${FONT}`;
    ctx.fillText('SHARD LOST', FIELD.width / 2, 208);
    ctx.restore();

    panel(ctx, FIELD.width / 2 - 300, 250, 600, 250, 16);
    const rows = [
      ['SCORE', String(s.score), PALETTE.text],
      ['WAVE REACHED', String(s.wave), PALETTE.shard],
      ['BEST COMBO', `x${s.bestCombo}`, PALETTE.gold],
      ['DEFLECTIONS', String(s.deflections), PALETTE.shard],
      ['BEST SCORE', String(best), PALETTE.gold],
    ];
    rows.forEach(([label, value, color], i) => {
      const y = 300 + i * 38;
      ctx.textAlign = 'left';
      ctx.fillStyle = PALETTE.muted;
      ctx.font = `600 17px ${FONT}`;
      ctx.fillText(label, FIELD.width / 2 - 268, y);
      ctx.textAlign = 'right';
      ctx.fillStyle = color;
      ctx.font = `700 22px ${FONT}`;
      ctx.fillText(value, FIELD.width / 2 + 268, y);
    });

    ctx.textAlign = 'center';
    const pulse = 0.6 + 0.4 * Math.sin(time * 4);
    ctx.globalAlpha = pulse;
    ctx.fillStyle = PALETTE.gold;
    ctx.font = `800 28px ${FONT}`;
    ctx.fillText('PRESS SPACE OR CLICK TO PLAY AGAIN', FIELD.width / 2, 566);
    ctx.globalAlpha = 1;
  }

  function draw(s, screen, best) {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = PALETTE.void;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.setTransform(scale, 0, 0, scale, offsetX + s.fx.shakeX, offsetY + s.fx.shakeY);
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, FIELD.width, FIELD.height);
    ctx.clip();

    drawBackdrop(ctx, s.fx, ARENA);

    for (let i = 0; i < s.enemies.length; i += 1) drawEnemy(ctx, s.enemies[i], s.time);
    drawProjectiles(ctx, s.projectiles);
    if (screen !== SCREEN_TITLE) {
      drawShield(ctx, s.player, s.time);
      drawShard(ctx, s.player, s.time);
    }
    drawEffects(ctx, s.fx);

    if (s.fx.flash > 0) {
      ctx.fillStyle = `rgba(255,80,110,${s.fx.flash})`;
      ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    }

    if (screen === SCREEN_PLAY) drawHud(ctx, s, best);
    else if (screen === SCREEN_TITLE) drawTitle(ctx, s, best, s.fx.time);
    else if (screen === SCREEN_PAUSED) {
      drawHud(ctx, s, best);
      drawPaused(ctx);
    } else if (screen === SCREEN_OVER) drawOver(ctx, s, best, s.fx.time);

    ctx.restore();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  return { draw, resize };
}
