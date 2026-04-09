import * as THREE from 'three';
import { Car } from './Car';
import { Track } from './Track';

export interface RacePosition {
    car: Car;
    lap: number;
    progress: number; // 0-1 along current lap
    totalDistance: number;
    position: number;
    isPlayer: boolean;
}

export class RaceManager {
    public cars: Car[];
    private track: Track;
    
    public carData: Map<Car, { lap: number, lastU: number, totalU: number, isPlayer: boolean }>;
    private positions: RacePosition[] = [];

    constructor(cars: Car[], track: Track, playerCar: Car) {
        this.cars = cars;
        this.track = track;
        this.carData = new Map();

        this.cars.forEach(car => {
            this.carData.set(car, {
                lap: 1,
                lastU: 0,
                totalU: 0,
                isPlayer: car === playerCar
            });
        });
    }

    public update() {
        this.cars.forEach(car => {
            const data = this.carData.get(car)!;
            // Optimized: search locally around last known U
            const currentU = this.findClosestULocal(car.visualBody.position, data.lastU);
            
            // Check for lap completion (U goes from 0.99 to 0.01)
            if (data.lastU > 0.8 && currentU < 0.2) {
                data.lap++;
            } else if (data.lastU < 0.2 && currentU > 0.8) {
                // Reversed? Not likely in F1 but handle it
                data.lap--;
            }

            data.totalU = (data.lap - 1) + currentU;
            data.lastU = currentU;
        });

        // Update positions
        this.positions = this.cars.map(car => {
             const data = this.carData.get(car)!;
             return {
                 car,
                 lap: data.lap,
                 progress: data.lastU,
                 totalDistance: data.totalU,
                 position: 0,
                 isPlayer: data.isPlayer
             };
        }).sort((a, b) => b.totalDistance - a.totalDistance);

        this.positions.forEach((p, index) => {
            p.position = index + 1;
        });

        this.updateHUD();
    }

    // Localized search to save CPU
    private findClosestULocal(pos: THREE.Vector3, lastU: number): number {
        let minU = lastU;
        let minDist = Infinity;
        
        // Search in a window around lastU
        const divisions = 50;
        const range = 0.1; // 10% of track length

        for (let i = 0; i <= divisions; i++) {
            const u = (lastU - range / 2 + (i / divisions) * range + 1) % 1;
            const p = this.track.curve.getPointAt(u);
            const d = p.distanceToSquared(pos);
            if (d < minDist) {
                minDist = d;
                minU = u;
            }
        }
        return minU;
    }

    public getCarProgress(car: Car): number {
        return this.carData.get(car)?.lastU || 0;
    }

    private updateHUD() {
        // HUD elements (pos-info, lap-info, minimap) have been removed for a minimalist experience.
    }
}
