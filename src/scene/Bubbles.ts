import * as THREE from 'three';
import { World } from './World';

const chat = ['hm','oh!','yeah','really?','exactly','mm-hmm','no way','haha','so then—','wait, what?','i know','right?','sure','and then','oh totally','hm…','huh','yep','listen—','ok ok'];
const awake = ['what?','look UP','it is him','all of you','together','come on'];
const shout = ['HOW much?','this is mad','robbery','no way','that is theft','enough!'];

interface Bubble { node: HTMLDivElement; citizen: number; until: number }

export class Bubbles {
  private readonly world: World;
  private readonly holder: HTMLElement;
  private items: Bubble[] = [];
  private next = 0;
  constructor(world: World, holder: HTMLElement) { this.world = world; this.holder = holder; }

  update(time: number) {
    this.items = this.items.filter(item => {
      if (time < item.until) return true;
      item.node.remove(); return false;
    });
    if (time > this.next && this.items.length < 6) {
      this.next = time + 0.8 + Math.random() * 1.4;
      const candidates = this.world.citizens.map((person, index) => ({ person, index }))
        .filter(({ person }) => person.state === 'talking' || person.state === 'awake' || person.state === 'arguing');
      const citizen = candidates.length ? candidates[Math.floor(Math.random() * candidates.length)].index
        : Math.floor(Math.random() * this.world.citizens.length);
      const person = this.world.citizens[citizen];
      const isShout = person.state === 'arguing';
      const pool = isShout ? shout : person.state === 'awake' ? awake : chat;
      const node = document.createElement('div');
      node.className = `bubble${isShout ? ' is-shout' : ''}`;
      node.textContent = pool[Math.floor(Math.random() * pool.length)];
      node.innerHTML += '<svg class="btail" viewBox="-3 -5 18 14" aria-hidden="true"><path class="btail-fill" d="M0 -5H12V-1.25L6 6 0 -1.25Z"/><path class="btail-line" d="M0 -1.25 6 6 12 -1.25"/></svg>';
      this.holder.appendChild(node);
      this.items.push({ node, citizen, until: time + 1.7 + Math.random() * 1.3 });
      requestAnimationFrame(() => node.classList.add('is-visible'));
    }
    const width = this.holder.clientWidth, height = this.holder.clientHeight;
    for (const item of this.items) {
      const person = this.world.citizens[item.citizen];
      const point = new THREE.Vector3(person.x, 2.1, person.z).project(this.world.camera);
      const x = (point.x * .5 + .5) * width;
      const y = (-point.y * .5 + .5) * height;
      item.node.style.left = `${x}px`;
      item.node.style.top = `${y}px`;
      item.node.style.display = point.z > 1 || x < 25 || x > width - 25 || y < 30 || y > height - 30 ? 'none' : '';
    }
  }
  dispose() { this.items.forEach(item => item.node.remove()); this.items = []; }
}
