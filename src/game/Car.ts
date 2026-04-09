import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { InputManager } from '../engine/Input';
import { createF1CarModel } from './F1CarModel';
import { ParticleSystem } from './Particles';

// Set to true to use a simple block for debugging movement
const DEBUG_MODE = true;

export class Car {
  public chassisBody: CANNON.Body;
  public vehicle: CANNON.RaycastVehicle;
  public visualBody: THREE.Group;
  private wheelMeshes: THREE.Mesh[] = [];
  private particles: ParticleSystem;
  public cubeCamera: THREE.CubeCamera;
  private cubeRenderTarget: THREE.WebGLCubeRenderTarget;

  constructor(scene: THREE.Scene, physicsWorld: CANNON.World, startPos: CANNON.Vec3) {
    // --- Physics ---
    const chassisShape = new CANNON.Box(new CANNON.Vec3(0.9, 0.4, 2.5));
    this.chassisBody = new CANNON.Body({ 
        mass: 800,
        allowSleep: false
    });
    this.chassisBody.addShape(chassisShape);
    this.chassisBody.position.copy(startPos);
    this.chassisBody.angularVelocity.set(0, 0, 0);

    const wheelMaterial = new CANNON.Material("wheel");

    this.vehicle = new CANNON.RaycastVehicle({
      chassisBody: this.chassisBody,
      indexRightAxis: 0,
      indexUpAxis: 1,
      indexForwardAxis: 2,
    });

    const options = {
      radius: 0.35,
      directionLocal: new CANNON.Vec3(0, -1, 0),
      suspensionStiffness: 60.0,
      suspensionRestLength: 0.3,
      frictionSlip: 10.5,
      dampingRelaxation: 2.3,
      dampingCompression: 4.4,
      maxSuspensionForce: 100000,
      rollInfluence: 0.1, 
      axleLocal: new CANNON.Vec3(-1, 0, 0),
      chassisConnectionPointLocal: new CANNON.Vec3(1, 1, 0),
      maxSuspensionTravel: 0.3,
    };

    // Front
    options.chassisConnectionPointLocal.set(1.0, 0, 2.0);
    this.vehicle.addWheel(options);
    options.chassisConnectionPointLocal.set(-1.0, 0, 2.0);
    this.vehicle.addWheel(options);
    // Rear
    options.chassisConnectionPointLocal.set(1.1, 0, -2.0);
    this.vehicle.addWheel(options);
    options.chassisConnectionPointLocal.set(-1.1, 0, -2.0);
    this.vehicle.addWheel(options);

    this.vehicle.addToWorld(physicsWorld);

    const wheelBodies: CANNON.Body[] = [];
    this.vehicle.wheelInfos.forEach(() => {
      const wheelBody = new CANNON.Body({
        mass: 0,
        type: CANNON.Body.KINEMATIC,
        collisionFilterGroup: 0,
        material: wheelMaterial
      });
      wheelBodies.push(wheelBody);
      physicsWorld.addBody(wheelBody);
    });

    // --- Visuals ---
    if (DEBUG_MODE) {
        // Use a simple block instead of F1 car as requested
        const boxGeo = new THREE.BoxGeometry(1.8, 0.8, 5.0);
        const boxMat = new THREE.MeshStandardMaterial({ color: 0x00ff00 }); // Neon Green
        const boxMesh = new THREE.Mesh(boxGeo, boxMat);
        boxMesh.position.y = 0.4;
        this.visualBody = new THREE.Group();
        this.visualBody.add(boxMesh);
        
        // Add a "front" indicator
        const nose = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.2, 1.0), new THREE.MeshStandardMaterial({color: 0xffffff}));
        nose.position.set(0, 0.3, 2.8);
        this.visualBody.add(nose);
    } else {
        this.visualBody = createF1CarModel();
    }
    scene.add(this.visualBody);

    const wheelGeo = new THREE.CylinderGeometry(options.radius, options.radius, 0.4, 32);
    wheelGeo.rotateZ(Math.PI / 2);
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111111 });

    for (let i = 0; i < 4; i++) {
      const m = new THREE.Mesh(wheelGeo, wheelMat);
      scene.add(m);
      this.wheelMeshes.push(m);
    }
    
    (this as any).wheelBodies = wheelBodies;
    this.particles = new ParticleSystem(scene);

    this.cubeRenderTarget = new THREE.WebGLCubeRenderTarget(128, {
        generateMipmaps: true,
        minFilter: THREE.LinearMipmapLinearFilter
    });
    this.cubeCamera = new THREE.CubeCamera(0.1, 1000, this.cubeRenderTarget);
    this.visualBody.add(this.cubeCamera);

    this.visualBody.traverse((child) => {
        if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshPhysicalMaterial) {
            child.material.envMap = this.cubeRenderTarget.texture;
        }
    });
  }

  // Phase 1: Apply forces based on input (Called BEFORE world.step)
  public applyInput(input: InputManager) {
    const maxSteerVal = 0.5;
    const maxForce = 8000; // Increased to ensure movement
    const brakeForce = 1500;
    const speed = Math.abs(this.vehicle.currentVehicleSpeedKmHour);

    let steerVal = maxSteerVal;
    if (speed > 100) steerVal = maxSteerVal * (100 / speed);
    if (steerVal < 0.1) steerVal = 0.1;

    let engineForce = 0;
    let steeringValue = 0;

    if (input.forward) engineForce = maxForce;
    if (input.backward) engineForce = -maxForce / 2;
    if (input.left) steeringValue = steerVal;
    if (input.right) steeringValue = -steerVal;

    // Downforce
    const downforceK = 1.5;
    const downforce = (speed * speed) * downforceK;
    this.chassisBody.applyLocalForce(new CANNON.Vec3(0, -downforce, 0), new CANNON.Vec3(0, 0, 0));

    // Steering (Front)
    this.vehicle.setSteeringValue(steeringValue, 0);
    this.vehicle.setSteeringValue(steeringValue, 1);

    // Engine (Rear)
    this.vehicle.applyEngineForce(engineForce, 2);
    this.vehicle.applyEngineForce(engineForce, 3);

    // Braking
    if (input.brake) {
      this.vehicle.setBrake(brakeForce, 0);
      this.vehicle.setBrake(brakeForce, 1);
      this.vehicle.setBrake(brakeForce, 2);
      this.vehicle.setBrake(brakeForce, 3);
    } else {
      this.vehicle.setBrake(0, 0);
      this.vehicle.setBrake(0, 1);
      this.vehicle.setBrake(0, 2);
      this.vehicle.setBrake(0, 3);
    }
  }

  // Phase 2: Sync visuals to physics result (Called AFTER world.step)
  public syncVisuals() {
    this.visualBody.position.copy(this.chassisBody.position as any);
    this.visualBody.quaternion.copy(this.chassisBody.quaternion as any);

    const wheelBodies = (this as any).wheelBodies;
    for (let i = 0; i < this.vehicle.wheelInfos.length; i++) {
        this.vehicle.updateWheelTransform(i);
        const transform = this.vehicle.wheelInfos[i].worldTransform;
        
        if (wheelBodies[i]) {
            wheelBodies[i].position.copy(transform.position);
            wheelBodies[i].quaternion.copy(transform.quaternion);
        }

        this.wheelMeshes[i].position.copy(transform.position as any);
        this.wheelMeshes[i].quaternion.copy(transform.quaternion as any);
    }

    this.particles.update(1 / 60);
  }

  // Legacy update for safety during refactor
  public update(input: InputManager) {
      this.applyInput(input);
      this.syncVisuals();
  }
}
