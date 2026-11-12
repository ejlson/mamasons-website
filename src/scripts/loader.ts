// Lifts the scoop loader (src/components/ScoopLoader.astro) once `ready` resolves. It stays up at
// least until the first scoop has landed, so a warm cache never flashes it for a frame. There is
// no time limit: the still lineup underneath is never shown, so a slow or failed load keeps the
// loader up rather than uncovering it. Resolves as the fade starts, so the page's own entrance
// plays out underneath it.
const MIN_MS = 1200; // the first scoop lands at 0.85 s and settles by 1.15 s (scoops.css)
const FADE_MS = 900; // the drawing thins first, the cream follows (ScoopLoader's transition)

// Calm beats in the 6 s scoop loop, in ms: a scoop has just settled and nothing is in the air
// (one, two, then the full stack with its cherry), or the cone is empty again after the topple.
// The loader goes out on one of these rather than mid-drop.
const LOOP_MS = 6000;
const CALM: [number, number][] = [[1150, 1300], [2060, 2200], [2960, 3300], [5700, 6390]];
const MAX_WAIT_MS = 700; // a calm beat further off than this isn't worth holding the page for

function untilCalm(el: HTMLElement): Promise<void> {
  const a = el.querySelector('.s1')?.getAnimations()[0];
  const t = typeof a?.currentTime === 'number' ? a.currentTime % LOOP_MS : null;
  if (t === null) return Promise.resolve();
  let wait = Infinity;
  for (const [from, to] of CALM) {
    for (const shift of [0, LOOP_MS]) {
      const s = from + shift, e = to + shift;
      if (t >= s && t <= e - 120) wait = 0; // inside one, with room to spare
      else if (s > t) wait = Math.min(wait, s - t);
    }
  }
  return wait <= MAX_WAIT_MS ? new Promise((r) => setTimeout(r, wait)) : Promise.resolve();
}

export function liftLoader(ready: Promise<unknown>): Promise<void> {
  const el = document.querySelector<HTMLElement>('[data-loader]');
  if (!el) return ready.then(() => undefined, () => undefined);
  const shown = performance.now();
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  return ready
    .then(() => new Promise((r) => setTimeout(r, Math.max(0, MIN_MS - (performance.now() - shown)))))
    .then(() => (reduce ? undefined : untilCalm(el)))
    .then(() => {
      el.classList.add('is-done');
      setTimeout(() => { el.hidden = true; }, reduce ? 0 : FADE_MS);
    });
}

/** Puts the loader back over the page at once, for a page that has to start again underneath. */
export function coverAgain() {
  const el = document.querySelector<HTMLElement>('[data-loader]');
  if (!el) return;
  el.style.transition = 'none';
  el.hidden = false;
  el.classList.remove('is-done');
}
