// Two trial settings for the dolls, chosen with ?set=capiz or ?set=sun.
//   capiz  one pink wall, low sun falling through a capiz-shell window, doll shadows on the wall
//   sun    a pink sunrise behind the flat wordmark (both CSS), matte clouds under the dolls
// Both are drawn straight, with no post pass: every colour here is authored directly.
import * as THREE from 'three';
import { toonRamp } from './sweets';

/** The time-of-day palette, worked out by scripts/sky.js before the page paints. */
type SkyPalette = { deep: string; pale: string; glow: string; cream: string; shade: string; stars: number; hemi: string; key: string };
declare global { interface Window { __sky?: { palette: SkyPalette | null } } }

const UBE = 0x8a6aa8;

function softLight(scene: THREE.Scene, renderer: THREE.WebGLRenderer, centre: THREE.Vector3, from: THREE.Vector3, strength: number) {
  scene.add(new THREE.HemisphereLight(0xfff6f4, 0xf3c6d4, 1.5));
  const key = new THREE.DirectionalLight(0xfff0dc, strength);
  key.position.copy(centre).add(from);
  key.target.position.copy(centre);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9, near: 1, far: 50 });
  key.shadow.radius = 9;
  key.shadow.blurSamples = 20;
  key.shadow.bias = -0.0006;
  scene.add(key, key.target);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.VSMShadowMap;
}

export function createCapizSet(scene: THREE.Scene, renderer: THREE.WebGLRenderer, centre: THREE.Vector3) {
  const WALL_Z = -1.7;
  const wall = new THREE.Mesh(
    new THREE.PlaneGeometry(90, 60),
    new THREE.ShaderMaterial({
      uniforms: {
        pink: { value: new THREE.Color('#fad7e1') },
        butter: { value: new THREE.Color('#fff0bd') },
        time: { value: 0 },
        origin: { value: new THREE.Vector2(centre.x + 1.5, 1.75) },
      },
      vertexShader: `varying vec2 vP; void main(){ vP = (modelMatrix * vec4(position, 1.0)).xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `
        uniform vec3 pink, butter; uniform float time; uniform vec2 origin; varying vec2 vP;
        float box(vec2 p, vec2 h, float s){ vec2 d = abs(p) - h; return smoothstep(s, -s, max(d.x, d.y)); }
        float hash(vec2 p){ return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }
        void main(){
          // the window as the low sun throws it: sheared and stretched across the wall
          vec2 q = vP - origin - vec2(time * 0.012, 0.0);
          q.x -= q.y * 0.55;
          q.y *= 0.82;
          float frame = box(q, vec2(2.5, 1.5), 0.1);
          // capiz panes: small squares in a lattice, two sliding sashes split by a heavier bar
          vec2 cell = q / 0.3;
          vec2 id = floor(cell), f = fract(cell) - 0.5;
          float pane = box(f, vec2(0.38), 0.12);
          float bar = 1.0 - box(vec2(q.x, 0.0), vec2(0.07, 1.0), 0.04);
          float rail = 1.0 - box(vec2(0.0, q.y), vec2(1.0, 0.06), 0.04);
          // each shell passes a slightly different amount of light
          float pearl = 0.8 + 0.2 * hash(id);
          float light = frame * pane * bar * rail * pearl;
          vec3 c = pink;
          c = mix(c, vec3(1.0, 0.93, 0.93), smoothstep(6.0, 0.0, length(q)) * 0.5); // the glow round it
          c = mix(c, butter, light * 0.8);
          gl_FragColor = vec4(c, 1.0);
          #include <colorspace_fragment>
        }`,
    }),
  );
  wall.position.set(centre.x, 2, WALL_Z);
  scene.add(wall);
  const shade = new THREE.Mesh(new THREE.PlaneGeometry(90, 60), new THREE.ShadowMaterial({ color: UBE, opacity: 0.3 }));
  shade.position.set(centre.x, 2, WALL_Z + 0.01);
  shade.receiveShadow = true;
  scene.add(shade);
  softLight(scene, renderer, centre, new THREE.Vector3(-7, 7, 11), 2.1);
  const u = (wall.material as THREE.ShaderMaterial).uniforms;
  return { update(t: number) { u.time.value = t; } };
}

export function createSunSet(scene: THREE.Scene, renderer: THREE.WebGLRenderer, centre: THREE.Vector3) {
  const ramp = toonRamp();
  const mat = new THREE.MeshToonMaterial({ color: 0xfffafa, gradientMap: ramp });
  mat.toneMapped = false;
  const clouds = new THREE.Group();
  // hand-placed puffs, flat underneath: x, z, width of each bank
  const banks: [number, number, number][] = [[-3.4, 0.2, 3.4], [0.6, 0.5, 4.4], [4.6, 0.1, 3.2], [-6.6, -0.8, 2.2], [7.6, -0.7, 2.4]];
  let seed = 11;
  const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  for (const [x, z, w] of banks) {
    const n = Math.round(w * 2.2);
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1) - 0.5;
      const r = (0.62 + rand() * 0.34) * (1 - Math.abs(t) * 0.75);
      const puff = new THREE.Mesh(new THREE.SphereGeometry(r, 32, 20), mat);
      puff.position.set(x + t * w + (rand() - 0.5) * 0.2, -0.5 + r * 0.42, z + (rand() - 0.5) * 0.5);
      puff.scale.y = 0.72;
      puff.receiveShadow = true;
      clouds.add(puff);
    }
  }
  clouds.position.x = centre.x - 1;
  scene.add(clouds);
  softLight(scene, renderer, centre, new THREE.Vector3(-3, 11, 6), 1.5);
  const base = clouds.position.x;
  return { update(t: number) { clouds.position.x = base + Math.sin(t * 0.08) * 0.25; } };
}

type GlyphState = { y: number; a: number; wave: number };

/** The flat wordmark and script line, drawn into the scene so clouds can pass in front of them.
 *  It reads its size and place from the page's real (hidden) title, so CSS still lays it out. */
function createSceneTitle(scene: THREE.Scene, renderer: THREE.WebGLRenderer, shared: { time: { value: number }; cell: { value: number } }) {
  const glyphs: GlyphState[] = Array.from({ length: 9 }, () => ({ y: 0, a: 0, wave: 0 }));
  const meshes: THREE.Mesh[] = [];
  const tex = new THREE.CanvasTexture(document.createElement('canvas'));
  tex.colorSpace = THREE.SRGBColorSpace;
  const css = new THREE.Vector2(1, 1);

  function build() {
    const word = document.querySelector<HTMLElement>('[data-wordmark]');
    const tag = document.querySelector<HTMLElement>('[data-tagline]');
    if (!word || !tag) return;
    const chars = [...word.querySelectorAll<HTMLElement>('.ch')];
    const fs = parseFloat(getComputedStyle(word).fontSize);
    const pad = fs * 0.14;
    const dpr = Math.min(renderer.getPixelRatio() * 1.5, 3);
    const wb = word.getBoundingClientRect();
    const tb = tag.getBoundingClientRect();
    const W = wb.width + pad * 2, H = wb.height + pad * 2;
    const canvas = tex.image as HTMLCanvasElement;
    canvas.width = Math.ceil(Math.max(W, tb.width) * dpr);
    canvas.height = Math.ceil((H + tb.height) * dpr);
    const g = canvas.getContext('2d')!;
    g.clearRect(0, 0, canvas.width, canvas.height);
    g.scale(dpr, dpr);
    g.font = `900 ${fs}px "Mamasons Display"`;
    g.textBaseline = 'alphabetic';
    g.lineJoin = 'miter';
    g.miterLimit = 3;
    const m = g.measureText('M');
    const navy = getComputedStyle(document.documentElement).getPropertyValue('--navy').trim() || '#14213d';
    const stroke = Math.min(7, Math.max(2, fs * 0.035));
    const rects: { x: number; y: number; w: number; h: number; ux: number; uy: number }[] = [];
    chars.forEach((ch) => {
      const r = ch.getBoundingClientRect();
      const x = r.left - wb.left + pad;
      const base = r.top - wb.top + pad + (r.height + m.fontBoundingBoxAscent - m.fontBoundingBoxDescent) / 2;
      for (let k = 5; k >= 1; k--) {
        const o = k * 0.012 * fs;
        g.strokeStyle = g.fillStyle = navy;
        g.lineWidth = stroke;
        g.strokeText(ch.textContent ?? '', x + o, base + o);
        g.fillText(ch.textContent ?? '', x + o, base + o);
      }
      g.strokeStyle = navy;
      g.lineWidth = stroke;
      g.strokeText(ch.textContent ?? '', x, base);
      g.fillStyle = ch.style.getPropertyValue('--fill');
      g.fillText(ch.textContent ?? '', x, base);
      rects.push({ x: r.left - pad * 0.4, y: r.top - pad, w: r.width + pad * 1.1, h: r.height + pad * 2, ux: x - pad * 0.4, uy: 0 });
    });
    const tfs = parseFloat(getComputedStyle(tag).fontSize);
    g.font = `400 ${tfs}px "Mamasons Script"`;
    g.textBaseline = 'middle';
    g.textAlign = 'center';
    g.lineWidth = Math.max(2, tfs * 0.09);
    g.strokeStyle = navy;
    g.fillStyle = '#fffaf3';
    g.strokeText(tag.textContent ?? '', tb.width / 2, H + tb.height / 2);
    g.fillText(tag.textContent ?? '', tb.width / 2, H + tb.height / 2);
    g.textAlign = 'left';
    rects.push({ x: tb.left, y: tb.top, w: tb.width, h: tb.height, ux: 0, uy: H });
    tex.needsUpdate = true;

    const cw = canvas.width / dpr, ch = canvas.height / dpr;
    css.set(innerWidth, innerHeight);
    meshes.forEach((q) => scene.remove(q));
    meshes.length = 0;
    rects.forEach((r, i) => {
      const q = new THREE.Mesh(
        new THREE.PlaneGeometry(1, 1),
        new THREE.ShaderMaterial({
          transparent: true,
          depthWrite: false,
          uniforms: {
            tex: { value: tex },
            rect: { value: new THREE.Vector4(r.x, r.y, r.w, r.h) },
            uvr: { value: new THREE.Vector4(r.ux / cw, 1 - (r.uy + r.h) / ch, r.w / cw, r.h / ch) },
            css: { value: css },
            lift: { value: 0 },
            alpha: { value: 0 },
            cell: shared.cell,
          },
          vertexShader: `uniform vec4 rect, uvr; uniform vec2 css; uniform float lift; varying vec2 vUv;
            void main(){
              vUv = uvr.xy + uv * uvr.zw;
              vec2 p = rect.xy + vec2(uv.x, 1.0 - uv.y) * rect.zw + vec2(0.0, lift);
              gl_Position = vec4(p.x / css.x * 2.0 - 1.0, 1.0 - p.y / css.y * 2.0, 0.999, 1.0);
            }`,
          // it arrives as a print does: the dots of the screen swell until the letter is solid
          fragmentShader: `uniform sampler2D tex; uniform float alpha, cell; varying vec2 vUv;
            void main(){
              vec4 c = texture2D(tex, vUv);
              vec2 g = mat2(0.7071, -0.7071, 0.7071, 0.7071) * gl_FragCoord.xy / cell;
              float d = 0.5 + 0.25 * (cos(g.x * 6.2832) + cos(g.y * 6.2832));
              gl_FragColor = vec4(c.rgb, c.a * smoothstep(d - 0.12, d + 0.12, alpha * 1.25 - 0.12));
              #include <colorspace_fragment>
            }`,
        }),
      );
      q.frustumCulled = false;
      q.renderOrder = 0;
      scene.add(q);
      meshes.push(q);
    });
  }

  void Promise.all([
    document.fonts.load('900 40px "Mamasons Display"', 'MAMASONS'),
    document.fonts.load('400 40px "Mamasons Script"', 'Dirty Ice Cream'),
  ]).then(build);
  let wait = 0;
  addEventListener('resize', () => { clearTimeout(wait); wait = window.setTimeout(build, 150); });

  return {
    glyphs,
    update() {
      // the name moves as one piece: letters drawn separately would part at their seams
      const bob = Math.sin(shared.time.value * 0.7) * innerHeight * 0.0028;
      meshes.forEach((q, i) => {
        const u = (q.material as THREE.ShaderMaterial).uniforms, g = glyphs[i];
        u.lift.value = bob * g.wave;
        u.alpha.value = g.a;
      });
    },
  };
}

/** ?set=dither: the dolls among volumetric clouds, as one printed image. Looping strips from
 *  Blender (media-src/mamasons-doll/cloud_strips.py) drift at their own speeds, far ones slowly,
 *  behind the live dolls, with the bank they sit in passing in front. The clouds are screened at
 *  45 degrees in cream on blue, and a last pass lays a fine screen and film grain over everything. */
export function createDitherSet(scene: THREE.Scene, renderer: THREE.WebGLRenderer) {
  // nothing of a doll exists below the cloud line, so she can't show through gaps in the bank
  renderer.clippingPlanes = [new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.35)];
  const px = renderer.getPixelRatio();
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const load = (name: string) => {
    const t = new THREE.TextureLoader().load(`/backdrop/strip-${name}.webp`);
    t.colorSpace = THREE.NoColorSpace; // read as printing tone, not colour
    t.wrapS = THREE.RepeatWrapping;
    t.anisotropy = 4;
    return t;
  };
  const shared = {
    cream: { value: new THREE.Color('#f4ecd9') },
    shade: { value: new THREE.Color('#4a7fd4') },
    deep: { value: new THREE.Color('#1450c4') },
    pale: { value: new THREE.Color('#2f7ee6') },
    glow: { value: new THREE.Color('#2f7ee6') }, // low in the sky, warm at sunrise and sunset
    stars: { value: 0 },
    cell: { value: 3.2 * px },
    res: { value: new THREE.Vector2(1, 1) },
    view: { value: new THREE.Vector3(1.49, 1.89, 2.72) }, // the z = 0 plane: centre x, y, half height
    titleY: { value: 0.72 }, // the foot of the wordmark, as a fraction of the screen height
    time: { value: 0 },
    drift: { value: 0 },
    far: { value: load('far') },
    mid: { value: load('mid') },
    near: { value: load('near') },
    front: { value: load('front') },
  };
  const SCREEN = `
    uniform float cell;
    float screen(){                                    // a round dot screen, turned 45 degrees
      vec2 g = mat2(0.7071, -0.7071, 0.7071, 0.7071) * gl_FragCoord.xy / cell;
      return 0.5 + 0.25 * (cos(g.x * 6.2832) + cos(g.y * 6.2832));
    }`;
  const STRIP = `
    uniform vec2 res; uniform vec3 view, cream, shade; uniform float drift, titleY;
    float screenY(float n){ return view.y + (2.0 * n - 1.0) * view.z; } // screen fraction to world
    // keeps a layer to the left and right edges of the screen, breaking up in dots towards the middle
    float sides(float a, float b){
      float x = abs(gl_FragCoord.x / res.x * 2.0 - 1.0);
      return smoothstep(screen() - 0.25, screen() + 0.25, smoothstep(a, b, x) * 1.3);
    }
    vec2 worldAt(){
      vec2 n = gl_FragCoord.xy / res * 2.0 - 1.0;
      return view.xy + n * vec2(view.z * res.x / res.y, view.z);
    }
    // one loop of cloud, w wide in the dolls' plane and w / 4 tall, printed through the screen
    vec4 strip(sampler2D map, vec2 p, float w, float y0, float speed, float haze){
      vec2 uv = vec2(p.x / w + 0.37 * w + drift * speed, (p.y - y0) / (w * 0.25));
      vec4 c = texture2D(map, uv);
      if (uv.y > 0.995 || uv.y < 0.004) c.a = 0.0;     // nothing smears past the strip's edges
      float d = screen();
      float t = (c.r * 0.86 + 0.14) * (1.0 - haze);
      vec3 col = mix(shade, cream, smoothstep(d - 0.16, d + 0.16, t));
      float a = smoothstep(d - 0.3, d + 0.3, c.a * 1.25) * smoothstep(0.0, 0.12, c.a) * (1.0 - haze * 0.5);
      return vec4(col, a);
    }`;
  // each cloud layer stands at a real distance, so anything flying between them is hidden properly
  const layers: { z: number; at: { value: number } }[] = [];
  const quad = (frag: string, z: number, order: number, depthTest: boolean) => {
    const depthAt = { value: 0.99 };
    layers.push({ z, at: depthAt });
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      new THREE.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        depthTest,
        uniforms: { ...shared, depthAt: depthAt },
        vertexShader: `uniform float depthAt; void main(){ gl_Position = vec4(position.xy, depthAt, 1.0); }`,
        fragmentShader: SCREEN + STRIP + frag,
      }),
    );
    m.frustumCulled = false;
    m.renderOrder = order;
    scene.add(m);
  };
  const sky = new THREE.Mesh(
    new THREE.PlaneGeometry(2, 2),
    new THREE.ShaderMaterial({
      depthTest: false,
      depthWrite: false,
      uniforms: shared,
      vertexShader: `void main(){ gl_Position = vec4(position.xy, 0.9999, 1.0); }`,
      fragmentShader: `uniform vec2 res; uniform vec3 deep, pale, glow, cream; uniform float stars, cell, drift;
        float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        void main(){
          float y = gl_FragCoord.y / res.y;
          vec3 c = mix(pale, deep, smoothstep(0.2, 1.0, y));
          c += (glow - pale) * smoothstep(0.62, 0.12, y); // nothing at all by day, where glow is pale
          // at night, a few small stars in the upper sky, each on its own slow twinkle
          if (stars > 0.0) {
            vec2 g = gl_FragCoord.xy / (cell * 11.0);
            vec2 id = floor(g);
            float h = hash(id);
            vec2 at = (vec2(hash(id + 3.1), hash(id + 7.7)) - 0.5) * 0.6;
            float r = length(fract(g) - 0.5 - at) * 35.2;   // in CSS pixels
            float lit = step(0.94, h) * smoothstep(1.3 + 0.9 * fract(h * 37.0), 0.3, r);
            lit *= 0.75 + 0.25 * sin(drift * (0.6 + fract(h * 91.0)) + h * 40.0);
            c = mix(c, cream * 1.1, lit * stars * smoothstep(0.35, 0.7, y));
          }
          gl_FragColor = vec4(c, 1.0);
          #include <colorspace_fragment>
        }`,
    }),
  );
  sky.frustumCulled = false;
  sky.renderOrder = -10;
  scene.add(sky);
  // the towers stand behind the name, so it reads against cloud and blue alike
  quad(`uniform sampler2D far, mid;
    void main(){
      vec2 p = worldAt();
      vec4 c, o = vec4(0.0);
      c = strip(far, p, 17.0, 1.1, 0.0007, 0.3); o = vec4(mix(o.rgb, c.rgb, c.a), max(o.a, c.a));
      if (res.x / res.y < 0.85) {                      // tall screens have more sky to fill
        c = strip(mid, p + vec2(4.0, 0.0), 16.0, screenY(0.5), 0.0009, 0.12); o = vec4(mix(o.rgb, c.rgb, c.a), max(o.a, c.a));
      }
      c = strip(mid, p, 16.0, 0.1, 0.0014, 0.06); o = vec4(mix(o.rgb, c.rgb, c.a), max(o.a, c.a));
      // big clouds standing up both sides, framing the group
      c = strip(mid, p + vec2(2.0, 0.0), 20.0, -0.9, 0.0011, 0.0);
      c.a *= sides(0.55, 0.82); o = vec4(mix(o.rgb, c.rgb, c.a), max(o.a, c.a));
      gl_FragColor = o;
      #include <colorspace_fragment>
    }`, -9, -5, true);
  const title = createSceneTitle(scene, renderer, shared);
  // nearer clouds, in front of the name: the odd scrap drifts over its foot, far apart
  quad(`uniform sampler2D near, far;
    void main(){
      vec2 p = worldAt();
      vec4 c, o = vec4(0.0);
      if (res.x / res.y >= 0.85) {                     // a phone's name is too small to share with cloud
        c = strip(far, p + vec2(9.0, 0.0), 8.0, screenY(titleY) - 0.25, 0.0022, 0.0);
        c.a *= smoothstep(screen() - 0.3, screen() + 0.3, smoothstep(0.35, 0.98, sin(p.x * 0.33 + drift * 0.021))); // fades out in dots, never a straight edge
        o = vec4(c.rgb, c.a);
      }
      c = strip(near, p, 12.5, -0.75, 0.0024, 0.0); o = vec4(mix(o.rgb, c.rgb, c.a), max(o.a, c.a));
      c = strip(near, p + vec2(7.0, 0.0), 17.0, -1.0, 0.0018, 0.0);
      c.a *= sides(0.62, 0.86); o = vec4(mix(o.rgb, c.rgb, c.a), max(o.a, c.a));
      gl_FragColor = o;
      #include <colorspace_fragment>
    }`, -3.6, 1, true);
  // in front of the dolls: the bank they sit in
  quad(`uniform sampler2D front;
    void main(){
      vec2 p = worldAt();
      // the bank, then more of it stacked towards us, down to the foot of the screen
      float bot = view.y - view.z;
      vec4 o = vec4(0.0);
      for (int k = 0; k < 7; k++) {
        float y0 = -1.28 - float(k) * 1.0;
        if (y0 + 2.2 < bot) break;
        vec4 c = strip(front, p, 15.0 + float(k) * 2.0, y0, 0.0034 + float(k) * 0.0007, 0.0);
        o = vec4(mix(o.rgb, c.rgb, c.a), max(o.a, c.a));
      }
      // a calm ground under the addresses
      // under the bank the air closes up into shaded cloud, so no sky shows through at the foot
      float h = (p.y - bot) / (2.0 * view.z);
      float under = smoothstep(0.2, 0.09, h + (screen() - 0.5) * 0.08);
      vec3 body = mix(shade, cream, smoothstep(screen() - 0.16, screen() + 0.16, 0.66));
      o = vec4(mix(body, o.rgb, o.a), max(o.a, under));
      float ground = res.x / res.y < 0.85 ? 0.07 : 0.02;
      float low = smoothstep(ground, ground + 0.09, (p.y - bot) / (2.0 * view.z) + (screen() - 0.5) * 0.05);
      gl_FragColor = vec4(mix(cream, o.rgb, low), mix(1.0, o.a, low));
      #include <colorspace_fragment>
    }`, 1.95, 10, true);
  const hemi = new THREE.HemisphereLight(0xfffaf0, 0xc9daf5, 1.9);
  scene.add(hemi);
  const key = new THREE.DirectionalLight(0xfff6e6, 1.3);
  key.position.set(-5, 8, 8);
  scene.add(key);

  // the time of day: colours ease to each new reading, so the minute-by-minute drift never steps
  const tint = [
    [shared.deep.value, 'deep'], [shared.pale.value, 'pale'], [shared.glow.value, 'glow'],
    [shared.cream.value, 'cream'], [shared.shade.value, 'shade'], [hemi.color, 'hemi'], [key.color, 'key'],
  ] as const;
  const goal = tint.map(([c]) => c.clone());
  let starGoal = 0;
  const read = (snap: boolean) => {
    const p = window.__sky?.palette;
    if (!p) return;
    tint.forEach(([c, k], i) => { goal[i].set(p[k]); if (snap) c.copy(goal[i]); });
    starGoal = p.stars;
    if (snap) shared.stars.value = starGoal;
  };
  read(true);
  addEventListener('mamasons:sky', () => read(still));

  // the print: everything is rendered once, then laid on the page through one screen and grain
  const rt = new THREE.WebGLRenderTarget(4, 4, { samples: 4, type: THREE.HalfFloatType });
  const postScene = new THREE.Scene();
  const postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const post = new THREE.Mesh(
    new THREE.PlaneGeometry(2, 2),
    new THREE.ShaderMaterial({
      depthTest: false,
      depthWrite: false,
      uniforms: { ...shared, tex: { value: rt.texture } },
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
      fragmentShader: `uniform sampler2D tex; uniform float time; varying vec2 vUv; ${SCREEN}
        float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
        void main(){
          gl_FragColor = vec4(texture2D(tex, vUv).rgb, 1.0);
          #include <colorspace_fragment>
          vec3 c = gl_FragColor.rgb;
          float l = dot(c, vec3(0.3, 0.6, 0.1));
          // ink sits heaviest in the midtones, as on paper
          c *= 1.0 + (screen() - 0.5) * 0.16 * (0.35 + 0.65 * sin(3.1416 * clamp(l, 0.0, 1.0)));
          // a grain that holds still at 8 frames a second, like film
          float g = hash(floor(gl_FragCoord.xy / max(1.0, cell * 0.34)) + floor(time * 8.0));
          c += (g - 0.5) * 0.075;
          gl_FragColor = vec4(c, 1.0);
        }`,
    }),
  );
  postScene.add(post);
  const size = new THREE.Vector2();
  const TAN = Math.tan(THREE.MathUtils.degToRad(13));
  const placeTitle = () => {
    const w = document.querySelector('[data-wordmark]')?.getBoundingClientRect();
    if (w) shared.titleY.value = 1 - w.bottom / innerHeight;
  };
  addEventListener('resize', placeTitle);
  void document.fonts.ready.then(placeTitle);
  placeTitle();
  return {
    title,
    update(t: number) {
      shared.time.value = t;
      shared.drift.value = still ? 0 : t;
      tint.forEach(([c], i) => c.lerp(goal[i], 0.02));
      shared.stars.value += (starGoal - shared.stars.value) * 0.02;
      renderer.getDrawingBufferSize(shared.res.value);
      shared.cell.value = 3.2 * renderer.getPixelRatio(); // the screen keeps its size if the resolution steps down
      title.update();
    },
    render(s: THREE.Scene, camera: THREE.Camera) {
      const d = camera.position.z / 0.9949;
      shared.view.value.set(camera.position.x, camera.position.y - 0.1006 * d, d * TAN);
      const { near, far } = camera as THREE.PerspectiveCamera;
      for (const l of layers) l.at.value = (far + near) / (far - near) - (2 * far * near) / ((far - near) * (d - l.z));
      renderer.getDrawingBufferSize(size);
      if (rt.width !== size.x || rt.height !== size.y) rt.setSize(size.x, size.y);
      renderer.setRenderTarget(rt);
      renderer.clear();
      renderer.render(s, camera);
      renderer.setRenderTarget(null);
      renderer.render(postScene, postCam);
    },
  };
}
