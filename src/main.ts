import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { Car } from './game/Car';
import { Track } from './game/Track';
import { InputManager } from './engine/Input';
import { SoundManager } from './engine/SoundManager';

export class Game {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private physicsWorld: CANNON.World;
  private car!: Car;
  private track!: Track;
  private soundManager!: SoundManager;
  private input: InputManager;
  
  private gameStarted = false;
  private lastTime = 0;
  private isMobile: boolean;

  constructor() {
    this.isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || (window.innerWidth < 800);
    
    // 1. Scene & Camera
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87ceeb); // Sky blue
    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 2000);
    
    // 2. Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    document.getElementById('app')?.appendChild(this.renderer.domElement);

    // 3. Physics
    this.physicsWorld = new CANNON.World();
    this.physicsWorld.gravity.set(0, -9.81, 0);
    
    // Default Contact Material
    const mat = new CANNON.Material("default");
    const contact = new CANNON.ContactMaterial(mat, mat, { friction: 1.0, restitution: 0.1 });
    this.physicsWorld.addContactMaterial(contact);
    this.physicsWorld.defaultContactMaterial = contact;

    // 4. Lights
    const amb = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(amb);
    const dir = new THREE.DirectionalLight(0xffffff, 1.0);
    dir.position.set(100, 100, 50);
    dir.castShadow = true;
    this.scene.add(dir);

    // 5. Track & Car
    this.track = new Track(this.scene, this.physicsWorld);
    this.car = new Car(this.scene, this.physicsWorld, new CANNON.Vec3(0, 1, 0));
    this.car.chassisBody.quaternion.setFromEuler(0, Math.PI / 2, 0);
    
    this.input = new InputManager();
    this.soundManager = new SoundManager(this.camera, this.car.visualBody);

    this.setupUI();
    
    window.addEventListener('resize', () => this.onResize());
    window.addEventListener('orientationchange', () => setTimeout(() => this.onResize(), 300));

    this.animate();
  }

  private setupUI() {
    const startBtn = document.getElementById('start-button');
    const startMenu = document.getElementById('start-menu');
    const mobileCtrl = document.getElementById('mobile-controls');
    const debugHud = document.getElementById('debug-hud');

    startBtn?.addEventListener('click', () => {
        this.gameStarted = true;
        this.lastTime = performance.now();
        if (startMenu) startMenu.style.display = 'none';
        if (debugHud) debugHud.style.display = 'block';
        
        // Force mobile controls visibility if on touch device
        if (this.isMobile || ('ontouchstart' in window)) {
            if (mobileCtrl) mobileCtrl.classList.add('visible');
        }

        this.soundManager.resume().catch(() => {});
        this.renderer.domElement.focus();
        this.onResize(); // Recalibrate on start
    });

    // Mobile Button Listeners
    const bind = (id: string, fn: (v: boolean) => void) => {
        const btn = document.getElementById(id);
        if (!btn) return;
        const press = (e: Event) => { e.preventDefault(); fn(true); btn.classList.add('pressed'); };
        const release = (e: Event) => { e.preventDefault(); fn(false); btn.classList.remove('pressed'); };
        
        btn.addEventListener('pointerdown', press);
        btn.addEventListener('pointerup', release);
        btn.addEventListener('pointercancel', release);
        btn.addEventListener('touchstart', press);
        btn.addEventListener('touchend', release);
    };

    bind('ctrl-left', (v) => this.input.setLeft(v));
    bind('ctrl-right', (v) => this.input.setRight(v));
    bind('ctrl-accel', (v) => this.input.setForward(v));
    bind('ctrl-brake', (v) => this.input.setBrake(v));
  }

  private onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  private updateHUD() {
    const pos = this.car.chassisBody.position;
    const posVal = document.getElementById('pos-val');
    if (posVal) posVal.textContent = `${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}, ${pos.z.toFixed(1)}`;
    
    const inputVal = document.getElementById('input-val');
    if (inputVal) {
        let active = [];
        if (this.input.forward) active.push("GAS");
        if (this.input.backward) active.push("BACK");
        if (this.input.left) active.push("LEFT");
        if (this.input.right) active.push("RIGHT");
        if (this.input.brake) active.push("BRAKE");
        inputVal.textContent = active.length > 0 ? active.join(" + ") : "NONE";
    }
  }

  private animate() {
    requestAnimationFrame(() => this.animate());

    if (!this.gameStarted) {
        this.renderer.render(this.scene, this.camera);
        return;
    }

    const now = performance.now();
    const dt = Math.min((now - this.lastTime) / 1000, 0.1);
    this.lastTime = now;

    // Phase 1: Input
    this.car.applyInput(this.input);
    
    // Phase 2: Physics (High precision sub-steps)
    this.physicsWorld.step(1/60, dt, 10);
    
    // Phase 3: Visuals
    this.car.syncVisuals();
    
    // Camera Follow
    const carPos = this.car.visualBody.position;
    const carRot = this.car.visualBody.quaternion;
    const offset = new THREE.Vector3(0, 4, -12).applyQuaternion(carRot);
    this.camera.position.lerp(carPos.clone().add(offset), 0.1);
    this.camera.lookAt(carPos.clone().add(new THREE.Vector3(0,0.5,5).applyQuaternion(carRot)));

    this.updateHUD();
    this.soundManager.update(this.car.vehicle.currentVehicleSpeedKmHour);
    this.renderer.render(this.scene, this.camera);
  }
}

new Game();
