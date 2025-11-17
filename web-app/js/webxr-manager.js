/**
 * WebXR Manager
 * Manages WebXR AR session, depth sensing, and camera tracking
 */

import { FeatureDetection, UIUtils } from './utils.js';

export class WebXRManager {
    constructor(canvas) {
        this.canvas = canvas;
        this.gl = null;
        this.session = null;
        this.referenceSpace = null;
        this.viewerSpace = null;
        this.depthInfo = null;
        this.isScanning = false;
        this.frameCallback = null;

        // Callbacks
        this.onDepthDataCallback = null;
        this.onPoseUpdateCallback = null;
        this.onErrorCallback = null;

        // Session state
        this.sessionActive = false;
        this.depthDataAvailable = false;
    }

    /**
     * Check if WebXR with depth sensing is supported
     */
    async checkSupport() {
        const webxrSupport = await FeatureDetection.checkWebXRSupport();
        if (!webxrSupport.supported) {
            return webxrSupport;
        }

        // Check for depth sensing support
        try {
            const session = await navigator.xr.requestSession('immersive-ar', {
                requiredFeatures: ['depth-sensing'],
                depthSensing: {
                    usagePreference: ['cpu-optimized'],
                    dataFormatPreference: ['luminance-alpha', 'float32']
                }
            });

            // Immediately end the test session
            await session.end();

            return {
                supported: true,
                depthSensing: true
            };
        } catch (error) {
            // Check if it's a depth sensing issue
            if (error.message.includes('depth')) {
                return {
                    supported: true,
                    depthSensing: false,
                    reason: 'Depth sensing not supported'
                };
            }
            return {
                supported: false,
                reason: error.message
            };
        }
    }

    /**
     * Initialize WebGL context
     */
    initWebGL() {
        this.gl = this.canvas.getContext('webgl2', {
            xrCompatible: true,
            alpha: true,
            antialias: true
        });

        if (!this.gl) {
            throw new Error('WebGL 2.0 not supported');
        }

        return this.gl;
    }

    /**
     * Start AR session with depth sensing
     */
    async startSession() {
        try {
            // Initialize WebGL if not already done
            if (!this.gl) {
                this.initWebGL();
            }

            // Request AR session with depth sensing
            this.session = await navigator.xr.requestSession('immersive-ar', {
                requiredFeatures: ['local', 'depth-sensing'],
                optionalFeatures: ['dom-overlay'],
                depthSensing: {
                    usagePreference: ['cpu-optimized'],
                    dataFormatPreference: ['luminance-alpha', 'float32']
                },
                domOverlay: { root: document.getElementById('ar-overlay') }
            });

            // Update base layer
            await this.gl.makeXRCompatible();
            this.session.updateRenderState({
                baseLayer: new XRWebGLLayer(this.session, this.gl)
            });

            // Get reference spaces
            this.referenceSpace = await this.session.requestReferenceSpace('local');
            this.viewerSpace = await this.session.requestReferenceSpace('viewer');

            // Handle session end
            this.session.addEventListener('end', () => {
                this.onSessionEnd();
            });

            this.sessionActive = true;

            // Check if depth sensing was enabled
            if (this.session.enabledFeatures) {
                this.depthDataAvailable = this.session.enabledFeatures.includes('depth-sensing');
                console.log('Depth sensing enabled:', this.depthDataAvailable);
            }

            return true;
        } catch (error) {
            console.error('Failed to start XR session:', error);
            if (this.onErrorCallback) {
                this.onErrorCallback(error);
            }
            throw error;
        }
    }

    /**
     * Start scanning (begin collecting depth data)
     */
    startScanning() {
        if (!this.session || !this.sessionActive) {
            throw new Error('Session not active');
        }

        this.isScanning = true;

        // Start the render loop
        this.session.requestAnimationFrame((time, frame) => {
            this.onXRFrame(time, frame);
        });
    }

    /**
     * Stop scanning (stop collecting data but keep session)
     */
    stopScanning() {
        this.isScanning = false;
    }

    /**
     * End AR session
     */
    async endSession() {
        if (this.session) {
            this.isScanning = false;
            await this.session.end();
        }
    }

    /**
     * Handle XR frame updates
     */
    onXRFrame(time, frame) {
        if (!this.session || !this.sessionActive) return;

        // Request next frame
        if (this.isScanning || this.sessionActive) {
            this.session.requestAnimationFrame((t, f) => this.onXRFrame(t, f));
        }

        // Get pose
        const pose = frame.getViewerPose(this.referenceSpace);
        if (!pose) return;

        // Process camera pose
        if (this.onPoseUpdateCallback && pose.views.length > 0) {
            const view = pose.views[0];
            this.onPoseUpdateCallback({
                position: pose.transform.position,
                orientation: pose.transform.orientation,
                matrix: pose.transform.matrix,
                projectionMatrix: view.projectionMatrix,
                viewMatrix: view.transform.inverse.matrix
            });
        }

        // Process depth data if scanning
        if (this.isScanning && this.depthDataAvailable) {
            this.processDepthData(frame, pose);
        }

        // Render camera passthrough
        this.render(frame, pose);
    }

    /**
     * Process depth data from frame
     */
    processDepthData(frame, pose) {
        try {
            const view = pose.views[0];

            // Get depth information
            const depthInfo = frame.getDepthInformation(view);
            if (!depthInfo) return;

            // Extract depth data
            const depthData = {
                width: depthInfo.width,
                height: depthInfo.height,
                data: depthInfo.data, // CPU depth buffer
                normDepthBufferFromNormView: depthInfo.normDepthBufferFromNormView,
                rawValueToMeters: depthInfo.rawValueToMeters,
                timestamp: frame.predictedDisplayTime
            };

            // Get camera transform
            const cameraTransform = {
                position: view.transform.position,
                orientation: view.transform.orientation,
                matrix: view.transform.matrix
            };

            // Send to callback
            if (this.onDepthDataCallback) {
                this.onDepthDataCallback(depthData, cameraTransform);
            }
        } catch (error) {
            console.warn('Error processing depth data:', error);
        }
    }

    /**
     * Render camera passthrough
     */
    render(frame, pose) {
        const gl = this.gl;
        const layer = this.session.renderState.baseLayer;

        // Bind framebuffer
        gl.bindFramebuffer(gl.FRAMEBUFFER, layer.framebuffer);

        // Clear
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        // The actual camera passthrough is handled by the XR system
        // We just need to maintain the render loop

        for (const view of pose.views) {
            const viewport = layer.getViewport(view);
            gl.viewport(viewport.x, viewport.y, viewport.width, viewport.height);

            // Additional rendering (overlays, etc.) can be done here
            if (this.frameCallback) {
                this.frameCallback(frame, view, viewport);
            }
        }
    }

    /**
     * Handle session end
     */
    onSessionEnd() {
        this.session = null;
        this.sessionActive = false;
        this.isScanning = false;
        this.depthDataAvailable = false;
        console.log('XR session ended');
    }

    /**
     * Set callback for depth data
     */
    onDepthData(callback) {
        this.onDepthDataCallback = callback;
    }

    /**
     * Set callback for pose updates
     */
    onPoseUpdate(callback) {
        this.onPoseUpdateCallback = callback;
    }

    /**
     * Set callback for errors
     */
    onError(callback) {
        this.onErrorCallback = callback;
    }

    /**
     * Set custom frame render callback
     */
    setFrameCallback(callback) {
        this.frameCallback = callback;
    }

    /**
     * Get current session state
     */
    getState() {
        return {
            sessionActive: this.sessionActive,
            isScanning: this.isScanning,
            depthDataAvailable: this.depthDataAvailable,
            hasSession: this.session !== null
        };
    }

    /**
     * Request camera permissions
     */
    static async requestPermissions() {
        try {
            // Camera permissions are handled by the browser when requesting XR session
            // We can check for general camera permissions if needed
            if (navigator.permissions) {
                const result = await navigator.permissions.query({ name: 'camera' });
                return result.state === 'granted';
            }
            return true; // Assume granted if permissions API not available
        } catch (error) {
            console.warn('Could not check camera permissions:', error);
            return true;
        }
    }

    /**
     * Convert depth pixel to 3D point
     */
    static depthPixelTo3D(x, y, depth, depthInfo, viewMatrix) {
        // Normalize coordinates (0 to 1)
        const normX = x / depthInfo.width;
        const normY = y / depthInfo.height;

        // Transform through depth buffer matrix
        const matrix = depthInfo.normDepthBufferFromNormView.matrix;

        // Apply transformation
        const ndcX = normX * 2 - 1;
        const ndcY = normY * 2 - 1;

        // Convert depth to meters
        const depthMeters = depth * depthInfo.rawValueToMeters;

        // Reconstruct 3D point (simplified)
        // In practice, you'd use the projection matrix inverse
        const point = {
            x: ndcX * depthMeters,
            y: -ndcY * depthMeters,
            z: -depthMeters
        };

        return point;
    }
}

export default WebXRManager;
