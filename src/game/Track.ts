import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { TrackLevel } from './GameData';

export class Track {
  public scene: THREE.Scene;
  public trackMeshes: THREE.Mesh[] = [];
  public curve!: THREE.CatmullRomCurve3;

  constructor(scene: THREE.Scene, level: TrackLevel) {
    this.scene = scene;
    this.createTrack(level);
  }

  private createTrack(level: TrackLevel) {
    // Dynamically creating track from level data
    this.curve = new THREE.CatmullRomCurve3(level.points, true);

    const trackWidth = 18;
    const pts = this.curve.getSpacedPoints(800);
    const up  = new THREE.Vector3(0, 1, 0);

    // ── Road surface ──────────────────────────────────────────
    const vertices: number[] = [];
    const uvs:      number[] = [];

    for (let i = 0; i < pts.length; i++) {
      const t       = i / (pts.length - 1);
      const p0      = pts[i];
      const tangent = this.curve.getTangent(t).normalize();
      const normal  = new THREE.Vector3().crossVectors(tangent, up).normalize();

      const left  = p0.clone().addScaledVector(normal,  trackWidth / 2);
      const right = p0.clone().addScaledVector(normal, -trackWidth / 2);

      vertices.push(left.x, 0.02, left.z);   // Slightly above y=0
      vertices.push(right.x, 0.02, right.z);
      uvs.push(0, t * 80, 1, t * 80);
    }

    const indices: number[] = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const v = i * 2;
      // Reverse winding order to ensure normals point up
      indices.push(v, v + 2, v + 1, v + 1, v + 2, v + 3);
    }

    const trackGeom = new THREE.BufferGeometry();
    trackGeom.setAttribute('position', new THREE.BufferAttribute(new Float32Array(vertices), 3));
    trackGeom.setAttribute('uv',       new THREE.BufferAttribute(new Float32Array(uvs), 2));
    trackGeom.setIndex(indices);
    trackGeom.computeVertexNormals();

    const tLoader    = new THREE.TextureLoader();
    const asphaltTex = tLoader.load('/textures/asphalt.jpg',
      (tex) => { tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(4, 60); },
      undefined, () => console.warn('Asphalt texture not found')
    );

    const trackMat  = new THREE.MeshStandardMaterial({ color: 0xaaaaaa, map: asphaltTex, roughness: 0.6, metalness: 0.1 });
    const trackMesh = new THREE.Mesh(trackGeom, trackMat);
    trackMesh.receiveShadow = true;
    this.scene.add(trackMesh);

    // ── Visual barriers (no physics) ─────────────────────────
    this.createBarriers(pts, trackWidth);

    // ── Environment ───────────────────────────────────────────
    this.createGround();
    this.spawnTrees();
    this.createStartFinish();
  }

  private createBarriers(pts: THREE.Vector3[], trackWidth: number) {
    const barrierH      = 1.2;
    const barrierOffset = trackWidth / 2 + 0.6;
    const geoms: THREE.BufferGeometry[] = [];

    for (let i = 0; i < pts.length - 1; i++) {
      const p0  = pts[i];
      const p1  = pts[i + 1];
      const mid = new THREE.Vector3().lerpVectors(p0, p1, 0.5);
      const dist = p0.distanceTo(p1);

      const tangent = new THREE.Vector3().subVectors(p1, p0).normalize();
      const normal  = new THREE.Vector3().crossVectors(tangent, new THREE.Vector3(0, 1, 0)).normalize();

      const box = new THREE.BoxGeometry(1, barrierH, dist + 0.1);

      [1, -1].forEach(side => {
        const pos = mid.clone().addScaledVector(normal, side * barrierOffset);
        const g   = box.clone();
        const dummy = new THREE.Object3D();
        dummy.position.set(pos.x, barrierH / 2, pos.z);
        dummy.lookAt(pos.clone().add(tangent));
        dummy.updateMatrix();
        g.applyMatrix4(dummy.matrix);
        geoms.push(g);
      });
    }

    if (geoms.length > 0) {
      const merged     = BufferGeometryUtils.mergeGeometries(geoms);
      const barrierMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, roughness: 0.9 });
      const mesh = new THREE.Mesh(merged, barrierMat);
      mesh.receiveShadow = true;
      mesh.castShadow    = true;
      this.scene.add(mesh);
    }
  }

  private createGround() {
    const groundGeo = new THREE.PlaneGeometry(6000, 6000);
    // Base color 0xcccccc to not overshadow the grass texture
    const groundMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, roughness: 1.0 });

    const tLoader = new THREE.TextureLoader();
    tLoader.load('/textures/grass.jpg', (tex) => {
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(400, 400);
      groundMat.map    = tex;
      groundMat.needsUpdate = true;
    }, undefined, () => {});

    const groundMesh = new THREE.Mesh(groundGeo, groundMat);
    groundMesh.rotation.x = -Math.PI / 2;
    groundMesh.position.y = -0.01;
    groundMesh.receiveShadow = true;
    this.scene.add(groundMesh);
  }

  private spawnTrees() {
    const count     = 200;
    const trunkGeo  = new THREE.CylinderGeometry(0.2, 0.3, 2.5, 6);
    const leavesGeo = new THREE.ConeGeometry(1.8, 5, 6);
    const trunkMat  = new THREE.MeshStandardMaterial({ color: 0x3d2010 });
    const leavesMat = new THREE.MeshStandardMaterial({ color: 0x1a4020 });

    const trunks  = new THREE.InstancedMesh(trunkGeo,  trunkMat,  count);
    const leaves  = new THREE.InstancedMesh(leavesGeo, leavesMat, count);
    trunks.castShadow  = true;
    leaves.castShadow  = true;

    const dummy = new THREE.Object3D();
    const trackWidth = 18;

    for (let i = 0; i < count; i++) {
      const t       = Math.random();
      const pos     = this.curve.getPointAt(t);
      const tangent = this.curve.getTangentAt(t).normalize();
      const normal  = new THREE.Vector3().crossVectors(tangent, new THREE.Vector3(0, 1, 0)).normalize();
      const side    = Math.random() > 0.5 ? 1 : -1;
      const dist    = trackWidth / 2 + 5 + Math.random() * 30;
      const treePos = pos.clone().addScaledVector(normal, side * dist);
      const scale   = 0.7 + Math.random() * 0.6;

      dummy.position.set(treePos.x, 1.25 * scale, treePos.z);
      dummy.scale.setScalar(scale);
      dummy.rotation.y = Math.random() * Math.PI * 2;
      dummy.updateMatrix();
      trunks.setMatrixAt(i, dummy.matrix);

      dummy.position.y = (1.25 + 3.5) * scale;
      dummy.updateMatrix();
      leaves.setMatrixAt(i, dummy.matrix);
    }

    this.scene.add(trunks, leaves);
  }

  private createStartFinish() {
    const startPos = this.curve.getPointAt(0);
    const tangent  = this.curve.getTangentAt(0).normalize();

    // Checkered line
    const canvas    = document.createElement('canvas');
    canvas.width    = 128; canvas.height = 32;
    const ctx       = canvas.getContext('2d')!;
    ctx.fillStyle   = 'white'; ctx.fillRect(0, 0, 128, 32);
    ctx.fillStyle   = 'black';
    for (let x = 0; x < 8; x++)
      for (let y = 0; y < 2; y++)
        if ((x + y) % 2 === 0) ctx.fillRect(x * 16, y * 16, 16, 16);

    const checkMat  = new THREE.MeshStandardMaterial({ map: new THREE.CanvasTexture(canvas), transparent: true });
    const startLine = new THREE.Mesh(new THREE.PlaneGeometry(18, 2), checkMat);
    startLine.rotation.x = -Math.PI / 2;
    startLine.position.set(startPos.x, 0.03, startPos.z);
    startLine.rotation.z = Math.atan2(tangent.x, tangent.z);
    this.scene.add(startLine);

    // Gantry arch
    const gantry   = new THREE.Group();
    const pMat     = new THREE.MeshStandardMaterial({ color: 0x1a1a1a });
    const beam     = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 20), pMat);
    beam.position.y = 8;
    const leftP    = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.45, 8), pMat);
    leftP.position.set(0, 4,  10);
    const rightP   = leftP.clone(); rightP.position.z = -10;
    gantry.add(beam, leftP, rightP);
    gantry.position.copy(startPos);
    gantry.lookAt(startPos.clone().add(tangent));
    gantry.rotateY(Math.PI / 2);
    this.scene.add(gantry);
  }
}
