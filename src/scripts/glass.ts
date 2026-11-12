// Liquid glass, after Apple's material: the panel refracts what is behind it near its rim
// and catches a specular highlight on its edge.
//
// Technique (LogRocket, "How to create liquid glass effects with CSS and SVG"): an SVG filter
// used as a backdrop-filter. feDisplacementMap bends the backdrop with a map whose red and
// green channels push pixels inward near the edges (128 = no shift); a rim map adds the
// highlight. Maps are drawn here per element, at its exact size and radius, and redrawn on
// resize, since a stretched map bends wrongly. Only Chromium renders an SVG backdrop-filter;
// every other browser keeps the CSS frosted fallback in base.css.

const SVG_NS = 'http://www.w3.org/2000/svg';

function isChromium() {
  const brands = (navigator as Navigator & { userAgentData?: { brands: { brand: string }[] } }).userAgentData?.brands;
  return !!brands?.some((b) => /Chromium|Google Chrome|Microsoft Edge/.test(b.brand));
}

// signed distance to a rounded rectangle centred on 0, half-size (hx, hy), radius r
function sdRoundRect(x: number, y: number, hx: number, hy: number, r: number) {
  const qx = Math.abs(x) - hx + r;
  const qy = Math.abs(y) - hy + r;
  const ox = Math.max(qx, 0), oy = Math.max(qy, 0);
  return Math.min(Math.max(qx, qy), 0) + Math.hypot(ox, oy) - r;
}

function maps(w: number, h: number, r: number, bevel: number) {
  const scale = 0.5; // half-resolution maps are plenty: the filter interpolates
  const cw = Math.max(2, Math.round(w * scale)), ch = Math.max(2, Math.round(h * scale));
  const disp = document.createElement('canvas');
  disp.width = cw;
  disp.height = ch;
  const spec = document.createElement('canvas');
  spec.width = cw;
  spec.height = ch;
  const dctx = disp.getContext('2d')!, sctx = spec.getContext('2d')!;
  const dImg = dctx.createImageData(cw, ch), sImg = sctx.createImageData(cw, ch);
  const hx = w / 2, hy = h / 2, e = 1;
  for (let j = 0; j < ch; j++) {
    for (let i = 0; i < cw; i++) {
      const x = (i + 0.5) / scale - hx, y = (j + 0.5) / scale - hy;
      const d = sdRoundRect(x, y, hx, hy, r); // negative inside
      const k = (j * cw + i) * 4;
      // gradient of the distance field = the outward normal
      const nx = sdRoundRect(x + e, y, hx, hy, r) - sdRoundRect(x - e, y, hx, hy, r);
      const ny = sdRoundRect(x, y + e, hx, hy, r) - sdRoundRect(x, y - e, hx, hy, r);
      const nl = Math.hypot(nx, ny) || 1;
      // refraction profile: zero in the middle, rising steeply into the rim, like a lens edge
      const t = d < 0 ? Math.max(0, 1 + d / bevel) : 0;
      const f = t * t * t;
      dImg.data[k] = 128 - (nx / nl) * f * 127;
      dImg.data[k + 1] = 128 - (ny / nl) * f * 127;
      dImg.data[k + 2] = 128;
      dImg.data[k + 3] = 255;
      // specular rim: a thin bright band on the edge, strongest top-left
      const rim = d < 0 ? Math.max(0, 1 - Math.abs(d + 1.2) / 2.2) : 0;
      const light = Math.max(0, (-(nx / nl) * 0.6 - (ny / nl) * 0.8)) * 0.85 + 0.15;
      const a = rim * light;
      sImg.data[k] = sImg.data[k + 1] = sImg.data[k + 2] = 255;
      sImg.data[k + 3] = Math.round(a * 255);
    }
  }
  dctx.putImageData(dImg, 0, 0);
  sctx.putImageData(sImg, 0, 0);
  return { disp: disp.toDataURL(), spec: spec.toDataURL() };
}

let host: SVGSVGElement | null = null;
let seq = 0;

function filterHost() {
  if (host) return host;
  host = document.createElementNS(SVG_NS, 'svg');
  host.setAttribute('aria-hidden', 'true');
  host.setAttribute('width', '0');
  host.setAttribute('height', '0');
  host.style.position = 'absolute';
  document.body.appendChild(host);
  return host;
}

function build(el: HTMLElement, id: string) {
  const w = el.offsetWidth, h = el.offsetHeight;
  if (!w || !h) return;
  const r = Math.min(parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0, h / 2, w / 2);
  const bevel = Math.min(Math.max(10, Math.min(w, h) * 0.32), 28);
  const strength = Number(el.dataset.glass || 1);
  const { disp, spec } = maps(w, h, r, bevel);
  let f = document.getElementById(id);
  if (!f) {
    f = document.createElementNS(SVG_NS, 'filter');
    f.id = id;
    f.setAttribute('color-interpolation-filters', 'sRGB');
    filterHost().appendChild(f);
  }
  f.setAttribute('x', '0');
  f.setAttribute('y', '0');
  f.setAttribute('width', String(w));
  f.setAttribute('height', String(h));
  f.setAttribute('filterUnits', 'userSpaceOnUse');
  f.innerHTML = `
    <feGaussianBlur in="SourceGraphic" stdDeviation="1.4" result="soft"/>
    <feImage href="${disp}" x="0" y="0" width="${w}" height="${h}" preserveAspectRatio="none" result="map"/>
    <feDisplacementMap in="soft" in2="map" scale="${Math.round(46 * strength)}" xChannelSelector="R" yChannelSelector="G" result="bent"/>
    <feColorMatrix in="bent" type="saturate" values="1.7" result="rich"/>
    <feImage href="${spec}" x="0" y="0" width="${w}" height="${h}" preserveAspectRatio="none" result="rim"/>
    <feGaussianBlur in="rim" stdDeviation="0.6" result="rimSoft"/>
    <feComposite in="rimSoft" in2="rich" operator="over"/>`;
}

export function initGlass(root: ParentNode = document) {
  if (!isChromium()) return; // the CSS frosted fallback stays
  const els = [...root.querySelectorAll<HTMLElement>('[data-glass]')];
  for (const el of els) {
    const id = `glass-${++seq}`;
    build(el, id);
    el.style.setProperty('--glass-filter', `url(#${id})`);
    el.classList.add('is-liquid');
    // rebuild after a resize settles (maps are redrawn on the CPU, so not every frame)
    let timer = 0;
    new ResizeObserver(() => {
      clearTimeout(timer);
      timer = window.setTimeout(() => build(el, id), 120);
    }).observe(el);
  }
}
