// Direction A, Nest. Mama opens; three dolls hop out, each from the one before; then the
// four of them chat, look at each other, laugh and play, on a loop. Their speech bubbles
// carry the real information. Behind them is the dream meadow (meadow.ts); the visitor can
// drag to look round it. ?world=valley shows the earlier ube dusk valley (world.ts).
//
// Every doll's motion is split into channels (slot, hop, look, squash, tilt, lid) that GSAP
// animates; one gsap.ticker composes the channels into transforms, updates the world,
// places the HTML bubbles and hit areas, and renders. Nothing else runs its own loop.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { gsap } from 'gsap';
import { toonRamp } from './sweets';
import { createWorld, addRim, createRays } from './world';
import { createMeadow, createNavyRays } from './meadow';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { createHalftone, DOLL_LAYER } from './halftone';
import { findBackdrop, createBackdrop, type StripView } from './backdrop';
import { createSuperDoll } from './flyer';
import { createUfo } from './ufo';
import { createUbeCloud } from './ubecloud';
import { createCapizSet, createDitherSet, createSunSet } from './sets';
import { createBird } from './bird';
import { createCow, createPlane, createScoops, visitorsMayLoad, type Head } from './props';
import { CENTRE } from './meadow';
import { bell, chime, pop, setSound, soundOn, onSound } from './audio';
import { initTitle } from './title';
import { coverAgain, liftLoader } from './loader';
import { shops } from '../data/site';

const NAVY = 0x0f1e37;
const H = 2; // doll height, model units
const SPLIT = 0.604; // where the lid parts from the base
const S = 0.8423; // each doll's scale relative to the one it nests in
const N = 4; // dolls in the scene; the fifth stays inside Bunso
// where each doll ends up, from the brand illustration: Mama on her own at the left, then
// Bunso (the smallest), Lila and Minty close together, all on one line facing out.
// Doll order is Mama, Lila, Minty, Bunso; x is in doll units (a doll is 2 tall).
const ROW = [
  { x: 0, z: 0 },
  { x: 2.08, z: 0 },
  { x: 2.98, z: 0 },
  { x: 1.17, z: 0 },
];
const HUDDLE = ROW; // the same arrangement on every screen
// in the sky the dolls hang free, so each gets clear air: no two bodies touch
const SKY_ROW = [
  { x: 0, z: 0 },
  { x: 2.12, z: 0 },
  { x: 3.16, z: 0 },
  { x: 1.1, z: 0 },
];
// on a phone they stand in depth instead, Bunso nearest, so the row is narrower and they are larger
const SKY_TALL = [
  { x: 0, z: 0 },
  { x: 1.55, z: -0.9 },
  { x: 2.3, z: 0.4 },
  { x: 0.95, z: 0.9 },
];
const portrait = () => innerWidth / innerHeight < 0.85;
let SLOTS = ROW;
const NAMES = ['Mama', 'Lila', 'Minty', 'Bunso'];
const LAUGHS = ['Ha ha!', 'Hahaha', 'Hehe!', 'Ha!'];
const YUMS = ['Yummy!', 'Mmmmmmm', 'Yummy!', 'Mmmmmmm!'];

type Channels = { x: number; y: number; z: number; hop: number; fly: number; size: number; dx: number; wob: number; look: number; squash: number; tilt: number; spin: number };
type Lid = { y: number; z: number; rx: number; ry: number };
// the words of a line arrive one after another, so a bubble seems to be spoken
function setBubble(el: HTMLElement, text: string) {
  el.replaceChildren(
    ...text.split(' ').flatMap((w, i) => {
      const s = document.createElement('span');
      s.className = 'w';
      s.style.setProperty('--i', String(i));
      s.textContent = w;
      return i ? [' ', s] : [s];
    }),
  );
}

type Doll = {
  root: THREE.Object3D;
  top: THREE.Object3D | null;
  topBase: THREE.Vector3;
  scale: number;
  c: Channels;
  lid: Lid;
  el: HTMLElement;
  hit: HTMLButtonElement;
  bubble: HTMLElement;
  think: HTMLElement | null;
  line: string;
};

// the conversation, on a loop. `act` adds a bit of play to the line.
const SCRIPT: { who?: number; say?: string; laugh?: boolean; act?: 'spin' | 'hop' | 'tip'; dream?: 'ube' | 'halo' }[] = [
  { who: 0, say: 'Everyone comfy up here? Good. The website is still nesting.' },
  { who: 3, say: 'Are we nearly there yet?', act: 'hop' },
  { who: 0, say: 'No, Bunso.' },
  { laugh: true },
  { who: 1, say: `The shops are open though. Kentish Town: ${shops[0].street}.`, act: 'tip' },
  { who: 2, say: `And Chinatown: ${shops[1].street}!`, act: 'spin' },
  { who: 3, say: 'Bilog, bilog, bilog!', act: 'hop' },
  { laugh: true },
  { who: 1, say: 'You know what I want? Halo-halo.', dream: 'halo' },
  { who: 3, say: 'Halo-halo! Halo-halo!', act: 'hop' },
  { who: 2, say: 'Is it me, or is it chilly up here?' },
  { who: 1, say: 'Perfect weather for ice cream.' },
  { who: 3, say: 'Mmmmmmm, ice cream.', act: 'hop' },
  { who: 0, say: 'Who wants an ube scoop?', dream: 'ube' },
];

// the sky is the page; ?set=classic or ?world=valley still reach the older scenes
function pageSet() {
  const q = new URLSearchParams(location.search);
  if (q.get('world') === 'valley' || q.get('set') === 'classic') return null;
  return q.get('set') ?? 'dither';
}

function webglOK() {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

export function initNest() {
  const page = document.querySelector<HTMLElement>('[data-nest]');
  const canvas = document.querySelector<HTMLCanvasElement>('[data-gl]');
  const stage = document.querySelector<HTMLElement>('[data-stage]');
  if (!page || !canvas || !stage) {
    void liftLoader(Promise.resolve());
    return;
  }

  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  // The loader stays up until the dolls are in. The still lineup in the HTML is for search engines
  // and screen readers only: no visitor ever sees it, so nothing below falls back to it. Reduced
  // motion gets the live page too, with its visitors and flights already switched off.
  let dollsIn = () => {};
  const lifted = liftLoader(new Promise<void>((r) => (dollsIn = r)));
  const entered = gate(reduce, lifted);
  if (!webglOK()) return; // nothing can draw the page: the loader stays

  const items = [...page.querySelectorAll<HTMLElement>('[data-doll]')];
  page.classList.add('has-gl');
  // A failed load or a GPU reset covers the page with the loader again and starts it over. Two
  // tries a session, so a device that can never draw it keeps the loader instead of looping.
  const fail = () => {
    coverAgain();
    const tries = Number(sessionStorage.getItem('nest-retry') ?? 0);
    if (tries < 2) {
      sessionStorage.setItem('nest-retry', String(tries + 1));
      setTimeout(() => location.reload(), 600);
    }
  };

  // the cloud print renders through its own multisampled target, so the canvas needs none of its own
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: pageSet() !== 'dither', alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  // a GPU that resets (a backgrounded phone, a driver hiccup) goes back under the loader and reloads
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); fail(); });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(26, 1, 0.5, 1400);
  const valley = new URLSearchParams(location.search).get('world') === 'valley';
  const mobile = innerWidth < 720;
  const world = valley ? createWorld(scene, renderer, { mobile }) : null;
  // a generated backdrop in public/backdrop/ wins; otherwise the procedural meadow
  let meadow: ReturnType<typeof createMeadow> | null = null;
  let backdrop: {
    update(t: number): void;
    render?(s: THREE.Scene, c: THREE.Camera): void;
    title?: { glyphs: { y: number; a: number; wave: number }[] };
  } | null = null;
  let stripView: StripView | null = null; // set when the backdrop was rendered from a fixed vantage
  let refit: (() => void) | null = null;
  let atmos: ((t: number) => void) | null = null;
  let contactPool: THREE.Mesh | null = null; // the dark patch under the group, eased away as they lift
  const setName = pageSet();
  if (setName === 'capiz' || setName === 'sun' || setName === 'dither') {
    const c = new THREE.Vector3(CENTRE.x, 0, CENTRE.y);
    backdrop = setName === 'capiz' ? createCapizSet(scene, renderer, c)
      : setName === 'sun' ? createSunSet(scene, renderer, c)
      : createDitherSet(scene, renderer);
  } else if (!valley) {
    // a pink set with some air in it: a soft gradient sky, a floor that melts into it, a warm
    // key light casting real shadows, a dark contact pool under the group, haze, and slow motes
    // drifting through the light. (The meadow and Blender backdrop are parked below.)
    const PINK = new THREE.Color('#fad7e1');
    // no scene.background: a colour background force-clears every render(), and the clean doll
    // pass would wipe the sky, floor and shadows drawn before it. The sky sphere is the backdrop.
    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(60, 48, 24),
      new THREE.ShaderMaterial({
        side: THREE.BackSide, depthWrite: false, fog: false,
        uniforms: {
          top: { value: new THREE.Color('#fff1f5') }, mid: { value: new THREE.Color('#fad7e1') },
          low: { value: new THREE.Color('#eeb3c4') }, glow: { value: new THREE.Color('#fff6e8') },
          sunDir: { value: new THREE.Vector3(-0.45, 0.55, -0.7).normalize() },
        },
        vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
        fragmentShader: `uniform vec3 top, mid, low, glow, sunDir; varying vec3 vDir;
          void main(){
            float y = vDir.y;
            // one soft wash, light above, a little deeper below: no horizon, so no ground
            vec3 c = mix(mid, top, smoothstep(-0.1, 0.8, y));
            c = mix(c, low, smoothstep(-0.05, -0.9, y));
            c += glow * pow(max(dot(vDir, sunDir), 0.0), 6.0) * 0.35; // a hazy sun glow
            gl_FragColor = vec4(c, 1.0);
            #include <colorspace_fragment>
          }`,
      }),
    );
    sky.position.set(CENTRE.x, 0, CENTRE.y);
    scene.add(sky);

    // the floor: pink near the dolls, fading to the horizon colour so there is no hard edge
    const floorTex = (() => {
      const c = document.createElement('canvas');
      c.width = c.height = 512;
      const g = c.getContext('2d')!;
      const r = g.createRadialGradient(256, 256, 0, 256, 256, 256);
      r.addColorStop(0, '#f8cfdb');
      r.addColorStop(0.55, '#f3c1cf');
      r.addColorStop(1, '#eeb3c4');
      g.fillStyle = r;
      g.fillRect(0, 0, 512, 512);
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace;
      return t;
    })();
    const ground = new THREE.Mesh(new THREE.CircleGeometry(60, 64), new THREE.MeshLambertMaterial({ map: floorTex }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(CENTRE.x, 0, CENTRE.y);
    ground.receiveShadow = true;
    // no floor: the dolls levitate in open pink air

    // contact pool: a soft dark ellipse right under the group, so they sit heavily on the floor
    const pool = (() => {
      const c = document.createElement('canvas');
      c.width = c.height = 256;
      const g = c.getContext('2d')!;
      const r = g.createRadialGradient(128, 128, 0, 128, 128, 128);
      r.addColorStop(0, 'rgba(120,40,70,0.42)');
      r.addColorStop(0.6, 'rgba(120,40,70,0.14)');
      r.addColorStop(1, 'rgba(120,40,70,0)');
      g.fillStyle = r;
      g.fillRect(0, 0, 256, 256);
      return new THREE.CanvasTexture(c);
    })();
    const contact = new THREE.Mesh(new THREE.PlaneGeometry(9, 3.2), new THREE.MeshBasicMaterial({ map: pool, transparent: true, depthWrite: false }));
    contact.rotation.x = -Math.PI / 2;
    contact.position.set(CENTRE.x, 0.004, CENTRE.y);
    // (contact patch only belongs on a floor)
    contactPool = contact;

    // light: soft pink fill from the sky, a warm low key from behind-left so shadows reach forward
    scene.add(new THREE.HemisphereLight(0xfff4f7, 0xe7a3b8, 1.1));
    const key = new THREE.DirectionalLight(0xffeedd, 2.4);
    key.position.set(CENTRE.x - 6, 7, CENTRE.y - 5);
    key.target.position.set(CENTRE.x, 0, CENTRE.y);
    key.castShadow = false;
    key.shadow.mapSize.set(2048, 2048);
    Object.assign(key.shadow.camera, { left: -7, right: 7, top: 7, bottom: -7, near: 1, far: 40 });
    // soft, light shadows: variance shadow maps blur the edge into a wide penumbra
    key.shadow.radius = 14;
    key.shadow.blurSamples = 20;
    key.shadow.intensity = 0.55;
    key.shadow.bias = -0.0006;
    scene.add(key, key.target);
    renderer.shadowMap.enabled = false;

    // motes: soft specks of light drifting slowly upward through the air around the dolls
    const MOTES = mobile ? 90 : 180;
    const mp = new Float32Array(MOTES * 3), seed = new Float32Array(MOTES);
    for (let i = 0; i < MOTES; i++) {
      mp[i * 3] = CENTRE.x + (Math.random() - 0.5) * 16;
      mp[i * 3 + 1] = Math.random() * 6;
      mp[i * 3 + 2] = CENTRE.y + (Math.random() - 0.5) * 10;
      seed[i] = Math.random();
    }
    const mg = new THREE.BufferGeometry();
    mg.setAttribute('position', new THREE.BufferAttribute(mp, 3));
    mg.setAttribute('seed', new THREE.BufferAttribute(seed, 1));
    const motes = new THREE.Points(mg, new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { time: { value: 0 }, px: { value: renderer.getPixelRatio() } },
      vertexShader: `uniform float time, px; attribute float seed; varying float vA;
        void main(){
          vec3 p = position;
          p.y = mod(p.y + time * (0.08 + seed * 0.12), 6.0);
          p.x += sin(time * 0.3 + seed * 40.0) * 0.4;
          p.z += cos(time * 0.25 + seed * 30.0) * 0.3;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = (2.0 + seed * 5.0) * px * (12.0 / -mv.z);
          vA = smoothstep(0.0, 1.0, p.y) * smoothstep(6.0, 4.5, p.y) * (0.35 + 0.5 * sin(time * 1.5 + seed * 20.0) * 0.5 + 0.25);
        }`,
      fragmentShader: `varying float vA;
        void main(){ float d = length(gl_PointCoord - 0.5); gl_FragColor = vec4(1.0, 0.97, 0.92, vA * smoothstep(0.5, 0.0, d) * 0.8); }`,
    }));
    scene.add(motes);
    atmos = (t: number) => { (motes.material as THREE.ShaderMaterial).uniforms.time.value = t; };
    scene.traverse((o) => { if ((o as THREE.Light).isLight) o.layers.enableAll(); });
  }
  if (false as boolean) {
    const lightDolls = () => scene.traverse((o) => { if ((o as THREE.Light).isLight) o.layers.enableAll(); });
    void findBackdrop().then(async (found) => {
      if (found) {
        const bd = await createBackdrop(scene, renderer, found, new THREE.Vector3(CENTRE.x, 0, CENTRE.y));
        backdrop = bd;
        dots.setDof(false); // the render has its own depth; blur only smears it
        if (bd.view) {
          stripView = bd.view;
          refit?.();
        }
      }
      else meadow = createMeadow(scene, renderer, { mobile });
      lightDolls(); // whichever arrives first, the dolls' own pass must see these lights
    });
  }
  // the final composite: depth of field and a soft glow; ?dots=on adds the halftone print
  const dots = createHalftone(renderer, { amount: new URLSearchParams(location.search).get('dots') === 'on' ? 0.22 : 0 });
  // drag to look round: orbit the dolls, never below the ground or too far away
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.07;
  controls.enablePan = false;
  controls.rotateSpeed = 0.55;
  controls.zoomSpeed = 0.6;
  controls.minPolarAngle = 0.55;
  controls.maxPolarAngle = valley ? 1.5 : 1.47;
  if (valley || setName) controls.enabled = false; // the valley is a set: it only looks good from the front
  controls.addEventListener('start', () => {
    canvas.classList.add('is-dragging');
    document.querySelector('[data-drag-hint]')?.classList.add('is-gone');
  });
  controls.addEventListener('end', () => canvas.classList.remove('is-dragging'));
  // a sunburst behind every doll, as in the logo; the speaker's glows brighter
  const rays = Array.from({ length: N }, () => (valley ? createRays() : createNavyRays()));
  rays.forEach((r) => {
    r.layers.set(DOLL_LAYER); // drawn clean, on top of the dots
    // in the sky every doll keeps hers on, opening wider behind whoever is talking
    r.visible = !setName || setName === 'dither';
    if (setName === 'dither') {
      r.layers.enable(0);
      r.renderOrder = 2; // over the nearer clouds
    }
    scene.add(r);
  });
  const raysMats = rays.map((r) => r.material as THREE.MeshBasicMaterial);
  const rayBoost = rays.map(() => ({ v: 0 }));
  const rayIdle = { v: 0 }; // comes up once the dolls have surfaced
  // a tap kicks a doll's sunburst: it pops out, spins on, and settles with a wobble
  const rayKick = rays.map(() => ({ pop: 0, turn: 0 }));

  // pointer, eased: the grass leans toward it
  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  addEventListener('pointermove', (e) => {
    pointer.tx = (e.clientX / innerWidth) * 2 - 1;
    pointer.ty = -((e.clientY / innerHeight) * 2 - 1);
  });

  const loader = new GLTFLoader();

  loader.setMeshoptDecoder(MeshoptDecoder);
  loader.load(
    '/models/dolls.glb',
    (gltf) => {
      const ramp = toonRamp();
      gltf.scene.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (!mesh.isMesh) return;
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        const swapped = mats.map((m) => {
          const std = m as THREE.MeshStandardMaterial;
          if (std.name === 'Outline') return new THREE.MeshBasicMaterial({ color: NAVY });
          const t = std.name.startsWith('Paint')
            ? new THREE.MeshToonMaterial({ map: std.map, gradientMap: ramp })
            : new THREE.MeshToonMaterial({ color: std.color, gradientMap: ramp });
          addRim(t);
          return t;
        });
        mesh.material = Array.isArray(mesh.material) ? swapped : swapped[0];
      });
      // the dolls draw in the background pass too (so the pond reflects them) and again,
      // clean, on the doll layer
      gltf.scene.traverse((o) => {
        o.layers.enable(DOLL_LAYER);
        const mesh = o as THREE.Mesh;
        if (mesh.isMesh) {
          mesh.castShadow = true;
          // keep the brand's paint colours exact: no film tone curve on the dolls
          (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach((mm) => (mm.toneMapped = false));
        }
      });
      // lights must reach the clean doll pass too
      scene.traverse((o) => { if ((o as THREE.Light).isLight) o.layers.enableAll(); });
      scene.add(gltf.scene);

      // pose the set nested and closed (the first frame of the baked animation), then
      // never touch the mixer again: from here GSAP owns every transform
      const mixer = new THREE.AnimationMixer(gltf.scene);
      for (const clip of gltf.animations) mixer.clipAction(clip).play();
      mixer.setTime(0);

      const root = (i: number) => {
        let r: THREE.Object3D | null = null;
        gltf.scene.traverse((o) => {
          if (!r && o.name === `Doll${i}` && !(o as THREE.Mesh).isMesh) r = o;
        });
        return r ?? gltf.scene.getObjectByName(`Doll${i}`)!;
      };
      root(5).visible = false; // the fifth stays inside Bunso

      const dolls: Doll[] = [];
      if (setName) Object.assign(window, { __dolls: dolls, __cam: camera, __gl: renderer }); // stills and the Blender plates read these
      for (let i = 0; i < N; i++) {
        const r = root(i + 1);
        const top = gltf.scene.getObjectByName(`Doll${i + 1}_Top`) ?? null;
        const el = items[i];
        const bubble = el.querySelector<HTMLElement>('[data-bubble]')!;
        const think = el.querySelector<HTMLElement>('[data-think]');
        dolls.push({
          root: r,
          top,
          topBase: top ? top.position.clone() : new THREE.Vector3(),
          scale: S ** i,
          c: { x: r.position.x, y: r.position.y, z: r.position.z, hop: 0, fly: 0, size: 1, dx: 0, wob: 0, look: 0, squash: 1, tilt: 0, spin: 0 },
          lid: { y: 0, z: 0, rx: 0, ry: 0 },
          el,
          hit: el.querySelector('button')!,
          bubble,
          think,
          line: bubble.textContent ?? '',
        });
      }
      // Mama stands on the centre slot; the others start nested where the file put them
      Object.assign(dolls[0].c, { x: 0, y: 0, z: 0 });

      // ---- camera: frame the finished group inside the stage band, with room above
      // their heads for the bubbles
      const groupBox = () => {
        const xs = SLOTS.map((s, i) => [s.x - 0.62 * S ** i, s.x + 0.62 * S ** i]).flat();
        return new THREE.Box3(
          new THREE.Vector3(Math.min(...xs) - 0.1, 0, -0.6),
          new THREE.Vector3(Math.max(...xs) + 0.1, H * 1.5 + 0.75, 1.8), // + the levitation height
        );
      };
      let introDone = false;
      function frame() {
        if (stripView) return frameStrip(stripView);
        const next = setName === 'dither' ? (portrait() ? SKY_TALL : SKY_ROW) : portrait() ? HUDDLE : ROW;
        if (next !== SLOTS) {
          SLOTS = next;
          // after the entrance, dolls walk to the new arrangement
          if (introDone) dolls.forEach((d, i) => gsap.to(d.c, { x: SLOTS[i].x, z: SLOTS[i].z, duration: 0.7, ease: 'power3.inOut' }));
        }
        const group = groupBox();
        const w = innerWidth, h = innerHeight;
        renderer.setSize(w, h, false);
        dots?.resize();
        camera.aspect = w / h;
        const s = stage!.getBoundingClientRect();
        const size = group.getSize(new THREE.Vector3());
        const centre = group.getCenter(new THREE.Vector3());
        const tanV = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
        const dH = size.y / (2 * tanV * (s.height / h));
        const dW = (size.x * 1.08) / (2 * tanV * camera.aspect * (s.width / w));
        const d = Math.max(dH, dW);
        const visH = 2 * d * tanV, visW = visH * camera.aspect;
        const ndcX = ((s.left + s.width / 2) / w) * 2 - 1;
        const ndcY = 1 - ((s.top + s.height / 2) / h) * 2;
        camera.position.set(centre.x - (ndcX * visW) / 2, centre.y - (ndcY * visH) / 2 + 0.25, centre.z + d);
        camera.lookAt(camera.position.x, camera.position.y - 0.25, centre.z);
        camera.updateProjectionMatrix();
        // orbit round the point the start view looks at, so the dolls stay in frame
        controls.target.set(camera.position.x, camera.position.y - 0.25, centre.z);
        controls.minDistance = d * 0.55;
        controls.maxDistance = d * 1.35;
        controls.update();
        // the stone under the dolls spans their arrangement
        const xs = SLOTS.map((sl, i) => [sl.x - 0.7 * S ** i, sl.x + 0.7 * S ** i]).flat();
        world?.layout(camera, { x: (Math.min(...xs) + Math.max(...xs)) / 2, width: Math.max(...xs) - Math.min(...xs) + 0.6 });
      }

      // the rendered backdrop was shot from one spot: stand there, fit the dolls by lens, and
      // turn on the spot to look around, within the directions the render covers
      function frameStrip(v: StripView) {
        const w = innerWidth, h = innerHeight;
        renderer.setSize(w, h, false);
        dots?.resize();
        camera.aspect = w / h;
        const look = new THREE.Vector3(CENTRE.x, 1.0, CENTRE.y);
        const dist = v.pos.distanceTo(look);
        const hfov = 2 * Math.atan(2.3 / dist / 0.8);                       // dolls ~80% of the width
        let vfov = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(hfov / 2) / camera.aspect));
        vfov = THREE.MathUtils.clamp(vfov, 38, 78);
        camera.fov = vfov;
        camera.position.copy(v.pos);
        camera.lookAt(look);
        camera.updateProjectionMatrix();
        const hDeg = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(vfov) / 2) * camera.aspect));
        const dir = look.clone().sub(v.pos).normalize();
        controls.target.copy(v.pos).addScaledVector(dir, 0.01);
        controls.enableZoom = false;
        controls.minDistance = controls.maxDistance = 0.01;
        controls.rotateSpeed = -0.3;                                          // the world follows your finger
        const yaw = THREE.MathUtils.degToRad(Math.max(0, v.lon[1] - hDeg / 2 - 2));
        controls.minAzimuthAngle = -yaw;
        controls.maxAzimuthAngle = yaw;
        controls.minPolarAngle = THREE.MathUtils.degToRad(90 + v.lat[0] + vfov / 2 + 2);
        controls.maxPolarAngle = THREE.MathUtils.degToRad(90 + v.lat[1] - vfov / 2 - 2);
        controls.update();
      }
      refit = () => frame();
      // on a phone the sides of the sky are off screen, so the background visitors come inwards
      // and up into the open sky over the dolls' heads. The dolls themselves never move for this
      const visHalf = (z: number) => (camera.position.z - z) * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect;
      const skyRay = new THREE.Vector3();
      // the world height at depth z that shows at screen height ndcY (-1 bottom, 1 top)
      const skyY = (ndcY: number, z: number) => {
        skyRay.set(0, ndcY, 0.5).unproject(camera).sub(camera.position).normalize();
        return camera.position.y + skyRay.y * ((z - camera.position.z) / skyRay.z);
      };

      // ---- compose channels into transforms
      // floating: once they've landed, the dolls rise off the floor and bob, each on its own
      // slow phase, so their shadows stay behind on the ground, softening as they lift
      const float = { v: 0 };
      const tiny = reduce || setName !== 'dither' ? null : createSuperDoll(scene, root(5));
      if (setName) Object.assign(window, { __tiny: tiny });
      const lift = new Array(N).fill(0);
      // when the little one flies by, one doll turns to follow her, tipping back to look up
      const watch = new Array(N).fill(0);
      let watcher = -1, watchUp = 0, curious = 0;
      function watchFlyer(dt: number) {
        const flying = !!tiny?.group.visible;
        if (flying && watcher < 0) {
          watcher = Math.floor(Math.random() * N);
          curious = 0;
        }
        if (!flying) watcher = -1;
        for (let i = 0; i < N; i++) {
          const d = dolls[i];
          let aim = 0;
          if (i === watcher && !flight[i].air && tiny) {
            const dx = tiny.group.position.x - d.root.position.x, dz = tiny.group.position.z - d.root.position.z;
            const near = Math.hypot(dx, dz) < 8.5;
            if (near) {
              // she can only turn so far, and she sulks back once it passes behind her
              // the limit counts the turn she already has towards a speaker, so her face stays in view
              aim = THREE.MathUtils.clamp(Math.atan2(dx, dz + 1.6), -0.72 - d.c.look, 0.72 - d.c.look);
              watchUp = THREE.MathUtils.clamp(tiny.group.position.y - d.root.position.y - 1, 0, 2);
              if (!curious && !d.bubble.classList.contains('is-on')) {
                curious = 1;
                setBubble(d.bubble, '?');
                d.bubble.classList.add('is-on', 'is-laugh');
                setTimeout(() => { if (d.bubble.textContent === '?') d.bubble.classList.remove('is-on', 'is-laugh'); }, 2200);
              }
            }
          }
          watch[i] += (aim - watch[i]) * Math.min(1, dt * 3.2);
        }
      }
      let lastT = 0;
      function compose(t: number) {
        watchFlyer(Math.min(t - lastT, 1 / 30));
        flapPhysics(Math.min(t - lastT, 1 / 30));
        lastT = t;
        for (let i = 0; i < N; i++) {
          const d = dolls[i];
          const c = d.c;
          const sway = setName === 'dither'
            ? Math.sin(t * 0.5 + i * 2.3) * 0.016 * float.v
            : Math.sin(t * 1.3 + i * 0.9) * 0.02 + Math.sin(t * 0.7 + i * 1.7) * 0.03 * float.v;
          // in the clouds they ride a slow swell, each at her own pace; heavier moves less
          lift[i] = setName === 'dither'
            ? Math.sin(t * (0.62 + i * 0.07) + i * 1.9) * (0.03 + i * 0.008) * float.v
            : float.v * (0.6 + Math.sin(t * 0.8 + i * 1.3) * 0.16) * (0.6 + 0.4 * d.scale);
          // a doll still nested inside another rides with her and takes no lift of its own
          const freed = i === 0 || d.root.parent === scene;
          d.root.position.set(c.x + c.dx, c.y + c.hop + c.fly + (freed ? lift[i] : 0), c.z);
          d.root.rotation.set(-watch[i] * 0.06 * watchUp, c.look + c.spin + watch[i], sway + c.tilt + c.wob);
          const sq = c.squash;
          d.root.scale.set((c.size / Math.sqrt(sq)), sq * c.size, c.size / Math.sqrt(sq));
          if (d.top) {
            d.top.position.set(d.topBase.x, d.topBase.y + d.lid.y, d.topBase.z + d.lid.z);
            d.top.rotation.x = d.lid.rx;
            d.top.rotation.y = d.lid.ry;
          }
        }
      }

      // ---- HTML over the dolls: hit areas, bubbles, the sunburst behind the speaker
      const v = new THREE.Vector3();
      const box = new THREE.Box3();
      let speaker = -1;
      function place() {
        for (const d of dolls) {
          box.setFromObject(d.root);
          let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
          for (let k = 0; k < 8; k++) {
            v.set(k & 1 ? box.max.x : box.min.x, k & 2 ? box.max.y : box.min.y, k & 4 ? box.max.z : box.min.z).project(camera);
            const sx = (v.x * 0.5 + 0.5) * innerWidth, sy = (-v.y * 0.5 + 0.5) * innerHeight;
            if (sx < x0) x0 = sx;
            if (sx > x1) x1 = sx;
            if (sy < y0) y0 = sy;
            if (sy > y1) y1 = sy;
          }
          const st = d.el.style;
          st.left = `${x0}px`;
          st.top = `${y0}px`;
          st.width = `${x1 - x0}px`;
          st.height = `${y1 - y0}px`;
        }
        // each sunburst sits behind its doll's head, facing the camera
        const tr = performance.now() / 9000;
        const rayDir = new THREE.Vector3();
        for (let i = 0; i < N; i++) {
          const d = dolls[i], k = d.scale, b = rayBoost[i].v;
          // behind the head as seen from wherever the camera is, so it never crosses the doll
          rayDir.set(d.c.x + d.c.dx, d.c.y + d.c.hop + d.c.fly + lift[i] + H * k * (setName === 'dither' ? 0.86 : 0.72), d.c.z);
          rays[i].position.copy(rayDir);
          rayDir.sub(camera.position).normalize();
          rays[i].position.addScaledVector(rayDir, 0.7 * k + 0.2);
          const kick = rayKick[i];
          // the burst follows the doll's squash and its tap pop
          rays[i].scale.setScalar((setName === 'dither' ? 0.6 + 1.25 * rayIdle.v + 0.65 * b : 2.15 + 0.35 * b) * k * (1 + 0.45 * kick.pop) * (0.6 + 0.4 * d.c.squash));
          rays[i].quaternion.copy(camera.quaternion);
          rays[i].rotateZ(tr * (i % 2 ? -1 : 1) + i + kick.turn - d.c.tilt);
          if (setName === 'dither') {
            raysMats[i].opacity = 0.55 * rayIdle.v + 0.3 * b;
            rays[i].visible = d.root.visible;
          }
          else raysMats[i].opacity = ready ? 0.5 + 0.5 * b : raysMats[i].opacity;
        }
      }

      // ---- the one clock
      let ready = false;
      // a device that can't keep up draws fewer pixels rather than dropping frames: if most
      // frames run long for a couple of seconds, the resolution steps down, never below 1x
      // long means long for this screen: a phone held to 30fps by low-power mode isn't struggling
      let slow = 0, lastTick = 0, settleUntil = 0, best = 1000;
      const adapt = (now: number) => {
        const dt = now - lastTick;
        lastTick = now;
        if (!ready || now < settleUntil || dt > 250) return; // skip the start, and returns from a hidden tab
        best = Math.min(best, Math.max(dt, 4));
        slow += ((dt > best * 1.6 ? 1 : 0) - slow) * 0.03;
        const ratio = renderer.getPixelRatio();
        if (slow < 0.6 || ratio <= 1) return;
        renderer.setPixelRatio(Math.max(1, ratio - 0.5));
        frame();
        slow = 0;
        settleUntil = now + 2500;
      };
      gsap.ticker.add(() => {
        const t = performance.now() / 1000;
        adapt(t * 1000);
        pointer.x += (pointer.tx - pointer.x) * 0.06;
        pointer.y += (pointer.ty - pointer.y) * 0.06;
        compose(t);
        world?.update(t, pointer.x, pointer.y);
        meadow?.update(t);
        atmos?.(t);
        backdrop?.update(t);
        tiny?.update(t, camera, camera.position.x, portrait() ? Math.min(1, visHalf(0) / 5) : 1);
        controls.update();
        if (ready) place();
        // a rendered backdrop is already graded: draw it straight, no glow or blur pass
        if (backdrop?.render) backdrop.render(scene, camera);
        else if (dots && !backdrop) dots.render(scene, camera, camera.position.distanceTo(controls.target));
        else renderer.render(scene, camera);
      });

      addEventListener('resize', frame);
      frame();

      // ---- the entrance: each doll pops out of the one before it
      // on the cloud page the name starts printing while the loader's cream is still thinning
      // (it takes 0.9 s), so the sky is never empty between the two
      const intro = gsap.timeline({ paused: true, delay: setName === 'dither' ? 0.1 : 0.5, onComplete: () => {
        introDone = true;
        visitorsMayLoad(); // the visitors' models wait until the entrance has the network to itself
        startTalking();
        if (setName !== 'dither') gsap.to(float, {
          v: 1, duration: 2.4, ease: 'sine.inOut',
          onUpdate: () => {
            if (!contactPool) return;
            (contactPool.material as THREE.MeshBasicMaterial).opacity = 1 - float.v * 0.65;
            contactPool.scale.setScalar(1 - float.v * 0.2);
          },
        });
      } });
      dollsIn();
      sessionStorage.removeItem('nest-retry'); // it drew: a later failure gets its tries again
      void entered.then(() => intro.play());
      intro.add(() => {
        page!.classList.add('is-gl');
        ready = true;
        place();
      }, 0.05);
      if (setName === 'dither') {
        // the entrance: they surface. Each doll comes up out of the cloud like something
        // buoyant, Mama first and slowest, the smaller ones lighter and quicker, each one
        // easing to a stop, sinking back a touch and finding her level. Nothing crosses.
        const REST = [0.54, 0.54, 0.54, 0.54]; // just above the bank, their hems showing
        // the name prints itself onto the sky: dots swell into each letter, from the middle
        // outwards
        backdrop?.title?.glyphs.forEach((g, i) => {
          if (reduce) return Object.assign(g, { a: 1 });
          const at = 0.15 + Math.abs(i - 3.5) * 0.09;
          intro.to(g, { a: 1, duration: 0.95, ease: 'sine.inOut' }, i === 8 ? 1 : at);
          intro.to(g, { wave: 1, duration: 1.5, ease: 'sine.inOut' }, 2.2);
        });
        [3, 2, 1].forEach((i) => intro.add(() => scene.attach(dolls[i].root), 0));
        dolls.forEach((d, i) => {
          Object.assign(d.c, { x: SLOTS[i].x, y: -3.4, z: SLOTS[i].z, tilt: (i % 2 ? -1 : 1) * 0.07, look: (i % 2 ? 0.34 : -0.34) });
        });
        const ORDER = [0, 1, 3, 2];
        ORDER.forEach((i, step) => {
          const c = dolls[i].c;
          const at = 1 + [0, 0.8, 1.35, 1.8][step];
          const dur = 2.2 - i * 0.22;                   // Mama is heavy, Bunso (3) is light
          intro.add(() => pop(420 + i * 110), at + 0.35);
          intro.to(c, { y: REST[i] + 0.1, duration: dur, ease: 'power2.out' }, at);
          intro.to(c, { y: REST[i], duration: dur * 0.8, ease: 'sine.inOut' }, at + dur);
          intro.to(c, { tilt: 0, duration: dur * 1.3, ease: 'sine.inOut' }, at + 0.2);
          intro.to(c, { look: 0, duration: dur * 1.2, ease: 'sine.inOut' }, at + 0.1);
        });
        intro.to(float, { v: 1, duration: 2, ease: 'sine.inOut' }, 3.4);
        intro.to(rayIdle, { v: 1, duration: 1.2, ease: 'sine.inOut' }, 3.4);
      } else for (let i = 1; i < N; i++) {
        const parent = dolls[i - 1];
        const child = dolls[i];
        const at = (i - 1) * 0.95;
        intro.add(() => {
          // free the child from its parent, keeping it where it is in the world
          child.root.updateMatrixWorld(true);
          const p = new THREE.Vector3();
          child.root.getWorldPosition(p);
          scene.attach(child.root);
          Object.assign(child.c, { x: p.x, y: p.y, z: p.z });
          pop(520 + i * 90);
        }, at);
        // the lid pops up and tips back, out of the way
        intro.to(parent.lid, { y: 0.42, z: -1.05, rx: -0.35, duration: 0.32, ease: 'back.out(2.4)' }, at);
        intro.to(parent.c, { squash: 0.9, duration: 0.12, yoyo: true, repeat: 1, ease: 'power2.out' }, at);
        // the hop: up over the rim, across to its place, a squash on landing
        const apex = (SPLIT + 0.2) * parent.scale + 0.35;
        intro.to(child.c, { y: apex, duration: 0.3, ease: 'power2.out' }, at + 0.12);
        intro.to(child.c, { x: SLOTS[i].x, z: SLOTS[i].z, duration: 0.62, ease: 'power1.inOut' }, at + 0.18);
        intro.to(child.c, { y: 0, duration: 0.34, ease: 'power2.in' }, at + 0.46);
        if (i === N - 1) intro.to(child.c, { spin: Math.PI * 2, duration: 0.6, ease: 'power2.inOut' }, at + 0.18);
        intro.to(child.c, { squash: 0.8, duration: 0.08, ease: 'power2.out' }, at + 0.8);
        intro.to(child.c, { squash: 1, duration: 0.7, ease: 'elastic.out(1, 0.35)' }, at + 0.88);
        // the parent closes behind it
        intro.to(parent.lid, { y: 0, z: 0, rx: 0, duration: 0.4, ease: 'power3.inOut' }, at + 0.62);
      }

      // ---- the chat
      let chat: gsap.core.Timeline | null = null;
      function lookAt(i: number, target: number) {
        const a = dolls[i].c, b = dolls[target].c;
        const ang = Math.atan2(b.x - a.x, b.z - a.z + 2.2); // +2.2: they half-face us too
        return gsap.utils.clamp(-0.62, 0.62, ang);
      }

      // the sunburst of whoever is speaking opens behind her head; -1 closes them all
      const boostRays = (who: number) => rayBoost.forEach((r, k) => gsap.to(r, { v: k === who ? 1 : 0, duration: 0.4, ease: 'power2.out', overwrite: true }));
      const clearBubbles = () => {
        for (const o of dolls) {
          o.bubble.classList.remove('is-on', 'is-laugh');
          o.think?.classList.remove('is-on');
        }
        boostRays(-1);
      };
      // the mention of ube: the others drift off, one by one, each picturing it
      function dreamBeat(tl: gsap.core.Timeline, who: number, food: string) {
        dolls.forEach((o, k) => {
          if (k === who) return;
          tl.add(() => {
            if (o.think) {
              o.think.dataset.food = food;
              o.think.classList.add('is-on');
            }
          }, `-=${k === 1 ? 2.2 : 0}`);
          tl.to(o.c, { look: k % 2 ? -0.22 : 0.22, duration: 0.6, ease: 'sine.inOut' }, '<');
          tl.to(o.c, { tilt: (k % 2 ? 1 : -1) * 0.05, duration: 0.8, ease: 'sine.inOut' }, '<');
          tl.to({}, { duration: 0.32 });
        });
        tl.to({}, { duration: 1.9 });
        // and the thought comes out loud
        tl.add(() => {
          clearBubbles();
          dolls.forEach((o, k) => {
            if (k === who) return;
            setBubble(o.bubble, YUMS[k % YUMS.length]);
            o.bubble.classList.add('is-on', 'is-laugh');
          });
          pop(620);
        });
        dolls.forEach((o, k) => {
          if (k !== who) tl.to(o.c, { squash: 1.06, duration: 0.3, yoyo: true, repeat: 3, ease: 'sine.inOut' }, '<');
        });
        tl.to({}, { duration: 1.6 });
        tl.add(clearBubbles);
        dolls.forEach((o) => tl.to(o.c, { tilt: 0, duration: 0.5, ease: 'sine.inOut' }, '<'));
      }

      function sayBeat(tl: gsap.core.Timeline, who: number, text: string, act?: string) {
        const d = dolls[who];
        const dur = 1.1 + text.length * 0.045;
        tl.add(() => {
          speaker = who;
          clearBubbles();
          setBubble(d.bubble, text);
          d.bubble.classList.add('is-on');
          chime(d.scale);
          boostRays(who);
        });
        // everyone turns to the speaker; the speaker turns a little to the group
        for (let k = 0; k < N; k++) {
          const look = k === who ? lookAt(k, who === 0 ? 1 : 0) * 0.4 : lookAt(k, who);
          tl.to(dolls[k].c, { look, duration: 0.45, ease: 'power3.out' }, '<');
        }
        // talking: a quick bounce and wiggle while the line is up
        const syll = Math.max(3, Math.round(text.length / 5));
        tl.to(d.c, { squash: 1.045, duration: 0.11, yoyo: true, repeat: syll * 2 - 1, ease: 'sine.inOut' }, '<');
        tl.to(d.c, { tilt: 0.05, duration: 0.22, yoyo: true, repeat: syll - 1, ease: 'sine.inOut' }, '<');
        if (act === 'hop') {
          tl.fromTo(d.c, { hop: 0 }, { hop: 0.32 * d.scale, duration: 0.2, yoyo: true, repeat: 3, ease: 'power2.out', immediateRender: false }, '<'); // its own channel: it always lands where it began
        } else if (act === 'spin') {
          tl.to(d.c, { spin: `+=${Math.PI * 2}`, duration: 0.8, ease: 'power2.inOut' }, '<0.2');
        } else if (act === 'tip' && d.top) {
          // tips her lid like a hat
          tl.to(d.lid, { y: 0.28, rx: -0.25, duration: 0.3, ease: 'back.out(2)' }, '<0.15');
          tl.to(d.lid, { y: 0, rx: 0, duration: 0.35, ease: 'power3.inOut' }, '<0.7');
        }
        tl.to({}, { duration: dur });
      }

      function laughBeat(tl: gsap.core.Timeline) {
        tl.add(() => {
          speaker = -1;
          rayBoost.forEach((r) => gsap.to(r, { v: 0.6, duration: 0.3, ease: 'power2.out', overwrite: true }));
          [0, 0.12, 0.24, 0.36].forEach((dt, k) => setTimeout(() => pop(700 + k * 120), dt * 1000));
          dolls.forEach((o, k) => {
            setBubble(o.bubble, LAUGHS[k % LAUGHS.length]);
            o.bubble.classList.add('is-on', 'is-laugh');
          });
        });
        dolls.forEach((o, k) => {
          tl.fromTo(o.c, { hop: 0 }, { hop: 0.16 * o.scale, duration: 0.13, yoyo: true, repeat: 5, ease: 'power2.out', immediateRender: false }, k === 0 ? '<' : '<0.05');
          tl.to(o.c, { tilt: k % 2 ? 0.09 : -0.09, duration: 0.13, yoyo: true, repeat: 5, ease: 'sine.inOut' }, '<');
          tl.to(o.c, { look: 0, duration: 0.3 }, '<');
        });
        tl.to({}, { duration: 1.1 });
        tl.add(clearBubbles);
      }

      // ---- flappy dolls: every tap is a kick upward and gravity does the rest, so keeping one up
      // takes real tapping. Heavier dolls fall harder. Keep it up and she leaves the top of the
      // screen, the others wonder where she went, and she drops back in
      // every doll takes to the air her own way, and the others have opinions
      const FLIGHT: { lines: Record<number, string>; react: Record<number, [number, string]>; gone: [number, string]; fall: string; land: string }[] = [
        {
          lines: { 3: 'Put me down this instant!', 5: 'I am your MOTHER!', 8: 'Oh. This is quite nice.', 12: 'Is that Kentish Town?' },
          react: { 6: [3, 'Mama can fly?!'], 10: [1, 'Mama, come down!'] },
          gone: [3, 'Does this mean no bedtime?'],
          fall: 'Aaaah!',
          land: 'Nobody saw that.',
        },
        {
          lines: { 3: 'Excuse me?!', 5: 'Oh. Oh, I like this.', 8: 'I can see Chinatown!', 12: 'Okay, that is enough.' },
          react: { 6: [2, 'Show off.'], 10: [0, 'Lila! Your lid!'] },
          gone: [2, 'More ube for me.'],
          fall: 'Not again!',
          land: 'Never again.',
        },
        {
          lines: { 3: 'Hey, stop it!', 5: 'Wheee!', 8: "I'm flyinggg!", 12: 'Too high! Too high!' },
          react: { 6: [1, 'She will be back.'], 10: [3, 'Take me next!'] },
          gone: [1, 'Where did she go?'],
          fall: 'Aaaah!',
          land: 'Am I dizzy, or is it you?',
        },
        {
          lines: { 3: 'Again! Again!', 5: 'Higher!', 8: 'HIGHER!', 12: 'I can see everything!' },
          react: { 6: [0, 'Bunso! Get down from there!'], 10: [2, 'She is so small up there.'] },
          gone: [0, 'BUNSO!'],
          fall: 'Wheeeeee!',
          land: 'Again!',
        },
      ];
      const solos: (gsap.core.Timeline | null)[] = new Array(N).fill(null);
      const flight = dolls.map((d, i) => ({
        last: 0, streak: 0, wait: 0, vy: 0, vx: 0, wobV: 0, downUntil: 0, wobTo: 0, ouch: 0, air: false, gone: false, bye: false, yelled: false,
        press: false, held: false, dragged: false, flung: false, shaken: false,
        g: 6 + 3.2 * d.scale,
        kick: 4.3 - 1.2 * d.scale,
        lean: i % 2 ? 1 : -1,
      }));
      const flyLine = (i: number, text: string) => {
        clearBubbles();
        speaker = i;
        boostRays(i);
        setBubble(dolls[i].bubble, text);
        dolls[i].bubble.classList.add('is-on');
      };
      // a line of her own: mid-event it joins the bubbles already up instead of clearing them
      const tapLine = (i: number, text: string) => (busy ? say2(i, text) : flyLine(i, text));
      // the height at which even her feet are above the top of the screen
      function exitHeight(d: Doll) {
        const dist = camera.position.z / 0.9949;
        const top = camera.position.y - 0.1006 * dist + dist * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
        return top - d.c.y + 0.5;
      }
      function tapFly(i: number) {
        const d = dolls[i], f = flight[i], now = performance.now();
        if (f.gone) return true;
        const quick = now - f.last < 650;
        f.last = now;
        f.streak = quick || f.air ? f.streak + 1 : 1;
        clearTimeout(f.wait);
        f.vy = f.kick;
        // by now there is little of her left to tap: this one sends her clean off the top
        const exit = exitHeight(d);
        if (f.streak >= 6 && d.c.fly > exit - 2.6 * d.scale) f.vy = Math.sqrt(2 * f.g * (exit - d.c.fly)) + 1;
        f.air = true;
        f.yelled = false;
        gsap.fromTo(d.c, { squash: 0.86 }, { squash: 1, duration: 0.4, ease: 'elastic.out(1, 0.4)', overwrite: 'auto' });
        pop(440 + Math.min(f.streak, 14) * 55);
        if (f.streak === 1) return false; // a lone tap is a hop and her usual line
        if (f.streak === 2) {
          // the usual reaction gives way: settle anything it left half done
          solos[i]?.kill();
          gsap.killTweensOf(d.lid);
          Object.assign(d.lid, { y: 0, rx: 0 });
          gsap.to(d.c, { spin: Math.round(d.c.spin / (Math.PI * 2)) * Math.PI * 2, duration: 0.2 });
          d.bubble.classList.remove('is-on');
        }
        const script = FLIGHT[i];
        if (script.lines[f.streak]) tapLine(i, script.lines[f.streak]);
        const react = script.react[f.streak];
        if (react && !flight[react[0]].gone) {
          // the other doll answers alongside her, without taking her bubble away
          setBubble(dolls[react[0]].bubble, react[1]);
          dolls[react[0]].bubble.classList.add('is-on');
          gsap.to(rayBoost[react[0]], { v: 1, duration: 0.4, ease: 'power2.out', overwrite: true });
        }
        return true;
      }
      function landed(i: number) {
        const d = dolls[i], f = flight[i];
        const flew = f.streak >= 2;
        const flung = f.flung, shaken = f.shaken;
        f.flung = f.shaken = false;
        Object.assign(f, { air: false, vy: 0, streak: 0, bye: false, yelled: false });
        d.c.fly = 0;
        d.el.classList.remove('is-flying');
        gsap.to(d.c, { tilt: 0, duration: 0.5, ease: 'elastic.out(1, 0.5)' });
        if (shaken) {
          tapLine(i, "I don't feel so good.");
          f.wobV += 3.4 * f.lean;
        } else if (flung) {
          f.wobV += 2.4 * f.lean;
          if (speaker === i && !busy) clearBubbles();
          f.wait = window.setTimeout(resumeChat, 700);
          return;
        }
        if (!flew && !shaken) {
          // a hop taken during an event has no line of its own to bring the chat back
          if (!solos.some((s) => s?.isActive())) resumeChat();
          return;
        }
        if (!shaken) tapLine(i, FLIGHT[i].land);
        f.wait = window.setTimeout(() => {
          if (busy) return dolls[i].bubble.classList.remove('is-on');
          if (speaker === i) clearBubbles();
          speaker = -1;
          resumeChat();
        }, 1700);
      }
      // an event has her, so a tap can't move her: she rocks where she is and her burst kicks
      function poke(i: number) {
        const kick = rayKick[i], side = i % 2 ? -1 : 1;
        flight[i].wobV += side * 2.6;
        pop(520);
        gsap.timeline({ overwrite: true })
          .to(kick, { pop: 1, duration: 0.12, ease: 'power2.out' })
          .to(kick, { pop: 0, duration: 0.9, ease: 'elastic.out(1, 0.3)' });
        gsap.to(kick, { turn: `+=${side * 1.2}`, duration: 1.1, ease: 'power3.out' });
      }
      const resumeChat = () => { if (!busy && flight.every((o) => !o.air)) void chat?.resume(); };

      // ---- every so often a saucer comes down and takes one of the family. It brings her back
      const ufo = reduce || setName !== 'dither' ? null : createUfo(scene, 3.2 * renderer.getPixelRatio());
      let busy = false;
      // the page's little accidents, taking turns, with a good gap between them
      const EVENTS = ['bird', 'ube', 'plane', 'sneeze', 'cow', 'nap', 'stack', 'rain', 'ufo', 'gossip', 'peek', 'sneeze', 'bird', 'cow', 'ube', 'stack', 'plane', 'nap', 'ufo', 'rain'];
      let eventAt = 0, eventNext = 32 + Math.random() * 14;
      const eventDone = () => {
        busy = false;
        speaker = -1;
        clearBubbles();
        eventNext = performance.now() / 1000 + 30 + Math.random() * 25;
        resumeChat();
      };
      const say2 = (who: number, text: string) => {
        // a second doll answers without taking the first one's bubble away
        setBubble(dolls[who].bubble, text);
        dolls[who].bubble.classList.add('is-on');
        gsap.to(rayBoost[who], { v: 1, duration: 0.4, ease: 'power2.out', overwrite: true });
      };

      // she feels it coming, it builds, and it blows her top half clean off
      function sneeze(i: number) {
        const d = dolls[i], f = flight[i];
        busy = true;
        f.gone = true;
        chat?.pause();
        clearBubbles();
        const c = d.c, lid = d.lid, side = i % 2 ? 1 : -1;
        const tl = gsap.timeline({ onComplete: () => { f.gone = false; eventDone(); } });
        tl.add(() => flyLine(i, 'Ah...'), 0);
        tl.to(c, { squash: 1.09, tilt: -0.05 * side, duration: 0.6, ease: 'sine.inOut' }, 0);
        tl.add(() => flyLine(i, 'Ah... ah...'), 0.8);
        tl.to(c, { squash: 1.17, tilt: -0.1 * side, duration: 0.5, ease: 'sine.in' }, 0.8);
        tl.to(c, { squash: 1.05, duration: 0.14, ease: 'sine.out' }, 1.3);
        tl.to(c, { squash: 1.2, duration: 0.2, ease: 'sine.in' }, 1.44);
        tl.add(() => { flyLine(i, 'ACHOO!'); pop(170); }, 1.66);
        tl.to(c, { squash: 0.76, tilt: 0.13 * side, duration: 0.08, ease: 'power3.out' }, 1.66);
        tl.to(c, { squash: 1, tilt: 0, duration: 0.8, ease: 'elastic.out(1, 0.35)' }, 1.74);
        // the lid goes up, turning over, and drops back on not quite straight
        tl.to(lid, { y: 1.9, duration: 0.42, ease: 'power2.out' }, 1.66);
        tl.to(lid, { rx: Math.PI * 2, duration: 0.84, ease: 'none' }, 1.66);
        tl.to(lid, { ry: 0.55 * side, duration: 0.84, ease: 'none' }, 1.66);
        tl.to(lid, { y: 0, duration: 0.42, ease: 'power2.in' }, 2.08);
        tl.add(() => { lid.rx = 0; pop(260); }, 2.5);
        tl.to(c, { squash: 0.88, duration: 0.06 }, 2.5);
        tl.to(c, { squash: 1, duration: 0.5, ease: 'elastic.out(1, 0.4)' }, 2.56);
        tl.add(() => say2((i + 2) % N, 'Bless you!'), 2.3);
        // her lid is on crooked: a pause, then she shuffles it straight
        tl.to(lid, { ry: 0.35 * side, duration: 0.12, ease: 'sine.inOut' }, 3.5);
        tl.to(lid, { ry: 0, duration: 0.3, ease: 'back.out(2)' }, 3.75);
        tl.add(() => flyLine(i, 'Excuse me.'), 3.7);
        tl.to({}, { duration: 1.3 }, 3.7);
      }

      // the three small ones stack up while Mama isn't looking. It wobbles, and over it goes
      function stackUp() {
        const [lila, minty, bunso] = [dolls[1], dolls[2], dolls[3]];
        busy = true;
        flight.forEach((f) => { f.gone = true; });
        chat?.pause();
        clearBubbles();
        const dir = Math.random() < 0.5 ? 1 : -1;
        const rest = { y: lila.c.y, l: { x: lila.c.x, z: lila.c.z }, m: { x: minty.c.x, z: minty.c.z }, b: { x: bunso.c.x, z: bunso.c.z } };
        const base = rest.y; // Lila stays in full view; they shrink a little so the tower fits
        const SMALL = 0.76;
        const h1 = H * lila.scale * 0.97 * SMALL, h2 = H * minty.scale * 0.97 * SMALL;
        const lean = { a: 0 };
        let stacked = false;
        const hold = () => {
          if (!stacked) return;
          // the tower bends as one, each doll carried by the top of the one under her
          lila.c.tilt = minty.c.tilt = bunso.c.tilt = lean.a;
          minty.c.x = lila.c.x - Math.sin(lean.a) * h1;
          minty.c.y = lila.c.y + Math.cos(lean.a) * h1;
          bunso.c.x = minty.c.x - Math.sin(lean.a) * h2;
          bunso.c.y = minty.c.y + Math.cos(lean.a) * h2;
        };
        const tl = gsap.timeline({
          onUpdate: hold,
          onComplete: () => { eventDone(); },
        });
        const hop = (d: Doll, at: number, y: number) => {
          tl.to(d.c, { squash: 0.84, duration: 0.14, ease: 'power2.out' }, at);
          tl.to(d.c, { squash: 1.06, duration: 0.14, ease: 'power2.in' }, at + 0.14);
          tl.to(d.c, { x: lila.c.x, z: lila.c.z, duration: 0.74, ease: 'sine.inOut' }, at + 0.2);
          tl.to(d.c, { y: y + 0.62, duration: 0.42, ease: 'power2.out' }, at + 0.2);
          tl.to(d.c, { y, duration: 0.32, ease: 'power2.in' }, at + 0.62);
          tl.add(() => pop(420 + y * 90), at + 0.94);
          tl.to(d.c, { squash: 0.8, duration: 0.07 }, at + 0.94);
          tl.to(d.c, { squash: 1, duration: 0.5, ease: 'elastic.out(1, 0.4)' }, at + 1.01);
        };
        tl.add(() => flyLine(3, 'Tower time!'), 0);
        [lila, minty, bunso].forEach((d) => tl.to(d.c, { size: SMALL, duration: 0.5, ease: 'sine.inOut' }, 0.2));
        hop(minty, 0.6, base + h1);
        hop(bunso, 1.8, base + h1 + h2);
        tl.add(() => { stacked = true; flyLine(3, 'Look at us!'); }, 3.05);
        tl.add(() => say2(0, 'Get down from there!'), 3.9);
        // it starts small, then gets out of hand
        [0.035, -0.05, 0.075, -0.1].forEach((a, k) => {
          tl.to(lean, { a: a * dir, duration: 0.46, ease: 'sine.inOut' }, 3.3 + k * 0.46);
        });
        tl.add(() => flyLine(2, 'Uh oh.'), 5);
        tl.to(lean, { a: 0.16 * dir, duration: 0.5, ease: 'sine.inOut' }, 5.14);
        tl.to(lean, { a: 0.62 * dir, duration: 0.5, ease: 'power2.in' }, 5.64);
        // over it goes: from here gravity has them, the same as a doll tapped into the air
        tl.add(() => {
          stacked = false;
          flyLine(3, 'Aaaah!');
          [minty, bunso].forEach((d) => {
            const i = dolls.indexOf(d), f = flight[i], y = d.c.y;
            Object.assign(f, { gone: false, air: true, vy: 2.2 });
            d.c.y = rest.y;
            d.c.fly = y - rest.y;
            const to = d === minty ? rest.m : rest.b;
            gsap.to(d.c, { x: to.x, z: to.z, duration: 1, ease: 'sine.out' });
          });
          pop(300);
        }, 6.14);
        tl.to(lila.c, { y: rest.y, duration: 0.5, ease: 'sine.inOut' }, 6.2);
        [lila, minty, bunso].forEach((d) => tl.to(d.c, { size: 1, duration: 0.7, ease: 'sine.inOut' }, 6.3));
        tl.to(lila.c, { tilt: 0, duration: 0.9, ease: 'elastic.out(1, 0.4)' }, 6.2);
        tl.add(() => { flight.forEach((f) => { if (!f.air) f.gone = false; }); }, 7.2);
        tl.add(() => flyLine(3, 'Again!'), 7.7);
        tl.add(() => say2(0, 'No.'), 8.5);
        tl.to({}, { duration: 1.5 }, 8.5);
      }

      // a seagull lands on someone's head. Everyone can see it except her
      const bird = ufo ? createBird(scene) : null;
      function birdLands(i: number) {
        const d = dolls[i], f = flight[i], b = bird!, st = b.state, pos = b.group.position;
        busy = true;
        f.gone = true;
        chat?.pause();
        clearBubbles();
        const dir = i > 1 ? -1 : 1;
        const a = (i + 1) % N, c = (i + 2) % N;
        const top = d.c.y + 2 * d.scale;
        pos.set(d.c.x - dir * 12, top + 2.6, 0.2);
        b.group.rotation.y = dir * 1.15;
        b.group.visible = true;
        d.el.classList.add('has-bird');
        Object.assign(st, { flap: 1, peck: 0, perched: null, at: 2 * d.scale });
        b.play('Fly', 0);
        const tl = gsap.timeline({ onComplete: () => { b.group.visible = false; f.gone = false; eventDone(); } });
        tl.add(() => d.el.classList.remove('has-bird'), 9.15);
        tl.to(pos, { x: d.c.x, duration: 2.1, ease: 'sine.out' }, 0);
        // both slowing together: a glide down that stalls onto her head, not a dive into it
        tl.to(pos, { y: top, duration: 2.1, ease: 'sine.out' }, 0);
        tl.to(st, { flap: 0, duration: 0.3, ease: 'sine.in' }, 1.85);
        tl.add(() => b.play('Glide', 0.3), 1);
        // Land's feet touch 0.36s in, which is the moment it reaches her head
        tl.add(() => b.play('Land', 0.15), 1.75);
        tl.to(b.group.rotation, { y: 0.5 * dir, duration: 0.45, ease: 'sine.inOut' }, 1.75);
        tl.add(() => { st.perched = d.root; pop(520); }, 2.1);
        tl.to(d.c, { squash: 0.95, duration: 0.08 }, 2.1);
        tl.to(d.c, { squash: 1, duration: 0.5, ease: 'elastic.out(1, 0.4)' }, 2.18);
        tl.add(() => flyLine(a, `Psst. ${NAMES[i]}.`), 3);
        tl.add(() => flyLine(i, 'What?'), 4.2);
        tl.add(() => b.play('HeadTilt'), 4.5);
        tl.add(() => flyLine(c, 'Nothing.'), 5.3);
        tl.add(() => b.play('Ruffle'), 5.45);
        tl.fromTo(dolls[c].c, { hop: 0 }, { hop: 0.12, duration: 0.12, yoyo: true, repeat: 5, ease: 'sine.inOut', immediateRender: false }, 5.4);
        tl.add(() => { clearBubbles(); pop(1500); b.play('Squawk', 0.1); }, 6.5);
        tl.add(() => flyLine(i, 'Did someone say something?'), 6.8);
        // it pecks her, twice. Peck's beak lands 0.1s in, on her squash
        [8, 8.34].forEach((at) => {
          tl.add(() => b.play('Peck', 0.03), at);
          tl.to(st, { peck: 1, duration: 0.09, ease: 'power2.in' }, at);
          tl.to(st, { peck: 0, duration: 0.15, ease: 'sine.out' }, at + 0.09);
          tl.to(d.c, { squash: 0.93, duration: 0.06, yoyo: true, repeat: 1 }, at + 0.08);
        });
        tl.add(() => flyLine(i, 'OW!'), 8.5);
        // she jumps, and it leaves in no hurry
        tl.fromTo(d.c, { hop: 0 }, { hop: 0.5, duration: 0.2, yoyo: true, repeat: 1, ease: 'power2.out', immediateRender: false }, 9.1);
        // TakeOff crouches first, so its leap comes on her jump
        tl.add(() => b.play('TakeOff', 0.08), 8.99);
        tl.add(() => { st.perched = null; pop(1500); }, 9.15);
        // it turns to face the way it's going, and climbs at once or her jump goes straight through it
        const away = d.c.x > 1.5 ? 1 : -1;
        tl.to(b.group.rotation, { y: away * 1.15, duration: 0.3, ease: 'sine.inOut' }, 9.15);
        tl.to(st, { flap: 1, duration: 0.15 }, 9.15);
        tl.to(pos, { x: d.c.x + away * 12, duration: 2.2, ease: 'power1.in' }, 9.15);
        tl.to(pos, { y: top + 1.5, duration: 1.4, ease: 'sine.out' }, 9.15);
        tl.add(() => { flight[i].wobV += 2.2; flyLine(i, 'Seagulls.'); }, 10);
        tl.to({}, { duration: 1.9 }, 10);
      }
      // ---- dolls are solid: nobody passes through anybody, and a hard hit puts you on your back
      const KNOCK = ['Watch it!', 'Ow!', 'Hey!', 'Oof!'];
      // the dolls keep a left-to-right order, and only change it by going over the top of each other
      const order = [...Array(N).keys()].sort((p, q) => dolls[p].c.x - dolls[q].c.x);
      const X = (i: number) => dolls[i].c.x + dolls[i].c.dx;
      const clearOf = (a: number, b: number) => {
        const A = dolls[a], B = dolls[b], ay = A.c.y + A.c.fly, by = B.c.y + B.c.fly;
        return ay > by + H * B.scale * 0.9 || by > ay + H * A.scale * 0.9;
      };
      // how far apart two dolls' bases must be, a on the left of b. A doll tips over from her base,
      // so lying down her body reaches out to one side of it
      const spacing = (a: number, b: number) => {
        const A = dolls[a], B = dolls[b];
        const reach = (d: Doll) => ({
          off: -Math.sin(d.c.wob + d.c.tilt) * d.scale,
          half: d.scale * (0.6 * Math.abs(Math.cos(d.c.wob + d.c.tilt)) + Math.abs(Math.sin(d.c.wob + d.c.tilt))),
        });
        const p = reach(A), q = reach(B), r = p.half + q.half, z = A.c.z - B.c.z;
        return Math.sqrt(Math.max(r * r - z * z, 0)) + p.off - q.off;
      };
      function collide(now: number) {
        for (let i = 0; i + 1 < N; i++) {
          const p = order[i], q = order[i + 1];
          if (X(p) > X(q) && clearOf(p, q)) { order[i] = q; order[i + 1] = p; }
        }
        // ---- who hit whom
        for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) {
          const a = order[i], b = order[j], fa = flight[a], fb = flight[b];
          if (fa.gone || fb.gone || clearOf(a, b) || X(b) - X(a) >= spacing(a, b)) continue;
          const hit = Math.abs(fa.vx - fb.vx) + Math.abs(fa.vy - fb.vy) * 0.5;
          if (!fa.held) fa.vx = -Math.abs(fa.vx) * 0.5 + fb.vx * 0.4;
          if (!fb.held) fb.vx = Math.abs(fb.vx) * 0.5 + fa.vx * 0.4;
          if (hit < 2.2) continue;
          // the one who was hit goes over; the one moving just reels
          const moving = Math.abs(fa.vx) + (fa.held ? 3 : 0) > Math.abs(fb.vx) + (fb.held ? 3 : 0) ? a : b;
          const victim = moving === a ? b : a, fv = flight[victim], push = moving === a ? 1 : -1;
          if (now * 1000 - fv.ouch < 900) continue;
          fv.ouch = now * 1000;
          Object.assign(fv, { wobTo: -push * 1.42, downUntil: performance.now() + 1100 });
          fv.wobV -= push * Math.min(hit, 7) * 1.1;
          flight[moving].wobV += push * 1.6;
          pop(240);
          say2(victim, KNOCK[victim]);
          window.setTimeout(() => { if (speaker !== victim) dolls[victim].bubble.classList.remove('is-on'); }, 1500);
        }
        // ---- nobody overlaps: push outwards from the doll doing the pushing, then back off the walls
        const half = (camera.position.z / 0.9949) * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect;
        const x = order.map(X);
        // a doll an event has is a post: she can't be pushed, but nobody gets through her
        const pinned = (k: number) => flight[order[k]].gone;
        const solid = (m: number, k: number) => !pinned(k) && !clearOf(order[m], order[k]);
        const gap = (m: number, k: number) => spacing(order[m], order[k]);
        const rightward = (from: number) => {
          for (let k = from + 1; k < N; k++) for (let m = from; m < k; m++) if (solid(m, k)) x[k] = Math.max(x[k], x[m] + gap(m, k));
        };
        const leftward = (from: number) => {
          for (let k = from - 1; k >= 0; k--) for (let m = from; m > k; m--) if (solid(m, k)) x[k] = Math.min(x[k], x[m] - gap(k, m));
        };
        let lead = order.findIndex((i) => flight[i].held);
        if (lead < 0) lead = order.reduce((best, i, k) => (Math.abs(flight[i].vx) > Math.abs(flight[order[best]].vx) ? k : best), 0);
        rightward(lead);
        leftward(lead);
        const edge = (i: number) => half - 0.66 * dolls[order[i]].scale;
        const left = camera.position.x - edge(0), right = camera.position.x + edge(N - 1);
        if (x[0] < left && !pinned(0)) { x[0] = left; rightward(0); }
        if (x[N - 1] > right && !pinned(N - 1)) { x[N - 1] = right; leftward(N - 1); }
        for (let k = 0; k < N; k++) if (pinned(k)) { rightward(k); leftward(k); }
        order.forEach((i, k) => {
          const moved = x[k] - X(i);
          if (Math.abs(moved) > 1e-5) dolls[i].c.dx += moved;
        });
        // two who ended up on the wrong sides of each other can't walk home: one hops over
        for (let k = 0; k + 1 < N; k++) {
          const p = order[k], q = order[k + 1];
          if (dolls[p].c.x < dolls[q].c.x) continue;
          const small = dolls[p].scale < dolls[q].scale ? p : q, f = flight[small];
          if (flight.some((o) => o.held) || flight[p].air || flight[q].air || flight[p].gone || flight[q].gone) continue;
          Object.assign(f, { air: true, flung: true, vy: 6 });
          pop(600);
        }
      }

      // ---- the smaller visitors and accidents
      const farUfo = ufo ? createUfo(scene, 3.2 * renderer.getPixelRatio()) : null;
      const cow = ufo ? createCow(scene) : null;
      const plane = ufo ? createPlane(scene) : null;
      const ube = ufo ? createUbeCloud(scene) : null;
      // tapping the ube cloud boops it, whatever else is going on
      if (ube) {
        const ray = new THREE.Raycaster(), tap = new THREE.Vector2(), hit = new THREE.Sphere();
        canvas.addEventListener('pointerdown', (e) => {
          if (!ube.group.visible) return;
          tap.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
          ray.setFromCamera(tap, camera);
          hit.set(ube.group.position, ube.group.scale.x * 0.55);
          if (!ray.ray.intersectsSphere(hit)) return;
          ube.play('Boop');
          pop(900);
        });
      }
      const scoops = ufo ? createScoops(scene) : null;
      // where the rain can land: the dome of each doll's head, read off her box while it rains
      const heads: Head[] = [], headBox = new THREE.Box3();
      const readHeads = () => {
        heads.length = 0;
        dolls.forEach((d, k) => {
          if (!d.root.visible) return;
          headBox.setFromObject(d.root);
          if (headBox.isEmpty()) return;
          const r = (headBox.max.x - headBox.min.x) * 0.3;
          // tagged with the doll, not her place in this list, which shifts as dolls come and go
          heads.push({ id: k, x: (headBox.min.x + headBox.max.x) / 2, y: headBox.max.y - r, z: (headBox.min.z + headBox.max.z) / 2, r });
        });
        return heads;
      };
      const beginEvent = () => { busy = true; chat?.pause(); clearBubbles(); };
      const fiveDoll = root(5);
      const moments: Record<string, () => void> = {
        // far off over the clouds, a saucer takes a cow, and only Bunso sees
        cow() {
          beginEvent();
          const u = farUfo!, c = cow!, z = -5.5, dir = Math.random() < 0.5 ? 1 : -1;
          const tall = portrait();
          const x = camera.position.x + dir * (tall ? visHalf(z) * 0.42 : 4.9);
          const y = tall ? skyY(0.56, z) : 2.85, low = tall ? skyY(0.24, z) : -0.7;
          const pos = u.group.position, reach = { y };
          u.group.scale.setScalar(0.5);
          pos.set(x - dir * 14, y + 1.5, z);
          u.group.visible = true;
          u.group.rotation.z = dir * 0.3;
          c.group.position.set(x, low, z);
          c.group.rotation.set(0, dir > 0 ? 0.5 : Math.PI - 0.5, 0);
          c.group.scale.setScalar(0.62);
          c.group.visible = true;
          c.play('Graze', 0);
          const tl = gsap.timeline({ onUpdate: () => u.reach(reach.y), onComplete: () => { c.group.visible = false; u.group.visible = false; eventDone(); } });
          tl.to(pos, { x, duration: 1.5, ease: 'power3.out' }, 0);
          tl.to(pos, { y, duration: 1.5, ease: 'sine.out' }, 0);
          tl.to(u.group.rotation, { z: 0, duration: 1.2, ease: 'sine.out' }, 0.6);
          tl.add(() => u.play('Arrive', 1.5), 0);
          tl.add(() => u.hatch(true), 1.3);
          if (tall) {
            // up in the open sky there is no cloud for her to graze in: she appears in the beam
            c.group.scale.setScalar(0.02);
            tl.to(c.group.scale, { x: 0.62, y: 0.62, z: 0.62, duration: 0.45, ease: 'back.out(2)' }, 1.75);
          }
          tl.to(u.beam, { value: 1, duration: 0.3 }, 1.7);
          tl.to(reach, { y: low, duration: 0.5, ease: 'power2.out' }, 1.7);
          // out of the clouds quickly, then hanging in the beam where she can be seen
          tl.to(c.group.position, { y: y - 0.45, duration: 3, ease: 'power1.out' }, 2.1);
          tl.to(c.group.rotation, { z: 0.2, duration: 3, ease: 'sine.inOut' }, 2.1);
          // she runs, gives up and rolls, and has one thing left to say
          tl.add(() => c.play('Panic', 0.15), 2.05);
          tl.add(() => c.play('Tumble', 0.6), 3.7);
          tl.add(() => c.moo(), 3.7);
          tl.add(() => flyLine(3, 'Is that a cow?'), 2.4);
          tl.add(() => flyLine(0, 'Do not look at it.'), 3.8);
          tl.to(c.group.scale, { x: 0.02, y: 0.02, z: 0.02, duration: 0.25, ease: 'power2.in' }, 5.05);
          tl.add(() => pop(1300), 5.3);
          tl.to(u.beam, { value: 0, duration: 0.25 }, 5.3);
          tl.add(() => u.hatch(false), 5.4);
          tl.to(reach, { y, duration: 0.3 }, 5.3);
          tl.add(() => flyLine(1, 'That was our milk.'), 5.6);
          tl.to(pos, { x: x + dir * 12, y: y + 2.5, duration: 0.8, ease: 'power3.in' }, 5.9);
          tl.add(() => u.play('Leave', 0.8), 5.9);
          tl.to({}, { duration: 2 }, 6.2);
        },
        // a little plane drags an advert across the sky, under the name
        plane() {
          beginEvent();
          const p = plane!, dir = Math.random() < 0.5 ? 1 : -1, pos = p.group.position;
          const half = (camera.position.z / 0.9949) * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect;
          // far off, between the cloud layers: clouds pass in front of it
          const Z = -6.2, far = half * ((camera.position.z - Z) / camera.position.z);
          const span = far + 5;
          p.face(dir);
          pos.set(camera.position.x - dir * span, portrait() ? skyY(0.42, Z) : 2.1, Z);
          p.group.visible = true;
          const tl = gsap.timeline({ onComplete: () => { p.group.visible = false; eventDone(); } });
          tl.to(pos, { x: camera.position.x + dir * span, duration: 11, ease: 'none' }, 0);
          tl.to(p.group.rotation, { z: dir * 0.06, duration: 1.4, yoyo: true, repeat: 5, ease: 'sine.inOut' }, 0);
          tl.add(() => flyLine(3, 'A plane!'), 2.2);
          tl.add(() => flyLine(2, 'Who is it talking to?'), 4.1);
          tl.add(() => flyLine(0, 'Everyone. That is our name up there.'), 6);
        },
        // Bunso nods off, and is not asleep
        nap() {
          beginEvent();
          const d = dolls[3], f = flight[3];
          f.gone = true;
          const tl = gsap.timeline({ onComplete: () => { f.gone = false; eventDone(); } });
          tl.to(d.c, { tilt: 0.24, duration: 2.6, ease: 'sine.in' }, 0);
          tl.to(d.c, { squash: 1.03, duration: 1, yoyo: true, repeat: 3, ease: 'sine.inOut' }, 0.4);
          tl.add(() => flyLine(3, 'Zzz...'), 0.6);
          tl.add(() => flyLine(3, 'Zzzzzzz...'), 2.2);
          tl.add(() => flyLine(0, 'Bunso.'), 4);
          tl.add(() => flyLine(0, 'BUNSO!'), 5);
          tl.add(() => pop(900), 5.1);
          tl.to(d.c, { hop: 0.5, duration: 0.14, yoyo: true, repeat: 1, ease: 'power2.out' }, 5.1);
          tl.to(d.c, { tilt: 0, duration: 0.5, ease: 'elastic.out(1, 0.4)' }, 5.1);
          tl.add(() => flyLine(3, 'I was not asleep!'), 5.7);
          tl.to({}, { duration: 1.8 }, 5.7);
        },
        // two of them lean in. The third can hear perfectly well
        gossip() {
          beginEvent();
          const [a, b] = [dolls[1], dolls[2]];
          flight[1].gone = flight[2].gone = true;
          const tl = gsap.timeline({ onComplete: () => { flight[1].gone = flight[2].gone = false; eventDone(); } });
          tl.to(a.c, { tilt: -0.16, look: 0.5, duration: 0.6, ease: 'sine.inOut' }, 0);
          tl.to(b.c, { tilt: 0.16, look: -0.5, duration: 0.6, ease: 'sine.inOut' }, 0);
          tl.add(() => flyLine(1, 'Psst. Mama ate the last scoop.'), 0.5);
          tl.add(() => flyLine(2, 'No!'), 2.2);
          tl.add(() => flyLine(1, 'Two, actually.'), 3.3);
          tl.add(() => flyLine(0, 'I can hear you.'), 4.8);
          tl.to(a.c, { tilt: 0, look: 0, duration: 0.14, ease: 'power2.out' }, 5);
          tl.to(b.c, { tilt: 0, look: 0, duration: 0.14, ease: 'power2.out' }, 5);
          tl.to({}, { duration: 1.8 }, 5);
        },
        // Bunso has a stowaway
        peek() {
          beginEvent();
          const d = dolls[3], f = flight[3], rest = fiveDoll.position.y;
          f.gone = true;
          fiveDoll.visible = true;
          const tl = gsap.timeline({ onComplete: () => { fiveDoll.visible = false; fiveDoll.position.y = rest; f.gone = false; eventDone(); } });
          tl.add(() => flyLine(3, 'Hic!'), 0.2);
          tl.to(d.lid, { y: 0.95, duration: 0.3, ease: 'back.out(2)' }, 0.3);
          tl.to(fiveDoll.position, { y: rest + 0.62, duration: 0.5, ease: 'sine.out' }, 0.7);
          tl.add(() => { flyLine(2, 'Who is THAT?'); pop(1250); }, 1.6);
          tl.to(fiveDoll.position, { y: rest, duration: 0.2, ease: 'power2.in' }, 2.9);
          tl.to(d.lid, { y: 0, duration: 0.24, ease: 'power2.in' }, 3.05);
          tl.add(() => flyLine(3, 'Nobody.'), 3.3);
          tl.to({}, { duration: 1.7 }, 3.3);
        },
        // it starts raining ice cream
        rain() {
          beginEvent();
          const half = (camera.position.z / 0.9949) * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
          scoops!.start(camera.position.x, camera.position.y + half, half * 2 * camera.aspect);
          const tl = gsap.timeline({ onComplete: eventDone });
          tl.add(() => flyLine(2, 'Did something just land on me?'), 1.2);
          tl.add(() => flyLine(3, 'IT IS RAINING ICE CREAM!'), 3);
          tl.add(() => { clearBubbles(); dolls.forEach((o, k) => { setBubble(o.bubble, YUMS[k]); o.bubble.classList.add('is-on', 'is-laugh'); }); }, 5);
          tl.add(() => scoops!.stop(), 6.2);
          tl.add(clearBubbles, 7);
          tl.to({}, { duration: 1 }, 7.2);
        },
        // an ube ice cream cloud drifts by behind them, and it has a face
        ube() {
          beginEvent();
          const u = ube!, g = u.group, z = -4.5, dir = Math.random() < 0.5 ? 1 : -1;
          // about a sixth of the screen's height, up in the open sky; on a phone, above the heads
          const tall = 2 * (camera.position.z - z) * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
          g.scale.setScalar(tall * (portrait() ? 0.15 : 0.2));
          const span = visHalf(z) + g.scale.x;
          const y = skyY(portrait() ? 0.42 : 0.27, z);
          g.position.set(camera.position.x - dir * span, y, z);
          g.rotation.set(0, dir * 0.25, 0);
          g.visible = true;
          const tl = gsap.timeline({ onComplete: () => { g.visible = false; eventDone(); } });
          tl.to(g.position, { x: camera.position.x + dir * span, duration: 16, ease: 'none' }, 0);
          tl.to(g.position, { y: y + 0.15, duration: 2, yoyo: true, repeat: 7, ease: 'sine.inOut' }, 0);
          tl.add(() => flyLine(3, 'Mama, that cloud has a face.'), 3);
          tl.add(() => u.play('Blink'), 4.2);
          tl.add(() => flyLine(0, 'That is not a cloud. That is ube.'), 5.4);
          tl.add(() => { flyLine(1, 'Hello, cloud!'); u.play('HappySquint') || u.play('Blink'); }, 6.8);
          // Melt is 7 s and ends as a plain cloud: three drips, one at a time, the first lets go at
          // about 2.3 s in. Nothing else plays over it, or play() would fade it out
          tl.add(() => u.play('Melt'), 8.4);
          tl.add(() => flyLine(2, 'It is dripping. I want it.'), 10.7);
        },
      };
      if (setName) Object.assign(window, { __ube: ube, __scoops: scoops, __sneeze: sneeze, __stack: stackUp, __bird: birdLands, __moments: moments });
      function abduct(i: number) {
        const d = dolls[i], f = flight[i], u = ufo!;
        busy = true;
        f.gone = true; // a tap only rocks her while it has her
        chat?.pause();
        clearBubbles();
        const k = d.scale, dir = Math.random() < 0.5 ? 1 : -1;
        const hover = { x: d.c.x, y: Math.min(2.9, d.c.y + 2 * k + 1.5) }; // low enough for the dome and aerial to stay on screen
        const pos = u.group.position, beam = u.beam;
        const reach = { y: hover.y };
        const held = hover.y - d.c.y - 2 * k * 0.5 - 0.55; // her height just under the hatch
        const friend = i === 3 ? 1 : 3;
        pos.set(hover.x - dir * 15, hover.y + 2.5, 0.2);
        u.group.visible = true;
        u.group.rotation.z = dir * 0.28;
        const tl = gsap.timeline({
          onUpdate: () => u.reach(reach.y),
          onComplete: () => {
            u.group.visible = false;
            f.gone = false;
            eventDone();
          },
        });
        const say = (who: number, text: string, at: number) => tl.add(() => flyLine(who, text), at);
        // in, fast and swooping, and it stops dead over her
        tl.to(pos, { x: hover.x, duration: 1.5, ease: 'power3.out' }, 0);
        tl.to(pos, { y: hover.y, duration: 1.5, ease: 'sine.out' }, 0);
        tl.to(u.group.rotation, { z: 0, duration: 1.6, ease: 'elastic.out(1, 0.5)' }, 0.5);
        tl.add(() => u.play('Arrive', 1.5), 0);
        tl.add(() => u.wave(), 1.2);
        say(i, 'Oh no.', 1.4);
        // the hatch folds open, the beam comes down, and up she goes, turning
        tl.add(() => u.hatch(true), 1.45);
        tl.add(() => pop(300), 1.9);
        tl.to(beam, { value: 1, duration: 0.3, ease: 'power2.out' }, 1.9);
        tl.to(reach, { y: d.c.y - 0.2, duration: 0.45, ease: 'power2.out' }, 1.9);
        tl.to(d.c, { tilt: 0.1 * dir, duration: 0.5, ease: 'sine.out' }, 2.3);
        say(i, 'Heeeelp!', 2.6);
        tl.to(d.c, { fly: held, duration: 2.1, ease: 'power1.in' }, 2.4);
        tl.to(d.c, { spin: `+=${Math.PI * 4}`, duration: 2.1, ease: 'power1.in' }, 2.4);
        // in through the hatch
        tl.to(d.c, { size: 0.02, duration: 0.3, ease: 'power2.in' }, 4.35);
        tl.add(() => { pop(1250); clearBubbles(); d.root.visible = false; }, 4.65);
        tl.to(beam, { value: 0, duration: 0.25, ease: 'power2.in' }, 4.7);
        tl.add(() => u.hatch(false), 4.8);
        tl.to(reach, { y: hover.y, duration: 0.3, ease: 'power2.in' }, 4.7);
        say(0 === i ? 1 : 0, `They took ${NAMES[i]}!`, 5);
        // gone in a blink
        tl.to(pos, { x: hover.x + dir * 16, y: hover.y + 3, duration: 0.8, ease: 'power3.in' }, 5.6);
        tl.add(() => u.play('Leave', 0.8), 5.6);
        say(friend, 'Can I have her scoop?', 7.2);
        // and back, to drop her off
        tl.add(() => { pos.set(hover.x + dir * 15, hover.y + 2.5, 0.2); u.group.rotation.z = -dir * 0.28; u.play('Arrive', 1.3); }, 9.4);
        tl.to(pos, { x: hover.x, duration: 1.3, ease: 'power3.out' }, 9.4);
        tl.to(pos, { y: hover.y, duration: 1.3, ease: 'sine.out' }, 9.4);
        tl.to(u.group.rotation, { z: 0, duration: 1.4, ease: 'elastic.out(1, 0.5)' }, 9.7);
        tl.add(() => u.hatch(true), 10.35);
        tl.to(beam, { value: 1, duration: 0.3, ease: 'power2.out' }, 10.8);
        tl.to(reach, { y: d.c.y - 0.2, duration: 0.4, ease: 'power2.out' }, 10.8);
        tl.add(() => { d.root.visible = true; pop(700); }, 11.2);
        tl.to(d.c, { size: 1, duration: 0.3, ease: 'back.out(2)' }, 11.2);
        tl.to(d.c, { spin: `+=${Math.PI * 2}`, duration: 1.5, ease: 'power1.out' }, 11.2);
        tl.to(d.c, { fly: 0, duration: 1.5, ease: 'sine.inOut' }, 11.3);
        tl.to(d.c, { tilt: 0, duration: 0.6, ease: 'sine.inOut' }, 12.2);
        tl.add(() => u.wave(), 11.8);
        tl.to(beam, { value: 0, duration: 0.25, ease: 'power2.in' }, 12.8);
        tl.add(() => u.hatch(false), 12.9);
        tl.to(reach, { y: hover.y, duration: 0.3, ease: 'power2.in' }, 12.8);
        tl.to(pos, { x: hover.x - dir * 16, y: hover.y + 3, duration: 0.8, ease: 'power3.in' }, 13.2);
        tl.add(() => u.play('Leave', 0.8), 13.2);
        say(i, 'They just wanted ube.', 13.3);
        tl.to({}, { duration: 2.4 }, 13.3);
      }
      if (setName) Object.assign(window, { __abduct: abduct, __ufo: ufo });

      // ---- grab a doll: she comes with you, and when you let go she flies and rocks back upright
      // on her round base. Shake her about and the whole family feels it
      const SHAKEN = ['Put me DOWN!', 'Who is doing this?!', 'Stop shaking me!', 'Weeeeee!'];
      const worldPerPx = () => (2 * (camera.position.z / 0.9949) * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))) / innerHeight;
      function makeGrabbable(i: number) {
        const d = dolls[i], f = flight[i], c = d.c;
        let sx = 0, sy = 0, lx = 0, ly = 0, lt = 0, ox = 0, oy = 0, side = 0, flips = 0;
        d.hit.addEventListener('pointerdown', (e) => {
          f.dragged = false;
          if (reduce || f.gone) return;
          Object.assign(f, { press: true });
          sx = lx = e.clientX;
          sy = ly = e.clientY;
          lt = e.timeStamp;
          ox = c.dx;
          oy = c.fly;
          side = flips = 0;
          d.hit.setPointerCapture(e.pointerId);
        });
        d.hit.addEventListener('pointermove', (e) => {
          if (!f.press) return;
          if (!f.held) {
            if (Math.hypot(e.clientX - sx, e.clientY - sy) < 8) return;
            clearTimeout(f.wait);
            solos[i]?.kill();
            Object.assign(f, { held: true, dragged: true, air: true, vy: 0, vx: 0, streak: 0 });
            chat?.pause();
            if (busy) d.bubble.classList.remove('is-on');
            else clearBubbles();
            gsap.killTweensOf(c, 'tilt,squash,fly,hop');
            gsap.killTweensOf(d.lid);
            Object.assign(d.lid, { y: 0, rx: 0 });
            c.squash = 1;
            c.hop = 0;
          }
          const w = worldPerPx(), dt = Math.max(e.timeStamp - lt, 4) / 1000;
          const vx = ((e.clientX - lx) * w) / dt, vy = ((ly - e.clientY) * w) / dt;
          f.vx += (vx - f.vx) * 0.45;
          f.vy += (vy - f.vy) * 0.45;
          lx = e.clientX;
          ly = e.clientY;
          lt = e.timeStamp;
          c.dx = THREE.MathUtils.clamp((e.clientX - sx) * w + ox, -7, 7);
          c.fly = Math.max(0, (sy - e.clientY) * w + oy);
          c.tilt = THREE.MathUtils.clamp(-f.vx * 0.035, -0.55, 0.55);
          d.el.classList.toggle('is-flying', d.el.getBoundingClientRect().top < 104);
          // every fast change of direction counts as a shake
          if (Math.abs(vx) > 5 && Math.sign(vx) !== side) {
            side = Math.sign(vx);
            if (++flips === 5 && !f.shaken) {
              f.shaken = true;
              tapLine(i, SHAKEN[i]);
              pop(300);
              const friend = (i + 1) % N;
              if (!flight[friend].gone) say2(friend, 'Leave her alone!');
              dolls.forEach((o, k) => { if (k !== i) flight[k].wobV += (k % 2 ? 4.2 : -4.2); });
            }
          }
        });
        const drop = () => {
          f.press = false;
          if (!f.held) return;
          f.held = false;
          f.flung = true;
          f.vx = THREE.MathUtils.clamp(f.vx, -10, 10);
          f.vy = THREE.MathUtils.clamp(f.vy, -7, 9);
          f.wobV += f.vx * 0.55;
        };
        d.hit.addEventListener('pointerup', drop);
        d.hit.addEventListener('pointercancel', drop);
      }

      function flapPhysics(dt: number) {
        flight.forEach((f, i) => {
          const c = dolls[i].c;
          if (!f.held) {
            f.vx += (-24 * c.dx - 5 * f.vx) * dt; // she drifts home to her place
            c.dx += f.vx * dt;
          }
          const lean = performance.now() < f.downUntil ? f.wobTo : 0; // flat out for a moment if knocked
          f.wobV += (-34 * (c.wob - lean) - 2.4 * f.wobV) * dt; // rocking on her round base, dying away
          c.wob += f.wobV * dt;
        });
        if (ufo) {
          const now = performance.now() / 1000;
          ufo.update(now);
          bird?.update(now);
          farUfo?.update(now);
          cow?.update(now);
          plane?.update(now);
          ube?.update(dt);
          if (scoops?.active) scoops.update(dt, readHeads());
          // an event's choreography is left alone until someone free moves among it
          if (introDone && (!busy || flight.some((f, i) => !f.gone && (f.air || Math.abs(dolls[i].c.dx) > 0.02)))) collide(now);
          // only when nobody is mid-air
          if (now > eventNext && chat && !busy && flight.every((o) => !o.air)) {
            const kind = EVENTS[eventAt++ % EVENTS.length];
            if (kind === 'ufo') abduct(1 + Math.floor(Math.random() * (N - 1)));
            else if (kind === 'bird') birdLands(Math.floor(Math.random() * N));
            else if (kind === 'sneeze') sneeze(Math.floor(Math.random() * N));
            else if (kind === 'stack') stackUp();
            else if (moments[kind]) moments[kind]();
            else eventNext = now + 30; // a kind nobody wrote: skip it rather than throw mid-frame
          }
        }
        flight.forEach((f, i) => {
          if (!f.air || f.gone || f.held) return;
          const d = dolls[i];
          f.vy -= f.g * dt;
          d.c.fly += f.vy * dt;
          // she leans into the climb and tips over the other way as she falls
          d.c.tilt = THREE.MathUtils.clamp(f.vy * 0.04 * f.lean, -0.34, 0.34);
          // near the top there is no room above her: the bubble goes under her feet
          d.el.classList.toggle('is-flying', d.el.getBoundingClientRect().top < 104);
          const exit = exitHeight(d);
          if (!f.bye && f.vy > 0 && d.c.fly > exit - 1.1 * d.scale) {
            f.bye = true;
            tapLine(i, 'Byeee!');
          }
          if (d.c.fly >= exit) {
            f.gone = true;
            f.vy = 0;
            d.c.fly = exit;
            d.c.tilt = 0;
            pop(1100);
            f.wait = window.setTimeout(() => {
              if (!flight[FLIGHT[i].gone[0]].gone) tapLine(FLIGHT[i].gone[0], FLIGHT[i].gone[1]);
              f.wait = window.setTimeout(() => { f.gone = false; }, 2000);
            }, 500);
            return;
          }
          if (f.streak >= 3 && !f.yelled && f.vy < -2.6 && d.c.fly > 0.8) {
            f.yelled = true;
            tapLine(i, FLIGHT[i].fall);
          }
          if (d.c.fly <= 0) {
            d.c.fly = 0;
            if (f.vy > -1.5 && !f.held) return landed(i);
            // she hits the cloud, squashes and bounces, less each time
            f.vy *= -0.36;
            f.wobV += 1.8 * f.lean;
            pop(220);
            gsap.timeline({ overwrite: 'auto' })
              .to(d.c, { squash: 0.76, duration: 0.07, ease: 'power2.out' })
              .to(d.c, { squash: 1, duration: 0.6, ease: 'elastic.out(1.1, 0.4)' });
          }
        });
      }

      function startTalking() {
        chat = gsap.timeline({ repeat: -1, repeatDelay: 0.6 });
        if (setName) Object.assign(window, { __chat: chat });
        for (const beat of SCRIPT) {
          if (beat.laugh) laughBeat(chat);
          else {
            sayBeat(chat, beat.who!, beat.say!, beat.act);
            if (beat.dream) dreamBeat(chat, beat.who!, beat.dream);
          }
        }
        // tapping a doll: it giggles and says its own line, then the chat picks up again
        dolls.forEach((d, i) => {
          if (setName === 'dither') makeGrabbable(i);
          d.hit.addEventListener('click', () => {
            if (flight[i].dragged) { flight[i].dragged = false; return; } // that was a drag, not a tap
            if (flight[i].gone) return poke(i);
            chat?.pause();
            dolls.forEach((o, k) => { if (!flight[k].gone) gsap.to(o.c, { hop: 0, duration: 0.2, ease: 'power2.out' }); }); // a tap cancels any hop in progress
            // quick taps keep sending her up: see tapFly
            if (!reduce && tapFly(i)) return;
            if (busy) return; // the stage is the event's: she hops, but keeps her line to herself
            const kick = rayKick[i];
            gsap.timeline({ overwrite: true })
              .to(kick, { pop: 1, duration: 0.12, ease: 'power2.out' })
              .to(kick, { pop: 0, duration: 0.9, ease: 'elastic.out(1, 0.3)' });
            gsap.to(kick, { turn: `+=${(i % 2 ? -1 : 1) * 1.2}`, duration: 1.1, ease: 'power3.out' });
            clearBubbles();
            const solo = gsap.timeline({ onComplete: resumeChat });
            solos[i] = solo;
            solo.to(d.c, { squash: 0.85, duration: 0.08 }).to(d.c, { squash: 1, duration: 0.6, ease: 'elastic.out(1, 0.35)' });
            sayBeat(solo, i, d.line, i === 3 ? 'hop' : i === 2 ? 'spin' : i === 1 ? 'tip' : undefined);
          });
        });
      }
    },
    undefined,
    (e) => { console.error('nest: the dolls could not be set up', e); fail(); },
  );
}

function introText(reduce: boolean) {
  if (reduce) return;
  if (pageSet() !== 'dither') initTitle();
  // the frame arrives after the title: the corner buttons and the dock rise into place
  gsap.from('.topbar .round', { y: -14, opacity: 0, duration: 0.7, stagger: 0.07, ease: 'power3.out', delay: 0.5 });
  gsap.from('.dock', { y: 18, opacity: 0, duration: 0.8, ease: 'power3.out', delay: 0.8 });
}

/** The entry gate, shown once the loader lifts. Resolves once the visitor enters, with or without sound. */
function gate(reduce: boolean, lifted: Promise<void>): Promise<void> {
  const el = document.querySelector<HTMLElement>('[data-gate]');
  const toggle = document.querySelector<HTMLButtonElement>('[data-sound]');
  const label = document.querySelector<HTMLElement>('[data-sound-label]');
  if (toggle) {
    toggle.hidden = false;
    toggle.addEventListener('click', () => setSound(!soundOn()));
    onSound((on) => {
      toggle.setAttribute('aria-pressed', String(on));
      if (label) label.textContent = on ? 'Turn sound off' : 'Turn sound on';
      toggle.dataset.tip = on ? 'Mute' : 'Play sound';
    });
  }
  // the cloud page has no entry screen: it opens straight on, silent, with the sound button there
  if (!el || pageSet() === 'dither') return lifted;
  return lifted.then(() => openGate(el, reduce));
}

function openGate(el: HTMLElement, reduce: boolean): Promise<void> {
  el.hidden = false;
  document.documentElement.style.overflow = 'hidden';
  if (!reduce) {
    gsap.from(el.querySelectorAll('.gate-mark .ch'), { yPercent: 60, opacity: 0, duration: 0.7, stagger: 0.04, ease: 'power3.out' });
    gsap.from(el.querySelectorAll('.gate-line, .gate-note, .enter, .quiet'), { y: 12, opacity: 0, duration: 0.6, stagger: 0.07, ease: 'power3.out', delay: 0.35 });
  }
  el.querySelector<HTMLButtonElement>('[data-enter="sound"]')?.focus({ preventScroll: true });
  return new Promise((done) => {
    el.querySelectorAll<HTMLButtonElement>('[data-enter]').forEach((b) =>
      b.addEventListener('click', () => {
        const withSound = b.dataset.enter === 'sound';
        if (withSound) {
          setSound(true);
          bell(880);
        }
        const finish = () => {
          el.hidden = true;
          document.documentElement.style.overflow = '';
          document.getElementById('main')?.focus?.();
          done();
        };
        if (reduce) return finish();
        // the gate lifts like a lid
        gsap.to(el, { yPercent: -100, duration: 0.9, ease: 'power4.inOut', onComplete: finish });
        setTimeout(() => {
          introText(false);
        }, 450);
        done();
      }, { once: true }),
    );
  });
}
