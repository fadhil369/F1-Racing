import * as THREE from 'three';
import { Car } from './Car';
import { Track } from './Track';
import { RaceManager } from './RaceManager';
import { InputManager } from '../engine/Input'; // We'll mock input for AI

export class AIController {
  private car: Car;
  private track: Track;
  private raceManager: RaceManager;
  private progress = 0; // 0 to 1 along the curve
  
  // Fake input for the car
  private aiInput: InputManager;

  constructor(car: Car, track: Track, raceManager: RaceManager) {
    this.car = car;
    this.track = track;
    this.raceManager = raceManager;
    this.aiInput = {
        forward: false,
        backward: false,
        left: false,
        right: false,
        brake: false
    } as any;
  }

  public update() {
    // 1. Get current position on curve (Optimized: use data from RaceManager)
    this.progress = this.raceManager.getCarProgress(this.car);
    const carPos = this.car.visualBody.position;
    
    const curve = this.track.curve;
    
    // Look ahead parameter
    const lookAheadDist = 0.02; // relative 0-1
    let targetU = (this.progress + lookAheadDist) % 1;
    
    const targetPoint = curve.getPointAt(targetU);
    const carForward = new THREE.Vector3(0, 0, 1).applyQuaternion(this.car.visualBody.quaternion);
    
    const toTarget = new THREE.Vector3().subVectors(targetPoint, carPos).normalize();
    
    // 2. Steering logic
    // Dot product to check if we are facing the target
    const angle = carForward.angleTo(toTarget);
    const cross = new THREE.Vector3().crossVectors(carForward, toTarget);
    
    // Reset inputs
    this.aiInput.left = false;
    this.aiInput.right = false;
    this.aiInput.forward = false;
    this.aiInput.brake = false;

    const steerThreshold = 0.05;
    if (angle > steerThreshold) {
      if (cross.y > 0) {
        this.aiInput.left = true;
      } else {
        this.aiInput.right = true;
      }
    }

    // 3. Speed logic
    const currentSpeed = this.car.chassisBody.velocity.length() * 3.6;
    
    // Calculate curvature at target to adjust target speed
    // Higher curvature = lower target speed
    const tangent1 = curve.getTangentAt(targetU);
    const tangent2 = curve.getTangentAt((targetU + 0.01) % 1);
    const curvature = tangent1.angleTo(tangent2) * 100;
    
    let speedLimit = 280;
    if (curvature > 0.5) speedLimit = 150;
    if (curvature > 1.5) speedLimit = 80;

    if (currentSpeed < speedLimit) {
      this.aiInput.forward = true;
    } else if (currentSpeed > speedLimit + 20) {
       this.aiInput.brake = true;
    }

    // 4. Update the car with AI input
    this.car.update(this.aiInput);
  }
}
