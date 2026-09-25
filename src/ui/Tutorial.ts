import { tutorialSteps } from '../data/tutorial';
import { CONFIG } from '../data/config';
import { el, text, visible } from './dom';
import { type PropKey, propNames } from '../game/Game';

export class TutorialUI {
  private step = 0;
  private resume = false;
  private readonly onDone: () => void;
  constructor(onDone: () => void) {
    this.onDone = onDone;
    el('step-next').addEventListener('click', () => this.next());
    el('step-skip').addEventListener('click', () => this.close());
  }
  open(resume = false) {
    this.resume = resume;
    this.step = 0;
    visible('steps', true);
    document.body.classList.add('is-teaching');
    this.render();
  }
  private render() {
    const step = tutorialSteps[this.step];
    const card = el('step-card');
    card.classList.remove('is-in');
    const img = el<HTMLImageElement>('step-art');
    img.src = step.art;
    img.hidden = 'key' in step;
    visible('step-key', 'key' in step);
    el('step-visual').classList.toggle('is-key', 'key' in step);
    visible('step-fee', 'fee' in step);
    el('step-extras').classList.toggle('has-extras', 'fee' in step || 'icons' in step);
    const icons = el('step-icons');
    icons.innerHTML = '';
    if ('icons' in step) {
      for (const [index, key] of step.icons.entries()) {
        const item = document.createElement('div');
        item.className = `sicon ${key === 'coach' || key === 'priest' ? 'is-follow' : key === 'trainer' || key === 'news' ? 'is-divide' : ''}`;
        const prop = CONFIG.props.kinds[key as PropKey];
        const keyNumber = ['ball','cat','tv','dance','news','coach','priest','trainer'].indexOf(key) + 1;
        item.innerHTML = `<img src="${prop.icon}" alt="${propNames[key as PropKey]}"><b>${keyNumber || index + 1}</b>`;
        icons.appendChild(item);
      }
    }
    visible('step-icons', 'icons' in step);
    text('step-num', `${this.step + 1} of ${tutorialSteps.length}`);
    text('step-title', step.title);
    text('step-line', step.line);
    text('step-skip', this.resume ? 'Back to the game' : 'Skip');
    text('step-next', this.step === tutorialSteps.length - 1 ? 'Play now' : 'Next');
    visible('step-skip', this.step < tutorialSteps.length - 1);
    requestAnimationFrame(() => card.classList.add('is-in'));
  }
  next() {
    if (this.step < tutorialSteps.length - 1) { this.step++; this.render(); }
    else this.close();
  }
  close() {
    visible('steps', false);
    document.body.classList.remove('is-teaching');
    this.onDone();
  }
}
