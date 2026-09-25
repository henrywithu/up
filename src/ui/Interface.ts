import { Game, money } from '../game/Game';
import { TutorialUI } from './Tutorial';
import { DockUI } from './Dock';
import { el, text, visible } from './dom';

export class Interface {
  private readonly game: Game;
  private readonly tutorial: TutorialUI;
  private readonly dock: DockUI;
  private tutorialFromTitle = false;
  private ended = false;
  constructor(game: Game) {
    this.game = game;
    this.tutorial = new TutorialUI(() => {
      if (this.tutorialFromTitle) this.begin();
      else game.resume();
    });
    this.dock = new DockUI(game);
    document.body.classList.add('is-title');
    const askConsent = !localStorage.getItem('up-consent');
    visible('consent', askConsent);
    el('consent').classList.toggle('is-on', askConsent);
    document.body.classList.toggle('is-asking', askConsent);
    el('consent-yes').addEventListener('click', () => this.consent(true));
    el('consent-no').addEventListener('click', () => this.consent(false));
    el('intro-start').addEventListener('click', () => {
      if (localStorage.getItem('up-seen') === '1') this.begin();
      else { this.tutorialFromTitle = true; visible('intro', false); document.body.classList.remove('is-title'); this.tutorial.open(); }
    });
    el('intro-how').addEventListener('click', () => { this.tutorialFromTitle = true; visible('intro', false); document.body.classList.remove('is-title'); this.tutorial.open(); });
    el('help').addEventListener('click', () => {
      if (game.state.phase === 'tutorial') this.tutorial.close();
      else if (game.state.phase === 'playing') { this.tutorialFromTitle = false; game.tutorial(); this.tutorial.open(true); }
    });
    el('over-again').addEventListener('click', () => this.begin());
    el('polaroid-share').addEventListener('click', async () => {
      const content = `I reached ${money(game.state.money)} in Don't Look Up. ${location.href}`;
      if (navigator.share) await navigator.share({ title: "Don't Look Up", text: content, url: location.href });
      else await navigator.clipboard.writeText(content);
    });
    game.subscribe(state => this.render(state));
    el('loader').classList.add('is-done');
    setTimeout(() => el('loader').remove(), 1000);
  }
  private consent(yes: boolean) {
    localStorage.setItem('up-consent', yes ? 'yes' : 'no');
    el('consent').classList.remove('is-on');
    document.body.classList.remove('is-asking');
    visible('consent', false);
  }
  private async begin() {
    this.ended = false;
    localStorage.setItem('up-seen', '1');
    visible('intro', false);
    visible('steps', false);
    document.body.classList.remove('is-title', 'is-teaching');
    el('over').classList.remove('is-on', 'lost');
    visible('polaroid-wrap', false);
    await this.game.start();
  }
  private render(s: Game['state']) {
    text('money', money(s.money));
    text('rate', s.phase === 'title' ? '—' : `${money(s.rate)} PER SECOND`);
    const minutes = Math.floor(s.elapsed / 60);
    text('time', `${minutes}:${Math.floor(s.elapsed % 60).toString().padStart(2, '0')}`);
    el('bar').querySelector('i')!.setAttribute('style', `width:${Math.min(100, s.money / 1e12 * 100)}%`);
    text('hud-awake', `${s.feet}`);
    el('m-up').style.width = `${Math.min(100, s.feet / Math.max(10, s.awake) * 100)}%`;
    const legendCounts = el('bar-legend').querySelectorAll('.lct');
    if (legendCounts[0]) legendCounts[0].textContent = `${Math.max(0, s.awake - s.recruiting)}`;
    if (legendCounts[1]) legendCounts[1].textContent = `${s.recruiting}`;
    el('alarmtext').textContent = s.feet > 16 ? 'they are pulling him down' : s.feet > 8 ? 'they are gathering at your feet' : 'they are organising';
    el('alarm').classList.toggle('is-on', s.feet >= 12);
    el('help').setAttribute('aria-label', s.phase === 'tutorial' ? 'Close' : 'Pause and read the tutorial');
    if (s.phase === 'won' || s.phase === 'lost' || s.phase === 'timeout') this.end(s.phase);
  }
  private end(reason: 'won' | 'lost' | 'timeout') {
    if (this.ended) return;
    this.ended = true;
    if (reason === 'lost') {
      setTimeout(() => { if (this.game.state.phase === reason) this.presentEnd(reason); }, 1800);
    } else if (reason === 'won') {
      this.game.audio.finalWin();
      setTimeout(() => { if (this.game.state.phase === reason) this.presentEnd(reason); }, 8300);
    } else this.presentEnd(reason);
  }
  private presentEnd(reason: 'won' | 'lost' | 'timeout') {
    const won = reason === 'won';
    const over = el('over');
    over.classList.add('is-on');
    over.classList.toggle('lost', !won);
    const art = el<HTMLImageElement>('over-art');
    art.src = won ? '/assets/brand/a_trillion_win.png' : reason === 'timeout' ? '/assets/brand/out_of_time.png' : '/assets/brand/lose_title.png';
    art.hidden = false;
    text('over-line', won ? 'They never worked out where it went.' : reason === 'timeout'
      ? 'A perfectly good arrangement, wound up before it matured.'
      : 'They were always angry. Today they were angry at the same thing, at the same time.');
    text('over-sum', `${money(this.game.state.money)} ${won ? 'collected' : reason === 'timeout' ? 'collected, and no more' : 'collected, then dropped'}`);
    visible('polaroid-share', won);
    if (won) {
      const snapshot = this.game.world.renderer.domElement.toDataURL('image/png');
      el<HTMLImageElement>('polaroid-img').src = snapshot;
      setTimeout(() => { if (this.ended) visible('polaroid-wrap', true); }, 5000);
    }
  }
}
