
import { combatAudioCategory, getWorldCuePitchScale, shouldPlayCombatCue, type CombatAudioCategory, type CombatCue } from './combatAudioPolicy';

class AudioService {
  private ctx: AudioContext | null = null;
  private gainNode: GainNode | null = null;
  private isMusicPlaying = false;
  private musicInterval: number | null = null;
  private currentSong: any = null;
  private step = 0;
  private readonly lastCombatCueByCategory = new Map<CombatAudioCategory, number>();
  
  public musicEnabled = true;
  public sfxEnabled = true;

  constructor() {
    try {
      this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.gainNode = this.ctx.createGain();
      this.gainNode.connect(this.ctx.destination);
      this.gainNode.gain.value = 0.3; // Master Volume
    } catch (e) {
      console.error("AudioContext not supported");
    }
  }

  setMusicEnabled(enabled: boolean) {
      this.musicEnabled = enabled;
      if (!enabled) {
          this.stopMusic();
      } else if (!this.isMusicPlaying) {
          this.startMusic();
      }
  }

  setSfxEnabled(enabled: boolean) {
      this.sfxEnabled = enabled;
  }

  private ensureContext() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  startMusic() {
    if (!this.musicEnabled) return;
    if (!this.ctx || this.isMusicPlaying) return;
    this.ensureContext();
    this.isMusicPlaying = true;
    this.playNextRandomSong();
  }

  private playNextRandomSong() {
     if (this.musicInterval) clearInterval(this.musicInterval);
     
     const songs = [
        this.getSongDungeon(), 
        this.getSongMystic(), 
        this.getSongMarch(),
        this.getSongBoss(),
        this.getSongEthereal()
    ];
    // Avoid repeating same song if possible
    let nextSong = songs[Math.floor(Math.random() * songs.length)];
    if (this.currentSong && songs.length > 1) {
        while(JSON.stringify(nextSong) === JSON.stringify(this.currentSong)) {
            nextSong = songs[Math.floor(Math.random() * songs.length)];
        }
    }
    
    this.currentSong = nextSong;
    this.step = 0;
    const speed = this.currentSong.speed;
    
    // Determine song length in steps (approximate)
    // We'll loop it a few times then change
    const loops = 4;
    const maxSteps = Math.max(this.currentSong.melody.length, this.currentSong.bass.length) * loops;

    this.musicInterval = window.setInterval(() => {
        if (!this.isMusicPlaying) return;
        
        const mIdx = this.step % this.currentSong.melody.length;
        const bIdx = this.step % this.currentSong.bass.length;
        
        const mNote = this.currentSong.melody[mIdx];
        const bNote = this.currentSong.bass[bIdx];
        
        if (mNote) this.playTone(mNote.f, 'square', mNote.d, 0, 0.05, true);
        if (bNote) this.playTone(bNote.f, 'triangle', bNote.d, 0, 0.08, true);

        this.step++;

        if (this.step > maxSteps) {
            // Change song
            this.playNextRandomSong();
        }

    }, speed);
  }

  getSongDungeon() {
      return {
          speed: 200,
          melody: [
            { f: 523.25, d: 0.1 }, null, { f: 622.25, d: 0.1 }, null, 
            { f: 783.99, d: 0.1 }, null, { f: 622.25, d: 0.1 }, null,
            { f: 587.33, d: 0.1 }, null, { f: 523.25, d: 0.1 }, null,
            { f: 466.16, d: 0.1 }, null, { f: 392.00, d: 0.1 }, null,
            { f: 523.25, d: 0.1 }, null, { f: 392.00, d: 0.1 }, null,
            { f: 311.13, d: 0.1 }, null, { f: 392.00, d: 0.1 }, null,
            { f: 293.66, d: 0.1 }, { f: 311.13, d: 0.1 }, { f: 349.23, d: 0.1 }, { f: 392.00, d: 0.1 },
            { f: 261.63, d: 0.4 }, null, null, null
          ],
          bass: [
            { f: 130.81, d: 0.3 }, null, null, null,
            { f: 130.81, d: 0.3 }, null, null, null, 
            { f: 116.54, d: 0.3 }, null, null, null,
            { f: 98.00, d: 0.3 }, null, null, null,
            { f: 103.83, d: 0.3 }, null, null, null,
            { f: 116.54, d: 0.3 }, null, null, null,
            { f: 130.81, d: 0.3 }, null, { f: 155.56, d: 0.1 }, { f: 174.61, d: 0.1 },
            { f: 130.81, d: 0.3 }, null, null, null
          ]
      };
  }

  getSongMystic() {
      return {
          speed: 250,
          melody: [
             { f: 659.25, d: 0.2 }, null, { f: 587.33, d: 0.2 }, null, // E5, D5
             { f: 523.25, d: 0.2 }, null, { f: 493.88, d: 0.2 }, null, // C5, B4
             { f: 329.63, d: 0.4 }, null, null, null, // E4 long
             { f: 392.00, d: 0.2 }, { f: 440.00, d: 0.2 }, { f: 493.88, d: 0.2 }, null, // G4, A4, B4
             { f: 659.25, d: 0.1 }, { f: 783.99, d: 0.1 }, { f: 659.25, d: 0.1 }, null // E5, G5, E5
          ],
          bass: [
             { f: 82.41, d: 0.6 }, null, null, null, // E2
             { f: 82.41, d: 0.6 }, null, null, null,
             { f: 87.31, d: 0.6 }, null, null, null, // F2
             { f: 73.42, d: 0.6 }, null, null, null, // D2
          ]
      };
  }

  getSongMarch() {
      return {
          speed: 150,
          melody: [
              { f: 440.00, d: 0.1 }, { f: 440.00, d: 0.1 }, { f: 440.00, d: 0.1 }, null,
              { f: 349.23, d: 0.1 }, null, { f: 523.25, d: 0.1 }, null,
              { f: 440.00, d: 0.1 }, { f: 349.23, d: 0.1 }, { f: 440.00, d: 0.4 }, null,
              null, null, null, null
          ],
          bass: [
              { f: 110.00, d: 0.1 }, null, { f: 110.00, d: 0.1 }, null,
              { f: 110.00, d: 0.1 }, null, { f: 110.00, d: 0.1 }, null,
              { f: 98.00, d: 0.1 }, null, { f: 98.00, d: 0.1 }, null,
              { f: 110.00, d: 0.1 }, null, { f: 110.00, d: 0.1 }, null,
          ]
      }
  }

  getSongBoss() {
    return {
        speed: 120,
        melody: [
            { f: 110.00, d: 0.1 }, { f: 110.00, d: 0.1 }, { f: 116.54, d: 0.1 }, { f: 110.00, d: 0.1 },
            { f: 130.81, d: 0.1 }, { f: 110.00, d: 0.1 }, { f: 155.56, d: 0.1 }, null,
            { f: 110.00, d: 0.1 }, { f: 110.00, d: 0.1 }, { f: 116.54, d: 0.1 }, { f: 110.00, d: 0.1 },
            { f: 98.00, d: 0.2 }, { f: 87.31, d: 0.2 }, null, null
        ],
        bass: [
            { f: 55.00, d: 0.1 }, null, { f: 55.00, d: 0.1 }, null,
            { f: 55.00, d: 0.1 }, null, { f: 55.00, d: 0.1 }, null,
            { f: 58.27, d: 0.1 }, null, { f: 58.27, d: 0.1 }, null,
            { f: 55.00, d: 0.4 }, null, null, null
        ]
    }
  }

  getSongEthereal() {
      return {
          speed: 300,
          melody: [
              { f: 659.25, d: 0.3 }, null, { f: 783.99, d: 0.3 }, null,
              { f: 987.77, d: 0.3 }, null, { f: 783.99, d: 0.3 }, null,
              { f: 587.33, d: 0.3 }, null, { f: 659.25, d: 0.3 }, null,
              { f: 523.25, d: 0.6 }, null, null, null
          ],
          bass: [
              { f: 164.81, d: 0.9 }, null, null, null,
              { f: 174.61, d: 0.9 }, null, null, null,
              { f: 130.81, d: 0.9 }, null, null, null,
              { f: 146.83, d: 0.9 }, null, null, null
          ]
      }
  }

  stopMusic() {
      if (this.musicInterval) {
          clearInterval(this.musicInterval);
          this.musicInterval = null;
      }
      this.isMusicPlaying = false;
  }

  playTone(freq: number, type: OscillatorType, duration: number, delay = 0, volume = 0.1, isMusic = false) {
    if (!this.ctx || !this.gainNode) return;
    if (isMusic && !this.musicEnabled) return;
    if (!isMusic && !this.sfxEnabled) return;

    this.ensureContext();

    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime + delay);
    
    // Envelope
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0, this.ctx.currentTime + delay);
    gain.gain.linearRampToValueAtTime(volume, this.ctx.currentTime + delay + 0.02); // Attack
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + delay + duration); // Decay
    
    osc.connect(gain);
    gain.connect(this.gainNode);
    
    osc.start(this.ctx.currentTime + delay);
    osc.stop(this.ctx.currentTime + delay + duration + 0.1);
  }

  playStep() {
    this.playTone(100, 'triangle', 0.05, 0, 0.1);
  }

  playBump() {
    this.playTone(60, 'sawtooth', 0.1, 0, 0.1);
  }

  playAttack() {
    this.playTone(200, 'square', 0.05, 0, 0.1);
    this.playTone(150, 'sawtooth', 0.1, 0.05, 0.1);
  }

  playCombatCue(cue: CombatCue, position?: { x: number; y: number; z: number }) {
    if (!this.ctx || !this.sfxEnabled) return;
    const audioTime = this.ctx.currentTime;
    if (!shouldPlayCombatCue(cue, audioTime, this.lastCombatCueByCategory)) return;
    this.lastCombatCueByCategory.set(combatAudioCategory(cue), audioTime);
    this.ensureContext();
    const pitchScale = getWorldCuePitchScale(position);
    const tone = (frequency: number, type: OscillatorType, duration: number, delay = 0, volume = 0.1) =>
      this.playTone(frequency * pitchScale, type, duration, delay, volume);
    if (cue === 'blade') { tone(235, 'sawtooth', 0.075, 0, 0.075); tone(150, 'square', 0.055, 0.025, 0.055); }
    else if (cue === 'spear') { tone(315, 'triangle', 0.055, 0, 0.07); tone(205, 'square', 0.06, 0.035, 0.045); }
    else if (cue === 'shield') { tone(220, 'triangle', 0.08, 0, 0.1); tone(80, 'square', 0.07, 0.03, 0.055); }
    else if (cue === 'cast') { tone(490, 'triangle', 0.12, 0, 0.065); tone(740, 'sine', 0.18, 0.045, 0.05); }
    else if (cue === 'projectile') { tone(660, 'square', 0.065, 0, 0.06); tone(280, 'triangle', 0.11, 0.03, 0.05); }
    else if (cue === 'enemyHit') { tone(400, 'square', 0.05, 0, 0.075); tone(300, 'sawtooth', 0.1, 0.05, 0.075); }
    else if (cue === 'playerHit') { tone(90, 'sawtooth', 0.14, 0, 0.085); tone(58, 'square', 0.1, 0.035, 0.05); }
    else if (cue === 'poison') { tone(330, 'triangle', 0.16, 0, 0.055); tone(215, 'sine', 0.22, 0.07, 0.04); }
    else if (cue === 'bossTelegraph') { tone(82, 'sawtooth', 0.28, 0, 0.075); tone(123, 'triangle', 0.24, 0.08, 0.06); }
    else if (cue === 'bossPhase') { tone(65, 'sawtooth', 0.4, 0, 0.1); tone(130, 'triangle', 0.45, 0.1, 0.08); }
    else if (cue === 'bossDeath') { tone(68, 'sawtooth', 0.45, 0, 0.1); tone(110, 'triangle', 0.38, 0.12, 0.065); }
    else if (cue === 'pickup') { tone(1046, 'sine', 0.1, 0, 0.075); tone(1318, 'sine', 0.2, 0.1, 0.075); }
    else if (cue === 'dodge') { tone(420, 'triangle', 0.045, 0, 0.045); tone(280, 'sine', 0.07, 0.025, 0.035); }
    else if (cue === 'heal') { tone(400, 'sine', 0.2, 0, 0.075); tone(600, 'sine', 0.3, 0.1, 0.065); }
    else if (cue === 'levelUp') { tone(440, 'square', 0.1, 0, 0.075); tone(554, 'square', 0.1, 0.1, 0.075); tone(659, 'square', 0.4, 0.2, 0.075); }
    else if (cue === 'stoneImpact') { tone(94, 'triangle', 0.12, 0, 0.075); tone(138, 'sine', 0.07, 0.02, 0.04); }
    else if (cue === 'bronzeImpact') { tone(335, 'triangle', 0.09, 0, 0.065); tone(510, 'sine', 0.065, 0.025, 0.045); }
    else if (cue === 'waterImpact') { tone(265, 'sine', 0.12, 0, 0.05); tone(440, 'triangle', 0.08, 0.04, 0.035); }
    else if (cue === 'magicImpact') { tone(590, 'sine', 0.14, 0, 0.06); tone(390, 'triangle', 0.16, 0.045, 0.045); }
  }

  playCrit() { this.playTone(700, 'square', 0.07, 0, 0.12); this.playTone(1000, 'triangle', 0.12, 0.05, 0.1); }
  playBlock() { this.playTone(220, 'triangle', 0.08, 0, 0.13); this.playTone(80, 'square', 0.07, 0.03, 0.07); }
  playInterrupt() { this.playTone(900, 'sawtooth', 0.07, 0, 0.09); this.playTone(320, 'square', 0.12, 0.06, 0.09); }
  playBossPhase() { this.playTone(65, 'sawtooth', 0.4, 0, 0.13); this.playTone(130, 'triangle', 0.45, 0.1, 0.1); }

  playDefend() {
      this.playTone(150, 'sine', 0.2, 0, 0.2);
  }

  playHeal() {
      this.playTone(400, 'sine', 0.2, 0, 0.1);
      this.playTone(600, 'sine', 0.3, 0.1, 0.1);
      this.playTone(800, 'sine', 0.5, 0.2, 0.1);
  }

  playEnemyHit() {
    this.playTone(400, 'square', 0.05, 0, 0.1);
    this.playTone(300, 'sawtooth', 0.1, 0.05, 0.1);
  }

  playLevelUp() {
    this.playTone(440, 'square', 0.1, 0, 0.1);
    this.playTone(554, 'square', 0.1, 0.1, 0.1);
    this.playTone(659, 'square', 0.4, 0.2, 0.1);
  }
  
  playItemGet() {
      this.playTone(1046, 'sine', 0.1, 0, 0.1);
      this.playTone(1318, 'sine', 0.2, 0.1, 0.1);
  }
}

export const audioService = new AudioService();
