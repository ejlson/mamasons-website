// A round, cross seagull: pear body, big yellow beak with the red spot, one suspicious eye, grey
// wings with black tips, orange feet. public/models/seagull.glb takes over if it is there.
import * as THREE from 'three';
import { flat, inked, loadModel, toon } from './props';

const NAVY = 0x182848;
// every other clip plays once: Land, Peck, Squawk, TakeOff, HeadTilt, Ruffle
const LOOPS = ['Fly', 'Glide', 'Perch'];

export function createBird(scene: THREE.Scene) {
  const group = new THREE.Group();
  const toy = new THREE.Group();
  group.add(toy);
  // the body is one turned pear, lying forwards a little
  const pear = [[0, -0.27], [0.14, -0.26], [0.25, -0.17], [0.28, -0.04], [0.23, 0.11], [0.15, 0.25], [0.15, 0.36], [0.17, 0.46], [0.13, 0.55], [0, 0.58]]
    .map(([x, y]) => new THREE.Vector2(x, y));
  const curve = new THREE.SplineCurve(pear).getPoints(30);
  const body = inked(new THREE.LatheGeometry(curve, 28), 0xfffaf3, toy, 0.06);
  body.position.set(0, 0.28, -0.03);
  body.rotation.x = 0.26;

  const head = new THREE.Group();
  head.position.set(0, 0.68, 0.14);
  toy.add(head);
  const mesh = new THREE.Group();
  head.add(mesh);
  const beak = inked(new THREE.ConeGeometry(0.075, 0.29, 14), 0xf6c94a, mesh, 0.1);
  beak.rotation.x = Math.PI / 2 + 0.16;
  beak.position.set(0, 0, 0.26);
  const spot = new THREE.Mesh(new THREE.SphereGeometry(0.02, 8, 6), flat(0xe0483e));
  spot.position.set(0, -0.045, 0.31);
  mesh.add(spot);
  for (const x of [-1, 1]) {
    const white = inked(new THREE.SphereGeometry(0.058, 14, 10), 0xffffff, mesh, 0.12);
    white.position.set(x * 0.115, 0.065, 0.1);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.028, 10, 8), flat(NAVY));
    pupil.position.set(x * 0.13, 0.065, 0.15);
    mesh.add(pupil);
    // a heavy brow is the whole of its personality
    const brow = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.018, 0.02), flat(NAVY));
    brow.position.set(x * 0.11, 0.125, 0.135);
    brow.rotation.z = -x * 0.42;
    mesh.add(brow);
  }
  for (const x of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.12, 6), flat(0xf0902e));
    leg.position.set(x * 0.09, 0.05, 0.02);
    toy.add(leg);
    const foot = inked(new THREE.ConeGeometry(0.075, 0.13, 3), 0xf0902e, toy, 0.1);
    foot.rotation.x = Math.PI / 2;
    foot.scale.y = 1;
    foot.position.set(x * 0.09, 0.01, 0.08);
  }
  const tail = inked(new THREE.ConeGeometry(0.1, 0.3, 8), 0xaebbd2, toy, 0.08);
  tail.rotation.x = -Math.PI / 2 - 0.34;
  tail.position.set(0, 0.24, -0.34);

  const shape = new THREE.Shape();
  shape.moveTo(0, -0.15);
  shape.bezierCurveTo(0.3, -0.21, 0.56, -0.13, 0.76, 0.03);
  shape.bezierCurveTo(0.5, 0.1, 0.25, 0.16, 0, 0.15);
  shape.closePath();
  const wingGeo = new THREE.ShapeGeometry(shape, 12);
  wingGeo.rotateX(-Math.PI / 2);
  const tipShape = new THREE.Shape();
  tipShape.moveTo(0.54, -0.13);
  tipShape.lineTo(0.77, 0.03);
  tipShape.lineTo(0.5, 0.09);
  tipShape.closePath();
  const tipGeo = new THREE.ShapeGeometry(tipShape);
  tipGeo.rotateX(-Math.PI / 2);
  const wings = [1, -1].map((dir) => {
    const hinge = new THREE.Group();
    hinge.position.set(dir * 0.2, 0.42, -0.02);
    hinge.scale.x = dir;
    const w = inked(wingGeo, toon(0xc4cede), hinge, 0);
    (w.material as THREE.Material).side = THREE.DoubleSide;
    const tip = new THREE.Mesh(tipGeo, toon(NAVY));
    (tip.material as THREE.Material).side = THREE.DoubleSide;
    tip.position.y = 0.002;
    hinge.add(tip);
    toy.add(hinge);
    return { hinge, dir };
  });
  group.visible = false;
  group.scale.setScalar(0.72);
  scene.add(group);
  // the rigged model: seagull_toy.py in media-src/mamasons-doll. Its feet are on its origin
  let mixer: THREE.AnimationMixer | undefined;
  let last = 0;
  let playing: THREE.AnimationAction | undefined;
  const clips = new Map<string, THREE.AnimationAction>();
  void loadModel('seagull', 0).then((m) => {
    if (!m) return;
    toy.clear();
    toy.add(m);
    const mix = new THREE.AnimationMixer(m);
    for (const clip of m.userData.clips as THREE.AnimationClip[]) {
      const action = mix.clipAction(clip);
      if (!LOOPS.includes(clip.name)) {
        action.setLoop(THREE.LoopOnce, 1);
        action.clampWhenFinished = true;
      }
      clips.set(clip.name, action);
    }
    // a one-off hands back to whatever comes naturally after it
    mix.addEventListener('finished', (e) => {
      if (e.action === playing) play(e.action.getClip().name === 'TakeOff' ? 'Fly' : 'Perch', 0.2);
    });
    mixer = mix;
  });

  /** Crossfades to a clip: a fade of 0 cuts to it. */
  function play(name: string, fade = 0.2) {
    const next = clips.get(name);
    if (!next) return;
    if (next !== playing) {
      if (fade > 0) playing?.fadeOut(fade);
      else playing?.stop();
    }
    next.reset().setEffectiveWeight(1);
    if (fade > 0 && next !== playing) next.fadeIn(fade);
    next.play();
    playing = next;
  }

  const state = { flap: 1, peck: 0, perched: null as THREE.Object3D | null, at: 2 };
  return {
    group,
    state,
    play,
    update(t: number) {
      if (!group.visible) { last = t; return; }
      if (state.perched) {
        group.position.copy(state.perched.position);
        // on her head, whatever her head is doing: she squashes under it
        group.position.y += state.at * state.perched.scale.y - 0.04;
      }
      if (mixer) {
        mixer.update(Math.min(t - last, 0.1));
        last = t;
        return;
      }
      const beat = Math.sin(t * 19) * 0.85 * state.flap;
      const folded = 1 - state.flap;
      for (const w of wings) {
        w.hinge.rotation.z = beat - folded * 1.28;
        w.hinge.rotation.y = -folded * 0.42;
      }
      head.rotation.x = state.peck * 1.05;
      head.rotation.y = state.flap > 0.5 ? 0 : Math.sin(t * 2.3) * 0.7;
    },
  };
}
