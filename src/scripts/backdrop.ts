// The Blender-rendered meadow (media-src/mamasons-doll/meadow_world.py), dropped into
// public/backdrop/:
//   meadow-360.jpg      the world, a Cycles equirectangular panorama
//   meadow-360-veg.png  white where the render has grass, flowers or blossom
// The panorama is projected onto a dome with a flat floor at the capture height, so the dolls
// stand in it and the visitor can drag right round. The plants sway: the shader ripples the
// panorama only where the mask is white. Real 3D grass at the dolls' feet sways too.
import * as THREE from 'three';
import { GroundedSkybox } from 'three/examples/jsm/objects/GroundedSkybox.js';

export type Backdrop = { kind: '360' | 'still' | 'strip'; update(t: number): void; view?: StripView };

/** Where the strip was rendered from and what it covers (Blender's VIEW, in three.js axes). */
export type StripView = { pos: THREE.Vector3; lon: [number, number]; lat: [number, number] };
export const STRIP_VIEW: StripView = {
  pos: new THREE.Vector3(1.4, 1.25, 8.5), // Blender (x, y, z) = (1.4, -8.5, 1.25)
  lon: [-80, 80],
  lat: [-45, 55],
};

const EYE = 1.6; // the panorama's capture height above the ground, in doll units (as in Blender)

/** The backdrop the build found in public/backdrop/, if any (see nest.astro). */
export async function findBackdrop(): Promise<{ kind: '360' | 'still' | 'strip'; url: string } | null> {
  const v = document.querySelector<HTMLElement>('[data-nest]')?.dataset.backdrop ?? '';
  const [kind, url] = v.split(':');
  return kind && url ? { kind: kind as '360' | 'still' | 'strip', url } : null;
}

export async function createBackdrop(
  scene: THREE.Scene,
  renderer: THREE.WebGLRenderer,
  found: { kind: '360' | 'still' | 'strip'; url: string },
  centre: THREE.Vector3,
): Promise<Backdrop> {
  const loader = new THREE.TextureLoader();
  const [tex, veg] = await Promise.all([
    loader.loadAsync(found.url),
    loader.loadAsync(found.url.replace(/\.jpg$/, '-veg.png')).catch(() => null),
  ]);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.mapping = THREE.EquirectangularReflectionMapping;
  renderer.toneMapping = THREE.NoToneMapping; // the render is already graded in Blender
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  // the panorama lights the dolls in its own colours; a sun gives them a soft contact shadow
  scene.environment = tex;
  scene.environmentIntensity = 0.35;
  scene.add(new THREE.HemisphereLight(0xeaf3ff, 0x6f9a52, 0.35));
  const sun = new THREE.DirectionalLight(0xfff1e6, 1.0);
  sun.position.set(centre.x - 6, 12, centre.z + 8);
  sun.target.position.copy(centre);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -6, right: 6, top: 6, bottom: -6, near: 1, far: 40 });
  sun.shadow.radius = 8;
  scene.add(sun, sun.target);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), new THREE.ShadowMaterial({ opacity: 0.2 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(centre.x, 0.002, centre.z);
  floor.receiveShadow = true;
  scene.add(floor);

  // ---- the dome, sampled by direction, with plants rippling in a breeze
  const time = { value: 0 };
  const strip = found.kind === 'strip';
  const sky = strip ? new THREE.Mesh(new THREE.SphereGeometry(300, 96, 48)) : new GroundedSkybox(tex, EYE, 120, 128);
  if (strip) sky.position.copy(STRIP_VIEW.pos);
  else sky.position.set(centre.x, EYE - 0.01, centre.z);
  sky.material = new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    depthWrite: false,
    uniforms: {
      map: { value: tex }, veg: { value: veg }, hasVeg: { value: veg ? 1 : 0 }, time,
      strip: { value: strip ? 1 : 0 },
      lonR: { value: new THREE.Vector2(...STRIP_VIEW.lon) }, latR: { value: new THREE.Vector2(...STRIP_VIEW.lat) },
    },
    vertexShader: `varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `
      uniform sampler2D map, veg; uniform float hasVeg, time, strip; uniform vec2 lonR, latR; varying vec3 vDir;
      void main(){
        vec3 d = normalize(vDir);
        vec2 uv;
        if (strip > 0.5) {
          // a partial equirect rendered looking along -z: longitude across, latitude up
          float lon = degrees(atan(-d.x, -d.z));
          float lat = degrees(asin(clamp(d.y, -1.0, 1.0)));
          uv = clamp(vec2((lon - lonR.x) / (lonR.y - lonR.x), (lat - latR.x) / (latR.y - latR.x)), 0.001, 0.999);
        } else {
          // three.js puts -z in the middle of an equirect; Blender's camera faced the dolls' back (+y = three -z)
          uv = vec2(atan(d.z, d.x) * 0.15915494 + 0.5, asin(clamp(d.y, -1.0, 1.0)) * 0.31830989 + 0.5);
        }
        if (hasVeg > 0.5) {
          float m = texture2D(veg, uv).r;
          float gust = 0.6 + 0.4 * sin(time * 0.4 + uv.x * 18.0);
          vec2 wob = vec2(
            sin(time * 1.6 + uv.x * 420.0 + uv.y * 160.0) + 0.5 * sin(time * 2.7 + uv.x * 900.0),
            0.35 * sin(time * 1.3 + uv.x * 300.0)
          ) * 0.0008 * gust * m;
          uv += wob;
        }
        gl_FragColor = texture2D(map, uv);
        #include <colorspace_fragment>
      }`,
  });
  scene.add(sky);
  scene.fog = null;

  // ---- living grass at the dolls' feet, melting into the panorama's own lawn
  const blades = innerWidth < 720 ? 9000 : 22000;
  const blade = new THREE.BufferGeometry();
  const verts: number[] = [], idx: number[] = [];
  for (let s = 0; s <= 4; s++) {
    const y = s / 4, w = 0.012 * Math.pow(1 - y, 0.7) + 0.0006;
    verts.push(-w, y, y * y * 0.3, w, y, y * y * 0.3);
    if (s < 4) { const k = s * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
  }
  blade.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  blade.setIndex(idx);
  const grassMat = new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    uniforms: { time, root: { value: new THREE.Color('#1F3F14') }, tip: { value: new THREE.Color('#6E8F45') } },
    vertexShader: `uniform float time; varying float vY; varying float vVar;
      void main(){
        vY = position.y;
        vVar = fract(sin(float(gl_InstanceID) * 12.9898) * 43758.5453);
        vec4 wp = modelMatrix * instanceMatrix * vec4(position, 1.0);
        float ph = wp.x * 1.3 + wp.z * 1.7;
        float gust = 0.6 + 0.4 * sin(time * 0.4 + wp.x * 0.5);
        float bend = (sin(time * 1.6 + ph) * 0.35 + sin(time * 0.7 + ph * 0.3)) * 0.05 * gust;
        wp.x += bend * vY * vY; wp.z += bend * 0.5 * vY * vY;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: `uniform vec3 root, tip; varying float vY; varying float vVar;
      void main(){
        vec3 c = mix(root * 0.7, tip, smoothstep(0.0, 1.0, vY)) * (0.85 + vVar * 0.3);
        gl_FragColor = vec4(c, 1.0);
        #include <colorspace_fragment>
      }`,
  });
  const grass = new THREE.InstancedMesh(blade, grassMat, blades);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3();
  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  for (let i = 0; i < blades; i++) {
    const a = rand() * Math.PI * 2, r = Math.pow(rand(), 0.7) * 3.0;
    e.set((rand() - 0.5) * 0.5, rand() * Math.PI * 2, (rand() - 0.5) * 0.5);
    q.setFromEuler(e);
    const h = (0.09 + rand() * 0.12) * (1 - r / 5.2);
    m.compose(v.set(centre.x + Math.cos(a) * r * 1.2, 0, centre.z + Math.sin(a) * r * 0.8), q, new THREE.Vector3(1, h, 1));
    grass.setMatrixAt(i, m);
  }
  if (!strip) scene.add(grass); // the strip's own lawn reaches the dolls' feet

  return { kind: strip ? 'strip' : '360', view: strip ? STRIP_VIEW : undefined, update(t: number) { time.value = t; } };
}
