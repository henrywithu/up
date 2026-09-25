import { CONFIG } from '../data/config';
import { World } from '../scene/World';
import { GameAudio } from './Audio';

export type Phase = 'title' | 'tutorial' | 'playing' | 'won' | 'lost' | 'timeout';
export interface GameState {
  phase: Phase; money: number; rate: number; elapsed: number; fee: number;
  ceiling: number; stage: number; drops: number; selected: string | null;
  awake: number; recruiting: number; feet: number; paused: boolean;
}
export const propOrder = ['ball', 'cat', 'tv', 'dance', 'news', 'coach', 'priest', 'trainer'] as const;
export type PropKey = typeof propOrder[number];
export const propNames: Record<PropKey, string> = {
  ball: 'Big match', cat: 'Cute cat', tv: 'Binge TV', dance: 'Viral dance',
  news: 'Post a fake news', coach: 'Finance guru', priest: 'Have faith', trainer: 'The politician',
};
type Listener = (state: GameState) => void;

export class Game {
  readonly audio = new GameAudio();
  readonly world: World;
  state: GameState = { phase: 'title', money: 0, rate: 0, elapsed: 0, fee: 0.05,
    ceiling: 0.3, stage: 0, drops: 0, selected: null, awake: 2, recruiting: 0, feet: 0, paused: false };
  private listeners = new Set<Listener>();
  private noticeClock = 0;
  private publishClock = 0;
  private angerClock = 0;

  constructor(world: World) {
    this.world = world;
    world.setTick(dt => this.tick(dt));
  }

  subscribe(listener: Listener) { this.listeners.add(listener); listener(this.state); return () => this.listeners.delete(listener); }
  emit() { for (const listener of this.listeners) listener(this.state); }

  async start() {
    this.world.reset();
    this.state = { phase: 'playing', money: 792e6, rate: 0, elapsed: 0, fee: 0.05,
      ceiling: 0.3, stage: 0, drops: 0, selected: null, awake: 2, recruiting: 0, feet: 0, paused: false };
    this.noticeClock = this.publishClock = this.angerClock = 0;
    this.world.setActive(true);
    this.world.setPaused(false);
    this.emit();
    await this.audio.unlock();
    this.audio.begin();
  }

  tutorial() { this.state.phase = 'tutorial'; this.state.paused = true; this.world.setPaused(true); this.emit(); }
  resume() { this.state.phase = 'playing'; this.state.paused = false; this.world.setPaused(false); this.emit(); }
  select(kind: PropKey | null) { this.state.selected = kind; this.emit(); }
  changeFee(direction: number) {
    if (this.state.phase !== 'playing' || this.state.paused) return;
    this.state.fee = Math.max(0.05, Math.min(1, this.state.fee + direction * 0.05));
    this.audio.ui('click');
    if (direction > 0) {
      let noticed = 0;
      for (const citizen of this.world.citizens) {
        if (citizen.state !== 'awake' && citizen.state !== 'believing' && Math.random() < CONFIG.economy.noticeGain * 0.05) {
          citizen.setState('awake'); noticed++;
        }
      }
      this.state.awake += noticed;
    }
    this.emit();
  }
  cost(kind: PropKey) {
    const prop = CONFIG.props.kinds[kind];
    const economy = CONFIG.economy;
    const progress = Math.min(1, Math.max(0, this.state.elapsed / economy.costRampOver));
    const smooth = progress * progress * (3 - 2 * progress);
    const scale = prop.mode === 'influence' ? economy.costScale
      : economy.costScaleFrom + (economy.costScale - economy.costScaleFrom) * smooth;
    const towerIndex = Math.max(0.1, 1 - economy.towerIndex + economy.towerIndex * this.state.fee / economy.towerIndexAt);
    const towerPrice = towerIndex * (1 + economy.towerEscalate * Math.max(0, this.state.drops - 1));
    return prop.costSeconds * this.world.citizens.length * economy.perCitizen * scale
      * (prop.mode === 'influence' ? towerPrice : 1);
  }
  available(kind: PropKey) { return CONFIG.props.kinds[kind].unlockAt <= this.state.stage; }

  place(x: number, z: number) {
    const kind = this.state.selected as PropKey | null;
    if (!kind || !this.available(kind) || this.state.phase !== 'playing') return false;
    const cost = this.cost(kind);
    if (this.state.money < cost) return false;
    this.state.money -= cost;
    const prop = CONFIG.props.kinds[kind];
    this.world.addDrop(kind, x, z, prop.life, prop.capacity);
    const changed = this.world.affectNearest(x, z, prop.pull, prop.capacity,
      prop.mode === 'influence' ? 'believing' : prop.mode === 'blame' ? 'arguing' : 'watching');
    this.state.awake = Math.max(0, this.state.awake - changed);
    this.state.drops++;
    this.state.stage = Math.min(3, Math.max(this.state.stage, Math.floor(this.state.drops / 2)));
    this.state.selected = null;
    this.audio.drop(kind);
    this.emit();
    return true;
  }

  private tick(dt: number) {
    const s = this.state;
    if (s.phase !== 'playing' || s.paused) return;
    s.elapsed += dt;
    this.noticeClock += dt;
    this.publishClock += dt;
    this.angerClock += dt;
    const crowd = this.world.snapshot();
    s.awake = crowd.awake;
    s.recruiting = crowd.recruiting;
    s.feet = this.world.citizens.filter(c => c.state === 'awake' && Math.hypot(c.x, c.z + 26) < 8).length;
    const pays = CONFIG.economy.pays;
    const weight = this.world.citizens.reduce((sum, citizen) => sum + pays[citizen.state], 0);
    s.rate = s.fee * weight * CONFIG.economy.perCitizen;
    s.money += s.rate * dt;
    if (this.noticeClock > Math.max(1.8, 4.8 - s.elapsed / 100)) {
      this.noticeClock = 0;
      const candidates = this.world.citizens.filter(c => c.state === 'living' || c.state === 'talking');
      if (candidates.length) candidates[Math.floor(Math.random() * candidates.length)].setState('awake');
    }
    if (s.fee > s.ceiling && this.angerClock > 1.4) {
      this.angerClock = 0;
      const candidates = this.world.citizens.filter(c => c.state === 'living' || c.state === 'talking');
      if (candidates.length) candidates[Math.floor(Math.random() * candidates.length)].setState('awake');
    }
    if (this.publishClock > 0.15) { this.publishClock = 0; this.emit(); }
    this.audio.setPanic(s.feet >= 12);
    if (s.money >= CONFIG.economy.target) this.end('won');
    else if (s.feet >= Math.max(10, crowd.total * CONFIG.uprising.share)) this.end('lost');
    else if (s.elapsed >= CONFIG.economy.timeLimit) this.end('timeout');
  }

  private end(reason: 'won' | 'lost' | 'timeout') {
    this.state.phase = reason;
    this.world.setPaused(true);
    if (reason === 'lost') this.world.topple();
    this.audio.end(reason === 'won');
    this.emit();
  }
  dispose() { this.audio.dispose(); }
}

export function money(value: number) {
  const abs = Math.abs(value);
  if (abs >= 1e12) return '$' + (value / 1e12).toFixed(value / 1e12 < 10 ? 2 : 1) + 'T';
  if (abs >= 1e9) return '$' + (value / 1e9).toFixed(value / 1e9 < 10 ? 2 : 1) + 'B';
  if (abs >= 1e6) return '$' + (value / 1e6).toFixed(1) + 'M';
  return '$' + Math.round(value).toLocaleString();
}
