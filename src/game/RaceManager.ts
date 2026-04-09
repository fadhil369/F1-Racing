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
    private lapCount = 3;
    
    public carData: Map<Car, { lap: number, lastU: number, totalU: number, isPlayer: boolean }>;
    private positions: RacePosition[] = [];
    private minimapPoints: THREE.Vector3[] = [];

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

        // Cache minimap points once (Using getPoints which is safer/faster for init)
        this.minimapPoints = this.track.curve.getPoints(100);
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

    private renderMinimap() {
        const canvas = document.getElementById('minimap') as HTMLCanvasElement;
        if (!canvas) return;
        
        // Ensure buffer size matches display size
        if (canvas.width !== canvas.clientWidth || canvas.height !== canvas.clientHeight) {
            canvas.width = canvas.clientWidth;
            canvas.height = canvas.clientHeight;
        }

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Clear
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Draw Track (Using cached points)
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.lineWidth = 2;
        ctx.lineJoin = 'round';
        ctx.beginPath();
        
        const mapScale = 0.1; 
        const centerX = canvas.width / 2 + 20; 
        const centerY = canvas.height / 2 - 10;

        if (this.minimapPoints.length > 0) {
            this.minimapPoints.forEach((p, i) => {
                const x = centerX + p.x * mapScale;
                const y = centerY + p.z * mapScale;
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            });
            ctx.closePath();
            ctx.stroke();
        }

        // Draw Cars
        this.positions.forEach(p => {
            const pos = p.car.visualBody.position;
            const x = centerX + pos.x * mapScale;
            const y = centerY + pos.z * mapScale;
            
            ctx.fillStyle = p.isPlayer ? '#ff2800' : '#ffffff';
            ctx.beginPath();
            ctx.arc(x, y, p.isPlayer ? 4 : 2, 0, Math.PI * 2);
            ctx.fill();
        });
    }
}
