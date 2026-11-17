// The simulation. Everything that happens in the arena lives here: the player's shard and its
// shield, the hostile fire, the deflect rule that turns fire back, the waves, the combo and the
// score. It advances in fixed steps and never touches the canvas or the browser, so the same
// inputs always give the same run and the screenshot scenes can replay it.

import { COMBO, FIELD, PLAYER, PROJECTILE, WAVE } from './config.js';
import { createEffects, clearEffects, spawnBurst, spawnRing, spawnShards, spawnText, addShake, addFlash, updateEffects } from './effects.js';
import { createEnemy, updateEnemy, waveRoster, TAU } from './enemies.js';

export const EVENT_HIT = 1;
export const EVENT_OVER = 2;
export const EVENT_WAVE = 4;
export const EVENT_DEFLECT = 8;
export const EVENT_KILL = 16;
export const EVENT_CLEAR = 32;
export const EVENT_DEPLETED = 64;

export const ARENA = { x: FIELD.width / 2, y: FIELD.height / 2, radius: 348 };

const MAX_PROJECTILES = 260;

export function createWorld(random) {
  const fx = createEffects(random);
  const state = {
    player: {
      x: ARENA.x,
      y: ARENA.y + 140,
      vx: 0,
      vy: 0,
      lives: PLAYER.lives,
      invulnerable: 0,
      shield: 1,
      shieldDown: false,
      regenWait: 0,
      shielding: false,
      aim: -Math.PI / 2,
      trail: [],
    },
    enemies: [],
    projectiles: [],
    score: 0,
    wave: 1,
    combo: 0,
    comboTimer: 0,
    bestCombo: 0,
    waveBanner: 0,
    waveName: '',
    spawnQueue: [],
    spawnTimer: 0,
    over: false,
    time: 0,
    deflections: 0,
    kills: 0,
    fx,
  };

  function reset() {
    const p = state.player;
    p.x = ARENA.x;
    p.y = ARENA.y + 140;
    p.vx = 0;
    p.vy = 0;
    p.lives = PLAYER.lives;
    p.invulnerable = 1.2;
    p.shield = 1;
    p.shieldDown = false;
    p.regenWait = 0;
    p.shielding = false;
    p.trail.length = 0;
    state.enemies.length = 0;
    state.projectiles.length = 0;
    state.score = 0;
    state.wave = 1;
    state.combo = 0;
    state.comboTimer = 0;
    state.bestCombo = 0;
    state.over = false;
    state.time = 0;
    state.deflections = 0;
    state.kills = 0;
    clearEffects(fx);
    beginWave(1);
  }

  function beginWave(wave) {
    state.wave = wave;
    state.spawnQueue = waveRoster(wave, ARENA, random);
    state.spawnTimer = 0;
    state.waveBanner = WAVE.banner;
    state.waveName = wave % WAVE.bossEvery === 0 ? `SENTINEL  ·  WAVE ${wave}` : `WAVE ${wave}`;
  }

  /** Push a shot into the arena. Hostile shots come from enemies; friendly ones are turned back. */
  function fire(x, y, angle, speed, hostile = true) {
    if (state.projectiles.length >= MAX_PROJECTILES) state.projectiles.shift();
    state.projectiles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      radius: PROJECTILE.radius,
      hostile,
      life: PROJECTILE.life,
      spin: 0,
    });
  }

  /**
   * Enemy fire leads the player: it aims where the shard will be when the shot arrives, so a
   * player who only drifts in a straight line is caught and has to use the ring. Without this a
   * foe that keeps its distance can never be answered and a wave stalls forever.
   */
  function fireAtPlayer(x, y, speed) {
    const p = state.player;
    const dx = p.x - x;
    const dy = p.y - y;
    const dist = Math.hypot(dx, dy) || 1;
    const travel = dist / Math.max(1, speed);
    const lead = Math.min(0.55, travel);
    const tx = p.x + p.vx * lead;
    const ty = p.y + p.vy * lead;
    fire(x, y, Math.atan2(ty - y, tx - x), speed, true);
  }

  /** Turn a hostile shot back at whoever fired it, faster and marked as the player's. */
  function deflect(shot) {
    const p = state.player;
    const angle = Math.atan2(shot.y - p.y, shot.x - p.x);
    const speed = Math.hypot(shot.vx, shot.vy) * PROJECTILE.deflectSpeed;
    shot.hostile = false;
    shot.vx = Math.cos(angle) * speed;
    shot.vy = Math.sin(angle) * speed;
    shot.life = PROJECTILE.life;
    shot.spin = 1;

    if (state.comboTimer > 0) state.combo = Math.min(COMBO.max, state.combo + 1);
    else state.combo = 1;
    state.comboTimer = COMBO.window;
    if (state.combo > state.bestCombo) state.bestCombo = state.combo;
    state.deflections += 1;

    spawnRing(fx, p.x, p.y, '#7ef0ff', PLAYER.shieldRadius - 6, PLAYER.shieldRadius + 26, 3, 0.34);
    spawnBurst(fx, shot.x, shot.y, '#eafcff', 7, 260, 0.34);
    addShake(fx, 2.4);
    if (state.combo > 1) {
      spawnText(fx, p.x, p.y - 42, `x${state.combo}`, '#ffd166', 20 + Math.min(12, state.combo * 2));
    }
  }

  function multiplier() {
    return 1 + Math.min(state.combo, COMBO.max) * 0.25;
  }

  function damagePlayer() {
    const p = state.player;
    if (p.invulnerable > 0 || state.over) return 0;
    p.lives -= 1;
    p.invulnerable = PLAYER.invulnerable;
    state.combo = 0;
    state.comboTimer = 0;
    addShake(fx, 18);
    addFlash(fx, 0.45);
    spawnBurst(fx, p.x, p.y, '#ff5f7e', 22, 300, 0.7);
    spawnRing(fx, p.x, p.y, '#ff5f7e', 10, 120, 5, 0.5);
    if (p.lives <= 0) {
      state.over = true;
      return EVENT_HIT | EVENT_OVER;
    }
    return EVENT_HIT;
  }

  function hurtEnemy(enemy, damage, hitX, hitY) {
    enemy.hp -= damage;
    enemy.hitFlash = 1;
    if (enemy.hp > 0) {
      spawnBurst(fx, hitX, hitY, enemy.color, 6, 200, 0.32);
      if (enemy.boss) spawnBurst(fx, hitX, hitY, '#ffd0d8', 8, 240, 0.4);
      return false;
    }
    enemy.alive = false;
    state.kills += 1;
    const gained = Math.round(enemy.points * multiplier());
    state.score += gained;
    spawnShards(fx, enemy.x, enemy.y, enemy.color, enemy.boss ? 34 : 10, enemy.boss ? 380 : 250);
    spawnRing(fx, enemy.x, enemy.y, enemy.color, 8, enemy.boss ? 220 : 74, 3, enemy.boss ? 0.8 : 0.42);
    spawnText(fx, enemy.x, enemy.y - 18, `+${gained}`, '#ffd166', enemy.boss ? 34 : 20);
    addShake(fx, enemy.boss ? 22 : 5);
    if (enemy.boss) addFlash(fx, 0.35);
    return true;
  }

  function step(dt, move, shieldWanted) {
    if (state.over) {
      updateEffects(fx, dt);
      return 0;
    }
    state.time += dt;
    let events = 0;

    const p = state.player;
    if (p.invulnerable > 0) p.invulnerable = Math.max(0, p.invulnerable - dt);

    // --- the shard: acceleration, damping, and the arena wall -------------------------------
    p.vx += move.x * PLAYER.accel * dt;
    p.vy += move.y * PLAYER.accel * dt;
    const damp = Math.pow(PLAYER.damping, dt * 60);
    p.vx *= damp;
    p.vy *= damp;
    const speed = Math.hypot(p.vx, p.vy);
    if (speed > PLAYER.maxSpeed) {
      p.vx = (p.vx / speed) * PLAYER.maxSpeed;
      p.vy = (p.vy / speed) * PLAYER.maxSpeed;
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;

    const dx = p.x - ARENA.x;
    const dy = p.y - ARENA.y;
    const dist = Math.hypot(dx, dy);
    const limit = ARENA.radius - PLAYER.radius;
    if (dist > limit) {
      const nx = dx / dist;
      const ny = dy / dist;
      p.x = ARENA.x + nx * limit;
      p.y = ARENA.y + ny * limit;
      const dot = p.vx * nx + p.vy * ny;
      if (dot > 0) {
        p.vx -= 2 * dot * nx;
        p.vy -= 2 * dot * ny;
      }
      spawnBurst(fx, p.x, p.y, '#5ad7ff', 3, 120, 0.24);
    }

    if (speed > 20) p.aim = Math.atan2(p.vy, p.vx);
    p.trail.unshift({ x: p.x, y: p.y });
    if (p.trail.length > PLAYER.trailLength) p.trail.pop();

    // --- the shield: a held ring that turns hostile fire back ---------------------------------
    if (p.shieldDown) {
      p.regenWait = Math.max(0, p.regenWait - dt);
      if (p.regenWait <= 0) {
        p.shield = Math.min(1, p.shield + PLAYER.shieldRegen * dt);
        if (p.shield >= 1) p.shieldDown = false;
      }
    }
    p.shielding = Boolean(shieldWanted) && !p.shieldDown && p.shield > 0.05;
    if (p.shielding) {
      p.shield -= PLAYER.shieldDrain * dt;
      if (p.shield <= 0) {
        p.shield = 0;
        p.shieldDown = true;
        p.regenWait = PLAYER.shieldRegenDelay;
        spawnRing(fx, p.x, p.y, '#5ad7ff', PLAYER.shieldRadius, PLAYER.shieldRadius + 70, 3, 0.4);
        addShake(fx, 5);
        events |= EVENT_DEPLETED;
      }
    } else if (!p.shieldDown) {
      p.shield = Math.min(1, p.shield + PLAYER.shieldRegen * 0.6 * dt);
    }

    if (state.comboTimer > 0) {
      state.comboTimer -= dt;
      if (state.comboTimer <= 0) state.combo = 0;
    }

    // --- spawning the wave --------------------------------------------------------------------
    if (state.spawnQueue.length > 0) {
      state.spawnTimer -= dt;
      if (state.spawnTimer <= 0) {
        const entry = state.spawnQueue.shift();
        const enemy = createEnemy(entry.kind, entry.x, entry.y, state.wave);
        state.enemies.push(enemy);
        spawnRing(fx, entry.x, entry.y, enemy.color, 4, enemy.radius + 40, 3, 0.45);
        state.spawnTimer = enemy.boss ? 0.9 : 0.34;
      }
    } else if (state.enemies.length === 0) {
      const bonus = WAVE.clearBonus * state.wave;
      state.score += bonus;
      events |= EVENT_CLEAR;
      spawnText(fx, ARENA.x, ARENA.y - 60, `WAVE CLEAR  +${bonus}`, '#7ef0ff', 30);
      beginWave(state.wave + 1);
      events |= EVENT_WAVE;
    }

    if (state.waveBanner > 0) state.waveBanner = Math.max(0, state.waveBanner - dt);

    // --- the foes ------------------------------------------------------------------------------
    for (let i = 0; i < state.enemies.length; i += 1) {
      const enemy = state.enemies[i];
      if (!enemy.alive) continue;
      updateEnemy(enemy, p, dt, state.wave, ARENA, (x, y, angle, spd) => fireAtPlayer(x, y, spd));
      if (enemy.spawn > 0) continue;
      const gap = Math.hypot(enemy.x - p.x, enemy.y - p.y);
      if (enemy.contact && gap < enemy.radius + PLAYER.radius && p.invulnerable <= 0) {
        const hit = damagePlayer();
        events |= hit;
        if (state.over) break;
        const push = Math.atan2(enemy.y - p.y, enemy.x - p.x);
        enemy.vx += Math.cos(push) * 260;
        enemy.vy += Math.sin(push) * 260;
      }
    }
    if (state.over) {
      updateEffects(fx, dt);
      return events;
    }

    // --- the fire, and the deflect -------------------------------------------------------------
    for (let i = state.projectiles.length - 1; i >= 0; i -= 1) {
      const shot = state.projectiles[i];
      shot.life -= dt;
      shot.x += shot.vx * dt;
      shot.y += shot.vy * dt;
      shot.spin += dt * 8;

      if (shot.life <= 0) {
        state.projectiles.splice(i, 1);
        continue;
      }
      const wall = Math.hypot(shot.x - ARENA.x, shot.y - ARENA.y);
      if (wall > ARENA.radius) {
        spawnBurst(fx, shot.x, shot.y, shot.hostile ? '#ff8ab0' : '#7ef0ff', 4, 140, 0.3);
        state.projectiles.splice(i, 1);
        continue;
      }

      const gap = Math.hypot(shot.x - p.x, shot.y - p.y);

      // A turned shot seeks the nearest foe: the ring's answer always finds its mark, so a foe
      // that keeps its distance can never stall a wave.
      if (!shot.hostile) {
        let target = null;
        let bestDist = Infinity;
        for (let j = 0; j < state.enemies.length; j += 1) {
          const e = state.enemies[j];
          if (!e.alive || e.spawn > 0) continue;
          const d = Math.hypot(e.x - shot.x, e.y - shot.y);
          if (d < bestDist) {
            bestDist = d;
            target = e;
          }
        }
        if (target) {
          const speed = Math.hypot(shot.vx, shot.vy) || 1;
          const want = Math.atan2(target.y - shot.y, target.x - shot.x);
          const have = Math.atan2(shot.vy, shot.vx);
          let delta = want - have;
          while (delta > Math.PI) delta -= Math.PI * 2;
          while (delta < -Math.PI) delta += Math.PI * 2;
          const turn = Math.max(-6 * dt, Math.min(6 * dt, delta));
          const angle = have + turn;
          shot.vx = Math.cos(angle) * speed;
          shot.vy = Math.sin(angle) * speed;
        }
      }

      if (shot.hostile) {
        // The ring turns it back; the body takes the hit.
        if (p.shielding && gap < PLAYER.shieldRadius + shot.radius) {
          deflect(shot);
          events |= EVENT_DEFLECT;
          continue;
        }
        if (gap < PLAYER.radius + shot.radius && p.invulnerable <= 0) {
          state.projectiles.splice(i, 1);
          const hit = damagePlayer();
          events |= hit;
          if (state.over) break;
          continue;
        }
      } else {
        // The player's own fire breaks the foes.
        let spent = false;
        for (let j = 0; j < state.enemies.length; j += 1) {
          const enemy = state.enemies[j];
          if (!enemy.alive || enemy.spawn > 0) continue;
          if (Math.hypot(enemy.x - shot.x, enemy.y - shot.y) < enemy.radius + shot.radius) {
            const dead = hurtEnemy(enemy, 1, shot.x, shot.y);
            if (dead) events |= EVENT_KILL;
            spent = true;
            break;
          }
        }
        if (spent) {
          state.projectiles.splice(i, 1);
          continue;
        }
      }
    }

    // Clear out the dead, splitting any splitter that fell.
    for (let i = state.enemies.length - 1; i >= 0; i -= 1) {
      const enemy = state.enemies[i];
      if (enemy.alive) continue;
      state.enemies.splice(i, 1);
      if (enemy.kind === 'splitter') {
        for (let k = 0; k < 2; k += 1) {
          const angle = (k / 2) * TAU + random() * 0.7;
          const child = createEnemy('drifter', enemy.x + Math.cos(angle) * 26, enemy.y + Math.sin(angle) * 26, state.wave);
          child.hp = 1;
          child.maxHp = 1;
          child.points = 12;
          child.spawn = 0.2;
          state.enemies.push(child);
        }
      }
    }

    updateEffects(fx, dt);
    return events;
  }

  reset();
  return { state, reset, step, fire };
}
