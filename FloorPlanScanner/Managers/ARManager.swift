//
//  ARManager.swift
//  FloorPlanScanner
//
//  Manages AR session and LiDAR scanning
//

import Foundation
import ARKit
import RealityKit
import Combine

class ARManager: NSObject, ObservableObject {
    static let shared = ARManager()

    // MARK: - Published Properties
    @Published var isSessionRunning = false
    @Published var isScanning = false
    @Published var scanProgress: Float = 0.0
    @Published var meshAnchors: [ARMeshAnchor] = []
    @Published var sessionError: String?
    @Published var scanningStatus: String = "Ready to scan"

    // MARK: - AR Session
    let arSession = ARSession()
    private var sceneReconstruction: ARWorldTrackingConfiguration.SceneReconstruction = .meshWithClassification

    // MARK: - Mesh Data
    private var collectedMeshData: MeshData?
    private var scannedVertices: [SIMD3<Float>] = []
    private var scannedNormals: [SIMD3<Float>] = []
    private var scannedFaces: [[Int32]] = []

    // MARK: - Scanning State
    private var scanStartTime: Date?
    private var lastUpdateTime: Date?

    override private init() {
        super.init()
        arSession.delegate = self
    }

    // MARK: - LiDAR Availability Check
    func isLiDARAvailable() -> Bool {
        return ARWorldTrackingConfiguration.supportsSceneReconstruction(.meshWithClassification)
    }

    // MARK: - Session Management
    func startSession() {
        guard isLiDARAvailable() else {
            sessionError = "LiDAR not available on this device"
            return
        }

        let configuration = ARWorldTrackingConfiguration()
        configuration.sceneReconstruction = sceneReconstruction
        configuration.planeDetection = [.horizontal, .vertical]
        configuration.environmentTexturing = .automatic

        // Enable frame semantics for better scene understanding
        if ARWorldTrackingConfiguration.supportsFrameSemantics(.sceneDepth) {
            configuration.frameSemantics.insert(.sceneDepth)
        }
        if ARWorldTrackingConfiguration.supportsFrameSemantics(.smoothedSceneDepth) {
            configuration.frameSemantics.insert(.smoothedSceneDepth)
        }

        arSession.run(configuration, options: [.resetTracking, .removeExistingAnchors])
        isSessionRunning = true
        sessionError = nil
        scanningStatus = "Session started"
    }

    func pauseSession() {
        arSession.pause()
        isSessionRunning = false
        isScanning = false
        scanningStatus = "Session paused"
    }

    func resetSession() {
        arSession.pause()
        meshAnchors.removeAll()
        scannedVertices.removeAll()
        scannedNormals.removeAll()
        scannedFaces.removeAll()
        collectedMeshData = nil
        scanProgress = 0.0
        isScanning = false
        isSessionRunning = false
        scanStartTime = nil
        lastUpdateTime = nil
        scanningStatus = "Session reset"
    }

    // MARK: - Scanning Control
    func startScanning() {
        guard isSessionRunning else {
            startSession()
            return
        }

        isScanning = true
        scanStartTime = Date()
        lastUpdateTime = Date()
        scannedVertices.removeAll()
        scannedNormals.removeAll()
        scannedFaces.removeAll()
        scanProgress = 0.0
        scanningStatus = "Scanning... Move around the room"
    }

    func stopScanning() -> MeshData? {
        isScanning = false
        scanningStatus = "Processing scan data..."

        // Compile all collected mesh data
        collectedMeshData = MeshData(
            vertices: scannedVertices,
            normals: scannedNormals,
            faces: scannedFaces
        )

        scanningStatus = "Scan completed"
        return collectedMeshData
    }

    // MARK: - Mesh Data Processing
    private func processMeshAnchor(_ anchor: ARMeshAnchor) {
        let geometry = anchor.geometry

        // Extract vertices
        let vertices = geometry.vertices
        let vertexCount = vertices.count
        let vertexBuffer = vertices.buffer.contents()

        // Extract normals
        let normals = geometry.normals
        let normalBuffer = normals.buffer.contents()

        // Extract faces (triangles)
        let faces = geometry.faces
        let faceCount = faces.count
        let faceBuffer = faces.buffer.contents()

        // Transform to world coordinates
        let transform = anchor.transform

        // Process vertices and normals
        for i in 0..<vertexCount {
            let vertexPointer = vertexBuffer.advanced(by: i * vertices.stride)
            let vertex = vertexPointer.assumingMemoryBound(to: SIMD3<Float>.self).pointee

            // Transform to world space
            let worldVertex = simd_make_float3(
                transform * simd_float4(vertex.x, vertex.y, vertex.z, 1.0)
            )
            scannedVertices.append(worldVertex)

            // Transform normals
            let normalPointer = normalBuffer.advanced(by: i * normals.stride)
            let normal = normalPointer.assumingMemoryBound(to: SIMD3<Float>.self).pointee
            let worldNormal = simd_make_float3(
                transform * simd_float4(normal.x, normal.y, normal.z, 0.0)
            )
            scannedNormals.append(normalize(worldNormal))
        }

        // Process faces
        let bytesPerIndex = faces.bytesPerIndex
        for i in 0..<faceCount {
            let facePointer = faceBuffer.advanced(by: i * faces.indexCountPerPrimitive * bytesPerIndex)

            var faceIndices: [Int32] = []
            for j in 0..<faces.indexCountPerPrimitive {
                let indexPointer = facePointer.advanced(by: j * bytesPerIndex)
                let index: Int32
                if bytesPerIndex == 2 {
                    index = Int32(indexPointer.assumingMemoryBound(to: UInt16.self).pointee)
                } else {
                    index = indexPointer.assumingMemoryBound(to: Int32.self).pointee
                }
                faceIndices.append(index)
            }
            scannedFaces.append(faceIndices)
        }

        // Update progress based on mesh coverage
        updateScanProgress()
    }

    private func updateScanProgress() {
        guard let startTime = scanStartTime else { return }

        // Simple progress calculation based on time and mesh density
        let elapsedTime = Date().timeIntervalSince(startTime)
        let timeProgress = min(Float(elapsedTime / 30.0), 0.7) // 30 seconds for 70% progress

        let vertexProgress = min(Float(scannedVertices.count) / 100000.0, 0.3) // Up to 30% for vertex count

        scanProgress = timeProgress + vertexProgress

        // Update status messages
        if scanProgress < 0.3 {
            scanningStatus = "Scanning... Point camera at walls"
        } else if scanProgress < 0.6 {
            scanningStatus = "Good! Continue scanning corners"
        } else {
            scanningStatus = "Almost done! Scan any missed areas"
        }
    }

    // MARK: - Helper Functions
    func getCurrentFrame() -> ARFrame? {
        return arSession.currentFrame
    }

    func getCameraTransform() -> simd_float4x4? {
        return arSession.currentFrame?.camera.transform
    }
}

// MARK: - ARSessionDelegate
extension ARManager: ARSessionDelegate {
    func session(_ session: ARSession, didAdd anchors: [ARAnchor]) {
        for anchor in anchors {
            if let meshAnchor = anchor as? ARMeshAnchor {
                DispatchQueue.main.async {
                    self.meshAnchors.append(meshAnchor)
                    if self.isScanning {
                        self.processMeshAnchor(meshAnchor)
                    }
                }
            }
        }
    }

    func session(_ session: ARSession, didUpdate anchors: [ARAnchor]) {
        for anchor in anchors {
            if let meshAnchor = anchor as? ARMeshAnchor {
                DispatchQueue.main.async {
                    // Update existing anchor
                    if let index = self.meshAnchors.firstIndex(where: { $0.identifier == meshAnchor.identifier }) {
                        self.meshAnchors[index] = meshAnchor
                    }

                    if self.isScanning {
                        self.processMeshAnchor(meshAnchor)
                    }
                }
            }
        }
    }

    func session(_ session: ARSession, didRemove anchors: [ARAnchor]) {
        for anchor in anchors {
            if let meshAnchor = anchor as? ARMeshAnchor {
                DispatchQueue.main.async {
                    self.meshAnchors.removeAll { $0.identifier == meshAnchor.identifier }
                }
            }
        }
    }

    func session(_ session: ARSession, didFailWithError error: Error) {
        DispatchQueue.main.async {
            self.sessionError = error.localizedDescription
            self.scanningStatus = "Error: \(error.localizedDescription)"
        }
    }

    func sessionWasInterrupted(_ session: ARSession) {
        DispatchQueue.main.async {
            self.scanningStatus = "Session interrupted"
        }
    }

    func sessionInterruptionEnded(_ session: ARSession) {
        DispatchQueue.main.async {
            self.scanningStatus = "Session resumed"
        }
    }
}
