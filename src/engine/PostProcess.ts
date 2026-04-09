import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';

export class PostProcess {
  private composer: EffectComposer | null = null;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private useComposer = false;

  constructor(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.PerspectiveCamera) {
    this.renderer = renderer;
    this.scene = scene;
    this.camera = camera;

    // Only use EffectComposer on desktop — PostProcess effects crash on many mobile GPUs
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    if (!isMobile) {
      try {
        this.composer = new EffectComposer(renderer);
        const renderPass = new RenderPass(scene, camera);
        this.composer.addPass(renderPass);
        this.useComposer = true;
      } catch (e) {
        console.warn('PostProcess init failed, falling back to direct render:', e);
        this.useComposer = false;
      }
    }
  }

  public render() {
    if (this.useComposer && this.composer) {
      this.composer.render();
    } else {
      // Plain render — works on all devices
      this.renderer.render(this.scene, this.camera);
    }
  }

  public setSize(width: number, height: number) {
    if (this.composer) {
      this.composer.setSize(width, height);
    }
  }
}
