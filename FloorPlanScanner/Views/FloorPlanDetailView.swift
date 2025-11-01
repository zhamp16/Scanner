//
//  FloorPlanDetailView.swift
//  FloorPlanScanner
//
//  Detailed view of generated floor plan with zoom and pan
//

import SwiftUI

struct FloorPlanDetailView: View {
    let scan: ScanData
    @Environment(\.presentationMode) var presentationMode
    @EnvironmentObject var dataManager: DataManager
    @EnvironmentObject var settingsManager: SettingsManager

    @State private var scale: CGFloat = 1.0
    @State private var lastScale: CGFloat = 1.0
    @State private var offset: CGSize = .zero
    @State private var lastOffset: CGSize = .zero
    @State private var showShareSheet = false
    @State private var shareURL: URL?
    @State private var showExportOptions = false

    var body: some View {
        NavigationView {
            ZStack {
                Color.white.edgesIgnoringSafeArea(.all)

                if let floorPlan = scan.floorPlan {
                    VStack(spacing: 0) {
                        // Floor Plan Canvas
                        GeometryReader { geometry in
                            ZStack {
                                Color.gray.opacity(0.1)

                                FloorPlanCanvas(floorPlan: floorPlan)
                                    .scaleEffect(scale)
                                    .offset(offset)
                                    .gesture(
                                        MagnificationGesture()
                                            .onChanged { value in
                                                let delta = value / lastScale
                                                lastScale = value
                                                scale *= delta
                                            }
                                            .onEnded { _ in
                                                lastScale = 1.0
                                            }
                                    )
                                    .simultaneousGesture(
                                        DragGesture()
                                            .onChanged { value in
                                                offset = CGSize(
                                                    width: lastOffset.width + value.translation.width,
                                                    height: lastOffset.height + value.translation.height
                                                )
                                            }
                                            .onEnded { _ in
                                                lastOffset = offset
                                            }
                                    )
                            }
                        }

                        // Info Panel
                        VStack(spacing: 12) {
                            Divider()

                            HStack(spacing: 24) {
                                VStack(alignment: .leading, spacing: 4) {
                                    Text("Total Area")
                                        .font(.caption)
                                        .foregroundColor(.secondary)
                                    Text(settingsManager.formatArea(floorPlan.dimensions.totalArea))
                                        .font(.title2)
                                        .fontWeight(.bold)
                                }

                                Divider()
                                    .frame(height: 40)

                                VStack(alignment: .leading, spacing: 4) {
                                    Text("Walls")
                                        .font(.caption)
                                        .foregroundColor(.secondary)
                                    Text("\(floorPlan.walls.count)")
                                        .font(.title2)
                                        .fontWeight(.bold)
                                }

                                Divider()
                                    .frame(height: 40)

                                VStack(alignment: .leading, spacing: 4) {
                                    Text("Rooms")
                                        .font(.caption)
                                        .foregroundColor(.secondary)
                                    Text("\(floorPlan.rooms.count)")
                                        .font(.title2)
                                        .fontWeight(.bold)
                                }
                            }
                            .padding()

                            // Control buttons
                            HStack(spacing: 16) {
                                Button(action: {
                                    resetZoom()
                                }) {
                                    Label("Reset View", systemImage: "arrow.counterclockwise")
                                        .font(.subheadline)
                                }
                                .buttonStyle(.bordered)

                                Spacer()

                                Button(action: {
                                    showExportOptions = true
                                }) {
                                    Label("Export", systemImage: "square.and.arrow.up")
                                        .font(.subheadline)
                                }
                                .buttonStyle(.borderedProminent)
                            }
                            .padding(.horizontal)
                            .padding(.bottom, 8)
                        }
                        .background(Color.white)
                    }
                } else {
                    VStack(spacing: 16) {
                        Image(systemName: "exclamationmark.triangle")
                            .font(.system(size: 50))
                            .foregroundColor(.orange)

                        Text("No Floor Plan Available")
                            .font(.headline)

                        Text("The floor plan could not be generated from the scan data.")
                            .font(.subheadline)
                            .foregroundColor(.secondary)
                            .multilineTextAlignment(.center)
                            .padding(.horizontal, 32)
                    }
                }
            }
            .navigationTitle(scan.name)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Done") {
                        presentationMode.wrappedValue.dismiss()
                    }
                }
            }
            .actionSheet(isPresented: $showExportOptions) {
                ActionSheet(
                    title: Text("Export Floor Plan"),
                    message: Text("Choose export format"),
                    buttons: [
                        .default(Text("Export as PDF")) {
                            exportAsPDF()
                        },
                        .default(Text("Export as Image")) {
                            exportAsImage()
                        },
                        .cancel()
                    ]
                )
            }
            .sheet(isPresented: $showShareSheet) {
                if let url = shareURL {
                    ShareSheet(items: [url])
                }
            }
        }
    }

    private func resetZoom() {
        withAnimation(.easeInOut(duration: 0.3)) {
            scale = 1.0
            offset = .zero
            lastOffset = .zero
        }
    }

    private func exportAsPDF() {
        if let url = dataManager.exportFloorPlanAsPDF(scan: scan) {
            shareURL = url
            showShareSheet = true
        }
    }

    private func exportAsImage() {
        if let url = dataManager.exportFloorPlanAsImage(scan: scan) {
            shareURL = url
            showShareSheet = true
        }
    }
}

// MARK: - Floor Plan Canvas
struct FloorPlanCanvas: View {
    let floorPlan: FloorPlan

    var body: some View {
        GeometryReader { geometry in
            let bounds = floorPlan.dimensions.bounds
            let scaleX = geometry.size.width / bounds.width * 0.8
            let scaleY = geometry.size.height / bounds.height * 0.8
            let scale = min(scaleX, scaleY)

            let offsetX = geometry.size.width / 2 - bounds.midX * scale
            let offsetY = geometry.size.height / 2 - bounds.midY * scale

            Canvas { context, size in
                // Draw rooms (filled)
                for room in floorPlan.rooms {
                    guard room.boundary.count >= 3 else { continue }

                    var path = Path()
                    let firstPoint = transformPoint(room.boundary[0], scale: scale, offset: CGPoint(x: offsetX, y: offsetY))
                    path.move(to: firstPoint)

                    for i in 1..<room.boundary.count {
                        let point = transformPoint(room.boundary[i], scale: scale, offset: CGPoint(x: offsetX, y: offsetY))
                        path.addLine(to: point)
                    }
                    path.closeSubpath()

                    context.fill(path, with: .color(.gray.opacity(0.1)))
                }

                // Draw walls
                for wall in floorPlan.walls {
                    let start = transformPoint(wall.start, scale: scale, offset: CGPoint(x: offsetX, y: offsetY))
                    let end = transformPoint(wall.end, scale: scale, offset: CGPoint(x: offsetX, y: offsetY))

                    var path = Path()
                    path.move(to: start)
                    path.addLine(to: end)

                    context.stroke(path, with: .color(.black), lineWidth: 3)
                }

                // Draw doors
                for door in floorPlan.doors where door.type == .door {
                    let center = transformPoint(door.position, scale: scale, offset: CGPoint(x: offsetX, y: offsetY))
                    let radius = CGFloat(door.width) * scale / 2

                    var path = Path()
                    path.addArc(
                        center: center,
                        radius: radius,
                        startAngle: .degrees(0),
                        endAngle: .degrees(90),
                        clockwise: false
                    )

                    context.stroke(path, with: .color(.blue), lineWidth: 2)
                }

                // Draw room labels
                for room in floorPlan.rooms {
                    let center = transformPoint(room.center, scale: scale, offset: CGPoint(x: offsetX, y: offsetY))

                    var text = Text(room.name)
                        .font(.caption)
                        .foregroundColor(.black)

                    context.draw(text, at: center)
                }
            }
        }
    }

    private func transformPoint(_ point: SIMD2<Float>, scale: CGFloat, offset: CGPoint) -> CGPoint {
        return CGPoint(
            x: CGFloat(point.x) * scale + offset.x,
            y: CGFloat(point.y) * scale + offset.y
        )
    }
}

// MARK: - Share Sheet
struct ShareSheet: UIViewControllerRepresentable {
    let items: [Any]

    func makeUIViewController(context: Context) -> UIActivityViewController {
        let controller = UIActivityViewController(activityItems: items, applicationActivities: nil)
        return controller
    }

    func updateUIViewController(_ uiViewController: UIActivityViewController, context: Context) {}
}

struct FloorPlanDetailView_Previews: PreviewProvider {
    static var previews: some View {
        let scan = ScanData()
        FloorPlanDetailView(scan: scan)
            .environmentObject(DataManager.shared)
            .environmentObject(SettingsManager.shared)
    }
}
