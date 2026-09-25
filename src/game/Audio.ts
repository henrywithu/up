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

  play(sound: Sound, volume = 1, loop = false) {
    if (!this.context || !this.master) return null;
    const buffer = this.buffers.get(sound);
    if (!buffer) return null;
    const source = this.context.createBufferSource();
    const gain = this.context.createGain();
    source.buffer = buffer;
    source.loop = loop;
    gain.gain.value = volume;
    source.connect(gain).connect(this.master);
    source.start();
    return { source, gain };
  }

  begin() {
    if (!this.ambience) {
      this.ambience = this.play('ambience', 0, true);
      if (this.ambience && this.context)
        this.ambience.gain.gain.linearRampToValueAtTime(CONFIG.audio.ambience.volume, this.context.currentTime + CONFIG.audio.ambience.fadeIn);
    }
  }
  drop(kind: string) {
    const sound = kind === 'news' ? 'blameIntro' : kind;
    if (sound in files) this.play(sound as Sound, CONFIG.audio.drop * (CONFIG.audio.gain as Record<string, number>)[kind]);
    if (kind === 'priest') setTimeout(() => this.play('priest2'), 1000);
    if (kind === 'news') setTimeout(() => this.play('blameCrowd', 0.75), 800);
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
  end(won: boolean) {
    this.setPanic(false);
    if (this.ambience && this.context) {
      const now = this.context.currentTime;
      this.ambience.gain.gain.linearRampToValueAtTime(0, now + 1.2);
      this.ambience.source.stop(now + 1.3);
      this.ambience = null;
    }
    this.play(won ? 'winMusic' : 'lose', 1);
  }
  dispose() { this.ambience?.source.stop(); this.panic?.source.stop(); this.context?.close(); }
}
