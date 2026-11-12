// The dream print: the background is rendered (in linear HDR) to a texture, then composited to
// the screen in one pass that softens it a touch, lays a fuzzy colour halftone over it (round
// soft dots in the scene's own colours on a paler paper, after the dotted-sky reference),
// adds a soft bloom round the bright parts, tone-maps it like film and vignettes the edges.
// The dolls (layer 1) are then drawn on top, clean, so their faces never break into dots.
import * as THREE from 'three';

export const DOLL_LAYER = 1;

export type Halftone = {
  render(scene: THREE.Scene, camera: THREE.PerspectiveCamera, focus?: number): void;
  setDof(on: boolean): void;
  resize(): void;
};

export function createHalftone(renderer: THREE.WebGLRenderer, opts: { amount?: number; cell?: number } = {}): Halftone {
  const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
  rt.depthTexture = new THREE.DepthTexture(1, 1);
  const quad = new THREE.Mesh(
    new THREE.PlaneGeometry(2, 2),
    new THREE.ShaderMaterial({
      depthTest: false,
      depthWrite: false,
      toneMapped: true,
      uniforms: {
        tScene: { value: rt.texture },
        res: { value: new THREE.Vector2(1, 1) },
        cell: { value: opts.cell ?? 6 },
        amount: { value: opts.amount ?? 0 },
        tDepth: { value: rt.depthTexture },
        near: { value: 0.1 },
        far: { value: 1000 },
        focus: { value: 12 },
        dofOn: { value: 1 },
      },
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0., 1.); }`,
      fragmentShader: `
        uniform sampler2D tScene, tDepth; uniform vec2 res; uniform float cell, amount, near, far, focus, dofOn;
        varying vec2 vUv;
        vec3 soft(vec2 uv, float r){
          vec2 p = r / res;
          vec3 c = texture2D(tScene, uv).rgb * 0.36;
          c += texture2D(tScene, uv + vec2( p.x, 0.)).rgb * 0.16;
          c += texture2D(tScene, uv + vec2(-p.x, 0.)).rgb * 0.16;
          c += texture2D(tScene, uv + vec2(0.,  p.y)).rgb * 0.16;
          c += texture2D(tScene, uv + vec2(0., -p.y)).rgb * 0.16;
          return c;
        }
        float luma(vec3 c){ return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
        float viewZ(vec2 uv){
          float z = texture2D(tDepth, uv).x * 2.0 - 1.0;
          return 2.0 * near * far / (far + near - z * (far - near));
        }
        // depth of field: a disc gather whose size grows away from the focus distance
        vec3 dof(vec2 uv){
          float d = viewZ(uv);
          float coc = clamp(abs(d - focus) / focus, 0.0, 1.0);
          coc = (smoothstep(0.08, 0.9, coc) * 11.0 + 1.2) * dofOn;   // pixels
          vec3 acc = texture2D(tScene, uv).rgb; float w = 1.0;
          for (int i = 0; i < 20; i++) {
            float fi = float(i);
            float r = sqrt((fi + 0.5) / 20.0) * coc;
            float a = fi * 2.39996;
            vec2 o = vec2(cos(a), sin(a)) * r / res;
            acc += texture2D(tScene, uv + o).rgb; w += 1.0;
          }
          return acc / w;
        }
        void main(){
          vec2 px = vUv * res;
          vec3 base = dof(vUv);

          // fuzzy colour halftone, the grid turned 15 degrees like print
          float a = 0.2618; mat2 rot = mat2(cos(a), -sin(a), sin(a), cos(a));
          vec2 q = rot * px;
          vec2 id = floor(q / cell);
          vec2 cq = (id + 0.5) * cell;
          vec2 cpx = transpose(rot) * cq;
          vec3 cc = dof(cpx / res);
          float l = clamp(luma(cc), 0.0, 1.2);
          float r = sqrt(clamp(1.05 - l * 0.85, 0.0, 1.0)) * 0.62;
          float d = length(q - cq) / cell;
          float dotMask = 1.0 - smoothstep(r - 0.16, r + 0.16, d);
          vec3 paper = mix(cc, vec3(1.0), 0.55);
          vec3 printed = mix(paper, cc * 0.82, dotMask);
          vec3 col = amount > 0.0 ? mix(base, printed, amount) : base;

          // soft bloom: a ring of taps, keeping only what is bright
          vec3 glow = vec3(0.0);
          for (int i = 0; i < 12; i++) {
            float t = float(i) / 12.0 * 6.2832;
            vec2 o = vec2(cos(t), sin(t));
            vec3 s1 = texture2D(tScene, vUv + o * 14.0 / res).rgb;
            vec3 s2 = texture2D(tScene, vUv + o * 34.0 / res).rgb;
            glow += max(s1 - 0.85, 0.0) + max(s2 - 0.85, 0.0) * 0.6;
          }
          col += glow / 12.0 * 0.55;

          // the film curve below greys pastels a little; give the colour back
          col = mix(vec3(luma(col)), col, 1.28);

          // a gentle vignette
          vec2 v = vUv - 0.5;
          col *= 1.0 - dot(v, v) * 0.35;

          gl_FragColor = vec4(col, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    }),
  );
  const post = new THREE.Scene();
  post.add(quad);
  const postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const mat = quad.material as THREE.ShaderMaterial;

  function resize() {
    const s = renderer.getDrawingBufferSize(new THREE.Vector2());
    rt.setSize(s.x, s.y);
    mat.uniforms.res.value.copy(s);
    mat.uniforms.cell.value = (opts.cell ?? 6) * renderer.getPixelRatio();
  }
  resize();

  function render(scene: THREE.Scene, camera: THREE.PerspectiveCamera, focus = 12) {
    mat.uniforms.near.value = camera.near;
    mat.uniforms.far.value = camera.far;
    mat.uniforms.focus.value = focus;
    // 1. the background, everything on layer 0, into the HDR texture
    camera.layers.set(0);
    renderer.setRenderTarget(rt);
    renderer.clear();
    renderer.render(scene, camera);
    // 2. the print of it, to the screen
    renderer.setRenderTarget(null);
    renderer.autoClear = true;
    renderer.render(post, postCam);
    // 3. the dolls on top, clean
    renderer.autoClear = false;
    renderer.clearDepth();
    camera.layers.set(DOLL_LAYER);
    renderer.render(scene, camera);
    renderer.autoClear = true;
    camera.layers.set(0);
  }

  return { render, resize, setDof: (on: boolean) => { mat.uniforms.dofOn.value = on ? 1 : 0; } };
}
