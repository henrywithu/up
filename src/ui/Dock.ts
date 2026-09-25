import { CONFIG } from '../data/config';
import { Game, money, propNames, propOrder, type PropKey } from '../game/Game';
import { el, text, visible } from './dom';

const blurbs: Record<PropKey, string> = {
  ball: 'Keep your eye on the ball, not on the fees.',
  cat: 'Aww… what fee?',
  tv: 'Keep watching. Keep paying.',
  dance: "Everybody's dancing. Nobody's counting the fee.",
  news: 'Point the crowd sideways, not upward.',
  coach: "The fee isn't high. Your income is low.",
  priest: 'Pay now. Paradise later.',
  trainer: 'They are not the problem. Each other is.',
};

export class DockUI {
  private readonly game: Game;
  private hovered: PropKey | null = null;
  constructor(game: Game) {
    this.game = game;
    const rail = el('rail');
    for (const [index, key] of propOrder.entries()) {
      const prop = CONFIG.props.kinds[key];
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'rbtn';
      button.dataset.prop = key;
      button.title = propNames[key];
      button.innerHTML = `<img class="ricon" src="${prop.icon}" alt=""><span class="rkey">${index + 1}</span><span class="rcost"></span>`;
      button.addEventListener('click', () => this.select(key));
      button.addEventListener('pointerenter', () => { this.game.audio.ui('hover'); this.hovered = key; this.card(key); });
      button.addEventListener('pointerleave', () => { if (this.hovered === key) { this.hovered = null; this.card(this.game.state.selected as PropKey | null); } });
      rail.appendChild(button);
    }
    rail.hidden = false;
    el('inspect').addEventListener('click', () => this.select(null));
    el('launch').addEventListener('click', () => this.toggleMenu());
    el('rc-place').addEventListener('click', () => {
      const key = this.hovered ?? this.game.state.selected as PropKey | null;
      if (key) this.select(key);
    });
    el('btn-up').addEventListener('click', () => game.changeFee(1));
    el('btn-down').addEventListener('click', () => game.changeFee(-1));
    game.subscribe(() => this.render());
  }
  select(key: PropKey | null) {
    this.game.audio.ui('click');
    this.game.select(key);
    this.card(key);
    visible('tapaway', !!key && matchMedia('(pointer: coarse)').matches);
    if (key) {
      el<HTMLImageElement>('tapaway-icon').src = CONFIG.props.kinds[key].icon;
      text('tapaway-text', 'Tap anywhere to place it');
    }
  }
  private toggleMenu() {
    const menu = el('menu');
    menu.hidden = !menu.hidden;
    if (menu.hidden) return;
    menu.innerHTML = '';
    for (const key of propOrder) {
      if (!this.game.available(key)) continue;
      const button = document.createElement('button');
      button.textContent = `${propNames[key]}  ${money(this.game.cost(key))}`;
      button.addEventListener('click', () => { this.select(key); menu.hidden = true; });
      menu.appendChild(button);
    }
  }
  private card(key: PropKey | null) {
    const card = el('railcard');
    if (!key) { card.hidden = true; return; }
    const prop = CONFIG.props.kinds[key];
    el<HTMLImageElement>('rc-art').src = prop.art;
    text('rc-name', propNames[key]);
    text('rc-effect', prop.mode === 'influence' ? 'Strong effect' : prop.mode === 'blame' ? 'Medium effect' : 'Fast effect');
    text('rc-blurb', blurbs[key]);
    const bits: string[] = prop.mode === 'influence'
      ? [`${Math.round('shelterRadius' in prop ? prop.shelterRadius : 0)}m`, `${Math.round(prop.life)}s`,
          'angers' in prop ? 'move away' : 'belief' in prop && prop.belief === 'priest' ? 'fully healed' : '+35% tolerance']
      : [`${prop.capacity} people`, `${Math.round(prop.life)}s`,
          ...('disperse' in prop && prop.disperse >= 8 ? ['moves them away'] : []),
          ...('spread' in prop && prop.spread ? ['spreads'] : [])];
    text('rc-tag', bits.join(' · '));
    text('rc-cost', money(this.game.cost(key)));
    card.hidden = false;
    const button = document.querySelector<HTMLButtonElement>(`.rbtn[data-prop="${key}"]`);
    if (button) {
      const rect = button.getBoundingClientRect();
      const bounds = card.getBoundingClientRect();
      card.style.right = 'auto'; card.style.bottom = 'auto';
      if (matchMedia('(pointer: coarse)').matches) {
        card.style.left = `${Math.max(10, rect.left - bounds.width - 12)}px`;
        card.style.top = `${Math.min(innerHeight - bounds.height - 12, Math.max(12, rect.top + rect.height / 2 - bounds.height / 2))}px`;
      } else {
        card.style.left = `${Math.min(innerWidth - bounds.width - 12, Math.max(12, rect.left + rect.width / 2 - bounds.width / 2))}px`;
        card.style.top = `${Math.max(12, rect.top - bounds.height - 14)}px`;
      }
    }
  }
  private render() {
    const s = this.game.state;
    text('fee', `${Math.round(s.fee * 100)}%`);
    text('fee-note', `they would carry ${Math.round(s.ceiling * 100)}%`);
    el('fee-fill').style.width = `${s.fee * 100}%`;
    el('fee-need').style.left = `${s.ceiling * 100}%`;
    el<HTMLButtonElement>('btn-down').disabled = s.fee <= 0.05 || s.phase !== 'playing';
    el<HTMLButtonElement>('btn-up').disabled = s.fee >= 1 || s.phase !== 'playing';
    const unlocked = propOrder.filter(key => this.game.available(key));
    document.documentElement.style.setProperty('--rail-n', `${unlocked.length}`);
    for (const key of propOrder) {
      const button = document.querySelector<HTMLButtonElement>(`.rbtn[data-prop="${key}"]`)!;
      button.style.display = this.game.available(key) ? '' : 'none';
      button.disabled = s.phase !== 'playing' || s.money < this.game.cost(key);
      button.classList.toggle('is-on', s.selected === key);
      button.querySelector<HTMLElement>('.rcost')!.textContent = `-${money(this.game.cost(key))}`;
    }
    el('inspect').classList.toggle('is-on', !s.selected);
    if (this.hovered) this.card(this.hovered);
    else if (s.selected) this.card(s.selected as PropKey);
    else el('railcard').hidden = true;
    const feeTip = el('feetip');
    feeTip.querySelector('.tt')!.innerHTML = '<b>RAISE THE FEE</b><br>Use +. This crowd will carry about 30%. Anything you are not charging is money left on the table.';
    feeTip.classList.toggle('is-on', s.phase === 'playing' && s.fee < s.ceiling && s.elapsed < 12 && !s.paused);
    const dropTip = el('droptip');
    dropTip.querySelector('.tt')!.innerHTML = '<b>PLANT DISTRACTIONS</b><br>Fast ones buy a moment, blame walks them off your feet, influencers stay and keep working.';
    dropTip.classList.toggle('is-on', s.phase === 'playing' && s.drops === 0 && s.elapsed > 2 && !s.paused && !s.selected);
  }
}
