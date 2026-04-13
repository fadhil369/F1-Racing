import * as THREE from 'three';

export interface CarStats {
  name: string;
  color: number;
  maxSpeed: number;
  acceleration: number;
  steerSpeed: number;
  description: string;
}

export interface TrackLevel {
  id: number;
  name: string;
  difficulty: 'Easy' | 'Medium' | 'Hard' | 'Deadly';
  points: THREE.Vector3[];
}

export const CAR_TYPES: CarStats[] = [
  {
    name: "GT-PRO",
    color: 0xff2800,
    maxSpeed: 60,
    acceleration: 18,
    steerSpeed: 1.4,
    description: "Balanced performance for all drivers."
  },
  {
    name: "AERO-MAX",
    color: 0x0066ff,
    maxSpeed: 75,
    acceleration: 14,
    steerSpeed: 1.1,
    description: "Exceptional top speed but harder to turn."
  },
  {
    name: "STINGRAY",
    color: 0xffcc00,
    maxSpeed: 52,
    acceleration: 24,
    steerSpeed: 1.8,
    description: "Lightning acceleration and razor-sharp handling."
  }
];

export const TRACK_LEVELS: TrackLevel[] = [
  {
    id: 1,
    name: "Tranquil Oval",
    difficulty: "Easy",
    points: [
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(200, 0, 0),
      new THREE.Vector3(250, 0, 50),
      new THREE.Vector3(250, 0, 150),
      new THREE.Vector3(200, 0, 200),
      new THREE.Vector3(0, 0, 200),
      new THREE.Vector3(-50, 0, 150),
      new THREE.Vector3(-50, 0, 50),
    ]
  },
  {
    id: 2,
    name: "Speed Rectangle",
    difficulty: "Easy",
    points: [
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(400, 0, 0),
      new THREE.Vector3(400, 0, 100),
      new THREE.Vector3(0, 0, 100),
    ]
  },
  {
    id: 3,
    name: "Twisted Loop",
    difficulty: "Medium",
    points: [
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(150, 0, 50),
      new THREE.Vector3(300, 0, 0),
      new THREE.Vector3(350, 0, 150),
      new THREE.Vector3(200, 0, 300),
      new THREE.Vector3(0, 0, 250),
      new THREE.Vector3(-100, 0, 100),
    ]
  },
  {
    id: 4,
    name: "Desert Cobra",
    difficulty: "Medium",
    points: [
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(200, 0, 0),
      new THREE.Vector3(250, 0, 100),
      new THREE.Vector3(150, 0, 200),
      new THREE.Vector3(250, 0, 300),
      new THREE.Vector3(400, 0, 350),
      new THREE.Vector3(400, 0, 500),
      new THREE.Vector3(200, 0, 600),
      new THREE.Vector3(0, 0, 500),
      new THREE.Vector3(-100, 0, 300),
    ]
  },
  {
    id: 5,
    name: "The Slalom",
    difficulty: "Hard",
    points: [
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(100, 0, 50),
      new THREE.Vector3(0, 0, 100),
      new THREE.Vector3(100, 0, 150),
      new THREE.Vector3(0, 0, 200),
      new THREE.Vector3(100, 0, 250),
      new THREE.Vector3(300, 0, 300),
      new THREE.Vector3(300, 0, -50),
    ]
  },
  {
    id: 6,
    name: "Neon Intersection",
    difficulty: "Hard",
    points: [
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(300, 0, 0),
      new THREE.Vector3(300, 0, 300),
      new THREE.Vector3(0, 0, 300),
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(150, 0, 150),
      new THREE.Vector3(300, 0, 0),
      new THREE.Vector3(300, 0, 300),
    ]
  },
  {
    id: 7,
    name: "Mountain Pass",
    difficulty: "Hard",
    points: [
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(100, 0, 100),
      new THREE.Vector3(300, 0, 150),
      new THREE.Vector3(450, 0, 50),
      new THREE.Vector3(600, 0, 200),
      new THREE.Vector3(400, 0, 400),
      new THREE.Vector3(200, 0, 350),
      new THREE.Vector3(0, 0, 500),
      new THREE.Vector3(-200, 0, 250),
    ]
  },
  {
    id: 8,
    name: "Volcano Rim",
    difficulty: "Hard",
    points: [
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(200, 0, -200),
      new THREE.Vector3(400, 0, 0),
      new THREE.Vector3(600, 0, 200),
      new THREE.Vector3(400, 0, 400),
      new THREE.Vector3(200, 0, 600),
      new THREE.Vector3(0, 0, 400),
      new THREE.Vector3(-200, 0, 200),
    ]
  },
  {
    id: 9,
    name: "Dragon's Tail",
    difficulty: "Deadly",
    points: [
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(50, 0, 100),
      new THREE.Vector3(-50, 0, 200),
      new THREE.Vector3(50, 0, 300),
      new THREE.Vector3(-50, 0, 400),
      new THREE.Vector3(50, 0, 500),
      new THREE.Vector3(300, 0, 500),
      new THREE.Vector3(300, 0, 0),
    ]
  },
  {
    id: 10,
    name: "The Omega",
    difficulty: "Deadly",
    points: [
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(500, 0, 0),
      new THREE.Vector3(550, 0, 100),
      new THREE.Vector3(400, 0, 300),
      new THREE.Vector3(600, 0, 500),
      new THREE.Vector3(300, 0, 700),
      new THREE.Vector3(0, 0, 500),
      new THREE.Vector3(-100, 0, 800),
      new THREE.Vector3(-400, 0, 600),
      new THREE.Vector3(-300, 0, 200),
      new THREE.Vector3(-100, 0, 100),
    ]
  }
];
