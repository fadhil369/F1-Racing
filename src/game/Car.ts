import * as THREE from 'three';
import { gsap } from 'gsap';
import { InputManager } from '../engine/Input';
import { CarStats } from './GameData';
import { createF1CarModel } from './F1CarModel';

export class Car {
  public visualBody: THREE.Group;
  private wheelMeshes: THREE.Mesh[] = [];

  // Movement state
  public speed = 0;
  public angle = 0; 
  public position = new THREE.Vector3(0, 0, 0);

  // Tuning (initialized from stats)
  public steerSpeed: number;
  private maxSpeed: number;
  private acceleration: number;
  private readonly MAX_REVERSE = 20;
  private readonly BRAKING = 30;
  private readonly DRAG = 8;
  private readonly WHEEL_RADIUS = 0.35;

  private wheelRotation = 0;
  private steerAngle = 0;
  private prevPosition = new THREE.Vector3();
  public isOffTrack = false;

  constructor(scene: THREE.Scene, startPos: THREE.Vector3, startAngle: number, stats: CarStats) {
    this.position.copy(startPos);
    this.angle = startAngle;
    
    this.steerSpeed = stats.steerSpeed;
    this.maxSpeed = stats.maxSpeed;
    this.acceleration = stats.acceleration;

    this.visualBody = new THREE.Group();
    this.buildBody(stats);
    scene.add(this.visualBody);

    this.setupWheels(scene);
    this.syncVisuals(0);
  }

  private buildBody(stats: CarStats) {
    const f1Model = createF1CarModel(stats.color);
    
    // Some basic variations for other types if needed, otherwise use base
    if (stats.name.includes('AERO')) {
        f1Model.scale.set(0.9, 0.9, 1.1); // Slightly longer/skinnier
    } else if (stats.name.includes('STINGRAY')) {
        f1Model.scale.set(1.1, 1.0, 0.9); // Slightly wider/shorter
    }

    this.visualBody.add(f1Model);
  }

  private buildGTPro(mat: THREE.Material, matBlack: THREE.Material, matCarbon: THREE.Material) {
    // Balanced F1 Look
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.35, 3.8), mat);
    this.visualBody.add(body);

    const nose = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.2, 1.4), mat);
    nose.position.set(0, -0.05, 2.5);
    this.visualBody.add(nose);

    const fWing = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.05, 0.5), matBlack);
    fWing.position.set(0, -0.15, 3.1);
    this.visualBody.add(fWing);

    const cockpit = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.3, 1.0), matCarbon);
    cockpit.position.set(0, 0.3, 0.2);
    this.visualBody.add(cockpit);

    const rWing = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.05, 0.6), matBlack);
    rWing.position.set(0, 0.55, -1.8);
    this.visualBody.add(rWing);
    
    this.addPillars(matBlack, -1.8, 0.5);
  }

  private buildAeroMax(mat: THREE.Material, matBlack: THREE.Material, matCarbon: THREE.Material) {
    // High Speed / Long Nose / Low Body
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.25, 4.4), mat);
    this.visualBody.add(body);

    const nose = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.15, 2.0), mat);
    nose.position.set(0, -0.1, 3.0);
    this.visualBody.add(nose);

    const fWing = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.04, 0.6), matBlack);
    fWing.position.set(0, -0.2, 3.8);
    this.visualBody.add(fWing);

    const cockpit = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.25, 1.2), matCarbon);
    cockpit.position.set(0, 0.2, 0.5);
    this.visualBody.add(cockpit);

    const rWing = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.05, 0.85), matBlack);
    rWing.position.set(0, 0.45, -2.1);
    this.visualBody.add(rWing);
    
    this.addPillars(matBlack, -2.1, 0.4);
  }

  private buildStingray(mat: THREE.Material, matBlack: THREE.Material, matCarbon: THREE.Material) {
    // Sharp / Aggressive / Technical
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.4, 3.2), mat);
    this.visualBody.add(body);

    // V-Shape nose (approximated with triangle-like box)
    const nose = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.25, 1.0), mat);
    nose.position.set(0, 0, 2.0);
    nose.scale.x = 0.5; // Tapering
    this.visualBody.add(nose);

    const fWing = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.08, 0.4), matBlack);
    fWing.position.set(0, -0.1, 2.4);
    this.visualBody.add(fWing);

    const cockpit = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.4, 0.8), matCarbon);
    cockpit.position.set(0, 0.4, 0.0);
    this.visualBody.add(cockpit);

    const rWing = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.1, 0.5), matBlack);
    rWing.position.set(0, 0.7, -1.5);
    this.visualBody.add(rWing);
    
    this.addPillars(matBlack, -1.5, 0.6);
  }

  private addPillars(mat: THREE.Material, z: number, h: number) {
    const pL = new THREE.Mesh(new THREE.BoxGeometry(0.05, h, 0.05), mat);
    pL.position.set(-0.5, h/2, z);
    this.visualBody.add(pL);
    const pR = pL.clone();
    pR.position.x = 0.5;
    this.visualBody.add(pR);
  }

  private setupWheels(scene: THREE.Scene) {
    const wheelGeo = new THREE.CylinderGeometry(this.WHEEL_RADIUS, this.WHEEL_RADIUS, 0.45, 24);
    wheelGeo.rotateZ(Math.PI / 2);
    const tireMat  = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 1.0 });
    const rimMat   = new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.3, metalness: 0.9 });
    const rimGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.47, 12);
    rimGeo.rotateZ(Math.PI / 2);

    const offsets = [
      new THREE.Vector3(-0.9, -0.15, 1.4),  // Front Left
      new THREE.Vector3(0.9, -0.15, 1.4),   // Front Right
      new THREE.Vector3(-0.95, -0.15, -1.4), // Rear Left
      new THREE.Vector3(0.95, -0.15, -1.4)   // Rear Right
    ];

    for (let i = 0; i < 4; i++) {
      const wheelGroup = new THREE.Group();
      const tire = new THREE.Mesh(wheelGeo, tireMat);
      const rim  = new THREE.Mesh(rimGeo, rimMat);
      tire.castShadow = true;
      wheelGroup.add(tire, rim);
      wheelGroup.position.copy(offsets[i]);
      this.visualBody.add(wheelGroup); // Parent to body for simpler sync
      this.wheelMeshes.push(wheelGroup as any);
    }
  }

  public update(input: InputManager, dt: number) {
    const gas = input.forward;
    const brake = input.backward || input.brake;
    const left = input.left;
    const right = input.right;

    if (gas) this.speed = Math.min(this.maxSpeed, this.speed + this.acceleration * dt);
    else if (brake) {
      if (this.speed > 0.5) this.speed = Math.max(0, this.speed - this.BRAKING * dt);
      else this.speed = Math.max(-this.MAX_REVERSE, this.speed - (this.acceleration * 0.7) * dt);
    } else {
      const drag = this.DRAG * dt;
      if (this.speed > 0) this.speed = Math.max(0, this.speed - drag);
      else if (this.speed < 0) this.speed = Math.min(0, this.speed + drag);
    }

    let steerDir = 0;
    if (left) steerDir = 1;
    if (right) steerDir = -1;

    const targetSteerAngle = steerDir * 0.5;
    this.steerAngle = THREE.MathUtils.lerp(this.steerAngle, targetSteerAngle, dt * 5);
    
    if (Math.abs(this.speed) > 1) {
      const turnRadius = this.speed * (this.steerSpeed / this.maxSpeed);
      this.angle += turnRadius * this.steerAngle * dt;
    }

    const velocity = new THREE.Vector3(
      Math.sin(this.angle) * this.speed * dt,
      0,
      Math.cos(this.angle) * this.speed * dt
    );
    this.prevPosition.copy(this.position);
    this.position.add(velocity);
  }

  public applyTrackConstraint(curve: THREE.CatmullRomCurve3, halfWidth: number) {
    const samples = 200;
    let closestT = 0;
    let closestD = Infinity;

    for (let i = 0; i <= samples; i++) {
      const t = i / samples;
      const p = curve.getPointAt(t);
      const d = this.position.distanceToSquared(p);
      if (d < closestD) { closestD = d; closestT = t; }
    }

    const center = curve.getPointAt(closestT);
    const distToCenter = this.position.distanceTo(center);
    
    if (distToCenter > halfWidth) {
      const toCenter = center.clone().sub(this.position).normalize();
      const overlap = distToCenter - halfWidth;
      this.position.add(toCenter.multiplyScalar(overlap));
      this.speed *= 0.95;
      this.isOffTrack = true;
    } else {
      this.isOffTrack = false;
    }
  }

  public syncVisuals(dt: number) {
    this.visualBody.position.lerp(this.position, 0.4);
    this.visualBody.rotation.y = this.angle;

    this.wheelRotation += this.speed * dt * 2.0;
    this.wheelMeshes.forEach((w, i) => {
      w.children[0].rotation.x = this.wheelRotation; 
      if (i < 2) w.rotation.y = this.steerAngle; 
    });
  }

  get speedKmh() { return Math.abs(this.speed) * 3.6; }
}
