//
//  ScanData.swift
//  FloorPlanScanner
//
//  Model representing a single scan session
//

import Foundation
import ARKit
import simd

struct ScanData: Identifiable, Codable {
    let id: UUID
    var name: String
    var timestamp: Date
    var meshData: MeshData?
    var floorPlan: FloorPlan?
    var thumbnailData: Data?

    init(id: UUID = UUID(), name: String = "", timestamp: Date = Date()) {
        self.id = id
        self.name = name.isEmpty ? "Scan \(DateFormatter.shortDate.string(from: timestamp))" : name
        self.timestamp = timestamp
    }
}

// Represents the 3D mesh data captured from LiDAR
struct MeshData: Codable {
    var vertices: [SIMD3<Float>]
    var normals: [SIMD3<Float>]
    var faces: [[Int32]] // Triangle indices
    var bounds: BoundingBox

    struct BoundingBox: Codable {
        var min: SIMD3<Float>
        var max: SIMD3<Float>

        var center: SIMD3<Float> {
            return (min + max) / 2
        }

        var size: SIMD3<Float> {
            return max - min
        }
    }

    init(vertices: [SIMD3<Float>] = [], normals: [SIMD3<Float>] = [], faces: [[Int32]] = []) {
        self.vertices = vertices
        self.normals = normals
        self.faces = faces

        // Calculate bounds
        if vertices.isEmpty {
            self.bounds = BoundingBox(min: SIMD3<Float>(0, 0, 0), max: SIMD3<Float>(0, 0, 0))
        } else {
            var minPoint = vertices[0]
            var maxPoint = vertices[0]

            for vertex in vertices {
                minPoint = SIMD3<Float>(
                    min(minPoint.x, vertex.x),
                    min(minPoint.y, vertex.y),
                    min(minPoint.z, vertex.z)
                )
                maxPoint = SIMD3<Float>(
                    max(maxPoint.x, vertex.x),
                    max(maxPoint.y, vertex.y),
                    max(maxPoint.z, vertex.z)
                )
            }

            self.bounds = BoundingBox(min: minPoint, max: maxPoint)
        }
    }
}

// Floor plan representation generated from mesh data
struct FloorPlan: Codable {
    var walls: [Wall]
    var rooms: [Room]
    var doors: [Opening]
    var dimensions: FloorPlanDimensions

    struct Wall: Codable, Identifiable {
        let id: UUID
        var start: SIMD2<Float>
        var end: SIMD2<Float>
        var thickness: Float
        var height: Float

        init(id: UUID = UUID(), start: SIMD2<Float>, end: SIMD2<Float>, thickness: Float = 0.15, height: Float = 2.4) {
            self.id = id
            self.start = start
            self.end = end
            self.thickness = thickness
            self.height = height
        }

        var length: Float {
            return distance(start, end)
        }

        var angle: Float {
            let delta = end - start
            return atan2(delta.y, delta.x)
        }
    }

    struct Room: Codable, Identifiable {
        let id: UUID
        var name: String
        var boundary: [SIMD2<Float>] // Polygon vertices
        var area: Float
        var center: SIMD2<Float>

        init(id: UUID = UUID(), name: String = "Room", boundary: [SIMD2<Float>]) {
            self.id = id
            self.name = name
            self.boundary = boundary
            self.area = Room.calculateArea(boundary)
            self.center = Room.calculateCenter(boundary)
        }

        static func calculateArea(_ boundary: [SIMD2<Float>]) -> Float {
            guard boundary.count >= 3 else { return 0 }

            var area: Float = 0
            for i in 0..<boundary.count {
                let j = (i + 1) % boundary.count
                area += boundary[i].x * boundary[j].y
                area -= boundary[j].x * boundary[i].y
            }
            return abs(area) / 2
        }

        static func calculateCenter(_ boundary: [SIMD2<Float>]) -> SIMD2<Float> {
            guard !boundary.isEmpty else { return SIMD2<Float>(0, 0) }

            var center = SIMD2<Float>(0, 0)
            for point in boundary {
                center += point
            }
            return center / Float(boundary.count)
        }
    }

    struct Opening: Codable, Identifiable {
        let id: UUID
        var position: SIMD2<Float>
        var width: Float
        var wallId: UUID?
        var type: OpeningType

        enum OpeningType: String, Codable {
            case door
            case window
            case opening
        }

        init(id: UUID = UUID(), position: SIMD2<Float>, width: Float, wallId: UUID? = nil, type: OpeningType = .door) {
            self.id = id
            self.position = position
            self.width = width
            self.wallId = wallId
            self.type = type
        }
    }

    struct FloorPlanDimensions: Codable {
        var totalArea: Float
        var perimeter: Float
        var bounds: CGRect

        init(totalArea: Float = 0, perimeter: Float = 0, bounds: CGRect = .zero) {
            self.totalArea = totalArea
            self.perimeter = perimeter
            self.bounds = bounds
        }
    }

    init() {
        self.walls = []
        self.rooms = []
        self.doors = []
        self.dimensions = FloorPlanDimensions()
    }
}

// MARK: - Helper Extensions

extension DateFormatter {
    static let shortDate: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateStyle = .short
        formatter.timeStyle = .short
        return formatter
    }()
}
