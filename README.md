# Shardlight

[![make.fun best game](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01)
[![rank](https://make.fun/badge/best-game-01/almanraza/shardlight/rank.svg)](https://make.fun/bounty/best-game-01)
[![reward](https://make.fun/badge/best-game-01/almanraza/shardlight/reward.svg)](https://make.fun/bounty/best-game-01)

An arena game for the browser. You drift a shard of light through the fire of geometric foes and
hold a ring of light to **turn their shots back at them** — faster than they came, and chained into
a combo multiplier. Clear every wave; a Sentinel arrives every fifth.

Built for [make.fun's *Make the best game* bounty](https://make.fun/bounty/best-game-01).

## Play

```bash
node serve.ts          # serves game/ at http://localhost:8080
```

Or open `game/index.html` from any static file server. No build step, no network request, no
library: the whole game is plain ES modules and a canvas.

## Controls

| Key | Action |
| --- | --- |
| `WASD` / arrow keys | Drift the shard |
| `Space` (hold) | Raise the shield ring — turns hostile fire back |
| `P` / `Escape` | Pause |
| `M` | Mute |
| `Space` / click | Start, restart |

## How it plays

The shard has no gun. Every shot you fire is a shot an enemy fired at you first, caught on the
ring and sent home. That makes the game a game of positioning rather than aiming: you have to be
where the fire is, with the ring up, without being where the fire lands.

- **Deflect** — a turned shot seeks the nearest foe, so the ring's answer always finds its mark.
- **Combo** — turns made within 2.8 s of each other chain, up to ×9, and each step adds 25% to the
  score of whatever that shot breaks.
- **Shield** — the ring drains while held and recharges when lowered. Run it dry and it locks out
  for a moment, which is usually when you get hit.
- **Foes** — Drifters hold a close ring and fire often; Spinners sweep the wall with fans; Chargers
  rush and never shoot, so they can only be answered with a turned shot; Splitters break into two
  when they die; the Sentinel volleys and bursts in rings.
- **Waves** — each cleared wave pays a bonus and brings more, faster foes.

## Layout

```
main.ts                 hands the entry in: copies game/ and screenshots/, writes dossier.json
serve.ts                a static server for local play
game/index.html         the page
game/src/config.js      every tuning number and colour
game/src/random.js      a seeded generator, so a seed always gives the same run
game/src/input.js       keyboard and pointer, with one-shot presses queued
game/src/audio.js       all sound, synthesised with Web Audio (no audio files)
game/src/effects.js     sparks, shards, rings, score words, shake, starfield
game/src/enemies.js     the five foe kinds and how each one thinks
game/src/world.js       the simulation: shard, shield, deflect, waves, combo, score
game/src/render.js      the arena, the HUD and the four screens
game/src/shots.js       the deterministic scenes behind ?shot=
game/src/main.js        boot and the fixed-step loop
screenshots/            four real renders of the game
vendor/makefun-game.ts  the kit's dossier library, unchanged
```

The simulation never touches the canvas or the browser, so the same inputs always give the same
run — which is what lets `?shot=play&seed=7` reproduce a screenshot exactly.

## Screenshots

`?shot=title|play|combo|over&seed=N` stages each scene by playing the real rules forward with a
simple autopilot, then paints it. They are renders of the game's own code, never edited.

## Licence

MIT — see [LICENSE](LICENSE).
