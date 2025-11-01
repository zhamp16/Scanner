//
//  ScannerView.swift
//  FloorPlanScanner
//
//  Main AR scanning interface with LiDAR visualization
//

import SwiftUI
import ARKit
import RealityKit

struct ScannerView: View {
    @StateObject private var arManager = ARManager.shared
    @EnvironmentObject var dataManager: DataManager
    @EnvironmentObject var settingsManager: SettingsManager

    @State private var showFloorPlan = false
    @State private var currentScan: ScanData?
    @State private var isProcessing = false
    @State private var showSaveDialog = false
    @State private var scanName = ""

    @Environment(\.presentationMode) var presentationMode

    var body: some View {
        ZStack {
            // AR View
            ARViewContainer(arManager: arManager)
                .edgesIgnoringSafeArea(.all)

            // Overlay UI
            VStack {
                // Top bar
                HStack {
                    Button(action: {
                        arManager.resetSession()
                        presentationMode.wrappedValue.dismiss()
                    }) {
                        Image(systemName: "xmark")
                            .font(.title2)
                            .foregroundColor(.white)
                            .padding()
                            .background(Color.black.opacity(0.6))
                            .clipShape(Circle())
                    }

                    Spacer()

                    // Status indicator
                    VStack(alignment: .trailing, spacing: 4) {
                        Text(arManager.scanningStatus)
                            .font(.subheadline)
                            .fontWeight(.semibold)
                            .foregroundColor(.white)

                        if arManager.isScanning {
                            ProgressView(value: arManager.scanProgress)
                                .progressViewStyle(LinearProgressViewStyle(tint: .green))
                                .frame(width: 150)
                        }
                    }
                    .padding()
                    .background(Color.black.opacity(0.6))
                    .cornerRadius(12)
                }
                .padding()

                Spacer()

                // Scanning guidance
                if arManager.isScanning {
                    VStack(spacing: 12) {
                        Image(systemName: "camera.viewfinder")
                            .font(.system(size: 40))
                            .foregroundColor(.white)

                        Text("Point camera at walls and corners")
                            .font(.headline)
                            .foregroundColor(.white)

                        Text("Move slowly for best results")
                            .font(.subheadline)
                            .foregroundColor(.white.opacity(0.8))
                    }
                    .padding()
                    .background(Color.black.opacity(0.6))
                    .cornerRadius(16)
                    .padding()
                }

                Spacer()

                // Control buttons
                VStack(spacing: 16) {
                    if !arManager.isScanning {
                        // Start scanning button
                        Button(action: {
                            arManager.startScanning()
                        }) {
                            HStack {
                                Image(systemName: "play.circle.fill")
                                    .font(.title2)
                                Text("Start Scanning")
                                    .font(.headline)
                            }
                            .frame(maxWidth: .infinity)
                            .padding()
                            .background(Color.green)
                            .foregroundColor(.white)
                            .cornerRadius(12)
                        }
                    } else {
                        // Stop scanning button
                        Button(action: {
                            stopAndProcess()
                        }) {
                            HStack {
                                Image(systemName: "stop.circle.fill")
                                    .font(.title2)
                                Text("Stop & Generate Floor Plan")
                                    .font(.headline)
                            }
                            .frame(maxWidth: .infinity)
                            .padding()
                            .background(Color.red)
                            .foregroundColor(.white)
                            .cornerRadius(12)
                        }
                        .disabled(arManager.scanProgress < 0.2)
                        .opacity(arManager.scanProgress < 0.2 ? 0.5 : 1.0)

                        // Pause button
                        Button(action: {
                            arManager.pauseSession()
                        }) {
                            HStack {
                                Image(systemName: "pause.circle")
                                Text("Pause")
                            }
                            .font(.subheadline)
                            .foregroundColor(.white)
                        }
                    }
                }
                .padding(.horizontal, 32)
                .padding(.bottom, 32)
            }

            // Processing overlay
            if isProcessing {
                ZStack {
                    Color.black.opacity(0.8)
                        .edgesIgnoringSafeArea(.all)

                    VStack(spacing: 20) {
                        ProgressView()
                            .progressViewStyle(CircularProgressViewStyle(tint: .white))
                            .scaleEffect(2)

                        Text("Processing scan data...")
                            .font(.headline)
                            .foregroundColor(.white)

                        Text("Generating floor plan")
                            .font(.subheadline)
                            .foregroundColor(.white.opacity(0.8))
                    }
                }
            }
        }
        .navigationBarHidden(true)
        .onAppear {
            arManager.startSession()
        }
        .onDisappear {
            arManager.pauseSession()
        }
        .sheet(isPresented: $showSaveDialog) {
            SaveScanView(scan: $currentScan, isPresented: $showSaveDialog)
        }
        .fullScreenCover(isPresented: $showFloorPlan) {
            if let scan = currentScan {
                FloorPlanDetailView(scan: scan)
            }
        }
    }

    private func stopAndProcess() {
        guard let meshData = arManager.stopScanning() else {
            return
        }

        isProcessing = true

        // Process in background
        DispatchQueue.global(qos: .userInitiated).async {
            // Generate floor plan
            let generator = FloorPlanGenerator()
            let floorPlan = generator.generateFloorPlan(from: meshData)

            // Create scan data
            var scan = ScanData()
            scan.meshData = meshData
            scan.floorPlan = floorPlan

            // Generate thumbnail (simplified)
            // In a real app, you would render the floor plan to an image

            DispatchQueue.main.async {
                self.currentScan = scan
                self.isProcessing = false

                if settingsManager.autoGenerateFloorPlan {
                    self.showSaveDialog = true
                } else {
                    self.showFloorPlan = true
                }
            }
        }
    }
}

// MARK: - AR View Container
struct ARViewContainer: UIViewRepresentable {
    let arManager: ARManager

    func makeUIView(context: Context) -> ARView {
        let arView = ARView(frame: .zero)
        arView.session = arManager.arSession

        // Configure rendering
        arView.environment.background = .color(.black)

        // Enable mesh visualization
        arView.debugOptions = [.showSceneUnderstanding]

        return arView
    }

    func updateUIView(_ uiView: ARView, context: Context) {
        // Update if needed
    }
}

// MARK: - Save Scan View
struct SaveScanView: View {
    @Binding var scan: ScanData?
    @Binding var isPresented: Bool
    @State private var scanName: String = ""
    @EnvironmentObject var dataManager: DataManager

    var body: some View {
        NavigationView {
            Form {
                Section(header: Text("Scan Details")) {
                    TextField("Scan Name", text: $scanName)
                        .textContentType(.name)
                }

                if let scan = scan, let floorPlan = scan.floorPlan {
                    Section(header: Text("Summary")) {
                        HStack {
                            Text("Total Area")
                            Spacer()
                            Text(String(format: "%.2f m²", floorPlan.dimensions.totalArea))
                                .foregroundColor(.secondary)
                        }

                        HStack {
                            Text("Walls Detected")
                            Spacer()
                            Text("\(floorPlan.walls.count)")
                                .foregroundColor(.secondary)
                        }

                        HStack {
                            Text("Rooms Detected")
                            Spacer()
                            Text("\(floorPlan.rooms.count)")
                                .foregroundColor(.secondary)
                        }

                        HStack {
                            Text("Doors Detected")
                            Spacer()
                            Text("\(floorPlan.doors.count)")
                                .foregroundColor(.secondary)
                        }
                    }
                }
            }
            .navigationTitle("Save Scan")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Cancel") {
                        isPresented = false
                    }
                }

                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Save") {
                        saveScan()
                    }
                    .fontWeight(.semibold)
                }
            }
        }
        .onAppear {
            if let scan = scan {
                scanName = scan.name
            }
        }
    }

    private func saveScan() {
        guard var scan = scan else { return }
        scan.name = scanName.isEmpty ? "Scan \(DateFormatter.shortDate.string(from: scan.timestamp))" : scanName

        dataManager.saveScan(scan)
        isPresented = false
    }
}

struct ScannerView_Previews: PreviewProvider {
    static var previews: some View {
        ScannerView()
            .environmentObject(DataManager.shared)
            .environmentObject(SettingsManager.shared)
    }
}
