// A chunky toy flying saucer, in the dolls' own language: toon shaded with a navy outline, in the
// brand pastels, with a tiny alien under a glass dome and a beam printed through the clouds' dot screen.
import * as THREE from 'three';
import { toonRamp } from './sweets';
import { loadModel } from './props';

const NAVY = 0x182848;

export function createUfo(scene: THREE.Scene, cell: number) {
  const ramp = toonRamp();
  const toon = (color: number) => {
    const m = new THREE.MeshToonMaterial({ color, gradientMap: ramp });
    m.toneMapped = false;
    return m;
  };
  const group = new THREE.Group();
  // tipped towards us so the dome reads from below; the hull turns inside that, and the outer
  // group stays free to bank
  const body = new THREE.Group();
  body.rotation.x = 0.3;
  group.add(body);
  const spin = new THREE.Group();
  body.add(spin);
  const outlined = (geo: THREE.BufferGeometry, mat: THREE.Material, parent: THREE.Object3D = spin, grow = 0.045) => {
    const mesh = new THREE.Mesh(geo, mat);
    const edge = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: NAVY, side: THREE.BackSide, toneMapped: false }));
    edge.scale.setScalar(1 + grow);
    mesh.add(edge);
    parent.add(mesh);
    return mesh;
  };
  const turned = (points: number[][], color: number) => {
    const m = toon(color);
    m.side = THREE.DoubleSide;
    const mesh = new THREE.Mesh(new THREE.LatheGeometry(points.map(([x, y]) => new THREE.Vector2(x, y)), 56), m);
    spin.add(mesh);
    return mesh;
  };
  // a fat toy saucer: cream deck, ube belly, a pink bumper round the waist, a mint racing stripe
  turned([[0, 0.34], [0.62, 0.33], [1.02, 0.22], [1.4, 0.03]], 0xf4ecd9);
  turned([[1.4, 0.0], [1.08, -0.22], [0.62, -0.34], [0, -0.34]], 0xba93c4);
  const bumper = outlined(new THREE.TorusGeometry(1.4, 0.1, 14, 72), toon(0xf49ab8), spin, 0.03);
  bumper.rotation.x = Math.PI / 2;
  const stripe = new THREE.Mesh(new THREE.TorusGeometry(0.96, 0.045, 10, 64), toon(0xbedcb6));
  stripe.rotation.x = Math.PI / 2;
  stripe.position.y = 0.245;
  spin.add(stripe);
  // the glowing hatch underneath
  const hatch = outlined(new THREE.CylinderGeometry(0.4, 0.46, 0.1, 40), new THREE.MeshBasicMaterial({ color: 0xfff0b8, toneMapped: false }), spin, 0.05);
  hatch.position.y = -0.37;

  // the cockpit: a small alien at the controls under a glass dome (these do not spin)
  const pilot = new THREE.Group();
  pilot.position.y = 0.34;
  body.add(pilot);
  // a head like a light bulb: a wide dome tapering to a tiny chin, all eyes
  const skull = [[0, -0.24], [0.05, -0.23], [0.11, -0.15], [0.18, -0.03], [0.235, 0.09], [0.225, 0.2], [0.14, 0.28], [0, 0.3]].map(([x, y]) => new THREE.Vector2(x, y));
  const head = outlined(new THREE.LatheGeometry(new THREE.SplineCurve(skull).getPoints(24), 28), toon(0xa6e04a), pilot, 0.05);
  head.position.set(0, 0.3, 0);
  const shoulders = outlined(new THREE.SphereGeometry(0.09, 14, 10), toon(0xa6e04a), pilot, 0.1);
  shoulders.scale.set(1.15, 0.9, 0.9);
  shoulders.position.y = 0.03;
  const eye = (x: number) => {
    // big, black and tilted, with one hard highlight
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.1, 18, 12), new THREE.MeshBasicMaterial({ color: 0x10162c, toneMapped: false }));
    e.scale.set(0.8, 1.32, 0.42);
    e.position.set(x, 0.34, 0.185);
    e.rotation.z = x > 0 ? 0.62 : -0.62;
    e.rotation.y = x * 2.2;
    pilot.add(e);
    const glint = new THREE.Mesh(new THREE.SphereGeometry(0.023, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }));
    glint.position.set(x - 0.02, 0.39, 0.235);
    pilot.add(glint);
  };
  eye(-0.1);
  eye(0.1);
  // glass: nearly clear in the middle, milky towards the edge, with a navy line at the silhouette
  const glass = new THREE.Mesh(
    new THREE.SphereGeometry(0.64, 40, 20, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      vertexShader: `varying vec3 vN, vV; void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `varying vec3 vN, vV;
        void main(){
          float f = dot(normalize(vN), normalize(vV));
          vec3 c = mix(vec3(0.094, 0.157, 0.282), vec3(0.85, 0.95, 1.0), smoothstep(0.1, 0.16, f));
          gl_FragColor = vec4(c, mix(1.0, mix(0.62, 0.14, smoothstep(0.15, 0.8, f)), smoothstep(0.1, 0.16, f)));
          #include <colorspace_fragment>
        }`,
    }),
  );
  glass.renderOrder = 3;
  pilot.add(glass);
  const seat = outlined(new THREE.TorusGeometry(0.64, 0.04, 10, 56), toon(0xf49ab8), pilot, 0.05);
  seat.rotation.x = Math.PI / 2;
  const shine = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 8), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, toneMapped: false }));
  shine.scale.set(0.5, 1.1, 0.12);
  shine.position.set(-0.32, 0.42, 0.42);
  shine.rotation.z = 0.7;
  shine.renderOrder = 4;
  pilot.add(shine);
  // an aerial with a bobble on top
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.024, 0.34, 8), new THREE.MeshBasicMaterial({ color: NAVY, toneMapped: false }));
  mast.position.y = 0.8;
  pilot.add(mast);
  const bobble = outlined(new THREE.SphereGeometry(0.075, 16, 12), new THREE.MeshBasicMaterial({ color: 0xf6e3a6, toneMapped: false }), pilot, 0.14);
  bobble.position.y = 1;

  // big bulbs on the bumper, chasing round
  const COLS = [0xfad7e1, 0xf6e3a6, 0xcde9f3, 0xbedcb6];
  const lights = Array.from({ length: 12 }, (_, i) => {
    const a = (i / 12) * Math.PI * 2;
    const m = new THREE.MeshBasicMaterial({ color: COLS[i % 4], toneMapped: false });
    const bulb = outlined(new THREE.SphereGeometry(0.11, 14, 10), m, spin, 0.1);
    bulb.position.set(Math.cos(a) * 1.4, 0.07, Math.sin(a) * 1.4);
    return { m, base: new THREE.Color(COLS[i % 4]) };
  });

  // a little wave out of the window, one hand
  const arm = outlined(new THREE.CapsuleGeometry(0.028, 0.18, 4, 8), toon(0xa6e04a), pilot, 0.12);
  arm.position.set(0.17, 0.14, 0.06);

  const beamUni = {
    on: { value: 0 },
    cell: { value: cell },
    time: { value: 0 },
    cream: { value: new THREE.Color('#fff4c2') },
  };
  const beamGeo = new THREE.CylinderGeometry(0.34, 1.05, 1, 40, 1, true);
  beamGeo.translate(0, -0.5, 0);
  const beam = new THREE.Mesh(beamGeo, new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.BackSide, // the far wall of the cone only, so she stays clear inside it
    uniforms: beamUni,
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform float on, cell, time; uniform vec3 cream; varying vec2 vUv;
      void main(){
        vec2 g = mat2(0.7071, -0.7071, 0.7071, 0.7071) * gl_FragCoord.xy / cell;
        float d = 0.5 + 0.25 * (cos(g.x * 6.2832) + cos(g.y * 6.2832));
        // brightest under the ship, fading downwards, with rings of light travelling up it
        float rings = 0.82 + 0.18 * sin(vUv.y * 26.0 - time * 7.0);
        float t = (0.3 + 0.62 * vUv.y) * rings * on;
        gl_FragColor = vec4(cream, smoothstep(d - 0.2, d + 0.2, t) * on * 0.9);
        #include <colorspace_fragment>
      }`,
  }));
  beam.scale.y = 0.001;
  beam.position.y = -0.3;
  beam.renderOrder = 6; // over the sky and the name, under the bank in front
  group.add(beam);
  group.visible = false;
  group.scale.setScalar(0.8);
  scene.add(group);
  let mixer: THREE.AnimationMixer | undefined;
  let mouth: THREE.Object3D | undefined;
  const shots: Record<string, THREE.AnimationAction> = {};
  let idle: THREE.AnimationAction | undefined;
  let shot: THREE.AnimationAction | undefined;
  void loadModel('ufo', 3.22).then((m) => {
    if (!m) return;
    spin.clear();
    body.remove(pilot);
    // sat by its hull, not by its bounding box, which the aerial drags upwards
    m.updateMatrixWorld(true);
    m.position.sub(m.getObjectByName('Body')!.getWorldPosition(new THREE.Vector3()));
    body.add(m);
    mouth = m.getObjectByName('HatchPoint');
    // the same navy edge as the toys, pushed out along the normal because these parts share a skin
    const ink = new THREE.MeshBasicMaterial({ color: NAVY, side: THREE.BackSide, toneMapped: false });
    ink.onBeforeCompile = (s) => {
      s.vertexShader = s.vertexShader.replace('#include <begin_vertex>', 'vec3 transformed = position + normal * 0.024;');
    };
    for (const name of ['Toon', 'Flat']) {
      const mesh = m.getObjectByName(name) as THREE.SkinnedMesh;
      if (name === 'Flat') mesh.material = new THREE.MeshBasicMaterial({ map: (mesh.material as THREE.MeshToonMaterial).map, toneMapped: false });
      const edge = mesh.clone();
      edge.material = ink;
      mesh.parent!.add(edge);
    }
    const dome = m.getObjectByName('Glass') as THREE.Mesh;
    dome.material = glass.material;
    dome.renderOrder = 3;
    const clips: THREE.AnimationClip[] = m.userData.clips ?? [];
    const hover = clips.find((c) => c.name === 'Hover');
    if (!hover) return;
    const mix = (mixer = new THREE.AnimationMixer(m));
    // the chase never stops, so it comes out of Hover and the rest can step aside for a one-shot
    const lit = /^(Rim|Lit\d)\./;
    mix.clipAction(new THREE.AnimationClip('Chase', hover.duration, hover.tracks.filter((t) => lit.test(t.name)))).play();
    idle = mix.clipAction(new THREE.AnimationClip('Idle', hover.duration, hover.tracks.filter((t) => !lit.test(t.name)))).play();
    for (const c of clips) {
      if (c === hover) continue;
      shots[c.name] = mix.clipAction(c).setLoop(THREE.LoopOnce, 1);
      shots[c.name].clampWhenFinished = c.name !== 'Wave';
    }
    mix.addEventListener('finished', (e) => {
      if (e.action !== shot) return;
      idle!.setEffectiveWeight(1).fadeIn(0.35);
      shot!.fadeOut(0.35);
      shot = undefined;
    });
  });
  let last = 0;

  return {
    group,
    beam: beamUni.on,
    /** Stretch the beam down to world height y. */
    reach(y: number) {
      beam.scale.y = Math.max(0.001, (group.position.y + beam.position.y * group.scale.y - y) / group.scale.y);
    },
    /** Arrive or Leave, fitted to the page's own move: the idle drops out and comes back after. */
    play(name: 'Arrive' | 'Leave', secs: number) {
      const a = shots[name];
      if (!a) return;
      shot?.stop();
      idle!.stopFading().setEffectiveWeight(0);
      shot = a.reset().setEffectiveTimeScale(a.getClip().duration / secs).play();
    },
    /** Folds the hatch open, or runs the same clip backwards to shut it. */
    hatch(open: boolean) {
      const a = shots.Beam;
      if (!a) return;
      a.paused = false;
      a.setEffectiveTimeScale(open ? 1 : -1).play();
    },
    wave() {
      shots.Wave?.reset().play();
    },
    update(t: number) {
      if (!group.visible) return;
      beamUni.time.value = t;
      mixer?.update(Math.min(t - last, 0.05));
      last = t;
      // the printed beam comes out of the hatch wherever the hover has carried it
      if (mouth) group.worldToLocal(mouth.getWorldPosition(beam.position));
      spin.rotation.y = t * 1.3;
      pilot.rotation.y = Math.sin(t * 1.7) * 0.5; // the pilot looks around
      arm.rotation.z = -0.7 + Math.sin(t * 9) * 0.5;
      pilot.position.y = 0.34 + Math.sin(t * 5) * 0.008;
      bobble.position.x = Math.sin(t * 6) * 0.03;
      const k = Math.floor(t * 9) % 4;
      lights.forEach((l, i) => l.m.color.copy(l.base).multiplyScalar(i % 4 === k ? 1.12 : 0.66));
    },
  };
}
