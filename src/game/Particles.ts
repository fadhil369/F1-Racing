import * as THREE from 'three';

export class ParticleSystem {
  private particles: THREE.Points;
  private geometry: THREE.BufferGeometry;
  private material: THREE.PointsMaterial;
  private maxParticles = 500;
  private positions: Float32Array;
  private velocities: Float32Array;
  private lifetimes: Float32Array;
  private activeCount = 0;

  constructor(scene: THREE.Scene) {
    this.geometry = new THREE.BufferGeometry();
    this.positions = new Float32Array(this.maxParticles * 3);
    this.velocities = new Float32Array(this.maxParticles * 3);
    this.lifetimes = new Float32Array(this.maxParticles);

    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));

    this.material = new THREE.PointsMaterial({
      color: 0xaaaaaa,
      size: 0.2,
      transparent: true,
      opacity: 0.5,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    this.particles = new THREE.Points(this.geometry, this.material);
    scene.add(this.particles);
  }

  public emit(pos: THREE.Vector3, vel: THREE.Vector3) {
    if (this.activeCount < this.maxParticles) {
      const idx = this.activeCount;
      this.positions[idx * 3] = pos.x;
      this.positions[idx * 3 + 1] = pos.y;
      this.positions[idx * 3 + 2] = pos.z;

      this.velocities[idx * 3] = vel.x;
      this.velocities[idx * 3 + 1] = vel.y;
      this.velocities[idx * 3 + 2] = vel.z;

      this.lifetimes[idx] = 1.0; // 1 second life
      this.activeCount++;
    }
  }

  public update(dt: number) {
    const posAttr = this.geometry.getAttribute('position') as THREE.BufferAttribute;
    
    for (let i = 0; i < this.activeCount; i++) {
      this.lifetimes[i] -= dt;

      if (this.lifetimes[i] <= 0) {
        // Swap with last active
        this.activeCount--;
        const lastIdx = this.activeCount;
        
        this.positions[i * 3] = this.positions[lastIdx * 3];
        this.positions[i * 3 + 1] = this.positions[lastIdx * 3 + 1];
        this.positions[i * 3 + 2] = this.positions[lastIdx * 3 + 2];

        this.velocities[i * 3] = this.velocities[lastIdx * 3];
        this.velocities[i * 3 + 1] = this.velocities[lastIdx * 3 + 1];
        this.velocities[i * 3 + 2] = this.velocities[lastIdx * 3 + 2];

        this.lifetimes[i] = this.lifetimes[lastIdx];
        i--;
        continue;
      }

      this.positions[i * 3] += this.velocities[i * 3] * dt;
      this.positions[i * 3 + 1] += this.velocities[i * 3 + 1] * dt;
      this.positions[i * 3 + 2] += this.velocities[i * 3 + 2] * dt;
    }

    posAttr.needsUpdate = true;
  }
}
