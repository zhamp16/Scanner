/**
 * Utility Functions
 * Helper functions used throughout the application
 */

// Vector and Math Utilities
export const MathUtils = {
    /**
     * Calculate distance between two 3D points
     */
    distance3D(p1, p2) {
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const dz = p2.z - p1.z;
        return Math.sqrt(dx * dx + dy * dy + dz * dz);
    },

    /**
     * Calculate distance between two 2D points
     */
    distance2D(p1, p2) {
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        return Math.sqrt(dx * dx + dy * dy);
    },

    /**
     * Normalize a vector
     */
    normalize(v) {
        const length = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
        if (length === 0) return { x: 0, y: 0, z: 0 };
        return {
            x: v.x / length,
            y: v.y / length,
            z: v.z / length
        };
    },

    /**
     * Dot product of two vectors
     */
    dot(v1, v2) {
        return v1.x * v2.x + v1.y * v2.y + v1.z * v2.z;
    },

    /**
     * Cross product of two vectors
     */
    cross(v1, v2) {
        return {
            x: v1.y * v2.z - v1.z * v2.y,
            y: v1.z * v2.x - v1.x * v2.z,
            z: v1.x * v2.y - v1.y * v2.x
        };
    },

    /**
     * Calculate angle between two vectors in degrees
     */
    angleBetween(v1, v2) {
        const dot = this.dot(v1, v2);
        const mag1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y + v1.z * v1.z);
        const mag2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y + v2.z * v2.z);
        return Math.acos(dot / (mag1 * mag2)) * (180 / Math.PI);
    },

    /**
     * Snap angle to nearest cardinal direction
     */
    snapToCardinal(angle, threshold = 15) {
        const cardinals = [0, 90, 180, 270, 360];
        for (const cardinal of cardinals) {
            if (Math.abs(angle - cardinal) < threshold) {
                return cardinal % 360;
            }
        }
        return angle;
    },

    /**
     * Linear interpolation
     */
    lerp(a, b, t) {
        return a + (b - a) * t;
    },

    /**
     * Clamp value between min and max
     */
    clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    },

    /**
     * Calculate polygon area (2D points)
     */
    polygonArea(points) {
        let area = 0;
        for (let i = 0; i < points.length; i++) {
            const j = (i + 1) % points.length;
            area += points[i].x * points[j].y;
            area -= points[j].x * points[i].y;
        }
        return Math.abs(area / 2);
    },

    /**
     * Calculate centroid of polygon
     */
    polygonCentroid(points) {
        let cx = 0, cy = 0;
        for (const point of points) {
            cx += point.x;
            cy += point.y;
        }
        return {
            x: cx / points.length,
            y: cy / points.length
        };
    }
};

// Unit Conversion Utilities
export const UnitConverter = {
    /**
     * Convert meters to feet
     */
    metersToFeet(meters) {
        return meters * 3.28084;
    },

    /**
     * Convert square meters to square feet
     */
    sqMetersToSqFeet(sqMeters) {
        return sqMeters * 10.7639;
    },

    /**
     * Format distance based on units preference
     */
    formatDistance(meters, units = 'metric', decimals = 2) {
        if (units === 'imperial') {
            return `${this.metersToFeet(meters).toFixed(decimals)} ft`;
        }
        return `${meters.toFixed(decimals)} m`;
    },

    /**
     * Format area based on units preference
     */
    formatArea(sqMeters, units = 'metric', decimals = 1) {
        if (units === 'imperial') {
            return `${this.sqMetersToSqFeet(sqMeters).toFixed(decimals)} ft²`;
        }
        return `${sqMeters.toFixed(decimals)} m²`;
    }
};

// UI Utilities
export const UIUtils = {
    /**
     * Show toast notification
     */
    showToast(message, type = 'info', duration = 3000) {
        const toast = document.getElementById('toast');
        if (!toast) return;

        toast.textContent = message;
        toast.className = `toast ${type}`;
        toast.classList.add('show');

        setTimeout(() => {
            toast.classList.remove('show');
        }, duration);
    },

    /**
     * Show screen by ID
     */
    showScreen(screenId) {
        const screens = document.querySelectorAll('.screen');
        screens.forEach(screen => screen.classList.remove('active'));

        const targetScreen = document.getElementById(screenId);
        if (targetScreen) {
            targetScreen.classList.add('active');
        }
    },

    /**
     * Show modal by ID
     */
    showModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('active');
        }
    },

    /**
     * Hide modal by ID
     */
    hideModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('active');
        }
    },

    /**
     * Update progress bar
     */
    updateProgress(percentage) {
        const progressFill = document.getElementById('progress-fill');
        if (progressFill) {
            progressFill.style.width = `${percentage}%`;
        }
    },

    /**
     * Set processing step status
     */
    setProcessingStep(stepName, status = 'active') {
        const step = document.querySelector(`[data-step="${stepName}"]`);
        if (step) {
            step.className = `step ${status}`;
        }
    },

    /**
     * Format timestamp
     */
    formatTimestamp(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
        if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
        if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;

        return date.toLocaleDateString();
    }
};

// Browser Feature Detection
export const FeatureDetection = {
    /**
     * Check if WebXR is supported
     */
    async checkWebXRSupport() {
        if (!('xr' in navigator)) {
            return {
                supported: false,
                reason: 'WebXR not available in this browser'
            };
        }

        try {
            const supported = await navigator.xr.isSessionSupported('immersive-ar');
            if (!supported) {
                return {
                    supported: false,
                    reason: 'Immersive AR not supported'
                };
            }

            return { supported: true };
        } catch (error) {
            return {
                supported: false,
                reason: error.message
            };
        }
    },

    /**
     * Check if depth sensing is supported
     */
    async checkDepthSensingSupport(session) {
        try {
            // This check happens during session creation
            return session.enabledFeatures && session.enabledFeatures.includes('depth-sensing');
        } catch (error) {
            return false;
        }
    },

    /**
     * Get browser information
     */
    getBrowserInfo() {
        const ua = navigator.userAgent;
        let browserName = 'Unknown';
        let version = 'Unknown';

        if (ua.indexOf('Safari') > -1 && ua.indexOf('Chrome') === -1) {
            browserName = 'Safari';
            const match = ua.match(/Version\/([\d.]+)/);
            if (match) version = match[1];
        } else if (ua.indexOf('Chrome') > -1) {
            browserName = 'Chrome';
            const match = ua.match(/Chrome\/([\d.]+)/);
            if (match) version = match[1];
        } else if (ua.indexOf('Firefox') > -1) {
            browserName = 'Firefox';
            const match = ua.match(/Firefox\/([\d.]+)/);
            if (match) version = match[1];
        }

        return `${browserName} ${version}`;
    },

    /**
     * Check if device has LiDAR
     */
    hasLiDAR() {
        // This is a heuristic check based on device model
        const ua = navigator.userAgent;

        // iPhone 12 Pro and later
        if (ua.includes('iPhone')) {
            // Check for iOS 14+ which is required for WebXR
            const match = ua.match(/OS (\d+)_/);
            if (match && parseInt(match[1]) >= 14) {
                return true;
            }
        }

        // iPad Pro 2020 and later
        if (ua.includes('iPad')) {
            const match = ua.match(/OS (\d+)_/);
            if (match && parseInt(match[1]) >= 14) {
                return true;
            }
        }

        return false;
    }
};

// Data Processing Utilities
export const DataUtils = {
    /**
     * Downsample point cloud
     */
    downsamplePoints(points, targetCount) {
        if (points.length <= targetCount) return points;

        const step = Math.floor(points.length / targetCount);
        const downsampled = [];

        for (let i = 0; i < points.length; i += step) {
            downsampled.push(points[i]);
        }

        return downsampled;
    },

    /**
     * Filter points by height range
     */
    filterByHeight(points, minY, maxY) {
        return points.filter(p => p.y >= minY && p.y <= maxY);
    },

    /**
     * Create histogram of values
     */
    createHistogram(values, binSize) {
        const histogram = new Map();

        for (const value of values) {
            const bin = Math.floor(value / binSize) * binSize;
            histogram.set(bin, (histogram.get(bin) || 0) + 1);
        }

        return histogram;
    },

    /**
     * Find most common value in histogram
     */
    findMostCommon(histogram) {
        let maxCount = 0;
        let mostCommon = null;

        for (const [value, count] of histogram) {
            if (count > maxCount) {
                maxCount = count;
                mostCommon = value;
            }
        }

        return mostCommon;
    },

    /**
     * Group points by grid cells
     */
    gridCluster(points, cellSize) {
        const grid = new Map();

        for (const point of points) {
            const cellX = Math.floor(point.x / cellSize);
            const cellZ = Math.floor(point.z / cellSize);
            const key = `${cellX},${cellZ}`;

            if (!grid.has(key)) {
                grid.set(key, []);
            }
            grid.get(key).push(point);
        }

        return grid;
    },

    /**
     * Calculate bounding box of points
     */
    calculateBounds(points) {
        if (points.length === 0) {
            return { min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 } };
        }

        const bounds = {
            min: { x: Infinity, y: Infinity, z: Infinity },
            max: { x: -Infinity, y: -Infinity, z: -Infinity }
        };

        for (const point of points) {
            bounds.min.x = Math.min(bounds.min.x, point.x);
            bounds.min.y = Math.min(bounds.min.y, point.y);
            bounds.min.z = Math.min(bounds.min.z, point.z);
            bounds.max.x = Math.max(bounds.max.x, point.x);
            bounds.max.y = Math.max(bounds.max.y, point.y);
            bounds.max.z = Math.max(bounds.max.z, point.z);
        }

        return bounds;
    }
};

// File Utilities
export const FileUtils = {
    /**
     * Download file
     */
    downloadFile(blob, filename) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    },

    /**
     * Convert canvas to blob
     */
    async canvasToBlob(canvas, type = 'image/png') {
        return new Promise((resolve) => {
            canvas.toBlob(resolve, type);
        });
    },

    /**
     * Generate unique ID
     */
    generateId() {
        return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    },

    /**
     * Format file size
     */
    formatFileSize(bytes) {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }
};

// Performance Utilities
export const PerformanceUtils = {
    /**
     * Debounce function
     */
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },

    /**
     * Throttle function
     */
    throttle(func, limit) {
        let inThrottle;
        return function executedFunction(...args) {
            if (!inThrottle) {
                func(...args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    },

    /**
     * Run task with progress updates
     */
    async runWithProgress(task, onProgress) {
        const startTime = Date.now();
        let progress = 0;

        const progressInterval = setInterval(() => {
            progress = Math.min(progress + 10, 90);
            onProgress(progress);
        }, 100);

        try {
            const result = await task();
            clearInterval(progressInterval);
            onProgress(100);
            return result;
        } catch (error) {
            clearInterval(progressInterval);
            throw error;
        }
    }
};

export default {
    MathUtils,
    UnitConverter,
    UIUtils,
    FeatureDetection,
    DataUtils,
    FileUtils,
    PerformanceUtils
};
