/**
 * Floor Plan Generator
 * Generates 2D floor plans from detected walls and calculates dimensions
 */

import { MathUtils, DataUtils } from './utils.js';

export class FloorPlanGenerator {
    constructor() {
        this.walls = [];
        this.doors = [];
        this.rooms = [];
        this.bounds = null;
        this.scale = 1;
    }

    /**
     * Generate floor plan from walls and openings
     */
    generate(walls, doors = []) {
        console.log('Generating floor plan from', walls.length, 'walls');

        this.walls = walls;
        this.doors = doors;

        // Calculate bounding box
        this.bounds = this.calculateBounds();

        // Identify rooms
        this.rooms = this.identifyRooms();

        // Calculate dimensions
        const dimensions = this.calculateDimensions();

        // Calculate total area
        const totalArea = this.calculateTotalArea();

        return {
            walls: this.walls,
            doors: this.doors,
            rooms: this.rooms,
            bounds: this.bounds,
            dimensions,
            totalArea
        };
    }

    /**
     * Calculate bounding box of all walls
     */
    calculateBounds() {
        if (this.walls.length === 0) {
            return { min: { x: 0, y: 0 }, max: { x: 0, y: 0 }, width: 0, height: 0 };
        }

        let minX = Infinity, minY = Infinity;
        let maxX = -Infinity, maxY = -Infinity;

        for (const wall of this.walls) {
            minX = Math.min(minX, wall.start.x, wall.end.x);
            minY = Math.min(minY, wall.start.y, wall.end.y);
            maxX = Math.max(maxX, wall.start.x, wall.end.x);
            maxY = Math.max(maxY, wall.start.y, wall.end.y);
        }

        return {
            min: { x: minX, y: minY },
            max: { x: maxX, y: maxY },
            width: maxX - minX,
            height: maxY - minY
        };
    }

    /**
     * Identify separate rooms from wall topology
     */
    identifyRooms() {
        // Simplified room identification
        // In a full implementation, this would use graph algorithms to find enclosed spaces

        if (this.walls.length === 0) {
            return [];
        }

        // For now, treat the entire space as one room
        const allPoints = [];
        for (const wall of this.walls) {
            allPoints.push(wall.start, wall.end);
        }

        // Find unique corners (vertices)
        const corners = this.findUniqueCorners(allPoints);

        // Calculate center point
        const center = MathUtils.polygonCentroid(corners);

        // Calculate area using all corners
        const area = MathUtils.polygonArea(corners);

        return [{
            id: 'room-1',
            name: 'Main Space',
            corners,
            center,
            area,
            walls: this.walls.map((_, i) => i)
        }];
    }

    /**
     * Find unique corner points
     */
    findUniqueCorners(points) {
        const uniqueCorners = [];
        const threshold = 0.1; // 10cm threshold for considering points the same

        for (const point of points) {
            let isDuplicate = false;

            for (const corner of uniqueCorners) {
                const dist = MathUtils.distance2D(point, corner);
                if (dist < threshold) {
                    isDuplicate = true;
                    break;
                }
            }

            if (!isDuplicate) {
                uniqueCorners.push({ x: point.x, y: point.y });
            }
        }

        // Sort corners by angle from centroid (for polygon area calculation)
        const centroid = {
            x: uniqueCorners.reduce((sum, p) => sum + p.x, 0) / uniqueCorners.length,
            y: uniqueCorners.reduce((sum, p) => sum + p.y, 0) / uniqueCorners.length
        };

        uniqueCorners.sort((a, b) => {
            const angleA = Math.atan2(a.y - centroid.y, a.x - centroid.x);
            const angleB = Math.atan2(b.y - centroid.y, b.x - centroid.x);
            return angleA - angleB;
        });

        return uniqueCorners;
    }

    /**
     * Calculate dimensions (wall lengths, room sizes)
     */
    calculateDimensions() {
        const dimensions = {
            walls: [],
            rooms: []
        };

        // Calculate wall lengths
        for (let i = 0; i < this.walls.length; i++) {
            const wall = this.walls[i];
            const length = MathUtils.distance2D(wall.start, wall.end);

            dimensions.walls.push({
                id: `wall-${i}`,
                length,
                start: wall.start,
                end: wall.end
            });
        }

        // Calculate room dimensions
        for (const room of this.rooms) {
            const corners = room.corners;
            if (corners.length < 3) continue;

            // Find width and height (axis-aligned bounding box)
            let minX = Infinity, minY = Infinity;
            let maxX = -Infinity, maxY = -Infinity;

            for (const corner of corners) {
                minX = Math.min(minX, corner.x);
                minY = Math.min(minY, corner.y);
                maxX = Math.max(maxX, corner.x);
                maxY = Math.max(maxY, corner.y);
            }

            dimensions.rooms.push({
                id: room.id,
                name: room.name,
                width: maxX - minX,
                height: maxY - minY,
                area: room.area
            });
        }

        return dimensions;
    }

    /**
     * Calculate total floor area
     */
    calculateTotalArea() {
        return this.rooms.reduce((total, room) => total + room.area, 0);
    }

    /**
     * Get floor plan data for rendering
     */
    getData() {
        return {
            walls: this.walls,
            doors: this.doors,
            rooms: this.rooms,
            bounds: this.bounds
        };
    }

    /**
     * Convert floor plan to SVG
     */
    toSVG(width = 800, height = 600, options = {}) {
        const {
            showDimensions = true,
            showLabels = true,
            padding = 50
        } = options;

        if (!this.bounds || this.walls.length === 0) {
            return '<svg></svg>';
        }

        // Calculate scale to fit
        const scaleX = (width - padding * 2) / this.bounds.width;
        const scaleY = (height - padding * 2) / this.bounds.height;
        const scale = Math.min(scaleX, scaleY);

        const transform = (x, y) => ({
            x: padding + (x - this.bounds.min.x) * scale,
            y: padding + (y - this.bounds.min.y) * scale
        });

        let svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">`;
        svg += `<rect width="${width}" height="${height}" fill="white"/>`;

        // Draw walls
        svg += '<g id="walls" stroke="black" stroke-width="3" stroke-linecap="round">';
        for (const wall of this.walls) {
            const start = transform(wall.start.x, wall.start.y);
            const end = transform(wall.end.x, wall.end.y);
            svg += `<line x1="${start.x}" y1="${start.y}" x2="${end.x}" y2="${end.y}"/>`;
        }
        svg += '</g>';

        // Draw doors
        if (this.doors.length > 0) {
            svg += '<g id="doors" stroke="brown" stroke-width="2" stroke-dasharray="5,5">';
            for (const door of this.doors) {
                const start = transform(door.start.x, door.start.y);
                const end = transform(door.end.x, door.end.y);
                svg += `<line x1="${start.x}" y1="${start.y}" x2="${end.x}" y2="${end.y}"/>`;
            }
            svg += '</g>';
        }

        // Draw dimensions
        if (showDimensions) {
            svg += '<g id="dimensions" fill="gray" font-size="12" font-family="Arial">';
            for (let i = 0; i < this.walls.length; i++) {
                const wall = this.walls[i];
                const length = MathUtils.distance2D(wall.start, wall.end);
                const mid = {
                    x: (wall.start.x + wall.end.x) / 2,
                    y: (wall.start.y + wall.end.y) / 2
                };
                const pos = transform(mid.x, mid.y);
                svg += `<text x="${pos.x}" y="${pos.y}" text-anchor="middle">${length.toFixed(2)}m</text>`;
            }
            svg += '</g>';
        }

        // Draw room labels
        if (showLabels) {
            svg += '<g id="labels" fill="blue" font-size="16" font-family="Arial" font-weight="bold">';
            for (const room of this.rooms) {
                const pos = transform(room.center.x, room.center.y);
                svg += `<text x="${pos.x}" y="${pos.y}" text-anchor="middle">${room.name}</text>`;
                svg += `<text x="${pos.x}" y="${pos.y + 20}" text-anchor="middle" font-size="12" font-weight="normal">${room.area.toFixed(1)}m²</text>`;
            }
            svg += '</g>';
        }

        svg += '</svg>';
        return svg;
    }

    /**
     * Export floor plan data as JSON
     */
    toJSON() {
        return JSON.stringify({
            walls: this.walls,
            doors: this.doors,
            rooms: this.rooms,
            bounds: this.bounds,
            dimensions: this.calculateDimensions(),
            totalArea: this.calculateTotalArea()
        }, null, 2);
    }
}

export default FloorPlanGenerator;
