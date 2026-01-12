/**
 * Audio Engine (Procedural Sound Generation)
 * Generates all game sounds procedurally using Web Audio API
 */
export class AudioEngine {
    constructor() {
        this.ctx = null;
        this.masterGain = null;
        this.enabled = true;
    }

    init() {
        if (!this.ctx) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.ctx = new AudioContext();
            this.masterGain = this.ctx.createGain();
            this.masterGain.gain.value = 0.3; // Master volume
            this.masterGain.connect(this.ctx.destination);
        }
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    // Helper: Create an oscillator tone
    playTone(freq, type, duration, vol = 1, slideTo = null) {
        if (!this.enabled || !this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
        if (slideTo) {
            osc.frequency.exponentialRampToValueAtTime(slideTo, this.ctx.currentTime + duration);
        }
        gain.gain.setValueAtTime(vol, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);

        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start();
        osc.stop(this.ctx.currentTime + duration);
    }

    // Helper: Create Noise (Explosions, impacts, wind)
    playNoise(duration, vol = 1, filterFreq = 1000) {
        if (!this.enabled || !this.ctx) return;
        const bufferSize = this.ctx.sampleRate * duration;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

        const noise = this.ctx.createBufferSource();
        noise.buffer = buffer;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = filterFreq;

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(vol, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);

        noise.connect(filter);
        filter.connect(gain);
        gain.connect(this.masterGain);
        noise.start();
    }

    // --- SFX LIBRARY ---

    playBounce() { this.playTone(150, 'sine', 0.1, 0.5, 100); }

    playHit() {
        this.playNoise(0.1, 0.6, 800);
        this.playTone(100, 'square', 0.05, 0.2, 50);
    }

    playBlock() {
        // High pitched metallic ting
        this.playTone(1200, 'triangle', 0.3, 0.4);
        this.playTone(1800, 'sine', 0.1, 0.2);
    }

    // Character Specifics
    playSwordSwing() {
        this.playNoise(0.15, 0.3, 2000); // Whoosh
    }

    playGunshot() {
        this.playNoise(0.1, 0.6, 2000); // Crack
        this.playTone(150, 'sawtooth', 0.1, 0.3, 50); // Body
    }

    playGrenadeThrow() {
        this.playTone(400, 'triangle', 0.15, 0.3, 200);
    }

    playExplosion() {
        this.playNoise(0.8, 0.8, 400); // Deep rumble
        this.playTone(50, 'sawtooth', 0.4, 0.5, 10);
    }

    playZap() {
        // Electrical crackle
        this.playTone(600 + Math.random() * 200, 'sawtooth', 0.1, 0.1);
        this.playTone(1200, 'square', 0.05, 0.1, 200);
    }

    playThunder() {
        // Big heavy zap
        this.playTone(150, 'sawtooth', 0.4, 0.5, 50);
        this.playNoise(0.6, 0.6, 300);
    }

    playHeavyImpact() { // Shieldbearer Slam
        this.playTone(80, 'square', 0.3, 0.8, 30);
        this.playNoise(0.3, 0.5, 200);
    }

    playSpeedUp() {
        this.playTone(200, 'sine', 0.3, 0.3, 600);
    }

    playTeleport() { // Ninja Flash
        // Fast upward sweep (sci-fi)
        this.playTone(300, 'sine', 0.15, 0.4, 1500);
    }

    playKunaiThrow() {
        this.playTone(800, 'triangle', 0.05, 0.2, 1200); // High tick
    }

    playMissileLaunch() {
        this.playNoise(0.4, 0.7, 300); // Longer, deeper noise
        this.playTone(100, 'sawtooth', 0.3, 0.4, 20); // Dropping pitch
    }

    playRegen() {
        this.playTone(600, 'sine', 0.1, 0.1, 800); // Subtle rising bloop
    }

    playLaser(duration = 1.0) {
        if (!this.enabled || !this.ctx) return;

        const stopTime = this.ctx.currentTime + duration;

        const createPart = (freq, type, vol) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            osc.type = type;
            osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

            // Stable envelope: Fade in, Stay Flat, Fade out
            gain.gain.setValueAtTime(0, this.ctx.currentTime);
            gain.gain.linearRampToValueAtTime(vol, this.ctx.currentTime + 0.05);
            gain.gain.setValueAtTime(vol, stopTime - 0.1);
            gain.gain.linearRampToValueAtTime(0, stopTime);

            osc.connect(gain);
            gain.connect(this.masterGain);
            osc.start();
            osc.stop(stopTime);
        };

        // Harmonic Stack (Consistent, No Beating)
        createPart(60, 'sawtooth', 0.4);  // Sub Core
        createPart(120, 'sawtooth', 0.2); // Mid harmonic
        createPart(180, 'square', 0.1);   // High grit

        // Low Grit Noise
        this.playNoise(duration, 0.15, 300);
    }

    playPowerUp() {
        this.playTone(400, 'square', 0.2, 0.4, 800);
        this.playTone(600, 'sine', 0.2, 0.4, 1200);
    }

    playWin() {
        setTimeout(() => this.playTone(440, 'triangle', 0.2, 0.5), 0);
        setTimeout(() => this.playTone(554, 'triangle', 0.2, 0.5), 150);
        setTimeout(() => this.playTone(659, 'triangle', 0.4, 0.5), 300);
    }

    playSlash() {
        // Sharper, more metallic slash sound
        this.playNoise(0.1, 0.4, 4000); // Quick sharp whish
        this.playTone(1200, 'sawtooth', 0.15, 0.3, 400); // High metallic cut
        this.playTone(2000, 'sine', 0.05, 0.2); // Extremely high-pitch shimmer
    }

    playCleaveHit() {
        // Very short, sharp cutting sound for rapid ticks
        this.playNoise(0.05, 0.2, 5000); // High-frequency clip
        this.playTone(1500, 'sawtooth', 0.04, 0.1, 800); // Tiny sharp cut
    }

    playBlackhole() {
        // Deep ominous void sound
        // 1. Sub-bass drone
        if (!this.enabled || !this.ctx) return;

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(50, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(120, this.ctx.currentTime + 2.5); // Rising pitch

        gain.gain.setValueAtTime(0, this.ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.6, this.ctx.currentTime + 0.2);
        gain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 3.0);

        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start();
        osc.stop(this.ctx.currentTime + 3.0);

        // 2. Swirling noise
        this.playNoise(3.0, 0.2, 400);
    }

    playRealisticSlash() {
        // Premium Rapid Slash Sound
        // 1. Sharp Metal Whistle (Sine slice)
        this.playTone(2200, 'sine', 0.1, 0.25, 400);

        // 2. Gritty Steel Slide (Sawtooth)
        this.playTone(1500, 'sawtooth', 0.08, 0.2, 300);

        // 3. High Frequency Air Cut (Noise)
        this.playNoise(0.1, 0.35, 4500);
    }
}

// Singleton instance
export const audioEngine = new AudioEngine();
