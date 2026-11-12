// The fifth doll, the tiny ube one from inside Bunso, who now and then shoots through the scene
// like Superman: head first, cape out, in and out of the clouds and right round the family.
import * as THREE from 'three';


export function createSuperDoll(scene: THREE.Scene, model: THREE.Object3D) {
  const group = new THREE.Group();
  const body = model.clone(true);
  body.visible = true;
  body.position.set(0, 0, 0);
  body.rotation.set(0, 0, 0);
  body.scale.setScalar(1);
  group.add(body);
  body.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(body);
  const tall = box.max.y - box.min.y;
  body.scale.setScalar(1 / tall);
  body.position.y = -(box.min.y + tall / 2) / tall; // centred, one unit long

  // a little cape, rippled along its length
  const capeGeo = new THREE.PlaneGeometry(0.42, 0.62, 1, 8);
  capeGeo.translate(0, -0.31, 0);
  const rest = (capeGeo.attributes.position as THREE.BufferAttribute).array.slice();
  const cape = new THREE.Mesh(capeGeo, new THREE.MeshBasicMaterial({ color: 0xe4567a, side: THREE.DoubleSide, toneMapped: false }));
  cape.position.set(0, 0.16, -0.27);
  group.add(cape);
  group.visible = false;
  scene.add(group);

  // round the dolls: in from the far left behind the clouds, out to the right, back across in
  // front of the family, up behind them, and away over the far cloud tops
  const route = [
    [-11, 3.1, -4], [-4, 2.5, -4.6], [2, 3.5, -3.6], [6.4, 2.5, -0.6], [4.6, 1.5, 2.8], [1.2, 1.3, 3.4],
    [-2.8, 2.3, 1.2], [-2.6, 3.3, -2.2], [1.5, 2.2, -2.6], [5.5, 3.1, -4.4], [12, 4.2, -6],
  ].map(([x, y, z]) => new THREE.Vector3(x, y, z));
  const path = new THREE.CatmullRomCurve3(route, false, 'centripetal');

  let from = 0, next = 16 + Math.random() * 12;
  let mirror = 1, dur = 14;
  const pos = new THREE.Vector3(), tan = new THREE.Vector3(), toCam = new THREE.Vector3();
  const side = new THREE.Vector3(), front = new THREE.Vector3(), m = new THREE.Matrix4();

  return {
    group,
    launch: (t: number) => { next = t; },
    update(t: number, camera: THREE.PerspectiveCamera, centreX: number, squeeze = 1) {
      if (!group.visible) {
        if (t <= next) return;
        group.visible = true;
        from = t;
        mirror = Math.random() < 0.5 ? 1 : -1;
        dur = 13 + Math.random() * 4;
      }
      const p = (t - from) / dur;
      if (p >= 1) {
        group.visible = false;
        next = t + 60 + Math.random() * 70;
        return;
      }
      path.getPointAt(p, pos);
      path.getTangentAt(Math.min(p + 0.002, 1), tan);
      // squeeze < 1 pulls the loop in for a narrow screen; heights and depths stay as they are
      pos.x = centreX + (pos.x - 1.5) * mirror * squeeze;
      tan.x *= mirror * squeeze;
      group.position.copy(pos);
      // head leads along the path, belly rolled towards us so her face is seen, banking in turns
      toCam.copy(camera.position).sub(pos).normalize();
      front.copy(toCam).addScaledVector(tan, -toCam.dot(tan)).normalize();
      if (front.lengthSq() < 0.01) front.set(0, 0, 1);
      front.applyAxisAngle(tan, Math.sin(p * 21) * 0.5);
      side.crossVectors(tan, front).normalize();
      m.makeBasis(side, tan, front);
      group.quaternion.setFromRotationMatrix(m);
      group.scale.setScalar(0.34);
      const a = capeGeo.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < a.count; i++) {
        const y = rest[i * 3 + 1];
        a.setX(i, rest[i * 3] * (1 - y * 0.9)); // it flares towards the hem
        a.setZ(i, Math.sin(y * 9 + t * 18) * 0.12 * -y - y * y * 0.3);
      }
      a.needsUpdate = true;
    },
  };
}

