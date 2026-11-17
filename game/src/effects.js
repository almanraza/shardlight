// Every bit of feedback the game draws that is not the game itself: sparks, shards, expanding
// rings, floating score words, the screen shake, and the drifting starfield behind the arena.
// All of it is pooled or bounded, so a long run allocates nothing new.

import { FIELD } from './config.js';
import { range } from './random.js';

const MAX_PARTICLES = 420;
const MAX_RINGS = 40;
const MAX_TEXTS = 16;
const STAR_COUNT = 150;

const SHARD_LIFE = 0.9;
const SPARK_LIFE = 0.5;

export function createEffects(random) {
  const stars = [];
  for (let i = 0; i < STAR_COUNT; i += 1) {
    stars.push({
      x: range(random, 0, FIELD.width),
      y: range(random, 0, FIELD.height),
      depth: range(random, 0.25, 1),
      size: range(random, 0.6, 2.1),
      phase: range(random, 0, Math.PI * 2),
    });
  }
  return {
    particles: [],
    rings: [],
    texts: [],
    stars,
    shake: 0,
    shakeX: 0,
    shakeY: 0,
    flash: 0,
    time: 0,
  };
}

export function clearEffects(fx) {
  fx.particles.length = 0;
  fx.rings.length = 0;
  fx.texts.length = 0;
  fx.shake = 0;
  fx.flash = 0;
}

function push(fx, particle) {
  if (fx.particles.length >= MAX_PARTICLES) fx.particles.shift();
  fx.particles.push(particle);
}

/** A puff of round sparks flying outward: used for impacts and deaths. */
export function spawnBurst(fx, x, y, color, count = 12, speed = 220, life = SPARK_LIFE) {
  for (let i = 0; i < count; i += 1) {
    const angle = (i / count) * Math.PI * 2 + Math.random() * 0.5;
    const v = speed * (0.45 + Math.random() * 0.75);
    push(fx, {
      kind: 'spark',
      x,
      y,
      vx: Math.cos(angle) * v,
      vy: Math.sin(angle) * v,
      life,
      max: life,
      size: 1.6 + Math.random() * 2.6,
      color,
      spin: 0,
      angle: 0,
    });
  }
}

/** Angular fragments that tumble as they fly: used when an enemy shatters. */
export function spawnShards(fx, x, y, color, count = 9, speed = 260) {
  for (let i = 0; i < count; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const v = speed * (0.35 + Math.random() * 0.9);
    push(fx, {
      kind: 'shard',
      x,
      y,
      vx: Math.cos(angle) * v,
      vy: Math.sin(angle) * v,
      life: SHARD_LIFE,
      max: SHARD_LIFE,
      size: 4 + Math.random() * 7,
      color,
      angle: Math.random() * Math.PI * 2,
      spin: (Math.random() - 0.5) * 12,
    });
  }
}

/** A ring that swells and fades: the shield catching a shot, a boss's shockwave. */
export function spawnRing(fx, x, y, color, from, to, width = 3, life = 0.4) {
  if (fx.rings.length >= MAX_RINGS) fx.rings.shift();
  fx.rings.push({ x, y, color, from, to, width, life, max: life });
}

/** A word that rises and fades: a combo count, a wave bonus. */
export function spawnText(fx, x, y, text, color, size = 22) {
  if (fx.texts.length >= MAX_TEXTS) fx.texts.shift();
  fx.texts.push({ x, y, text, color, size, life: 0.9, max: 0.9 });
}

export function addShake(fx, amount) {
  fx.shake = Math.min(26, fx.shake + amount);
}

export function addFlash(fx, amount) {
  fx.flash = Math.min(0.7, fx.flash + amount);
}

export function updateEffects(fx, dt) {
  fx.time += dt;

  for (let i = fx.particles.length - 1; i >= 0; i -= 1) {
    const p = fx.particles[i];
    p.life -= dt;
    if (p.life <= 0) {
      fx.particles.splice(i, 1);
      continue;
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    const drag = p.kind === 'spark' ? 3.2 : 1.5;
    const k = Math.max(0, 1 - drag * dt);
    p.vx *= k;
    p.vy *= k;
    if (p.kind === 'shard') p.angle += p.spin * dt;
  }

  for (let i = fx.rings.length - 1; i >= 0; i -= 1) {
    const r = fx.rings[i];
    r.life -= dt;
    if (r.life <= 0) fx.rings.splice(i, 1);
  }

  for (let i = fx.texts.length - 1; i >= 0; i -= 1) {
    const t = fx.texts[i];
    t.life -= dt;
    t.y -= 34 * dt;
    if (t.life <= 0) fx.texts.splice(i, 1);
  }

  if (fx.shake > 0) {
    fx.shake = Math.max(0, fx.shake - 42 * dt);
    const power = fx.shake;
    fx.shakeX = (Math.random() - 0.5) * power;
    fx.shakeY = (Math.random() - 0.5) * power;
  } else {
    fx.shakeX = 0;
    fx.shakeY = 0;
  }

  if (fx.flash > 0) fx.flash = Math.max(0, fx.flash - 2.4 * dt);
}

/** The parallax starfield and the arena haze. Drawn first, so everything else sits on top. */
export function drawBackdrop(ctx, fx, arena) {
  ctx.fillStyle = '#05070f';
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);

  const cx = FIELD.width / 2;
  const cy = FIELD.height / 2;
  const glow = ctx.createRadialGradient(cx, cy, 60, cx, cy, 620);
  glow.addColorStop(0, 'rgba(24,48,86,0.85)');
  glow.addColorStop(0.55, 'rgba(12,24,46,0.55)');
  glow.addColorStop(1, 'rgba(5,7,15,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);

  for (let i = 0; i < fx.stars.length; i += 1) {
    const s = fx.stars[i];
    const twinkle = 0.55 + 0.45 * Math.sin(fx.time * 1.6 + s.phase);
    ctx.globalAlpha = 0.25 + s.depth * 0.55 * twinkle;
    ctx.fillStyle = s.depth > 0.8 ? '#bfe9ff' : '#7f9ac4';
    const size = s.size * (0.7 + s.depth * 0.6);
    ctx.fillRect(s.x, s.y, size, size);
  }
  ctx.globalAlpha = 1;

  // The arena wall: a hexagon of light the player is held inside.
  ctx.save();
  ctx.strokeStyle = 'rgba(90,215,255,0.30)';
  ctx.lineWidth = 2;
  ctx.shadowColor = 'rgba(90,215,255,0.55)';
  ctx.shadowBlur = 18;
  ctx.beginPath();
  for (let i = 0; i <= 6; i += 1) {
    const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
    const x = cx + Math.cos(a) * arena.radius;
    const y = cy + Math.sin(a) * arena.radius;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.strokeStyle = 'rgba(70,120,180,0.16)';
  ctx.lineWidth = 1;
  for (let i = 1; i <= 3; i += 1) {
    ctx.beginPath();
    ctx.arc(cx, cy, (arena.radius / 4) * i, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

export function drawEffects(ctx, fx) {
  for (let i = 0; i < fx.particles.length; i += 1) {
    const p = fx.particles[i];
    const t = p.life / p.max;
    ctx.globalAlpha = Math.max(0, Math.min(1, t));
    if (p.kind === 'shard') {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle);
      ctx.fillStyle = p.color;
      const s = p.size * (0.4 + t * 0.6);
      ctx.beginPath();
      ctx.moveTo(0, -s);
      ctx.lineTo(s * 0.7, s * 0.8);
      ctx.lineTo(-s * 0.7, s * 0.8);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    } else {
      ctx.fillStyle = p.color;
      const s = p.size * (0.5 + t * 0.5);
      ctx.beginPath();
      ctx.arc(p.x, p.y, s, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;

  for (let i = 0; i < fx.rings.length; i += 1) {
    const r = fx.rings[i];
    const t = 1 - r.life / r.max;
    const radius = r.from + (r.to - r.from) * t;
    ctx.globalAlpha = Math.max(0, 1 - t);
    ctx.strokeStyle = r.color;
    ctx.lineWidth = r.width * (1 - t * 0.6);
    ctx.beginPath();
    ctx.arc(r.x, r.y, radius, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let i = 0; i < fx.texts.length; i += 1) {
    const t = fx.texts[i];
    ctx.globalAlpha = Math.max(0, Math.min(1, t.life / t.max));
    ctx.font = `700 ${t.size}px ${'system-ui, sans-serif'}`;
    ctx.fillStyle = t.color;
    ctx.fillText(t.text, t.x, t.y);
  }
  ctx.globalAlpha = 1;
}
