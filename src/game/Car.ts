import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { InputManager } from '../engine/Input';
import { createF1CarModel } from './F1CarModel';
import { ParticleSystem } from './Particles';

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
    
    // Chassis roughly size of F1 car (1.8m wide, ~1m high, ~5m long)
    const chassisShape = new CANNON.Box(new CANNON.Vec3(0.9, 0.4, 2.5));
    this.chassisBody = new CANNON.Body({ 
        mass: 800,
        allowSleep: false // Prevent car from going to sleep
    });
    this.chassisBody.addShape(chassisShape);
    this.chassisBody.position.copy(startPos);
    this.chassisBody.angularVelocity.set(0, 0, 0);

    this.vehicle = new CANNON.RaycastVehicle({
      chassisBody: this.chassisBody,
      indexRightAxis: 0,   // +X = right
      indexUpAxis: 1,      // +Y = up
      indexForwardAxis: 2, // +Z = forward
    });

    const options = {
      radius: 0.35, // tyre radius
      directionLocal: new CANNON.Vec3(0, -1, 0),
      suspensionStiffness: 60.0,
      suspensionRestLength: 0.3,
      frictionSlip: 10.5, // Increased for better grip
      dampingRelaxation: 2.3,
      dampingCompression: 4.4,
      maxSuspensionForce: 100000,
      rollInfluence: 0.1, // Prevent flipping over too much
      axleLocal: new CANNON.Vec3(-1, 0, 0),
      chassisConnectionPointLocal: new CANNON.Vec3(1, 1, 0),
      maxSuspensionTravel: 0.3,
      customSlidingRotationalSpeed: -30,
      useCustomSlidingRotationalSpeed: true
    };

    // Front Left
    options.chassisConnectionPointLocal.set(0.9, 0, -1.5);
    this.vehicle.addWheel(options);
    // Front Right
    options.chassisConnectionPointLocal.set(-0.9, 0, -1.5);
    this.vehicle.addWheel(options);
    // Rear Left
    options.chassisConnectionPointLocal.set(0.9, 0, 1.5);
    this.vehicle.addWheel(options);
    // Rear Right
    options.chassisConnectionPointLocal.set(-0.9, 0, 1.5);
    this.vehicle.addWheel(options);

    this.vehicle.addToWorld(physicsWorld);

    // Wheel bodies
    const wheelBodies: CANNON.Body[] = [];
    this.vehicle.wheelInfos.forEach(() => {
      const cylinderShape = new CANNON.Cylinder(options.radius, options.radius, 0.4, 20);
      // Wheels are rotated to stand up
      const q = new CANNON.Quaternion();
      q.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), Math.PI / 2);
      
      const wheelBody = new CANNON.Body({
        mass: 0,
        type: CANNON.Body.KINEMATIC,
        collisionFilterGroup: 0, // don't collide with ground mechanically
      });
      wheelBody.addShape(cylinderShape, new CANNON.Vec3(0,0,0), q);
      wheelBodies.push(wheelBody);
      physicsWorld.addBody(wheelBody);
    });

    // --- Visuals ---
    this.visualBody = createF1CarModel();
    scene.add(this.visualBody);

    // Wheel visuals
    const wheelGeo = new THREE.CylinderGeometry(options.radius, options.radius, 0.4, 32);
    wheelGeo.rotateZ(Math.PI / 2);
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111111 });

    for (let i = 0; i < 4; i++) {
      const m = new THREE.Mesh(wheelGeo, wheelMat);
      m.castShadow = true;
      scene.add(m);
      this.wheelMeshes.push(m);
    }
    
    // Keep reference to physical wheel bodies to update smoothly
    (this as any).wheelBodies = wheelBodies;

    this.particles = new ParticleSystem(scene);

    // --- Real-time Reflections ---
    this.cubeRenderTarget = new THREE.WebGLCubeRenderTarget(128, {
        generateMipmaps: true,
        minFilter: THREE.LinearMipmapLinearFilter
    });
    this.cubeCamera = new THREE.CubeCamera(0.1, 1000, this.cubeRenderTarget);
    this.visualBody.add(this.cubeCamera);

    // Apply to car body
    this.visualBody.traverse((child) => {
        if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshPhysicalMaterial) {
            child.material.envMap = this.cubeRenderTarget.texture;
            child.material.envMapIntensity = 1.0;
        }
    });
  }

  public update(input: InputManager) {
    const maxSteerVal = 0.5;      // Rad - F1 cars have high steering lock
    const maxForce = 3500;        // Engine Force
    const brakeForce = 300;       // Braking Force
    const speed = Math.abs(this.vehicle.currentVehicleSpeedKmHour);

    // Dynamic steering: less lock at high speeds to prevent spinning out
    let steerVal = maxSteerVal;
    if (speed > 50) {
      steerVal = maxSteerVal * (50 / speed);
    }
    if (steerVal < 0.05) steerVal = 0.05;

    let engineForce = 0;
    let steeringValue = 0;

    if (input.forward) {
      engineForce = maxForce;
    }
    if (input.backward) {
      engineForce = -maxForce;
    }
    if (input.left) {
      steeringValue = steerVal;
    }
    if (input.right) {
      steeringValue = -steerVal;
    }

    // --- Downforce ---
    // F1 cars generate downforce proportional to speed^2
    // Simplified: downforce = k * speed^2
    const downforceK = 0.8; 
    const downforce = (speed * speed) * downforceK;
    this.chassisBody.applyLocalForce(new CANNON.Vec3(0, -downforce, 0), new CANNON.Vec3(0, 0, 0));

    // Apply steering to front wheels
    this.vehicle.setSteeringValue(steeringValue, 0);
    this.vehicle.setSteeringValue(steeringValue, 1);

    // Apply engine force to rear wheels (RWD) — positive = forward
    this.vehicle.applyEngineForce(-engineForce, 2);
    this.vehicle.applyEngineForce(-engineForce, 3);

    // Braking
    if (input.brake) {
      const b = brakeForce;
      this.vehicle.setBrake(b, 0);
      this.vehicle.setBrake(b, 1);
      this.vehicle.setBrake(b, 2);
      this.vehicle.setBrake(b, 3);
    } else {
      this.vehicle.setBrake(0, 0);
      this.vehicle.setBrake(0, 1);
      this.vehicle.setBrake(0, 2);
      this.vehicle.setBrake(0, 3);
    }

    // Update particles
    this.particles.update(1 / 60);

    // Emit smoke if skidding
    // Calculate slip (very simplified: if steering hard or braking hard while moving)
    const isSkidding = (Math.abs(steeringValue) > 0.2 && speed > 50) || (input.brake && speed > 20);
    if (isSkidding) {
       for (let i = 2; i < 4; i++) { // Rear wheels
         const wheelPos = this.vehicle.wheelInfos[i].worldTransform.position;
         this.particles.emit(
           new THREE.Vector3(wheelPos.x, wheelPos.y, wheelPos.z),
           new THREE.Vector3((Math.random() - 0.5) * 2, Math.random() * 2, (Math.random() - 0.5) * 2)
         );
       }
    }

    // Update reflections (Skip some frames or just do it every frame for smoothness)
    this.visualBody.visible = false; // Hide car from its own reflection
    (this.visualBody as any).parent.parent.renderer?.render ? null : null; // Accessing renderer is tricky from here
    // We'll actually handle cubeCamera update in main.ts logic for better access to renderer
    
    // Sync visual body
    this.visualBody.position.copy(this.chassisBody.position as any);
    this.visualBody.quaternion.copy(this.chassisBody.quaternion as any);

    // Sync wheels
    const wheelBodies = (this as any).wheelBodies;
    for (let i = 0; i < this.vehicle.wheelInfos.length; i++) {
        this.vehicle.updateWheelTransform(i);
        const transform = this.vehicle.wheelInfos[i].worldTransform;
        
        wheelBodies[i].position.copy(transform.position);
        wheelBodies[i].quaternion.copy(transform.quaternion);

        this.wheelMeshes[i].position.copy(transform.position as any);
        this.wheelMeshes[i].quaternion.copy(transform.quaternion as any);
    }
  }
}
