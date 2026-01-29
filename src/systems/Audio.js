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

    // ============================================
    // UNIFIED PLAY METHOD (De-spaghettification)
    // ============================================
    // Allows playing sounds by string ID, e.g., audioEngine.play('zap')
    // Falls back to playHit() if the method doesn't exist
    play(soundId) {
        if (!soundId) {
            this.playHit();
            return;
        }
        const methodName = `play${soundId.charAt(0).toUpperCase() + soundId.slice(1)}`;
        if (typeof this[methodName] === 'function') {
            this[methodName]();
        } else {
            console.warn(`AudioEngine: Unknown sound ID '${soundId}', playing 'hit' instead`);
            this.playHit();
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

    playHirenkyaku() {
        // Sharp spiritual "blink" - high pitched chirp + fast sweep
        if (!this.enabled || !this.ctx) return;

        // 1. High frequency reishi chirp
        this.playTone(3200, 'triangle', 0.1, 0.3, 2400);

        // 2. Fast futuristic "zip"
        this.playTone(400, 'sine', 0.12, 0.4, 2000);

        // 3. High-pass noise burst for air displacement
        this.playNoise(0.08, 0.2, 5000);
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

    playZoltraak() {
        // Magical laser sound - high pitch, ethereal, quick end
        if (!this.enabled || !this.ctx) return;

        const duration = 0.25; // Much shorter than playLaser
        const stopTime = this.ctx.currentTime + duration;

        // High-pitched magical hum (main tone)
        const osc1 = this.ctx.createOscillator();
        const gain1 = this.ctx.createGain();
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(1200, this.ctx.currentTime);
        osc1.frequency.exponentialRampToValueAtTime(800, stopTime);
        gain1.gain.setValueAtTime(0.3, this.ctx.currentTime);
        gain1.gain.exponentialRampToValueAtTime(0.01, stopTime);
        osc1.connect(gain1);
        gain1.connect(this.masterGain);
        osc1.start();
        osc1.stop(stopTime);

        // Ethereal shimmer (triangle harmonics)
        const osc2 = this.ctx.createOscillator();
        const gain2 = this.ctx.createGain();
        osc2.type = 'triangle';
        osc2.frequency.setValueAtTime(2400, this.ctx.currentTime);
        osc2.frequency.exponentialRampToValueAtTime(1600, stopTime);
        gain2.gain.setValueAtTime(0.15, this.ctx.currentTime);
        gain2.gain.exponentialRampToValueAtTime(0.01, stopTime);
        osc2.connect(gain2);
        gain2.connect(this.masterGain);
        osc2.start();
        osc2.stop(stopTime);

        // Sparkle effect (very high frequency chirp)
        const osc3 = this.ctx.createOscillator();
        const gain3 = this.ctx.createGain();
        osc3.type = 'sine';
        osc3.frequency.setValueAtTime(3600, this.ctx.currentTime);
        osc3.frequency.exponentialRampToValueAtTime(2000, stopTime);
        gain3.gain.setValueAtTime(0.1, this.ctx.currentTime);
        gain3.gain.exponentialRampToValueAtTime(0.01, stopTime * 0.5);
        osc3.connect(gain3);
        gain3.connect(this.masterGain);
        osc3.start();
        osc3.stop(stopTime);

        // Light noise for "magic dust" feel
        this.playNoise(0.15, 0.08, 6000);
    }

    playZoltraakImpact() {
        // Magical impact - high pitched crystalline hit with magical resonance
        if (!this.enabled || !this.ctx) return;

        const now = this.ctx.currentTime;
        const duration = 0.4;

        // Crystalline "ting"
        this.playTone(2800, 'triangle', 0.1, 0.3, 1800);

        // Magical resonance pulse
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, now);
        osc.frequency.exponentialRampToValueAtTime(200, now + duration);

        gain.gain.setValueAtTime(0.4, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + duration);

        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.start();
        osc.stop(now + duration);

        // Magic sparkles noise
        this.playNoise(0.3, 0.15, 4000);
    }

    // ============================================
    // DEATH GOD SWORDSMAN (Ichigo) SOUND EFFECTS
    // ============================================

    playGetsuga() {
        // Blue Getsuga Tenshou - Whooshing energy wave
        // 1. Sharp energy release
        this.playTone(600, 'sawtooth', 0.3, 0.5, 200);
        // 2. Deep power undertone
        this.playTone(150, 'sine', 0.4, 0.4, 80);
        // 3. Wind whoosh
        this.playNoise(0.35, 0.4, 1500);
        // 4. Energy shimmer (High ring)
        this.playTone(1200, 'triangle', 0.25, 0.2, 800);
    }

    playGetsugaBankai() {
        // Black Getsuga Tenshou - More intense, darker sound
        // 1. Deep rumbling power
        this.playTone(80, 'sawtooth', 0.5, 0.6, 40);
        // 2. Sinister mid-frequency hum
        this.playTone(400, 'square', 0.4, 0.4, 150);
        this.playTone(600, 'sawtooth', 0.3, 0.3, 200);
        // 3. High energy crackling
        this.playTone(800, 'sawtooth', 0.2, 0.3, 400);
        // 4. Heavy impact noise
        this.playNoise(0.5, 0.5, 600);
    }

    playBankai() {
        // Bankai transformation - Epic power-up sound
        if (!this.enabled || !this.ctx) return;

        // 1. Deep building power
        const osc1 = this.ctx.createOscillator();
        const gain1 = this.ctx.createGain();
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(60, this.ctx.currentTime);
        osc1.frequency.exponentialRampToValueAtTime(200, this.ctx.currentTime + 0.8);
        gain1.gain.setValueAtTime(0, this.ctx.currentTime);
        gain1.gain.linearRampToValueAtTime(0.6, this.ctx.currentTime + 0.3);
        gain1.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 1.0);
        osc1.connect(gain1);
        gain1.connect(this.masterGain);
        osc1.start();
        osc1.stop(this.ctx.currentTime + 1.0);

        // 2. Rising energy sweep
        const osc2 = this.ctx.createOscillator();
        const gain2 = this.ctx.createGain();
        osc2.type = 'sawtooth';
        osc2.frequency.setValueAtTime(200, this.ctx.currentTime);
        osc2.frequency.exponentialRampToValueAtTime(1200, this.ctx.currentTime + 0.6);
        gain2.gain.setValueAtTime(0.3, this.ctx.currentTime);
        gain2.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.8);
        osc2.connect(gain2);
        gain2.connect(this.masterGain);
        osc2.start();
        osc2.stop(this.ctx.currentTime + 0.8);

        // 3. Power burst noise
        this.playNoise(0.6, 0.4, 800);

        // 4. Ethereal chime (spiritual power)
        setTimeout(() => this.playTone(880, 'triangle', 0.3, 0.3), 200);
        setTimeout(() => this.playTone(1320, 'sine', 0.2, 0.2), 350);
    }

    playBankaiPulse() {
        // Shorter, sharper version of the Bankai sound for the pulsating pressure
        this.playTone(100, 'sawtooth', 0.3, 0.4, 600);
        this.playNoise(0.25, 0.3, 1200);
        this.playTone(1500, 'sine', 0.1, 0.1, 800);
    }

    playHollowPurple() {
        // === HOLLOW PURPLE PREMIUM SFX ===
        // Massive, devastating energy fusion sound - Layered for Impact
        if (!this.enabled || !this.ctx) return;

        // LAYER 1: The "Snap" (Reality Break) - High-pitched crystalline impact
        this.playZoltraakImpact();

        // LAYER 2: The "Crackle" (Energy Discharge) - Raw electrical texture
        this.playThunder();

        const now = this.ctx.currentTime;
        const duration = 1.5;

        // LAYER 3: The "Weight" (Sub-Bass Drop) - Double oscillator for thickness
        this.playTone(50, 'sine', duration, 1.0, 5);         // Primary Deep Bass
        this.playTone(35, 'square', duration * 0.7, 0.3, 5); // Gritty Sub-Bass

        // LAYER 4: The "Scream" (Inverted Frequency Sweep)
        // Aggressive Sawtooth: Low -> High -> Low (Doppler-like tearing sound)
        const osc1 = this.ctx.createOscillator();
        const gain1 = this.ctx.createGain();
        osc1.type = 'sawtooth';
        osc1.frequency.setValueAtTime(150, now);
        osc1.frequency.exponentialRampToValueAtTime(1500, now + 0.15); // Fast rise
        osc1.frequency.exponentialRampToValueAtTime(50, now + duration); // Slow fall

        gain1.gain.setValueAtTime(0, now);
        gain1.gain.linearRampToValueAtTime(0.5, now + 0.05); // Sharp attack
        gain1.gain.exponentialRampToValueAtTime(0.01, now + duration);

        osc1.connect(gain1);
        gain1.connect(this.masterGain);
        osc1.start();
        osc1.stop(now + duration);

        // LAYER 5: The "Void" (Implosion Noise)
        // Filter sweeps High->Low to simulate collapse
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(4000, now); // Start bright
        filter.frequency.exponentialRampToValueAtTime(50, now + duration); // End dark

        const noiseBuffer = this.ctx.createBuffer(1, this.ctx.sampleRate * duration, this.ctx.sampleRate);
        const noiseData = noiseBuffer.getChannelData(0);
        for (let i = 0; i < noiseData.length; i++) noiseData[i] = Math.random() * 2 - 1;

        const noise = this.ctx.createBufferSource();
        noise.buffer = noiseBuffer;
        const noiseGain = this.ctx.createGain();
        noiseGain.gain.setValueAtTime(0.8, now); // Loud volume
        noiseGain.gain.exponentialRampToValueAtTime(0.01, now + duration);

        noise.connect(filter);
        filter.connect(noiseGain);
        noiseGain.connect(this.masterGain);
        noise.start();
    }
}


// Singleton instance
export const audioEngine = new AudioEngine();
