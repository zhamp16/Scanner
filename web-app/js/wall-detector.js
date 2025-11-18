/**
 * Wall Detector
 * Detects walls, doors, and openings from point cloud data using RANSAC and clustering
 */

import { MathUtils, DataUtils } from './utils.js';

export class WallDetector {
    constructor() {
        // Detection parameters
        this.gridCellSize = 0.1; // 10cm grid cells
        this.minWallLength = 0.3; // 30cm minimum wall length
        this.minWallHeight = 0.5; // 50cm minimum height
        this.maxWallHeight = 3.0; // 3m maximum height
        this.wallThicknessThreshold = 0.15; // 15cm
        this.angleSnapThreshold = 15; // degrees
        this.doorWidthRange = { min: 0.6, max: 1.2 }; // meters
        this.doorSampleDistance = 0.1; // 10cm sampling for door detection

        // RANSAC parameters
        this.ransacIterations = 100;
        this.ransacThreshold = 0.05; // 5cm tolerance
        this.ransacMinInliers = 50;
    }

    /**
     * Detect walls from point cloud
     */
    detectWalls(points, normals) {
        console.log('Starting wall detection with', points.length, 'points');

        // Step 1: Detect floor level
        const floorLevel = this.detectFloorLevel(points);
        console.log('Floor level detected at Y =', floorLevel);

        // Step 2: Filter points by height (wall height range)
        const wallPoints = this.filterByWallHeight(points, normals, floorLevel);
        console.log('Filtered to', wallPoints.length, 'wall points');

        // Step 3: Project to 2D (top-down view)
        const points2D = wallPoints.map(p => ({
            x: p.point.x,
            y: p.point.z, // Use Z as Y in 2D
            originalY: p.point.y,
            normal: p.normal
        }));

        // Step 4: Grid-based clustering
        const clusters = this.gridCluster(points2D);
        console.log('Created', clusters.length, 'clusters');

        // Step 5: Fit lines to clusters (wall segments)
        const wallSegments = [];
        for (const cluster of clusters) {
            if (cluster.length >= this.ransacMinInliers) {
                const line = this.fitLineRANSAC(cluster);
                if (line) {
                    wallSegments.push({
                        start: line.start,
                        end: line.end,
                        normal: line.normal,
                        thickness: line.thickness,
                        points: cluster
                    });
                }
            }
        }

        console.log('Detected', wallSegments.length, 'wall segments');

        // Step 6: Process walls (snap, merge, connect)
        const walls = this.processWalls(wallSegments);
        console.log('Processed to', walls.length, 'walls');

        return {
            walls,
            floorLevel
        };
    }

    /**
     * Detect floor level using histogram
     */
    detectFloorLevel(points) {
        if (points.length === 0) return 0;

        // Create histogram of Y coordinates
        const binSize = 0.05; // 5cm bins
        const yValues = points.map(p => p.y);
        const histogram = DataUtils.createHistogram(yValues, binSize);

        // Find most common Y value (floor)
        return DataUtils.findMostCommon(histogram);
    }

    /**
     * Filter points that are at wall height
     */
    filterByWallHeight(points, normals, floorLevel) {
        const wallPoints = [];

        for (let i = 0; i < points.length; i++) {
            const point = points[i];
            const normal = normals[i] || { x: 0, y: 0, z: 1 };

            // Check if point is at wall height
            const heightAboveFloor = point.y - floorLevel;
            if (heightAboveFloor < this.minWallHeight || heightAboveFloor > this.maxWallHeight) {
                continue;
            }

            // Check if normal is horizontal (vertical surface)
            // Wall normals should be perpendicular to Y axis
            const horizontalNormal = Math.sqrt(normal.x * normal.x + normal.z * normal.z);
            if (horizontalNormal > 0.7) { // Threshold for "horizontal" normal
                wallPoints.push({ point, normal });
            }
        }

        return wallPoints;
    }

    /**
     * Grid-based spatial clustering
     */
    gridCluster(points2D) {
        // Group points into grid cells
        const grid = new Map();

        for (const point of points2D) {
            const cellX = Math.floor(point.x / this.gridCellSize);
            const cellY = Math.floor(point.y / this.gridCellSize);
            const key = `${cellX},${cellY}`;

            if (!grid.has(key)) {
                grid.set(key, []);
            }
            grid.get(key).push(point);
        }

        // Connected component analysis
        const visited = new Set();
        const clusters = [];

        for (const [key, cellPoints] of grid) {
            if (visited.has(key)) continue;

            const cluster = [];
            const queue = [key];
            visited.add(key);

            while (queue.length > 0) {
                const currentKey = queue.shift();
                const [cx, cy] = currentKey.split(',').map(Number);

                if (grid.has(currentKey)) {
                    cluster.push(...grid.get(currentKey));
                }

                // Check 8-connected neighbors
                for (let dx = -1; dx <= 1; dx++) {
                    for (let dy = -1; dy <= 1; dy++) {
                        if (dx === 0 && dy === 0) continue;

                        const neighborKey = `${cx + dx},${cy + dy}`;
                        if (!visited.has(neighborKey) && grid.has(neighborKey)) {
                            visited.add(neighborKey);
                            queue.push(neighborKey);
                        }
                    }
                }
            }

            if (cluster.length > 0) {
                clusters.push(cluster);
            }
        }

        return clusters;
    }

    /**
     * Fit line to points using RANSAC
     */
    fitLineRANSAC(points) {
        if (points.length < 2) return null;

        let bestLine = null;
        let maxInliers = 0;

        for (let i = 0; i < this.ransacIterations; i++) {
            // Randomly sample two points
            const idx1 = Math.floor(Math.random() * points.length);
            let idx2 = Math.floor(Math.random() * points.length);
            while (idx2 === idx1) {
                idx2 = Math.floor(Math.random() * points.length);
            }

            const p1 = points[idx1];
            const p2 = points[idx2];

            // Calculate line direction
            const dx = p2.x - p1.x;
            const dy = p2.y - p1.y;
            const length = Math.sqrt(dx * dx + dy * dy);

            if (length < this.minWallLength) continue;

            // Normalize direction
            const dirX = dx / length;
            const dirY = dy / length;

            // Count inliers (points close to line)
            const inliers = [];
            for (const point of points) {
                const dist = this.pointToLineDistance(point, p1, dirX, dirY);
                if (dist < this.ransacThreshold) {
                    inliers.push(point);
                }
            }

            if (inliers.length > maxInliers) {
                maxInliers = inliers.length;

                // Refine line using all inliers (PCA)
                const refined = this.fitLinePCA(inliers);
                bestLine = {
                    ...refined,
                    inlierCount: inliers.length
                };
            }
        }

        return bestLine;
    }

    /**
     * Fit line using Principal Component Analysis
     */
    fitLinePCA(points) {
        if (points.length < 2) return null;

        // Calculate centroid
        let cx = 0, cy = 0;
        for (const p of points) {
            cx += p.x;
            cy += p.y;
        }
        cx /= points.length;
        cy /= points.length;

        // Calculate covariance matrix
        let cxx = 0, cyy = 0, cxy = 0;
        for (const p of points) {
            const dx = p.x - cx;
            const dy = p.y - cy;
            cxx += dx * dx;
            cyy += dy * dy;
            cxy += dx * dy;
        }

        // Find principal component (eigenvector)
        const trace = cxx + cyy;
        const det = cxx * cyy - cxy * cxy;
        const eigenvalue = trace / 2 + Math.sqrt((trace / 2) ** 2 - det);

        let dirX, dirY;
        if (Math.abs(cxy) > 1e-10) {
            dirX = eigenvalue - cyy;
            dirY = cxy;
        } else {
            dirX = 1;
            dirY = 0;
        }

        // Normalize
        const length = Math.sqrt(dirX * dirX + dirY * dirY);
        dirX /= length;
        dirY /= length;

        // Find endpoints
        let minProj = Infinity, maxProj = -Infinity;
        for (const p of points) {
            const proj = (p.x - cx) * dirX + (p.y - cy) * dirY;
            minProj = Math.min(minProj, proj);
            maxProj = Math.max(maxProj, proj);
        }

        const start = {
            x: cx + minProj * dirX,
            y: cx + minProj * dirY
        };

        const end = {
            x: cx + maxProj * dirX,
            y: cy + maxProj * dirY
        };

        // Calculate wall normal (perpendicular to direction)
        const normal = {
            x: -dirY,
            y: dirX
        };

        return {
            start,
            end,
            normal,
            thickness: this.estimateWallThickness(points, start, dirX, dirY)
        };
    }

    /**
     * Calculate distance from point to line
     */
    pointToLineDistance(point, linePoint, dirX, dirY) {
        const dx = point.x - linePoint.x;
        const dy = point.y - linePoint.y;

        // Perpendicular distance
        return Math.abs(dx * (-dirY) + dy * dirX);
    }

    /**
     * Estimate wall thickness
     */
    estimateWallThickness(points, linePoint, dirX, dirY) {
        const distances = points.map(p =>
            this.pointToLineDistance(p, linePoint, dirX, dirY)
        );

        // Use median distance
        distances.sort((a, b) => a - b);
        const median = distances[Math.floor(distances.length / 2)];

        return Math.min(median * 2, this.wallThicknessThreshold);
    }

    /**
     * Process walls (snap to cardinal directions, merge, connect)
     */
    processWalls(wallSegments) {
        if (wallSegments.length === 0) return [];

        // Step 1: Snap to cardinal directions
        const snapped = wallSegments.map(wall => this.snapWallToCardinal(wall));

        // Step 2: Merge parallel walls that are close
        const merged = this.mergeParallelWalls(snapped);

        // Step 3: Connect wall endpoints
        const connected = this.connectWalls(merged);

        return connected;
    }

    /**
     * Snap wall to nearest cardinal direction
     */
    snapWallToCardinal(wall) {
        const dx = wall.end.x - wall.start.x;
        const dy = wall.end.y - wall.start.y;
        const angle = Math.atan2(dy, dx) * (180 / Math.PI);

        const snappedAngle = MathUtils.snapToCardinal(angle, this.angleSnapThreshold);

        if (Math.abs(snappedAngle - angle) < this.angleSnapThreshold) {
            const length = Math.sqrt(dx * dx + dy * dy);
            const rad = snappedAngle * (Math.PI / 180);

            const newDx = Math.cos(rad) * length;
            const newDy = Math.sin(rad) * length;

            return {
                ...wall,
                end: {
                    x: wall.start.x + newDx,
                    y: wall.start.y + newDy
                }
            };
        }

        return wall;
    }

    /**
     * Merge parallel walls that are close together
     */
    mergeParallelWalls(walls) {
        const merged = [];
        const used = new Set();

        for (let i = 0; i < walls.length; i++) {
            if (used.has(i)) continue;

            let currentWall = walls[i];
            used.add(i);

            // Find parallel walls to merge
            for (let j = i + 1; j < walls.length; j++) {
                if (used.has(j)) continue;

                const otherWall = walls[j];

                if (this.areWallsParallel(currentWall, otherWall) &&
                    this.areWallsClose(currentWall, otherWall)) {
                    // Merge walls
                    currentWall = this.mergeWalls(currentWall, otherWall);
                    used.add(j);
                }
            }

            merged.push(currentWall);
        }

        return merged;
    }

    /**
     * Check if two walls are parallel
     */
    areWallsParallel(wall1, wall2) {
        const dx1 = wall1.end.x - wall1.start.x;
        const dy1 = wall1.end.y - wall1.start.y;
        const dx2 = wall2.end.x - wall2.start.x;
        const dy2 = wall2.end.y - wall2.start.y;

        const angle1 = Math.atan2(dy1, dx1);
        const angle2 = Math.atan2(dy2, dx2);

        const angleDiff = Math.abs(angle1 - angle2) * (180 / Math.PI);

        return angleDiff < this.angleSnapThreshold || angleDiff > (180 - this.angleSnapThreshold);
    }

    /**
     * Check if two walls are close to each other
     */
    areWallsClose(wall1, wall2) {
        const dist = Math.min(
            MathUtils.distance2D(wall1.start, wall2.start),
            MathUtils.distance2D(wall1.start, wall2.end),
            MathUtils.distance2D(wall1.end, wall2.start),
            MathUtils.distance2D(wall1.end, wall2.end)
        );

        return dist < this.wallThicknessThreshold * 3;
    }

    /**
     * Merge two walls into one
     */
    mergeWalls(wall1, wall2) {
        // Find extreme points
        const allPoints = [wall1.start, wall1.end, wall2.start, wall2.end];

        const dx = wall1.end.x - wall1.start.x;
        const dy = wall1.end.y - wall1.start.y;
        const length = Math.sqrt(dx * dx + dy * dy);
        const dirX = dx / length;
        const dirY = dy / length;

        let minProj = Infinity, maxProj = -Infinity;
        let minPoint = null, maxPoint = null;

        for (const point of allPoints) {
            const proj = point.x * dirX + point.y * dirY;
            if (proj < minProj) {
                minProj = proj;
                minPoint = point;
            }
            if (proj > maxProj) {
                maxProj = proj;
                maxPoint = point;
            }
        }

        return {
            start: minPoint,
            end: maxPoint,
            normal: wall1.normal,
            thickness: (wall1.thickness + wall2.thickness) / 2,
            points: [...(wall1.points || []), ...(wall2.points || [])]
        };
    }

    /**
     * Connect wall endpoints that are close
     */
    connectWalls(walls) {
        const connectionThreshold = 0.3; // 30cm

        for (let i = 0; i < walls.length; i++) {
            for (let j = i + 1; j < walls.length; j++) {
                const wall1 = walls[i];
                const wall2 = walls[j];

                // Check if endpoints are close
                const distances = [
                    { dist: MathUtils.distance2D(wall1.end, wall2.start), type: 'end-start' },
                    { dist: MathUtils.distance2D(wall1.end, wall2.end), type: 'end-end' },
                    { dist: MathUtils.distance2D(wall1.start, wall2.start), type: 'start-start' },
                    { dist: MathUtils.distance2D(wall1.start, wall2.end), type: 'start-end' }
                ];

                const closest = distances.reduce((min, curr) =>
                    curr.dist < min.dist ? curr : min
                );

                if (closest.dist < connectionThreshold) {
                    // Snap endpoints together
                    const midpoint = {
                        x: (wall1[closest.type.split('-')[0]].x + wall2[closest.type.split('-')[1]].x) / 2,
                        y: (wall1[closest.type.split('-')[0]].y + wall2[closest.type.split('-')[1]].y) / 2
                    };

                    wall1[closest.type.split('-')[0]] = midpoint;
                    wall2[closest.type.split('-')[1]] = midpoint;
                }
            }
        }

        return walls;
    }

    /**
     * Detect door and window openings
     */
    detectOpenings(walls, points) {
        const openings = [];

        for (const wall of walls) {
            const wallOpenings = this.detectOpeningsInWall(wall, points);
            openings.push(...wallOpenings);
        }

        return openings;
    }

    /**
     * Detect openings in a specific wall
     */
    detectOpeningsInWall(wall, points) {
        const openings = [];
        const dx = wall.end.x - wall.start.x;
        const dy = wall.end.y - wall.start.y;
        const wallLength = Math.sqrt(dx * dx + dy * dy);

        // Sample along wall
        const samples = Math.ceil(wallLength / this.doorSampleDistance);

        let gapStart = null;
        let gapLength = 0;

        for (let i = 0; i <= samples; i++) {
            const t = i / samples;
            const samplePoint = {
                x: wall.start.x + dx * t,
                y: wall.start.y + dy * t
            };

            // Check if there are points near this location
            const hasPoints = this.hasPointsNear(samplePoint, points, this.doorSampleDistance);

            if (!hasPoints) {
                // Start or continue gap
                if (gapStart === null) {
                    gapStart = t;
                }
                gapLength = t - gapStart;
            } else {
                // End gap if exists
                if (gapStart !== null && gapLength > 0) {
                    const gapLengthMeters = gapLength * wallLength;

                    if (gapLengthMeters >= this.doorWidthRange.min &&
                        gapLengthMeters <= this.doorWidthRange.max) {
                        openings.push({
                            start: {
                                x: wall.start.x + dx * gapStart,
                                y: wall.start.y + dy * gapStart
                            },
                            end: {
                                x: wall.start.x + dx * t,
                                y: wall.start.y + dy * t
                            },
                            width: gapLengthMeters,
                            type: 'door'
                        });
                    }
                }

                gapStart = null;
                gapLength = 0;
            }
        }

        return openings;
    }

    /**
     * Check if there are points near a location
     */
    hasPointsNear(location, points, threshold) {
        for (const point of points) {
            const dist = Math.sqrt(
                (point.x - location.x) ** 2 +
                (point.z - location.y) ** 2
            );
            if (dist < threshold) {
                return true;
            }
        }
        return false;
    }
}

export default WallDetector;
