// ==========================================================================
// Lord of the Hacks - Web Audio API Retro Sound Effects Synthesizer
// Generates dynamic 8-bit synth sound effects completely in-code.
// Avoids offline CORS issues and missing file asset errors.
// ==========================================================================

class AudioManager {
    constructor() {
        this.ctx = null;
        this.muted = false;
    }

    // Lazy initialization triggered on first user interaction
    init() {
        if (this.ctx) return;
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (AudioContextClass) {
            this.ctx = new AudioContextClass();
        }
    }

    // Helper to play a frequency-sweep tone
    _playTone(freqStart, freqEnd, duration, type = 'sine', gainStart = 0.1) {
        this.init();
        if (!this.ctx || this.muted) return;
        
        // Auto-resume if context is suspended by browser autoplay policy
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }

        const osc = this.ctx.createOscillator();
        const gainNode = this.ctx.createGain();

        osc.type = type;
        osc.frequency.setValueAtTime(freqStart, this.ctx.currentTime);
        if (freqEnd !== freqStart) {
            osc.frequency.exponentialRampToValueAtTime(freqEnd, this.ctx.currentTime + duration);
        }

        gainNode.gain.setValueAtTime(gainStart, this.ctx.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.0001, this.ctx.currentTime + duration);

        osc.connect(gainNode);
        gainNode.connect(this.ctx.destination);

        osc.start();
        osc.stop(this.ctx.currentTime + duration);
    }

    // Jump sound: quick upward pitch sweep (triangle wave)
    playJump() {
        this._playTone(150, 550, 0.16, 'triangle', 0.12);
    }

    // Melee attack: white noise burst simulated by a rapid sawtooth frequency drop
    playMelee() {
        this._playTone(900, 150, 0.11, 'sawtooth', 0.08);
    }

    // Ranged attack: short swoosh drop
    playRanged() {
        this._playTone(450, 100, 0.1, 'triangle', 0.1);
    }

    // Footstep: very quiet low-pitch thud
    playStep() {
        this._playTone(85, 35, 0.05, 'sine', 0.03);
    }

    // Hit damage: low rumble sawtooth sweep
    playHit() {
        this._playTone(280, 50, 0.22, 'sawtooth', 0.15);
    }

    // Coin collect: classic retro dual-note chime (B5 -> E6)
    playCoin() {
        this.init();
        if (!this.ctx || this.muted) return;
        if (this.ctx.state === 'suspended') this.ctx.resume();

        const now = this.ctx.currentTime;
        
        // Note 1 (B5)
        const osc1 = this.ctx.createOscillator();
        const gain1 = this.ctx.createGain();
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(987, now);
        gain1.gain.setValueAtTime(0.08, now);
        gain1.gain.linearRampToValueAtTime(0.0001, now + 0.08);
        osc1.connect(gain1);
        gain1.connect(this.ctx.destination);
        osc1.start(now);
        osc1.stop(now + 0.08);

        // Note 2 (E6)
        const osc2 = this.ctx.createOscillator();
        const gain2 = this.ctx.createGain();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(1318, now + 0.08);
        gain2.gain.setValueAtTime(0.08, now + 0.08);
        gain2.gain.linearRampToValueAtTime(0.0001, now + 0.08 + 0.22);
        osc2.connect(gain2);
        gain2.connect(this.ctx.destination);
        osc2.start(now + 0.08);
        osc2.stop(now + 0.08 + 0.22);
    }

    // Ring Toggle: arpeggio (rising for on, falling for off)
    playRingToggle(active) {
        this.init();
        if (!this.ctx || this.muted) return;
        if (this.ctx.state === 'suspended') this.ctx.resume();

        const now = this.ctx.currentTime;
        const notes = active ? [330, 495, 660, 990] : [990, 660, 495, 330];
        const duration = 0.09;

        notes.forEach((freq, i) => {
            const osc = this.ctx.createOscillator();
            const gainNode = this.ctx.createGain();
            
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, now + i * 0.045);
            
            gainNode.gain.setValueAtTime(0.06, now + i * 0.045);
            gainNode.gain.linearRampToValueAtTime(0.0001, now + i * 0.045 + duration);
            
            osc.connect(gainNode);
            gainNode.connect(this.ctx.destination);
            
            osc.start(now + i * 0.045);
            osc.stop(now + i * 0.045 + duration);
        });
    }

    // Nazgul Rider Scream: high pitch screech
    playScream() {
        this._playTone(950, 1800, 0.35, 'sawtooth', 0.07);
    }

    // Boss Explosion/Tower Collapse: low rumble sawtooth sweep
    playExplosion() {
        this._playTone(180, 30, 0.95, 'sawtooth', 0.25);
    }
}
