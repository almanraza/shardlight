// The foes the player faces, and how each one thinks. Every kind is a plain object advanced by
// one fixed step; an enemy asks the world to fire by calling the `fire` callback it is handed,
// so this module never needs the world's own code and the two stay separable.

import { COMBO } from './config.js';

export const KIND_DRIFTER = 'drifter';
export const KIND_SPINNER = 'spinner';
export const KIND_CHARGER = 'charger';
export const KIND_SPLITTER = 'splitter';
export const KIND_SENTINEL = 'sentinel';

/** What each kind is worth, how tough it is and how it looks. */
export const ENEMY_SPEC = {
  [KIND_DRIFTER]: { hp: 2, radius: 16, points: 25, color: '#ff5f7e', sides: 3, contact: true },
  [KIND_SPINNER]: { hp: 3, radius: 18, points: 40, color: '#ff8ab0', sides: 6, contact: true },
  [KIND_CHARGER]: { hp: 2, radius: 17, points: 35, color: '#ffa63d', sides: 4, contact: true },
  [KIND_SPLITTER]: { hp: 4, radius: 22, points: 50, color: '#c07bff', sides: 5, contact: true },
  [KIND_SENTINEL]: { hp: 26, radius: 52, points: 400, color: '#c07bff', sides: 8, contact: true, boss: true },
};

const TAU = Math.PI * 2;

function angleTo(ax, ay, bx, by) {
  return Math.atan2(by - ay, bx - ax);
}

/** Keep an enemy inside the arena, reflecting the velocity it hits the wall with. */
function contain(enemy, arena) {
  const dx = enemy.x - arena.x;
  const dy = enemy.y - arena.y;
  const dist = Math.hypot(dx, dy);
  const limit = arena.radius - enemy.radius;
  if (dist > limit && dist > 0) {
    const nx = dx / dist;
    const ny = dy / dist;
    enemy.x = arena.x + nx * limit;
    enemy.y = arena.y + ny * limit;
    const dot = enemy.vx * nx + enemy.vy * ny;
    if (dot > 0) {
      enemy.vx -= 2 * dot * nx;
      enemy.vy -= 2 * dot * ny;
    }
  }
}

export function createEnemy(kind, x, y, wave) {
  const spec = ENEMY_SPEC[kind];
  const hp = spec.boss ? spec.hp + wave * 2 : spec.hp + Math.floor(wave / 4);
  return {
    kind,
    x,
    y,
    vx: 0,
    vy: 0,
    radius: spec.radius,
    hp,
    maxHp: hp,
    points: spec.points,
    color: spec.color,
    sides: spec.sides,
    boss: Boolean(spec.boss),
    contact: spec.contact,
    cooldown: 1.1 + Math.random() * 0,
    burst: spec.boss ? 3.4 : 0,
    age: 0,
    hitFlash: 0,
    spin: 0,
    orbit: Math.atan2(y - 360, x - 640),
    alive: true,
    spawn: 0.45,
  };
}

/**
 * Advance one enemy by dt. `fire(x, y, angle, speed)` asks the world for a shot; `wave` scales
 * the foe's speed and rate. Returns nothing; it mutates the enemy in place.
 */
export function updateEnemy(enemy, player, dt, wave, arena, fire) {
  enemy.age += dt;
  if (enemy.hitFlash > 0) enemy.hitFlash = Math.max(0, enemy.hitFlash - dt * 4);
  if (enemy.spawn > 0) enemy.spawn = Math.max(0, enemy.spawn - dt);
  const shotSpeed = Math.min(330, 205 + (wave - 1) * 9);
  const toPlayer = angleTo(enemy.x, enemy.y, player.x, player.y);
  const dx = player.x - enemy.x;
  const dy = player.y - enemy.y;
  const dist = Math.hypot(dx, dy) || 1;

  switch (enemy.kind) {
    case KIND_DRIFTER: {
      // Holds a close ring around the player and fires often: the main source of deflections.
      const want = 165;
      const pull = dist > want ? 1 : -0.85;
      enemy.vx += ((dx / dist) * 150 * pull - enemy.vx * 2.2) * dt;
      enemy.vy += ((dy / dist) * 150 * pull - enemy.vy * 2.2) * dt;
      enemy.spin += dt * 0.6;
      enemy.cooldown -= dt;
      if (enemy.cooldown <= 0) {
        enemy.cooldown = Math.max(0.6, 1.45 - wave * 0.05);
        fire(enemy.x, enemy.y, toPlayer, shotSpeed);
      }
      break;
    }
    case KIND_SPINNER: {
      // Sweeps the arena wall in a slow orbit, firing a fan at the player.
      enemy.orbit += dt * 0.55;
      const targetX = arena.x + Math.cos(enemy.orbit) * arena.radius * 0.62;
      const targetY = arena.y + Math.sin(enemy.orbit) * arena.radius * 0.62;
      enemy.vx += ((targetX - enemy.x) * 2.2 - enemy.vx * 3.4) * dt;
      enemy.vy += ((targetY - enemy.y) * 2.2 - enemy.vy * 3.4) * dt;
      enemy.spin -= dt * 1.4;
      enemy.cooldown -= dt;
      if (enemy.cooldown <= 0) {
        enemy.cooldown = Math.max(1.0, 2.1 - wave * 0.07);
        const spread = 0.34;
        for (let i = -2; i <= 2; i += 1) fire(enemy.x, enemy.y, toPlayer + i * spread, shotSpeed * 0.92);
      }
      break;
    }
    case KIND_CHARGER: {
      // Rushes the player and never shoots: it can only be answered with a turned shot.
      const speed = 150 + wave * 7;
      enemy.vx += ((dx / dist) * speed * 2.4 - enemy.vx * 2.2) * dt;
      enemy.vy += ((dy / dist) * speed * 2.4 - enemy.vy * 2.2) * dt;
      const cap = speed;
      const mag = Math.hypot(enemy.vx, enemy.vy);
      if (mag > cap) {
        enemy.vx = (enemy.vx / mag) * cap;
        enemy.vy = (enemy.vy / mag) * cap;
      }
      enemy.spin += dt * 3;
      break;
    }
    case KIND_SPLITTER: {
      // Lumbers forward, firing slow heavy shots, and breaks into two when it dies.
      enemy.vx += ((dx / dist) * 70 - enemy.vx * 1.4) * dt;
      enemy.vy += ((dy / dist) * 70 - enemy.vy * 1.4) * dt;
      enemy.spin += dt * 0.4;
      enemy.cooldown -= dt;
      if (enemy.cooldown <= 0) {
        enemy.cooldown = Math.max(1.2, 2.2 - wave * 0.05);
        fire(enemy.x, enemy.y, toPlayer, shotSpeed * 0.85);
      }
      break;
    }
    case KIND_SENTINEL: {
      // Drifts across the middle, volleying at the player and bursting in rings.
      enemy.vx += (Math.cos(enemy.age * 0.6) * 90 - enemy.vx * 1.6) * dt;
      enemy.vy += (Math.sin(enemy.age * 0.45) * 70 - enemy.vy * 1.6) * dt;
      enemy.spin += dt * 0.25;
      enemy.cooldown -= dt;
      if (enemy.cooldown <= 0) {
        enemy.cooldown = 1.7;
        for (let i = -2; i <= 2; i += 1) fire(enemy.x, enemy.y, toPlayer + i * 0.22, shotSpeed);
      }
      enemy.burst -= dt;
      if (enemy.burst <= 0) {
        enemy.burst = 3.4;
        const count = 12;
        for (let i = 0; i < count; i += 1) fire(enemy.x, enemy.y, (i / count) * TAU + enemy.age * 0.3, shotSpeed * 0.8);
      }
      break;
    }
    default:
      break;
  }

  contain(enemy, arena);
  enemy.x += enemy.vx * dt;
  enemy.y += enemy.vy * dt;
  contain(enemy, arena);
}

/** The foes that make up a wave: a mix that changes as the run goes on, a boss every fifth. */
export function waveRoster(wave, arena, random) {
  const roster = [];
  const place = () => {
    const angle = random() * TAU;
    const r = arena.radius * (0.55 + random() * 0.32);
    return { x: arena.x + Math.cos(angle) * r, y: arena.y + Math.sin(angle) * r };
  };

  if (wave % 5 === 0) {
    roster.push({ kind: KIND_SENTINEL, ...place() });
    for (let i = 0; i < Math.min(3, 1 + Math.floor(wave / 5)); i += 1) roster.push({ kind: KIND_DRIFTER, ...place() });
    return roster;
  }

  const total = Math.min(11, 2 + Math.floor(wave * 1.05));
  for (let i = 0; i < total; i += 1) {
    let kind = KIND_DRIFTER;
    if (wave >= 3 && i % 5 === 2) kind = KIND_SPINNER;
    if (wave >= 4 && i % 7 === 3) kind = KIND_CHARGER;
    if (wave >= 6 && i % 6 === 4) kind = KIND_SPLITTER;
    roster.push({ kind, ...place() });
  }
  return roster;
}

export { TAU };
