// The ube valley: a dusk landscape in one colour family, after emotion-agency.com's hero.
// A gradient sky with a low sun, soft clouds, faceted low-poly rocks along the far shore,
// a reflecting lake, a flat stone the dolls stand on, swaying grass in the foreground and
// drifting specks of light. Everything is procedural: no textures to download.
import * as THREE from 'three';
import { Reflector } from 'three/examples/jsm/objects/Reflector.js';

export const UBE = {
  skyTop: new THREE.Color('#8E6CC4'),
  skyMid: new THREE.Color('#B79BDD'),
  horizon: new THREE.Color('#EBCFE8'),
  sun: new THREE.Color('#FFE6EE'),
  rock: new THREE.Color('#7B5FA6'),
  farBank: new THREE.Color('#6A4F94'),
  stone: new THREE.Color('#9A83C0'),
  grassBase: new THREE.Color('#4A2F78'),
  grassTip: new THREE.Color('#B48FE0'),
  water: new THREE.Color('#A58BD3'),
};
const WATER_Y = -0.12;
const SUN_DIR = new THREE.Vector3(-0.35, 0.16, -1).normalize(); // low, behind the dolls

function rng(seed: number) {
  return () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
}

export type World = {
  layout(camera: THREE.PerspectiveCamera, platform: { x: number; width: number }): void;
  update(t: number, px: number, py: number): void;
};

export function createWorld(scene: THREE.Scene, renderer: THREE.WebGLRenderer, opts: { mobile: boolean }): World {
  const rand = rng(9);
  scene.fog = new THREE.Fog(UBE.horizon.clone().lerp(UBE.skyMid, 0.35), 30, 130);

  // ---- light: sky above, ube bounce below, a warm low sun behind, a soft front fill
  scene.add(new THREE.HemisphereLight(0xf4e6ff, 0x5b3f86, 1.15));
  const sun = new THREE.DirectionalLight(0xffd9e6, 2.2);
  sun.position.copy(SUN_DIR).multiplyScalar(-20).setY(9); // the key comes from in front-left…
  sun.position.set(-6, 9, 10);
  scene.add(sun);
  const back = new THREE.DirectionalLight(0xffc6dc, 1.6); // …and the sun itself rims them from behind
  back.position.set(4, 5, -12);
  scene.add(back);

  // ---- sky dome
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(400, 32, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: {
        top: { value: UBE.skyTop }, mid: { value: UBE.skyMid }, hor: { value: UBE.horizon },
        sunCol: { value: UBE.sun }, sunDir: { value: SUN_DIR },
      },
      vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }`,
      fragmentShader: `
        uniform vec3 top, mid, hor, sunCol, sunDir; varying vec3 vDir;
        void main(){
          float h = clamp(vDir.y, -0.2, 1.0);
          vec3 c = mix(hor, mid, smoothstep(0.0, 0.18, h));
          c = mix(c, top, smoothstep(0.18, 0.75, h));
          float s = max(dot(normalize(vDir), sunDir), 0.0);
          c += sunCol * (pow(s, 18.0) * 0.55 + pow(s, 3.0) * 0.18);
          gl_FragColor = vec4(c, 1.0);
        }`,
    }),
  );
  scene.add(sky);

  // ---- clouds: soft puffs drawn once to a canvas, used as sprites
  const puff = (() => {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 128;
    const g = c.getContext('2d')!;
    for (let i = 0; i < 14; i++) {
      const x = 40 + rand() * 176, y = 58 + (rand() - 0.5) * 30, r = 22 + rand() * 36;
      const grd = g.createRadialGradient(x, y, 0, x, y, r);
      grd.addColorStop(0, 'rgba(255,240,250,0.55)');
      grd.addColorStop(1, 'rgba(255,240,250,0)');
      g.fillStyle = grd;
      g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();
  const clouds: THREE.Sprite[] = [];
  for (let i = 0; i < (opts.mobile ? 7 : 12); i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: puff, transparent: true, depthWrite: false, fog: false, opacity: 0.5 + rand() * 0.35, color: 0xf3dcf2 }));
    const w = 30 + rand() * 40;
    s.scale.set(w, w * 0.42, 1);
    s.position.set((rand() - 0.5) * 260, 10 + rand() * 26, -180 - rand() * 90);
    scene.add(s);
    clouds.push(s);
  }

  // ---- the far shore: a dark bank and a line of faceted rocks
  const bank = new THREE.Mesh(new THREE.PlaneGeometry(400, 60), new THREE.MeshLambertMaterial({ color: UBE.farBank }));
  bank.rotation.x = -Math.PI / 2;
  bank.position.set(0, WATER_Y + 0.02, -100);
  scene.add(bank);
  const rockMat = new THREE.MeshLambertMaterial({ color: UBE.rock, flatShading: true });
  const rockGeo = new THREE.IcosahedronGeometry(1, 0);
  const rocks = new THREE.InstancedMesh(rockGeo, rockMat, 70);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  for (let i = 0; i < 70; i++) {
    const x = -140 + i * 4 + (rand() - 0.5) * 4;
    const z = -70 - rand() * 14;
    const h = 0.8 + rand() * rand() * 3.4;
    e.set(rand() * 0.4, rand() * 6, rand() * 0.3);
    q.setFromEuler(e);
    m.compose(new THREE.Vector3(x, WATER_Y + h * 0.3, z), q, new THREE.Vector3(2 + rand() * 2.4, h, 1.6 + rand() * 1.8));
    rocks.setMatrixAt(i, m);
  }
  scene.add(rocks);

  // ---- the lake: a reflector with slow ripples and a fade into the fog
  const dpr = Math.min(devicePixelRatio, opts.mobile ? 1 : 1.5);
  const water = new Reflector(new THREE.PlaneGeometry(400, 400), {
    textureWidth: Math.round(innerWidth * dpr * 0.6),
    textureHeight: Math.round(innerHeight * dpr * 0.6),
    clipBias: 0.003,
    color: 0x888888,
    shader: {
      name: 'UbeWater',
      uniforms: {
        color: { value: null },
        tDiffuse: { value: null },
        textureMatrix: { value: null },
        time: { value: 0 },
        tint: { value: UBE.water },
        fogCol: { value: (scene.fog as THREE.Fog).color },
        fadeNear: { value: 40 },
        fadeFar: { value: 130 },
      },
      vertexShader: `
        uniform mat4 textureMatrix; varying vec4 vUv; varying vec3 vWorld;
        void main(){ vUv = textureMatrix * vec4(position,1.); vWorld = (modelMatrix * vec4(position,1.)).xyz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }`,
      fragmentShader: `
        uniform sampler2D tDiffuse; uniform float time, fadeNear, fadeFar; uniform vec3 tint, fogCol;
        varying vec4 vUv; varying vec3 vWorld;
        void main(){
          vec2 w = vWorld.xz;
          vec2 rip = vec2(sin(w.y*2.1 + time*0.9) + sin(w.x*1.3 - time*0.6), cos(w.x*1.7 + time*0.7) + sin(w.y*2.9 - time*1.1)) * 0.006;
          vec4 uv = vUv; uv.xy += rip * uv.w;
          vec3 refl = texture2DProj(tDiffuse, uv).rgb;
          vec3 c = mix(refl, tint, 0.32);
          float d = length(vWorld - cameraPosition);
          c = mix(c, fogCol, smoothstep(fadeNear, fadeFar, d));
          gl_FragColor = vec4(c, 1.0);
          #include <colorspace_fragment>
        }`,
    },
  });
  water.rotation.x = -Math.PI / 2;
  water.position.y = WATER_Y;
  scene.add(water);
  const waterUniforms = (water.material as THREE.ShaderMaterial).uniforms;

  // ---- the stone the dolls stand on
  const stoneGeo = new THREE.CylinderGeometry(1, 1.12, 0.34, 9, 1);
  const pos = stoneGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    if (pos.getY(i) > 0) pos.setY(i, pos.getY(i) + (rand() - 0.5) * 0.03);
  }
  stoneGeo.computeVertexNormals();
  const stone = new THREE.Mesh(stoneGeo, new THREE.MeshLambertMaterial({ color: UBE.stone, flatShading: true }));
  stone.position.y = -0.17; // top face at y = 0
  scene.add(stone);

  // ---- foreground grass: instanced blades swaying in a vertex shader
  const blades = opts.mobile ? 1600 : 4200;
  const blade = new THREE.BufferGeometry();
  // a tapered strip, 4 segments
  const verts: number[] = [], idx: number[] = [];
  for (let s = 0; s <= 4; s++) {
    const y = s / 4, wdt = 0.05 * (1 - y * 0.92);
    verts.push(-wdt, y, 0, wdt, y, 0);
    if (s < 4) { const a = s * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  }
  blade.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  blade.setIndex(idx);
  const grassMat = new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    fog: true,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
      time: { value: 0 }, base: { value: UBE.grassBase }, tip: { value: UBE.grassTip }, push: { value: new THREE.Vector2() },
    }]),
    vertexShader: `
      uniform float time; uniform vec2 push; varying float vY;
      #include <fog_pars_vertex>
      void main(){
        vY = position.y;
        vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
        float phase = wp.x * 0.7 + wp.z * 1.3;
        float bend = (sin(time * 1.6 + phase) * 0.5 + sin(time * 0.7 + phase * 0.4)) * 0.16 + push.x * 0.25;
        wp.x += bend * vY * vY;
        wp.z += push.y * 0.12 * vY * vY;
        vec4 mvPosition = viewMatrix * wp;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: `
      uniform vec3 base, tip; varying float vY;
      #include <fog_pars_fragment>
      void main(){
        gl_FragColor = vec4(mix(base, tip, smoothstep(0.0, 1.0, vY)), 1.0);
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
  });
  const grass = new THREE.InstancedMesh(blade, grassMat, blades);
  const grassGroup = new THREE.Group();
  grassGroup.add(grass);
  const bankNear = new THREE.Mesh(new THREE.PlaneGeometry(60, 4), new THREE.MeshLambertMaterial({ color: UBE.grassBase }));
  bankNear.rotation.x = -Math.PI / 2;
  bankNear.position.y = -0.02;
  grassGroup.add(bankNear);
  for (let i = 0; i < blades; i++) {
    const x = (rand() - 0.5) * 30, z = (rand() - 0.5) * 2.6;
    const h = 0.16 + rand() * 0.3 + (z > 0.4 ? 0.12 : 0);
    e.set((rand() - 0.5) * 0.3, rand() * Math.PI, (rand() - 0.5) * 0.3);
    q.setFromEuler(e);
    m.compose(new THREE.Vector3(x, 0, z), q, new THREE.Vector3(1 + rand(), h, 1));
    grass.setMatrixAt(i, m);
  }
  scene.add(grassGroup);

  // ---- drifting specks of light
  const specks = opts.mobile ? 60 : 140;
  const sp = new Float32Array(specks * 3);
  for (let i = 0; i < specks; i++) { sp[i * 3] = (rand() - 0.5) * 30; sp[i * 3 + 1] = rand() * 7; sp[i * 3 + 2] = -rand() * 18 + 2; }
  const speckGeo = new THREE.BufferGeometry();
  speckGeo.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  const points = new THREE.Points(speckGeo, new THREE.PointsMaterial({
    color: 0xfff1f8, size: 0.06, transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending,
  }));
  scene.add(points);

  const fog = scene.fog as THREE.Fog;
  function layout(camera: THREE.PerspectiveCamera, platform: { x: number; width: number }) {
    // haze starts well behind the dolls: the long lens puts the camera far back
    const toDolls = camera.position.length();
    fog.near = toDolls + 18;
    fog.far = toDolls + 120;
    waterUniforms.fadeNear.value = toDolls + 25;
    waterUniforms.fadeFar.value = toDolls + 130;
    // the grass sits a few units in front of the camera, so it frames the bottom edge
    // where the ground first enters the bottom of the frame, so the grass only edges it
    const below = camera.position.y / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    grassGroup.position.set(camera.position.x, 0, camera.position.z - below * 0.95);
    stone.position.x = platform.x;
    stone.scale.set(platform.width / 2, 1, 1.15);
    water.getRenderTarget().setSize(Math.round(innerWidth * dpr * 0.6), Math.round(innerHeight * dpr * 0.6));
  }

  function update(t: number, px: number, py: number) {
    waterUniforms.time.value = t;
    grassMat.uniforms.time.value = t;
    grassMat.uniforms.push.value.set(px, py);
    for (let i = 0; i < clouds.length; i++) {
      clouds[i].position.x += 0.012 + (i % 3) * 0.004;
      if (clouds[i].position.x > 130) clouds[i].position.x = -130;
    }
    const a = speckGeo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < specks; i++) {
      let y = a.getY(i) + 0.004 + (i % 5) * 0.0012;
      if (y > 7) y = 0;
      a.setY(i, y);
      a.setX(i, a.getX(i) + Math.sin(t * 0.5 + i) * 0.002);
    }
    a.needsUpdate = true;
  }

  renderer.setClearColor(UBE.horizon);
  return { layout, update };
}

// a pink rim of light round any toon material, so the dolls separate from the dusk
export function addRim(mat: THREE.Material, colour = new THREE.Color('#FFC2DA'), strength = 0.32) {
  mat.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader.replace(
      '#include <opaque_fragment>',
      `float rimF = pow(1.0 - clamp(dot(normalize(normal), normalize(vViewPosition)), 0.0, 1.0), 3.0);
       outgoingLight += vec3(${colour.r.toFixed(3)}, ${colour.g.toFixed(3)}, ${colour.b.toFixed(3)}) * rimF * ${strength.toFixed(2)};
       #include <opaque_fragment>`,
    );
  };
}

// the logo's sunburst as a soft-glowing card in the scene, so it sits behind the speaker
export function createRays() {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const g = c.getContext('2d')!;
  g.translate(256, 256);
  g.lineCap = 'round';
  g.shadowColor = 'rgba(255,210,232,0.9)';
  g.shadowBlur = 18;
  g.strokeStyle = '#fff7fb';
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2, long = i % 2 === 0;
    const r0 = long ? 150 : 166, r1 = long ? 236 : 212;
    g.lineWidth = long ? 13 : 10;
    g.beginPath();
    g.moveTo(Math.cos(a) * r0, Math.sin(a) * r0);
    g.lineTo(Math.cos(a) * r1, Math.sin(a) * r1);
    g.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, fog: false, opacity: 0 });
  return new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
}
