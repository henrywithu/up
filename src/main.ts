import './styles/reference.css';
import './styles/local.css';
import { World } from './scene/World';
import { Game, propOrder } from './game/Game';
import { Interface } from './ui/Interface';
import { el } from './ui/dom';
import { Bubbles } from './scene/Bubbles';
import { Inspector } from './ui/Inspector';

const world = new World(el('stage'));
const game = new Game(world);
const bubbles = new Bubbles(world, el('bubbles'));
const inspector = new Inspector(game, world);
world.setFrame(time => bubbles.update(time));
new Interface(game);

let pointerStart: { x: number; y: number } | null = null;
world.renderer.domElement.addEventListener('pointerdown', event => {
  pointerStart = { x: event.clientX, y: event.clientY };
});
world.renderer.domElement.addEventListener('pointerup', event => {
  if (!pointerStart || Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y) > 5) return;
  pointerStart = null;
  const point = world.screenToWorld(event.clientX, event.clientY);
  if (point && game.state.selected) game.place(point.x, point.z);
  else inspector.move(event.clientX, event.clientY);
});
world.renderer.domElement.addEventListener('pointermove', event => {
  const point = world.screenToWorld(event.clientX, event.clientY);
  if (point && game.state.selected) world.setCursorPosition(point.x, point.z);
  inspector.move(event.clientX, event.clientY);
});
world.renderer.domElement.addEventListener('pointerleave', () => inspector.hide());
game.subscribe(state => world.setCursorVisible(!!state.selected));

window.addEventListener('keydown', event => {
  if (event.repeat) return;
  if (event.key === 'Escape') { game.select(null); el('menu').hidden = true; return; }
  if (event.key === 'ArrowUp') { event.preventDefault(); game.changeFee(1); return; }
  if (event.key === 'ArrowDown') { event.preventDefault(); game.changeFee(-1); return; }
  if (event.key === ' ') { event.preventDefault(); el<HTMLButtonElement>('launch').click(); return; }
  const number = Number(event.key);
  if (number >= 1 && number <= propOrder.length) {
    const key = propOrder[number - 1];
    if (game.available(key)) document.querySelector<HTMLButtonElement>(`.rbtn[data-prop="${key}"]`)?.click();
  }
});

if (import.meta.hot) import.meta.hot.dispose(() => { bubbles.dispose(); game.dispose(); world.dispose(); });
