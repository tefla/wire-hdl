// Sound Chip for WireOS
// NES-style APU with 2 pulse channels, triangle, and noise

// I/O Register addresses
export const SOUND_IO = {
  // Pulse 1 ($8070-$8073)
  PULSE1_CTRL: 0x8070,    // [DD-C VVVV] duty, const vol, volume
  PULSE1_SWEEP: 0x8071,   // Frequency sweep (not implemented)
  PULSE1_LO: 0x8072,      // Timer low byte
  PULSE1_HI: 0x8073,      // Timer high + length counter load

  // Pulse 2 ($8074-$8077)
  PULSE2_CTRL: 0x8074,
  PULSE2_SWEEP: 0x8075,
  PULSE2_LO: 0x8076,
  PULSE2_HI: 0x8077,

  // Triangle ($8078-$807B)
  TRI_CTRL: 0x8078,       // [C--- ----] control flag
  TRI_UNUSED: 0x8079,
  TRI_LO: 0x807A,         // Timer low byte
  TRI_HI: 0x807B,         // Timer high + length counter load

  // Noise ($807C-$807F)
  NOISE_CTRL: 0x807C,     // [--LC VVVV] loop, const vol, volume
  NOISE_UNUSED: 0x807D,
  NOISE_PERIOD: 0x807E,   // [M--- PPPP] mode, period
  NOISE_LENGTH: 0x807F,   // [LLLL L---] length counter load

  // Status register
  APU_STATUS: 0x8080,     // [---D NT21] enable channels
};

// Duty cycle waveforms (0-3)
// Each has 8 samples representing one period
const DUTY_CYCLES = [
  [0, 1, 0, 0, 0, 0, 0, 0], // 12.5%
  [0, 1, 1, 0, 0, 0, 0, 0], // 25%
  [0, 1, 1, 1, 1, 0, 0, 0], // 50%
  [1, 0, 0, 1, 1, 1, 1, 1], // 75% (inverted 25%)
];

// Noise period lookup table (NES values)
const NOISE_PERIODS = [
  4, 8, 16, 32, 64, 96, 128, 160, 202, 254, 380, 508, 762, 1016, 2034, 4068
];

export class SoundChip {
  private audioCtx: AudioContext | null = null;
  private masterGain: GainNode | null = null;

  // Pulse channels
  private pulse1Osc: OscillatorNode | null = null;
  private pulse1Gain: GainNode | null = null;
  private pulse2Osc: OscillatorNode | null = null;
  private pulse2Gain: GainNode | null = null;

  // Triangle channel
  private triOsc: OscillatorNode | null = null;
  private triGain: GainNode | null = null;

  // Noise channel
  private noiseSource: AudioBufferSourceNode | null = null;
  private noiseGain: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;

  // Register values
  private pulse1Ctrl = 0;
  private pulse1Timer = 0;
  private pulse2Ctrl = 0;
  private pulse2Timer = 0;
  private triTimer = 0;
  private noiseCtrl = 0;
  private noisePeriod = 0;
  private apuStatus = 0;

  // Initialize audio context (must be called from user gesture)
  init(): boolean {
    if (this.audioCtx) return true;

    try {
      this.audioCtx = new AudioContext();
      this.masterGain = this.audioCtx.createGain();
      this.masterGain.gain.value = 0.3; // Master volume
      this.masterGain.connect(this.audioCtx.destination);

      // Create pulse 1 channel
      this.pulse1Gain = this.audioCtx.createGain();
      this.pulse1Gain.gain.value = 0;
      this.pulse1Gain.connect(this.masterGain);

      // Create pulse 2 channel
      this.pulse2Gain = this.audioCtx.createGain();
      this.pulse2Gain.gain.value = 0;
      this.pulse2Gain.connect(this.masterGain);

      // Create triangle channel
      this.triGain = this.audioCtx.createGain();
      this.triGain.gain.value = 0;
      this.triGain.connect(this.masterGain);

      // Create noise channel
      this.noiseGain = this.audioCtx.createGain();
      this.noiseGain.gain.value = 0;
      this.noiseGain.connect(this.masterGain);

      // Generate noise buffer
      this.generateNoiseBuffer();

      return true;
    } catch {
      console.error('Failed to initialize audio context');
      return false;
    }
  }

  // Generate LFSR noise buffer
  private generateNoiseBuffer(): void {
    if (!this.audioCtx) return;

    const sampleRate = this.audioCtx.sampleRate;
    const duration = 2; // 2 seconds of noise
    const length = sampleRate * duration;
    this.noiseBuffer = this.audioCtx.createBuffer(1, length, sampleRate);
    const data = this.noiseBuffer.getChannelData(0);

    // Generate noise using LFSR (like NES)
    let shift = 1;
    for (let i = 0; i < length; i++) {
      // Mode 0: XOR bits 0 and 1
      const feedback = (shift & 1) ^ ((shift >> 1) & 1);
      shift = (shift >> 1) | (feedback << 14);
      data[i] = (shift & 1) ? 0.5 : -0.5;
    }
  }

  // Write to sound register
  write(addr: number, value: number): void {
    switch (addr) {
      case SOUND_IO.PULSE1_CTRL:
        this.pulse1Ctrl = value;
        this.updatePulse1();
        break;
      case SOUND_IO.PULSE1_LO:
        this.pulse1Timer = (this.pulse1Timer & 0x700) | value;
        this.updatePulse1();
        break;
      case SOUND_IO.PULSE1_HI:
        this.pulse1Timer = (this.pulse1Timer & 0xFF) | ((value & 0x07) << 8);
        this.updatePulse1();
        break;

      case SOUND_IO.PULSE2_CTRL:
        this.pulse2Ctrl = value;
        this.updatePulse2();
        break;
      case SOUND_IO.PULSE2_LO:
        this.pulse2Timer = (this.pulse2Timer & 0x700) | value;
        this.updatePulse2();
        break;
      case SOUND_IO.PULSE2_HI:
        this.pulse2Timer = (this.pulse2Timer & 0xFF) | ((value & 0x07) << 8);
        this.updatePulse2();
        break;

      case SOUND_IO.TRI_CTRL:
        // TRI_CTRL value stored but not used (triangle has fixed volume)
        this.updateTriangle();
        break;
      case SOUND_IO.TRI_LO:
        this.triTimer = (this.triTimer & 0x700) | value;
        this.updateTriangle();
        break;
      case SOUND_IO.TRI_HI:
        this.triTimer = (this.triTimer & 0xFF) | ((value & 0x07) << 8);
        this.updateTriangle();
        break;

      case SOUND_IO.NOISE_CTRL:
        this.noiseCtrl = value;
        this.updateNoise();
        break;
      case SOUND_IO.NOISE_PERIOD:
        this.noisePeriod = value;
        this.updateNoise();
        break;

      case SOUND_IO.APU_STATUS:
        this.apuStatus = value;
        this.updateAllChannels();
        break;
    }
  }

  // Read from sound register
  read(addr: number): number {
    if (addr === SOUND_IO.APU_STATUS) {
      return this.apuStatus;
    }
    return 0;
  }

  // Convert NES timer value to frequency
  private timerToFreq(timer: number): number {
    if (timer === 0) return 0;
    // NES CPU clock is 1.789773 MHz, timer counts down
    // Frequency = CPU / (16 * (timer + 1))
    // We'll use a simpler approximation for our purposes
    return 1789773 / (16 * (timer + 1));
  }

  // Update pulse 1 channel
  private updatePulse1(): void {
    if (!this.audioCtx || !this.pulse1Gain) return;

    const enabled = (this.apuStatus & 0x01) !== 0;
    const volume = this.pulse1Ctrl & 0x0F;
    const duty = (this.pulse1Ctrl >> 6) & 0x03;
    const freq = this.timerToFreq(this.pulse1Timer);

    if (!enabled || freq < 20 || freq > 20000 || volume === 0) {
      this.pulse1Gain.gain.setTargetAtTime(0, this.audioCtx.currentTime, 0.01);
      return;
    }

    // Create or update oscillator
    if (!this.pulse1Osc) {
      this.pulse1Osc = this.createPulseOscillator(duty);
      this.pulse1Osc.connect(this.pulse1Gain);
      this.pulse1Osc.start();
    }

    this.pulse1Osc.frequency.setTargetAtTime(freq, this.audioCtx.currentTime, 0.01);
    this.pulse1Gain.gain.setTargetAtTime(volume / 15 * 0.5, this.audioCtx.currentTime, 0.01);
  }

  // Update pulse 2 channel
  private updatePulse2(): void {
    if (!this.audioCtx || !this.pulse2Gain) return;

    const enabled = (this.apuStatus & 0x02) !== 0;
    const volume = this.pulse2Ctrl & 0x0F;
    const duty = (this.pulse2Ctrl >> 6) & 0x03;
    const freq = this.timerToFreq(this.pulse2Timer);

    if (!enabled || freq < 20 || freq > 20000 || volume === 0) {
      this.pulse2Gain.gain.setTargetAtTime(0, this.audioCtx.currentTime, 0.01);
      return;
    }

    if (!this.pulse2Osc) {
      this.pulse2Osc = this.createPulseOscillator(duty);
      this.pulse2Osc.connect(this.pulse2Gain);
      this.pulse2Osc.start();
    }

    this.pulse2Osc.frequency.setTargetAtTime(freq, this.audioCtx.currentTime, 0.01);
    this.pulse2Gain.gain.setTargetAtTime(volume / 15 * 0.5, this.audioCtx.currentTime, 0.01);
  }

  // Update triangle channel
  private updateTriangle(): void {
    if (!this.audioCtx || !this.triGain) return;

    const enabled = (this.apuStatus & 0x04) !== 0;
    const freq = this.timerToFreq(this.triTimer);

    if (!enabled || freq < 20 || freq > 20000) {
      this.triGain.gain.setTargetAtTime(0, this.audioCtx.currentTime, 0.01);
      return;
    }

    if (!this.triOsc) {
      this.triOsc = this.audioCtx.createOscillator();
      this.triOsc.type = 'triangle';
      this.triOsc.connect(this.triGain);
      this.triOsc.start();
    }

    this.triOsc.frequency.setTargetAtTime(freq, this.audioCtx.currentTime, 0.01);
    this.triGain.gain.setTargetAtTime(0.5, this.audioCtx.currentTime, 0.01);
  }

  // Update noise channel
  private updateNoise(): void {
    if (!this.audioCtx || !this.noiseGain || !this.noiseBuffer) return;

    const enabled = (this.apuStatus & 0x08) !== 0;
    const volume = this.noiseCtrl & 0x0F;

    if (!enabled || volume === 0) {
      this.noiseGain.gain.setTargetAtTime(0, this.audioCtx.currentTime, 0.01);
      return;
    }

    // Create new noise source if needed
    if (!this.noiseSource) {
      this.noiseSource = this.audioCtx.createBufferSource();
      this.noiseSource.buffer = this.noiseBuffer;
      this.noiseSource.loop = true;
      this.noiseSource.connect(this.noiseGain);
      this.noiseSource.start();
    }

    // Adjust playback rate based on period
    const periodIdx = this.noisePeriod & 0x0F;
    const period = NOISE_PERIODS[periodIdx];
    this.noiseSource.playbackRate.value = 4068 / period;

    this.noiseGain.gain.setTargetAtTime(volume / 15 * 0.3, this.audioCtx.currentTime, 0.01);
  }

  // Update all channels based on status register
  private updateAllChannels(): void {
    this.updatePulse1();
    this.updatePulse2();
    this.updateTriangle();
    this.updateNoise();
  }

  // Create pulse oscillator with specific duty cycle
  private createPulseOscillator(duty: number): OscillatorNode {
    const osc = this.audioCtx!.createOscillator();

    // Create custom waveform for pulse wave
    const real = new Float32Array(32);
    const imag = new Float32Array(32);

    // Generate harmonics for pulse wave
    const dutyCycle = DUTY_CYCLES[duty];
    for (let n = 1; n < 32; n++) {
      let sum = 0;
      for (let k = 0; k < 8; k++) {
        sum += dutyCycle[k] * Math.sin(2 * Math.PI * n * k / 8);
      }
      imag[n] = sum / 4;
    }

    const wave = this.audioCtx!.createPeriodicWave(real, imag);
    osc.setPeriodicWave(wave);

    return osc;
  }

  // Resume audio context (call from user gesture)
  resume(): void {
    if (this.audioCtx?.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  // Stop all sound
  stop(): void {
    if (this.pulse1Gain) this.pulse1Gain.gain.value = 0;
    if (this.pulse2Gain) this.pulse2Gain.gain.value = 0;
    if (this.triGain) this.triGain.gain.value = 0;
    if (this.noiseGain) this.noiseGain.gain.value = 0;
  }

  // Clean up
  destroy(): void {
    this.stop();
    this.pulse1Osc?.stop();
    this.pulse2Osc?.stop();
    this.triOsc?.stop();
    this.noiseSource?.stop();
    this.audioCtx?.close();
  }
}
