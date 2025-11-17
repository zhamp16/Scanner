/**
 * Main Application Controller
 * Orchestrates the LiDAR Floor Plan Scanner application
 */

import { UIUtils, FeatureDetection } from './utils.js';
import storageManager from './storage-manager.js';
import WebXRManager from './webxr-manager.js';
import PointCloudBuilder from './point-cloud-builder.js';
import WallDetector from './wall-detector.js';
import FloorPlanGenerator from './floor-plan-generator.js';
import FloorPlanRenderer from './floor-plan-renderer.js';
import ExportManager from './export-manager.js';

class FloorPlanScannerApp {
    constructor() {
        // Core components
        this.webxrManager = null;
        this.pointCloudBuilder = null;
        this.wallDetector = new WallDetector();
        this.floorPlanGenerator = new FloorPlanGenerator();
        this.floorPlanRenderer = null;
        this.exportManager = new ExportManager();

        // State
        this.currentScreen = 'onboarding';
        this.currentScan = null;
        this.isScanning = false;
        this.scanStartTime = 0;

        // Settings
        this.settings = storageManager.loadSettings();

        // Initialize
        this.init();
    }

    /**
     * Initialize application
     */
    async init() {
        console.log('Initializing Floor Plan Scanner...');

        // Setup event listeners
        this.setupEventListeners();

        // Initialize storage
        await storageManager.init();

        // Check WebXR support
        await this.checkWebXRSupport();

        // Load settings
        this.loadSettings();

        // Show onboarding or scan list based on first use
        const scans = await storageManager.getAllScans();
        if (scans.length > 0) {
            this.showScanList();
        } else {
            this.showOnboarding();
        }
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Onboarding
        document.getElementById('start-btn')?.addEventListener('click', () => {
            this.showScanList();
        });

        // Scan list
        document.getElementById('new-scan-btn')?.addEventListener('click', () => {
            this.startNewScan();
        });

        // Scanner controls
        document.getElementById('scan-action-btn')?.addEventListener('click', () => {
            this.toggleScanning();
        });

        document.getElementById('finish-scan-btn')?.addEventListener('click', () => {
            this.finishScan();
        });

        document.getElementById('cancel-scan-btn')?.addEventListener('click', () => {
            this.cancelScan();
        });

        // Floor plan viewer
        document.getElementById('back-to-list-btn')?.addEventListener('click', () => {
            this.showScanList();
        });

        document.getElementById('export-btn')?.addEventListener('click', () => {
            this.showExportModal();
        });

        document.getElementById('zoom-in-btn')?.addEventListener('click', () => {
            this.floorPlanRenderer?.zoomIn();
        });

        document.getElementById('zoom-out-btn')?.addEventListener('click', () => {
            this.floorPlanRenderer?.zoomOut();
        });

        document.getElementById('reset-view-btn')?.addEventListener('click', () => {
            this.floorPlanRenderer?.resetView();
        });

        // Settings
        document.getElementById('settings-btn')?.addEventListener('click', () => {
            this.showSettings();
        });

        document.getElementById('close-settings-btn')?.addEventListener('click', () => {
            this.closeSettings();
        });

        document.getElementById('units-select')?.addEventListener('change', (e) => {
            this.changeUnits(e.target.value);
        });

        document.getElementById('quality-select')?.addEventListener('change', (e) => {
            this.changeQuality(e.target.value);
        });

        document.getElementById('clear-data-btn')?.addEventListener('click', () => {
            this.clearAllData();
        });

        // Export modal
        const exportModal = document.getElementById('export-modal');
        exportModal?.querySelectorAll('.close-modal').forEach(btn => {
            btn.addEventListener('click', () => {
                UIUtils.hideModal('export-modal');
            });
        });

        exportModal?.querySelectorAll('.export-option').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const format = e.currentTarget.dataset.format;
                this.exportFloorPlan(format);
            });
        });
    }

    /**
     * Check WebXR support
     */
    async checkWebXRSupport() {
        const support = await FeatureDetection.checkWebXRSupport();

        const webxrSupportEl = document.getElementById('webxr-support');
        const depthSupportEl = document.getElementById('depth-support');

        if (webxrSupportEl) {
            webxrSupportEl.textContent = support.supported ? 'Yes' : 'No';
            webxrSupportEl.style.color = support.supported ? 'green' : 'red';
        }

        if (depthSupportEl) {
            depthSupportEl.textContent = support.depthSensing ? 'Yes' : 'Unknown';
            depthSupportEl.style.color = support.depthSensing ? 'green' : 'orange';
        }

        if (!support.supported) {
            this.showUnsupportedMessage(support.reason);
        }

        return support;
    }

    /**
     * Show unsupported message
     */
    showUnsupportedMessage(reason) {
        const messageEl = document.getElementById('unsupported-message');
        if (messageEl) {
            messageEl.style.display = 'flex';
            console.error('WebXR not supported:', reason);
        }
    }

    /**
     * Load settings
     */
    loadSettings() {
        // Browser info
        const browserInfo = document.getElementById('browser-info');
        if (browserInfo) {
            browserInfo.textContent = FeatureDetection.getBrowserInfo();
        }

        // Units
        const unitsSelect = document.getElementById('units-select');
        if (unitsSelect) {
            unitsSelect.value = this.settings.units || 'metric';
        }

        // Quality
        const qualitySelect = document.getElementById('quality-select');
        if (qualitySelect) {
            qualitySelect.value = this.settings.quality || 'medium';
        }

        // Guidance
        const guidanceToggle = document.getElementById('guidance-toggle');
        if (guidanceToggle) {
            guidanceToggle.checked = this.settings.showGuidance !== false;
        }
    }

    /**
     * Show onboarding screen
     */
    showOnboarding() {
        this.currentScreen = 'onboarding';
        UIUtils.showScreen('onboarding-screen');
    }

    /**
     * Show scan list screen
     */
    async showScanList() {
        this.currentScreen = 'scan-list';
        UIUtils.showScreen('scan-list-screen');

        // Load scans
        await this.loadScanList();
    }

    /**
     * Load and display scan list
     */
    async loadScanList() {
        const scans = await storageManager.getAllScans();
        const scanList = document.getElementById('scan-list');
        const emptyState = document.getElementById('empty-state');

        if (scans.length === 0) {
            if (scanList) scanList.style.display = 'none';
            if (emptyState) emptyState.style.display = 'flex';
            return;
        }

        if (scanList) scanList.style.display = 'block';
        if (emptyState) emptyState.style.display = 'none';

        // Clear existing
        if (scanList) {
            scanList.innerHTML = '';

            // Create scan cards
            for (const scan of scans) {
                const card = this.createScanCard(scan);
                scanList.appendChild(card);
            }
        }
    }

    /**
     * Create scan card element
     */
    createScanCard(scan) {
        const card = document.createElement('div');
        card.className = 'scan-card';

        card.innerHTML = `
            <div class="scan-card-header">
                <h3>${scan.name}</h3>
            </div>
            <div class="scan-card-meta">
                ${UIUtils.formatTimestamp(scan.timestamp)}
            </div>
            <div class="scan-card-stats">
                <span>${scan.area?.toFixed(1) || '0'} m²</span>
                <span>•</span>
                <span>${scan.walls?.length || 0} walls</span>
                <span>•</span>
                <span>${scan.pointCloud?.length || 0} points</span>
            </div>
            ${scan.thumbnail ? `<div class="scan-thumbnail"><img src="${scan.thumbnail}" alt="${scan.name}"></div>` : ''}
        `;

        card.addEventListener('click', () => {
            this.viewScan(scan.id);
        });

        return card;
    }

    /**
     * Start new scan
     */
    async startNewScan() {
        try {
            // Check support first
            const support = await this.checkWebXRSupport();
            if (!support.supported) {
                UIUtils.showToast('WebXR not supported on this device', 'error');
                return;
            }

            // Show scanner screen
            UIUtils.showScreen('scanner-screen');

            // Initialize WebXR
            const canvas = document.getElementById('ar-canvas');
            this.webxrManager = new WebXRManager(canvas);

            // Setup callbacks
            this.webxrManager.onDepthData((depthData, cameraTransform) => {
                this.processDepthData(depthData, cameraTransform);
            });

            this.webxrManager.onError((error) => {
                console.error('WebXR error:', error);
                UIUtils.showToast('AR session error: ' + error.message, 'error');
                this.cancelScan();
            });

            // Start session
            await this.webxrManager.startSession();

            // Initialize point cloud builder
            const quality = this.settings.quality || 'medium';
            this.pointCloudBuilder = new PointCloudBuilder(quality);

            // Update UI
            document.getElementById('status-text').textContent = 'Ready to scan';
            document.getElementById('scan-action-btn').textContent = 'Start Scanning';
            document.getElementById('scan-action-btn').disabled = false;

            UIUtils.showToast('AR session started', 'success');

        } catch (error) {
            console.error('Failed to start scan:', error);
            UIUtils.showToast('Failed to start AR session', 'error');
            this.showScanList();
        }
    }

    /**
     * Toggle scanning on/off
     */
    toggleScanning() {
        if (!this.isScanning) {
            this.startScanning();
        } else {
            this.pauseScanning();
        }
    }

    /**
     * Start scanning
     */
    startScanning() {
        this.isScanning = true;
        this.scanStartTime = Date.now();

        this.webxrManager.startScanning();

        // Update UI
        document.getElementById('scan-action-btn').textContent = 'Pause';
        document.getElementById('finish-scan-btn').disabled = false;
        document.getElementById('status-text').textContent = 'Scanning...';

        UIUtils.showToast('Scanning started', 'success');
    }

    /**
     * Pause scanning
     */
    pauseScanning() {
        this.isScanning = false;
        this.webxrManager.stopScanning();

        // Update UI
        document.getElementById('scan-action-btn').textContent = 'Resume';
        document.getElementById('status-text').textContent = 'Paused';

        UIUtils.showToast('Scanning paused', 'info');
    }

    /**
     * Process depth data
     */
    processDepthData(depthData, cameraTransform) {
        if (!this.isScanning || !this.pointCloudBuilder) return;

        // Add to point cloud
        const result = this.pointCloudBuilder.processDepthData(depthData, cameraTransform);

        // Update UI
        const pointCountEl = document.getElementById('point-count-value');
        if (pointCountEl) {
            pointCountEl.textContent = result.totalPoints.toLocaleString();
        }

        // Update progress (based on point count)
        const targetPoints = this.pointCloudBuilder.settings.maxPoints;
        const progress = Math.min((result.totalPoints / targetPoints) * 100, 100);
        UIUtils.updateProgress(progress);

        // Update guidance
        if (this.settings.showGuidance) {
            this.updateScanGuidance(result.totalPoints);
        }
    }

    /**
     * Update scan guidance text
     */
    updateScanGuidance(pointCount) {
        const guidanceEl = document.getElementById('scan-guidance');
        if (!guidanceEl) return;

        let message = '';

        if (pointCount < 1000) {
            message = 'Point camera at walls and move slowly around the room';
        } else if (pointCount < 5000) {
            message = 'Good! Continue scanning walls and corners';
        } else if (pointCount < 20000) {
            message = 'Great progress! Make sure to cover all walls';
        } else {
            message = 'Excellent! Enough data collected. You can stop scanning.';
        }

        guidanceEl.querySelector('p').textContent = message;
    }

    /**
     * Finish scan and process
     */
    async finishScan() {
        try {
            this.isScanning = false;
            this.webxrManager.stopScanning();

            // Show processing screen
            UIUtils.showScreen('processing-screen');

            // Get point cloud data
            const pointCloudData = this.pointCloudBuilder.getData();

            console.log('Processing', pointCloudData.count, 'points');

            // Step 1: Detect walls
            UIUtils.setProcessingStep('pointcloud', 'completed');
            UIUtils.setProcessingStep('walls', 'active');

            await this.delay(500);

            const wallResult = this.wallDetector.detectWalls(
                pointCloudData.points,
                pointCloudData.normals
            );

            console.log('Detected', wallResult.walls.length, 'walls');

            // Step 2: Detect openings
            UIUtils.setProcessingStep('walls', 'completed');
            UIUtils.setProcessingStep('doors', 'active');

            await this.delay(500);

            const doors = this.wallDetector.detectOpenings(wallResult.walls, pointCloudData.points);

            console.log('Detected', doors.length, 'openings');

            // Step 3: Generate floor plan
            UIUtils.setProcessingStep('doors', 'completed');
            UIUtils.setProcessingStep('floorplan', 'active');

            await this.delay(500);

            const floorPlan = this.floorPlanGenerator.generate(wallResult.walls, doors);

            UIUtils.setProcessingStep('floorplan', 'completed');

            await this.delay(500);

            // Save scan
            const scanData = {
                name: `Scan ${new Date().toLocaleString()}`,
                pointCloud: pointCloudData.points,
                walls: wallResult.walls,
                doors: doors,
                rooms: floorPlan.rooms,
                floorPlan: floorPlan,
                dimensions: floorPlan.dimensions,
                area: floorPlan.totalArea,
                floorLevel: wallResult.floorLevel
            };

            const scanId = await storageManager.saveScan(scanData);
            console.log('Scan saved with ID:', scanId);

            // End WebXR session
            await this.webxrManager.endSession();

            // View the floor plan
            await this.viewScan(scanId);

            UIUtils.showToast('Floor plan generated successfully!', 'success');

        } catch (error) {
            console.error('Error processing scan:', error);
            UIUtils.showToast('Error processing scan: ' + error.message, 'error');
            this.showScanList();
        }
    }

    /**
     * Cancel scan
     */
    async cancelScan() {
        this.isScanning = false;

        if (this.webxrManager) {
            await this.webxrManager.endSession();
        }

        if (this.pointCloudBuilder) {
            this.pointCloudBuilder.clear();
        }

        this.showScanList();
    }

    /**
     * View a saved scan
     */
    async viewScan(scanId) {
        try {
            const scan = await storageManager.getScan(scanId);
            if (!scan) {
                UIUtils.showToast('Scan not found', 'error');
                return;
            }

            this.currentScan = scan;

            // Show floor plan screen
            UIUtils.showScreen('floorplan-screen');

            // Update title
            const titleEl = document.getElementById('floorplan-title');
            if (titleEl) {
                titleEl.textContent = scan.name;
            }

            // Initialize renderer if needed
            const canvas = document.getElementById('floorplan-canvas');
            if (!this.floorPlanRenderer) {
                this.floorPlanRenderer = new FloorPlanRenderer(canvas);
            }

            // Set units from settings
            this.floorPlanRenderer.setUnits(this.settings.units || 'metric');

            // Load floor plan
            this.floorPlanRenderer.setFloorPlan(scan.floorPlan);

            // Update export manager references
            this.exportManager.setFloorPlanGenerator(this.floorPlanGenerator);
            this.exportManager.setRenderer(this.floorPlanRenderer);

            // Update dimensions display
            this.updateDimensionsDisplay(scan);

        } catch (error) {
            console.error('Error viewing scan:', error);
            UIUtils.showToast('Error loading scan', 'error');
        }
    }

    /**
     * Update dimensions display
     */
    updateDimensionsDisplay(scan) {
        const dimensionsEl = document.getElementById('dimensions-list');
        const areaEl = document.getElementById('total-area');

        if (dimensionsEl && scan.dimensions) {
            dimensionsEl.innerHTML = '';

            if (scan.dimensions.rooms && scan.dimensions.rooms.length > 0) {
                for (const room of scan.dimensions.rooms) {
                    const div = document.createElement('div');
                    div.textContent = `${room.name}: ${room.width.toFixed(2)}m × ${room.height.toFixed(2)}m`;
                    dimensionsEl.appendChild(div);
                }
            }
        }

        if (areaEl) {
            const units = this.settings.units || 'metric';
            const areaText = units === 'metric'
                ? `${scan.area.toFixed(1)} m²`
                : `${(scan.area * 10.7639).toFixed(1)} ft²`;
            areaEl.textContent = areaText;
        }
    }

    /**
     * Show export modal
     */
    showExportModal() {
        if (!this.currentScan) return;

        const exportNameInput = document.getElementById('export-name');
        if (exportNameInput) {
            exportNameInput.value = this.currentScan.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        }

        UIUtils.showModal('export-modal');
    }

    /**
     * Export floor plan
     */
    async exportFloorPlan(format) {
        try {
            const filename = document.getElementById('export-name')?.value || 'floor-plan';
            const includeDimensions = document.getElementById('include-dimensions')?.checked !== false;
            const includeLabels = document.getElementById('include-labels')?.checked !== false;

            const options = { includeDimensions, includeLabels };

            UIUtils.hideModal('export-modal');
            UIUtils.showToast('Exporting...', 'info');

            // Load the floor plan into generator for export
            if (this.currentScan && this.currentScan.floorPlan) {
                this.floorPlanGenerator.walls = this.currentScan.floorPlan.walls;
                this.floorPlanGenerator.doors = this.currentScan.floorPlan.doors;
                this.floorPlanGenerator.rooms = this.currentScan.floorPlan.rooms;
                this.floorPlanGenerator.bounds = this.currentScan.floorPlan.bounds;
            }

            switch (format) {
                case 'png':
                    await this.exportManager.exportPNG(filename, options);
                    break;
                case 'svg':
                    await this.exportManager.exportSVG(filename, options);
                    break;
                case 'pdf':
                    await this.exportManager.exportPDF(filename, options);
                    break;
                case 'json':
                    await this.exportManager.exportJSON(filename);
                    break;
                default:
                    throw new Error('Unsupported format');
            }

            UIUtils.showToast(`Exported as ${format.toUpperCase()}`, 'success');

        } catch (error) {
            console.error('Export error:', error);
            UIUtils.showToast('Export failed: ' + error.message, 'error');
        }
    }

    /**
     * Show settings
     */
    showSettings() {
        UIUtils.showScreen('settings-screen');
    }

    /**
     * Close settings
     */
    closeSettings() {
        UIUtils.showScreen(this.currentScreen === 'onboarding' ? 'onboarding-screen' : 'scan-list-screen');
    }

    /**
     * Change units
     */
    changeUnits(units) {
        this.settings.units = units;
        storageManager.saveSettings(this.settings);

        if (this.floorPlanRenderer) {
            this.floorPlanRenderer.setUnits(units);
            this.updateDimensionsDisplay(this.currentScan);
        }

        UIUtils.showToast(`Units changed to ${units}`, 'success');
    }

    /**
     * Change quality
     */
    changeQuality(quality) {
        this.settings.quality = quality;
        storageManager.saveSettings(this.settings);
        UIUtils.showToast(`Quality set to ${quality}`, 'success');
    }

    /**
     * Clear all data
     */
    async clearAllData() {
        if (!confirm('Are you sure you want to delete all scans? This cannot be undone.')) {
            return;
        }

        try {
            await storageManager.deleteAllScans();
            UIUtils.showToast('All scans deleted', 'success');
            this.showScanList();
        } catch (error) {
            console.error('Error clearing data:', error);
            UIUtils.showToast('Error clearing data', 'error');
        }
    }

    /**
     * Delay helper
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// Initialize app when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.app = new FloorPlanScannerApp();
    });
} else {
    window.app = new FloorPlanScannerApp();
}

export default FloorPlanScannerApp;
