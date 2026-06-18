export default class LofiAmbientSynth {
  constructor() {
    this.ctx = null;
    this.isPlaying = false;
    this.nodes = [];
    this.chordTimer = null;
    this.droneOsc = null;
    this.noise = null;
    this.mainGain = null;
    this.filter = null;
  }

  start(volume = 0.5) {
    if (this.isPlaying) return;

    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();

      this.mainGain = this.ctx.createGain();
      this.mainGain.gain.setValueAtTime(volume * 0.12, this.ctx.currentTime);
      this.mainGain.connect(this.ctx.destination);

      this.filter = this.ctx.createBiquadFilter();
      this.filter.type = 'lowpass';
      this.filter.frequency.setValueAtTime(400, this.ctx.currentTime);
      this.filter.connect(this.mainGain);

      const bufferSize = 2 * this.ctx.sampleRate;
      const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);

      for (let i = 0; i < bufferSize; i += 1) {
        output[i] = Math.random() * 2 - 1;
      }

      this.noise = this.ctx.createBufferSource();
      this.noise.buffer = noiseBuffer;
      this.noise.loop = true;

      const noiseFilter = this.ctx.createBiquadFilter();
      noiseFilter.type = 'bandpass';
      noiseFilter.frequency.setValueAtTime(1000, this.ctx.currentTime);
      noiseFilter.Q.setValueAtTime(2.0, this.ctx.currentTime);

      const noiseGain = this.ctx.createGain();
      noiseGain.gain.setValueAtTime(0.03, this.ctx.currentTime);

      this.noise.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      noiseGain.connect(this.mainGain);
      this.noise.start();

      this.droneOsc = this.ctx.createOscillator();
      this.droneOsc.type = 'triangle';
      this.droneOsc.frequency.setValueAtTime(73.42, this.ctx.currentTime);

      const droneGain = this.ctx.createGain();
      droneGain.gain.setValueAtTime(0.12, this.ctx.currentTime);

      this.droneOsc.connect(this.filter);
      this.droneOsc.connect(droneGain);
      droneGain.connect(this.mainGain);
      this.droneOsc.start();

      const scale = [146.83, 164.81, 220.00, 293.66, 329.63, 440.00, 587.33, 659.25];

      this.chordTimer = setInterval(() => {
        if (!this.ctx || this.ctx.state === 'suspended') return;

        const now = this.ctx.currentTime;
        const count = Math.random() > 0.5 ? 2 : 1;

        for (let k = 0; k < count; k += 1) {
          const freq = scale[Math.floor(Math.random() * scale.length)];
          const osc = this.ctx.createOscillator();
          const oscGain = this.ctx.createGain();

          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now);

          oscGain.gain.setValueAtTime(0, now);
          oscGain.gain.linearRampToValueAtTime(0.06, now + 0.15);
          oscGain.gain.exponentialRampToValueAtTime(0.0001, now + 3.5);

          osc.connect(this.filter);
          osc.connect(oscGain);
          oscGain.connect(this.mainGain);

          osc.start(now);
          osc.stop(now + 3.6);
        }
      }, 3500);

      this.isPlaying = true;
    } catch (err) {
      console.warn('Web Audio API not supported or blocked:', err);
    }
  }

  setVolume(vol) {
    if (this.mainGain && this.ctx) {
      this.mainGain.gain.setValueAtTime(vol * 0.12, this.ctx.currentTime);
    }
  }

  stop() {
    if (!this.isPlaying) return;

    clearInterval(this.chordTimer);

    if (this.noise) {
      try {
        this.noise.stop();
      } catch {
        // Audio nodes can already be stopped by the browser.
      }
    }

    if (this.droneOsc) {
      try {
        this.droneOsc.stop();
      } catch {
        // Audio nodes can already be stopped by the browser.
      }
    }

    if (this.ctx) {
      this.ctx.close();
    }

    this.isPlaying = false;
  }
}
