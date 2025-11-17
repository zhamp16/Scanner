/**
 * Floor Plan Renderer
 * Renders floor plans on HTML5 canvas with zoom, pan, and interaction
 */

import { MathUtils, UnitConverter } from './utils.js';

export class FloorPlanRenderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');

        // View state
        this.offsetX = 0;
        this.offsetY = 0;
        this.scale = 1;
        this.minScale = 0.1;
        this.maxScale = 5;

        // Floor plan data
        this.floorPlan = null;
        this.units = 'metric';
        this.showDimensions = true;
        this.showLabels = true;

        // Interaction state
        this.isDragging = false;
        this.lastMouseX = 0;
        this.lastMouseY = 0;

        // Bind event handlers
        this.setupEventHandlers();

        // Set canvas size
        this.resize();
    }

    /**
     * Set floor plan data
     */
    setFloorPlan(floorPlan) {
        this.floorPlan = floorPlan;
        this.resetView();
        this.render();
    }

    /**
     * Reset view to fit floor plan
     */
    resetView() {
        if (!this.floorPlan || !this.floorPlan.bounds) return;

        const bounds = this.floorPlan.bounds;
        const padding = 50;

        const scaleX = (this.canvas.width - padding * 2) / bounds.width;
        const scaleY = (this.canvas.height - padding * 2) / bounds.height;

        this.scale = Math.min(scaleX, scaleY, 50); // Max 50 pixels per meter

        this.offsetX = this.canvas.width / 2 - (bounds.min.x + bounds.width / 2) * this.scale;
        this.offsetY = this.canvas.height / 2 - (bounds.min.y + bounds.height / 2) * this.scale;

        this.render();
    }

    /**
     * Transform world coordinates to canvas coordinates
     */
    worldToCanvas(x, y) {
        return {
            x: x * this.scale + this.offsetX,
            y: y * this.scale + this.offsetY
        };
    }

    /**
     * Transform canvas coordinates to world coordinates
     */
    canvasToWorld(x, y) {
        return {
            x: (x - this.offsetX) / this.scale,
            y: (y - this.offsetY) / this.scale
        };
    }

    /**
     * Render the floor plan
     */
    render() {
        const ctx = this.ctx;

        // Clear canvas
        ctx.fillStyle = '#f5f5f5';
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        if (!this.floorPlan) return;

        // Draw grid
        this.drawGrid();

        // Draw rooms (background)
        this.drawRooms();

        // Draw walls
        this.drawWalls();

        // Draw doors
        this.drawDoors();

        // Draw dimensions
        if (this.showDimensions) {
            this.drawDimensions();
        }

        // Draw labels
        if (this.showLabels) {
            this.drawLabels();
        }

        // Draw scale indicator
        this.drawScaleIndicator();
    }

    /**
     * Draw grid
     */
    drawGrid() {
        const ctx = this.ctx;
        const gridSize = 1; // 1 meter
        const gridPixels = gridSize * this.scale;

        if (gridPixels < 10) return; // Don't draw grid if too dense

        ctx.strokeStyle = '#e0e0e0';
        ctx.lineWidth = 1;

        const bounds = this.floorPlan.bounds;
        const startX = Math.floor(bounds.min.x / gridSize) * gridSize;
        const startY = Math.floor(bounds.min.y / gridSize) * gridSize;
        const endX = Math.ceil(bounds.max.x / gridSize) * gridSize;
        const endY = Math.ceil(bounds.max.y / gridSize) * gridSize;

        // Vertical lines
        for (let x = startX; x <= endX; x += gridSize) {
            const canvasX = this.worldToCanvas(x, 0).x;
            ctx.beginPath();
            ctx.moveTo(canvasX, 0);
            ctx.lineTo(canvasX, this.canvas.height);
            ctx.stroke();
        }

        // Horizontal lines
        for (let y = startY; y <= endY; y += gridSize) {
            const canvasY = this.worldToCanvas(0, y).y;
            ctx.beginPath();
            ctx.moveTo(0, canvasY);
            ctx.lineTo(this.canvas.width, canvasY);
            ctx.stroke();
        }
    }

    /**
     * Draw rooms
     */
    drawRooms() {
        const ctx = this.ctx;

        for (const room of this.floorPlan.rooms) {
            if (room.corners.length < 3) continue;

            ctx.fillStyle = 'rgba(135, 206, 250, 0.1)';
            ctx.strokeStyle = 'rgba(135, 206, 250, 0.3)';
            ctx.lineWidth = 2;

            ctx.beginPath();
            const firstCorner = this.worldToCanvas(room.corners[0].x, room.corners[0].y);
            ctx.moveTo(firstCorner.x, firstCorner.y);

            for (let i = 1; i < room.corners.length; i++) {
                const corner = this.worldToCanvas(room.corners[i].x, room.corners[i].y);
                ctx.lineTo(corner.x, corner.y);
            }

            ctx.closePath();
            ctx.fill();
            ctx.stroke();
        }
    }

    /**
     * Draw walls
     */
    drawWalls() {
        const ctx = this.ctx;

        ctx.strokeStyle = '#333';
        ctx.lineWidth = Math.max(3, this.scale * 0.15); // Scale with zoom
        ctx.lineCap = 'round';

        for (const wall of this.floorPlan.walls) {
            const start = this.worldToCanvas(wall.start.x, wall.start.y);
            const end = this.worldToCanvas(wall.end.x, wall.end.y);

            ctx.beginPath();
            ctx.moveTo(start.x, start.y);
            ctx.lineTo(end.x, end.y);
            ctx.stroke();
        }
    }

    /**
     * Draw doors
     */
    drawDoors() {
        const ctx = this.ctx;

        if (this.floorPlan.doors.length === 0) return;

        ctx.strokeStyle = '#8B4513';
        ctx.lineWidth = Math.max(2, this.scale * 0.1);
        ctx.setLineDash([5, 5]);

        for (const door of this.floorPlan.doors) {
            const start = this.worldToCanvas(door.start.x, door.start.y);
            const end = this.worldToCanvas(door.end.x, door.end.y);

            ctx.beginPath();
            ctx.moveTo(start.x, start.y);
            ctx.lineTo(end.x, end.y);
            ctx.stroke();

            // Draw arc for door swing
            const radius = MathUtils.distance2D(start, end);
            ctx.beginPath();
            const angle1 = Math.atan2(end.y - start.y, end.x - start.x);
            ctx.arc(start.x, start.y, radius, angle1, angle1 - Math.PI / 2, true);
            ctx.stroke();
        }

        ctx.setLineDash([]);
    }

    /**
     * Draw dimensions
     */
    drawDimensions() {
        const ctx = this.ctx;

        ctx.fillStyle = '#666';
        ctx.font = `${Math.max(10, 12 * this.scale / 50)}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        for (const wall of this.floorPlan.walls) {
            const length = MathUtils.distance2D(wall.start, wall.end);
            const mid = {
                x: (wall.start.x + wall.end.x) / 2,
                y: (wall.start.y + wall.end.y) / 2
            };

            const canvasMid = this.worldToCanvas(mid.x, mid.y);

            // Calculate text rotation
            const angle = Math.atan2(wall.end.y - wall.start.y, wall.end.x - wall.start.x);

            ctx.save();
            ctx.translate(canvasMid.x, canvasMid.y);
            ctx.rotate(angle);

            // Draw background
            const text = UnitConverter.formatDistance(length, this.units);
            const metrics = ctx.measureText(text);
            const padding = 4;

            ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
            ctx.fillRect(
                -metrics.width / 2 - padding,
                -8 - padding,
                metrics.width + padding * 2,
                16 + padding * 2
            );

            // Draw text
            ctx.fillStyle = '#666';
            ctx.fillText(text, 0, 0);

            ctx.restore();
        }
    }

    /**
     * Draw labels
     */
    drawLabels() {
        const ctx = this.ctx;

        for (const room of this.floorPlan.rooms) {
            const center = this.worldToCanvas(room.center.x, room.center.y);

            // Room name
            ctx.fillStyle = '#007AFF';
            ctx.font = `bold ${Math.max(14, 16 * this.scale / 50)}px Arial`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(room.name, center.x, center.y - 10);

            // Room area
            ctx.fillStyle = '#666';
            ctx.font = `${Math.max(11, 12 * this.scale / 50)}px Arial`;
            const areaText = UnitConverter.formatArea(room.area, this.units);
            ctx.fillText(areaText, center.x, center.y + 10);
        }
    }

    /**
     * Draw scale indicator
     */
    drawScaleIndicator() {
        const ctx = this.ctx;

        const scaleLength = 1; // 1 meter
        const scalePixels = scaleLength * this.scale;

        const x = 20;
        const y = this.canvas.height - 30;

        // Draw scale bar
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + scalePixels, y);
        ctx.stroke();

        // Draw ticks
        ctx.beginPath();
        ctx.moveTo(x, y - 5);
        ctx.lineTo(x, y + 5);
        ctx.moveTo(x + scalePixels, y - 5);
        ctx.lineTo(x + scalePixels, y + 5);
        ctx.stroke();

        // Draw label
        ctx.fillStyle = '#333';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(UnitConverter.formatDistance(scaleLength, this.units), x + scalePixels / 2, y - 10);
    }

    /**
     * Setup event handlers for interaction
     */
    setupEventHandlers() {
        // Mouse events
        this.canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
        this.canvas.addEventListener('mouseup', (e) => this.onMouseUp(e));
        this.canvas.addEventListener('wheel', (e) => this.onWheel(e));

        // Touch events
        this.canvas.addEventListener('touchstart', (e) => this.onTouchStart(e));
        this.canvas.addEventListener('touchmove', (e) => this.onTouchMove(e));
        this.canvas.addEventListener('touchend', (e) => this.onTouchEnd(e));

        // Window resize
        window.addEventListener('resize', () => this.resize());
    }

    /**
     * Mouse down event
     */
    onMouseDown(e) {
        this.isDragging = true;
        this.lastMouseX = e.clientX;
        this.lastMouseY = e.clientY;
        this.canvas.style.cursor = 'grabbing';
    }

    /**
     * Mouse move event
     */
    onMouseMove(e) {
        if (!this.isDragging) return;

        const dx = e.clientX - this.lastMouseX;
        const dy = e.clientY - this.lastMouseY;

        this.offsetX += dx;
        this.offsetY += dy;

        this.lastMouseX = e.clientX;
        this.lastMouseY = e.clientY;

        this.render();
    }

    /**
     * Mouse up event
     */
    onMouseUp(e) {
        this.isDragging = false;
        this.canvas.style.cursor = 'grab';
    }

    /**
     * Mouse wheel event (zoom)
     */
    onWheel(e) {
        e.preventDefault();

        const rect = this.canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const zoom = e.deltaY < 0 ? 1.1 : 0.9;
        const newScale = MathUtils.clamp(this.scale * zoom, this.minScale, this.maxScale);

        // Zoom towards mouse position
        const worldBefore = this.canvasToWorld(mouseX, mouseY);
        this.scale = newScale;
        const worldAfter = this.canvasToWorld(mouseX, mouseY);

        this.offsetX += (worldAfter.x - worldBefore.x) * this.scale;
        this.offsetY += (worldAfter.y - worldBefore.y) * this.scale;

        this.render();
    }

    /**
     * Touch start event
     */
    onTouchStart(e) {
        if (e.touches.length === 1) {
            this.isDragging = true;
            this.lastMouseX = e.touches[0].clientX;
            this.lastMouseY = e.touches[0].clientY;
        }
    }

    /**
     * Touch move event
     */
    onTouchMove(e) {
        e.preventDefault();

        if (e.touches.length === 1 && this.isDragging) {
            const dx = e.touches[0].clientX - this.lastMouseX;
            const dy = e.touches[0].clientY - this.lastMouseY;

            this.offsetX += dx;
            this.offsetY += dy;

            this.lastMouseX = e.touches[0].clientX;
            this.lastMouseY = e.touches[0].clientY;

            this.render();
        }
    }

    /**
     * Touch end event
     */
    onTouchEnd(e) {
        this.isDragging = false;
    }

    /**
     * Zoom in
     */
    zoomIn() {
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;

        const worldBefore = this.canvasToWorld(centerX, centerY);
        this.scale = MathUtils.clamp(this.scale * 1.2, this.minScale, this.maxScale);
        const worldAfter = this.canvasToWorld(centerX, centerY);

        this.offsetX += (worldAfter.x - worldBefore.x) * this.scale;
        this.offsetY += (worldAfter.y - worldBefore.y) * this.scale;

        this.render();
    }

    /**
     * Zoom out
     */
    zoomOut() {
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;

        const worldBefore = this.canvasToWorld(centerX, centerY);
        this.scale = MathUtils.clamp(this.scale / 1.2, this.minScale, this.maxScale);
        const worldAfter = this.canvasToWorld(centerX, centerY);

        this.offsetX += (worldAfter.x - worldBefore.x) * this.scale;
        this.offsetY += (worldAfter.y - worldBefore.y) * this.scale;

        this.render();
    }

    /**
     * Resize canvas
     */
    resize() {
        const parent = this.canvas.parentElement;
        if (parent) {
            this.canvas.width = parent.clientWidth;
            this.canvas.height = parent.clientHeight;
            this.render();
        }
    }

    /**
     * Set units preference
     */
    setUnits(units) {
        this.units = units;
        this.render();
    }

    /**
     * Toggle dimensions
     */
    toggleDimensions() {
        this.showDimensions = !this.showDimensions;
        this.render();
    }

    /**
     * Toggle labels
     */
    toggleLabels() {
        this.showLabels = !this.showLabels;
        this.render();
    }
}

export default FloorPlanRenderer;
