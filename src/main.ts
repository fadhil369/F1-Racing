import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { InputManager } from './engine/Input';
import { Car } from './game/Car';
import { Track } from './game/Track';
import { AIController } from './game/AIController';
import { RaceManager } from './game/RaceManager';
import { PostProcess } from './engine/PostProcess';
import { SoundManager } from './engine/SoundManager';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';

class Game {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private physicsWorld: CANNON.World;
  
  private input: InputManager;
  private car: Car;
  private aiCars: { car: Car, controller: AIController }[] = [];
  private raceManager!: RaceManager;
  private track!: Track;
  private postProcess!: PostProcess;
  private soundManager!: SoundManager;
  private gameStarted = false;
  private lastTime = 0;

  constructor() {
    this.lastTime = performance.now();
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87CEEB);
    // Add some fog for depth
    this.scene.fog = new THREE.Fog(0x87CEEB, 20, 300);

    this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    
    // Mobile optimization: Cap pixel ratio at 2.0 to prevent lag on high-DPI phones
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const pixelRatio = isMobile ? Math.min(window.devicePixelRatio, 2.0) : window.devicePixelRatio;
    this.renderer.setPixelRatio(pixelRatio);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.getElementById('app')?.appendChild(this.renderer.domElement);

    // Physics settings for better mobile & desktop stability
    this.physicsWorld = new CANNON.World({
      gravity: new CANNON.Vec3(0, -9.81, 0),
    });
    
    // Improved material physics for better traction
    const defaultMaterial = new CANNON.Material("default");
    const contactMaterial = new CANNON.ContactMaterial(defaultMaterial, defaultMaterial, {
      friction: 0.7, // Increased from 0.1 for better traction
      restitution: 0.2,
      contactEquationStiffness: 1e8,
      contactEquationRelaxation: 3
    });
    this.physicsWorld.addContactMaterial(contactMaterial);
    this.physicsWorld.defaultContactMaterial = contactMaterial;

    this.setupLighting();
    
    // Create new advanced Track
    this.track = new Track(this.scene, this.physicsWorld);

    this.input = new InputManager();
    this.setupMobileControls();

    // Spawn Player Car (Aligned with start line, facing +X)
    this.car = new Car(this.scene, this.physicsWorld, new CANNON.Vec3(-10, 2, 0));
    this.car.chassisBody.quaternion.setFromEuler(0, Math.PI / 2, 0);

    // Initialize RaceManager first so AI can use it
    this.raceManager = new RaceManager([this.car], this.track, this.car);

    // Spawn AI Cars (Grid layout)
    const aiColors = [0x00ff00, 0x0000ff, 0xffff00];
    for (let i = 0; i < 3; i++) {
        const xOffset = -25 - (i * 15);
        const zOffset = (i % 2 === 0 ? 4 : -4);
        const aiCar = new Car(this.scene, this.physicsWorld, new CANNON.Vec3(xOffset, 2, zOffset));
        aiCar.chassisBody.quaternion.setFromEuler(0, Math.PI / 2, 0);
        
        // Change AI car color slightly
        aiCar.visualBody.traverse((child) => {
            if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshPhysicalMaterial) {
                child.material = (child.material as THREE.MeshPhysicalMaterial).clone();
                child.material.color.set(aiColors[i]);
            }
        });
        const controller = new AIController(aiCar, this.track, this.raceManager);
        this.aiCars.push({ car: aiCar, controller });
        // Add to race manager
        this.raceManager.cars.push(aiCar);
        this.raceManager.carData.set(aiCar, {
            lap: 1,
            lastU: 0,
            totalU: 0,
            isPlayer: false
        });
    }

    this.postProcess = new PostProcess(this.renderer, this.scene, this.camera);
    
    // Initialize SoundManager
    this.soundManager = new SoundManager(this.camera, this.car.visualBody);
    
    // Start Button Logic
    const startBtn = document.getElementById('start-button');
    startBtn?.addEventListener('click', () => {
        this.gameStarted = true;
        this.lastTime = performance.now(); // Reset timer to prevent physics stall
        this.soundManager.resume();
        
        // Ensure browser captures keyboard focus
        window.focus();
        this.renderer.domElement.focus();

        document.getElementById('start-menu')!.style.display = 'none';
        document.getElementById('game-ui')!.style.display = 'flex';
    });

    window.addEventListener('resize', this.onWindowResize.bind(this));

    this.animate();
  }

  private setupMobileControls() {
     const register = (id: string, action: (val: boolean) => void) => {
        const el = document.getElementById(id);
        if (!el) return;
        const handle = (e: Event, val: boolean) => {
           e.preventDefault();
           action(val);
        };
        el.addEventListener('pointerdown', (e) => handle(e, true));
        el.addEventListener('pointerup', (e) => handle(e, false));
        el.addEventListener('pointerleave', (e) => handle(e, false));
     };

     register('ctrl-left', (v) => this.input.setLeft(v));
     register('ctrl-right', (v) => this.input.setRight(v));
     register('ctrl-accel', (v) => this.input.setForward(v));
     register('ctrl-brake', (v) => this.input.setBrake(v));
  }

  private setupLighting() {
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
    dirLight.position.set(100, 100, 50);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 2048;
    dirLight.shadow.mapSize.height = 2048;
    // Cover a reasonable area for car movement
    const d = 50;
    dirLight.shadow.camera.near = 0.5;
    dirLight.shadow.camera.far = 500;
    dirLight.shadow.camera.left = -d;
    dirLight.shadow.camera.right = d;
    dirLight.shadow.camera.top = d;
    dirLight.shadow.camera.bottom = -d;
    // Set focus on car dynamic
    this.scene.add(dirLight);
    (this as any).dirLight = dirLight;

    // Load HDRI Environment Map
    const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    pmremGenerator.compileEquirectangularShader();
    
    new RGBELoader().load('/textures/env.hdr', (texture) => {
      const envMap = pmremGenerator.fromEquirectangular(texture).texture;
      this.scene.environment = envMap;
      this.scene.background = envMap; // Also set as background
      texture.dispose();
      pmremGenerator.dispose();
    });
  }

  // createPlaceholderTrack removed, using Track.ts

  private updateCamera() {
    // 3rd Person Camera Follow
    const carPos = this.car.visualBody.position;
    const carRot = this.car.visualBody.quaternion;
    const speed = Math.abs(this.car.vehicle.currentVehicleSpeedKmHour);

    // Relative camera offset
    const offset = new THREE.Vector3(0, 3.5, 12);
    offset.applyQuaternion(carRot);
    const targetCamPos = carPos.clone().add(offset);

    // Smooth camera movement
    this.camera.position.lerp(targetCamPos, 0.1);
    
    // Dynamic FOV based on speed
    const baseFOV = 60;
    const maxFOV = 85;
    this.camera.fov = baseFOV + (speed / 350) * (maxFOV - baseFOV);
    this.camera.updateProjectionMatrix();

    // Look ahead of car
    const lookAhead = new THREE.Vector3(0, 0, -10).applyQuaternion(carRot);
    this.camera.lookAt(carPos.clone().add(lookAhead));

    // Move directional light to cover car
    const dirLight = (this as any).dirLight;
    dirLight.position.copy(carPos).add(new THREE.Vector3(100, 100, 50));
    dirLight.target.position.copy(carPos);
    dirLight.target.updateMatrixWorld();
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

    // Update player car physics and controls
    this.car.update(this.input);

    const now = performance.now();
    const dt = (now - this.lastTime) / 1000;
    this.lastTime = now;

    // Stable physics stepping: use fixed step or variable with cap
    // Cannon-es prefers fixed steps. We'll do a few steps if delta is large.
    const fixedTimeStep = 1 / 60;
    const maxSubSteps = 10;
    this.physicsWorld.step(fixedTimeStep, dt, maxSubSteps);

    // Update race manager to get latest progress for all cars
    this.raceManager.update();

    // Update AI cars (now using fresh progress from RaceManager)
    this.aiCars.forEach(ai => ai.controller.update());

    this.updateCamera();

    // --- Update Reflections (Optimized: every 2nd frame) ---
    if (Math.floor(Date.now() / 16) % 2 === 0) {
        this.car.visualBody.visible = false;
        this.car.cubeCamera.update(this.renderer, this.scene);
        this.car.visualBody.visible = true;
    }

    const speedKmh = this.car.chassisBody.velocity.length() * 3.6;
    this.soundManager.update(speedKmh);

    this.postProcess.render();
  }
}

new Game();
