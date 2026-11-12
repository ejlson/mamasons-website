// A drifting field of toon sweets: scoops on cones, ice lollies, Bilog buns and sprinkles,
// in the brand pastels with navy outlines like the dolls. Far sweets sink into the page colour
// through fog, so the field reads as depth instead of clutter behind the type.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

const NAVY = 0x0f1e37;
const PASTELS = ['#FAD7E1', '#BEDCB6', '#CDE9F3', '#BA93C4', '#F6E3A6', '#FFFCF4'];
const WAFFLE = '#E5B36E';
const TOAST = '#D9964A';

export function toonRamp() {
  const data = new Uint8Array([196, 196, 206, 255, 232, 230, 238, 255, 255, 255, 255, 255]);
  const t = new THREE.DataTexture(data, 3, 1, THREE.RGBAFormat);
  t.minFilter = t.magFilter = THREE.NearestFilter;
  t.needsUpdate = true;
  return t;
}

// a seeded random, so the composition is the same on every visit
function rng(seed: number) {
  return () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
}

type Item = {
  obj: THREE.Object3D;
  home: THREE.Vector3;
  phase: number;
  bob: number;
  spin: THREE.Vector3;
  depth: number; // 0 near .. 1 far, for parallax
};

export type Sweets = {
  group: THREE.Group;
  layout(camera: THREE.PerspectiveCamera, focus: THREE.Vector3, keepOut?: THREE.Box2[]): void;
  update(t: number, px: number, py: number): void;
  setGround(css: string): void;
};

export function createSweets(scene: THREE.Scene, opts: { count?: number; seed?: number } = {}): Sweets {
  const ramp = toonRamp();
  const group = new THREE.Group();
  scene.add(group);
  const fog = new THREE.Fog(new THREE.Color('#FFFCF4'), 6, 26);
  scene.fog = fog;

  const ink = new THREE.MeshBasicMaterial({ color: NAVY, side: THREE.BackSide });
  const toon = (c: string) => new THREE.MeshToonMaterial({ color: new THREE.Color(c), gradientMap: ramp });

  // shared geometry
  const g = {
    scoop: new THREE.SphereGeometry(0.5, 28, 18),
    cone: new THREE.ConeGeometry(0.36, 1.0, 24, 1, true),
    lolly: new RoundedBoxGeometry(0.62, 0.95, 0.24, 4, 0.12),
    stick: new RoundedBoxGeometry(0.12, 0.5, 0.06, 2, 0.03),
    bun: new THREE.SphereGeometry(0.6, 32, 16),
    band: new THREE.CylinderGeometry(0.58, 0.58, 0.14, 32, 1, true),
    sprinkle: new THREE.CapsuleGeometry(0.05, 0.22, 4, 8),
  };

  function outlined(geo: THREE.BufferGeometry, mat: THREE.Material, w = 1.07) {
    const o = new THREE.Group();
    o.add(new THREE.Mesh(geo, mat));
    const hull = new THREE.Mesh(geo, ink);
    hull.scale.setScalar(w);
    o.add(hull);
    return o;
  }

  const makers = [
    (c: string) => {
      // a scoop on a waffle cone
      const o = new THREE.Group();
      const s = outlined(g.scoop, toon(c));
      s.scale.set(1, 0.92, 1);
      s.position.y = 0.32;
      const k = outlined(g.cone, toon(WAFFLE), 1.06);
      k.rotation.x = Math.PI;
      k.position.y = -0.35;
      o.add(k, s);
      return o;
    },
    (c: string) => {
      // an ice lolly
      const o = new THREE.Group();
      const body = outlined(g.lolly, toon(c));
      body.position.y = 0.2;
      const st = outlined(g.stick, toon('#F3DDB0'), 1.12);
      st.position.y = -0.48;
      o.add(st, body);
      return o;
    },
    (c: string) => {
      // a Bilog: a toasted bun sealed round a scoop
      const o = new THREE.Group();
      const top = outlined(g.bun, toon(TOAST));
      top.scale.set(0.8, 0.34, 0.8);
      top.position.y = 0.09;
      const bot = outlined(g.bun, toon(TOAST));
      bot.scale.set(0.8, 0.24, 0.8);
      bot.position.y = -0.09;
      const fill = new THREE.Mesh(g.band, toon(c));
      fill.scale.set(0.8, 1, 0.8);
      o.add(bot, fill, top);
      return o;
    },
    (c: string) => outlined(g.sprinkle, toon(c), 1.25),
  ];

  const rand = rng(opts.seed ?? 7);
  const count = opts.count ?? 26;
  const items: Item[] = [];
  for (let i = 0; i < count; i++) {
    // mostly sprinkles, a handful of big sweets
    const kind = i < 9 ? i % 3 : 3;
    const obj = makers[kind](PASTELS[Math.floor(rand() * PASTELS.length)]);
    const scale = kind === 3 ? 1.6 + rand() * 0.8 : 0.55 + rand() * 0.45;
    obj.scale.setScalar(scale);
    obj.rotation.set(rand() * 6, rand() * 6, rand() * 6);
    group.add(obj);
    items.push({
      obj,
      home: new THREE.Vector3(),
      phase: rand() * Math.PI * 2,
      bob: 0.08 + rand() * 0.14,
      spin: new THREE.Vector3((rand() - 0.5) * 0.25, (rand() - 0.5) * 0.35, (rand() - 0.5) * 0.2),
      depth: rand(),
    });
  }

  // place every sweet inside the camera's view, behind the focus plane, avoiding a
  // screen-space box (the type) so nothing sits under the headline
  function layout(camera: THREE.PerspectiveCamera, focus: THREE.Vector3, keepOut: THREE.Box2[] = []) {
    const r = rng((opts.seed ?? 7) + 11);
    const tanV = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const camZ = camera.position.z;
    // fog starts just behind the focus plane, so only the sweets fade, never the dolls
    fog.near = camZ - focus.z + 1;
    fog.far = fog.near + 13;
    for (const it of items) {
      const z = focus.z - 1.5 - it.depth * 9; // behind the dolls
      const dist = camZ - z;
      const hh = dist * tanV, hw = hh * camera.aspect;
      let x = 0, y = 0;
      for (let tries = 0; tries < 24; tries++) {
        const sx = r() * 2 - 1, sy = r() * 2 - 1;
        x = camera.position.x + sx * hw * 1.05;
        y = camera.position.y + sy * hh * 1.05;
        const p = new THREE.Vector2(sx, sy);
        if (!keepOut.some((b) => b.containsPoint(p))) break;
      }
      it.home.set(x, y, z);
      it.obj.position.copy(it.home);
    }
  }

  const tmp = new THREE.Vector3();
  function update(t: number, px: number, py: number) {
    for (const it of items) {
      const near = 1 - it.depth;
      tmp.copy(it.home);
      tmp.y += Math.sin(t * 0.7 + it.phase) * it.bob;
      tmp.x += px * (0.15 + near * 0.55);
      tmp.y += py * (0.1 + near * 0.4);
      it.obj.position.lerp(tmp, 0.08);
      it.obj.rotation.x += it.spin.x * 0.01;
      it.obj.rotation.y += it.spin.y * 0.01;
      it.obj.rotation.z += it.spin.z * 0.01;
    }
  }

  function setGround(css: string) {
    fog.color.set(css);
  }

  return { group, layout, update, setGround };
}
