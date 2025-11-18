/**
 * Export Manager
 * Handles exporting floor plans to various formats (PNG, SVG, PDF, JSON)
 */

import { FileUtils } from './utils.js';

export class ExportManager {
    constructor() {
        this.floorPlanGenerator = null;
        this.renderer = null;
    }

    /**
     * Set floor plan generator reference
     */
    setFloorPlanGenerator(generator) {
        this.floorPlanGenerator = generator;
    }

    /**
     * Set renderer reference
     */
    setRenderer(renderer) {
        this.renderer = renderer;
    }

    /**
     * Export as PNG image
     */
    async exportPNG(filename, options = {}) {
        const {
            width = 1920,
            height = 1080,
            includeDimensions = true,
            includeLabels = true
        } = options;

        if (!this.renderer || !this.renderer.canvas) {
            throw new Error('Renderer not available');
        }

        // Create temporary canvas at desired resolution
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = width;
        tempCanvas.height = height;

        const tempCtx = tempCanvas.getContext('2d');

        // Draw white background
        tempCtx.fillStyle = 'white';
        tempCtx.fillRect(0, 0, width, height);

        // Scale and draw the floor plan
        const scale = Math.min(
            width / this.renderer.canvas.width,
            height / this.renderer.canvas.height
        );

        const scaledWidth = this.renderer.canvas.width * scale;
        const scaledHeight = this.renderer.canvas.height * scale;
        const offsetX = (width - scaledWidth) / 2;
        const offsetY = (height - scaledHeight) / 2;

        tempCtx.drawImage(
            this.renderer.canvas,
            offsetX, offsetY,
            scaledWidth, scaledHeight
        );

        // Convert to blob
        const blob = await FileUtils.canvasToBlob(tempCanvas, 'image/png');

        // Download
        FileUtils.downloadFile(blob, `${filename}.png`);

        return blob;
    }

    /**
     * Export as SVG vector
     */
    async exportSVG(filename, options = {}) {
        const {
            width = 800,
            height = 600,
            includeDimensions = true,
            includeLabels = true
        } = options;

        if (!this.floorPlanGenerator) {
            throw new Error('Floor plan generator not available');
        }

        // Generate SVG
        const svg = this.floorPlanGenerator.toSVG(width, height, {
            showDimensions: includeDimensions,
            showLabels: includeLabels
        });

        // Create blob
        const blob = new Blob([svg], { type: 'image/svg+xml' });

        // Download
        FileUtils.downloadFile(blob, `${filename}.svg`);

        return blob;
    }

    /**
     * Export as PDF document
     */
    async exportPDF(filename, options = {}) {
        const {
            title = 'Floor Plan',
            includeDimensions = true,
            includeLabels = true,
            pageSize = 'a4',
            orientation = 'landscape'
        } = options;

        // Check if jsPDF is available
        if (typeof jspdf === 'undefined' && typeof window.jspdf === 'undefined') {
            throw new Error('jsPDF library not loaded');
        }

        const { jsPDF } = window.jspdf;

        // Create PDF
        const pdf = new jsPDF({
            orientation: orientation,
            unit: 'mm',
            format: pageSize
        });

        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();

        // Add title
        pdf.setFontSize(20);
        pdf.text(title, pageWidth / 2, 15, { align: 'center' });

        // Add date
        pdf.setFontSize(10);
        const date = new Date().toLocaleDateString();
        pdf.text(`Generated on ${date}`, pageWidth / 2, 22, { align: 'center' });

        // Add floor plan image
        if (this.renderer && this.renderer.canvas) {
            const imgData = this.renderer.canvas.toDataURL('image/png');

            const margin = 20;
            const imgWidth = pageWidth - margin * 2;
            const imgHeight = pageHeight - margin * 2 - 25; // Account for title

            pdf.addImage(imgData, 'PNG', margin, 30, imgWidth, imgHeight);
        }

        // Add dimensions summary
        if (includeDimensions && this.floorPlanGenerator) {
            const dimensions = this.floorPlanGenerator.calculateDimensions();
            const totalArea = this.floorPlanGenerator.calculateTotalArea();

            pdf.addPage();
            pdf.setFontSize(16);
            pdf.text('Dimensions Summary', 15, 15);

            pdf.setFontSize(10);
            let y = 30;

            // Total area
            pdf.text(`Total Area: ${totalArea.toFixed(2)} m²`, 15, y);
            y += 10;

            // Room dimensions
            if (dimensions.rooms.length > 0) {
                pdf.text('Room Dimensions:', 15, y);
                y += 7;

                for (const room of dimensions.rooms) {
                    pdf.text(
                        `  ${room.name}: ${room.width.toFixed(2)}m × ${room.height.toFixed(2)}m (${room.area.toFixed(2)}m²)`,
                        15, y
                    );
                    y += 6;
                }
            }

            y += 10;

            // Wall lengths
            if (dimensions.walls.length > 0) {
                pdf.text('Wall Lengths:', 15, y);
                y += 7;

                for (let i = 0; i < dimensions.walls.length; i++) {
                    const wall = dimensions.walls[i];
                    pdf.text(`  Wall ${i + 1}: ${wall.length.toFixed(2)}m`, 15, y);
                    y += 6;

                    // Add new page if needed
                    if (y > pageHeight - 20) {
                        pdf.addPage();
                        y = 15;
                    }
                }
            }
        }

        // Save PDF
        pdf.save(`${filename}.pdf`);

        return pdf;
    }

    /**
     * Export as JSON data
     */
    async exportJSON(filename, options = {}) {
        const { pretty = true } = options;

        if (!this.floorPlanGenerator) {
            throw new Error('Floor plan generator not available');
        }

        const data = {
            metadata: {
                version: '1.0',
                exportDate: new Date().toISOString(),
                generator: 'LiDAR Floor Plan Scanner'
            },
            floorPlan: {
                walls: this.floorPlanGenerator.walls,
                doors: this.floorPlanGenerator.doors,
                rooms: this.floorPlanGenerator.rooms,
                bounds: this.floorPlanGenerator.bounds,
                dimensions: this.floorPlanGenerator.calculateDimensions(),
                totalArea: this.floorPlanGenerator.calculateTotalArea()
            }
        };

        const jsonString = pretty ? JSON.stringify(data, null, 2) : JSON.stringify(data);

        const blob = new Blob([jsonString], { type: 'application/json' });

        FileUtils.downloadFile(blob, `${filename}.json`);

        return blob;
    }

    /**
     * Export complete scan data (including point cloud)
     */
    async exportFullData(scanData, filename) {
        const fullData = {
            metadata: {
                version: '1.0',
                exportDate: new Date().toISOString(),
                generator: 'LiDAR Floor Plan Scanner',
                pointCount: scanData.pointCloud?.length || 0
            },
            scan: scanData
        };

        const jsonString = JSON.stringify(fullData);

        const blob = new Blob([jsonString], { type: 'application/json' });

        FileUtils.downloadFile(blob, `${filename}_full_data.json`);

        return blob;
    }

    /**
     * Share floor plan using Web Share API
     */
    async share(title = 'Floor Plan') {
        if (!navigator.share || !navigator.canShare) {
            throw new Error('Web Share API not supported');
        }

        // Export as PNG first
        const blob = await this.exportPNG('floor-plan-share', { width: 1200, height: 900 });

        const file = new File([blob], 'floor-plan.png', { type: 'image/png' });

        const shareData = {
            title: title,
            text: 'Check out this floor plan',
            files: [file]
        };

        if (navigator.canShare(shareData)) {
            await navigator.share(shareData);
            return true;
        } else {
            throw new Error('Cannot share this data');
        }
    }

    /**
     * Copy floor plan image to clipboard
     */
    async copyToClipboard() {
        if (!navigator.clipboard || !this.renderer) {
            throw new Error('Clipboard API not supported');
        }

        const blob = await FileUtils.canvasToBlob(this.renderer.canvas, 'image/png');

        await navigator.clipboard.write([
            new ClipboardItem({ 'image/png': blob })
        ]);

        return true;
    }

    /**
     * Print floor plan
     */
    print() {
        if (!this.renderer || !this.renderer.canvas) {
            throw new Error('Renderer not available');
        }

        // Create print window
        const printWindow = window.open('', '_blank');

        if (!printWindow) {
            throw new Error('Could not open print window');
        }

        const imgData = this.renderer.canvas.toDataURL('image/png');

        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Floor Plan</title>
                <style>
                    body {
                        margin: 0;
                        padding: 20px;
                        display: flex;
                        justify-content: center;
                        align-items: center;
                        min-height: 100vh;
                    }
                    img {
                        max-width: 100%;
                        height: auto;
                    }
                    @media print {
                        body { padding: 0; }
                        img { page-break-inside: avoid; }
                    }
                </style>
            </head>
            <body>
                <img src="${imgData}" alt="Floor Plan" />
            </body>
            </html>
        `);

        printWindow.document.close();

        // Wait for image to load then print
        printWindow.onload = () => {
            printWindow.print();
        };
    }

    /**
     * Get supported export formats
     */
    getSupportedFormats() {
        return [
            { format: 'png', name: 'PNG Image', extension: '.png', mimeType: 'image/png' },
            { format: 'svg', name: 'SVG Vector', extension: '.svg', mimeType: 'image/svg+xml' },
            { format: 'pdf', name: 'PDF Document', extension: '.pdf', mimeType: 'application/pdf' },
            { format: 'json', name: 'JSON Data', extension: '.json', mimeType: 'application/json' }
        ];
    }

    /**
     * Check if Web Share API is available
     */
    canShare() {
        return navigator.share && navigator.canShare;
    }

    /**
     * Check if Clipboard API is available
     */
    canCopyToClipboard() {
        return navigator.clipboard && navigator.clipboard.write;
    }
}

export default ExportManager;
