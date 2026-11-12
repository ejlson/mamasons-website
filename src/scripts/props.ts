// The cast of visitors. Each has a hand-built toy version in the dolls' style; a model at
// public/models/<name>.glb (cow, ufo, seagull), listed in READY, takes over from the toy.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { toonRamp } from './sweets';

const NAVY = 0x182848;
let ramp: THREE.Texture | undefined;
export const toon = (color: number) => {
  const m = new THREE.MeshToonMaterial({ color, gradientMap: (ramp ??= toonRamp()) });
  m.toneMapped = false;
  return m;
};
export const flat = (color: number) => new THREE.MeshBasicMaterial({ color, toneMapped: false });

/** A mesh with the navy outline every toy on the page shares. */
export function inked(geo: THREE.BufferGeometry, color: number | THREE.Material, parent: THREE.Object3D, grow = 0.07) {
  const mesh = new THREE.Mesh(geo, typeof color === 'number' ? toon(color) : color);
  const edge = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: NAVY, side: THREE.BackSide, toneMapped: false }));
  edge.scale.setScalar(1 + grow);
  mesh.add(edge);
  parent.add(mesh);
  return mesh;
}

// the models actually in public/models/: add a name here when its file goes in
const READY = ['cow', 'ufo', 'seagull', 'ube-cloud'];

/**
 * Loads public/models/<name>.glb, scaled to `size` across and centred; size 0 keeps the model's own
 * units and origin. Every clip in the file is on holder.userData.clips; `clip` also starts one playing.
 */
export async function loadModel(name: string, size: number, clip?: string, tone = 1) {
  if (!READY.includes(name)) return null;
  const gltf = await new GLTFLoader().loadAsync(`/models/${name}.glb`).catch(() => null);
  if (!gltf) return null;
  const model = gltf.scene;
  if (size > 0) {
    const box = new THREE.Box3().setFromObject(model);
    const dim = box.getSize(new THREE.Vector3());
    const k = size / Math.max(dim.x, dim.y, dim.z);
    model.scale.setScalar(k);
    model.position.copy(box.getCenter(new THREE.Vector3())).multiplyScalar(-k);
  }
  model.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    // bones carry it well outside the box it was bound in
    if ((mesh as THREE.SkinnedMesh).isSkinnedMesh) mesh.frustumCulled = false;
    // repainted in the page's flat toon light, which the models' metal and gloss would go black in
    const paint = (m: THREE.Material) => {
      const src = m as THREE.MeshStandardMaterial;
      if (src.name === 'Outline') return new THREE.MeshBasicMaterial({ color: NAVY, toneMapped: false });
      const out = new THREE.MeshToonMaterial({ map: src.map, color: src.color.clone().multiplyScalar(tone), gradientMap: (ramp ??= toonRamp()), transparent: src.transparent, opacity: src.opacity, side: src.side });
      out.toneMapped = false;
      return out;
    };
    if (tone > 0) mesh.material = Array.isArray(mesh.material) ? mesh.material.map(paint) : paint(mesh.material);
    else (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach((m) => (m.toneMapped = false)); // tone 0: keep its own metal
  });
  const holder = new THREE.Group();
  holder.add(model);
  holder.userData.clips = gltf.animations;
  if (clip) {
    const action = gltf.animations.find((a) => a.name === clip);
    if (action) {
      const mixer = new THREE.AnimationMixer(model);
      mixer.clipAction(action).play();
      holder.userData.mixer = mixer;
    }
  }
  return holder;
}

const sphere = (r: number) => new THREE.SphereGeometry(r, 18, 12);

/** The same navy edge for a rigged model: its own skin again, pushed out along the normals and turned inside out. */
function inkSkin(model: THREE.Object3D, grow: number) {
  const skins: THREE.SkinnedMesh[] = [];
  model.traverse((o) => { if ((o as THREE.SkinnedMesh).isSkinnedMesh) skins.push(o as THREE.SkinnedMesh); });
  for (const skin of skins) {
    const size = (skin.geometry.boundingBox ?? (skin.geometry.computeBoundingBox(), skin.geometry.boundingBox!)).getSize(new THREE.Vector3());
    const push = (Math.max(size.x, size.y, size.z) * grow).toFixed(4);
    const ink = new THREE.MeshBasicMaterial({ color: NAVY, side: THREE.BackSide, toneMapped: false });
    ink.onBeforeCompile = (s) => {
      s.vertexShader = s.vertexShader.replace('#include <begin_vertex>', `vec3 transformed = position + normalize(normal) * ${push};`);
    };
    const edge = new THREE.SkinnedMesh(skin.geometry, ink);
    edge.bind(skin.skeleton, skin.bindMatrix);
    edge.frustumCulled = false;
    skin.parent!.add(edge);
  }
}

export function createCow(scene: THREE.Scene) {
  const group = new THREE.Group();
  const toy = new THREE.Group();
  group.add(toy);
  const body = inked(sphere(0.5), 0xfffaf3, toy);
  body.scale.set(1.5, 0.92, 0.92);
  [[-0.3, 0.2, 0.34, 0.2], [0.35, 0.08, 0.38, 0.17], [0.05, 0.32, -0.28, 0.2], [-0.42, -0.08, -0.36, 0.15]].forEach(([x, y, z, r]) => {
    const spot = new THREE.Mesh(sphere(r), toon(NAVY));
    spot.position.set(x, y, z);
    spot.scale.z = 0.4;
    toy.add(spot);
  });
  const head = inked(sphere(0.29), 0xfffaf3, toy);
  head.position.set(0.82, 0.3, 0);
  const nose = inked(sphere(0.16), 0xf49ab8, head);
  nose.scale.set(0.8, 0.72, 1.15);
  nose.position.set(0.24, -0.09, 0);
  for (const z of [-1, 1]) {
    const eye = new THREE.Mesh(sphere(0.05), flat(NAVY));
    eye.position.set(0.17, 0.08, z * 0.2);
    head.add(eye);
    const horn = inked(new THREE.ConeGeometry(0.05, 0.22, 10), 0xf6e3a6, head);
    horn.position.set(-0.03, 0.31, z * 0.15);
    const ear = inked(sphere(0.09), 0xf49ab8, head);
    ear.scale.set(0.5, 0.5, 1.5);
    ear.position.set(-0.08, 0.12, z * 0.32);
  }
  const legs = [[-0.42, -0.25], [-0.42, 0.25], [0.42, -0.25], [0.42, 0.25]].map(([x, z]) => {
    const pivot = new THREE.Group();
    pivot.position.set(x, -0.3, z);
    const leg = inked(new THREE.CylinderGeometry(0.075, 0.065, 0.42, 10), 0xfffaf3, pivot);
    leg.position.y = -0.2;
    toy.add(pivot);
    return pivot;
  });
  const tail = inked(new THREE.CylinderGeometry(0.018, 0.018, 0.42, 6), NAVY, toy, 0);
  tail.position.set(-0.8, 0.05, 0);
  tail.rotation.z = -0.45;
  group.visible = false;
  scene.add(group);
  let mixer: THREE.AnimationMixer | undefined;
  const clips: Record<string, THREE.AnimationAction> = {};
  let current: THREE.AnimationAction | undefined, mooing = false, last = 0;
  void loadModel('cow', 2).then((m) => {
    if (!m) return;
    toy.clear();
    toy.add(m);
    inkSkin(m, 0.016);
    mixer = new THREE.AnimationMixer(m);
    for (const clip of m.userData.clips as THREE.AnimationClip[]) clips[clip.name] = mixer.clipAction(clip);
    clips.Moo.setLoop(THREE.LoopOnce, 1);
    if (group.visible) play('Graze', 0);
  });
  function play(name: string, fade = 0.25) {
    const next = clips[name];
    if (!next || next === current) return;
    next.reset().fadeIn(fade).play();
    current?.fadeOut(fade);
    current = next;
  }
  return {
    group,
    play,
    /** Moo has no legs or tail in it, so it goes over whatever those are doing; the weight wins the head. */
    moo() {
      if (!clips.Moo) return;
      clips.Moo.reset().setEffectiveWeight(12).fadeIn(0.12).play();
      mooing = true;
    },
    update(t: number) {
      const dt = Math.min(t - last, 0.05);
      last = t;
      if (!group.visible) return;
      if (mixer) {
        if (mooing && clips.Moo.time > 1.35) { clips.Moo.fadeOut(0.25); mooing = false; }
        mixer.update(dt);
        return;
      }
      // she runs on the spot in mid air, the way anyone would
      legs.forEach((l, i) => { l.rotation.z = Math.sin(t * 14 + i * 2) * 0.7; });
      tail.rotation.x = Math.sin(t * 9) * 0.5;
    },
  };
}

export function createPlane(scene: THREE.Scene) {
  const group = new THREE.Group();
  const body = new THREE.Group();
  group.add(body);
  const toy = new THREE.Group();
  body.add(toy);
  // a low-poly tourer in the wordmark's colours: cream body, pink nose, ube wings, mint tail,
  // navy windows and wheels, and the dolls' navy outline round the hull
  const WHITE = 0xfffaf3, MAGENTA = 0xf49ab8, PLUM = NAVY, LILAC = 0xba93c4, MINT = 0xbedcb6, BUTTER = 0xf6e3a6;
  const paint = (color: number) => {
    const m = toon(color);
    m.side = THREE.DoubleSide;
    return m;
  };
  const faceted = (geo: THREE.BufferGeometry, color: number, parent: THREE.Object3D = toy) => {
    const flatGeo = geo.index ? geo.toNonIndexed() : geo;
    flatGeo.computeVertexNormals();
    const mesh = new THREE.Mesh(flatGeo, paint(color));
    parent.add(mesh);
    return mesh;
  };
  // a hull lofted through six-sided rings: [x, bottom, top, half width]
  const loft = (rings: number[][], color: number) => {
    const pts: number[] = [], idx: number[] = [];
    rings.forEach(([x, lo, hi, w]) => {
      const mid = (lo + hi) / 2;
      [[0.62, hi], [1, mid], [0.72, lo], [-0.72, lo], [-1, mid], [-0.62, hi]].forEach(([k, y]) => pts.push(x, y, k * w));
    });
    for (let r = 0; r + 1 < rings.length; r++) for (let i = 0; i < 6; i++) {
      const j = (i + 1) % 6, a = r * 6 + i, b = r * 6 + j, c = a + 6, d = b + 6;
      idx.push(a, c, b, b, c, d);
    }
    // caps, so nothing is hollow
    for (const r of [0, rings.length - 1]) for (let i = 1; i < 5; i++) idx.push(r * 6, r * 6 + i, r * 6 + i + 1);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    g.setIndex(idx);
    const hull = faceted(g, color);
    const edge = new THREE.Mesh(hull.geometry, new THREE.MeshBasicMaterial({ color: NAVY, side: THREE.BackSide, toneMapped: false }));
    edge.scale.setScalar(1.045);
    hull.add(edge);
    return hull;
  };
  const panel = (outline: number[][], color: number, parent: THREE.Object3D = toy) => {
    const shape = new THREE.Shape(outline.map(([x, y]) => new THREE.Vector2(x, y)));
    return faceted(new THREE.ExtrudeGeometry(shape, { depth: 0.025, bevelEnabled: false }), color, parent);
  };
  loft([[1.5, -0.02, 0.05, 0.05], [1.32, -0.2, 0.2, 0.25], [0.96, -0.3, 0.27, 0.34]], MAGENTA);
  loft([[0.96, -0.3, 0.27, 0.34], [0.42, -0.34, 0.32, 0.37], [-0.65, -0.28, 0.34, 0.34], [-1.55, -0.02, 0.26, 0.15], [-2.02, 0.12, 0.24, 0.05]], WHITE);
  // the cabin roof, with lilac on top of the cowl as in the reference
  loft([[0.72, 0.28, 0.33, 0.3], [0.42, 0.3, 0.72, 0.28], [-0.5, 0.3, 0.74, 0.27], [-1.1, 0.26, 0.4, 0.2]], WHITE);
  const cowl = panel([[0.96, 0], [0.5, 0], [0.5, 0.56], [0.96, 0.5]], LILAC);
  cowl.rotation.x = Math.PI / 2;
  cowl.position.set(0, 0.34, -0.28);
  for (const z of [-1, 1]) {
    const side = new THREE.Group();
    side.position.z = z * 0.305;
    toy.add(side);
    panel([[0.56, 0.36], [0.42, 0.66], [0.2, 0.66], [0.24, 0.36]], PLUM, side);
    panel([[0.16, 0.36], [0.13, 0.66], [-0.08, 0.66], [-0.1, 0.36]], PLUM, side);
    panel([[-0.17, 0.36], [-0.15, 0.68], [-0.72, 0.56], [-0.82, 0.36]], PLUM, side);
    // the swept wing, low on the body
    const wing = new THREE.Group();
    wing.position.set(0.1, -0.2, z * 0.3);
    wing.rotation.x = z * 0.09 + Math.PI / 2;
    wing.scale.y = z;
    toy.add(wing);
    panel([[0.34, 0], [-0.5, 0], [-0.62, 1.72], [-0.12, 1.72]], LILAC, wing);
    panel([[-0.12, 1.72], [-0.62, 1.72], [-0.68, 2.02], [-0.3, 2.02]], BUTTER, wing);
    const tail = new THREE.Group();
    tail.position.set(-1.72, 0.2, z * 0.04);
    tail.rotation.x = Math.PI / 2;
    tail.scale.y = z;
    toy.add(tail);
    panel([[0.16, 0], [-0.22, 0], [-0.46, 0.68], [-0.28, 0.68]], MINT, tail);
    // a main wheel on a thin leg
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.44, 6), flat(WHITE));
    leg.position.set(-0.04, -0.46, z * 0.5);
    leg.rotation.x = z * 0.22;
    toy.add(leg);
    const tyre = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.08, 10), paint(PLUM));
    tyre.rotation.x = Math.PI / 2;
    tyre.position.set(-0.04, -0.7, z * 0.55);
    toy.add(tyre);
  }
  panel([[-1.28, 0.3], [-1.86, 0.26], [-2.3, 1.02], [-1.98, 1.02]], MINT).position.z = -0.012;
  // a band of the title's colours down the side
  for (const z of [-1, 1]) {
    [0xfad7e1, 0xcde9f3, 0xba93c4, 0xf6e3a6].forEach((c, i) => {
      const band = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.1, 0.02), paint(c));
      band.position.set(-0.62 - i * 0.3, 0.02 + i * 0.03, z * (0.325 - i * 0.05));
      band.rotation.y = -z * 0.09;
      toy.add(band);
    });
  }
  const noseLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.42, 6), flat(WHITE));
  noseLeg.position.set(0.86, -0.48, 0);
  toy.add(noseLeg);
  const noseTyre = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.07, 10), paint(PLUM));
  noseTyre.rotation.x = Math.PI / 2;
  noseTyre.position.set(0.86, -0.7, 0);
  toy.add(noseTyre);
  toy.rotation.set(0.24, -0.4, 0); // turned three-quarters, so the wing and windows read
  const prop = new THREE.Group();
  prop.position.set(1.52, 0.02, 0);
  for (const a of [0, Math.PI]) {
    const blade = new THREE.Mesh(new THREE.ConeGeometry(0.065, 0.8, 4), paint(NAVY));
    blade.scale.z = 0.3;
    blade.position.y = 0.4;
    const arm = new THREE.Group();
    arm.rotation.x = a;
    arm.add(blade);
    prop.add(arm);
  }
  toy.add(prop);

  // the banner, in the title's own print
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 150;
  const g = canvas.getContext('2d')!;
  // the name, in the wordmark's own lettering
  const paintBanner = () => {
    g.fillStyle = '#fffaf3';
    g.fillRect(0, 0, 1024, 150);
    g.strokeStyle = '#182848';
    g.lineWidth = 12;
    g.strokeRect(6, 6, 1012, 138);
    g.font = '900 104px "Mamasons Display", sans-serif';
    g.textBaseline = 'middle';
    g.lineJoin = 'round';
    const word = 'MAMASONS', tints = ['#FAD7E1', '#BEDCB6', '#CDE9F3', '#BA93C4', '#F6E3A6', '#FAD7E1', '#BEDCB6', '#CDE9F3'];
    const total = [...word].reduce((w, c) => w + g.measureText(c).width + 6, 0);
    let x = 512 - total / 2;
    [...word].forEach((c, i) => {
      g.lineWidth = 10;
      g.strokeText(c, x, 80);
      g.fillStyle = tints[i];
      g.fillText(c, x, 80);
      x += g.measureText(c).width + 6;
    });
  };
  paintBanner();
  void document.fonts.load('900 104px "Mamasons Display"', 'MAMASONS').then(() => { paintBanner(); tex.needsUpdate = true; });
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const geo = new THREE.PlaneGeometry(4.6, 0.68, 30, 1);
  const rest = (geo.attributes.position as THREE.BufferAttribute).array.slice();
  const banner = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide, toneMapped: false }));
  group.add(banner);
  const rope = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.02, 0.02), flat(NAVY));
  group.add(rope);
  group.visible = false;
  group.scale.setScalar(0.34);
  scene.add(group);
  let dir = 1;
  return {
    group,
    face(d: number) {
      dir = d;
      body.scale.x = d;
      banner.position.x = -d * 4.1;
      rope.position.x = -d * 1.45;
    },
    update(t: number) {
      if (!group.visible) return;
      prop.rotation.x = t * 40;
      const a = geo.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < a.count; i++) {
        const x = rest[i * 3], far = (x * dir + 2.3) / 4.6; // 0 at the plane end
        const u = 1 - far;
        a.setY(i, rest[i * 3 + 1] + Math.sin(x * 2.4 * dir + t * 7) * 0.13 * u);
        a.setZ(i, Math.cos(x * 1.8 + t * 6) * 0.1 * u);
      }
      a.needsUpdate = true;
    },
  };
}

/** Somewhere a scoop can land: the dome of a doll's head, in world units. */
/** a doll's head this frame; `id` is the doll, so a scoop keeps hers even when the list shifts */
export type Head = { id: number; x: number; y: number; z: number; r: number };

/**
 * A shower of gloopy cones. Each scoop falls as a soft teardrop with its cone tumbling under it,
 * lands with a jelly splat on a doll's head (the cone left sticking up like a party hat) or the
 * clouds, sits there wobbling, then slides off and drips, or melts into a puddle.
 * The shape is a spring (squash and stretch, volume kept) plus a vertex shader that pulls a tail
 * up behind the fall, wobbles the surface, and spreads the bottom as it melts.
 */
export function createScoops(scene: THREE.Scene, count = 46) {
  const R = 0.17;
  const geo = new THREE.SphereGeometry(R, 18, 14);
  // per scoop: x tail, y wobble, z phase, w melt
  const goo = new THREE.InstancedBufferAttribute(new Float32Array(count * 4), 4);
  goo.setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('aGoo', goo);
  const time = { value: 0 };
  const gloop = (push: number) => (s: THREE.WebGLProgramParametersWithUniforms) => {
    s.uniforms.uTime = time;
    s.vertexShader = s.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec4 aGoo;\nuniform float uTime;')
      .replace('#include <begin_vertex>', `
        vec3 p = position / ${R.toFixed(3)};
        // a tail drawn up behind it as it falls
        float k = smoothstep(-0.2, 1.0, p.y);
        p.xz *= 1.0 - aGoo.x * 0.78 * k * k;
        p.y += aGoo.x * 1.7 * k * k * k;
        // lumpy jelly
        p += normal * aGoo.y * (0.6 * sin(uTime * 13.0 + aGoo.z + p.y * 5.0) + 0.4 * sin(uTime * 8.0 + aGoo.z * 1.7 + p.x * 6.0 + p.z * 4.0));
        // melting: the bottom spreads into a puddle and the top sinks into it
        float low = smoothstep(0.4, -1.0, p.y);
        p.xz *= 1.0 + aGoo.w * 1.1 * low;
        p.y = mix(p.y, -1.0 + (p.y + 1.0) * 0.3, aGoo.w);
        vec3 transformed = p * ${R.toFixed(3)} + normal * ${push.toFixed(3)};`);
  };
  const body = toon(0xffffff);
  body.onBeforeCompile = gloop(0);
  const mesh = new THREE.InstancedMesh(geo, body, count);
  const COLS = [0xba93c4, 0xfad7e1, 0xbedcb6, 0xf6e3a6, 0xcde9f3].map((c) => new THREE.Color(c));
  for (let i = 0; i < count; i++) mesh.setColorAt(i, COLS[i % 5]);
  // the navy edge every toy on the page has, riding the same instances and the same gloop
  const ink = new THREE.MeshBasicMaterial({ color: NAVY, side: THREE.BackSide, toneMapped: false });
  ink.onBeforeCompile = gloop(0.022);
  const edge = new THREE.InstancedMesh(geo, ink, count);
  edge.instanceMatrix = mesh.instanceMatrix;
  // the cones: waffle, with the crisscross drawn in, apex down from the base at their origin
  const CONE_H = R * 2.5;
  const coneGeo = new THREE.ConeGeometry(R * 0.8, CONE_H, 14, 1);
  coneGeo.rotateX(Math.PI);
  coneGeo.translate(0, -CONE_H / 2, 0);
  const waffle = toon(0xe5b36e);
  waffle.onBeforeCompile = (s) => {
    s.vertexShader = s.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vWaffle;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWaffle = uv;');
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vWaffle;')
      .replace('#include <color_fragment>', `#include <color_fragment>
        vec2 w = vWaffle * vec2(9.0, 4.0);
        float g = min(abs(fract(w.x + w.y) - 0.5), abs(fract(w.x - w.y) - 0.5));
        diffuseColor.rgb = mix(vec3(0.85, 0.59, 0.29), diffuseColor.rgb, smoothstep(0.05, 0.11, g));`);
  };
  const cones = new THREE.InstancedMesh(coneGeo, waffle, count);
  const coneInk = new THREE.MeshBasicMaterial({ color: NAVY, side: THREE.BackSide, toneMapped: false });
  coneInk.onBeforeCompile = (s) => {
    s.vertexShader = s.vertexShader.replace('#include <begin_vertex>', 'vec3 transformed = position + normal * 0.02;');
  };
  const coneEdge = new THREE.InstancedMesh(coneGeo, coneInk, count);
  coneEdge.instanceMatrix = cones.instanceMatrix;
  // the trail a scoop leaves as it slides off a head: flattened dabs of its own colour, pressed
  // onto the dome and carried along with the doll as she bobs, fading after a while
  const TRAIL = 180;
  const dabGeo = new THREE.SphereGeometry(R, 12, 8);
  const dabs = new THREE.InstancedMesh(dabGeo, toon(0xffffff), TRAIL);
  for (let i = 0; i < TRAIL; i++) dabs.setColorAt(i, COLS[0]);
  const dabInk = new THREE.MeshBasicMaterial({ color: NAVY, side: THREE.BackSide, toneMapped: false });
  dabInk.onBeforeCompile = (s) => {
    s.vertexShader = s.vertexShader.replace('#include <begin_vertex>', 'vec3 transformed = position + normal * 0.012;');
  };
  const dabEdge = new THREE.InstancedMesh(dabGeo, dabInk, TRAIL);
  dabEdge.instanceMatrix = dabs.instanceMatrix;
  const trail = Array.from({ length: TRAIL }, () => ({ head: -1, n: new THREE.Vector3(), size: 0, age: 0, life: 0 }));
  let nextDab = 0;
  const all = [mesh, edge, cones, coneEdge, dabs, dabEdge];
  for (const m of all) {
    m.frustumCulled = false;
    m.visible = false;
    scene.add(m);
  }

  const FALL = 0, STUCK = 1, MELT = 2, GONE = 3;
  // head: the id of the head it sits on; sat: how long it has been there; slid: it has come off a
  // head already, and no head catches it again, so it falls clear and melts
  const p = Array.from({ length: count }, () => ({
    state: GONE, x: 0, y: 0, z: 0, vx: 0, vy: 0, size: 1,
    s: 1, sv: 0, tail: 0, wob: 0, ph: Math.random() * 6.3, melt: 0, t: 0,
    head: -1, sat: 0, slid: false, dir: 0, ang: 0, angV: 0, laid: 0, n: new THREE.Vector3(0, 1, 0),
    // which way the cone points, and the axis it tumbles about while it falls
    cd: new THREE.Vector3(0, -1, 0), axis: new THREE.Vector3(1, 0, 0), spin: 0,
    tip: new THREE.Vector3(0, 1, 0), // where a melting cone ends up pointing: never quite straight up
  }));
  let on = false, top = 0, cx = 0, wide = 0, floor = 0.2;
  // the first scoops of a shower are aimed, so somebody always gets one on the head
  let aim = false;
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0);
  const at = new THREE.Vector3(), sc = new THREE.Vector3(), down = new THREE.Vector3(0, -1, 0);
  const spawn = (o: (typeof p)[number], high: number) => {
    const a = Math.random() * Math.PI * 2;
    o.axis.set(Math.cos(a), 0, Math.sin(a));
    o.cd.set(0, -1, 0).applyAxisAngle(o.axis, (Math.random() - 0.5) * 2.4);
    o.spin = (Math.random() < 0.5 ? -1 : 1) * (1 + Math.random() * 2.5);
    return Object.assign(o, {
    state: FALL, x: cx + (Math.random() - 0.5) * wide, y: top + Math.random() * high, z: -1.2 + Math.random() * 2.8,
    vx: (Math.random() - 0.5) * 0.2, vy: -(1.2 + Math.random() * 1.6), size: 0.8 + Math.random() * 0.7,
    s: 1, sv: 0, tail: 0.2, wob: 0.04, melt: 0, head: -1, sat: 0, slid: false, t: 0,
    });
  };
  const splat = (o: (typeof p)[number], speed: number) => {
    o.sv = -speed * 2.2; // the landing squashes it, and the spring does the rest
    o.wob = 0.24;
    o.tail = 0;
    o.vx = o.vy = 0;
  };
  // it lets go of the head: out past the rim and down, stretching as it drops, never to land again
  const letGo = (o: (typeof p)[number]) => {
    o.state = FALL;
    o.slid = true;
    o.vx = o.n.x * 0.6;
    o.vy = -0.4;
    o.sv = 3;
  };
  // a scoop may sit for this long at most: the slide always finishes well inside it, so this only
  // ever catches a head that stops behaving (knocked flat, dragged about, bobbing under it)
  const SIT_MAX = 1.5;

  return {
    get active() { return mesh.visible; },
    /** how many scoops are falling, on a head, melting: for probes */
    get counts() { return [FALL, STUCK, MELT].map((st) => p.filter((o) => o.state === st).length); },
    /** every scoop's state, for probes that trace a shower */
    get ps() { return p; },
    start(x: number, y: number, w: number) {
      on = true;
      cx = x; top = y; wide = w;
      for (const o of p) spawn(o, 7);
      aim = true;
      for (const m of all) m.visible = true;
    },
    stop() { on = false; },
    /** heads: where each doll's head is this frame, for scoops to land on */
    update(dt: number, heads: Head[] = []) {
      if (!mesh.visible || !(dt > 0)) return; // a 0 or NaN step would leave every scoop where it is
      dt = Math.min(dt, 1 / 30);
      time.value += dt;
      const headOf = (id: number) => heads.find((h) => h.id === id);
      if (aim && heads.length) {
        aim = false;
        // one straight away on a doll's head, a second on another a moment later
        const first = Math.floor(Math.random() * heads.length);
        [first, (first + 1 + Math.floor(Math.random() * (heads.length - 1))) % heads.length].forEach((h, k) => {
          const d = heads[h], o = p[k];
          Object.assign(o, { x: d.x + (Math.random() - 0.5) * d.r * 0.5, z: d.z + d.r * 0.25, vx: 0, y: top + k * 1.6, vy: -2.6, size: 1.25 });
        });
      }
      let alive = 0;
      p.forEach((o, i) => {
        let target = 1; // the shape the spring is pulling towards: >1 tall, <1 flat
        if (o.state === FALL) {
          // gravity against a thick drag: it reaches a lazy terminal speed and hangs in a teardrop
          o.vy += (-9 - 2.6 * o.vy) * dt;
          o.x += o.vx * dt;
          o.y += o.vy * dt;
          o.tail += (Math.min(0.3, -o.vy * 0.09) - o.tail) * Math.min(1, dt * 6);
          o.cd.applyAxisAngle(o.axis, o.spin * dt);
          o.wob += (0.04 - o.wob) * dt * 2;
          o.n.copy(up);
          const bottom = o.y - R * o.size;
          // only a fresh drop can land, and only while it still rains: one that has slid off a head,
          // or is still coming down as the shower ends, falls past the others to the clouds
          for (const d of o.slid || !on ? [] : heads) {
            const dx = o.x - d.x, dz = o.z - d.z, rr = d.r + R * o.size * 0.6;
            const flat = dx * dx + dz * dz;
            if (flat > rr * rr) continue;
            const surface = d.y + Math.sqrt(rr * rr - flat);
            // it has to meet the dome this frame: what it fell, plus a little for a head bobbing up
            if (bottom <= surface && bottom > surface - (0.2 - o.vy * dt)) {
              o.state = STUCK;
              o.head = d.id;
              o.sat = 0;
              o.dir = Math.atan2(dz, dx);
              o.ang = Math.asin(Math.min(1, Math.sqrt(flat) / rr));
              o.angV = 0;
              o.laid = o.ang;
              o.t = 0.15 + Math.random() * 0.3; // a beat to splat, then it goes
              splat(o, -o.vy);
              break;
            }
          }
          if (o.state === FALL && bottom <= floor) {
            o.state = MELT;
            o.y = floor + R * o.size * 0.4;
            o.tip.copy(up).applyAxisAngle(o.axis, (Math.random() < 0.5 ? -1 : 1) * (0.35 + Math.random() * 0.6));
            o.t = 0;
            splat(o, -o.vy);
          }
        } else if (o.state === STUCK) {
          const d = headOf(o.head);
          o.sat += dt;
          // the doll has gone (flown off, taken), or it has sat too long: it drops from where it is
          if (!d || o.sat > SIT_MAX) letGo(o);
          else {
            // it sits, then its own weight drags it round the dome, faster as it goes
            o.t -= dt;
            if (o.t < 0) o.angV += (2.6 + o.ang * 3) * dt;
            o.ang += o.angV * dt;
            const rr = d.r + R * o.size * 0.12; // pressed into the paint a little, so it never floats
            o.n.set(Math.cos(o.dir) * Math.sin(o.ang), Math.cos(o.ang), Math.sin(o.dir) * Math.sin(o.ang));
            o.x = d.x + o.n.x * rr;
            o.y = d.y + o.n.y * rr;
            o.z = d.z + o.n.z * rr;
            // once it is moving it paints its way down: a dab every little way, thinning out
            if (o.angV > 0.05 && o.ang - o.laid > 0.04) {
              o.laid = o.ang;
              const dab = trail[nextDab];
              nextDab = (nextDab + 1) % TRAIL;
              Object.assign(dab, { head: o.head, size: o.size * (0.34 - 0.14 * Math.min(1, o.ang / 1.45)), age: 0, life: 1.6 + Math.random() * 0.5 });
              dab.n.copy(o.n);
              dabs.setColorAt((nextDab + TRAIL - 1) % TRAIL, COLS[i % 5]);
              if (dabs.instanceColor) dabs.instanceColor.needsUpdate = true;
            }
            target = 0.6;
            // stringy as it lets go
            o.tail += (Math.min(0.35, o.angV * 0.3) - o.tail) * Math.min(1, dt * 5);
            o.wob += (0.06 - o.wob) * dt * 1.5;
            if (o.ang > 1.45) letGo(o); // over the rim
          }
        } else if (o.state === MELT) {
          o.t += dt;
          o.n.copy(up);
          target = 0.45;
          o.melt = Math.min(1, o.t / 1.4);
          o.wob += (0.02 - o.wob) * dt * 1.5;
          o.tail = 0;
          if (o.t > 1.8) {
            if (on) spawn(o, 2);
            else o.state = GONE;
          }
        }
        // the gloop spring: soft and underdamped, so every landing jiggles
        o.sv += (160 * (target - o.s) - 7 * o.sv) * dt;
        o.s = Math.max(0.25, o.s + o.sv * dt);
        if (o.state !== GONE) alive++;
        // the last of a puddle shrinks away
        const fade = o.state === GONE ? 0 : o.state === MELT ? Math.min(1, (1.8 - o.t) / 0.4) : 1;
        const k = o.size * fade, xz = 1 / Math.sqrt(o.s);
        q.setFromUnitVectors(up, o.n);
        m.compose(at.set(o.x, o.y, o.z), q, sc.set(k * xz, k * o.s, k * xz));
        mesh.setMatrixAt(i, m);
        goo.setXYZW(i, o.tail, o.wob, o.ph, o.melt);
        // once it has landed the cone swings round to stand out of the splat, and rocks with the jelly
        if (o.state !== FALL) {
          o.cd.lerp(o.state === MELT ? o.tip : o.n, Math.min(1, dt * 9)).normalize();
          if (o.state === STUCK || o.melt < 0.6) o.cd.addScaledVector(o.axis, o.sv * 0.004).normalize();
        }
        // the cone's mouth sits in the scoop and its point follows cd; landed, the splat is thinner,
        // so the mouth sinks with it
        const sit = o.state === FALL ? 0.45 : 0.15 + 0.3 * o.s * (1 - 0.6 * o.melt);
        q.setFromUnitVectors(down, o.cd);
        m.compose(sc.set(o.x, o.y, o.z).addScaledVector(o.cd, R * k * sit), q, at.set(k, k, k));
        cones.setMatrixAt(i, m);
      });
      let trails = 0;
      trail.forEach((dab, k) => {
        const d = dab.head >= 0 ? headOf(dab.head) : undefined;
        let size = 0;
        if (dab.head >= 0) {
          // it dries whether or not its doll is still here, so a trail never outlives the shower
          dab.age += dt;
          // it stays wet a while, then dries back to nothing
          if (d) size = dab.size * (1 - Math.min(1, Math.max(0, (dab.age - dab.life + 0.8) / 0.8)));
          if (dab.age > dab.life) dab.head = -1;
          else trails++;
        }
        q.setFromUnitVectors(up, dab.n);
        const rr = (d?.r ?? 0) + R * 0.05;
        at.set((d?.x ?? 0) + dab.n.x * rr, (d?.y ?? 0) + dab.n.y * rr, (d?.z ?? 0) + dab.n.z * rr);
        m.compose(at, q, sc.set(size, size * 0.28, size));
        dabs.setMatrixAt(k, m);
      });
      mesh.instanceMatrix.needsUpdate = true;
      cones.instanceMatrix.needsUpdate = true;
      dabs.instanceMatrix.needsUpdate = true;
      goo.needsUpdate = true;
      if (!on && !alive && !trails) for (const m of all) m.visible = false;
    },
  };
}
