
class AudioService {
  private ctx: AudioContext | null = null;
  private gainNode: GainNode | null = null;
  private isMusicPlaying = false;
  private musicInterval: number | null = null;
  private currentSong: any = null;
  private step = 0;
  
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
