/**
 * Web Audio API procedural sound synthesizer
 * Zero external audio files required.
 */

class SoundSystem {
  private ctx: AudioContext | null = null;
  public isMuted: boolean = false;

  private initContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  // Crisp mechanical stamp thud with subtle ink click
  public playStampSound() {
    if (this.isMuted) return;
    try {
      this.initContext();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;

      // Heavy low thud
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(140, now);
      osc.frequency.exponentialRampToValueAtTime(32, now + 0.12);

      gain.gain.setValueAtTime(0.7, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.15);

      // High click / spring release
      const clickOsc = this.ctx.createOscillator();
      const clickGain = this.ctx.createGain();
      clickOsc.type = 'sine';
      clickOsc.frequency.setValueAtTime(900, now);
      clickOsc.frequency.exponentialRampToValueAtTime(180, now + 0.05);

      clickGain.gain.setValueAtTime(0.4, now);
      clickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

      clickOsc.connect(clickGain);
      clickGain.connect(this.ctx.destination);

      clickOsc.start(now);
      clickOsc.stop(now + 0.07);
    } catch {
      // Audio not permitted yet
    }
  }

  // Soft paper rustle / fold sound
  public playPaperFold() {
    if (this.isMuted) return;
    try {
      this.initContext();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;

      // Band-passed noise simulation with rapid frequency modulation
      const bufferSize = this.ctx.sampleRate * 0.18;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const output = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
      }

      const whiteNoise = this.ctx.createBufferSource();
      whiteNoise.buffer = buffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1600, now);
      filter.frequency.exponentialRampToValueAtTime(800, now + 0.18);
      filter.Q.value = 3;

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.35, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

      whiteNoise.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);

      whiteNoise.start(now);
      whiteNoise.stop(now + 0.19);
    } catch {
      // ignore
    }
  }

  // Pen stroke / signature scratch sound
  public playPenScratch() {
    if (this.isMuted) return;
    try {
      this.initContext();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(420 + Math.random() * 120, now);
      osc.frequency.linearRampToValueAtTime(360, now + 0.05);

      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.06);
    } catch {
      // ignore
    }
  }

  // Ballot box slot drop swoosh
  public playDropSound() {
    if (this.isMuted) return;
    try {
      this.initContext();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;

      // Descending tone
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(480, now);
      osc.frequency.exponentialRampToValueAtTime(120, now + 0.35);

      gain.gain.setValueAtTime(0.4, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.4);
    } catch {
      // ignore
    }
  }

  // Celebratory victory chime fanfare
  public playChime() {
    if (this.isMuted) return;
    try {
      this.initContext();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;

      const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
      notes.forEach((freq, idx) => {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;

        const startTime = now + idx * 0.1;
        gain.gain.setValueAtTime(0, startTime);
        gain.gain.linearRampToValueAtTime(0.3, startTime + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.6);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(startTime);
        osc.stop(startTime + 0.65);
      });
    } catch {
      // ignore
    }
  }

  // Soft footstep tap
  private lastFootstepTime = 0;
  public playFootstep() {
    if (this.isMuted) return;
    const nowMs = performance.now();
    if (nowMs - this.lastFootstepTime < 280) return;
    this.lastFootstepTime = nowMs;

    try {
      this.initContext();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(90 + Math.random() * 20, now);
      osc.frequency.exponentialRampToValueAtTime(40, now + 0.05);

      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.07);
    } catch {
      // ignore
    }
  }

  // Crisp UI Click
  public playClick() {
    if (this.isMuted) return;
    try {
      this.initContext();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(640, now);
      osc.frequency.exponentialRampToValueAtTime(320, now + 0.04);

      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.06);
    } catch {
      // ignore
    }
  }

  // Low buzz / double warning sound
  public playWarning() {
    if (this.isMuted) return;
    try {
      this.initContext();
      if (!this.ctx) return;
      const now = this.ctx.currentTime;

      [0, 0.1].forEach((delay) => {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(220, now + delay);
        osc.frequency.exponentialRampToValueAtTime(160, now + delay + 0.08);

        gain.gain.setValueAtTime(0.2, now + delay);
        gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.08);

        osc.connect(gain);
        gain.connect(this.ctx.destination);

        osc.start(now + delay);
        osc.stop(now + delay + 0.09);
      });
    } catch {
      // ignore
    }
  }

  private normalizeEmoteType(emoteType: string): 'hello' | 'clap' | 'think' | 'voted' {
    const raw = (emoteType || '').toLowerCase();
    if (raw === 'clap' || raw.includes('👏') || raw.includes('박수')) return 'clap';
    if (raw === 'think' || raw.includes('🤔') || raw.includes('고민')) return 'think';
    if (raw === 'voted' || raw.includes('🗳') || raw.includes('투표')) return 'voted';
    return 'hello';
  }

  /**
   * Synthesizes distinct Web Audio API sound effects for the 4 avatar emotes.
   * Zero external MP3 assets required; works across desktop & mobile Safari/Chrome.
   */
  public playEmoteSound(emoteType: string, isRemote: boolean = false) {
    if (this.isMuted) return;
    try {
      if (!this.ctx) {
        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (!AudioCtx) return;
        this.ctx = new AudioCtx();
      }

      const ctx = this.ctx;
      const kind = this.normalizeEmoteType(emoteType);
      const vol = isRemote ? 0.5 : 1.0;

      const scheduleSound = () => {
        if (this.isMuted) return;
        const now = ctx.currentTime + 0.005;

        if (kind === 'hello') {
          // Bright, friendly xylophone/chimebell arpeggio: C5 -> E5 -> G5 -> C6 ("띠리링~")
          const notes = [523.25, 659.25, 783.99, 1046.5];
          notes.forEach((freq, idx) => {
            const start = now + idx * 0.068;
            const decay = idx === notes.length - 1 ? 0.52 : 0.28;

            // Clear sine fundamental
            const sineOsc = ctx.createOscillator();
            const sineGain = ctx.createGain();
            sineOsc.type = 'sine';
            sineOsc.frequency.setValueAtTime(freq, start);

            sineGain.gain.setValueAtTime(0.0001, start);
            sineGain.gain.linearRampToValueAtTime(0.24 * vol, start + 0.008);
            sineGain.gain.exponentialRampToValueAtTime(0.0008, start + decay);

            sineOsc.connect(sineGain);
            sineGain.connect(ctx.destination);
            sineOsc.start(start);
            sineOsc.stop(start + decay + 0.03);

            // Warm triangle bell overtone
            const triOsc = ctx.createOscillator();
            const triGain = ctx.createGain();
            triOsc.type = 'triangle';
            triOsc.frequency.setValueAtTime(freq * 2, start);

            triGain.gain.setValueAtTime(0.0001, start);
            triGain.gain.linearRampToValueAtTime(0.075 * vol, start + 0.006);
            triGain.gain.exponentialRampToValueAtTime(0.0008, start + decay * 0.65);

            triOsc.connect(triGain);
            triGain.connect(ctx.destination);
            triOsc.start(start);
            triOsc.stop(start + decay * 0.7 + 0.02);
          });
          return;
        }

        if (kind === 'clap') {
          // Calm, crisp 3-hit applause ("짝! · 짝! · 짝!") synced 1:1 with 3D avatar palm impact timestamps
          const clapTimestamps = [0.28, 0.68, 1.08];
          const duration = 0.125;
          const sampleCount = Math.floor(ctx.sampleRate * duration);

          clapTimestamps.forEach((offsetSec, i) => {
            const clapStart = now + offsetSec;
            const buffer = ctx.createBuffer(1, sampleCount, ctx.sampleRate);
            const data = buffer.getChannelData(0);
            for (let s = 0; s < sampleCount; s++) {
              data[s] = Math.random() * 2 - 1;
            }

            // Two tightly spaced micro-transients (0ms & 7ms) replicate realistic palm-to-palm clap
            const emphasis = i === 2 ? 1.04 : 0.96 + i * 0.03;
            const layers = [
              { offset: 0, gainPeak: 0.5 * emphasis * vol, decay: 0.088, freqBase: 1180 },
              { offset: 0.007, gainPeak: 0.34 * emphasis * vol, decay: 0.078, freqBase: 1420 },
            ];

            layers.forEach((layer) => {
              const src = ctx.createBufferSource();
              src.buffer = buffer;

              const bandpass = ctx.createBiquadFilter();
              bandpass.type = 'bandpass';
              bandpass.frequency.setValueAtTime(
                layer.freqBase + (Math.random() - 0.5) * 140,
                clapStart + layer.offset
              );
              bandpass.Q.setValueAtTime(1.45, clapStart + layer.offset);

              const gain = ctx.createGain();
              const t0 = clapStart + layer.offset;
              gain.gain.setValueAtTime(0.0001, t0);
              gain.gain.linearRampToValueAtTime(Math.max(0.05, layer.gainPeak), t0 + 0.004);
              gain.gain.exponentialRampToValueAtTime(0.0008, t0 + 0.004 + layer.decay);

              src.connect(bandpass);
              bandpass.connect(gain);
              gain.connect(ctx.destination);

              src.start(t0);
              src.stop(t0 + duration);
            });
          });
          return;
        }

        if (kind === 'think') {
          // 1) Crisp woodblock taps at 0.0s & 0.22s (800Hz -> 400Hz pitch drop, "똑.. 딱..")
          const woodTaps = [
            { delay: 0.0, startFreq: 800, endFreq: 400 },
            { delay: 0.22, startFreq: 840, endFreq: 410 },
          ];
          woodTaps.forEach(({ delay, startFreq, endFreq }) => {
            const t0 = now + delay;

            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(startFreq, t0);
            osc.frequency.exponentialRampToValueAtTime(endFreq, t0 + 0.045);

            gain.gain.setValueAtTime(0.0001, t0);
            gain.gain.linearRampToValueAtTime(0.32 * vol, t0 + 0.004);
            gain.gain.exponentialRampToValueAtTime(0.0008, t0 + 0.075);

            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start(t0);
            osc.stop(t0 + 0.085);

            // Subtle woody click harmonic
            const clickOsc = ctx.createOscillator();
            const clickGain = ctx.createGain();
            clickOsc.type = 'triangle';
            clickOsc.frequency.setValueAtTime(startFreq * 1.5, t0);
            clickOsc.frequency.exponentialRampToValueAtTime(endFreq * 1.2, t0 + 0.03);

            clickGain.gain.setValueAtTime(0.0001, t0);
            clickGain.gain.linearRampToValueAtTime(0.11 * vol, t0 + 0.003);
            clickGain.gain.exponentialRampToValueAtTime(0.0008, t0 + 0.04);

            clickOsc.connect(clickGain);
            clickGain.connect(ctx.destination);
            clickOsc.start(t0);
            clickOsc.stop(t0 + 0.05);
          });

          // 2) At 0.45s: inquisitive upward pitch slide 320Hz -> 480Hz ("음~?")
          const qStart = now + 0.45;
          const qDur = 0.36;

          const qOsc = ctx.createOscillator();
          const qGain = ctx.createGain();
          qOsc.type = 'sine';
          qOsc.frequency.setValueAtTime(320, qStart);
          qOsc.frequency.exponentialRampToValueAtTime(340, qStart + 0.08);
          qOsc.frequency.exponentialRampToValueAtTime(480, qStart + qDur);

          qGain.gain.setValueAtTime(0.0001, qStart);
          qGain.gain.linearRampToValueAtTime(0.24 * vol, qStart + 0.04);
          qGain.gain.setValueAtTime(0.21 * vol, qStart + qDur * 0.72);
          qGain.gain.exponentialRampToValueAtTime(0.0008, qStart + qDur + 0.08);

          qOsc.connect(qGain);
          qGain.connect(ctx.destination);
          qOsc.start(qStart);
          qOsc.stop(qStart + qDur + 0.1);

          // Soft warm harmonic layer for the humming inflection
          const qTri = ctx.createOscillator();
          const qTriGain = ctx.createGain();
          qTri.type = 'triangle';
          qTri.frequency.setValueAtTime(320, qStart);
          qTri.frequency.exponentialRampToValueAtTime(480, qStart + qDur);

          qTriGain.gain.setValueAtTime(0.0001, qStart);
          qTriGain.gain.linearRampToValueAtTime(0.08 * vol, qStart + 0.045);
          qTriGain.gain.exponentialRampToValueAtTime(0.0008, qStart + qDur + 0.06);

          qTri.connect(qTriGain);
          qTriGain.connect(ctx.destination);
          qTri.start(qStart);
          qTri.stop(qStart + qDur + 0.08);
          return;
        }

        // 'voted': Celebratory brassy fanfare ("빠바밤~!") + sparkling high chime (1500~2400Hz)
        // Melody: C5 -> G4 -> C5 -> E5 -> G5 -> C6
        const fanfareNotes = [
          { freq: 523.25, delay: 0.0, dur: 0.1, gain: 0.22 },
          { freq: 392.0, delay: 0.095, dur: 0.1, gain: 0.21 },
          { freq: 523.25, delay: 0.19, dur: 0.11, gain: 0.23 },
          { freq: 659.25, delay: 0.295, dur: 0.11, gain: 0.24 },
          { freq: 783.99, delay: 0.4, dur: 0.11, gain: 0.25 },
          { freq: 1046.5, delay: 0.51, dur: 0.62, gain: 0.27 },
        ];

        const brassFilter = ctx.createBiquadFilter();
        brassFilter.type = 'lowpass';
        brassFilter.frequency.setValueAtTime(2500, now);
        brassFilter.Q.setValueAtTime(1.1, now);
        brassFilter.connect(ctx.destination);

        fanfareNotes.forEach(({ freq, delay, dur, gain: noteVol }) => {
          const t0 = now + delay;

          // Triangle body
          const tri = ctx.createOscillator();
          const triGain = ctx.createGain();
          tri.type = 'triangle';
          tri.frequency.setValueAtTime(freq, t0);

          triGain.gain.setValueAtTime(0.0001, t0);
          triGain.gain.linearRampToValueAtTime(noteVol * vol, t0 + 0.014);
          triGain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);

          tri.connect(triGain);
          triGain.connect(brassFilter);
          tri.start(t0);
          tri.stop(t0 + dur + 0.03);

          // Sawtooth brass brilliance
          const saw = ctx.createOscillator();
          const sawGain = ctx.createGain();
          saw.type = 'sawtooth';
          saw.frequency.setValueAtTime(freq, t0);

          sawGain.gain.setValueAtTime(0.0001, t0);
          sawGain.gain.linearRampToValueAtTime(noteVol * 0.48 * vol, t0 + 0.018);
          sawGain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);

          saw.connect(sawGain);
          sawGain.connect(brassFilter);
          saw.start(t0);
          saw.stop(t0 + dur + 0.03);
        });

        // Celebratory harmonic brass triad chord sustaining under the final C6
        const chordStart = now + 0.51;
        [523.25, 659.25, 783.99].forEach((freq) => {
          const chordOsc = ctx.createOscillator();
          const chordGain = ctx.createGain();
          chordOsc.type = 'triangle';
          chordOsc.frequency.setValueAtTime(freq, chordStart);

          chordGain.gain.setValueAtTime(0.0001, chordStart);
          chordGain.gain.linearRampToValueAtTime(0.11 * vol, chordStart + 0.025);
          chordGain.gain.exponentialRampToValueAtTime(0.0008, chordStart + 0.62);

          chordOsc.connect(chordGain);
          chordGain.connect(brassFilter);
          chordOsc.start(chordStart);
          chordOsc.stop(chordStart + 0.65);
        });

        // Sparkling high-frequency chimes (1500~2400Hz)
        const sparkles = [
          { freq: 1567.98, delay: 0.52 }, // G6
          { freq: 1975.53, delay: 0.6 }, // B6
          { freq: 2093.0, delay: 0.68 }, // C7
          { freq: 2349.32, delay: 0.77 }, // D7
        ];
        sparkles.forEach(({ freq, delay }) => {
          const t0 = now + delay;
          const spOsc = ctx.createOscillator();
          const spGain = ctx.createGain();
          spOsc.type = 'sine';
          spOsc.frequency.setValueAtTime(freq, t0);

          spGain.gain.setValueAtTime(0.0001, t0);
          spGain.gain.linearRampToValueAtTime(0.11 * vol, t0 + 0.006);
          spGain.gain.exponentialRampToValueAtTime(0.0006, t0 + 0.28);

          spOsc.connect(spGain);
          spGain.connect(ctx.destination);
          spOsc.start(t0);
          spOsc.stop(t0 + 0.31);
        });
      };

      if (ctx.state === 'suspended') {
        ctx
          .resume()
          .then(() => scheduleSound())
          .catch(() => {
            // Autoplay blocked until next user gesture
          });
      } else {
        scheduleSound();
      }
    } catch {
      // AudioContext unavailable or blocked
    }
  }
}

export const sounds = new SoundSystem();

export function playEmoteSound(emoteType: string, isRemote: boolean = false): void {
  sounds.playEmoteSound(emoteType, isRemote);
}

