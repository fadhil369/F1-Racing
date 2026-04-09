import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { InputManager } from '../engine/Input';

export class Car {
  public chassisBody: CANNON.Body;
  public vehicle: CANNON.RaycastVehicle;
  public visualBody: THREE.Mesh;
  private wheelMeshes: THREE.Mesh[] = [];

  constructor(scene: THREE.Scene, physicsWorld: CANNON.World, startPos: CANNON.Vec3) {
    // 1. Physics Material (Super High Friction)
    const carMaterial = new CANNON.Material("car");
    
    // 2. Chassis Body
    this.chassisBody = new CANNON.Body({ 
        mass: 800,
        material: carMaterial,
        allowSleep: false
    });
    this.chassisBody.addShape(new CANNON.Box(new CANNON.Vec3(0.9, 0.4, 2.5)));
    this.chassisBody.position.copy(startPos);
    
    // CRITICAL: Add the body to the world or it won't be simulated!
    physicsWorld.addBody(this.chassisBody);

    // 3. Vehicle Setup
    this.vehicle = new CANNON.RaycastVehicle({
      chassisBody: this.chassisBody,
      indexRightAxis: 0,
      indexUpAxis: 1,
      indexForwardAxis: 2,
    });

    const wheelOptions = {
      radius: 0.35,
      directionLocal: new CANNON.Vec3(0, -1, 0),
      suspensionStiffness: 30,
      suspensionRestLength: 0.3,
      frictionSlip: 50.0, // ULTRA GRIP
      dampingRelaxation: 2.3,
      dampingCompression: 4.4,
      maxSuspensionForce: 100000,
      rollInfluence: 0.01,
      axleLocal: new CANNON.Vec3(-1, 0, 0),
      chassisConnectionPointLocal: new CANNON.Vec3(1, 1, 0),
      maxSuspensionTravel: 0.3,
    };

    // Add 4 wheels
    wheelOptions.chassisConnectionPointLocal.set(1.0, 0, 2.0);
    this.vehicle.addWheel(wheelOptions);
    wheelOptions.chassisConnectionPointLocal.set(-1.0, 0, 2.0);
    this.vehicle.addWheel(wheelOptions);
    wheelOptions.chassisConnectionPointLocal.set(1.1, 0, -2.0);
    this.vehicle.addWheel(wheelOptions);
    wheelOptions.chassisConnectionPointLocal.set(-1.1, 0, -2.0);
    this.vehicle.addWheel(wheelOptions);

    this.vehicle.addToWorld(physicsWorld);

    // 4. Visual Body (Simple Green Block)
    this.visualBody = new THREE.Mesh(
        new THREE.BoxGeometry(1.8, 0.8, 5),
        new THREE.MeshStandardMaterial({ color: 0x00ff00 }) // Bright Green
    );
    scene.add(this.visualBody);

    // 5. Wheel Visuals
    const wheelGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.4, 16);
    wheelGeo.rotateZ(Math.PI / 2);
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x222222 });

    for (let i = 0; i < 4; i++) {
        const mesh = new THREE.Mesh(wheelGeo, wheelMat);
        scene.add(mesh);
        this.wheelMeshes.push(mesh);
    }
  }

  public applyInput(input: InputManager) {
    const engineForce = 12000; // Formula 1 style power
    const brakeForce = 3000;
    const steeringLimit = 0.5;

    let f = 0;
    let s = 0;

    if (input.forward) f = engineForce;
    if (input.backward) f = -engineForce / 2;
    if (input.left) s = steeringLimit;
    if (input.right) s = -steeringLimit;

    this.vehicle.applyEngineForce(f, 2);
    this.vehicle.applyEngineForce(f, 3);
    this.vehicle.setSteeringValue(s, 0);
    this.vehicle.setSteeringValue(s, 1);

    if (input.brake) {
        for (let i = 0; i < 4; i++) this.vehicle.setBrake(brakeForce, i);
    } else {
        for (let i = 0; i < 4; i++) this.vehicle.setBrake(0, i);
    }
    
    // Constant downforce to keep it on track
    this.chassisBody.applyLocalForce(new CANNON.Vec3(0, -5000, 0), new CANNON.Vec3(0,0,0));
  }

  public syncVisuals() {
    this.visualBody.position.copy(this.chassisBody.position as any);
    this.visualBody.quaternion.copy(this.chassisBody.quaternion as any);

    for (let i = 0; i < this.vehicle.wheelInfos.length; i++) {
        this.vehicle.updateWheelTransform(i);
        const t = this.vehicle.wheelInfos[i].worldTransform;
        this.wheelMeshes[i].position.copy(t.position as any);
        this.wheelMeshes[i].quaternion.copy(t.quaternion as any);
    }
  }
}
