import * as THREE from 'three';
import { outlineGeometry, paperMaterial } from './materials';

const ink = 0x14140f;
const paper = 0xf4f3ef;
const outlineMaterial = new THREE.MeshBasicMaterial({ color: ink, side: THREE.BackSide });
const bodyMaterial = paperMaterial();
const darkMaterial = new THREE.MeshBasicMaterial({ color: ink });

function outlined(geometry: THREE.BufferGeometry, material = bodyMaterial, thickness = 0.05) {
  const group = new THREE.Group();
  const fill = new THREE.Mesh(geometry, material);
  fill.castShadow = true;
  const edge = new THREE.Mesh(outlineGeometry(geometry, thickness), outlineMaterial);
  group.add(fill, edge);
  return group;
}

function limb(radius: number, length: number) {
  const shape = new THREE.Group();
  const tube = outlined(new THREE.CylinderGeometry(radius, radius * 1.05, length, 10), bodyMaterial, 0.12);
  tube.position.y = -length / 2 - radius;
  shape.add(tube);
  const end = outlined(new THREE.SphereGeometry(radius * 1.15, 10, 8), bodyMaterial, 0.1);
  end.position.y = -length - radius;
  end.scale.set(1.2, 0.7, 1.5);
  shape.add(end);
  return shape;
}

export type CitizenState = 'living' | 'talking' | 'awake' | 'arguing' | 'believing' | 'watching';

export class Puppet {
  readonly group = new THREE.Group();
  readonly head = new THREE.Group();
  private readonly leftArm = limb(0.07, 0.30);
  private readonly rightArm = limb(0.07, 0.30);
  private readonly leftLeg = limb(0.085, 0.34);
  private readonly rightLeg = limb(0.085, 0.34);
  private readonly fill: THREE.MeshToonMaterial;
  readonly speed: number;
  readonly phase: number;
  readonly kind: 'hat' | 'shirt' | 'plain';
  state: CitizenState = 'living';
  x: number;
  z: number;
  targetX: number;
  targetZ: number;

  constructor(x: number, z: number, kind: 'hat' | 'shirt' | 'plain', scale: number, phase: number) {
    this.x = x;
    this.z = z;
    this.targetX = x;
    this.targetZ = z;
    this.kind = kind;
    this.phase = phase;
    this.speed = 1.05 + ((phase * 0.618) % 1) * 0.6;
    this.fill = bodyMaterial.clone();
    const body = new THREE.LatheGeometry([
      [0, 0.44], [0.15, 0.48], [0.235, 0.58], [0.283, 0.73],
      [0.295, 0.9], [0.276, 1.06], [0.229, 1.19], [0.15, 1.28], [0, 1.32],
    ].map(([r, y]) => new THREE.Vector2(r, y)), 22);
    this.group.add(outlined(body, this.fill, 0.045));
    const headMesh = outlined(new THREE.SphereGeometry(0.235, 20, 16), this.fill, 0.055);
    this.head.add(headMesh);
    this.head.position.y = 1.44;
    this.group.add(this.head);

    const face = new THREE.Group();
    for (const sx of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.014, 8, 8), darkMaterial);
      eye.position.set(sx * 0.075, 0.025, 0.224);
      face.add(eye);
    }
    const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.007, 5, 16, Math.PI), darkMaterial);
    mouth.position.set(0, -0.066, 0.229);
    mouth.rotation.z = Math.PI;
    face.add(mouth);
    this.head.add(face);

    this.leftArm.position.set(0.243, 1.12, 0);
    this.rightArm.position.set(-0.243, 1.12, 0);
    this.leftLeg.position.set(0.105, 0.58, 0);
    this.rightLeg.position.set(-0.105, 0.58, 0);
    this.group.add(this.leftArm, this.rightArm, this.leftLeg, this.rightLeg);
    if (kind === 'hat') {
      const hat = new THREE.Mesh(new THREE.SphereGeometry(0.21, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.5), darkMaterial);
      hat.position.y = 1.55;
      hat.scale.set(1.15, 0.8, 1.2);
      this.group.add(hat);
      const brim = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.02, 0.11), darkMaterial);
      brim.position.set(0, 1.56, 0.20);
      this.group.add(brim);
    } else if (kind === 'shirt') {
      const shirt = new THREE.Mesh(new THREE.LatheGeometry([
        [0.298, 0.88], [0.28, 1.06], [0.233, 1.19], [0.153, 1.28], [0, 1.325],
      ].map(([r, y]) => new THREE.Vector2(r, y)), 22), darkMaterial);
      this.group.add(shirt);
    }
    this.group.scale.setScalar(scale);
    this.group.position.set(x, 0, z);
  }

  setState(state: CitizenState) {
    this.state = state;
    const tint = state === 'awake' ? 0xf8e08a : state === 'believing' ? 0x9abeef : state === 'arguing' ? 0xf0b3aa : 0xf4f3ef;
    this.fill.color.setHex(tint);
  }

  update(dt: number, time: number) {
    const dx = this.targetX - this.x;
    const dz = this.targetZ - this.z;
    const distance = Math.hypot(dx, dz);
    const moving = distance > 0.18;
    if (moving) {
      const step = Math.min(distance, this.speed * dt);
      this.x += dx / distance * step;
      this.z += dz / distance * step;
      this.group.rotation.y = Math.atan2(dx, dz);
    }
    this.group.position.set(this.x, moving ? Math.abs(Math.sin(time * 6 + this.phase)) * 0.035 : 0, this.z);
    const swing = moving ? Math.sin(time * 6 + this.phase) * 0.28 : Math.sin(time * 1.6 + this.phase) * 0.035;
    this.leftArm.rotation.x = swing;
    this.rightArm.rotation.x = -swing;
    this.leftLeg.rotation.x = -swing;
    this.rightLeg.rotation.x = swing;
    this.head.rotation.x = this.state === 'awake' ? -0.4 : 0.05;
  }

  dispose() { this.fill.dispose(); }
}
