import * as THREE from 'three';
import { Car } from './Car';

export class AICar extends Car {
  public progression = 0; // [0, 1] along the curve
  public lap = 1;         // current lap
  private baseSpeed: number;
  private lateralOffset: number;
  private curveLength: number;
  private lapCrossedZero = false;

  public get totalProgress(): number {
    return this.lap + this.progression;
  }

  constructor(
    scene: THREE.Scene, 
    curve: THREE.CatmullRomCurve3, 
    color: number, 
    lateralOffset: number, 
    difficulty: 'Low' | 'Medium' | 'High'
  ) {
    // Initial position doesn't matter much as we'll sync it immediately
    // For AI, we just pass a dummy CarStats or make a default one
    super(scene, new THREE.Vector3(), 0, { name: 'AI', color, maxSpeed: 60, acceleration: 18, steerSpeed: 1.4, description: '' });
    
    this.lateralOffset = lateralOffset;
    
    // Scale speed based on difficulty
    const speedMult = difficulty === 'High' ? 1.1 : difficulty === 'Medium' ? 0.9 : 0.75;
    this.baseSpeed = (48 + Math.random() * 5) * speedMult; 

    this.curveLength = curve.getLength();
    this.progression = Math.random() * 0.05; // Start slightly staggered
  }

  public updateAI(dt: number, curve: THREE.CatmullRomCurve3) {
    // Move along the curve based on speed
    // t = distance / length
    const deltaT = (this.baseSpeed / this.curveLength) * dt;
    const nextProg = this.progression + deltaT;
    
    // Lap detection for bots
    if (this.progression > 0.9 && (nextProg % 1) < 0.1 && !this.lapCrossedZero) {
        this.lap++;
        this.lapCrossedZero = true;
    } else if (nextProg % 1 > 0.1) {
        this.lapCrossedZero = false;
    }
    
    this.progression = nextProg % 1;

    // Get position and tangent
    const splinePos = curve.getPointAt(this.progression);
    const tangent = curve.getTangentAt(this.progression).normalize();
    const up = new THREE.Vector3(0, 1, 0);
    const normal = new THREE.Vector3().crossVectors(tangent, up).normalize();

    // Set position with lateral offset (lane)
    this.position.copy(splinePos).addScaledVector(normal, this.lateralOffset);
    this.position.y = 0;

    // Set angle to face tangent
    this.angle = Math.atan2(tangent.x, tangent.z);

    // Update visuals (wheels rotation etc)
    // AICars move at their baseSpeed constantly for now
    this.speed = this.baseSpeed;
    
    // Call the parent syncVisuals to update Three.js meshes
    this.syncVisuals(dt);
  }
}
