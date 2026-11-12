// The title's text effects: the multicoloured wordmark drops in letter by letter and lands
// like jelly, the script line flows on like wet ink, the letters keep a slow wave going at
// rest, and each letter jiggles under the pointer. All on gsap.ticker; nothing under
// reduced motion (the static wordmark is the designed state).
import { gsap } from 'gsap';

export function initTitle() {
  const word = document.querySelector<HTMLElement>('[data-wordmark]');
  const tag = document.querySelector<HTMLElement>('[data-tagline]');
  if (!word) return;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const chars = [...word.querySelectorAll<HTMLElement>('.ch')];

  // ---- entrance: drop, squash on landing, spring back
  const tl = gsap.timeline({ delay: 0.1 });
  chars.forEach((ch, i) => {
    const at = i * 0.065;
    const tilt = gsap.utils.random(-14, 14);
    tl.from(ch, { yPercent: -130, rotate: tilt, opacity: 0, duration: 0.42, ease: 'power2.in' }, at);
    tl.to(ch, { scaleY: 0.72, scaleX: 1.16, duration: 0.07, ease: 'power2.out' }, at + 0.42);
    tl.to(ch, { scaleY: 1, scaleX: 1, duration: 0.85, ease: 'elastic.out(1.1, 0.32)' }, at + 0.49);
  });

  // ---- the script flows on behind a feathered mask, like ink finding the paper
  if (tag) {
    gsap.set(tag, {
      webkitMaskImage: 'linear-gradient(90deg, #000 42%, transparent 58%)',
      maskImage: 'linear-gradient(90deg, #000 42%, transparent 58%)',
      webkitMaskSize: '260% 100%',
      maskSize: '260% 100%',
      webkitMaskRepeat: 'no-repeat',
      maskRepeat: 'no-repeat',
      maskPosition: '100% 0',
      webkitMaskPosition: '100% 0',
    });
    // a mask clips to the element's box, shadow included: drop it once the ink has landed
    tl.to(tag, {
      maskPosition: '0% 0', webkitMaskPosition: '0% 0', duration: 1.25, ease: 'power2.inOut',
      onComplete: () => gsap.set(tag, { clearProps: 'maskImage,webkitMaskImage,maskSize,webkitMaskSize,maskRepeat,webkitMaskRepeat,maskPosition,webkitMaskPosition' }),
    }, 0.55);
    tl.from(tag, { y: 10, duration: 1.1, ease: 'power3.out' }, 0.55);
  }

  // ---- idle: a slow wave across the letters once they have landed
  const setters = chars.map((ch) => gsap.quickSetter(ch, 'y', 'px') as (v: number) => void);
  let live = false;
  tl.add(() => (live = true));
  gsap.ticker.add(() => {
    if (!live) return;
    const t = performance.now() / 1000;
    const amp = word.getBoundingClientRect().height * 0.018;
    for (let i = 0; i < setters.length; i++) setters[i](Math.sin(t * 1.7 - i * 0.55) * amp);
  });

  // ---- the pointer: a letter jiggles as you pass it
  if (matchMedia('(hover: hover)').matches) {
    for (const ch of chars) {
      ch.addEventListener('pointerenter', () => {
        if (!live) return;
        gsap.timeline({ overwrite: 'auto' })
          .to(ch, { scaleY: 0.82, scaleX: 1.12, rotate: gsap.utils.random(-6, 6), duration: 0.09, ease: 'power2.out' })
          .to(ch, { scaleY: 1, scaleX: 1, rotate: 0, duration: 0.9, ease: 'elastic.out(1.2, 0.3)' });
      });
    }
  }
}
