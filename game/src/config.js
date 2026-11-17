// Every tuning number and colour in one place. The playfield is a fixed 1280x720 logical
// area; the renderer scales it to the window, so no rule below depends on the screen size.

export const FIELD = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

export const PLAYER = {
  radius: 15,
  accel: 2500,
  /** Velocity kept each step: a light shard, so it answers at once and still drifts. */
  damping: 0.9,
  maxSpeed: 400,
  lives: 3,
  invulnerable: 1.7,
  /** The ring a held shield draws around the shard, and the reach that turns a shot back. */
  shieldRadius: 62,
  shieldDrain: 0.34,
  shieldRegen: 0.4,
  shieldRegenDelay: 0.32,
  trailLength: 16,
};

export const PROJECTILE = {
  radius: 7,
  speed: 215,
  speedPerWave: 10,
  maxSpeed: 350,
  /** A turned shot flies this much faster than it came. */
  deflectSpeed: 1.7,
  life: 8,
};

/** Consecutive turns of enemy fire, and how long a gap breaks the chain. */
export const COMBO = { window: 2.8, max: 9 };

export const WAVE = { banner: 2.1, clearBonus: 60, bossEvery: 5 };

export const PALETTE = {
  void: '#05070f',
  deep: '#0a1020',
  haze: '#12203a',
  shard: '#7ef0ff',
  shardCore: '#eafcff',
  shield: '#5ad7ff',
  enemy: '#ff5f7e',
  enemyCore: '#ffd0d8',
  charger: '#ffa63d',
  boss: '#c07bff',
  gold: '#ffd166',
  text: '#eaf2ff',
  muted: '#7d8aa6',
  panel: 'rgba(9,16,30,0.74)',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'shardlight.best';
