import * as THREE from 'three';

export class SoundManager {
  private listener: THREE.AudioListener;
  private engineSound: THREE.PositionalAudio;
  private audioContext: AudioContext;
  
  private masterGain: GainNode;
  private filter: BiquadFilterNode;
  private distortion: WaveShaperNode;
  private oscillators: OscillatorNode[] = [];

  constructor(camera: THREE.PerspectiveCamera, carMesh: THREE.Object3D) {
    this.listener = new THREE.AudioListener();
    camera.add(this.listener);

    this.engineSound = new THREE.PositionalAudio(this.listener);
    carMesh.add(this.engineSound);

    this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    // Master volume control
    this.masterGain = this.audioContext.createGain();
    this.masterGain.gain.value = 0; // Start silent

    // F1 Engine requires aggressive distortion to mimic the exhaust crackle and mechanical roar
    this.distortion = this.audioContext.createWaveShaper();
    this.distortion.curve = this.makeDistortionCurve(40);
    this.distortion.oversample = '4x';
    
    // Filter creates the "screaming" effect by opening up high frequencies at high RPM
    this.filter = this.audioContext.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.frequency.value = 500;
    this.filter.Q.value = 3; // Resonance for that distinct whine
    
    // Base engine grumble (V6/V10 lower harmonics)
    const subOsc = this.audioContext.createOscillator();
    subOsc.type = 'sawtooth';
    const subGain = this.audioContext.createGain();
    subGain.gain.value = 0.6;
    subOsc.connect(subGain);
    
    // Main engine scream (High harmonics)
    const osc1 = this.audioContext.createOscillator();
    osc1.type = 'sawtooth';
    const gain1 = this.audioContext.createGain();
    gain1.gain.value = 0.8;
    osc1.connect(gain1);
    
    // Detuned oscillator for mechanical richness
    const osc2 = this.audioContext.createOscillator();
    osc2.type = 'sawtooth'; 
    const gain2 = this.audioContext.createGain();
    gain2.gain.value = 0.6;
    osc2.connect(gain2);

    // Straight-cut gear whine / Turbo whistle
    const whineOsc = this.audioContext.createOscillator();
    whineOsc.type = 'triangle'; 
    const whineGain = this.audioContext.createGain();
    whineGain.gain.value = 0.15;
    whineOsc.connect(whineGain);
    
    // Routing
    subGain.connect(this.distortion);
    gain1.connect(this.distortion);
    gain2.connect(this.distortion);
    
    // Whine bypasses distortion to stay clean and piercing
    whineGain.connect(this.filter); 
    this.distortion.connect(this.filter);
    
    this.filter.connect(this.masterGain);
    this.masterGain.connect(this.audioContext.destination);
    
    this.oscillators = [subOsc, osc1, osc2, whineOsc];
    this.oscillators.forEach(o => o.start());
  }

  // Create a sigmoid distortion curve
  private makeDistortionCurve(amount: number) {
    const k = amount;
    const n_samples = 44100;
    const curve = new Float32Array(n_samples);
    const deg = Math.PI / 180;
    for (let i = 0; i < n_samples; ++i) {
      const x = (i * 2) / n_samples - 1;
      curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
    }
    return curve;
  }

  public update(speedKmh: number) {
    if (this.audioContext.state === 'suspended') return;

    const speedRatio = Math.max(0, Math.min(speedKmh / 350, 1.0));
    
    // 8-Speed Gearbox Simulation
    const gearConfigs = [
       { minSpeed: 0, maxSpeed: 40 },
       { minSpeed: 30, maxSpeed: 85 },
       { minSpeed: 75, maxSpeed: 135 },
       { minSpeed: 120, maxSpeed: 175 },
       { minSpeed: 165, maxSpeed: 215 },
       { minSpeed: 205, maxSpeed: 255 },
       { minSpeed: 245, maxSpeed: 295 },
       { minSpeed: 285, maxSpeed: 360 }
    ];
    
    let currentGear = 0;
    for (let i = 0; i < gearConfigs.length; i++) {
        if (speedKmh >= gearConfigs[i].minSpeed) currentGear = i;
        else break;
    }
    
    const gear = gearConfigs[currentGear];
    let gearRatio = (speedKmh - gear.minSpeed) / (gear.maxSpeed - gear.minSpeed);
    gearRatio = Math.max(0, Math.min(gearRatio, 1));
    
    // F1 engines idle high and scream at max RPM. Base pitch rises with gears.
    const idleFreq = 100 + (currentGear * 8); 
    const maxFreq = 650 + (currentGear * 20);
    
    // The pitch rises rapidly within the gear
    const targetFreq = idleFreq + (maxFreq - idleFreq) * gearRatio;
    const smoothT = this.audioContext.currentTime + 0.1;
    
    // Apply frequencies to our synthesis engine
    this.oscillators[0].frequency.setTargetAtTime(targetFreq * 0.5, smoothT, 0.05); // Sub
    this.oscillators[1].frequency.setTargetAtTime(targetFreq, smoothT, 0.05);       // Main
    this.oscillators[2].frequency.setTargetAtTime(targetFreq * 1.015, smoothT, 0.05); // Detune
    this.oscillators[3].frequency.setTargetAtTime(targetFreq * 2.8, smoothT, 0.05); // Gear whine
    
    // Filter opens up completely as RPM rises, letting the scream out
    const filterFreq = 800 + (gearRatio * 4000);
    this.filter.frequency.setTargetAtTime(filterFreq, smoothT, 0.05);

    // Throttle load simulation (louder and more aggressive when pushing)
    const loadVolume = speedKmh > 5 ? (0.3 + speedRatio * 0.4) : 0.1; 
    this.masterGain.gain.setTargetAtTime(loadVolume, smoothT, 0.05);
  }

  public async resume() {
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }
  }
}
