import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import { Car } from './game/Car';
import { Track } from './game/Track';
import { InputManager } from './engine/Input';
import { AIController } from './game/AIController';
import { RaceManager } from './game/RaceManager';
import { PostProcess } from './engine/PostProcess';
import { SoundManager } from './engine/SoundManager';

export class Game {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private physicsWorld: CANNON.World;
  private car!: Car;
  private aiCars: { car: Car, controller: AIController }[] = [];
  private raceManager!: RaceManager;
  private track!: Track;
  private postProcess!: PostProcess;
  private soundManager!: SoundManager;
  private rgbeLoader!: RGBELoader;
  private isMobile!: boolean;
  private gameStarted = false;
  private lastTime = 0;

  constructor() {
    // Basic Three.js setup
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 2000);
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    
    // Mobile Detection
    this.isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const pixelRatio = this.isMobile ? Math.min(window.devicePixelRatio, 1.5) : Math.min(window.devicePixelRatio, 2);
    this.renderer.setPixelRatio(pixelRatio);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    document.getElementById('app')?.appendChild(this.renderer.domElement);
    
    // Prevent default touch behaviors on canvas
    this.renderer.domElement.style.touchAction = 'none';
    this.renderer.domElement.setAttribute('tabindex', '0');

    // Physics setup
    this.physicsWorld = new CANNON.World();
    this.physicsWorld.gravity.set(0, -9.81, 0);
    
    // Improved material physics for maximum traction
    const defaultMaterial = new CANNON.Material("default");
    const contactMaterial = new CANNON.ContactMaterial(defaultMaterial, defaultMaterial, {
      friction: 1.0, 
      restitution: 0.1,
      contactEquationStiffness: 1e9,
      contactEquationRelaxation: 3
    });
    this.physicsWorld.addContactMaterial(contactMaterial);
    this.physicsWorld.defaultContactMaterial = contactMaterial;

    this.setupLighting();
    this.track = new Track(this.scene, this.physicsWorld);
    this.input = new InputManager();
    this.setupMobileControls();

    // Spawn Player Car
    this.car = new Car(this.scene, this.physicsWorld, new CANNON.Vec3(0, 1, 0));
    this.car.chassisBody.quaternion.setFromEuler(0, Math.PI / 2, 0);

    this.raceManager = new RaceManager([this.car], this.track, this.car);

    // Spawn AI Cars
    const aiColors = [0x00ff00, 0x0000ff, 0xffff00];
    for (let i = 0; i < 3; i++) {
        const xOffset = -25 - (i * 15);
        const zOffset = (i % 2 === 0 ? 4 : -4);
        const aiCar = new Car(this.scene, this.physicsWorld, new CANNON.Vec3(xOffset, 1, zOffset));
        aiCar.chassisBody.quaternion.setFromEuler(0, Math.PI / 2, 0);
        this.raceManager.cars.push(aiCar);
        const controller = new AIController(aiCar, this.track, this.raceManager);
        this.aiCars.push({ car: aiCar, controller });
    }

    this.postProcess = new PostProcess(this.renderer, this.scene, this.camera);
    this.soundManager = new SoundManager(this.camera, this.car.visualBody);
    
    // Start Button
    const startBtn = document.getElementById('start-button');
    startBtn?.addEventListener('click', () => {
        this.gameStarted = true;
        this.lastTime = performance.now();
        this.soundManager.resume().catch(console.error);
        
        // Capture focus aggressively
        window.focus();
        this.renderer.domElement.focus();

        document.getElementById('start-menu')!.style.display = 'none';
        
        // Use grid for buttons to ensure layout is correct
        const mc = document.getElementById('mobile-controls');
        if (mc) mc.style.display = 'grid';
    });

    window.addEventListener('resize', this.onWindowResize.bind(this));
    // Handle orientation change specifically for horizontal phone view
    window.addEventListener('orientationchange', () => {
        setTimeout(() => this.onWindowResize(), 300);
    });

    this.animate();
  }

  private input!: InputManager;

  private setupLighting() {
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    this.scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
    dirLight.position.set(100, 100, 50);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    dirLight.shadow.camera.left = -500;
    dirLight.shadow.camera.right = 500;
    dirLight.shadow.camera.top = 500;
    dirLight.shadow.camera.bottom = -500;
    dirLight.shadow.camera.far = 1000;
    this.scene.add(dirLight);
    (this as any).dirLight = dirLight;

    const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    pmremGenerator.compileEquirectangularShader();
    this.rgbeLoader = new RGBELoader();
    const basePath = (import.meta as any).env.BASE_URL || './';
    this.rgbeLoader.load(`${basePath}textures/env.hdr`, (texture: THREE.DataTexture) => {
        texture.mapping = THREE.EquirectangularReflectionMapping;
        this.scene.environment = texture;
        this.scene.background = texture;
        pmremGenerator.dispose();
    });
  }

  private setupMobileControls() {
     const register = (id: string, action: (val: boolean) => void) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.addEventListener('pointerdown', (e: PointerEvent) => {
           e.preventDefault();
           (e.target as Element).setPointerCapture(e.pointerId);
           action(true);
           el.classList.add('pressed');
        });
        el.addEventListener('pointerup', (e: PointerEvent) => {
           e.preventDefault();
           action(false);
           el.classList.remove('pressed');
        });
        el.addEventListener('pointercancel', (e: PointerEvent) => {
           e.preventDefault();
           action(false);
           el.classList.remove('pressed');
        });
     };

     register('ctrl-left',  (v) => this.input.setLeft(v));
     register('ctrl-right', (v) => this.input.setRight(v));
     register('ctrl-accel', (v) => this.input.setForward(v));
     register('ctrl-brake', (v) => this.input.setBrake(v));

     if (this.isMobile || window.matchMedia('(pointer: coarse)').matches) {
        document.getElementById('mobile-controls')?.classList.add('active');
     }
  }

  private updateCamera() {
    const carPos = this.car.visualBody.position;
    const carRot = this.car.visualBody.quaternion;
    const speed = Math.abs(this.car.vehicle.currentVehicleSpeedKmHour);

    const offset = new THREE.Vector3(0, 3.5, -12);
    offset.applyQuaternion(carRot);
    this.camera.position.lerp(carPos.clone().add(offset), 0.1);

    const baseFOV = 65;
    const maxFOV = 90;
    this.camera.fov = baseFOV + (speed / 350) * (maxFOV - baseFOV);
    this.camera.updateProjectionMatrix();

    const lookAhead = new THREE.Vector3(0, 0.5, 8).applyQuaternion(carRot);
    this.camera.lookAt(carPos.clone().add(lookAhead));

    const dirLight = (this as any).dirLight;
    if (dirLight) {
      dirLight.position.copy(carPos).add(new THREE.Vector3(100, 100, 50));
      dirLight.target.position.copy(carPos);
      dirLight.target.updateMatrixWorld();
    }
  }

  private onWindowResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.postProcess.setSize(window.innerWidth, window.innerHeight);
  }

  private animate() {
    requestAnimationFrame(this.animate.bind(this));
    
    if (!this.gameStarted) {
        this.updateCamera();
        this.postProcess.render();
        return;
    }

    // Two-phase update for perfect physics/visual sync
    this.car.applyInput(this.input);
    
    const now = performance.now();
    const dt = Math.min((now - this.lastTime) / 1000, 0.1); // Cap dt to prevent huge jumps
    this.lastTime = now;

    // Use higher sub-steps for precision
    this.physicsWorld.step(1/60, dt, 10);

    this.car.syncVisuals();
    this.raceManager.update();
    this.aiCars.forEach(ai => ai.controller.update());
    
    this.updateCamera();

    // Occasional reflection update
    if (Math.floor(now / 16) % 2 === 0) {
        this.car.visualBody.visible = false;
        this.car.cubeCamera.update(this.renderer, this.scene);
        this.car.visualBody.visible = true;
    }

    const speedKmh = this.car.chassisBody.velocity.length() * 3.6;
    this.soundManager.update(speedKmh);
    this.postProcess.render();
  }
}

// Global error handler
window.addEventListener('error', (e) => {
  const msg = document.createElement('div');
  msg.style.cssText = 'position:fixed;top:0;left:0;right:0;background:red;color:white;padding:20px;z-index:9999;font-size:14px;word-break:break-all;';
  msg.textContent = '⚠️ Error: ' + e.message;
  document.body.appendChild(msg);
});

try {
  new Game();
} catch(e) {
  const msg = document.createElement('div');
  msg.style.cssText = 'position:fixed;top:0;left:0;right:0;background:red;color:white;padding:20px;z-index:9999;';
  msg.textContent = 'Runtime Exception: ' + e;
  document.body.appendChild(msg);
}
