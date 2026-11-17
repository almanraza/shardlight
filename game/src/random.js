// A small seeded random number generator (mulberry32): the same seed gives the same game,
// which is what makes the screenshot scenes repeatable.

export function createRandom(seed) {
  let a = seed | 0;
  return function random() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A random number in [min, max) from a generator. */
export function range(random, min, max) {
  return min + random() * (max - min);
}

/** A random integer in [min, max] from a generator. */
export function rangeInt(random, min, max) {
  return Math.floor(min + random() * (max - min + 1));
}

/** One of the entries of `list`, chosen by a generator. */
export function pick(random, list) {
  return list[Math.min(list.length - 1, Math.floor(random() * list.length))];
}
