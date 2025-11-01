//
//  DataManager.swift
//  FloorPlanScanner
//
//  Manages scan data persistence and storage
//

import Foundation
import UIKit

class DataManager: ObservableObject {
    static let shared = DataManager()

    @Published var scans: [ScanData] = []

    private let scansKey = "SavedScans"
    private let fileManager = FileManager.default

    private init() {
        loadScans()
    }

    // MARK: - Document Directory
    private func getDocumentsDirectory() -> URL {
        fileManager.urls(for: .documentDirectory, in: .userDomainMask)[0]
    }

    private func getScanDirectory(for scanId: UUID) -> URL {
        getDocumentsDirectory().appendingPathComponent(scanId.uuidString)
    }

    // MARK: - Save/Load Scans
    func saveScan(_ scan: ScanData) {
        // Create directory for this scan
        let scanDir = getScanDirectory(for: scan.id)

        do {
            try fileManager.createDirectory(at: scanDir, withIntermediateDirectories: true)

            // Save scan metadata
            let encoder = JSONEncoder()
            let data = try encoder.encode(scan)
            let metadataURL = scanDir.appendingPathComponent("metadata.json")
            try data.write(to: metadataURL)

            // Update scans array
            if let index = scans.firstIndex(where: { $0.id == scan.id }) {
                scans[index] = scan
            } else {
                scans.append(scan)
            }

            // Save scans list
            saveScansIndex()

        } catch {
            print("Error saving scan: \(error)")
        }
    }

    func loadScans() {
        do {
            let scansDirectory = getDocumentsDirectory()
            let scanDirs = try fileManager.contentsOfDirectory(
                at: scansDirectory,
                includingPropertiesForKeys: [.isDirectoryKey]
            )

            var loadedScans: [ScanData] = []

            for dir in scanDirs {
                guard dir.hasDirectoryPath else { continue }

                let metadataURL = dir.appendingPathComponent("metadata.json")
                guard fileManager.fileExists(atPath: metadataURL.path) else { continue }

                let data = try Data(contentsOf: metadataURL)
                let decoder = JSONDecoder()
                let scan = try decoder.decode(ScanData.self, from: data)
                loadedScans.append(scan)
            }

            scans = loadedScans.sorted { $0.timestamp > $1.timestamp }

        } catch {
            print("Error loading scans: \(error)")
        }
    }

    func deleteScan(_ scan: ScanData) {
        let scanDir = getScanDirectory(for: scan.id)

        do {
            try fileManager.removeItem(at: scanDir)
            scans.removeAll { $0.id == scan.id }
            saveScansIndex()
        } catch {
            print("Error deleting scan: \(error)")
        }
    }

    private func saveScansIndex() {
        do {
            let encoder = JSONEncoder()
            let data = try encoder.encode(scans.map { $0.id })
            let indexURL = getDocumentsDirectory().appendingPathComponent("scans_index.json")
            try data.write(to: indexURL)
        } catch {
            print("Error saving scans index: \(error)")
        }
    }

    // MARK: - Export Functions
    func exportFloorPlanAsPDF(scan: ScanData) -> URL? {
        guard let floorPlan = scan.floorPlan else { return nil }

        let pdfURL = getScanDirectory(for: scan.id).appendingPathComponent("\(scan.name).pdf")

        // Create PDF renderer
        let pageRect = CGRect(x: 0, y: 0, width: 612, height: 792) // Letter size
        let renderer = UIGraphicsPDFRenderer(bounds: pageRect)

        do {
            try renderer.writePDF(to: pdfURL) { context in
                context.beginPage()

                // Draw title
                let titleAttributes: [NSAttributedString.Key: Any] = [
                    .font: UIFont.boldSystemFont(ofSize: 24),
                    .foregroundColor: UIColor.black
                ]
                let title = scan.name as NSString
                title.draw(at: CGPoint(x: 50, y: 50), withAttributes: titleAttributes)

                // Draw timestamp
                let dateAttributes: [NSAttributedString.Key: Any] = [
                    .font: UIFont.systemFont(ofSize: 12),
                    .foregroundColor: UIColor.gray
                ]
                let dateString = DateFormatter.shortDate.string(from: scan.timestamp) as NSString
                dateString.draw(at: CGPoint(x: 50, y: 80), withAttributes: dateAttributes)

                // Draw floor plan
                let drawingRect = CGRect(x: 50, y: 120, width: 512, height: 600)
                drawFloorPlan(floorPlan, in: drawingRect, context: context.cgContext)

                // Draw dimensions
                let dimsY = drawingRect.maxY + 20
                let dimsAttributes: [NSAttributedString.Key: Any] = [
                    .font: UIFont.systemFont(ofSize: 14),
                    .foregroundColor: UIColor.black
                ]
                let areaText = String(format: "Total Area: %.2f m²", floorPlan.dimensions.totalArea) as NSString
                areaText.draw(at: CGPoint(x: 50, y: dimsY), withAttributes: dimsAttributes)
            }

            return pdfURL
        } catch {
            print("Error creating PDF: \(error)")
            return nil
        }
    }

    func exportFloorPlanAsImage(scan: ScanData) -> URL? {
        guard let floorPlan = scan.floorPlan else { return nil }

        let imageSize = CGSize(width: 2048, height: 2048)
        let renderer = UIGraphicsImageRenderer(size: imageSize)

        let image = renderer.image { context in
            // White background
            UIColor.white.setFill()
            context.fill(CGRect(origin: .zero, size: imageSize))

            // Draw floor plan
            let margin: CGFloat = 100
            let drawingRect = CGRect(
                x: margin,
                y: margin,
                width: imageSize.width - 2 * margin,
                height: imageSize.height - 2 * margin
            )
            drawFloorPlan(floorPlan, in: drawingRect, context: context.cgContext)
        }

        // Save to file
        let imageURL = getScanDirectory(for: scan.id).appendingPathComponent("\(scan.name).png")

        do {
            if let data = image.pngData() {
                try data.write(to: imageURL)
                return imageURL
            }
        } catch {
            print("Error saving image: \(error)")
        }

        return nil
    }

    // MARK: - Floor Plan Drawing
    private func drawFloorPlan(_ floorPlan: FloorPlan, in rect: CGRect, context: CGContext) {
        guard !floorPlan.walls.isEmpty else { return }

        // Calculate scale to fit floor plan in rect
        let bounds = floorPlan.dimensions.bounds
        let scaleX = rect.width / bounds.width
        let scaleY = rect.height / bounds.height
        let scale = min(scaleX, scaleY) * 0.9 // Leave 10% margin

        // Center the floor plan
        let scaledWidth = bounds.width * scale
        let scaledHeight = bounds.height * scale
        let offsetX = rect.midX - scaledWidth / 2 - CGFloat(bounds.origin.x) * scale
        let offsetY = rect.midY - scaledHeight / 2 - CGFloat(bounds.origin.y) * scale

        // Helper function to transform coordinates
        func transform(_ point: SIMD2<Float>) -> CGPoint {
            return CGPoint(
                x: offsetX + CGFloat(point.x) * scale,
                y: offsetY + CGFloat(point.y) * scale
            )
        }

        // Draw rooms (filled)
        context.setFillColor(UIColor.systemGray6.cgColor)
        for room in floorPlan.rooms {
            guard room.boundary.count >= 3 else { continue }

            context.beginPath()
            context.move(to: transform(room.boundary[0]))
            for i in 1..<room.boundary.count {
                context.addLine(to: transform(room.boundary[i]))
            }
            context.closePath()
            context.fillPath()
        }

        // Draw walls
        context.setStrokeColor(UIColor.black.cgColor)
        context.setLineWidth(3.0)

        for wall in floorPlan.walls {
            let start = transform(wall.start)
            let end = transform(wall.end)

            context.beginPath()
            context.move(to: start)
            context.addLine(to: end)
            context.strokePath()
        }

        // Draw doors
        context.setStrokeColor(UIColor.systemBlue.cgColor)
        context.setLineWidth(2.0)

        for door in floorPlan.doors where door.type == .door {
            let center = transform(door.position)
            let radius: CGFloat = CGFloat(door.width) * scale / 2

            context.beginPath()
            context.addArc(
                center: center,
                radius: radius,
                startAngle: 0,
                endAngle: .pi / 2,
                clockwise: false
            )
            context.strokePath()
        }

        // Draw room labels
        let textAttributes: [NSAttributedString.Key: Any] = [
            .font: UIFont.systemFont(ofSize: 14),
            .foregroundColor: UIColor.darkGray
        ]

        for room in floorPlan.rooms {
            let center = transform(room.center)
            let nameString = room.name as NSString
            let textSize = nameString.size(withAttributes: textAttributes)
            let textRect = CGRect(
                x: center.x - textSize.width / 2,
                y: center.y - textSize.height / 2,
                width: textSize.width,
                height: textSize.height
            )
            nameString.draw(in: textRect, withAttributes: textAttributes)

            // Draw area below name
            let areaString = String(format: "%.1f m²", room.area) as NSString
            let areaSize = areaString.size(withAttributes: textAttributes)
            let areaRect = CGRect(
                x: center.x - areaSize.width / 2,
                y: center.y + textSize.height / 2 + 4,
                width: areaSize.width,
                height: areaSize.height
            )
            areaString.draw(in: areaRect, withAttributes: textAttributes)
        }
    }
}
