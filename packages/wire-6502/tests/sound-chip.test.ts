import { describe, it, expect, beforeEach } from 'vitest';
import { SoundChip, SOUND_IO } from '../src/web/sound-chip.js';

describe('SoundChip', () => {
  let sound: SoundChip;

  beforeEach(() => {
    sound = new SoundChip();
  });

  describe('register addresses', () => {
    it('should have correct pulse 1 register addresses', () => {
      expect(SOUND_IO.PULSE1_CTRL).toBe(0x8070);
      expect(SOUND_IO.PULSE1_SWEEP).toBe(0x8071);
      expect(SOUND_IO.PULSE1_LO).toBe(0x8072);
      expect(SOUND_IO.PULSE1_HI).toBe(0x8073);
    });

    it('should have correct pulse 2 register addresses', () => {
      expect(SOUND_IO.PULSE2_CTRL).toBe(0x8074);
      expect(SOUND_IO.PULSE2_SWEEP).toBe(0x8075);
      expect(SOUND_IO.PULSE2_LO).toBe(0x8076);
      expect(SOUND_IO.PULSE2_HI).toBe(0x8077);
    });

    it('should have correct triangle register addresses', () => {
      expect(SOUND_IO.TRI_CTRL).toBe(0x8078);
      expect(SOUND_IO.TRI_UNUSED).toBe(0x8079);
      expect(SOUND_IO.TRI_LO).toBe(0x807A);
      expect(SOUND_IO.TRI_HI).toBe(0x807B);
    });

    it('should have correct noise register addresses', () => {
      expect(SOUND_IO.NOISE_CTRL).toBe(0x807C);
      expect(SOUND_IO.NOISE_UNUSED).toBe(0x807D);
      expect(SOUND_IO.NOISE_PERIOD).toBe(0x807E);
      expect(SOUND_IO.NOISE_LENGTH).toBe(0x807F);
    });

    it('should have correct APU status address', () => {
      expect(SOUND_IO.APU_STATUS).toBe(0x8080);
    });
  });

  describe('APU status register', () => {
    it('should initialize with all channels disabled', () => {
      expect(sound.read(SOUND_IO.APU_STATUS)).toBe(0);
    });

    it('should enable pulse 1 channel (bit 0)', () => {
      sound.write(SOUND_IO.APU_STATUS, 0x01);
      expect(sound.read(SOUND_IO.APU_STATUS)).toBe(0x01);
    });

    it('should enable pulse 2 channel (bit 1)', () => {
      sound.write(SOUND_IO.APU_STATUS, 0x02);
      expect(sound.read(SOUND_IO.APU_STATUS)).toBe(0x02);
    });

    it('should enable triangle channel (bit 2)', () => {
      sound.write(SOUND_IO.APU_STATUS, 0x04);
      expect(sound.read(SOUND_IO.APU_STATUS)).toBe(0x04);
    });

    it('should enable noise channel (bit 3)', () => {
      sound.write(SOUND_IO.APU_STATUS, 0x08);
      expect(sound.read(SOUND_IO.APU_STATUS)).toBe(0x08);
    });

    it('should enable all channels', () => {
      sound.write(SOUND_IO.APU_STATUS, 0x0F);
      expect(sound.read(SOUND_IO.APU_STATUS)).toBe(0x0F);
    });

    it('should disable all channels', () => {
      sound.write(SOUND_IO.APU_STATUS, 0x0F);
      sound.write(SOUND_IO.APU_STATUS, 0x00);
      expect(sound.read(SOUND_IO.APU_STATUS)).toBe(0x00);
    });
  });

  describe('pulse channel registers', () => {
    it('should write and preserve pulse 1 control', () => {
      // Write duty cycle and volume (duty=50%, volume=15)
      sound.write(SOUND_IO.PULSE1_CTRL, 0x8F);
      // Note: These are internal registers - we can only verify they don't crash
      // The actual values are private. This tests the write path.
    });

    it('should write pulse 1 timer low byte', () => {
      sound.write(SOUND_IO.PULSE1_LO, 0xAA);
      // Timer is combined from LO and HI registers internally
    });

    it('should write pulse 1 timer high byte', () => {
      sound.write(SOUND_IO.PULSE1_HI, 0x05);
      // High byte contains bits 8-10 of timer (& 0x07)
    });

    it('should write pulse 2 control', () => {
      sound.write(SOUND_IO.PULSE2_CTRL, 0xCF);
    });

    it('should write pulse 2 timer', () => {
      sound.write(SOUND_IO.PULSE2_LO, 0x55);
      sound.write(SOUND_IO.PULSE2_HI, 0x03);
    });
  });

  describe('triangle channel registers', () => {
    it('should write triangle control', () => {
      sound.write(SOUND_IO.TRI_CTRL, 0x80);
    });

    it('should write triangle timer low byte', () => {
      sound.write(SOUND_IO.TRI_LO, 0xFF);
    });

    it('should write triangle timer high byte', () => {
      sound.write(SOUND_IO.TRI_HI, 0x07);
    });
  });

  describe('noise channel registers', () => {
    it('should write noise control (volume)', () => {
      sound.write(SOUND_IO.NOISE_CTRL, 0x0F);
    });

    it('should write noise period', () => {
      sound.write(SOUND_IO.NOISE_PERIOD, 0x8A);
      // High bit is mode flag, low 4 bits are period index
    });
  });

  describe('register read behavior', () => {
    it('should return 0 for non-status registers', () => {
      // Most APU registers are write-only, reads return 0
      expect(sound.read(SOUND_IO.PULSE1_CTRL)).toBe(0);
      expect(sound.read(SOUND_IO.PULSE1_LO)).toBe(0);
      expect(sound.read(SOUND_IO.PULSE2_CTRL)).toBe(0);
      expect(sound.read(SOUND_IO.TRI_CTRL)).toBe(0);
      expect(sound.read(SOUND_IO.NOISE_CTRL)).toBe(0);
    });

    it('should only allow reading APU status', () => {
      sound.write(SOUND_IO.APU_STATUS, 0x0F);
      expect(sound.read(SOUND_IO.APU_STATUS)).toBe(0x0F);
      // Other registers remain write-only
      expect(sound.read(SOUND_IO.PULSE1_LO)).toBe(0);
    });
  });

  describe('initialization without audio context', () => {
    it('should handle operations without audio context', () => {
      // Without calling init(), no audio context exists
      // All writes should succeed without crashing
      sound.write(SOUND_IO.APU_STATUS, 0x0F);
      sound.write(SOUND_IO.PULSE1_CTRL, 0x8F);
      sound.write(SOUND_IO.PULSE1_LO, 0xFF);
      sound.write(SOUND_IO.PULSE1_HI, 0x07);
      sound.write(SOUND_IO.PULSE2_CTRL, 0x4F);
      sound.write(SOUND_IO.TRI_LO, 0x80);
      sound.write(SOUND_IO.NOISE_CTRL, 0x0F);
      sound.write(SOUND_IO.NOISE_PERIOD, 0x05);
      // Should not throw
    });

    it('should handle stop() without audio context', () => {
      sound.stop();
      // Should not throw
    });

    it('should handle destroy() without audio context', () => {
      sound.destroy();
      // Should not throw
    });

    it('should handle resume() without audio context', () => {
      sound.resume();
      // Should not throw
    });
  });

  describe('duty cycle bit patterns', () => {
    // Test that different duty cycles can be set via CTRL register
    it('should accept 12.5% duty cycle (bits 6-7 = 00)', () => {
      sound.write(SOUND_IO.PULSE1_CTRL, 0x0F); // duty=00, vol=15
    });

    it('should accept 25% duty cycle (bits 6-7 = 01)', () => {
      sound.write(SOUND_IO.PULSE1_CTRL, 0x4F); // duty=01, vol=15
    });

    it('should accept 50% duty cycle (bits 6-7 = 10)', () => {
      sound.write(SOUND_IO.PULSE1_CTRL, 0x8F); // duty=10, vol=15
    });

    it('should accept 75% duty cycle (bits 6-7 = 11)', () => {
      sound.write(SOUND_IO.PULSE1_CTRL, 0xCF); // duty=11, vol=15
    });
  });

  describe('volume control', () => {
    it('should accept minimum volume (0)', () => {
      sound.write(SOUND_IO.PULSE1_CTRL, 0x80); // volume = 0
    });

    it('should accept maximum volume (15)', () => {
      sound.write(SOUND_IO.PULSE1_CTRL, 0x8F); // volume = 15
    });

    it('should accept noise volume', () => {
      sound.write(SOUND_IO.NOISE_CTRL, 0x0C); // volume = 12
    });
  });

  describe('noise period index', () => {
    it('should accept all 16 noise period values', () => {
      for (let period = 0; period < 16; period++) {
        sound.write(SOUND_IO.NOISE_PERIOD, period);
        // Should not throw
      }
    });

    it('should accept noise mode flag (bit 7)', () => {
      sound.write(SOUND_IO.NOISE_PERIOD, 0x80); // mode=1, period=0
      sound.write(SOUND_IO.NOISE_PERIOD, 0x8F); // mode=1, period=15
    });
  });
});
