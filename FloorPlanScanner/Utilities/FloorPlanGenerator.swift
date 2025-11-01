//
//  FloorPlanGenerator.swift
//  FloorPlanScanner
//
//  Converts 3D mesh data to 2D floor plans
//

import Foundation
import simd
import CoreGraphics

class FloorPlanGenerator {

    // MARK: - Configuration
    private let wallThicknessThreshold: Float = 0.15 // 15cm
    private let minWallLength: Float = 0.3 // 30cm minimum wall length
    private let wallHeightRange: ClosedRange<Float> = 0.5...3.0 // Heights considered as walls
    private let floorHeightTolerance: Float = 0.1 // 10cm tolerance for floor detection
    private let wallAngleSnapThreshold: Float = 15.0 // Degrees to snap to cardinal directions
    private let doorWidthRange: ClosedRange<Float> = 0.6...1.2 // Typical door width range

    // MARK: - Main Processing Function
    func generateFloorPlan(from meshData: MeshData) -> FloorPlan {
        var floorPlan = FloorPlan()

        // Step 1: Identify the floor plane and height
        let floorHeight = detectFloorHeight(from: meshData)

        // Step 2: Project vertices onto 2D plane (top-down view)
        let projectedPoints = projectTo2D(meshData: meshData, floorHeight: floorHeight)

        // Step 3: Detect vertical surfaces (walls)
        let wallSegments = detectWalls(from: meshData, floorHeight: floorHeight)

        // Step 4: Process and clean wall segments
        let processedWalls = processWalls(wallSegments)

        // Step 5: Detect openings (doors, windows)
        let openings = detectOpenings(from: meshData, walls: processedWalls, floorHeight: floorHeight)

        // Step 6: Identify rooms
        let rooms = identifyRooms(from: processedWalls, openings: openings)

        // Step 7: Calculate dimensions
        let dimensions = calculateDimensions(walls: processedWalls, rooms: rooms)

        // Assemble floor plan
        floorPlan.walls = processedWalls
        floorPlan.rooms = rooms
        floorPlan.doors = openings
        floorPlan.dimensions = dimensions

        return floorPlan
    }

    // MARK: - Floor Detection
    private func detectFloorHeight(from meshData: MeshData) -> Float {
        // Find the most common Y coordinate (height) - this is likely the floor
        var heightHistogram: [Float: Int] = [:]
        let bucketSize: Float = 0.05 // 5cm buckets

        for vertex in meshData.vertices {
            let bucket = round(vertex.y / bucketSize) * bucketSize
            heightHistogram[bucket, default: 0] += 1
        }

        // Find the bucket with most points
        let floorHeight = heightHistogram.max(by: { $0.value < $1.value })?.key ?? 0.0
        return floorHeight
    }

    // MARK: - 2D Projection
    private func projectTo2D(meshData: MeshData, floorHeight: Float) -> [SIMD2<Float>] {
        return meshData.vertices.map { vertex in
            SIMD2<Float>(vertex.x, vertex.z) // Use X and Z axes for top-down view
        }
    }

    // MARK: - Wall Detection
    private func detectWalls(from meshData: MeshData, floorHeight: Float) -> [FloorPlan.Wall] {
        var wallSegments: [FloorPlan.Wall] = []

        // Group vertices by vertical surfaces
        // A vertical surface has vertices with similar X,Z but varying Y
        var verticalSurfaces: [[SIMD3<Float>]] = []

        // Simple approach: cluster points with similar normals pointing horizontally
        let horizontalNormalThreshold: Float = 0.7 // cos(45°) ≈ 0.7

        var verticalPoints: [SIMD3<Float>] = []
        for i in 0..<meshData.vertices.count {
            guard i < meshData.normals.count else { continue }

            let normal = meshData.normals[i]
            let vertex = meshData.vertices[i]

            // Check if normal is pointing horizontally (vertical wall)
            let horizontalComponent = sqrt(normal.x * normal.x + normal.z * normal.z)

            if horizontalComponent > horizontalNormalThreshold &&
               vertex.y >= floorHeight - floorHeightTolerance &&
               vertex.y <= floorHeight + wallHeightRange.upperBound {
                verticalPoints.append(vertex)
            }
        }

        // Cluster vertical points into wall segments using a simple grid-based approach
        let gridSize: Float = 0.1 // 10cm grid cells
        var grid: [SIMD2<Int>: [SIMD3<Float>]] = [:]

        for point in verticalPoints {
            let gridPos = SIMD2<Int>(
                Int(point.x / gridSize),
                Int(point.z / gridSize)
            )
            grid[gridPos, default: []].append(point)
        }

        // Extract wall lines from grid cells with sufficient points
        let minPointsPerCell = 5

        var processedCells: Set<SIMD2<Int>> = []

        for (gridPos, points) in grid where points.count >= minPointsPerCell {
            guard !processedCells.contains(gridPos) else { continue }

            // Find connected cells (wall segments)
            var wallPoints: [SIMD3<Float>] = []
            var cellsToProcess: [SIMD2<Int>] = [gridPos]
            var visitedCells: Set<SIMD2<Int>> = []

            while !cellsToProcess.isEmpty {
                let currentCell = cellsToProcess.removeFirst()
                guard !visitedCells.contains(currentCell) else { continue }
                visitedCells.insert(currentCell)

                if let cellPoints = grid[currentCell], cellPoints.count >= minPointsPerCell {
                    wallPoints.append(contentsOf: cellPoints)

                    // Check neighboring cells
                    for dx in -1...1 {
                        for dz in -1...1 {
                            if dx == 0 && dz == 0 { continue }
                            let neighbor = SIMD2<Int>(currentCell.x + dx, currentCell.y + dz)
                            if !visitedCells.contains(neighbor) {
                                cellsToProcess.append(neighbor)
                            }
                        }
                    }
                }
            }

            processedCells.formUnion(visitedCells)

            // Fit a line to these points (2D - using X and Z)
            if wallPoints.count >= minPointsPerCell {
                if let wallSegment = fitLineToPoints(wallPoints, floorHeight: floorHeight) {
                    wallSegments.append(wallSegment)
                }
            }
        }

        return wallSegments
    }

    // MARK: - Line Fitting
    private func fitLineToPoints(_ points: [SIMD3<Float>], floorHeight: Float) -> FloorPlan.Wall? {
        guard points.count >= 2 else { return nil }

        // Use 2D points (X, Z) for line fitting
        let points2D = points.map { SIMD2<Float>($0.x, $0.z) }

        // Calculate centroid
        var centroid = SIMD2<Float>(0, 0)
        for point in points2D {
            centroid += point
        }
        centroid /= Float(points2D.count)

        // Calculate covariance matrix for principal component analysis
        var xx: Float = 0, xz: Float = 0, zz: Float = 0

        for point in points2D {
            let dx = point.x - centroid.x
            let dz = point.y - centroid.y
            xx += dx * dx
            xz += dx * dz
            zz += dz * dz
        }

        // Find principal direction (eigenvector of largest eigenvalue)
        let trace = xx + zz
        let det = xx * zz - xz * xz
        let eigenvalue = trace / 2 + sqrt(max(0, trace * trace / 4 - det))

        var direction = SIMD2<Float>(xz, eigenvalue - xx)
        let length = sqrt(direction.x * direction.x + direction.y * direction.y)
        if length > 0 {
            direction /= length
        } else {
            direction = SIMD2<Float>(1, 0)
        }

        // Project points onto the line and find extents
        var minProj: Float = .infinity
        var maxProj: Float = -.infinity

        for point in points2D {
            let proj = dot(point - centroid, direction)
            minProj = min(minProj, proj)
            maxProj = max(maxProj, proj)
        }

        // Calculate wall endpoints
        let start = centroid + direction * minProj
        let end = centroid + direction * maxProj

        // Calculate average wall height
        let avgHeight = points.map { $0.y }.reduce(0, +) / Float(points.count) - floorHeight

        // Only include if wall is long enough
        let wallLength = distance(start, end)
        guard wallLength >= minWallLength else { return nil }

        return FloorPlan.Wall(
            start: start,
            end: end,
            thickness: wallThicknessThreshold,
            height: avgHeight
        )
    }

    // MARK: - Wall Processing
    private func processWalls(_ walls: [FloorPlan.Wall]) -> [FloorPlan.Wall] {
        var processed = walls

        // Snap walls to cardinal directions
        processed = processed.map { wall in
            var newWall = wall
            let angle = wall.angle
            let angleDeg = angle * 180 / .pi

            // Snap to 0, 90, 180, 270 degrees
            let cardinalAngles: [Float] = [0, 90, 180, 270, 360]
            for cardinal in cardinalAngles {
                if abs(angleDeg - cardinal) < wallAngleSnapThreshold ||
                   abs(angleDeg + 360 - cardinal) < wallAngleSnapThreshold {
                    let cardinalRad = cardinal * .pi / 180
                    let length = wall.length
                    let center = (wall.start + wall.end) / 2
                    let direction = SIMD2<Float>(cos(cardinalRad), sin(cardinalRad))

                    newWall.start = center - direction * length / 2
                    newWall.end = center + direction * length / 2
                    break
                }
            }
            return newWall
        }

        // Merge nearby parallel walls
        processed = mergeNearbyWalls(processed)

        // Connect wall endpoints that are close
        processed = connectWallEndpoints(processed)

        return processed
    }

    private func mergeNearbyWalls(_ walls: [FloorPlan.Wall]) -> [FloorPlan.Wall] {
        var merged: [FloorPlan.Wall] = []
        var used = Set<UUID>()

        for i in 0..<walls.count {
            let wall1 = walls[i]
            guard !used.contains(wall1.id) else { continue }

            var mergedWall = wall1
            used.insert(wall1.id)

            for j in (i+1)..<walls.count {
                let wall2 = walls[j]
                guard !used.contains(wall2.id) else { continue }

                // Check if walls are parallel and close
                let angle1 = wall1.angle
                let angle2 = wall2.angle
                let angleDiff = abs(angle1 - angle2)

                if angleDiff < 0.1 || angleDiff > .pi - 0.1 { // Nearly parallel
                    let dist1 = distance(wall1.start, wall2.start)
                    let dist2 = distance(wall1.end, wall2.end)

                    if dist1 < 0.3 || dist2 < 0.3 {
                        // Merge walls
                        let allPoints = [wall1.start, wall1.end, wall2.start, wall2.end]
                        let minX = allPoints.map { $0.x }.min() ?? 0
                        let maxX = allPoints.map { $0.x }.max() ?? 0
                        let minZ = allPoints.map { $0.y }.min() ?? 0
                        let maxZ = allPoints.map { $0.y }.max() ?? 0

                        mergedWall = FloorPlan.Wall(
                            start: SIMD2<Float>(minX, minZ),
                            end: SIMD2<Float>(maxX, maxZ),
                            thickness: (wall1.thickness + wall2.thickness) / 2,
                            height: max(wall1.height, wall2.height)
                        )
                        used.insert(wall2.id)
                    }
                }
            }

            merged.append(mergedWall)
        }

        return merged
    }

    private func connectWallEndpoints(_ walls: [FloorPlan.Wall]) -> [FloorPlan.Wall] {
        // Snap endpoints that are very close together
        let snapThreshold: Float = 0.2 // 20cm

        var adjusted = walls

        for i in 0..<adjusted.count {
            for j in (i+1)..<adjusted.count {
                let dist = distance(adjusted[i].end, adjusted[j].start)
                if dist < snapThreshold {
                    let midpoint = (adjusted[i].end + adjusted[j].start) / 2
                    adjusted[i].end = midpoint
                    adjusted[j].start = midpoint
                }
            }
        }

        return adjusted
    }

    // MARK: - Opening Detection
    private func detectOpenings(from meshData: MeshData, walls: [FloorPlan.Wall], floorHeight: Float) -> [FloorPlan.Opening] {
        var openings: [FloorPlan.Opening] = []

        // Look for gaps in walls at floor level - potential doors
        for wall in walls {
            // Sample points along the wall
            let samples = 20
            var gapStart: SIMD2<Float>?
            var gapWidth: Float = 0

            for i in 0...samples {
                let t = Float(i) / Float(samples)
                let point = wall.start + (wall.end - wall.start) * t

                // Check if there's a gap (no vertices near this point at floor level)
                let hasGeometry = meshData.vertices.contains { vertex in
                    let point3D = SIMD3<Float>(point.x, floorHeight + 0.5, point.y)
                    return distance(vertex, point3D) < 0.15
                }

                if !hasGeometry {
                    if gapStart == nil {
                        gapStart = point
                    }
                    gapWidth = distance(gapStart!, point)
                } else {
                    if let start = gapStart, doorWidthRange.contains(gapWidth) {
                        let doorCenter = start + (point - start) / 2
                        openings.append(FloorPlan.Opening(
                            position: doorCenter,
                            width: gapWidth,
                            wallId: wall.id,
                            type: .door
                        ))
                    }
                    gapStart = nil
                    gapWidth = 0
                }
            }
        }

        return openings
    }

    // MARK: - Room Identification
    private func identifyRooms(from walls: [FloorPlan.Wall], openings: [FloorPlan.Opening]) -> [FloorPlan.Room] {
        var rooms: [FloorPlan.Room] = []

        // Simple approach: create a bounding room from all walls
        guard !walls.isEmpty else { return rooms }

        // Find overall bounds
        var minX: Float = .infinity
        var maxX: Float = -.infinity
        var minZ: Float = .infinity
        var maxZ: Float = -.infinity

        for wall in walls {
            minX = min(minX, wall.start.x, wall.end.x)
            maxX = max(maxX, wall.start.x, wall.end.x)
            minZ = min(minZ, wall.start.y, wall.end.y)
            maxZ = max(maxZ, wall.start.y, wall.end.y)
        }

        // Create a rectangular room boundary
        let boundary = [
            SIMD2<Float>(minX, minZ),
            SIMD2<Float>(maxX, minZ),
            SIMD2<Float>(maxX, maxZ),
            SIMD2<Float>(minX, maxZ)
        ]

        let room = FloorPlan.Room(name: "Main Space", boundary: boundary)
        rooms.append(room)

        // TODO: Implement more sophisticated room segmentation using wall topology

        return rooms
    }

    // MARK: - Dimension Calculation
    private func calculateDimensions(walls: [FloorPlan.Wall], rooms: [FloorPlan.Room]) -> FloorPlan.FloorPlanDimensions {
        let totalArea = rooms.reduce(0) { $0 + $1.area }

        var perimeter: Float = 0
        for wall in walls {
            perimeter += wall.length
        }

        // Calculate overall bounds
        var minX: Float = .infinity
        var maxX: Float = -.infinity
        var minZ: Float = .infinity
        var maxZ: Float = -.infinity

        for wall in walls {
            minX = min(minX, wall.start.x, wall.end.x)
            maxX = max(maxX, wall.start.x, wall.end.x)
            minZ = min(minZ, wall.start.y, wall.end.y)
            maxZ = max(maxZ, wall.start.y, wall.end.y)
        }

        let bounds = CGRect(
            x: CGFloat(minX),
            y: CGFloat(minZ),
            width: CGFloat(maxX - minX),
            height: CGFloat(maxZ - minZ)
        )

        return FloorPlan.FloorPlanDimensions(
            totalArea: totalArea,
            perimeter: perimeter,
            bounds: bounds
        )
    }
}
