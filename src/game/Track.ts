import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export class Track {
  public scene: THREE.Scene;
  public world: CANNON.World;
  public trackMeshes: THREE.Mesh[] = [];
  public curve!: THREE.CatmullRomCurve3;

  constructor(scene: THREE.Scene, world: CANNON.World) {
    this.scene = scene;
    this.world = world;
    this.createTrack();
  }

  private createTrack() {
    // 1. Create Track Spline Shape (Simplified Monza Circuit layout)
    this.curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 0),        // Start line
      new THREE.Vector3(300, 0, 0),      // First long straight
      new THREE.Vector3(320, 0, 20),     // Rettifilo Chicane start
      new THREE.Vector3(320, 0, 40),     // Chicane mid
      new THREE.Vector3(300, 0, 60),     // Chicane exit
      new THREE.Vector3(150, 0, 200),    // Curva Grande
      new THREE.Vector3(100, 0, 350),    // Roggia Chicane
      new THREE.Vector3(0, 0, 450),      // Lesmo 1
      new THREE.Vector3(-150, 0, 480),   // Lesmo 2
      new THREE.Vector3(-400, 0, 400),   // Serraglio straight
      new THREE.Vector3(-550, 0, 200),   // Ascari Chicane
      new THREE.Vector3(-600, 0, 0),     // Back straight
      new THREE.Vector3(-450, 0, -200),  // Parabolica start
      new THREE.Vector3(-150, 0, -150),  // Parabolica exit
    ], true);

    const trackWidth = 16;
    const pts = this.curve.getSpacedPoints(400);
    const trackGeom = new THREE.BufferGeometry();
    const vertices: number[] = [];
    const uvs: number[] = [];
    const up = new THREE.Vector3(0, 1, 0);

    for (let i = 0; i < pts.length; i++) {
        const t = i / (pts.length - 1);
        const p0 = pts[i];
        const tangent = this.curve.getTangent(t).normalize();
        const normal = new THREE.Vector3().crossVectors(tangent, up).normalize();
        
        const left = new THREE.Vector3().copy(p0).addScaledVector(normal, trackWidth / 2);
        const right = new THREE.Vector3().copy(p0).addScaledVector(normal, -trackWidth / 2);
        
        vertices.push(
            left.x, left.y + 0.1, left.z,
            right.x, right.y + 0.1, right.z
        );
        
        uvs.push(0, t * 50, 1, t * 50);
    }
    
    const indices: number[] = [];
    for (let i = 0; i < pts.length - 1; i++) {
        const v = i * 2;
        indices.push(v, v + 1, v + 2);
        indices.push(v + 1, v + 3, v + 2);
    }
    
    trackGeom.setAttribute('position', new THREE.BufferAttribute(new Float32Array(vertices), 3));
    trackGeom.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(uvs), 2));
    trackGeom.setIndex(indices);
    trackGeom.computeVertexNormals();
    
    const tLoader = new THREE.TextureLoader();
    const asphaltTex = tLoader.load('/textures/asphalt.jpg', (tex) => {
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.RepeatWrapping;
        tex.repeat.set(5, 50);
    }, undefined, () => {
        console.warn("Asphalt texture not found, using color fallback.");
    });

    const trackMat = new THREE.MeshStandardMaterial({ 
        color: 0x333333,
        map: asphaltTex,
        roughness: 0.9,
    });
    
    const trackMesh = new THREE.Mesh(trackGeom, trackMat);
    trackMesh.receiveShadow = true;
    this.scene.add(trackMesh);
    
    const groundShape = new CANNON.Plane();
    const groundBody = new CANNON.Body({ mass: 0, shape: groundShape });
    groundBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
    this.world.addBody(groundBody);

    // Optimized Environment Generation
    this.createOptimizedCurbs(pts, trackWidth);
    this.createOptimizedBarriers(pts, trackWidth);
    this.spawnOptimizedTrees();
    this.createStartFinishVisuals();
    this.spawnOptimizedBanners();
    this.createGround();
  }

  private createGround() {
    const tLoader = new THREE.TextureLoader();
    const groundGeo = new THREE.PlaneGeometry(5000, 5000);
    const groundMat = new THREE.MeshStandardMaterial({ color: 0x1a331a, roughness: 1.0 });
    
    tLoader.load('/textures/grass.jpg', (tex) => {
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.RepeatWrapping;
        tex.repeat.set(500, 500);
        groundMat.map = tex;
    });

    const groundMesh = new THREE.Mesh(groundGeo, groundMat);
    groundMesh.rotation.x = -Math.PI / 2;
    groundMesh.receiveShadow = true;
    this.scene.add(groundMesh);
  }

  private createOptimizedCurbs(pts: THREE.Vector3[], trackWidth: number) {
    const up = new THREE.Vector3(0, 1, 0);
    const curbWidth = 1.2;
    const curbHeight = 0.2;
    const curbLength = 4.0;
    const curbGeo = new THREE.BoxGeometry(curbWidth, curbHeight, curbLength);
    
    const redGeometries: THREE.BufferGeometry[] = [];
    const whiteGeometries: THREE.BufferGeometry[] = [];

    for (let i = 0; i < pts.length - 1; i += 2) {
        const t = i / (pts.length - 1);
        const p0 = pts[i];
        const tangent = this.curve.getTangentAt(t).normalize();
        const normal = new THREE.Vector3().crossVectors(tangent, up).normalize();

        const isRed = (i % 8) < 4;
        
        [1, -1].forEach(side => {
            const g = curbGeo.clone();
            const pos = p0.clone().addScaledVector(normal, side * (trackWidth / 2 + curbWidth / 2));
            const dummy = new THREE.Object3D();
            dummy.position.copy(pos);
            dummy.lookAt(pos.clone().add(tangent));
            dummy.updateMatrix();
            g.applyMatrix4(dummy.matrix);
            if (isRed) redGeometries.push(g);
            else whiteGeometries.push(g);
        });
    }

    if (redGeometries.length > 0) {
        const redMerged = BufferGeometryUtils.mergeGeometries(redGeometries);
        this.scene.add(new THREE.Mesh(redMerged, new THREE.MeshStandardMaterial({ color: 0xff0000, roughness: 0.8 })));
    }
    if (whiteGeometries.length > 0) {
        const whiteMerged = BufferGeometryUtils.mergeGeometries(whiteGeometries);
        this.scene.add(new THREE.Mesh(whiteMerged, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8 })));
    }
  }

  private createOptimizedBarriers(pts: THREE.Vector3[], trackWidth: number) {
    const barrierHeight = 1.6;
    const barrierGeometries: THREE.BufferGeometry[] = [];
    const barrierGeo = new THREE.BoxGeometry(1, barrierHeight, 0.5);

    for (let i = 0; i < pts.length; i += 2) {
        const t = i / (pts.length - 1);
        const p0 = pts[i];
        const nextP = pts[(i + 1) % pts.length];
        const dist = p0.distanceTo(nextP) * 2;
        
        const tangent = this.curve.getTangentAt(t).normalize();
        const normal = new THREE.Vector3().crossVectors(tangent, new THREE.Vector3(0, 1, 0)).normalize();

        [1, -1].forEach(side => {
            const barrierPos = p0.clone().addScaledVector(normal, side * (trackWidth / 2 + 0.5));
            const g = barrierGeo.clone();
            g.scale(dist + 0.1, 1, 1);
            
            const dummy = new THREE.Object3D();
            dummy.position.copy(barrierPos);
            dummy.position.y = barrierHeight / 2;
            dummy.lookAt(nextP.clone().addScaledVector(normal, side * (trackWidth / 2 + 0.5)));
            dummy.rotateY(Math.PI / 2);
            dummy.updateMatrix();
            g.applyMatrix4(dummy.matrix);
            barrierGeometries.push(g);

            // Physics still needs to be individual but we can optimize this too if needed
            const wallShape = new CANNON.Box(new CANNON.Vec3(0.25, barrierHeight / 2, dist / 2));
            const wallBody = new CANNON.Body({ mass: 0 });
            wallBody.addShape(wallShape);
            wallBody.position.set(barrierPos.x, barrierHeight / 2, barrierPos.z);
            const q = new THREE.Quaternion();
            q.setFromUnitVectors(new THREE.Vector3(0, 0, 1), tangent);
            wallBody.quaternion.set(q.x, q.y, q.z, q.w);
            this.world.addBody(wallBody);
        });
    }
    
    const merged = BufferGeometryUtils.mergeGeometries(barrierGeometries);
    const barrierMat = new THREE.MeshStandardMaterial({ color: 0x444444 });
    const barrierMesh = new THREE.Mesh(merged, barrierMat);
    barrierMesh.receiveShadow = true;
    this.scene.add(barrierMesh);
  }

  private spawnOptimizedTrees() {
    const treeCount = 200;
    const trunkGeom = new THREE.CylinderGeometry(0.2, 0.3, 2);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x3d1f1f });
    const leavesGeom = new THREE.ConeGeometry(1.5, 4, 6);
    const leavesMat = new THREE.MeshStandardMaterial({ color: 0x1a2e1a });

    const trunkMesh = new THREE.InstancedMesh(trunkGeom, trunkMat, treeCount);
    const leavesMesh = new THREE.InstancedMesh(leavesGeom, leavesMat, treeCount);
    
    trunkMesh.castShadow = true;
    leavesMesh.castShadow = true;

    const dummy = new THREE.Object3D();

    for (let i = 0; i < treeCount; i++) {
        const t = Math.random();
        const pos = this.curve.getPointAt(t);
        const tangent = this.curve.getTangentAt(t).normalize();
        const normal = new THREE.Vector3().crossVectors(tangent, new THREE.Vector3(0, 1, 0)).normalize();
        const side = Math.random() > 0.5 ? 1 : -1;
        const dist = 18 + Math.random() * 25;
        const treePos = pos.clone().addScaledVector(normal, side * dist);

        dummy.position.copy(treePos);
        dummy.position.y = 1;
        dummy.scale.setScalar(0.8 + Math.random() * 0.4);
        dummy.updateMatrix();
        trunkMesh.setMatrixAt(i, dummy.matrix);

        dummy.position.y = 4;
        dummy.updateMatrix();
        leavesMesh.setMatrixAt(i, dummy.matrix);
    }
    
    this.scene.add(trunkMesh, leavesMesh);
  }

  private spawnOptimizedBanners() {
    const bannerCount = 15;
    const bannerGeom = new THREE.BoxGeometry(10, 3, 0.2);
    // Merge colors or use instanced mesh with attributes
    const colors = [0xff2800, 0x00f0ff, 0xffffff];
    
    for (let j = 0; j < 3; j++) {
        const mesh = new THREE.InstancedMesh(bannerGeom, new THREE.MeshStandardMaterial({ color: colors[j] }), Math.ceil(bannerCount / 3));
        let count = 0;
        const dummy = new THREE.Object3D();
        
        for (let i = 0; i < bannerCount; i++) {
            if (i % 3 !== j) continue;
            const t = i / bannerCount;
            const pos = this.curve.getPointAt(t);
            const tangent = this.curve.getTangentAt(t).normalize();
            const normal = new THREE.Vector3().crossVectors(tangent, new THREE.Vector3(0, 1, 0)).normalize();
            const side = (i % 2 === 0) ? 1 : -1;
            const bannerPos = pos.clone().addScaledVector(normal, side * 12);

            dummy.position.copy(bannerPos);
            dummy.position.y = 2;
            dummy.lookAt(pos);
            dummy.updateMatrix();
            mesh.setMatrixAt(count++, dummy.matrix);
        }
        this.scene.add(mesh);
    }
  }

  private createStartFinishVisuals() {
    const startPos = this.curve.getPointAt(0);
    const tangent = this.curve.getTangentAt(0).normalize();
    const normal = new THREE.Vector3().crossVectors(tangent, new THREE.Vector3(0, 1, 0)).normalize();
    
    const canvas = document.createElement('canvas');
    canvas.width = 128; canvas.height = 32;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = 'white'; ctx.fillRect(0,0,128,32);
    ctx.fillStyle = 'black';
    for(let x=0; x<8; x++) for(let y=0; y<2; y++) if((x+y)%2===0) ctx.fillRect(x*16, y*16, 16, 16);
    
    const checkTex = new THREE.CanvasTexture(canvas);
    const startLine = new THREE.Mesh(new THREE.PlaneGeometry(16, 2), new THREE.MeshStandardMaterial({ map: checkTex, transparent: true, opacity: 0.8 }));
    startLine.position.copy(startPos).add(new THREE.Vector3(0, 0.15, 0));
    startLine.rotation.x = -Math.PI / 2;
    startLine.lookAt(startPos.clone().add(normal));
    startLine.rotation.z = Math.PI / 2;
    this.scene.add(startLine);

    // Optimized Gantry
    const gantry = new THREE.Group();
    const pillarMat = new THREE.MeshStandardMaterial({ color: 0x222222 });
    const beam = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 19), pillarMat);
    beam.position.y = 8;
    const leftP = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.4, 8), pillarMat);
    leftP.position.set(0, 4, 9.5);
    const rightP = leftP.clone();
    rightP.position.set(0, 4, -9.5);
    gantry.add(beam, leftP, rightP);
    gantry.position.copy(startPos);
    gantry.lookAt(startPos.clone().add(tangent));
    this.scene.add(gantry);
  }
}
