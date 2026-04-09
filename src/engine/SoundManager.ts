import * as THREE from 'three';

export class SoundManager {
  private listener: THREE.AudioListener;
  private engineSound: THREE.PositionalAudio;
  private audioContext: AudioContext;
  private oscillator: OscillatorNode;
  private gain: GainNode;

  constructor(camera: THREE.PerspectiveCamera, carMesh: THREE.Object3D) {
    this.listener = new THREE.AudioListener();
    camera.add(this.listener);

    this.engineSound = new THREE.PositionalAudio(this.listener);
    carMesh.add(this.engineSound);

    // Initializing Web Audio for a synthesized engine sound
    this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    // Create oscillator for "thrumming" engine
    this.oscillator = this.audioContext.createOscillator();
    this.oscillator.type = 'sawtooth';
    
    this.gain = this.audioContext.createGain();
    this.gain.gain.value = 0; // Start silent

    this.oscillator.connect(this.gain);
    this.gain.connect(this.audioContext.destination);
    
    this.oscillator.start();
  }

  public update(speedKmh: number) {
    if (this.audioContext.state === 'suspended') {
      // Audio needs a user gesture to start usually, handled in start()
      return;
    }

    // Map speed to pitch
    // Base 50Hz, max 400Hz
    const baseFreq = 50;
    const freq = baseFreq + (speedKmh / 350) * 350;
    this.oscillator.frequency.setTargetAtTime(freq, this.audioContext.currentTime, 0.1);

    // Map speed to volume (simulating load)
    const volume = 0.1 + (speedKmh / 350) * 0.4;
    this.gain.gain.setTargetAtTime(volume, this.audioContext.currentTime, 0.1);
  }

  public resume() {
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }
  }
}
