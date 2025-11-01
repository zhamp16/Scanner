//
//  SettingsManager.swift
//  FloorPlanScanner
//
//  Manages app settings and preferences
//

import Foundation

class SettingsManager: ObservableObject {
    static let shared = SettingsManager()

    @Published var measurementUnit: MeasurementUnit {
        didSet {
            UserDefaults.standard.set(measurementUnit.rawValue, forKey: "measurementUnit")
        }
    }

    @Published var hasCompletedOnboarding: Bool {
        didSet {
            UserDefaults.standard.set(hasCompletedOnboarding, forKey: "hasCompletedOnboarding")
        }
    }

    @Published var showMeshDuringScanning: Bool {
        didSet {
            UserDefaults.standard.set(showMeshDuringScanning, forKey: "showMeshDuringScanning")
        }
    }

    @Published var autoGenerateFloorPlan: Bool {
        didSet {
            UserDefaults.standard.set(autoGenerateFloorPlan, forKey: "autoGenerateFloorPlan")
        }
    }

    enum MeasurementUnit: String, CaseIterable {
        case metric = "Metric"
        case imperial = "Imperial"

        var areaUnit: String {
            switch self {
            case .metric: return "m²"
            case .imperial: return "ft²"
            }
        }

        var lengthUnit: String {
            switch self {
            case .metric: return "m"
            case .imperial: return "ft"
            }
        }

        func convertLength(_ meters: Float) -> Float {
            switch self {
            case .metric: return meters
            case .imperial: return meters * 3.28084 // Convert to feet
            }
        }

        func convertArea(_ squareMeters: Float) -> Float {
            switch self {
            case .metric: return squareMeters
            case .imperial: return squareMeters * 10.7639 // Convert to square feet
            }
        }
    }

    private init() {
        // Load saved settings
        let unitString = UserDefaults.standard.string(forKey: "measurementUnit") ?? MeasurementUnit.metric.rawValue
        self.measurementUnit = MeasurementUnit(rawValue: unitString) ?? .metric

        self.hasCompletedOnboarding = UserDefaults.standard.bool(forKey: "hasCompletedOnboarding")
        self.showMeshDuringScanning = UserDefaults.standard.object(forKey: "showMeshDuringScanning") as? Bool ?? true
        self.autoGenerateFloorPlan = UserDefaults.standard.object(forKey: "autoGenerateFloorPlan") as? Bool ?? true
    }

    func formatLength(_ meters: Float) -> String {
        let value = measurementUnit.convertLength(meters)
        return String(format: "%.2f %@", value, measurementUnit.lengthUnit)
    }

    func formatArea(_ squareMeters: Float) -> String {
        let value = measurementUnit.convertArea(squareMeters)
        return String(format: "%.2f %@", value, measurementUnit.areaUnit)
    }

    func resetToDefaults() {
        measurementUnit = .metric
        hasCompletedOnboarding = false
        showMeshDuringScanning = true
        autoGenerateFloorPlan = true
    }
}
