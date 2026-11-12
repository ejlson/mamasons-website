// The ube ice cream cloud (media-src/mamasons-doll/ube_cloud.py): a round, fluffy ube scoop with a
// face and two Stik-O wafers, that drifts across the sky now and then. Idle bobs it; Blink,
// HappySquint, Boop and Melt are one-shots laid over the bob. Melt (7 s) starts and ends as a plain
// cloud: its three drips hide inside it until then. Tapping it boops it.
import * as THREE from 'three';
import { loadModel } from './props';

export function createUbeCloud(scene: THREE.Scene) {
  const group = new THREE.Group();
  group.visible = false;
  scene.add(group);
  let mixer: THREE.AnimationMixer | undefined;
  let shot: THREE.AnimationAction | undefined;
  const shots: Record<string, THREE.AnimationAction> = {};
  void loadModel('ube-cloud', 1).then((m) => {
    if (!m) return;
    group.add(m);
    const clips: THREE.AnimationClip[] = m.userData.clips ?? [];
    const mix = (mixer = new THREE.AnimationMixer(m.children[0]));
    const idle = clips.find((c) => c.name === 'Idle');
    if (idle) mix.clipAction(idle).play();
    for (const c of clips) {
      if (c === idle) continue;
      shots[c.name] = mix.clipAction(c).setLoop(THREE.LoopOnce, 1);
    }
    mix.addEventListener('finished', (e) => { if (e.action === shot) shot = undefined; });
  });
  return {
    group,
    /** a one-shot over the bob; a clip the model doesn't have yet is skipped */
    play(name: string) {
      const a = shots[name];
      if (!a) return false;
      shot?.fadeOut(0.15);
      shot = a.reset().setEffectiveWeight(1).fadeIn(0.1).play();
      return true;
    },
    update(dt: number) {
      if (group.visible) mixer?.update(dt);
    },
  };
}
