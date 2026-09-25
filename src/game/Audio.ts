import { CONFIG } from '../data/config';

const files = {
  ambience: 'ambient_sound', tv: 'TV', ball: 'football', cat: 'cat',
  dance: 'viral_dance', coach: 'finance_guru', priest: 'priest', priest2: 'church_sound2',
  trainer: 'politician_new', blameIntro: 'hat_shirt_sound_intro',
  blameCrowd: 'hat_shirt_crowd_sound', panic: 'panic_music', lose: 'youlose',
  cheer: 'crowd_celebration', winMusic: 'win_music', winFinal: 'win_final_sound',
  timeout: 'outoftime',
} as const;
type Sound = keyof typeof files;

export class GameAudio {
  private context: AudioContext | null = null;
  private buffers = new Map<Sound, AudioBuffer>();
  private master: GainNode | null = null;
  private ambience: { source: AudioBufferSourceNode; gain: GainNode } | null = null;
  private panic: { source: AudioBufferSourceNode; gain: GainNode } | null = null;
  private lastUI = 0;
  private playing = new Map<Sound, { source: AudioBufferSourceNode; gain: GainNode }>();
  private lastNotice = 0;
  private noticeTired = 0;
  private lastCountdown: number | null = null;
  private lastApproach: number | null = null;

  async unlock() {
    if (!this.context) {
      this.context = new AudioContext();
      this.master = this.context.createGain();
      this.master.gain.value = CONFIG.audio.master;
      this.master.connect(this.context.destination);
      await Promise.all(Object.entries(files).map(async ([key, name]) => {
        try {
          const data = await fetch(`/assets/audio/${name}.aac`).then(r => r.arrayBuffer());
          this.buffers.set(key as Sound, await this.context!.decodeAudioData(data));
        } catch { /* A missing optional sound does not stop the game. */ }
      }));
    }
    await this.context.resume();
  }

  play(sound: Sound, volume = 1, loop = false, when = 0) {
    if (!this.context || !this.master) return null;
    const buffer = this.buffers.get(sound);
    if (!buffer) return null;
    const source = this.context.createBufferSource();
    const gain = this.context.createGain();
    source.buffer = buffer;
    source.loop = loop;
    gain.gain.value = volume;
    source.connect(gain).connect(this.master);
    source.start(this.context.currentTime + when);
    const handle = { source, gain };
    this.playing.set(sound, handle);
    source.onended = () => { if (this.playing.get(sound) === handle) this.playing.delete(sound); };
    return handle;
  }

  begin() {
    if (!this.ambience) {
      this.ambience = this.play('ambience', 0, true);
      if (this.ambience && this.context)
        this.ambience.gain.gain.linearRampToValueAtTime(CONFIG.audio.ambience.volume, this.context.currentTime + CONFIG.audio.ambience.fadeIn);
    }
  }
  drop(kind: string) {
    const gain = CONFIG.audio.drop * (CONFIG.audio.gain as Record<string, number>)[kind];
    if (kind === 'news') {
      const intro = this.play('blameIntro', gain);
      const delay = Math.max(0, (this.buffers.get('blameIntro')?.duration ?? 0) - CONFIG.audio.blame.overlap);
      const crowd = this.play('blameCrowd', 0, true, delay);
      if (crowd && this.context) {
        const start = this.context.currentTime + delay;
        crowd.gain.gain.setValueAtTime(0, start);
        crowd.gain.gain.linearRampToValueAtTime(CONFIG.audio.blame.crowdVolume * CONFIG.audio.drop, start + CONFIG.audio.blame.crowdIn);
        crowd.gain.gain.setValueAtTime(CONFIG.audio.blame.crowdVolume * CONFIG.audio.drop, start + CONFIG.audio.blame.crowdIn + CONFIG.audio.blame.crowdHold);
        crowd.gain.gain.linearRampToValueAtTime(0, start + CONFIG.audio.blame.crowdIn + CONFIG.audio.blame.crowdHold + CONFIG.audio.blame.crowdFade);
        crowd.source.stop(start + CONFIG.audio.blame.crowdIn + CONFIG.audio.blame.crowdHold + CONFIG.audio.blame.crowdFade + 0.1);
      }
      return intro;
    }
    const sound = kind as Sound;
    if (sound in files) {
      const handle = this.play(sound, gain, kind === 'dance');
      const life = CONFIG.props.kinds[kind as keyof typeof CONFIG.props.kinds]?.life ?? 0;
      if (handle && this.context && life > CONFIG.audio.loopFade) {
        const end = this.context.currentTime + life - CONFIG.audio.loopFade;
        handle.gain.gain.setValueAtTime(gain, end);
        handle.gain.gain.linearRampToValueAtTime(0, end + CONFIG.audio.loopFade);
        handle.source.stop(end + CONFIG.audio.loopFade + 0.05);
      }
      if (kind === 'priest') this.play('priest2', gain, false, CONFIG.audio.churchGap);
      return handle;
    }
  }
  setPanic(on: boolean) {
    if (!this.context) return;
    const now = this.context.currentTime;
    if (on && !this.panic) {
      this.panic = this.play('panic', 0, true);
      this.panic?.gain.gain.linearRampToValueAtTime(CONFIG.audio.panic.volume, now + CONFIG.audio.panic.fadeIn);
      this.ambience?.gain.gain.linearRampToValueAtTime(CONFIG.audio.ambience.volume * CONFIG.audio.panic.duckAmbience, now + CONFIG.audio.panic.fadeIn);
    }
    if (!on && this.panic) {
      this.panic.gain.gain.setValueAtTime(this.panic.gain.gain.value, now);
      this.panic.gain.gain.linearRampToValueAtTime(0, now + CONFIG.audio.panic.fadeOut);
      this.panic.source.stop(now + CONFIG.audio.panic.fadeOut + 0.1);
      this.panic = null;
      this.ambience?.gain.gain.linearRampToValueAtTime(CONFIG.audio.ambience.volume, now + CONFIG.audio.panic.fadeOut);
    }
  }
  ui(type: 'hover' | 'click') {
    if (!this.context || !this.master || performance.now() - this.lastUI < CONFIG.audio.ui.minGap) return;
    this.lastUI = performance.now();
    const now = this.context.currentTime;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.value = type === 'hover' ? CONFIG.audio.ui.hoverHz : CONFIG.audio.ui.clickHz;
    gain.gain.setValueAtTime(type === 'hover' ? CONFIG.audio.ui.hoverVolume : CONFIG.audio.ui.clickVolume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
    oscillator.connect(gain).connect(this.master);
    oscillator.start(now); oscillator.stop(now + 0.1);
  }
  notice(count: number) {
    if (!this.context || this.context.state !== 'running' || count <= 0) return;
    const now = performance.now();
    if (now - this.lastNotice < CONFIG.audio.notice.minGap) return;
    const elapsed = (now - this.lastNotice) / 1000;
    this.lastNotice = now;
    this.noticeTired *= Math.exp(-elapsed / CONFIG.audio.notice.forget);
    const volume = Math.max(CONFIG.audio.notice.floor, 1 - this.noticeTired);
    const chord = Math.min(count, CONFIG.audio.notice.chord);
    for (let i = 0; i < chord; i++) this.tone(CONFIG.audio.notice.hz * Math.pow(CONFIG.audio.notice.chordStep, i), volume * CONFIG.audio.notice.volume * Math.pow(CONFIG.audio.notice.chordFade, i), CONFIG.audio.notice.attack, CONFIG.audio.notice.decay, i * CONFIG.audio.notice.chordGap, CONFIG.audio.notice.bend);
    this.noticeTired = Math.min(1, this.noticeTired + CONFIG.audio.notice.fatigue * chord);
  }
  countdown(seconds: number) {
    if (!this.context || this.context.state !== 'running') return;
    const n = Math.ceil(seconds);
    if (n > CONFIG.audio.countdown.from || n <= 0 || n === this.lastCountdown) { if (n > CONFIG.audio.countdown.from || n <= 0) this.lastCountdown = null; return; }
    this.lastCountdown = n;
    const urgent = n <= CONFIG.audio.countdown.urgentFrom;
    this.tone(urgent ? CONFIG.audio.countdown.urgentHz : CONFIG.audio.countdown.hz, urgent ? CONFIG.audio.countdown.urgentVolume : CONFIG.audio.countdown.volume, .005, urgent ? .22 : .13);
  }
  approach(value: number) {
    if (!this.context || this.context.state !== 'running' || value <= 0 || value > CONFIG.audio.approach.from) { this.lastApproach = null; return; }
    const step = Math.ceil(value / CONFIG.audio.approach.step);
    if (step === this.lastApproach) return;
    this.lastApproach = step;
    const index = Math.max(0, Math.round(CONFIG.audio.approach.from / CONFIG.audio.approach.step) - step);
    this.tone(CONFIG.audio.approach.hz * Math.pow(CONFIG.audio.approach.rise, index), CONFIG.audio.approach.volume, .004, CONFIG.audio.approach.decay);
  }
  private tone(frequency: number, volume: number, attack: number, decay: number, when = 0, bend = 0) {
    if (!this.context || !this.master) return;
    const at = this.context.currentTime + when;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = 'sine'; oscillator.frequency.setValueAtTime(frequency, at);
    if (bend) oscillator.frequency.exponentialRampToValueAtTime(frequency * bend, at + attack + decay);
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(volume, at + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + attack + decay);
    oscillator.connect(gain).connect(this.master); oscillator.start(at); oscillator.stop(at + attack + decay + .02);
  }
  end(reason: 'won' | 'lost' | 'timeout') {
    this.setPanic(false);
    if (this.ambience && this.context) {
      const now = this.context.currentTime;
      this.ambience.gain.gain.linearRampToValueAtTime(0, now + 1.2);
      this.ambience.source.stop(now + 1.3);
      this.ambience = null;
    }
    if (reason === 'won') this.play('winMusic', CONFIG.audio.drop * CONFIG.audio.gain.winMusic);
    else if (reason === 'timeout') this.play('timeout', CONFIG.audio.drop * CONFIG.audio.gain.timeout);
    else this.play('lose', CONFIG.audio.drop * CONFIG.audio.gain.lose);
  }
  finalWin() { this.play('winFinal', CONFIG.audio.drop * CONFIG.audio.gain.winFinal); }
  dispose() {
    for (const handle of this.playing.values()) { try { handle.source.stop(); } catch {} }
    this.playing.clear(); this.context?.close(); this.ambience = null; this.panic = null;
  }
}
