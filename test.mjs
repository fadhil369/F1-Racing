import * as THREE from 'three';
console.log("THREE loaded.");

const points = [
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(200, 0, 0),
      new THREE.Vector3(250, 0, 50),
      new THREE.Vector3(250, 0, 150),
      new THREE.Vector3(200, 0, 200),
      new THREE.Vector3(0, 0, 200),
      new THREE.Vector3(-50, 0, 150),
      new THREE.Vector3(-50, 0, 50),
];

const curve = new THREE.CatmullRomCurve3(points, true);
console.log("Curve created.");

const startT = 0.01;
const startPos = curve.getPointAt(startT);
const tangent = curve.getTangentAt(startT).normalize();
const angle = Math.atan2(tangent.x, tangent.z);

console.log("StartPos:", startPos);
console.log("Angle:", angle);
