# LiDAR Floor Plan Scanner - Web Application

A web-based LiDAR scanning application that creates accurate 2D floor plans using WebXR and depth sensing APIs. Works directly in mobile browsers with no installation required.

![WebXR](https://img.shields.io/badge/WebXR-Device%20API-blue)
![Three.js](https://img.shields.io/badge/Three.js-3D%20Rendering-green)
![License](https://img.shields.io/badge/License-MIT-lightgrey)

## Overview

This application leverages modern web technologies to provide professional-quality floor plan generation directly in mobile browsers. It uses WebXR's depth sensing capabilities to capture LiDAR data and processes it using advanced algorithms to detect walls, doors, and room boundaries.

### Key Features

- **Zero Installation** - Works directly in Safari or Chrome on compatible devices
- **Real-time Scanning** - Live point cloud visualization during capture
- **Automatic Detection** - Walls, doors, and dimensions detected automatically
- **Multiple Export Formats** - PNG, SVG, PDF, and JSON
- **Local Storage** - All data stored on device using IndexedDB
- **Responsive Design** - Works on iPhones and iPads with LiDAR sensors

## Requirements

### Device Requirements

**iOS Devices with LiDAR:**
- iPhone 12 Pro / 12 Pro Max
- iPhone 13 Pro / 13 Pro Max
- iPhone 14 Pro / 14 Pro Max
- iPhone 15 Pro / 15 Pro Max
- iPad Pro 11-inch (2020 and later)
- iPad Pro 12.9-inch (4th generation and later)

### Browser Requirements

- **Safari 15+** (recommended for iOS)
- **Chrome 90+** (with WebXR flag enabled)
- HTTPS connection required (or localhost for development)

### Permissions Required

- Camera access for AR and depth sensing
- Storage access for saving scans (automatic via IndexedDB)

## Quick Start

### Option 1: Open Directly (Simplest)

1. Copy all files to a web-accessible directory
2. Open `index.html` in Safari on a LiDAR-enabled device
3. Grant camera permissions when prompted
4. Start scanning!

### Option 2: Deploy to Web Server

```bash
# Using Python's built-in server (for development)
cd web-app
python3 -m http.server 8000

# Access at: http://localhost:8000
```

### Option 3: Deploy to GitHub Pages

1. Push the `web-app` directory to a GitHub repository
2. Enable GitHub Pages in repository settings
3. Access via `https://yourusername.github.io/your-repo/`

### Option 4: Deploy to Netlify/Vercel

Simply drag and drop the `web-app` folder to [Netlify Drop](https://app.netlify.com/drop) or connect to [Vercel](https://vercel.com).

## Usage Guide

### Scanning a Space

1. **Prepare the Environment**
   - Ensure good lighting conditions
   - Clear line of sight to walls
   - Remove or minimize reflective surfaces

2. **Start a New Scan**
   - Tap "New Scan" button
   - Grant camera permissions if prompted
   - Wait for AR session to initialize

3. **Scan Technique**
   - Tap "Start Scanning" when ready
   - Move slowly around the room (walking pace)
   - Point device at walls and corners
   - Maintain 1-3 meters distance from walls
   - Cover the entire perimeter
   - Watch point count increase

4. **Generate Floor Plan**
   - Tap "Generate Plan" when complete
   - Wait for processing (5-15 seconds)
   - Review the generated floor plan

5. **Save and Export**
   - Scan is automatically saved
   - Use "Export" button for PNG, SVG, PDF, or JSON
   - Share using device's share sheet

### Tips for Best Results

- **Lighting**: Natural or bright artificial lighting works best
- **Speed**: Move at a steady walking pace (don't rush)
- **Coverage**: Scan all walls, even behind furniture
- **Distance**: Stay 1-3 meters from walls for optimal depth data
- **Corners**: Pay extra attention to room corners and edges
- **Openings**: Scan around doors and windows clearly
- **Duration**: 30-60 seconds typically captures enough data

## Project Structure

```
web-app/
├── index.html                      # Main HTML file (single-page app)
├── README.md                       # This file
│
├── css/
│   └── styles.css                  # All styles and responsive design
│
└── js/
    ├── app.js                      # Main application controller
    ├── webxr-manager.js           # WebXR session and depth sensing
    ├── point-cloud-builder.js     # Point cloud construction
    ├── wall-detector.js           # Wall detection algorithms (RANSAC)
    ├── floor-plan-generator.js    # 2D floor plan generation
    ├── floor-plan-renderer.js     # Canvas rendering with zoom/pan
    ├── export-manager.js          # Export to PNG/SVG/PDF/JSON
    ├── storage-manager.js         # IndexedDB and localStorage
    └── utils.js                   # Utility functions
```

## Architecture

### Technology Stack

- **HTML5** - Document structure and canvas elements
- **CSS3** - Responsive layout with flexbox/grid
- **JavaScript (ES6 Modules)** - Application logic
- **WebXR Device API** - AR session and device tracking
- **WebXR Depth Sensing** - LiDAR data access
- **Three.js** - 3D point cloud visualization
- **Canvas API** - 2D floor plan rendering
- **IndexedDB** - Local data persistence
- **jsPDF** - PDF export functionality

### Core Components

#### 1. WebXR Manager (`webxr-manager.js`)

Manages the WebXR AR session and depth sensing:
- Initializes WebGL context with XR compatibility
- Requests immersive AR session with depth sensing
- Processes XR frames and extracts depth data
- Provides camera pose tracking
- Handles session lifecycle

**Key Methods:**
- `startSession()` - Initialize AR session
- `startScanning()` - Begin depth data collection
- `processDepthData()` - Extract depth buffer data
- `endSession()` - Clean up AR session

#### 2. Point Cloud Builder (`point-cloud-builder.js`)

Constructs 3D point cloud from depth data:
- Converts depth pixels to 3D coordinates
- Transforms points from camera to world space
- Estimates surface normals from neighboring points
- Filters outliers using statistical methods
- Downsamples to maintain performance

**Algorithm:**
1. Sample depth buffer at quality-based intervals
2. Unproject 2D pixels to 3D using camera intrinsics
3. Transform to world coordinates using pose matrix
4. Estimate normals via finite differences
5. Filter outliers beyond 2.5 standard deviations
6. Downsample if exceeding maximum point count

#### 3. Wall Detector (`wall-detector.js`)

Detects walls and openings using RANSAC:

**Algorithm Pipeline:**
1. **Floor Detection** - Histogram-based Y-coordinate clustering
2. **Height Filtering** - Select points at wall height (0.5m - 3.0m)
3. **Vertical Surface Detection** - Filter by horizontal surface normals
4. **Grid Clustering** - Spatial clustering in 10cm cells
5. **Connected Components** - Group adjacent cells
6. **RANSAC Line Fitting** - Robust line fitting to each cluster
7. **PCA Refinement** - Improve line fit using all inliers
8. **Post-Processing** - Snap to cardinal directions, merge parallel walls
9. **Opening Detection** - Identify gaps for doors (0.6m - 1.2m)

**RANSAC Parameters:**
- 100 iterations
- 5cm inlier threshold
- Minimum 50 inliers per wall

#### 4. Floor Plan Generator (`floor-plan-generator.js`)

Generates 2D floor plan representation:
- Projects 3D walls to 2D top-down view
- Identifies room boundaries and corners
- Calculates dimensions and areas
- Generates SVG for vector export
- Produces JSON data format

#### 5. Floor Plan Renderer (`floor-plan-renderer.js`)

Interactive canvas-based renderer:
- Real-time pan and zoom
- Touch gesture support
- Dynamic dimension labels
- Scale indicator
- Grid overlay
- Responsive to window resize

**Interaction:**
- **Mouse/Touch Drag** - Pan the view
- **Mouse Wheel/Pinch** - Zoom in/out
- **Buttons** - Zoom controls and reset view

#### 6. Export Manager (`export-manager.js`)

Handles multiple export formats:
- **PNG** - Rasterized image at custom resolution
- **SVG** - Vector graphics with embedded dimensions
- **PDF** - Multi-page document with dimension summary
- **JSON** - Complete data export for analysis

#### 7. Storage Manager (`storage-manager.js`)

Data persistence layer:
- **IndexedDB** - For large scan data and point clouds
- **localStorage** - For settings and preferences
- Thumbnail generation
- Scan versioning
- Import/export functionality

### Data Flow

```
WebXR Frame
    ↓
Depth Buffer → Point Cloud Builder → 3D Points + Normals
                                          ↓
                                     Wall Detector
                                          ↓
                                    Wall Segments
                                          ↓
                                 Floor Plan Generator
                                          ↓
                                    2D Floor Plan
                                          ↓
                        ┌──────────────────┴──────────────────┐
                        ↓                                      ↓
                 Canvas Renderer                        Export Manager
                        ↓                                      ↓
                 Interactive View                      PNG/SVG/PDF/JSON
```

## Advanced Configuration

### Adjusting Detection Parameters

Edit `wall-detector.js` to tune detection:

```javascript
// Grid clustering resolution
this.gridCellSize = 0.1; // 10cm cells (smaller = more detail)

// Minimum wall length
this.minWallLength = 0.3; // 30cm (shorter = detect smaller walls)

// Wall height range
this.minWallHeight = 0.5; // 50cm
this.maxWallHeight = 3.0; // 3m

// Cardinal direction snapping threshold
this.angleSnapThreshold = 15; // degrees

// Door width detection range
this.doorWidthRange = { min: 0.6, max: 1.2 }; // meters
```

### Adjusting Point Cloud Quality

Three quality levels are available:

```javascript
// Low quality (fastest, fewer points)
qualitySettings = {
    low: { samplingStep: 8, maxPoints: 50000 }
}

// Medium quality (balanced)
qualitySettings = {
    medium: { samplingStep: 4, maxPoints: 100000 }
}

// High quality (slowest, most points)
qualitySettings = {
    high: { samplingStep: 2, maxPoints: 200000 }
}
```

### Customizing UI Colors

Edit CSS variables in `styles.css`:

```css
:root {
    --primary-color: #007AFF;  /* Change to your brand color */
    --success-color: #34C759;
    --danger-color: #FF3B30;
    /* ... */
}
```

## Performance Optimization

### Point Cloud Optimization

- **Downsampling** - Automatically limits points to quality-based maximum
- **Outlier Filtering** - Removes statistical outliers to reduce noise
- **Grid Clustering** - O(n) spatial indexing instead of O(n²) comparisons
- **Progressive Rendering** - Updates UI incrementally during scanning

### Memory Management

- **Web Workers** - Heavy processing offloaded to background threads (future enhancement)
- **Incremental GC** - Regular cleanup of temporary data structures
- **IndexedDB** - Large datasets stored off main memory
- **Blob Storage** - Point clouds compressed for storage

### Best Practices

1. **Limit Scan Duration** - 30-60 seconds typically sufficient
2. **Use Medium Quality** - Best balance of speed and accuracy
3. **Clear Old Scans** - Periodically remove unused scans
4. **Test on Device** - Performance varies by device model

## Browser Compatibility

### Safari (iOS)

- ✅ Full WebXR support on iOS 14+
- ✅ Depth sensing on LiDAR devices
- ✅ DOM overlay support
- ⚠️ Requires user gesture to start AR session

### Chrome (iOS)

- ⚠️ Limited WebXR support
- ⚠️ Depth sensing may require flags
- ❌ Not recommended (use Safari instead)

### Chrome (Android)

- ✅ WebXR support on compatible devices
- ⚠️ ToF sensor required (limited device availability)
- ⚠️ Depth sensing API support varies

## Troubleshooting

### "WebXR Not Supported"

**Causes:**
- Browser doesn't support WebXR
- Device doesn't have LiDAR sensor
- Not using HTTPS (required for sensor access)

**Solutions:**
- Use Safari 15+ on iPhone 12 Pro or later
- Ensure HTTPS or localhost connection
- Check browser console for specific errors

### "Depth Sensing Not Available"

**Causes:**
- Device doesn't have LiDAR (e.g., iPhone 12, not Pro)
- Browser doesn't support depth sensing extension

**Solutions:**
- Verify device model has LiDAR sensor
- Update iOS to latest version
- Try Safari if using Chrome

### Poor Floor Plan Quality

**Causes:**
- Insufficient scan coverage
- Too fast camera movement
- Poor lighting conditions
- Reflective or transparent surfaces

**Solutions:**
- Scan for longer (aim for 20,000+ points)
- Move more slowly and steadily
- Improve lighting
- Increase quality setting in app settings

### Walls Not Detected

**Causes:**
- Not enough points near walls
- Walls too thin or far away
- Camera angle too steep

**Solutions:**
- Scan closer to walls (1-2 meters ideal)
- Point camera perpendicular to walls
- Increase scan duration and coverage

### App Crashes or Freezes

**Causes:**
- Too many points (memory exhaustion)
- Background apps consuming memory
- Device overheating

**Solutions:**
- Use lower quality setting
- Close other apps
- Let device cool down
- Reduce scan duration

## Security and Privacy

### Data Privacy

- ✅ **All processing on-device** - No data transmitted to servers
- ✅ **Local storage only** - Scans stored in browser IndexedDB
- ✅ **User control** - Easy deletion of scans and data
- ✅ **No tracking** - No analytics or tracking scripts
- ✅ **No account required** - No sign-up or personal information

### Camera Permissions

- Explicit user consent required by browser
- Permissions can be revoked anytime in browser settings
- Camera used only during active AR session
- No video/photo recording (only depth data captured)

## API Reference

### WebXRManager

```javascript
const xrManager = new WebXRManager(canvas);

// Check support
await xrManager.checkSupport();

// Start AR session
await xrManager.startSession();

// Begin scanning
xrManager.startScanning();

// Set callbacks
xrManager.onDepthData((depthData, cameraTransform) => {
    // Process depth data
});

xrManager.onError((error) => {
    // Handle errors
});

// Stop scanning
xrManager.stopScanning();

// End session
await xrManager.endSession();
```

### PointCloudBuilder

```javascript
const builder = new PointCloudBuilder('medium'); // quality: low/medium/high

// Process depth frame
const result = builder.processDepthData(depthData, cameraTransform);
// Returns: { pointsAdded: number, totalPoints: number }

// Get point cloud
const data = builder.getData();
// Returns: { points: Array, normals: Array, count: number }

// Export to OBJ format
const obj = builder.exportOBJ();

// Clear point cloud
builder.clear();
```

### WallDetector

```javascript
const detector = new WallDetector();

// Detect walls
const result = detector.detectWalls(points, normals);
// Returns: { walls: Array, floorLevel: number }

// Detect openings
const doors = detector.detectOpenings(walls, points);
// Returns: Array of door objects
```

### FloorPlanGenerator

```javascript
const generator = new FloorPlanGenerator();

// Generate floor plan
const floorPlan = generator.generate(walls, doors);
// Returns: { walls, doors, rooms, bounds, dimensions, totalArea }

// Export to SVG
const svg = generator.toSVG(width, height, options);

// Export to JSON
const json = generator.toJSON();
```

### ExportManager

```javascript
const exporter = new ExportManager();

exporter.setFloorPlanGenerator(generator);
exporter.setRenderer(renderer);

// Export formats
await exporter.exportPNG('filename', options);
await exporter.exportSVG('filename', options);
await exporter.exportPDF('filename', options);
await exporter.exportJSON('filename', options);

// Share
await exporter.share('Floor Plan Title');

// Print
exporter.print();
```

## Known Limitations

1. **Room Segmentation** - Currently treats space as single room; advanced multi-room detection planned
2. **Furniture Detection** - Does not distinguish walls from furniture
3. **Ceiling Height** - Not measured (assumes standard height)
4. **Curved Walls** - Approximated as straight segments
5. **Outdoor Use** - Designed for indoor spaces only
6. **Large Spaces** - Performance may degrade beyond 200m²
7. **Browser Limitations** - WebXR adoption still limited to certain browsers

## Future Enhancements

- [ ] Multi-room segmentation algorithm
- [ ] Furniture detection and classification
- [ ] Ceiling height measurement
- [ ] Multi-floor support
- [ ] Web Workers for background processing
- [ ] Progressive Web App (offline support)
- [ ] Cloud sync (optional)
- [ ] Collaborative scanning
- [ ] 3D model export (OBJ, GLTF)
- [ ] AR preview of floor plan overlay
- [ ] CAD software integration
- [ ] Custom measurements and annotations

## Contributing

Contributions are welcome! Areas for improvement:

- Better room segmentation algorithms
- Furniture detection
- Performance optimizations
- Additional export formats
- Better error handling and user feedback
- Accessibility improvements

## License

MIT License - See LICENSE file for details

## Credits

**Technologies:**
- [WebXR Device API](https://immersiveweb.dev/) - W3C standard for AR/VR
- [Three.js](https://threejs.org/) - 3D graphics library
- [jsPDF](https://github.com/parallax/jsPDF) - PDF generation

**Algorithms:**
- RANSAC - Random Sample Consensus for robust fitting
- PCA - Principal Component Analysis for line fitting
- Connected Components - Spatial clustering algorithm

## Support

For issues or questions:
- Check this README thoroughly
- Review browser console for error messages
- Verify device and browser compatibility
- Check WebXR API status at [caniuse.com](https://caniuse.com/webxr)

## Changelog

### Version 1.0 (Initial Release)
- ✅ WebXR depth sensing integration
- ✅ Real-time point cloud building
- ✅ RANSAC-based wall detection
- ✅ Automatic floor plan generation
- ✅ Interactive canvas renderer
- ✅ PNG, SVG, PDF, JSON export
- ✅ IndexedDB storage
- ✅ Responsive mobile-first design
- ✅ Touch gesture support
- ✅ Settings and preferences

---

**Built with modern web technologies for the future of spatial computing.**

For more information about WebXR, visit [immersiveweb.dev](https://immersiveweb.dev/)
