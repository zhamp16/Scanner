/**
 * Point Cloud Builder
 * Constructs 3D point cloud from WebXR depth data
 */

import { MathUtils, DataUtils } from './utils.js';

export class PointCloudBuilder {
    constructor(quality = 'medium') {
        this.points = [];
        this.normals = [];
        this.colors = [];
        this.quality = quality;

        // Quality settings determine sampling rate
        this.qualitySettings = {
            low: { samplingStep: 8, maxPoints: 50000 },
            medium: { samplingStep: 4, maxPoints: 100000 },
            high: { samplingStep: 2, maxPoints: 200000 }
        };

        this.settings = this.qualitySettings[quality];

        // Filtering parameters
        this.minDepth = 0.1; // 10cm minimum
        this.maxDepth = 10.0; // 10m maximum
        this.outlierThreshold = 0.5; // meters
    }

    /**
     * Process depth data and add points to cloud
     */
    processDepthData(depthData, cameraTransform) {
        const { width, height, data, rawValueToMeters } = depthData;
        const step = this.settings.samplingStep;

        const newPoints = [];
        const newNormals = [];

        // Sample depth buffer
        for (let y = 0; y < height; y += step) {
            for (let x = 0; x < width; x += step) {
                const index = y * width + x;

                // Get depth value
                let depth;
                if (data instanceof Uint16Array) {
                    depth = data[index] * rawValueToMeters;
                } else if (data instanceof Float32Array) {
                    depth = data[index];
                } else {
                    // Luminance-alpha format
                    const idx = index * 2;
                    depth = (data[idx] + data[idx + 1] * 256) * rawValueToMeters;
                }

                // Filter invalid depths
                if (depth < this.minDepth || depth > this.maxDepth || isNaN(depth)) {
                    continue;
                }

                // Convert to normalized device coordinates
                const normX = x / width;
                const normY = y / height;

                // Convert to 3D point in camera space
                const point = this.unprojectPoint(normX, normY, depth, width, height);

                // Transform to world space
                const worldPoint = this.transformPoint(point, cameraTransform);

                // Calculate normal (using neighboring points)
                const normal = this.estimateNormal(x, y, depth, width, height, data, rawValueToMeters);
                const worldNormal = this.transformNormal(normal, cameraTransform);

                newPoints.push(worldPoint);
                newNormals.push(worldNormal);
            }
        }

        // Filter outliers
        const filtered = this.filterOutliers(newPoints, newNormals);

        // Add to point cloud
        this.points.push(...filtered.points);
        this.normals.push(...filtered.normals);

        // Downsample if exceeding max points
        if (this.points.length > this.settings.maxPoints) {
            this.downsample();
        }

        return {
            pointsAdded: filtered.points.length,
            totalPoints: this.points.length
        };
    }

    /**
     * Unproject 2D pixel + depth to 3D point in camera space
     */
    unprojectPoint(normX, normY, depth, width, height) {
        // Assume symmetric FOV and centered principal point
        // For accurate results, use actual camera intrinsics from XRView
        const fovY = 60 * (Math.PI / 180); // Approximate vertical FOV
        const aspect = width / height;

        // Convert to NDC (-1 to 1)
        const ndcX = (normX * 2) - 1;
        const ndcY = 1 - (normY * 2); // Flip Y

        // Calculate ray direction
        const tanFovY = Math.tan(fovY / 2);
        const tanFovX = tanFovY * aspect;

        // Point in camera space
        return {
            x: ndcX * tanFovX * depth,
            y: ndcY * tanFovY * depth,
            z: -depth // Negative Z is forward in camera space
        };
    }

    /**
     * Transform point from camera space to world space
     */
    transformPoint(point, cameraTransform) {
        // Apply camera transform matrix
        const matrix = cameraTransform.matrix;

        const x = point.x * matrix[0] + point.y * matrix[4] + point.z * matrix[8] + matrix[12];
        const y = point.x * matrix[1] + point.y * matrix[5] + point.z * matrix[9] + matrix[13];
        const z = point.x * matrix[2] + point.y * matrix[6] + point.z * matrix[10] + matrix[14];

        return { x, y, z };
    }

    /**
     * Transform normal from camera space to world space
     */
    transformNormal(normal, cameraTransform) {
        const matrix = cameraTransform.matrix;

        const x = normal.x * matrix[0] + normal.y * matrix[4] + normal.z * matrix[8];
        const y = normal.x * matrix[1] + normal.y * matrix[5] + normal.z * matrix[9];
        const z = normal.x * matrix[2] + normal.y * matrix[6] + normal.z * matrix[10];

        return MathUtils.normalize({ x, y, z });
    }

    /**
     * Estimate surface normal from neighboring depth values
     */
    estimateNormal(x, y, depth, width, height, depthData, rawValueToMeters) {
        // Sample neighbors
        const neighbors = [
            { dx: 1, dy: 0 },
            { dx: -1, dy: 0 },
            { dx: 0, dy: 1 },
            { dx: 0, dy: -1 }
        ];

        const validNeighbors = [];

        for (const { dx, dy } of neighbors) {
            const nx = x + dx;
            const ny = y + dy;

            if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                const index = ny * width + nx;
                let nDepth;

                if (depthData instanceof Uint16Array) {
                    nDepth = depthData[index] * rawValueToMeters;
                } else if (depthData instanceof Float32Array) {
                    nDepth = depthData[index];
                } else {
                    const idx = index * 2;
                    nDepth = (depthData[idx] + depthData[idx + 1] * 256) * rawValueToMeters;
                }

                if (nDepth > this.minDepth && nDepth < this.maxDepth) {
                    validNeighbors.push({
                        point: this.unprojectPoint(nx / width, ny / height, nDepth, width, height),
                        depth: nDepth
                    });
                }
            }
        }

        // Compute normal from cross product of edge vectors
        if (validNeighbors.length >= 2) {
            const center = this.unprojectPoint(x / width, y / height, depth, width, height);

            const v1 = {
                x: validNeighbors[0].point.x - center.x,
                y: validNeighbors[0].point.y - center.y,
                z: validNeighbors[0].point.z - center.z
            };

            const v2 = {
                x: validNeighbors[1].point.x - center.x,
                y: validNeighbors[1].point.y - center.y,
                z: validNeighbors[1].point.z - center.z
            };

            const normal = MathUtils.cross(v1, v2);
            return MathUtils.normalize(normal);
        }

        // Default normal (pointing toward camera)
        return { x: 0, y: 0, z: 1 };
    }

    /**
     * Filter outlier points
     */
    filterOutliers(points, normals) {
        if (points.length < 10) {
            return { points, normals };
        }

        const filtered = { points: [], normals: [] };

        // Simple statistical outlier removal
        // Calculate mean position
        const mean = { x: 0, y: 0, z: 0 };
        for (const point of points) {
            mean.x += point.x;
            mean.y += point.y;
            mean.z += point.z;
        }
        mean.x /= points.length;
        mean.y /= points.length;
        mean.z /= points.length;

        // Calculate standard deviation
        let variance = 0;
        for (const point of points) {
            const dist = MathUtils.distance3D(point, mean);
            variance += dist * dist;
        }
        const stdDev = Math.sqrt(variance / points.length);

        // Filter points beyond threshold
        const threshold = stdDev * 2.5;

        for (let i = 0; i < points.length; i++) {
            const dist = MathUtils.distance3D(points[i], mean);
            if (dist < threshold) {
                filtered.points.push(points[i]);
                filtered.normals.push(normals[i]);
            }
        }

        return filtered;
    }

    /**
     * Downsample point cloud to meet max points constraint
     */
    downsample() {
        const targetCount = Math.floor(this.settings.maxPoints * 0.9);

        if (this.points.length <= targetCount) return;

        const downsampled = DataUtils.downsamplePoints(this.points, targetCount);
        const step = Math.floor(this.points.length / targetCount);

        const newNormals = [];
        for (let i = 0; i < this.points.length; i += step) {
            if (this.normals[i]) {
                newNormals.push(this.normals[i]);
            }
        }

        this.points = downsampled;
        this.normals = newNormals;
    }

    /**
     * Get all points
     */
    getPoints() {
        return this.points;
    }

    /**
     * Get all normals
     */
    getNormals() {
        return this.normals;
    }

    /**
     * Get point cloud data
     */
    getData() {
        return {
            points: this.points,
            normals: this.normals,
            count: this.points.length
        };
    }

    /**
     * Clear point cloud
     */
    clear() {
        this.points = [];
        this.normals = [];
        this.colors = [];
    }

    /**
     * Get bounding box
     */
    getBounds() {
        return DataUtils.calculateBounds(this.points);
    }

    /**
     * Set quality level
     */
    setQuality(quality) {
        this.quality = quality;
        this.settings = this.qualitySettings[quality];
    }

    /**
     * Export point cloud to OBJ format
     */
    exportOBJ() {
        let obj = '# Point Cloud Export\n';
        obj += `# Total Points: ${this.points.length}\n\n`;

        // Write vertices
        for (const point of this.points) {
            obj += `v ${point.x.toFixed(6)} ${point.y.toFixed(6)} ${point.z.toFixed(6)}\n`;
        }

        // Write normals
        obj += '\n';
        for (const normal of this.normals) {
            obj += `vn ${normal.x.toFixed(6)} ${normal.y.toFixed(6)} ${normal.z.toFixed(6)}\n`;
        }

        return obj;
    }

    /**
     * Create Three.js geometry from point cloud
     */
    createThreeGeometry() {
        if (typeof THREE === 'undefined') {
            console.warn('Three.js not loaded');
            return null;
        }

        const geometry = new THREE.BufferGeometry();

        // Convert points to Float32Array
        const positions = new Float32Array(this.points.length * 3);
        for (let i = 0; i < this.points.length; i++) {
            positions[i * 3] = this.points[i].x;
            positions[i * 3 + 1] = this.points[i].y;
            positions[i * 3 + 2] = this.points[i].z;
        }

        // Convert normals to Float32Array
        const normals = new Float32Array(this.normals.length * 3);
        for (let i = 0; i < this.normals.length; i++) {
            normals[i * 3] = this.normals[i].x;
            normals[i * 3 + 1] = this.normals[i].y;
            normals[i * 3 + 2] = this.normals[i].z;
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));

        return geometry;
    }
}

export default PointCloudBuilder;
