import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { SMAAPass } from 'three/examples/jsm/postprocessing/SMAAPass.js';

export class PostProcess {
  private composer: EffectComposer;
  private bloomPass: UnrealBloomPass;

  constructor(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.PerspectiveCamera) {
    this.composer = new EffectComposer(renderer);
    
    // 1. Render Pass
    const renderPass = new RenderPass(scene, camera);
    this.composer.addPass(renderPass);

    // 2. Anti-aliasing (SMAA)
    const smaaPass = new SMAAPass(); 
    this.composer.addPass(smaaPass);

    // 3. Bloom (For those glowing F1 lights and sun reflections)
    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      0.5, // strength
      0.4, // radius
      0.85 // threshold
    );
    this.composer.addPass(this.bloomPass);

    // 4. Custom Speed Motion Blur (Simplified)
    // We'll use a basic vignette/radial blur approach for speed sensation
  }

  public render() {
    this.composer.render();
  }

  public setSize(width: number, height: number) {
    this.composer.setSize(width, height);
  }
}
