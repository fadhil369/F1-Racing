import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { gsap } from 'gsap';
import { Car } from './game/Car';
import { AICar } from './game/AICar';
import { Track } from './game/Track';
import { InputManager } from './engine/Input';
import { SoundManager } from './engine/SoundManager';
import { CAR_TYPES, TRACK_LEVELS, CarStats, TrackLevel } from './game/GameData';

const TRACK_HALF_WIDTH = 9; 
const TOTAL_LAPS = 3;

export class Game {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private car?: Car;
  private bots: AICar[] = [];
  private track?: Track;
  private soundManager?: SoundManager;
  private input: InputManager;

  // ── Selection State ──────────────────────────────────────
  private selectedCarIndex = 0;
  private selectedTrack: TrackLevel = TRACK_LEVELS[0];
  private selectedDifficulty: 'Low' | 'Medium' | 'High' = 'Medium';
  private selectedGraphics: 'Low' | 'Medium' | 'High' = 'Medium';

  private gameStarted = false;
  private raceFinished = false;
  private lastTime = 0;
  private fps = 0;
  private frameCount = 0;
  private lastFpsTime = 0;
  private isMobile: boolean;

  // Preview Objects
  private previewCar?: Car;
  private pedestal?: THREE.Mesh;
  private showroomSpot?: THREE.SpotLight;
  private dirLight!: THREE.DirectionalLight;

  // UI Elements
  private startMenu: HTMLElement | null = null;
  private finishMenu: HTMLElement | null = null;
  private trackMenu: HTMLElement | null = null;
  private settingsMenu: HTMLElement | null = null;
  private mobileCtrl: HTMLElement | null = null;
  private debugHud: HTMLElement | null = null;
  private transitionOverlay: HTMLElement | null = null;

  // ── Scoring & Racing ──────────────────────────────────────
  private lap = 1;
  private lapStartTime = 0;
  private raceStartTime = 0;
  private bestLapMs = Infinity;
  private score = 0;
  private prevT = 0;
  private lapCrossedZero = false;
  private passedMidpoint = false;

  private animateId: number = 0;

  constructor() {
    // --- HMR Cleanup to prevent WebGL Context Limits & Black Screen ---
    // @ts-ignore
    if (window.game) {
      // @ts-ignore
      cancelAnimationFrame(window.game.animateId);
      // @ts-ignore
      if (window.game.renderer) {
        // @ts-ignore
        window.game.renderer.dispose();
        // @ts-ignore
        window.game.renderer.forceContextLoss();
        // @ts-ignore
        const oldDom = window.game.renderer.domElement;
        if (oldDom && oldDom.parentNode) {
          oldDom.parentNode.removeChild(oldDom);
        }
      }
    }
    this.isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || 
                    (window.innerWidth < 1000) || 
                    (navigator.maxTouchPoints > 0);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x05070c);
    this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 2000);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.domElement.tabIndex = 0;
    document.getElementById('app')?.appendChild(this.renderer.domElement);

    const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    pmremGenerator.compileEquirectangularShader();
    this.scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;

    this.dirLight = new THREE.DirectionalLight(0xffffff, 2.0);
    this.dirLight.position.set(20, 50, 20);
    this.dirLight.castShadow = true;
    this.dirLight.shadow.mapSize.set(1024, 1024);
    this.scene.add(this.dirLight);

    this.input = new InputManager();
    
    this.setupUI();
    this.setupHUD();
    this.initShowroom(); // Initial showroom state

    window.addEventListener('resize', () => this.onResize());
    
    // @ts-ignore
    window.game = this;
    this.animate();
  }

  private initShowroom() {
    this.scene.clear();
    this.scene.background = new THREE.Color(0x05070c);
    this.scene.fog = new THREE.FogExp2(0x05070c, 0.02);

    const amb = new THREE.AmbientLight(0xffffff, 0.4);
    this.scene.add(amb);
    this.scene.add(this.dirLight);

    // Showroom Spotlight
    this.showroomSpot = new THREE.SpotLight(0xffffff, 4.0);
    this.showroomSpot.position.set(0, 15, 5);
    this.showroomSpot.angle = Math.PI / 6;
    this.showroomSpot.penumbra = 0.4;
    this.showroomSpot.castShadow = true;
    this.scene.add(this.showroomSpot);
    this.showroomSpot.target.position.set(0, 0, 0);
    this.scene.add(this.showroomSpot.target);

    const fillLight = new THREE.PointLight(0xff4400, 15, 20);
    fillLight.position.set(2, 2, 2);
    this.scene.add(fillLight);

    // Pedestal
    const pedGeo = new THREE.CylinderGeometry(6, 6.5, 0.4, 64);
    const pedMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.1, metalness: 0.9, emissive: 0x111111 });
    this.pedestal = new THREE.Mesh(pedGeo, pedMat);
    this.pedestal.position.y = -0.2;
    this.scene.add(this.pedestal);

    const ring = new THREE.Mesh(new THREE.TorusGeometry(6, 0.08, 16, 100), new THREE.MeshBasicMaterial({ color: 0xff4400 }));
    ring.rotation.x = Math.PI/2; ring.position.y = 0.1;
    this.pedestal.add(ring);

    const glow = new THREE.Mesh(new THREE.RingGeometry(6.1, 6.4, 64), new THREE.MeshBasicMaterial({ color: 0xff2800, transparent:true, opacity:0.4, side:THREE.DoubleSide }));
    glow.rotation.x = Math.PI/2; glow.position.y = 0.12;
    this.pedestal.add(glow);

    // Ensure camera is looking at something
    this.camera.position.set(10, 5, 10);
    this.camera.lookAt(0, 1.2, 0);

    this.switchCar(0);
  }

  private setupUI() {
    this.startMenu = document.getElementById('start-menu');
    this.finishMenu = document.getElementById('finish-menu');
    this.trackMenu = document.getElementById('track-menu');
    this.settingsMenu = document.getElementById('settings-menu');
    this.mobileCtrl = document.getElementById('mobile-controls');
    this.debugHud = document.getElementById('debug-hud');
    this.transitionOverlay = document.getElementById('transition-overlay');
    
    document.getElementById('start-button')?.addEventListener('click', () => this.startRaceCinematic());
    document.getElementById('btn-select')?.addEventListener('click', () => this.startRaceCinematic());
    document.getElementById('restart-button')?.addEventListener('click', () => this.startRaceCinematic());
    document.getElementById('home-button')?.addEventListener('click', () => this.goToHome());

    // Fullscreen & Orientation
    document.getElementById('btn-fullscreen')?.addEventListener('click', () => this.toggleFullscreen());
    document.getElementById('btn-mobile-fullscreen')?.addEventListener('click', () => this.toggleFullscreen());
    document.getElementById('btn-force-landscape-top')?.addEventListener('click', () => this.requestLandscape());
    document.getElementById('btn-force-landscape-overlay')?.addEventListener('click', () => this.requestLandscape());

    // Settings
    document.getElementById('settings-trigger')?.addEventListener('click', () => this.toggleSettings(true));
    document.getElementById('close-settings')?.addEventListener('click', () => this.toggleSettings(false));
    document.getElementById('btn-save-settings')?.addEventListener('click', () => this.toggleSettings(false));

    // Sliders
    document.getElementById('diff-slider')?.addEventListener('input', (e) => {
        const val = (e.target as HTMLInputElement).value;
        this.selectedDifficulty = val === '0' ? 'Low' : val === '1' ? 'Medium' : 'High';
    });
    document.getElementById('gfx-slider')?.addEventListener('input', (e) => {
        const val = (e.target as HTMLInputElement).value;
        this.selectedGraphics = val === '0' ? 'Low' : val === '1' ? 'Medium' : 'High';
        this.updateGraphics();
    });

    this.setupMobileControls();
  }

  private setupMobileControls() {
    const btnLeft = document.getElementById('ctrl-left');
    const btnRight = document.getElementById('ctrl-right');
    const btnAccel = document.getElementById('ctrl-accel');
    const btnBrake = document.getElementById('ctrl-brake');

    const handleTouch = (el: HTMLElement | null, setter: (v: boolean) => void) => {
      if (!el) return;
      el.addEventListener('touchstart', (e) => {
        e.preventDefault();
        setter(true);
        el.classList.add('pressed');
      }, { passive: false });
      el.addEventListener('touchend', (e) => {
        e.preventDefault();
        setter(false);
        el.classList.remove('pressed');
      }, { passive: false });
      el.addEventListener('touchcancel', (e) => {
        e.preventDefault();
        setter(false);
        el.classList.remove('pressed');
      }, { passive: false });
    };

    handleTouch(btnLeft, (v) => this.input.setLeft(v));
    handleTouch(btnRight, (v) => this.input.setRight(v));
    handleTouch(btnAccel, (v) => this.input.setForward(v));
    handleTouch(btnBrake, (v) => this.input.setBrake(v));

    window.addEventListener('orientationchange', () => {
      setTimeout(() => this.onResize(), 100);
    });
  }

  private toggleSettings(show: boolean) {
    if (show) {
      this.settingsMenu?.classList.remove('hidden');
      gsap.fromTo(this.settingsMenu, { opacity: 0, scale: 0.9 }, { opacity: 1, scale: 1, duration: 0.4, ease: "back.out(1.7)" });
    } else {
      gsap.to(this.settingsMenu, { opacity: 0, scale: 0.9, duration: 0.3, onComplete: () => this.settingsMenu?.classList.add('hidden') });
    }
  }

  private async requestLandscape() {
    try {
        if (!document.fullscreenElement) {
            await document.documentElement.requestFullscreen();
        }
        // @ts-ignore
        if (screen.orientation && screen.orientation.lock) {
            // @ts-ignore
            await screen.orientation.lock('landscape').catch(e => console.log("Orientation lock failed:", e));
        }
    } catch (err) {
        console.error("Landscape request failed:", err);
    }
  }

  private updateGraphics() {
    if (!this.renderer) return;
    const pixelRatio = this.selectedGraphics === 'Low' ? 1 : 
                       this.selectedGraphics === 'Medium' ? 1.5 : 2;
    this.renderer.setPixelRatio(pixelRatio);
    this.renderer.shadowMap.enabled = this.selectedGraphics !== 'Low';
  }

  private toggleFullscreen() {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(err => {
            console.error(`Error attempting to enable full-screen mode: ${err.message}`);
        });
    } else {
        if (document.exitFullscreen) {
            document.exitFullscreen();
        }
    }
  }

  private setupHUD() {
    document.getElementById('prev-car')?.addEventListener('click', () => this.switchCar(-1));
    document.getElementById('next-car')?.addEventListener('click', () => this.switchCar(1));
    document.getElementById('btn-tracks')?.addEventListener('click', () => this.toggleTrackMenu(true));
    document.getElementById('close-tracks')?.addEventListener('click', () => this.toggleTrackMenu(false));

    // Populate Track List
    const list = document.getElementById('track-list');
    if (list) {
      TRACK_LEVELS.forEach(track => {
        const card = document.createElement('div');
        card.className = `track-card-aaa ${track.id === this.selectedTrack.id ? 'selected' : ''}`;
        card.innerHTML = `
          <div class="track-id-aaa">CIRCUIT ${track.id}</div>
          <div class="track-name-aaa">${track.name}</div>
          <div class="track-diff diff-${track.difficulty}">${track.difficulty}</div>
        `;
        card.onclick = () => {
          document.querySelectorAll('.track-card-aaa').forEach(c => c.classList.remove('selected'));
          card.classList.add('selected');
          this.selectedTrack = track;
          this.toggleTrackMenu(false);
        };
        list.appendChild(card);
      });
    }
  }

  private toggleTrackMenu(show: boolean) {
    if (!this.trackMenu) return;
    if (show) {
      this.trackMenu.classList.remove('hidden');
      gsap.fromTo(this.trackMenu.querySelector('.track-menu-inner'), { y: 50, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, ease: "power3.out" });
    } else {
      gsap.to(this.trackMenu.querySelector('.track-menu-inner'), { y: 50, opacity: 0, duration: 0.3, onComplete: () => this.trackMenu?.classList.add('hidden') });
    }
  }

  private switchCar(dir: number) {
    this.selectedCarIndex = (this.selectedCarIndex + dir + CAR_TYPES.length) % CAR_TYPES.length;
    const car = CAR_TYPES[this.selectedCarIndex];
    const prevCar = CAR_TYPES[(this.selectedCarIndex - 1 + CAR_TYPES.length) % CAR_TYPES.length];
    const nextCar = CAR_TYPES[(this.selectedCarIndex + 1) % CAR_TYPES.length];

    if (document.getElementById('active-car-name')) document.getElementById('active-car-name')!.textContent = car.name;
    if (document.getElementById('prev-name')) document.getElementById('prev-name')!.textContent = prevCar.name;
    if (document.getElementById('next-name')) document.getElementById('next-name')!.textContent = nextCar.name;

    this.updateStars('stat-speed', Math.floor((car.maxSpeed / 80) * 5));
    this.updateStars('stat-accel', Math.floor((car.acceleration / 30) * 5));
    this.updateStars('stat-handling', Math.floor((car.steerSpeed / 2) * 5));

    if (this.previewCar) {
      const oldBody = this.previewCar.visualBody;
      gsap.to(oldBody.position, { y: -2, opacity: 0, duration: 0.3, onComplete: () => { this.scene.remove(oldBody); } });
    }

    // Set initial position at 0, 0, 0 for showroom
    this.previewCar = new Car(this.scene, new THREE.Vector3(0, 0, 0), 0, car);
    this.previewCar.visualBody.scale.setScalar(2.2);
    this.previewCar.visualBody.position.y = -2; // Start visually below for animation
    gsap.to(this.previewCar.visualBody.position, { y: 0, duration: 0.6, ease: "back.out(1.7)" });

    // Camera push/pull with lookAt update
    const camTarget = new THREE.Vector3(0, 1.2, 0);
    gsap.to(this.camera.position, { 
      x: 10 + (Math.random() - 0.5) * 2, 
      y: 4 + (Math.random() - 0.5) * 1,
      z: 10 + (Math.random() - 0.5) * 2, 
      duration: 1, 
      ease: "power2.out",
      onUpdate: () => {
        this.camera.lookAt(camTarget);
      }
    });
  }

  private updateStars(id: string, count: number) {
    const container = document.getElementById(id);
    if (!container) return;
    container.innerHTML = '';
    for (let i = 0; i < 5; i++) {
        const star = document.createElement('div');
        star.className = i < count ? 'star-fill' : 'star';
        container.appendChild(star);
    }
  }

  private async startRaceCinematic() {
    if (!this.transitionOverlay) return;
    
    // Phase 1: Fade to Black
    if (this.isMobile && !document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
    }
    await gsap.to(this.transitionOverlay, { opacity: 1, duration: 0.6, ease: "power2.inOut" });
    
    // Phase 2: Init Game while black
    this.initGame();
    
    // Phase 3: Cinematic Camera Transition
    if (this.car) {
      const targetPos = this.car.position.clone().add(new THREE.Vector3(-Math.sin(this.car.angle) * 12, 5, -Math.cos(this.car.angle) * 12));
      this.camera.position.set(targetPos.x, targetPos.y + 20, targetPos.z);
      this.camera.lookAt(this.car.position);
    }
    
    // Phase 4: Fade back in
    await gsap.to(this.transitionOverlay, { opacity: 0, duration: 0.8, delay: 0.2 });
    
    // Phase 5: Start Countdown
    await this.startCountdown();
    
    // Phase 6: Start engine
    this.startGame();
  }

  private startCountdown(): Promise<void> {
    return new Promise(resolve => {
      const hud = document.getElementById('countdown-hud');
      const val = document.getElementById('countdown-val');
      if (!hud || !val) { resolve(); return; }

      hud.style.display = 'flex';
      const steps = ['3', '2', '1', 'GO!'];
      
      let stepIdx = 0;
      const interval = setInterval(() => {
        if (stepIdx >= steps.length) {
          clearInterval(interval);
          hud.style.display = 'none';
          resolve();
          return;
        }
        
        // Update value and trigger animation restart
        val.textContent = steps[stepIdx];
        
        // Force reflow to restart CSS animation
        val.classList.remove('countdown-anim');
        void val.offsetWidth; 
        val.classList.add('countdown-anim');
        
        if (steps[stepIdx] === 'GO!') {
            val.style.color = '#00ff88';
            val.style.textShadow = '0 0 50px rgba(0, 255, 136, 0.8), 0 0 20px rgba(0, 255, 136, 1)';
        } else {
            val.style.color = '#fff';
            val.style.textShadow = '0 0 50px rgba(255, 40, 0, 0.8), 0 0 20px rgba(255, 40, 0, 1)';
        }
        
        stepIdx++;
      }, 1000);
    });
  }

  private async initGame() {
    this.gameStarted = false;
    this.scene.clear();
    this.bots = [];
    
    this.scene.background = new THREE.Color(0x87ceeb);
    this.scene.fog = new THREE.FogExp2(0x87ceeb, 0.002);
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.4));
    this.scene.add(this.dirLight);

    this.track = new Track(this.scene, this.selectedTrack);

    const startT = 0.01;
    const startPos = this.track.curve.getPointAt(startT);
    const startTangent = this.track.curve.getTangentAt(startT).normalize();
    const startAngle = Math.atan2(startTangent.x, startTangent.z);
    
    this.car = new Car(this.scene, new THREE.Vector3(startPos.x, 0, startPos.z), startAngle, CAR_TYPES[this.selectedCarIndex]);
    this.prevT = startT;
    this.lap = 1;
    this.score = 0;
    this.bestLapMs = Infinity;
    this.passedMidpoint = false;

    const botColors = [0x555555, 0x00ff88, 0xff00ff];
    const laneOffsets = [-4, 4, -7];
    for(let i=0; i<3; i++) {
        this.bots.push(new AICar(this.scene, this.track.curve, botColors[i], laneOffsets[i], this.selectedDifficulty));
    }

    this.soundManager = new SoundManager(this.camera, this.car.visualBody);
  }

  private startGame() {
    this.gameStarted = true;
    this.raceFinished = false;
    this.lastTime = performance.now();
    this.raceStartTime = performance.now();
    this.lapStartTime = performance.now();
    
    if (this.startMenu) this.startMenu.style.display = 'none';
    if (this.finishMenu) this.finishMenu.style.display = 'none';
    if (this.debugHud) this.debugHud.style.display = 'block';
    if (this.isMobile || 'ontouchstart' in window) this.mobileCtrl?.classList.add('visible');
    
    const lapEl = document.getElementById('lap-val');
    if (lapEl) lapEl.textContent = '1';

    this.soundManager?.resume().catch(() => {});
    this.renderer.domElement.focus();
  }

  private async goToHome() {
    if (this.transitionOverlay) await gsap.to(this.transitionOverlay, { opacity: 1, duration: 0.4 });
    
    this.gameStarted = false;
    this.raceFinished = false;
    if (this.finishMenu) this.finishMenu.style.display = 'none';
    if (this.startMenu) this.startMenu.style.display = 'flex';
    if (this.debugHud) this.debugHud.style.display = 'none';
    this.mobileCtrl?.classList.remove('visible');
    
    this.initShowroom();

    if (this.transitionOverlay) gsap.to(this.transitionOverlay, { opacity: 0, duration: 0.4, delay: 0.2 });
  }

  private onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  private updateHUD() {
    if (!this.car) return;
    const fpsEl = document.getElementById('fps-val');
    if (fpsEl) fpsEl.textContent = Math.round(this.fps).toString();

    const kmh = Math.abs(this.car.speed);
    const speedEl = document.getElementById('speed-val');
    if (speedEl) speedEl.textContent = Math.round(kmh).toString();
    const fillEl = document.getElementById('speed-fill') as any;
    if (fillEl) {
      const pct = Math.min(kmh / 60, 1);
      fillEl.style.strokeDashoffset = String(173 - pct * 173);
    }
    
    // Vignette pulse with speed
    const vignette = document.querySelector('.vignette') as HTMLElement;
    if (vignette && this.car.speed > 40) {
      const pulse = 1 + (this.car.speed - 40) / 40;
      vignette.style.opacity = (Math.sin(Date.now() * 0.01) * 0.1 + 0.2).toString();
    } else if (vignette) {
      vignette.style.opacity = '0.3';
    }

    if (!this.raceFinished) this.updateScoring();
    this.drawMinimap();
  }

  private updateScoring() {
    if (!this.car || !this.track) return;
    const samples = 400;
    let closestT = 0, closestD = Infinity;
    for (let i = 0; i <= samples; i++) {
        const t = i / samples;
        const d = this.car.position.distanceToSquared(this.track.curve.getPointAt(t));
        if (d < closestD) { closestD = d; closestT = t; }
    }

    if (closestT > 0.4 && closestT < 0.6) {
        this.passedMidpoint = true;
    }

    if (this.prevT > 0.9 && closestT < 0.1 && !this.lapCrossedZero) {
      if (this.passedMidpoint) {
        this.lapCrossedZero = true;
        this.passedMidpoint = false; // Reset for the next lap
        
        const lapMs = performance.now() - this.lapStartTime;
        if (lapMs < this.bestLapMs) { this.bestLapMs = lapMs; this.flashBestLap(); }
        this.score += 1000 + Math.floor(Math.abs(this.car.speed) * 10);
        
        if (this.lap >= TOTAL_LAPS) this.finishRace();
        else {
          this.lap++;
          this.lapStartTime = performance.now();
          if (document.getElementById('lap-val')) document.getElementById('lap-val')!.textContent = String(this.lap);
        }
      }
    } else if (closestT > 0.1) {
       this.lapCrossedZero = false;
    }
    this.prevT = closestT;

    if (document.getElementById('score-val')) document.getElementById('score-val')!.textContent = this.score.toLocaleString();
    if (document.getElementById('laptime-val')) document.getElementById('laptime-val')!.textContent = this.formatTime(performance.now() - this.lapStartTime);
    if (document.getElementById('bestlap-val')) document.getElementById('bestlap-val')!.textContent = this.bestLapMs === Infinity ? '--:--.---' : this.formatTime(this.bestLapMs);
  }

  private async finishRace() {
    this.raceFinished = true;
    this.gameStarted = false;
    
    const playerProgress = this.lap + this.prevT;
    const results: { name: string, progress: number, isPlayer: boolean }[] = [];
    results.push({ name: 'YOU', progress: playerProgress, isPlayer: true });
    
    this.bots.forEach((bot, i) => {
        results.push({ name: `AI DRIVER ${i + 1}`, progress: bot.totalProgress, isPlayer: false });
    });

    results.sort((a, b) => b.progress - a.progress);
    
    let rank = 1;
    const listEl = document.getElementById('leaderboard-list');
    if (listEl) {
        listEl.innerHTML = '';
        results.forEach((r, idx) => {
            if (r.isPlayer) rank = idx + 1;
            const row = document.createElement('div');
            row.className = `leaderboard-row ${r.isPlayer ? 'player' : ''}`;
            
            const rSuffix = idx === 0 ? 'ST' : idx === 1 ? 'ND' : idx === 2 ? 'RD' : 'TH';
            row.innerHTML = `<span class="leaderboard-rank">${idx + 1}${rSuffix}</span>
                             <span class="leaderboard-name">${r.name}</span>`;
            listEl.appendChild(row);
        });
    }

    // Cinematic Pause before menu
    if (this.car) this.car.speed *= 0.2; 
    
    await new Promise(r => setTimeout(r, 1500));

    if (this.finishMenu) {
      this.finishMenu.style.display = 'flex';
      this.finishMenu.classList.toggle('grand-winner', rank === 1);
      
      const content = this.finishMenu.querySelector('.menu-content');
      gsap.fromTo(content, { opacity: 0, y: 100, scale: 0.8 }, { opacity: 1, y: 0, scale: 1, duration: 0.8, ease: "back.out(1.7)" });
    }

    if (this.debugHud) this.debugHud.style.display = 'none';

    const totalTimeMs = performance.now() - this.raceStartTime;
    const rankSuffix = rank === 1 ? 'ST' : rank === 2 ? 'ND' : rank === 3 ? 'RD' : 'TH';
    
    if (document.getElementById('final-rank')) {
        const el = document.getElementById('final-rank')!;
        el.textContent = `${rank}${rankSuffix}`;
        gsap.from(el, { scale: 3, opacity: 0, duration: 1, ease: "expo.out", delay: 0.5 });
    }
    
    // Animate stats one by one
    const resItems = document.querySelectorAll('.res-item');
    gsap.from(resItems, { 
        x: -50, 
        opacity: 0, 
        duration: 0.5, 
        stagger: 0.2, 
        delay: 1, 
        ease: "power2.out" 
    });

    if (document.getElementById('final-time')) document.getElementById('final-time')!.textContent = this.formatTime(totalTimeMs);
    if (document.getElementById('final-best')) document.getElementById('final-best')!.textContent = this.formatTime(this.bestLapMs);
    if (document.getElementById('final-score')) document.getElementById('final-score')!.textContent = this.score.toLocaleString();
  }

  private formatTime(ms: number) {
    const m = Math.floor(ms / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    const mil = Math.floor(ms % 1000);
    return `${m}:${String(s).padStart(2, '0')}.${String(mil).padStart(3, '0')}`;
  }

  private flashBestLap() {
    const el = document.getElementById('bestlap-val');
    if (el) { el.style.color = '#00ff88'; setTimeout(() => el.style.color = '', 2000); }
  }

  private drawMinimap() {
    if (!this.track) return;
    const canvas = document.getElementById('minimap-canvas') as HTMLCanvasElement;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const scale = 0.1, offX = canvas.width / 2, offY = canvas.height / 2;
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    this.track.curve.getSpacedPoints(100).forEach((p, i) => {
      if (i === 0) ctx.moveTo(p.x * scale + offX, p.z * scale + offY);
      else ctx.lineTo(p.x * scale + offX, p.z * scale + offY);
    });
    ctx.stroke();
    if (this.car) {
      ctx.fillStyle = '#ff2800'; ctx.beginPath();
      ctx.arc(this.car.position.x * scale + offX, this.car.position.z * scale + offY, 5, 0, Math.PI * 2); ctx.fill();
    }
  }

  private animate() {
    this.animateId = requestAnimationFrame(() => this.animate());
    const now = performance.now();
    const dt = Math.min((now - this.lastTime) / 1000, 0.05);
    this.lastTime = now;
    if (now - this.lastFpsTime > 1000) { this.fps = this.frameCount; this.frameCount = 0; this.lastFpsTime = now; }
    this.frameCount++;

    if (this.gameStarted && this.car && this.track) {
      this.car.update(this.input, dt);
      this.car.applyTrackConstraint(this.track.curve, TRACK_HALF_WIDTH);
      this.car.syncVisuals(dt);
      this.bots.forEach(bot => bot.updateAI(dt, this.track!.curve));
      const carPos = this.car.position.clone();
      const behind = new THREE.Vector3(-Math.sin(this.car.angle) * 12, 5, -Math.cos(this.car.angle) * 12);
      this.camera.position.lerp(carPos.clone().add(behind), 0.1);
      this.camera.lookAt(carPos.add(new THREE.Vector3(Math.sin(this.car.angle) * 5, 0.5, Math.cos(this.car.angle) * 5)));
      this.updateHUD();
      this.soundManager?.update(this.car.speedKmh);
    } else if (!this.gameStarted && this.previewCar && this.pedestal) {
      this.pedestal.rotation.y += 0.3 * dt;
      this.previewCar.angle = this.pedestal.rotation.y;
      this.previewCar.syncVisuals(dt);
    }
    this.renderer.render(this.scene, this.camera);
  }
}
new Game();
