/**
 * Storage Manager
 * Handles data persistence using localStorage and IndexedDB
 */

import { FileUtils } from './utils.js';

const DB_NAME = 'FloorPlanScannerDB';
const DB_VERSION = 1;
const STORE_NAME = 'scans';
const SETTINGS_KEY = 'floorplan_settings';

export class StorageManager {
    constructor() {
        this.db = null;
        this.settings = this.loadSettings();
    }

    /**
     * Initialize IndexedDB
     */
    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onerror = () => {
                console.error('IndexedDB error:', request.error);
                reject(request.error);
            };

            request.onsuccess = () => {
                this.db = request.result;
                resolve();
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                // Create object store for scans
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    const objectStore = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
                    objectStore.createIndex('timestamp', 'timestamp', { unique: false });
                    objectStore.createIndex('name', 'name', { unique: false });
                }
            };
        });
    }

    /**
     * Save a scan
     */
    async saveScan(scanData) {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);

            // Add metadata
            const scan = {
                id: scanData.id || FileUtils.generateId(),
                name: scanData.name || `Scan ${new Date().toLocaleDateString()}`,
                timestamp: scanData.timestamp || Date.now(),
                pointCloud: scanData.pointCloud || [],
                walls: scanData.walls || [],
                doors: scanData.doors || [],
                rooms: scanData.rooms || [],
                floorPlan: scanData.floorPlan || null,
                dimensions: scanData.dimensions || {},
                area: scanData.area || 0
            };

            const request = store.put(scan);

            request.onsuccess = () => {
                resolve(scan.id);
            };

            request.onerror = () => {
                reject(request.error);
            };
        });
    }

    /**
     * Get a scan by ID
     */
    async getScan(id) {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.get(id);

            request.onsuccess = () => {
                resolve(request.result);
            };

            request.onerror = () => {
                reject(request.error);
            };
        });
    }

    /**
     * Get all scans
     */
    async getAllScans() {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const index = store.index('timestamp');
            const request = index.openCursor(null, 'prev'); // Sort by newest first

            const scans = [];

            request.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor) {
                    scans.push(cursor.value);
                    cursor.continue();
                } else {
                    resolve(scans);
                }
            };

            request.onerror = () => {
                reject(request.error);
            };
        });
    }

    /**
     * Delete a scan
     */
    async deleteScan(id) {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.delete(id);

            request.onsuccess = () => {
                resolve();
            };

            request.onerror = () => {
                reject(request.error);
            };
        });
    }

    /**
     * Delete all scans
     */
    async deleteAllScans() {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.clear();

            request.onsuccess = () => {
                resolve();
            };

            request.onerror = () => {
                reject(request.error);
            };
        });
    }

    /**
     * Get storage usage
     */
    async getStorageUsage() {
        if ('storage' in navigator && 'estimate' in navigator.storage) {
            const estimate = await navigator.storage.estimate();
            return {
                usage: estimate.usage,
                quota: estimate.quota,
                percentage: (estimate.usage / estimate.quota) * 100
            };
        }
        return null;
    }

    /**
     * Update scan name
     */
    async updateScanName(id, newName) {
        const scan = await this.getScan(id);
        if (scan) {
            scan.name = newName;
            await this.saveScan(scan);
        }
    }

    /**
     * Load settings from localStorage
     */
    loadSettings() {
        try {
            const saved = localStorage.getItem(SETTINGS_KEY);
            if (saved) {
                return JSON.parse(saved);
            }
        } catch (error) {
            console.error('Error loading settings:', error);
        }

        // Default settings
        return {
            units: 'metric',
            quality: 'medium',
            showGuidance: true,
            lastVersion: '1.0.0'
        };
    }

    /**
     * Save settings to localStorage
     */
    saveSettings(settings) {
        try {
            this.settings = { ...this.settings, ...settings };
            localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.settings));
            return true;
        } catch (error) {
            console.error('Error saving settings:', error);
            return false;
        }
    }

    /**
     * Get a specific setting
     */
    getSetting(key, defaultValue = null) {
        return this.settings[key] !== undefined ? this.settings[key] : defaultValue;
    }

    /**
     * Set a specific setting
     */
    setSetting(key, value) {
        this.settings[key] = value;
        this.saveSettings(this.settings);
    }

    /**
     * Export scan as JSON
     */
    exportScanJSON(scan) {
        const jsonData = JSON.stringify(scan, null, 2);
        const blob = new Blob([jsonData], { type: 'application/json' });
        const filename = `${scan.name.replace(/[^a-z0-9]/gi, '_')}.json`;
        FileUtils.downloadFile(blob, filename);
    }

    /**
     * Import scan from JSON
     */
    async importScanJSON(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = async (event) => {
                try {
                    const scanData = JSON.parse(event.target.result);
                    // Generate new ID to avoid conflicts
                    scanData.id = FileUtils.generateId();
                    scanData.timestamp = Date.now();
                    const id = await this.saveScan(scanData);
                    resolve(id);
                } catch (error) {
                    reject(error);
                }
            };

            reader.onerror = () => {
                reject(reader.error);
            };

            reader.readAsText(file);
        });
    }

    /**
     * Get scan summary statistics
     */
    async getScanStats() {
        const scans = await this.getAllScans();

        return {
            totalScans: scans.length,
            totalArea: scans.reduce((sum, scan) => sum + (scan.area || 0), 0),
            totalPoints: scans.reduce((sum, scan) => sum + (scan.pointCloud?.length || 0), 0),
            lastScan: scans.length > 0 ? scans[0].timestamp : null
        };
    }

    /**
     * Create thumbnail from floor plan
     */
    createThumbnail(canvas, maxWidth = 300, maxHeight = 200) {
        const thumbnailCanvas = document.createElement('canvas');
        const ctx = thumbnailCanvas.getContext('2d');

        const scale = Math.min(
            maxWidth / canvas.width,
            maxHeight / canvas.height
        );

        thumbnailCanvas.width = canvas.width * scale;
        thumbnailCanvas.height = canvas.height * scale;

        ctx.drawImage(
            canvas,
            0, 0,
            canvas.width, canvas.height,
            0, 0,
            thumbnailCanvas.width, thumbnailCanvas.height
        );

        return thumbnailCanvas.toDataURL('image/png');
    }

    /**
     * Save thumbnail with scan
     */
    async saveThumbnail(scanId, canvas) {
        const scan = await this.getScan(scanId);
        if (scan) {
            scan.thumbnail = this.createThumbnail(canvas);
            await this.saveScan(scan);
        }
    }
}

// Create singleton instance
const storageManager = new StorageManager();

export default storageManager;
