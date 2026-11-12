// The dream meadow: soft rolling green hills all the way round, a little pond in front of the
// dolls that holds their reflections, wildflowers, pink blossom trees on the slopes, big
// fluffy clouds in a pale blue sky and petals drifting on the breeze. Everything is built in
// code (no textures to download) and surrounds the dolls in every direction, because the
// visitor can drag the camera round them. (world.ts keeps the earlier ube dusk valley.)
import * as THREE from 'three';
import { Reflector } from 'three/examples/jsm/objects/Reflector.js';

const COL = {
  skyTop: new THREE.Color('#4F8EDB'),
  skyMid: new THREE.Color('#86B9EA'),
  horizon: new THREE.Color('#D3E8F6'),
  sun: new THREE.Color('#FFF6E0'),
  grassDeep: new THREE.Color('#4F9A3A'),
  grassLight: new THREE.Color('#A9D96A'),
  grassTip: new THREE.Color('#C9EE84'),
  bank: new THREE.Color('#7DB653'),
  water: new THREE.Color('#9FCDE6'),
  bark: new THREE.Color('#7A5A4A'),
  blossom: ['#F7B6CF', '#F49BBF', '#FAD1E0', '#EE86AF'].map((c) => new THREE.Color(c)),
  flowers: ['#F48FB8', '#FFF8F2', '#FFF8F2', '#F7C6DA', '#FFE58A', '#E76FA3'].map((c) => new THREE.Color(c)),
};
const SUN_DIR = new THREE.Vector3(-0.45, 0.55, 0.7).normalize();
const WATER_Y = -0.06;

// where the dolls stand and where the pond lies (in front of them, toward the start camera)
export const CENTRE = new THREE.Vector2(1.4, 0);
const POND = { x: 1.4, z: 3.3, rx: 4.2, rz: 1.7 };

function rng(seed: number) {
  return () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
}

// smooth value noise, for the hills
function hash(x: number, y: number) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}
function noise(x: number, y: number) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x: number, y: number) {
  return noise(x, y) * 0.6 + noise(x * 2.1, y * 2.1) * 0.28 + noise(x * 4.3, y * 4.3) * 0.12;
}

/** Ground height at (x, z): a flat lawn where the dolls stand, the pond, then rolling hills. */
export function groundY(x: number, z: number) {
  const dx = x - CENTRE.x, dz = z - CENTRE.y;
  const r = Math.hypot(dx, dz);
  const lawn = (fbm(x * 0.35, z * 0.35) - 0.5) * 0.18;
  const hills = Math.pow(fbm(x * 0.04 + 3, z * 0.04 + 7), 1.7) * 11;
  const rise = THREE.MathUtils.smoothstep(r, 12, 48);
  let y = lawn * (1 - rise) + hills * rise - 0.02;
  y *= THREE.MathUtils.smoothstep(r, 2.6, 4.2); // the dolls' spot is level
  // the pond: a soft bowl that dips under the water line
  const p = Math.hypot((x - POND.x) / POND.rx, (z - POND.z) / POND.rz);
  if (p < 1.25) y = Math.min(y, WATER_Y - 0.22 + THREE.MathUtils.smoothstep(p, 0.75, 1.25) * 0.3);
  return y;
}

export type World = { update(t: number): void };

export function createMeadow(scene: THREE.Scene, renderer: THREE.WebGLRenderer, opts: { mobile: boolean }): World {
  const rand = rng(11);
  const mobile = opts.mobile;
  scene.fog = new THREE.Fog(new THREE.Color('#E6EEF6'), 18, 140); // a soft haze for depth
  renderer.setClearColor(COL.horizon);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  // ---- light: a bright soft day. The sky lights everything (image-based light, made from
  // the sky dome below), a warm sun casts soft shadows, a pink back light rims the dolls.
  scene.add(new THREE.HemisphereLight(0xdff0ff, 0x6c9a4a, 0.45));
  const sun = new THREE.DirectionalLight(0xfff1dc, 2.6);
  sun.position.set(CENTRE.x, 0, CENTRE.y).addScaledVector(SUN_DIR, 30);
  sun.target.position.set(CENTRE.x, 0, CENTRE.y);
  sun.castShadow = true;
  sun.shadow.mapSize.set(mobile ? 1024 : 2048, mobile ? 1024 : 2048);
  Object.assign(sun.shadow.camera, { left: -14, right: 14, top: 14, bottom: -14, near: 1, far: 80 });
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.03;
  sun.shadow.radius = 6;
  scene.add(sun, sun.target);
  const back = new THREE.DirectionalLight(0xffd6e6, 0.9);
  back.position.set(6, 6, -14);
  scene.add(back);

  // ---- sky dome
  const skyDome = new THREE.Mesh(
    new THREE.SphereGeometry(600, 32, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: { top: { value: COL.skyTop }, mid: { value: COL.skyMid }, hor: { value: COL.horizon }, sunCol: { value: COL.sun }, sunDir: { value: SUN_DIR } },
      vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }`,
      fragmentShader: `
        uniform vec3 top, mid, hor, sunCol, sunDir; varying vec3 vDir;
        void main(){
          float h = clamp(vDir.y, -0.2, 1.0);
          vec3 c = mix(hor, mid, smoothstep(0.0, 0.22, h));
          c = mix(c, top, smoothstep(0.22, 0.85, h));
          float s = max(dot(normalize(vDir), sunDir), 0.0);
          c += sunCol * (pow(s, 64.0) * 0.6 + pow(s, 6.0) * 0.12);
          gl_FragColor = vec4(c, 1.0);
        }`,
    }),
  );
  scene.add(skyDome);
  // image-based light from the sky itself, so every surface picks up its blue
  {
    const pmrem = new THREE.PMREMGenerator(renderer);
    const skyOnly = new THREE.Scene();
    skyOnly.add(skyDome.clone());
    scene.environment = pmrem.fromScene(skyOnly, 0.04).texture;
    scene.environmentIntensity = 0.7;
    pmrem.dispose();
  }

  // ---- clouds: puffy cumulus, lit from above, as sprite clusters all round the sky
  const puff = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 256;
    const g = c.getContext('2d')!;
    const grd = g.createRadialGradient(128, 118, 10, 128, 128, 126);
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(0.55, 'rgba(250,252,255,0.9)');
    grd.addColorStop(0.8, 'rgba(225,236,248,0.45)');
    grd.addColorStop(1, 'rgba(225,236,248,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, 256, 256);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();
  const clouds = new THREE.Group();
  const cloudCount = mobile ? 9 : 16;
  for (let i = 0; i < cloudCount; i++) {
    const cloud = new THREE.Group();
    const a = (i / cloudCount) * Math.PI * 2 + rand() * 0.3;
    const dist = 170 + rand() * 120;
    cloud.position.set(Math.cos(a) * dist, 34 + rand() * 40, Math.sin(a) * dist);
    const puffs = 7 + Math.floor(rand() * 6);
    const w = 26 + rand() * 30;
    for (let k = 0; k < puffs; k++) {
      const under = k < puffs * 0.35; // the underside a touch blue-grey
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: puff, color: under ? 0xdde8f5 : 0xffffff, transparent: true, depthWrite: false, fog: false }));
      const sz = w * (0.35 + rand() * 0.45);
      s.scale.set(sz, sz * 0.85, 1);
      s.position.set((rand() - 0.5) * w * 1.3, under ? -sz * 0.12 : rand() * w * 0.35, (rand() - 0.5) * 8);
      cloud.add(s);
    }
    clouds.add(cloud);
  }
  scene.add(clouds);

  // ---- the ground: one big terrain, coloured by height and a little noise
  const size = 520, seg = mobile ? 160 : 260;
  const ground = new THREE.PlaneGeometry(size, size, seg, seg);
  ground.rotateX(-Math.PI / 2);
  ground.translate(CENTRE.x, 0, CENTRE.y);
  const gp = ground.attributes.position as THREE.BufferAttribute;
  const colours = new Float32Array(gp.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < gp.count; i++) {
    const x = gp.getX(i), z = gp.getZ(i), y = groundY(x, z);
    gp.setY(i, y);
    const n = fbm(x * 0.2, z * 0.2);
    c.copy(COL.grassDeep).lerp(COL.grassLight, THREE.MathUtils.clamp(0.35 + n * 0.5 + y * 0.03, 0, 1));
    if (y < WATER_Y + 0.02) c.lerp(COL.bank, 0.6);
    colours.set([c.r, c.g, c.b], i * 3);
  }
  ground.setAttribute('color', new THREE.BufferAttribute(colours, 3));
  ground.computeVertexNormals();
  const groundMesh = new THREE.Mesh(ground, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 }));
  groundMesh.receiveShadow = true;
  scene.add(groundMesh);

  // ---- the pond: a reflector, its edges hidden by the terrain around it, with slow ripples
  const dpr = Math.min(devicePixelRatio, mobile ? 1 : 1.5);
  const pond = new Reflector(new THREE.PlaneGeometry(POND.rx * 2.8, POND.rz * 2.8), {
    textureWidth: Math.round(innerWidth * dpr * 0.6),
    textureHeight: Math.round(innerHeight * dpr * 0.6),
    clipBias: 0.003,
    color: 0x888888,
    shader: {
      name: 'Pond',
      uniforms: { color: { value: null }, tDiffuse: { value: null }, textureMatrix: { value: null }, time: { value: 0 }, tint: { value: COL.water } },
      vertexShader: `
        uniform mat4 textureMatrix; varying vec4 vUv; varying vec3 vWorld;
        void main(){ vUv = textureMatrix * vec4(position,1.); vWorld = (modelMatrix * vec4(position,1.)).xyz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }`,
      fragmentShader: `
        uniform sampler2D tDiffuse; uniform float time; uniform vec3 tint;
        varying vec4 vUv; varying vec3 vWorld;
        void main(){
          vec2 w = vWorld.xz;
          vec2 rip = vec2(sin(w.y*3.1 + time*1.1) + sin(w.x*2.3 - time*0.8), cos(w.x*2.7 + time*0.9) + sin(w.y*3.9 - time*1.3)) * 0.005;
          vec4 uv = vUv; uv.xy += rip * uv.w;
          vec3 c = mix(texture2DProj(tDiffuse, uv).rgb, tint, 0.28);
          gl_FragColor = vec4(c, 1.0);
          #include <colorspace_fragment>
        }`,
    },
  });
  pond.rotation.x = -Math.PI / 2;
  pond.position.set(POND.x, WATER_Y, POND.z);
  scene.add(pond);
  const pondU = (pond.material as THREE.ShaderMaterial).uniforms;

  // ---- a fine lawn: dense, thin, curved blades that grow in clumps, right up to the dolls
  const blades = mobile ? 26000 : 70000;
  const blade = new THREE.BufferGeometry();
  const verts: number[] = [], idx: number[] = [];
  const SEGS = 5;
  for (let sg = 0; sg <= SEGS; sg++) {
    const y = sg / SEGS;
    // a slim blade that tapers to a point and arches forward as it rises
    const wdt = 0.011 * Math.pow(1 - y, 0.7) + 0.0006;
    const lean = y * y * 0.35;
    verts.push(-wdt, y, lean, wdt, y, lean);
    if (sg < SEGS) { const k = sg * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
  }
  blade.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  blade.setIndex(idx);
  const grassMat = new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    fog: true,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
      time: { value: 0 },
      root: { value: new THREE.Color('#2E5A22') },
      base: { value: COL.grassDeep },
      tip: { value: new THREE.Color('#B8E07A') },
      dry: { value: new THREE.Color('#C9C27A') },
      sunDir: { value: SUN_DIR }, sunCol: { value: new THREE.Color('#fff1dc') }, sky: { value: new THREE.Color('#bcd9f2') },
    }]),
    vertexShader: `uniform float time; varying float vY; varying float vVar; varying vec3 vN; varying vec3 vView;
      #include <fog_pars_vertex>
      void main(){
        vY = position.y;
        vVar = fract(sin(float(gl_InstanceID) * 12.9898) * 43758.5453);
        // the blade's normal tilts with its arch, so light rolls down it
        vN = normalize(mat3(modelMatrix * instanceMatrix) * vec3(0.0, 0.7 * vY, 1.0));
        vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
        float ph = wp.x * 1.3 + wp.z * 1.7;
        float gust = sin(time * 0.5 + wp.x * 0.15) * 0.5 + 0.5;
        float bend = (sin(time * 1.9 + ph) * 0.35 + sin(time * 0.8 + ph * 0.3)) * (0.025 + gust * 0.03);
        wp.x += bend * vY * vY; wp.z += bend * 0.5 * vY * vY;
        vView = normalize(cameraPosition - wp.xyz);
        vec4 mvPosition = viewMatrix * wp;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: `uniform vec3 root, base, tip, dry, sunDir, sunCol, sky; varying float vY; varying float vVar; varying vec3 vN; varying vec3 vView;
      #include <fog_pars_fragment>
      void main(){
        // albedo: shaded root into a fresh green, a lighter tip; each blade its own green,
        // and one in twelve gone straw-dry
        vec3 alb = mix(root, base, smoothstep(0.0, 0.45, vY));
        alb = mix(alb, tip, smoothstep(0.45, 1.0, vY) * (0.5 + vVar * 0.5));
        alb *= 0.85 + vVar * 0.3;
        alb = mix(alb, dry * mix(0.6, 1.0, vY), step(0.92, vVar));
        vec3 n = normalize(vN) * (gl_FrontFacing ? 1.0 : -1.0);
        float diff = max(dot(n, sunDir), 0.0) * 0.65 + 0.35;
        float spec = pow(max(dot(reflect(-sunDir, n), vView), 0.0), 24.0) * 0.18 * vY;
        float trans = pow(max(dot(-vView, sunDir), 0.0), 3.0) * vY * 0.5;
        float ao = mix(0.35, 1.0, smoothstep(0.0, 0.6, vY));
        vec3 col = alb * (sunCol * diff * 1.55 + sky * 0.5) * ao + tip * trans + sunCol * spec;
        gl_FragColor = vec4(col, 1.0);
        #include <fog_fragment>
      }`,
  });
  const grass = new THREE.InstancedMesh(blade, grassMat, blades);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3();
  // the dolls' footprints (their places in the row), so no blade grows through one
  const FEET = [[0, 0, 0.62], [2.08, 0, 0.53], [2.98, 0, 0.45], [1.17, 0, 0.38]];
  const clear = (x: number, z: number) => FEET.every(([fx, fz, r]) => Math.hypot(x - fx, z - fz) > r);
  const spot = (maxR: number) => {
    for (let tries = 0; tries < 20; tries++) {
      const a = rand() * Math.PI * 2, r = Math.sqrt(rand()) * maxR;
      const x = CENTRE.x + Math.cos(a) * r, z = CENTRE.y + Math.sin(a) * r;
      const y = groundY(x, z);
      if (y < WATER_Y + 0.03) continue; // not in the pond
      if (!clear(x, z)) continue;
      return v.set(x, y, z);
    }
    return null;
  };
  // blades grow in tufts: pick a tuft centre, then scatter a handful of blades round it
  let gi = 0;
  const near = blades * 0.8;
  while (gi < blades) {
    const c = spot(gi < near ? 10 : 30);
    if (!c) continue;
    const cx = c.x, cz = c.z;
    const tuft = 6 + Math.floor(rand() * 10);
    const tall = gi < near ? 0.11 + rand() * 0.14 : 0.2 + rand() * 0.25;
    for (let k = 0; k < tuft && gi < blades; k++) {
      const x = cx + (rand() - 0.5) * 0.16, z = cz + (rand() - 0.5) * 0.16;
      if (!clear(x, z)) continue;
      const y = groundY(x, z) - 0.01;
      e.set((rand() - 0.5) * 0.5, rand() * Math.PI * 2, (rand() - 0.5) * 0.5);
      q.setFromEuler(e);
      m.compose(v.set(x, y, z), q, new THREE.Vector3(0.8 + rand() * 0.6, tall * (0.6 + rand() * 0.8), 1));
      grass.setMatrixAt(gi++, m);
    }
  }
  grass.count = gi;
  grass.frustumCulled = false;
  scene.add(grass);

  // ---- the bloom field: soft round blooms as camera-facing cards, heaped into mounds.
  // One instanced mesh draws every bloom in the meadow and every blossom on the trees.
  const bloomTex = (() => {
    const cv = document.createElement('canvas');
    cv.width = cv.height = 64;
    const g = cv.getContext('2d')!;
    // a soft rose: petals as overlapping blobs, lighter at the heart, feathered edge
    for (let k = 0; k < 9; k++) {
      const a = (k / 9) * Math.PI * 2, rr = k < 6 ? 15 : 7;
      const x = 32 + Math.cos(a) * rr, y = 32 + Math.sin(a) * rr;
      const grd = g.createRadialGradient(x, y, 0, x, y, 17);
      grd.addColorStop(0, 'rgba(255,255,255,0.95)');
      grd.addColorStop(0.7, 'rgba(235,235,235,0.75)');
      grd.addColorStop(1, 'rgba(210,210,210,0)');
      g.fillStyle = grd;
      g.beginPath(); g.arc(x, y, 17, 0, Math.PI * 2); g.fill();
    }
    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();
  const bloomMat = new THREE.ShaderMaterial({
    fog: true,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, {
      time: { value: 0 }, map: { value: bloomTex }, sunCol: { value: new THREE.Color('#fff1dc') }, sky: { value: new THREE.Color('#c8dcf2') },
    }]),
    vertexShader: `
      uniform float time; varying vec2 vUv; varying vec3 vCol; varying float vLight;
      #include <fog_pars_vertex>
      void main(){
        vUv = uv;
        vec4 c = modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
        float s = length(instanceMatrix[0].xyz);
        float ph = c.x * 0.9 + c.z * 0.7;
        c.x += sin(time * 1.2 + ph) * 0.025 * s * 6.0;
        vec4 mvPosition = viewMatrix * c;
        mvPosition.xy += position.xy * s;
        gl_Position = projectionMatrix * mvPosition;
        #ifdef USE_INSTANCING_COLOR
          vCol = instanceColor;
        #else
          vCol = vec3(1.0);
        #endif
        // blooms high on a mound catch more sun; each one a touch different
        float h = fract(sin(dot(c.xz, vec2(12.9898, 78.233))) * 43758.5453);
        vLight = 0.78 + h * 0.3;
        #include <fog_vertex>
      }`,
    fragmentShader: `
      uniform sampler2D map; uniform vec3 sunCol, sky; varying vec2 vUv; varying vec3 vCol; varying float vLight;
      #include <fog_pars_fragment>
      void main(){
        vec4 t = texture2D(map, vUv);
        if (t.a < 0.42) discard;
        vec3 col = vCol * t.rgb * (sunCol * vLight * 1.15 + sky * 0.25);
        gl_FragColor = vec4(col, 1.0);
        #include <fog_fragment>
      }`,
  });
  const PALETTES = [
    ['#F27F7F', '#F49A8E', '#F7B2A8', '#FCE3DC'],   // coral roses
    ['#F49BBF', '#F7B6CF', '#FAD1E0', '#FFF2F5'],   // pink
    ['#FFF6F2', '#FBE9E4', '#FFFFFF', '#F6D9DE'],   // white
    ['#9C97DE', '#B0A9E8', '#8E84D2', '#C6BFF0'],   // lavender
  ].map((p) => p.map((c) => new THREE.Color(c)));
  const blooms: { p: THREE.Vector3; s: number; c: THREE.Color }[] = [];
  // mounds round the dolls, more and bigger toward the hills
  const mounds = mobile ? 34 : 60;
  for (let i = 0; i < mounds; i++) {
    const a = rand() * Math.PI * 2, r = 4.5 + Math.pow(rand(), 0.8) * 40;
    const mx = CENTRE.x + Math.cos(a) * r, mz = CENTRE.y + Math.sin(a) * r;
    if (Math.hypot((mx - POND.x) / POND.rx, (mz - POND.z) / POND.rz) < 1.3) continue;
    if (Math.abs(mz) < 2.2 && mx > -2 && mx < 4.8) continue; // not on the dolls' lawn
    const rad = 1.4 + rand() * (1.2 + r * 0.08), hgt = 0.35 + rand() * 0.9;
    const pal = PALETTES[i % 7 === 3 ? 3 : Math.floor(rand() * 3)];
    const n = Math.round(rad * rad * (mobile ? 55 : 120));
    for (let k = 0; k < n; k++) {
      const ang = rand() * Math.PI * 2, d = Math.sqrt(rand());
      const x = mx + Math.cos(ang) * d * rad, z = mz + Math.sin(ang) * d * rad;
      const gy = groundY(x, z);
      if (gy < WATER_Y + 0.03) continue;
      const y = gy + (1 - d * d) * hgt + rand() * 0.12;
      blooms.push({ p: new THREE.Vector3(x, y, z), s: 0.13 + rand() * 0.12, c: pal[Math.floor(rand() * pal.length)] });
    }
  }
  // little daisies and clover-pinks nestled low in the lawn, in loose drifts
  const lawnFlowers = [new THREE.Color('#FFFDF8'), new THREE.Color('#FFF6EE'), new THREE.Color('#F7C4D4'), new THREE.Color('#F3A9C0')];
  for (let i = 0; i < (mobile ? 700 : 2200); i++) {
    const p = spot(12);
    if (!p) continue;
    if (fbm(p.x * 0.5 + 4, p.z * 0.5) < 0.5 && rand() < 0.75) continue;
    blooms.push({ p: p.clone().setY(p.y + 0.1 + rand() * 0.08), s: 0.035 + rand() * 0.03, c: lawnFlowers[Math.floor(rand() * lawnFlowers.length)] });
  }

  // ---- blossom trees: a trunk and a cloud of pink blooms
  const trunkGeo = new THREE.CylinderGeometry(0.16, 0.26, 2.6, 7);
  trunkGeo.translate(0, 1.3, 0);
  const trunkMat = new THREE.MeshStandardMaterial({ color: COL.bark, roughness: 0.9 });
  const trees = mobile ? 12 : 22;
  for (let i = 0; i < trees; i++) {
    const a = (i / trees) * Math.PI * 2 + rand() * 0.5;
    const r = 20 + rand() * 45;
    const x = CENTRE.x + Math.cos(a) * r, z = CENTRE.y + Math.sin(a) * r;
    if (Math.hypot((x - POND.x) / POND.rx, (z - POND.z) / POND.rz) < 1.6) continue;
    if (z < -4 && z > -16 && Math.abs(x - CENTRE.x) < 5) continue; // keep the start view open
    const k = 0.8 + rand() * 0.7;
    const base = new THREE.Vector3(x, groundY(x, z) - 0.1, z);
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.copy(base);
    trunk.scale.setScalar(k);
    trunk.castShadow = true;
    scene.add(trunk);
    const pal = PALETTES[1];
    const n = mobile ? 260 : 650;
    for (let b = 0; b < n; b++) {
      // inside a lumpy ellipsoid crown
      const u = rand() * Math.PI * 2, w = Math.acos(2 * rand() - 1), d = Math.cbrt(rand());
      const cx = Math.sin(w) * Math.cos(u) * 2.2 * d, cy = Math.cos(w) * 1.3 * d, cz = Math.sin(w) * Math.sin(u) * 2.2 * d;
      blooms.push({ p: new THREE.Vector3(cx, cy + 3.4, cz).multiplyScalar(k).add(base), s: (0.2 + rand() * 0.16) * k, c: pal[Math.floor(rand() * pal.length)] });
    }
  }
  const bloomMesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), bloomMat, blooms.length);
  for (let i = 0; i < blooms.length; i++) {
    const b = blooms[i];
    m.compose(b.p, q.identity(), v.setScalar(b.s));
    bloomMesh.setMatrixAt(i, m);
    bloomMesh.setColorAt(i, b.c);
  }
  bloomMesh.frustumCulled = false;
  scene.add(bloomMesh);

  // ---- petals on the breeze
  const petals = mobile ? 90 : 220;
  const pp = new Float32Array(petals * 3);
  for (let i = 0; i < petals; i++) {
    pp[i * 3] = CENTRE.x + (rand() - 0.5) * 30;
    pp[i * 3 + 1] = rand() * 8;
    pp[i * 3 + 2] = (rand() - 0.5) * 30;
  }
  const petalGeo = new THREE.BufferGeometry();
  petalGeo.setAttribute('position', new THREE.BufferAttribute(pp, 3));
  const petalTex = (() => {
    const cv = document.createElement('canvas');
    cv.width = cv.height = 32;
    const g = cv.getContext('2d')!;
    g.fillStyle = '#f9b9d2';
    g.beginPath();
    g.ellipse(16, 16, 13, 8, 0.6, 0, Math.PI * 2);
    g.fill();
    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();
  scene.add(new THREE.Points(petalGeo, new THREE.PointsMaterial({ map: petalTex, size: 0.14, transparent: true, depthWrite: false, alphaTest: 0.2 })));

  function update(t: number) {
    pondU.time.value = t;
    grassMat.uniforms.time.value = t;
    bloomMat.uniforms.time.value = t;
    clouds.rotation.y = t * 0.004;
    const a = petalGeo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < petals; i++) {
      let y = a.getY(i) - 0.006 - (i % 4) * 0.0015;
      let x = a.getX(i) + 0.008 + Math.sin(t * 0.7 + i) * 0.006;
      if (y < 0) y = 8;
      if (x > CENTRE.x + 15) x = CENTRE.x - 15;
      a.setXYZ(i, x, y, a.getZ(i) + Math.cos(t * 0.5 + i) * 0.004);
    }
    a.needsUpdate = true;
  }
  return { update };
}

// the logo's sunburst in navy, like the brand illustration
export function createNavyRays() {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 512;
  const g = cv.getContext('2d')!;
  g.translate(256, 256);
  g.lineCap = 'round';
  g.strokeStyle = '#0f1e37';
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2, long = i % 2 === 0;
    const r0 = long ? 150 : 166, r1 = long ? 236 : 212;
    g.lineWidth = long ? 12 : 9;
    g.beginPath();
    g.moveTo(Math.cos(a) * r0, Math.sin(a) * r0);
    g.lineTo(Math.cos(a) * r1, Math.sin(a) * r1);
    g.stroke();
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, fog: false, opacity: 0 }),
  );
}
