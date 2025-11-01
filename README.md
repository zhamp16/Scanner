# Floor Plan Scanner - LiDAR-Powered iOS App

A native iOS application that uses LiDAR technology to scan indoor spaces and generate accurate 2D floor plan layouts. Built with Swift, SwiftUI, ARKit, and RealityKit.

![iOS](https://img.shields.io/badge/iOS-14.0+-blue.svg)
![Swift](https://img.shields.io/badge/Swift-5.0-orange.svg)
![ARKit](https://img.shields.io/badge/ARKit-Scene%20Reconstruction-green.svg)
![License](https://img.shields.io/badge/License-MIT-lightgrey.svg)

## Features

### LiDAR Scanning
- ✅ Real-time AR view with live scanning feedback
- ✅ Visual mesh overlay showing scanned areas
- ✅ Progress tracking and scanning guidance
- ✅ Start/stop/pause scanning controls
- ✅ Distance measurements during scanning
- ✅ Automatic LiDAR availability detection

### Floor Plan Generation
- ✅ Automatic wall detection from 3D mesh data
- ✅ Door and opening identification
- ✅ Room boundary extraction
- ✅ Accurate dimension calculations
- ✅ Clean 2D top-down floor plan view
- ✅ Room labeling and area measurement

### User Interface
- ✅ Onboarding tutorial for first-time users
- ✅ Intuitive scanning interface with visual guidance
- ✅ Floor plan viewer with zoom and pan controls
- ✅ Settings for metric/imperial units
- ✅ Dark mode optimized for AR usage

### Data Management
- ✅ Save multiple scans with custom names
- ✅ Local storage using file system
- ✅ Export floor plans as PDF
- ✅ Export floor plans as PNG images
- ✅ Share via iOS share sheet

## Requirements

### Device Requirements
- iPhone 12 Pro or later (devices with LiDAR sensor)
- iPad Pro (2020 or later) with LiDAR sensor
- iOS 14.0 or later

### Development Requirements
- Xcode 14.0 or later
- macOS 12.0 (Monterey) or later
- Swift 5.7 or later
- iOS SDK 14.0 or later

## Installation

### Option 1: Open in Xcode
1. Clone or download this repository:
   ```bash
   git clone <repository-url>
   cd Scanner
   ```

2. Open the project in Xcode:
   ```bash
   open FloorPlanScanner.xcodeproj
   ```

3. Select your development team in the project settings:
   - Click on the project in the navigator
   - Select the "FloorPlanScanner" target
   - Go to "Signing & Capabilities"
   - Select your Team

4. Connect a LiDAR-enabled iOS device

5. Build and run (⌘R)

### Option 2: Build from Command Line
```bash
cd Scanner
xcodebuild -project FloorPlanScanner.xcodeproj -scheme FloorPlanScanner -destination 'platform=iOS,id=<device-id>' build
```

## Architecture Overview

The app follows the MVVM (Model-View-ViewModel) architecture pattern with manager classes for core functionality.

### Project Structure

```
FloorPlanScanner/
├── FloorPlanScannerApp.swift      # App entry point
├── Info.plist                      # App configuration
│
├── Models/                         # Data models
│   └── ScanData.swift             # Core data structures
│       ├── ScanData               # Scan session model
│       ├── MeshData               # 3D mesh representation
│       └── FloorPlan              # 2D floor plan model
│
├── Views/                          # SwiftUI views
│   ├── ContentView.swift          # Main navigation
│   ├── ScannerView.swift          # AR scanning interface
│   ├── FloorPlanDetailView.swift # Floor plan viewer
│   ├── SavedScansView.swift      # Scan history list
│   ├── SettingsView.swift        # App settings
│   └── OnboardingView.swift      # Tutorial screens
│
├── Managers/                       # Business logic
│   ├── ARManager.swift            # AR session management
│   ├── DataManager.swift          # Persistence layer
│   └── SettingsManager.swift     # User preferences
│
└── Utilities/                      # Helper classes
    └── FloorPlanGenerator.swift   # 3D to 2D conversion
```

## Key Components

### 1. ARManager (ARManager.swift:1)
Manages the AR session and LiDAR scanning process.

**Key Responsibilities:**
- AR session lifecycle management
- LiDAR mesh data capture
- Real-time mesh anchor processing
- Session error handling

**Key Methods:**
- `startSession()` - Initializes AR session with scene reconstruction
- `startScanning()` - Begins collecting mesh data
- `stopScanning()` - Finalizes scan and returns mesh data
- `processMeshAnchor()` - Extracts vertices, normals, and faces from mesh anchors

### 2. FloorPlanGenerator (FloorPlanGenerator.swift:1)
Converts 3D mesh data into 2D floor plans.

**Algorithm Overview:**

1. **Floor Detection** (FloorPlanGenerator.swift:48)
   - Creates histogram of Y-coordinates
   - Identifies most common height as floor level
   - Uses 5cm buckets for clustering

2. **2D Projection** (FloorPlanGenerator.swift:62)
   - Projects 3D vertices onto XZ plane (top-down view)
   - Maintains spatial relationships

3. **Wall Detection** (FloorPlanGenerator.swift:70)
   - Identifies vertical surfaces using surface normals
   - Groups points with horizontal normals (walls)
   - Uses grid-based clustering (10cm cells)
   - Connects adjacent cells to form wall segments

4. **Line Fitting** (FloorPlanGenerator.swift:145)
   - Applies Principal Component Analysis (PCA)
   - Fits lines to wall point clusters
   - Calculates wall endpoints and dimensions

5. **Wall Processing** (FloorPlanGenerator.swift:201)
   - Snaps walls to cardinal directions (0°, 90°, 180°, 270°)
   - Merges nearby parallel walls
   - Connects wall endpoints within threshold

6. **Opening Detection** (FloorPlanGenerator.swift:279)
   - Samples points along walls
   - Identifies gaps in geometry (doors/windows)
   - Filters by typical door width (0.6m - 1.2m)

7. **Room Identification** (FloorPlanGenerator.swift:315)
   - Creates room boundaries from wall topology
   - Calculates room areas using polygon math
   - Identifies room centers for labeling

### 3. DataManager (DataManager.swift:1)
Handles data persistence and export functionality.

**Features:**
- File-based storage in Documents directory
- JSON serialization for scan metadata
- PDF generation using UIGraphicsPDFRenderer
- PNG export using UIGraphicsImageRenderer
- iOS share sheet integration

### 4. ScannerView (ScannerView.swift:1)
Main AR scanning interface with real-time feedback.

**UI Components:**
- ARViewContainer - Wraps ARView for SwiftUI
- Status display with progress bar
- Scanning guidance messages
- Control buttons (Start/Stop/Pause)
- Processing overlay during floor plan generation

## Technical Implementation Details

### LiDAR Mesh Capture

The app uses ARKit's scene reconstruction to capture LiDAR data:

```swift
let configuration = ARWorldTrackingConfiguration()
configuration.sceneReconstruction = .meshWithClassification
configuration.planeDetection = [.horizontal, .vertical]
configuration.frameSemantics = [.sceneDepth, .smoothedSceneDepth]
```

### Coordinate System

- **3D Space (ARKit):**
  - X: Right
  - Y: Up
  - Z: Back (away from user)

- **2D Floor Plan:**
  - X: Horizontal axis
  - Z: Depth axis (Y is projected out for top-down view)

### Wall Detection Algorithm

The wall detection uses surface normal analysis:

1. Filter vertices with horizontal normals (vertical surfaces)
2. Grid-based spatial clustering
3. Connected component analysis
4. PCA-based line fitting
5. Cardinal direction snapping (±15° threshold)

### Performance Optimizations

- Mesh processing runs on background queue
- Progress calculation uses time + vertex count heuristic
- Grid-based clustering reduces O(n²) comparisons
- Minimal UI updates during scanning

## Usage Guide

### Scanning a Space

1. **Prepare the Space**
   - Ensure good lighting
   - Clear line of sight to walls
   - Remove obstacles if possible

2. **Start Scanning**
   - Tap "New Scan"
   - Grant camera permissions
   - Tap "Start Scanning"

3. **Scan Technique**
   - Move slowly and steadily
   - Point camera at walls and corners
   - Maintain 1-3 meters distance from walls
   - Cover entire perimeter of room
   - Include doorways and openings

4. **Stop & Process**
   - Tap "Stop & Generate Floor Plan"
   - Wait for processing (5-10 seconds)
   - Review generated floor plan

5. **Save & Export**
   - Enter scan name
   - Review dimensions
   - Export as PDF or PNG
   - Share via iOS share sheet

### Tips for Best Results

- **Lighting:** Natural daylight or bright indoor lighting works best
- **Speed:** Move at walking pace, don't rush
- **Coverage:** Scan all walls, even behind furniture
- **Distance:** Stay 1-3 meters from walls for optimal data
- **Corners:** Pay extra attention to room corners
- **Openings:** Scan around doors and windows clearly

## Troubleshooting

### "LiDAR Not Available"
- Ensure device has LiDAR sensor (iPhone 12 Pro or later)
- Check iOS version (14.0+)

### Poor Floor Plan Quality
- Scan more slowly
- Ensure good lighting
- Cover all areas thoroughly
- Increase scan time (30+ seconds recommended)

### App Crashes During Scanning
- Close other apps to free memory
- Restart device
- Ensure sufficient storage space

### Walls Not Detected
- Scan closer to walls (1-2 meters optimal)
- Increase scan coverage of wall surfaces
- Ensure walls are not reflective or transparent

## Customization

### Adjusting Detection Parameters

Edit `FloorPlanGenerator.swift` to tune detection:

```swift
// Wall detection thresholds
private let wallThicknessThreshold: Float = 0.15  // 15cm
private let minWallLength: Float = 0.3            // 30cm
private let wallHeightRange: ClosedRange<Float> = 0.5...3.0

// Angle snapping
private let wallAngleSnapThreshold: Float = 15.0  // degrees

// Door detection
private let doorWidthRange: ClosedRange<Float> = 0.6...1.2  // meters
```

### Changing UI Colors

Edit individual view files to customize appearance:

```swift
// Example: Change primary color
.background(Color.blue)  // Change to .green, .purple, etc.
```

### Adding New Export Formats

Extend `DataManager.swift` to add new export formats:

```swift
func exportFloorPlanAsJSON(scan: ScanData) -> URL? {
    // Implement JSON export
}
```

## Known Limitations

1. **Room Segmentation:** Current implementation creates one main room; advanced room separation is TODO
2. **Furniture Detection:** Does not distinguish between walls and furniture
3. **Ceiling Height:** Assumes standard ceiling height (not measured)
4. **Outdoor Use:** Not designed for outdoor scanning
5. **Large Spaces:** Performance may degrade in very large spaces (>200m²)

## Future Enhancements

- [ ] Advanced room segmentation algorithm
- [ ] Furniture detection and classification
- [ ] Multi-floor support
- [ ] Cloud synchronization
- [ ] Collaborative scanning
- [ ] AR preview of floor plan overlay
- [ ] 3D model export (OBJ, USDZ)
- [ ] Measurement tools in AR view
- [ ] Custom room labels and notes
- [ ] Integration with CAD software

## Contributing

Contributions are welcome! Please follow these guidelines:

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

This project is provided as-is for educational and development purposes.

## Credits

**Frameworks Used:**
- ARKit - Apple's augmented reality framework
- RealityKit - 3D rendering and AR experiences
- SwiftUI - Modern UI framework
- simd - Vector and matrix mathematics

**Algorithm References:**
- Principal Component Analysis for line fitting
- RANSAC for robust plane detection
- Grid-based spatial clustering

## Support

For issues, questions, or suggestions:
- Open an issue on GitHub
- Check existing issues for solutions
- Review this README thoroughly

## Changelog

### Version 1.0 (Initial Release)
- ✅ Core LiDAR scanning functionality
- ✅ Real-time AR view with mesh visualization
- ✅ Automatic floor plan generation
- ✅ Wall and door detection
- ✅ PDF and PNG export
- ✅ Metric and imperial units
- ✅ Local data persistence
- ✅ Onboarding tutorial
- ✅ Settings management

---

**Built with ❤️ using Swift and ARKit**

For questions or feedback about this project, please open an issue on GitHub.
