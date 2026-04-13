import * as THREE from 'three';

export function createF1CarModel(color: number = 0xe3000f): THREE.Group {
  const f1Group = new THREE.Group();

  // Materials for AAA Realism
  const paintMaterial = new THREE.MeshPhysicalMaterial({ 
    color: color, 
    metalness: 0.8,
    roughness: 0.1,
    clearcoat: 1.0,
    clearcoatRoughness: 0.05
  });
  
  const blackCarbonMat = new THREE.MeshPhysicalMaterial({
    color: 0x111111,
    metalness: 0.9,
    roughness: 0.3,
    clearcoat: 0.8,
    clearcoatRoughness: 0.2
  });

  // Nose & Main Monocoque
  const monocoqueGeo = new THREE.BoxGeometry(0.7, 0.5, 3.5);
  // Taper the nose by moving vertices
  const pos = monocoqueGeo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const z = pos.getZ(i);
    const y = pos.getY(i);
    if (z > 0) { // Front half
      pos.setX(i, pos.getX(i) * (1 - z * 0.15));
      if (y > 0) pos.setY(i, pos.getY(i) - z * 0.1);
    }
  }
  monocoqueGeo.computeVertexNormals();
  const monocoque = new THREE.Mesh(monocoqueGeo, paintMaterial);
  monocoque.position.set(0, 0.4, 0);
  monocoque.castShadow = true;
  f1Group.add(monocoque);

  // Sidepods
  const sidepodGeo = new THREE.BoxGeometry(1.6, 0.4, 2.0);
  const sidepod = new THREE.Mesh(sidepodGeo, paintMaterial);
  sidepod.position.set(0, 0.35, -0.2);
  sidepod.castShadow = true;
  f1Group.add(sidepod);

  // Airbox
  const airboxGeo = new THREE.BoxGeometry(0.5, 0.6, 1.2);
  const airbox = new THREE.Mesh(airboxGeo, blackCarbonMat);
  airbox.position.set(0, 0.8, -0.6);
  airbox.castShadow = true;
  f1Group.add(airbox);

  // Front Wing
  const frontWingMainGeo = new THREE.BoxGeometry(1.8, 0.05, 0.4);
  const frontWingMain = new THREE.Mesh(frontWingMainGeo, blackCarbonMat);
  frontWingMain.position.set(0, 0.15, 1.8);
  frontWingMain.castShadow = true;
  f1Group.add(frontWingMain);

  const frontWingEndplateGeo = new THREE.BoxGeometry(0.05, 0.25, 0.5);
  const fwLeft = new THREE.Mesh(frontWingEndplateGeo, paintMaterial);
  fwLeft.position.set(0.9, 0.25, 1.8);
  fwLeft.castShadow = true;
  const fwRight = fwLeft.clone();
  fwRight.position.set(-0.9, 0.25, 1.8);
  f1Group.add(fwLeft);
  f1Group.add(fwRight);

  // Rear Wing
  const rearWingMainGeo = new THREE.BoxGeometry(1.5, 0.05, 0.5);
  const rearWingMain = new THREE.Mesh(rearWingMainGeo, paintMaterial);
  rearWingMain.position.set(0, 0.9, -1.8);
  rearWingMain.castShadow = true;
  f1Group.add(rearWingMain);
  
  const rearWingEndplateGeo = new THREE.BoxGeometry(0.05, 0.6, 0.6);
  const rwLeft = new THREE.Mesh(rearWingEndplateGeo, blackCarbonMat);
  rwLeft.position.set(0.75, 0.7, -1.8);
  rwLeft.castShadow = true;
  const rwRight = rwLeft.clone();
  rwRight.position.set(-0.75, 0.7, -1.8);
  f1Group.add(rwLeft);
  f1Group.add(rwRight);

  // Halo
  const haloCurve = new THREE.EllipseCurve(0, 0, 0.4, 0.3, 0, Math.PI, false, 0);
  const haloPoints = haloCurve.getPoints(50);
  const haloShape = new THREE.Shape();
  haloShape.moveTo(0, 0);
  haloShape.arc(0, 0, 0.03, 0, Math.PI * 2, false);
  const extrudeSettings = {
    steps: 50,
    bevelEnabled: false,
    extrudePath: new THREE.CatmullRomCurve3(haloPoints.map(p => new THREE.Vector3(p.x, 0.65, p.y + 0.3)))
  };
  const haloGeo = new THREE.ExtrudeGeometry(haloShape, extrudeSettings);
  const halo = new THREE.Mesh(haloGeo, blackCarbonMat);
  halo.castShadow = true;
  f1Group.add(halo);

  const haloPillarGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.25);
  const haloPillar = new THREE.Mesh(haloPillarGeo, blackCarbonMat);
  haloPillar.position.set(0, 0.5, 0.6);
  haloPillar.rotation.x = Math.PI / 8;
  haloPillar.castShadow = true;
  f1Group.add(haloPillar);

  return f1Group;
}
