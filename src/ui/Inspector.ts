import * as THREE from 'three';
import { Game } from '../game/Game';
import { World } from '../scene/World';
import { el, text, visible } from './dom';

export class Inspector {
  private readonly game: Game;
  private readonly world: World;
  private readonly cameraPoint = new THREE.Vector3();
  constructor(game: Game, world: World) { this.game = game; this.world = world; }

  move(x: number, y: number) {
    if (this.game.state.phase !== 'playing' || this.game.state.selected) { this.hide(); return; }
    const width = innerWidth, height = innerHeight;
    let nearest: { kind: 'prop' | 'crowd'; distance: number; index: number } | null = null;
    for (const [index, prop] of this.world.drops.entries()) {
      this.cameraPoint.set(prop.x, 1, prop.z).project(this.world.camera);
      if (this.cameraPoint.z >= 1) continue;
      const px = (this.cameraPoint.x * .5 + .5) * width;
      const py = (-this.cameraPoint.y * .5 + .5) * height;
      const distance = Math.hypot(px - x, py - y);
      if (distance < 54 && (!nearest || distance < nearest.distance)) nearest = { kind: 'prop', distance, index };
    }
    if (!nearest) {
      for (const [index, person] of this.world.citizens.entries()) {
        if (person.state !== 'awake') continue;
        this.cameraPoint.set(person.x, 1, person.z).project(this.world.camera);
        if (this.cameraPoint.z >= 1) continue;
        const px = (this.cameraPoint.x * .5 + .5) * width;
        const py = (-this.cameraPoint.y * .5 + .5) * height;
        const distance = Math.hypot(px - x, py - y);
        if (distance < 96 && (!nearest || distance < nearest.distance)) nearest = { kind: 'crowd', distance, index };
      }
    }
    if (!nearest) { this.hide(); return; }
    if (nearest.kind === 'crowd') {
      const person = this.world.citizens[nearest.index];
      const group = this.world.citizens.filter(c => c.state === 'awake' && Math.hypot(c.x - person.x, c.z - person.z) < 4);
      const recruiting = group.filter(c => Math.hypot(c.x, c.z + 26) < 15).length;
      el<HTMLImageElement>('card-art').src = '/assets/steps/up.jpg';
      visible('card-art', true);
      text('card-kicker', 'the crowd here');
      text('card-title', `${group.length} looking up`);
      text('card-line', 'Put something in front of them before the rest join in.');
      visible('card-note', false);
      visible('card-legend', true);
      const counts = el('card-legend').querySelectorAll('.lct');
      counts[0].textContent = `${group.length - recruiting}`;
      counts[1].textContent = `${recruiting}`;
      el('card-meter').classList.add('is-staged');
      el('cs-up').style.width = `${(group.length - recruiting) / group.length * 100}%`;
      el('cs-recruit').style.width = `${recruiting / group.length * 100}%`;
      visible('card-meter', true);
    } else {
      const drop = this.world.drops[nearest.index];
      const prop = (awaitProp as Record<string, { art: string; mode: string; life: number; pull?: number; capacity?: number }>)[drop.kind];
      if (!prop) { this.hide(); return; }
      el<HTMLImageElement>('card-art').src = prop.art;
      visible('card-art', true);
      const listening = this.world.citizens.filter(c => {
        const radius = prop.pull ?? 5;
        return Math.hypot(c.x - drop.x, c.z - drop.z) < radius && c.state === (prop.mode === 'blame' ? 'arguing' : prop.mode === 'influence' ? 'believing' : 'watching');
      }).length;
      text('card-kicker', prop.mode === 'blame' ? 'somebody is to blame' : prop.mode === 'influence' ? 'somebody to follow' : prop.mode === 'dance' ? 'everybody is doing this' : 'a distraction');
      text('card-title', drop.title ?? drop.kind.replace(/^[a-z]/, c => c.toUpperCase()));
      text('card-line', drop.line ?? 'Keep them looking down.');
      text('card-note', `${Math.ceil(drop.life)}s left · ${listening} ${prop.mode === 'influence' ? 'converted' : prop.mode === 'blame' ? 'at each other' : 'watching'}`);
      visible('card-note', true);
      visible('card-legend', false);
      el('card-meter').classList.remove('is-staged');
      el('card-fill').style.width = `${drop.life / prop.life * 100}%`;
      visible('card-meter', true);
    }
    el('card').classList.add('is-on');
    document.body.classList.add('has-card');
  }
  hide() { el('card').classList.remove('is-on'); document.body.classList.remove('has-card'); }
}

// Small source-data projection for the inspect card, kept away from renderer code.
import { CONFIG } from '../data/config';
const awaitProp = CONFIG.props.kinds;
